import { Edge, Node } from '@xyflow/react';

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
