import { MermaidEdgeDef, MermaidNodeDef, MermaidSubgraphDef } from '../../ast/types';
import { Rect } from '../types';
import { matchSvgEdgeToAst } from '../../utils/edgeMatching';
import { getDistanceToSvgPath } from '../../utils/edgeGeometry';

export interface SetupSvgInteractivityOptions {
  mountEl: HTMLElement;
  displayNodes: Map<string, MermaidNodeDef>;
  displayEdges: MermaidEdgeDef[];
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  getLocalRect: (el: Element) => Rect | null;
  selectedNodeIdsRef: React.RefObject<Set<string>>;
  selectedEdgeIdsRef: React.RefObject<Set<string>>;
  onSelectNode: (targetNodeId: string, isMulti: boolean, htmlEl: Element) => void;
  onSelectEdge: (targetEdge: MermaidEdgeDef, resolvedPath: Element, isMulti: boolean) => void;
  onSelectSubgraph: (targetSubId: string, htmlEl: Element) => void;
  onStartEditingNode: (nodeId: string, nodeEl: Element) => void;
  onStartEditingEdge: (edgeId: string, anchorEl: Element) => void;
  onStartEditingSubgraph: (subId: string, subEl: Element) => void;
  onHoverNode: (nodeId: string, rect: Rect | null, startEndKind?: 'start' | 'end' | null) => void;
}

export type StartEndKind = 'start' | 'end' | null;

function getStartEndKind(el: Element): StartEndKind {
  const attr = el.getAttribute('data-mermaid-start-end');
  if (attr === 'start' || attr === 'end') return attr;
  const idAttr = el.getAttribute('id') || '';
  if (idAttr.includes('root_start') || idAttr.includes('_start-')) return 'start';
  if (idAttr.includes('root_end') || idAttr.includes('_end-')) return 'end';
  // Mermaid renders start as <g class="node default"><circle class="state-start">
  // and end as <g class="node default"><g class="outer-path">… (no circle.state-end in some versions)
  if (el.classList.contains('state-start')) return 'start';
  if (el.classList.contains('state-end')) return 'end';
  // Container <g> wrapping the anchor circle
  try {
    if (el.querySelector('.state-start')) return 'start';
    if (el.querySelector('.state-end')) return 'end';
    if (el.querySelector('.outer-path')) return 'end';
  } catch {
    /* ignore */
  }
  return null;
}

export function setupSvgInteractivity({
  mountEl,
  displayNodes,
  displayEdges,
  displaySubgraphs,
  getLocalRect,
  selectedNodeIdsRef,
  selectedEdgeIdsRef,
  onSelectNode,
  onSelectEdge,
  onSelectSubgraph,
  onStartEditingNode,
  onStartEditingEdge,
  onStartEditingSubgraph,
  onHoverNode,
}: SetupSvgInteractivityOptions): void {
  // A. Setup Node Listeners
  const nodeElements = mountEl.querySelectorAll('.node, [class*="node "]');
  nodeElements.forEach((el) => {
    const htmlEl = el as SVGGraphicsElement;
    htmlEl.style.cursor = 'pointer';

    const idAttr = htmlEl.getAttribute('id') || '';
    let matchedNodeId: string | null = null;

    for (const nid of displayNodes.keys()) {
      if (
        idAttr.includes(`flowchart-${nid}-`) ||
        idAttr === `flowchart-${nid}` ||
        idAttr.includes(`state-${nid}-`) ||
        idAttr === `state-${nid}` ||
        idAttr.endsWith(`-${nid}`) ||
        idAttr === nid ||
        (nid === '[*]' &&
          (htmlEl.classList.contains('state-start') ||
            htmlEl.classList.contains('state-end') ||
            htmlEl.querySelector('.state-start') !== null ||
            htmlEl.querySelector('.state-end') !== null ||
            idAttr.includes('root_start') ||
            idAttr.includes('root_end') ||
            idAttr.includes('state-[')))
      ) {
        matchedNodeId = nid;
        break;
      }
    }

    // Empty subgraphs degrade to plain `.node` elements with id `{diagramId}-{subId}`
    if (!matchedNodeId && idAttr && !idAttr.includes('flowchart-') && !idAttr.includes('state-')) {
      for (const subId of displaySubgraphs.keys()) {
        if (idAttr === subId || idAttr.endsWith(`-${subId}`) || idAttr.includes(`state-${subId}-`)) {
          htmlEl.setAttribute('data-mermaid-subgraph-id', subId);
          const targetSubId = subId;
          htmlEl.onclick = (e) => {
            e.stopPropagation();
            onSelectSubgraph(targetSubId, htmlEl);
          };
          htmlEl.ondblclick = (e) => {
            e.stopPropagation();
            onStartEditingSubgraph(targetSubId, htmlEl);
          };
          return;
        }
      }
    }

    if (!matchedNodeId) {
      const labelText = htmlEl.querySelector('.label, text')?.textContent?.trim();
      for (const [nid, ndef] of displayNodes.entries()) {
        if (ndef.label === labelText || nid === labelText) {
          matchedNodeId = nid;
          break;
        }
      }
    }

    if (!matchedNodeId) return;
    const targetNodeId = matchedNodeId;
    htmlEl.setAttribute('data-mermaid-node-id', targetNodeId);
    if (targetNodeId === '[*]') {
      const k = getStartEndKind(htmlEl);
      if (k) htmlEl.setAttribute('data-mermaid-start-end', k);
    }

    htmlEl.onclick = (e) => {
      e.stopPropagation();
      const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
      onSelectNode(targetNodeId, isMulti, htmlEl);
    };

    htmlEl.ondblclick = (e) => {
      e.stopPropagation();
      onStartEditingNode(targetNodeId, htmlEl);
    };

    htmlEl.onmouseenter = () => {
      const rect = getLocalRect(htmlEl);
      onHoverNode(targetNodeId, rect, getStartEndKind(htmlEl));
    };
  });

  // A2. Mermaid renders [*] anchors as <g class="node default" id="...-root_start-…">
  // (circle.state-start) and <g id="...-root_end-…"> (outer-path, no circle.state-end
  // in some mermaid versions). Ensure they are always tagged for selection and
  // drag-to-connect.
  mountEl
    .querySelectorAll('.state-start, .state-end, [id*="root_start"], [id*="root_end"]')
    .forEach((shapeEl) => {
      const el = shapeEl as Element;
      const idAttr = el.getAttribute('id') || '';
      const isStart =
        el.classList.contains('state-start') ||
        idAttr.includes('root_start') ||
        idAttr.includes('_start-');
      const isEnd =
        el.classList.contains('state-end') ||
        idAttr.includes('root_end') ||
        idAttr.includes('_end-') ||
        el.classList.contains('outer-path') ||
        !!el.querySelector('.outer-path');
      if (!isStart && !isEnd) return;
      const kind: 'start' | 'end' = isStart ? 'start' : 'end';
      const rawContainer = (el as Element).closest('g.node, g');
      const container =
        (rawContainer as SVGGraphicsElement | null) ||
        (el as SVGGraphicsElement);
    container.setAttribute('data-mermaid-node-id', '[*]');
    container.setAttribute('data-mermaid-start-end', kind);
    container.style.cursor = 'pointer';

    container.onclick = (e) => {
      e.stopPropagation();
      const isMulti =
        (e as MouseEvent).shiftKey || (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey;
      onSelectNode('[*]', isMulti, container);
    };

    container.ondblclick = (e) => {
      e.stopPropagation();
      onStartEditingNode('[*]', container);
    };

    container.onmouseenter = () => {
      const rect = getLocalRect(container);
      onHoverNode('[*]', rect, kind);
    };
  });

  // Helper: Match SVG element to AST edge definition
  const findEdgeForElement = (
    el: Element,
    fallbackIdx?: number
  ): MermaidEdgeDef | null => {
    const edgeGroup = el.closest(
      '.edgePath, .edgeLabel, [class*="edgePath"], [class*="edgeLabel"]'
    );
    const id = el.getAttribute('id') || edgeGroup?.getAttribute('id');
    const className = [
      el.getAttribute('class') || '',
      edgeGroup?.getAttribute('class') || '',
    ]
      .filter(Boolean)
      .join(' ');
    const textContent = (el.textContent || edgeGroup?.textContent || '').trim();

    return matchSvgEdgeToAst(
      {
        id,
        className,
        textContent,
      },
      displayEdges,
      fallbackIdx
    );
  };

  // B. Setup Edge Paths & Invisible Hit-Areas
  mountEl.querySelectorAll('.mermaid-edge-hit-area').forEach((el) => el.remove());

  const rawEdgePaths = mountEl.querySelectorAll(
    '.edgePaths path, .edgePath path, path.flowchart-link, [class*="flowchart-link"]'
  );
  const edgePaths: SVGPathElement[] = [];
  rawEdgePaths.forEach((p) => {
    const pathEl = p as SVGPathElement;
    if (
      pathEl.tagName.toLowerCase() === 'path' &&
      pathEl.getAttribute('d') &&
      !pathEl.classList.contains('mermaid-edge-hit-area') &&
      !pathEl.classList.contains('arrowheadPath') &&
      !edgePaths.includes(pathEl)
    ) {
      edgePaths.push(pathEl);
    }
  });

  edgePaths.forEach((pathEl, idx) => {
    const targetEdge = findEdgeForElement(pathEl, idx);
    if (!targetEdge) return;
    const targetEdgeId = targetEdge.id;

    pathEl.setAttribute('data-mermaid-edge-id', targetEdgeId);
    pathEl.style.cursor = 'pointer';

    // Create an invisible 10px stroke hit overlay
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitArea.setAttribute('d', pathEl.getAttribute('d') || '');
    hitArea.setAttribute('class', 'mermaid-edge-hit-area');
    hitArea.setAttribute('data-mermaid-edge-id', targetEdgeId);
    hitArea.setAttribute('fill', 'none');
    hitArea.setAttribute('stroke', 'transparent');
    hitArea.setAttribute('stroke-width', '10');
    hitArea.setAttribute('stroke-linecap', 'round');
    hitArea.style.cursor = 'pointer';
    hitArea.style.pointerEvents = 'stroke';

    pathEl.parentNode?.insertBefore(hitArea, pathEl.nextSibling);

    const onEdgeClick = (
      e: MouseEvent,
      edgeDef: MermaidEdgeDef,
      clickedEl: Element
    ) => {
      e.stopPropagation();
      e.preventDefault();

      let resolvedEdge = edgeDef;
      let resolvedPath = pathEl;
      if (e.clientX && e.clientY && edgePaths.length > 1) {
        let closestDist = Infinity;
        for (const p of edgePaths) {
          const dist = getDistanceToSvgPath(p, e.clientX, e.clientY);
          if (dist < closestDist) {
            const edgeId = p.getAttribute('data-mermaid-edge-id');
            const found = displayEdges.find((ed) => ed.id === edgeId);
            if (found) {
              closestDist = dist;
              resolvedEdge = found;
              resolvedPath = p;
            }
          }
        }
      }

      const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
      onSelectEdge(resolvedEdge, resolvedPath, isMulti);
    };

    hitArea.onclick = (e) => {
      onEdgeClick(e, targetEdge, hitArea);
    };

    pathEl.onclick = (e) => {
      onEdgeClick(e, targetEdge, pathEl);
    };

    hitArea.onmouseenter = () => {
      pathEl.classList.add('mermaid-edge-hovered');
    };

    hitArea.onmousemove = () => {
      if (!pathEl.classList.contains('mermaid-edge-hovered')) {
        mountEl
          .querySelectorAll('.mermaid-edge-hovered')
          .forEach((p) => p.classList.remove('mermaid-edge-hovered'));
        pathEl.classList.add('mermaid-edge-hovered');
      }
    };

    hitArea.onmouseleave = () => {
      pathEl.classList.remove('mermaid-edge-hovered');
    };

    pathEl.onmousemove = hitArea.onmousemove;
    pathEl.onmouseleave = hitArea.onmouseleave;
  });

  // C. Setup Edge Labels
  const edgeLabels = mountEl.querySelectorAll(
    '.edgeLabels .edgeLabel, .edgeLabel, [class*="edgeLabel"]'
  );
  edgeLabels.forEach((el) => {
    const htmlEl = el as SVGGraphicsElement;
    const targetEdge = findEdgeForElement(htmlEl);
    if (!targetEdge) return;
    const targetEdgeId = targetEdge.id;

    htmlEl.setAttribute('data-mermaid-edge-id', targetEdgeId);
    htmlEl.style.cursor = 'pointer';

    htmlEl.onclick = (e) => {
      const edgeDef = displayEdges.find((ed) => ed.id === targetEdgeId) || targetEdge;
      const mouseEv = e as unknown as MouseEvent;
      mouseEv.stopPropagation();
      mouseEv.preventDefault();
      const isMulti = mouseEv.shiftKey || mouseEv.metaKey || mouseEv.ctrlKey;
      onSelectEdge(edgeDef, htmlEl, isMulti);
    };

    htmlEl.ondblclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      onStartEditingEdge(targetEdgeId, htmlEl);
    };
  });

  // D. Setup Subgraph Clusters
  const clusterElements = Array.from(
    mountEl.querySelectorAll('.cluster, [class*="cluster"]')
  );
  const usedSubIds = new Set<string>();
  const pendingLabelClusters: Element[] = [];

  const matchByIdOrContainment = (htmlEl: Element): string | null => {
    const idAttr = htmlEl.getAttribute('id') || '';
    if (idAttr) {
      for (const subId of displaySubgraphs.keys()) {
        if (usedSubIds.has(subId)) continue;
        if (
          idAttr.includes(`flowchart-${subId}-`) ||
          idAttr === `flowchart-${subId}` ||
          idAttr.includes(`state-${subId}-`) ||
          idAttr === `state-${subId}` ||
          idAttr.endsWith(`-${subId}`) ||
          idAttr === subId
        ) {
          return subId;
        }
      }
    }

    for (const [subId, subDef] of displaySubgraphs.entries()) {
      if (usedSubIds.has(subId)) continue;
      if (subDef.nodeIds.length === 0) continue;
      for (const nid of subDef.nodeIds) {
        if (htmlEl.querySelector(`[data-mermaid-node-id="${nid}"]`)) {
          return subId;
        }
      }
    }
    return null;
  };

  const unassignedClusters: Element[] = [];
  for (const el of clusterElements) {
    const htmlEl = el as SVGGraphicsElement;
    htmlEl.style.cursor = 'pointer';
    const matched = matchByIdOrContainment(htmlEl);
    if (matched) {
      usedSubIds.add(matched);
      htmlEl.setAttribute('data-mermaid-subgraph-id', matched);
      const targetSubId = matched;
      htmlEl.onclick = (e) => {
        e.stopPropagation();
        onSelectSubgraph(targetSubId, htmlEl);
      };
      htmlEl.ondblclick = (e) => {
        e.stopPropagation();
        onStartEditingSubgraph(targetSubId, htmlEl);
      };
    } else {
      unassignedClusters.push(htmlEl);
    }
  }

  // Second pass: label matching
  const clustersByLabel = new Map<string, Element[]>();
  for (const el of unassignedClusters) {
    const labelText =
      el.querySelector('.label, text, .cluster-label')?.textContent?.trim() ?? '';
    const key = labelText;
    if (!clustersByLabel.has(key)) clustersByLabel.set(key, []);
    clustersByLabel.get(key)!.push(el);
  }
  const subsByLabel = new Map<string, string[]>();
  for (const [subId, subDef] of displaySubgraphs.entries()) {
    if (usedSubIds.has(subId)) continue;
    for (const key of [subDef.label, subId]) {
      if (!subsByLabel.has(key)) subsByLabel.set(key, []);
      subsByLabel.get(key)!.push(subId);
    }
  }
  for (const el of unassignedClusters) {
    const htmlEl = el as SVGGraphicsElement;
    if (htmlEl.hasAttribute('data-mermaid-subgraph-id')) continue;
    const labelText =
      htmlEl.querySelector('.label, text, .cluster-label')?.textContent?.trim() ?? '';
    const clusterQueue = clustersByLabel.get(labelText) ?? [];
    const subQueue = subsByLabel.get(labelText) ?? [];
    if (subQueue.length === 0) {
      pendingLabelClusters.push(htmlEl);
      continue;
    }
    const idx = clusterQueue.indexOf(el);
    const targetSubId = subQueue[Math.min(idx, subQueue.length - 1)];
    if (usedSubIds.has(targetSubId)) continue;
    usedSubIds.add(targetSubId);
    const qIdx = subQueue.indexOf(targetSubId);
    if (qIdx !== -1) subQueue.splice(qIdx, 1);
    htmlEl.setAttribute('data-mermaid-subgraph-id', targetSubId);
    htmlEl.onclick = (e) => {
      e.stopPropagation();
      onSelectSubgraph(targetSubId, htmlEl);
    };
    htmlEl.ondblclick = (e) => {
      e.stopPropagation();
      onStartEditingSubgraph(targetSubId, htmlEl);
    };
  }
  for (const el of pendingLabelClusters) {
    const htmlEl = el as SVGGraphicsElement;
    if (!htmlEl.onclick) {
      htmlEl.style.cursor = 'default';
    }
  }
}
