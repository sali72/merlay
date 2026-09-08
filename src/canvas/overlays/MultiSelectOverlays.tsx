/**
 * Overlays for Multi-Selection: MultiSelect HUD, batch edge type popover, batch shape popover, batch style popover.
 */

import React from 'react';
import { ActiveMultiPopover, PopoverPos } from '../types';
import { ThemePreset } from '../constants';
import { ArrowType, MermaidNodeDef, MermaidShapeType } from '../../ast/types';
import { MermaidStateType } from '../../diagrams/state/types';
import { MultiSelectHud } from '../components/MultiSelectHud';
import { EdgeTypePopover } from '../components/EdgeTypePopover';
import { ShapePopover } from '../components/ShapePopover';
import { StateTypePopover } from '../components/StateTypePopover';
import { NodeStylePopover } from '../components/NodeStylePopover';

export interface MultiSelectOverlaysProps {
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
  isStateDiagram: boolean;

  popoverPos: PopoverPos | null;
  onBatchUpdateEdgeType: (newType: ArrowType) => void;
  astNodes: Map<string, MermaidNodeDef>;
  onSelectShape: (shape: MermaidShapeType) => void;
  onSelectStateType: (type: MermaidStateType) => void;
  onApplyPreset: (preset: ThemePreset) => void;
  onUpdateCustomStyle: (prop: string, val: string) => void;
  onClearStyle: () => void;
}

export const MultiSelectOverlays: React.FC<MultiSelectOverlaysProps> = ({
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
  isStateDiagram,
  popoverPos,
  onBatchUpdateEdgeType,
  astNodes,
  onSelectShape,
  onSelectStateType,
  onApplyPreset,
  onUpdateCustomStyle,
  onClearStyle,
}) => {
  if (!isMultiSelect) return null;

  return (
    <>
      {/* Multi-Select Floating Action HUD */}
      {multiSelectBounds && (
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

      {/* Multi-Select Edge Type Popover (flowchart only) */}
      {activeMultiPopover === 'edgeType' && !isStateDiagram && popoverPos && (
        <EdgeTypePopover
          popoverPos={popoverPos}
          onSelectType={onBatchUpdateEdgeType}
        />
      )}

      {/* Multi-Select Shape Popover (flowchart) */}
      {activeMultiPopover === 'shape' && !isStateDiagram && popoverPos && (
        <ShapePopover
          popoverPos={popoverPos}
          selectedNodeId={null}
          selectedNodeIds={selectedNodeIds}
          astNodes={astNodes}
          onSelectShape={onSelectShape}
        />
      )}

      {/* Multi-Select State Type Popover (stateDiagram) */}
      {activeMultiPopover === 'shape' && isStateDiagram && popoverPos && (
        <StateTypePopover
          popoverPos={popoverPos}
          selectedStateId={null}
          currentState={undefined}
          onSelectStateType={onSelectStateType}
        />
      )}

      {/* Multi-Select Visual Styling Popover */}
      {activeMultiPopover === 'style' && popoverPos && (
        <NodeStylePopover
          popoverPos={popoverPos}
          currentStyle={undefined}
          onApplyPreset={onApplyPreset}
          onUpdateCustomStyle={onUpdateCustomStyle}
          onClearStyle={onClearStyle}
        />
      )}
    </>
  );
};
