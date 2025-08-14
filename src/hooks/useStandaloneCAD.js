/**
 * React hook for Standalone CAD Engine integration
 * 
 * Provides a clean interface for the React components to interact with the CAD engine
 */

import { useState, useEffect, useCallback } from 'react';
import standaloneCADEngine from '../services/StandaloneCADEngine';

export const useStandaloneCAD = () => {
  const [objects, setObjects] = useState([]);
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [isConnected, setIsConnected] = useState(true); // Always true for standalone mode

  // Update objects state when CAD engine changes
  useEffect(() => {
    const handleObjectCreated = (data) => {
      setObjects(standaloneCADEngine.getAllObjects());
    };

    const handleObjectUpdated = (data) => {
      setObjects(standaloneCADEngine.getAllObjects());
    };

    const handleObjectDeleted = (data) => {
      setObjects(standaloneCADEngine.getAllObjects());
    };

    const handleSelectionChanged = (data) => {
      setSelectedObjects(data.selectedObjects || []);
    };

    const handleModelState = (data) => {
      setObjects(data.objects || []);
    };

    // Add event listeners
    standaloneCADEngine.addEventListener('object_created', handleObjectCreated);
    standaloneCADEngine.addEventListener('object_updated', handleObjectUpdated);
    standaloneCADEngine.addEventListener('object_deleted', handleObjectDeleted);
    standaloneCADEngine.addEventListener('selection_changed', handleSelectionChanged);
    standaloneCADEngine.addEventListener('model_state', handleModelState);

    // Initialize with current state
    setObjects(standaloneCADEngine.getAllObjects());
    setSelectedObjects(standaloneCADEngine.getSelectedObjects().map(obj => obj.id));

    return () => {
      standaloneCADEngine.removeEventListener('object_created', handleObjectCreated);
      standaloneCADEngine.removeEventListener('object_updated', handleObjectUpdated);
      standaloneCADEngine.removeEventListener('object_deleted', handleObjectDeleted);
      standaloneCADEngine.removeEventListener('selection_changed', handleSelectionChanged);
      standaloneCADEngine.removeEventListener('model_state', handleModelState);
    };
  }, []);

  // API methods
  const createObject = useCallback((type, position = { x: 0, y: 0, z: 0 }, params = {}) => {
    console.log('🏗️ CREATEOBJECT DEBUG: Function called with:', { type, position, params });
    console.log('🏗️ CREATEOBJECT DEBUG: StandaloneCADEngine available:', !!standaloneCADEngine);
    
    const objectParams = {
      ...params,
      position
    };
    
    console.log(`🔧 CREATEOBJECT DEBUG: Final params for ${type}:`, objectParams);
    
    try {
      const result = standaloneCADEngine.createObject(type, objectParams);
      console.log('🏗️ CREATEOBJECT DEBUG: CAD engine returned:', result);
      return result;
    } catch (error) {
      console.error('🏗️ CREATEOBJECT DEBUG: Error in CAD engine:', error);
      throw error;
    }
  }, []);

  const updateObject = useCallback((objectId, newParams) => {
    return standaloneCADEngine.updateObject(objectId, newParams);
  }, []);

  const deleteObject = useCallback((objectId) => {
    return standaloneCADEngine.deleteObject(objectId);
  }, []);

  const selectObject = useCallback((objectId, addToSelection = false) => {
    if (objectId) {
      standaloneCADEngine.selectObject(objectId, addToSelection);
    } else {
      standaloneCADEngine.clearSelection();
    }
  }, []);

  const clearSelection = useCallback(() => {
    standaloneCADEngine.clearSelection();
  }, []);

  // Tool-specific creation methods
  const createSlab = useCallback((params) => {
    const { width = 5, depth = 5, thickness = 0.2, material = 'concrete', position = { x: 0, y: 0, z: 0 } } = params;
    
    return createObject('slab', position, {
      width,
      depth,
      thickness,
      material,
      shape: params.shape || 'rectangular'
    });
  }, [createObject]);

  const createWall = useCallback((startPoint, endPoint, params = {}) => {
    // TODO: Implement wall creation
    console.log('Wall creation not yet implemented');
    return null;
  }, []);

  // Preview methods
  const createPreview = useCallback((type, params) => {
    return standaloneCADEngine.createPreview(type, params);
  }, []);

  const clearPreview = useCallback(() => {
    standaloneCADEngine.clearPreview();
  }, []);

  // Chat integration (stub)
  const sendChatMessage = useCallback(async (message, context = {}) => {
    console.log('📢 Chat message (standalone mode):', message);
    return Promise.resolve({ success: true, message: 'Standalone CAD mode - chat disabled' });
  }, []);

  const clearChatHistory = useCallback(() => {
    console.log('🧹 Clear chat history (standalone mode)');
  }, []);

  // Step execution (stub)
  const executeStep = useCallback(async (stepId, params) => {
    console.log('⚡ Execute step (standalone mode):', stepId);
    return Promise.resolve({ success: true });
  }, []);

  const skipStep = useCallback(async (stepId) => {
    console.log('⏭️ Skip step (standalone mode):', stepId);
    return Promise.resolve({ success: true });
  }, []);

  return {
    // Connection state
    isConnected,
    connectionStatus: { 
      isConnected: true, 
      reconnectAttempts: 0, 
      maxReconnectAttempts: 0, 
      pendingMessages: 0, 
      pendingChatMessages: 0 
    },

    // Data state
    objects,
    selectedObjects,
    chatMessages: [], // Empty for standalone mode
    stepExecutionStates: {},

    // Core CAD methods
    createObject,
    updateObject,
    deleteObject,
    selectObject,
    clearSelection,

    // Tool-specific methods
    createSlab,
    createWall,

    // Preview methods
    createPreview,
    clearPreview,

    // Chat methods (stubs)
    sendChatMessage,
    clearChatHistory,

    // Step execution methods (stubs)
    executeStep,
    skipStep,
    getStepExecutionStatus: () => ({ status: 'pending', isExecuting: false }),
    resetStepExecution: () => {},
    resetAllStepExecutions: () => {},

    // Property updates
    updateObjectProperty: async (objectId, propertyName, newValue) => {
      const updateParams = { [propertyName]: newValue };
      return updateObject(objectId, updateParams);
    },

    // Additional helpers
    get3DScene: () => standaloneCADEngine.get3DScene(),
    get2DScene: () => standaloneCADEngine.get2DScene(),
  };
};

export default useStandaloneCAD;