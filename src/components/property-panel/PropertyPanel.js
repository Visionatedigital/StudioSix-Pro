import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, MinusIcon } from '@heroicons/react/24/outline';
import PropertyPanelHeader from './PropertyPanelHeader';
import PropertyPanelBody from './PropertyPanelBody';
import PropertyPanelFooter from './PropertyPanelFooter';

const PropertyPanel = ({
  title = 'Properties',
  properties = {},
  selectedObject = null,
  onClose,
  onChange,
  position = { x: 20, y: 20 },
  isDraggable = true,
  isMinimizable = true,
  isLoading = false,
  isSyncing = false,
  theme = 'dark',
  containerBounds = null // New prop to define viewport bounds
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [panelPosition, setPanelPosition] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [panelSize, setPanelSize] = useState({ width: 320, height: 'auto' });
  const [opacity, setOpacity] = useState(1);

  // Handle panel dragging
  const handleMouseDown = useCallback((e) => {
    if (!isDraggable) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - panelPosition.x,
      y: e.clientY - panelPosition.y
    });
  }, [isDraggable, panelPosition]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;
    
    // Constrain to container bounds if provided
    if (containerBounds) {
      // Keep panel within viewport bounds
      const panelWidth = panelSize.width;
      const panelHeight = isMinimized ? 48 : 400; // Approximate panel height
      
      newX = Math.max(0, Math.min(newX, containerBounds.width - panelWidth));
      newY = Math.max(0, Math.min(newY, containerBounds.height - panelHeight));
    }
    
    setPanelPosition({
      x: newX,
      y: newY
    });
  }, [isDragging, dragOffset, containerBounds, panelSize.width, isMinimized]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove event listeners for dragging
  useEffect(() => {
    if (isDraggable) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggable, handleMouseMove, handleMouseUp]);

  // Validate position when container bounds change
  useEffect(() => {
    if (containerBounds) {
      const panelWidth = panelSize.width;
      const panelHeight = isMinimized ? 48 : 400;
      
      let validatedX = Math.max(0, Math.min(panelPosition.x, containerBounds.width - panelWidth));
      let validatedY = Math.max(0, Math.min(panelPosition.y, containerBounds.height - panelHeight));
      
      if (validatedX !== panelPosition.x || validatedY !== panelPosition.y) {
        setPanelPosition({ x: validatedX, y: validatedY });
      }
    }
  }, [containerBounds, panelSize.width, isMinimized, panelPosition.x, panelPosition.y]);

  // Handle property changes
  const handlePropertyChange = useCallback((propertyName, value) => {
    if (onChange) {
      onChange(propertyName, value, selectedObject);
    }
  }, [onChange, selectedObject]);

  return (
    <div 
      className={`property-panel absolute backdrop-blur-md border rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ${
        isMinimized ? 'h-12' : 'h-auto'
      } ${
        isSyncing ? 'border-studiosix-500/70 shadow-studiosix-500/20' : 'border-gray-700/50'
      } ${
        theme === 'dark' ? 'bg-gray-900/95' : 'bg-white/95'
      } ${
        isDragging ? 'shadow-3xl scale-105' : ''
      }`}
      style={{
        top: panelPosition.y,
        left: panelPosition.x,
        width: panelSize.width,
        minWidth: '280px',
        maxWidth: '500px',
        zIndex: 1000,
        opacity: opacity,
        transform: isDragging ? 'rotate(1deg)' : 'none'
      }}
      role="dialog"
      aria-labelledby="property-panel-title"
      tabIndex={-1}
    >
      <PropertyPanelHeader
        title={title}
        onClose={onClose}
        onMinimize={() => isMinimizable && setIsMinimized(!isMinimized)}
        onMouseDown={handleMouseDown}
        isMinimized={isMinimized}
        isMinimizable={isMinimizable}
        isSyncing={isSyncing}
        isLoading={isLoading}
        theme={theme}
        opacity={opacity}
        onOpacityChange={setOpacity}
      />

      {!isMinimized && (
        <>
          <PropertyPanelBody
            properties={properties}
            onChange={handlePropertyChange}
            theme={theme}
            isLoading={isLoading}
          />
          <PropertyPanelFooter 
            theme={theme}
            propertyCount={Object.keys(properties).length}
          />
        </>
      )}
    </div>
  );
};

export default PropertyPanel; 