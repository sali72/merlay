import React from 'react';
import { FlowchartDirection } from '../../ast/types';
import {
  CodeIcon,
  CopyIcon,
  FolderIcon,
  ImageIcon,
  PlusIcon,
  RedoIcon,
  UndoIcon,
  VectorIcon,
  WandIcon,
} from '../icons/Icons';

export interface TopToolbarProps {
  direction: FlowchartDirection;
  onDirectionChange: (dir: FlowchartDirection) => void;
  onAutoTidy: () => void;
  onAddNode: () => void;
  onAddSubgraph: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCopyCode: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  showCodePanel: boolean;
  onToggleCodePanel: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  direction,
  onDirectionChange,
  onAutoTidy,
  onAddNode,
  onAddSubgraph,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onCopyCode,
  onExportPng,
  onExportSvg,
  showCodePanel,
  onToggleCodePanel,
}) => {
  return (
    <div className="mermaid-top-toolbar">
      {/* Brand / Title */}
      <div className="mermaid-brand">
        <span className="mermaid-brand-icon">⬡</span>
        <span className="mermaid-brand-text">Mermaid Studio</span>
      </div>

      <div className="mermaid-toolbar-divider" />

      {/* Creation Tools */}
      <div className="mermaid-toolbar-group">
        <button
          className="mermaid-tool-btn"
          onClick={onAddNode}
          title="Add New Node (Double click canvas or Enter)"
        >
          <PlusIcon size={14} />
          <span>Node</span>
        </button>
        <button
          className="mermaid-tool-btn"
          onClick={onAddSubgraph}
          title="Add Subgraph Container (or select nodes first)"
        >
          <FolderIcon size={14} />
          <span>Subgraph</span>
        </button>
      </div>

      <div className="mermaid-toolbar-divider" />

      {/* Direction Picker */}
      <div className="mermaid-toolbar-group">
        <label className="mermaid-control-label">Direction:</label>
        <select
          className="mermaid-dropdown"
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as FlowchartDirection)}
        >
          <option value="LR">Left → Right (LR)</option>
          <option value="TD">Top → Down (TD)</option>
          <option value="BT">Bottom → Top (BT)</option>
          <option value="RL">Right → Left (RL)</option>
        </select>
      </div>

      <div className="mermaid-toolbar-divider" />

      {/* Auto-Tidy & History */}
      <div className="mermaid-toolbar-group">
        <button
          className="mermaid-tool-btn mod-cta"
          onClick={onAutoTidy}
          title="Re-calculate clean layout using Elk.js"
        >
          <WandIcon size={14} />
          <span>Auto-Tidy</span>
        </button>
        <button
          className="mermaid-tool-btn icon-only"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon size={14} />
        </button>
        <button
          className="mermaid-tool-btn icon-only"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <RedoIcon size={14} />
        </button>
      </div>

      <div className="mermaid-toolbar-spacer" />

      {/* Export & Actions */}
      <div className="mermaid-toolbar-group">
        <button
          className="mermaid-tool-btn"
          onClick={onExportPng}
          title="Export High-Resolution PNG"
        >
          <ImageIcon size={14} />
          <span>PNG</span>
        </button>
        <button
          className="mermaid-tool-btn"
          onClick={onExportSvg}
          title="Export Scalable Vector Graphics (SVG)"
        >
          <VectorIcon size={14} />
          <span>SVG</span>
        </button>
        <button
          className="mermaid-tool-btn"
          onClick={onCopyCode}
          title="Copy Mermaid Code"
        >
          <CopyIcon size={14} />
          <span>Copy</span>
        </button>
        <button
          className={`mermaid-tool-btn ${showCodePanel ? 'is-active' : ''}`}
          onClick={onToggleCodePanel}
          title="Toggle Mermaid Code Split View"
        >
          <CodeIcon size={14} />
          <span>{showCodePanel ? 'Hide Code' : 'Code'}</span>
        </button>
      </div>
    </div>
  );
};
