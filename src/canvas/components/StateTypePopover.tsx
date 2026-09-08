import React from 'react';
import { MermaidStateDef, MermaidStateType } from '../../diagrams/state/types';
import { PopoverPos } from '../types';
import { StateTypeIcons } from '../icons/Icons';

export interface StateTypeOption {
  type: MermaidStateType;
  label: string;
}

export const STATE_TYPE_OPTIONS: StateTypeOption[] = [
  { type: 'normal', label: 'Normal State' },
  { type: 'choice', label: 'Choice <<choice>>' },
  { type: 'fork', label: 'Fork <<fork>>' },
  { type: 'join', label: 'Join <<join>>' },
];

export interface StateTypePopoverProps {
  popoverPos: PopoverPos | null;
  selectedStateId: string | null;
  currentState: MermaidStateDef | undefined;
  onSelectStateType: (stateType: MermaidStateType) => void;
}

export const StateTypePopover: React.FC<StateTypePopoverProps> = ({
  popoverPos,
  currentState,
  onSelectStateType,
}) => {
  if (!popoverPos) return null;

  return (
    <div
      className="mermaid-popover-menu mermaid-shape-popover nodrag"
      style={{
        position: 'absolute',
        left: popoverPos.left,
        top: popoverPos.top,
        transform: popoverPos.transform,
        zIndex: 200,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          padding: '6px 10px 4px',
          fontSize: '11px',
          fontWeight: 600,
          opacity: 0.65,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        State Type
      </div>
      {STATE_TYPE_OPTIONS.map((opt) => {
        const IconComp = StateTypeIcons[opt.type] || StateTypeIcons.normal;
        const isCurrent = currentState?.stateType === opt.type;

        return (
          <button
            key={opt.type}
            type="button"
            className={`mermaid-shape-item-btn ${isCurrent ? 'is-active' : ''}`}
            onClick={() => onSelectStateType(opt.type)}
          >
            <span className="mermaid-shape-item-icon">
              <IconComp size={15} />
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
