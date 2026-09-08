/**
 * Subgraph Cluster Interactivity Setup for Native Mermaid SVG.
 * Matches SVG cluster groups to AST subgraphs and attaches click/double-click handlers.
 */

import { MermaidSubgraphDef } from '../../ast/types';

export interface SetupClusterInteractivityOptions {
  mountEl: HTMLElement;
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  onSelectSubgraph: (targetSubId: string, htmlEl: Element) => void;
  onStartEditingSubgraph: (subId: string, subEl: Element) => void;
}

export function setupClusterInteractivity({
  mountEl,
  displaySubgraphs,
  onSelectSubgraph,
  onStartEditingSubgraph,
}: SetupClusterInteractivityOptions): void {
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
