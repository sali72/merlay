/**
 * Hook for Subgraph / Group operations (creation, dissolve, deletion, rename, membership, styling).
 */

import { useCallback } from 'react';
import {
  addNode,
  clearSubgraphStyle,
  createSubgraph,
  deleteSubgraph,
  getSubgraphStyle,
  moveNodeToSubgraph,
  renameSubgraph,
  updateSubgraphStyle,
} from '../../../ast/mutations';
import { MermaidFlowchartAST } from '../../../ast/types';
import { MermaidStateAST } from '../../../diagrams/state/types';
import * as stateMutations from '../../../diagrams/state/mutations';
import { ThemePreset } from '../../constants';

export interface UseSubgraphMutationsOptions {
  isStateDiagram: boolean;
  applyAstMutation: (mutator: (currentAst: MermaidFlowchartAST) => void, keepNodeId?: string) => void;
  applyStateAstMutation: (mutator: (currentAst: MermaidStateAST) => void, keepNodeId?: string) => void;
  selectedSubgraphId: string | null;
  setSelectedSubgraphId: (id: string | null) => void;
  setSelectedSubgraphRect: (rect: any) => void;
  setActiveSubgraphPopover: (p: any) => void;
}

export function useSubgraphMutations({
  isStateDiagram,
  applyAstMutation,
  applyStateAstMutation,
  selectedSubgraphId,
  setSelectedSubgraphId,
  setSelectedSubgraphRect,
  setActiveSubgraphPopover,
}: UseSubgraphMutationsOptions) {
  const handleAddGroup = useCallback(() => {
    if (isStateDiagram) {
      applyStateAstMutation((currentAst) => {
        const compId = stateMutations.createCompositeState(currentAst, 'Composite State');
        stateMutations.addState(currentAst, 'State 1', 'normal', compId);
      });
      return;
    }
    applyAstMutation((currentAst) => {
      const newNodeId = addNode(currentAst, 'Step 1');
      createSubgraph(currentAst, 'New Group', [newNodeId]);
    });
  }, [isStateDiagram, applyStateAstMutation, applyAstMutation]);

  const handleApplySubgraphPreset = useCallback(
    (preset: ThemePreset) => {
      if (!selectedSubgraphId) return;
      const target = selectedSubgraphId;

      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          if (!preset.fill && !preset.stroke && !preset.color) {
            stateMutations.clearCompositeStateStyle(a, target);
          } else {
            const styles: Record<string, string> = {};
            if (preset.fill) styles['fill'] = preset.fill;
            if (preset.stroke) styles['stroke'] = preset.stroke;
            if (preset.color) styles['color'] = preset.color;
            stateMutations.updateCompositeStateStyle(a, target, styles);
          }
        });
        return;
      }

      applyAstMutation((a) => {
        if (!preset.fill && !preset.stroke && !preset.color) {
          clearSubgraphStyle(a, target);
        } else {
          const styles: Record<string, string> = {};
          if (preset.fill) styles['fill'] = preset.fill;
          if (preset.stroke) styles['stroke'] = preset.stroke;
          if (preset.color) styles['color'] = preset.color;
          updateSubgraphStyle(a, target, styles);
        }
      });
    },
    [selectedSubgraphId, isStateDiagram, applyStateAstMutation, applyAstMutation]
  );

  const handleUpdateSubgraphCustomStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedSubgraphId) return;
      const target = selectedSubgraphId;

      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          const currentStyle = stateMutations.getCompositeStateStyle(a, target) || {};
          const updated = { ...currentStyle };
          if (value) {
            updated[property] = value;
          } else {
            delete updated[property];
          }
          stateMutations.updateCompositeStateStyle(a, target, updated);
        });
        return;
      }

      applyAstMutation((a) => {
        const currentStyle = getSubgraphStyle(a, target) || {};
        const updated = { ...currentStyle };
        if (value) {
          updated[property] = value;
        } else {
          delete updated[property];
        }
        updateSubgraphStyle(a, target, updated);
      });
    },
    [selectedSubgraphId, isStateDiagram, applyStateAstMutation, applyAstMutation]
  );

  const handleClearSubgraphStyle = useCallback(() => {
    if (!selectedSubgraphId) return;

    if (isStateDiagram) {
      applyStateAstMutation((a) => {
        stateMutations.clearCompositeStateStyle(a, selectedSubgraphId);
      });
      return;
    }

    applyAstMutation((a) => {
      clearSubgraphStyle(a, selectedSubgraphId);
    });
  }, [selectedSubgraphId, isStateDiagram, applyStateAstMutation, applyAstMutation]);

  const handleDissolveSubgraph = useCallback(() => {
    if (!selectedSubgraphId) return;
    if (isStateDiagram) {
      applyStateAstMutation((currentAst) => {
        stateMutations.deleteCompositeState(currentAst, selectedSubgraphId, false);
      });
    } else {
      applyAstMutation((currentAst) => {
        deleteSubgraph(currentAst, selectedSubgraphId, false);
      });
    }
    setSelectedSubgraphId(null);
    setSelectedSubgraphRect(null);
    setActiveSubgraphPopover(null);
  }, [
    selectedSubgraphId,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    setActiveSubgraphPopover,
  ]);

  const handleDeleteSubgraphAll = useCallback(() => {
    if (!selectedSubgraphId) return;
    if (isStateDiagram) {
      applyStateAstMutation((currentAst) => {
        stateMutations.deleteCompositeState(currentAst, selectedSubgraphId, true);
      });
    } else {
      applyAstMutation((currentAst) => {
        deleteSubgraph(currentAst, selectedSubgraphId, true);
      });
    }
    setSelectedSubgraphId(null);
    setSelectedSubgraphRect(null);
    setActiveSubgraphPopover(null);
  }, [
    selectedSubgraphId,
    isStateDiagram,
    applyStateAstMutation,
    applyAstMutation,
    setSelectedSubgraphId,
    setSelectedSubgraphRect,
    setActiveSubgraphPopover,
  ]);

  const handleRenameSubgraph = useCallback(
    (subId: string, label: string) => {
      if (isStateDiagram) {
        applyStateAstMutation((a) => {
          stateMutations.renameCompositeState(a, subId, label);
        });
      } else {
        applyAstMutation((a) => {
          renameSubgraph(a, subId, label);
        });
      }
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation]
  );

  const handleMoveNodeToSubgraph = useCallback(
    (nodeId: string, subId: string | null) => {
      if (isStateDiagram) {
        applyStateAstMutation((currentAst) => {
          stateMutations.moveStateToComposite(currentAst, nodeId, subId || undefined);
        }, nodeId);
      } else {
        applyAstMutation((currentAst) => {
          moveNodeToSubgraph(currentAst, nodeId, subId);
        }, nodeId);
      }
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation]
  );

  const handleCreateGroupWithNode = useCallback(
    (nodeId: string) => {
      if (isStateDiagram) {
        applyStateAstMutation((currentAst) => {
          const compId = stateMutations.createCompositeState(currentAst, 'Composite State');
          stateMutations.moveStateToComposite(currentAst, nodeId, compId);
        }, nodeId);
      } else {
        applyAstMutation((currentAst) => {
          createSubgraph(currentAst, 'New Group', [nodeId]);
        }, nodeId);
      }
    },
    [isStateDiagram, applyStateAstMutation, applyAstMutation]
  );

  return {
    handleAddGroup,
    handleApplySubgraphPreset,
    handleUpdateSubgraphCustomStyle,
    handleClearSubgraphStyle,
    handleDissolveSubgraph,
    handleDeleteSubgraphAll,
    handleRenameSubgraph,
    handleMoveNodeToSubgraph,
    handleCreateGroupWithNode,
  };
}
