/**
 * AutoSave Status Component
 * Subtle text-only status indicator for the header
 * Shows simple status without visual clutter
 */

import React, { useState, useEffect } from 'react';

const AutoSaveStatus = ({ autoSaveStatus, className = '' }) => {
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
    const interval = setInterval(updateTime, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [autoSaveStatus.lastSave]);

  // Get status text and color
  const getStatusDisplay = () => {
    if (autoSaveStatus.error) {
      return {
        text: 'Save failed',
        color: 'text-red-400'
      };
    }
    
    if (autoSaveStatus.isAutoSaving) {
      return {
        text: 'Saving...',
        color: 'text-blue-400'
      };
    }
    
    if (autoSaveStatus.pendingChanges) {
      return {
        text: 'Unsaved changes',
        color: 'text-yellow-400'
      };
    }
    
    if (autoSaveStatus.lastSave && timeSinceLastSave) {
      return {
        text: `Saved ${timeSinceLastSave}`,
        color: 'text-green-400'
      };
    }
    
    return {
      text: 'No changes',
      color: 'text-gray-500'
    };
  };

  if (!autoSaveStatus.enabled) {
    return null;
  }

  const statusDisplay = getStatusDisplay();

  return (
    <span className={`text-xs font-medium ${statusDisplay.color} ${className}`}>
      {statusDisplay.text}
    </span>
  );
};

export default AutoSaveStatus;