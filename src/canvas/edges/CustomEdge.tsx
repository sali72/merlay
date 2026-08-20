import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  useInternalNode,
} from '@xyflow/react';
import { ArrowType } from '../../ast/types';
import { FloatingEdgeToolbar } from '../toolbar/FloatingEdgeToolbar';
import { getAdaptiveEdgeParams } from '../../layout/geometry';

export interface CustomEdgeData {
  arrowType: ArrowType;
  label?: string;
  onArrowTypeChange?: (edgeId: string, newType: ArrowType) => void;
  onLabelChange?: (edgeId: string, label: string) => void;
  onReverse?: (edgeId: string) => void;
  onDelete?: (edgeId: string) => void;
}

export const CustomEdge: React.FC<EdgeProps> = ({
  id,
  source,
  target,
  sourceX: defaultSourceX,
  sourceY: defaultSourceY,
  targetX: defaultTargetX,
  targetY: defaultTargetY,
  sourcePosition: defaultSourcePosition,
  targetPosition: defaultTargetPosition,
  style = {},
  data,
  selected,
  markerEnd,
  markerStart,
}) => {
  const edgeData = data as unknown as CustomEdgeData;

  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const adaptiveParams = getAdaptiveEdgeParams(sourceNode, targetNode);

  const sourceX = adaptiveParams ? adaptiveParams.sourceX : defaultSourceX;
  const sourceY = adaptiveParams ? adaptiveParams.sourceY : defaultSourceY;
  const targetX = adaptiveParams ? adaptiveParams.targetX : defaultTargetX;
  const targetY = adaptiveParams ? adaptiveParams.targetY : defaultTargetY;
  const sourcePosition = adaptiveParams ? adaptiveParams.sourcePosition : defaultSourcePosition;
  const targetPosition = adaptiveParams ? adaptiveParams.targetPosition : defaultTargetPosition;

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

  const strokeWidth = isThick ? 3 : 1.75;
  const strokeDasharray = isDotted ? '5,5' : undefined;
  const strokeColor = selected
    ? 'var(--mermaid-accent, #7c3aed)'
    : 'var(--mermaid-text-muted, #888888)';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          ...style,
          strokeWidth,
          strokeDasharray,
          stroke: strokeColor,
        }}
      />

      <EdgeLabelRenderer>
        {/* Floating Context Toolbar directly at selected edge midpoint */}
        {selected ? (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 12}px)`,
              zIndex: 1000,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <FloatingEdgeToolbar
              currentArrowType={arrowType}
              currentLabel={edgeData?.label || ''}
              onArrowTypeChange={(newType) => edgeData?.onArrowTypeChange?.(id, newType)}
              onLabelChange={(newLabel) => edgeData?.onLabelChange?.(id, newLabel)}
              onReverse={() => edgeData?.onReverse?.(id)}
              onDelete={() => edgeData?.onDelete?.(id)}
            />
          </div>
        ) : (
          edgeData?.label && (
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan mermaid-edge-label"
            >
              {edgeData.label}
            </div>
          )
        )}
      </EdgeLabelRenderer>
    </>
  );
};

