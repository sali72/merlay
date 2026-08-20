import { Edge, Node, Position } from '@xyflow/react';

export function getAdaptiveEdgeParams(sourceNode: any, targetNode: any) {
  if (!sourceNode || !targetNode) return null;

  const sX = sourceNode.internals?.positionAbsolute?.x ?? sourceNode.position?.x ?? 0;
  const sY = sourceNode.internals?.positionAbsolute?.y ?? sourceNode.position?.y ?? 0;
  const sW = sourceNode.measured?.width ?? sourceNode.width ?? 130;
  const sH = sourceNode.measured?.height ?? sourceNode.height ?? 48;

  const tX = targetNode.internals?.positionAbsolute?.x ?? targetNode.position?.x ?? 0;
  const tY = targetNode.internals?.positionAbsolute?.y ?? targetNode.position?.y ?? 0;
  const tW = targetNode.measured?.width ?? targetNode.width ?? 130;
  const tH = targetNode.measured?.height ?? targetNode.height ?? 48;

  const scX = sX + sW / 2;
  const scY = sY + sH / 2;
  const tcX = tX + tW / 2;
  const tcY = tY + tH / 2;

  const dx = tcX - scX;
  const dy = tcY - scY;

  if (Math.hypot(dx, dy) < 1) return null;

  // 1. Calculate continuous intersection on source node perimeter
  const sHw = sW / 2;
  const sHh = sH / 2;
  const sTx = dx !== 0 ? Math.abs(sHw / dx) : Infinity;
  const sTy = dy !== 0 ? Math.abs(sHh / dy) : Infinity;
  const sT = Math.min(sTx, sTy);

  let sourcePosition = Position.Right;
  let sourceX = scX;
  let sourceY = scY;

  if (sTx < sTy) {
    if (dx > 0) {
      sourcePosition = Position.Right;
      sourceX = sX + sW;
      sourceY = scY + sT * dy;
    } else {
      sourcePosition = Position.Left;
      sourceX = sX;
      sourceY = scY + sT * dy;
    }
    sourceY = Math.max(sY + 4, Math.min(sY + sH - 4, sourceY));
  } else {
    if (dy > 0) {
      sourcePosition = Position.Bottom;
      sourceX = scX + sT * dx;
      sourceY = sY + sH;
    } else {
      sourcePosition = Position.Top;
      sourceX = scX + sT * dx;
      sourceY = sY;
    }
    sourceX = Math.max(sX + 4, Math.min(sX + sW - 4, sourceX));
  }

  // 2. Calculate continuous intersection on target node perimeter
  const tdx = scX - tcX;
  const tdy = scY - tcY;
  const tHw = tW / 2;
  const tHh = tH / 2;
  const tTx = tdx !== 0 ? Math.abs(tHw / tdx) : Infinity;
  const tTy = tdy !== 0 ? Math.abs(tHh / tdy) : Infinity;
  const tT = Math.min(tTx, tTy);

  let targetPosition = Position.Left;
  let targetX = tcX;
  let targetY = tcY;

  if (tTx < tTy) {
    if (tdx > 0) {
      targetPosition = Position.Right;
      targetX = tX + tW;
      targetY = tcY + tT * tdy;
    } else {
      targetPosition = Position.Left;
      targetX = tX;
      targetY = tcY + tT * tdy;
    }
    targetY = Math.max(tY + 4, Math.min(tY + tH - 4, targetY));
  } else {
    if (tdy > 0) {
      targetPosition = Position.Bottom;
      targetX = tcX + tT * tdx;
      targetY = tY + tH;
    } else {
      targetPosition = Position.Top;
      targetX = tcX + tT * tdx;
      targetY = tY;
    }
    targetX = Math.max(tX + 4, Math.min(tX + tW - 4, targetX));
  }

  return {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };
}

export function findSpliceCandidateEdge(
  draggedNode: Node,
  allNodes: Node[],
  allEdges: Edge[],
  tolerance = 30
): Edge | null {
  const nodeX = draggedNode.position.x + (draggedNode.measured?.width || 120) / 2;
  const nodeY = draggedNode.position.y + (draggedNode.measured?.height || 48) / 2;

  const nodeMap = new Map<string, Node>();
  for (const n of allNodes) {
    nodeMap.set(n.id, n);
  }

  for (const edge of allEdges) {
    if (edge.source === draggedNode.id || edge.target === draggedNode.id) {
      continue;
    }

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) continue;

    const sX = sourceNode.position.x + (sourceNode.measured?.width || 120) / 2;
    const sY = sourceNode.position.y + (sourceNode.measured?.height || 48) / 2;
    const tX = targetNode.position.x + (targetNode.measured?.width || 120) / 2;
    const tY = targetNode.position.y + (targetNode.measured?.height || 48) / 2;

    const dist = pointToSegmentDistance(nodeX, nodeY, sX, sY, tX, tY);

    if (dist <= tolerance) {
      return edge;
    }
  }

  return null;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);

  return Math.hypot(px - projX, py - projY);
}

