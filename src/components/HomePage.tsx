import { EMPTY_FILTER } from '../lib/filter.ts';
import { formatYears } from '../lib/format.ts';
import { useReadIssues } from '../lib/readIssuesContext.ts';
import { buildUrl } from '../lib/urlState.ts';
import { sagaSummary } from '../lib/saga.ts';
import { SAGA_TYPE_LABELS, type Saga, type SagaId } from '../types/comic.ts';
import { ProgressBar } from './ProgressBar.tsx';

/** Home page: one card per guide. Picking one opens its issue map. */
export function HomePage({
  sagas,
  onOpen,
}: {
  sagas: Saga[];
  onOpen: (id: SagaId) => void;
}) {
  const { read } = useReadIssues();

  return (
    <main className="home">
      <h2 className="home__title">Pick a reading guide</h2>
      <ul className="home__grid">
        {sagas.map((saga) => {
          const s = sagaSummary(saga);
          const done = s.main.filter((i) => read.has(i.id)).length;
          const optionalDone = s.optional.filter((i) => read.has(i.id)).length;
          return (
            <li key={saga.id}>
              <a
                className="saga-card"
                href={buildUrl({ sagaId: saga.id, filter: EMPTY_FILTER })}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onOpen(saga.id);
                }}
              >
                {s.coverUrl ? (
                  <img className="saga-card__cover" src={s.coverUrl} alt="" loading="lazy" />
                ) : (
                  <span className="saga-card__cover" aria-hidden="true" />
                )}
                <span className="saga-card__body">
                  <span className="saga-card__type">{SAGA_TYPE_LABELS[saga.type]}</span>
                  <span className="saga-card__name">{saga.name}</span>
                  <span className="saga-card__meta">
                    {formatYears(s.startYear, s.endYear)}, {s.count} issues
                  </span>
                  {saga.description && (
                    <span className="saga-card__description">{saga.description}</span>
                  )}
                  <ProgressBar
                    label={saga.name}
                    done={done}
                    total={s.main.length}
                    optionalDone={optionalDone}
                    optionalTotal={s.optional.length}
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
