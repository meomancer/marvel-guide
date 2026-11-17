/** Round avatar in a tag chip; an empty circle keeps chips aligned. */
export function TagImage({ url }: { url?: string }) {
  return url ? (
    <img className="chip__img" src={url} alt="" loading="lazy" />
  ) : (
    <span className="chip__img" aria-hidden="true" />
  );
}
