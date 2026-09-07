import React from 'react';
import { MermaidNodeDef, MermaidShapeType } from '../../ast/types';
import { PopoverPos } from '../types';
import { SHAPE_OPTIONS } from '../constants';
import { ShapeIcons } from '../icons/Icons';

export interface ShapePopoverProps {
  popoverPos: PopoverPos | null;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  astNodes: Map<string, MermaidNodeDef>;
  onSelectShape: (shape: MermaidShapeType) => void;
}

export const ShapePopover: React.FC<ShapePopoverProps> = ({
  popoverPos,
  selectedNodeId,
  selectedNodeIds,
  astNodes,
  onSelectShape,
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
      {SHAPE_OPTIONS.map((shape) => {
        const IconComp =
          ShapeIcons[shape.type as keyof typeof ShapeIcons] || ShapeIcons.rectangle;
        const isCurrent = selectedNodeId
          ? astNodes.get(selectedNodeId)?.shape === shape.type
          : selectedNodeIds.size > 0 &&
            Array.from(selectedNodeIds).every(
              (id) => astNodes.get(id)?.shape === shape.type
            );

        return (
          <button
            key={shape.type}
            type="button"
            className={`mermaid-shape-item-btn ${isCurrent ? 'is-active' : ''}`}
            onClick={() => onSelectShape(shape.type)}
          >
            <span className="mermaid-shape-item-icon">
              <IconComp size={15} />
            </span>
            <span>{shape.label}</span>
          </button>
        );
      })}
    </div>
  );
};
