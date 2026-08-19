/**
 * Elk.js Layout Engine Adapter for Mermaid Flowchart AST
 */

import ELK, { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import {
  FlowchartDirection,
  MermaidFlowchartAST,
  PositionedGraph,
  PositionedNode,
  PositionedSubgraph,
} from '../ast/types';

const elk = new ELK();

export async function calculateElkLayout(
  ast: MermaidFlowchartAST
): Promise<PositionedGraph> {
  const elkDirection = mapDirectionToElk(ast.direction);

  // Group nodes by subgraph
  const subgraphChildrenMap = new Map<string, ElkNode[]>();
  for (const subId of ast.subgraphs.keys()) {
    subgraphChildrenMap.set(subId, []);
  }

  const rootChildren: ElkNode[] = [];

  // Build node elements
  for (const [nodeId, nodeDef] of ast.nodes.entries()) {
    const label = nodeDef.label || nodeId;
    const estWidth = Math.max(120, label.length * 10 + 30);
    const estHeight = 48;

    const elkChild: ElkNode = {
      id: nodeId,
      width: estWidth,
      height: estHeight,
      layoutOptions: {
        'elk.nodeLabels.placement': 'INSIDE H_CENTER V_CENTER',
      },
    };

    if (nodeDef.subgraphId && subgraphChildrenMap.has(nodeDef.subgraphId)) {
      subgraphChildrenMap.get(nodeDef.subgraphId)!.push(elkChild);
    } else {
      rootChildren.push(elkChild);
    }
  }

  // Build subgraph compound nodes
  for (const [subId, subDef] of ast.subgraphs.entries()) {
    const children = subgraphChildrenMap.get(subId) || [];
    const subDirection = subDef.direction
      ? mapDirectionToElk(subDef.direction)
      : elkDirection;

    const subNode: ElkNode = {
      id: subId,
      children,
      layoutOptions: {
        'elk.direction': subDirection,
        'elk.padding': '[top=40,left=20,bottom=20,right=20]',
        'elk.spacing.nodeNode': '25',
      },
    };
    rootChildren.push(subNode);
  }

  // Build edges
  const elkEdges: ElkExtendedEdge[] = ast.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.from],
    targets: [edge.to],
  }));

  const rootGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': elkDirection,
      'elk.spacing.nodeNode': '35',
      'elk.layered.spacing.nodeNodeBetweenLayers': '45',
      'elk.spacing.edgeNode': '20',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: rootChildren,
    edges: elkEdges,
  };

  const layoutResult = await elk.layout(rootGraph);

  const positionedNodes: PositionedNode[] = [];
  const positionedSubgraphs: PositionedSubgraph[] = [];

  // Extract positioned nodes and subgraphs recursively
  function extractPositions(
    node: ElkNode,
    parentOffsetX: number,
    parentOffsetY: number
  ) {
    const absX = parentOffsetX + (node.x || 0);
    const absY = parentOffsetY + (node.y || 0);

    if (node.id !== 'root') {
      if (ast.subgraphs.has(node.id)) {
        const subDef = ast.subgraphs.get(node.id)!;
        positionedSubgraphs.push({
          id: node.id,
          label: subDef.label || node.id,
          x: absX,
          y: absY,
          width: node.width || 200,
          height: node.height || 150,
          nodeIds: subDef.nodeIds,
        });
      } else if (ast.nodes.has(node.id)) {
        const nodeDef = ast.nodes.get(node.id)!;
        positionedNodes.push({
          id: node.id,
          label: nodeDef.label || node.id,
          shape: nodeDef.shape || 'rectangle',
          x: absX,
          y: absY,
          width: node.width || 120,
          height: node.height || 48,
          subgraphId: nodeDef.subgraphId,
          style: nodeDef.style,
        });
      }
    }

    if (node.children) {
      for (const child of node.children) {
        extractPositions(
          child,
          node.id === 'root' ? 0 : absX,
          node.id === 'root' ? 0 : absY
        );
      }
    }
  }

  extractPositions(layoutResult, 0, 0);

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

function mapDirectionToElk(dir: FlowchartDirection): string {
  switch (dir) {
    case 'LR':
      return 'RIGHT';
    case 'RL':
      return 'LEFT';
    case 'BT':
      return 'UP';
    case 'TB':
    case 'TD':
    default:
      return 'DOWN';
  }
}
