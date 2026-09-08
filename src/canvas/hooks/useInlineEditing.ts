import { useState, useCallback } from 'react';
import { Rect } from '../types';
import { MermaidEdgeDef, MermaidNodeDef, MermaidSubgraphDef } from '../../diagrams/viewModel';

export interface UseInlineEditingOptions {
  displayNodes: Map<string, MermaidNodeDef>;
  displayEdges: MermaidEdgeDef[];
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  getLocalRect: (el: Element) => Rect | null;
  onCommitNodeLabel: (nodeId: string, newLabel: string) => void;
  onCommitEdgeLabel: (edgeId: string, newLabel: string) => void;
  onCommitSubgraphLabel: (subgraphId: string, newLabel: string) => void;
  onClearOtherSelections: (keepType: 'node' | 'edge' | 'subgraph', id: string) => void;
}

export function useInlineEditing({
  displayNodes,
  displayEdges,
  displaySubgraphs,
  getLocalRect,
  onCommitNodeLabel,
  onCommitEdgeLabel,
  onCommitSubgraphLabel,
  onClearOtherSelections,
}: UseInlineEditingOptions) {
  // Node inline editing
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editNodeLabel, setEditNodeLabel] = useState<string>('');
  const [editingPos, setEditingPos] = useState<Rect | null>(null);

  // Edge inline editing
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editEdgeLabel, setEditEdgeLabel] = useState<string>('');
  const [editingEdgePos, setEditingEdgePos] = useState<Rect | null>(null);

  // Subgraph inline editing
  const [editingSubgraphId, setEditingSubgraphId] = useState<string | null>(null);
  const [editSubgraphLabel, setEditSubgraphLabel] = useState<string>('');
  const [editingSubgraphPos, setEditingSubgraphPos] = useState<Rect | null>(null);

  const startEditingNode = useCallback(
    (nodeId: string, nodeEl: Element) => {
      onClearOtherSelections('node', nodeId);
      setEditingEdgeId(null);
      setEditingSubgraphId(null);

      const rect = getLocalRect(nodeEl);
      if (rect) {
        setEditingPos({
          x: rect.x,
          y: rect.y,
          width: Math.max(90, rect.width),
          height: Math.max(34, rect.height),
        });
      }
      const ndef = displayNodes.get(nodeId);
      setEditNodeLabel(ndef?.label || nodeId);
      setEditingNodeId(nodeId);
    },
    [displayNodes, getLocalRect, onClearOtherSelections]
  );

  const handleFinishEditingNode = useCallback(() => {
    if (editingNodeId) {
      onCommitNodeLabel(editingNodeId, editNodeLabel);
      setEditingNodeId(null);
      setEditingPos(null);
    }
  }, [editingNodeId, editNodeLabel, onCommitNodeLabel]);

  const cancelEditingNode = useCallback(() => {
    setEditingNodeId(null);
    setEditingPos(null);
  }, []);

  const startEditingEdge = useCallback(
    (edgeId: string, anchorEl: Element) => {
      onClearOtherSelections('edge', edgeId);
      setEditingNodeId(null);
      setEditingSubgraphId(null);

      const rect = getLocalRect(anchorEl);
      if (rect) {
        setEditingEdgePos({
          x: rect.x + rect.width / 2 - 70,
          y: rect.y + rect.height / 2 - 16,
          width: Math.max(140, rect.width + 24),
          height: Math.max(32, rect.height + 8),
        });
      }
      const edgeDef = displayEdges.find((e) => e.id === edgeId);
      setEditEdgeLabel(edgeDef?.label || '');
      setEditingEdgeId(edgeId);
    },
    [displayEdges, getLocalRect, onClearOtherSelections]
  );

  const handleFinishEditingEdge = useCallback(() => {
    if (editingEdgeId) {
      onCommitEdgeLabel(editingEdgeId, editEdgeLabel);
      setEditingEdgeId(null);
      setEditingEdgePos(null);
    }
  }, [editingEdgeId, editEdgeLabel, onCommitEdgeLabel]);

  const cancelEditingEdge = useCallback(() => {
    setEditingEdgeId(null);
    setEditingEdgePos(null);
  }, []);

  const startEditingSubgraph = useCallback(
    (subId: string, subEl: Element) => {
      onClearOtherSelections('subgraph', subId);
      setEditingNodeId(null);
      setEditingEdgeId(null);

      const rect = getLocalRect(subEl);
      if (rect) {
        setEditingSubgraphPos({
          x: rect.x + rect.width / 2 - 80,
          y: rect.y + 10,
          width: Math.max(160, Math.min(240, rect.width - 20)),
          height: 30,
        });
      }
      const subDef = displaySubgraphs.get(subId);
      setEditSubgraphLabel(subDef?.label || subId);
      setEditingSubgraphId(subId);
    },
    [displaySubgraphs, getLocalRect, onClearOtherSelections]
  );

  const handleFinishEditingSubgraph = useCallback(() => {
    if (editingSubgraphId) {
      const label = editSubgraphLabel.trim();
      if (label) {
        onCommitSubgraphLabel(editingSubgraphId, label);
      }
      setEditingSubgraphId(null);
      setEditingSubgraphPos(null);
    }
  }, [editingSubgraphId, editSubgraphLabel, onCommitSubgraphLabel]);

  const cancelEditingSubgraph = useCallback(() => {
    setEditingSubgraphId(null);
    setEditingSubgraphPos(null);
  }, []);

  return {
    editingNodeId,
    setEditingNodeId,
    editNodeLabel,
    setEditNodeLabel,
    editingPos,
    setEditingPos,
    startEditingNode,
    handleFinishEditingNode,
    cancelEditingNode,

    editingEdgeId,
    setEditingEdgeId,
    editEdgeLabel,
    setEditEdgeLabel,
    editingEdgePos,
    setEditingEdgePos,
    startEditingEdge,
    handleFinishEditingEdge,
    cancelEditingEdge,

    editingSubgraphId,
    setEditingSubgraphId,
    editSubgraphLabel,
    setEditSubgraphLabel,
    editingSubgraphPos,
    setEditingSubgraphPos,
    startEditingSubgraph,
    handleFinishEditingSubgraph,
    cancelEditingSubgraph,
  };
}
