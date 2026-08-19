import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import { ArrowType } from '../../ast/types';

export interface CustomEdgeData {
  arrowType: ArrowType;
  label?: string;
  onLabelChange?: (edgeId: string, label: string) => void;
}

export const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}) => {
  const edgeData = data as unknown as CustomEdgeData;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const arrowType = edgeData?.arrowType || 'arrow';
  const isDotted = arrowType === 'dotted' || arrowType === 'dotted_open';
  const isThick = arrowType === 'thick' || arrowType === 'thick_open';

  const strokeWidth = isThick ? 3 : 1.5;
  const strokeDasharray = isDotted ? '4,4' : undefined;
  const strokeColor = selected
    ? 'var(--interactive-accent, #7c3aed)'
    : 'var(--text-muted, #999)';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          strokeWidth,
          strokeDasharray,
          stroke: strokeColor,
        }}
      />
      {edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'var(--background-secondary, #252525)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--text-normal, #ddd)',
              border: '1px solid var(--background-modifier-border, #444)',
              pointerEvents: 'all',
            }}
            className="nodrag nopan mermaid-edge-label"
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
