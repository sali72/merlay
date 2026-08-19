import React from 'react';
import { ArrowType } from '../../ast/types';
import { TrashIcon } from '../icons/Icons';

export interface FloatingEdgeToolbarProps {
  currentArrowType: ArrowType;
  currentLabel: string;
  onArrowTypeChange: (type: ArrowType) => void;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
}

const ARROW_TYPES: Array<{ type: ArrowType; label: string; text: string }> = [
  { type: 'arrow', label: 'Solid Arrow (-->)', text: '⟶' },
  { type: 'dotted', label: 'Dotted Arrow (-.->)', text: '⤍' },
  { type: 'thick', label: 'Thick Arrow (==>)', text: '⟹' },
  { type: 'bidirectional', label: 'Bidirectional (<-->)', text: '⟷' },
  { type: 'open', label: 'Solid Line (---)', text: '―' },
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
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{a.text}</span>
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
        <TrashIcon size={14} />
      </button>
    </div>
  );
};
