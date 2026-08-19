import React from 'react';
import { FlowchartDirection, MermaidShapeType } from '../../ast/types';
import {
  CodeIcon,
  CopyIcon,
  FolderIcon,
  ImageIcon,
  MaximizeIcon,
  PlusIcon,
  RedoIcon,
  ShapesIcon,
  UndoIcon,
  VectorIcon,
  WandIcon,
} from '../icons/Icons';

export interface TopToolbarProps {
  direction: FlowchartDirection;
  onDirectionChange: (dir: FlowchartDirection) => void;
  onAutoTidy: () => void;
  onAddNode: (shape?: MermaidShapeType) => void;
  onAddSubgraph: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCopyCode: () => void;
  onCopyImage?: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  showCodePanel: boolean;
  onToggleCodePanel: () => void;
  onFitView?: () => void;
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
  onFitView,
}) => {
  return (
    <div className="mermaid-floating-dock nodrag nopan">
      {/* Creation Tools */}
      <div className="mermaid-dock-group">
        <button
          type="button"
          className="mermaid-dock-btn mod-cta"
          onClick={() => onAddNode('rectangle')}
          title="Add Card (Double-click canvas)"
        >
          <PlusIcon size={15} />
        </button>

        <div className="mermaid-dock-dropdown-wrapper" title="Choose Shape">
          <div className="mermaid-dock-dropdown-icon">
            <ShapesIcon size={14} />
          </div>
          <select
            className="mermaid-dock-dropdown"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onAddNode(e.target.value as MermaidShapeType);
                e.target.value = '';
              }
            }}
          >
            <option value="" disabled>
              Shape
            </option>
            <option value="rectangle">Rectangle [text]</option>
            <option value="rounded">Rounded (text)</option>
            <option value="stadium">Stadium ([text])</option>
            <option value="cylinder">Database [(text)]</option>
            <option value="circle">Circle ((text))</option>
            <option value="diamond">Decision {"{text}"}</option>
            <option value="hexagon">Hexagon {"{{text}}"}</option>
            <option value="subroutine">Subroutine [[text]]</option>
            <option value="parallelogram">Parallelogram [/text/]</option>
          </select>
        </div>

        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onAddSubgraph}
          title="Add Group (or select cards first)"
        >
          <FolderIcon size={15} />
        </button>
      </div>

      <div className="mermaid-dock-divider" />

      {/* Direction & Auto-Layout */}
      <div className="mermaid-dock-group">
        <select
          className="mermaid-dock-dropdown simple"
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as FlowchartDirection)}
          title="Layout Direction"
        >
          <option value="LR">LR →</option>
          <option value="TD">TD ↓</option>
          <option value="BT">BT ↑</option>
          <option value="RL">RL ←</option>
        </select>

        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onAutoTidy}
          title="Auto-Layout Clean Alignment"
        >
          <WandIcon size={14} />
        </button>
      </div>

      <div className="mermaid-dock-divider" />

      {/* History & Zoom */}
      <div className="mermaid-dock-group">
        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <UndoIcon size={14} />
        </button>
        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <RedoIcon size={14} />
        </button>
        {onFitView && (
          <button
            type="button"
            className="mermaid-dock-btn"
            onClick={onFitView}
            title="Zoom to Fit"
          >
            <MaximizeIcon size={14} />
          </button>
        )}
      </div>

      <div className="mermaid-dock-divider" />

      {/* Export & Code Toggle */}
      <div className="mermaid-dock-group">
        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onExportPng}
          title="Export PNG"
        >
          <ImageIcon size={14} />
        </button>
        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onExportSvg}
          title="Export SVG"
        >
          <VectorIcon size={14} />
        </button>
        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onCopyCode}
          title="Copy Mermaid Syntax"
        >
          <CopyIcon size={14} />
        </button>
        <button
          type="button"
          className={`mermaid-dock-btn ${showCodePanel ? 'is-active' : ''}`}
          onClick={onToggleCodePanel}
          title="Toggle Mermaid Syntax Editor"
        >
          <CodeIcon size={14} />
        </button>
      </div>
    </div>
  );
};
