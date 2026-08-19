import React from 'react';
import { ArrowType } from '../../ast/types';

export interface FloatingEdgeToolbarProps {
  currentArrowType: ArrowType;
  currentLabel: string;
  onArrowTypeChange: (type: ArrowType) => void;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
}

const ARROW_TYPES: Array<{ type: ArrowType; label: string; icon: string }> = [
  { type: 'arrow', label: 'Solid Arrow (-->)', icon: '⟶' },
  { type: 'dotted', label: 'Dotted Arrow (-.->)', icon: '⤍' },
  { type: 'thick', label: 'Thick Arrow (==>)', icon: '⟹' },
  { type: 'bidirectional', label: 'Bidirectional (<-->)', icon: '⟷' },
  { type: 'open', label: 'Solid Line (---)', icon: '―' },
];

export const FloatingEdgeToolbar: React.FC<FloatingEdgeToolbarProps> = ({
  currentArrowType,
  currentLabel,
  onArrowTypeChange,
  onLabelChange,
  onDelete,
}) => {
  return (
    <div className="mermaid-floating-toolbar edge-toolbar">
      {/* Arrow Style Selector */}
      <div className="mermaid-pill-group">
        {ARROW_TYPES.map((a) => (
          <button
            key={a.type}
            className={`mermaid-pill-btn ${currentArrowType === a.type ? 'is-active' : ''}`}
            onClick={() => onArrowTypeChange(a.type)}
            title={a.label}
          >
            {a.icon}
          </button>
        ))}
      </div>

      <div className="mermaid-pill-divider" />

      {/* Inline Label Editor */}
      <input
        type="text"
        className="mermaid-edge-input"
        placeholder="Edge label..."
        value={currentLabel}
        onChange={(e) => onLabelChange(e.target.value)}
      />

      <div className="mermaid-pill-divider" />

      {/* Delete */}
      <button
        className="mermaid-pill-btn delete"
        onClick={onDelete}
        title="Delete Connection"
      >
        🗑️
      </button>
    </div>
  );
};
