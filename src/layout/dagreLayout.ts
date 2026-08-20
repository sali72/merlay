/**
 * Dagre & Native Mermaid Layout Engine
 * Matches 1:1 with official Mermaid.js and Obsidian native diagram renderer.
 */

import dagre from '@dagrejs/dagre';
import { line, curveBasis } from 'd3-shape';
import {
  FlowchartDirection,
  MermaidFlowchartAST,
  PositionedEdge,
  PositionedGraph,
  PositionedNode,
  PositionedSubgraph,
} from '../ast/types';
import { serializeMermaidFlowchart } from '../ast/serializer';

const d3CurveGenerator = line<{ x: number; y: number }>()
  .x((d) => d.x)
  .y((d) => d.y)
  .curve(curveBasis);

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

/**
 * Extracts exact node and subgraph pixel positions from a rendered Mermaid SVG.
 */
export function extractPositionsFromMermaidSvg(
  svgString: string,
  ast: MermaidFlowchartAST
): PositionedGraph | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return null;

    const nodeMap = new Map<string, PositionedNode>();
    const subgraphs: PositionedSubgraph[] = [];

    // 1. Extract Node Positions
    const nodeElements = doc.querySelectorAll('.node, [class*="node "]');
    nodeElements.forEach((el) => {
      const idAttr = el.getAttribute('id') || '';
      let matchedId: string | null = null;

      for (const nodeId of ast.nodes.keys()) {
        if (
          idAttr.includes(`flowchart-${nodeId}-`) ||
          idAttr === `flowchart-${nodeId}` ||
          idAttr.endsWith(`-${nodeId}`) ||
          idAttr === nodeId
        ) {
          matchedId = nodeId;
          break;
        }
      }

      if (!matchedId) {
        const labelText = el.querySelector('.label, text')?.textContent?.trim();
        for (const [nid, ndef] of ast.nodes.entries()) {
          if (ndef.label === labelText || nid === labelText) {
            matchedId = nid;
            break;
          }
        }
      }

      if (!matchedId) return;

      const nodeDef = ast.nodes.get(matchedId);
      if (!nodeDef) return;

      const transform = el.getAttribute('transform') || '';
      const match = /translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i.exec(transform);
      if (!match) return;

      const cx = parseFloat(match[1]);
      const cy = parseFloat(match[2]);

      let width = 110;
      let height = 48;

      const rect = el.querySelector('rect');
      const circle = el.querySelector('circle');
      const polygon = el.querySelector('polygon');

      if (rect) {
        width = parseFloat(rect.getAttribute('width') || '110');
        height = parseFloat(rect.getAttribute('height') || '48');
      } else if (circle) {
        const r = parseFloat(circle.getAttribute('r') || '30');
        width = r * 2;
        height = r * 2;
      } else if (polygon) {
        const points = (polygon.getAttribute('points') || '')
          .trim()
          .split(/[\s,]+/)
          .map(parseFloat)
          .filter((n) => !isNaN(n));
        if (points.length >= 4) {
          const xs: number[] = [];
          const ys: number[] = [];
          for (let i = 0; i < points.length; i += 2) {
            xs.push(points[i]);
            ys.push(points[i + 1]);
          }
          width = Math.max(...xs) - Math.min(...xs);
          height = Math.max(...ys) - Math.min(...ys);
        }
      }

      nodeMap.set(matchedId, {
        id: matchedId,
        label: nodeDef.label || matchedId,
        shape: nodeDef.shape || 'rectangle',
        x: cx - width / 2,
        y: cy - height / 2,
        width,
        height,
        subgraphId: nodeDef.subgraphId,
        style: nodeDef.style,
      });
    });

    // 2. Extract Cluster / Subgraph Positions
    const clusterElements = doc.querySelectorAll('.cluster, [class*="cluster"]');
    clusterElements.forEach((el) => {
      const idAttr = el.getAttribute('id') || '';
      let matchedSubId: string | null = null;

      for (const subId of ast.subgraphs.keys()) {
        if (
          idAttr.includes(`flowchart-${subId}-`) ||
          idAttr === `flowchart-${subId}` ||
          idAttr.endsWith(`-${subId}`) ||
          idAttr === subId
        ) {
          matchedSubId = subId;
          break;
        }
      }

      if (!matchedSubId) {
        const labelText = el.querySelector('.label, text')?.textContent?.trim();
        for (const [sid, sdef] of ast.subgraphs.entries()) {
          if (sdef.label === labelText || sid === labelText) {
            matchedSubId = sid;
            break;
          }
        }
      }

      if (!matchedSubId) return;

      const subDef = ast.subgraphs.get(matchedSubId);
      if (!subDef) return;

      const rect = el.querySelector('rect');
      if (rect) {
        const x = parseFloat(rect.getAttribute('x') || '0');
        const y = parseFloat(rect.getAttribute('y') || '0');
        const width = parseFloat(rect.getAttribute('width') || '200');
        const height = parseFloat(rect.getAttribute('height') || '150');

        subgraphs.push({
          id: matchedSubId,
          label: subDef.label || matchedSubId,
          x,
          y,
          width,
          height,
          nodeIds: subDef.nodeIds,
        });
      }
    });

    // 3. Extract Edge Paths from Mermaid SVG
    const edgePaths = new Map<string, string>();
    const pathElements = doc.querySelectorAll('.flowchart-link, [class*="flowchart-link"], .edgePath path');
    pathElements.forEach((pathEl) => {
      const dAttr = pathEl.getAttribute('d');
      if (!dAttr) return;

      const idAttr = pathEl.getAttribute('id') || pathEl.parentElement?.getAttribute('id') || '';
      const classAttr = pathEl.getAttribute('class') || pathEl.parentElement?.getAttribute('class') || '';

      for (const edge of ast.edges) {
        if (
          idAttr.includes(`L-${edge.from}-${edge.to}`) ||
          classAttr.includes(`L-${edge.from}-${edge.to}`) ||
          idAttr.includes(`${edge.from}-${edge.to}`) ||
          classAttr.includes(`${edge.from}-${edge.to}`)
        ) {
          edgePaths.set(edge.id, dAttr);
          break;
        }
      }
    });

    if (nodeMap.size === ast.nodes.size && nodeMap.size > 0) {
      return {
        direction: ast.direction,
        nodes: Array.from(nodeMap.values()),
        edges: ast.edges.map((e) => ({
          id: e.id,
          from: e.from,
          to: e.to,
          arrowType: e.arrowType,
          label: e.label,
          svgPath: edgePaths.get(e.id),
        })),
        subgraphs,
      };
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Converts a sequence of Dagre 2D points into a smooth cubic B-spline path
 * matching Mermaid's d3.curveBasis interpolation.
 */
export function pointsToSvgPath(points: Array<{ x: number; y: number }>): string {
  if (!points || points.length === 0) return '';
  return d3CurveGenerator(points) || '';
}

/**
 * Pure Dagre Layout Engine with edge label spacers matching Mermaid specifications.
 */
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

  // 3. Add Edges with Label Spacers
  for (const edge of ast.edges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      const labelLen = edge.label ? edge.label.length : 0;
      const edgeOpts =
        labelLen > 0
          ? { width: Math.max(30, labelLen * 8.5 + 16), height: 20, labelpos: 'c' }
          : {};
      g.setEdge(edge.from, edge.to, edgeOpts);
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

  // 6. Extract positioned edges with Dagre B-spline paths
  const positionedEdges: PositionedEdge[] = ast.edges.map((e) => {
    const dEdge = g.edge(e.from, e.to);
    const points = dEdge?.points;
    const svgPath = points ? pointsToSvgPath(points) : undefined;
    const labelPosition =
      dEdge?.x !== undefined && dEdge?.y !== undefined
        ? { x: dEdge.x, y: dEdge.y }
        : undefined;

    return {
      id: e.id,
      from: e.from,
      to: e.to,
      arrowType: e.arrowType,
      label: e.label,
      points,
      svgPath,
      labelPosition,
    };
  });

  return {
    direction: ast.direction,
    nodes: positionedNodes,
    edges: positionedEdges,
    subgraphs: positionedSubgraphs,
  };
}

/**
 * Universal Native Mermaid Layout:
 * Attempts to render via Obsidian's global mermaid instance for 100% pixel parity,
 * with instantaneous Dagre fallback.
 */
export async function calculateMermaidLayout(
  ast: MermaidFlowchartAST
): Promise<PositionedGraph> {
  const mermaidGlobal = (typeof window !== 'undefined' && (window as any).mermaid) as any;

  if (mermaidGlobal && typeof mermaidGlobal.render === 'function') {
    try {
      const code = serializeMermaidFlowchart(ast);
      const renderId = `m_render_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const result = await mermaidGlobal.render(renderId, code);
      const svgString = typeof result === 'string' ? result : result?.svg;

      if (svgString) {
        const nativeLayout = extractPositionsFromMermaidSvg(svgString, ast);
        if (nativeLayout) {
          return nativeLayout;
        }
      }
    } catch (e) {
      // Fall through to Dagre
    }
  }

  return calculateDagreLayout(ast);
}
