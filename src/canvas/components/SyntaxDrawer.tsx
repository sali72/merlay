import React from 'react';
import { CloseIcon } from '../icons/Icons';

export interface SyntaxDrawerProps {
  isOpen: boolean;
  code: string;
  syntaxError: string | null;
  onClose: () => void;
  onChangeCode: (newCode: string) => void;
}

export const SyntaxDrawer: React.FC<SyntaxDrawerProps> = ({
  isOpen,
  code,
  syntaxError,
  onClose,
  onChangeCode,
}) => {
  if (!isOpen) return null;

  return (
    <div className="mermaid-side-code-drawer nodrag">
      <div className="mermaid-code-drawer-header">
        <span>Mermaid Syntax</span>
        <button
          type="button"
          className="mermaid-code-close-btn"
          onClick={onClose}
          title="Close Syntax Drawer"
        >
          <CloseIcon size={14} />
        </button>
      </div>
      {syntaxError && (
        <div className="mermaid-code-error-badge">{syntaxError}</div>
      )}
      <textarea
        className="mermaid-code-drawer-textarea"
        value={code}
        onChange={(e) => onChangeCode(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
};
