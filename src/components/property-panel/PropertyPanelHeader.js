import React from 'react';
import { XMarkIcon, MinusIcon, ArrowPathIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const PropertyPanelHeader = ({
  title,
  onClose,
  onMinimize,
  onMouseDown,
  isMinimized,
  isMinimizable,
  isSyncing = false,
  isLoading = false,
  theme = 'dark',
  opacity = 1,
  onOpacityChange
}) => {
  return (
    <div
      className={`property-panel-header flex items-center justify-between px-4 py-2 border-b cursor-move transition-all duration-200 ${
        theme === 'dark' 
          ? 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800/70' 
          : 'bg-gray-100/50 border-gray-300/50 hover:bg-gray-100/70'
      }`}
      onMouseDown={onMouseDown}
      id="property-panel-title"
    >
      <div className="flex items-center space-x-2">
        <h3 className={`text-sm font-semibold select-none ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>{title}</h3>
        {isSyncing && (
          <ArrowPathIcon className="w-3 h-3 text-studiosix-400 animate-spin" title="Syncing changes..." />
        )}
        {isLoading && (
          <div className="w-3 h-3 border-2 border-studiosix-400 border-t-transparent rounded-full animate-spin" title="Loading properties..." />
        )}
      </div>
      
      <div className="flex items-center space-x-1">
        {onOpacityChange && (
          <div className="flex items-center space-x-1 px-2">
            <EyeSlashIcon className={`w-3 h-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
              className="w-12 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer opacity-slider"
              title={`Panel opacity: ${Math.round(opacity * 100)}%`}
            />
            <EyeIcon className={`w-3 h-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
        )}
        
        {isMinimizable && (
          <button
            onClick={onMinimize}
            className={`p-1 rounded-md transition-colors ${
              theme === 'dark' 
                ? 'hover:bg-gray-700/50 text-gray-400 hover:text-white' 
                : 'hover:bg-gray-200/50 text-gray-600 hover:text-gray-900'
            }`}
            title={isMinimized ? 'Expand panel' : 'Minimize panel'}
            aria-label={isMinimized ? 'Expand panel' : 'Minimize panel'}
          >
            <MinusIcon className="w-4 h-4" />
          </button>
        )}
        
        <button
          onClick={onClose}
          className={`p-1 rounded-md transition-colors ${
            theme === 'dark' 
              ? 'hover:bg-gray-700/50 text-gray-400 hover:text-white' 
              : 'hover:bg-gray-200/50 text-gray-600 hover:text-gray-900'
          }`}
          title="Close panel"
          aria-label="Close panel"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PropertyPanelHeader; 