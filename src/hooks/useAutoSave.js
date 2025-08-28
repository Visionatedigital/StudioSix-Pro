/**
 * useAutoSave Hook
 * React hook for integrating autosave functionality with project management
 * Connects command history changes, project state changes, and UI updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import autoSaveService from '../services/AutoSaveService';
import commandHistory from '../utils/commandHistory';

const useAutoSave = (currentProject, currentUser, sceneManager) => {
  // Autosave status state
  const [autoSaveStatus, setAutoSaveStatus] = useState({
    enabled: true,
    isAutoSaving: false,
    pendingChanges: false,
    lastSave: null,
    timeSinceLastSave: null,
    error: null
  });

  // Refs to track previous values
  const prevProjectRef = useRef(null);
  const prevUserRef = useRef(null);
  const unsubscribeRefs = useRef([]);

  // Update autosave status from service
  const updateStatus = useCallback(() => {
    const status = autoSaveService.getStatus();
    setAutoSaveStatus(prevStatus => ({
      ...prevStatus,
      enabled: status.enabled,
      isAutoSaving: status.isAutoSaving,
      pendingChanges: status.pendingChanges,
      lastSave: status.lastSave,
      timeSinceLastSave: status.timeSinceLastSave
    }));
  }, []);

  // Handle autosave events
  const handleAutoSaveEvent = useCallback((event) => {
    console.log('🔄 AutoSave event:', event.type, event);
    
    switch (event.type) {
      case 'started':
        setAutoSaveStatus(prev => ({
          ...prev,
          enabled: true,
          error: null
        }));
        break;
        
      case 'saved':
        setAutoSaveStatus(prev => ({
          ...prev,
          isAutoSaving: false,
          pendingChanges: false,
          lastSave: event.timestamp,
          timeSinceLastSave: 0,
          error: null
        }));
        break;
        
      case 'changes_detected':
        setAutoSaveStatus(prev => ({
          ...prev,
          pendingChanges: true
        }));
        break;
        
      case 'error':
        setAutoSaveStatus(prev => ({
          ...prev,
          isAutoSaving: false,
          error: event.error
        }));
        break;
        
      case 'stopped':
        setAutoSaveStatus(prev => ({
          ...prev,
          enabled: false,
          isAutoSaving: false,
          pendingChanges: false
        }));
        break;
    }
  }, []);

  // Initialize autosave when project or user changes
  useEffect(() => {
    if (!currentProject || !currentUser?.id) {
      // Stop autosave if no project or user
      if (prevProjectRef.current || prevUserRef.current) {
        autoSaveService.stopAutoSave(true);
      }
      prevProjectRef.current = null;
      prevUserRef.current = null;
      return;
    }

    // Check if project or user changed
    const projectChanged = prevProjectRef.current?.id !== currentProject.id;
    const userChanged = prevUserRef.current?.id !== currentUser.id;

    if (projectChanged || userChanged) {
      console.log('🔄 Project or user changed, reinitializing autosave');
      
      // Stop previous autosave
      if (prevProjectRef.current) {
        autoSaveService.stopAutoSave(true);
      }
      
      // Start autosave for new project
      autoSaveService.startAutoSave(currentProject, currentUser.id);
      
      // Update refs
      prevProjectRef.current = currentProject;
      prevUserRef.current = currentUser;
    }
  }, [currentProject, currentUser]);

  // Set up event listeners for autosave and command history
  useEffect(() => {
    // Listen to autosave events
    autoSaveService.addEventListener(handleAutoSaveEvent);
    
    // Listen to command history changes for autosave triggers
    const unsubCommandExecuted = commandHistory.on('commandExecuted', (data) => {
      console.log('📝 Command executed, marking changes for autosave');
      autoSaveService.markChanges({ 
        type: 'command_executed', 
        command: data.command?.type || 'unknown' 
      });
    });

    const unsubCommandUndone = commandHistory.on('commandUndone', (data) => {
      console.log('↩️ Command undone, marking changes for autosave');
      autoSaveService.markChanges({ 
        type: 'command_undone', 
        command: data.command?.type || 'unknown' 
      });
    });

    const unsubCommandRedone = commandHistory.on('commandRedone', (data) => {
      console.log('↪️ Command redone, marking changes for autosave');
      autoSaveService.markChanges({ 
        type: 'command_redone', 
        command: data.command?.type || 'unknown' 
      });
    });

    // Store unsubscribe functions
    unsubscribeRefs.current = [
      unsubCommandExecuted,
      unsubCommandUndone, 
      unsubCommandRedone
    ];

    // Cleanup function
    return () => {
      autoSaveService.removeEventListener(handleAutoSaveEvent);
      unsubscribeRefs.current.forEach(unsub => unsub());
      unsubscribeRefs.current = [];
    };
  }, [handleAutoSaveEvent]);

  // Listen for scene changes (geometry modifications, materials, etc.)
  useEffect(() => {
    if (!sceneManager) return;

    const handleSceneChange = (changeType, details) => {
      console.log('🎬 Scene changed, marking for autosave:', changeType);
      autoSaveService.markChanges({ 
        type: 'scene_change', 
        changeType, 
        details 
      });
    };

    // If sceneManager has event emitter capabilities
    if (sceneManager.on) {
      const unsubSceneChange = sceneManager.on('sceneChanged', handleSceneChange);
      return () => unsubSceneChange();
    }
  }, [sceneManager]);

  // Periodic status updates
  useEffect(() => {
    const interval = setInterval(updateStatus, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [updateStatus]);

  // Handle page unload - ensure final save
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (autoSaveStatus.pendingChanges) {
        // Perform synchronous final save attempt
        autoSaveService.forceSave();
        
        // Show warning to user
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        event.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autoSaveStatus.pendingChanges]);

  // Cleanup autosave on unmount
  useEffect(() => {
    return () => {
      autoSaveService.stopAutoSave(true);
    };
  }, []);

  // Exposed functions for manual control
  const forceSave = useCallback(async () => {
    console.log('🔄 Force saving project...');
    return await autoSaveService.forceSave();
  }, []);

  const configureAutoSave = useCallback((options) => {
    autoSaveService.configure(options);
    updateStatus();
  }, [updateStatus]);

  const markChanges = useCallback((details) => {
    autoSaveService.markChanges(details);
  }, []);

  const getRecoveredProjects = useCallback(async () => {
    if (!currentUser?.id) return [];
    return await autoSaveService.recoverUnsavedProjects(currentUser.id);
  }, [currentUser]);

  return {
    // Status
    autoSaveStatus,
    
    // Actions
    forceSave,
    configureAutoSave,
    markChanges,
    getRecoveredProjects,
    
    // Utilities
    isAutoSaving: autoSaveStatus.isAutoSaving,
    hasPendingChanges: autoSaveStatus.pendingChanges,
    lastSaveTime: autoSaveStatus.lastSave,
    autoSaveEnabled: autoSaveStatus.enabled,
    autoSaveError: autoSaveStatus.error
  };
};

export default useAutoSave;