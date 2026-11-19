import { resolveAssetUrl } from './assets.ts';
import type { Issue, Saga } from '../types/comic.ts';

/** Facts shown on a saga card, also used by the navbar search on the home page. */
export function sagaSummary(saga: Saga) {
  // The guide's own main issues: saga boxes on the main path belong to another guide.
  const main = saga.issues.filter((i) => !i.optional && !i.ref);
  // History is background and saga boxes belong to other guides: neither is
  // counted as optional reading.
  const optional = saga.issues.filter((i) => i.optional && !i.history && !i.ref);
  const byDate = (a: Issue, b: Issue) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0);
  // The guide's own issues: saga boxes (references to other guides) excluded.
  const own = saga.issues.filter((i) => !i.ref);
  // The guide's span is its main reading path only: optional branches and
  // history (e.g. a 1941 debut) would stretch it.
  const span = main.length > 0 ? main : own;
  const years = span.map((i) => i.year);
  const first = [...span].sort(byDate)[0];
  const firstCover = [...main].sort(byDate).find((i) => i.coverUrl)?.coverUrl;
  return {
    main,
    optional,
    /** Number of the guide's own issues (main, optional and history). */
    count: own.length,
    startYear: Math.min(...years),
    endYear: Math.max(...years),
    /** Cover date of the first main issue as one number (year * 12 + month), for ordering guides. */
    startKey: first ? first.year * 12 + (first.month ?? 0) : Infinity,
    coverUrl: firstCover ? resolveAssetUrl(firstCover) : undefined,
  };
}
