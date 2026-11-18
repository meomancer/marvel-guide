import { useEffect, useState } from 'react';
import { issueTags, loadIssueDetail } from '../data/index.ts';
import { resolveAssetUrl } from '../lib/assets.ts';
import { ComicVineLink } from './ComicVineLink.tsx';
import { TagImage } from './TagImage.tsx';
import { formatDate } from '../lib/format.ts';
import { useReadIssues } from '../lib/readIssuesContext.ts';
import {
  ENTITY_LABELS,
  ROLE_LABELS,
  type OptionalRole,
  type Entity,
  type EntityId,
  type EntityKind,
  type GuideFilter,
  type Issue,
  type IssueDetail,
  type IssueId,
} from '../types/comic.ts';

interface IssuePanelProps {
  issue: Issue;
  issues: Map<IssueId, Issue>;
  previous: Issue[];
  entities: Record<EntityKind, Map<EntityId, Entity>>;
  /** Reading progress per story arc in this guide. */
  arcProgress: Map<EntityId, { done: number; total: number }>;
  /** Current filter, to mark tags that are active. */
  filter: GuideFilter;
  onSelectIssue: (id: IssueId) => void;
  onFilterTag: (kind: EntityKind, id: EntityId) => void;
  onClose: () => void;
}

/** What each kind of optional reading means, for the label's tooltip. */
const ROLE_HINTS: Record<OptionalRole, string> = {
  impact: 'Optional, but its effects reach the main timeline: worth reading.',
  'tie-in': 'Part of an event, told from another angle.',
  prelude: 'Sets up a main story.',
  side: 'A side series or the rest of a run: skip freely.',
};

/** Tag kinds listed in the panel after the credits. */
const TAG_SECTIONS: EntityKind[] = ['characters', 'teams', 'locations', 'objects'];

export function IssuePanel({
  issue,
  issues,
  previous,
  entities,
  arcProgress,
  filter,
  onSelectIssue,
  onFilterTag,
  onClose,
}: IssuePanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Long-form detail (synopsis, credits) is loaded on demand per issue.
  const [detail, setDetail] = useState<{ id: IssueId; data?: IssueDetail }>();
  useEffect(() => {
    let cancelled = false;
    loadIssueDetail(issue.id)
      .catch(() => undefined)
      .then((data) => {
        if (!cancelled) setDetail({ id: issue.id, data });
      });
    return () => {
      cancelled = true;
    };
  }, [issue.id]);
  const loading = detail?.id !== issue.id;
  const info = loading ? undefined : detail?.data;

  const { isRead, toggleRead } = useReadIssues();
  const read = isRead(issue.id);

  const next = issue.next
    .map((id) => issues.get(id))
    .filter((i): i is Issue => i !== undefined);

  const nameOf = (kind: EntityKind, id: EntityId) => entities[kind].get(id)?.name ?? id;
  const sortedTags = (kind: EntityKind) =>
    [...issueTags(issue, kind)].sort((a, b) => nameOf(kind, a).localeCompare(nameOf(kind, b)));

  return (
    <aside className="issue-panel" aria-label={issue.title}>
      {/* Zero-height sticky bar: the X stays at the top right while scrolling */}
      <div className="issue-panel__bar">
        <button
          type="button"
          className="issue-panel__close"
          onClick={onClose}
          aria-label="Close details"
          title="Close"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      </div>

      {issue.coverUrl && (
        <img
          className="issue-panel__cover"
          src={resolveAssetUrl(issue.coverUrl)}
          alt={`Cover of ${issue.title}`}
        />
      )}

      <p className="issue-panel__series">{issue.series}</p>
      <h2 className="issue-panel__title">
        {issue.title}
        <ComicVineLink url={info?.comicVineUrl} name={issue.title} />
      </h2>
      {info?.name && <p className="issue-panel__story">{info.name}</p>}
      {issue.keypoint && <p className="issue-panel__keypoint">{issue.keypoint}</p>}
      <p className="issue-panel__date">
        {formatDate(issue.year, issue.month)}
        {issue.history ? (
          <span
            className="issue-panel__optional issue-panel__optional--history"
            title="Character history: background only, not part of the guide's story arcs."
          >
            History
          </span>
        ) : (
          issue.optional && (
            <span className="issue-panel__optional" title={ROLE_HINTS[issue.role ?? 'side']}>
              {issue.role ? `Optional · ${ROLE_LABELS[issue.role]}` : 'Optional'}
            </span>
          )
        )}
      </p>

      <button
        type="button"
        className="issue-panel__read"
        aria-pressed={read}
        onClick={() => toggleRead(issue.id)}
      >
        {read ? 'Read' : 'Mark as read'}
      </button>

      {issue.synopsis && <p className="issue-panel__synopsis">{issue.synopsis}</p>}

      {issueTags(issue, 'arcs').length > 0 && (
        <section className="issue-panel__section">
          <h3>{issueTags(issue, 'arcs').length === 1 ? 'Story arc' : 'Story arcs'}</h3>
          <ul className="story-arcs">
            {issueTags(issue, 'arcs').map((id) => {
              const arc = entities.arcs.get(id);
              const on = filter.tags.arcs.includes(id);
              return (
                <li key={id}>
                  {arc?.coverUrl ? (
                    <img className="story-arcs__img" src={arc.coverUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="story-arcs__img" aria-hidden="true" />
                  )}
                  <div>
                    <strong>
                      <button
                        type="button"
                        className={`story-arcs__name${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        onClick={() => onFilterTag('arcs', id)}
                        title={on ? 'Remove this filter' : 'Show only this story arc'}
                      >
                        {nameOf('arcs', id)}
                      </button>
                      <ComicVineLink url={arc?.comicVineUrl} name={nameOf('arcs', id)} />
                    </strong>
                    {arc?.deck && <p>{arc.deck}</p>}
                    {arcProgress.has(id) && (
                      <p className="story-arcs__progress">
                        {arcProgress.get(id)!.done} of {arcProgress.get(id)!.total} issues read
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {info && (info.deck || info.synopsis.length > 0) && (
        <section className="issue-panel__section">
          <h3>Synopsis</h3>
          {info.deck && <p className="issue-panel__deck">{info.deck}</p>}
          <div className="issue-panel__cv">
            {info.synopsis.map((block, i) =>
              block.kind === 'heading' ? (
                <h4 key={i}>{block.text}</h4>
              ) : (
                <p key={i}>{block.text}</p>
              ),
            )}
          </div>
          {info.comicVineUrl && (
            <p className="issue-panel__source">
              From{' '}
              <a href={info.comicVineUrl} target="_blank" rel="noreferrer">
                Comic Vine
              </a>
            </p>
          )}
        </section>
      )}

      {info && info.credits.length > 0 && (
        <section className="issue-panel__section">
          <h3>{ENTITY_LABELS.creators}</h3>
          <ul className="credits">
            {info.credits.map((credit) => (
              <li key={credit.creator}>
                <span className="credits__name">
                <button
                  type="button"
                  className={filter.tags.creators.includes(credit.creator) ? 'is-on' : undefined}
                  aria-pressed={filter.tags.creators.includes(credit.creator)}
                  onClick={() => onFilterTag('creators', credit.creator)}
                  title={
                    filter.tags.creators.includes(credit.creator)
                      ? 'Remove this filter'
                      : 'Show only issues by this creator'
                  }
                >
                  {nameOf('creators', credit.creator)}
                </button>
                <ComicVineLink
                  url={entities.creators.get(credit.creator)?.comicVineUrl}
                  name={nameOf('creators', credit.creator)}
                />
                </span>
                <span className="credits__roles">{credit.roles.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {TAG_SECTIONS.map((kind) => {
        const tags = sortedTags(kind);
        if (tags.length === 0) return null;
        return (
          <PanelSection key={kind} title={ENTITY_LABELS[kind]}>
            {tags.map((id) => {
              const on = filter.tags[kind].includes(id);
              const entity = entities[kind].get(id);
              return (
                // The wrapper draws the chip border, so the filter button and
                // the link icon (which can't be nested) sit inside one chip.
                <span key={id} className={`tag-chip${on ? ' is-on' : ''}`}>
                  <button
                    type="button"
                    className="tag-chip__main"
                    aria-pressed={on}
                    onClick={() => onFilterTag(kind, id)}
                    title={
                      on
                        ? 'Remove this filter'
                        : [entity?.deck, `Click to show only issues with ${nameOf(kind, id)}`]
                            .filter(Boolean)
                            .join('\n\n')
                    }
                  >
                    <TagImage url={entity?.coverUrl} />
                    {nameOf(kind, id)}
                  </button>
                  <ComicVineLink url={entity?.comicVineUrl} name={nameOf(kind, id)} />
                </span>
              );
            })}
          </PanelSection>
        );
      })}

      <PanelSection title="Read before">
        <IssueLinks items={previous} onSelect={onSelectIssue} empty="Start here." />
      </PanelSection>

      <PanelSection title="Read next">
        <IssueLinks items={next} onSelect={onSelectIssue} empty="End of this reading path." />
      </PanelSection>
    </aside>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="issue-panel__section">
      <h3>{title}</h3>
      <div className="issue-panel__items">{children}</div>
    </section>
  );
}

function IssueLinks({
  items,
  onSelect,
  empty,
}: {
  items: Issue[];
  onSelect: (id: IssueId) => void;
  empty: string;
}) {
  if (items.length === 0) return <p className="issue-panel__empty">{empty}</p>;
  return (
    <ul className="issue-links">
      {items.map((i) => (
        <li key={i.id}>
          <button type="button" onClick={() => onSelect(i.id)}>
            <span>{i.title}</span>
            <span className="issue-links__date">{formatDate(i.year, i.month)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
