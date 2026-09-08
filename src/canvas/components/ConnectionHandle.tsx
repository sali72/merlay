import React from 'react';
import { CursorMode, Rect } from '../types';

export interface ConnectionHandleProps {
  hoveredNodeRect: Rect | null;
  isLR: boolean;
  cursorMode: CursorMode;
  isSpacePressed: boolean;
  hidden?: boolean;
  onStartConnect: (e: React.MouseEvent, startX: number, startY: number) => void;
}

export const ConnectionHandle: React.FC<ConnectionHandleProps> = ({
  hoveredNodeRect,
  isLR,
  cursorMode,
  isSpacePressed,
  hidden = false,
  onStartConnect,
}) => {
  if (!hoveredNodeRect || cursorMode === 'hand' || isSpacePressed || hidden) {
    return null;
  }

  const posX = isLR
    ? hoveredNodeRect.x + hoveredNodeRect.width
    : hoveredNodeRect.x + hoveredNodeRect.width / 2;

  const posY = isLR
    ? hoveredNodeRect.y + hoveredNodeRect.height / 2
    : hoveredNodeRect.y + hoveredNodeRect.height;

  return (
    <div
      className="mermaid-connection-handle nodrag"
      style={{
        position: 'absolute',
        left: posX,
        top: posY,
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
      }}
      onMouseDown={(e) => onStartConnect(e, posX, posY)}
      title="Drag to connect with another step"
    />
  );
};
