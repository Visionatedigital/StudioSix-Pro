/**
 * useCommandHistory Hook
 * React hook for integrating command history with the UI
 * Connects to existing undo/redo buttons and provides command execution
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import commandHistory from '../utils/commandHistory.js';
import { CommandFactory } from '../commands/architecturalCommands.js';

const useCommandHistory = (sceneManager, constraintService, projectManager) => {
  // State for UI updates
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [undoDescription, setUndoDescription] = useState(null);
  const [redoDescription, setRedoDescription] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [historySize, setHistorySize] = useState(0);

  // Refs for cleanup
  const unsubscribeRefs = useRef([]);

  // Initialize command history events
  useEffect(() => {
    const updateUIState = () => {
      const info = commandHistory.getCurrentCommandInfo();
      setCanUndo(info.canUndo);
      setCanRedo(info.canRedo);
      setIsDirty(info.isDirty);
      setUndoDescription(info.undoDescription);
      setRedoDescription(info.redoDescription);
      setHistorySize(info.historySize);
    };

    // Subscribe to history events
    const unsubCommandExecuted = commandHistory.on('commandExecuted', (data) => {
      updateUIState();
      setIsExecuting(false);
    });

    const unsubCommandUndone = commandHistory.on('commandUndone', (data) => {
      updateUIState();
      setIsExecuting(false);
    });

    const unsubCommandRedone = commandHistory.on('commandRedone', (data) => {
      updateUIState();
      setIsExecuting(false);
    });

    const unsubSaveStateChanged = commandHistory.on('saveStateChanged', (data) => {
      setIsDirty(data.isDirty);
    });

    const unsubHistoryCleared = commandHistory.on('historyCleared', () => {
      updateUIState();
    });

    const unsubCommandError = commandHistory.on('commandError', (data) => {
      setIsExecuting(false);
      console.error('Command execution error:', data.error);
    });

    const unsubUndoError = commandHistory.on('undoError', (data) => {
      setIsExecuting(false);
      console.error('Undo error:', data.error);
    });

    const unsubRedoError = commandHistory.on('redoError', (data) => {
      setIsExecuting(false);
      console.error('Redo error:', data.error);
    });

    // Store unsubscribe functions
    unsubscribeRefs.current = [
      unsubCommandExecuted,
      unsubCommandUndone,
      unsubCommandRedone,
      unsubSaveStateChanged,
      unsubHistoryCleared,
      unsubCommandError,
      unsubUndoError,
      unsubRedoError
    ];

    // Initial state update
    updateUIState();

    // Cleanup on unmount
    return () => {
      unsubscribeRefs.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, []);

  // Execute command
  const executeCommand = useCallback(async (command) => {
    try {
      setIsExecuting(true);
      await commandHistory.executeCommand(command);
      return true;
    } catch (error) {
      console.error('Failed to execute command:', error);
      setIsExecuting(false);
      throw error;
    }
  }, []);

  // Undo operation (connects to your existing undo button)
  const undo = useCallback(async () => {
    if (!canUndo || isExecuting) return false;
    
    try {
      setIsExecuting(true);
      return await commandHistory.undo();
    } catch (error) {
      console.error('Failed to undo:', error);
      setIsExecuting(false);
      throw error;
    }
  }, [canUndo, isExecuting]);

  // Redo operation (connects to your existing redo button)
  const redo = useCallback(async () => {
    if (!canRedo || isExecuting) return false;
    
    try {
      setIsExecuting(true);
      return await commandHistory.redo();
    } catch (error) {
      console.error('Failed to redo:', error);
      setIsExecuting(false);
      throw error;
    }
  }, [canRedo, isExecuting]);

  // Convenience methods for common operations
  const createWall = useCallback(async (wallData) => {
    const command = CommandFactory.createWall(wallData, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const createDoor = useCallback(async (doorData) => {
    const command = CommandFactory.createDoor(doorData, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const createWindow = useCallback(async (windowData) => {
    const command = CommandFactory.createWindow(windowData, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const createSlab = useCallback(async (slabData) => {
    const command = CommandFactory.createSlab(slabData, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const createRoof = useCallback(async (roofData) => {
    const command = CommandFactory.createRoof(roofData, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const createStair = useCallback(async (stairData) => {
    const command = CommandFactory.createStair(stairData, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const deleteWall = useCallback(async (wallId) => {
    const command = CommandFactory.deleteWall(wallId, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const modifyWall = useCallback(async (wallId, wallData) => {
    const command = CommandFactory.modifyWall(wallId, wallData, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const moveEntity = useCallback(async (entityId, entityType, moveData) => {
    const command = CommandFactory.moveEntity(entityId, entityType, moveData, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const rotateEntity = useCallback(async (entityId, entityType, rotateData) => {
    const command = CommandFactory.rotateEntity(entityId, entityType, rotateData, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const scaleEntity = useCallback(async (entityId, entityType, scaleData) => {
    const command = CommandFactory.scaleEntity(entityId, entityType, scaleData, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const groupEntities = useCallback(async (entityIds) => {
    const command = CommandFactory.groupEntities(entityIds, sceneManager);
    return await executeCommand(command);
  }, [executeCommand, sceneManager]);

  const createConstraint = useCallback(async (constraintData) => {
    const command = CommandFactory.createConstraint(constraintData, constraintService);
    return await executeCommand(command);
  }, [executeCommand, constraintService]);

  const deleteConstraint = useCallback(async (constraintId) => {
    const command = CommandFactory.deleteConstraint(constraintId, constraintService);
    return await executeCommand(command);
  }, [executeCommand, constraintService]);

  const executeBatch = useCallback(async (commands) => {
    const batchCommand = CommandFactory.batch(commands);
    return await executeCommand(batchCommand);
  }, [executeCommand]);

  const saveProject = useCallback(async (projectData) => {
    const command = CommandFactory.saveProject(projectData, projectManager);
    return await executeCommand(command);
  }, [executeCommand, projectManager]);

  // Clear history (useful for new projects)
  const clearHistory = useCallback(() => {
    commandHistory.clear();
  }, []);

  // Get command history for debugging or UI display
  const getHistory = useCallback(() => {
    return commandHistory.getHistory();
  }, []);

  // Save/load history for project persistence
  const serializeHistory = useCallback(() => {
    return commandHistory.serialize();
  }, []);

  const deserializeHistory = useCallback((historyData) => {
    return commandHistory.deserialize(historyData);
  }, []);

  // Mark project as saved (for dirty state tracking)
  const markProjectAsSaved = useCallback(() => {
    commandHistory.markAsSaved();
  }, []);

  // Keyboard shortcuts (can be connected to your existing shortcuts)
  const handleKeyboardShortcut = useCallback((event) => {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'z':
          if (event.shiftKey) {
            // Ctrl+Shift+Z or Cmd+Shift+Z for redo
            event.preventDefault();
            redo();
          } else {
            // Ctrl+Z or Cmd+Z for undo
            event.preventDefault();
            undo();
          }
          break;
        case 'y':
          // Ctrl+Y for redo (Windows style)
          if (!event.shiftKey) {
            event.preventDefault();
            redo();
          }
          break;
        case 's':
          // Ctrl+S for save
          event.preventDefault();
          if (projectManager && typeof projectManager.saveProject === 'function') {
            saveProject();
          }
          break;
      }
    }
  }, [undo, redo, saveProject, projectManager]);

  // Register keyboard shortcuts
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcut);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcut);
    };
  }, [handleKeyboardShortcut]);

  // Return hook interface
  return {
    // State for UI updates
    canUndo,
    canRedo,
    isDirty,
    undoDescription,
    redoDescription,
    isExecuting,
    historySize,

    // Core operations (connect these to your existing buttons)
    undo,
    redo,
    executeCommand,

    // Convenience methods for architectural operations
    createWall,
    createDoor,
    createWindow,
    createSlab,
    createRoof,
    createStair,
    deleteWall,
    modifyWall,
    moveEntity,
    rotateEntity,
    scaleEntity,
    groupEntities,

    // Constraint operations
    createConstraint,
    deleteConstraint,

    // Batch operations
    executeBatch,

    // Project operations
    saveProject,
    markProjectAsSaved,

    // History management
    clearHistory,
    getHistory,
    serializeHistory,
    deserializeHistory,

    // Factory access for custom commands
    CommandFactory
  };
};

export default useCommandHistory; 