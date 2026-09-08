/**
 * Node Interactivity Setup for Native Mermaid SVG.
 * Handles hit-testing, clicking, double-clicking, and hover proximity detection for nodes and [*] anchors.
 */

import { MermaidNodeDef, MermaidSubgraphDef } from '../../ast/types';
import { Rect } from '../types';

export type StartEndKind = 'start' | 'end' | null;

export function getStartEndKind(el: Element): StartEndKind {
  const attr = el.getAttribute('data-mermaid-start-end');
  if (attr === 'start' || attr === 'end') return attr;
  const idAttr = el.getAttribute('id') || '';
  if (idAttr.includes('root_start') || idAttr.includes('_start-')) return 'start';
  if (idAttr.includes('root_end') || idAttr.includes('_end-')) return 'end';
  if (el.classList.contains('state-start')) return 'start';
  if (el.classList.contains('state-end')) return 'end';
  try {
    if (el.querySelector('.state-start')) return 'start';
    if (el.querySelector('.state-end')) return 'end';
    if (el.querySelector('.outer-path')) return 'end';
  } catch {
    /* ignore */
  }
  return null;
}

export interface SetupNodeInteractivityOptions {
  mountEl: HTMLElement;
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
  displayNodes,
  displaySubgraphs,
  getLocalRect,
  onSelectNode,
  onSelectSubgraph,
  onStartEditingNode,
  onStartEditingSubgraph,
  onHoverNode,
}: SetupNodeInteractivityOptions): void {
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

  // Mermaid renders [*] anchors as <g class="node default" id="...-root_start-…">
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
}
