/**
 * Canvas Overlays Manager
 * Composes dedicated overlay layers: Connection, MultiSelect, Node, Edge, Subgraph, and Inline Editing.
 */

import React from 'react';
import { CursorMode, SelectionBox } from '../types';
import { SupportedDiagramType } from '../../diagrams/types';
import { useCanvasSelection } from '../hooks/useCanvasSelection';
import { useDiagramMutations } from '../hooks/useDiagramMutations';
import { useInlineEditing } from '../hooks/useInlineEditing';
import { useCanvasMouseInteractions } from '../hooks/useCanvasMouseInteractions';

import { ConnectionLine } from './ConnectionLine';
import { SelectionMarquee } from './SelectionMarquee';
import { ConnectionHandle } from './ConnectionHandle';
import { NodeOverlays } from '../overlays/NodeOverlays';
import { EdgeOverlays } from '../overlays/EdgeOverlays';
import { SubgraphOverlays } from '../overlays/SubgraphOverlays';
import { MultiSelectOverlays } from '../overlays/MultiSelectOverlays';
import { InlineEditOverlays } from '../overlays/InlineEditOverlays';

export interface CanvasOverlaysProps {
  mouse: ReturnType<typeof useCanvasMouseInteractions>;
  marquee: { selectionBox: SelectionBox | null };
  selection: ReturnType<typeof useCanvasSelection>;
  mutations: ReturnType<typeof useDiagramMutations>;
  inlineEditing: ReturnType<typeof useInlineEditing>;
  cursorMode: CursorMode;
  isSpacePressed: boolean;
  diagramType: SupportedDiagramType;
  isStateDiagram: boolean;
  canRenameSelectedState?: boolean;
  svgMountRef: React.RefObject<HTMLDivElement>;
  handleStartEditingNode: (nodeId: string, nodeEl: Element) => void;
}

export const CanvasOverlays: React.FC<CanvasOverlaysProps> = ({
  mouse,
  marquee,
  selection,
  mutations,
  inlineEditing,
  cursorMode,
  isSpacePressed,
  diagramType,
  isStateDiagram,
  canRenameSelectedState,
  svgMountRef,
  handleStartEditingNode,
}) => {
  const { selectedNodeId, selectedEdgeId, selectedSubgraphId } = selection;

  const canUngroup = isStateDiagram
    ? Array.from(selection.selectedNodeIds).some(
        (nid) => !!mutations.stateAst.states.get(nid)?.compositeId
      )
    : Array.from(selection.selectedNodeIds).some(
        (nid) => !!mutations.ast.nodes.get(nid)?.subgraphId
      );

  const selectedNodeStyle = selectedNodeId
    ? isStateDiagram
      ? mutations.stateAst.states.get(selectedNodeId)?.style
      : mutations.ast.nodes.get(selectedNodeId)?.style
    : undefined;

  const selectedEdgeStyle = selectedEdgeId
    ? isStateDiagram
      ? mutations.stateAst.transitions.find((t) => t.id === selectedEdgeId)?.style
      : mutations.ast.edges.find((e) => e.id === selectedEdgeId)?.style
    : undefined;

  const selectedSubgraphStyle = selectedSubgraphId
    ? isStateDiagram
      ? mutations.stateAst.compositeStates.get(selectedSubgraphId)?.style
      : mutations.ast.subgraphs.get(selectedSubgraphId)?.style
    : undefined;

  return (
    <div className="mermaid-native-overlay">
      {/* Connection Dragging SVG Line */}
      <ConnectionLine dragLine={mouse.dragLine} />

      {/* Marquee Drag Selection Box */}
      <SelectionMarquee box={marquee.selectionBox} />

      {/* Node Connection Handle */}
      <ConnectionHandle
        hoveredNodeRect={mouse.hoveredNodeRect}
        isLR={selection.isLR}
        cursorMode={cursorMode}
        isSpacePressed={isSpacePressed}
        hidden={mouse.hoveredNodeId === '[*]' && mouse.hoveredNodeKind === 'end'}
        onStartConnect={mouse.handleStartConnect}
      />

      {/* Multi-Select Layer */}
      <MultiSelectOverlays
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
        canUngroup={canUngroup}
        onBatchUngroup={mutations.handleBatchUngroupSelected}
        isStateDiagram={isStateDiagram}
        popoverPos={selection.popoverPos}
        onBatchUpdateEdgeType={mutations.handleBatchUpdateEdgeType}
        astNodes={mutations.ast.nodes}
        onSelectShape={mutations.handleBatchUpdateShape}
        onSelectStateType={mutations.handleBatchUpdateStateType}
        onApplyPreset={mutations.handleBatchApplyThemePreset}
        onUpdateCustomStyle={mutations.handleBatchUpdateCustomStyle}
        onClearStyle={mutations.handleBatchClearStyle}
      />

      {/* Single Node Layer */}
      <NodeOverlays
        selectedNodeRect={selection.selectedNodeRect}
        selectedNodeId={selectedNodeId}
        isMultiSelect={selection.isMultiSelect}
        sproutX={selection.sproutX}
        sproutY={selection.sproutY}
        isLR={selection.isLR}
        diagramType={diagramType}
        stateType={
          selectedNodeId && isStateDiagram
            ? mutations.stateAst.states.get(selectedNodeId)?.stateType
            : undefined
        }
        currentNode={selectedNodeId ? mutations.displayNodes.get(selectedNodeId) : undefined}
        currentStyle={selectedNodeStyle}
        activeNodePopover={selection.activeNodePopover}
        onSproutNextStep={mutations.handleSproutNextStep}
        onStartEditingNode={(nodeId) => {
          const el = svgMountRef.current?.querySelector(`[data-mermaid-node-id="${nodeId}"]`);
          if (el) handleStartEditingNode(nodeId, el);
        }}
        onToggleNodePopover={(popover) =>
          selection.setActiveNodePopover((prev) => (prev === popover ? null : popover))
        }
        onDeleteNode={mutations.handleDeleteSelectedNode}
        canRenameState={canRenameSelectedState}
        popoverPos={selection.popoverPos}
        astNodes={mutations.ast.nodes}
        onSelectShape={mutations.handleUpdateNodeShape}
        currentState={
          selectedNodeId && isStateDiagram
            ? mutations.stateAst.states.get(selectedNodeId)
            : undefined
        }
        onSelectStateType={mutations.handleUpdateStateType}
        onApplyNodePreset={mutations.handleApplyNodePreset}
        onUpdateCustomStyle={mutations.handleUpdateCustomStyle}
        onClearNodeStyle={mutations.handleClearNodeStyle}
        currentSubgraphId={
          selectedNodeId
            ? isStateDiagram
              ? mutations.stateAst.states.get(selectedNodeId)?.compositeId
              : mutations.ast.nodes.get(selectedNodeId)?.subgraphId
            : undefined
        }
        displaySubgraphs={mutations.displaySubgraphs}
        onSelectSubgraphMembership={(subId) => {
          if (selectedNodeId) {
            mutations.handleMoveNodeToSubgraph(selectedNodeId, subId);
          }
          selection.setActiveNodePopover(null);
        }}
        onCreateNewGroupMembership={() => {
          if (selectedNodeId) {
            mutations.handleCreateGroupWithNode(selectedNodeId);
          }
          selection.setActiveNodePopover(null);
        }}
        onCloseSubgraphMembership={() => selection.setActiveNodePopover(null)}
      />

      {/* Single Edge Layer */}
      <EdgeOverlays
        selectedEdgePos={selection.selectedEdgePos}
        selectedEdgeId={selectedEdgeId}
        isMultiSelect={selection.isMultiSelect}
        selectedEdgeStyle={selectedEdgeStyle}
        activeEdgePopover={selection.activeEdgePopover}
        onChangeEdgeType={mutations.handleChangeEdgeType}
        onReverseEdge={mutations.handleReverseEdge}
        onInsertNodeOnEdge={mutations.handleInsertNodeOnEdge}
        onUpdateEdgeLabel={mutations.handleUpdateEdgeLabel}
        onToggleEdgeStyle={() =>
          selection.setActiveEdgePopover((prev) => (prev === 'style' ? null : 'style'))
        }
        onDeleteEdge={mutations.handleDeleteSelectedEdge}
        isStateDiagram={isStateDiagram}
        onApplyEdgePreset={mutations.handleApplyEdgePreset}
        onUpdateEdgeCustomStyle={mutations.handleUpdateEdgeCustomStyle}
        onClearEdgeStyle={mutations.handleClearEdgeStyle}
      />

      {/* Subgraph Layer */}
      <SubgraphOverlays
        selectedSubgraphRect={selection.selectedSubgraphRect}
        selectedSubgraphId={selectedSubgraphId}
        isMultiSelect={selection.isMultiSelect}
        displaySubgraphs={mutations.displaySubgraphs}
        selectedSubgraphStyle={selectedSubgraphStyle}
        activeSubgraphPopover={selection.activeSubgraphPopover}
        onToggleSubgraphStyle={() =>
          selection.setActiveSubgraphPopover((prev) => (prev === 'style' ? null : 'style'))
        }
        onStartEditingSubgraph={(subId) => {
          const subEl = svgMountRef.current?.querySelector(`[data-mermaid-subgraph-id="${subId}"]`);
          if (subEl) {
            inlineEditing.startEditingSubgraph(subId, subEl);
          } else if (selection.selectedSubgraphRect && svgMountRef.current) {
            inlineEditing.startEditingSubgraph(subId, svgMountRef.current);
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
      />

      {/* Inline Text Editors Layer */}
      <InlineEditOverlays
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
  );
};
