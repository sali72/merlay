import React from 'react';
import { NodeToolbar, Position } from '@xyflow/react';
import { MermaidShapeType } from '../../ast/types';
import { ShapeIcons, TrashIcon } from '../icons/Icons';

export interface FloatingNodeToolbarProps {
  currentShape: MermaidShapeType;
  currentColor?: string;
  onShapeChange: (shape: MermaidShapeType) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
}

const SHAPES: Array<{
  type: MermaidShapeType;
  label: string;
  renderIcon: () => React.ReactNode;
}> = [
  { type: 'rectangle', label: 'Rectangle [text]', renderIcon: () => ShapeIcons.rectangle({ size: 14 }) },
  { type: 'rounded', label: 'Rounded (text)', renderIcon: () => ShapeIcons.rounded({ size: 14 }) },
  { type: 'stadium', label: 'Stadium ([text])', renderIcon: () => ShapeIcons.stadium({ size: 14 }) },
  { type: 'cylinder', label: 'Database [(text)]', renderIcon: () => ShapeIcons.cylinder({ size: 14 }) },
  { type: 'circle', label: 'Circle ((text))', renderIcon: () => ShapeIcons.circle({ size: 14 }) },
  { type: 'diamond', label: 'Decision {text}', renderIcon: () => ShapeIcons.diamond({ size: 14 }) },
  { type: 'hexagon', label: 'Hexagon {{text}}', renderIcon: () => ShapeIcons.hexagon({ size: 14 }) },
  { type: 'subroutine', label: 'Subroutine [[text]]', renderIcon: () => ShapeIcons.subroutine({ size: 14 }) },
  { type: 'parallelogram', label: 'Parallelogram [/text/]', renderIcon: () => ShapeIcons.parallelogram({ size: 14 }) },
];

const CANVAS_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Red', value: '#e22c38' },
  { name: 'Orange', value: '#ec7500' },
  { name: 'Yellow', value: '#e0ac00' },
  { name: 'Green', value: '#08b94e' },
  { name: 'Blue', value: '#088cdb' },
  { name: 'Purple', value: '#7b66ff' },
];

export const FloatingNodeToolbar: React.FC<FloatingNodeToolbarProps> = ({
  currentShape,
  currentColor = '',
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
          {CANVAS_COLORS.map((c) => {
            const isSelected = (!currentColor && !c.value) || currentColor === c.value;
            return (
              <button
                key={c.name}
                type="button"
                className={`mermaid-color-dot ${!c.value ? 'default' : ''} ${isSelected ? 'is-active' : ''}`}
                style={{ background: c.value || undefined }}
                onClick={(e) => {
                  e.stopPropagation();
                  onColorChange(c.value);
                }}
                title={`Color: ${c.name}`}
              />
            );
          })}
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
          title="Delete Node (Backspace/Delete)"
        >
          <TrashIcon size={14} />
        </button>
      </div>
    </NodeToolbar>
  );
};

