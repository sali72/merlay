import React, { useState, useEffect, useRef } from 'react';
import { NodeProps, NodeToolbar, Position } from '@xyflow/react';
import { FlowchartDirection } from '../../ast/types';
import {
  FolderIcon,
  PencilIcon,
  TrashIcon,
  UngroupIcon,
} from '../icons/Icons';

export interface SubgraphNodeData {
  id: string;
  label: string;
  direction?: FlowchartDirection;
  onLabelChange?: (id: string, newLabel: string) => void;
  onDirectionChange?: (id: string, dir: FlowchartDirection | undefined) => void;
  onUngroup?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const SubgraphNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeData = data as unknown as SubgraphNodeData;
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
    if (e.key === 'Enter') handleBlur();
    else if (e.key === 'Escape') {
      setLabel(nodeData.label || id);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`mermaid-subgraph-container ${selected ? 'is-selected' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        background: 'rgba(124, 58, 237, 0.04)',
        border: `2px dashed ${
          selected
            ? 'var(--interactive-accent, #7c3aed)'
            : 'var(--background-modifier-border, #555)'
        }`,
        borderRadius: 8,
        padding: '8px 12px',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 0,
      }}
    >
      {/* Subgraph Floating Context Toolbar */}
      {selected && (
        <NodeToolbar
          isVisible={true}
          position={Position.Top}
          offset={8}
          className="mermaid-floating-toolbar-container nodrag nopan"
        >
          <div className="mermaid-floating-toolbar">
            <button
              type="button"
              className="mermaid-pill-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="Rename Subgraph (Enter)"
            >
              <PencilIcon size={13} />
            </button>

            {nodeData.onUngroup && (
              <button
                type="button"
                className="mermaid-pill-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  nodeData.onUngroup?.(id);
                }}
                title="Ungroup (Keep nodes inside)"
              >
                <UngroupIcon size={14} />
              </button>
            )}

            <div className="mermaid-pill-divider" />

            <button
              type="button"
              className="mermaid-pill-btn delete"
              onClick={(e) => {
                e.stopPropagation();
                nodeData.onDelete?.(id);
              }}
              title="Delete Subgraph (Backspace/Delete)"
            >
              <TrashIcon size={13} />
            </button>
          </div>
        </NodeToolbar>
      )}

      {/* Subgraph Header Badge */}
      <div
        className="mermaid-subgraph-header nodrag"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 600,
          fontSize: '0.82rem',
          color: 'var(--text-normal, #ddd)',
          background: 'var(--background-secondary, #1e1e1e)',
          padding: '3px 10px',
          borderRadius: 6,
          border: '1px solid var(--background-modifier-border, #444)',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
        }}
        onDoubleClick={() => setIsEditing(true)}
      >
        <FolderIcon size={14} className="mermaid-subgraph-icon" />
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="mermaid-node-input nodrag nopan"
            style={{ width: '120px', padding: '1px 4px', fontSize: '0.8rem' }}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span>{label}</span>
        )}
      </div>
    </div>
  );
};

