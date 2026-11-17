# Marvel Guide

A Marvel comics reading-order guide, shown as a diagram of boxes connected by lines.

## Tech stack

- React 19 + Vite 8 + TypeScript (strict, `tsconfig.json`)
- Components are `.tsx`; files without JSX (types, utils) are `.ts`
- Data types live in `src/types/comic.ts` (`Issue`, `Character`, `ComicEvent`, `GuideData`, `GuideFilter`, `ReadingEdge`)
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
- The Vite `base` is set at build time from `actions/configure-pages` (`--base="<base_path>/"`), so do not hardcode `base` in `vite.config.js`.
- Requires repo **Settings → Pages → Source = GitHub Actions**.

## Product idea (in progress, not built yet)

A reading guide for Marvel comics, drawn as a flowchart:

- **Boxes (nodes)**: a comic issue or story arc, with title, issue number, year, cover, and a short synopsis. Clicking a box shows its details.
- **Lines (edges)**: reading order ("read this, then this"). Lines can branch (crossovers, tie-ins) and merge (big events).
- **Data**: stored in JSON files, so adding comics means editing data, not code. No backend, so it stays compatible with GitHub Pages.
- **Proposed library**: React Flow (`@xyflow/react`) for the canvas, zoom/pan, nodes, and edges.

### Year timeline (left side)

- The vertical axis is time: older at the top, newer at the bottom. A box's Y position is computed from its year in the JSON. No manual positioning.
- The horizontal axis holds reading lanes, e.g. main series on the left, crossovers and tie-ins to the right.
- Edges still mean reading order, usually flowing downward, sideways for issues in the same year.
- A year ruler is pinned to the left edge. It stays visible during horizontal pan and follows vertical pan and zoom, in sync with the React Flow viewport.

### Tags and filtering

Each box has two kinds of tags:

- **Character tags**, e.g. `spider-man`, `fantastic-four`. A box can have many.
- **Event tags**, e.g. `civil-war`, `secret-wars`. A box can belong to zero or more events.

Search and filter behavior:

- The user can search and select **multiple events** and **multiple characters**.
- Filter logic (decided):
  - Within the same category it is **OR**: selecting `civil-war` + `secret-wars` shows boxes in either event.
  - Across categories it is **AND**: selecting event `civil-war` + character `spider-man` shows only boxes that are in Civil War **and** feature Spider-Man.
  - An empty category does not filter. Only characters selected means filter by characters only, and vice versa.
- Only matching boxes are shown. Everything else is hidden.
- **Bridged edges** (decided): when a hidden box sits between two visible ones in the reading order (A → X → B with X hidden), draw a direct edge A → B so the reading order stays visible. This applies across chains of hidden boxes too (A → X → Y → B becomes A → B). Bridged edges may be styled differently (e.g. dashed) to show that issues were skipped.
- The timeline ruler adapts to the filtered set, showing only the years that still have boxes.
- Clearing all filters brings back the full diagram.

Sketch of the data shape (not final):

```json
{
  "id": "asm-1",
  "title": "Amazing Spider-Man #1",
  "year": 1963,
  "characters": ["spider-man", "fantastic-four"],
  "events": [],
  "next": ["asm-2"]
}
```

### Open questions (ask the user before building)

1. In "guide issue marvel commit", is "commit" a typo for "comic", or does it mean something else?
2. Is one box a single issue (e.g. *ASM #1*) or a whole arc (e.g. *Civil War #1–7*)?
3. Initial scope: a specific character or era (Spider-Man, X-Men, Marvel 2015+), or everything?
4. Interactivity beyond tags and event filter: "mark as read", or view-only first?
5. Timeline year: real-world publication year (recommended) or in-universe chronology?
6. Empty years (e.g. 1965 → 1985): show proportionally, or compress with a gap marker like `⋯ 1966–1984 ⋯` (recommended)?
7. Timeline granularity: per year, or per month within a year?

## Conventions

- The user communicates in Indonesian; reply in Indonesian.
