/**
 * Overlays for Direct-Manipulation Inline Text Editing on Nodes, Edges, and Subgraphs.
 */

import React from 'react';
import { Rect } from '../types';

export interface InlineEditOverlaysProps {
  editingNodeId: string | null;
  editingPos: Rect | null;
  editNodeLabel: string;
  onEditNodeLabelChange: (val: string) => void;
  onFinishEditingNode: () => void;
  onCancelEditingNode: () => void;

  editingEdgeId: string | null;
  editingEdgePos: Rect | null;
  editEdgeLabel: string;
  onEditEdgeLabelChange: (val: string) => void;
  onFinishEditingEdge: () => void;
  onCancelEditingEdge: () => void;

  editingSubgraphId: string | null;
  editingSubgraphPos: Rect | null;
  editSubgraphLabel: string;
  onEditSubgraphLabelChange: (val: string) => void;
  onFinishEditingSubgraph: () => void;
  onCancelEditingSubgraph: () => void;
}

export const InlineEditOverlays: React.FC<InlineEditOverlaysProps> = ({
  editingNodeId,
  editingPos,
  editNodeLabel,
  onEditNodeLabelChange,
  onFinishEditingNode,
  onCancelEditingNode,

  editingEdgeId,
  editingEdgePos,
  editEdgeLabel,
  onEditEdgeLabelChange,
  onFinishEditingEdge,
  onCancelEditingEdge,

  editingSubgraphId,
  editingSubgraphPos,
  editSubgraphLabel,
  onEditSubgraphLabelChange,
  onFinishEditingSubgraph,
  onCancelEditingSubgraph,
}) => {
  return (
    <>
      {/* Inline Edge Caption Editor Overlay */}
      {editingEdgeId && editingEdgePos && (
        <input
          autoFocus
          className="mermaid-inline-edge-input nodrag"
          style={{
            position: 'absolute',
            left: editingEdgePos.x,
            top: editingEdgePos.y,
            width: editingEdgePos.width,
            height: editingEdgePos.height,
            zIndex: 200,
          }}
          value={editEdgeLabel}
          placeholder="Caption..."
          onChange={(e) => onEditEdgeLabelChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFinishEditingEdge();
            if (e.key === 'Escape') onCancelEditingEdge();
          }}
          onBlur={onFinishEditingEdge}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Inline Subgraph Label Editor Overlay */}
      {editingSubgraphId && editingSubgraphPos && (
        <input
          autoFocus
          className="mermaid-inline-node-input nodrag"
          style={{
            position: 'absolute',
            left: editingSubgraphPos.x,
            top: editingSubgraphPos.y,
            width: editingSubgraphPos.width,
            height: editingSubgraphPos.height,
            zIndex: 220,
          }}
          value={editSubgraphLabel}
          onChange={(e) => onEditSubgraphLabelChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFinishEditingSubgraph();
            if (e.key === 'Escape') onCancelEditingSubgraph();
          }}
          onBlur={onFinishEditingSubgraph}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Inline Node Label Editor Overlay */}
      {editingNodeId && editingPos && (
        <input
          autoFocus
          className="mermaid-inline-node-input nodrag"
          style={{
            position: 'absolute',
            left: editingPos.x,
            top: editingPos.y,
            width: editingPos.width,
            height: editingPos.height,
            zIndex: 200,
          }}
          value={editNodeLabel}
          onChange={(e) => onEditNodeLabelChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFinishEditingNode();
            if (e.key === 'Escape') onCancelEditingNode();
          }}
          onBlur={onFinishEditingNode}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </>
  );
};
