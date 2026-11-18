import { useState } from 'react';
import { TagImage } from './TagImage.tsx';
import {
  activeTagCount,
  EMPTY_FILTER,
  isFilterEmpty,
  withTag,
  withoutTag,
} from '../lib/filter.ts';
import {
  ENTITY_KINDS,
  ENTITY_LABELS,
  type Entity,
  type EntityKind,
  type GuideFilter,
} from '../types/comic.ts';

interface FilterSidebarProps {
  /** Story arcs in this guide, in reading order, with reading progress. */
  arcs: { arc: Entity; done: number; total: number }[];
  /** How many issues of this guide carry each tag (ranks search results). */
  tagCounts: Record<EntityKind, Map<string, number>>;
  entities: Record<EntityKind, Entity[]>;
  filter: GuideFilter;
  onChange: (filter: GuideFilter) => void;
  visibleCount: number;
  totalCount: number;
  /** Zoom the map to the first issue of a story arc. */
  onZoomArc: (arcId: string) => void;
}

const COLLAPSED_KEY = 'marvel-guide:filters-collapsed';
const BODY_ID = 'filter-sidebar-body';
/** Search results shown per kind before "and N more". */
const RESULTS_PER_KIND = 6;

/** Remembered per browser; small screens start collapsed. */
function initialCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved !== null) return saved === 'true';
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return window.matchMedia('(max-width: 720px)').matches;
}

/** Tag kinds searched from the box (story arcs have their own chip list). */
const SEARCH_KINDS = ENTITY_KINDS.filter((kind) => kind !== 'arcs');

export function FilterSidebar({
  arcs,
  tagCounts,
  entities,
  filter,
  onChange,
  visibleCount,
  totalCount,
  onZoomArc,
}: FilterSidebarProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [query, setQuery] = useState('');

  const setAndSave = (value: boolean) => {
    setCollapsed(value);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(value));
    } catch {
      // Storage unavailable: state still works for this visit.
    }
  };

  const q = query.trim().toLowerCase();
  const match = (name: string) => q === '' || name.toLowerCase().includes(q);
  const activeCount =
    activeTagCount(filter) + (filter.hideOptional ? 1 : 0) + (filter.hideHistory ? 1 : 0);
  const shownArcs = arcs.filter(({ arc }) => match(arc.name));

  const entityOf = (kind: EntityKind, id: string) => entities[kind].find((e) => e.id === id);
  const entityName = (kind: EntityKind, id: string) => entityOf(kind, id)?.name ?? id;

  return (
    <aside
      className={`filter-sidebar${collapsed ? ' is-collapsed' : ''}`}
      aria-label="Filters"
    >
      <div className="filter-sidebar__head">
        <div className="filter-sidebar__head-row">
        {!collapsed && (
          <div className="filter-sidebar__summary">
            <h2 className="filter-sidebar__count" aria-live="polite">
              <span className="visually-hidden">Filters: </span>
              {visibleCount === totalCount
                ? `${totalCount} issues`
                : `${visibleCount} of ${totalCount} issues`}
            </h2>
            {!isFilterEmpty(filter) && (
              <button
                type="button"
                className="filter-sidebar__reset"
                onClick={() => onChange(EMPTY_FILTER)}
                aria-label="Clear all filters"
                title="Clear all filters"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3 3v3.5h3.5" />
                  <path d="M3.3 6.3A5 5 0 1 1 3 9.5" />
                </svg>
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          className="filter-sidebar__toggle"
          aria-expanded={!collapsed}
          aria-controls={BODY_ID}
          onClick={() => setAndSave(!collapsed)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {/* Sidebar sits on the right: "<" opens it, ">" closes it */}
            <path d={collapsed ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} />
          </svg>
          <span className="visually-hidden">
            {collapsed ? 'Show filters' : 'Hide filters'}
          </span>
        </button>
        </div>

        {/* Outside the scrolling body, so always visible */}
        {!collapsed && (
          <>
            <input
              type="search"
              className="filter-sidebar__search"
              placeholder="Search story arcs, characters, creators…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search story arcs, characters, creators, teams, locations and objects"
            />
            <div className="filter-sidebar__options">
              <label className="filter-sidebar__check">
                <input
                  type="checkbox"
                  checked={!filter.hideOptional}
                  onChange={(e) => onChange({ ...filter, hideOptional: !e.target.checked })}
                />
                <span>Show optional</span>
              </label>
              <label className="filter-sidebar__check filter-sidebar__check--history">
                <input
                  type="checkbox"
                  checked={!filter.hideHistory}
                  onChange={(e) => onChange({ ...filter, hideHistory: !e.target.checked })}
                />
                <span>Show history</span>
              </label>
            </div>
          </>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          className="filter-sidebar__rail"
          onClick={() => setAndSave(false)}
          aria-hidden="true"
          tabIndex={-1}
        >
          <span className="filter-sidebar__rail-label">Filters</span>
          {activeCount > 0 && (
            <span className="filter-sidebar__badge">{activeCount}</span>
          )}
        </button>
      )}

      <div id={BODY_ID} className="filter-sidebar__body" hidden={collapsed}>
        {/* Active filters first, every kind including story arcs, so it is
            always clear what is filtering the map. */}
        {ENTITY_KINDS.filter((kind) => filter.tags[kind].length > 0).map((kind) => (
          <ChipGroup key={kind} label={`Selected ${ENTITY_LABELS[kind].toLowerCase()}`}>
            {filter.tags[kind].map((id) => (
              <button
                key={id}
                type="button"
                className="chip chip--with-img is-on"
                aria-label={`Remove ${entityName(kind, id)}`}
                onClick={() => onChange(withoutTag(filter, kind, id))}
              >
                <TagImage url={entityOf(kind, id)?.coverUrl} />
                {entityName(kind, id)} <span aria-hidden="true">×</span>
              </button>
            ))}
          </ChipGroup>
        ))}

        {/* Search results across tag kinds, most frequent first */}
        {q === '' ? (
          <p className="filter-sidebar__hint">
            Type to find characters, creators, teams, locations and objects.
          </p>
        ) : (
          SEARCH_KINDS.map((kind) => {
            const counts = tagCounts[kind];
            // Only tags that appear in this guide.
            const results = entities[kind]
              .filter(
                (e) => counts.has(e.id) && match(e.name) && !filter.tags[kind].includes(e.id),
              )
              .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
            if (results.length === 0) return null;
            return (
              <ChipGroup key={kind} label={ENTITY_LABELS[kind]}>
                {results.slice(0, RESULTS_PER_KIND).map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    className="chip chip--with-img"
                    title={`${counts.get(entity.id) ?? 0} issues`}
                    onClick={() => onChange(withTag(filter, kind, entity.id))}
                  >
                    <TagImage url={entity.coverUrl} />
                    {entity.name}
                    <span className="chip__count">{counts.get(entity.id) ?? 0}</span>
                  </button>
                ))}
                {results.length > RESULTS_PER_KIND && (
                  <span className="chip-group__empty">
                    and {results.length - RESULTS_PER_KIND} more, keep typing
                  </span>
                )}
              </ChipGroup>
            );
          })
        )}

        {/* All story arcs of the guide, at the bottom */}
        <section className="chip-group" aria-label="Story arcs">
          <h3 className="chip-group__label">Story arcs</h3>
          {shownArcs.length === 0 ? (
            <span className="chip-group__empty">No matches</span>
          ) : (
            <ul className="arc-list">
              {shownArcs.map(({ arc, done, total }) => {
                const on = filter.tags.arcs.includes(arc.id);
                return (
                  <li key={arc.id} className={`arc-row${on ? ' is-on' : ''}`}>
                    {/* Two buttons side by side (buttons can't be nested) */}
                    <button
                      type="button"
                      className="arc-row__zoom"
                      onClick={() => onZoomArc(arc.id)}
                      aria-label={`Zoom to the first issue of ${arc.name}`}
                      title="Zoom to its first issue"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="7" cy="7" r="4.5" />
                        <path d="M10.5 10.5 14 14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="arc-row__main"
                      aria-pressed={on}
                      title={[arc.deck, `${done} of ${total} issues read`]
                        .filter(Boolean)
                        .join('\n\n')}
                      onClick={() =>
                        onChange(
                          on ? withoutTag(filter, 'arcs', arc.id) : withTag(filter, 'arcs', arc.id),
                        )
                      }
                    >
                      <span className="arc-row__name">{arc.name}</span>
                      <span className="arc-row__count">
                        {done}/{total}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="chip-group" aria-label={label}>
      <h3 className="chip-group__label">{label}</h3>
      <div className="chip-group__chips">{children}</div>
    </section>
  );
}
