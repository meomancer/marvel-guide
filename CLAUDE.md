# Marvel Guide

A Marvel comics reading-order guide, shown as a diagram of boxes connected by lines.

## Tech stack

- React 19 + Vite 8 + TypeScript (strict, `tsconfig.json`)
- Components are `.tsx`; files without JSX (types, utils) are `.ts`
- Data types live in `src/types/comic.ts` (`IssueFacts`, `SagaFile`/`SagaEntry`, joined `Saga`/`Issue`, `Entity`, `IssueDetail`, `GuideData`, `GuideFilter`, `ReadingEdge`)
- oxlint for linting (`.oxlintrc.json`)
- Deployed to GitHub Pages via GitHub Actions
- Remote: `git@github.com:meomancer/marvel-guide.git`, default branch `main`

## Commands

Use the Makefile for development (`make` lists all targets):

- `make dev`: start the dev server (port 5173, override with `PORT=3000`)
- `make dev-host`: start the dev server exposed on the LAN
- `make lint`: run oxlint
- `make typecheck`: run `tsc` (no emit)
- `make build`: type check, then production build into `dist/`
- `make preview`: build, then serve the production bundle locally
- `make clean` / `make reset`: remove `dist/` / reinstall `node_modules/`

## Deployment

Two workflows in `.github/workflows/`:

- **`ci.yml`** runs on push to any branch, PRs to `main`, and manual dispatch. Four parallel jobs: lint (oxlint), type check (`tsc`), build, and `npm audit` (production deps, high severity and above).
- **`deploy.yml`** runs only on push to `main` and manual dispatch: build (includes type check), then publish to GitHub Pages. Deployments queue rather than cancel each other.
- The Vite `base` is set at build time from `actions/configure-pages` (`--base="<base_path>/"`), so do not hardcode `base` in `vite.config.ts`.
- Requires repo **Settings → Pages → Source = GitHub Actions**.

## Product

A reading guide for Marvel comics, drawn as a flowchart of boxes and lines.

### Hierarchy (decided)

**Saga (guide) → Issue**, with story arcs and other tags from Comic Vine.

- **Data is normalised like relational tables, joined by id** (decided; static JSON, no database server):
  - `src/data/issues.json` = the **catalog**: every issue **once** (`IssueFacts`: title, series, number, dates, cover, `comicVineId`, `keypoint`, tag ids). Facts that are the same in every guide.
  - `src/data/sagas/<id>.json` = one **guide** (`SagaFile`): `{ id, name, description, entries: [{ issue, next, optional? }] }`, in reading order, one entry per line. Only what is specific to the guide: reading-order `next` and `optional`. A new guide that uses an existing issue just references its id (no duplication). New guides are picked up by `import.meta.glob`.
  - `src/data/index.ts` joins each guide's entries with the catalog into a `Saga` of full `Issue`s at load time (Maps, a few ms); the rest of the app only sees joined `Issue`s. Unknown ids are reported in the warning banner.
  - Detail files (`src/data/issues/<id>.json`) and tag dictionaries are shared too.
  - When there are many guides: keep the normalised files as the source, and add a build step that writes one pre-joined bundle per guide, so a guide page only downloads its own issues.
- **Issue**: **one box = one single issue**. `issueNumber` is a single integer. Multi-issue stories are split into one entry per issue, linked with `next`.
- There is **no Era/Event level** (removed on request): story arcs from Comic Vine are the grouping. There is no hand-made arc level either: do not reintroduce invented story names or synopses.

### Data

- JSON files in `src/data/`, typed by `src/types/comic.ts`, loaded and validated by `src/data/index.ts` (issue ids and `next` are checked per guide). Broken references show a warning banner in the app.
- The catalog and guide files keep one record per line to stay compact and diff-friendly.
- Dates are real cover dates from Comic Vine (`fetch_comicvine.py` overwrites `year`/`month` for every matched issue); hand-entered dates are only placeholders until the script runs.
- **Essential vs optional** (decided): `Issue.optional: true` marks side reading. Essential issues form the main timeline; optional ones form branches that split off a main issue (it lists both targets in `next`) and rejoin later.
- Current content: the Avengers saga, curated by Claude (the user asked to drop the earlier ChatGPT list). Rebuilt by a one-off script that asserts every issue is placed exactly once.
  - **Main timeline (essential)**: vol. 1 era (1963–1987): Avengers #1, #4, #16, #57–58, Kree-Skrull War #89–97, Celestial Madonna (#129–135 with Giant-Size Avengers #2–4), Korvac Saga (#167–168, #170–177; #169 is a stand-alone and was removed), Under Siege #270–277. vol. 3 era (1998–2004): Avengers (1998) #1–4, Ultron Unlimited #19–22, Avengers Forever #1–12, Kang Dynasty #41–55.
  - **Optional branches**: Avengers #2–3; #51–52, #54–55 (Black Panther, Ultron); Avengers/Defenders War (from #97 to #129); Serpent Crown → Ultron and Jocasta → Nefaria Trilogy → Thanos (Avengers Annual #7, Marvel Two-In-One Annual #2) → Thor Annual #6 as the Korvac prelude (from Giant-Size Avengers #4 to #167); Byrne era #181–187 → Hank Pym #211–214 → Avengers Annual #10 (Rogue) → #228–230 (from #177 to #270); Galactic Storm #345–347 → Onslaught → Thunderbolts #1 → Heroes Reborn: The Return #1–4 (from #277 to Avengers (1998) #1); vol. 3 #5–18 with Live Kree or Die; #23–40 with Maximum Security; #56–84 (after Busiek, no rejoin).
  - More character introductions (optional, may lead into other optional issues): Fantastic Four #52 (Black Panther) → Avengers #51; Marvel Super-Heroes #12 (Mar-Vell) → #89; Avengers #6, #8, #9 (Masters of Evil, Kang, Wonder Man) from #4 to #16; Iron Man #55 (Thanos) → Avengers Annual #7; Avengers #112 (Mantis) → #115; Marvel Super-Heroes #18 (Guardians of the Galaxy) → Giant-Size Defenders #3 (Korvac) → #167; Ms. Marvel #1 → #181.
  - Character debuts are optional branches at the start of the guide: Captain America Comics #1, Tales to Astonish #27 → #35 (Ant-Man) → #44 (Wasp) as one chain, Incredible Hulk #1, Journey into Mystery #83 (Thor), Tales of Suspense #39 (Iron Man), #57 (Hawkeye), X-Men #4 (Quicksilver, Scarlet Witch). Each points to the Avengers issue where the character joins (#1, #4 or #16).
- No cover images are bundled. `coverUrl` is optional: an absolute URL, or a path under `public/` resolved with the deploy base path (`src/lib/assets.ts`).
- **Comic Vine data** (decided): `make comicvine` runs `scripts/fetch_comicvine.py` (Python, stdlib only). Needs `COMICVINE_API_KEY` in `.env` (git-ignored; never commit or print it). For each issue it matches `series` "<Name> (<year>)" to a Marvel volume, then by issue number, and:
  - sets `comicVineId` and fills a missing `coverUrl` (linked, not downloaded),
  - writes `src/data/issues/<issue id>.json` (`IssueDetail`: story name, deck, synopsis as heading/paragraph blocks with HTML stripped, creator credits with roles, Comic Vine URL). An issue without an `arcs` field is treated as not fully fetched and is fetched again,
  - sets the issue's tag ids `characters`, `creators`, `teams`, `locations`, `objects`, `arcs` (Comic Vine characters replace the hand-made ones) and adds new entries to `src/data/<kind>.json` (`{id, name, comicVineId}`, id = name slug, plus `-<cvId>` on a clash).
  - Works only on the catalog `src/data/issues.json` (never reads or writes guide files). Never touches the curated `keypoint`; dates are synced to Comic Vine cover dates. Resumable: skips issues that already have a detail file (`--force` redoes all) and saves after every issue, because Comic Vine allows about 200 requests per resource per hour. Volume lookups are cached in `scripts/.cache/` (git-ignored). Volume names are compared ignoring "The" and punctuation (Comic Vine titles the 1998 series "Avengers: Forever"), with the search endpoint as a fallback when the name filter finds nothing.
  - Comic Vine requires attribution: the footer links to it, and each synopsis says "From Comic Vine". Do not scrape marvel.com (its terms forbid automated access).
- **Images and links for tags** (decided): every run (or `--images` alone) fills `coverUrl` (Comic Vine `icon_url`, a small square) and `comicVineUrl` on characters, creators, teams, locations, objects and story arcs that lack them, via list endpoints with `filter=id:a|b|...` (100 ids per request, about 15 requests in total, separate rate limit from issues). Story arc images are copied into the detail files. In the UI, tag chips show a round avatar, and characters/teams/locations/objects/creators/story arcs and the issue title have an external-link icon (`ComicVineLink`) right of the name.
- **Data split** (decided): the catalog and guide files are the light index (everything the diagram and filters need, tag ids only). `issues/<id>.json` holds long text and is loaded lazily via `import.meta.glob` in `src/data/index.ts` (`loadIssueDetail`), one small chunk per issue, only when its panel opens.

### Keypoints

- `Issue.keypoint` (optional): a short highlight, e.g. "Iron Man's debut", "Vision weds Wanda". Keep it short (a few words).
- Shown as a yellow bar **stacked on top of the box, inside the node** (not absolutely positioned): `.issue-node-wrap` = keypoint bar (22px, `KEYPOINT_HEIGHT` in `IssueNode.tsx`) + box. Incoming arrows from above end on the top of the node, i.e. on the keypoint. Nodes with a keypoint are placed 22px higher so the boxes stay aligned in their row. Side handles live on the box. Longer text is cut with "…"; the full text is in the tooltip and in the detail panel.
- Current keypoints were written by Claude: character debuts, team changes, and the start of each major story.

### Story arcs (decided)

- Story arcs are a **tag kind like teams or locations**: dictionary `src/data/arcs.json` (`{id, name, comicVineId, deck, coverUrl, comicVineUrl}`), and `Issue.arcs` holds arc ids. They are searchable and filterable (`arcs=` in the URL) like the other kinds. Names have Comic Vine's quoted series prefix stripped. No invented arc names.
- The first arc of an issue is shown as a blue bar on top of the node, above the keypoint (`.issue-node__arc`, `ARC_TITLE_HEIGHT` 22px), on **every issue of the arc**. The detail panel lists the arcs with image, summary and link; clicking an arc toggles it as the filter.
- Node stack, top to bottom: arc title, keypoint, box. The bars use the box's border: black on main boxes, dashed pink on optional ones. `TimelineItem.header` is the height of the bars; each row gets that much extra room above (the tallest header in the row), so there is always the full row gap between a box and the next node's top.
- Every tag kind now has a `deck` (one-line summary, "" if Comic Vine has none), shown in the chip tooltip.

### Layout and timeline

- Code: `src/lib/timeline.ts` (layout), `src/components/TimelineCanvas.tsx` (React Flow canvas, year bands, ruler).
- Vertical axis is time (real-world cover date, year then month). Horizontal axis: the **main** lane (essential issues, cyan) in the centre, with optional branches (pink) in their own columns around it. Branch boxes are styled differently (tinted, dashed border, "Optional" label).
- Colours (decided): main timeline boxes are **black** (ink, white text) with **blue** lines (cyan `#0089BF`) and a blue ring when selected; optional boxes are **pink** (tinted background, magenta `#C8006A` stripe, dashed border; no "Optional" label on the box, the colour says it, the detail panel keeps the label) with magenta lines, including lines into and out of a branch; skipped-issue (bridged) lines lighter grey and dashed. Story arcs share **one blue** (`--event`, `#0089BF`): the arc bar on boxes, arc chips, the arc rail and progress bars. No per-arc colour.
- Characters are listed alphabetically by name everywhere (sorted in `src/data/index.ts`).
- Branch columns (`src/lib/lanes.ts`, decided): each chain of optional issues linked by reading-order lines is one branch (union-find over the visible lines). Optional issues can lead into other optional issues; when several optional lines lead into one issue, only its closest predecessor in time continues the column, the others join from the side (so a 1973 debut leading to a 1977 annual doesn't run through every box in between). Branches that overlap in time never share a column; they alternate right and left of main (R1, L1, R2, L2, ...). A branch occupies its column from its first issue until the issue its lines rejoin. Freed columns are reused; a branch that continues another branch keeps the same column. Lines must not cross: a column is rejected if an outer branch on that side rejoins while this one still runs, or an inner one is still running when this one rejoins. So when two branches rejoin the same issue, the later one goes outside, on the same side. A branch that splits off the main timeline also can't sit outside a branch that is still running on that side (its outgoing line would cut through). Falls back to the first free column if nothing fits.
- Lines use a custom edge, `src/components/TimelineEdge.tsx` (type `timeline`), that sets the exact turn height: a line leaving the main lane turns 26px below its source; any other line between columns turns 26px above its target (rows are 56px apart so there is room for the turn and the arrowhead). All lines into the same box therefore share one sideways segment (no ladders, no jogs). Boxes in the same row, or a target higher up, connect side to side.
- Within one lane, **reading order wins over cover date**: a box that is read after another but dated earlier (e.g. an annual) is moved down to its predecessor's month and placed after it (`respectReadingOrder` in `timeline.ts`), so lines in a column never run upward. The box still shows its real date.
- Each month gets its own row, aligned across lanes. Years with no issues are compressed into one hatched gap band (e.g. "1966–1967").
- A year ruler is pinned left, synced to vertical pan and zoom. It only shows years that have visible boxes.
- A **story arc rail** sits right of the year ruler: one blue vertical span per story arc, from its first to its last visible box, labelled with the arc name in vertical text. Synced to pan and zoom; the label sticks to the top of the screen while its span is in view. Overlapping arcs get separate rail columns. Markers are computed in `App.tsx`, rendered by `EventRail` in `TimelineCanvas.tsx`.

### Navbar search

Code: `src/components/MapSearch.tsx` (generic combobox; rows built in `App.tsx`).

- A combobox in the masthead listing what the current page shows, sorted by date: on `/` the **guides** (cover, name, years, issue count, reading progress, description; picking one opens it), in a guide the **issues** on its map (filtered).
- Each issue option shows its cover, title ("Avengers (1963) #167"), date, first story arc (blue), keypoint (yellow), "Optional" (pink) and "✓ Read". Search matches title, arc, keypoint and year (all words must match).
- Picking an issue clears filters that hide it, opens its detail panel and zooms the map to its box (`TimelineCanvas` `focus={id, seq}`; a new `seq` re-focuses the same box). Keyboard: ↑ ↓, Enter, Esc. On phones it takes a full-width line under the title.

### URLs and pages (decided)

Code: `src/lib/urlState.ts`, synced in `App.tsx`. No router library.

- `/` = **home**: one card per guide (`HomePage.tsx`, `SagaCard`-style links) with cover, name, years, issue count, description and reading progress. It is the navigation; there is no other overview page.
- `/<saga id>` (e.g. `/avengers`) = that guide's issue map, showing only its issues. An unknown id shows a "no such guide" message with a link home. The masthead title ("Marvel Guide") is the link home; there is no separate "All guides" link.
- Every filter change updates the query: `characters`, `creators`, `teams`, `locations`, `objects`, `arcs` (comma-separated ids), `optional=hide`, and `issue=<id>` for the open detail panel. Opening a URL restores that state. Paths are relative to the deploy base (`/marvel-guide/` on GitHub Pages).
- Opening a guide or going home pushes a history entry (Back works) and clears filters. Clicking a tag in the detail panel **replaces the whole filter** with just that one; clicking it again (it shows as active) **removes** it. Both push an entry, so Back restores the previous filters. Sidebar filter and selection changes replace the current entry.
- GitHub Pages has no SPA fallback, so `deploy.yml` copies `dist/index.html` to `dist/404.html`. Vite's dev and preview servers fall back on their own.

### Tags and filtering

Code: `src/lib/filter.ts`, `src/components/FilterSidebar.tsx`.

- Filters live in a right sidebar on a guide page. It collapses to a narrow rail (showing the active filter count); the collapsed state is remembered in `localStorage` (`marvel-guide:filters-collapsed`). Small screens start collapsed, and the open sidebar floats over the canvas.
- Sidebar layout: the **head** (outside the scrolling body, so always visible) has the issue count ("217 issues", no "Filters" title) with a reset-filters icon button next to it (only when a filter is on), the collapse toggle, the search box, and "Show optional issues". The scrolling body lists the **active filters** of every kind first (including story arcs), so it is always clear what filters the map; then search results; and **story arcs at the bottom**. Story arcs of the guide are listed in reading order as square-cornered full-width rows: a zoom button (zooms the map to the arc's first issue, clearing filters that hide it, without opening the panel), the name (fills the row; click toggles the arc filter, active rows turn blue) and "read/total" on the right. The other tag kinds (characters, creators, teams, locations, objects) are searched from one box; only tags that appear in this guide are offered, grouped by kind and ranked by how many of its issues carry the tag (`countTags`). Selected tags show as removable chips.
- Filter logic: **OR** within a tag kind, **AND** across kinds, an empty kind does not filter.
- "Show optional issues" checkbox (`GuideFilter.hideOptional`): unticked leaves only the main timeline.
- Only matching boxes are shown.
- **Bridged edges**: when hidden boxes sit between visible ones (A → X → B, X hidden), a dashed grey line A → B is drawn.

### Reading progress

Code: `src/lib/readIssues.tsx` (provider), `src/lib/readIssuesContext.ts` (`useReadIssues` hook), `src/components/ProgressBar.tsx`.

- Read issue ids are cached in `localStorage` under `marvel-guide:read-issues` (JSON array). Per browser only, no sync across devices. Synced across open tabs via the `storage` event. Shared by all guides (reading an issue counts in every guide that lists it).
- Every issue box has a check toggle (top right), and the detail panel has a "Mark as read" button.
- **Per guide**: on the home card and in the guide header ("X of Y main issues read", bar over essential issues only, plus "N of M optional").
- **Per story arc**: "read/total" on the arc chips in the sidebar, and "X of Y issues read" under each arc in the detail panel.

### Open questions

1. Content after 2004 (Avengers Disassembled onward) is not added yet; the user wants it later.
2. With many guides, load guide files lazily (one per page) instead of eagerly.

## Mobile (≤720px)

- Year ruler 28px with **vertical** year labels, and story arc rail 20px per column (set in `TimelineCanvas.tsx` via `useNarrow`); diagram starts at zoom 0.6.
- Detail panel is a bottom sheet (max 72% height). Its close button is an X that stays at the top right while the panel scrolls (zero-height sticky bar), on every screen size.
- Collapsed filters become a small floating tab on the right; open filters float over the canvas at full width (desktop width is 350px).
- Search input is 16px so iOS doesn't zoom on focus. `.app` uses `100dvh`; padding respects `env(safe-area-inset-bottom)` (`viewport-fit=cover` in `index.html`).

## Conventions

- The user communicates in Indonesian; reply in Indonesian.
