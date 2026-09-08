/**
 * Node Interactivity Setup for Native Mermaid SVG.
 * Handles hit-testing, clicking, double-clicking, and hover proximity detection
 * for nodes and start/end anchors, using the driver's SVG DOM adapter.
 */

import { MermaidNodeDef, MermaidSubgraphDef } from '../../diagrams/viewModel';
import { SvgDomAdapter } from '../../diagrams/types';
import { Rect } from '../types';

export type StartEndKind = 'start' | 'end' | null;

export interface SetupNodeInteractivityOptions {
  mountEl: HTMLElement;
  dom: SvgDomAdapter;
  displayNodes: Map<string, MermaidNodeDef>;
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  getLocalRect: (el: Element) => Rect | null;
  onSelectNode: (targetNodeId: string, isMulti: boolean, htmlEl: Element) => void;
  onSelectSubgraph: (targetSubId: string, htmlEl: Element) => void;
  onStartEditingNode: (nodeId: string, nodeEl: Element) => void;
  onStartEditingSubgraph: (subId: string, subEl: Element) => void;
  onHoverNode: (nodeId: string, rect: Rect | null, startEndKind?: StartEndKind) => void;
}

export function setupNodeInteractivity({
  mountEl,
  dom,
  displayNodes,
  displaySubgraphs,
  getLocalRect,
  onSelectNode,
  onSelectSubgraph,
  onStartEditingNode,
  onStartEditingSubgraph,
  onHoverNode,
}: SetupNodeInteractivityOptions): void {
  const prefixes = dom.nodeIdPrefixes;
  const anchorNodeId = dom.anchorNodeId;
  const isAnchorEl = dom.isAnchorElement;

  const nodeElements = mountEl.querySelectorAll('.node, [class*="node "]');
  nodeElements.forEach((el) => {
    const htmlEl = el as SVGGraphicsElement;
    htmlEl.style.cursor = 'pointer';

    const idAttr = htmlEl.getAttribute('id') || '';
    let matchedNodeId: string | null = null;

    for (const nid of displayNodes.keys()) {
      if (
        prefixes.some(
          (p) => idAttr.includes(`${p}${nid}-`) || idAttr === `${p}${nid}`
        ) ||
        idAttr.endsWith(`-${nid}`) ||
        idAttr === nid ||
        (isAnchorEl && isAnchorEl(htmlEl))
      ) {
        matchedNodeId = nid;
        break;
      }
    }

    // Empty subgraphs degrade to plain `.node` elements with id `{diagramId}-{subId}`
    if (!matchedNodeId && idAttr && !prefixes.some((p) => idAttr.includes(p))) {
      for (const subId of displaySubgraphs.keys()) {
        if (idAttr === subId || idAttr.endsWith(`-${subId}`) || prefixes.some((p) => idAttr.includes(`${p}${subId}-`))) {
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
    if (anchorNodeId && targetNodeId === anchorNodeId) {
      const k = dom.getAnchorKind?.(htmlEl) ?? null;
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
      const anchorKind =
        anchorNodeId && targetNodeId === anchorNodeId
          ? dom.getAnchorKind?.(htmlEl) ?? null
          : null;
      onHoverNode(targetNodeId, rect, anchorKind);
    };
  });

  // Anchor shapes (e.g. mermaid renders [*] as <g class="node default"
  // id="...-root_start-…"> / outer-path end markers) are tagged separately for
  // selection and drag-to-connect.
  if (dom.anchorSelectors && anchorNodeId) {
    mountEl.querySelectorAll(dom.anchorSelectors).forEach((shapeEl) => {
      const el = shapeEl as Element;
      const kind = dom.getAnchorKind?.(el) ?? null;
      if (!kind) return;
      const rawContainer = (el as Element).closest('g.node, g');
      const container =
        (rawContainer as SVGGraphicsElement | null) ||
        (el as SVGGraphicsElement);
      container.setAttribute('data-mermaid-node-id', anchorNodeId);
      container.setAttribute('data-mermaid-start-end', kind);
      container.style.cursor = 'pointer';

      container.onclick = (e) => {
        e.stopPropagation();
        const isMulti =
          (e as MouseEvent).shiftKey || (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey;
        onSelectNode(anchorNodeId, isMulti, container);
      };

      container.ondblclick = (e) => {
        e.stopPropagation();
        onStartEditingNode(anchorNodeId, container);
      };

      container.onmouseenter = () => {
        const rect = getLocalRect(container);
        onHoverNode(anchorNodeId, rect, kind);
      };
    });
  }
}
