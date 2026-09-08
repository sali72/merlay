/**
 * Overlays for Selected Subgraphs: Subgraph Action HUD, Style Popover, and Fallback Chips Bar.
 */

import React from 'react';
import { PopoverPos, Rect } from '../types';
import { ThemePreset } from '../constants';
import { MermaidSubgraphDef } from '../../ast/types';
import { SubgraphActionHud } from '../components/SubgraphActionHud';
import { NodeStylePopover } from '../components/NodeStylePopover';

export interface SubgraphOverlaysProps {
  selectedSubgraphRect: Rect | null;
  selectedSubgraphId: string | null;
  isMultiSelect: boolean;
  displaySubgraphs: Map<string, MermaidSubgraphDef>;
  selectedSubgraphStyle: Record<string, string> | undefined;
  activeSubgraphPopover: 'style' | null;
  onToggleSubgraphStyle: () => void;
  onStartEditingSubgraph: (subId: string) => void;
  onDissolveSubgraph: () => void;
  onDeleteSubgraphAll: () => void;
  subgraphPopoverPos: PopoverPos | null;
  onApplySubgraphPreset: (preset: ThemePreset) => void;
  onUpdateSubgraphCustomStyle: (prop: string, val: string) => void;
  onClearSubgraphStyle: () => void;
  unmatchedSubgraphIds: string[];
  onSelectUnmatchedSubgraph: (subId: string, idx: number) => void;
}

export const SubgraphOverlays: React.FC<SubgraphOverlaysProps> = ({
  selectedSubgraphRect,
  selectedSubgraphId,
  isMultiSelect,
  displaySubgraphs,
  selectedSubgraphStyle,
  activeSubgraphPopover,
  onToggleSubgraphStyle,
  onStartEditingSubgraph,
  onDissolveSubgraph,
  onDeleteSubgraphAll,
  subgraphPopoverPos,
  onApplySubgraphPreset,
  onUpdateSubgraphCustomStyle,
  onClearSubgraphStyle,
  unmatchedSubgraphIds,
  onSelectUnmatchedSubgraph,
}) => {
  return (
    <>
      {/* Subgraph Floating Action HUD */}
      {selectedSubgraphRect &&
        selectedSubgraphId &&
        displaySubgraphs.has(selectedSubgraphId) &&
        !isMultiSelect && (
          <SubgraphActionHud
            subgraph={displaySubgraphs.get(selectedSubgraphId)!}
            centerX={selectedSubgraphRect.x + selectedSubgraphRect.width / 2}
            topY={selectedSubgraphRect.y}
            currentStyle={selectedSubgraphStyle}
            isStyleActive={activeSubgraphPopover === 'style'}
            onToggleStyle={onToggleSubgraphStyle}
            onRename={() => onStartEditingSubgraph(selectedSubgraphId)}
            onDissolve={onDissolveSubgraph}
            onDeleteAll={onDeleteSubgraphAll}
          />
        )}

      {/* Subgraph Style Popover */}
      {activeSubgraphPopover === 'style' &&
        subgraphPopoverPos &&
        selectedSubgraphId &&
        displaySubgraphs.has(selectedSubgraphId) &&
        !isMultiSelect && (
          <NodeStylePopover
            popoverPos={subgraphPopoverPos}
            currentStyle={selectedSubgraphStyle}
            defaultDash="dashed"
            onApplyPreset={onApplySubgraphPreset}
            onUpdateCustomStyle={onUpdateSubgraphCustomStyle}
            onClearStyle={onClearSubgraphStyle}
          />
        )}

      {/* Fallback chips for groups with no rendered cluster element */}
      {unmatchedSubgraphIds.length > 0 && (
        <div
          className="mermaid-group-fallback-bar nodrag"
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            display: 'flex',
            gap: 6,
            zIndex: 120,
            maxWidth: '70%',
            flexWrap: 'wrap',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {unmatchedSubgraphIds.map((subId, idx) => {
            const sub = displaySubgraphs.get(subId);
            if (!sub) return null;
            const isActive = selectedSubgraphId === subId;
            return (
              <button
                key={subId}
                type="button"
                className={`mermaid-subgraph-badge ${isActive ? 'is-selected' : ''}`}
                style={isActive ? { outline: '2px solid var(--mermaid-accent)' } : undefined}
                title={
                  sub.nodeIds.length === 0
                    ? `Empty group "${sub.label}" — click to select`
                    : `Group "${sub.label}" — click to select`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectUnmatchedSubgraph(subId, idx);
                }}
              >
                <span>{sub.label || subId}</span>
                {sub.nodeIds.length === 0 && <span> (empty)</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};
