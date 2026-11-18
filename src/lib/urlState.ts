import {
  ENTITY_KINDS,
  type GuideFilter,
  type IssueId,
  type SagaId,
} from '../types/comic.ts';

/**
 * The app's state as a URL, so guides and filters can be bookmarked, shared
 * and navigated with Back/Forward:
 *
 *   /                 home: one card per saga (guide)
 *   /<saga id>        that guide's issue map, e.g. /avengers
 *                     ?arcs=korvac-saga&characters=thor&creators=...
 *                     &optional=hide&history=hide&issue=<selected issue>
 *
 * Paths are relative to the deploy base (e.g. /marvel-guide/ on GitHub Pages).
 */

export interface UrlState {
  /** undefined = home page. */
  sagaId?: SagaId;
  filter: GuideFilter;
  issueId?: IssueId;
}

const BASE = import.meta.env.BASE_URL; // always ends with "/"

const list = (params: URLSearchParams, key: string) =>
  (params.get(key) ?? '').split(',').filter(Boolean);

export function readUrl(): UrlState {
  const path = window.location.pathname;
  const rest = path.startsWith(BASE) ? path.slice(BASE.length) : path.replace(/^\//, '');
  const sagaId = decodeURIComponent(rest.replace(/\/$/, '').split('/')[0] ?? '') || undefined;
  const params = new URLSearchParams(window.location.search);

  return {
    sagaId,
    issueId: params.get('issue') ?? undefined,
    filter: {
      tags: Object.fromEntries(ENTITY_KINDS.map((kind) => [kind, list(params, kind)])) as
        GuideFilter['tags'],
      hideOptional: params.get('optional') === 'hide',
      hideHistory: params.get('history') === 'hide',
    },
  };
}

export function buildUrl(state: UrlState): string {
  if (!state.sagaId) return BASE;
  const params = new URLSearchParams();
  const { filter } = state;
  for (const kind of ENTITY_KINDS) {
    if (filter.tags[kind].length) params.set(kind, filter.tags[kind].join(','));
  }
  if (filter.hideOptional) params.set('optional', 'hide');
  if (filter.hideHistory) params.set('history', 'hide');
  if (state.issueId) params.set('issue', state.issueId);
  // Keep commas readable in the address bar.
  const query = params.toString().replace(/%2C/g, ',');
  return `${BASE}${encodeURIComponent(state.sagaId)}${query ? `?${query}` : ''}`;
}
