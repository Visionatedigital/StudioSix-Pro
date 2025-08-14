/**
 * Xeokit IFC Service - Enhanced IFC handling with xeokit integration
 * 
 * This service handles IFC file import and visualization using xeokit-sdk
 * with web-ifc for parsing and conversion to xeokit format
 */

import { IfcAPI, IFCPROJECT } from 'web-ifc';

class XeokitIFCService {
  constructor() {
    this.ifcAPI = null;
    this.xeokitViewer = null;
    this.isInitialized = false;
    this.loadedModels = new Map();
    
    console.log('🏗️ Xeokit IFC Service created');
  }

  /**
   * Initialize the service with xeokit viewer
   */
  async initialize(xeokitViewer) {
    try {
      console.log('🚀 Initializing Xeokit IFC Service...');

      // Store xeokit viewer reference
      this.xeokitViewer = xeokitViewer;

      // Initialize web-ifc API with performance optimizations
      this.ifcAPI = new IfcAPI();
      
      // Set optimized WASM path - check multiple locations (prioritize public paths)
      const wasmPaths = [
        '/wasm/',
        '/',
        '/static/js/',
        './wasm/',
        process.env.PUBLIC_URL + '/wasm/',
        '/node_modules/web-ifc/'
      ];
      
      let wasmLoaded = false;
      for (const path of wasmPaths) {
        try {
          this.ifcAPI.SetWasmPath(path);
          await this.ifcAPI.Init();
          wasmLoaded = true;
          console.log(`✅ Web-IFC WASM loaded from: ${path}`);
          break;
        } catch (error) {
          console.warn(`⚠️ Failed to load WASM from ${path}:`, error.message);
        }
      }
      
      if (!wasmLoaded) {
        throw new Error('Could not load web-ifc WASM from any path');
      }
      console.log('✅ Web-IFC API initialized');

      this.isInitialized = true;
      console.log('✅ Xeokit IFC Service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Xeokit IFC Service:', error);
      return false;
    }
  }

  /**
   * Load IFC file into xeokit viewer
   */
  async loadIFCFile(file, options = {}) {
    if (!this.isInitialized) {
      throw new Error('IFC Service not initialized');
    }

    if (!this.xeokitViewer) {
      throw new Error('Xeokit viewer not provided');
    }

    try {
      console.log('📁 Loading IFC file:', file.name);
      
      // Read file as ArrayBuffer
      const arrayBuffer = await this.fileToArrayBuffer(file);
      
      // Open IFC model with web-ifc
      const modelID = this.ifcAPI.OpenModel(arrayBuffer);
      console.log('🔄 IFC model opened with ID:', modelID);

      // Extract geometry and create xeokit model
      const xeokitModel = await this.convertIFCToXeokit(modelID, file.name, options);
      
      // Store model reference
      this.loadedModels.set(file.name, {
        modelID,
        xeokitModel,
        file
      });

      console.log('✅ IFC file loaded successfully:', file.name);
      return {
        success: true,
        modelID,
        xeokitModel,
        fileName: file.name
      };

    } catch (error) {
      console.error('❌ Failed to load IFC file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert IFC model to xeokit entities
   */
  async convertIFCToXeokit(modelID, fileName, options = {}) {
    try {
      console.log('🔄 Converting IFC to xeokit format...');

      // Get all IFC entities
      const allEntities = this.ifcAPI.GetLineIDsWithType(modelID, 0); // 0 = all types
      console.log(`📊 Found ${allEntities.size()} IFC entities`);

      // Create xeokit scene
      const scene = this.xeokitViewer.scene;
      
      // Create root model node
      const modelId = `ifc-model-${Date.now()}`;
      const model = scene.models[modelId] = {
        id: modelId,
        isModel: true,
        objects: []
      };

      // Process entities with optimized batching and parallel processing
      const batchSize = 500; // Increased batch size for better performance
      const totalEntities = allEntities.size();
      let processedCount = 0;
      const entityPromises = [];

      // Process entities in larger batches with parallel execution
      for (let i = 0; i < totalEntities; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, totalEntities);
        const batchPromises = [];
        
        for (let j = i; j < batchEnd; j++) {
          const entityID = allEntities.get(j);
          // Process entities in parallel within batch
          batchPromises.push(this.processIFCEntity(modelID, entityID, scene, modelId));
        }
        
        // Wait for batch to complete
        const batchResults = await Promise.allSettled(batchPromises);
        processedCount += batchResults.length;

        // Report progress less frequently for better performance
        if (i % (batchSize * 5) === 0 || processedCount >= totalEntities) {
          const progress = Math.round((processedCount / totalEntities) * 100);
          console.log(`🔄 Processing IFC entities: ${progress}% (${processedCount}/${totalEntities})`);
        }
        
        // Yield control less frequently
        if (i % (batchSize * 2) === 0) {
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }

      // Fit camera to show the entire model
      this.xeokitViewer.cameraFlight.flyTo(model);

      console.log('✅ IFC to xeokit conversion complete');
      return model;

    } catch (error) {
      console.error('❌ IFC to xeokit conversion failed:', error);
      throw error;
    }
  }

  /**
   * Process individual IFC entity
   */
  async processIFCEntity(modelID, entityID, scene, modelId) {
    try {
      // Get entity properties
      const properties = this.ifcAPI.GetLine(modelID, entityID);
      
      if (!properties) return;

      // Get entity type info
      const entityType = properties.constructor.name;
      
      // Skip certain entity types that don't need visualization
      const skipTypes = ['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCPERSON', 'IFCORGANIZATION'];
      if (skipTypes.includes(entityType)) {
        return;
      }

      // Get geometry if available
      const geometry = await this.getEntityGeometry(modelID, entityID);
      
      if (geometry && geometry.vertices.length > 0) {
        // Create xeokit entity
        const entityId = `${entityType}-${entityID}`;
        
        // Create mesh
        const mesh = scene.createMesh({
          id: `${entityId}-mesh`,
          positions: geometry.vertices,
          indices: geometry.indices,
          normals: geometry.normals
        });

        // Create entity
        const entity = scene.createEntity({
          id: entityId,
          meshIds: [mesh.id],
          isObject: true,
          colorize: this.getEntityColor(entityType)
        });

        // Add to model
        scene.models[modelId].objects.push(entity);
      }

    } catch (error) {
      // Log but don't stop processing other entities
      console.warn(`⚠️ Failed to process entity ${entityID}:`, error.message);
    }
  }

  /**
   * Get geometry for IFC entity
   */
  async getEntityGeometry(modelID, entityID) {
    try {
      // Get geometry from web-ifc
      const geometry = this.ifcAPI.GetGeometry(modelID, entityID);
      
      if (!geometry || !geometry.GetVertexData) {
        return null;
      }

      // Extract vertex data
      const vertexData = geometry.GetVertexData();
      const indexData = geometry.GetIndexData();

      // Convert to format expected by xeokit
      const vertices = [];
      const indices = [];
      const normals = [];

      // Process vertices (assuming each vertex has 6 values: x,y,z,nx,ny,nz)
      for (let i = 0; i < vertexData.length; i += 6) {
        vertices.push(vertexData[i], vertexData[i + 1], vertexData[i + 2]);
        normals.push(vertexData[i + 3], vertexData[i + 4], vertexData[i + 5]);
      }

      // Process indices
      for (let i = 0; i < indexData.length; i++) {
        indices.push(indexData[i]);
      }

      return {
        vertices: new Float32Array(vertices),
        indices: new Uint32Array(indices),
        normals: new Float32Array(normals)
      };

    } catch (error) {
      console.warn(`⚠️ Failed to get geometry for entity ${entityID}:`, error.message);
      return null;
    }
  }

  /**
   * Get appropriate color for entity type
   */
  getEntityColor(entityType) {
    const colorMap = {
      'IFCWALL': [0.8, 0.8, 0.8],           // Light gray walls
      'IFCWALLSTANDARDCASE': [0.8, 0.8, 0.8], // Light gray walls
      'IFCDOOR': [0.6, 0.3, 0.1],           // Brown doors
      'IFCWINDOW': [0.3, 0.6, 0.9],         // Blue windows
      'IFCSLAB': [0.7, 0.7, 0.7],           // Gray slabs
      'IFCBEAM': [0.4, 0.2, 0.1],           // Dark brown beams
      'IFCCOLUMN': [0.5, 0.5, 0.5],         // Gray columns
      'IFCROOF': [0.8, 0.2, 0.2],           // Red roof
      'IFCSTAIR': [0.6, 0.6, 0.6],          // Gray stairs
      'IFCRAILING': [0.3, 0.3, 0.3],        // Dark gray railings
      'IFCFURNISHINGELEMENT': [0.4, 0.6, 0.8], // Light blue furniture
      'IFCSPACE': [0.9, 0.9, 0.9, 0.1]      // Semi-transparent spaces
    };

    return colorMap[entityType] || [0.6, 0.6, 0.6]; // Default gray
  }

  /**
   * Convert File to ArrayBuffer
   */
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Clear all loaded models
   */
  clearModels() {
    if (this.xeokitViewer && this.xeokitViewer.scene) {
      // Clear all models from scene
      Object.keys(this.xeokitViewer.scene.models).forEach(modelId => {
        if (modelId.startsWith('ifc-model-')) {
          this.xeokitViewer.scene.destroyModel(modelId);
        }
      });
    }

    // Clear web-ifc models
    if (this.ifcAPI && this.loadedModels.size > 0) {
      this.loadedModels.forEach((modelData, fileName) => {
        try {
          this.ifcAPI.CloseModel(modelData.modelID);
        } catch (error) {
          console.warn(`Failed to close IFC model ${fileName}:`, error.message);
        }
      });
    }

    this.loadedModels.clear();
    console.log('🗑️ Cleared all IFC models');
  }

  /**
   * Get model information
   */
  getModelInfo(fileName) {
    const modelData = this.loadedModels.get(fileName);
    if (!modelData) return null;

    try {
      const modelID = modelData.modelID;
      
      // Get basic model properties
      const ifcProject = this.ifcAPI.GetLineIDsWithType(modelID, IFCPROJECT);
      const projectInfo = ifcProject.size() > 0 ? this.ifcAPI.GetLine(modelID, ifcProject.get(0)) : null;

      return {
        fileName,
        modelID,
        projectName: projectInfo?.Name?.value || fileName,
        description: projectInfo?.Description?.value || 'IFC Model',
        entityCount: this.ifcAPI.GetLineIDsWithType(modelID, 0).size(),
        loadedAt: modelData.loadedAt || new Date().toISOString()
      };

    } catch (error) {
      console.warn(`Failed to get model info for ${fileName}:`, error.message);
      return { fileName, error: error.message };
    }
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.clearModels();
    
    if (this.ifcAPI) {
      try {
        // Clean up web-ifc resources
        // Note: web-ifc doesn't have an explicit dispose method
        this.ifcAPI = null;
      } catch (error) {
        console.warn('Error disposing IFC API:', error.message);
      }
    }

    this.xeokitViewer = null;
    this.isInitialized = false;
    console.log('🗑️ Xeokit IFC Service disposed');
  }
}

// Export singleton instance
const xeokitIFCService = new XeokitIFCService();
export default xeokitIFCService;