import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MermaidShapeType } from '../../ast/types';
import { ShapeRenderer } from './ShapeRenderer';
import { PlusIcon } from '../icons/Icons';

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
  const [dimensions, setDimensions] = useState({ width: 130, height: 48 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(nodeData.label || id);
  }, [nodeData.label, id]);

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const minW = nodeData.shape === 'circle' ? 68 : Math.max(120, (label.length * 8.5) + 36);
      const minH = nodeData.shape === 'circle' ? 68 : 46;
      setDimensions({
        width: Math.max(minW, rect.width || minW),
        height: Math.max(minH, rect.height || minH),
      });
    }
  }, [label, nodeData.shape]);

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
  const customFill = nodeData.style?.fill || 'var(--background-secondary, #252525)';
  const customStroke = nodeData.style?.stroke || (selected ? 'var(--interactive-accent, #7c3aed)' : 'var(--background-modifier-border, #555)');
  const customColor = nodeData.style?.color || 'var(--text-normal, #e0e0e0)';

  return (
    <div
      ref={containerRef}
      className={`mermaid-shape-node-wrapper ${selected ? 'is-selected' : ''}`}
      style={{
        position: 'relative',
        width: dimensions.width,
        height: dimensions.height,
        minWidth: shape === 'circle' ? 68 : 110,
        minHeight: shape === 'circle' ? 68 : 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: customColor,
        background: 'transparent',
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
      {/* Crisp Vector Shape Canvas */}
      <ShapeRenderer
        shape={shape}
        width={dimensions.width}
        height={dimensions.height}
        fill={customFill}
        stroke={customStroke}
        strokeWidth={selected ? 2.5 : 1.75}
      />

      {/* 4-Directional Connection Handles */}
      <Handle type="source" position={Position.Top} id="top-src" className="mermaid-handle" style={{ top: -3 }} />
      <Handle type="target" position={Position.Top} id="top-tgt" className="mermaid-handle" style={{ top: -3 }} />

      <Handle type="source" position={Position.Right} id="right-src" className="mermaid-handle" style={{ right: -3 }} />
      <Handle type="target" position={Position.Right} id="right-tgt" className="mermaid-handle" style={{ right: -3 }} />

      <Handle type="source" position={Position.Bottom} id="bottom-src" className="mermaid-handle" style={{ bottom: -3 }} />
      <Handle type="target" position={Position.Bottom} id="bottom-tgt" className="mermaid-handle" style={{ bottom: -3 }} />

      <Handle type="source" position={Position.Left} id="left-src" className="mermaid-handle" style={{ left: -3 }} />
      <Handle type="target" position={Position.Left} id="left-tgt" className="mermaid-handle" style={{ left: -3 }} />

      {/* Quick Sprout Directional Handles */}
      {selected && nodeData.onSprout && (
        <>
          <button
            className="mermaid-sprout-btn sprout-right"
            title="Sprout Right [Tab]"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'right');
            }}
          >
            <PlusIcon size={12} />
          </button>
          <button
            className="mermaid-sprout-btn sprout-down"
            title="Sprout Down"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'down');
            }}
          >
            <PlusIcon size={12} />
          </button>
          <button
            className="mermaid-sprout-btn sprout-left"
            title="Sprout Left"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'left');
            }}
          >
            <PlusIcon size={12} />
          </button>
          <button
            className="mermaid-sprout-btn sprout-up"
            title="Sprout Up"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'up');
            }}
          >
            <PlusIcon size={12} />
          </button>
        </>
      )}

      {/* Label Content / Inline Editor */}
      <div style={{ position: 'relative', zIndex: 5, padding: '0 12px', textAlign: 'center', width: '100%', pointerEvents: 'all' }}>
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
    </div>
  );
};
