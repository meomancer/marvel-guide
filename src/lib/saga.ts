import { resolveAssetUrl } from './assets.ts';
import type { Issue, Saga } from '../types/comic.ts';

/** Facts shown on a saga card, also used by the navbar search on the home page. */
export function sagaSummary(saga: Saga) {
  const main = saga.issues.filter((i) => !i.optional);
  // History is background and saga boxes belong to other guides: neither is
  // counted as optional reading.
  const optional = saga.issues.filter((i) => i.optional && !i.history && !i.ref);
  const byDate = (a: Issue, b: Issue) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0);
  // The guide's own issues: saga boxes (references to other guides) excluded.
  const own = saga.issues.filter((i) => !i.ref);
  const years = own.map((i) => i.year);
  const firstCover = [...main].sort(byDate).find((i) => i.coverUrl)?.coverUrl;
  return {
    main,
    optional,
    /** Number of the guide's own issues (main, optional and history). */
    count: own.length,
    startYear: Math.min(...years),
    endYear: Math.max(...years),
    coverUrl: firstCover ? resolveAssetUrl(firstCover) : undefined,
  };
}
