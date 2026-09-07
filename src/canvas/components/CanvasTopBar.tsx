import React from 'react';
import { FlowchartDirection } from '../../ast/types';
import { CursorMode } from '../types';
import {
  SelectModeIcon,
  HandModeIcon,
  PlusIcon,
  FitViewIcon,
  CodeIcon,
} from '../icons/Icons';

export interface CanvasTopBarProps {
  cursorMode: CursorMode;
  onSetCursorMode: (mode: CursorMode) => void;
  onAddStep: () => void;
  direction: FlowchartDirection;
  onToggleDirection: () => void;
  onFitView: () => void;
  showCodeDrawer: boolean;
  onToggleCodeDrawer: () => void;
}

export const CanvasTopBar: React.FC<CanvasTopBarProps> = ({
  cursorMode,
  onSetCursorMode,
  onAddStep,
  direction,
  onToggleDirection,
  onFitView,
  showCodeDrawer,
  onToggleCodeDrawer,
}) => {
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

        <button
          type="button"
          className="mermaid-tool-btn mod-cta"
          onClick={onAddStep}
          title="Add new step"
        >
          <PlusIcon size={14} />
          <span>Add Step</span>
        </button>

        <button
          type="button"
          className="mermaid-tool-btn"
          onClick={onToggleDirection}
          title={`Toggle Flow Direction (Current: ${direction})`}
        >
          <span>Flow: {direction}</span>
        </button>

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
