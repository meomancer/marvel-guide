import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IssueId } from '../types/comic.ts';
import { ReadIssuesContext, type ReadIssues } from './readIssuesContext.ts';

/**
 * Tracks which issues the reader has marked as read.
 * Stored in this browser's localStorage only: it does not sync between
 * devices, and it is lost if site data is cleared.
 */

const STORAGE_KEY = 'marvel-guide:read-issues';

function load(): Set<IssueId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

function save(read: Set<IssueId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...read]));
  } catch {
    // Storage unavailable (private mode, blocked site data): keep in memory only.
  }
}

export function ReadIssuesProvider({ children }: { children: React.ReactNode }) {
  const [read, setRead] = useState<Set<IssueId>>(load);

  // Keep other open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setRead(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleRead = useCallback((id: IssueId) => {
    setRead((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(next);
      return next;
    });
  }, []);

  const value = useMemo<ReadIssues>(
    () => ({ read, isRead: (id) => read.has(id), toggleRead }),
    [read, toggleRead],
  );

  return <ReadIssuesContext value={value}>{children}</ReadIssuesContext>;
}
