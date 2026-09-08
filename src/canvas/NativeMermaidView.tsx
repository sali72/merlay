/**
 * Native Mermaid View with Direct Structural Manipulation Overlay
 * Renders Obsidian's exact native Mermaid SVG (100% parity, zero layout simulation)
 * with direct-manipulation node sprouting, drag-to-connect, inline label editing, and camera stabilization.
 * All diagram-specific behavior comes from the DiagramDriver — no type branching here.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { detectDiagramType } from '../diagrams/registry';
import { CursorMode, NativeMermaidViewProps } from './types';
import { useHistory } from './useHistory';

import { useCanvasCamera } from './hooks/useCanvasCamera';
import { useCanvasSelection } from './hooks/useCanvasSelection';
import { useMarqueeSelection } from './hooks/useMarqueeSelection';
import { useInlineEditing } from './hooks/useInlineEditing';
import { useDiagramAst } from './hooks/mutations/useDiagramAst';
import { useDiagramMutations } from './hooks/useDiagramMutations';
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts';
import { useCanvasMouseInteractions } from './hooks/useCanvasMouseInteractions';
import { useCanvasRenderer } from './hooks/useCanvasRenderer';

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
  const diagramType = useMemo<ReturnType<typeof detectDiagramType>>(
    () => detectDiagramType(code),
    [code]
  );

  // History Stack
  const history = useHistory(code);
  const pushHistoryState = history.pushState;
  const undoHistory = history.undo;
  const redoHistory = history.redo;

  // Primary Canvas DOM Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const svgMountRef = useRef<HTMLDivElement>(null);

  // 1. Camera & Viewport
  const {
    zoom,
    pan,
    isPanning,
    zoomRef,
    getLocalRect,
    pinNodeForCamera,
    stabilizeCamera,
    handleWheel,
    handleFitView,
    startPan,
    updatePan,
    endPan,
  } = useCanvasCamera({ worldRef, svgMountRef });

  // 2. AST State & Driver Projections (single active AST owned by the driver)
  const astHook = useDiagramAst({
    code,
    setCode,
    onCodeChange,
    pushHistoryState,
    diagramType,
    pinNodeForCamera,
  });
  const driver = astHook.driver;

  const [selectedStarKind, setSelectedStarKind] = useState<'start' | 'end' | null>(null);
  const selectedStarKindRef = useRef<'start' | 'end' | null>(null);
  useEffect(() => {
    selectedStarKindRef.current = selectedStarKind;
  }, [selectedStarKind]);

  // 3. Selection & Halos
  const selection = useCanvasSelection({
    svgMountRef,
    getLocalRect,
    displayDirection: astHook.displayDirection,
    selectedStarKind,
  });

  // 4. Diagram Mutations (driver-dispatched)
  const mutations = useDiagramMutations({
    astHook,
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

  // 5. Marquee Selection
  const marquee = useMarqueeSelection({
    worldRef,
    svgMountRef,
    zoomRef,
    getLocalRect,
    onSelectionChange: (nodes, edges) => {
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

  // 6. Inline Text Editing
  const inlineEditing = useInlineEditing({
    displayNodes: mutations.displayNodes,
    displayEdges: mutations.displayEdges,
    displaySubgraphs: mutations.displaySubgraphs,
    getLocalRect,
    onCommitNodeLabel: (nodeId, newLabel) => {
      mutations.applyMutation(
        (a) => {
          driver.mutations.updateNodeLabel(a, nodeId, newLabel);
        },
        nodeId
      );
    },
    onCommitEdgeLabel: mutations.handleUpdateEdgeLabel,
    onCommitSubgraphLabel: mutations.handleRenameSubgraph,
    onClearOtherSelections: selection.isolateSelection,
  });

  // 7. Viewport Modes & State
  const [cursorMode, setCursorMode] = useState<CursorMode>('select');
  const [showCodeDrawer, setShowCodeDrawer] = useState<boolean>(false);

  const handleStartEditingNode = useCallback(
    (nodeId: string, nodeEl: Element) => {
      if (!driver.mutations.isNodeTextEditable(astHook.ast, nodeId)) {
        return;
      }
      inlineEditing.startEditingNode(nodeId, nodeEl);
    },
    [driver, astHook.ast, inlineEditing]
  );

  const canRenameSelectedNode = selection.selectedNodeId
    ? driver.mutations.isNodeTextEditable(astHook.ast, selection.selectedNodeId)
    : false;

  const resetTransientUiState = useCallback(() => {
    selection.clearSelection();
    selectedStarKindRef.current = null;
    setSelectedStarKind(null);
    inlineEditing.setEditingNodeId(null);
    inlineEditing.setEditingEdgeId(null);
    inlineEditing.setEditingSubgraphId(null);
  }, [selection, inlineEditing]);

  const handleUndo = useCallback(() => {
    const prevCode = undoHistory();
    if (prevCode === null) return;
    // setCode triggers the re-parse effect inside useDiagramAst
    setCode(prevCode);
    mutations.setSyntaxError(null);
    onCodeChange(prevCode);
    resetTransientUiState();
  }, [undoHistory, onCodeChange, mutations, resetTransientUiState]);

  const handleRedo = useCallback(() => {
    const nextCode = redoHistory();
    if (nextCode === null) return;
    setCode(nextCode);
    mutations.setSyntaxError(null);
    onCodeChange(nextCode);
    resetTransientUiState();
  }, [redoHistory, onCodeChange, mutations, resetTransientUiState]);

  const handleSelectAll = useCallback(() => {
    const anchors = driver.mutations.anchors;
    const allNodeIds = new Set(
      Array.from(mutations.displayNodes.keys()).filter(
        (id) => !(anchors && anchors.isAnchor(id))
      )
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
  }, [driver, mutations.displayNodes, mutations.displayEdges, selection]);

  // 8. Keyboard Shortcuts
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

  // 9. Mouse Interactions (Panning, Connecting, Hover)
  const mouse = useCanvasMouseInteractions({
    worldRef,
    zoom,
    cursorMode,
    isSpacePressed,
    isPanning,
    startPan,
    updatePan,
    endPan,
    marquee,
    displayNodes: mutations.displayNodes,
    displayEdges: mutations.displayEdges,
    displaySubgraphs: mutations.displaySubgraphs,
    driver,
    applyMutation: mutations.applyMutation,
    setSelectedNodeId: selection.setSelectedNodeId,
  });

  // 10. Mermaid Native SVG Mount & Renderer
  useCanvasRenderer({
    app,
    code,
    driver,
    svgMountRef,
    displayNodes: mutations.displayNodes,
    displayEdges: mutations.displayEdges,
    displaySubgraphs: mutations.displaySubgraphs,
    getLocalRect,
    selection,
    selectedStarKindRef,
    setSelectedStarKind,
    inlineEditing,
    handleStartEditingNode,
    setHoveredNodeId: mouse.setHoveredNodeId,
    setHoveredNodeRect: mouse.setHoveredNodeRect,
    setHoveredNodeKind: mouse.setHoveredNodeKind,
    stabilizeCamera,
    setSyntaxError: mutations.setSyntaxError,
  });

  return (
    <div
      className={`mermaid-native-editor-root is-mode-${cursorMode} ${
        isPanning ? 'is-panning' : ''
      } ${isSpacePressed ? 'is-space-held' : ''}`}
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={mouse.handleMouseDown}
      onMouseMove={mouse.handleMouseMove}
      onMouseUp={mouse.handleMouseUp}
      onMouseLeave={() => {
        if (!mouse.connectingSourceId) {
          mouse.setHoveredNodeId(null);
          mouse.setHoveredNodeRect(null);
          mouse.setHoveredNodeKind(null);
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
        driver={driver}
        cursorMode={cursorMode}
        onSetCursorMode={setCursorMode}
        onAddStep={mutations.handleAddStandaloneStep}
        onAddStart={mutations.handleAddStartState}
        onAddEnd={mutations.handleAddEndState}
        canAddStart={!mutations.hasStartState}
        canAddEnd={!mutations.hasEndState}
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
          mouse={mouse}
          marquee={marquee}
          selection={selection}
          mutations={mutations}
          inlineEditing={inlineEditing}
          cursorMode={cursorMode}
          isSpacePressed={isSpacePressed}
          canRenameSelectedNode={canRenameSelectedNode}
          svgMountRef={svgMountRef}
          handleStartEditingNode={handleStartEditingNode}
        />
      </div>

      {/* Slide-out Mermaid Code Syntax Drawer */}
      <SyntaxDrawer
        isOpen={showCodeDrawer}
        code={code}
        syntaxError={mutations.syntaxError}
        onClose={() => setShowCodeDrawer(false)}
        onChangeCode={(newCode) => {
          // setCode triggers the re-parse effect inside useDiagramAst,
          // which also surfaces syntax errors.
          setCode(newCode);
          onCodeChange(newCode);
        }}
      />
    </div>
  );
};
