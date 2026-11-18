import {
  ENTITY_KINDS,
  type Entity,
  type EntityKind,
  type GuideData,
  type Issue,
  type IssueDetail,
  type IssueFacts,
  type IssueId,
  type Saga,
  type SagaFile,
} from '../types/comic.ts';
import arcsJson from './arcs.json';
import charactersJson from './characters.json';
import creatorsJson from './creators.json';
import issuesJson from './issues.json';
import locationsJson from './locations.json';
import objectsJson from './objects.json';
import teamsJson from './teams.json';

/** Sorted by name so every list of tags reads alphabetically. */
const byName = (items: Entity[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

/** The catalog: every issue once, shared by all guides. */
const catalog = issuesJson as IssueFacts[];
const catalogById = new Map(catalog.map((i) => [i.id, i]));

/**
 * One file per guide: src/data/sagas/<id>.json, holding references to
 * catalog issues. Loaded eagerly for now (one guide); with many guides these
 * can become lazy like the detail files.
 */
const sagaFiles = import.meta.glob<SagaFile>('./sagas/*.json', {
  eager: true,
  import: 'default',
});

/** Join a guide's entries with the catalog (unknown ids are reported, not shown). */
function joinSaga(file: SagaFile): Saga {
  return {
    id: file.id,
    name: file.name,
    type: file.type,
    description: file.description,
    issues: file.entries.flatMap((entry) => {
      const facts = catalogById.get(entry.issue);
      return facts
        ? [
            {
              ...facts,
              next: entry.next,
              // History and references to other guides are off the main timeline too.
              optional: entry.optional || entry.history || entry.ref !== undefined,
              history: entry.history,
              role: entry.role,
              ref: entry.ref,
            },
          ]
        : [];
    }),
  };
}

const sagaFileList = Object.values(sagaFiles);

const data: GuideData = {
  sagas: sagaFileList.map(joinSaga).sort((a, b) => a.name.localeCompare(b.name)),
  entities: {
    characters: byName(charactersJson as Entity[]),
    creators: byName(creatorsJson as Entity[]),
    teams: byName(teamsJson as Entity[]),
    locations: byName(locationsJson as Entity[]),
    objects: byName(objectsJson as Entity[]),
    arcs: byName(arcsJson as Entity[]),
  },
};

/** Tag ids of one kind on an issue (empty if the issue has none). */
export function issueTags(issue: Issue, kind: EntityKind): string[] {
  return issue[kind] ?? [];
}

/**
 * Per-issue detail files (synopsis, credits), shared by all guides. Each
 * becomes its own small chunk, fetched only when that issue's panel opens.
 */
const detailFiles = import.meta.glob<IssueDetail>('./issues/*.json', {
  import: 'default',
});

export async function loadIssueDetail(id: IssueId): Promise<IssueDetail | undefined> {
  const load = detailFiles[`./issues/${id}.json`];
  return load ? load() : undefined;
}

/** How many issues of a guide carry each tag, per kind. Ranks search results. */
export function countTags(issues: Issue[]): Record<EntityKind, Map<string, number>> {
  return Object.fromEntries(
    ENTITY_KINDS.map((kind) => {
      const counts = new Map<string, number>();
      for (const issue of issues) {
        for (const tag of issueTags(issue, kind)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      return [kind, counts];
    }),
  ) as Record<EntityKind, Map<string, number>>;
}

/**
 * Checks that every id referenced in the data exists and that ids are unique.
 * Returns a list of human-readable problems (empty when the data is valid).
 */
export function validateGuideData(d: GuideData): string[] {
  const problems: string[] = [];

  const ids = <T extends { id: string }>(kind: string, items: T[]) => {
    const set = new Set<string>();
    for (const item of items) {
      if (set.has(item.id)) problems.push(`Duplicate ${kind} id "${item.id}"`);
      set.add(item.id);
    }
    return set;
  };

  ids('saga', d.sagas);
  ids('catalog issue', catalog);
  const fileById = new Map(sagaFileList.map((f) => [f.id, f]));

  // One home saga per issue: other guides may only show it as a saga box
  // (`ref`) pointing back to that home saga.
  const homeOf = new Map<string, string>();
  for (const file of sagaFileList) {
    for (const entry of file.entries) {
      if (entry.ref !== undefined) continue;
      const home = homeOf.get(entry.issue);
      if (home && home !== file.id) {
        problems.push(
          `Issue "${entry.issue}" is listed in both "${home}" and "${file.id}": keep it in one saga and add it to the other as a reference ("ref": "${home}")`,
        );
      } else {
        homeOf.set(entry.issue, file.id);
      }
    }
  }
  for (const file of sagaFileList) {
    for (const entry of file.entries) {
      if (!catalogById.has(entry.issue)) {
        problems.push(`Saga "${file.id}" refers to issue "${entry.issue}", which is not in issues.json`);
      }
      if (entry.ref !== undefined) {
        // A saga box must point at a real issue of the other guide.
        const other = fileById.get(entry.ref);
        if (!other) {
          problems.push(`Saga "${file.id}" links issue "${entry.issue}" to unknown saga "${entry.ref}"`);
        } else if (!other.entries.some((e) => e.issue === entry.issue && e.ref === undefined)) {
          problems.push(`Saga "${file.id}" links "${entry.issue}" to "${entry.ref}", which does not list it`);
        }
      }
    }
  }
  const entityIds = Object.fromEntries(
    ENTITY_KINDS.map((kind) => [kind, ids(kind, d.entities[kind])]),
  ) as Record<EntityKind, Set<string>>;

  for (const saga of d.sagas) {
    // Issue ids and reading order are checked within each guide.
    const issueIds = ids(`issue in saga "${saga.id}"`, saga.issues);
    for (const issue of saga.issues) {
      if (!Number.isInteger(issue.issueNumber)) {
        problems.push(`Issue "${issue.id}" must have a single whole issueNumber`);
      }
      for (const kind of ENTITY_KINDS) {
        for (const tag of issueTags(issue, kind)) {
          if (!entityIds[kind].has(tag)) {
            problems.push(`Issue "${issue.id}" has unknown ${kind} tag "${tag}"`);
          }
        }
      }
      for (const n of issue.next) {
        if (!issueIds.has(n)) {
          problems.push(`Issue "${issue.id}" in saga "${saga.id}" points to unknown next issue "${n}"`);
        }
      }
    }
  }

  return problems;
}

export const guideData = data;
export const dataProblems = validateGuideData(data);
