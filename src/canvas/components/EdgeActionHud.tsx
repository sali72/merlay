import React from 'react';
import { ArrowType } from '../../ast/types';
import { ActiveEdgePopover, SelectedEdgePos } from '../types';
import {
  ArrowBidirectionalIcon,
  ArrowDottedIcon,
  ArrowOpenIcon,
  ArrowSolidIcon,
  ArrowThickIcon,
  InsertStepIcon,
  PaletteIcon,
  ReverseIcon,
  TrashIcon,
} from '../icons/Icons';

export interface EdgeActionHudProps {
  selectedEdgeId: string;
  selectedEdgePos: SelectedEdgePos;
  selectedEdgeStyle: Record<string, string> | undefined;
  activeEdgePopover: ActiveEdgePopover;
  onChangeEdgeType: (newType: ArrowType) => void;
  onReverseEdge: () => void;
  onInsertNodeOnEdge: () => void;
  onUpdateEdgeLabel: (label: string) => void;
  onToggleStylePopover: () => void;
  onDeleteEdge: () => void;
}

export const EdgeActionHud: React.FC<EdgeActionHudProps> = ({
  selectedEdgeId,
  selectedEdgePos,
  selectedEdgeStyle,
  activeEdgePopover,
  onChangeEdgeType,
  onReverseEdge,
  onInsertNodeOnEdge,
  onUpdateEdgeLabel,
  onToggleStylePopover,
  onDeleteEdge,
}) => {
  return (
    <div
      className="mermaid-edge-hud nodrag"
      style={{
        position: 'absolute',
        left: selectedEdgePos.x,
        top: selectedEdgePos.y - 12,
        transform: 'translate(-50%, -100%)',
        zIndex: 150,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Arrow Shape Pickers */}
      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          selectedEdgePos.arrowType === 'arrow' ? 'is-active' : ''
        }`}
        onClick={() => onChangeEdgeType('arrow')}
        title="Solid Arrow (-->)"
      >
        <ArrowSolidIcon size={14} />
      </button>

      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          selectedEdgePos.arrowType === 'dotted' ? 'is-active' : ''
        }`}
        onClick={() => onChangeEdgeType('dotted')}
        title="Dotted Arrow (-.->)"
      >
        <ArrowDottedIcon size={14} />
      </button>

      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          selectedEdgePos.arrowType === 'thick' ? 'is-active' : ''
        }`}
        onClick={() => onChangeEdgeType('thick')}
        title="Thick Arrow (==>)"
      >
        <ArrowThickIcon size={14} />
      </button>

      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          selectedEdgePos.arrowType === 'open' ? 'is-active' : ''
        }`}
        onClick={() => onChangeEdgeType('open')}
        title="Open Line (---)"
      >
        <ArrowOpenIcon size={14} />
      </button>

      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          selectedEdgePos.arrowType === 'bidirectional' ? 'is-active' : ''
        }`}
        onClick={() => onChangeEdgeType('bidirectional')}
        title="Bidirectional Arrow (<-->)"
      >
        <ArrowBidirectionalIcon size={14} />
      </button>

      <div className="mermaid-hud-divider" />

      {/* Reverse Direction */}
      <button
        type="button"
        className="mermaid-hud-btn icon-only"
        onClick={onReverseEdge}
        title="Reverse Direction (swap endpoints ⇄)"
      >
        <ReverseIcon size={14} />
      </button>

      {/* Insert Step Between */}
      <button
        type="button"
        className="mermaid-hud-btn insert-step-btn"
        onClick={onInsertNodeOnEdge}
        title="Insert Step Between (splits connection)"
      >
        <InsertStepIcon size={13} />
        <span>Insert Step</span>
      </button>

      <div className="mermaid-hud-divider" />

      {/* Caption Input */}
      <input
        type="text"
        className="mermaid-edge-input"
        placeholder="Caption (e.g. Yes/No)..."
        defaultValue={selectedEdgePos.label || ''}
        key={selectedEdgeId + (selectedEdgePos.label || '')}
        onBlur={(e) => onUpdateEdgeLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onUpdateEdgeLabel((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />

      <div className="mermaid-hud-divider" />

      {/* Arrow Colors & Themes Button */}
      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          activeEdgePopover === 'style' ? 'is-active' : ''
        }`}
        onClick={onToggleStylePopover}
        title="Arrow Colors & Themes"
      >
        <PaletteIcon size={14} />
        {selectedEdgeStyle?.stroke && (
          <span
            className="mermaid-hud-color-indicator"
            style={{ backgroundColor: selectedEdgeStyle.stroke }}
          />
        )}
      </button>

      <div className="mermaid-hud-divider" />

      {/* Delete Edge */}
      <button
        type="button"
        className="mermaid-hud-btn delete-btn icon-only"
        onClick={onDeleteEdge}
        title="Delete connection"
      >
        <TrashIcon size={13} />
      </button>
    </div>
  );
};
