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
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleBlur();
      nodeData.onSprout?.(id, 'right');
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
        padding: '8px 18px',
        color: customColor,
        background: customFill,
        border: `2px solid ${customStroke}`,
        boxShadow: selected
          ? '0 0 0 2px var(--interactive-accent, #7c3aed), 0 4px 12px rgba(0,0,0,0.3)'
          : '0 2px 6px rgba(0,0,0,0.2)',
        ...getShapeStyles(shape),
      }}
      tabIndex={0}
      onDoubleClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Tab' && !isEditing) {
          e.preventDefault();
          nodeData.onSprout?.(id, 'right');
        } else if (e.key === 'Enter' && !isEditing) {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {/* 3D Database cylinder top lid line */}
      {shape === 'cylinder' && (
        <div
          className="mermaid-cylinder-lid"
          style={{
            position: 'absolute',
            top: 6,
            left: 0,
            right: 0,
            height: 10,
            borderBottom: `2px solid ${customStroke}`,
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Subroutine double border indicators */}
      {shape === 'subroutine' && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 6,
              width: 2,
              background: customStroke,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 6,
              width: 2,
              background: customStroke,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* Standard Connection Handles */}
      <Handle type="target" position={Position.Top} id="top" className="mermaid-handle" />
      <Handle type="source" position={Position.Right} id="right" className="mermaid-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="mermaid-handle" />
      <Handle type="target" position={Position.Left} id="left" className="mermaid-handle" />

      {/* Quick Sprout Directional Handles (All 4 Directions on Selection) */}
      {selected && nodeData.onSprout && (
        <>
          <button
            className="mermaid-sprout-btn sprout-right"
            title="Sprout Connected Node (Right) [Tab]"
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
          <button
            className="mermaid-sprout-btn sprout-left"
            title="Sprout Connected Node (Left)"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'left');
            }}
          >
            +
          </button>
          <button
            className="mermaid-sprout-btn sprout-up"
            title="Sprout Connected Node (Up)"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'up');
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

function getShapeStyles(shape: MermaidShapeType): React.CSSProperties {
  switch (shape) {
    case 'rounded':
      return { borderRadius: 10 };
    case 'stadium':
      return { borderRadius: 24, padding: '8px 22px' };
    case 'circle':
      return { borderRadius: '50%', minWidth: 64, minHeight: 64, aspectRatio: '1/1' };
    case 'cylinder':
      return { borderRadius: '6px 6px 14px 14px', paddingTop: 14 };
    case 'diamond':
      return { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', padding: '14px 22px' };
    case 'hexagon':
      return { clipPath: 'polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)', padding: '10px 24px' };
    case 'parallelogram':
      return { transform: 'skewX(-15deg)', padding: '8px 22px' };
    case 'subroutine':
      return { borderRadius: 4, padding: '8px 20px' };
    case 'rectangle':
    default:
      return { borderRadius: 4 };
  }
}
