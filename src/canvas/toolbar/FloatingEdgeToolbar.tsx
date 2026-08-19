import React, { useState, useEffect } from 'react';
import { ArrowType } from '../../ast/types';
import { TrashIcon, ReverseIcon } from '../icons/Icons';

export interface FloatingEdgeToolbarProps {
  currentArrowType: ArrowType;
  currentLabel: string;
  onArrowTypeChange: (type: ArrowType) => void;
  onLabelChange: (label: string) => void;
  onReverse?: () => void;
  onDelete: () => void;
}

const ARROW_TYPES: Array<{ type: ArrowType; label: string; text: string }> = [
  { type: 'arrow', label: 'Solid Arrow (-->)', text: '⟶' },
  { type: 'dotted', label: 'Dotted Arrow (-.->)', text: '⇢' },
  { type: 'thick', label: 'Thick Arrow (==>)', text: '⟹' },
  { type: 'bidirectional', label: 'Bidirectional (<-->)', text: '⟷' },
  { type: 'open', label: 'Solid Line (---)', text: '―' },
];

export const FloatingEdgeToolbar: React.FC<FloatingEdgeToolbarProps> = ({
  currentArrowType,
  currentLabel,
  onArrowTypeChange,
  onLabelChange,
  onReverse,
  onDelete,
}) => {
  const [localLabel, setLocalLabel] = useState(currentLabel);

  useEffect(() => {
    setLocalLabel(currentLabel);
  }, [currentLabel]);

  const commitLabel = () => {
    if (localLabel.trim() !== currentLabel) {
      onLabelChange(localLabel.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setLocalLabel(currentLabel);
      e.currentTarget.blur();
    }
  };

  return (
    <div className="mermaid-floating-toolbar edge-toolbar nodrag nopan">
      {/* Arrow Style Selector */}
      <div className="mermaid-pill-group">
        {ARROW_TYPES.map((a) => (
          <button
            key={a.type}
            type="button"
            className={`mermaid-pill-btn ${currentArrowType === a.type ? 'is-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onArrowTypeChange(a.type);
            }}
            title={a.label}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{a.text}</span>
          </button>
        ))}
      </div>

      <div className="mermaid-pill-divider" />

      {/* Reverse Direction */}
      {onReverse && (
        <button
          type="button"
          className="mermaid-pill-btn"
          onClick={(e) => {
            e.stopPropagation();
            onReverse();
          }}
          title="Reverse Direction"
        >
          <ReverseIcon size={13} />
        </button>
      )}

      {/* Inline Label Editor */}
      <input
        type="text"
        className="mermaid-edge-input"
        placeholder="Label..."
        value={currentLabel}
        onChange={(e) => onLabelChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />

      <div className="mermaid-pill-divider" />

      {/* Delete */}
      <button
        type="button"
        className="mermaid-pill-btn delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete (Backspace)"
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );
};
