import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const ResizableAIChat = ({ children, defaultWidth = 480, minWidth = 320, maxWidth = 800 }) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const panelRef = useRef(null);

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(width);
  }, [width]);

  // Handle mouse move during resize
  const handleMouseMove = useCallback((e) => {
    if (!isResizing) return;
    
    e.preventDefault();
    const deltaX = startX - e.clientX; // Inverted because we're resizing from the left
    const newWidth = Math.min(Math.max(startWidth + deltaX, minWidth), maxWidth);
    setWidth(newWidth);
  }, [isResizing, startX, startWidth, minWidth, maxWidth]);

  // Handle mouse up to stop resize
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add/remove event listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Handle collapse/expand toggle
  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  return (
    <div 
      ref={panelRef}
      className={`resizable-ai-chat relative transition-all duration-300 ease-in-out ${
        isResizing ? 'resizing pointer-events-none' : ''
      }`}
      style={{
        width: isCollapsed ? '48px' : `${width}px`,
        minWidth: isCollapsed ? '48px' : `${minWidth}px`,
        maxWidth: isCollapsed ? '48px' : `${maxWidth}px`,
        height: '100%',
        position: 'relative',
        flexShrink: 0
      }}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={handleToggleCollapse}
        className={`absolute z-20 bg-gray-800/70 hover:bg-gray-700/90 border border-gray-600/50 rounded-lg p-2 transition-all duration-300 ${
          isCollapsed 
            ? 'top-4 left-2 shadow-lg opacity-90' 
            : 'top-4 right-4 shadow-sm opacity-70 hover:opacity-100'
        }`}
        title={isCollapsed ? 'Expand AI Chat' : 'Collapse AI Chat'}
      >
        {isCollapsed ? (
          <ChevronLeftIcon className="w-4 h-4 text-white" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-white" />
        )}
      </button>

      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={`absolute left-0 top-0 bottom-0 w-1 bg-transparent hover:bg-studiosix-500/50 cursor-ew-resize z-10 transition-colors duration-200 ${
            isResizing ? 'bg-studiosix-500/50' : ''
          }`}
          title="Drag to resize"
        >
          {/* Visual indicator for resize handle */}
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gray-600/30 hover:bg-studiosix-500/70 transition-colors duration-200 rounded-r" />
        </div>
      )}

      {/* AI Chat Content */}
      <div 
        className={`ai-chat-content h-full transition-opacity duration-300 ${
          isCollapsed ? 'opacity-0 pointer-events-none overflow-hidden' : 'opacity-100'
        }`}
        style={{
          width: isCollapsed ? '0px' : `${width}px`,
          overflow: isCollapsed ? 'hidden' : 'visible',
          position: 'absolute',
          left: isCollapsed ? '48px' : '0px',
          top: '0px'
        }}
      >
        {React.cloneElement(children, {
          style: {
            width: `${width}px`,
            maxWidth: `${width}px`,
            minWidth: `${width}px`,
            ...children.props.style
          }
        })}
      </div>

      {/* Collapsed State Indicator */}
      {isCollapsed && (
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-900/95 border-r border-gray-700/50 flex flex-col items-center justify-center">
          <div className="writing-mode-vertical text-xs text-gray-400 font-medium tracking-wider">
            AI CHAT
          </div>
        </div>
      )}

      {/* Resize Preview Line */}
      {isResizing && (
        <div 
          className="fixed top-0 bottom-0 w-0.5 bg-studiosix-500 z-50 pointer-events-none"
          style={{ left: `${startX - (startX - (panelRef.current?.getBoundingClientRect().left || 0))}px` }}
        />
      )}
    </div>
  );
};

export default ResizableAIChat; 