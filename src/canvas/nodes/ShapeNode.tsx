import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MermaidShapeType } from '../../ast/types';

export interface ShapeNodeData {
  id: string;
  label: string;
  shape: MermaidShapeType;
  style?: Record<string, string>;
  onLabelChange?: (id: string, newLabel: string) => void;
  onSprout?: (sourceId: string, direction: 'right' | 'down' | 'left' | 'up') => void;
}

export const ShapeNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as ShapeNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label || id);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(nodeData.label || id);
  }, [nodeData.label, id]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (nodeData.onLabelChange && label.trim() !== nodeData.label) {
      nodeData.onLabelChange(id, label.trim() || id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLabel(nodeData.label || id);
      setIsEditing(false);
    }
  };

  const shape = nodeData.shape || 'rectangle';
  const customFill = nodeData.style?.fill || 'var(--background-secondary, #202020)';
  const customStroke = nodeData.style?.stroke || (selected ? 'var(--interactive-accent, #7c3aed)' : 'var(--background-modifier-border, #444)');
  const customColor = nodeData.style?.color || 'var(--text-normal, #dcddde)';

  return (
    <div
      className={`mermaid-shape-node ${shape} ${selected ? 'is-selected' : ''}`}
      style={{
        position: 'relative',
        minWidth: 120,
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 16px',
        color: customColor,
        background: customFill,
        border: `2px solid ${customStroke}`,
        boxShadow: selected ? '0 0 0 2px var(--interactive-accent, #7c3aed)' : '0 2px 5px rgba(0,0,0,0.2)',
        ...getShapeBorderRadius(shape),
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Standard Connection Handles */}
      <Handle type="target" position={Position.Top} id="top" className="mermaid-handle" />
      <Handle type="source" position={Position.Right} id="right" className="mermaid-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="mermaid-handle" />
      <Handle type="target" position={Position.Left} id="left" className="mermaid-handle" />

      {/* Quick Sprout Directional Handles */}
      {selected && nodeData.onSprout && (
        <>
          <button
            className="mermaid-sprout-btn sprout-right"
            title="Sprout Connected Node (Right)"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'right');
            }}
          >
            +
          </button>
          <button
            className="mermaid-sprout-btn sprout-down"
            title="Sprout Connected Node (Down)"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'down');
            }}
          >
            +
          </button>
        </>
      )}

      {/* Label Content / Inline Editor */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="mermaid-node-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span className="mermaid-node-label">{label}</span>
      )}
    </div>
  );
};

function getShapeBorderRadius(shape: MermaidShapeType): React.CSSProperties {
  switch (shape) {
    case 'rounded':
      return { borderRadius: 10 };
    case 'stadium':
      return { borderRadius: 24 };
    case 'circle':
      return { borderRadius: '50%', minWidth: 64, minHeight: 64, aspectRatio: '1/1' };
    case 'cylinder':
      return { borderRadius: '8px 8px 16px 16px', borderTopWidth: 4 };
    case 'diamond':
      return { transform: 'rotate(0deg)', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', padding: '14px 20px' };
    case 'hexagon':
      return { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', padding: '10px 24px' };
    case 'parallelogram':
      return { transform: 'skewX(-15deg)', padding: '8px 20px' };
    case 'subroutine':
      return { borderRadius: 2, outline: '2px solid var(--background-modifier-border, #444)', outlineOffset: -4 };
    case 'rectangle':
    default:
      return { borderRadius: 4 };
  }
}
