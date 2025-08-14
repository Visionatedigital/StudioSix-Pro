/**
 * AI Command Executor Service
 * 
 * Native AI chat integration for StudioSix that directly interfaces with:
 * - Standalone CAD Engine for geometry creation/manipulation
 * - Toolbar tools for parameter control
 * - Viewports for visual feedback
 * - Project tree for hierarchy management
 * 
 * Replaces WebSocket-based command pipeline with direct API calls
 */

import standaloneCADEngine from './StandaloneCADEngine';

class AICommandExecutor {
  constructor() {
    this.isProcessing = false;
    this.listeners = new Map();
    this.context = {
      selectedTool: null,
      selectedObjects: new Set(),
      viewMode: '3d',
      currentFloor: 'ground',
      projectHierarchy: [],
      availableTools: ['wall', 'slab', 'door', 'window', 'column', 'roof', 'stair'],
      viewportData: null
    };
    
    // Tool creation handlers
    this.toolHandlers = new Map();
    this.setupToolHandlers();
  }

  /**
   * Set up tool creation handlers
   */
  setupToolHandlers() {
    this.toolHandlers.set('wall', this.createWall.bind(this));
    this.toolHandlers.set('slab', this.createSlab.bind(this));
    this.toolHandlers.set('door', this.createDoor.bind(this));
    this.toolHandlers.set('window', this.createWindow.bind(this));
    this.toolHandlers.set('column', this.createColumn.bind(this));
    this.toolHandlers.set('roof', this.createRoof.bind(this));
    this.toolHandlers.set('stair', this.createStair.bind(this));
    this.toolHandlers.set('room', this.createRoom.bind(this));
    this.toolHandlers.set('furniture', this.createFurniture.bind(this));
    this.toolHandlers.set('floor', this.createFloor.bind(this));
  }

  /**
   * Update context with current app state
   */
  updateContext(newContext) {
    this.context = { ...this.context, ...newContext };
    this.emit('context_updated', this.context);
  }

  /**
   * Get project tree context for AI analysis
   */
  getProjectTreeContext() {
    const { projectTree, currentFloor } = this.context;
    
    if (!projectTree || !projectTree[0]) {
      return {
        floors: [],
        currentFloor: currentFloor || 'ground',
        totalFloors: 0,
        floorStructure: 'No project structure available'
      };
    }

    const levelsNode = projectTree[0];
    const floors = levelsNode.children || [];
    
    const floorData = floors.map(floor => {
      const floorInfo = {
        id: floor.id,
        name: floor.name,
        level: floor.level,
        type: floor.type,
        categories: {}
      };

      // Analyze floor categories and their contents
      if (floor.children) {
        floor.children.forEach(category => {
          const categoryName = category.name.toLowerCase();
          floorInfo.categories[categoryName] = {
            id: category.id,
            name: category.name,
            items: category.children ? category.children.length : 0,
            subcategories: category.children ? category.children.map(item => ({
              id: item.id,
              name: item.name,
              floor: item.floor
            })) : []
          };
        });
      }

      return floorInfo;
    });

    const currentFloorData = floorData.find(floor => floor.id === currentFloor);

    return {
      floors: floorData,
      currentFloor: currentFloor || 'ground',
      currentFloorData: currentFloorData,
      totalFloors: floors.length,
      floorStructure: this.generateFloorStructureDescription(floorData, currentFloor)
    };
  }

  /**
   * Generate human-readable floor structure description
   */
  generateFloorStructureDescription(floorData, currentFloor) {
    if (floorData.length === 0) {
      return "No floors defined in the project";
    }

    const descriptions = [];
    
    descriptions.push(`Project has ${floorData.length} floor${floorData.length > 1 ? 's' : ''}`);
    
    const floorNames = floorData.map(floor => {
      const isActive = floor.id === currentFloor;
      return `${floor.name}${isActive ? ' (current)' : ''}`;
    });
    
    descriptions.push(`Floors: ${floorNames.join(', ')}`);

    // Analyze current floor structure
    const currentFloorData = floorData.find(floor => floor.id === currentFloor);
    if (currentFloorData) {
      const categories = Object.keys(currentFloorData.categories);
      if (categories.length > 0) {
        descriptions.push(`Current floor (${currentFloorData.name}) has categories: ${categories.join(', ')}`);
      }
    }

    return descriptions.join('. ');
  }

  /**
   * Process natural language AI chat message
   */
  async processMessage(message, context = {}) {
    if (this.isProcessing) {
      return {
        success: false,
        message: "I'm still processing your previous request. Please wait a moment.",
        type: 'system'
      };
    }

    this.isProcessing = true;
    
    try {
      // Update context with current state
      this.updateContext(context);
      
      // Parse the natural language message
      const parsedCommand = await this.parseNaturalLanguage(message);
      
      // Create response message
      const response = {
        success: true,
        message: '',
        type: 'ai',
        actions: [],
        timestamp: new Date().toISOString()
      };

      // Execute the parsed command
      if (parsedCommand.intent === 'create_object') {
        const result = await this.executeObjectCreation(parsedCommand);
        response.message = result.message;
        response.actions = result.actions;
      } else if (parsedCommand.intent === 'select_tool') {
        const result = await this.executeToolSelection(parsedCommand);
        response.message = result.message;
        response.actions = result.actions;
      } else if (parsedCommand.intent === 'modify_object') {
        const result = await this.executeObjectModification(parsedCommand);
        response.message = result.message;
        response.actions = result.actions;
      } else if (parsedCommand.intent === 'delete_object') {
        const result = await this.executeObjectDeletion(parsedCommand);
        response.message = result.message;
        response.actions = result.actions;
      } else if (parsedCommand.intent === 'viewport_control') {
        const result = await this.executeViewportControl(parsedCommand);
        response.message = result.message;
        response.actions = result.actions;
      } else if (parsedCommand.intent === 'project_management') {
        const result = await this.executeProjectManagement(parsedCommand);
        response.message = result.message;
        response.actions = result.actions;
      } else if (parsedCommand.intent === 'query') {
        const result = await this.executeQuery(parsedCommand);
        response.message = result.message;
        response.actions = result.actions || [];
      } else {
        // General conversation or help
        response.message = await this.generateConversationalResponse(message, parsedCommand);
      }

      this.emit('message_processed', response);
      return response;
      
    } catch (error) {
      console.error('❌ AI Command Executor error:', error);
      
      const errorResponse = {
        success: false,
        message: `I encountered an error: ${error.message}. Please try rephrasing your request.`,
        type: 'ai',
        timestamp: new Date().toISOString()
      };
      
      this.emit('message_processed', errorResponse);
      return errorResponse;
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Parse natural language to extract intent and parameters
   */
  async parseNaturalLanguage(message) {
    const lowerMessage = message.toLowerCase();
    
    // Object creation patterns
    if (this.matchesPattern(lowerMessage, ['create', 'add', 'make', 'build', 'place', 'draw'])) {
      return this.parseObjectCreation(lowerMessage, message);
    }
    
    // Tool selection patterns
    if (this.matchesPattern(lowerMessage, ['select', 'use', 'switch to', 'activate', 'choose'])) {
      return this.parseToolSelection(lowerMessage, message);
    }
    
    // Object modification patterns
    if (this.matchesPattern(lowerMessage, ['modify', 'change', 'update', 'edit', 'adjust', 'resize'])) {
      return this.parseObjectModification(lowerMessage, message);
    }
    
    // Object deletion patterns
    if (this.matchesPattern(lowerMessage, ['delete', 'remove', 'destroy', 'clear', 'erase'])) {
      return this.parseObjectDeletion(lowerMessage, message);
    }
    
    // Viewport control patterns
    if (this.matchesPattern(lowerMessage, ['show', 'view', 'look at', 'zoom', 'rotate', 'pan'])) {
      return this.parseViewportControl(lowerMessage, message);
    }
    
    // Project management patterns
    if (this.matchesPattern(lowerMessage, ['floor', 'level', 'story', 'save', 'load', 'export'])) {
      return this.parseProjectManagement(lowerMessage, message);
    }
    
    // Default conversation
    return {
      intent: 'conversation',
      confidence: 0.5,
      originalMessage: message
    };
  }

  /**
   * Check if message matches any of the given patterns
   */
  matchesPattern(message, patterns) {
    return patterns.some(pattern => message.includes(pattern));
  }

  /**
   * Parse object creation commands
   */
  parseObjectCreation(lowerMessage, originalMessage) {
    // Check for room creation first (higher priority)
    if (this.matchesPattern(lowerMessage, ['room', 'space', 'chamber', 'office', 'bedroom', 'kitchen', 'bathroom'])) {
      const parameters = this.extractRoomParameters(lowerMessage);
      return {
        intent: 'create_object',
        objectType: 'room',
        parameters: parameters,
        confidence: 0.95,
        originalMessage: originalMessage
      };
    }
    
    // Check for furniture creation
    if (this.matchesPattern(lowerMessage, ['furniture', 'chair', 'table', 'desk', 'sofa', 'couch', 'bed', 'lamp', 'cabinet', 'shelf', 'bookcase', 'dresser', 'nightstand', 'wardrobe', 'ottoman', 'stool', 'armchair', 'bench'])) {
      const parameters = this.extractFurnitureParameters(lowerMessage);
      return {
        intent: 'create_object',
        objectType: 'furniture',
        parameters: parameters,
        confidence: 0.92,
        originalMessage: originalMessage
      };
    }

    // Check for floor creation/management
    if (this.matchesPattern(lowerMessage, ['floor', 'level', 'story', 'storey', 'add floor', 'new floor', 'create floor', 'add level', 'new level'])) {
      const parameters = this.extractFloorParameters(lowerMessage);
      return {
        intent: 'create_object',
        objectType: 'floor',
        parameters: parameters,
        confidence: 0.90,
        originalMessage: originalMessage
      };
    }
    
    // Handle floor information requests
    if (this.matchesPattern(lowerMessage, ['list floors', 'show floors', 'all floors', 'what floors', 'floor list', 'floors in project', 'how many floors'])) {
      return {
        intent: 'query',
        queryType: 'list_floors',
        confidence: 0.9,
        originalMessage: originalMessage
      };
    }

    // Handle current floor information
    if (this.matchesPattern(lowerMessage, ['current floor', 'active floor', 'which floor', 'what floor am i on', 'floor info'])) {
      return {
        intent: 'query',
        queryType: 'current_floor',
        confidence: 0.9,
        originalMessage: originalMessage
      };
    }

    // Handle project tree information
    if (this.matchesPattern(lowerMessage, ['project structure', 'project tree', 'project hierarchy', 'show project', 'project organization'])) {
      return {
        intent: 'query',
        queryType: 'project_tree',
        confidence: 0.85,
        originalMessage: originalMessage
      };
    }

    // Handle wall properties information
    if (this.matchesPattern(lowerMessage, ['wall properties', 'wall details', 'show wall', 'wall info', 'wall dimensions', 'selected wall'])) {
      return {
        intent: 'query',
        queryType: 'wall_properties',
        confidence: 0.9,
        originalMessage: originalMessage
      };
    }

    const objectTypes = ['wall', 'slab', 'door', 'window', 'column', 'roof', 'stair'];
    const foundType = objectTypes.find(type => lowerMessage.includes(type));
    
    if (!foundType) {
      return {
        intent: 'conversation',
        confidence: 0.3,
        originalMessage: originalMessage
      };
    }
    
    // Extract dimensions and parameters
    const parameters = this.extractParameters(lowerMessage, foundType);
    
    return {
      intent: 'create_object',
      objectType: foundType,
      parameters: parameters,
      confidence: 0.9,
      originalMessage: originalMessage
    };
  }

  /**
   * Extract parameters from natural language
   */
  extractParameters(message, objectType) {
    const params = {};
    
    // Extract dimensions
    const dimensionPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres)/g,
      /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)/g,
      /(\d+(?:\.\d+)?)\s*(?:cm|centimeter|centimeters)/g
    ];
    
    const dimensions = [];
    dimensionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        let value = parseFloat(match[1]);
        // Convert to meters
        if (match[0].includes('ft') || match[0].includes('foot') || match[0].includes('feet')) {
          value *= 0.3048;
        } else if (match[0].includes('cm') || match[0].includes('centimeter')) {
          value *= 0.01;
        }
        dimensions.push(value);
      }
    });
    
    // Assign dimensions based on object type
    if (objectType === 'wall') {
      if (dimensions.length >= 1) params.length = dimensions[0];
      if (dimensions.length >= 2) params.height = dimensions[1];
      if (dimensions.length >= 3) params.thickness = dimensions[2];
      // Set defaults
      params.length = params.length || 4;
      params.height = params.height || 2.5;
      params.thickness = params.thickness || 0.2;
    } else if (objectType === 'slab') {
      if (dimensions.length >= 1) params.width = dimensions[0];
      if (dimensions.length >= 2) params.depth = dimensions[1];
      if (dimensions.length >= 3) params.thickness = dimensions[2];
      // Set defaults
      params.width = params.width || 5;
      params.depth = params.depth || 5;
      params.thickness = params.thickness || 0.2;
    }
    
    // Extract materials
    const materials = ['concrete', 'steel', 'wood', 'aluminum', 'glass'];
    const foundMaterial = materials.find(material => message.includes(material));
    if (foundMaterial) {
      params.material = foundMaterial;
    }
    
    return params;
  }

  /**
   * Extract room-specific parameters from natural language
   */
  extractRoomParameters(message) {
    const params = {};
    
    // Extract dimensions using various patterns
    const dimensionPatterns = [
      // "3m by 5m", "3 by 5 meters", "3x5m"
      /(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres)?\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres)/gi,
      // "3 meters by 5 meters"
      /(\d+(?:\.\d+)?)\s*(?:meter|meters|metre|metres)\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(?:meter|meters|metre|metres)/gi,
      // "3ft by 5ft", "3 by 5 feet"
      /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)?\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)/gi,
      // Single dimensions followed by "room" - assume square
      /(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres|ft|foot|feet)\s+(?:room|space)/gi
    ];
    
    let width = null, length = null;
    
    for (const pattern of dimensionPatterns) {
      const match = pattern.exec(message);
      if (match) {
        let val1 = parseFloat(match[1]);
        let val2 = match[2] ? parseFloat(match[2]) : val1; // Square room if only one dimension
        
        // Convert feet to meters
        if (match[0].includes('ft') || match[0].includes('foot') || match[0].includes('feet')) {
          val1 *= 0.3048;
          val2 *= 0.3048;
        }
        
        width = val1;
        length = val2;
        break;
      }
    }
    
    // Set room dimensions
    params.width = width || 4; // Default 4m wide
    params.length = length || 4; // Default 4m long
    
    // Room height
    const heightPattern = /(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres|ft|foot|feet)\s+(?:high|height|tall)/gi;
    const heightMatch = heightPattern.exec(message);
    if (heightMatch) {
      let height = parseFloat(heightMatch[1]);
      if (heightMatch[0].includes('ft') || heightMatch[0].includes('foot') || heightMatch[0].includes('feet')) {
        height *= 0.3048;
      }
      params.height = height;
    } else {
      params.height = 2.5; // Default 2.5m high
    }
    
    // Wall thickness
    params.thickness = 0.2; // Default 20cm walls
    
    // Extract material
    const materials = ['concrete', 'steel', 'wood', 'aluminum', 'glass', 'brick', 'stone'];
    const foundMaterial = materials.find(material => message.includes(material));
    params.material = foundMaterial || 'concrete';
    
    // Room type/name extraction
    const roomTypes = ['office', 'bedroom', 'kitchen', 'bathroom', 'living room', 'dining room', 'study', 'closet'];
    const foundType = roomTypes.find(type => message.includes(type));
    if (foundType) {
      params.roomType = foundType;
    }
    
    console.log('🏠 Extracted room parameters:', params);
    return params;
  }

  /**
   * Extract furniture-specific parameters from natural language
   */
  extractFurnitureParameters(message) {
    const params = {};
    
    // Detect furniture type
    const furnitureTypes = {
      'chair': ['chair', 'seat'],
      'table': ['table', 'desk'],
      'sofa': ['sofa', 'couch'],
      'bed': ['bed'],
      'lamp': ['lamp', 'light'],
      'cabinet': ['cabinet', 'cupboard'],
      'shelf': ['shelf', 'bookcase', 'bookshelf'],
      'dresser': ['dresser', 'chest of drawers'],
      'nightstand': ['nightstand', 'bedside table'],
      'wardrobe': ['wardrobe', 'closet', 'armoire'],
      'ottoman': ['ottoman', 'footstool'],
      'stool': ['stool', 'bar stool'],
      'armchair': ['armchair', 'recliner'],
      'bench': ['bench']
    };
    
    // Find furniture type
    let furnitureType = 'furniture';
    for (const [type, keywords] of Object.entries(furnitureTypes)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        furnitureType = type;
        break;
      }
    }
    params.furnitureType = furnitureType;
    
    // Extract style/material preferences
    const styles = ['modern', 'contemporary', 'traditional', 'rustic', 'industrial', 'minimalist', 'vintage', 'classic'];
    const foundStyle = styles.find(style => message.includes(style));
    if (foundStyle) {
      params.style = foundStyle;
    }
    
    const materials = ['wood', 'wooden', 'metal', 'glass', 'leather', 'fabric', 'plastic', 'marble'];
    const foundMaterial = materials.find(material => message.includes(material));
    if (foundMaterial) {
      params.material = foundMaterial;
    }
    
    // Extract colors
    const colors = ['black', 'white', 'brown', 'red', 'blue', 'green', 'gray', 'grey', 'beige', 'cream'];
    const foundColor = colors.find(color => message.includes(color));
    if (foundColor) {
      params.color = foundColor;
    }
    
    // Extract room context for better furniture selection
    const roomTypes = ['living room', 'bedroom', 'kitchen', 'dining room', 'office', 'bathroom', 'study'];
    const foundRoom = roomTypes.find(room => message.includes(room));
    if (foundRoom) {
      params.roomContext = foundRoom;
    }
    
    // Extract quantity
    const quantityPattern = /(\d+)\s*(?:chairs?|tables?|lamps?|pieces?)/i;
    const quantityMatch = message.match(quantityPattern);
    if (quantityMatch) {
      params.quantity = parseInt(quantityMatch[1]);
    } else {
      params.quantity = 1; // Default
    }
    
    console.log('🪑 Extracted furniture parameters:', params);
    return params;
  }

  /**
   * Extract floor-specific parameters from natural language
   */
  extractFloorParameters(message) {
    const params = {};
    
    // Extract floor name/type
    const floorTypes = ['ground floor', 'first floor', 'second floor', 'third floor', 'basement', 'attic', 'mezzanine', 'penthouse'];
    const foundType = floorTypes.find(type => message.includes(type));
    if (foundType) {
      params.floorType = foundType;
      params.name = foundType.charAt(0).toUpperCase() + foundType.slice(1);
    }
    
    // Extract floor level/number
    const levelPattern = /(?:floor|level|story|storey)\s*(\d+)|(\d+)(?:st|nd|rd|th)\s*(?:floor|level|story|storey)/i;
    const levelMatch = message.match(levelPattern);
    if (levelMatch) {
      const level = parseInt(levelMatch[1] || levelMatch[2]);
      params.level = level;
      if (!params.name) {
        const ordinal = level === 1 ? 'First' : level === 2 ? 'Second' : level === 3 ? 'Third' : `${level}th`;
        params.name = `${ordinal} Floor`;
      }
    }
    
    // Extract floor name from quotes or specific naming
    const namePattern = /(?:name|call|label).*?["']([^"']+)["']|["']([^"']+)["'].*?(?:floor|level)/i;
    const nameMatch = message.match(namePattern);
    if (nameMatch) {
      params.name = nameMatch[1] || nameMatch[2];
    }
    
    // Default values
    if (!params.name) {
      params.name = 'New Floor';
    }
    
    if (params.level === undefined) {
      params.level = null; // Will be calculated during creation
    }
    
    console.log('🏢 Extracted floor parameters:', params);
    return params;
  }

  /**
   * Execute object creation
   */
  async executeObjectCreation(command) {
    const { objectType, parameters } = command;
    
    try {
      // Use the appropriate tool handler
      const handler = this.toolHandlers.get(objectType);
      if (!handler) {
        throw new Error(`No handler found for object type: ${objectType}`);
      }
      
      const objectId = await handler(parameters);
      
      // Special messages for different object types
      let successMessage;
      if (objectType === 'room') {
        const { width, length, height, material, roomType } = parameters;
        const roomDesc = roomType ? `${roomType} room` : 'room';
        successMessage = `🏠 Created a ${roomDesc} successfully! \n\n📐 **Dimensions:** ${width}m × ${length}m × ${height}m\n🧱 **Material:** ${material}\n🔧 **Walls:** 4 walls with automatic corner joinery\n\nThe room is now visible in both 2D and 3D viewports. You can add doors, windows, or furniture next!`;
      } else if (objectType === 'furniture') {
        const { furnitureType, style, material, quantity } = parameters;
        const furnitureDesc = `${style ? style + ' ' : ''}${material ? material + ' ' : ''}${furnitureType}`;
        const quantityText = quantity > 1 ? ` (${quantity} pieces)` : '';
        successMessage = `🪑 Added ${furnitureDesc}${quantityText} to your space! \n\n🎨 **Style:** ${style || 'Default'}\n🪵 **Material:** ${material || 'Standard'}\n📦 **Type:** ${furnitureType}\n\nThe furniture is now visible in both 2D and 3D viewports. You can move it around or add more furniture to complete your design!`;
      } else if (objectType === 'floor') {
        const { name, level, floorType } = parameters;
        const levelText = level !== null ? ` on level ${level}` : '';
        successMessage = `🏢 Added "${name}" floor${levelText} to your project! \n\n📋 **Floor Name:** ${name}\n🏗️ **Type:** ${floorType || 'Standard Floor'}\n📊 **Level:** ${level || 'Auto-assigned'}\n\nThe new floor is now available in the project tree on the left. You can switch to it and start adding rooms, walls, and furniture. Use the project tree to organize your design across multiple levels!`;
      } else {
        successMessage = `✅ Created ${objectType} successfully! The ${objectType} has been added to your project and is visible in the viewport.`;
      }
      
      return {
        message: successMessage,
        actions: [
          {
            type: 'object_created',
            objectId: objectId,
            objectType: objectType,
            parameters: parameters
          },
          {
            type: 'viewport_update',
            focus: objectId
          }
        ]
      };
      
    } catch (error) {
      return {
        message: `❌ Failed to create ${objectType}: ${error.message}`,
        actions: []
      };
    }
  }

  /**
   * Tool-specific creation methods
   */
  async createWall(params) {
    return standaloneCADEngine.createObject('wall', {
      length: params.length || 4,
      height: params.height || 2.5,
      thickness: params.thickness || 0.2,
      material: params.material || 'concrete'
    });
  }

  async createSlab(params) {
    return standaloneCADEngine.createObject('slab', {
      width: params.width || 5,
      depth: params.depth || 5,
      thickness: params.thickness || 0.2,
      material: params.material || 'concrete'
    });
  }

  async createDoor(params) {
    return standaloneCADEngine.createObject('door', {
      width: params.width || 0.9,
      height: params.height || 2.1,
      thickness: params.thickness || 0.05,
      material: params.material || 'wood'
    });
  }

  async createWindow(params) {
    return standaloneCADEngine.createObject('window', {
      width: params.width || 1.2,
      height: params.height || 1.4,
      thickness: params.thickness || 0.05,
      material: params.material || 'aluminum'
    });
  }

  async createColumn(params) {
    return standaloneCADEngine.createObject('column', {
      width: params.width || 0.4,
      depth: params.depth || 0.4,
      height: params.height || 3.0,
      material: params.material || 'concrete'
    });
  }

  async createRoof(params) {
    // Roof creation would need more complex parameters
    return standaloneCADEngine.createObject('slab', {
      width: params.width || 10,
      depth: params.depth || 10,
      thickness: params.thickness || 0.15,
      material: params.material || 'concrete'
    });
  }

  async createStair(params) {
    // Stair creation would need step-specific parameters
    return standaloneCADEngine.createObject('slab', {
      width: params.width || 1.2,
      depth: params.depth || 3,
      thickness: params.thickness || 0.18,
      material: params.material || 'concrete'
    });
  }

  /**
   * Create a complete room with 4 walls forming a rectangle
   */
  async createRoom(params) {
    console.log('🏠 Creating room with parameters:', params);
    
    const {
      width = 4,
      length = 4,
      height = 2.5,
      thickness = 0.2,
      material = 'concrete',
      roomType = 'room'
    } = params;
    
    // Calculate wall positions to form a perfect rectangle
    // Position room at origin (0,0) for simplicity
    const halfWidth = width / 2;
    const halfLength = length / 2;
    const halfThickness = thickness / 2;
    
    const wallIds = [];
    
    try {
      // Wall 1: Bottom wall (horizontal, along width)
      const wall1Id = standaloneCADEngine.createObject('wall', {
        startPoint: { x: -halfWidth, y: 0, z: -halfLength },
        endPoint: { x: halfWidth, y: 0, z: -halfLength },
        length: width,
        height: height,
        thickness: thickness,
        material: material,
        autoExtend: true,
        joineryEnabled: true
      });
      wallIds.push(wall1Id);
      console.log('🧱 Created bottom wall:', wall1Id);
      
      // Wall 2: Right wall (vertical, along length)  
      const wall2Id = standaloneCADEngine.createObject('wall', {
        startPoint: { x: halfWidth, y: 0, z: -halfLength },
        endPoint: { x: halfWidth, y: 0, z: halfLength },
        length: length,
        height: height,
        thickness: thickness,
        material: material,
        autoExtend: true,
        joineryEnabled: true
      });
      wallIds.push(wall2Id);
      console.log('🧱 Created right wall:', wall2Id);
      
      // Wall 3: Top wall (horizontal, along width)
      const wall3Id = standaloneCADEngine.createObject('wall', {
        startPoint: { x: halfWidth, y: 0, z: halfLength },
        endPoint: { x: -halfWidth, y: 0, z: halfLength },
        length: width,
        height: height,
        thickness: thickness,
        material: material,
        autoExtend: true,
        joineryEnabled: true
      });
      wallIds.push(wall3Id);
      console.log('🧱 Created top wall:', wall3Id);
      
      // Wall 4: Left wall (vertical, along length)
      const wall4Id = standaloneCADEngine.createObject('wall', {
        startPoint: { x: -halfWidth, y: 0, z: halfLength },
        endPoint: { x: -halfWidth, y: 0, z: -halfLength },
        length: length,
        height: height,
        thickness: thickness,
        material: material,
        autoExtend: true,
        joineryEnabled: true
      });
      wallIds.push(wall4Id);
      console.log('🧱 Created left wall:', wall4Id);
      
      // Apply joinery to connect all walls properly
      console.log('🔧 Applying wall joinery for room...');
      setTimeout(() => {
        standaloneCADEngine.applyWallJoinery({
          tolerance: 0.25,
          cornerStyle: 'butt',
          tightCorners: false,
          autoExtend: true
        });
        console.log('✅ Room joinery applied successfully');
      }, 500);
      
      console.log(`✅ Room created successfully with ${wallIds.length} walls`);
      
      // Return the first wall ID as primary identifier
      return wall1Id;
      
    } catch (error) {
      console.error('❌ Failed to create room:', error);
      throw new Error(`Failed to create room: ${error.message}`);
    }
  }

  /**
   * Create furniture by searching and importing from the furniture database
   */
  async createFurniture(params) {
    console.log('🪑 Creating furniture with parameters:', params);
    
    const {
      furnitureType = 'furniture',
      style,
      material,
      color,
      roomContext,
      quantity = 1
    } = params;
    
    try {
      // Search for appropriate furniture model
      const searchQuery = this.buildFurnitureSearchQuery(params);
      console.log('🔍 Searching for furniture with query:', searchQuery);
      
      // Try to find a suitable furniture model from the database
      const furnitureModel = await this.findFurnitureModel(searchQuery, furnitureType);
      
      if (!furnitureModel) {
        // Fallback: Create a simple placeholder furniture object
        console.log('⚠️ No suitable model found, creating placeholder furniture');
        return this.createPlaceholderFurniture(params);
      }
      
      // Create furniture object(s) using the found model
      const furnitureIds = [];
      
      for (let i = 0; i < quantity; i++) {
        const objectParams = {
          // Basic identification
          subtype: furnitureModel.id || `${furnitureType}-${Date.now()}-${i}`,
          name: furnitureModel.name || `${furnitureType} ${i + 1}`,
          
          // Positioning (spread out multiple items)
          position: { 
            x: i * 1.5, // Space items 1.5m apart
            y: 0, 
            z: 0 
          },
          
          // Dimensions from model or defaults
          width: furnitureModel.width || this.getDefaultFurnitureDimensions(furnitureType).width,
          height: furnitureModel.height || this.getDefaultFurnitureDimensions(furnitureType).height,
          depth: furnitureModel.depth || this.getDefaultFurnitureDimensions(furnitureType).depth,
          
          // Model information
          modelUrl: furnitureModel.model_url,
          thumbnailUrl: furnitureModel.thumbnail_url,
          format: furnitureModel.format || [],
          
          // Metadata
          description: furnitureModel.description || `${style || ''} ${material || ''} ${furnitureType}`.trim(),
          category: furnitureModel.category || 'furniture',
          subcategory: furnitureModel.subcategory,
          furnitureType: furnitureType,
          
          // Style preferences
          style: style,
          material: material,
          color: color,
          roomContext: roomContext,
          
          // Import metadata
          importedAt: new Date().toISOString(),
          importMethod: 'ai_assistant'
        };
        
        // Create the furniture object using standalone CAD engine
        const furnitureId = standaloneCADEngine.createObject('furniture', objectParams);
        furnitureIds.push(furnitureId);
        
        console.log(`🪑 Created furniture ${i + 1}/${quantity}:`, furnitureId);
      }
      
      console.log(`✅ Successfully created ${quantity} ${furnitureType}(s)`);
      return furnitureIds[0]; // Return first ID as primary
      
    } catch (error) {
      console.error('❌ Failed to create furniture:', error);
      throw new Error(`Failed to create furniture: ${error.message}`);
    }
  }

  /**
   * Build search query for furniture database
   */
  buildFurnitureSearchQuery(params) {
    const queryParts = [];
    
    if (params.furnitureType && params.furnitureType !== 'furniture') {
      queryParts.push(params.furnitureType);
    }
    
    if (params.style) {
      queryParts.push(params.style);
    }
    
    if (params.material) {
      queryParts.push(params.material);
    }
    
    if (params.roomContext) {
      queryParts.push(params.roomContext.replace(' room', ''));
    }
    
    return queryParts.join(' ') || 'furniture';
  }

  /**
   * Find suitable furniture model from database (mock implementation for now)
   */
  async findFurnitureModel(searchQuery, furnitureType) {
    // TODO: Implement actual database search
    // For now, return a mock furniture model
    console.log(`🔍 Mock search for: ${searchQuery} (${furnitureType})`);
    
    // Mock furniture models for different types
    const mockModels = {
      chair: {
        id: 'chair-modern-01',
        name: 'Modern Office Chair',
        description: 'Ergonomic modern office chair with sleek design',
        category: 'furniture',
        subcategory: 'chairs',
        model_url: '/models/furniture/chairs/modern-office-chair.obj',
        thumbnail_url: '/thumbnails/chairs/modern-office-chair.jpg',
        width: 0.6,
        height: 1.2,
        depth: 0.6
      },
      table: {
        id: 'table-wood-01',
        name: 'Wooden Dining Table',
        description: 'Classic wooden dining table for 4-6 people',
        category: 'furniture',
        subcategory: 'tables',
        model_url: '/models/furniture/tables/wooden-dining-table.obj',
        thumbnail_url: '/thumbnails/tables/wooden-dining-table.jpg',
        width: 1.5,
        height: 0.75,
        depth: 0.9
      },
      sofa: {
        id: 'sofa-modern-01',
        name: 'Modern Sectional Sofa',
        description: 'Comfortable modern sectional sofa',
        category: 'furniture',
        subcategory: 'sofas',
        model_url: '/models/furniture/sofas/modern-sectional.obj',
        thumbnail_url: '/thumbnails/sofas/modern-sectional.jpg',
        width: 2.5,
        height: 0.85,
        depth: 1.2
      }
    };
    
    return mockModels[furnitureType] || mockModels.chair;
  }

  /**
   * Create placeholder furniture when no model is found
   */
  createPlaceholderFurniture(params) {
    const { furnitureType = 'furniture' } = params;
    const dimensions = this.getDefaultFurnitureDimensions(furnitureType);
    
    const objectParams = {
      subtype: `placeholder-${furnitureType}-${Date.now()}`,
      name: `${furnitureType} (placeholder)`,
      position: { x: 0, y: 0, z: 0 },
      ...dimensions,
      description: `Placeholder ${furnitureType} - replace with actual model`,
      furnitureType: furnitureType,
      isPlaceholder: true,
      importMethod: 'ai_assistant_placeholder'
    };
    
    return standaloneCADEngine.createObject('furniture', objectParams);
  }

  /**
   * Get default dimensions for different furniture types
   */
  getDefaultFurnitureDimensions(furnitureType) {
    const dimensions = {
      chair: { width: 0.6, height: 1.0, depth: 0.6 },
      table: { width: 1.2, height: 0.75, depth: 0.8 },
      sofa: { width: 2.0, height: 0.85, depth: 1.0 },
      bed: { width: 1.4, height: 0.6, depth: 2.0 },
      lamp: { width: 0.3, height: 1.5, depth: 0.3 },
      cabinet: { width: 0.8, height: 2.0, depth: 0.4 },
      shelf: { width: 1.0, height: 1.8, depth: 0.3 },
      dresser: { width: 1.2, height: 0.8, depth: 0.5 },
      nightstand: { width: 0.5, height: 0.6, depth: 0.4 },
      wardrobe: { width: 1.0, height: 2.2, depth: 0.6 },
      ottoman: { width: 0.6, height: 0.4, depth: 0.4 },
      stool: { width: 0.4, height: 0.7, depth: 0.4 },
      armchair: { width: 0.8, height: 1.0, depth: 0.8 },
      bench: { width: 1.2, height: 0.45, depth: 0.4 }
    };
    
    return dimensions[furnitureType] || { width: 1.0, height: 1.0, depth: 1.0 };
  }

  /**
   * Create a new floor in the project tree
   */
  async createFloor(params) {
    console.log('🏢 Creating floor with parameters:', params);
    
    const { name = 'New Floor', level, floorType } = params;
    
    try {
      // Check if we have access to the app's floor management bridge
      if (!window.addNewFloorForAI) {
        console.log('⚠️ AI floor creation bridge not available, using fallback');
        return this.createFloorFallback(params);
      }
      
      // Use the AI bridge function for floor creation
      const floorId = window.addNewFloorForAI(name, level);
      
      console.log(`✅ Floor "${name}" created successfully with ID: ${floorId}`);
      return floorId;
      
    } catch (error) {
      console.error('❌ Failed to create floor:', error);
      throw new Error(`Failed to create floor: ${error.message}`);
    }
  }

  /**
   * Fallback method for floor creation when direct access isn't available
   */
  createFloorFallback(params) {
    const { name = 'New Floor' } = params;
    
    // This is a simulation - in a real implementation, this would need to 
    // communicate with the main app to add the floor to the PROJECT_TREE
    console.log('🏢 Simulating floor creation (fallback mode)');
    console.log(`Would create floor: ${name}`);
    
    // Return a mock floor ID
    return `floor-${Date.now()}`;
  }

  /**
   * Get information about a specific floor
   */
  getFloorInfo(floorId) {
    const projectTreeContext = this.getProjectTreeContext();
    const floor = projectTreeContext.floors.find(f => f.id === floorId);
    
    if (!floor) {
      return null;
    }
    
    const info = {
      id: floor.id,
      name: floor.name,
      level: floor.level,
      type: floor.type,
      categories: floor.categories,
      isActive: floor.id === projectTreeContext.currentFloor,
      description: this.generateFloorDescription(floor)
    };
    
    return info;
  }

  /**
   * Generate a description of a floor's contents
   */
  generateFloorDescription(floor) {
    const descriptions = [];
    
    descriptions.push(`${floor.name} (Level ${floor.level})`);
    
    const categories = Object.entries(floor.categories);
    if (categories.length > 0) {
      const categoryInfo = categories.map(([name, data]) => {
        const itemCount = data.items || 0;
        return `${name}: ${itemCount} item${itemCount !== 1 ? 's' : ''}`;
      });
      descriptions.push(categoryInfo.join(', '));
    } else {
      descriptions.push('Empty floor');
    }
    
    return descriptions.join(' - ');
  }

  /**
   * List all floors in the project
   */
  listFloors() {
    const projectTreeContext = this.getProjectTreeContext();
    return projectTreeContext.floors.map(floor => ({
      id: floor.id,
      name: floor.name,
      level: floor.level,
      isActive: floor.id === projectTreeContext.currentFloor,
      summary: this.generateFloorDescription(floor)
    }));
  }

  /**
   * Parse tool selection commands
   */
  parseToolSelection(lowerMessage, originalMessage) {
    const tools = ['wall', 'slab', 'door', 'window', 'column', 'roof', 'stair'];
    const foundTool = tools.find(tool => lowerMessage.includes(tool));
    
    if (!foundTool) {
      return {
        intent: 'conversation',
        confidence: 0.3,
        originalMessage: originalMessage
      };
    }
    
    return {
      intent: 'select_tool',
      toolName: foundTool,
      confidence: 0.9,
      originalMessage: originalMessage
    };
  }

  /**
   * Execute tool selection
   */
  async executeToolSelection(command) {
    const { toolName } = command;
    
    return {
      message: `🔧 Selected ${toolName} tool. You can now use the ${toolName} tool in the toolbar to create objects, or continue chatting with me to create them through conversation.`,
      actions: [
        {
          type: 'tool_selected',
          toolName: toolName
        }
      ]
    };
  }

  /**
   * Parse object modification commands  
   */
  parseObjectModification(lowerMessage, originalMessage) {
    // Wall property modification patterns
    const wallPatterns = {
      length: ['longer', 'shorter', 'length', 'extend', 'shrink', 'wide', 'narrow'],
      height: ['taller', 'higher', 'shorter', 'lower', 'height', 'tall', 'high'],
      thickness: ['thicker', 'thinner', 'thick', 'thin', 'width', 'thickness'],
      material: ['material', 'concrete', 'steel', 'wood', 'aluminum', 'glass', 'brick', 'stone']
    };
    
    // Check if this is about walls
    const isWallModification = this.matchesPattern(lowerMessage, ['wall', 'walls']);
    
    if (isWallModification) {
      const modifications = {};
      
      // Extract specific property changes
      for (const [property, keywords] of Object.entries(wallPatterns)) {
        if (keywords.some(keyword => lowerMessage.includes(keyword))) {
          modifications[property] = this.extractPropertyValue(lowerMessage, property);
        }
      }
      
      // Extract numeric values for dimensions
      const numbers = lowerMessage.match(/(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres|ft|foot|feet|cm|centimeter|centimeters)?/g);
      
      return {
        intent: 'modify_object',
        objectType: 'wall',
        modifications: modifications,
        extractedValues: numbers ? numbers.map(n => parseFloat(n.match(/\d+(?:\.\d+)?/)[0])) : [],
        confidence: 0.85,
        originalMessage: originalMessage
      };
    }
    
    // Other object types (doors, windows, etc.)
    const objectTypes = ['door', 'window', 'column', 'slab', 'furniture'];
    const foundType = objectTypes.find(type => lowerMessage.includes(type));
    
    if (foundType) {
      return {
        intent: 'modify_object',
        objectType: foundType,
        modifications: {},
        confidence: 0.7,
        originalMessage: originalMessage
      };
    }
    
    // Generic modification command
    return {
      intent: 'modify_object',
      objectType: 'unknown',
      modifications: {},
      confidence: 0.6,
      originalMessage: originalMessage
    };
  }

  /**
   * Extract property value from natural language
   */
  extractPropertyValue(message, property) {
    // Material extraction
    if (property === 'material') {
      const materials = ['concrete', 'steel', 'wood', 'aluminum', 'glass', 'brick', 'stone'];
      return materials.find(material => message.includes(material)) || null;
    }
    
    // Dimension extraction with units
    const dimensionPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres)/g,
      /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)/g,
      /(\d+(?:\.\d+)?)\s*(?:cm|centimeter|centimeters)/g
    ];
    
    for (const pattern of dimensionPatterns) {
      const match = pattern.exec(message);
      if (match) {
        let value = parseFloat(match[1]);
        // Convert to meters
        if (match[0].includes('ft') || match[0].includes('foot') || match[0].includes('feet')) {
          value *= 0.3048;
        } else if (match[0].includes('cm') || match[0].includes('centimeter')) {
          value *= 0.01;
        }
        return value;
      }
    }
    
    return null;
  }

  /**
   * Execute object modification
   */
  async executeObjectModification(command) {
    const { objectType, modifications, extractedValues, originalMessage } = command;
    
    try {
      if (objectType === 'wall') {
        return await this.executeWallModification(command);
      } else {
        return {
          message: `🔧 Object modification for ${objectType} is not yet implemented. I can currently modify wall properties like length, height, thickness, and material.`,
          actions: []
        };
      }
    } catch (error) {
      return {
        message: `❌ Failed to modify ${objectType}: ${error.message}`,
        actions: []
      };
    }
  }

  /**
   * Execute wall-specific modifications
   */
  async executeWallModification(command) {
    const { modifications, extractedValues, originalMessage } = command;
    
    // Get selected walls or all walls if none selected
    const selectedObjects = Array.from(this.context.selectedObjects);
    const selectedWalls = selectedObjects.filter(obj => obj.type === 'wall');
    
    if (selectedWalls.length === 0) {
      // If no walls selected, try to get all walls
      const allObjects = standaloneCADEngine.getAllObjects();
      const allWalls = allObjects.filter(obj => obj.type === 'wall');
      
      if (allWalls.length === 0) {
        return {
          message: `🧱 **No walls found** to modify.\n\nCreate some walls first, then I can help you adjust their properties!`,
          actions: []
        };
      } else if (allWalls.length === 1) {
        // Auto-select the only wall
        return this.modifyWalls([allWalls[0]], modifications, extractedValues, originalMessage);
      } else {
        return {
          message: `🧱 **Multiple walls found** (${allWalls.length} walls).\n\nPlease select a specific wall first, then ask me to modify it. You can:\n• Click on a wall to select it\n• Say "select all walls" to modify all walls at once`,
          actions: []
        };
      }
    }
    
    return this.modifyWalls(selectedWalls, modifications, extractedValues, originalMessage);
  }

  /**
   * Modify specified walls with given parameters
   */
  async modifyWalls(walls, modifications, extractedValues, originalMessage) {
    const modifiedWalls = [];
    const errors = [];
    
    for (const wall of walls) {
      try {
        const currentParams = wall.params || {};
        const updates = {};
        
        // Process each modification
        for (const [property, value] of Object.entries(modifications)) {
          if (value !== null) {
            if (property === 'material') {
              updates.material = value;
            } else {
              updates[property] = value;
            }
          }
        }
        
        // If we have extracted numeric values but no specific property mapping,
        // try to intelligently assign them based on context
        if (extractedValues.length > 0 && Object.keys(updates).length === 0) {
          const contextKeywords = originalMessage.toLowerCase();
          
          if (this.matchesPattern(contextKeywords, ['length', 'long', 'extend', 'wide'])) {
            updates.length = extractedValues[0];
          } else if (this.matchesPattern(contextKeywords, ['height', 'tall', 'high'])) {
            updates.height = extractedValues[0];
          } else if (this.matchesPattern(contextKeywords, ['thick', 'width', 'thickness'])) {
            updates.thickness = extractedValues[0];
          } else {
            // Default to length if ambiguous
            updates.length = extractedValues[0];
          }
        }
        
        if (Object.keys(updates).length === 0) {
          errors.push(`No valid modifications found for wall ${wall.id}`);
          continue;
        }
        
        console.log(`🔧 AI: Modifying wall ${wall.id} with updates:`, updates);
        
        // Use the CAD engine's updateObject method (which we already enhanced)
        const success = standaloneCADEngine.updateObject(wall.id, updates);
        
        if (success) {
          modifiedWalls.push({
            id: wall.id,
            updates: updates
          });
        } else {
          errors.push(`Failed to update wall ${wall.id}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to modify wall ${wall.id}:`, error);
        errors.push(`Error modifying wall ${wall.id}: ${error.message}`);
      }
    }
    
    // Generate response message
    let message;
    if (modifiedWalls.length > 0) {
      const wallCount = modifiedWalls.length;
      const updateSummary = this.generateUpdateSummary(modifiedWalls);
      
      message = `✅ **Successfully modified ${wallCount} wall${wallCount > 1 ? 's' : ''}!**\n\n${updateSummary}\n\nThe changes are now visible in both 2D and 3D viewports.`;
      
      if (errors.length > 0) {
        message += `\n\n⚠️ **Some issues encountered:**\n${errors.join('\n')}`;
      }
    } else {
      message = `❌ **Failed to modify walls.**\n\n${errors.join('\n')}\n\nPlease check your command and try again.`;
    }
    
    return {
      message: message,
      actions: modifiedWalls.map(wall => ({
        type: 'object_modified',
        objectId: wall.id,
        objectType: 'wall',
        updates: wall.updates
      }))
    };
  }

  /**
   * Generate a human-readable summary of wall updates
   */
  generateUpdateSummary(modifiedWalls) {
    const summaryParts = [];
    
    // Collect all unique update types
    const allUpdates = {};
    modifiedWalls.forEach(wall => {
      Object.entries(wall.updates).forEach(([property, value]) => {
        if (!allUpdates[property]) {
          allUpdates[property] = [];
        }
        allUpdates[property].push(value);
      });
    });
    
    // Generate summary for each property
    for (const [property, values] of Object.entries(allUpdates)) {
      const uniqueValues = [...new Set(values)];
      
      if (property === 'material') {
        summaryParts.push(`🧱 **Material:** Changed to ${uniqueValues.join(', ')}`);
      } else if (property === 'length') {
        summaryParts.push(`📏 **Length:** Set to ${uniqueValues.map(v => `${v}m`).join(', ')}`);
      } else if (property === 'height') {
        summaryParts.push(`📐 **Height:** Set to ${uniqueValues.map(v => `${v}m`).join(', ')}`);
      } else if (property === 'thickness') {
        summaryParts.push(`📦 **Thickness:** Set to ${uniqueValues.map(v => `${v}m`).join(', ')}`);
      } else {
        summaryParts.push(`🔧 **${property}:** Updated to ${uniqueValues.join(', ')}`);
      }
    }
    
    return summaryParts.join('\n');
  }

  /**
   * Parse object deletion commands
   */
  parseObjectDeletion(lowerMessage, originalMessage) {
    // Wall deletion patterns
    const isWallDeletion = this.matchesPattern(lowerMessage, ['wall', 'walls']);
    
    if (isWallDeletion) {
      return {
        intent: 'delete_object',
        objectType: 'wall',
        confidence: 0.9,
        originalMessage: originalMessage
      };
    }
    
    // Other object types
    const objectTypes = ['door', 'window', 'column', 'slab', 'furniture'];
    const foundType = objectTypes.find(type => lowerMessage.includes(type));
    
    if (foundType) {
      return {
        intent: 'delete_object',
        objectType: foundType,
        confidence: 0.85,
        originalMessage: originalMessage
      };
    }
    
    // Generic deletion (selected objects, everything, etc.)
    if (this.matchesPattern(lowerMessage, ['selected', 'this', 'these', 'current'])) {
      return {
        intent: 'delete_object',
        objectType: 'selected',
        confidence: 0.9,
        originalMessage: originalMessage
      };
    }
    
    if (this.matchesPattern(lowerMessage, ['all', 'everything', 'everything in scene'])) {
      return {
        intent: 'delete_object',
        objectType: 'all',
        confidence: 0.8,
        originalMessage: originalMessage
      };
    }
    
    // Generic deletion command
    return {
      intent: 'delete_object',
      objectType: 'unknown',
      confidence: 0.6,
      originalMessage: originalMessage
    };
  }

  /**
   * Execute object deletion
   */
  async executeObjectDeletion(command) {
    const { objectType, originalMessage } = command;
    
    try {
      if (objectType === 'wall') {
        return await this.executeWallDeletion(command);
      } else if (objectType === 'selected') {
        return await this.executeSelectedObjectsDeletion(command);
      } else if (objectType === 'all') {
        return await this.executeAllObjectsDeletion(command);
      } else {
        return await this.executeGenericObjectDeletion(command);
      }
    } catch (error) {
      return {
        message: `❌ Failed to delete ${objectType}: ${error.message}`,
        actions: []
      };
    }
  }

  /**
   * Execute wall-specific deletion
   */
  async executeWallDeletion(command) {
    const { originalMessage } = command;
    
    // Get selected walls or all walls if none selected
    const selectedObjects = Array.from(this.context.selectedObjects);
    const selectedWalls = selectedObjects.filter(obj => obj.type === 'wall');
    
    if (selectedWalls.length === 0) {
      // If no walls selected, check if we should delete all walls
      if (this.matchesPattern(originalMessage.toLowerCase(), ['all walls', 'all the walls', 'every wall'])) {
        const allObjects = standaloneCADEngine.getAllObjects();
        const allWalls = allObjects.filter(obj => obj.type === 'wall');
        
        if (allWalls.length === 0) {
          return {
            message: `🧱 **No walls found** to delete.\n\nCreate some walls first, then I can help you remove them!`,
            actions: []
          };
        }
        
        return this.deleteWalls(allWalls, 'all walls');
      } else {
        return {
          message: `🧱 **No walls selected** to delete.\n\nPlease select specific walls first, or say "delete all walls" to remove all walls from the project.`,
          actions: []
        };
      }
    }
    
    return this.deleteWalls(selectedWalls, 'selected walls');
  }

  /**
   * Execute deletion of selected objects
   */
  async executeSelectedObjectsDeletion(command) {
    const selectedObjects = Array.from(this.context.selectedObjects);
    
    if (selectedObjects.length === 0) {
      return {
        message: `🎯 **No objects selected** to delete.\n\nPlease select some objects first, then ask me to delete them.`,
        actions: []
      };
    }
    
    return this.deleteObjects(selectedObjects, 'selected objects');
  }

  /**
   * Execute deletion of all objects
   */
  async executeAllObjectsDeletion(command) {
    const allObjects = standaloneCADEngine.getAllObjects();
    
    if (allObjects.length === 0) {
      return {
        message: `📭 **No objects found** to delete.\n\nThe scene is already empty!`,
        actions: []
      };
    }
    
    // This is a destructive operation, so we should be extra careful
    return {
      message: `⚠️ **Delete everything?** This will remove **all ${allObjects.length} objects** from your project.\n\nThis action cannot be undone. If you're sure, please select all objects first (say "select all objects") and then ask me to delete the selected objects.`,
      actions: []
    };
  }

  /**
   * Execute generic object deletion
   */
  async executeGenericObjectDeletion(command) {
    const { objectType, originalMessage } = command;
    
    if (objectType === 'unknown') {
      const selectedObjects = Array.from(this.context.selectedObjects);
      
      if (selectedObjects.length > 0) {
        return this.deleteObjects(selectedObjects, 'selected objects');
      } else {
        return {
          message: `🗑️ **What would you like to delete?**\n\nPlease specify what to delete, such as:\n• "Delete the wall"\n• "Delete selected objects"\n• "Remove all walls"\n\nOr select objects first and then ask me to delete them.`,
          actions: []
        };
      }
    }
    
    // Handle specific object type deletion
    const allObjects = standaloneCADEngine.getAllObjects();
    const objectsOfType = allObjects.filter(obj => obj.type === objectType);
    
    if (objectsOfType.length === 0) {
      return {
        message: `🔍 **No ${objectType}s found** to delete.\n\nThere are no ${objectType}s in your project to remove.`,
        actions: []
      };
    }
    
    return this.deleteObjects(objectsOfType, `all ${objectType}s`);
  }

  /**
   * Delete specified walls with confirmation and feedback
   */
  async deleteWalls(walls, description) {
    const deletedWalls = [];
    const errors = [];
    
    for (const wall of walls) {
      try {
        console.log(`🗑️ AI: Deleting wall ${wall.id}`);
        
        const success = standaloneCADEngine.deleteObject(wall.id);
        
        if (success) {
          deletedWalls.push(wall);
        } else {
          errors.push(`Failed to delete wall ${wall.id}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to delete wall ${wall.id}:`, error);
        errors.push(`Error deleting wall ${wall.id}: ${error.message}`);
      }
    }
    
    // Generate response message
    let message;
    if (deletedWalls.length > 0) {
      const wallCount = deletedWalls.length;
      
      message = `✅ **Successfully deleted ${wallCount} wall${wallCount > 1 ? 's' : ''}!**\n\n🧱 **Removed:** ${description}\n📊 **Count:** ${wallCount} wall${wallCount > 1 ? 's' : ''}\n\nThe walls have been removed from both 2D and 3D viewports.`;
      
      if (errors.length > 0) {
        message += `\n\n⚠️ **Some issues encountered:**\n${errors.join('\n')}`;
      }
    } else {
      message = `❌ **Failed to delete walls.**\n\n${errors.join('\n')}\n\nPlease try again or check the console for details.`;
    }
    
    return {
      message: message,
      actions: deletedWalls.map(wall => ({
        type: 'object_deleted',
        objectId: wall.id,
        objectType: 'wall'
      }))
    };
  }

  /**
   * Delete specified objects with confirmation and feedback
   */
  async deleteObjects(objects, description) {
    const deletedObjects = [];
    const errors = [];
    
    for (const obj of objects) {
      try {
        console.log(`🗑️ AI: Deleting ${obj.type} ${obj.id}`);
        
        const success = standaloneCADEngine.deleteObject(obj.id);
        
        if (success) {
          deletedObjects.push(obj);
        } else {
          errors.push(`Failed to delete ${obj.type} ${obj.id}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to delete ${obj.type} ${obj.id}:`, error);
        errors.push(`Error deleting ${obj.type} ${obj.id}: ${error.message}`);
      }
    }
    
    // Generate response message
    let message;
    if (deletedObjects.length > 0) {
      const objectCount = deletedObjects.length;
      
      // Summarize by type
      const typesSummary = this.generateObjectTypeSummary(deletedObjects);
      
      message = `✅ **Successfully deleted ${objectCount} object${objectCount > 1 ? 's' : ''}!**\n\n🗑️ **Removed:** ${description}\n📊 **Details:** ${typesSummary}\n\nThe objects have been removed from both 2D and 3D viewports.`;
      
      if (errors.length > 0) {
        message += `\n\n⚠️ **Some issues encountered:**\n${errors.join('\n')}`;
      }
    } else {
      message = `❌ **Failed to delete objects.**\n\n${errors.join('\n')}\n\nPlease try again or check the console for details.`;
    }
    
    return {
      message: message,
      actions: deletedObjects.map(obj => ({
        type: 'object_deleted',
        objectId: obj.id,
        objectType: obj.type
      }))
    };
  }

  /**
   * Generate summary of objects by type
   */
  generateObjectTypeSummary(objects) {
    const typeCounts = {};
    objects.forEach(obj => {
      typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');
  }

  /**
   * Generate detailed wall properties report
   */
  generateWallPropertiesReport(walls) {
    if (walls.length === 0) {
      return "🧱 **No walls to analyze.**";
    }
    
    const reportParts = [];
    
    if (walls.length === 1) {
      const wall = walls[0];
      const params = wall.params || {};
      
      reportParts.push(`🧱 **Wall Properties** (ID: ${wall.id})`);
      reportParts.push('');
      
      // Basic dimensions
      reportParts.push(`📏 **Length:** ${params.length ? `${params.length}m` : 'Not specified'}`);
      reportParts.push(`📐 **Height:** ${params.height ? `${params.height}m` : 'Not specified'}`);
      reportParts.push(`📦 **Thickness:** ${params.thickness ? `${params.thickness}m` : 'Not specified'}`);
      reportParts.push('');
      
      // Material properties
      reportParts.push(`🧱 **Material:** ${params.material || 'Not specified'}`);
      if (params.materialColor) {
        reportParts.push(`🎨 **Color:** ${params.materialColor}`);
      }
      if (params.density) {
        reportParts.push(`⚖️ **Density:** ${params.density} kg/m³`);
      }
      reportParts.push('');
      
      // Position information
      if (params.startPoint && params.endPoint) {
        reportParts.push(`📍 **Position:**`);
        reportParts.push(`   Start: (${params.startPoint.x.toFixed(2)}, ${params.startPoint.z.toFixed(2)})`);
        reportParts.push(`   End: (${params.endPoint.x.toFixed(2)}, ${params.endPoint.z.toFixed(2)})`);
        
        // Calculate angle
        const deltaX = params.endPoint.x - params.startPoint.x;
        const deltaZ = params.endPoint.z - params.startPoint.z;
        const angleDegrees = (Math.atan2(deltaZ, deltaX) * 180 / Math.PI);
        reportParts.push(`   Angle: ${angleDegrees.toFixed(1)}°`);
      }
      reportParts.push('');
      
      // Additional properties
      if (params.alignment) {
        reportParts.push(`⚖️ **Alignment:** ${params.alignment}`);
      }
      
      reportParts.push(`\n💡 **You can modify this wall by saying:**`);
      reportParts.push(`• "Make this wall 6 meters long"`);
      reportParts.push(`• "Change the material to wood"`);
      reportParts.push(`• "Make it taller" or "Make it 3m high"`);
      reportParts.push(`• "Make it thicker" or "Set thickness to 0.3m"`);
      
    } else {
      // Multiple walls summary
      reportParts.push(`🧱 **Wall Properties Summary** (${walls.length} walls selected)`);
      reportParts.push('');
      
      // Collect statistics
      const lengths = walls.map(w => w.params?.length).filter(l => l);
      const heights = walls.map(w => w.params?.height).filter(h => h);
      const thicknesses = walls.map(w => w.params?.thickness).filter(t => t);
      const materials = walls.map(w => w.params?.material).filter(m => m);
      
      if (lengths.length > 0) {
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const minLength = Math.min(...lengths);
        const maxLength = Math.max(...lengths);
        reportParts.push(`📏 **Length:** ${minLength.toFixed(1)}m - ${maxLength.toFixed(1)}m (avg: ${avgLength.toFixed(1)}m)`);
      }
      
      if (heights.length > 0) {
        const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
        const minHeight = Math.min(...heights);
        const maxHeight = Math.max(...heights);
        reportParts.push(`📐 **Height:** ${minHeight.toFixed(1)}m - ${maxHeight.toFixed(1)}m (avg: ${avgHeight.toFixed(1)}m)`);
      }
      
      if (thicknesses.length > 0) {
        const avgThickness = thicknesses.reduce((a, b) => a + b, 0) / thicknesses.length;
        const minThickness = Math.min(...thicknesses);
        const maxThickness = Math.max(...thicknesses);
        reportParts.push(`📦 **Thickness:** ${minThickness.toFixed(2)}m - ${maxThickness.toFixed(2)}m (avg: ${avgThickness.toFixed(2)}m)`);
      }
      
      if (materials.length > 0) {
        const uniqueMaterials = [...new Set(materials)];
        reportParts.push(`🧱 **Materials:** ${uniqueMaterials.join(', ')}`);
      }
      
      reportParts.push('');
      reportParts.push(`📋 **Individual Walls:**`);
      walls.forEach((wall, index) => {
        const params = wall.params || {};
        const summary = [
          params.length ? `${params.length}m long` : null,
          params.height ? `${params.height}m high` : null,
          params.thickness ? `${params.thickness}m thick` : null,
          params.material ? params.material : null
        ].filter(Boolean).join(', ');
        
        reportParts.push(`   ${index + 1}. ${wall.id}: ${summary || 'No properties set'}`);
      });
      
      reportParts.push(`\n💡 **You can modify all selected walls by saying:**`);
      reportParts.push(`• "Make all walls 6 meters long"`);
      reportParts.push(`• "Change material to wood"`);
      reportParts.push(`• "Make them all 3m high"`);
    }
    
    return reportParts.join('\n');
  }

  /**
   * Parse viewport control commands
   */
  parseViewportControl(lowerMessage, originalMessage) {
    let command = { intent: 'viewport_control', confidence: 0.8, originalMessage: originalMessage };
    
    // Parse specific viewport commands
    if (this.matchesPattern(lowerMessage, ['2d', 'plan', 'top', 'floor plan'])) {
      command.action = 'switch_2d';
      command.confidence = 0.9;
    } else if (this.matchesPattern(lowerMessage, ['3d', 'perspective', '3d view', 'isometric'])) {
      command.action = 'switch_3d';
      command.confidence = 0.9;
    } else if (this.matchesPattern(lowerMessage, ['zoom', 'fit', 'zoom to fit', 'fit all'])) {
      command.action = 'zoom_fit';
      command.confidence = 0.9;
    } else if (this.matchesPattern(lowerMessage, ['zoom in', 'closer'])) {
      command.action = 'zoom_in';
      command.confidence = 0.8;
    } else if (this.matchesPattern(lowerMessage, ['zoom out', 'further'])) {
      command.action = 'zoom_out';
      command.confidence = 0.8;
    } else if (this.matchesPattern(lowerMessage, ['light', 'bright', 'light theme'])) {
      command.action = 'theme_light';
      command.confidence = 0.9;
    } else if (this.matchesPattern(lowerMessage, ['dark', 'dark theme', 'night'])) {
      command.action = 'theme_dark';
      command.confidence = 0.9;
    }
    
    return command;
  }

  /**
   * Execute viewport control
   */
  async executeViewportControl(command) {
    const { action } = command;
    
    switch (action) {
      case 'switch_2d':
        return {
          message: `📐 Switched to 2D plan view. You can now see the floor plan layout of your project.`,
          actions: [{ type: 'viewport_change', viewMode: '2d' }]
        };
        
      case 'switch_3d':
        return {
          message: `🏗️ Switched to 3D perspective view. You can now see your building in three dimensions.`,
          actions: [{ type: 'viewport_change', viewMode: '3d' }]
        };
        
      case 'zoom_fit':
        return {
          message: `🔍 Zooming to fit all objects in the viewport.`,
          actions: [{ type: 'viewport_action', action: 'zoom_fit' }]
        };
        
      case 'zoom_in':
        return {
          message: `🔍➕ Zooming in for a closer view.`,
          actions: [{ type: 'viewport_action', action: 'zoom_in' }]
        };
        
      case 'zoom_out':
        return {
          message: `🔍➖ Zooming out for a wider view.`,
          actions: [{ type: 'viewport_action', action: 'zoom_out' }]
        };
        
      case 'theme_light':
        return {
          message: `☀️ Switched to light theme for better visibility.`,
          actions: [{ type: 'theme_change', theme: 'light' }]
        };
        
      case 'theme_dark':
        return {
          message: `🌙 Switched to dark theme for comfortable viewing.`,
          actions: [{ type: 'theme_change', theme: 'dark' }]
        };
        
      default:
        return {
          message: `👁️ I can help you control the viewport. Try asking me to:\n\n• "Switch to 2D view" or "Show 3D view"\n• "Zoom to fit" or "Zoom in"\n• "Use light theme" or "Switch to dark mode"`,
          actions: []
        };
    }
  }

  /**
   * Parse project management commands
   */
  parseProjectManagement(lowerMessage, originalMessage) {
    let command = { intent: 'project_management', confidence: 0.8, originalMessage: originalMessage };
    
    // Parse specific project commands
    if (this.matchesPattern(lowerMessage, ['add floor', 'new floor', 'create floor', 'add level'])) {
      command.action = 'add_floor';
      command.confidence = 0.9;
    } else if (this.matchesPattern(lowerMessage, ['switch floor', 'go to floor', 'change floor', 'floor'])) {
      command.action = 'switch_floor';
      command.confidence = 0.8;
      // Try to extract floor name/number
      const floorMatch = lowerMessage.match(/floor\s*(\d+|ground|first|second|third)/);
      if (floorMatch) {
        command.floorName = floorMatch[1];
      }
    } else if (this.matchesPattern(lowerMessage, ['save', 'save project', 'export'])) {
      command.action = 'save_project';
      command.confidence = 0.9;
    } else if (this.matchesPattern(lowerMessage, ['objects', 'show objects', 'list objects', 'what objects'])) {
      command.action = 'list_objects';
      command.confidence = 0.9;
    } else if (this.matchesPattern(lowerMessage, ['select all', 'select everything'])) {
      command.action = 'select_all';
      command.confidence = 0.9;
    } else if (this.matchesPattern(lowerMessage, ['select all walls', 'select walls', 'select every wall'])) {
      command.action = 'select_all_walls';
      command.confidence = 0.95;
    } else if (this.matchesPattern(lowerMessage, ['clear selection', 'deselect', 'unselect'])) {
      command.action = 'clear_selection';
      command.confidence = 0.9;
    }
    
    return command;
  }

  /**
   * Execute project management
   */
  async executeProjectManagement(command) {
    const { action, floorName } = command;
    
    switch (action) {
      case 'add_floor':
        return {
          message: `🏗️ I'll add a new floor to your project. You can use the '+' button next to 'Levels' in the project tree on the left to add floors.`,
          actions: [{ type: 'project_action', action: 'add_floor' }]
        };
        
      case 'switch_floor':
        const targetFloor = floorName || 'ground';
        return {
          message: `🏢 Switching to ${targetFloor} floor. The 2D view will now show the layout for this floor level.`,
          actions: [{ type: 'project_action', action: 'switch_floor', floorName: targetFloor }]
        };
        
      case 'save_project':
        return {
          message: `💾 I can help you save your project. Use Ctrl+S or the File menu to save your current work.`,
          actions: [{ type: 'project_action', action: 'save_project' }]
        };
        
      case 'list_objects':
        const objects = standaloneCADEngine.getAllObjects();
        const objectSummary = objects.reduce((acc, obj) => {
          acc[obj.type] = (acc[obj.type] || 0) + 1;
          return acc;
        }, {});
        
        const summaryText = Object.entries(objectSummary)
          .map(([type, count]) => `• ${count} ${type}${count > 1 ? 's' : ''}`)
          .join('\n');
        
        return {
          message: `📋 **Current Project Objects:**\n\n${summaryText || 'No objects created yet'}\n\n**Total:** ${objects.length} object${objects.length !== 1 ? 's' : ''}`,
          actions: []
        };
        
      case 'select_all':
        const allObjects = standaloneCADEngine.getAllObjects();
        allObjects.forEach(obj => standaloneCADEngine.selectObject(obj.id, true));
        
        return {
          message: `🎯 Selected all ${allObjects.length} objects in your project.`,
          actions: [{ type: 'selection_action', action: 'select_all' }]
        };
        
      case 'select_all_walls':
        const allWalls = standaloneCADEngine.getAllObjects().filter(obj => obj.type === 'wall');
        
        if (allWalls.length === 0) {
          return {
            message: `🧱 **No walls found** to select.\n\nCreate some walls first, then I can help you select them!`,
            actions: []
          };
        }
        
        // Clear current selection first
        standaloneCADEngine.clearSelection();
        
        // Select all walls
        allWalls.forEach(wall => standaloneCADEngine.selectObject(wall.id, true));
        
        return {
          message: `🧱 **Selected all ${allWalls.length} wall${allWalls.length > 1 ? 's' : ''}** in your project.\n\nNow you can ask me to modify them, such as:\n• "Make the walls taller"\n• "Change the material to wood"\n• "Make them 5 meters long"`,
          actions: [{ 
            type: 'selection_action', 
            action: 'select_all_walls',
            objectIds: allWalls.map(wall => wall.id)
          }]
        };
        
      case 'clear_selection':
        standaloneCADEngine.clearSelection();
        
        return {
          message: `🎯 Cleared all selections. No objects are currently selected.`,
          actions: [{ type: 'selection_action', action: 'clear_selection' }]
        };
        
      default:
        return {
          message: `📁 I can help you manage your project. Try asking me to:\n\n• "Add a new floor" or "Switch to ground floor"\n• "Save project" or "Export project"\n• "Show all objects" or "List current objects"\n• "Select all objects" or "Clear selection"`,
          actions: []
        };
    }
  }

  /**
   * Generate conversational response
   */
  async generateConversationalResponse(message, parsedCommand) {
    const responses = [
      "I'm here to help you design and create architectural elements. You can ask me to create rooms, walls, doors, windows, furniture, manage floors, and **edit properties** of existing elements! 🏠",
      "What would you like to build today? I can create complete rooms (like 'create a 3m by 5m office'), manage floors, add furniture, or **modify existing walls and elements**.",
      "I understand natural language commands for creating and **editing** building elements. Try saying 'create a room 4x4m', 'make the wall taller', or 'change wall material to wood'. I can build and modify entire multi-story buildings! 🏗️",
      "I'm your AI architectural assistant. I can create complete rooms, manage floors, add furniture, **edit wall properties**, select tools, and organize your building project across multiple levels. Want to start with a room or modify existing walls?",
      "🏠 **Room Creation:**\n• 'Create a 3m by 5m room'\n• 'Add a 4x4m office'\n\n🧱 **Wall Editing:**\n• 'Make the wall 5 meters long'\n• 'Change wall material to wood'\n• 'Make the walls taller'\n• 'Select all walls'\n\n🗑️ **Object Deletion:**\n• 'Delete the wall'\n• 'Remove selected objects'\n• 'Delete all walls'\n• Press Backspace to delete selected\n\n🏢 **Floor Management:**\n• 'Add a new floor'\n• 'List all floors'\n• 'What floor am I on?'\n\n🪑 **Furniture:**\n• 'Add a modern chair'\n• 'Add a wooden table'\n\n🧱 **Building Elements:**\n• 'Create a wall'\n• 'Add a door'\n\nWhat would you like to build, modify, or remove?",
      "I can see exactly what's in your viewport and help organize your design across multiple floors. I can also **edit existing walls** - select them and ask me to change their length, height, thickness, or material! Try asking 'What do you see?' for design advice! 👁️🏢🔧"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Get current context for external use
   */
  getContext() {
    return { ...this.context };
  }

  /**
   * Execute query commands (information requests)
   */
  async executeQuery(command) {
    const { queryType, originalMessage } = command;
    
    try {
      let message = '';
      
      switch (queryType) {
        case 'list_floors':
          const floors = this.listFloors();
          if (floors.length === 0) {
            message = "🏢 **No floors found in the project.**\n\nYou can add a new floor by saying 'Add a new floor' or clicking the '+' button next to 'Levels' in the project tree.";
          } else {
            const floorList = floors.map(floor => {
              const activeIcon = floor.isActive ? '📍 ' : '';
              return `${activeIcon}**${floor.name}** (Level ${floor.level}) - ${floor.summary}`;
            }).join('\n');
            
            message = `🏢 **Project Floors (${floors.length} total):**\n\n${floorList}\n\n💡 You can switch floors using the project tree panel on the left, or ask me to create new floors!`;
          }
          break;
          
        case 'current_floor':
          const projectTreeContext = this.getProjectTreeContext();
          const currentFloor = projectTreeContext.currentFloorData;
          
          if (!currentFloor) {
            message = `🏢 **Current Floor:** ${projectTreeContext.currentFloor}\n\n⚠️ Floor data not available. Check the project tree on the left to see all floors.`;
          } else {
            const categories = Object.entries(currentFloor.categories);
            const categoryInfo = categories.length > 0 
              ? categories.map(([name, data]) => `${name}: ${data.items} item${data.items !== 1 ? 's' : ''}`).join(', ')
              : 'Empty floor';
              
            message = `🏢 **Current Floor:** ${currentFloor.name}\n\n📊 **Level:** ${currentFloor.level}\n🗂️ **Categories:** ${categoryInfo}\n\n💡 You can add rooms, walls, furniture, and other elements to this floor!`;
          }
          break;
          
        case 'project_tree':
          const treeContext = this.getProjectTreeContext();
          message = `🗂️ **Project Structure:**\n\n${treeContext.floorStructure}\n\n📋 **Organization:**\nEach floor contains categories for Walls (exterior/interior), Openings (doors/windows), and Furniture. Use the project tree panel on the left to navigate between floors and organize your design elements.`;
          break;
          
        case 'wall_properties':
          const selectedObjects = Array.from(this.context.selectedObjects);
          const selectedWalls = selectedObjects.filter(obj => obj.type === 'wall');
          
          if (selectedWalls.length === 0) {
            const allWalls = standaloneCADEngine.getAllObjects().filter(obj => obj.type === 'wall');
            if (allWalls.length === 0) {
              message = `🧱 **No walls found** in your project.\n\nCreate some walls first, then I can show you their properties!`;
            } else if (allWalls.length === 1) {
              message = this.generateWallPropertiesReport([allWalls[0]]);
            } else {
              message = `🧱 **Multiple walls found** (${allWalls.length} walls).\n\nPlease select a specific wall first to see its properties, or say "select all walls" to see properties of all walls.`;
            }
          } else {
            message = this.generateWallPropertiesReport(selectedWalls);
          }
          break;
          
        default:
          message = `❓ I'm not sure how to handle that query type: ${queryType}. Try asking about floors, project structure, wall properties, or specific objects.`;
      }
      
      return {
        message: message,
        actions: []
      };
      
    } catch (error) {
      console.error('❌ Failed to execute query:', error);
      return {
        message: `❌ Sorry, I encountered an error while processing your request: ${error.message}`,
        actions: []
      };
    }
  }

  /**
   * Get viewport data for AI context
   */
  getViewportContext() {
    const objects = standaloneCADEngine.getAllObjects();
    const selectedObjects = standaloneCADEngine.getSelectedObjects();
    
    // Generate comprehensive scene analysis
    const sceneAnalysis = this.analyzeViewportScene(objects, selectedObjects);
    
    // Get project tree context
    const projectTreeContext = this.getProjectTreeContext();
    
    return {
      objects: objects,
      selectedObjects: selectedObjects,
      totalObjects: objects.length,
      viewMode: this.context.viewMode,
      currentTool: this.context.selectedTool,
      sceneAnalysis: sceneAnalysis,
      projectTree: projectTreeContext,
      currentFloor: projectTreeContext.currentFloor,
      floorStructure: projectTreeContext.floorStructure
    };
  }

  /**
   * Analyze the viewport scene to provide human-readable context to AI
   */
  analyzeViewportScene(objects, selectedObjects) {
    console.log('🔍 Analyzing viewport scene for AI context...');
    
    if (objects.length === 0) {
      return {
        description: "The viewport is empty. No architectural elements have been created yet.",
        summary: "Empty scene",
        recommendations: ["Start by creating a room or wall", "Use natural language like 'create a 3m by 5m room'"],
        objectCounts: {},
        spatialLayout: "No layout"
      };
    }

    // Count objects by type
    const objectCounts = {};
    const walls = [];
    const doors = [];
    const windows = [];
    const slabs = [];
    const furniture = [];
    const other = [];

    objects.forEach(obj => {
      objectCounts[obj.type] = (objectCounts[obj.type] || 0) + 1;
      
      switch(obj.type?.toLowerCase()) {
        case 'wall':
          walls.push(obj);
          break;
        case 'door':
          doors.push(obj);
          break;
        case 'window':
          windows.push(obj);
          break;
        case 'slab':
          slabs.push(obj);
          break;
        case 'furniture':
          furniture.push(obj);
          break;
        default:
          other.push(obj);
      }
    });

    // Analyze walls and room structure
    const roomAnalysis = this.analyzeRoomStructure(walls);
    const layoutAnalysis = this.analyzeSpatialLayout(objects);
    const designRecommendations = this.generateDesignRecommendations(objects, roomAnalysis);

    // Generate human-readable description
    let description = "I can see ";
    
    if (walls.length === 0) {
      description += "no walls in the scene. ";
    } else if (walls.length === 4 && roomAnalysis.isRectangularRoom) {
      description += `a rectangular room formed by ${walls.length} walls (${roomAnalysis.dimensions.width}m × ${roomAnalysis.dimensions.length}m). `;
    } else if (walls.length >= 3) {
      description += `${walls.length} walls forming ${roomAnalysis.estimatedRooms} space(s). `;
    } else {
      description += `${walls.length} wall${walls.length > 1 ? 's' : ''} that ${walls.length === 1 ? 'appears' : 'appear'} to be part of an incomplete structure. `;
    }

    if (doors.length > 0) {
      description += `There ${doors.length === 1 ? 'is' : 'are'} ${doors.length} door${doors.length > 1 ? 's' : ''} placed. `;
    }

    if (windows.length > 0) {
      description += `There ${windows.length === 1 ? 'is' : 'are'} ${windows.length} window${windows.length > 1 ? 's' : ''} installed. `;
    }

    if (slabs.length > 0) {
      description += `There ${slabs.length === 1 ? 'is' : 'are'} ${slabs.length} slab${slabs.length > 1 ? 's' : ''} (floor/roof elements). `;
    }

    if (furniture.length > 0) {
      // Analyze furniture types
      const furnitureTypes = {};
      furniture.forEach(item => {
        const furnitureType = item.params?.furnitureType || item.params?.subtype || 'furniture';
        furnitureTypes[furnitureType] = (furnitureTypes[furnitureType] || 0) + 1;
      });
      
      const furnitureList = Object.entries(furnitureTypes)
        .map(([type, count]) => count > 1 ? `${count} ${type}s` : `${count} ${type}`)
        .join(', ');
      
      description += `The space is furnished with ${furnitureList}. `;
    }

    if (selectedObjects.length > 0) {
      description += `Currently ${selectedObjects.length} object${selectedObjects.length > 1 ? 's are' : ' is'} selected. `;
    }

    // Add design quality assessment
    if (roomAnalysis.hasProperJoinery) {
      description += "The walls appear to be properly connected at corners. ";
    } else if (walls.length >= 2) {
      description += "⚠️ Some walls may not be properly connected - consider applying wall joinery. ";
    }

    return {
      description: description.trim(),
      summary: this.generateSceneSummary(objectCounts, roomAnalysis),
      recommendations: designRecommendations,
      objectCounts: objectCounts,
      spatialLayout: layoutAnalysis,
      roomAnalysis: roomAnalysis,
      selectionContext: selectedObjects.length > 0 ? 
        `${selectedObjects.length} object(s) selected: ${selectedObjects.map(obj => `${obj.type} (${obj.id})`).join(', ')}` : 
        "No objects selected"
    };
  }

  /**
   * Analyze room structure from walls
   */
  analyzeRoomStructure(walls) {
    if (walls.length === 0) {
      return {
        isRectangularRoom: false,
        estimatedRooms: 0,
        dimensions: null,
        hasProperJoinery: false
      };
    }

    if (walls.length === 4) {
      // Check if 4 walls form a rectangle
      const bounds = this.calculateWallBounds(walls);
      const isRectangular = this.checkIfRectangular(walls, bounds);
      
      return {
        isRectangularRoom: isRectangular,
        estimatedRooms: isRectangular ? 1 : 0,
        dimensions: isRectangular ? {
          width: Math.abs(bounds.maxX - bounds.minX),
          length: Math.abs(bounds.maxZ - bounds.minZ),
          area: Math.abs(bounds.maxX - bounds.minX) * Math.abs(bounds.maxZ - bounds.minZ)
        } : null,
        hasProperJoinery: this.checkWallJoinery(walls)
      };
    }

    // For other configurations, estimate rooms
    return {
      isRectangularRoom: false,
      estimatedRooms: Math.ceil(walls.length / 4),
      dimensions: null,
      hasProperJoinery: this.checkWallJoinery(walls)
    };
  }

  /**
   * Calculate bounding box of walls
   */
  calculateWallBounds(walls) {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    walls.forEach(wall => {
      if (wall.params?.startPoint && wall.params?.endPoint) {
        const start = wall.params.startPoint;
        const end = wall.params.endPoint;
        
        minX = Math.min(minX, start.x, end.x);
        maxX = Math.max(maxX, start.x, end.x);
        minZ = Math.min(minZ, start.z, end.z);
        maxZ = Math.max(maxZ, start.z, end.z);
      }
    });

    return { minX, maxX, minZ, maxZ };
  }

  /**
   * Check if walls form a rectangle
   */
  checkIfRectangular(walls, bounds) {
    if (walls.length !== 4) return false;
    
    // Simple heuristic: check if we have 2 horizontal and 2 vertical walls
    let horizontalWalls = 0;
    let verticalWalls = 0;
    
    walls.forEach(wall => {
      if (wall.params?.startPoint && wall.params?.endPoint) {
        const start = wall.params.startPoint;
        const end = wall.params.endPoint;
        const deltaX = Math.abs(end.x - start.x);
        const deltaZ = Math.abs(end.z - start.z);
        
        if (deltaX > deltaZ) {
          horizontalWalls++;
        } else {
          verticalWalls++;
        }
      }
    });
    
    return horizontalWalls === 2 && verticalWalls === 2;
  }

  /**
   * Check wall joinery quality
   */
  checkWallJoinery(walls) {
    if (walls.length < 2) return true;
    
    // Check if walls have proper endpoint connections
    let connectedEndpoints = 0;
    const tolerance = 0.3; // 30cm tolerance
    
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const wall1 = walls[i];
        const wall2 = walls[j];
        
        if (wall1.params?.startPoint && wall1.params?.endPoint && 
            wall2.params?.startPoint && wall2.params?.endPoint) {
          
          const connections = [
            this.distance3D(wall1.params.startPoint, wall2.params.startPoint),
            this.distance3D(wall1.params.startPoint, wall2.params.endPoint),
            this.distance3D(wall1.params.endPoint, wall2.params.startPoint),
            this.distance3D(wall1.params.endPoint, wall2.params.endPoint)
          ];
          
          if (connections.some(dist => dist <= tolerance)) {
            connectedEndpoints++;
          }
        }
      }
    }
    
    // Expect at least (walls.length - 1) connections for good joinery
    return connectedEndpoints >= Math.max(1, walls.length - 1);
  }

  /**
   * Helper function to calculate 3D distance
   */
  distance3D(point1, point2) {
    if (!point1 || !point2) return Infinity;
    const dx = point1.x - point2.x;
    const dy = (point1.y || 0) - (point2.y || 0);
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Analyze spatial layout
   */
  analyzeSpatialLayout(objects) {
    if (objects.length === 0) return "No layout";
    
    const layouts = [];
    
    if (objects.some(obj => obj.type === 'wall')) {
      layouts.push("structural walls");
    }
    if (objects.some(obj => obj.type === 'door')) {
      layouts.push("entrance elements");
    }
    if (objects.some(obj => obj.type === 'window')) {
      layouts.push("fenestration");
    }
    if (objects.some(obj => obj.type === 'slab')) {
      layouts.push("horizontal elements");
    }
    if (objects.some(obj => obj.type === 'furniture')) {
      layouts.push("furnished spaces");
    }
    
    return layouts.length > 0 ? layouts.join(", ") : "basic elements";
  }

  /**
   * Generate design recommendations
   */
  generateDesignRecommendations(objects, roomAnalysis) {
    const recommendations = [];
    
    if (objects.length === 0) {
      recommendations.push("Start by creating a room: 'create a 3m by 5m room'");
      recommendations.push("Or add individual walls: 'create a wall'");
      return recommendations;
    }
    
    const walls = objects.filter(obj => obj.type === 'wall');
    const doors = objects.filter(obj => obj.type === 'door');
    const windows = objects.filter(obj => obj.type === 'window');
    const furniture = objects.filter(obj => obj.type === 'furniture');
    
    // Wall-specific recommendations
    if (walls.length > 0 && !roomAnalysis.hasProperJoinery) {
      recommendations.push("⚠️ Consider fixing wall connections for proper joinery");
    }
    
    if (walls.length >= 3 && doors.length === 0) {
      recommendations.push("🚪 Add doors for room access: 'add a door'");
    }
    
    if (walls.length >= 3 && windows.length === 0) {
      recommendations.push("🪟 Consider adding windows for natural light: 'add a window'");
    }
    
    // Furniture-specific recommendations
    if (roomAnalysis.isRectangularRoom && furniture.length === 0) {
      const area = roomAnalysis.dimensions?.area || 0;
      if (area >= 10) {
        recommendations.push("🪑 Add furniture to make the space functional: 'add a chair' or 'add a table'");
      }
    }
    
    if (furniture.length > 0) {
      // Analyze furniture types for recommendations
      const furnitureTypes = furniture.map(item => item.params?.furnitureType || 'furniture');
      const hasSeating = furnitureTypes.some(type => ['chair', 'sofa', 'armchair', 'stool', 'bench'].includes(type));
      const hasTables = furnitureTypes.some(type => ['table', 'desk'].includes(type));
      const hasStorage = furnitureTypes.some(type => ['cabinet', 'shelf', 'dresser', 'wardrobe'].includes(type));
      
      if (!hasSeating && roomAnalysis.isRectangularRoom) {
        recommendations.push("💺 Consider adding seating: 'add a chair' or 'add a sofa'");
      }
      
      if (hasSeating && !hasTables) {
        recommendations.push("🏓 Add a table to complement the seating: 'add a table'");
      }
      
      if (furniture.length > 3 && !hasStorage) {
        recommendations.push("📦 Consider adding storage furniture: 'add a cabinet' or 'add a shelf'");
      }
    }
    
    if (roomAnalysis.isRectangularRoom && roomAnalysis.dimensions) {
      const area = roomAnalysis.dimensions.area;
      if (area < 10) {
        recommendations.push("💡 This is a small room - consider compact furniture");
      } else if (area > 50) {
        recommendations.push("💡 This is a large room - consider creating furniture zones or adding more pieces");
      }
    }
    
    if (walls.length >= 4 && objects.filter(obj => obj.type === 'slab').length === 0) {
      recommendations.push("🏗️ Consider adding floor/ceiling slabs for completeness");
    }
    
    return recommendations;
  }

  /**
   * Generate concise scene summary
   */
  generateSceneSummary(objectCounts, roomAnalysis) {
    const parts = [];
    
    if (roomAnalysis.isRectangularRoom) {
      parts.push(`Rectangular room (${roomAnalysis.dimensions.width.toFixed(1)}m × ${roomAnalysis.dimensions.length.toFixed(1)}m)`);
    } else if (objectCounts.wall > 0) {
      parts.push(`${objectCounts.wall} wall${objectCounts.wall > 1 ? 's' : ''}`);
    }
    
    if (objectCounts.door > 0) {
      parts.push(`${objectCounts.door} door${objectCounts.door > 1 ? 's' : ''}`);
    }
    
    if (objectCounts.window > 0) {
      parts.push(`${objectCounts.window} window${objectCounts.window > 1 ? 's' : ''}`);
    }
    
    if (objectCounts.furniture > 0) {
      parts.push(`${objectCounts.furniture} furniture piece${objectCounts.furniture > 1 ? 's' : ''}`);
    }
    
    return parts.length > 0 ? parts.join(", ") : "Empty scene";
  }

  /**
   * Event system for external integration
   */
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in AI Command Executor event listener (${event}):`, error);
        }
      });
    }
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.listeners.clear();
    this.toolHandlers.clear();
    this.isProcessing = false;
  }
}

// Export singleton instance
const aiCommandExecutor = new AICommandExecutor();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.aiCommandExecutor = aiCommandExecutor;
  console.log('🤖 AI Command Executor available at window.aiCommandExecutor');
}

export default aiCommandExecutor;