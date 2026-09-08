/**
 * Hook to manage Mermaid SVG rendering, camera stabilization, unmatched subgraph discovery,
 * and binding SVG DOM interactivity.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { App } from 'obsidian';
import { Rect } from '../types';
import { MermaidNodeDef, MermaidEdgeDef, MermaidSubgraphDef } from '../../ast/types';
import { DiagramDriver } from '../../diagrams/types';
import { renderMermaidSvg } from '../renderer/mermaidRenderer';
import { applySelectedNodeHalos } from '../renderer/selectionHalo';
import { setupSvgInteractivity } from '../interaction/setupSvgInteractivity';

export interface UseCanvasRendererOptions {
  app: App;
  code: string;
  driver: DiagramDriver;
  svgMountRef: React.RefObject<HTMLDivElement>;
  displayNodes: Map<string, MermaidNodeDef>;
  displayEdges: MermaidEdgeDef[];
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  getLocalRect: (el: Element) => Rect | null;
  selection: {
    selectedNodeIdsRef: React.MutableRefObject<Set<string>>;
    selectedEdgeIdsRef: React.MutableRefObject<Set<string>>;
    setSelectedNodeIds: (ids: Set<string>) => void;
    setSelectedEdgeIds: (ids: Set<string>) => void;
    setSelectedNodeRect: (rect: Rect | null) => void;
    setSelectedEdgePos: (pos: any | null) => void;
    setSelectedSubgraphId: (id: string | null) => void;
    setSelectedSubgraphRect: (rect: Rect | null) => void;
    setActiveNodePopover: (popover: any) => void;
    setActiveEdgePopover: (popover: any) => void;
    setActiveMultiPopover: (popover: any) => void;
    setActiveSubgraphPopover: (popover: any) => void;
    updateSelectedNodeHalo: (nodes?: Set<string>) => void;
    updateSelectedEdgeHalo: (edges?: Set<string>) => void;
    updateSelectedNodeRect: () => void;
    setUnmatchedSubgraphIds: React.Dispatch<React.SetStateAction<string[]>>;
  };
  selectedStarKindRef: React.MutableRefObject<'start' | 'end' | null>;
  setSelectedStarKind: (kind: 'start' | 'end' | null) => void;
  inlineEditing: {
    startEditingEdge: (edgeId: string, edgeEl: Element) => void;
    startEditingSubgraph: (subId: string, subEl: Element) => void;
    setEditingNodeId: (id: string | null) => void;
  };
  handleStartEditingNode: (nodeId: string, el: Element) => void;
  setHoveredNodeId: (id: string | null) => void;
  setHoveredNodeRect: (rect: Rect | null) => void;
  setHoveredNodeKind: (kind: 'start' | 'end' | null) => void;
  stabilizeCamera: () => void;
  setSyntaxError: (err: string | null) => void;
}

export function useCanvasRenderer({
  app,
  code,
  driver,
  svgMountRef,
  displayNodes,
  displayEdges,
  displaySubgraphs,
  getLocalRect,
  selection,
  selectedStarKindRef,
  setSelectedStarKind,
  inlineEditing,
  handleStartEditingNode,
  setHoveredNodeId,
  setHoveredNodeRect,
  setHoveredNodeKind,
  stabilizeCamera,
  setSyntaxError,
}: UseCanvasRendererOptions) {
  const renderTicketRef = useRef<number>(0);
  const anchors = driver.mutations.anchors;
  const isAnchorId = (id: string | null | undefined): id is string =>
    !!anchors && !!id && anchors.isAnchor(id);

  const setupSvg = useCallback(() => {
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    setupSvgInteractivity({
      mountEl,
      dom: driver.dom,
      displayNodes,
      displayEdges,
      displaySubgraphs,
      getLocalRect,
      selectedNodeIdsRef: selection.selectedNodeIdsRef,
      selectedEdgeIdsRef: selection.selectedEdgeIdsRef,
      onSelectNode: (targetNodeId, isMulti, htmlEl) => {
        selection.setSelectedSubgraphId(null);
        selection.setSelectedSubgraphRect(null);
        selection.setActiveSubgraphPopover(null);
        mountEl.querySelectorAll('.mermaid-cluster-selected').forEach((c) =>
          c.classList.remove('mermaid-cluster-selected')
        );

        // Track which anchor (start vs end) was clicked — they share one node
        // id but have distinct visuals.
        const starKindForTarget = isAnchorId(targetNodeId)
          ? driver.dom.getAnchorKind?.(htmlEl) ?? null
          : null;

        if (isAnchorId(targetNodeId) && starKindForTarget) {
          selectedStarKindRef.current = starKindForTarget;
          setSelectedStarKind(starKindForTarget);
        } else if (!isAnchorId(targetNodeId)) {
          selectedStarKindRef.current = null;
          setSelectedStarKind(null);
        }

        if (isMulti) {
          // Anchors are single-select only — never part of a multi-select group.
          if (isAnchorId(targetNodeId)) {
            const nextNodes = new Set([targetNodeId]);
            selection.selectedNodeIdsRef.current = nextNodes;
            selection.setSelectedNodeIds(nextNodes);
            selection.setSelectedEdgeIds(new Set());
            selection.setSelectedEdgePos(null);
            selection.updateSelectedEdgeHalo(new Set());
            const rect = getLocalRect(htmlEl);
            if (rect) selection.setSelectedNodeRect(rect);
            // Kind-filtered halo — only highlight the clicked anchor, not both
            applySelectedNodeHalos(mountEl, nextNodes, undefined, starKindForTarget);
            return;
          }
          const prev = selection.selectedNodeIdsRef.current;
          // Drop any existing anchor from the multi-set before toggling.
          const next = new Set(
            Array.from(prev).filter((id) => !isAnchorId(id))
          );
          if (next.has(targetNodeId)) next.delete(targetNodeId);
          else next.add(targetNodeId);
          selection.selectedNodeIdsRef.current = next;
          selection.setSelectedNodeIds(next);
          selection.updateSelectedNodeHalo(next);
        } else {
          const nextNodes = new Set([targetNodeId]);
          const emptyEdges = new Set<string>();
          selection.selectedNodeIdsRef.current = nextNodes;
          selection.selectedEdgeIdsRef.current = emptyEdges;
          selection.setSelectedNodeIds(nextNodes);
          selection.setSelectedEdgeIds(emptyEdges);
          selection.setSelectedEdgePos(null);
          selection.updateSelectedEdgeHalo(emptyEdges);
          const rect = getLocalRect(htmlEl);
          if (rect) selection.setSelectedNodeRect(rect);
          if (isAnchorId(targetNodeId) && starKindForTarget) {
            applySelectedNodeHalos(mountEl, nextNodes, undefined, starKindForTarget);
          } else {
            selection.updateSelectedNodeHalo(nextNodes);
          }
        }
      },
      onSelectEdge: (targetEdge, resolvedPath, isMulti) => {
        selectedStarKindRef.current = null;
        setSelectedStarKind(null);
        selection.setSelectedSubgraphId(null);
        selection.setSelectedSubgraphRect(null);
        selection.setActiveSubgraphPopover(null);
        mountEl.querySelectorAll('.mermaid-cluster-selected').forEach((c) =>
          c.classList.remove('mermaid-cluster-selected')
        );

        const edgeId = targetEdge.id;
        if (isMulti) {
          const prev = selection.selectedEdgeIdsRef.current;
          const next = new Set(prev);
          if (next.has(edgeId)) next.delete(edgeId);
          else next.add(edgeId);
          selection.selectedEdgeIdsRef.current = next;
          selection.setSelectedEdgeIds(next);
          selection.updateSelectedEdgeHalo(next);
        } else {
          const nextEdges = new Set([edgeId]);
          const emptyNodes = new Set<string>();
          selection.selectedEdgeIdsRef.current = nextEdges;
          selection.selectedNodeIdsRef.current = emptyNodes;
          selection.setSelectedEdgeIds(nextEdges);
          selection.setSelectedNodeIds(emptyNodes);
          selection.setSelectedNodeRect(null);
          inlineEditing.setEditingNodeId(null);
          selection.updateSelectedNodeHalo(emptyNodes);
          selection.updateSelectedEdgeHalo(nextEdges);

          const rect = getLocalRect(resolvedPath);
          if (rect) {
            selection.setSelectedEdgePos({
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
              label: targetEdge.label,
              from: targetEdge.from,
              to: targetEdge.to,
              arrowType: targetEdge.arrowType,
            });
          }
        }
      },
      onSelectSubgraph: (targetSubId, htmlEl) => {
        selectedStarKindRef.current = null;
        setSelectedStarKind(null);
        selection.setSelectedSubgraphId(targetSubId);
        const empty = new Set<string>();
        selection.selectedNodeIdsRef.current = empty;
        selection.selectedEdgeIdsRef.current = new Set<string>();
        selection.setSelectedNodeIds(new Set());
        selection.setSelectedEdgeIds(new Set());
        selection.setSelectedNodeRect(null);
        selection.setSelectedEdgePos(null);
        selection.setActiveNodePopover(null);
        selection.setActiveEdgePopover(null);
        selection.setActiveMultiPopover(null);
        selection.setActiveSubgraphPopover(null);
        selection.updateSelectedNodeHalo(new Set());
        selection.updateSelectedEdgeHalo(new Set());

        mountEl.querySelectorAll('.mermaid-cluster-selected').forEach((c) =>
          c.classList.remove('mermaid-cluster-selected')
        );
        htmlEl.classList.add('mermaid-cluster-selected');

        const rect = getLocalRect(htmlEl);
        if (rect) selection.setSelectedSubgraphRect(rect);
      },
      onStartEditingNode: handleStartEditingNode,
      onStartEditingEdge: inlineEditing.startEditingEdge,
      onStartEditingSubgraph: inlineEditing.startEditingSubgraph,
      onHoverNode: (nodeId, rect, kind) => {
        setHoveredNodeId(nodeId);
        if (rect) setHoveredNodeRect(rect);
        setHoveredNodeKind(kind ?? null);
      },
    });
  }, [
    svgMountRef,
    driver,
    displayNodes,
    displayEdges,
    displaySubgraphs,
    getLocalRect,
    selection,
    selectedStarKindRef,
    setSelectedStarKind,
    inlineEditing,
    handleStartEditingNode,
    setHoveredNodeId,
    setHoveredNodeRect,
    setHoveredNodeKind,
  ]);

  // Latest-callback refs so the render effect only depends on [code, app].
  const setupRef = useRef(setupSvg);
  setupRef.current = setupSvg;
  const stabilizeRef = useRef(stabilizeCamera);
  stabilizeRef.current = stabilizeCamera;
  const rectRef = useRef(selection.updateSelectedNodeRect);
  rectRef.current = selection.updateSelectedNodeRect;
  const haloNodeRef = useRef(selection.updateSelectedNodeHalo);
  haloNodeRef.current = selection.updateSelectedNodeHalo;
  const haloEdgeRef = useRef(selection.updateSelectedEdgeHalo);
  haloEdgeRef.current = selection.updateSelectedEdgeHalo;
  const subgraphsRef = useRef(displaySubgraphs);
  subgraphsRef.current = displaySubgraphs;

  // Render SVG
  useEffect(() => {
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    const ticket = ++renderTicketRef.current;

    renderMermaidSvg(app, code)
      .then((svgHtml) => {
        if (ticket !== renderTicketRef.current) return;
        mountEl.innerHTML = svgHtml;
        setSyntaxError(null);

        setupRef.current();
        stabilizeRef.current();
        rectRef.current();
        haloNodeRef.current();
        haloEdgeRef.current();

        try {
          const rendered = new Set<string>();
          mountEl.querySelectorAll('[data-mermaid-subgraph-id]').forEach((el) => {
            const id = el.getAttribute('data-mermaid-subgraph-id');
            if (id) rendered.add(id);
          });
          const missing: string[] = [];
          for (const subId of subgraphsRef.current.keys()) {
            if (!rendered.has(subId)) missing.push(subId);
          }
          selection.setUnmatchedSubgraphIds((prev) => {
            if (prev.length === missing.length && prev.every((id) => missing.includes(id))) {
              return prev;
            }
            return missing;
          });
        } catch {
          /* ignore */
        }
      })
      .catch((err) => {
        if (ticket !== renderTicketRef.current) return;
        console.error('Mermaid render error:', err);
        setSyntaxError(err?.message || 'Diagram syntax error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, app]);
}
