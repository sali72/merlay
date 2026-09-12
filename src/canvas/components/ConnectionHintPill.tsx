import React from 'react';
import { CursorMode, Rect } from '../types';
import { LinkIcon } from '../icons/Icons';

export interface ConnectionHintPillProps {
  hoveredNodeRect: Rect | null;
  hoveredNodeId: string | null;
  hoveredNodeKind?: 'start' | 'end' | null;
  isLR: boolean;
  cursorMode: CursorMode;
  isSpacePressed: boolean;
  isConnecting: boolean;
  isEditing: boolean;
  isMultiSelect: boolean;
  isAnchor?: (id: string) => boolean;
}

export const ConnectionHintPill: React.FC<ConnectionHintPillProps> = ({
  hoveredNodeRect,
  hoveredNodeId,
  hoveredNodeKind,
  isLR,
  cursorMode,
  isSpacePressed,
  isConnecting,
  isEditing,
  isMultiSelect,
  isAnchor,
}) => {
  if (
    !hoveredNodeRect ||
    !hoveredNodeId ||
    cursorMode === 'hand' ||
    isSpacePressed ||
    isConnecting ||
    isEditing ||
    isMultiSelect
  ) {
    return null;
  }

  // End anchors have no outgoing transitions in state diagrams
  if (isAnchor && isAnchor(hoveredNodeId) && hoveredNodeKind === 'end') {
    return null;
  }

  // Position above the node by default, or below if too close to the canvas top
  const isTooHigh = hoveredNodeRect.y < 34;
  const posX = hoveredNodeRect.x + hoveredNodeRect.width / 2;
  const posY = isTooHigh
    ? hoveredNodeRect.y + hoveredNodeRect.height + 8
    : hoveredNodeRect.y - 8;

  const transform = isTooHigh ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';

  return (
    <div
      className="mermaid-connect-hint-pill nodrag"
      style={{
        position: 'absolute',
        left: posX,
        top: posY,
        transform,
        zIndex: 120,
        pointerEvents: 'none',
      }}
    >
      <LinkIcon size={12} strokeWidth={2.2} />
      <span>Drag to connect</span>
    </div>
  );
};
