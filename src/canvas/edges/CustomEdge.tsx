import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
  useInternalNode,
} from '@xyflow/react';
import { line, curveBasis } from 'd3-shape';
import { ArrowType } from '../../ast/types';
import { FloatingEdgeToolbar } from '../toolbar/FloatingEdgeToolbar';
import { getAdaptiveEdgeParams } from '../../layout/geometry';

const d3CurveGenerator = line<{ x: number; y: number }>()
  .x((d) => d.x)
  .y((d) => d.y)
  .curve(curveBasis);

function calculateMermaidCurve(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position
): [string, number, number] {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.hypot(dx, dy);
  const factor = Math.min(0.45, Math.max(0.2, 40 / Math.max(1, dist)));

  const p0 = { x: sourceX, y: sourceY };
  let p1: { x: number; y: number };
  let p2: { x: number; y: number };
  const p3 = { x: targetX, y: targetY };

  switch (sourcePosition) {
    case Position.Left:
      p1 = { x: sourceX - Math.abs(dx) * factor - 10, y: sourceY };
      break;
    case Position.Right:
      p1 = { x: sourceX + Math.abs(dx) * factor + 10, y: sourceY };
      break;
    case Position.Top:
      p1 = { x: sourceX, y: sourceY - Math.abs(dy) * factor - 10 };
      break;
    case Position.Bottom:
    default:
      p1 = { x: sourceX, y: sourceY + Math.abs(dy) * factor + 10 };
      break;
  }

  switch (targetPosition) {
    case Position.Left:
      p2 = { x: targetX - Math.abs(dx) * factor - 10, y: targetY };
      break;
    case Position.Right:
      p2 = { x: targetX + Math.abs(dx) * factor + 10, y: targetY };
      break;
    case Position.Top:
      p2 = { x: targetX, y: targetY - Math.abs(dy) * factor - 10 };
      break;
    case Position.Bottom:
    default:
      p2 = { x: targetX, y: targetY + Math.abs(dy) * factor + 10 };
      break;
  }

  const path = d3CurveGenerator([p0, p1, p2, p3]) || '';
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;
  return [path, labelX, labelY];
}

export interface CustomEdgeData {
  arrowType: ArrowType;
  label?: string;
  svgPath?: string;
  labelPosition?: { x: number; y: number };
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

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (edgeData?.svgPath) {
    // 1. Exact Native Mermaid B-spline Path from layout engine
    edgePath = edgeData.svgPath;
    if (edgeData.labelPosition) {
      labelX = edgeData.labelPosition.x;
      labelY = edgeData.labelPosition.y;
    } else {
      labelX = (sourceX + targetX) / 2;
      labelY = (sourceY + targetY) / 2;
    }
  } else {
    // 2. Smooth D3 B-Spline Basis Curve matching Mermaid style
    const [curvePath, cx, cy] = calculateMermaidCurve(
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition
    );
    edgePath = curvePath;
    labelX = cx;
    labelY = cy;
  }

  const arrowType = edgeData?.arrowType || 'arrow';
  const isDotted = arrowType === 'dotted' || arrowType === 'dotted_open';
  const isThick = arrowType === 'thick' || arrowType === 'thick_open';
  const isOpen = arrowType === 'open' || arrowType === 'dotted_open' || arrowType === 'thick_open';
  const isBidirectional = arrowType === 'bidirectional';
  const isCross = arrowType === 'cross';
  const isCircle = arrowType === 'circle';

  const strokeWidth = isThick ? 2.5 : 1.5;
  const strokeDasharray = isDotted ? '4,4' : undefined;
  const strokeColor = selected
    ? 'var(--mermaid-accent, #7c3aed)'
    : 'var(--mermaid-text-muted, #888888)';

  // Exact native Mermaid SVG marker URLs
  let markerEndUrl: string | undefined = undefined;
  let markerStartUrl: string | undefined = undefined;

  if (!isOpen) {
    if (isCross) {
      markerEndUrl = 'url(#mermaid-marker-cross)';
    } else if (isCircle) {
      markerEndUrl = 'url(#mermaid-marker-circle)';
    } else if (isThick) {
      markerEndUrl = selected
        ? 'url(#mermaid-marker-thick-selected)'
        : 'url(#mermaid-marker-thick)';
    } else {
      markerEndUrl = selected
        ? 'url(#mermaid-marker-arrow-selected)'
        : 'url(#mermaid-marker-arrow)';
    }
  }

  if (isBidirectional) {
    markerStartUrl = selected
      ? 'url(#mermaid-marker-arrow-start-selected)'
      : 'url(#mermaid-marker-arrow-start)';
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEndUrl}
        markerStart={markerStartUrl}
        style={{
          ...style,
          strokeWidth,
          strokeDasharray,
          stroke: strokeColor,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
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

