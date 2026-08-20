import React, { useState, useEffect } from 'react';
import { ArrowType } from '../../ast/types';
import {
  ArrowBidirectionalIcon,
  ArrowDottedIcon,
  ArrowOpenIcon,
  ArrowSolidIcon,
  ArrowThickIcon,
  ReverseIcon,
  TrashIcon,
} from '../icons/Icons';

export interface FloatingEdgeToolbarProps {
  currentArrowType: ArrowType;
  currentLabel: string;
  onArrowTypeChange: (type: ArrowType) => void;
  onLabelChange: (label: string) => void;
  onReverse?: () => void;
  onDelete: () => void;
}

const ARROW_TYPES: Array<{
  type: ArrowType;
  label: string;
  renderIcon: () => React.ReactNode;
}> = [
  { type: 'arrow', label: 'Solid Arrow (-->)', renderIcon: () => <ArrowSolidIcon size={15} /> },
  { type: 'dotted', label: 'Dotted Arrow (-.->)', renderIcon: () => <ArrowDottedIcon size={15} /> },
  { type: 'thick', label: 'Thick Arrow (==>)', renderIcon: () => <ArrowThickIcon size={15} /> },
  { type: 'bidirectional', label: 'Bidirectional (<-->)', renderIcon: () => <ArrowBidirectionalIcon size={15} /> },
  { type: 'open', label: 'Solid Line (---)', renderIcon: () => <ArrowOpenIcon size={15} /> },
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
      commitLabel();
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
            {a.renderIcon()}
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
          title="Reverse Connection Direction"
        >
          <ReverseIcon size={14} />
        </button>
      )}

      {/* Inline Label Editor */}
      <input
        type="text"
        className="mermaid-edge-input"
        placeholder="Label..."
        value={localLabel}
        onChange={(e) => setLocalLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={handleKeyDown}
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
        title="Delete Connection (Backspace/Delete)"
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );
};

