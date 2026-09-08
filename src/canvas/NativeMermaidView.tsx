/**
 * Native Mermaid View with Direct Structural Manipulation Overlay
 * Renders Obsidian's exact native Mermaid SVG (100% parity, zero layout simulation)
 * with direct-manipulation node sprouting, drag-to-connect, inline label editing, and camera stabilization.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { parseMermaidFlowchart } from '../ast/parser';
import { detectDiagramType } from '../diagrams/registry';
import { SupportedDiagramType } from '../diagrams/types';
import { parseMermaidStateDiagram } from '../diagrams/state/parser';
import * as stateMutations from '../diagrams/state/mutations';
import { CursorMode, NativeMermaidViewProps } from './types';
import { useHistory } from './useHistory';

import { useCanvasCamera } from './hooks/useCanvasCamera';
import { useCanvasSelection } from './hooks/useCanvasSelection';
import { useMarqueeSelection } from './hooks/useMarqueeSelection';
import { useInlineEditing } from './hooks/useInlineEditing';
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
        mutations.applyAstMutation(() => {
          mutations.handleUpdateNodeShape(
            mutations.displayNodes.get(nodeId)?.shape || 'rectangle',
            nodeId
          );
        }, nodeId);
      }
    },
    onCommitEdgeLabel: mutations.handleUpdateEdgeLabel,
    onCommitSubgraphLabel: mutations.handleRenameSubgraph,
    onClearOtherSelections: selection.isolateSelection,
  });

  // 6. Viewport Modes & State
  const [cursorMode, setCursorMode] = useState<CursorMode>('select');
  const [showCodeDrawer, setShowCodeDrawer] = useState<boolean>(false);

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

  // 8. Mouse Interactions (Panning, Connecting, Hover)
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
    isStateDiagram,
    applyAstMutation: mutations.applyAstMutation,
    applyStateAstMutation: mutations.applyStateAstMutation,
    setSelectedNodeId: selection.setSelectedNodeId,
  });

  // 9. Mermaid Native SVG Mount & Renderer
  useCanvasRenderer({
    app,
    code,
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
          mouse={mouse}
          marquee={marquee}
          selection={selection}
          mutations={mutations}
          inlineEditing={inlineEditing}
          cursorMode={cursorMode}
          isSpacePressed={isSpacePressed}
          diagramType={diagramType}
          isStateDiagram={isStateDiagram}
          canRenameSelectedState={canRenameSelectedState}
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
