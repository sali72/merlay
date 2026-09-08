import React from 'react';
import { CursorMode } from '../types';
import {
  SelectModeIcon,
  HandModeIcon,
  PlusIcon,
  FolderIcon,
  UndoIcon,
  RedoIcon,
  FitViewIcon,
  CodeIcon,
} from '../icons/Icons';

import { DiagramDriver } from '../../diagrams/types';

export interface CanvasTopBarProps {
  driver: DiagramDriver;
  cursorMode: CursorMode;
  onSetCursorMode: (mode: CursorMode) => void;
  onAddStep: () => void;
  onAddStart?: () => void;
  onAddEnd?: () => void;
  canAddStart?: boolean;
  canAddEnd?: boolean;
  onAddGroup: () => void;
  direction: string;
  onToggleDirection: () => void;
  onFitView: () => void;
  showCodeDrawer: boolean;
  onToggleCodeDrawer: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const CanvasTopBar: React.FC<CanvasTopBarProps> = ({
  driver,
  cursorMode,
  onSetCursorMode,
  onAddStep,
  onAddStart,
  onAddEnd,
  canAddStart = true,
  canAddEnd = true,
  onAddGroup,
  direction,
  onToggleDirection,
  onFitView,
  showCodeDrawer,
  onToggleCodeDrawer,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const { labels, capabilities } = driver;

  return (
    <div className="mermaid-native-top-bar nodrag">
      <div className="mermaid-top-bar-left">
        {/* Mode Switcher: Select (V) vs Hand (H) */}
        <div className="mermaid-mode-segmented">
          <button
            type="button"
            className={`mermaid-mode-btn ${cursorMode === 'select' ? 'is-active' : ''}`}
            onClick={() => onSetCursorMode('select')}
            title="Select & Marquee Tool (V)"
          >
            <SelectModeIcon size={13} />
            <span>Select</span>
          </button>
          <button
            type="button"
            className={`mermaid-mode-btn ${cursorMode === 'hand' ? 'is-active' : ''}`}
            onClick={() => onSetCursorMode('hand')}
            title="Hand / Pan Tool (H) - or hold Space"
          >
            <HandModeIcon size={13} />
            <span>Hand</span>
          </button>
        </div>

        <div className="mermaid-bar-divider" />

        {/* Undo / Redo */}
        <button
          type="button"
          className="mermaid-tool-btn icon-only"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon size={14} />
        </button>
        <button
          type="button"
          className="mermaid-tool-btn icon-only"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
        >
          <RedoIcon size={14} />
        </button>

        <div className="mermaid-bar-divider" />

        <button
          type="button"
          className="mermaid-tool-btn mod-cta"
          onClick={onAddStep}
          title={`Add new ${labels.node.toLowerCase()}`}
        >
          <PlusIcon size={14} />
          <span>{labels.addNode}</span>
        </button>

        {capabilities.hasAnchors && onAddStart && (
          <button
            type="button"
            className="mermaid-tool-btn"
            onClick={onAddStart}
            disabled={!canAddStart}
            title={canAddStart ? 'Add Start point ([*]) with first state' : 'Start point already exists'}
          >
            <span>＋Start</span>
          </button>
        )}

        {capabilities.hasAnchors && onAddEnd && (
          <button
            type="button"
            className="mermaid-tool-btn"
            onClick={onAddEnd}
            disabled={!canAddEnd}
            title={canAddEnd ? 'Add End point ([*]) with final state' : 'End point already exists'}
          >
            <span>＋End</span>
          </button>
        )}

        {capabilities.supportsGroups && (
          <button
            type="button"
            className="mermaid-tool-btn"
            onClick={onAddGroup}
            title={`Add new ${labels.group}`}
          >
            <FolderIcon size={14} />
            <span>{labels.addGroup}</span>
          </button>
        )}

        {capabilities.supportsDirection && (
          <button
            type="button"
            className="mermaid-tool-btn"
            onClick={onToggleDirection}
            title={`Toggle Flow Direction (Current: ${direction})`}
          >
            <span>Flow: {direction}</span>
          </button>
        )}

        <div className="mermaid-bar-divider" />

        <button
          type="button"
          className="mermaid-tool-btn"
          onClick={onFitView}
          title="Reset Zoom & Center (Fit View)"
        >
          <FitViewIcon size={14} />
        </button>
      </div>

      <div className="mermaid-top-bar-right">
        <span className="mermaid-diagram-badge" title="Diagram Type">
          {driver.displayName}
        </span>
        <button
          type="button"
          className={`mermaid-tool-btn ${showCodeDrawer ? 'is-active' : ''}`}
          onClick={onToggleCodeDrawer}
          title="Toggle Mermaid Syntax Drawer"
        >
          <CodeIcon size={14} />
          <span>Syntax</span>
        </button>
      </div>
    </div>
  );
};
