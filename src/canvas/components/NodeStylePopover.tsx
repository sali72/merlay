import React from 'react';
import { PopoverPos } from '../types';
import { THEME_PRESETS, ThemePreset } from '../constants';
import { CheckIcon } from '../icons/Icons';

export interface NodeStylePopoverProps {
  popoverPos: PopoverPos | null;
  currentStyle: Record<string, string> | undefined;
  onApplyPreset: (preset: ThemePreset) => void;
  onUpdateCustomStyle: (property: string, value: string) => void;
  onClearStyle: () => void;
  /**
   * Which dash the target has when `stroke-dasharray` is unset.
   * Nodes default to solid; groups default to dashed (via container CSS),
   * so for groups Solid must write explicit `none` instead of deleting.
   */
  defaultDash?: 'solid' | 'dashed';
}

export const NodeStylePopover: React.FC<NodeStylePopoverProps> = ({
  popoverPos,
  currentStyle,
  onApplyPreset,
  onUpdateCustomStyle,
  onClearStyle,
  defaultDash = 'solid',
}) => {
  if (!popoverPos) return null;

  const solidValue = defaultDash === 'dashed' ? 'none' : '';
  // Effective dash for highlight purposes: unset means the target default.
  const effectiveDash = currentStyle?.['stroke-dasharray'] ?? (defaultDash === 'dashed' ? '5 5' : '');

  return (
    <div
      className="mermaid-popover-menu mermaid-style-popover nodrag"
      style={{
        position: 'absolute',
        left: popoverPos.left,
        top: popoverPos.top,
        transform: popoverPos.transform,
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Theme Presets */}
      <div className="mermaid-style-popover-title">Themes</div>
      <div className="mermaid-swatches-grid">
        {THEME_PRESETS.map((p) => {
          const isCurrent =
            (!p.fill && !currentStyle?.fill) ||
            (Boolean(currentStyle?.fill) &&
              currentStyle?.fill?.toLowerCase() === p.fill.toLowerCase());
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
        <span className="mermaid-style-popover-title">Border</span>
        <div className="mermaid-style-segmented">
          {['1px', '2px', '3px', '4px'].map((w) => {
            const isCurrent = currentStyle?.['stroke-width'] === w;
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
            { label: 'Solid', value: solidValue },
            { label: 'Dashed', value: '5 5' },
            { label: 'Dotted', value: '2 2' },
          ].map((dash) => {
            const isCurrent = effectiveDash === dash.value;
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

      {/* Custom Colors */}
      <div className="mermaid-style-control-row">
        <span>Fill Color</span>
        <div className="mermaid-color-input-wrapper">
          <input
            type="color"
            className="mermaid-color-picker-input"
            value={currentStyle?.fill || '#ffffff'}
            onChange={(e) => onUpdateCustomStyle('fill', e.target.value)}
            title="Custom Fill Color"
          />
        </div>
      </div>

      <div className="mermaid-style-control-row">
        <span>Border Color</span>
        <div className="mermaid-color-input-wrapper">
          <input
            type="color"
            className="mermaid-color-picker-input"
            value={currentStyle?.stroke || '#7c3aed'}
            onChange={(e) => onUpdateCustomStyle('stroke', e.target.value)}
            title="Custom Border Color"
          />
        </div>
      </div>

      <div className="mermaid-style-control-row">
        <span>Text Color</span>
        <div className="mermaid-color-input-wrapper">
          <input
            type="color"
            className="mermaid-color-picker-input"
            value={currentStyle?.color || '#000000'}
            onChange={(e) => onUpdateCustomStyle('color', e.target.value)}
            title="Custom Text Color"
          />
        </div>
      </div>

      {/* Reset to Default */}
      <button
        type="button"
        className="mermaid-style-reset-btn"
        onClick={onClearStyle}
      >
        Reset to Default Theme
      </button>
    </div>
  );
};
