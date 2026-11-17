/**
 * Resolves an image URL from the data. Absolute URLs are used as-is; relative
 * paths point into `public/` and get the deploy base path (e.g. "/marvel-guide/").
 */
export function resolveAssetUrl(url: string): string {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
  return import.meta.env.BASE_URL + url.replace(/^\//, '');
}
