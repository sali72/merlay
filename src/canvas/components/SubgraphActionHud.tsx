import React from 'react';
import { MermaidSubgraphDef } from '../../ast/types';
import { PencilIcon, TrashIcon, UngroupIcon } from '../icons/Icons';

export interface SubgraphActionHudProps {
  subgraph: MermaidSubgraphDef;
  centerX: number;
  topY: number;
  onRename: () => void;
  onDissolve: () => void;
  onDeleteAll: () => void;
}

export const SubgraphActionHud: React.FC<SubgraphActionHudProps> = ({
  subgraph,
  centerX,
  topY,
  onRename,
  onDissolve,
  onDeleteAll,
}) => {
  return (
    <div
      className="mermaid-subgraph-hud nodrag"
      style={{
        position: 'absolute',
        left: centerX,
        top: topY - 12,
        transform: 'translate(-50%, -100%)',
        zIndex: 150,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mermaid-subgraph-badge" title={`Subgraph: ${subgraph.id}`}>
        <span>{subgraph.label || subgraph.id}</span>
      </div>

      <button
        type="button"
        className="mermaid-hud-btn icon-only"
        onClick={onRename}
        title="Rename Group"
      >
        <PencilIcon size={13} />
      </button>

      <button
        type="button"
        className="mermaid-hud-btn icon-only"
        onClick={onDissolve}
        title="Dissolve Group (keep inner steps)"
      >
        <UngroupIcon size={14} />
      </button>

      <div className="mermaid-hud-divider" />

      <button
        type="button"
        className="mermaid-hud-btn delete-btn icon-only"
        onClick={onDeleteAll}
        title="Delete Group & inner steps"
      >
        <TrashIcon size={13} />
      </button>
    </div>
  );
};
