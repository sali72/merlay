/**
 * Native Mermaid View with Direct Structural Manipulation Overlay
 * Renders Obsidian's exact native Mermaid SVG (100% parity, zero layout simulation)
 * with direct-manipulation node sprouting, drag-to-connect, inline label editing, and camera stabilization.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { connectNodes, insertNodeOnEdge } from '../ast/mutations';
import { parseMermaidFlowchart } from '../ast/parser';
import { detectDiagramType } from '../diagrams/registry';
import { SupportedDiagramType } from '../diagrams/types';
import { parseMermaidStateDiagram } from '../diagrams/state/parser';
import * as stateMutations from '../diagrams/state/mutations';
import {
  CursorMode,
  NativeMermaidViewProps,
  Rect,
} from './types';
import { renderMermaidSvg } from './renderer/mermaidRenderer';
import { applySelectedNodeHalos } from './renderer/selectionHalo';
import { useHistory } from './useHistory';

import { useCanvasCamera } from './hooks/useCanvasCamera';
import { useCanvasSelection } from './hooks/useCanvasSelection';
import { useMarqueeSelection } from './hooks/useMarqueeSelection';
import { useInlineEditing } from './hooks/useInlineEditing';
import { useDiagramMutations } from './hooks/useDiagramMutations';
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts';
import { setupSvgInteractivity } from './interaction/setupSvgInteractivity';

import { CanvasTopBar } from './components/CanvasTopBar';
import { CanvasOverlays } from './components/CanvasOverlays';
import { SyntaxDrawer } from './components/SyntaxDrawer';

export type { NativeMermaidViewProps };

export const NativeMermaidView: React.FC<NativeMermaidViewProps> = ({
  app,
  initialCode,
  onCodeChange,
}) => {
  const [code, setCode] = useState<string>(
    initialCode || 'flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]'
  );
  const diagramType = useMemo<SupportedDiagramType>(
    () => detectDiagramType(code),
    [code]
  );
  const isStateDiagram = diagramType === 'stateDiagram';

  // History Stack
  const history = useHistory(code);
  const pushHistoryState = history.pushState;
  const undoHistory = history.undo;
  const redoHistory = history.redo;

  // Primary Canvas DOM Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const svgMountRef = useRef<HTMLDivElement>(null);
  const renderTicketRef = useRef<number>(0);

  // 1. Camera & Viewport
  const {
    zoom,
    setZoom,
    pan,
    setPan,
    isPanning,
    setIsPanning,
    zoomRef,
    panStartRef,
    getLocalRect,
    pinNodeForCamera,
    stabilizeCamera,
    handleWheel,
    handleFitView,
    startPan,
    updatePan,
    endPan,
  } = useCanvasCamera({ worldRef, svgMountRef });

  const [selectedStarKind, setSelectedStarKind] = useState<'start' | 'end' | null>(null);
  const selectedStarKindRef = useRef<'start' | 'end' | null>(null);
  useEffect(() => {
    selectedStarKindRef.current = selectedStarKind;
  }, [selectedStarKind]);

  // 2. Selection & Halos
  const selection = useCanvasSelection({
    svgMountRef,
    getLocalRect,
    displayDirection: isStateDiagram ? 'LR' : 'TD',
    selectedStarKind,
  });

  // 3. Diagram Mutations & AST State
  const mutations = useDiagramMutations({
    code,
    setCode,
    onCodeChange,
    pushHistoryState,
    diagramType,
    pinNodeForCamera,
    selectedNodeId: selection.selectedNodeId,
    selectedNodeIds: selection.selectedNodeIds,
    selectedEdgeId: selection.selectedEdgeId,
    selectedEdgeIds: selection.selectedEdgeIds,
    selectedSubgraphId: selection.selectedSubgraphId,
    setSelectedNodeId: selection.setSelectedNodeId,
    setSelectedEdgeId: selection.setSelectedEdgeId,
    setSelectedSubgraphId: selection.setSelectedSubgraphId,
    setSelectedNodeIds: selection.setSelectedNodeIds,
    setSelectedEdgeIds: selection.setSelectedEdgeIds,
    setSelectedNodeRect: selection.setSelectedNodeRect,
    setSelectedEdgePos: selection.setSelectedEdgePos,
    setSelectedSubgraphRect: selection.setSelectedSubgraphRect,
    setActiveNodePopover: selection.setActiveNodePopover,
    setActiveEdgePopover: selection.setActiveEdgePopover,
    setActiveMultiPopover: selection.setActiveMultiPopover,
    setActiveSubgraphPopover: selection.setActiveSubgraphPopover,
    updateSelectedNodeHalo: selection.updateSelectedNodeHalo,
    updateSelectedEdgeHalo: selection.updateSelectedEdgeHalo,
    selectedNodeIdsRef: selection.selectedNodeIdsRef,
    selectedEdgeIdsRef: selection.selectedEdgeIdsRef,
    selectedStarKind,
    setSelectedStarKind,
  });

  // 4. Marquee Selection
  const marquee = useMarqueeSelection({
    worldRef,
    svgMountRef,
    zoomRef,
    getLocalRect,
    onSelectionChange: (nodes, edges) => {
      // Marquee never includes [*] (filtered in hook), clear star kind
      if (!nodes.has('[*]')) {
        selectedStarKindRef.current = null;
        setSelectedStarKind(null);
      }
      selection.selectedNodeIdsRef.current = nodes;
      selection.selectedEdgeIdsRef.current = edges;
      selection.setSelectedNodeIds(nodes);
      selection.setSelectedEdgeIds(edges);
      selection.updateSelectedNodeHalo(nodes);
      selection.updateSelectedEdgeHalo(edges);
    },
    selectedNodeIdsRef: selection.selectedNodeIdsRef,
    selectedEdgeIdsRef: selection.selectedEdgeIdsRef,
  });

  // 5. Inline Text Editing
  const inlineEditing = useInlineEditing({
    displayNodes: mutations.displayNodes,
    displayEdges: mutations.displayEdges,
    displaySubgraphs: mutations.displaySubgraphs,
    getLocalRect,
    onCommitNodeLabel: (nodeId, newLabel) => {
      if (isStateDiagram) {
        mutations.applyStateAstMutation((a) => {
          stateMutations.updateStateLabel(a, nodeId, newLabel);
        }, nodeId);
      } else {
        mutations.applyAstMutation((a) => {
          mutations.handleUpdateNodeShape(mutations.displayNodes.get(nodeId)?.shape || 'rectangle', nodeId);
        }, nodeId);
      }
    },
    onCommitEdgeLabel: mutations.handleUpdateEdgeLabel,
    onCommitSubgraphLabel: mutations.handleRenameSubgraph,
    onClearOtherSelections: (keepType, id) => {
      if (keepType === 'node') {
        selection.setSelectedEdgeIds(new Set());
        selection.selectedEdgeIdsRef.current = new Set();
        selection.setSelectedEdgePos(null);
        selection.updateSelectedEdgeHalo(new Set());
      } else if (keepType === 'edge') {
        selection.setSelectedNodeIds(new Set());
        selection.selectedNodeIdsRef.current = new Set();
        selection.setSelectedNodeRect(null);
        selection.updateSelectedNodeHalo(new Set());
        selection.setSelectedEdgeId(id);
        selection.updateSelectedEdgeHalo(new Set([id]));
      } else if (keepType === 'subgraph') {
        selection.setSelectedNodeIds(new Set());
        selection.setSelectedEdgeIds(new Set());
        selection.selectedNodeIdsRef.current = new Set();
        selection.selectedEdgeIdsRef.current = new Set();
        selection.setSelectedNodeRect(null);
        selection.setSelectedEdgePos(null);
        selection.updateSelectedNodeHalo(new Set());
        selection.updateSelectedEdgeHalo(new Set());
        selection.setSelectedSubgraphId(id);
      }
    },
  });

  // 6. Viewport Interaction State
  const [cursorMode, setCursorMode] = useState<CursorMode>('select');
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [dragLine, setDragLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredNodeRect, setHoveredNodeRect] = useState<Rect | null>(null);
  const [hoveredNodeKind, setHoveredNodeKind] = useState<'start' | 'end' | null>(null);
  const [connectingSourceKind, setConnectingSourceKind] = useState<'start' | 'end' | null>(null);
  const [showCodeDrawer, setShowCodeDrawer] = useState<boolean>(false);

  // Undo / Redo Handlers
  // Only normal + choice states carry editable text (fork/join bars and [*] do not)
  const handleStartEditingNode = useCallback(
    (nodeId: string, nodeEl: Element) => {
      if (isStateDiagram) {
        if (!stateMutations.isStateTextEditable(mutations.stateAst.states.get(nodeId))) {
          return;
        }
      }
      inlineEditing.startEditingNode(nodeId, nodeEl);
    },
    [isStateDiagram, mutations.stateAst, inlineEditing]
  );

  const canRenameSelectedState =
    !isStateDiagram ||
    (selection.selectedNodeId
      ? stateMutations.isStateTextEditable(mutations.stateAst.states.get(selection.selectedNodeId))
      : false);

  const handleUndo = useCallback(() => {
    const prevCode = undoHistory();
    if (prevCode !== null) {
      try {
        const isPrevState = detectDiagramType(prevCode) === 'stateDiagram';
        if (isPrevState) {
          mutations.setStateAst(parseMermaidStateDiagram(prevCode));
        } else {
          mutations.setAst(parseMermaidFlowchart(prevCode));
        }
        setCode(prevCode);
        mutations.setSyntaxError(null);
        onCodeChange(prevCode);
        selection.clearSelection();
        selectedStarKindRef.current = null;
        setSelectedStarKind(null);
        inlineEditing.setEditingNodeId(null);
        inlineEditing.setEditingEdgeId(null);
        inlineEditing.setEditingSubgraphId(null);
      } catch (err) {
        console.error('Failed to parse undo state:', err);
      }
    }
  }, [undoHistory, onCodeChange, mutations, selection, inlineEditing]);

  const handleRedo = useCallback(() => {
    const nextCode = redoHistory();
    if (nextCode !== null) {
      try {
        const isNextState = detectDiagramType(nextCode) === 'stateDiagram';
        if (isNextState) {
          mutations.setStateAst(parseMermaidStateDiagram(nextCode));
        } else {
          mutations.setAst(parseMermaidFlowchart(nextCode));
        }
        setCode(nextCode);
        mutations.setSyntaxError(null);
        onCodeChange(nextCode);
        selection.clearSelection();
        selectedStarKindRef.current = null;
        setSelectedStarKind(null);
        inlineEditing.setEditingNodeId(null);
        inlineEditing.setEditingEdgeId(null);
        inlineEditing.setEditingSubgraphId(null);
      } catch (err) {
        console.error('Failed to parse redo state:', err);
      }
    }
  }, [redoHistory, onCodeChange, mutations, selection, inlineEditing]);

  const handleSelectAll = useCallback(() => {
    const allNodeIds = new Set(
      Array.from(mutations.displayNodes.keys()).filter((id) => id !== '[*]')
    );
    const allEdgeIds = new Set(mutations.displayEdges.map((e) => e.id));
    selectedStarKindRef.current = null;
    setSelectedStarKind(null);
    selection.selectedNodeIdsRef.current = allNodeIds;
    selection.selectedEdgeIdsRef.current = allEdgeIds;
    selection.setSelectedNodeIds(allNodeIds);
    selection.setSelectedEdgeIds(allEdgeIds);
    selection.setSelectedSubgraphId(null);
    selection.setSelectedNodeRect(null);
    selection.setSelectedEdgePos(null);
    selection.setSelectedSubgraphRect(null);
    selection.setActiveSubgraphPopover(null);
    selection.updateSelectedNodeHalo(allNodeIds);
    selection.updateSelectedEdgeHalo(allEdgeIds);
  }, [mutations.displayNodes, mutations.displayEdges, selection]);

  // 7. Keyboard Shortcuts
  const hasActivePopovers = !!(
    selection.activeNodePopover ||
    selection.activeEdgePopover ||
    selection.activeMultiPopover ||
    selection.activeSubgraphPopover
  );
  const hasSelectedElements =
    selection.selectedNodeIds.size > 0 ||
    selection.selectedEdgeIds.size > 0 ||
    !!selection.selectedSubgraphId;

  const { isSpacePressed } = useCanvasShortcuts({
    setCursorMode,
    handleUndo,
    handleRedo,
    handleSelectAll,
    handleDuplicateSelected: mutations.handleDuplicateSelected,
    handleCopySelected: mutations.handleCopySelected,
    handlePasteSelected: mutations.handlePasteSelected,
    handleBatchDeleteSelected: mutations.handleBatchDeleteSelected,
    clearSelection: selection.clearSelection,
    hasActivePopovers,
    clearActivePopovers: () => {
      selection.setActiveNodePopover(null);
      selection.setActiveEdgePopover(null);
      selection.setActiveMultiPopover(null);
      selection.setActiveSubgraphPopover(null);
    },
    hasSelectedElements,
    canCopy: selection.selectedNodeIds.size > 0,
  });

  // Attach interactive SVG listeners
  const setupSvg = useCallback(() => {
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    setupSvgInteractivity({
      mountEl,
      displayNodes: mutations.displayNodes,
      displayEdges: mutations.displayEdges,
      displaySubgraphs: mutations.displaySubgraphs,
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
        // Track which [*] anchor (start vs end) was clicked — they share id "[*]" but have distinct visuals.
        const starKindForTarget =
          targetNodeId === '[*]'
            ? ((htmlEl.getAttribute('data-mermaid-start-end') as 'start'|'end'|null) ||
               (htmlEl.getAttribute('id')?.includes('root_start') ? 'start' : htmlEl.getAttribute('id')?.includes('root_end') ? 'end' : null))
            : null;
        if (targetNodeId === '[*]' && starKindForTarget) {
          selectedStarKindRef.current = starKindForTarget;
          setSelectedStarKind(starKindForTarget);
        } else if (targetNodeId !== '[*]') {
          selectedStarKindRef.current = null;
          setSelectedStarKind(null);
        }

        if (isMulti) {
          // Start/end anchors ([*]) are single-select only — never part of a multi-select group.
          if (targetNodeId === '[*]') {
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
          // Drop any existing [*] from the multi-set before toggling.
          const next = new Set(Array.from(prev).filter((id) => id !== '[*]'));
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
          if (targetNodeId === '[*]' && starKindForTarget) {
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
  }, [mutations.displayNodes, mutations.displayEdges, mutations.displaySubgraphs, getLocalRect, selection, inlineEditing, handleStartEditingNode]);

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
  const subgraphsRef = useRef(mutations.displaySubgraphs);
  subgraphsRef.current = mutations.displaySubgraphs;

  // Render SVG
  useEffect(() => {
    const mountEl = svgMountRef.current;
    if (!mountEl) return;

    const ticket = ++renderTicketRef.current;

    renderMermaidSvg(app, code)
      .then((svgHtml) => {
        if (ticket !== renderTicketRef.current) return;
        mountEl.innerHTML = svgHtml;
        mutations.setSyntaxError(null);

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
        mutations.setSyntaxError(err?.message || 'Diagram syntax error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, app]);

  // Canvas Mouse Event Handlers
  const handleStartConnect = (
    e: React.MouseEvent,
    startX: number,
    startY: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hoveredNodeId) return;
    // End anchors have no outgoing transitions.
    if (hoveredNodeId === '[*]' && hoveredNodeKind === 'end') return;

    setConnectingSourceId(hoveredNodeId);
    setConnectingSourceKind(hoveredNodeKind);
    setDragLine({
      x1: startX,
      y1: startY,
      x2: startX,
      y2: startY,
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('.nodrag') ||
      (e.target as HTMLElement).closest('.mermaid-action-hud') ||
      (e.target as HTMLElement).closest('.mermaid-multiselect-hud') ||
      (e.target as HTMLElement).closest('.mermaid-connection-handle')
    ) {
      return;
    }

    const isMiddleClick = e.button === 1;
    const isHandModeActive = cursorMode === 'hand' || isSpacePressed || isMiddleClick;

    if (isHandModeActive) {
      startPan(e.clientX, e.clientY);
      return;
    }

    if (e.button === 0) {
      marquee.startMarquee(e.clientX, e.clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      updatePan(e.clientX, e.clientY);
      return;
    }

    if (connectingSourceId && worldRef.current) {
      const worldRect = worldRef.current.getBoundingClientRect();
      const currentWorldX = (e.clientX - worldRect.left) / zoom;
      const currentWorldY = (e.clientY - worldRect.top) / zoom;
      setDragLine((prev) =>
        prev
          ? {
              ...prev,
              x2: currentWorldX,
              y2: currentWorldY,
            }
          : null
      );
      return;
    }

    const isMarquee = marquee.updateMarquee(
      e.clientX,
      e.clientY,
      mutations.displayNodes,
      mutations.displayEdges
    );

    if (!isMarquee && hoveredNodeId && hoveredNodeRect && worldRef.current && !connectingSourceId) {
      const worldRect = worldRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - worldRect.left) / zoom;
      const mouseY = (e.clientY - worldRect.top) / zoom;
      const pad = 24;
      const withinX =
        mouseX >= hoveredNodeRect.x - pad &&
        mouseX <= hoveredNodeRect.x + hoveredNodeRect.width + pad + 24;
      const withinY =
        mouseY >= hoveredNodeRect.y - pad &&
        mouseY <= hoveredNodeRect.y + hoveredNodeRect.height + pad + 24;

      if (!withinX || !withinY) {
        setHoveredNodeId(null);
        setHoveredNodeRect(null);
        setHoveredNodeKind(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    endPan();

    if (marquee.dragBoxStartRef.current) {
      marquee.endMarquee(mutations.displayNodes, mutations.displayEdges);
    }

    if (connectingSourceId) {
      const targetNodeEl = (e.target as HTMLElement).closest(
        '[data-mermaid-node-id]'
      ) as HTMLElement | null;
      const targetNodeId = targetNodeEl?.getAttribute('data-mermaid-node-id');
      const targetKind = targetNodeEl?.getAttribute('data-mermaid-start-end') as
        | 'start'
        | 'end'
        | null;

      const targetEdgeEl = (e.target as HTMLElement).closest(
        '[data-mermaid-edge-id]'
      ) as HTMLElement | null;
      const targetEdgeId = targetEdgeEl?.getAttribute('data-mermaid-edge-id');

      // Directional guard for start/end anchors.
      const srcIsStart = connectingSourceId === '[*]' && connectingSourceKind === 'start';
      const srcIsEnd = connectingSourceId === '[*]' && connectingSourceKind === 'end';
      const tgtIsStart = targetNodeId === '[*]' && targetKind === 'start';
      const tgtIsEnd = targetNodeId === '[*]' && targetKind === 'end';

      // [*]-->[*] (start→end) is never a real edge, and no edge should
      // enter a start or leave an end.
      const isBlockedAnchorEdge =
        (targetNodeId === '[*]' && connectingSourceId === '[*]') ||
        srcIsEnd ||
        tgtIsStart ||
        (isStateDiagram && targetNodeId === '[*]' && !tgtIsEnd) ||
        (isStateDiagram && connectingSourceId === '[*]' && !srcIsStart);

      if (targetNodeId && targetNodeId !== connectingSourceId && !isBlockedAnchorEdge) {
        if (isStateDiagram) {
          mutations.applyStateAstMutation((a) => {
            stateMutations.connectStates(a, connectingSourceId, targetNodeId);
          }, connectingSourceId);
        } else {
          mutations.applyAstMutation((a) => {
            connectNodes(a, connectingSourceId, targetNodeId);
          }, connectingSourceId);
        }
      } else if (targetEdgeId) {
        let createdNodeId: string | null = null;
        if (isStateDiagram) {
          mutations.applyStateAstMutation((a) => {
            const tr = a.transitions.find((t) => t.id === targetEdgeId);
            if (tr) {
              const newStateId = stateMutations.addState(a, 'New State');
              createdNodeId = newStateId;
              const oldTo = tr.to;
              const oldLabel = tr.label;
              tr.to = newStateId;
              delete tr.label;
              stateMutations.connectStates(a, newStateId, oldTo, oldLabel);
            }
          });
        } else {
          mutations.applyAstMutation((a) => {
            const res = insertNodeOnEdge(a, targetEdgeId, 'New Step');
            if (res) createdNodeId = res.nodeId;
          });
        }
        if (createdNodeId) selection.setSelectedNodeId(createdNodeId);
      }

      setConnectingSourceId(null);
      setConnectingSourceKind(null);
      setDragLine(null);
    }
  };

  return (
    <div
      className={`mermaid-native-editor-root is-mode-${cursorMode} ${
        isPanning ? 'is-panning' : ''
      } ${isSpacePressed ? 'is-space-held' : ''}`}
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (!connectingSourceId) {
          setHoveredNodeId(null);
          setHoveredNodeRect(null);
          setHoveredNodeKind(null);
        }
      }}
      onClick={() => {
        if (marquee.isMarqueeActiveRef.current) return;
        selection.clearSelection();
        selectedStarKindRef.current = null;
        setSelectedStarKind(null);
        inlineEditing.setEditingNodeId(null);
        inlineEditing.setEditingEdgeId(null);
        inlineEditing.setEditingSubgraphId(null);
      }}
    >
      {/* Top Controls Bar */}
      <CanvasTopBar
        diagramType={diagramType}
        diagramDisplayName={isStateDiagram ? 'State Diagram' : 'Flowchart'}
        cursorMode={cursorMode}
        onSetCursorMode={setCursorMode}
        onAddStep={mutations.handleAddStandaloneStep}
        onAddStart={isStateDiagram ? mutations.handleAddStartState : undefined}
        onAddEnd={isStateDiagram ? mutations.handleAddEndState : undefined}
        canAddStart={isStateDiagram ? !mutations.hasStartState : true}
        canAddEnd={isStateDiagram ? !mutations.hasEndState : true}
        onAddGroup={mutations.handleAddGroup}
        direction={mutations.displayDirection}
        onToggleDirection={mutations.handleToggleDirection}
        onFitView={handleFitView}
        showCodeDrawer={showCodeDrawer}
        onToggleCodeDrawer={() => setShowCodeDrawer(!showCodeDrawer)}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Interactive World Canvas */}
      <div
        className="mermaid-native-world"
        ref={worldRef}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Native Mermaid SVG Output */}
        <div className="mermaid-native-svg-mount mermaid" ref={svgMountRef} />

        {/* Interactive Overlay Layer */}
        <CanvasOverlays
          dragLine={dragLine}
          selectionBox={marquee.selectionBox}
          hoveredNodeRect={hoveredNodeRect}
          isLR={selection.isLR}
          cursorMode={cursorMode}
          isSpacePressed={isSpacePressed}
          connectHandleHidden={hoveredNodeId === '[*]' && hoveredNodeKind === 'end'}
          onStartConnect={handleStartConnect}

          multiSelectBounds={selection.multiSelectBounds}
          isMultiSelect={selection.isMultiSelect}
          selectedNodeIds={selection.selectedNodeIds}
          selectedEdgeIds={selection.selectedEdgeIds}
          activeMultiPopover={selection.activeMultiPopover}
          onToggleMultiPopover={(popover) =>
            selection.setActiveMultiPopover((prev) => (prev === popover ? null : popover))
          }
          onBatchDelete={mutations.handleBatchDeleteSelected}
          onBatchGroup={mutations.handleBatchGroupSelected}
          canUngroup={
            isStateDiagram
              ? Array.from(selection.selectedNodeIds).some(
                  (nid) => !!mutations.stateAst.states.get(nid)?.compositeId
                )
              : Array.from(selection.selectedNodeIds).some(
                  (nid) => !!mutations.ast.nodes.get(nid)?.subgraphId
                )
          }
          onBatchUngroup={mutations.handleBatchUngroupSelected}
          onBatchUpdateEdgeType={mutations.handleBatchUpdateEdgeType}

          selectedNodeRect={selection.selectedNodeRect}
          selectedNodeId={selection.selectedNodeId}
          sproutX={selection.sproutX}
          sproutY={selection.sproutY}
          currentNode={
            selection.selectedNodeId
              ? mutations.displayNodes.get(selection.selectedNodeId)
              : undefined
          }
          currentStyle={
            selection.selectedNodeId
              ? isStateDiagram
                ? mutations.stateAst.states.get(selection.selectedNodeId)?.style
                : mutations.ast.nodes.get(selection.selectedNodeId)?.style
              : undefined
          }
          activeNodePopover={selection.activeNodePopover}
          onSproutNextStep={mutations.handleSproutNextStep}
          onStartEditingNode={(nodeId) => {
            const el = svgMountRef.current?.querySelector(
              `[data-mermaid-node-id="${nodeId}"]`
            );
            if (el) handleStartEditingNode(nodeId, el);
          }}
          onToggleNodePopover={(popover) =>
            selection.setActiveNodePopover((prev) => (prev === popover ? null : popover))
          }
          onDeleteNode={mutations.handleDeleteSelectedNode}
          canRenameState={canRenameSelectedState}
          diagramType={diagramType}
          stateType={
            selection.selectedNodeId && isStateDiagram
              ? mutations.stateAst.states.get(selection.selectedNodeId)?.stateType
              : undefined
          }

          popoverPos={selection.popoverPos}
          astNodes={mutations.ast.nodes}
          onSelectShape={(shape) => {
            if (selection.isMultiSelect) mutations.handleBatchUpdateShape(shape);
            else mutations.handleUpdateNodeShape(shape);
          }}
          currentState={
            selection.selectedNodeId && isStateDiagram
              ? mutations.stateAst.states.get(selection.selectedNodeId)
              : undefined
          }
          onSelectStateType={(stateType) => {
            if (selection.isMultiSelect) mutations.handleBatchUpdateStateType(stateType);
            else mutations.handleUpdateStateType(stateType);
          }}
          onApplyNodePreset={
            selection.isMultiSelect
              ? mutations.handleBatchApplyThemePreset
              : mutations.handleApplyNodePreset
          }
          onUpdateCustomStyle={
            selection.isMultiSelect
              ? mutations.handleBatchUpdateCustomStyle
              : mutations.handleUpdateCustomStyle
          }
          onClearNodeStyle={
            selection.isMultiSelect
              ? mutations.handleBatchClearStyle
              : mutations.handleClearNodeStyle
          }

          selectedEdgePos={selection.selectedEdgePos}
          selectedEdgeId={selection.selectedEdgeId}
          selectedEdgeStyle={
            selection.selectedEdgeId
              ? isStateDiagram
                ? mutations.stateAst.transitions.find((t) => t.id === selection.selectedEdgeId)?.style
                : mutations.ast.edges.find((e) => e.id === selection.selectedEdgeId)?.style
              : undefined
          }
          activeEdgePopover={selection.activeEdgePopover}
          onChangeEdgeType={mutations.handleChangeEdgeType}
          onReverseEdge={mutations.handleReverseEdge}
          onInsertNodeOnEdge={mutations.handleInsertNodeOnEdge}
          onUpdateEdgeLabel={mutations.handleUpdateEdgeLabel}
          onToggleEdgeStyle={() =>
            selection.setActiveEdgePopover((prev) => (prev === 'style' ? null : 'style'))
          }
          onDeleteEdge={mutations.handleDeleteSelectedEdge}
          onApplyEdgePreset={mutations.handleApplyEdgePreset}
          onUpdateEdgeCustomStyle={mutations.handleUpdateEdgeCustomStyle}
          onClearEdgeStyle={mutations.handleClearEdgeStyle}

          selectedSubgraphRect={selection.selectedSubgraphRect}
          selectedSubgraphId={selection.selectedSubgraphId}
          displaySubgraphs={mutations.displaySubgraphs}
          selectedSubgraphStyle={
            selection.selectedSubgraphId
              ? isStateDiagram
                ? mutations.stateAst.compositeStates.get(selection.selectedSubgraphId)?.style
                : mutations.ast.subgraphs.get(selection.selectedSubgraphId)?.style
              : undefined
          }
          activeSubgraphPopover={selection.activeSubgraphPopover}
          onToggleSubgraphStyle={() =>
            selection.setActiveSubgraphPopover((prev) => (prev === 'style' ? null : 'style'))
          }
          onStartEditingSubgraph={(subId) => {
            const subEl = svgMountRef.current?.querySelector(
              `[data-mermaid-subgraph-id="${subId}"]`
            );
            if (subEl) {
              inlineEditing.startEditingSubgraph(subId, subEl);
            } else if (selection.selectedSubgraphRect) {
              inlineEditing.startEditingSubgraph(subId, svgMountRef.current!);
            }
          }}
          onDissolveSubgraph={mutations.handleDissolveSubgraph}
          onDeleteSubgraphAll={mutations.handleDeleteSubgraphAll}
          subgraphPopoverPos={selection.subgraphPopoverPos}
          onApplySubgraphPreset={mutations.handleApplySubgraphPreset}
          onUpdateSubgraphCustomStyle={mutations.handleUpdateSubgraphCustomStyle}
          onClearSubgraphStyle={mutations.handleClearSubgraphStyle}
          unmatchedSubgraphIds={selection.unmatchedSubgraphIds}
          onSelectUnmatchedSubgraph={(subId, idx) => {
            selection.setSelectedNodeIds(new Set());
            selection.setSelectedEdgeIds(new Set());
            selection.selectedNodeIdsRef.current = new Set();
            selection.selectedEdgeIdsRef.current = new Set();
            selection.setSelectedNodeRect(null);
            selection.setSelectedEdgePos(null);
            selection.setActiveNodePopover(null);
            selection.setActiveEdgePopover(null);
            selection.setActiveMultiPopover(null);
            selection.setActiveSubgraphPopover(null);
            selection.updateSelectedNodeHalo(new Set());
            selection.updateSelectedEdgeHalo(new Set());
            selection.setSelectedSubgraphId(subId);
            selection.setSelectedSubgraphRect({
              x: 24,
              y: 52 + idx * 4,
              width: 200,
              height: 30,
            });
          }}
          currentSubgraphId={
            selection.selectedNodeId
              ? isStateDiagram
                ? mutations.stateAst.states.get(selection.selectedNodeId)?.compositeId
                : mutations.ast.nodes.get(selection.selectedNodeId)?.subgraphId
              : undefined
          }
          onSelectSubgraphMembership={(subId) => {
            if (selection.selectedNodeId) {
              mutations.handleMoveNodeToSubgraph(selection.selectedNodeId, subId);
            }
            selection.setActiveNodePopover(null);
          }}
          onCreateNewGroupMembership={() => {
            if (selection.selectedNodeId) {
              mutations.handleCreateGroupWithNode(selection.selectedNodeId);
            }
            selection.setActiveNodePopover(null);
          }}
          onCloseSubgraphMembership={() => selection.setActiveNodePopover(null)}

          editingNodeId={inlineEditing.editingNodeId}
          editingPos={inlineEditing.editingPos}
          editNodeLabel={inlineEditing.editNodeLabel}
          onEditNodeLabelChange={inlineEditing.setEditNodeLabel}
          onFinishEditingNode={inlineEditing.handleFinishEditingNode}
          onCancelEditingNode={inlineEditing.cancelEditingNode}

          editingEdgeId={inlineEditing.editingEdgeId}
          editingEdgePos={inlineEditing.editingEdgePos}
          editEdgeLabel={inlineEditing.editEdgeLabel}
          onEditEdgeLabelChange={inlineEditing.setEditEdgeLabel}
          onFinishEditingEdge={inlineEditing.handleFinishEditingEdge}
          onCancelEditingEdge={inlineEditing.cancelEditingEdge}

          editingSubgraphId={inlineEditing.editingSubgraphId}
          editingSubgraphPos={inlineEditing.editingSubgraphPos}
          editSubgraphLabel={inlineEditing.editSubgraphLabel}
          onEditSubgraphLabelChange={inlineEditing.setEditSubgraphLabel}
          onFinishEditingSubgraph={inlineEditing.handleFinishEditingSubgraph}
          onCancelEditingSubgraph={inlineEditing.cancelEditingSubgraph}
        />
      </div>

      {/* Slide-out Mermaid Code Syntax Drawer */}
      <SyntaxDrawer
        isOpen={showCodeDrawer}
        code={code}
        syntaxError={mutations.syntaxError}
        onClose={() => setShowCodeDrawer(false)}
        onChangeCode={(newCode) => {
          setCode(newCode);
          onCodeChange(newCode);
          try {
            const detected = detectDiagramType(newCode);
            if (detected === 'stateDiagram') {
              const parsed = parseMermaidStateDiagram(newCode);
              mutations.setStateAst(parsed);
            } else {
              const parsed = parseMermaidFlowchart(newCode);
              mutations.setAst(parsed);
            }
            mutations.setSyntaxError(null);
          } catch (err: any) {
            mutations.setSyntaxError(err.message || 'Syntax Error');
          }
        }}
      />
    </div>
  );
};
