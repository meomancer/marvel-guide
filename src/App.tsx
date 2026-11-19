import { MarkerType, type Edge, type NodeTypes } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FilterSidebar } from './components/FilterSidebar.tsx';
import { HomePage } from './components/HomePage.tsx';
import {
  ARC_TITLE_HEIGHT,
  IssueNode,
  KEYPOINT_HEIGHT,
  type IssueNodeType,
} from './components/IssueNode.tsx';
import { IssuePanel } from './components/IssuePanel.tsx';
import { MapSearch, type SearchRow } from './components/MapSearch.tsx';
import { ProgressBar } from './components/ProgressBar.tsx';
import {
  SAGA_REF_FRAME,
  SagaRefNode,
  type SagaRefNodeType,
} from './components/SagaRefNode.tsx';
import { TimelineCanvas, type RailMarker } from './components/TimelineCanvas.tsx';
import { TURN_GAP, type TurnAt } from './components/TimelineEdge.tsx';
import { countTags, dataProblems, guideData } from './data/index.ts';
import { resolveAssetUrl } from './lib/assets.ts';
import { laneColor } from './lib/colors.ts';
import {
  buildReadingEdges,
  EMPTY_FILTER,
  matchesFilter,
  withTag,
  withoutTag,
} from './lib/filter.ts';
import { formatDate, formatYears } from './lib/format.ts';
import { findHops } from './lib/hops.ts';
import { assignLanes, MAIN_LANE } from './lib/lanes.ts';
import { useReadIssues } from './lib/readIssuesContext.ts';
import { sagaSummary } from './lib/saga.ts';
import { layoutTimeline, NODE_HEIGHT, NODE_WIDTH } from './lib/timeline.ts';
import { buildUrl, readUrl } from './lib/urlState.ts';
import {
  ENTITY_KINDS,
  type Entity,
  type EntityId,
  type EntityKind,
  type GuideFilter,
  type Issue,
  type IssueId,
  type SagaId,
  ROLE_LABELS,
} from './types/comic.ts';
import './App.css';

const nodeTypes: NodeTypes = { issue: IssueNode, sagaRef: SagaRefNode };

const DISCLAIMER =
  'Unofficial, non-commercial fan reading guide. Marvel characters, titles and logos are trademarks of Marvel. Not affiliated with or endorsed by Marvel.';

/** Main timeline lines in blue, optional branches in pink. */
const MAIN_COLOR = laneColor(0);
const BRANCH_COLOR = '#C8006A';
/** Dark yellow for character-history boxes' lines (readable on light paper). */
const HISTORY_COLOR = '#B38F00';
/** Purple for saga boxes (issues from another guide) and their lines. */
const REF_COLOR = '#6B3FA0';
/** Lighter grey, dashed: lines that skip hidden issues. */
const BRIDGED_COLOR = '#8A949C';

/**
 * Lines leaving the main timeline turn right below their source, so they run
 * down their own branch column. Every other line between columns turns right
 * above its target, so all lines into one box share a single sideways segment.
 */
function turnAt(sourceLane: string, targetLane: string, sideways: boolean): TurnAt {
  if (sideways || sourceLane === targetLane) return 'middle';
  return sourceLane === MAIN_LANE ? 'source' : 'target';
}

/**
 * Line look. Bridged (skips hidden issues): grey dashes. History (background
 * only, not reading order proper): dashes in the history colour. Lines to and
 * from saga boxes look like any other line of their kind (main, optional,
 * history): the box itself says it belongs to another guide.
 */
function edgeStyle(color: string, bridged: boolean, history = false): Partial<Edge> {
  const stroke = bridged ? BRIDGED_COLOR : color;
  return {
    style: {
      stroke,
      strokeWidth: bridged ? 2 : 3,
      strokeLinecap: history ? 'butt' : 'round',
      strokeLinejoin: 'round',
      strokeDasharray: bridged ? '6 6' : history ? '7 5' : undefined,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 12, height: 12 },
  };
}

const { sagas, entities } = guideData;
const sagaById = new Map(sagas.map((s) => [s.id, s]));
/** Tag id -> entity, per kind (shared by all guides). */
const entityById = Object.fromEntries(
  ENTITY_KINDS.map((kind) => [kind, new Map(entities[kind].map((e) => [e.id, e]))]),
) as Record<EntityKind, Map<EntityId, Entity>>;

const byDate = (a: Issue, b: Issue) =>
  a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || a.issueNumber - b.issueNumber;

/** A plain click on a link: handle it in the app instead of reloading. */
const isPlainClick = (e: React.MouseEvent) =>
  !(e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0);

export default function App() {
  // State comes from the URL: / = home, /<saga id> = that guide + filters.
  const [initial] = useState(readUrl);
  const [sagaId, setSagaId] = useState<SagaId | undefined>(initial.sagaId);
  const [filter, setFilter] = useState<GuideFilter>(initial.filter);
  const [selectedId, setSelectedId] = useState<IssueId | undefined>(initial.issueId);
  const [focus, setFocus] = useState<{ id: IssueId; seq: number } | undefined>(
    initial.issueId ? { id: initial.issueId, seq: 0 } : undefined,
  );
  const { read } = useReadIssues();

  // Keep the URL in sync. Switching guide (or home), or a filter picked from
  // the detail panel, adds a history entry (Back returns to the previous URL);
  // other filter and selection changes replace the current one.
  const lastSaga = useRef(sagaId);
  const pushNext = useRef(false);
  useEffect(() => {
    const url = buildUrl({ sagaId, filter, issueId: selectedId });
    if (url !== window.location.pathname + window.location.search) {
      if (lastSaga.current !== sagaId || pushNext.current) {
        window.history.pushState(null, '', url);
      } else {
        window.history.replaceState(null, '', url);
      }
    }
    lastSaga.current = sagaId;
    pushNext.current = false;
  }, [sagaId, filter, selectedId]);

  // Back/Forward: restore state from the URL.
  useEffect(() => {
    const onPopState = () => {
      const state = readUrl();
      lastSaga.current = state.sagaId;
      setSagaId(state.sagaId);
      setFilter(state.filter);
      setSelectedId(state.issueId);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const saga = sagaId ? sagaById.get(sagaId) : undefined;
  const issues = useMemo(() => saga?.issues ?? [], [saga]);

  /** Open a guide (or home with undefined), with a clean filter. */
  const openSaga = useCallback((id: SagaId | undefined) => {
    setSagaId(id);
    setFilter(EMPTY_FILTER);
    setSelectedId(undefined);
  }, []);

  // ---- Per-guide lookups ----
  const guide = useMemo(() => {
    const issueById = new Map(issues.map((i) => [i.id, i]));
    /** Issues that list the given issue in their `next`. */
    const previousById = new Map<IssueId, Issue[]>();
    for (const issue of issues) {
      for (const n of issue.next) previousById.set(n, [...(previousById.get(n) ?? []), issue]);
    }
    // Story arcs in this guide, in reading (date) order, with progress.
    // Character history is background only: it is not part of the arcs.
    const arcIssues = new Map<EntityId, Issue[]>();
    for (const issue of [...issues].sort(byDate)) {
      if (issue.history || issue.ref) continue;
      for (const arcId of issue.arcs ?? []) arcIssues.set(arcId, [...(arcIssues.get(arcId) ?? []), issue]);
    }
    return { issueById, previousById, arcIssues, tagCounts: countTags(issues) };
  }, [issues]);

  const arcProgress = useMemo(() => {
    const progress = new Map<EntityId, { done: number; total: number }>();
    for (const [arcId, list] of guide.arcIssues) {
      progress.set(arcId, { done: list.filter((i) => read.has(i.id)).length, total: list.length });
    }
    return progress;
  }, [guide, read]);

  const arcList = useMemo(
    () =>
      [...guide.arcIssues.keys()]
        .map((id) => entityById.arcs.get(id))
        .filter((arc): arc is Entity => arc !== undefined)
        .map((arc) => ({ arc, ...arcProgress.get(arc.id)! })),
    [guide, arcProgress],
  );

  // ---- Issue map: one box per issue, filtered, with bridged lines ----
  const visibleIssues = useMemo(
    () => issues.filter((i) => matchesFilter(i, filter)),
    [issues, filter],
  );

  const issueGraph = useMemo(() => {
    const visible = new Set(visibleIssues.map((i) => i.id));
    const readingEdges = buildReadingEdges(issues, visible);
    const lanes = assignLanes(visibleIssues, readingEdges);
    const laneOf = (id: IssueId) => lanes.laneOf.get(id) ?? MAIN_LANE;

    // Bars stacked above the box: story arc title, then keypoint.
    // Home-guide look of a saga box's inner issue (main/optional/history).
    const homeOf = (issue: Issue) =>
      issue.ref ? sagaById.get(issue.ref)?.issues.find((i) => i.id === issue.id) : undefined;
    const showsArc = (issue: Issue) =>
      Boolean(issue.arcs?.length) && !(issue.ref ? homeOf(issue)?.history : issue.history);
    // Space above the issue box: saga frame (for saga boxes), then the story
    // arc bar and the keypoint bar.
    const headerOf = (issue: Issue) =>
      (issue.ref ? SAGA_REF_FRAME.top : 0) +
      (showsArc(issue) ? ARC_TITLE_HEIGHT : 0) +
      (issue.keypoint ? KEYPOINT_HEIGHT : 0);

    const layout = layoutTimeline(
      visibleIssues.map((i) => ({
        id: i.id,
        year: i.year,
        month: i.month,
        lane: laneOf(i.id),
        header: headerOf(i),
      })),
      lanes.laneOrder,
      readingEdges,
    );
    const colorOf = (issue: Issue) =>
      issue.ref
        ? REF_COLOR
        : issue.history
          ? HISTORY_COLOR
          : issue.optional
            ? BRANCH_COLOR
            : MAIN_COLOR;

    const nodes: (IssueNodeType | SagaRefNodeType)[] = visibleIssues.map((issue) => {
      const { x, y } = layout.positions.get(issue.id)!;
      if (issue.ref) {
        // An issue from another guide: a purple frame (saga + arc) around a
        // normal issue box styled as in its home guide. The frame sticks out
        // to the sides, so the issue box still lines up with its column.
        const home = homeOf(issue);
        const homeKind = home?.history ? 'history' : home?.optional ? 'optional' : 'main';
        return {
          id: issue.id,
          type: 'sagaRef' as const,
          position: { x: x - SAGA_REF_FRAME.side, y: y - headerOf(issue) },
          data: {
            issue,
            sagaName: sagaById.get(issue.ref)?.name ?? issue.ref,
            arcName: showsArc(issue) ? entityById.arcs.get(issue.arcs![0]!)?.name : undefined,
            homeKind,
            homeColor:
              homeKind === 'history'
                ? HISTORY_COLOR
                : homeKind === 'optional'
                  ? BRANCH_COLOR
                  : MAIN_COLOR,
            href: buildUrl({ sagaId: issue.ref, filter: EMPTY_FILTER, issueId: issue.id }),
          },
          selected: issue.id === selectedId,
        };
      }
      return {
        id: issue.id,
        type: 'issue' as const,
        // Bars sit on top of the box: start the node higher so the box
        // itself lines up with the rest of its row.
        position: { x, y: y - headerOf(issue) },
        data: {
          issue,
          color: colorOf(issue),
          optional: issue.optional === true,
          history: issue.history === true,
          role: issue.role,
          // History is background only: no story arc bar on it.
          arcTitle:
            issue.arcs?.[0] && !issue.history
              ? entityById.arcs.get(issue.arcs[0])?.name
              : undefined,
        },
        selected: issue.id === selectedId,
      };
    });

    // Geometry of every line, to find where lines cross (line hops).
    // Same maths as TimelineEdge: handles sit at the centre of the node's top
    // (above any bars) and of the box's bottom.
    const geometry = readingEdges.map((e) => {
      const source = layout.positions.get(e.source)!;
      const target = layout.positions.get(e.target)!;
      const sideways = target.y < source.y + NODE_HEIGHT;
      const sx = source.x + NODE_WIDTH / 2;
      const sy = source.y + NODE_HEIGHT;
      const tx = target.x + NODE_WIDTH / 2;
      const ty = target.y - headerOf(guide.issueById.get(e.target)!);
      const turn = turnAt(laneOf(e.source), laneOf(e.target), sideways);
      const room = ty - sy > TURN_GAP * 2;
      const cy =
        sideways || !room || turn === 'middle'
          ? undefined
          : turn === 'source'
            ? sy + TURN_GAP
            : ty - TURN_GAP;
      return { id: `${e.source}->${e.target}`, sx, sy, tx, ty, cy };
    });
    const hops = findHops(geometry);

    const edges: Edge[] = readingEdges.map((e) => {
      const source = layout.positions.get(e.source)!;
      const target = layout.positions.get(e.target)!;
      // Line colour: history (yellow) if either end is history, else branch
      // (pink) if either end is optional; only main-to-main lines are blue.
      // Saga boxes count as their kind in this guide: main ones are on the
      // main line, the others are optional.
      const ends = [guide.issueById.get(e.source)!, guide.issueById.get(e.target)!];
      const lineColor = ends.some((i) => i.history)
        ? HISTORY_COLOR
        : ends.some((i) => i.optional)
          ? BRANCH_COLOR
          : MAIN_COLOR;
      // Target in the same row or higher: connect side to side instead of
      // looping from the bottom of one box around to the top of the other.
      const sideways = target.y < source.y + NODE_HEIGHT;
      const goingRight = target.x > source.x;
      return {
        id: `${e.source}->${e.target}`,
        source: e.source,
        target: e.target,
        sourceHandle: sideways ? (goingRight ? 's-right' : 's-left') : 's-bottom',
        targetHandle: sideways ? (goingRight ? 't-left' : 't-right') : 't-top',
        ...edgeStyle(lineColor, e.bridged, ends.some((i) => i.history)),
        type: 'timeline',
        data: {
          turnAt: turnAt(laneOf(e.source), laneOf(e.target), sideways),
          hops: hops.get(`${e.source}->${e.target}`),
        },
      };
    });

    // Story arc spans for the rail beside the year ruler.
    const spans = [...guide.arcIssues.keys()]
      .map((arcId) => {
        const ys = visibleIssues
          .filter((issue) => !issue.history && !issue.ref && issue.arcs?.includes(arcId))
          .map((issue) => layout.positions.get(issue.id)!.y - headerOf(issue));
        if (ys.length === 0) return undefined;
        const top = Math.min(...ys) - TURN_GAP / 2;
        const bottom = Math.max(...ys) + NODE_HEIGHT + ARC_TITLE_HEIGHT + KEYPOINT_HEIGHT;
        return { arcId, top, bottom };
      })
      .filter((span) => span !== undefined)
      .sort((a, b) => a.top - b.top);

    // Overlapping arcs get separate rail columns.
    const columnBottoms: number[] = [];
    const markers: RailMarker[] = spans.map(({ arcId, top, bottom }) => {
      let column = columnBottoms.findIndex((b) => b <= top);
      if (column === -1) column = columnBottoms.length;
      columnBottoms[column] = bottom;
      return {
        id: arcId,
        label: entityById.arcs.get(arcId)?.name ?? arcId,
        top,
        height: bottom - top,
        column,
      };
    });

    return { nodes, edges, bands: layout.bands, markers };
  }, [issues, visibleIssues, selectedId, guide]);

  // ---- Actions ----
  const selectIssue = useCallback(
    (id: IssueId) => {
      const issue = guide.issueById.get(id);
      if (issue && !matchesFilter(issue, filter)) setFilter(EMPTY_FILTER);
      setSelectedId(id);
      setFocus((f) => ({ id, seq: (f?.seq ?? 0) + 1 }));
    },
    [filter, guide],
  );

  // From the detail panel: a tag that is not in the filter becomes the only
  // filter; one that is already in it is removed (click again to undo). Each
  // click is a new history entry, so Back restores the previous filters.
  const filterTag = useCallback((kind: EntityKind, id: EntityId) => {
    pushNext.current = true;
    setFilter((f) =>
      f.tags[kind].includes(id) ? withoutTag(f, kind, id) : withTag(EMPTY_FILTER, kind, id),
    );
  }, []);

  const closePanel = useCallback(() => setSelectedId(undefined), []);

  // Sidebar story arc list: zoom to the arc's first issue (clearing filters
  // that hide it), without opening the detail panel.
  const zoomToArc = useCallback(
    (arcId: EntityId) => {
      const first = guide.arcIssues.get(arcId)?.[0];
      if (!first) return;
      if (!matchesFilter(first, filter)) setFilter(EMPTY_FILTER);
      setFocus((f) => ({ id: first.id, seq: (f?.seq ?? 0) + 1 }));
    },
    [guide, filter],
  );

  // ---- Navbar search options, sorted by date ----
  const issueRows = useMemo<SearchRow[]>(
    () =>
      // Saga boxes belong to other guides: not offered in this guide's search.
      [...visibleIssues].filter((i) => !i.ref).sort(byDate).map((issue) => {
        const title = issue.series ? `${issue.series} #${issue.issueNumber}` : issue.title;
        const arc = issue.arcs?.[0] ? entityById.arcs.get(issue.arcs[0])?.name : undefined;
        const chips: SearchRow['chips'] = [];
        if (arc) chips.push({ text: arc, kind: 'arc' });
        if (issue.keypoint) chips.push({ text: issue.keypoint, kind: 'keypoint' });
        if (issue.history) chips.push({ text: 'History', kind: 'history' });
        else if (issue.optional) {
          chips.push({ text: issue.role ? ROLE_LABELS[issue.role] : 'Optional', kind: 'optional' });
        }
        if (read.has(issue.id)) chips.push({ text: '✓ Read', kind: 'read' });
        return {
          id: issue.id,
          title,
          date: formatDate(issue.year, issue.month),
          chips,
          optional: issue.optional,
          history: issue.history,
          imageUrl: issue.coverUrl ? resolveAssetUrl(issue.coverUrl) : undefined,
          haystack: [title, issue.title, arc, issue.keypoint, String(issue.year)]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
        };
      }),
    [visibleIssues, read],
  );

  const sagaRows = useMemo<SearchRow[]>(
    () =>
      sagas
        .map((s) => ({ s, sum: sagaSummary(s) }))
        .sort((a, b) => a.sum.startKey - b.sum.startKey || a.s.name.localeCompare(b.s.name))
        .map(({ s, sum }) => {
          const done = sum.main.filter((i) => read.has(i.id)).length;
          return {
            id: s.id,
            imageUrl: sum.coverUrl,
            title: s.name,
            date: formatYears(sum.startYear, sum.endYear),
            chips: [
              { text: `${sum.count} issues`, kind: 'arc' as const },
              { text: `${done} of ${sum.main.length} main read`, kind: 'read' as const },
              ...(s.description ? [{ text: s.description, kind: 'plain' as const }] : []),
            ],
            haystack: [s.name, s.description, sum.startYear, sum.endYear]
              .filter(Boolean)
              .join(' ')
              .toLowerCase(),
          };
        }),
    [read],
  );

  const selected = selectedId ? guide.issueById.get(selectedId) : undefined;
  const summary = saga ? sagaSummary(saga) : undefined;

  return (
    <div className="app">
      <header className="masthead">
        <a
          className="masthead__brand"
          href={buildUrl({ filter: EMPTY_FILTER })}
          onClick={(e) => {
            if (!isPlainClick(e)) return;
            e.preventDefault();
            openSaga(undefined);
          }}
        >
          <h1 className="masthead__title">Marvel Guide</h1>
          <p className="masthead__tagline">Marvel reading guide.</p>
        </a>
        {/* Lists the boxes on the current page: guides on home, issues in a guide */}
        {saga ? (
          <MapSearch key={`issues:${saga.id}`} rows={issueRows} noun="issue" onPick={selectIssue} />
        ) : (
          <MapSearch key="sagas" rows={sagaRows} noun="guide" onPick={openSaga} />
        )}
      </header>

      {dataProblems.length > 0 && (
        <div className="data-problems" role="alert">
          <strong>The guide data has {dataProblems.length} problem(s):</strong>
          <ul>
            {dataProblems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {!sagaId ? (
        <HomePage sagas={sagas} onOpen={openSaga} />
      ) : !saga || !summary ? (
        <main className="home">
          <div className="empty-state">
            <p>There is no guide called “{sagaId}”.</p>
            <button type="button" onClick={() => openSaga(undefined)}>
              See all guides
            </button>
          </div>
        </main>
      ) : (
        <>
          <section className="saga-bar">
            <div>
              <h2 className="saga-bar__name">{saga.name}</h2>
              <p className="saga-bar__description">
                {formatYears(summary.startYear, summary.endYear)}, {summary.count} issues
              </p>
            </div>
            <ProgressBar
              label={saga.name}
              done={summary.main.filter((i) => read.has(i.id)).length}
              total={summary.main.length}
              optionalDone={summary.optional.filter((i) => read.has(i.id)).length}
              optionalTotal={summary.optional.length}
            />
          </section>
          <main className={`stage${selected ? ' has-panel' : ''}`}>
            {visibleIssues.length === 0 ? (
              <div className="empty-state">
                <p>No issue matches every selected tag.</p>
                <button type="button" onClick={() => setFilter(EMPTY_FILTER)}>
                  Clear filters
                </button>
              </div>
            ) : (
              <TimelineCanvas<IssueNodeType | SagaRefNodeType>
                nodes={issueGraph.nodes}
                edges={issueGraph.edges}
                bands={issueGraph.bands}
                nodeTypes={nodeTypes}
                // Saga box: open that guide in a new tab, zoomed to the issue.
                // Issue box: toggle its detail panel.
                onNodeClick={(_, node) => {
                  if (node.type === 'sagaRef') {
                    window.open(node.data.href, '_blank', 'noopener');
                    return;
                  }
                  setSelectedId((current) => (current === node.id ? undefined : node.id));
                }}
                onPaneClick={closePanel}
                resetKey={`${saga.id}:${JSON.stringify(filter)}`}
                focus={focus}
                markers={issueGraph.markers}
              />
            )}
            {selected && (
              <IssuePanel
                issue={selected}
                issues={guide.issueById}
                previous={guide.previousById.get(selected.id) ?? []}
                entities={entityById}
                arcProgress={arcProgress}
                filter={filter}
                onSelectIssue={selectIssue}
                onFilterTag={filterTag}
                onClose={closePanel}
              />
            )}
            <FilterSidebar
              arcs={arcList}
              tagCounts={guide.tagCounts}
              entities={entities}
              filter={filter}
              onChange={setFilter}
              visibleCount={visibleIssues.length}
              totalCount={issues.length}
              onZoomArc={zoomToArc}
            />
          </main>
        </>
      )}

      <footer className="disclaimer">
        {/* One line; cut off with "..." on narrow screens, full text on hover */}
        <p title={DISCLAIMER}>
          {DISCLAIMER} Cover images from{' '}
          <a href="https://comicvine.gamespot.com/" target="_blank" rel="noreferrer">
            Comic Vine
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
