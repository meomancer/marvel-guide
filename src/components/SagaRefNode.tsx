import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { resolveAssetUrl } from '../lib/assets.ts';
import { formatDate } from '../lib/format.ts';
import type { Issue } from '../types/comic.ts';

/**
 * Frame around the issue node. Must match .saga-ref in App.css:
 * 2px border, 16px padding, a 28px saga-name bar plus 12px gap on top.
 * - top: space from the frame's top edge to the issue node (its arc and
 *   keypoint bars not included: App adds those like for any issue),
 * - side: how far the frame sticks out left and right of the issue box.
 */
export const SAGA_REF_FRAME = { top: 2 + 28 + 12, side: 2 + 16 };

/** How the issue appears in its home guide; the inner node is styled the same. */
export type HomeKind = 'main' | 'optional' | 'history';

export type SagaRefNodeType = Node<
  {
    issue: Issue;
    /** Name of the guide this issue belongs to, e.g. "Avengers". */
    sagaName: string;
    /** Story arc bar above the box (as in the home guide), if any. */
    arcName?: string;
    homeKind: HomeKind;
    /** Lane colour of the issue in its home guide (box stripe). */
    homeColor: string;
    /** Link to that guide, zoomed to this issue (opens in a new tab). */
    href: string;
  },
  'sagaRef'
>;

/**
 * Purple "saga box": a padded, striped frame naming another guide, wrapped
 * around the issue exactly as it looks in that guide (arc bar, keypoint bar,
 * issue box). Clicking opens the guide in a new tab (handled in App).
 */
export function SagaRefNode({ data, selected }: NodeProps<SagaRefNodeType>) {
  const { issue, sagaName, arcName, homeKind, homeColor } = data;
  const title = issue.series ? `${issue.series} #${issue.issueNumber}` : issue.title;
  const kindClass =
    homeKind === 'history' ? ' is-optional is-history' : homeKind === 'optional' ? ' is-optional' : '';

  return (
    <div
      className={`saga-ref${selected ? ' is-selected' : ''}`}
      title={`${title}: open in the ${sagaName} guide (new tab)`}
    >
      <Handle id="t-top" type="target" position={Position.Top} className="node-handle" />

      <p className="saga-ref__saga">
        {sagaName}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v3.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5H7" />
        </svg>
      </p>

      {/* The issue node as in its home guide: arc bar, keypoint bar, box */}
      <div
        className={`issue-node-wrap${kindClass}`}
        style={{ '--lane': homeColor } as React.CSSProperties}
      >
        {arcName && <p className="issue-node__arc">{arcName}</p>}
        {issue.keypoint && <p className="issue-node__keypoint">{issue.keypoint}</p>}
        <div className={`issue-node${kindClass}`}>
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
            <h3 className="issue-node__title">{title}</h3>
            <p className="issue-node__date">{formatDate(issue.year, issue.month)}</p>
          </div>
          {/* Lines leave from the issue box's bottom, like other boxes */}
          <Handle id="s-bottom" type="source" position={Position.Bottom} className="node-handle" />
        </div>
      </div>
    </div>
  );
}
