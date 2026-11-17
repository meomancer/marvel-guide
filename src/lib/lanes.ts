import type { Issue, IssueId, ReadingEdge } from '../types/comic.ts';

/**
 * Lane assignment for the Issues view.
 *
 * Essential issues share the "main" lane. Optional issues are grouped into
 * branches: each chain of optional issues linked by reading-order lines is
 * one branch (e.g. Avengers #2 -> #3); where several optional lines lead into
 * one issue, only the closest in time continues its column. Branches that overlap in time get their own column,
 * alternating right and left of the main lane (R1, L1, R2, L2, ...), so their
 * lines never run through each other's boxes. A branch that continues another
 * branch (e.g. Avengers/Defenders War -> Celestial Madonna) reuses its column.
 */

export const MAIN_LANE = 'main';

interface Branch {
  key: string;
  issueIds: IssueId[];
  /** First month the branch occupies (its first issue). */
  start: number;
  /** Last month it occupies: its last issue, or where its lines rejoin. */
  end: number;
  /** Branches whose lines lead into this one. */
  from: Set<string>;
  /** The issue its last line rejoins (latest target outside the branch). */
  rejoin?: IssueId;
  /** True when a line leads into it from the main timeline (it splits off). */
  splitsFromMain: boolean;
}

const monthIndex = (i: Issue) => i.year * 12 + ((i.month ?? 1) - 1);

/** Slot order around the main lane: R1, L1, R2, L2, ... */
const slotName = (slot: number) =>
  `${slot % 2 === 0 ? 'R' : 'L'}${Math.floor(slot / 2) + 1}`;
const sideOf = (slot: number) => slot % 2;
/** Distance from the main lane: 0 for R1/L1, 1 for R2/L2, ... */
const depthOf = (slot: number) => Math.floor(slot / 2);

export interface LaneAssignment {
  laneOf: Map<IssueId, string>;
  /** All lanes left to right, e.g. ["L2", "L1", "main", "R1", "R2"]. */
  laneOrder: string[];
}

export function assignLanes(
  visibleIssues: Issue[],
  edges: ReadingEdge[],
): LaneAssignment {
  const byId = new Map(visibleIssues.map((i) => [i.id, i]));

  // Union-find: optional issues joined by a line belong to the same branch.
  const parent = new Map<IssueId, IssueId>();
  for (const issue of visibleIssues) if (issue.optional) parent.set(issue.id, issue.id);
  const root = (id: IssueId): IssueId => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(id, r);
    return r;
  };
  // Each optional issue continues the column of its closest optional
  // predecessor only. Other optional lines into it (e.g. a 1973 debut that
  // leads to a 1977 annual) stay separate branches that join from the side,
  // instead of running down through every box in between.
  const closest = new Map<IssueId, IssueId>();
  for (const edge of edges) {
    if (!parent.has(edge.source) || !parent.has(edge.target)) continue;
    const current = closest.get(edge.target);
    if (
      current === undefined ||
      monthIndex(byId.get(edge.source)!) > monthIndex(byId.get(current)!)
    ) {
      closest.set(edge.target, edge.source);
    }
  }
  for (const [target, source] of closest) {
    parent.set(root(source), root(target));
  }
  const branchKey = (i: Issue) => root(i.id);

  // Group optional issues into branches.
  const branches = new Map<string, Branch>();
  for (const issue of visibleIssues) {
    if (!issue.optional) continue;
    const key = branchKey(issue);
    const m = monthIndex(issue);
    const b = branches.get(key);
    if (b) {
      b.issueIds.push(issue.id);
      b.start = Math.min(b.start, m);
      b.end = Math.max(b.end, m);
    } else {
      branches.set(key, {
        key,
        issueIds: [issue.id],
        start: m,
        end: m,
        from: new Set(),
        splitsFromMain: false,
      });
    }
  }

  // A branch occupies its column until the point where its lines rejoin.
  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    const sourceBranch = source.optional ? branches.get(branchKey(source)) : undefined;
    const targetBranch = target.optional ? branches.get(branchKey(target)) : undefined;
    if (sourceBranch && sourceBranch !== targetBranch) {
      const m = monthIndex(target);
      if (m >= sourceBranch.end) sourceBranch.rejoin = target.id;
      sourceBranch.end = Math.max(sourceBranch.end, m);
    }
    if (sourceBranch && targetBranch && sourceBranch !== targetBranch) {
      targetBranch.from.add(sourceBranch.key);
    }
    if (!source.optional && targetBranch) targetBranch.splitsFromMain = true;
  }

  // Greedy packing, earliest branch first.
  const ordered = [...branches.values()].sort((a, b) => a.start - b.start);
  const slotEnd: number[] = []; // last month used, per slot
  const slotLast: (string | undefined)[] = []; // last branch placed, per slot
  const slotOf = new Map<string, number>();

  const isActive = (slot: number, from: number) =>
    slotEnd[slot] !== undefined && slotEnd[slot]! >= from;

  /**
   * A slot works if it is free and the branch's lines won't cross another
   * branch's lines on the same side. Lines rejoin by turning towards the main
   * lane, so:
   * - an outer branch must not rejoin while this one is still running
   *   (its sideways line would cut through this column), and
   * - an inner branch must not still be running when this one rejoins
   *   (this one's sideways line would cut through it).
   * With equal rejoin points, the later branch therefore goes outside.
   * - a branch that splits off the main timeline must not have a running
   *   branch inside it (the line leaving main would cut through it).
   */
  const fits = (slot: number, branch: Branch) => {
    if (isActive(slot, branch.start)) return false;
    for (let other = 0; other < slotEnd.length; other++) {
      if (other === slot || sideOf(other) !== sideOf(slot)) continue;
      if (!isActive(other, branch.start)) continue;
      const end = slotEnd[other]!;
      if (depthOf(other) > depthOf(slot) && end <= branch.end) return false;
      if (depthOf(other) < depthOf(slot) && end > branch.end) return false;
      if (depthOf(other) < depthOf(slot) && branch.splitsFromMain) return false;
    }
    return true;
  };

  const slotRejoin: (IssueId | undefined)[] = [];

  for (const branch of ordered) {
    let slot = -1;

    // Continue a predecessor branch in its own column when that column is free.
    for (const fromKey of branch.from) {
      const s = slotOf.get(fromKey);
      if (s !== undefined && slotLast[s] === fromKey && slotEnd[s]! <= branch.start) {
        slot = s;
        break;
      }
    }
    // Otherwise a column that won't cross other lines. Prefer the side of a
    // running branch that rejoins at the same issue, so the two merge neatly.
    if (slot === -1) {
      const limit = 2 * (slotEnd.length + ordered.length) + 2;
      const sameRejoin = slotRejoin.findIndex(
        (r, s) => r !== undefined && r === branch.rejoin && isActive(s, branch.start),
      );
      const candidates: number[] = [];
      if (sameRejoin !== -1) {
        for (let s = sideOf(sameRejoin); s < limit; s += 2) candidates.push(s);
      }
      for (let s = 0; s < limit; s++) candidates.push(s);
      slot = candidates.find((s) => fits(s, branch)) ?? -1;
    }
    // Fallback: the first free column, even if a line has to cross.
    if (slot === -1) {
      slot = 0;
      while (isActive(slot, branch.start)) slot++;
    }

    slotOf.set(branch.key, slot);
    slotEnd[slot] = branch.end;
    slotLast[slot] = branch.key;
    slotRejoin[slot] = branch.rejoin;
  }

  const laneOf = new Map<IssueId, string>();
  for (const issue of visibleIssues) {
    laneOf.set(
      issue.id,
      issue.optional ? slotName(slotOf.get(branchKey(issue))!) : MAIN_LANE,
    );
  }

  // Only lanes that were used; unused slots between them are dropped.
  const used = [...new Set(slotOf.values())].sort((a, b) => a - b);
  const left: string[] = [];
  const right: string[] = [];
  for (const s of used) (s % 2 === 0 ? right : left).push(slotName(s));
  return { laneOf, laneOrder: [...left.reverse(), MAIN_LANE, ...right] };
}
