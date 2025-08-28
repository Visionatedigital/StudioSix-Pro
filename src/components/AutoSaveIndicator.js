/**
 * AutoSave Indicator Component
 * Shows autosave status, progress, and provides manual save controls
 * Displays in the top toolbar or corner of the application
 */

import React, { useState, useEffect } from 'react';
import {
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

const AutoSaveIndicator = ({ 
  autoSaveStatus, 
  onForceSave, 
  onConfigure, 
  className = '' 
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [timeSinceLastSave, setTimeSinceLastSave] = useState(null);

  // Update time since last save
  useEffect(() => {
    if (!autoSaveStatus.lastSave) return;

    const updateTime = () => {
      const lastSave = new Date(autoSaveStatus.lastSave);
      const now = new Date();
      const diffMs = now - lastSave;
      
      if (diffMs < 60000) {
        setTimeSinceLastSave('just now');
      } else if (diffMs < 3600000) {
        const minutes = Math.floor(diffMs / 60000);
        setTimeSinceLastSave(`${minutes}m ago`);
      } else {
        const hours = Math.floor(diffMs / 3600000);
        setTimeSinceLastSave(`${hours}h ago`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [autoSaveStatus.lastSave]);

  // Get status icon and color
  const getStatusDisplay = () => {
    if (autoSaveStatus.error) {
      return {
        icon: ExclamationTriangleIcon,
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        message: 'Autosave failed'
      };
    }
    
    if (autoSaveStatus.isAutoSaving) {
      return {
        icon: CloudArrowUpIcon,
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        message: 'Saving...'
      };
    }
    
    if (autoSaveStatus.pendingChanges) {
      return {
        icon: ClockIcon,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        message: 'Unsaved changes'
      };
    }
    
    if (autoSaveStatus.lastSave) {
      return {
        icon: CheckCircleIcon,
        color: 'text-green-500',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        message: 'All changes saved'
      };
    }
    
    return {
      icon: CloudArrowDownIcon,
      color: 'text-gray-400',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      message: 'No changes'
    };
  };

  const statusDisplay = getStatusDisplay();
  const Icon = statusDisplay.icon;

  if (!autoSaveStatus.enabled) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main indicator button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200
          ${statusDisplay.bgColor} ${statusDisplay.borderColor} ${statusDisplay.color}
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
        `}
        title={statusDisplay.message}
      >
        <Icon 
          className={`w-4 h-4 ${autoSaveStatus.isAutoSaving ? 'animate-spin' : ''}`} 
        />
        <span className="text-sm font-medium hidden sm:block">
          {statusDisplay.message}
        </span>
        {timeSinceLastSave && !autoSaveStatus.isAutoSaving && !autoSaveStatus.pendingChanges && (
          <span className="text-xs opacity-75 hidden md:block">
            {timeSinceLastSave}
          </span>
        )}
      </button>

      {/* Detailed status dropdown */}
      {showDetails && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">AutoSave Status</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {/* Status details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${statusDisplay.color}`}>
                  {statusDisplay.message}
                </span>
              </div>

              {autoSaveStatus.lastSave && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last saved:</span>
                  <span className="text-gray-900">
                    {timeSinceLastSave || 'Unknown'}
                  </span>
                </div>
              )}

              {autoSaveStatus.error && (
                <div className="text-sm">
                  <span className="text-gray-600">Error:</span>
                  <p className="text-red-600 mt-1 text-xs">
                    {autoSaveStatus.error}
                  </p>
                </div>
              )}

              {/* Progress indicator */}
              {autoSaveStatus.isAutoSaving && (
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Saving...</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full animate-pulse w-3/4"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => {
                  onForceSave?.();
                  setShowDetails(false);
                }}
                disabled={autoSaveStatus.isAutoSaving}
                className="
                  flex-1 flex items-center justify-center gap-2 px-3 py-2 
                  bg-blue-500 text-white text-sm rounded-md
                  hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-200
                "
              >
                <ArrowPathIcon className="w-4 h-4" />
                Save Now
              </button>
              
              {onConfigure && (
                <button
                  onClick={() => {
                    onConfigure();
                    setShowDetails(false);
                  }}
                  className="
                    px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-md
                    hover:bg-gray-50 transition-colors duration-200
                  "
                  title="Configure AutoSave"
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Statistics (if available) */}
            {autoSaveStatus.stats && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Total saves:</span>
                    <span>{autoSaveStatus.stats.totalAutoSaves || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success rate:</span>
                    <span>
                      {autoSaveStatus.stats.totalAutoSaves > 0 
                        ? Math.round((autoSaveStatus.stats.successfulSaves / autoSaveStatus.stats.totalAutoSaves) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoSaveIndicator;