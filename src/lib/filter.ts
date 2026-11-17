import {
  ENTITY_KINDS,
  type EntityId,
  type EntityKind,
  type GuideFilter,
  type Issue,
  type IssueId,
  type ReadingEdge,
} from '../types/comic.ts';

export const EMPTY_FILTER: GuideFilter = {
  tags: { characters: [], creators: [], teams: [], locations: [], objects: [], arcs: [] },
  hideOptional: false,
};

/** Number of selected tags. */
export function activeTagCount(filter: GuideFilter): number {
  return ENTITY_KINDS.reduce((sum, kind) => sum + filter.tags[kind].length, 0);
}

export function isFilterEmpty(filter: GuideFilter): boolean {
  return activeTagCount(filter) === 0 && !filter.hideOptional;
}

/** Adds a tag to the filter (no-op if already selected). */
export function withTag(filter: GuideFilter, kind: EntityKind, id: EntityId): GuideFilter {
  if (filter.tags[kind].includes(id)) return filter;
  return { ...filter, tags: { ...filter.tags, [kind]: [...filter.tags[kind], id] } };
}

/** Removes a tag from the filter. */
export function withoutTag(filter: GuideFilter, kind: EntityKind, id: EntityId): GuideFilter {
  return {
    ...filter,
    tags: { ...filter.tags, [kind]: filter.tags[kind].filter((t) => t !== id) },
  };
}

/** Selected values match if the issue has any of them. */
const anyOf = (selected: string[], values: string[] | undefined) =>
  selected.length === 0 || (values ?? []).some((v) => selected.includes(v));

/**
 * OR within a category, AND across categories, empty category = no filter.
 */
export function matchesFilter(issue: Issue, filter: GuideFilter): boolean {
  if (filter.hideOptional && issue.optional) return false;
  return ENTITY_KINDS.every((kind) => anyOf(filter.tags[kind], issue[kind]));
}

/**
 * Builds the lines between visible issues. When hidden issues sit between two
 * visible ones (A -> X -> B, X hidden), a direct "bridged" line A -> B is
 * drawn instead, so reading order stays visible after filtering.
 */
export function buildReadingEdges(
  issues: Issue[],
  visible: Set<IssueId>,
): ReadingEdge[] {
  const byId = new Map(issues.map((i) => [i.id, i]));
  const edges: ReadingEdge[] = [];

  for (const id of visible) {
    const issue = byId.get(id);
    if (!issue) continue;

    // Walk forward through hidden issues until visible ones are reached.
    const found = new Map<IssueId, boolean>(); // target -> bridged
    const seen = new Set<IssueId>();
    const stack = issue.next.map((target) => ({ target, bridged: false }));

    while (stack.length > 0) {
      const { target, bridged } = stack.pop()!;
      if (visible.has(target)) {
        // A direct line wins over a bridged one to the same target.
        found.set(target, (found.get(target) ?? true) && bridged);
        continue;
      }
      if (seen.has(target)) continue;
      seen.add(target);
      for (const next of byId.get(target)?.next ?? []) {
        stack.push({ target: next, bridged: true });
      }
    }

    for (const [target, bridged] of found) {
      edges.push({ source: id, target, bridged });
    }
  }

  return edges;
}
