import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for making panels draggable within viewport boundaries
 * @param {number} panelWidth - Width of the panel in pixels
 * @param {number} panelHeight - Approximate height of the panel in pixels
 * @param {object} initialPosition - Initial position { x: number, y: number }
 * @returns {object} - Dragging state and handlers
 */
export const useDraggablePanel = (panelWidth = 320, panelHeight = 400, initialPosition = { x: 0, y: 0 }) => {
  const [panelPosition, setPanelPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasBeenMoved, setHasBeenMoved] = useState(false);

  // Handle panel dragging with viewport boundaries
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If this is the first drag, calculate position from current rendered position
    if (!hasBeenMoved) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPanelPosition({ x: rect.left, y: rect.top });
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setHasBeenMoved(true);
    } else {
      setDragOffset({
        x: e.clientX - panelPosition.x,
        y: e.clientY - panelPosition.y
      });
    }
    
    setIsDragging(true);
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  }, [panelPosition, hasBeenMoved]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Get viewport boundaries
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate new position with boundaries
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;
    
    // Constrain to viewport boundaries
    newX = Math.max(0, Math.min(newX, viewportWidth - panelWidth));
    newY = Math.max(0, Math.min(newY, viewportHeight - panelHeight));
    
    setPanelPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset, panelWidth, panelHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    
    // Restore text selection
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
  }, []);

  // Add/remove event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Get positioning styles for the panel
  const getPanelStyles = useCallback(() => {
    if (!hasBeenMoved) {
      // Use default positioning (top-right corner)
      return {
        top: 16,
        right: 16,
        transform: isDragging ? 'rotate(1deg)' : 'none'
      };
    } else {
      // Use absolute positioning with left/top
      return {
        top: panelPosition.y,
        left: panelPosition.x,
        transform: isDragging ? 'rotate(1deg)' : 'none'
      };
    }
  }, [panelPosition, isDragging, hasBeenMoved]);

  // Get CSS classes for dragging state
  const getPanelClasses = useCallback((baseClasses = '') => 
    `${baseClasses} ${isDragging ? 'shadow-3xl scale-105' : ''}`.trim()
  , [isDragging]);

  return {
    panelPosition,
    isDragging,
    hasBeenMoved,
    handleMouseDown,
    getPanelStyles,
    getPanelClasses,
    resetPosition: () => {
      setPanelPosition(initialPosition);
      setHasBeenMoved(false);
    }
  };
};

export default useDraggablePanel; 