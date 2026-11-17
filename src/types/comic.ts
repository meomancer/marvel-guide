/**
 * Data types for the Marvel reading guide.
 *
 * The guide is a diagram: each box is an `Issue`, and lines between boxes
 * follow `Issue.next` (reading order). Boxes are tagged with characters and
 * events, which drive search and filtering.
 */

/** Slug id, e.g. "asm-1". Unique across all issues. */
export type IssueId = string;

/** Slug id, e.g. "spider-man". */
export type CharacterId = string;

/** Slug id, e.g. "civil-war". */
export type EventId = string;

/** Month of publication, 1 = January ... 12 = December. */
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** One box in the diagram. */
export interface Issue {
  id: IssueId;
  /** Display title, e.g. "Amazing Spider-Man #1". */
  title: string;
  /** Series name, e.g. "The Amazing Spider-Man". */
  series?: string;
  /** Issue number or range, e.g. "1" or "1-7" for an arc. */
  issueNumber?: string;
  /** Publication year. Determines the box's position on the timeline. */
  year: number;
  /** Optional month, to order boxes within the same year. */
  month?: Month;
  coverUrl?: string;
  synopsis?: string;
  /** Character tags on this box. */
  characters: CharacterId[];
  /** Event tags on this box. Empty if the issue is not part of an event. */
  events: EventId[];
  /** Issues to read after this one. Each entry becomes a line in the diagram. */
  next: IssueId[];
}

/** A character that can be used as a tag. */
export interface Character {
  id: CharacterId;
  /** Display name, e.g. "Spider-Man". */
  name: string;
  /** Optional colour for the tag chip, e.g. "#c62828". */
  color?: string;
}

/**
 * A crossover event that can be used as a tag.
 * Named `ComicEvent` to avoid clashing with the DOM `Event` type.
 */
export interface ComicEvent {
  id: EventId;
  /** Display name, e.g. "Civil War". */
  name: string;
  startYear?: number;
  endYear?: number;
  description?: string;
  color?: string;
}

/** Everything the guide needs, as loaded from the JSON data files. */
export interface GuideData {
  issues: Issue[];
  characters: Character[];
  events: ComicEvent[];
}

/**
 * Active filters.
 * - Within one list it is OR (any selected event matches).
 * - Across lists it is AND (must match an event AND a character).
 * - An empty list does not filter.
 */
export interface GuideFilter {
  events: EventId[];
  characters: CharacterId[];
}

/** A line between two boxes, after filtering. */
export interface ReadingEdge {
  source: IssueId;
  target: IssueId;
  /**
   * True when hidden issues were skipped between source and target
   * (A -> X -> B shown as A -> B). Drawn dashed.
   */
  bridged: boolean;
}
