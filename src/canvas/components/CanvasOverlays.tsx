import React from 'react';
import {
  ActiveEdgePopover,
  ActiveMultiPopover,
  ActiveNodePopover,
  CursorMode,
  PopoverPos,
  Rect,
  SelectedEdgePos,
  SelectionBox,
} from '../types';
import { EdgeThemePreset, ThemePreset } from '../constants';
import {
  ArrowType,
  MermaidNodeDef,
  MermaidShapeType,
  MermaidSubgraphDef,
} from '../../ast/types';
import { MermaidStateDef, MermaidStateType } from '../../diagrams/state/types';
import { SupportedDiagramType } from '../../diagrams/types';

import { ConnectionLine } from './ConnectionLine';
import { SelectionMarquee } from './SelectionMarquee';
import { ConnectionHandle } from './ConnectionHandle';
import { MultiSelectHud } from './MultiSelectHud';
import { NodeActionHud } from './NodeActionHud';
import { ShapePopover } from './ShapePopover';
import { StateTypePopover } from './StateTypePopover';
import { EdgeTypePopover } from './EdgeTypePopover';
import { NodeStylePopover } from './NodeStylePopover';
import { EdgeActionHud } from './EdgeActionHud';
import { EdgeStylePopover } from './EdgeStylePopover';
import { SubgraphActionHud } from './SubgraphActionHud';
import { SubgraphPopover } from './SubgraphPopover';

export interface CanvasOverlaysProps {
  dragLine: { x1: number; y1: number; x2: number; y2: number } | null;
  selectionBox: SelectionBox | null;
  hoveredNodeRect: Rect | null;
  isLR: boolean;
  cursorMode: CursorMode;
  isSpacePressed: boolean;
  connectHandleHidden?: boolean;
  onStartConnect: (e: React.MouseEvent, startX: number, startY: number) => void;

  // Multi-Select
  multiSelectBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    topY: number;
  } | null;
  isMultiSelect: boolean;
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  activeMultiPopover: ActiveMultiPopover;
  onToggleMultiPopover: (popover: 'shape' | 'style' | 'edgeType') => void;
  onBatchDelete: () => void;
  onBatchGroup: () => void;
  canUngroup: boolean;
  onBatchUngroup: () => void;
  onBatchUpdateEdgeType: (newType: ArrowType) => void;

  // Single Node
  selectedNodeRect: Rect | null;
  selectedNodeId: string | null;
  sproutX: number;
  sproutY: number;
  currentNode: MermaidNodeDef | undefined;
  currentStyle: Record<string, string> | undefined;
  activeNodePopover: ActiveNodePopover;
  onSproutNextStep: (nodeId: string) => void;
  onStartEditingNode: (nodeId: string) => void;
  onToggleNodePopover: (popover: 'shape' | 'style' | 'subgraph') => void;
  onDeleteNode: () => void;
  diagramType: SupportedDiagramType;
  stateType: MermaidStateType | undefined;
  canRenameState?: boolean;

  // Popover Anchors
  popoverPos: PopoverPos | null;
  astNodes: Map<string, MermaidNodeDef>;
  onSelectShape: (shape: MermaidShapeType) => void;
  currentState: MermaidStateDef | undefined;
  onSelectStateType: (type: MermaidStateType) => void;
  onApplyNodePreset: (preset: ThemePreset) => void;
  onUpdateCustomStyle: (prop: string, val: string) => void;
  onClearNodeStyle: () => void;

  // Single Edge
  selectedEdgePos: SelectedEdgePos | null;
  selectedEdgeId: string | null;
  selectedEdgeStyle: Record<string, string> | undefined;
  activeEdgePopover: ActiveEdgePopover;
  onChangeEdgeType: (newType: ArrowType) => void;
  onReverseEdge: () => void;
  onInsertNodeOnEdge: (edgeId: string) => void;
  onUpdateEdgeLabel: (newLabel: string) => void;
  onToggleEdgeStyle: () => void;
  onDeleteEdge: () => void;
  onApplyEdgePreset: (preset: EdgeThemePreset) => void;
  onUpdateEdgeCustomStyle: (prop: string, val: string) => void;
  onClearEdgeStyle: () => void;

  // Subgraph
  selectedSubgraphRect: Rect | null;
  selectedSubgraphId: string | null;
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  selectedSubgraphStyle: Record<string, string> | undefined;
  activeSubgraphPopover: 'style' | null;
  onToggleSubgraphStyle: () => void;
  onStartEditingSubgraph: (subId: string) => void;
  onDissolveSubgraph: () => void;
  onDeleteSubgraphAll: () => void;
  subgraphPopoverPos: PopoverPos | null;
  onApplySubgraphPreset: (preset: ThemePreset) => void;
  onUpdateSubgraphCustomStyle: (prop: string, val: string) => void;
  onClearSubgraphStyle: () => void;
  unmatchedSubgraphIds: string[];
  onSelectUnmatchedSubgraph: (subId: string, idx: number) => void;
  currentSubgraphId: string | undefined;
  onSelectSubgraphMembership: (subId: string | null) => void;
  onCreateNewGroupMembership: () => void;
  onCloseSubgraphMembership: () => void;

  // Inline Editors
  editingNodeId: string | null;
  editingPos: Rect | null;
  editNodeLabel: string;
  onEditNodeLabelChange: (val: string) => void;
  onFinishEditingNode: () => void;
  onCancelEditingNode: () => void;

  editingEdgeId: string | null;
  editingEdgePos: Rect | null;
  editEdgeLabel: string;
  onEditEdgeLabelChange: (val: string) => void;
  onFinishEditingEdge: () => void;
  onCancelEditingEdge: () => void;

  editingSubgraphId: string | null;
  editingSubgraphPos: Rect | null;
  editSubgraphLabel: string;
  onEditSubgraphLabelChange: (val: string) => void;
  onFinishEditingSubgraph: () => void;
  onCancelEditingSubgraph: () => void;
}

export const CanvasOverlays: React.FC<CanvasOverlaysProps> = ({
  dragLine,
  selectionBox,
  hoveredNodeRect,
  isLR,
  cursorMode,
  isSpacePressed,
  connectHandleHidden = false,
  onStartConnect,

  multiSelectBounds,
  isMultiSelect,
  selectedNodeIds,
  selectedEdgeIds,
  activeMultiPopover,
  onToggleMultiPopover,
  onBatchDelete,
  onBatchGroup,
  canUngroup,
  onBatchUngroup,
  onBatchUpdateEdgeType,

  selectedNodeRect,
  selectedNodeId,
  sproutX,
  sproutY,
  currentNode,
  currentStyle,
  activeNodePopover,
  onSproutNextStep,
  onStartEditingNode,
  onToggleNodePopover,
  onDeleteNode,
  diagramType,
  stateType,
  canRenameState,

  popoverPos,
  astNodes,
  onSelectShape,
  currentState,
  onSelectStateType,
  onApplyNodePreset,
  onUpdateCustomStyle,
  onClearNodeStyle,

  selectedEdgePos,
  selectedEdgeId,
  selectedEdgeStyle,
  activeEdgePopover,
  onChangeEdgeType,
  onReverseEdge,
  onInsertNodeOnEdge,
  onUpdateEdgeLabel,
  onToggleEdgeStyle,
  onDeleteEdge,
  onApplyEdgePreset,
  onUpdateEdgeCustomStyle,
  onClearEdgeStyle,

  selectedSubgraphRect,
  selectedSubgraphId,
  displaySubgraphs,
  selectedSubgraphStyle,
  activeSubgraphPopover,
  onToggleSubgraphStyle,
  onStartEditingSubgraph,
  onDissolveSubgraph,
  onDeleteSubgraphAll,
  subgraphPopoverPos,
  onApplySubgraphPreset,
  onUpdateSubgraphCustomStyle,
  onClearSubgraphStyle,
  unmatchedSubgraphIds,
  onSelectUnmatchedSubgraph,
  currentSubgraphId,
  onSelectSubgraphMembership,
  onCreateNewGroupMembership,
  onCloseSubgraphMembership,

  editingNodeId,
  editingPos,
  editNodeLabel,
  onEditNodeLabelChange,
  onFinishEditingNode,
  onCancelEditingNode,

  editingEdgeId,
  editingEdgePos,
  editEdgeLabel,
  onEditEdgeLabelChange,
  onFinishEditingEdge,
  onCancelEditingEdge,

  editingSubgraphId,
  editingSubgraphPos,
  editSubgraphLabel,
  onEditSubgraphLabelChange,
  onFinishEditingSubgraph,
  onCancelEditingSubgraph,
}) => {
  const isStateDiagram = diagramType === 'stateDiagram';

  return (
    <div className="mermaid-native-overlay">
      {/* Connection Dragging SVG Line */}
      <ConnectionLine dragLine={dragLine} />

      {/* Marquee Drag Selection Box */}
      <SelectionMarquee box={selectionBox} />

      {/* Node Connection Handle (Downstream anchor dot) */}
      <ConnectionHandle
        hoveredNodeRect={hoveredNodeRect}
        isLR={isLR}
        cursorMode={cursorMode}
        isSpacePressed={isSpacePressed}
        hidden={connectHandleHidden}
        onStartConnect={onStartConnect}
      />

      {/* Multi-Select Floating Action HUD */}
      {multiSelectBounds && isMultiSelect && (
        <MultiSelectHud
          selectedNodeCount={selectedNodeIds.size}
          selectedEdgeCount={selectedEdgeIds.size}
          centerX={multiSelectBounds.centerX}
          topY={multiSelectBounds.topY}
          activePopover={activeMultiPopover}
          onTogglePopover={onToggleMultiPopover}
          onBatchDelete={onBatchDelete}
          onGroupSelected={onBatchGroup}
          canUngroup={canUngroup}
          onUngroupSelected={onBatchUngroup}
          isStateDiagram={isStateDiagram}
        />
      )}

      {/* Single Node Relational Sprout HUD */}
      {selectedNodeRect && selectedNodeId && !isMultiSelect && (
        <NodeActionHud
          selectedNodeId={selectedNodeId}
          sproutX={sproutX}
          sproutY={sproutY}
          isLR={isLR}
          diagramType={diagramType}
          stateType={stateType}
          currentNode={currentNode}
          currentStyle={currentStyle}
          activeNodePopover={activeNodePopover}
          onSproutNextStep={() => onSproutNextStep(selectedNodeId)}
          onRename={() => onStartEditingNode(selectedNodeId)}
          onTogglePopover={onToggleNodePopover}
          onDelete={onDeleteNode}
          canRenameState={canRenameState}
          hideSprout={isStateDiagram && selectedNodeId === '[*]'}
          hideDelete={false}
        />
      )}

      {/* Shape Popover for flowchart (supports single node or multi-select) */}
      {(activeNodePopover === 'shape' || activeMultiPopover === 'shape') &&
        !isStateDiagram &&
        popoverPos && (
          <ShapePopover
            popoverPos={popoverPos}
            selectedNodeId={selectedNodeId}
            selectedNodeIds={selectedNodeIds}
            astNodes={astNodes}
            onSelectShape={onSelectShape}
          />
        )}

      {/* State Type Popover for state diagrams (supports single state or multi-select) */}
      {(activeNodePopover === 'shape' || activeMultiPopover === 'shape') &&
        isStateDiagram &&
        popoverPos && (
          <StateTypePopover
            popoverPos={popoverPos}
            selectedStateId={selectedNodeId}
            currentState={currentState}
            onSelectStateType={onSelectStateType}
          />
        )}

      {/* Edge Type Popover for multi-select (flowchart only) */}
      {activeMultiPopover === 'edgeType' && !isStateDiagram && popoverPos && (
        <EdgeTypePopover
          popoverPos={popoverPos}
          onSelectType={onBatchUpdateEdgeType}
        />
      )}

      {/* Visual Styling Popover */}
      {(activeNodePopover === 'style' || activeMultiPopover === 'style') &&
        popoverPos && (
          <NodeStylePopover
            popoverPos={popoverPos}
            currentStyle={currentStyle}
            onApplyPreset={onApplyNodePreset}
            onUpdateCustomStyle={onUpdateCustomStyle}
            onClearStyle={onClearNodeStyle}
          />
        )}

      {/* Selected Edge HUD */}
      {selectedEdgePos && selectedEdgeId && !isMultiSelect && (
        <EdgeActionHud
          selectedEdgeId={selectedEdgeId}
          selectedEdgePos={selectedEdgePos}
          selectedEdgeStyle={selectedEdgeStyle}
          activeEdgePopover={activeEdgePopover}
          onChangeEdgeType={onChangeEdgeType}
          onReverseEdge={onReverseEdge}
          onInsertNodeOnEdge={() => onInsertNodeOnEdge(selectedEdgeId)}
          onUpdateEdgeLabel={onUpdateEdgeLabel}
          onToggleStylePopover={onToggleEdgeStyle}
          onDeleteEdge={onDeleteEdge}
          isStateDiagram={isStateDiagram}
        />
      )}

      {/* Edge Style Popover (Only for flowchart linkStyles) */}
      {activeEdgePopover === 'style' &&
        !isStateDiagram &&
        selectedEdgePos &&
        selectedEdgeId &&
        !isMultiSelect && (
          <EdgeStylePopover
            selectedEdgePos={selectedEdgePos}
            currentEdgeStyle={selectedEdgeStyle}
            onApplyPreset={onApplyEdgePreset}
            onUpdateCustomStyle={onUpdateEdgeCustomStyle}
            onClearStyle={onClearEdgeStyle}
          />
        )}

      {/* Inline Edge Caption Editor Overlay */}
      {editingEdgeId && editingEdgePos && (
        <input
          autoFocus
          className="mermaid-inline-edge-input nodrag"
          style={{
            position: 'absolute',
            left: editingEdgePos.x,
            top: editingEdgePos.y,
            width: editingEdgePos.width,
            height: editingEdgePos.height,
            zIndex: 200,
          }}
          value={editEdgeLabel}
          placeholder="Caption..."
          onChange={(e) => onEditEdgeLabelChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFinishEditingEdge();
            if (e.key === 'Escape') onCancelEditingEdge();
          }}
          onBlur={onFinishEditingEdge}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Subgraph Floating Action HUD */}
      {selectedSubgraphRect &&
        selectedSubgraphId &&
        displaySubgraphs.has(selectedSubgraphId) &&
        !isMultiSelect && (
          <SubgraphActionHud
            subgraph={displaySubgraphs.get(selectedSubgraphId)!}
            centerX={selectedSubgraphRect.x + selectedSubgraphRect.width / 2}
            topY={selectedSubgraphRect.y}
            currentStyle={selectedSubgraphStyle}
            isStyleActive={activeSubgraphPopover === 'style'}
            onToggleStyle={onToggleSubgraphStyle}
            onRename={() => onStartEditingSubgraph(selectedSubgraphId)}
            onDissolve={onDissolveSubgraph}
            onDeleteAll={onDeleteSubgraphAll}
          />
        )}

      {/* Subgraph Style Popover */}
      {activeSubgraphPopover === 'style' &&
        subgraphPopoverPos &&
        selectedSubgraphId &&
        displaySubgraphs.has(selectedSubgraphId) &&
        !isMultiSelect && (
          <NodeStylePopover
            popoverPos={subgraphPopoverPos}
            currentStyle={selectedSubgraphStyle}
            defaultDash="dashed"
            onApplyPreset={onApplySubgraphPreset}
            onUpdateCustomStyle={onUpdateSubgraphCustomStyle}
            onClearStyle={onClearSubgraphStyle}
          />
        )}

      {/* Fallback chips for groups with no rendered cluster element */}
      {unmatchedSubgraphIds.length > 0 && (
        <div
          className="mermaid-group-fallback-bar nodrag"
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            display: 'flex',
            gap: 6,
            zIndex: 120,
            maxWidth: '70%',
            flexWrap: 'wrap',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {unmatchedSubgraphIds.map((subId, idx) => {
            const sub = displaySubgraphs.get(subId);
            if (!sub) return null;
            const isActive = selectedSubgraphId === subId;
            return (
              <button
                key={subId}
                type="button"
                className={`mermaid-subgraph-badge ${isActive ? 'is-selected' : ''}`}
                style={isActive ? { outline: '2px solid var(--mermaid-accent)' } : undefined}
                title={
                  sub.nodeIds.length === 0
                    ? `Empty group "${sub.label}" — click to select`
                    : `Group "${sub.label}" — click to select`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectUnmatchedSubgraph(subId, idx);
                }}
              >
                <span>{sub.label || subId}</span>
                {sub.nodeIds.length === 0 && <span> (empty)</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Subgraph Membership Popover */}
      {activeNodePopover === 'subgraph' && popoverPos && selectedNodeId && (
        <div
          style={{
            position: 'absolute',
            left: popoverPos.left,
            top: popoverPos.top,
            transform: popoverPos.transform,
            zIndex: 200,
          }}
        >
          <SubgraphPopover
            currentSubgraphId={currentSubgraphId}
            subgraphs={Array.from(displaySubgraphs.values())}
            onSelectSubgraph={onSelectSubgraphMembership}
            onCreateNewGroup={onCreateNewGroupMembership}
            onClose={onCloseSubgraphMembership}
          />
        </div>
      )}

      {/* Inline Subgraph Label Editor Overlay */}
      {editingSubgraphId && editingSubgraphPos && (
        <input
          autoFocus
          className="mermaid-inline-node-input nodrag"
          style={{
            position: 'absolute',
            left: editingSubgraphPos.x,
            top: editingSubgraphPos.y,
            width: editingSubgraphPos.width,
            height: editingSubgraphPos.height,
            zIndex: 220,
          }}
          value={editSubgraphLabel}
          onChange={(e) => onEditSubgraphLabelChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFinishEditingSubgraph();
            if (e.key === 'Escape') onCancelEditingSubgraph();
          }}
          onBlur={onFinishEditingSubgraph}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Inline Node Label Editor Overlay */}
      {editingNodeId && editingPos && (
        <input
          autoFocus
          className="mermaid-inline-node-input nodrag"
          style={{
            position: 'absolute',
            left: editingPos.x,
            top: editingPos.y,
            width: editingPos.width,
            height: editingPos.height,
            zIndex: 200,
          }}
          value={editNodeLabel}
          onChange={(e) => onEditNodeLabelChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFinishEditingNode();
            if (e.key === 'Escape') onCancelEditingNode();
          }}
          onBlur={onFinishEditingNode}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
};
