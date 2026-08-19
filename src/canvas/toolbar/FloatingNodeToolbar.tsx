import React from 'react';
import { NodeToolbar, Position } from '@xyflow/react';
import { MermaidShapeType } from '../../ast/types';
import { ShapeIcons, TrashIcon } from '../icons/Icons';

export interface FloatingNodeToolbarProps {
  currentShape: MermaidShapeType;
  onShapeChange: (shape: MermaidShapeType) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
}

const SHAPES: Array<{
  type: MermaidShapeType;
  label: string;
  renderIcon: () => React.ReactNode;
}> = [
  { type: 'rectangle', label: 'Rectangle [text]', renderIcon: ShapeIcons.rectangle },
  { type: 'rounded', label: 'Rounded (text)', renderIcon: ShapeIcons.rounded },
  { type: 'stadium', label: 'Stadium ([text])', renderIcon: ShapeIcons.stadium },
  { type: 'cylinder', label: 'Database [(text)]', renderIcon: ShapeIcons.cylinder },
  { type: 'circle', label: 'Circle ((text))', renderIcon: ShapeIcons.circle },
  { type: 'diamond', label: 'Decision {text}', renderIcon: ShapeIcons.diamond },
  { type: 'hexagon', label: 'Hexagon {{text}}', renderIcon: ShapeIcons.hexagon },
  { type: 'subroutine', label: 'Subroutine [[text]]', renderIcon: ShapeIcons.subroutine },
  { type: 'parallelogram', label: 'Parallelogram [/text/]', renderIcon: ShapeIcons.parallelogram },
];

const CANVAS_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Red', value: '#e93d82' },
  { name: 'Orange', value: '#e57028' },
  { name: 'Yellow', value: '#e5a000' },
  { name: 'Green', value: '#2e9e62' },
  { name: 'Blue', value: '#1d8cf8' },
  { name: 'Purple', value: '#8b5cf6' },
];

export const FloatingNodeToolbar: React.FC<FloatingNodeToolbarProps> = ({
  currentShape,
  onShapeChange,
  onColorChange,
  onDelete,
}) => {
  return (
    <NodeToolbar
      isVisible={true}
      position={Position.Top}
      offset={10}
      className="mermaid-floating-toolbar-container nodrag nopan"
    >
      <div className="mermaid-floating-toolbar">
        {/* Shape Selector */}
        <div className="mermaid-pill-group">
          {SHAPES.map((s) => (
            <button
              key={s.type}
              type="button"
              className={`mermaid-pill-btn ${currentShape === s.type ? 'is-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onShapeChange(s.type);
              }}
              title={s.label}
            >
              {s.renderIcon()}
            </button>
          ))}
        </div>

        <div className="mermaid-pill-divider" />

        {/* Canvas Color Palette */}
        <div className="mermaid-pill-group colors">
          {CANVAS_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`mermaid-color-dot ${!c.value ? 'default' : ''}`}
              style={{ background: c.value || 'var(--background-secondary, #333)' }}
              onClick={(e) => {
                e.stopPropagation();
                onColorChange(c.value);
              }}
              title={`Color: ${c.name}`}
            />
          ))}
        </div>

        <div className="mermaid-pill-divider" />

        {/* Delete */}
        <button
          type="button"
          className="mermaid-pill-btn delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete (Backspace)"
        >
          <TrashIcon size={14} />
        </button>
      </div>
    </NodeToolbar>
  );
};
