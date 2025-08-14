import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TrashIcon, ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/react/24/outline';

const OBJModelPanel = ({
  modelData,
  onDelete,
  onTransform,
  onClose,
  theme = 'dark',
  initialPosition = { x: window.innerWidth - 340, y: 70 }
}) => {
  const [position, setPosition] = useState(modelData.position || { x: 0, y: 0, z: 0 });
  const [rotation, setRotation] = useState(modelData.rotation || { x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState(modelData.scale || { x: 1, y: 1, z: 1 });
  
  // Dragging state
  const [panelPosition, setPanelPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef(null);

  const handleTransform = () => {
    if (onTransform) {
      onTransform(modelData.modelId, {
        position,
        rotation,
        scale
      });
    }
  };

  const handleDelete = () => {
    if (onDelete && window.confirm(`Delete imported model?`)) {
      onDelete(modelData.modelId);
    }
  };

  // Dragging functionality
  const handleMouseDown = useCallback((e) => {
    // Only drag from header area, not from inputs or buttons
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - panelPosition.x,
        y: e.clientY - panelPosition.y
      });
      e.preventDefault();
    }
  }, [panelPosition]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const panelWidth = 320; // w-80 = 320px
    const panelHeight = panelRef.current?.offsetHeight || 300;
    
    // Calculate new position
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;

    // Constrain to viewport boundaries
    const maxX = window.innerWidth - panelWidth;
    const maxY = window.innerHeight - panelHeight;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    setPanelPosition({ x: newX, y: newY });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
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

  return (
    <div 
      ref={panelRef}
      className="w-80 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-white fixed z-50"
      style={{
        left: `${panelPosition.x}px`,
        top: `${panelPosition.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="drag-handle flex items-center justify-between p-3 border-b border-slate-600 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
          <h3 className="text-sm font-medium">Imported Model</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white w-4 h-4"
        >
          <XMarkIcon />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Position */}
        <div>
          <div className="text-xs text-slate-300 mb-1">Position</div>
          <div className="grid grid-cols-3 gap-1">
            <input
              type="number"
              step="0.1"
              value={position.x}
              onChange={(e) => setPosition(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))}
              className="w-full px-1 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:border-purple-400 focus:ring-0"
              placeholder="X"
            />
            <input
              type="number"
              step="0.1"
              value={position.y}
              onChange={(e) => setPosition(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))}
              className="w-full px-1 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:border-purple-400 focus:ring-0"
              placeholder="Y"
            />
            <input
              type="number"
              step="0.1"
              value={position.z}
              onChange={(e) => setPosition(prev => ({ ...prev, z: parseFloat(e.target.value) || 0 }))}
              className="w-full px-1 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:border-purple-400 focus:ring-0"
              placeholder="Z"
            />
          </div>
        </div>

        {/* Rotation */}
        <div>
          <div className="text-xs text-slate-300 mb-1">Rotation</div>
          <div className="grid grid-cols-3 gap-1">
            <input
              type="number"
              step="1"
              value={rotation.x}
              onChange={(e) => setRotation(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))}
              className="w-full px-1 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:border-purple-400 focus:ring-0"
              placeholder="X°"
            />
            <input
              type="number"
              step="1"
              value={rotation.y}
              onChange={(e) => setRotation(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))}
              className="w-full px-1 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:border-purple-400 focus:ring-0"
              placeholder="Y°"
            />
            <input
              type="number"
              step="1"
              value={rotation.z}
              onChange={(e) => setRotation(prev => ({ ...prev, z: parseFloat(e.target.value) || 0 }))}
              className="w-full px-1 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:border-purple-400 focus:ring-0"
              placeholder="Z°"
            />
          </div>
        </div>

        {/* Scale */}
        <div>
          <div className="text-xs text-slate-300 mb-1">Scale</div>
          <div className="grid grid-cols-3 gap-1">
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={scale.x}
              onChange={(e) => setScale(prev => ({ ...prev, x: parseFloat(e.target.value) || 1 }))}
              className="w-full px-1 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:border-purple-400 focus:ring-0"
              placeholder="X"
            />
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={scale.y}
              onChange={(e) => setScale(prev => ({ ...prev, y: parseFloat(e.target.value) || 1 }))}
              className="w-full px-1 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:border-purple-400 focus:ring-0"
              placeholder="Y"
            />
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={scale.z}
              onChange={(e) => setScale(prev => ({ ...prev, z: parseFloat(e.target.value) || 1 }))}
              className="w-full px-1 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:border-purple-400 focus:ring-0"
              placeholder="Z"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleTransform}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
          >
            <ArrowsPointingOutIcon className="w-3 h-3" />
            Apply
          </button>
          <button
            onClick={handleDelete}
            className="px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
          >
            <TrashIcon className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OBJModelPanel;