import React from 'react';
import { ActiveNodePopover } from '../types';
import {
  CheckSquareIcon,
  ShapesIcon,
  PaletteIcon,
  TrashIcon,
} from '../icons/Icons';

export interface MultiSelectHudProps {
  selectedCount: number;
  centerX: number;
  topY: number;
  activeNodePopover: ActiveNodePopover;
  onTogglePopover: (popover: 'shape' | 'style') => void;
  onBatchDelete: () => void;
}

export const MultiSelectHud: React.FC<MultiSelectHudProps> = ({
  selectedCount,
  centerX,
  topY,
  activeNodePopover,
  onTogglePopover,
  onBatchDelete,
}) => {
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
        <span>{selectedCount} Steps Selected</span>
      </div>

      <div className="mermaid-hud-divider" />

      {/* Batch Shape Picker */}
      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          activeNodePopover === 'shape' ? 'is-active' : ''
        }`}
        onClick={() => onTogglePopover('shape')}
        title="Change Shape (All Selected)"
      >
        <ShapesIcon size={14} />
      </button>

      {/* Batch Visual Style & Color */}
      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          activeNodePopover === 'style' ? 'is-active' : ''
        }`}
        onClick={() => onTogglePopover('style')}
        title="Themes & Colors (All Selected)"
      >
        <PaletteIcon size={14} />
      </button>

      <div className="mermaid-hud-divider" />

      {/* Batch Delete */}
      <button
        type="button"
        className="mermaid-hud-btn delete-btn icon-only"
        onClick={onBatchDelete}
        title={`Delete Selected Steps (${selectedCount})`}
      >
        <TrashIcon size={13} />
      </button>
    </div>
  );
};
