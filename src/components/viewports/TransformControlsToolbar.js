/**
 * Transform Controls Toolbar
 * 
 * Provides UI buttons for transform mode switching and controls
 */

import React from 'react';

const TransformControlsToolbar = ({ 
  currentMode, 
  onModeChange, 
  isObjectSelected, 
  currentSpace,
  onSpaceToggle 
}) => {
  const modes = [
    { key: 'translate', label: 'Move', icon: '⟷', shortcut: 'T' },
    { key: 'rotate', label: 'Rotate', icon: '↻', shortcut: 'R' },
    { key: 'scale', label: 'Scale', icon: '⇲', shortcut: 'S' }
  ];

  if (!isObjectSelected) {
    return null;
  }

  return (
    <div className="transform-controls-toolbar">
      <div className="mode-buttons">
        {modes.map(mode => (
          <button
            key={mode.key}
            className={`mode-button ${currentMode === mode.key ? 'active' : ''}`}
            onClick={() => onModeChange(mode.key)}
            title={`${mode.label} (${mode.shortcut})`}
          >
            <span className="mode-icon">{mode.icon}</span>
            <span className="mode-shortcut">{mode.shortcut}</span>
          </button>
        ))}
      </div>

      <div className="space-toggle">
        <button
          className={`space-button ${currentSpace === 'local' ? 'active' : ''}`}
          onClick={onSpaceToggle}
          title={`${currentSpace === 'local' ? 'Local' : 'World'} Space (Shift to toggle)`}
        >
          <span className="space-icon">{currentSpace === 'local' ? '⊙' : '⊕'}</span>
        </button>
      </div>

      <div className="delete-section">
        <div className="delete-hint">
          <span className="delete-text">Delete: </span>
          <span className="delete-key">⌫</span>
        </div>
      </div>

      <style jsx>{`
        .transform-controls-toolbar {
          position: absolute;
          top: 20px;
          left: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          
          /* Glassmorphism */
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 8px 12px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: rgba(255, 255, 255, 0.9);
          z-index: 1000;
          
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .mode-buttons {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 2px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .mode-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 8px 10px;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 10px;
          font-weight: 500;
          min-width: 40px;
          position: relative;
          overflow: hidden;
        }

        .mode-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .mode-button:hover {
          color: rgba(255, 255, 255, 0.9);
          transform: translateY(-1px);
        }

        .mode-button:hover::before {
          opacity: 1;
        }

        .mode-button.active {
          color: #ffffff;
          background: rgba(59, 130, 246, 0.3);
          border: 1px solid rgba(59, 130, 246, 0.4);
          box-shadow: 
            0 0 20px rgba(59, 130, 246, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .mode-button.active::before {
          opacity: 0;
        }

        .mode-icon {
          font-size: 16px;
          line-height: 1;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
        }

        .mode-shortcut {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.5px;
          opacity: 0.8;
        }

        .space-toggle {
          margin-left: 4px;
          padding-left: 8px;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
        }

        .space-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .space-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .space-button:hover {
          color: rgba(255, 255, 255, 0.9);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .space-button:hover::before {
          opacity: 1;
        }

        .space-button.active {
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.4);
          background: rgba(16, 185, 129, 0.1);
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
        }

        .space-button.active::before {
          opacity: 0;
        }

        .space-icon {
          font-size: 14px;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
        }

        .delete-section {
          margin-left: 8px;
          padding-left: 8px;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
        }

        .delete-hint {
          display: flex;
          align-items: center;
          gap: 4px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 10px;
          font-weight: 500;
        }

        .delete-text {
          font-size: 9px;
          letter-spacing: 0.5px;
        }

        .delete-key {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 2px 4px;
          font-size: 10px;
          font-weight: 600;
          min-width: 16px;
          text-align: center;
          color: rgba(255, 255, 255, 0.8);
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .transform-controls-toolbar {
            top: 10px;
            left: 10px;
            padding: 6px 8px;
            border-radius: 12px;
          }
          
          .mode-button {
            padding: 6px 8px;
            min-width: 36px;
          }
          
          .mode-icon {
            font-size: 14px;
          }
          
          .mode-shortcut {
            font-size: 8px;
          }
          
          .space-button {
            width: 28px;
            height: 28px;
          }
          
          .delete-section {
            display: none;
          }
        }

        /* Dark theme support */
        @media (prefers-color-scheme: dark) {
          .transform-controls-toolbar {
            background: rgba(17, 24, 39, 0.3);
            border-color: rgba(255, 255, 255, 0.08);
          }
        }
      `}</style>
    </div>
  );
};

export default TransformControlsToolbar;
