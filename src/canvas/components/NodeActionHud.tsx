import React from 'react';
import { MermaidNodeDef } from '../../ast/types';
import { ActiveNodePopover } from '../types';
import {
  PlusIcon,
  PencilIcon,
  PaletteIcon,
  TrashIcon,
  ShapeIcons,
} from '../icons/Icons';

export interface NodeActionHudProps {
  selectedNodeId: string;
  sproutX: number;
  sproutY: number;
  isLR: boolean;
  currentNode: MermaidNodeDef | undefined;
  currentStyle: Record<string, string> | undefined;
  activeNodePopover: ActiveNodePopover;
  onSproutNextStep: () => void;
  onRename: () => void;
  onTogglePopover: (popover: 'shape' | 'style') => void;
  onDelete: () => void;
}

export const NodeActionHud: React.FC<NodeActionHudProps> = ({
  sproutX,
  sproutY,
  isLR,
  currentNode,
  currentStyle,
  activeNodePopover,
  onSproutNextStep,
  onRename,
  onTogglePopover,
  onDelete,
}) => {
  const ShapeComp =
    currentNode && ShapeIcons[currentNode.shape as keyof typeof ShapeIcons]
      ? ShapeIcons[currentNode.shape as keyof typeof ShapeIcons]
      : ShapeIcons.rectangle;

  return (
    <div
      className="mermaid-action-hud nodrag"
      style={{
        position: 'absolute',
        left: sproutX,
        top: sproutY,
        transform: isLR ? 'translate(0, -50%)' : 'translate(-50%, 0)',
        zIndex: 150,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="mermaid-hud-btn sprout-btn"
        onClick={onSproutNextStep}
        title="Sprout Next Step (creates connected child)"
      >
        <PlusIcon size={13} />
        <span>Next Step</span>
      </button>

      <button
        type="button"
        className="mermaid-hud-btn icon-only"
        onClick={onRename}
        title="Rename Step"
      >
        <PencilIcon size={13} />
      </button>

      {/* Shape Picker Button */}
      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          activeNodePopover === 'shape' ? 'is-active' : ''
        }`}
        onClick={() => onTogglePopover('shape')}
        title="Change Shape"
      >
        <ShapeComp size={14} />
      </button>

      {/* Visual Style & Color Button */}
      <button
        type="button"
        className={`mermaid-hud-btn icon-only ${
          activeNodePopover === 'style' ? 'is-active' : ''
        }`}
        onClick={() => onTogglePopover('style')}
        title="Colors & Border Style"
      >
        <PaletteIcon size={14} />
        {currentStyle?.fill && (
          <span
            className="mermaid-hud-color-indicator"
            style={{ backgroundColor: currentStyle.fill }}
          />
        )}
      </button>

      <div className="mermaid-hud-divider" />

      <button
        type="button"
        className="mermaid-hud-btn delete-btn icon-only"
        onClick={onDelete}
        title="Delete Step (and connections)"
      >
        <TrashIcon size={13} />
      </button>
    </div>
  );
};
