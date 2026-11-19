import { EMPTY_FILTER } from '../lib/filter.ts';
import { formatYears } from '../lib/format.ts';
import { useReadIssues } from '../lib/readIssuesContext.ts';
import { buildUrl } from '../lib/urlState.ts';
import { sagaSummary } from '../lib/saga.ts';
import { SAGA_TYPE_SECTIONS, type Saga, type SagaId } from '../types/comic.ts';
import { ProgressBar } from './ProgressBar.tsx';

/**
 * Home page: one section per guide type (teams, characters, events), each
 * with one card per guide. Picking a card opens its issue map.
 */
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
      {SAGA_TYPE_SECTIONS.map(({ type, title }) => {
        // Oldest first, by the cover date of each guide's first main issue.
        const ofType = sagas
          .filter((saga) => saga.type === type)
          .map((saga) => ({ saga, s: sagaSummary(saga) }))
          .sort((a, b) => a.s.startKey - b.s.startKey || a.saga.name.localeCompare(b.saga.name));
        if (ofType.length === 0) return null;
        return (
          <section key={type} className="home__section" aria-labelledby={`home-${type}`}>
            <h3 id={`home-${type}`} className="home__section-title">
              {title}
              <span className="home__section-count">{ofType.length}</span>
            </h3>
            <ul className="home__grid">
              {ofType.map(({ saga, s }) => {
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
          </section>
        );
      })}
    </main>
  );
}
