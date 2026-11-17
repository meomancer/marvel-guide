import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { resolveAssetUrl } from '../lib/assets.ts';
import { formatDate } from '../lib/format.ts';
import { useReadIssues } from '../lib/readIssuesContext.ts';
import type { Issue } from '../types/comic.ts';

/**
 * Height of the keypoint bar stacked on top of a box (must match
 * .issue-node__keypoint in App.css). Nodes with a keypoint are placed this
 * much higher so their boxes stay aligned with the rest of the row.
 */
export const KEYPOINT_HEIGHT = 22;
/** Height of the story arc title bar (must match .issue-node__arc in App.css). */
export const ARC_TITLE_HEIGHT = 22;

export type IssueNodeType = Node<
  {
    issue: Issue;
    color: string;
    optional: boolean;
    /** Story arc name, shown on every issue of the arc. */
    arcTitle?: string;
  },
  'issue'
>;

export function IssueNode({ data, selected }: NodeProps<IssueNodeType>) {
  const { issue, color, optional, arcTitle } = data;
  const { isRead, toggleRead } = useReadIssues();
  const read = isRead(issue.id);

  return (
    <div
      className={`issue-node-wrap${optional ? ' is-optional' : ''}${read ? ' is-read' : ''}`}
      style={{ '--lane': color } as React.CSSProperties}
    >
      {/* Incoming lines from above end on the top of the node: the keypoint
          bar if there is one, otherwise the box. */}
      <Handle id="t-top" type="target" position={Position.Top} className="node-handle" />

      {arcTitle && (
        <p className="issue-node__arc" title={`Story arc: ${arcTitle}`}>
          {arcTitle}
        </p>
      )}

      {issue.keypoint && (
        <p className="issue-node__keypoint" title={issue.keypoint}>
          {issue.keypoint}
        </p>
      )}

      <div
        className={`issue-node${optional ? ' is-optional' : ''}${selected ? ' is-selected' : ''}`}
      >
        {/* Side handles sit on the box, for lines to a box in the same row
            (see sourceHandle/targetHandle in App.tsx). */}
        <Handle id="t-left" type="target" position={Position.Left} className="node-handle" />
        <Handle id="t-right" type="target" position={Position.Right} className="node-handle" />
        <Handle id="s-left" type="source" position={Position.Left} className="node-handle" />
        <Handle id="s-right" type="source" position={Position.Right} className="node-handle" />

        <div className="issue-node__cover">
          {issue.coverUrl ? (
            <img src={resolveAssetUrl(issue.coverUrl)} alt="" loading="lazy" />
          ) : (
            <span className="issue-node__number" aria-hidden="true">
              #{issue.issueNumber}
            </span>
          )}
        </div>
        <div className="issue-node__body">
          {/* One line: series with its start year, then the issue number,
              e.g. "Avengers (1963) #171". */}
          <h3 className="issue-node__title">
            {issue.series ? `${issue.series} #${issue.issueNumber}` : issue.title}
          </h3>
          <p className="issue-node__date">{formatDate(issue.year, issue.month)}</p>
        </div>
        <button
          type="button"
          className="read-toggle nodrag nopan"
          aria-pressed={read}
          aria-label={read ? `Mark ${issue.title} as unread` : `Mark ${issue.title} as read`}
          title={read ? 'Mark as unread' : 'Mark as read'}
          onClick={(e) => {
            // Don't also open the detail panel.
            e.stopPropagation();
            toggleRead(issue.id);
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8.5l3.2 3L13 4.5" />
          </svg>
        </button>
      </div>

      <Handle id="s-bottom" type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
}
