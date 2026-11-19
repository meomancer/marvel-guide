/**
 * Data types for the Marvel reading guide.
 *
 * Stored normalised, like relational tables joined by id:
 * - src/data/issues.json: the catalog, every issue once (`IssueFacts`).
 * - src/data/sagas/<id>.json: one guide (`SagaFile`), whose `entries` point
 *   at catalog issues and add what is specific to that guide (reading-order
 *   `next`, `optional`).
 * At load time each guide is joined into a `Saga` of full `Issue`s, which
 * the rest of the app uses. Story arcs, characters, creators and other tags
 * (from Comic Vine) drive search and filtering.
 */

/** Slug id, e.g. "asm-1". Unique across all issues. */
export type IssueId = string;

/** Slug id, e.g. "spider-man". */
export type CharacterId = string;

/** Slug id of a creator, team, location or object, e.g. "jack-kirby". */
export type EntityId = string;

/**
 * Searchable tag categories that come from Comic Vine. Each has a dictionary
 * file in src/data/ (e.g. creators.json) and a list of ids on every Issue.
 */
export const ENTITY_KINDS = [
  'characters',
  'creators',
  'teams',
  'locations',
  'objects',
  'arcs',
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const ENTITY_LABELS: Record<EntityKind, string> = {
  characters: 'Characters',
  creators: 'Creators',
  teams: 'Teams',
  locations: 'Locations',
  objects: 'Objects',
  arcs: 'Story arcs',
};

/** Month of publication, 1 = January ... 12 = December. */
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * One issue in a guide: catalog facts joined with the guide's entry.
 * Every field except `next` and `optional` comes from the catalog.
 */
export interface Issue {
  id: IssueId;
  /** Display title, e.g. "Amazing Spider-Man #1". */
  title: string;
  /** Series name, e.g. "The Amazing Spider-Man". */
  series?: string;
  /** A single issue number. Multi-issue stories are split into one Issue each. */
  issueNumber: number;
  /**
   * Optional reading: shown on a branch beside the main timeline. Branches
   * split off the main line and rejoin it via `next`. Default: essential.
   */
  optional?: boolean;
  /**
   * Character history (shown yellow): a debut or key moment in a character's
   * own series. Background only: not part of the guide's story arcs. Always
   * off the main timeline (also `optional`).
   */
  history?: boolean;
  /**
   * Reference to another guide (purple saga box): this issue belongs to the
   * saga with this id and is shown here as context. Clicking it opens that
   * guide in a new tab, zoomed to this issue. Off the main timeline, and not
   * counted in this guide's progress, arcs or search.
   */
  ref?: SagaId;
  /** Kind of optional reading (pink boxes). */
  role?: OptionalRole;
  /**
   * Short highlight shown above the box, e.g. "Iron Man's debut" or
   * "Vision marries Scarlet Witch". Keep it to a few words.
   */
  keypoint?: string;
  /** Publication (cover) year. Determines the box's position on the timeline. */
  year: number;
  /** Optional month, to order boxes within the same year. */
  month?: Month;
  coverUrl?: string;
  synopsis?: string;
  /** Comic Vine issue id. Details live in src/data/issues/<id>.json. */
  comicVineId?: number;
  /** Character tags on this box. */
  characters: CharacterId[];
  /** Creator tags (writers, artists, editors...). Roles are in the detail file. */
  creators?: EntityId[];
  teams?: EntityId[];
  locations?: EntityId[];
  objects?: EntityId[];
  /** Comic Vine story arcs (ids in arcs.json). Missing = not fetched yet. */
  arcs?: EntityId[];
  /** Issues to read after this one. Each entry becomes a line in the diagram. */
  next: IssueId[];
}

/** A searchable tag: character, creator, team, location or object. */
export interface Entity {
  id: EntityId;
  /** Display name, e.g. "Jack Kirby". */
  name: string;
  comicVineId?: number;
  /** Comic Vine page. */
  comicVineUrl?: string;
  /** Small square image from Comic Vine. */
  coverUrl?: string;
  /** One-line summary from Comic Vine ("" if it has none). */
  deck?: string;
  /** Optional colour for the tag chip, e.g. "#c62828". */
  color?: string;
}

/** A character that can be used as a tag. */
export type Character = Entity;

/** One block of a synopsis: a section heading or a paragraph. */
export interface SynopsisBlock {
  kind: 'heading' | 'paragraph';
  text: string;
}

/**
 * Long-form data for one issue, in src/data/issues/<issue id>.json.
 * Loaded only when the issue's detail panel opens.
 */
export interface IssueDetail {
  id: IssueId;
  /** Story title from Comic Vine, e.g. "The Coming of the Avengers!". */
  name?: string;
  /** One-line summary. */
  deck?: string;
  synopsis: SynopsisBlock[];
  credits: { creator: EntityId; roles: string[] }[];
  /** Comic Vine page, for attribution. */
  comicVineUrl?: string;
}

/** Slug id, e.g. "avengers". */
export type SagaId = string;

/** Catalog record (src/data/issues.json): facts that are the same in every guide. */
export type IssueFacts = Omit<Issue, 'next' | 'optional' | 'history' | 'role' | 'ref'>;

/**
 * Kinds of optional reading:
 * - impact: side story whose effects reach the main timeline (worth reading),
 * - tie-in: part of an event, told from another angle,
 * - prelude: sets up a main story,
 * - side: a parallel series or the rest of a run; skip freely.
 */
export type OptionalRole = 'impact' | 'tie-in' | 'prelude' | 'side';

export const ROLE_LABELS: Record<OptionalRole, string> = {
  impact: 'Impact',
  'tie-in': 'Tie-in',
  prelude: 'Prelude',
  side: 'Side',
};

/** A guide's reference to a catalog issue, with what is specific to the guide. */
export interface SagaEntry {
  /** Catalog issue id. */
  issue: IssueId;
  /** Issues (in this guide) to read after this one. */
  next: IssueId[];
  /** Side reading in this guide: drawn on a branch beside the main timeline. */
  optional?: boolean;
  /** Kind of optional reading. */
  role?: OptionalRole;
  /** Character history (yellow, background only). Implies off the main timeline. */
  history?: boolean;
  /**
   * Only with `ref`: the saga box is part of this guide's main reading path
   * (e.g. Kree-Skrull War inside Avengers), so it sits in the main lane.
   * Without it a saga box is laid out on a branch like optional reading.
   */
  main?: boolean;
  /**
   * The issue belongs to another guide (saga id): shown as a purple saga box
   * linking there. The issue must be an entry of that guide.
   */
  ref?: SagaId;
}

/** What a guide follows: a team, one character, or an event/storyline. */
export type SagaType = 'team' | 'character' | 'event';

export const SAGA_TYPE_LABELS: Record<SagaType, string> = {
  team: 'Team',
  character: 'Character',
  event: 'Event',
};

/** Home page sections, in this order (empty ones are left out). */
export const SAGA_TYPE_SECTIONS: { type: SagaType; title: string }[] = [
  { type: 'event', title: 'Events' },
  { type: 'team', title: 'Teams' },
  { type: 'character', title: 'Characters' },
];

/** As stored in src/data/sagas/<id>.json. */
export interface SagaFile {
  id: SagaId;
  /** Display name, e.g. "Avengers". */
  name: string;
  type: SagaType;
  description?: string;
  /** In reading order. */
  entries: SagaEntry[];
}

/**
 * One reading guide, e.g. the Avengers from their formation onward,
 * with its entries joined to the catalog.
 */
export interface Saga {
  id: SagaId;
  name: string;
  type: SagaType;
  description?: string;
  issues: Issue[];
}

/** Everything the guide needs, as loaded from the JSON data files. */
export interface GuideData {
  /** All guides, sorted by name. */
  sagas: Saga[];
  /** Tag dictionaries, one per kind, sorted by name. Shared by all guides. */
  entities: Record<EntityKind, Entity[]>;
}

/**
 * Active filters.
 * - Within one tag kind it is OR (any selected story arc matches).
 * - Across kinds it is AND (must match a story arc AND a character).
 * - An empty list does not filter.
 */
export interface GuideFilter {
  /** Selected tags per kind (characters, creators, teams, ...). */
  tags: Record<EntityKind, EntityId[]>;
  /** Hide optional (pink) issues. */
  hideOptional: boolean;
  /** Hide character history (yellow) issues. */
  hideHistory: boolean;
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
