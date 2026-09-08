import React from 'react';
import { MermaidNodeDef } from '../../ast/types';
import { ActiveNodePopover } from '../types';
import {
  PlusIcon,
  PencilIcon,
  PaletteIcon,
  FolderIcon,
  TrashIcon,
  ShapeIcons,
} from '../icons/Icons';

import { SupportedDiagramType } from '../../diagrams/types';
import { MermaidStateType } from '../../diagrams/state/types';
import { StateTypeIcons } from '../icons/Icons';

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
  onTogglePopover: (popover: 'shape' | 'style' | 'subgraph') => void;
  onDelete: () => void;
  diagramType?: SupportedDiagramType;
  stateType?: MermaidStateType;
  canRenameState?: boolean;
  hideSprout?: boolean;
  hideDelete?: boolean;
}

export const NodeActionHud: React.FC<NodeActionHudProps> = ({
  selectedNodeId,
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
  diagramType = 'flowchart',
  stateType,
  canRenameState,
  hideSprout = false,
  hideDelete = false,
}) => {
  const isStateDiagram = diagramType === 'stateDiagram';
  const isStartEndAnchor = isStateDiagram && selectedNodeId === '[*]';
  const canRename = isStateDiagram ? (canRenameState ?? !isStartEndAnchor) : !isStartEndAnchor;
  const ShapeComp = isStateDiagram
    ? StateTypeIcons[stateType || 'normal'] || StateTypeIcons.normal
    : currentNode && ShapeIcons[currentNode.shape as keyof typeof ShapeIcons]
    ? ShapeIcons[currentNode.shape as keyof typeof ShapeIcons]
    : ShapeIcons.rectangle;

  const sproutLabel = isStateDiagram ? 'Next State' : 'Next Step';
  const sproutTitle = isStateDiagram
    ? 'Sprout Next State (creates connected child)'
    : 'Sprout Next Step (creates connected child)';
  const deleteTitle = isStateDiagram
    ? 'Delete State (and transitions)'
    : 'Delete Step (and connections)';

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
      {!hideSprout && (
        <button
          type="button"
          className="mermaid-hud-btn sprout-btn"
          onClick={onSproutNextStep}
          title={sproutTitle}
        >
          <PlusIcon size={13} />
          <span>{sproutLabel}</span>
        </button>
      )}

      {/* Rename Button (only normal states carry text) */}
      {(!isStateDiagram && !isStartEndAnchor) || (isStateDiagram && canRename) ? (
        <button
          type="button"
          className="mermaid-hud-btn icon-only"
          onClick={onRename}
          title={isStateDiagram ? 'Rename State' : 'Rename Step'}
        >
          <PencilIcon size={13} />
        </button>
      ) : null}

      {/* Shape / Type Picker Button (Hidden for [*]) */}
      {!isStartEndAnchor && (
        <button
          type="button"
          className={`mermaid-hud-btn icon-only ${
            activeNodePopover === 'shape' ? 'is-active' : ''
          }`}
          onClick={() => onTogglePopover('shape')}
          title={isStateDiagram ? 'Change State Type (Choice, Fork, Join, etc.)' : 'Change Shape'}
        >
          <ShapeComp size={14} />
        </button>
      )}

      {/* Visual Style & Color Button (Hidden for [*]) */}
      {!isStartEndAnchor && (
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
      )}

      {/* Subgraph / Composite Assignment Button (Hidden for [*]) */}
      {!isStartEndAnchor && (
        <button
          type="button"
          className={`mermaid-hud-btn icon-only ${
            activeNodePopover === 'subgraph' ? 'is-active' : ''
          }`}
          onClick={() => onTogglePopover('subgraph')}
          title={
            currentNode?.subgraphId
              ? `${isStateDiagram ? 'Composite' : 'Group'}: ${currentNode.subgraphId} (Click to change)`
              : isStateDiagram
              ? 'Assign to Composite State'
              : 'Assign to Group / Subgraph'
          }
        >
          <FolderIcon size={14} />
        </button>
      )}

      {!hideDelete && (
        <>
          <div className="mermaid-hud-divider" />

          <button
            type="button"
            className="mermaid-hud-btn delete-btn icon-only"
            onClick={onDelete}
            title={deleteTitle}
          >
            <TrashIcon size={13} />
          </button>
        </>
      )}
    </div>
  );
};
