/**
 * Command History Provider
 * React provider component that integrates the command history system with existing UI
 * Connects your existing undo/redo buttons to the command system
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import useCommandHistory from '../hooks/useCommandHistory.js';
import { browserProjectManager } from '../utils/projectHistoryIntegration.js';
import constraintService from '../services/constraintService.js';

// Create context for command history
const CommandHistoryContext = createContext(null);

// Provider component
export const CommandHistoryProvider = ({ 
  children, 
  sceneManager, 
  projectManager = browserProjectManager 
}) => {
  // Initialize command history hook
  const commandHistory = useCommandHistory(sceneManager, constraintService, projectManager);
  
  // Additional state for UI feedback
  const [isConnected, setIsConnected] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  // Initialize the system
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize constraint service
        await constraintService.initialize();
        
        // Enable auto-save
        projectManager.enableAutoSave(30000); // 30 seconds
        
        setIsConnected(true);
        console.log('Command history system initialized');
      } catch (error) {
        console.error('Failed to initialize command history system:', error);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      projectManager.cleanup();
    };
  }, [projectManager]);

  // Track last action for UI feedback
  useEffect(() => {
    if (commandHistory.undoDescription || commandHistory.redoDescription) {
      setLastAction({
        type: commandHistory.undoDescription ? 'executed' : 'waiting',
        description: commandHistory.undoDescription || commandHistory.redoDescription,
        timestamp: Date.now()
      });
    }
  }, [commandHistory.undoDescription, commandHistory.redoDescription]);

  // Enhanced command history with additional methods
  const enhancedCommandHistory = {
    ...commandHistory,
    
    // System status
    isConnected,
    lastAction,
    
    // Enhanced save with UI feedback
    saveProject: async (projectData) => {
      try {
        const result = await commandHistory.saveProject(projectData);
        if (result.success) {
          setLastAction({
            type: 'saved',
            description: 'Project saved',
            timestamp: Date.now()
          });
        }
        return result;
      } catch (error) {
        setLastAction({
          type: 'error',
          description: 'Save failed',
          timestamp: Date.now()
        });
        throw error;
      }
    },

    // Enhanced undo with UI feedback
    undo: async () => {
      try {
        const result = await commandHistory.undo();
        if (result) {
          setLastAction({
            type: 'undone',
            description: 'Action undone',
            timestamp: Date.now()
          });
        }
        return result;
      } catch (error) {
        setLastAction({
          type: 'error',
          description: 'Undo failed',
          timestamp: Date.now()
        });
        throw error;
      }
    },

    // Enhanced redo with UI feedback
    redo: async () => {
      try {
        const result = await commandHistory.redo();
        if (result) {
          setLastAction({
            type: 'redone',
            description: 'Action redone',
            timestamp: Date.now()
          });
        }
        return result;
      } catch (error) {
        setLastAction({
          type: 'error',
          description: 'Redo failed',
          timestamp: Date.now()
        });
        throw error;
      }
    },

    // Batch operations with progress tracking
    executeBatchWithProgress: async (commands, onProgress) => {
      const totalCommands = commands.length;
      const results = [];
      
      for (let i = 0; i < commands.length; i++) {
        try {
          const result = await commandHistory.executeCommand(commands[i]);
          results.push(result);
          
          if (onProgress) {
            onProgress({
              completed: i + 1,
              total: totalCommands,
              progress: ((i + 1) / totalCommands) * 100
            });
          }
        } catch (error) {
          console.error(`Failed to execute command ${i + 1}:`, error);
          results.push({ success: false, error });
        }
      }
      
      return results;
    }
  };

  return (
    <CommandHistoryContext.Provider value={enhancedCommandHistory}>
      {children}
    </CommandHistoryContext.Provider>
  );
};

// Hook to use command history context
export const useCommandHistoryContext = () => {
  const context = useContext(CommandHistoryContext);
  
  if (!context) {
    throw new Error('useCommandHistoryContext must be used within a CommandHistoryProvider');
  }
  
  return context;
};

// Enhanced Button Components that connect to your existing UI
export const UndoButton = ({ 
  className = '',
  disabled = false,
  showTooltip = true,
  children,
  ...props 
}) => {
  const { undo, canUndo, undoDescription, isExecuting } = useCommandHistoryContext();
  
  const isDisabled = disabled || !canUndo || isExecuting;
  
  const handleClick = async () => {
    if (!isDisabled) {
      await undo();
    }
  };

  return (
    <button
      className={`${className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-80'}`}
      disabled={isDisabled}
      onClick={handleClick}
      title={showTooltip ? (undoDescription || 'Nothing to undo') : undefined}
      aria-label={undoDescription || 'Undo'}
      {...props}
    >
      {children || (
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" 
          />
        </svg>
      )}
    </button>
  );
};

export const RedoButton = ({ 
  className = '',
  disabled = false,
  showTooltip = true,
  children,
  ...props 
}) => {
  const { redo, canRedo, redoDescription, isExecuting } = useCommandHistoryContext();
  
  const isDisabled = disabled || !canRedo || isExecuting;
  
  const handleClick = async () => {
    if (!isDisabled) {
      await redo();
    }
  };

  return (
    <button
      className={`${className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-80'}`}
      disabled={isDisabled}
      onClick={handleClick}
      title={showTooltip ? (redoDescription || 'Nothing to redo') : undefined}
      aria-label={redoDescription || 'Redo'}
      {...props}
    >
      {children || (
        <svg 
          className="w-5 h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" 
          />
        </svg>
      )}
    </button>
  );
};

// Save Button with dirty state indicator
export const SaveButton = ({ 
  className = '',
  disabled = false,
  showDirtyIndicator = true,
  children,
  ...props 
}) => {
  const { saveProject, isDirty, isExecuting } = useCommandHistoryContext();
  
  const isDisabled = disabled || isExecuting;
  
  const handleClick = async () => {
    if (!isDisabled) {
      // This would need to be connected to your actual project data
      await saveProject({
        // Your project data here
        entities: {},
        constraints: {},
        metadata: {
          name: 'Untitled Project',
          author: 'User'
        }
      });
    }
  };

  return (
    <button
      className={`${className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-80'} ${isDirty ? 'bg-blue-600' : 'bg-gray-600'}`}
      disabled={isDisabled}
      onClick={handleClick}
      title={isDirty ? 'Save changes' : 'No changes to save'}
      aria-label="Save project"
      {...props}
    >
      <div className="flex items-center gap-2">
        {children || (
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" 
            />
          </svg>
        )}
        {showDirtyIndicator && isDirty && (
          <span className="w-2 h-2 bg-yellow-400 rounded-full" aria-label="Unsaved changes" />
        )}
      </div>
    </button>
  );
};

// Status indicator component
export const HistoryStatusIndicator = ({ className = '' }) => {
  const { 
    historySize, 
    isDirty, 
    isExecuting, 
    lastAction,
    isConnected 
  } = useCommandHistoryContext();

  if (!isConnected) {
    return (
      <div className={`${className} text-red-500 text-sm`}>
        History system not connected
      </div>
    );
  }

  return (
    <div className={`${className} text-sm text-gray-600 flex items-center gap-2`}>
      <span>History: {historySize}</span>
      {isDirty && <span className="text-yellow-600">•</span>}
      {isExecuting && <span className="text-blue-600">Processing...</span>}
      {lastAction && (
        <span className="text-xs opacity-75">
          {lastAction.description}
        </span>
      )}
    </div>
  );
};

// History panel for debugging/advanced users
export const HistoryPanel = ({ className = '', maxItems = 10 }) => {
  const { getHistory } = useCommandHistoryContext();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const updateHistory = () => {
      const currentHistory = getHistory();
      setHistory(currentHistory.slice(-maxItems));
    };

    updateHistory();
    const interval = setInterval(updateHistory, 1000);
    
    return () => clearInterval(interval);
  }, [getHistory, maxItems]);

  return (
    <div className={`${className} bg-gray-100 p-3 rounded-lg`}>
      <h3 className="text-sm font-semibold mb-2">Command History</h3>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {history.map((item, index) => (
          <div 
            key={item.id}
            className={`text-xs p-1 rounded ${
              item.isCurrent ? 'bg-blue-200' : 
              item.isActive ? 'bg-green-100' : 'bg-gray-200'
            }`}
          >
            <span className="font-mono">#{index + 1}</span>
            <span className="ml-2">{item.description}</span>
            <span className="ml-2 opacity-75">
              {new Date(item.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommandHistoryProvider; 