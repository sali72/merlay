/**
 * Edge Interactivity Setup for Native Mermaid SVG.
 * Handles edge path hit-areas, stroke hovering, and edge label click/editing.
 */

import { MermaidEdgeDef } from '../../diagrams/viewModel';
import { matchSvgEdgeToAst } from '../../utils/edgeMatching';
import { getDistanceToSvgPath } from '../../utils/edgeGeometry';

export interface SetupEdgeInteractivityOptions {
  mountEl: HTMLElement;
  displayEdges: MermaidEdgeDef[];
  onSelectEdge: (targetEdge: MermaidEdgeDef, resolvedPath: Element, isMulti: boolean) => void;
  onStartEditingEdge: (edgeId: string, anchorEl: Element) => void;
}

export function setupEdgeInteractivity({
  mountEl,
  displayEdges,
  onSelectEdge,
  onStartEditingEdge,
}: SetupEdgeInteractivityOptions): void {
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

  // Remove stale hit areas
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

  // Setup Edge Labels
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
}
