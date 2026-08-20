import React, { useState, useRef, useEffect } from 'react';
import { FlowchartDirection, MermaidShapeType } from '../../ast/types';
import {
  ChevronDownIcon,
  CodeIcon,
  CopyIcon,
  FolderIcon,
  ImageIcon,
  MaximizeIcon,
  PlusIcon,
  RedoIcon,
  ShapeIcons,
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

const SHAPE_OPTIONS: Array<{
  type: MermaidShapeType;
  label: string;
  syntax: string;
  icon: (props: { size?: number }) => React.ReactNode;
}> = [
  { type: 'rectangle', label: 'Rectangle', syntax: '[text]', icon: ShapeIcons.rectangle },
  { type: 'rounded', label: 'Rounded', syntax: '(text)', icon: ShapeIcons.rounded },
  { type: 'stadium', label: 'Stadium', syntax: '([text])', icon: ShapeIcons.stadium },
  { type: 'cylinder', label: 'Database', syntax: '[(text)]', icon: ShapeIcons.cylinder },
  { type: 'circle', label: 'Circle', syntax: '((text))', icon: ShapeIcons.circle },
  { type: 'diamond', label: 'Decision', syntax: '{text}', icon: ShapeIcons.diamond },
  { type: 'hexagon', label: 'Hexagon', syntax: '{{text}}', icon: ShapeIcons.hexagon },
  { type: 'subroutine', label: 'Subroutine', syntax: '[[text]]', icon: ShapeIcons.subroutine },
  { type: 'parallelogram', label: 'Parallelogram', syntax: '[/text/]', icon: ShapeIcons.parallelogram },
];

const DIRECTION_OPTIONS: Array<{
  dir: FlowchartDirection;
  label: string;
  arrow: string;
}> = [
  { dir: 'LR', label: 'Left to Right', arrow: 'LR →' },
  { dir: 'TD', label: 'Top to Down', arrow: 'TD ↓' },
  { dir: 'BT', label: 'Bottom to Top', arrow: 'BT ↑' },
  { dir: 'RL', label: 'Right to Left', arrow: 'RL ←' },
];

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
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [dirMenuOpen, setDirMenuOpen] = useState(false);

  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const dirMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(e.target as Node)) {
        setShapeMenuOpen(false);
      }
      if (dirMenuRef.current && !dirMenuRef.current.contains(e.target as Node)) {
        setDirMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentDirObj = DIRECTION_OPTIONS.find((d) => d.dir === direction) || DIRECTION_OPTIONS[0];

  return (
    <div className="mermaid-floating-dock nodrag nopan">
      {/* Creation Tools */}
      <div className="mermaid-dock-group">
        <button
          type="button"
          className="mermaid-dock-btn mod-cta"
          onClick={() => onAddNode('rectangle')}
          title="Add Rectangle Card (Double-click canvas)"
        >
          <PlusIcon size={15} />
        </button>

        {/* Shape Picker Popover */}
        <div className="mermaid-dock-menu-wrapper" ref={shapeMenuRef}>
          <button
            type="button"
            className={`mermaid-dock-menu-trigger ${shapeMenuOpen ? 'is-open' : ''}`}
            onClick={() => {
              setShapeMenuOpen(!shapeMenuOpen);
              setDirMenuOpen(false);
            }}
            title="Choose Card Shape"
          >
            <span className="mermaid-dock-menu-trigger-icon">
              <ShapesIcon size={14} />
            </span>
            <span>Shape</span>
            <span className="mermaid-dock-menu-arrow">
              <ChevronDownIcon size={12} />
            </span>
          </button>

          {shapeMenuOpen && (
            <div className="mermaid-dock-popover">
              {SHAPE_OPTIONS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="mermaid-popover-item"
                  onClick={() => {
                    onAddNode(item.type);
                    setShapeMenuOpen(false);
                  }}
                >
                  <div className="mermaid-popover-item-left">
                    <span className="mermaid-popover-item-icon">{item.icon({ size: 14 })}</span>
                    <span>{item.label}</span>
                  </div>
                  <span className="mermaid-popover-item-shortcut">{item.syntax}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onAddSubgraph}
          title="Add Group Box (Select cards to group them)"
        >
          <FolderIcon size={15} />
        </button>
      </div>

      <div className="mermaid-dock-divider" />

      {/* Direction & Auto-Layout */}
      <div className="mermaid-dock-group">
        <div className="mermaid-dock-menu-wrapper" ref={dirMenuRef}>
          <button
            type="button"
            className={`mermaid-dock-menu-trigger ${dirMenuOpen ? 'is-open' : ''}`}
            onClick={() => {
              setDirMenuOpen(!dirMenuOpen);
              setShapeMenuOpen(false);
            }}
            title="Diagram Layout Direction"
          >
            <span>{currentDirObj.arrow}</span>
            <span className="mermaid-dock-menu-arrow">
              <ChevronDownIcon size={12} />
            </span>
          </button>

          {dirMenuOpen && (
            <div className="mermaid-dock-popover" style={{ minWidth: 150 }}>
              {DIRECTION_OPTIONS.map((item) => (
                <button
                  key={item.dir}
                  type="button"
                  className={`mermaid-popover-item ${direction === item.dir ? 'is-selected' : ''}`}
                  onClick={() => {
                    onDirectionChange(item.dir);
                    setDirMenuOpen(false);
                  }}
                >
                  <div className="mermaid-popover-item-left">
                    <span>{item.label}</span>
                  </div>
                  <span className="mermaid-popover-item-shortcut">{item.arrow}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onAutoTidy}
          title="Auto-Layout Clean Alignment (Elk.js)"
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
          title="Undo (Ctrl/Cmd+Z)"
        >
          <UndoIcon size={14} />
        </button>
        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)"
        >
          <RedoIcon size={14} />
        </button>
        {onFitView && (
          <button
            type="button"
            className="mermaid-dock-btn"
            onClick={onFitView}
            title="Zoom to Fit Diagram"
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
          title="Export Diagram as PNG"
        >
          <ImageIcon size={14} />
        </button>
        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onExportSvg}
          title="Export Diagram as SVG"
        >
          <VectorIcon size={14} />
        </button>
        <button
          type="button"
          className="mermaid-dock-btn"
          onClick={onCopyCode}
          title="Copy Mermaid Syntax to Clipboard"
        >
          <CopyIcon size={14} />
        </button>
        <button
          type="button"
          className={`mermaid-dock-btn ${showCodePanel ? 'is-active' : ''}`}
          onClick={onToggleCodePanel}
          title="Toggle Mermaid Syntax Code Drawer"
        >
          <CodeIcon size={14} />
        </button>
      </div>
    </div>
  );
};

