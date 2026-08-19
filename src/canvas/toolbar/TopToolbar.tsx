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
  onCopyImage,
  onExportPng,
  onExportSvg,
  showCodePanel,
  onToggleCodePanel,
  onFitView,
}) => {
  return (
    <div className="mermaid-top-toolbar">
      {/* Creation Tools */}
      <div className="mermaid-toolbar-group">
        <button
          className="mermaid-tool-btn mod-cta"
          onClick={() => onAddNode('rectangle')}
          title="Add Card (Double-click canvas)"
        >
          <PlusIcon size={14} />
          <span>Card</span>
        </button>

        <div className="mermaid-dropdown-wrapper" title="Choose shape">
          <div className="mermaid-dropdown-icon">
            <ShapesIcon size={14} />
          </div>
          <select
            className="mermaid-dropdown with-icon"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onAddNode(e.target.value as MermaidShapeType);
                e.target.value = '';
              }
            }}
          >
            <option value="" disabled>
              Shape...
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
          className="mermaid-tool-btn"
          onClick={onAddSubgraph}
          title="Add Group Container (or select cards first)"
        >
          <FolderIcon size={14} />
          <span>Group</span>
        </button>
      </div>

      <div className="mermaid-toolbar-divider" />

      {/* Direction & Auto-Layout */}
      <div className="mermaid-toolbar-group">
        <select
          className="mermaid-dropdown"
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as FlowchartDirection)}
          title="Flowchart layout direction"
        >
          <option value="LR">Left to Right (LR)</option>
          <option value="TD">Top to Bottom (TD)</option>
          <option value="BT">Bottom to Top (BT)</option>
          <option value="RL">Right to Left (RL)</option>
        </select>

        <button
          className="mermaid-tool-btn"
          onClick={onAutoTidy}
          title="Auto-align canvas layout"
        >
          <WandIcon size={14} />
          <span>Auto-Layout</span>
        </button>
      </div>

      <div className="mermaid-toolbar-divider" />

      {/* History & Zoom */}
      <div className="mermaid-toolbar-group">
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
        {onFitView && (
          <button
            className="mermaid-tool-btn icon-only"
            onClick={onFitView}
            title="Zoom to Fit Canvas"
          >
            <MaximizeIcon size={14} />
          </button>
        )}
      </div>

      <div className="mermaid-toolbar-spacer" />

      {/* Export & Code Toggle */}
      <div className="mermaid-toolbar-group">
        <button
          className="mermaid-tool-btn icon-only"
          onClick={onExportPng}
          title="Export high-resolution PNG"
        >
          <ImageIcon size={14} />
        </button>
        <button
          className="mermaid-tool-btn icon-only"
          onClick={onExportSvg}
          title="Export scalable SVG"
        >
          <VectorIcon size={14} />
        </button>
        <button
          className="mermaid-tool-btn icon-only"
          onClick={onCopyCode}
          title="Copy Mermaid syntax"
        >
          <CopyIcon size={14} />
        </button>
        <button
          className={`mermaid-tool-btn ${showCodePanel ? 'is-active' : ''}`}
          onClick={onToggleCodePanel}
          title="Toggle code editor pane"
        >
          <CodeIcon size={14} />
          <span>{showCodePanel ? 'Hide Code' : 'Code'}</span>
        </button>
      </div>
    </div>
  );
};
