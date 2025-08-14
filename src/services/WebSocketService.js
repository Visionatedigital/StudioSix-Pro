/**
 * WebSocket Service for FreeCAD Backend Communication
 * 
 * WEBSOCKET INTEGRATION DISABLED - Building independent CAD engine
 * This service is disabled but preserved for potential fallback use.
 * All connection methods return immediately without connecting.
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000; // 3 seconds
    this.listeners = {
      connect: [],
      disconnect: [],
      error: [],
      message: [],
      chat_response: [],
      chat_update: [],
      object_created: [],
      object_updated: [],
      object_deleted: [],
      model_state: [],
      ifc_imported: [],
      project_saved: [],
      project_created: []
    };
    
    // Configuration
    this.host = 'localhost';
    this.port = 8001;
    this.url = `ws://${this.host}:${this.port}`;
    
    // Message queue for when disconnected
    this.messageQueue = [];
    
    // Chat-specific properties
    this.messageIdCounter = 0;
    this.pendingChatMessages = new Map(); // messageId -> resolve/reject functions
  }

  /**
   * Connect to WebSocket server
   * WEBSOCKET INTEGRATION DISABLED - Always returns resolved promise without connecting
   */
  connect() {
    console.log('🚫 WebSocket connection disabled - building independent CAD engine');
    this.isConnected = false;
    return Promise.resolve();

    // Original connection logic (commented out):
    /*
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`🔌 Connecting to WebSocket server at ${this.url}...`);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = (event) => {
          console.log('✅ WebSocket connected successfully to', this.url);
          console.log('WebSocket ready state:', this.ws.readyState);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Process queued messages
          this.processMessageQueue();
          
          // Notify listeners
          this.emit('connect', event);
          
          // Request initial model state
          this.requestModelState();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
            console.error('Raw message:', event.data);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected. Code:', event.code, 'Reason:', event.reason || 'No reason given');
          console.log('Was clean close:', event.wasClean);
          this.isConnected = false;
          this.emit('disconnect', event);
          
          // Attempt reconnection if not a clean close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error occurred:', error);
          console.error('WebSocket URL:', this.url);
          console.error('WebSocket ready state:', this.ws?.readyState);
          this.emit('error', error);
          reject(error);
        };

      } catch (error) {
        console.error('❌ Error creating WebSocket connection:', error);
        reject(error);
      }
    });
    */
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
      this.isConnected = false;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect().catch(error => {
          console.error('❌ Reconnection failed:', error);
        });
      }
    }, this.reconnectInterval);
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    console.log('📨 Received WebSocket message:', data.type, data);
    
    // Emit general message event
    this.emit('message', data);
    
    // Handle specific message types
    switch (data.type) {
      case 'chat_response':
        this.handleChatResponse(data);
        break;
      
      case 'chat_update':
        this.emit('chat_update', data);
        break;
      
      case 'object_created':
        this.emit('object_created', data.object);
        break;
      
      case 'object_updated':
        this.emit('object_updated', data.object);
        break;
      
      case 'object_deleted':
        this.emit('object_deleted', data.objectId);
        break;
      
      case 'model_state':
        this.emit('model_state', data);
        break;
      
      case 'ifc_imported':
        this.emit('ifc_imported', data);
        break;
      
      case 'project_saved':
        this.emit('project_saved', data);
        break;
      
      case 'project_created':
        this.emit('project_created', data);
        break;
      
      case 'selection_changed':
        this.emit('selection_changed', data);
        break;
      
      default:
        console.log('🤷 Unknown message type:', data.type);
    }
  }

  /**
   * Handle chat response messages
   */
  handleChatResponse(data) {
    const messageId = data.messageId;
    
    // Resolve pending promise if exists
    if (this.pendingChatMessages.has(messageId)) {
      const { resolve } = this.pendingChatMessages.get(messageId);
      resolve(data);
      this.pendingChatMessages.delete(messageId);
    }
    
    // Emit chat response event
    this.emit('chat_response', data);
  }

  /**
   * Send a message to the WebSocket server
   * WEBSOCKET INTEGRATION DISABLED - Always returns false without sending
   */
  sendMessage(message) {
    console.log('🚫 WebSocket message blocked (websocket disabled):', message.type);
    return false;

    // Original sending logic (commented out):
    /*
    if (this.isConnected && this.ws) {
      try {
        const messageStr = JSON.stringify(message);
        this.ws.send(messageStr);
        console.log('📤 Sent WebSocket message:', message.type);
        return true;
      } catch (error) {
        console.error('❌ Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.log('📦 Queueing message (not connected):', message.type);
      this.messageQueue.push(message);
      return false;
    }
    */
  }

  /**
   * Process queued messages when connection is restored
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.sendMessage(message);
    }
  }

  /**
   * Send a chat message to the AI assistant
   */
  async sendChatMessage(message, context = {}) {
    const messageId = `chat_${Date.now()}_${++this.messageIdCounter}`;
    
    const chatMessage = {
      type: 'chat_message',
      messageId: messageId,
      message: message,
      context: context,
      timestamp: new Date().toISOString()
    };

    // Create promise for response
    return new Promise((resolve, reject) => {
      // Store promise callbacks
      this.pendingChatMessages.set(messageId, { resolve, reject });
      
      // Set timeout for response
      setTimeout(() => {
        if (this.pendingChatMessages.has(messageId)) {
          this.pendingChatMessages.delete(messageId);
          reject(new Error('Chat message timeout'));
        }
      }, 30000); // 30 second timeout
      
      // Send message
      const sent = this.sendMessage(chatMessage);
      if (!sent && !this.isConnected) {
        reject(new Error('WebSocket not connected'));
      }
    });
  }

  /**
   * Request current model state from FreeCAD
   */
  requestModelState() {
    this.sendMessage({ type: 'request_model_state' });
  }

  /**
   * Activate a tool in FreeCAD
   */
  activateTool(toolId, workbench = 'Arch') {
    this.sendMessage({
      type: 'activate_tool',
      toolId: toolId,
      workbench: workbench
    });
  }

  /**
   * Execute a command in FreeCAD
   */
  executeCommand(command, workbench = 'Arch', parameters = {}) {
    this.sendMessage({
      type: 'execute_command',
      command: command,
      workbench: workbench,
      parameters: parameters
    });
  }

  /**
   * Create an object in FreeCAD
   */
  createObject(objectType, position = { x: 0, y: 0, z: 0 }, dimensions = {}) {
    this.sendMessage({
      type: 'create_object',
      objectType: objectType,
      position: position,
      dimensions: dimensions
    });
  }

  /**
   * Select an object in FreeCAD
   */
  selectObject(objectId) {
    this.sendMessage({
      type: 'select_object',
      objectId: objectId
    });
  }

  /**
   * Clear object selection in FreeCAD
   */
  clearSelection() {
    this.sendMessage({
      type: 'clear_selection'
    });
  }

  /**
   * Delete an object in FreeCAD
   */
  deleteObject(objectId) {
    this.sendMessage({
      type: 'delete_object',
      objectId: objectId
    });
  }

  /**
   * Add event listener
   */
  addEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      pendingMessages: this.messageQueue.length,
      pendingChatMessages: this.pendingChatMessages.size
    };
  }
}

// Export singleton instance
const webSocketService = new WebSocketService();
export default webSocketService; 