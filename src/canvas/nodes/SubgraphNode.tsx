import React, { useState, useEffect, useRef } from 'react';
import { NodeProps } from '@xyflow/react';

export interface SubgraphNodeData {
  id: string;
  label: string;
  onLabelChange?: (id: string, newLabel: string) => void;
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
        background: 'rgba(255, 255, 255, 0.03)',
        border: `2px dashed ${selected ? 'var(--interactive-accent, #7c3aed)' : 'var(--background-modifier-border, #555)'}`,
        borderRadius: 8,
        padding: '8px 12px',
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}
    >
      <div
        className="mermaid-subgraph-header"
        style={{
          pointerEvents: 'auto',
          display: 'inline-block',
          fontWeight: 600,
          fontSize: '0.85rem',
          color: 'var(--text-muted, #888)',
          background: 'var(--background-primary, #1e1e1e)',
          padding: '2px 8px',
          borderRadius: 4,
          border: '1px solid var(--background-modifier-border, #444)',
        }}
        onDoubleClick={() => setIsEditing(true)}
      >
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
          <span>📦 {label}</span>
        )}
      </div>
    </div>
  );
};
