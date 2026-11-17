#!/usr/bin/env python3
"""
Pull issue data from the Comic Vine API (https://comicvine.gamespot.com/api/)
into the guide's data files. Standard library only.

For every issue in the catalog (src/data/issues.json, every issue once,
shared by all guides in src/data/sagas/) it:
  - finds the Comic Vine issue (series "<Name> (<year>)" -> Marvel volume,
    then issue number) and stores `comicVineId`,
  - fills `coverUrl` if missing (linked, not downloaded),
  - writes src/data/issues/<issue id>.json with the synopsis and creator
    credits (with roles),
  - sets the issue's `characters`, `creators`, `teams`, `locations`,
    `objects` and `arcs` (story arcs) tag ids, adding new entries to the
    matching dictionaries (src/data/characters.json, ..., arcs.json).

It also sets every issue's `year` and `month` from Comic Vine's cover date
(our own dates are estimates). The curated `keypoint` is never touched, and
guide files (reading order, optional) are not read or written at all.

It also fills `coverUrl` (a small square image), `comicVineUrl` (page link)
and `deck` (one-line summary) on every tag that doesn't have them yet. These use Comic
Vine's list endpoints with up to 100 ids per request, so they are cheap and
have their own rate limit.

Usage:
    python3 scripts/fetch_comicvine.py           # issues without a (complete) detail file, then images
    python3 scripts/fetch_comicvine.py --force   # redo every issue
    python3 scripts/fetch_comicvine.py --images  # images only

Resumable: progress is saved after every issue, so if Comic Vine's rate limit
(about 200 requests per resource per hour) stops the run, run it again later.
Needs COMICVINE_API_KEY in .env (git-ignored). Comic Vine requires
attribution, which is in the site footer and on each synopsis.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
ISSUES_PATH = DATA / "issues.json"
DETAIL_DIR = DATA / "issues"
CACHE_PATH = ROOT / "scripts" / ".cache" / "comicvine-volumes.json"
API = "https://comicvine.gamespot.com/api"
# Comic Vine rejects requests without a User-Agent. Keep it generic.
HEADERS = {"User-Agent": "marvel-guide-data-fetcher/1.0"}
DELAY_SECONDS = 1.2

# Tag kind -> Comic Vine field on an issue.
KINDS = {
    "characters": "character_credits",
    "creators": "person_credits",
    "teams": "team_credits",
    "locations": "location_credits",
    "objects": "object_credits",
    "arcs": "story_arc_credits",
}


class RateLimited(Exception):
    pass


# ---------------------------------------------------------------- API ----


def load_api_key() -> str:
    key = os.environ.get("COMICVINE_API_KEY", "")
    env_file = ROOT / ".env"
    if not key and env_file.exists():
        match = re.search(r"^COMICVINE_API_KEY=(.+)$", env_file.read_text(), re.M)
        if match:
            key = match.group(1)
    key = key.strip().strip('"').strip("'")
    if not key:
        sys.exit("Missing COMICVINE_API_KEY (set it in .env).")
    return key


API_KEY = load_api_key()


def api(path: str, params: dict) -> dict:
    query = urllib.parse.urlencode({"api_key": API_KEY, "format": "json", **params})
    request = urllib.request.Request(f"{API}/{path}/?{query}", headers=HEADERS)
    time.sleep(DELAY_SECONDS)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.load(response)
    except urllib.error.HTTPError as err:
        # Never echo the URL: it contains the API key.
        if err.code in (420, 429):
            raise RateLimited() from None
        raise RuntimeError(f"{path}: HTTP {err.code}") from None
    code = body.get("status_code")
    if code == 107:
        raise RateLimited()
    if code != 1:
        raise RuntimeError(f"{path}: {body.get('error')} (code {code})")
    return body


# ------------------------------------------------------------ volumes ----


def normalize(name: str) -> str:
    """'The Avengers', 'Avengers' and 'Avengers:' compare equal; so do
    'Avengers Forever' and 'Avengers: Forever'."""
    name = re.sub(r"^the\s+", "", name.lower())
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", name)).strip()


def find_volume_id(series: str) -> int | None:
    match = re.fullmatch(r"(.*)\s+\((\d{4})\)", series)
    if not match:
        raise RuntimeError(f'Series "{series}" is not in "<Name> (<year>)" form')
    name, year = match.groups()
    fields = "id,name,start_year,publisher,count_of_issues"

    def matching(results: list[dict]) -> list[dict]:
        return [
            v
            for v in results
            if (v.get("publisher") or {}).get("name") == "Marvel"
            and str(v.get("start_year")) == year
            and normalize(v.get("name") or "") == normalize(name)
        ]

    body = api("volumes", {"filter": f"name:{normalize(name)}", "field_list": fields, "limit": "100"})
    candidates = matching(body["results"])
    if not candidates:
        # The name filter misses titles with punctuation ("Avengers: Forever");
        # the search endpoint is looser.
        body = api(
            "search",
            {"query": name, "resources": "volume", "field_list": fields, "limit": "100"},
        )
        candidates = matching(body["results"])
    # Several matches (reprints, digests): the longest run is the main series.
    candidates.sort(key=lambda v: v.get("count_of_issues") or 0, reverse=True)
    if not candidates:
        return None
    best = candidates[0]
    print(f'  {series} -> "{best["name"]}" ({best["start_year"]}), volume {best["id"]}')
    return best["id"]


def volume_issues(volume_id: int) -> dict[str, dict]:
    """Issue number -> {id, cover} for every issue in a volume."""
    found: dict[str, dict] = {}
    offset = 0
    while True:
        body = api(
            "issues",
            {
                "filter": f"volume:{volume_id}",
                "field_list": "id,issue_number,image,cover_date",
                "limit": "100",
                "offset": str(offset),
            },
        )
        for issue in body["results"]:
            cover = (issue.get("image") or {}).get("medium_url")
            if cover and "blank.png" in cover:
                cover = None
            found[str(issue.get("issue_number"))] = {
                "id": issue["id"],
                "cover": cover,
                "date": issue.get("cover_date"),  # "1963-09-01", may be None
            }
        offset += 100
        if offset >= body["number_of_total_results"]:
            return found


# ----------------------------------------------------------- synopsis ----


class SynopsisParser(HTMLParser):
    """Turns Comic Vine's HTML description into heading/paragraph blocks.
    Tables (cover lists), figures and images are skipped."""

    BLOCKS = {"p": "paragraph", "li": "paragraph", "blockquote": "paragraph"}
    HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
    SKIP = {"table", "figure", "script", "style"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks: list[dict] = []
        self.skip_depth = 0
        self.kind: str | None = None
        self.text: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip_depth += 1
        elif self.skip_depth == 0 and (tag in self.BLOCKS or tag in self.HEADINGS):
            self.flush()
            self.kind = "heading" if tag in self.HEADINGS else self.BLOCKS[tag]
        elif tag == "br":
            self.text.append(" ")

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip_depth = max(0, self.skip_depth - 1)
        elif self.skip_depth == 0 and (tag in self.BLOCKS or tag in self.HEADINGS):
            self.flush()

    def handle_data(self, data):
        if self.skip_depth == 0:
            self.text.append(data)

    def flush(self):
        text = re.sub(r"\s+", " ", "".join(self.text)).strip()
        if text:
            self.blocks.append({"kind": self.kind or "paragraph", "text": text})
        self.kind = None
        self.text = []

    # Sections that list covers or credits rather than tell the story.
    SKIP_SECTIONS = re.compile(r"^(list of covers|covers?\b|credits?\b)", re.I)

    def result(self) -> list[dict]:
        self.flush()
        blocks: list[dict] = []
        skipping = False
        for b in self.blocks:
            if b["kind"] == "heading":
                skipping = bool(self.SKIP_SECTIONS.match(b["text"]))
            if not skipping:
                blocks.append(b)
        # Drop headings with no paragraph after them (e.g. above a skipped table).
        return [
            b
            for i, b in enumerate(blocks)
            if b["kind"] != "heading"
            or (i + 1 < len(blocks) and blocks[i + 1]["kind"] == "paragraph")
        ]


def parse_synopsis(html: str | None) -> list[dict]:
    if not html:
        return []
    parser = SynopsisParser()
    parser.feed(html)
    return parser.result()


def arc_name(name: str | None) -> str | None:
    """Comic Vine prefixes some arc names with the series in quotes:
    '"The Avengers" Korvac Saga' -> 'Korvac Saga'."""
    text = plain(name)
    return re.sub(r'^"[^"]+"\s+', "", text) if text else text


def plain(text: str | None) -> str | None:
    if not text:
        return None
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", text)).strip() or None


# ------------------------------------------------------- dictionaries ----


def image_url(image: dict | None) -> str | None:
    """Square avatar-sized image, or None for Comic Vine's placeholder."""
    url = (image or {}).get("icon_url")
    return None if not url or "blank" in url else url


# Tag kinds that get images and links, and their Comic Vine list resource.
IMAGE_RESOURCES = {
    "characters": "characters",
    "creators": "people",
    "teams": "teams",
    "locations": "locations",
    "objects": "objects",
    "arcs": "story_arcs",
}


def fetch_images(dictionaries: dict, save_all) -> None:
    """Fill coverUrl, comicVineUrl and deck (summary) on tags that lack them,
    100 ids per request. A deck of "" means Comic Vine has none."""
    jobs = [
        (
            kind,
            resource,
            {
                e["comicVineId"]: e
                for e in dictionaries[kind].entries
                if e.get("comicVineId")
                and not (e.get("coverUrl") and e.get("comicVineUrl") and "deck" in e)
            },
        )
        for kind, resource in IMAGE_RESOURCES.items()
    ]

    print("\nImages, links and summaries:")
    for label, resource, pending in jobs:
        ids = list(pending)
        found = 0
        try:
            for start in range(0, len(ids), 100):
                chunk = ids[start : start + 100]
                body = api(
                    resource,
                    {
                        "filter": "id:" + "|".join(str(i) for i in chunk),
                        "field_list": "id,image,site_detail_url,deck",
                        "limit": "100",
                    },
                )
                for item in body["results"]:
                    entry = pending.get(item["id"])
                    if entry is None:
                        continue
                    url = image_url(item.get("image"))
                    if url:
                        entry["coverUrl"] = url
                        found += 1
                    if item.get("site_detail_url"):
                        entry["comicVineUrl"] = item["site_detail_url"]
                    entry["deck"] = plain(item.get("deck")) or ""
                save_all()
        except RateLimited:
            print(f"  {label}: rate limit reached, run again in an hour")
        except RuntimeError as err:
            print(f"  {label}: {err}")
        print(f"  {label}: {len(ids)} looked up, {found} with an image")


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "unknown"


class Dictionary:
    """One tag dictionary file, e.g. src/data/creators.json."""

    def __init__(self, kind: str):
        self.path = DATA / f"{kind}.json"
        self.entries: list[dict] = json.loads(self.path.read_text()) if self.path.exists() else []
        self.by_cv = {e["comicVineId"]: e for e in self.entries if e.get("comicVineId")}
        self.ids = {e["id"] for e in self.entries}

    def id_for(self, cv_id: int, name: str) -> str:
        if cv_id in self.by_cv:
            return self.by_cv[cv_id]["id"]
        # Hand-made entry with the same name and no Comic Vine id yet: adopt it.
        for entry in self.entries:
            if not entry.get("comicVineId") and entry["name"].lower() == name.lower():
                entry["comicVineId"] = cv_id
                self.by_cv[cv_id] = entry
                return entry["id"]
        slug = slugify(name)
        if slug in self.ids:
            slug = f"{slug}-{cv_id}"
        entry = {"id": slug, "name": name, "comicVineId": cv_id}
        self.entries.append(entry)
        self.by_cv[cv_id] = entry
        self.ids.add(slug)
        return slug

    def prune(self, used: set[str]):
        """Drop hand-made entries that no issue uses any more."""
        self.entries = [e for e in self.entries if e["id"] in used or e.get("comicVineId")]

    def save(self):
        self.entries.sort(key=lambda e: e["name"].lower())
        self.path.write_text(
            "[\n" + ",\n".join("  " + json.dumps(e, ensure_ascii=False) for e in self.entries) + "\n]\n"
        )


# --------------------------------------------------------------- main ----


def save_issues(issues: list[dict]):
    """Catalog: one issue per line (compact, diff-friendly)."""
    lines = ",\n".join(
        "  " + json.dumps(i, ensure_ascii=False, separators=(",", ":")) for i in issues
    )
    ISSUES_PATH.write_text("[\n" + lines + "\n]\n")


def main() -> None:
    force = "--force" in sys.argv
    images_only = "--images" in sys.argv
    DETAIL_DIR.mkdir(exist_ok=True)
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)

    issues = json.loads(ISSUES_PATH.read_text())
    dictionaries = {kind: Dictionary(kind) for kind in KINDS}
    volume_cache: dict = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}

    def needs_fetch(issue: dict) -> bool:
        path = DETAIL_DIR / f"{issue['id']}.json"
        if force or not path.exists():
            return True
        # Issues fetched before story arcs became a tag kind get fetched again.
        return "arcs" not in issue

    todo = [] if images_only else [i for i in issues if needs_fetch(i)]
    print(f"{len(todo)} of {len(issues)} issues to fetch.\n")

    def save_all():
        save_issues(issues)
        for d in dictionaries.values():
            d.save()
        CACHE_PATH.write_text(json.dumps(volume_cache, indent=2) + "\n")


    done = 0
    missing: list[str] = []
    try:
        # Resolve each series to a volume and its issue ids and cover dates
        # (cached between runs; older caches without dates are refreshed).
        all_series = [] if images_only else dict.fromkeys(i["series"] for i in issues if i.get("series"))
        for series in all_series:
            cached = volume_cache.get(series, "missing")
            if cached == "missing":
                volume_id = find_volume_id(series)
                volume_cache[series] = (
                    {"volume": volume_id, "issues": volume_issues(volume_id)} if volume_id else None
                )
                save_all()
            elif cached and any("date" not in v for v in cached["issues"].values()):
                cached["issues"] = volume_issues(cached["volume"])
                print(f"  {series} -> volume {cached['volume']} (refreshed dates)")
                save_all()
            elif cached:
                print(f"  {series} -> volume {cached['volume']} (cached)")
            else:
                print(f"  {series} -> no matching Marvel volume (cached)")
        print()

        # Real cover dates for every issue we can match.
        redated = 0
        for issue in issues:
            volume = volume_cache.get(issue.get("series") or "")
            match = (volume or {}).get("issues", {}).get(str(issue["issueNumber"]))
            date = re.match(r"(\d{4})-(\d{2})", (match or {}).get("date") or "")
            if date:
                year, month = int(date.group(1)), int(date.group(2))
                if (issue.get("year"), issue.get("month")) != (year, month):
                    issue["year"], issue["month"] = year, month
                    redated += 1
        if redated:
            print(f"Updated cover dates on {redated} issues.\n")
            save_all()

        for issue in todo:
            volume = volume_cache.get(issue.get("series") or "")
            match = (volume or {}).get("issues", {}).get(str(issue["issueNumber"]))
            if not match:
                missing.append(issue["title"])
                continue

            data = api(
                f"issue/4000-{match['id']}",
                {
                    "field_list": "name,deck,description,site_detail_url,"
                    + ",".join(KINDS.values()),
                },
            )["results"]

            issue["comicVineId"] = match["id"]
            if match["cover"] and (force or not issue.get("coverUrl")):
                issue["coverUrl"] = match["cover"]

            credits = []
            for kind, field in KINDS.items():
                ids: list[str] = []
                for item in data.get(field) or []:
                    # Arc names come as '"The Avengers" Korvac Saga': drop the prefix.
                    name = arc_name(item["name"]) if kind == "arcs" else item["name"]
                    tag_id = dictionaries[kind].id_for(item["id"], name)
                    if tag_id not in ids:
                        ids.append(tag_id)
                    if kind == "creators":
                        roles = [r.strip() for r in (item.get("role") or "").split(",") if r.strip()]
                        credits.append({"creator": tag_id, "roles": roles})
                # Keep hand-made character tags if Comic Vine lists none.
                if ids or kind != "characters":
                    issue[kind] = ids

            detail = {
                "id": issue["id"],
                "name": plain(data.get("name")),
                "deck": plain(data.get("deck")),
                "synopsis": parse_synopsis(data.get("description")),
                "credits": credits,
                "comicVineUrl": data.get("site_detail_url"),
            }
            detail = {k: v for k, v in detail.items() if v is not None}
            (DETAIL_DIR / f"{issue['id']}.json").write_text(
                json.dumps(detail, ensure_ascii=False, indent=2) + "\n"
            )
            save_all()
            done += 1
            print(f"  ok {issue['title']}  ({done}/{len(todo)})")
    except RateLimited:
        print("\nComic Vine rate limit reached. Progress is saved; run again in an hour.")
    finally:
        used = {
            kind: {tag for i in issues for tag in (i.get(kind) or [])} for kind in KINDS
        }
        for kind, d in dictionaries.items():
            d.prune(used[kind])
        save_all()

    print(f"\nFetched {done} of {len(todo)}.")
    if missing:
        print("Not found on Comic Vine: " + ", ".join(missing))

    fetch_images(dictionaries, save_all)


if __name__ == "__main__":
    main()
