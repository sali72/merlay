import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MermaidShapeType } from '../../ast/types';
import { ShapeRenderer } from './ShapeRenderer';
import { FloatingNodeToolbar } from '../toolbar/FloatingNodeToolbar';

export interface ShapeNodeData {
  id: string;
  label: string;
  shape: MermaidShapeType;
  style?: Record<string, string>;
  onLabelChange?: (id: string, newLabel: string) => void;
  onShapeChange?: (id: string, newShape: MermaidShapeType) => void;
  onColorChange?: (id: string, color: string) => void;
  onDelete?: (id: string) => void;
}

export const ShapeNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as ShapeNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label || id);
  const [dimensions, setDimensions] = useState({ width: 130, height: 48 });
  const [hoveredSide, setHoveredSide] = useState<'top' | 'right' | 'bottom' | 'left' | null>(null);

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
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width || dimensions.width;
    const h = rect.height || dimensions.height;

    const distTop = y / h;
    const distBottom = (h - y) / h;
    const distLeft = x / w;
    const distRight = (w - x) / w;

    const minDist = Math.min(distTop, distBottom, distLeft, distRight);
    if (minDist === distTop) setHoveredSide('top');
    else if (minDist === distBottom) setHoveredSide('bottom');
    else if (minDist === distLeft) setHoveredSide('left');
    else setHoveredSide('right');
  };

  const handleMouseLeave = () => {
    setHoveredSide(null);
  };

  const customFill = nodeData.style?.fill || 'var(--background-primary, #1e1e1e)';
  const customStroke =
    nodeData.style?.stroke ||
    (selected
      ? 'var(--mermaid-accent, #7c3aed)'
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
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isEditing) {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {/* Obsidian Canvas Style Floating Context Toolbar */}
      {selected && (
        <FloatingNodeToolbar
          currentShape={shape}
          currentColor={nodeData.style?.fill || ''}
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

      {/* 4-Directional Anchors (Proximity Hover & Connection Dragging) */}
      <Handle
        type="source"
        position={Position.Top}
        id="top-src"
        className={`mermaid-handle source ${hoveredSide === 'top' ? 'is-active' : ''}`}
        style={{ zIndex: 3 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-tgt"
        className={`mermaid-handle target ${hoveredSide === 'top' ? 'is-active' : ''}`}
        style={{ zIndex: 2 }}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="right-src"
        className={`mermaid-handle source ${hoveredSide === 'right' ? 'is-active' : ''}`}
        style={{ zIndex: 3 }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-tgt"
        className={`mermaid-handle target ${hoveredSide === 'right' ? 'is-active' : ''}`}
        style={{ zIndex: 2 }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-src"
        className={`mermaid-handle source ${hoveredSide === 'bottom' ? 'is-active' : ''}`}
        style={{ zIndex: 3 }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-tgt"
        className={`mermaid-handle target ${hoveredSide === 'bottom' ? 'is-active' : ''}`}
        style={{ zIndex: 2 }}
      />

      <Handle
        type="source"
        position={Position.Left}
        id="left-src"
        className={`mermaid-handle source ${hoveredSide === 'left' ? 'is-active' : ''}`}
        style={{ zIndex: 3 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-tgt"
        className={`mermaid-handle target ${hoveredSide === 'left' ? 'is-active' : ''}`}
        style={{ zIndex: 2 }}
      />

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


