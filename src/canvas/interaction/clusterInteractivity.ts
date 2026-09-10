/**
 * Subgraph Cluster Interactivity Setup for Native Mermaid SVG.
 * Matches SVG cluster groups to view-model subgraphs and attaches
 * click/double-click handlers, plus hover so clusters can act as connection
 * endpoints (drag-to-connect to/from a composite/group).
 */

import { MermaidSubgraphDef } from '../../diagrams/viewModel';
import { Rect } from '../types';

export interface SetupClusterInteractivityOptions {
  mountEl: HTMLElement;
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  getLocalRect: (el: Element) => Rect | null;
  onSelectSubgraph: (targetSubId: string, htmlEl: Element) => void;
  onStartEditingSubgraph: (subId: string, subEl: Element) => void;
  onHoverSubgraph?: (subId: string, rect: Rect | null) => void;
}

export function setupClusterInteractivity({
  mountEl,
  displaySubgraphs,
  getLocalRect,
  onSelectSubgraph,
  onStartEditingSubgraph,
  onHoverSubgraph,
}: SetupClusterInteractivityOptions): void {
  const clusterElements: Element[] = Array.from(
    mountEl.querySelectorAll('.cluster, [class*="cluster"], .box, [class*="box"]')
  );

  // In Mermaid sequence diagrams, boxes are rendered as <g><rect class="rect" .../><text class="text">...</text></g>
  mountEl.querySelectorAll('rect.rect').forEach((rectEl) => {
    const parentG = rectEl.parentElement;
    if (parentG && parentG.tagName.toLowerCase() === 'g') {
      if (!clusterElements.includes(parentG)) clusterElements.push(parentG);
    } else if (!clusterElements.includes(rectEl)) {
      clusterElements.push(rectEl);
    }
  });

  const usedSubIds = new Set<string>();
  const pendingLabelClusters: Element[] = [];

  const bindCluster = (htmlEl: SVGGraphicsElement, targetSubId: string) => {
    htmlEl.setAttribute('data-mermaid-subgraph-id', targetSubId);
    // Clusters double as connection endpoints (e.g. transitions to/from
    // composite states, edges between flowchart subgraphs). Drivers decide
    // whether the id is connectable; the canvas just resolves the drop.
    htmlEl.setAttribute('data-mermaid-node-id', targetSubId);
    htmlEl.setCssStyles({ cursor: 'pointer' });

    // Ensure all child rects and texts receive clicks and have pointer cursor
    htmlEl.querySelectorAll('rect, text').forEach((child) => {
      const childEl = child as SVGGraphicsElement;
      childEl.setCssStyles({ cursor: 'pointer' });
      childEl.setAttribute('pointer-events', 'all');
      childEl.onclick = (e) => {
        e.stopPropagation();
        onSelectSubgraph(targetSubId, htmlEl);
      };
      childEl.ondblclick = (e) => {
        e.stopPropagation();
        onStartEditingSubgraph(targetSubId, htmlEl);
      };
    });

    htmlEl.onclick = (e) => {
      e.stopPropagation();
      onSelectSubgraph(targetSubId, htmlEl);
    };
    htmlEl.ondblclick = (e) => {
      e.stopPropagation();
      onStartEditingSubgraph(targetSubId, htmlEl);
    };
    if (onHoverSubgraph) {
      htmlEl.onmouseenter = () => {
        onHoverSubgraph(targetSubId, getLocalRect(htmlEl));
      };
    }
  };

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

    // 1. Direct DOM containment (flowchart / state subgraphs)
    for (const [subId, subDef] of displaySubgraphs.entries()) {
      if (usedSubIds.has(subId)) continue;
      if (subDef.nodeIds.length === 0) continue;
      for (const nid of subDef.nodeIds) {
        if (htmlEl.querySelector(`[data-mermaid-node-id="${nid}"]`)) {
          return subId;
        }
      }
    }

    // 2. Geometric horizontal containment (for sequence diagram boxes where participants are siblings)
    const boxRect = getLocalRect(htmlEl);
    if (boxRect) {
      for (const [subId, subDef] of displaySubgraphs.entries()) {
        if (usedSubIds.has(subId)) continue;
        if (subDef.nodeIds.length === 0) continue;
        let allMatch = true;
        for (const nid of subDef.nodeIds) {
          const nodeEl =
            mountEl.querySelector(
              `rect.actor-top[name="${nid}"], g.actor-top[name="${nid}"], [data-mermaid-node-id="${nid}"]:not(.actor-line):not(.mermaid-lifeline-hit-area)`
            ) || mountEl.querySelector(`[data-mermaid-node-id="${nid}"]`);
          if (nodeEl) {
            const nr = getLocalRect(nodeEl);
            if (nr && (nr.x < boxRect.x - 30 || nr.x + nr.width > boxRect.x + boxRect.width + 30)) {
              allMatch = false;
              break;
            }
          }
        }
        if (allMatch) {
          return subId;
        }
      }
    }

    return null;
  };

  const unassignedClusters: Element[] = [];
  for (const el of clusterElements) {
    const htmlEl = el as SVGGraphicsElement;
    htmlEl.setCssStyles({ cursor: 'pointer' });
    const matched = matchByIdOrContainment(htmlEl);
    if (matched) {
      usedSubIds.add(matched);
      bindCluster(htmlEl, matched);
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
    bindCluster(htmlEl, targetSubId);
  }
  for (const el of pendingLabelClusters) {
    const htmlEl = el as SVGGraphicsElement;
    if (!htmlEl.onclick) {
      htmlEl.setCssStyles({ cursor: 'default' });
    }
  }
}
