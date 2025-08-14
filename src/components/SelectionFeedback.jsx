/**
 * Selection Feedback Component
 * Provides intelligent visual feedback for selection operations
 */

import React, { useState, useEffect } from 'react';
import {
  CursorArrowRaysIcon,
  EyeIcon,
  Square2StackIcon,
  HandRaisedIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import useSelection from '../hooks/useSelection.js';

const SelectionFeedback = ({
  scene,
  camera,
  renderer,
  raycaster,
  className = '',
  position = 'top-right', // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  theme = 'dark',
  showInstructions = true,
  showStatistics = true,
  showMethodHints = true
}) => {
  const {
    selectionMethod,
    selectionCount,
    hoveredObject,
    isMultiSelecting,
    mouseState,
    getSelectionStats,
    SelectionMethods
  } = useSelection(scene, camera, renderer, raycaster);

  const [stats, setStats] = useState(null);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [instructions, setInstructions] = useState('');

  // Update statistics when selection changes
  useEffect(() => {
    if (selectionCount > 0) {
      setStats(getSelectionStats());
    } else {
      setStats(null);
    }
  }, [selectionCount, getSelectionStats]);

  // Update instructions based on selection method
  useEffect(() => {
    const methodInstructions = {
      [SelectionMethods.SINGLE]: 'Click to select objects. Hold Ctrl/Cmd to add to selection.',
      [SelectionMethods.WINDOW]: 'Drag to create a rectangle. Objects completely inside will be selected.',
      [SelectionMethods.CROSSING]: 'Drag to create a rectangle. Objects that intersect will be selected.',
      [SelectionMethods.LASSO]: 'Click and drag to draw a freeform selection area.',
      [SelectionMethods.POLYGONAL]: 'Left-click to add points. Right-click to finish selection.'
    };

    setInstructions(methodInstructions[selectionMethod] || '');
  }, [selectionMethod, SelectionMethods]);

  // Theme classes
  const themeClasses = {
    dark: {
      panel: 'bg-gray-900 bg-opacity-95 border-gray-600 text-white',
      header: 'text-gray-200',
      subtext: 'text-gray-400',
      accent: 'text-blue-400',
      success: 'text-green-400',
      warning: 'text-yellow-400',
      divider: 'border-gray-600'
    },
    light: {
      panel: 'bg-white bg-opacity-95 border-gray-300 text-gray-900',
      header: 'text-gray-700',
      subtext: 'text-gray-500',
      accent: 'text-blue-600',
      success: 'text-green-600',
      warning: 'text-yellow-600',
      divider: 'border-gray-300'
    }
  };

  const t = themeClasses[theme];

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  // Get selection method icon
  const getMethodIcon = () => {
    switch (selectionMethod) {
      case SelectionMethods.SINGLE:
        return CursorArrowRaysIcon;
      case SelectionMethods.WINDOW:
      case SelectionMethods.CROSSING:
        return Square2StackIcon;
      case SelectionMethods.LASSO:
      case SelectionMethods.POLYGONAL:
        return HandRaisedIcon;
      default:
        return CursorArrowRaysIcon;
    }
  };

  const MethodIcon = getMethodIcon();

  // Format object type for display
  const formatObjectType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Get hovered object info
  const getHoveredObjectInfo = () => {
    if (!hoveredObject || !hoveredObject.userData) return null;

    return {
      type: hoveredObject.userData.type || 'Object',
      name: hoveredObject.userData.name || hoveredObject.name || 'Unnamed',
      id: hoveredObject.uuid.slice(0, 8),
      layer: hoveredObject.userData.layer || 'Default'
    };
  };

  const hoveredInfo = getHoveredObjectInfo();

  return (
    <div className={`
      ${className}
      fixed ${positionClasses[position]} z-50
      ${t.panel} border rounded-lg shadow-lg
      p-4 min-w-64 max-w-96
    `}>
      {/* Header */}
      <div className="flex items-center space-x-2 mb-3">
        <MethodIcon className="w-5 h-5" />
        <h3 className={`font-semibold ${t.header}`}>Selection Tool</h3>
      </div>

      {/* Method Instructions */}
      {showMethodHints && instructions && (
        <div className="mb-3">
          <div className={`text-sm ${t.subtext} leading-relaxed`}>
            {instructions}
          </div>
          {isMultiSelecting && (
            <div className={`text-xs ${t.warning} mt-1`}>
              Press Escape to cancel
            </div>
          )}
        </div>
      )}

      {/* Hover Information */}
      {hoveredInfo && !isMultiSelecting && (
        <div className="mb-3">
          <div className="flex items-center space-x-2 mb-2">
            <EyeIcon className="w-4 h-4" />
            <span className={`text-sm font-medium ${t.header}`}>Hovering</span>
          </div>
          <div className={`text-sm ${t.subtext} space-y-1`}>
            <div>
              <span className="font-medium">Type:</span> {formatObjectType(hoveredInfo.type)}
            </div>
            <div>
              <span className="font-medium">Name:</span> {hoveredInfo.name}
            </div>
            <div>
              <span className="font-medium">ID:</span> <code className="font-mono">{hoveredInfo.id}</code>
            </div>
            {hoveredInfo.layer !== 'Default' && (
              <div>
                <span className="font-medium">Layer:</span> {hoveredInfo.layer}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection Statistics */}
      {showStatistics && stats && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Square2StackIcon className="w-4 h-4" />
              <span className={`text-sm font-medium ${t.header}`}>Selected</span>
            </div>
            <button
              onClick={() => setShowDetailedStats(!showDetailedStats)}
              className={`text-xs ${t.accent} hover:underline`}
            >
              {showDetailedStats ? 'Less' : 'Details'}
            </button>
          </div>

          <div className={`text-sm ${t.subtext}`}>
            <div className="flex justify-between">
              <span>Total Objects:</span>
              <span className={`font-medium ${t.success}`}>{stats.total}</span>
            </div>

            {showDetailedStats && (
              <>
                <div className={`border-t ${t.divider} my-2 pt-2`}>
                  <div className="space-y-1">
                    <div className={`text-xs font-medium ${t.header} mb-1`}>By Type</div>
                    {Object.entries(stats.byType).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-xs">
                        <span>{formatObjectType(type)}:</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {Object.keys(stats.byLayer).length > 1 && (
                  <div className={`border-t ${t.divider} my-2 pt-2`}>
                    <div className="space-y-1">
                      <div className={`text-xs font-medium ${t.header} mb-1`}>By Layer</div>
                      {Object.entries(stats.byLayer).map(([layer, count]) => (
                        <div key={layer} className="flex justify-between text-xs">
                          <span>{layer}:</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stats.bounds && (
                  <div className={`border-t ${t.divider} my-2 pt-2`}>
                    <div className={`text-xs font-medium ${t.header} mb-1`}>Bounds</div>
                    <div className="text-xs space-y-1">
                      <div>
                        Width: {(stats.bounds.max.x - stats.bounds.min.x).toFixed(2)}m
                      </div>
                      <div>
                        Height: {(stats.bounds.max.y - stats.bounds.min.y).toFixed(2)}m
                      </div>
                      <div>
                        Depth: {(stats.bounds.max.z - stats.bounds.min.z).toFixed(2)}m
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Multi-selection Progress */}
      {isMultiSelecting && mouseState.startPoint && mouseState.currentPoint && (
        <div className="mb-3">
          <div className={`text-sm ${t.header} mb-1`}>Selection Area</div>
          <div className={`text-xs ${t.subtext}`}>
            <div>
              Width: {Math.abs(mouseState.currentPoint.x - mouseState.startPoint.x)}px
            </div>
            <div>
              Height: {Math.abs(mouseState.currentPoint.y - mouseState.startPoint.y)}px
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts */}
      {showInstructions && (
        <div className={`border-t ${t.divider} pt-3`}>
          <div className="flex items-center space-x-2 mb-2">
            <InformationCircleIcon className="w-4 h-4" />
            <span className={`text-xs font-medium ${t.header}`}>Shortcuts</span>
          </div>
          <div className={`text-xs ${t.subtext} space-y-1`}>
            <div><kbd className="font-mono">Ctrl+A</kbd> Select All</div>
            <div><kbd className="font-mono">Ctrl+I</kbd> Invert Selection</div>
            <div><kbd className="font-mono">Esc</kbd> Clear Selection</div>
            <div><kbd className="font-mono">Del</kbd> Delete Selected</div>
            <div><kbd className="font-mono">Ctrl+Click</kbd> Add to Selection</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact selection status component
export const SelectionStatus = ({
  scene,
  camera,
  renderer,
  raycaster,
  className = '',
  theme = 'dark'
}) => {
  const {
    selectionCount,
    hoveredObject,
    isMultiSelecting,
    selectionMethod,
    SelectionMethods
  } = useSelection(scene, camera, renderer, raycaster);

  const themeClasses = {
    dark: {
      status: 'bg-gray-800 border-gray-600 text-white',
      accent: 'text-blue-400'
    },
    light: {
      status: 'bg-white border-gray-300 text-gray-700',
      accent: 'text-blue-600'
    }
  };

  const t = themeClasses[theme];

  const getStatusText = () => {
    if (isMultiSelecting) {
      return 'Multi-selecting...';
    }
    
    if (selectionCount > 0) {
      return `${selectionCount} selected`;
    }
    
    if (hoveredObject) {
      const type = hoveredObject.userData?.type || 'object';
      return `Hover: ${type}`;
    }
    
    const methodNames = {
      [SelectionMethods.SINGLE]: 'Single',
      [SelectionMethods.WINDOW]: 'Window',
      [SelectionMethods.CROSSING]: 'Crossing',
      [SelectionMethods.LASSO]: 'Lasso',
      [SelectionMethods.POLYGONAL]: 'Polygon'
    };
    
    return `${methodNames[selectionMethod]} mode`;
  };

  return (
    <div className={`
      ${className}
      ${t.status} border rounded px-3 py-1 text-sm
    `}>
      <span className={selectionCount > 0 ? t.accent : ''}>{getStatusText()}</span>
    </div>
  );
};

export default SelectionFeedback; 