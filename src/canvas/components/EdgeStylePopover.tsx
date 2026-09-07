import React from 'react';
import { SelectedEdgePos } from '../types';
import { EDGE_THEME_PRESETS, EdgeThemePreset } from '../constants';
import { CheckIcon } from '../icons/Icons';

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
      {/* Theme Presets */}
      <div className="mermaid-style-popover-title">Arrow Themes</div>
      <div className="mermaid-swatches-grid">
        {EDGE_THEME_PRESETS.map((p) => {
          const isCurrent =
            (!p.stroke && !currentEdgeStyle?.stroke) ||
            (Boolean(currentEdgeStyle?.stroke) &&
              currentEdgeStyle?.stroke?.toLowerCase() === p.stroke.toLowerCase());
          return (
            <button
              key={p.name}
              type="button"
              className={`mermaid-swatch-btn ${isCurrent ? 'is-active' : ''}`}
              style={{
                backgroundColor: p.bgPreview,
                borderColor: p.borderPreview,
              }}
              onClick={() => onApplyPreset(p)}
              title={p.name}
            >
              {isCurrent && <CheckIcon size={12} />}
            </button>
          );
        })}
      </div>

      {/* Stroke Width */}
      <div className="mermaid-style-control-row">
        <span className="mermaid-style-popover-title">Thickness</span>
        <div className="mermaid-style-segmented">
          {['1px', '2px', '3px', '4px'].map((w) => {
            const isCurrent = currentEdgeStyle?.['stroke-width'] === w;
            return (
              <button
                key={w}
                type="button"
                className={`mermaid-segmented-btn ${isCurrent ? 'is-active' : ''}`}
                onClick={() => onUpdateCustomStyle('stroke-width', w)}
              >
                {w}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stroke Dash Style */}
      <div className="mermaid-style-control-row">
        <span className="mermaid-style-popover-title">Dash</span>
        <div className="mermaid-style-segmented">
          {[
            { label: 'Solid', value: '' },
            { label: 'Dashed', value: '5 5' },
            { label: 'Dotted', value: '2 2' },
          ].map((dash) => {
            const isCurrent =
              (!dash.value && !currentEdgeStyle?.['stroke-dasharray']) ||
              currentEdgeStyle?.['stroke-dasharray'] === dash.value;
            return (
              <button
                key={dash.label}
                type="button"
                className={`mermaid-segmented-btn ${isCurrent ? 'is-active' : ''}`}
                onClick={() => onUpdateCustomStyle('stroke-dasharray', dash.value)}
              >
                {dash.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Arrow Color */}
      <div className="mermaid-style-control-row">
        <span>Arrow Color</span>
        <div className="mermaid-color-input-wrapper">
          <input
            type="color"
            className="mermaid-color-picker-input"
            value={currentEdgeStyle?.stroke || '#7c3aed'}
            onChange={(e) => onUpdateCustomStyle('stroke', e.target.value)}
            title="Custom Arrow Color"
          />
        </div>
      </div>

      {/* Custom Caption Text Color */}
      <div className="mermaid-style-control-row">
        <span>Caption Color</span>
        <div className="mermaid-color-input-wrapper">
          <input
            type="color"
            className="mermaid-color-picker-input"
            value={currentEdgeStyle?.color || '#000000'}
            onChange={(e) => onUpdateCustomStyle('color', e.target.value)}
            title="Custom Caption Text Color"
          />
        </div>
      </div>

      {/* Reset to Default */}
      <button
        type="button"
        className="mermaid-style-reset-btn"
        onClick={onClearStyle}
      >
        Reset to Default Arrow Style
      </button>
    </div>
  );
};
