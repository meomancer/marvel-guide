import { useId, useRef, useState } from 'react';

export type ChipKind = 'arc' | 'keypoint' | 'optional' | 'read' | 'plain';

/** One option in the navbar search: a box on the current map. */
export interface SearchRow {
  id: string;
  title: string;
  /** Right-aligned, e.g. "Jan 1978" or "1963–1987". */
  date: string;
  /** Small labels under the title. */
  chips: { text: string; kind: ChipKind }[];
  /** Optional issue: pink left stripe. */
  optional?: boolean;
  /** Cover shown at the far left. */
  imageUrl?: string;
  /** Lower-case text that search matches against. */
  haystack: string;
}

interface MapSearchProps {
  /** Rows in display order (sorted by date by the caller). */
  rows: SearchRow[];
  /** e.g. "issue" or "guide", used in the placeholder and empty state. */
  noun: string;
  onPick: (id: string) => void;
}

/**
 * Navbar combobox over the boxes on the current map. Picking one zooms the
 * map to it. Keyboard: arrows, Enter, Esc.
 */
export function MapSearch({ rows, noun, onPick }: MapSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = words.length
    ? rows.filter((r) => words.every((w) => r.haystack.includes(w)))
    : rows;

  const article = /^[aeiou]/i.test(noun) ? 'an' : 'a';

  const pick = (id: string) => {
    onPick(id);
    setOpen(false);
    setQuery('');
  };

  const move = (to: number) => {
    const next = Math.max(0, Math.min(results.length - 1, to));
    setActive(next);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  const activeRow = open ? results[active] : undefined;

  return (
    <div className="issue-search">
      <input
        type="search"
        className="issue-search__input"
        placeholder={`Find ${article} ${noun} (${rows.length} ${rows.length === 1 ? noun : `${noun}s`})`}
        value={query}
        role="combobox"
        aria-label={`Find ${article} ${noun}`}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeRow ? `${listId}-${activeRow.id}` : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Delay so a click on an option lands before the list closes.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            move(active + 1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            move(active - 1);
          } else if (e.key === 'Enter' && activeRow) {
            e.preventDefault();
            pick(activeRow.id);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />

      {open && (
        <ul className="issue-search__list" id={listId} role="listbox" ref={listRef}>
          {results.length === 0 ? (
            <li className="issue-search__empty">
              No {noun} matches “{query}”.
            </li>
          ) : (
            results.map((row, index) => (
              <li
                key={row.id}
                id={`${listId}-${row.id}`}
                data-index={index}
                role="option"
                aria-selected={index === active}
                className={`issue-search__option${index === active ? ' is-active' : ''}${
                  row.optional ? ' is-optional' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(row.id)}
              >
                {row.imageUrl ? (
                  <img className="issue-search__cover" src={row.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className="issue-search__cover" aria-hidden="true" />
                )}
                <span className="issue-search__body">
                <span className="issue-search__line">
                  <span className="issue-search__title">{row.title}</span>
                  <span className="issue-search__date">{row.date}</span>
                </span>
                {row.chips.length > 0 && (
                  <span className="issue-search__meta">
                    {row.chips.map((chip, i) => (
                      <span key={i} className={`issue-search__chip issue-search__chip--${chip.kind}`}>
                        {chip.text}
                      </span>
                    ))}
                  </span>
                )}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
