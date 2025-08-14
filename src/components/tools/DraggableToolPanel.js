import React, { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Draggable wrapper for tool panels
 * Provides smooth dragging functionality with viewport constraints
 */
const DraggableToolPanel = ({ 
  children, 
  isActive, 
  width = 320, 
  height = 400,
  className = '',
  style = {},
  containerBounds = null,
  ...props 
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasBeenMoved, setHasBeenMoved] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef(null);

  // Handle mouse down with smooth positioning
  const handleMouseDown = useCallback((e) => {
    if (!panelRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Get current panel position
    const rect = panelRef.current.getBoundingClientRect();
    
    if (!hasBeenMoved) {
      // First time dragging - capture current position
      setPosition({ x: rect.left, y: rect.top });
      setHasBeenMoved(true);
    }
    
    setDragOffset({
      x: e.clientX - (hasBeenMoved ? position.x : rect.left),
      y: e.clientY - (hasBeenMoved ? position.y : rect.top)
    });
    
    setIsDragging(true);
    
    // Prevent text selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.cursor = 'grabbing';
  }, [position, hasBeenMoved]);

  // Handle mouse move with smooth animation
  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    e.preventDefault();
    
    // Calculate new position
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;
    
    // Get viewport boundaries with padding
    const padding = 10;
    const bounds = containerBounds || { width: window.innerWidth, height: window.innerHeight };
    const maxX = bounds.width - width - padding;
    const maxY = bounds.height - height - padding;
    
    // Constrain to viewport
    newX = Math.max(padding, Math.min(newX, maxX));
    newY = Math.max(padding, Math.min(newY, maxY));
    
    // Use requestAnimationFrame for smooth movement
    requestAnimationFrame(() => {
      setPosition({ x: newX, y: newY });
    });
  }, [isDragging, dragOffset, width, height]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    
    // Restore text selection and cursor
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    document.body.style.cursor = '';
  }, []);

  // Add/remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Reset position when tool becomes inactive
  useEffect(() => {
    if (!isActive) {
      setPosition({ x: 0, y: 0 });
      setHasBeenMoved(false);
      setIsDragging(false);
    }
  }, [isActive]);

  // Don't render if not active
  if (!isActive) return null;

  // Calculate positioning styles
  const positionStyles = hasBeenMoved ? {
    position: 'fixed',
    left: position.x,
    top: position.y,
    right: 'auto'
  } : {
    position: 'absolute',
    top: 80,  // Below toolbar to avoid overlap
    right: 20,
    zIndex: 100  // Ensure it's above viewport content
  };

  return (
    <div
      ref={panelRef}
      className={`tool-panel-draggable ${className} ${isDragging ? 'dragging' : ''}`}
      style={{
        ...positionStyles,
        width: width,
        maxHeight: '85vh',
        zIndex: isDragging ? 1000 : 50,
        transform: isDragging ? 'scale(1.02) rotate(0.5deg)' : 'scale(1) rotate(0deg)',
        transition: isDragging ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease',
        boxShadow: isDragging 
          ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(168, 85, 247, 0.2)' 
          : '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        cursor: isDragging ? 'grabbing' : 'default',
        ...style
      }}
      {...props}
    >
      {/* Draggable header overlay */}
      <div
        className="draggable-header"
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60px', // Cover the header area
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 10,
          background: 'transparent'
        }}
      />
      
      {children}
    </div>
  );
};

export default DraggableToolPanel; 