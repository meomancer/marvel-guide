import { createContext, useContext } from 'react';
import type { IssueId } from '../types/comic.ts';

export interface ReadIssues {
  read: Set<IssueId>;
  isRead: (id: IssueId) => boolean;
  toggleRead: (id: IssueId) => void;
}

export const ReadIssuesContext = createContext<ReadIssues | null>(null);

/** Read/unread state for issues. Provided by <ReadIssuesProvider>. */
export function useReadIssues(): ReadIssues {
  const ctx = useContext(ReadIssuesContext);
  if (!ctx) throw new Error('useReadIssues must be used inside <ReadIssuesProvider>');
  return ctx;
}
