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
  { type: 'parallelogram', label: 'Input/Output [/text/]', renderIcon: ShapeIcons.parallelogram },
];

const COLORS = [
  { name: 'Default', value: '' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Slate', value: '#475569' },
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
      className="mermaid-floating-toolbar"
    >
      {/* Shape Selector */}
      <div className="mermaid-pill-group">
        {SHAPES.map((s) => (
          <button
            key={s.type}
            className={`mermaid-pill-btn ${currentShape === s.type ? 'is-active' : ''}`}
            onClick={() => onShapeChange(s.type)}
            title={s.label}
          >
            {s.renderIcon()}
          </button>
        ))}
      </div>

      <div className="mermaid-pill-divider" />

      {/* Color Palette */}
      <div className="mermaid-pill-group colors">
        {COLORS.map((c) => (
          <button
            key={c.name}
            className={`mermaid-color-dot ${!c.value ? 'default' : ''}`}
            style={{ background: c.value || 'var(--background-secondary, #333)' }}
            onClick={() => onColorChange(c.value)}
            title={`Color: ${c.name}`}
          />
        ))}
      </div>

      <div className="mermaid-pill-divider" />

      {/* Delete */}
      <button
        className="mermaid-pill-btn delete"
        onClick={onDelete}
        title="Delete Node (Backspace)"
      >
        <TrashIcon size={14} />
      </button>
    </NodeToolbar>
  );
};
