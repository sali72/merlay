import React from 'react';
import { SelectedEdgePos } from '../types';
import { EDGE_THEME_PRESETS, EdgeThemePreset } from '../constants';
import {
  SwatchesGrid,
  StrokeWidthControl,
  StrokeDashControl,
  ColorPickerRow,
  ResetStyleButton,
} from './StyleControls';

export interface EdgeStylePopoverProps {
  selectedEdgePos: SelectedEdgePos | null;
  currentEdgeStyle: Record<string, string> | undefined;
  onApplyPreset: (preset: EdgeThemePreset) => void;
  onUpdateCustomStyle: (property: string, value: string) => void;
  onClearStyle: () => void;
}

export const EdgeStylePopover: React.FC<EdgeStylePopoverProps> = ({
  selectedEdgePos,
  currentEdgeStyle,
  onApplyPreset,
  onUpdateCustomStyle,
  onClearStyle,
}) => {
  if (!selectedEdgePos) return null;

  return (
    <div
      className="mermaid-popover-menu mermaid-style-popover nodrag"
      style={{
        position: 'absolute',
        left: selectedEdgePos.x,
        top: selectedEdgePos.y + 14,
        transform: 'translate(-50%, 0)',
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <SwatchesGrid
        title="Arrow Themes"
        presets={EDGE_THEME_PRESETS}
        activeValue={currentEdgeStyle?.stroke}
        valueKey="stroke"
        onApply={onApplyPreset}
      />

      <StrokeWidthControl
        title="Thickness"
        currentWidth={currentEdgeStyle?.['stroke-width']}
        onUpdate={(w) => onUpdateCustomStyle('stroke-width', w)}
      />

      <StrokeDashControl
        currentDash={currentEdgeStyle?.['stroke-dasharray']}
        solidValue=""
        onUpdate={(d) => onUpdateCustomStyle('stroke-dasharray', d)}
      />

      <ColorPickerRow
        label="Arrow Color"
        value={currentEdgeStyle?.stroke || '#7c3aed'}
        title="Custom Arrow Color"
        onChange={(v) => onUpdateCustomStyle('stroke', v)}
      />

      <ColorPickerRow
        label="Caption Color"
        value={currentEdgeStyle?.color || '#000000'}
        title="Custom Caption Text Color"
        onChange={(v) => onUpdateCustomStyle('color', v)}
      />

      <ResetStyleButton label="Reset to Default Arrow Style" onReset={onClearStyle} />
    </div>
  );
};
