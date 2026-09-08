/**
 * Overlays for Selected Nodes: HUD, Shape Popover, State Type Popover, Node Style Popover, Subgraph Membership.
 */

import React from 'react';
import { ActiveNodePopover, PopoverPos, Rect } from '../types';
import { ThemePreset } from '../constants';
import { MermaidNodeDef, MermaidShapeType, MermaidSubgraphDef } from '../../ast/types';
import { MermaidStateDef, MermaidStateType } from '../../diagrams/state/types';
import { SupportedDiagramType } from '../../diagrams/types';
import { NodeActionHud } from '../components/NodeActionHud';
import { ShapePopover } from '../components/ShapePopover';
import { StateTypePopover } from '../components/StateTypePopover';
import { NodeStylePopover } from '../components/NodeStylePopover';
import { SubgraphPopover } from '../components/SubgraphPopover';

export interface NodeOverlaysProps {
  selectedNodeRect: Rect | null;
  selectedNodeId: string | null;
  isMultiSelect: boolean;
  sproutX: number;
  sproutY: number;
  isLR: boolean;
  diagramType: SupportedDiagramType;
  stateType: MermaidStateType | undefined;
  currentNode: MermaidNodeDef | undefined;
  currentStyle: Record<string, string> | undefined;
  activeNodePopover: ActiveNodePopover;
  onSproutNextStep: (nodeId: string) => void;
  onStartEditingNode: (nodeId: string) => void;
  onToggleNodePopover: (popover: 'shape' | 'style' | 'subgraph') => void;
  onDeleteNode: () => void;
  canRenameState?: boolean;

  popoverPos: PopoverPos | null;
  astNodes: Map<string, MermaidNodeDef>;
  onSelectShape: (shape: MermaidShapeType) => void;
  currentState: MermaidStateDef | undefined;
  onSelectStateType: (type: MermaidStateType) => void;
  onApplyNodePreset: (preset: ThemePreset) => void;
  onUpdateCustomStyle: (prop: string, val: string) => void;
  onClearNodeStyle: () => void;

  currentSubgraphId: string | undefined;
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  onSelectSubgraphMembership: (subId: string | null) => void;
  onCreateNewGroupMembership: () => void;
  onCloseSubgraphMembership: () => void;
}

export const NodeOverlays: React.FC<NodeOverlaysProps> = ({
  selectedNodeRect,
  selectedNodeId,
  isMultiSelect,
  sproutX,
  sproutY,
  isLR,
  diagramType,
  stateType,
  currentNode,
  currentStyle,
  activeNodePopover,
  onSproutNextStep,
  onStartEditingNode,
  onToggleNodePopover,
  onDeleteNode,
  canRenameState,
  popoverPos,
  astNodes,
  onSelectShape,
  currentState,
  onSelectStateType,
  onApplyNodePreset,
  onUpdateCustomStyle,
  onClearNodeStyle,
  currentSubgraphId,
  displaySubgraphs,
  onSelectSubgraphMembership,
  onCreateNewGroupMembership,
  onCloseSubgraphMembership,
}) => {
  const isStateDiagram = diagramType === 'stateDiagram';

  return (
    <>
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

      {/* Shape Popover for flowchart */}
      {activeNodePopover === 'shape' && !isStateDiagram && popoverPos && (
        <ShapePopover
          popoverPos={popoverPos}
          selectedNodeId={selectedNodeId}
          selectedNodeIds={new Set(selectedNodeId ? [selectedNodeId] : [])}
          astNodes={astNodes}
          onSelectShape={onSelectShape}
        />
      )}

      {/* State Type Popover for state diagrams */}
      {activeNodePopover === 'shape' && isStateDiagram && popoverPos && (
        <StateTypePopover
          popoverPos={popoverPos}
          selectedStateId={selectedNodeId}
          currentState={currentState}
          onSelectStateType={onSelectStateType}
        />
      )}

      {/* Visual Styling Popover for single node */}
      {activeNodePopover === 'style' && popoverPos && (
        <NodeStylePopover
          popoverPos={popoverPos}
          currentStyle={currentStyle}
          onApplyPreset={onApplyNodePreset}
          onUpdateCustomStyle={onUpdateCustomStyle}
          onClearStyle={onClearNodeStyle}
        />
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
    </>
  );
};
