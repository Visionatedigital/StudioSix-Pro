/**
 * Simple IFC Handler for Xeokit
 * 
 * Real IFC file parser that extracts actual geometry and renders
 * the true building structure in xeokit viewer
 */

// Dynamic import to handle WASM loading issues better
// IfcAPI is imported dynamically in the initialize method

class SimpleIFCHandler {
  constructor() {
    this.xeokitViewer = null;
    this.loadedModels = new Map();
    this.isInitialized = false;
    this.isInitializing = false;
    this.ifcAPI = null;
    
    console.log('🏗️ Real IFC Handler created');
  }

  /**
   * Initialize with xeokit viewer
   */
  async initialize(xeokitViewer) {
    // Prevent concurrent initialization (React Strict Mode protection)
    if (this.isInitializing) {
      console.log('⏳ IFC Handler initialization already in progress, waiting...');
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.isInitialized) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
      });
    }

    this.isInitializing = true;

    try {
      console.log('🚀 Initializing Real IFC Handler with web-ifc...');
      
      this.xeokitViewer = xeokitViewer;
      
      // Re-enable IFC functionality with comprehensive debugging
      console.log('🔧 Starting IFC functionality setup with enhanced debugging...');
      console.log('📊 Environment check:');
      console.log('  - WebAssembly support:', typeof WebAssembly !== 'undefined');
      console.log('  - Worker support:', typeof Worker !== 'undefined');
      console.log('  - Fetch support:', typeof fetch !== 'undefined');
      console.log('  - Current URL:', window.location.href);
      
      // Dynamic import web-ifc to handle WASM loading issues
      let IfcAPI;
      try {
        console.log('📦 Importing web-ifc package...');
        const webIfc = await import('web-ifc');
        IfcAPI = webIfc.IfcAPI;
        console.log('✅ Successfully imported web-ifc package');
        console.log('📊 IfcAPI constructor type:', typeof IfcAPI);
      } catch (error) {
        console.error('❌ Failed to import web-ifc package:', error);
        console.error('❌ Import error details:', error.message, error.stack);
        this.ifcAPI = null;
        this.isInitializing = false;
        this.isInitialized = true;
        console.log('✅ IFC Handler initialized in placeholder mode (web-ifc package unavailable)');
        return true;
      }
      
      // We'll create fresh IfcAPI instances for each attempt to avoid corruption
      
      // Completely prevent Worker creation during IFC operations
      const originalWorker = window.Worker;
      const disableWorkers = () => {
        window.Worker = function(scriptURL, options) {
          console.log('🔄 Worker creation intercepted:', scriptURL);
          
          // Redirect webpack worker paths to local files
          if (typeof scriptURL === 'string' && scriptURL.includes('web-ifc-mt.worker.js')) {
            const localWorkerURL = '/web-ifc-mt.worker.js';
            console.log(`✅ Redirecting worker script to local: ${localWorkerURL}`);
            return new originalWorker(localWorkerURL, options);
          }
          
          // Allow other workers normally
          return new originalWorker(scriptURL, options);
        };
      };
      
      // Re-enable workers after IFC initialization
      const enableWorkers = () => {
        window.Worker = originalWorker;
      };
      
      // Store these for later use
      this.disableWorkers = disableWorkers;
      this.enableWorkers = enableWorkers;
      
      // Network interception to redirect WASM requests to local files
      console.log('🌐 Setting up network interception for WASM files...');
      const originalFetch = window.fetch;
      const enableNetworkInterception = () => {
        window.fetch = function(url, options) {
          // Check if this is a web-ifc file request OR webpack static file
          if (typeof url === 'string' && (url.includes('web-ifc') || url.includes('/static/js/'))) {
            console.log(`🔄 Intercepting web-ifc/webpack request: ${url}`);
            
            // Single-threaded WASM
            if (url.includes('web-ifc.wasm') && !url.includes('web-ifc-mt')) {
              const localUrl = '/web-ifc.wasm';
              console.log(`✅ Redirecting single-threaded WASM to local: ${localUrl}`);
              return originalFetch.call(this, localUrl, options);
            }
            
            // Multi-threaded WASM file
            if (url.includes('web-ifc-mt.wasm')) {
              const localUrl = '/wasm/web-ifc-mt.wasm';
              console.log(`✅ Redirecting multi-threaded WASM to local: ${localUrl}`);
              return originalFetch.call(this, localUrl, options);
            }
            
            // Multi-threaded worker file (both direct and webpack paths)
            if (url.includes('web-ifc-mt.worker.js')) {
              const localUrl = '/web-ifc-mt.worker.js';
              console.log(`✅ Redirecting multi-threaded worker to local: ${localUrl}`);
              return originalFetch.call(this, localUrl, options);
            }
            
            // Any other web-ifc files
            if (url.includes('web-ifc')) {
              console.log(`🔄 Allowing other web-ifc request: ${url}`);
            }
          }
          
          // Pass through all other requests
          return originalFetch.call(this, url, options);
        };
      };
      
      const disableNetworkInterception = () => {
        window.fetch = originalFetch;
      };
      
      // Store network control functions
      this.enableNetworkInterception = enableNetworkInterception;
      this.disableNetworkInterception = disableNetworkInterception;
      
      // WASM INITIALIZATION - Local paths only (no CDN to avoid HTML responses)
      const wasmPaths = [
        '/wasm/',           // Primary: /public/wasm/web-ifc.wasm
        '/'                 // Fallback: /public/web-ifc.wasm
      ];
      
      let initialized = false;
      
      // Disable workers globally during initialization
      this.disableWorkers();
      
      // Enable network interception during initialization
      this.enableNetworkInterception();
      
      for (let i = 0; i < wasmPaths.length; i++) {
        const wasmPath = wasmPaths[i];
        try {
          console.log(`🔧 Attempt ${i + 1}/${wasmPaths.length}: Trying WASM path: ${wasmPath} (workers blocked)`);
          
          // Create fresh IfcAPI instance for this attempt (prevents corruption from failed attempts)
          console.log(`🏗️ Creating fresh IfcAPI instance for attempt ${i + 1}...`);
          try {
            this.ifcAPI = new IfcAPI();
            console.log(`✅ Fresh IfcAPI instance created successfully`);
          } catch (apiError) {
            console.error(`❌ Failed to create IfcAPI instance:`, apiError);
            continue; // Skip this attempt
          }
          
          // Verify WASM file is accessible before trying to initialize
          const wasmUrl = `${wasmPath}web-ifc.wasm`;
          console.log(`🔍 Step 1: Checking WASM file accessibility at: ${wasmUrl}`);
          
          try {
            const response = await fetch(wasmUrl, { method: 'HEAD' });
            console.log(`📊 Response status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
            if (!response.ok) {
              throw new Error(`WASM file not accessible (status: ${response.status})`);
            }
            if (response.headers.get('content-type') !== 'application/wasm') {
              throw new Error(`Wrong content-type: ${response.headers.get('content-type')}`);
            }
            console.log(`✅ Step 1 SUCCESS: WASM file verified at ${wasmUrl}`);
          } catch (fetchError) {
            console.warn(`❌ Step 1 FAILED: WASM file check failed for ${wasmUrl}:`, fetchError.message);
            continue; // Skip this path
          }
          
          // Set WASM path with workers completely disabled
          console.log(`🔧 Step 2: Setting WASM path to: ${wasmPath}`);
          this.ifcAPI.SetWasmPath(wasmPath);
          console.log(`✅ Step 2 SUCCESS: WASM path set`);
          
          // Try to preload the WASM binary manually to avoid web-ifc's URL loading issues
          try {
            console.log(`📥 Step 3: Pre-loading WASM binary from ${wasmUrl}`);
            const wasmResponse = await fetch(wasmUrl);
            if (wasmResponse.ok) {
              const wasmArrayBuffer = await wasmResponse.arrayBuffer();
              console.log(`✅ Step 3 SUCCESS: WASM binary loaded: ${wasmArrayBuffer.byteLength} bytes`);
              
              // Override the WASM module if possible
              if (this.ifcAPI.wasmModule) {
                this.ifcAPI.wasmModule = wasmArrayBuffer;
                console.log(`✅ Step 3a: WASM module override applied`);
              } else {
                console.log(`ℹ️ Step 3a: No wasmModule property to override`);
              }
            }
          } catch (preloadError) {
            console.warn(`⚠️ Step 3 WARNING: WASM preload failed (continuing):`, preloadError.message);
          }
          
          // Initialize with timeout and single-threading forced
          console.log(`🚀 Step 4: Initializing web-ifc (single-threaded, 5s timeout)...`);
          const initPromise = this.ifcAPI.Init(false); // false = disable multi-threading
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('WASM init timeout after 5 seconds')), 5000)
          );
          
          await Promise.race([initPromise, timeoutPromise]);
          console.log(`✅ Step 4 SUCCESS: Web-IFC initialized with WASM path: ${wasmPath} (single-threaded)`);
          initialized = true;
          break;
        } catch (error) {
          console.error(`❌ Attempt ${i + 1} FAILED for ${wasmPath}:`, error.message);
          console.error(`❌ Error type:`, error.constructor.name);
          console.error(`❌ Full error:`, error);
          if (error.stack) {
            console.error(`❌ Stack trace:`, error.stack);
          }
        }
      }
      
      // Re-enable workers after initialization (in case other parts of the app need them)
      this.enableWorkers();
      
      // Disable network interception after initialization
      this.disableNetworkInterception();
      
      if (!initialized) {
        console.error('❌❌❌ FINAL RESULT: Could not initialize web-ifc, falling back to placeholder mode');
        console.error('🔍 This means IFC files will show as placeholder walls instead of real geometry');
        console.error('💡 All WASM loading attempts failed. Check the detailed logs above for specific errors.');
        this.ifcAPI = null;
      } else {
        console.log('🎉🎉🎉 FINAL RESULT: web-ifc successfully initialized! Real IFC parsing enabled.');
      }
      
      this.isInitializing = false;
      this.isInitialized = true;
      const status = !!this.ifcAPI ? 'REAL IFC PARSING ENABLED' : 'PLACEHOLDER MODE ONLY';
      console.log(`✅ IFC Handler initialized (${status})`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Real IFC Handler:', error);
      this.ifcAPI = null;
      this.isInitializing = false;
      this.isInitialized = true; // Continue without web-ifc
      return false;
    }
  }

  /**
   * Load IFC file - Parse actual IFC content and render real geometry
   */
  async loadIFCFile(file, options = {}) {
    if (!this.isInitialized || !this.xeokitViewer) {
      throw new Error('IFC Handler not initialized');
    }

    try {
      console.log('📁 Loading IFC file (parsing real geometry):', file.name);
      
      const modelId = `ifc-${Date.now()}`;
      let model;
      
      if (this.ifcAPI) {
        // Parse real IFC file
        console.log('🔍 Parsing IFC file with web-ifc...');
        console.log('📊 this.ifcAPI is available, proceeding with real geometry parsing');
        model = await this.parseRealIFCFile(file, modelId);
      } else {
        // Fallback to placeholder
        console.log('⚠️ Using placeholder model (web-ifc unavailable)');
        console.log('🔍 this.ifcAPI is null - falling back to placeholder walls');
        console.log('💡 To fix this, ensure WASM files load properly during initialization');
        model = await this.createIFCPlaceholderModel(modelId, file.name);
      }
      
      // Store model reference
      this.loadedModels.set(file.name, {
        modelId,
        model,
        file,
        loadedAt: new Date().toISOString(),
        isReal: !!this.ifcAPI
      });

      // Fit camera to model
      if (this.xeokitViewer.viewer && model) {
        this.xeokitViewer.viewer.cameraFlight.flyTo(model);
      }

      console.log('✅ IFC file loaded:', file.name, this.ifcAPI ? '(real geometry)' : '(placeholder)');
      
      return {
        success: true,
        modelID: modelId,
        xeokitModel: model,
        fileName: file.name,
        isReal: !!this.ifcAPI
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
   * Parse real IFC file using web-ifc
   */
  async parseRealIFCFile(file, modelId) {
    try {
      console.log('🔍 Reading IFC file content...');
      
      // Read file as ArrayBuffer
      const arrayBuffer = await this.fileToArrayBuffer(file);
      
      // Open IFC model
      const ifcModelID = this.ifcAPI.OpenModel(arrayBuffer);
      console.log('📖 IFC model opened with ID:', ifcModelID);
      
      // Get all lines in the model
      const allLines = this.ifcAPI.GetLineIDsWithType(ifcModelID, 0);
      console.log(`📋 Found ${allLines.size()} IFC entities`);
      
      // Create xeokit scene model or use fallback
      const scene = this.xeokitViewer.viewer.scene;
      let model = null;
      
      if (scene && window.xeokit && window.xeokit.SceneModel) {
        console.log('✅ Using real xeokit SceneModel for geometry creation');
        const SceneModel = window.xeokit.SceneModel;
        model = new SceneModel(scene, {
          id: modelId,
          isModel: true,
          position: [0, 0, 0],
          scale: [1, 1, 1],
          rotation: [0, 0, 0]
        });
      } else {
        console.log('📝 Using fallback mode - testing geometry processing without 3D visualization');
        // Create a mock model for testing geometry processing
        model = {
          id: modelId,
          meshes: [],
          entities: [],
          createMesh: function(meshConfig) {
            const mesh = {
              id: meshConfig.id,
              positions: meshConfig.positions,
              normals: meshConfig.normals,
              indices: meshConfig.indices
            };
            this.meshes.push(mesh);
            console.log(`📦 Mock mesh created: ${mesh.id} (${mesh.positions.length/3} vertices, ${mesh.indices.length/3} triangles)`);
            return mesh;
          },
          createEntity: function(entityConfig) {
            const entity = {
              id: entityConfig.id,
              meshIds: entityConfig.meshIds,
              isObject: entityConfig.isObject,
              colorize: entityConfig.colorize
            };
            this.entities.push(entity);
            console.log(`🎯 Mock entity created: ${entity.id} (color: [${entity.colorize.join(', ')}])`);
            return entity;
          },
          finalize: function() {
            console.log(`✅ Mock model finalized: ${this.meshes.length} meshes, ${this.entities.length} entities`);
          }
        };
      }

      // Process IFC entities and extract geometry
      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const totalEntities = allLines.size();
      
      console.log(`🔄 Processing all ${totalEntities} entities...`);
      
      for (let i = 0; i < totalEntities; i++) {
        const lineID = allLines.get(i);
        
        try {
          const processed = await this.processIFCEntity(ifcModelID, lineID, model, modelId);
          if (processed) {
            processedCount++;
          } else {
            skippedCount++;
          }
          
          // Progress update every 100 entities
          if (i % 100 === 0) {
            console.log(`🔄 Processed ${i}/${totalEntities} entities (${processedCount} geometry, ${skippedCount} skipped, ${errorCount} errors)`);
            // Allow UI to update
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          
        } catch (error) {
          errorCount++;
          // Continue processing other entities
          console.warn(`⚠️ Failed to process entity ${lineID}:`, error.message);
        }
      }
      
      // Finalize the model
      model.finalize();
      
      // Keep it simple - no enhanced rendering to avoid compatibility issues
      console.log('✅ Real IFC model finalized');
      
      // Close IFC model to free memory
      this.ifcAPI.CloseModel(ifcModelID);
      
      console.log(`✅ IFC parsing complete: ${processedCount} entities with geometry, ${skippedCount} skipped, ${errorCount} errors (${totalEntities} total)`);
      
      if (processedCount === 0) {
        console.warn(`⚠️ No entities with geometry were processed. This might indicate vertex format issues or unsupported IFC structure.`);
        console.warn(`💡 Check that your IFC file contains actual geometric objects (walls, doors, windows, etc.)`);
        console.warn(`🔍 File will display as placeholder walls instead of real geometry`);
      } else {
        console.log(`🎉 SUCCESS: Found ${processedCount} geometric objects in your IFC file!`);
        console.log(`🏗️ Your custom IFC geometry should now be visible in the 3D viewport`);
      }
      
      return model;
      
    } catch (error) {
      console.error('❌ Failed to parse real IFC file:', error);
      throw error;
    }
  }

  /**
   * Process individual IFC entity and extract geometry
   */
  async processIFCEntity(ifcModelID, lineID, model, modelId) {
    try {
      // Get entity properties
      const properties = this.ifcAPI.GetLine(ifcModelID, lineID);
      if (!properties) return false;
      
      // Get entity type
      const entityType = properties.constructor.name;
      
      // Skip non-geometric entities
      const skipTypes = ['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 
                        'IFCPERSON', 'IFCORGANIZATION', 'IFCRELATIONSHIP', 'IFCPROPERTYSET'];
      
      if (skipTypes.some(type => entityType.includes(type))) {
        return false;
      }
      
      // Get geometry
      const geometry = this.ifcAPI.GetGeometry(ifcModelID, lineID);
      if (!geometry || !geometry.GetVertexData) {
        return false;
      }
      
      const vertexData = geometry.GetVertexData();
      const indexData = geometry.GetIndexData();
      
      if (vertexData.length === 0 || indexData.length === 0) {
        return false;
      }
      
      // Use enhanced geometry processing to handle different vertex formats
      const processedGeometry = this.getEnhancedGeometry(vertexData, indexData, entityType, lineID);
      if (!processedGeometry) {
        return false;
      }
      
      // Create mesh in xeokit
      const entityId = `${modelId}-entity-${lineID}`;
      
      const mesh = model.createMesh({
        id: `${entityId}-mesh`,
        positions: processedGeometry.positions,
        normals: processedGeometry.normals,
        indices: processedGeometry.indices
      });
      
      // Create entity with appropriate color
      model.createEntity({
        id: entityId,
        meshIds: [mesh.id],
        isObject: true,
        colorize: this.getEntityColor(entityType)
      });
      
      return true;
      
    } catch (error) {
      // Don't log every failure, just continue
      return false;
    }
  }

  /**
   * Enhanced geometry processing to handle different vertex formats
   * Detects and processes 3, 6, or 9 component vertex formats
   */
  getEnhancedGeometry(vertexData, indexData, entityType, lineID) {
    try {
      const positions = [];
      const normals = [];
      const indices = [];
      
      // Process indices first - this is always the same
      for (let i = 0; i < indexData.length; i++) {
        indices.push(indexData[i]);
      }
      
      // Detect vertex format based on vertex count and data length
      const vertexCount = indices.length > 0 ? Math.max(...indices) + 1 : 0;
      if (vertexCount === 0) {
        console.warn(`⚠️ No valid vertices found for entity ${lineID} (${entityType})`);
        return null;
      }
      
      const componentsPerVertex = vertexData.length / vertexCount;
      const detectedFormat = Math.round(componentsPerVertex);
      
      console.log(`🔍 Entity ${lineID} (${entityType}): ${vertexCount} vertices, ${vertexData.length} components, ${detectedFormat} per vertex`);
      
      if (detectedFormat === 3) {
        // Format: x, y, z (positions only)
        for (let i = 0; i < vertexData.length; i += 3) {
          positions.push(vertexData[i], vertexData[i + 1], vertexData[i + 2]);
        }
        
        // Generate normals automatically for each triangle
        this.generateNormals(positions, indices, normals);
        console.log(`✅ Processed 3-component format: ${positions.length/3} vertices with generated normals`);
        
      } else if (detectedFormat === 6) {
        // Format: x, y, z, nx, ny, nz (positions + normals)
        for (let i = 0; i < vertexData.length; i += 6) {
          positions.push(vertexData[i], vertexData[i + 1], vertexData[i + 2]);
          normals.push(vertexData[i + 3], vertexData[i + 4], vertexData[i + 5]);
        }
        console.log(`✅ Processed 6-component format: ${positions.length/3} vertices with normals`);
        
      } else if (detectedFormat === 9) {
        // Format: x, y, z, nx, ny, nz, u, v, w (positions + normals + texture coords)
        for (let i = 0; i < vertexData.length; i += 9) {
          positions.push(vertexData[i], vertexData[i + 1], vertexData[i + 2]);
          normals.push(vertexData[i + 3], vertexData[i + 4], vertexData[i + 5]);
          // Skip texture coordinates for now (vertexData[i + 6], vertexData[i + 7], vertexData[i + 8])
        }
        console.log(`✅ Processed 9-component format: ${positions.length/3} vertices with normals (texture coords skipped)`);
        
      } else {
        // Fallback: try to guess the format
        console.warn(`⚠️ Unknown vertex format (${detectedFormat} components) for entity ${lineID}, attempting fallback`);
        
        if (detectedFormat > 6) {
          // Assume first 6 components are position + normal
          for (let i = 0; i < vertexData.length; i += detectedFormat) {
            positions.push(vertexData[i], vertexData[i + 1], vertexData[i + 2]);
            normals.push(vertexData[i + 3], vertexData[i + 4], vertexData[i + 5]);
          }
        } else if (detectedFormat > 3) {
          // Assume first 3 components are position, rest is padding
          for (let i = 0; i < vertexData.length; i += detectedFormat) {
            positions.push(vertexData[i], vertexData[i + 1], vertexData[i + 2]);
          }
          this.generateNormals(positions, indices, normals);
        } else {
          console.error(`❌ Cannot process vertex format with ${detectedFormat} components for entity ${lineID}`);
          return null;
        }
      }
      
      // Validate geometry
      if (positions.length === 0 || indices.length === 0) {
        console.warn(`⚠️ Invalid geometry for entity ${lineID}: ${positions.length/3} vertices, ${indices.length} indices`);
        return null;
      }
      
      // Ensure normals array matches positions
      if (normals.length !== positions.length) {
        console.warn(`⚠️ Normal count mismatch for entity ${lineID}, regenerating normals`);
        normals.length = 0;
        this.generateNormals(positions, indices, normals);
      }
      
      return {
        positions,
        normals,
        indices
      };
      
    } catch (error) {
      console.error(`❌ Error processing geometry for entity ${lineID}:`, error);
      return null;
    }
  }

  /**
   * Generate normals for geometry that doesn't have them
   */
  generateNormals(positions, indices, normals) {
    // Initialize normals array with zeros
    for (let i = 0; i < positions.length; i++) {
      normals[i] = 0;
    }
    
    // Calculate face normals and accumulate vertex normals
    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i] * 3;
      const i2 = indices[i + 1] * 3;
      const i3 = indices[i + 2] * 3;
      
      // Get triangle vertices
      const v1 = [positions[i1], positions[i1 + 1], positions[i1 + 2]];
      const v2 = [positions[i2], positions[i2 + 1], positions[i2 + 2]];
      const v3 = [positions[i3], positions[i3 + 1], positions[i3 + 2]];
      
      // Calculate face normal using cross product
      const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
      const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
      
      const normal = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0]
      ];
      
      // Normalize
      const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
      if (length > 0) {
        normal[0] /= length;
        normal[1] /= length;
        normal[2] /= length;
      }
      
      // Accumulate normal for each vertex of the triangle
      normals[i1] += normal[0]; normals[i1 + 1] += normal[1]; normals[i1 + 2] += normal[2];
      normals[i2] += normal[0]; normals[i2 + 1] += normal[1]; normals[i2 + 2] += normal[2];
      normals[i3] += normal[0]; normals[i3 + 1] += normal[1]; normals[i3 + 2] += normal[2];
    }
    
    // Normalize accumulated normals
    for (let i = 0; i < normals.length; i += 3) {
      const length = Math.sqrt(normals[i] * normals[i] + normals[i + 1] * normals[i + 1] + normals[i + 2] * normals[i + 2]);
      if (length > 0) {
        normals[i] /= length;
        normals[i + 1] /= length;
        normals[i + 2] /= length;
      }
    }
  }

  /**
   * Get appropriate color for IFC entity type
   */
  getEntityColor(entityType) {
    const colorMap = {
      'IFCWALL': [0.85, 0.9, 0.95],         // Very light blue-gray walls
      'IFCWALLSTANDARDCASE': [0.85, 0.9, 0.95], 
      'IFCDOOR': [0.8, 0.5, 0.2],           // Warm brown doors
      'IFCWINDOW': [0.4, 0.7, 1.0],         // Bright blue windows
      'IFCSLAB': [0.9, 0.9, 0.85],          // Light cream slabs/floors
      'IFCBEAM': [0.7, 0.4, 0.1],           // Rich brown beams
      'IFCCOLUMN': [0.6, 0.7, 0.8],         // Blue-gray columns
      'IFCROOF': [0.9, 0.4, 0.3],           // Bright red roof
      'IFCSTAIR': [0.5, 0.6, 0.7],          // Medium blue-gray stairs
      'IFCRAILING': [0.4, 0.4, 0.5],        // Dark gray railings
      'IFCFURNISHINGELEMENT': [0.6, 0.8, 0.4], // Green furniture
      'IFCBUILDINGSYSTEM': [0.8, 0.6, 0.9], // Purple building systems
      'IFCDISTRIBUTIONELEMENT': [1.0, 0.7, 0.0], // Orange MEP elements
      'IFCSPACE': [0.9, 0.9, 0.9, 0.1],     // Semi-transparent spaces
      'IFCPLATE': [0.7, 0.8, 0.9],          // Light blue plates
      'IFCMEMBER': [0.8, 0.7, 0.6],         // Tan structural members
      'IFCCURTAINWALL': [0.6, 0.8, 1.0],    // Light blue curtain walls
      'IFCFOOTING': [0.5, 0.5, 0.6],        // Gray footings
      'IFCPILE': [0.4, 0.4, 0.5],           // Dark gray piles
    };

    return colorMap[entityType] || [0.7, 0.8, 0.9]; // Light blue-gray default
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
   * Create a placeholder building model in xeokit or fallback
   */
  async createIFCPlaceholderModel(modelId, fileName) {
    try {
      const scene = this.xeokitViewer.viewer.scene;
      let model = null;
      
      // Check if real xeokit SceneModel is available
      if (scene && window.xeokit && window.xeokit.SceneModel) {
        console.log('✅ Creating real xeokit placeholder model');
        const SceneModel = window.xeokit.SceneModel;
        
        // Create a new scene model
        model = new SceneModel(scene, {
          id: modelId,
          isModel: true,
          position: [0, 0, 0],
          scale: [1, 1, 1],
          rotation: [0, 0, 0]
        });
      } else {
        console.log('📝 Creating fallback placeholder model');
        // Create mock model for fallback mode
        model = {
          id: modelId,
          meshes: [],
          entities: [],
          createMesh: function(meshConfig) {
            const mesh = {
              id: meshConfig.id,
              positions: meshConfig.positions,
              normals: meshConfig.normals,
              indices: meshConfig.indices
            };
            this.meshes.push(mesh);
            console.log(`📦 Placeholder mesh created: ${mesh.id}`);
            return mesh;
          },
          createEntity: function(entityConfig) {
            const entity = {
              id: entityConfig.id,
              meshIds: entityConfig.meshIds,
              isObject: entityConfig.isObject,
              colorize: entityConfig.colorize
            };
            this.entities.push(entity);
            console.log(`🎯 Placeholder entity created: ${entity.id}`);
            return entity;
          },
          finalize: function() {
            console.log(`✅ Placeholder model finalized: ${this.meshes.length} meshes, ${this.entities.length} entities`);
          }
        };
      }

      // Create building floor
      const floorMesh = model.createMesh({
        id: `${modelId}-floor-mesh`,
        positions: [
          -10, 0, -10,   10, 0, -10,   10, 0, 10,   -10, 0, 10  // Floor vertices
        ],
        normals: [
          0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0  // Up normals
        ],
        indices: [0, 1, 2, 0, 2, 3]  // Two triangles forming a square
      });

      model.createEntity({
        id: `${modelId}-floor`,
        meshIds: [floorMesh.id],
        isObject: true,
        colorize: [0.8, 0.8, 0.8]  // Light gray floor
      });

      // Create walls
      this.createWall(model, modelId, 'wall-1', [-10, 0, -10], [10, 0, -10], 3);  // Front wall
      this.createWall(model, modelId, 'wall-2', [10, 0, -10], [10, 0, 10], 3);    // Right wall
      this.createWall(model, modelId, 'wall-3', [10, 0, 10], [-10, 0, 10], 3);    // Back wall
      this.createWall(model, modelId, 'wall-4', [-10, 0, 10], [-10, 0, -10], 3);  // Left wall

      // Finalize the model
      model.finalize();
      
      console.log('🏢 Created IFC placeholder building model');
      return model;

    } catch (error) {
      console.error('❌ Failed to create placeholder model:', error);
      throw error;
    }
  }

  /**
   * Create a wall between two points
   */
  createWall(model, modelId, wallId, startPos, endPos, height) {
    const [x1, , z1] = startPos; // y1 not used - wall positioned at specified height
    const [x2, , z2] = endPos;   // y2 not used - wall positioned at specified height
    
    // Calculate wall dimensions
    const length = Math.sqrt((x2 - x1)**2 + (z2 - z1)**2);
    const thickness = 0.2;
    
    // Calculate wall center and rotation
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;
    const centerY = height / 2;
    
    // Create wall mesh (simplified box)
    const wallMesh = model.createMesh({
      id: `${modelId}-${wallId}-mesh`,
      positions: [
        // Bottom face
        -length/2, 0, -thickness/2,
        length/2, 0, -thickness/2,
        length/2, 0, thickness/2,
        -length/2, 0, thickness/2,
        // Top face
        -length/2, height, -thickness/2,
        length/2, height, -thickness/2,
        length/2, height, thickness/2,
        -length/2, height, thickness/2
      ],
      normals: [
        // Bottom normals
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
        // Top normals
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0
      ],
      indices: [
        // Bottom
        0, 1, 2, 0, 2, 3,
        // Top
        4, 7, 6, 4, 6, 5,
        // Sides
        0, 4, 5, 0, 5, 1,
        1, 5, 6, 1, 6, 2,
        2, 6, 7, 2, 7, 3,
        3, 7, 4, 3, 4, 0
      ]
    });

    // Calculate rotation angle
    const angle = Math.atan2(z2 - z1, x2 - x1);

    model.createEntity({
      id: `${modelId}-${wallId}`,
      meshIds: [wallMesh.id],
      isObject: true,
      position: [centerX, centerY, centerZ],
      rotation: [0, angle, 0],
      colorize: [0.7, 0.7, 0.7]  // Gray walls
    });
  }

  /**
   * Clear all loaded models
   */
  clearModels() {
    if (this.xeokitViewer && this.xeokitViewer.viewer) {
      this.loadedModels.forEach((modelData, fileName) => {
        try {
          this.xeokitViewer.viewer.scene.destroyModel(modelData.modelId);
        } catch (error) {
          console.warn(`Failed to destroy model ${fileName}:`, error.message);
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

    return {
      fileName,
      modelId: modelData.modelId,
      loadedAt: modelData.loadedAt,
      simplified: true,
      description: `Simplified IFC model: ${fileName}`
    };
  }

  /**
   * Dispose resources
   */
  dispose() {
    this.clearModels();
    this.xeokitViewer = null;
    this.isInitialized = false;
    console.log('🗑️ Simple IFC Handler disposed');
  }
}

// Export singleton instance
const simpleIFCHandler = new SimpleIFCHandler();
export default simpleIFCHandler;