/**
 * Dagre Layout Engine for Mermaid Flowcharts
 * Matches 1:1 with official Mermaid.js and Obsidian native diagram renderer.
 */

import dagre from '@dagrejs/dagre';
import {
  FlowchartDirection,
  MermaidFlowchartAST,
  PositionedGraph,
  PositionedNode,
  PositionedSubgraph,
} from '../ast/types';

function getNodeDimensions(label: string, shape: string = 'rectangle') {
  const textLen = label.length;

  if (shape === 'circle') {
    const diameter = Math.max(76, Math.min(160, Math.max(textLen * 9 + 28, 76)));
    return { width: diameter, height: diameter };
  } else if (shape === 'diamond') {
    const w = Math.max(140, textLen * 10.5 + 44);
    const h = Math.max(72, Math.round(w * 0.58));
    return { width: w, height: h };
  } else if (shape === 'hexagon') {
    const w = Math.max(130, textLen * 9.5 + 50);
    return { width: w, height: 48 };
  } else if (shape === 'cylinder') {
    const w = Math.max(120, textLen * 8.5 + 36);
    return { width: w, height: 56 };
  } else {
    const w = Math.max(110, textLen * 8.5 + 32);
    return { width: w, height: 48 };
  }
}

function mapDirectionToDagre(dir: FlowchartDirection): string {
  switch (dir) {
    case 'TD':
    case 'TB':
      return 'TB';
    case 'BT':
      return 'BT';
    case 'RL':
      return 'RL';
    case 'LR':
    default:
      return 'LR';
  }
}

export function calculateDagreLayout(
  ast: MermaidFlowchartAST
): PositionedGraph {
  const rankdir = mapDirectionToDagre(ast.direction);

  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({
    rankdir,
    nodesep: 50,
    ranksep: 50,
    marginx: 24,
    marginy: 24,
    acyclicer: 'greedy',
  });
  g.setDefaultEdgeLabel(() => ({}));

  // 1. Add Subgraph Cluster Compound Nodes
  for (const [subId, subDef] of ast.subgraphs.entries()) {
    g.setNode(subId, {
      label: subDef.label || subId,
      clusterNode: true,
    });
  }

  // 2. Add Shape Nodes
  for (const [nodeId, nodeDef] of ast.nodes.entries()) {
    const label = nodeDef.label || nodeId;
    const { width, height } = getNodeDimensions(label, nodeDef.shape);

    g.setNode(nodeId, {
      width,
      height,
      label,
    });

    if (nodeDef.subgraphId && ast.subgraphs.has(nodeDef.subgraphId)) {
      g.setParent(nodeId, nodeDef.subgraphId);
    }
  }

  // 3. Add Edges
  for (const edge of ast.edges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to);
    }
  }

  // Execute Dagre layout
  dagre.layout(g);

  // 4. Extract positioned nodes
  const positionedNodes: PositionedNode[] = [];
  for (const [nodeId, nodeDef] of ast.nodes.entries()) {
    const dNode = g.node(nodeId);
    if (!dNode) continue;

    positionedNodes.push({
      id: nodeId,
      label: nodeDef.label || nodeId,
      shape: nodeDef.shape || 'rectangle',
      x: dNode.x - dNode.width / 2,
      y: dNode.y - dNode.height / 2,
      width: dNode.width,
      height: dNode.height,
      subgraphId: nodeDef.subgraphId,
      style: nodeDef.style,
    });
  }

  // 5. Extract positioned subgraphs
  const positionedSubgraphs: PositionedSubgraph[] = [];
  for (const [subId, subDef] of ast.subgraphs.entries()) {
    const dSub = g.node(subId);
    if (!dSub || dSub.width === undefined || dSub.height === undefined) continue;

    positionedSubgraphs.push({
      id: subId,
      label: subDef.label || subId,
      x: dSub.x - dSub.width / 2,
      y: dSub.y - dSub.height / 2,
      width: dSub.width,
      height: dSub.height,
      nodeIds: subDef.nodeIds,
    });
  }

  return {
    direction: ast.direction,
    nodes: positionedNodes,
    edges: ast.edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      arrowType: e.arrowType,
      label: e.label,
    })),
    subgraphs: positionedSubgraphs,
  };
}
