import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MermaidShapeType } from '../../ast/types';
import { ShapeRenderer } from './ShapeRenderer';
import { FloatingNodeToolbar } from '../toolbar/FloatingNodeToolbar';
import { PlusIcon } from '../icons/Icons';

export interface ShapeNodeData {
  id: string;
  label: string;
  shape: MermaidShapeType;
  style?: Record<string, string>;
  onLabelChange?: (id: string, newLabel: string) => void;
  onSprout?: (sourceId: string, direction: 'right' | 'down' | 'left' | 'up') => void;
  onShapeChange?: (id: string, newShape: MermaidShapeType) => void;
  onColorChange?: (id: string, color: string) => void;
  onDelete?: (id: string) => void;
}

export const ShapeNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as ShapeNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label || id);
  const [dimensions, setDimensions] = useState({ width: 130, height: 48 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const shape = nodeData.shape || 'rectangle';

  useEffect(() => {
    setLabel(nodeData.label || id);
  }, [nodeData.label, id]);

  useEffect(() => {
    const textLen = label.length;

    if (shape === 'circle') {
      const diameter = Math.max(76, Math.min(160, Math.max(textLen * 9 + 28, 76)));
      setDimensions({ width: diameter, height: diameter });
    } else if (shape === 'diamond') {
      const w = Math.max(140, textLen * 10.5 + 44);
      const h = Math.max(72, Math.round(w * 0.58));
      setDimensions({ width: w, height: h });
    } else if (shape === 'hexagon') {
      const w = Math.max(130, textLen * 9.5 + 50);
      setDimensions({ width: w, height: 48 });
    } else if (shape === 'cylinder') {
      const w = Math.max(120, textLen * 8.5 + 36);
      setDimensions({ width: w, height: 56 });
    } else {
      const w = Math.max(110, textLen * 8.5 + 32);
      setDimensions({ width: w, height: 48 });
    }
  }, [label, shape]);

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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

  const customFill = nodeData.style?.fill || 'var(--background-primary, #1e1e1e)';
  const customStroke =
    nodeData.style?.stroke ||
    (selected
      ? 'var(--interactive-accent, #7c3aed)'
      : 'var(--canvas-card-border, var(--background-modifier-border, #3a3a3a))');
  const customColor = nodeData.style?.color || 'var(--text-normal, #e0e0e0)';

  return (
    <div
      ref={containerRef}
      className={`mermaid-shape-node-wrapper ${selected ? 'is-selected' : ''}`}
      style={{
        position: 'relative',
        width: dimensions.width,
        height: dimensions.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: customColor,
        background: 'transparent',
        zIndex: selected ? 999 : 1,
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
      {/* Obsidian Canvas Style Floating Context Toolbar */}
      {selected && (
        <FloatingNodeToolbar
          currentShape={shape}
          onShapeChange={(newShape) => nodeData.onShapeChange?.(id, newShape)}
          onColorChange={(color) => nodeData.onColorChange?.(id, color)}
          onDelete={() => nodeData.onDelete?.(id)}
        />
      )}

      {/* Crisp Vector Shape Canvas */}
      <ShapeRenderer
        shape={shape}
        width={dimensions.width}
        height={dimensions.height}
        fill={customFill}
        stroke={customStroke}
        strokeWidth={selected ? 2 : 1.25}
      />

      {/* Non-Conflicting 4-Directional Anchors (Source z-index: 3, Target z-index: 2) */}
      <Handle
        type="source"
        position={Position.Top}
        id="top-src"
        className="mermaid-handle source"
        style={{ top: -4, zIndex: 3 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-tgt"
        className="mermaid-handle target"
        style={{ top: -4, zIndex: 2 }}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="right-src"
        className="mermaid-handle source"
        style={{ right: -4, zIndex: 3 }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-tgt"
        className="mermaid-handle target"
        style={{ right: -4, zIndex: 2 }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-src"
        className="mermaid-handle source"
        style={{ bottom: -4, zIndex: 3 }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-tgt"
        className="mermaid-handle target"
        style={{ bottom: -4, zIndex: 2 }}
      />

      <Handle
        type="source"
        position={Position.Left}
        id="left-src"
        className="mermaid-handle source"
        style={{ left: -4, zIndex: 3 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-tgt"
        className="mermaid-handle target"
        style={{ left: -4, zIndex: 2 }}
      />

      {/* Quick Sprout Directional Handles */}
      {selected && nodeData.onSprout && (
        <>
          <button
            type="button"
            className="mermaid-sprout-btn sprout-right"
            title="Sprout Right [Tab]"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'right');
            }}
          >
            <PlusIcon size={11} />
          </button>
          <button
            type="button"
            className="mermaid-sprout-btn sprout-down"
            title="Sprout Down"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'down');
            }}
          >
            <PlusIcon size={11} />
          </button>
          <button
            type="button"
            className="mermaid-sprout-btn sprout-left"
            title="Sprout Left"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'left');
            }}
          >
            <PlusIcon size={11} />
          </button>
          <button
            type="button"
            className="mermaid-sprout-btn sprout-up"
            title="Sprout Up"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSprout?.(id, 'up');
            }}
          >
            <PlusIcon size={11} />
          </button>
        </>
      )}

      {/* Label Content with multi-line wrap support */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          padding: shape === 'diamond' ? '0 24px' : '0 12px',
          textAlign: 'center',
          maxWidth: '92%',
          pointerEvents: 'all',
        }}
      >
        {isEditing ? (
          <textarea
            ref={inputRef}
            className="mermaid-node-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            rows={label.includes('\n') ? 2 : 1}
          />
        ) : (
          <span className="mermaid-node-label">{label}</span>
        )}
      </div>
    </div>
  );
};
