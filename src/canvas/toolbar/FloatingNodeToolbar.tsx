import React from 'react';
import { NodeToolbar, Position } from '@xyflow/react';
import { MermaidShapeType } from '../../ast/types';

export interface FloatingNodeToolbarProps {
  currentShape: MermaidShapeType;
  onShapeChange: (shape: MermaidShapeType) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
}

const SHAPES: Array<{ type: MermaidShapeType; label: string; icon: string }> = [
  { type: 'rectangle', label: 'Rectangle', icon: '▢' },
  { type: 'rounded', label: 'Rounded', icon: '▢' },
  { type: 'stadium', label: 'Stadium', icon: '⬭' },
  { type: 'cylinder', label: 'Database', icon: '🛢️' },
  { type: 'circle', label: 'Circle', icon: '○' },
  { type: 'diamond', label: 'Decision', icon: '◇' },
  { type: 'hexagon', label: 'Hexagon', icon: '⬡' },
  { type: 'subroutine', label: 'Subroutine', icon: '⧉' },
  { type: 'parallelogram', label: 'Input/Output', icon: '▰' },
];

const COLORS = [
  { name: 'Default', value: '' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Slate', value: '#64748b' },
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
            {s.icon}
          </button>
        ))}
      </div>

      <div className="mermaid-pill-divider" />

      {/* Color Palette */}
      <div className="mermaid-pill-group colors">
        {COLORS.map((c) => (
          <button
            key={c.name}
            className="mermaid-color-dot"
            style={{ background: c.value || 'var(--background-secondary, #444)' }}
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
        🗑️
      </button>
    </NodeToolbar>
  );
};
