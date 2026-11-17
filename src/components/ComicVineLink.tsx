/** Small external-link icon that opens a Comic Vine page in a new tab. */
export function ComicVineLink({ url, name }: { url?: string; name: string }) {
  if (!url) return null;
  return (
    <a
      className="cv-link"
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`${name} on Comic Vine (opens in a new tab)`}
      title="Open on Comic Vine"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v3.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5H7" />
      </svg>
    </a>
  );
}
