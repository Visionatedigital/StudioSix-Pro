import { useState, useEffect, useCallback, useRef } from 'react';
import webSocketService from '../services/WebSocketService';

/**
 * React hook for WebSocket integration with FreeCAD backend
 * 
 * WEBSOCKET INTEGRATION DISABLED - Building independent CAD engine
 * This hook is disabled but preserved for potential fallback use.
 * All methods return stub implementations.
 */
export const useWebSocket = () => {
  console.log('🚫 useWebSocket hook disabled - building independent CAD engine');
  
  // Return stub implementations
  return {
    isConnected: false,
    connectionStatus: { isConnected: false, reconnectAttempts: 0, maxReconnectAttempts: 5, pendingMessages: 0, pendingChatMessages: 0 },
    lastMessage: null,
    chatMessages: [],
    objects: [],
    selectedObjects: [],
    stepExecutionStates: {},
    connect: () => Promise.resolve(),
    disconnect: () => {},
    sendChatMessage: async () => Promise.resolve({ success: false, message: 'WebSocket integration disabled' }),
    clearChatHistory: () => {},
    requestModelState: () => {},
    activateTool: () => {},
    executeCommand: () => {},
    createObject: () => {},
    selectObject: () => {},
    clearSelection: () => {},
    deleteObject: () => {},
    executeStep: async () => Promise.resolve({ success: false }),
    skipStep: async () => Promise.resolve({ success: false }),
    editStep: async () => Promise.resolve({ success: false }),
    updateStepParameter: async () => Promise.resolve({ success: false }),
    getStepExecutionStatus: () => ({ status: 'pending', isExecuting: false }),
    resetStepExecution: () => {},
    resetAllStepExecutions: () => {},
    updateObjectProperty: async () => Promise.resolve({ success: false })
  };
};

// Original implementation (commented out):
/*
export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    pendingMessages: 0,
    pendingChatMessages: 0
  });
  const [lastMessage, setLastMessage] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [objects, setObjects] = useState([]);
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [stepExecutionStates, setStepExecutionStates] = useState({}); // stepId -> { status, isExecuting, lastUpdated }
  
  // Refs to avoid stale closures in event listeners
  const isConnectedRef = useRef(isConnected);
  const chatMessagesRef = useRef(chatMessages);
  const objectsRef = useRef(objects);

  // Update refs when state changes
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  // Event handlers
  const handleConnect = useCallback(() => {
    console.log('🔌 WebSocket connected');
    setIsConnected(true);
    setConnectionStatus(webSocketService.getConnectionStatus());
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log('🔌 WebSocket disconnected');
    setIsConnected(false);
    setConnectionStatus(webSocketService.getConnectionStatus());
  }, []);

  const handleError = useCallback((error) => {
    console.error('❌ WebSocket error:', error);
    setConnectionStatus(webSocketService.getConnectionStatus());
  }, []);

  const handleMessage = useCallback((data) => {
    setLastMessage(data);
  }, []);

  const handleChatResponse = useCallback((data) => {
    const newMessage = {
      id: data.messageId,
      type: 'ai',
      message: data.response,
      timestamp: data.timestamp || new Date().toISOString(),
      success: data.success
    };
    
    setChatMessages(prev => [...prev, newMessage]);
  }, []);

  const handleChatUpdate = useCallback((data) => {
    // This handler is now unused since we removed chat_update broadcasts
    // Keeping it for compatibility but it won't receive events
    console.log('Received unexpected chat_update event:', data);
  }, []);

  const handleObjectCreated = useCallback((object) => {
    console.log('➕ Creating object:', object.type, object.id);
    setObjects(prev => {
      const existingIndex = prev.findIndex(obj => obj.id === object.id);
      if (existingIndex >= 0) {
        // Update existing object
        return prev.map((obj, index) => index === existingIndex ? object : obj);
      } else {
        // Add new object
        return [...prev, object];
      }
    });
  }, []);

  const handleObjectUpdated = useCallback((object) => {
    setObjects(prev => {
      const existingIndex = prev.findIndex(obj => obj.id === object.id);
      if (existingIndex >= 0) {
        // Update existing object
        return prev.map((obj, index) => index === existingIndex ? object : obj);
      } else {
        // Add new object if it doesn't exist
        return [...prev, object];
      }
    });
  }, []);

  const handleObjectDeleted = useCallback((objectId) => {
    setObjects(prev => prev.filter(obj => obj.id !== objectId));
    
    // Remove from selection if selected
    setSelectedObjects(prev => prev.filter(id => id !== objectId));
  }, []);

  const handleModelState = useCallback((data) => {
    console.log('🗃️ handleModelState called with:', data);
    if (data.objects) {
      // Ensure objects is always an array
      const objectsArray = Array.isArray(data.objects) ? data.objects : 
                          typeof data.objects === 'object' ? Object.values(data.objects) : [];
      console.log('🔄 Setting objects from model_state:', objectsArray.length, 'objects');
      console.log('📋 Objects list:', objectsArray.map(obj => ({ id: obj.id, type: obj.type })));
      
      // DEBUG: Check wall objects specifically for rotation data from backend
      const wallObjects = objectsArray.filter(obj => obj.type === 'Wall');
      if (wallObjects.length > 0) {
        console.log('🧱 BACKEND WALL OBJECTS RECEIVED:', wallObjects.map(wall => ({
          id: wall.id,
          position: wall.position,
          rotation: wall.rotation,
          hasRotation: !!(wall.rotation && (wall.rotation.x || wall.rotation.y || wall.rotation.z)),
          fullData: wall
        })));
      }
      
      setObjects(objectsArray);
    }
    if (data.selectedObjects) {
      setSelectedObjects(data.selectedObjects);
    }
  }, []);

  const handleObjectPropertyUpdated = useCallback((data) => {
    const { objectId, propertyName, newValue, updatedObject } = data;
    
    console.log(`🔄 Property update received: ${propertyName} of ${objectId} = ${newValue}`);
    
    // Update the object in our local state
    setObjects(prev => {
      const updatedObjects = prev.map(obj => {
        if (obj.id === objectId) {
          return {
            ...obj,
            [propertyName]: newValue,
            ...updatedObject // Include any other updated properties
          };
        }
        return obj;
      });
      return updatedObjects;
    });
  }, []);

  const handleIfcImported = useCallback((data) => {
    console.log('🏗️ IFC import result received:', data);
    
    const resultMessage = {
      id: `ifc_result_${Date.now()}`,
      type: 'ai',
      timestamp: new Date().toISOString()
    };
    
    if (data.success) {
      resultMessage.message = `✅ **IFC Import Successful!**\n\n` +
        `📊 **Import Summary:**\n` +
        `- **File:** ${data.fileName || 'IFC file'}\n` +
        `- **Objects imported:** ${data.summary?.total_imported || data.objects?.length || 0}\n` +
        `- **Walls:** ${data.summary?.walls || 0}\n` +
        `- **Slabs:** ${data.summary?.slabs || 0}\n` +
        `- **Columns:** ${data.summary?.columns || 0}\n\n` +
        `🏗️ **Building Structure:**\n` +
        `- **Sites:** ${data.structure?.sites || 0}\n` +
        `- **Buildings:** ${data.structure?.buildings || 0}\n` +
        `- **Stories:** ${data.structure?.storeys || 0}\n\n` +
        `All objects have been imported and should now be visible in the 3D viewport.`;
      resultMessage.success = true;
    } else {
      resultMessage.message = `❌ **IFC Import Failed**\n\n` +
        `**Error:** ${data.message || 'Unknown error occurred'}\n\n` +
        `Please check that your IFC file is valid and try again.`;
      resultMessage.success = false;
    }
    
    setChatMessages(prev => [...prev, resultMessage]);
  }, []);

  const handleProjectSaved = useCallback((data) => {
    console.log('💾 Project save completed:', data);
    
    const resultMessage = {
      id: `save_result_${Date.now()}`,
      type: 'ai',
      timestamp: new Date().toISOString()
    };
    
    if (data.success) {
      resultMessage.message = `✅ **Project Saved Successfully!**\n\n` +
        `📊 **Save Summary:**\n` +
        `- **File:** ${data.data?.fileName || 'project'}.${data.data?.format?.toLowerCase() || 'unknown'}\n` +
        `- **Format:** ${data.data?.format || 'Unknown'}\n` +
        `- **Location:** ${data.data?.path || 'Default location'}\n\n` +
        `🎯 **Status:** Save complete - your project has been successfully saved!`;
      resultMessage.success = true;
    } else {
      resultMessage.message = `❌ **Project Save Failed!**\n\n` +
        `**Error:** ${data.message || 'Unknown error occurred'}\n\n` +
        `Please check your permissions and available disk space, then try again.`;
      resultMessage.success = false;
    }
    
    setChatMessages(prev => [...prev, resultMessage]);
  }, []);

  // Set up event listeners
  useEffect(() => {
    webSocketService.addEventListener('connect', handleConnect);
    webSocketService.addEventListener('disconnect', handleDisconnect);
    webSocketService.addEventListener('error', handleError);
    webSocketService.addEventListener('message', handleMessage);
    webSocketService.addEventListener('chat_response', handleChatResponse);
    webSocketService.addEventListener('chat_update', handleChatUpdate);
    webSocketService.addEventListener('object_created', handleObjectCreated);
    webSocketService.addEventListener('object_updated', handleObjectUpdated);
    webSocketService.addEventListener('object_deleted', handleObjectDeleted);
    webSocketService.addEventListener('model_state', handleModelState);
    webSocketService.addEventListener('object_property_updated', handleObjectPropertyUpdated);
    webSocketService.addEventListener('ifc_imported', handleIfcImported);
    webSocketService.addEventListener('project_saved', handleProjectSaved);

    return () => {
      webSocketService.removeEventListener('connect', handleConnect);
      webSocketService.removeEventListener('disconnect', handleDisconnect);
      webSocketService.removeEventListener('error', handleError);
      webSocketService.removeEventListener('message', handleMessage);
      webSocketService.removeEventListener('chat_response', handleChatResponse);
      webSocketService.removeEventListener('chat_update', handleChatUpdate);
      webSocketService.removeEventListener('object_created', handleObjectCreated);
      webSocketService.removeEventListener('object_updated', handleObjectUpdated);
      webSocketService.removeEventListener('object_deleted', handleObjectDeleted);
      webSocketService.removeEventListener('model_state', handleModelState);
      webSocketService.removeEventListener('object_property_updated', handleObjectPropertyUpdated);
      webSocketService.removeEventListener('ifc_imported', handleIfcImported);
      webSocketService.removeEventListener('project_saved', handleProjectSaved);
    };
  }, [
    handleConnect,
    handleDisconnect,
    handleError,
    handleMessage,
    handleChatResponse,
    handleChatUpdate,
    handleObjectCreated,
    handleObjectUpdated,
    handleObjectDeleted,
    handleModelState,
    handleObjectPropertyUpdated,
    handleIfcImported,
    handleProjectSaved
  ]);

  // Auto-connect on mount
  useEffect(() => {
    webSocketService.connect().catch(error => {
      console.error('❌ Failed to connect to WebSocket:', error);
    });

    return () => {
      // Don't disconnect on unmount to allow reconnection
      // webSocketService.disconnect();
    };
  }, []);

  // API methods
  const connect = useCallback(() => {
    return webSocketService.connect();
  }, []);

  const disconnect = useCallback(() => {
    webSocketService.disconnect();
  }, []);

  const sendChatMessage = useCallback(async (message, context = {}) => {
    try {
      // Add user message to local state immediately
      const userMessage = {
        id: `user_${Date.now()}`,
        type: 'user',
        message: message,
        timestamp: new Date().toISOString()
      };
      
      setChatMessages(prev => [...prev, userMessage]);

      // Send to backend and get response
      const response = await webSocketService.sendChatMessage(message, context);
      
      // Note: The AI response will be added via the chat_response event handler
      return response;
    } catch (error) {
      console.error('❌ Error sending chat message:', error);
      
      // Add error message to chat
      const errorMessage = {
        id: `error_${Date.now()}`,
        type: 'ai',
        message: `❌ **Error**: ${error.message}`,
        timestamp: new Date().toISOString(),
        success: false
      };
      
      setChatMessages(prev => [...prev, errorMessage]);
      
      throw error;
    }
  }, []);

  const clearChatHistory = useCallback(() => {
    setChatMessages([]);
  }, []);

  const requestModelState = useCallback(() => {
    webSocketService.requestModelState();
  }, []);

  const activateTool = useCallback((toolId, workbench = 'Arch') => {
    webSocketService.activateTool(toolId, workbench);
  }, []);

  const executeCommand = useCallback((command, workbench = 'Arch', parameters = {}) => {
    webSocketService.executeCommand(command, workbench, parameters);
  }, []);

  const createObject = useCallback((objectType, position = { x: 0, y: 0, z: 0 }, dimensions = {}) => {
    webSocketService.createObject(objectType, position, dimensions);
  }, []);

  const selectObject = useCallback((objectId) => {
    webSocketService.selectObject(objectId);
    setSelectedObjects(prev => [...prev, objectId]);
  }, []);

  const clearSelection = useCallback(() => {
    webSocketService.clearSelection();
    setSelectedObjects([]);
  }, []);

  const deleteObject = useCallback((objectId) => {
    webSocketService.deleteObject(objectId);
  }, []);

  // Interactive Step Execution Methods
  const executeStep = useCallback(async (stepId, parameters = {}) => {
    try {
      // Update execution state
      setStepExecutionStates(prev => ({
        ...prev,
        [stepId]: {
          status: 'running',
          isExecuting: true,
          lastUpdated: new Date().toISOString()
        }
      }));

      // Send step execution request to backend
      const message = {
        type: 'execute_step',
        stepId: stepId,
        parameters: parameters,
        timestamp: new Date().toISOString()
      };

      const result = await webSocketService.sendMessage(message);

      // Update execution state based on result
      setStepExecutionStates(prev => ({
        ...prev,
        [stepId]: {
          status: result.success ? 'completed' : 'failed',
          isExecuting: false,
          lastUpdated: new Date().toISOString(),
          result: result
        }
      }));

      return result;
    } catch (error) {
      console.error('❌ Error executing step:', error);
      
      // Update execution state to failed
      setStepExecutionStates(prev => ({
        ...prev,
        [stepId]: {
          status: 'failed',
          isExecuting: false,
          lastUpdated: new Date().toISOString(),
          error: error.message
        }
      }));

      throw error;
    }
  }, []);

  const skipStep = useCallback(async (stepId) => {
    try {
      // Update execution state
      setStepExecutionStates(prev => ({
        ...prev,
        [stepId]: {
          status: 'skipped',
          isExecuting: false,
          lastUpdated: new Date().toISOString()
        }
      }));

      // Send skip request to backend
      const message = {
        type: 'skip_step',
        stepId: stepId,
        timestamp: new Date().toISOString()
      };

      const result = await webSocketService.sendMessage(message);
      return result;
    } catch (error) {
      console.error('❌ Error skipping step:', error);
      throw error;
    }
  }, []);

  const editStep = useCallback(async (stepId, stepData) => {
    try {
      // Send edit request to backend
      const message = {
        type: 'edit_step',
        stepId: stepId,
        stepData: stepData,
        timestamp: new Date().toISOString()
      };

      const result = await webSocketService.sendMessage(message);
      return result;
    } catch (error) {
      console.error('❌ Error editing step:', error);
      throw error;
    }
  }, []);

  const updateStepParameter = useCallback(async (stepId, parameterName, parameterValue) => {
    try {
      // Send parameter update to backend
      const message = {
        type: 'update_step_parameter',
        stepId: stepId,
        parameterName: parameterName,
        parameterValue: parameterValue,
        timestamp: new Date().toISOString()
      };

      const result = await webSocketService.sendMessage(message);
      return result;
    } catch (error) {
      console.error('❌ Error updating step parameter:', error);
      throw error;
    }
  }, []);

  const getStepExecutionStatus = useCallback((stepId) => {
    return stepExecutionStates[stepId] || { status: 'pending', isExecuting: false };
  }, [stepExecutionStates]);

  const resetStepExecution = useCallback((stepId) => {
    setStepExecutionStates(prev => {
      const newState = { ...prev };
      delete newState[stepId];
      return newState;
    });
  }, []);

  const resetAllStepExecutions = useCallback(() => {
    setStepExecutionStates({});
  }, []);

  // Object Property Update Method
  const updateObjectProperty = useCallback(async (objectId, propertyName, newValue) => {
    try {
      console.log(`🔧 Updating property ${propertyName} of object ${objectId} to:`, newValue);
      
      // Send property update to backend
      const message = {
        type: 'update_object_property',
        objectId: objectId,
        propertyName: propertyName,
        newValue: newValue,
        timestamp: new Date().toISOString()
      };

      const result = await webSocketService.sendMessage(message);
      return result;
    } catch (error) {
      console.error('❌ Error updating object property:', error);
      throw error;
    }
  }, []);

  return {
    // Connection state
    isConnected,
    connectionStatus,
    
    // Data state
    lastMessage,
    chatMessages,
    objects,
    selectedObjects,
    
    // API methods
    connect,
    disconnect,
    sendChatMessage,
    clearChatHistory,
    requestModelState,
    activateTool,
    executeCommand,
    createObject,
    selectObject,
    clearSelection,
    deleteObject,
    
    // Interactive Step Execution
    executeStep,
    skipStep,
    editStep,
    updateStepParameter,
    getStepExecutionStatus,
    resetStepExecution,
    resetAllStepExecutions,
    stepExecutionStates,
    
    // Object Property Updates
    updateObjectProperty
  };
};

export default useWebSocket;
*/ 