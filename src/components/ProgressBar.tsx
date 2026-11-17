/**
 * Reading progress: a bar over the main-timeline (essential) issues, plus a
 * separate count for optional ones.
 */
export function ProgressBar({
  label,
  done,
  total,
  optionalDone = 0,
  optionalTotal = 0,
}: {
  /** What the bar measures, for screen readers, e.g. "Avengers". */
  label: string;
  done: number;
  total: number;
  optionalDone?: number;
  optionalTotal?: number;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const finished = total > 0 && done === total;
  return (
    <div className={`progress${finished ? ' is-finished' : ''}`}>
      <div
        className="progress__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${label}: main issues read`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="progress__text">
        {finished ? 'Main timeline read' : `${done} of ${total} main issues read`}
        {optionalTotal > 0 && (
          <span className="progress__optional">
            {optionalDone} of {optionalTotal} optional
          </span>
        )}
      </p>
    </div>
  );
}
