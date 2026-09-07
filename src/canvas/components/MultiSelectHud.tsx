import React from 'react';
import { ActiveMultiPopover } from '../types';
import {
  CheckSquareIcon,
  ShapesIcon,
  PaletteIcon,
  TrashIcon,
  ArrowSolidIcon,
  FolderIcon,
  UngroupIcon,
} from '../icons/Icons';

export interface MultiSelectHudProps {
  selectedNodeCount: number;
  selectedEdgeCount: number;
  centerX: number;
  topY: number;
  activePopover: ActiveMultiPopover;
  onTogglePopover: (popover: 'shape' | 'style' | 'edgeType') => void;
  onBatchDelete: () => void;
  onGroupSelected?: () => void;
  onUngroupSelected?: () => void;
  canUngroup?: boolean;
}

export const MultiSelectHud: React.FC<MultiSelectHudProps> = ({
  selectedNodeCount,
  selectedEdgeCount,
  centerX,
  topY,
  activePopover,
  onTogglePopover,
  onBatchDelete,
  onGroupSelected,
  onUngroupSelected,
  canUngroup,
}) => {
  const totalCount = selectedNodeCount + selectedEdgeCount;

  const renderBadgeText = () => {
    if (selectedNodeCount > 0 && selectedEdgeCount > 0) {
      return `${selectedNodeCount} Steps, ${selectedEdgeCount} Arrows`;
    }
    if (selectedNodeCount > 0) {
      return `${selectedNodeCount} Steps Selected`;
    }
    return `${selectedEdgeCount} Arrows Selected`;
  };

  return (
    <div
      className="mermaid-multiselect-hud nodrag"
      style={{
        position: 'absolute',
        left: centerX,
        top: topY - 14,
        transform: 'translate(-50%, -100%)',
        zIndex: 150,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mermaid-multiselect-badge">
        <CheckSquareIcon size={12} />
        <span>{renderBadgeText()}</span>
      </div>

      <div className="mermaid-hud-divider" />

      {/* Batch Shape Picker (visible if any nodes selected) */}
      {selectedNodeCount > 0 && (
        <button
          type="button"
          className={`mermaid-hud-btn icon-only ${
            activePopover === 'shape' ? 'is-active' : ''
          }`}
          onClick={() => onTogglePopover('shape')}
          title="Change Shape (All Selected Nodes)"
        >
          <ShapesIcon size={14} />
        </button>
      )}

      {/* Batch Arrow Type Picker (visible if any edges selected) */}
      {selectedEdgeCount > 0 && (
        <button
          type="button"
          className={`mermaid-hud-btn icon-only ${
            activePopover === 'edgeType' ? 'is-active' : ''
          }`}
          onClick={() => onTogglePopover('edgeType')}
          title="Change Arrow Type (All Selected Arrows)"
        >
          <ArrowSolidIcon size={14} />
        </button>
      )}

      {/* Batch Visual Style & Color (Applies to both nodes & arrows!) */}
      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          activePopover === 'style' ? 'is-active' : ''
        }`}
        onClick={() => onTogglePopover('style')}
        title="Themes & Colors (All Selected Items)"
      >
        <PaletteIcon size={14} />
      </button>

      {/* Group selected nodes into new subgraph */}
      {selectedNodeCount > 0 && onGroupSelected && (
        <button
          type="button"
          className="mermaid-hud-btn icon-only"
          onClick={onGroupSelected}
          title="Group Selected Nodes into New Subgraph"
        >
          <FolderIcon size={14} />
        </button>
      )}

      {/* Ungroup selected nodes from their current subgraphs */}
      {selectedNodeCount > 0 && canUngroup && onUngroupSelected && (
        <button
          type="button"
          className="mermaid-hud-btn icon-only"
          onClick={onUngroupSelected}
          title="Ungroup Selected Nodes"
        >
          <UngroupIcon size={14} />
        </button>
      )}

      <div className="mermaid-hud-divider" />

      {/* Batch Delete */}
      <button
        type="button"
        className="mermaid-hud-btn delete-btn icon-only"
        onClick={onBatchDelete}
        title={`Delete Selected Items (${totalCount})`}
      >
        <TrashIcon size={13} />
      </button>
    </div>
  );
};
