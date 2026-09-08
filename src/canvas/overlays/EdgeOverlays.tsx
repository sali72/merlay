/**
 * Overlays for Selected Edges: Edge Action HUD and Edge Style Popover.
 */

import React from 'react';
import { ActiveEdgePopover, SelectedEdgePos } from '../types';
import { EdgeThemePreset } from '../constants';
import { ArrowType } from '../../ast/types';
import { EdgeActionHud } from '../components/EdgeActionHud';
import { EdgeStylePopover } from '../components/EdgeStylePopover';

export interface EdgeOverlaysProps {
  selectedEdgePos: SelectedEdgePos | null;
  selectedEdgeId: string | null;
  isMultiSelect: boolean;
  selectedEdgeStyle: Record<string, string> | undefined;
  activeEdgePopover: ActiveEdgePopover;
  onChangeEdgeType: (newType: ArrowType) => void;
  onReverseEdge: () => void;
  onInsertNodeOnEdge: (edgeId: string) => void;
  onUpdateEdgeLabel: (newLabel: string) => void;
  onToggleEdgeStyle: () => void;
  onDeleteEdge: () => void;
  isStateDiagram: boolean;
  onApplyEdgePreset: (preset: EdgeThemePreset) => void;
  onUpdateEdgeCustomStyle: (prop: string, val: string) => void;
  onClearEdgeStyle: () => void;
}

export const EdgeOverlays: React.FC<EdgeOverlaysProps> = ({
  selectedEdgePos,
  selectedEdgeId,
  isMultiSelect,
  selectedEdgeStyle,
  activeEdgePopover,
  onChangeEdgeType,
  onReverseEdge,
  onInsertNodeOnEdge,
  onUpdateEdgeLabel,
  onToggleEdgeStyle,
  onDeleteEdge,
  isStateDiagram,
  onApplyEdgePreset,
  onUpdateEdgeCustomStyle,
  onClearEdgeStyle,
}) => {
  return (
    <>
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
    </>
  );
};
