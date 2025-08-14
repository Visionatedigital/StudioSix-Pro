/**
 * IFC Service - Handles IFC file parsing and processing
 * 
 * This service initializes and configures web-ifc for BIM object creation 
 * and IFC file handling with xeokit integration.
 */

import { IFCSPACE, IFCWALLSTANDARDCASE, IFCWINDOW, IFCDOOR } from 'web-ifc';

class IFCService {
  constructor() {
    this.ifcAPI = null;
    this.xeokitViewer = null;
    this.isInitialized = false;
    this.models = new Map();
    
    console.log('🏗️ IFC Service instance created');
  }

  /**
   * Initialize the IFC service with xeokit integration
   * @param {Object} xeokitViewer - The xeokit viewer instance
   * @param {HTMLCanvasElement} canvas - Canvas element for reference
   */
  async initialize(xeokitViewer = null, canvas = null) {
    try {
      console.log('🚀 Initializing IFC Service...');

      // Initialize web-ifc API directly
      const { IfcAPI } = await import('web-ifc');
      this.ifcAPI = new IfcAPI();
      
      // Configure WASM path to use files from public directory
      this.ifcAPI.SetWasmPath('/wasm/');
      
      // Initialize the API with better error handling
      await this.ifcAPI.Init();
      console.log('✅ Web-IFC API initialized');

      // Store xeokit viewer reference for integration
      this.xeokitViewer = xeokitViewer;

      // Set initialization flag
      this.isInitialized = true;
      
      console.log('✅ IFC Service initialized successfully');
      return true;
      
    } catch (error) {
      console.warn('⚠️ IFC Service initialization failed, continuing without IFC support:', error.message);
      // Don't throw error - allow application to continue without IFC functionality
      this.isInitialized = false;
      this.xeokitViewer = xeokitViewer; // Still store viewer reference
      return false;
    }
  }

  /**
   * Load an IFC file and parse it
   * @param {File|ArrayBuffer} ifcFile - IFC file to load
   * @param {string} modelName - Name for the model
   */
  async loadIFCFile(ifcFile, modelName = 'model') {
    try {
      if (!this.isInitialized) {
        throw new Error('IFC Service not initialized. Call initialize() first.');
      }

      console.log(`📂 Loading IFC file: ${modelName}`);

      // Convert file to ArrayBuffer if needed
      const arrayBuffer = ifcFile instanceof ArrayBuffer 
        ? ifcFile 
        : await this.fileToArrayBuffer(ifcFile);

      // Open the model in web-ifc
      const modelID = this.ifcAPI.OpenModel(arrayBuffer);
      
      // Get model properties
      const properties = await this.ifcAPI.GetModelProperties(modelID);
      
      const modelData = { 
        modelID, 
        ifcAPI: this.ifcAPI,
        properties,
        name: modelName,
        loaded: true
      };
      
      this.models.set(modelName, modelData);
      
      console.log(`✅ IFC file parsed successfully: ${modelName} (ID: ${modelID})`);
      console.log(`📊 Model properties:`, properties);

      return modelData;
      
    } catch (error) {
      console.error(`❌ Failed to load IFC file ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Create BIM objects using IFC definitions
   * @param {Object} objectData - Object data (type, geometry, properties)
   */
  async createBIMObject(objectData) {
    try {
      const { type, geometry, properties = {} } = objectData;
      
      console.log(`🏗️ Creating BIM object of type: ${type}`);

      // Map object types to IFC types
      const ifcTypeMap = {
        'wall': IFCWALLSTANDARDCASE,
        'door': IFCDOOR,
        'window': IFCWINDOW,
        'space': IFCSPACE
      };

      const ifcType = ifcTypeMap[type.toLowerCase()] || IFCWALLSTANDARDCASE;

      // Create object structure for IFC
      const bimObject = {
        id: properties.id || `${type}_${Date.now()}`,
        type: type,
        ifcType: ifcType,
        geometry: geometry,
        properties: {
          name: properties.name || `${type}_${Date.now()}`,
          description: properties.description || `Generated ${type}`,
          ...properties
        },
        xeokitEntityId: null, // Will be set when integrated with xeokit
        created: new Date().toISOString()
      };

      console.log(`✅ BIM object created:`, bimObject);
      return bimObject;
      
    } catch (error) {
      console.error('❌ Failed to create BIM object:', error);
      throw error;
    }
  }

  /**
   * Get all elements of a specific type from a loaded model
   * @param {string} modelName - Name of the model
   * @param {number} ifcType - IFC type constant
   */
  async getElementsOfType(modelName, ifcType) {
    try {
      const model = this.models.get(modelName);
      if (!model) {
        throw new Error(`Model ${modelName} not found`);
      }

      console.log(`🔍 Getting elements of type ${ifcType} from model ${modelName}`);
      
      const elements = await this.ifcAPI.GetLineIDsWithType(model.modelID, ifcType);
      console.log(`📊 Found ${elements.size()} elements of type ${ifcType}`);
      
      return elements;
      
    } catch (error) {
      console.error('❌ Failed to get elements:', error);
      throw error;
    }
  }

  /**
   * Get properties of a specific IFC element
   * @param {string} modelName - Name of the model
   * @param {number} elementID - Element ID
   */
  async getElementProperties(modelName, elementID) {
    try {
      const model = this.models.get(modelName);
      if (!model) {
        throw new Error(`Model ${modelName} not found`);
      }

      const properties = await this.ifcAPI.GetLine(model.modelID, elementID);
      return properties;
      
    } catch (error) {
      console.error('❌ Failed to get element properties:', error);
      throw error;
    }
  }

  /**
   * Get all loaded models
   */
  getModels() {
    return Array.from(this.models.entries()).map(([name, data]) => ({
      name,
      data
    }));
  }

  /**
   * Get specific model by name
   * @param {string} modelName - Name of the model
   */
  getModel(modelName) {
    return this.models.get(modelName);
  }

  /**
   * Utility: Convert File to ArrayBuffer
   * @param {File} file - File object
   */
  async fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Test initialization (for development/testing)
   */
  static async testInitialization() {
    try {
      console.log('🧪 Testing IFC Service initialization...');
      
      const ifcService = new IFCService();
      await ifcService.initialize();
      
      console.log('✅ IFC Service test passed - initialization successful');
      return true;
      
    } catch (error) {
      console.error('❌ IFC Service test failed:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    try {
      if (this.ifcAPI) {
        // Close all models
        for (const [name, model] of this.models) {
          try {
            this.ifcAPI.CloseModel(model.modelID);
            console.log(`🧹 Closed IFC model: ${name}`);
          } catch (error) {
            console.warn(`⚠️ Error closing model ${name}:`, error);
          }
        }
        
        this.ifcAPI = null;
      }

      this.models.clear();
      this.xeokitViewer = null;
      this.isInitialized = false;
      
      console.log('🧹 IFC Service cleaned up');
      
    } catch (error) {
      console.warn('⚠️ Error during IFC Service cleanup:', error);
    }
  }
}

// Create singleton instance
const ifcService = new IFCService();

// Export both the class and singleton instance
export { IFCService };
export default ifcService; 