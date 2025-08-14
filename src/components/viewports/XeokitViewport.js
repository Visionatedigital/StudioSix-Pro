/**
 * Xeokit Viewport Component - CDN Integration with Scene Loading
 *
 * Professional BIM viewer component using xeokit SDK via CDN
 * Supports IFC/XKT model loading and empty scene initialization
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import ifcService from '../../services/IFCService';
import cadToXeokitConverter from '../../services/CADToXeokitConverter';
// OLD: import simpleIFCHandler from '../../services/SimpleIFCHandler'; // DISABLED - using DirectGLTFLoader instead

/**
 * XeokitViewport Component - CDN-based implementation with Scene Loading
 *
 * @param {Object} props - Component props
 * @param {string} props.className - CSS class name
 * @param {Object} props.style - Inline styles
 * @param {string} props.theme - Theme ('light' or 'dark')
 * @param {boolean} props.enable2D - Enable 2D mode
 * @param {boolean} props.enable3D - Enable 3D mode (default)
 * @param {Array} props.cadObjects - CAD objects from StandaloneCADEngine to display in 3D
 * @param {Function} props.onViewerReady - Callback when viewer is initialized
 * @param {Function} props.onModelLoaded - Callback when model is loaded
 * @param {Function} props.onObjectClick - Callback when object is clicked
 * @param {Function} props.onObjectHover - Callback when object is hovered
 * @param {Function} props.onThemeChange - Callback when theme toggle is clicked
 * @param {Object} props.config - Additional xeokit configuration
 * @param {Object} props.sceneConfig - Scene loading configuration
 * @param {string} props.sceneConfig.mode - 'model' | 'empty' | 'sample' | 'hybrid'
 * @param {string} props.sceneConfig.modelUrl - URL to XKT model file
 * @param {string} props.sceneConfig.metaModelUrl - URL to metadata JSON
 * @param {Object} props.sceneConfig.sampleModel - Sample model configuration
 */
const XeokitViewport = ({
  className = "",
  style = {},
  theme = "dark",
  selectedTool = "pointer",
  enable2D = true,
  enable3D = true,
  cadObjects = [], // CAD objects from StandaloneCADEngine
  onViewerReady,
  onModelLoaded,
  onObjectClick,
  onObjectHover,
  onThemeChange,
  config = {},
  sceneConfig = { mode: 'sample' } // Default to sample scene
}) => {
  // Refs for DOM elements and xeokit instances - MUST be called before any conditional returns
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const xktLoaderRef = useRef(null);
  const scriptsLoadedRef = useRef(false);
  
  // Stable refs to prevent re-rendering loops
  const onViewerReadyRef = useRef(onViewerReady);
  const configRef = useRef(config);
  
  // Update refs when props change
  onViewerReadyRef.current = onViewerReady;
  configRef.current = config;

  // Component state - MUST be called before any conditional returns
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [viewMode, setViewMode] = useState('3D');
  const [loadedModel, setLoadedModel] = useState(null);
  const [error, setError] = useState(null);
  
  // Lighting control state
  const [lightingPanelOpen, setLightingPanelOpen] = useState(false);
  const [lightingSettings, setLightingSettings] = useState({
    sunIntensity: theme === 'dark' ? 0.4 : 0.9, // More balanced defaults
    skyIntensity: theme === 'dark' ? 0.15 : 0.5,
    ambientIntensity: 1.0,
    shadowIntensity: 1.0,
    timeOfDay: theme === 'dark' ? 'night' : 'day'
  });

  // CAD objects integration state
  const [cadModel, setCadModel] = useState(null); // SceneModel for CAD objects
  const [loadedCADObjects, setLoadedCADObjects] = useState(new Map()); // cadObjectId -> xeokitData

  // Check if we're in IFC test mode AFTER hooks are declared
  const urlParams = new URLSearchParams(window.location.search);
  const isIFCTestMode = urlParams.get('test') === 'ifc';

  /**
   * Load an XKT model into the viewer
   */
  const loadModel = useCallback(async (modelConfig) => {
    if (!viewerRef.current || !xktLoaderRef.current) {
      console.error('Viewer or XKT loader not initialized');
      return null;
    }

    try {
      console.log('🔄 Loading model:', modelConfig);
      setIsLoading(true);
      setError(null);

      const model = xktLoaderRef.current.load({
        id: modelConfig.id || 'loadedModel',
        src: modelConfig.src,
        metaModelSrc: modelConfig.metaModelSrc,
        edges: true,
        position: modelConfig.position || [0, 0, 0],
        scale: modelConfig.scale || [1, 1, 1],
        rotation: modelConfig.rotation || [0, 0, 0]
      });

      // Handle model loaded event
      model.on('loaded', () => {
        setLoadedModel(model);
        setIsLoading(false);
        
        // Fit camera to model
        viewerRef.current.cameraFlight.flyTo(model);
        
        // Notify parent component
        if (onModelLoaded) {
          onModelLoaded(model, modelConfig.id);
        }
      });

      // Handle model error
      model.on('error', (error) => {
        setError(`Failed to load model: ${error.message}`);
        setIsLoading(false);
      });

      return model;
    } catch (error) {
      console.error('❌ Model loading failed:', error);
      setError(`Model loading failed: ${error.message}`);
      setIsLoading(false);
      return null;
    }
  }, [onModelLoaded]);

  /**
   * Create a basic sample scene with a simple cube
   */
  const createSampleScene = async () => {
    if (!viewerRef.current) return;

    try {
      const scene = viewerRef.current.scene;
      
      // Clear existing models (correct way)
      Object.keys(scene.models).forEach(modelId => {
        scene.destroyModel(modelId);
      });

      // Import SceneModel from xeokit
      const xeokit = await loadXeokitFromCDN();
      if (!xeokit || !xeokit.SceneModel) {
        throw new Error('Failed to load SceneModel from xeokit');
      }
      const { SceneModel } = xeokit;

      // Create a new scene model with unique ID (correct API)
      const uniqueId = `sampleModel_${Date.now()}`;
      const sceneModel = new SceneModel(scene, {
        id: uniqueId,
        isObject: true
      });

      // Create a simple cube geometry using the correct API
      const cubeId = `sampleCube_${Date.now()}`;
      sceneModel.createMesh({
        id: cubeId,
        primitive: 'triangles',
        positions: [
          // Front face
          -1, -1,  1,  1, -1,  1,  1,  1,  1, -1,  1,  1,
          // Back face
          -1, -1, -1, -1,  1, -1,  1,  1, -1,  1, -1, -1,
          // Top face
          -1,  1, -1, -1,  1,  1,  1,  1,  1,  1,  1, -1,
          // Bottom face
          -1, -1, -1,  1, -1, -1,  1, -1,  1, -1, -1,  1,
          // Right face
           1, -1, -1,  1,  1, -1,  1,  1,  1,  1, -1,  1,
          // Left face
          -1, -1, -1, -1, -1,  1, -1,  1,  1, -1,  1, -1
        ],
        normals: [
          // Front face
          0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
          // Back face
          0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
          // Top face
          0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
          // Bottom face
          0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
          // Right face
          1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
          // Left face
          -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0
        ],
        indices: [
          0,  1,  2,    0,  2,  3,    // front
          4,  5,  6,    4,  6,  7,    // back
          8,  9,  10,   8,  10, 11,   // top
          12, 13, 14,   12, 14, 15,   // bottom
          16, 17, 18,   16, 18, 19,   // right
          20, 21, 22,   20, 22, 23    // left
        ],
        // Enhanced material properties for better shading
        material: {
          diffuse: [0.7, 0.7, 0.9],          // Light blue-gray base color
          specular: [0.4, 0.4, 0.4],         // Moderate specular reflection
          glossiness: 0.6,                   // Somewhat glossy surface
          specularF0: 0.04,                  // Standard dielectric reflectance
          emissive: [0.0, 0.0, 0.0],         // No emissive light
          alpha: 1.0,                        // Fully opaque
          alphaMode: "opaque"                // Alpha blending mode
        }
      });

      // Create entity using the mesh
      sceneModel.createEntity({
        id: `sampleCubeEntity_${Date.now()}`,
        meshIds: [cubeId],
        isObject: true,
        position: [0, 0, 0],
        scale: [2, 2, 2],
        rotation: [0, 0, 0],
        colorize: theme === 'dark' ? [0.3, 0.7, 1.0] : [0.2, 0.5, 0.8]
      });

      // Finalize the model
      sceneModel.finalize();

      // Basic scene setup - keep it simple to avoid loading issues
      try {
        // Set a simple background color
        if (scene.canvas && scene.canvas.backgroundColor !== undefined) {
          scene.canvas.backgroundColor = theme === 'dark' ? [0.1, 0.1, 0.15] : [0.95, 0.95, 0.97];
        }
      } catch (lightingError) {
        console.warn('⚠️ Skipping advanced scene setup:', lightingError.message);
      }

      // Position camera to view the cube
      viewerRef.current.camera.eye = [5, 5, 5];
      viewerRef.current.camera.look = [0, 0, 0];
      viewerRef.current.camera.up = [0, 1, 0];

      console.log('✅ Sample scene created successfully');
      setIsLoading(false);
      
      // Debug the sample scene model
      setTimeout(() => debugModelMaterials(sceneModel), 100);
      
      // Notify parent component
      if (onModelLoaded) {
        onModelLoaded({ type: 'sampleScene', model: sceneModel }, 'sampleScene');
      }

    } catch (error) {
      console.error('❌ Failed to create sample scene:', error);
      setError(`Failed to create sample scene: ${error.message}`);
      setIsLoading(false);
    }
  };

  /**
   * Setup environment mapping for realistic reflections
   */
  const setupEnvironmentMapping = useCallback(async (viewer) => {
    try {
      console.log('🌍 Setting up environment mapping...');
      
      // Create a simple procedural sky environment
      const scene = viewer.scene;
      
      // Set up basic environment lighting if available
      if (scene.envMap !== undefined) {
        // For now, use a simple sky gradient simulation
        // In a full implementation, you would load actual HDR environment maps
        const skyColor = theme === 'dark' 
          ? [0.05, 0.1, 0.2]  // Dark night sky
          : [0.4, 0.6, 1.0];   // Bright day sky
          
        scene.envMap = {
          skyColor: skyColor,
          horizonColor: theme === 'dark' ? [0.1, 0.15, 0.3] : [0.8, 0.9, 1.0],
          groundColor: theme === 'dark' ? [0.02, 0.02, 0.05] : [0.3, 0.25, 0.2]
        };
        
        console.log('🌅 Environment mapping configured');
      }
      
      // Enable environment reflections on materials if available
      if (scene.environmentEnabled !== undefined) {
        scene.environmentEnabled = true;
        scene.environmentIntensity = theme === 'dark' ? 0.3 : 0.7;
      }
      
    } catch (error) {
      console.warn('⚠️ Environment mapping setup failed:', error);
    }
  }, [theme]);

  /**
   * Update lighting based on time of day or user preferences
   */
  const updateLighting = useCallback((config = {}) => {
    if (!viewerRef.current) return;
    
    const viewer = viewerRef.current;
    const {
      timeOfDay = 'day',
      sunIntensity,
      skyIntensity,
      shadowIntensity,
      ambientIntensity
    } = config;
    
    try {
      console.log('🌞 Updating lighting configuration...', config);
      
      const isDark = timeOfDay === 'night' || theme === 'dark';
      
      // Update ambient light
      if (ambientIntensity !== undefined) {
        const baseAmbient = isDark ? [0.15, 0.18, 0.25] : [0.35, 0.42, 0.50];
        viewer.scene.ambientLight = baseAmbient.map(c => c * ambientIntensity);
      }
      
      // Update directional lights
      const dirLights = viewer.scene.dirLights;
      if (dirLights && dirLights.length > 0) {
        // Sun light
        if (sunIntensity !== undefined && dirLights[0]) {
          dirLights[0].intensity = sunIntensity;
        }
        
        // Sky light
        if (skyIntensity !== undefined && dirLights[1]) {
          dirLights[1].intensity = skyIntensity;
        }
      }
      
      // Update shadow intensity if available
      if (shadowIntensity !== undefined && viewer.scene.shadowMap) {
        viewer.scene.shadowMap.intensity = shadowIntensity;
      }
      
      // Update stored configuration
      if (viewer.lightingConfig) {
        viewer.lightingConfig = { ...viewer.lightingConfig, ...config };
      }
      
      console.log('✅ Lighting updated successfully');
    } catch (error) {
      console.warn('⚠️ Failed to update lighting:', error);
    }
  }, [theme]);

  /**
   * Debug loaded model materials and geometry
   */
  const debugModelMaterials = useCallback((sceneModel) => {
    try {
      console.log('🔍 Starting model debug analysis...');
      
      if (!sceneModel) {
        console.warn('❌ No sceneModel provided for debugging');
        return;
      }

      // Check what type of object we received
      console.log('🔍 SceneModel type and structure:', {
        type: typeof sceneModel,
        constructor: sceneModel.constructor?.name,
        isSceneModel: sceneModel.constructor?.name === 'SceneModel',
        hasId: 'id' in sceneModel,
        hasEntities: 'entities' in sceneModel,
        hasMeshes: 'meshes' in sceneModel,
        hasMaterials: 'materials' in sceneModel,
        keys: Object.keys(sceneModel)
      });

      // Basic model info with null checks
      const modelInfo = {
        modelId: sceneModel.id || 'unknown',
        numEntities: sceneModel.entities ? Object.keys(sceneModel.entities || {}).length : 0,
        numMeshes: sceneModel.meshes ? Object.keys(sceneModel.meshes || {}).length : 0,
        numMaterials: sceneModel.materials ? Object.keys(sceneModel.materials || {}).length : 0
      };
      
      console.log('🔍 Model Debug Info:', modelInfo);

      // Check for different result structures
      if (sceneModel.model && sceneModel.model !== sceneModel) {
        console.log('🔄 Found nested model, analyzing that instead...');
        return debugModelMaterials(sceneModel.model);
      }

      // Log material information with safety checks
      console.log('🔍 Checking materials structure:', {
        hasMaterials: 'materials' in sceneModel,
        materialsType: typeof sceneModel.materials,
        materialsKeys: sceneModel.materials ? Object.keys(sceneModel.materials) : null,
        materialsLength: sceneModel.materials ? Object.keys(sceneModel.materials).length : 0
      });
      
      if (sceneModel.materials && typeof sceneModel.materials === 'object') {
        const materialEntries = Object.entries(sceneModel.materials);
        console.log(`📦 Found ${materialEntries.length} materials:`);
        
        materialEntries.forEach(([matId, material]) => {
          if (material && typeof material === 'object') {
            console.log(`📦 Material ${matId}:`, {
              type: material.type || 'unknown',
              diffuse: material.diffuse || null,
              specular: material.specular || null,
              metallic: material.metallic || null,
              roughness: material.roughness || null,
              emissive: material.emissive || null,
              opacity: material.alpha || material.opacity || null,
              hasTextures: !!(material.diffuseMap || material.normalMap || material.specularMap)
            });
          }
        });
      } else {
        console.log('📦 No materials found or materials not an object - checking mesh-level materials...');
        
        // Check if materials are applied at mesh level instead
        if (sceneModel.meshes && typeof sceneModel.meshes === 'object') {
          const meshEntries = Object.entries(sceneModel.meshes);
          let meshMaterialCount = 0;
          meshEntries.forEach(([meshId, mesh]) => {
            if (mesh && (mesh.color || mesh.metallic || mesh.roughness)) {
              meshMaterialCount++;
              console.log(`📦 Mesh-level material on ${meshId}:`, {
                color: mesh.color,
                opacity: mesh.opacity,
                metallic: mesh.metallic,
                roughness: mesh.roughness
              });
            }
          });
          console.log(`📦 Found ${meshMaterialCount} meshes with material properties`);
        }
      }

      // Log entity information with safety checks  
      console.log('🔍 Checking entities structure:', {
        hasEntities: 'entities' in sceneModel,
        entitiesType: typeof sceneModel.entities,
        entitiesKeys: sceneModel.entities ? Object.keys(sceneModel.entities) : null,
        entitiesLength: sceneModel.entities ? Object.keys(sceneModel.entities).length : 0
      });
      
      if (sceneModel.entities && typeof sceneModel.entities === 'object') {
        const entities = Object.values(sceneModel.entities);
        if (entities.length > 0) {
          console.log(`🏗️ Sample entities (${Math.min(5, entities.length)} of ${entities.length}):`, 
            entities.slice(0, 5).map(e => ({
              id: e?.id || 'no-id',
              type: e?.type || 'unknown',
              visible: e?.visible ?? 'unknown',
              materialId: e?.material?.id || 'no-material',
              hasGeometry: !!(e?.geometry || e?.mesh),
              meshIds: e?.meshIds || []
            }))
          );
        } else {
          console.log('🏗️ Entities object exists but is empty');
        }
      } else {
        console.log('🏗️ No entities found or entities not an object');
      }

      // Check for xeokit viewer scene directly
      if (viewerRef.current?.scene) {
        const scene = viewerRef.current.scene;
        console.log('🌍 Xeokit Scene Info:', {
          numModels: Object.keys(scene.models || {}).length,
          numObjects: Object.keys(scene.objects || {}).length,
          numMaterials: Object.keys(scene.materials || {}).length,
          modelIds: Object.keys(scene.models || {})
        });
      }
      
    } catch (error) {
      console.error('❌ Error debugging model materials:', error);
      console.error('Stack trace:', error.stack);
    }
  }, []);

  /**
   * Handle lighting settings change
   */
  const handleLightingChange = useCallback((newSettings) => {
    setLightingSettings(prevSettings => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      updateLighting(updatedSettings);
      return updatedSettings;
    });
  }, [updateLighting]);

  /**
   * Create or get the CAD objects SceneModel
   */
  const getCADModel = useCallback(() => {
    if (cadModel) {
      return cadModel;
    }

    if (!viewerRef.current || !window.xeokit?.SceneModel) {
      console.warn('Viewer or SceneModel not ready for CAD model creation');
      return null;
    }

    const { SceneModel } = window.xeokit;
    const sceneModel = new SceneModel(viewerRef.current.scene, {
      id: 'cad_objects_model',
      isObject: true
    });

    console.log('🏗️ Created CAD objects SceneModel');
    setCadModel(sceneModel);
    return sceneModel;
  }, [cadModel]);

  /**
   * Load CAD objects into xeokit viewer
   */
  const loadCADObjects = useCallback((cadObjectsArray) => {
    if (!viewerRef.current || !window.xeokit?.SceneModel) {
      console.warn('Viewer or SceneModel not ready for CAD objects');
      return;
    }

    if (!cadObjectsArray || cadObjectsArray.length === 0) {
      console.log('📦 No CAD objects to load');
      return;
    }

    console.log(`🔄 Loading ${cadObjectsArray.length} CAD objects into xeokit...`);
    
    // 🎯 Debug: Show all CAD object IDs 
    const allCADIds = cadObjectsArray.map(obj => obj.id);
    console.log(`🎯 CAD Object IDs being processed:`, allCADIds);

    const sceneModel = getCADModel();
    if (!sceneModel) {
      console.error('Failed to get CAD SceneModel');
      return;
    }

    const newLoadedObjects = new Map();
    let successCount = 0;

    cadObjectsArray.forEach(cadObject => {
      try {
        console.log(`🎯 CONVERTING CAD OBJECT ${cadObject.id} - coordinate mapping logs should appear next!`);
        console.log(`🎯 Object position:`, cadObject.position);
        console.log(`🎯 Object params:`, cadObject.params);
        
        const result = cadToXeokitConverter.convertCADObject(cadObject, sceneModel);
        
        if (result) {
          newLoadedObjects.set(cadObject.id, result);
          successCount++;
          console.log(`✅ Loaded CAD object ${cadObject.id} (${cadObject.type})`);
        } else {
          console.warn(`⚠️ Failed to convert CAD object ${cadObject.id}`);
        }
      } catch (error) {
        console.error(`❌ Error loading CAD object ${cadObject.id}:`, error);
      }
    });

    // Finalize the scene model to apply changes
    sceneModel.finalize();

    // 🎯 POST-FINALIZATION COORDINATE VERIFICATION
    console.log(`🔍 Verifying final coordinates after scene finalization...`);
    cadObjectsArray.forEach(cadObject => {
      const entity = sceneModel.objects[`cad_entity_${cadObject.id}`];
      if (entity && entity.aabb && entity.aabb.length >= 6) {
        const aabbCenter = {
          x: (entity.aabb[0] + entity.aabb[3]) / 2,
          y: (entity.aabb[1] + entity.aabb[4]) / 2, 
          z: (entity.aabb[2] + entity.aabb[5]) / 2
        };
        
        const positionMatch = (
          Math.abs(aabbCenter.x - cadObject.position.x) < 0.1 && 
          Math.abs(aabbCenter.z - cadObject.position.z) < 0.1
        );
        
        if (positionMatch) {
          console.log(`✅ [${cadObject.id}] Final coordinate verification PASSED`);
          console.log(`   📍 Expected: [${cadObject.position.x.toFixed(3)}, ${cadObject.position.z.toFixed(3)}]`);
          console.log(`   📍 Actual: [${aabbCenter.x.toFixed(3)}, ${aabbCenter.z.toFixed(3)}]`);
        } else {
          console.warn(`⚠️ [${cadObject.id}] Final coordinate verification FAILED`);
          console.warn(`   📍 Expected: [${cadObject.position.x.toFixed(3)}, ${cadObject.position.z.toFixed(3)}]`);
          console.warn(`   📍 Actual: [${aabbCenter.x.toFixed(3)}, ${aabbCenter.z.toFixed(3)}]`);
        }
      } else {
        console.warn(`⚠️ [${cadObject.id}] No AABB available after finalization`);
      }
    });

    setLoadedCADObjects(newLoadedObjects);
    console.log(`🎉 Successfully loaded ${successCount}/${cadObjectsArray.length} CAD objects`);
    
    // Debug: Check what entities are actually in the scene
    console.log('🔍 Checking xeokit scene entities after loading...');
    const scene = viewerRef.current.scene;
    const entityCount = Object.keys(scene.objects).length;
    console.log(`📊 Total entities in scene: ${entityCount}`);
    
    // Log CAD entities specifically
    const cadEntities = Object.values(scene.objects).filter(obj => obj.id.startsWith('cad_entity_'));
    console.log(`🧱 CAD entities in scene: ${cadEntities.length}`);
    cadEntities.forEach(entity => {
      console.log(`📍 Entity ${entity.id}:`, {
        visible: entity.visible,
        position: entity.position || 'not set',
        aabb: entity.aabb ? `[${entity.aabb.join(', ')}]` : 'not available',
        numMeshes: entity.meshIds ? entity.meshIds.length : 0,
        opacity: entity.opacity || 'default'
      });
      
      // Check mesh details with safe property access
      if (entity.meshIds && entity.meshIds.length > 0) {
        entity.meshIds.forEach(meshId => {
          let mesh = null;
          try {
            // Try multiple ways to access mesh data
            if (scene.meshes && scene.meshes[meshId]) {
              mesh = scene.meshes[meshId];
            } else if (scene.getMesh && typeof scene.getMesh === 'function') {
              mesh = scene.getMesh(meshId);
            } else if (entity.meshes && entity.meshes.length > 0) {
              // Sometimes meshes are stored directly on the entity
              mesh = entity.meshes.find(m => m.id === meshId);
            }
          } catch (error) {
            console.log(`  ⚠️ Could not access mesh ${meshId}:`, error.message);
          }
          
          if (mesh) {
            console.log(`  🔗 Mesh ${meshId}:`, {
              primitive: mesh.primitive || 'unknown',
              numVertices: mesh.positions ? mesh.positions.length / 3 : 'not available',
              color: mesh.color || 'not set',
              opacity: mesh.opacity || 'default'
            });
          } else {
            console.log(`  ⚠️ Mesh ${meshId}: not accessible via scene.meshes`);
          }
        });
      }
    });
    
    // Fit view to show all objects
    if (cadEntities.length > 0) {
      console.log('📷 Fitting camera to show all CAD objects...');
      viewerRef.current.cameraFlight.flyTo({
        aabb: scene.aabb,
        duration: 1.0
      });
    }

    // Trigger model loaded callback if provided
    if (onModelLoaded && successCount > 0) {
      onModelLoaded(sceneModel, 'cad_objects_model');
    }
  }, [getCADModel, onModelLoaded]);

  /**
   * Update CAD objects when they change
   */
  const updateCADObjects = useCallback((newCADObjects) => {
    if (!viewerRef.current || !window.xeokit?.SceneModel) {
      console.warn('Viewer not ready for CAD object updates');
      return;
    }

    console.log(`🔄 Updating CAD objects: ${newCADObjects.length} total`);

    const sceneModel = getCADModel();
    if (!sceneModel) {
      console.error('Failed to get CAD SceneModel for update');
      return;
    }

    // Get current loaded object IDs
    const currentObjectIds = new Set(loadedCADObjects.keys());
    const newObjectIds = new Set(newCADObjects.map(obj => obj.id));

    // Remove objects that no longer exist
    currentObjectIds.forEach(objectId => {
      if (!newObjectIds.has(objectId)) {
        console.log(`🗑️ Removing CAD object ${objectId}`);
        cadToXeokitConverter.removeCADObject(objectId, sceneModel);
      }
    });

    // Add or update objects
    const updatedLoadedObjects = new Map();
    
    newCADObjects.forEach(cadObject => {
      try {
        if (loadedCADObjects.has(cadObject.id)) {
          // Update existing object
          const existingData = loadedCADObjects.get(cadObject.id);
          console.log(`🔄 Updating CAD object ${cadObject.id}`);
          
          const result = cadToXeokitConverter.updateCADObject(
            cadObject, 
            sceneModel, 
            existingData.entityId
          );
          
          if (result) {
            updatedLoadedObjects.set(cadObject.id, result);
          }
        } else {
          // Add new object
          console.log(`➕ Adding new CAD object ${cadObject.id}`);
          const result = cadToXeokitConverter.convertCADObject(cadObject, sceneModel);
          
          if (result) {
            updatedLoadedObjects.set(cadObject.id, result);
          }
        }
      } catch (error) {
        console.error(`❌ Error updating CAD object ${cadObject.id}:`, error);
      }
    });

    // Finalize the scene model to apply changes
    sceneModel.finalize();

    setLoadedCADObjects(updatedLoadedObjects);
    console.log(`✅ CAD objects update complete: ${updatedLoadedObjects.size} objects loaded`);
  }, [getCADModel, loadedCADObjects]);

  /**
   * Initialize scene based on configuration
   */
  const initializeScene = useCallback(async () => {
    if (!viewerRef.current || !xktLoaderRef.current) {
      console.warn('Viewer not ready for scene initialization');
      return;
    }

    console.log('🎬 Initializing scene with config:', sceneConfig);

    switch (sceneConfig.mode) {
      case 'model':
        if (sceneConfig.modelUrl) {
          await loadModel({
            id: 'startupModel',
            src: sceneConfig.modelUrl,
            metaModelSrc: sceneConfig.metaModelUrl
          });
                 } else {
          console.warn('Model mode selected but no modelUrl provided');
          await createSampleScene();
        }
        break;
        
      case 'sample':
        // Load a sample model or create sample scene
        if (sceneConfig.sampleModel?.src) {
          await loadModel({
            id: 'sampleModel',
            ...sceneConfig.sampleModel
          });
        } else {
          await createSampleScene();
        }
       break;
        
      case 'empty':
      default:
        // Just set up an empty scene with good camera position
        viewerRef.current.camera.eye = [0, 0, 10];
        viewerRef.current.camera.look = [0, 0, 0];
        viewerRef.current.camera.up = [0, 1, 0];
        setIsLoading(false);
        console.log('✅ Empty scene initialized');
        break;
    }
     }, [sceneConfig, loadModel]);

  /**
   * DISABLED - IFC service initialization (using DirectGLTFLoader instead)
   */
  const initializeIFCService = useCallback(async (viewer) => {
    // OLD IFC handler disabled - using DirectGLTFLoader for 3D file loading
    console.log('🚫 Old IFC handler disabled - using DirectGLTFLoader instead');
    return true; // Always return success to prevent blocking
  }, []);

  /**
   * Load xeokit from CDN (optimized for speed and minimal logging)
   */
  const loadXeokitFromCDN = useCallback(() => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.xeokit) {
        resolve(window.xeokit);
        return;
      }

      // Extended timeout for multiple CDN attempts
      const timeout = setTimeout(() => {
        console.error('⏰ Xeokit CDN loading timeout');
        reject(new Error('Xeokit loading timeout - all CDN sources failed to respond'));
      }, 15000); // 15 seconds for multiple CDN attempts

      // Try multiple CDN sources for reliability
      const CDN_URLS = [
        'https://unpkg.com/@xeokit/xeokit-sdk@2.6.87/dist/xeokit-sdk.es.min.js',
        'https://cdn.jsdelivr.net/npm/@xeokit/xeokit-sdk@2.6.87/dist/xeokit-sdk.es.min.js',
        'https://cdn.skypack.dev/@xeokit/xeokit-sdk@2.6.87'
      ];

      const script = document.createElement('script');
      script.type = 'module';
      script.innerHTML = `
        (async () => {
          console.log('🔄 Loading Xeokit from CDN...');
          let lastError;
          
          for (const url of ${JSON.stringify(CDN_URLS)}) {
            try {
              console.log('🌐 Trying CDN:', url);
              const xeokit = await import(url);
              console.log('✅ Xeokit loaded successfully from:', url);
              window.xeokit = xeokit;
              window.dispatchEvent(new CustomEvent('xeokit-ready', { detail: xeokit }));
              return;
            } catch (error) {
              console.warn('❌ CDN failed:', url, error.message);
              lastError = error;
              continue;
            }
          }
          
          console.error('💥 All CDN sources failed');
          window.dispatchEvent(new CustomEvent('xeokit-failed', { detail: lastError }));
        })();
      `;

      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener('xeokit-ready', handleSuccess);
        window.removeEventListener('xeokit-failed', handleError);
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };

      const handleSuccess = (event) => {
        cleanup();
        scriptsLoadedRef.current = true;
        resolve(event.detail);
      };

      const handleError = (event) => {
        cleanup();
        const errorMsg = event.detail?.message || 'All CDN sources failed';
        console.error('🚨 Xeokit loading failed:', errorMsg);
        reject(new Error(`Failed to load Xeokit viewer: ${errorMsg}. Please check your internet connection and try again.`));
      };

      window.addEventListener('xeokit-ready', handleSuccess);
      window.addEventListener('xeokit-failed', handleError);
      script.onerror = () => handleError({ detail: new Error('Script load failed') });
      
      document.head.appendChild(script);
    });
  }, []);

  /**
   * Initialize xeokit viewer with performance optimizations
   */
  const initializeViewer = useCallback(async () => {
    // Check if we're in IFC test mode and skip initialization
    const urlParams = new URLSearchParams(window.location.search);
    const isIFCTestMode = urlParams.get('test') === 'ifc';
    
    if (isIFCTestMode) {
      console.log('🧪 Skipping xeokit viewer initialization (IFC test mode)');
      setIsLoading(false);
      return;
    }

    if (!canvasRef.current || viewerRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log('🚀 Loading xeokit with optimizations...');
      
      // Use Promise.all for parallel loading where possible
      const [xeokit] = await Promise.all([
        loadXeokitFromCDN(),
        // Pre-warm other resources
        new Promise(resolve => setTimeout(resolve, 0)) // Yield to browser
      ]);
      
      console.log('✅ Xeokit loaded successfully');

      const { Viewer, XKTLoaderPlugin } = xeokit;

      // Generate unique canvas ID
      const canvasId = `xeokit-canvas-${Date.now()}`;
      canvasRef.current.id = canvasId;

      // Optimized viewer configuration
      const viewerConfig = {
        canvasId: canvasId,
        transparent: true,
        backgroundColor: [0.8, 0.8, 0.8], // Light grey background
        // Performance optimizations
        colorTextureEnabled: true,
        // Memory optimizations
        maxGeometryBatchSize: 50000000, // 50MB batches
        // LOD optimizations
        lodEnabled: true,
        ...configRef.current // Use stable ref instead of prop
      };

      const viewer = new Viewer(viewerConfig);
      
      // Set advanced features after viewer creation with error handling
      try {
        if (viewer.configurations) {
          viewer.configurations.dtxEnabled = false; // Disable initially for faster startup
          viewer.configurations.pbrEnabled = true; // Enable PBR for better shading
        }
      } catch (error) {
        // Silent fail - configurations not critical
      }

      // Professional lighting setup with shadows and environment reflections
      try {
        console.log('🌅 Setting up professional lighting system...');
        
        // Enhanced ambient lighting with hemisphere simulation
        const isDark = theme === 'dark';
        viewer.scene.ambientLight = isDark 
          ? [0.25, 0.28, 0.35] // Brighter night ambient for better visibility
          : [0.45, 0.50, 0.55]; // Softer daylight ambient to prevent washout

        // Configure directional lights for realistic sun lighting
        const dirLights = viewer.scene.dirLights;
        if (dirLights && dirLights.length > 0) {
          // Primary sun light with realistic positioning
          const sunLight = dirLights[0];
          sunLight.dir = [-0.6, -0.8, -0.4]; // Late morning sun angle
          sunLight.color = isDark ? [0.4, 0.5, 0.8] : [1.0, 0.95, 0.85]; // Cool moonlight / warm sunlight
          sunLight.intensity = isDark ? 0.4 : 0.9; // Reduced intensity for better balance
          sunLight.space = "world";
          
          // Enable shadows on the main directional light
          if (sunLight.shadow !== undefined) {
            sunLight.shadow = true;
            console.log('☀️ Shadows enabled for sun light');
          }

          // Sky light (hemisphere lighting simulation)
          if (dirLights[1]) {
            const skyLight = dirLights[1];
            skyLight.dir = [0.0, 1.0, 0.0]; // From directly above
            skyLight.color = isDark ? [0.15, 0.2, 0.4] : [0.5, 0.7, 1.0]; // Sky blue
            skyLight.intensity = isDark ? 0.1 : 0.6;
            skyLight.space = "world";
          }

          // Fill light for shadow detail
          if (dirLights[2]) {
            const fillLight = dirLights[2];
            fillLight.dir = [0.3, -0.1, 0.8]; // From opposite side
            fillLight.color = isDark ? [0.2, 0.2, 0.3] : [0.8, 0.9, 1.0]; // Cool fill
            fillLight.intensity = isDark ? 0.05 : 0.25;
            fillLight.space = "world";
          }
        }

        // Enhanced Screen Space Ambient Occlusion for depth
        if (viewer.scene.sao) {
          viewer.scene.sao.enabled = true;
          viewer.scene.sao.intensity = isDark ? 0.25 : 0.20; // Stronger AO in dark mode
          viewer.scene.sao.bias = 0.4;
          viewer.scene.sao.scale = 1200.0;
          viewer.scene.sao.minResolution = 0.0;
          viewer.scene.sao.kernelRadius = 120;
          viewer.scene.sao.blendCutoff = 0.08;
          viewer.scene.sao.blendFactor = 1.2;
          console.log('🎯 Enhanced SAO enabled');
        }

        // Configure shadows globally
        if (viewer.scene.shadowMap) {
          viewer.scene.shadowMap.enabled = true;
          viewer.scene.shadowMap.size = [2048, 2048]; // High resolution shadows
          viewer.scene.shadowMap.bias = 0.0001;
          viewer.scene.shadowMap.normalBias = 0.001;
          viewer.scene.shadowMap.radius = 4;
          console.log('🌑 Shadow mapping enabled');
        }

        // Enhanced tone mapping and color grading
        if (viewer.scene.gammaOutput !== undefined) {
          viewer.scene.gammaOutput = true;
          viewer.scene.gammaFactor = 2.2;
        }
        
        if (viewer.scene.colorCorrectionEnabled !== undefined) {
          viewer.scene.colorCorrectionEnabled = true;
          viewer.scene.exposure = isDark ? 0.8 : 1.0;
          viewer.scene.contrast = 1.1;
          viewer.scene.saturation = 1.05;
        }

        // Store lighting configuration for later access
        viewer.lightingConfig = {
          theme: theme,
          sunIntensity: isDark ? 0.4 : 0.9, // More balanced values
          skyIntensity: isDark ? 0.15 : 0.5,
          fillIntensity: isDark ? 0.08 : 0.2,
          ambientLevel: isDark ? [0.25, 0.28, 0.35] : [0.45, 0.50, 0.55],
          shadowsEnabled: true,
          saoEnabled: true,
          timeOfDay: isDark ? 'night' : 'day'
        };

        console.log('✅ Professional lighting system initialized', viewer.lightingConfig);
      } catch (error) {
        console.warn('⚠️ Failed to configure professional lighting:', error);
      }

      // Optimized camera setup
      viewer.camera.eye = [-20, 15, 30];
      viewer.camera.look = [0, 0, 0];
      viewer.camera.up = [0, 1, 0];
      
      // Set reasonable clipping planes for better performance
      viewer.camera.perspective.near = 0.1;
      viewer.camera.perspective.far = 10000;

      // Add plugins with optimizations
      const xktLoader = new XKTLoaderPlugin(viewer, {
        // Enable streaming for large models
        reuseGeometries: true
      });
      xktLoaderRef.current = xktLoader;

      // Setup event listeners (non-blocking)
      requestAnimationFrame(() => setupEventListeners(viewer));

      // Store references
      viewerRef.current = viewer;
      window.xeokitViewer = viewer; // Global reference for debugging

      setIsInitialized(true);
      
              // Initialize services in parallel (non-blocking)
        Promise.all([
          initializeIFCService(viewer),
          initializeScene(),
          setupEnvironmentMapping(viewer)
        ]).then(([ifcSuccess]) => {
        // Create infinite ground grid
        setTimeout(() => {
          createInfiniteGrid(viewer, {
            size: 100,           // Grid extends from -100 to +100 units
            divisions: 50,       // 50x50 grid lines (less dense)
            color1: [1.0, 1.0, 1.0], // White grid lines
            opacity: 0.6,        // Higher opacity for white lines
            yLevel: 0            // At ground level
          });
        }, 500);
        
        // Enable advanced features after initial load
        setTimeout(() => {
          if (viewerRef.current && viewerRef.current.configurations) {
            try {
              viewerRef.current.configurations.dtxEnabled = true;
              viewerRef.current.configurations.pbrEnabled = true;
            } catch (error) {
              // Silent fail - advanced features not critical
            }
          }
        }, 2000);
        
        
        // Notify parent component
        if (onViewerReadyRef.current) {
          const viewerConfig = {
            viewer,
            switchViewMode: setViewMode,
            directLoader: null, // Will be set when DirectGLTFLoader is created
            isPlaceholder: false,
            message: ifcSuccess 
              ? 'Xeokit viewer ready with IFC support' 
              : 'Xeokit viewer ready (IFC unavailable)'
          };
          
          // Only expose IFC methods if service initialized successfully
          if (ifcSuccess) {
            viewerConfig.loadIFCFile = loadIFCFile;
            viewerConfig.createBIMObject = createBIMObject;
          }
          
          onViewerReadyRef.current(viewerConfig);
        }
      }).catch(error => {
        console.warn('⚠️ Service initialization warning:', error);
        // Continue anyway - viewer is functional
      });

    } catch (error) {
      console.error('❌ Failed to initialize xeokit viewer:', error);
      
      // Check if this is a CDN loading error
      if (error.message && error.message.includes('xeokit')) {
        setError('Failed to load BIM viewer. Please check your internet connection and refresh the page.');
      } else {
        setError(error.message || 'Failed to initialize BIM viewer');
      }
      
      setIsLoading(false);
    }
  }, []);

  // Create Infinite Grid with Distance-Based Fade
  const createInfiniteGrid = useCallback((viewer, options = {}) => {
    try {
      const {
        size = 200,          // Grid extends from -size to +size
        divisions = 200,     // Number of divisions (grid lines)
        color1 = [1.0, 1.0, 1.0], // Grid line color
        opacity = 0.6,       // Base grid transparency
        yLevel = 0,          // Y position (ground level)
        fadeRings = 4        // Number of fade rings
      } = options;

      console.log('🗂️ Creating infinite ground grid with distance fade...');

      const { SceneModel } = window.xeokit;
      if (!SceneModel || !viewer?.scene) {
        console.warn('⚠️ Cannot create grid: SceneModel or viewer.scene not available');
        return;
      }

      // Remove existing grid if present
      if (viewer.scene.models.groundGrid) {
        viewer.scene.destroyModel('groundGrid');
      }

      const gridModel = new SceneModel(viewer.scene, {
        id: 'groundGrid',
        isObject: false, // Not selectable/pickable
        visible: true,
        edges: false,    // Disable edge rendering for better performance
        backfaces: false // Single-sided for better performance
      });

      // Create multiple concentric grid rings with different opacities
      const ringSize = size / fadeRings;
      
      for (let ring = 0; ring < fadeRings; ring++) {
        const ringStartRadius = ring * ringSize;
        const ringEndRadius = (ring + 1) * ringSize;
        
        // Calculate fade opacity (closer = more opaque)
        const fadeOpacity = opacity * (1 - (ring / fadeRings) * 0.8); // 80% fade
        
        // Skip if opacity would be too low
        if (fadeOpacity < 0.05) continue;
        
        console.log(`🔄 Creating grid ring ${ring + 1}: radius ${ringStartRadius}-${ringEndRadius}, opacity ${fadeOpacity.toFixed(2)}`);
        
        this.createGridRing(gridModel, {
          innerRadius: ringStartRadius,
          outerRadius: ringEndRadius,
          divisions: Math.ceil(divisions * (ringEndRadius / size)), // Adaptive division density
          color: color1,
          opacity: fadeOpacity,
          yLevel,
          ringIndex: ring
        });
      }

      gridModel.finalize();
      console.log(`✅ Infinite ground grid created with ${fadeRings} fade rings`);
      return gridModel;

    } catch (error) {
      console.error('❌ Failed to create infinite grid:', error);
      return null;
    }
  }, []);

  // Helper function to create a single grid ring
  const createGridRing = useCallback((gridModel, options) => {
    const {
      innerRadius,
      outerRadius,
      divisions,
      color,
      opacity,
      yLevel,
      ringIndex
    } = options;

    const positions = [];
    const indices = [];
    let vertexIndex = 0;

    const step = (outerRadius - innerRadius) * 2 / divisions;

    // Create vertical lines (X direction) within ring bounds
    for (let i = 0; i <= divisions; i++) {
      const x = -outerRadius + (i * step);
      
      // Skip if line is within inner radius (already covered by inner rings)
      if (Math.abs(x) < innerRadius) continue;
      
      // Line from (x, yLevel, -outerRadius) to (x, yLevel, outerRadius)
      positions.push(x, yLevel, -outerRadius);
      positions.push(x, yLevel, outerRadius);
      indices.push(vertexIndex, vertexIndex + 1);
      vertexIndex += 2;
    }

    // Create horizontal lines (Z direction) within ring bounds
    for (let i = 0; i <= divisions; i++) {
      const z = -outerRadius + (i * step);
      
      // Skip if line is within inner radius (already covered by inner rings)
      if (Math.abs(z) < innerRadius) continue;
      
      // Line from (-outerRadius, yLevel, z) to (outerRadius, yLevel, z)
      positions.push(-outerRadius, yLevel, z);
      positions.push(outerRadius, yLevel, z);
      indices.push(vertexIndex, vertexIndex + 1);
      vertexIndex += 2;
    }

    // Create mesh for this ring
    gridModel.createMesh({
      id: `gridMesh_ring_${ringIndex}`,
      primitive: 'lines',
      positions: positions,
      indices: indices,
      material: {
        diffuse: color,
        emissive: color,
        specular: [0.1, 0.1, 0.1],
        shininess: 1,
        alpha: opacity,
        alphaMode: opacity < 1.0 ? 'blend' : 'opaque',
        backfaces: false,
        lineWidth: Math.max(1, 3 - ringIndex), // Thinner lines for distant rings
        metallic: 0,
        roughness: 1.0,
        unlit: true
      }
    });

    // Create entity for this ring
    gridModel.createEntity({
      id: `gridEntity_ring_${ringIndex}`,
      meshIds: [`gridMesh_ring_${ringIndex}`],
      isObject: false,
      visible: true
    });
  }, []);

  /**
   * Create a basic scene with minimal geometry (fallback)
   */
  const createBasicScene = async (viewer) => {
    try {
      // Import SceneModel from xeokit
      const xeokit = await loadXeokitFromCDN();
      if (!xeokit || !xeokit.SceneModel) {
        throw new Error('Failed to load SceneModel from xeokit');
      }
      const { SceneModel } = xeokit;

      // Create a new scene model using correct API
      const sceneModel = new SceneModel(viewer.scene, {
        id: "testModel",
        isObject: true
      });

      // Create a test cube
      sceneModel.createMesh({
        id: "testCube",
        primitive: "triangles",
        positions: [
          1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
          1, 1, 1, 1, -1, 1, 1, -1, -1, 1, 1, -1,
          1, 1, 1, 1, 1, -1, -1, 1, -1, -1, 1, 1,
          -1, 1, 1, -1, 1, -1, -1, -1, -1, -1, -1, 1,
          -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
          1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1
        ],
        normals: [
          0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
          1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
          0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
          -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
          0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
          0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1
        ],
        indices: [
          0, 1, 2, 0, 2, 3,
          4, 5, 6, 4, 6, 7,
          8, 9, 10, 8, 10, 11,
          12, 13, 14, 12, 14, 15,
          16, 17, 18, 16, 18, 19,
          20, 21, 22, 20, 22, 23
        ]
      });

      sceneModel.createEntity({
        id: "testCubeEntity",
        meshIds: ["testCube"],
        isObject: true,
        position: [0, 0, 0],
        scale: [3, 3, 3],
        rotation: [0, 0, 0],
        colorize: theme === 'dark' ? [0.3, 0.7, 1.0] : [0.2, 0.5, 0.8]
      });

      sceneModel.finalize();

      console.log('✅ Basic test scene created');
    } catch (error) {
      console.warn('⚠️ Could not create basic scene:', error);
    }
  };

  /**
   * Setup event listeners for viewer interactions
   */
  const setupEventListeners = (viewer) => {
    // Mouse click events
    viewer.cameraControl.on("picked", (pickResult) => {
      if (pickResult.entity) {
        console.log('🎯 Object clicked:', pickResult.entity.id);
        if (onObjectClick) {
          onObjectClick({
            entityId: pickResult.entity.id,
            canvasPos: pickResult.canvasPos,
            worldPos: pickResult.worldPos,
            isPlaceholder: false
          });
        }
      } else if (onObjectClick) {
        // Click on empty space
        onObjectClick({
          canvasPos: pickResult.canvasPos,
          worldPos: pickResult.worldPos,
          isPlaceholder: false
        });
      }
    });

    // Mouse hover events
    viewer.cameraControl.on("hover", (pickResult) => {
      if (pickResult.entity && onObjectHover) {
        onObjectHover({
          entityId: pickResult.entity.id,
          canvasPos: pickResult.canvasPos,
          worldPos: pickResult.worldPos,
          isPlaceholder: false
        });
      }
    });

    // Camera events
    viewer.cameraControl.on("matrix", () => {
      // Camera position changed
    });
  };

  /**
   * Handle window resize
   */
  const handleResize = useCallback(() => {
    if (viewerRef.current && containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      viewerRef.current.scene.canvas.canvas.width = clientWidth;
      viewerRef.current.scene.canvas.canvas.height = clientHeight;
      viewerRef.current.scene.canvas.canvas.style.width = clientWidth + 'px';
      viewerRef.current.scene.canvas.canvas.style.height = clientHeight + 'px';
      viewerRef.current.scene.canvas.boundary = [0, 0, clientWidth, clientHeight];
    }
  }, []);

  /**
   * Switch between 2D and 3D views
   */
  const switchTo2DMode = useCallback(() => {
    if (!viewerRef.current) {
      console.warn('⚠️ Cannot switch to 2D: viewer not initialized');
      return;
    }
    
    try {
      console.log('🔄 Switching to 2D view mode');
      setViewMode('2D');
      
      const camera = viewerRef.current.camera;
      const cameraControl = viewerRef.current.cameraControl;
      
      // Set orthographic projection for 2D view
      console.log('📐 Setting orthographic projection...');
      camera.projection = "ortho";
      
      // Position camera for top-down view
      console.log('📹 Setting camera position for 2D view...');
      camera.eye = [0, 50, 0];
      camera.look = [0, 0, 0];
      camera.up = [0, 0, -1];
      
      // Configure camera controls for 2D navigation
      if (cameraControl) {
        console.log('🎮 Configuring 2D camera controls...');
        cameraControl.constrainVertical = true;
        cameraControl.planView = true;
        // Disable rotation for 2D mode
        cameraControl.rotateSpeed = 0;
        cameraControl.enabled = true;
      }
      
      // Small delay to ensure camera updates are applied
      setTimeout(() => {
        if (viewerRef.current?.camera) {
          viewerRef.current.camera.ortho.scale = 20; // Adjust scale for better 2D view
        }
        console.log('✅ 2D view mode activated');
      }, 100);
      
    } catch (error) {
      console.error('❌ Error switching to 2D mode:', error);
      // Fallback: just update the UI state
      setViewMode('2D');
    }
  }, []);

  const switchTo3DMode = useCallback(() => {
    if (!viewerRef.current) {
      console.warn('⚠️ Cannot switch to 3D: viewer not initialized');
      return;
    }
    
    try {
      console.log('🔄 Switching to 3D view mode');
      setViewMode('3D');
      
      const camera = viewerRef.current.camera;
      const cameraControl = viewerRef.current.cameraControl;
      
      // Set perspective projection for 3D view
      console.log('🎯 Setting perspective projection...');
      camera.projection = "perspective";
      
      // Position camera for 3D perspective view
      console.log('📹 Setting camera position for 3D view...');
      camera.eye = [-20, 15, 30];
      camera.look = [0, 0, 0];
      camera.up = [0, 1, 0];
      
      // Enable full 3D navigation controls
      if (cameraControl) {
        console.log('🎮 Configuring 3D camera controls...');
        cameraControl.constrainVertical = false;
        cameraControl.planView = false;
        cameraControl.rotateSpeed = 1.0; // Restore rotation
        cameraControl.enabled = true;
      }
      
      // Small delay to ensure camera updates are applied
      setTimeout(() => {
        console.log('✅ 3D view mode activated');
      }, 100);
      
    } catch (error) {
      console.error('❌ Error switching to 3D mode:', error);
      // Fallback: just update the UI state
      setViewMode('3D');
    }
  }, []);

  /**
   * Load any 3D file (IFC, glTF, OBJ) into the viewer
   */
  const loadIFCFile = useCallback(async (file, options = {}) => {
    try {
      console.log(`🎬 Loading 3D file: ${file.name}`);
      setIsLoading(true);
      setError(null);
      
      // Use simple direct loader instead of complex IFC handler
      const DirectGLTFLoader = (await import('../../services/DirectGLTFLoader.js')).default;
      const directLoader = new DirectGLTFLoader(viewerRef.current);
      
      // Store directLoader reference for later use
      if (viewerRef.current) {
        viewerRef.current.directLoader = directLoader;
      }
      
      const result = await directLoader.loadAnyFile(file, file.name);
      
      if (result.success) {
        console.log(`✅ 3D file loaded successfully: ${result.format}`);
        setIsLoading(false);
        
        // Debug materials and geometry for the loaded model
        if (result.model) {
          setTimeout(() => debugModelMaterials(result.model), 100);
        }
        
        // Notify parent component
        if (onModelLoaded) {
          onModelLoaded(result.model, result.fileName);
        }
        
        return result;
      } else {
        // For IFC files, show conversion instructions
        if (file.name.toLowerCase().endsWith('.ifc')) {
          const shortMsg = `IFC files need conversion first. Convert "${file.name}" to .glb format at: ${result.convertUrl || 'an online converter'}, then import the .glb file here.`;
          setError(shortMsg);
          
          // Also log detailed instructions
          console.log('📋 Full IFC conversion guide:', result.instructions);
        } else {
          setError(result.message || 'Failed to load file');
        }
        setIsLoading(false);
        return result;
      }
      
    } catch (error) {
      console.error('❌ Failed to load 3D file:', error);
      setError(error.message);
      setIsLoading(false);
      throw error;
    }
  }, [onModelLoaded]);

  /**
   * Create a BIM object using IFC definitions
   */
  const createBIMObject = useCallback(async (objectData) => {
    try {
      if (!ifcService.isInitialized) {
        throw new Error('IFC service not initialized');
      }
      
      console.log('🏗️ Creating BIM object...');
      const bimObject = await ifcService.createBIMObject(objectData);
      
      // Future: Create corresponding xeokit entity
      if (viewerRef.current && bimObject) {
        console.log('🔗 Creating xeokit entity for BIM object...');
        // This will be implemented in future iterations
        bimObject.xeokitEntityId = `entity_${bimObject.id}`;
      }
      
      return bimObject;
      
    } catch (error) {
      console.error('❌ Failed to create BIM object:', error);
      throw error;
    }
  }, []);

  /**
   * Cleanup viewer on unmount
   */
  const cleanup = useCallback(() => {
    if (viewerRef.current) {
      try {
        viewerRef.current.destroy();
        viewerRef.current = null;
        delete window.xeokitViewer;
        console.log('🧹 Xeokit viewer cleaned up');
      } catch (error) {
        console.warn('⚠️ Error during cleanup:', error);
      }
    }
    
    // Cleanup IFC service
    try {
      ifcService.destroy();
      delete window.ifcService;
      console.log('🧹 IFC service cleaned up');
    } catch (error) {
      console.warn('⚠️ Error during IFC service cleanup:', error);
    }
  }, []);

  // Initialize viewer on mount - FIXED: Remove unstable dependencies
  useEffect(() => {
    // Only initialize once and add extra guards
    if (containerRef.current && !viewerRef.current && !isIFCTestMode) {
      initializeViewer();
    }
    return cleanup;
  }, []); // Empty dependency array - only run once on mount

  // Handle config/theme changes separately without full re-initialization
  useEffect(() => {
    if (viewerRef.current && !isIFCTestMode) {
      // Update theme without re-initializing
      try {
        const bgColor = [0.8, 0.8, 0.8]; // Light grey background for both themes
        viewerRef.current.scene.canvas.backgroundColor = bgColor;
        
        // Recreate grid with new theme colors
        createInfiniteGrid(viewerRef.current, {
          size: 100,
          divisions: 50,
          color1: [1.0, 1.0, 1.0], // White grid lines
          opacity: 0.6,
          yLevel: 0
        });
      } catch (error) {
        console.warn('⚠️ Could not update theme:', error);
      }
    }
  }, [theme, createInfiniteGrid]); // Re-run when theme changes

  // Handle window resize  
  useEffect(() => {
    const handleResizeStable = () => {
      if (viewerRef.current && !isIFCTestMode) {
        try {
          // Try xeokit's standard resize method
          if (viewerRef.current.scene?.canvas?.resizeToMatch) {
            viewerRef.current.scene.canvas.resizeToMatch();
          } else if (viewerRef.current.canvas?.resizeToMatch) {
            // Alternative canvas location
            viewerRef.current.canvas.resizeToMatch();
          } else if (viewerRef.current.resize) {
            // Try viewer-level resize
            viewerRef.current.resize();
          } else {
            console.warn('⚠️ No resize method found on xeokit viewer');
          }
        } catch (error) {
          console.warn('⚠️ Canvas resize failed:', {
            error: error.message,
            hasViewer: !!viewerRef.current,
            hasScene: !!viewerRef.current?.scene,
            hasCanvas: !!viewerRef.current?.scene?.canvas,
            canvasType: viewerRef.current?.scene?.canvas?.constructor?.name
          });
        }
      }
    };
    
    window.addEventListener('resize', handleResizeStable);
    return () => window.removeEventListener('resize', handleResizeStable);
  }, []); // Stable resize handler

  // Synchronize CAD objects from StandaloneCADEngine
  useEffect(() => {
    if (!cadObjects || cadObjects.length === 0) {
      return;
    }

    console.log(`🔄 CAD objects changed: ${cadObjects.length} objects`);
    console.log(`🔍 Viewer state: initialized=${isInitialized}, viewer=${!!viewerRef.current}, SceneModel=${!!window.xeokit?.SceneModel}`);

    // Check if viewer is ready
    if (!isInitialized || !viewerRef.current || !window.xeokit?.SceneModel) {
      console.log(`⏳ Viewer not ready yet, will retry when ready...`);
      return;
    }

    // Add small delay to ensure viewer is fully ready
    const loadTimer = setTimeout(() => {
      console.log(`🚀 Loading CAD objects with delay for viewer stability...`);
      
      // If this is the first load of CAD objects
      if (loadedCADObjects.size === 0 && cadObjects.length > 0) {
        loadCADObjects(cadObjects);
      } else if (cadObjects.length !== loadedCADObjects.size) {
        // Objects have been added/removed, update accordingly
        updateCADObjects(cadObjects);
      } else {
        // Check if any objects have been modified (basic check)
        const needsUpdate = cadObjects.some(cadObj => {
          const loaded = loadedCADObjects.get(cadObj.id);
          return !loaded; // If we don't have it loaded, we need an update
        });

        if (needsUpdate) {
          updateCADObjects(cadObjects);
        }
      }
    }, 500); // 500ms delay to ensure viewer is stable

    return () => clearTimeout(loadTimer);
  }, [cadObjects, isInitialized, loadedCADObjects, loadCADObjects, updateCADObjects]);

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
      color: theme === 'dark' ? '#ffffff' : '#000000'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚡</div>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
        Loading BIM Viewer
      </h3>
      <p style={{ margin: 0, opacity: 0.8, fontSize: '14px' }}>
        Initializing professional BIM viewer from CDN...
      </p>
    </div>
  );

  /**
   * Render error state
   */
  const renderError = () => (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
      color: theme === 'dark' ? '#ffffff' : '#000000'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
        3D Viewer Loading Failed
      </h3>
      <p style={{ margin: '0 0 12px 0', opacity: 0.8, fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>
        {error || 'Unknown error occurred'}
      </p>
      <p style={{ margin: 0, opacity: 0.6, fontSize: '12px', textAlign: 'center' }}>
        Check your internet connection and click Retry
      </p>
      <button
        onClick={initializeViewer}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        Retry
      </button>
    </div>
  );

  // Handle IFC test mode - return placeholder AFTER all hooks are called
  if (isIFCTestMode) {
    return (
      <div 
        className={className}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1f2937',
          color: '#9ca3af',
          fontSize: '14px',
          position: 'relative',
          width: '100%',
          height: '100%'
        }}
      >
        🧪 Xeokit viewport disabled during IFC testing
      </div>
    );
  }

  // Get cursor style based on selected tool
  const getCursorStyle = () => {
    const cursor = (() => {
      switch(selectedTool) {
        case 'wall':
          return 'crosshair';
        case 'slab':
          return 'crosshair';
        case 'door':
          return 'crosshair';
        case 'window':
          return 'crosshair';
        case 'column':
          return 'crosshair';
        case 'pan':
          return 'grab';
        case 'orbit':
          return 'grab';
        case 'pointer':
        default:
          return 'default';
      }
    })();
    
    console.log('🎯 XEOKIT CURSOR DEBUG: Setting cursor for tool:', selectedTool, 'to:', cursor);
    return cursor;
  };

  return (
    <div
      ref={containerRef}
      className={`xeokit-viewport ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
        cursor: getCursorStyle(),
        ...style
      }}
    >
      {/* Canvas element for xeokit */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: isInitialized && !error ? 'block' : 'none'
        }}
      />

      {/* Loading state */}
      {isLoading && !error && renderLoading()}

      {/* Error state */}
      {error && renderError()}

      {/* View mode controls */}
      {isInitialized && !error && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              zIndex: 1001,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🏗️</span>
          </div>

          {/* Combined View Mode & Theme Controls with Glassmorphism */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 1002
            }}
          >
            <div
              style={{
                backgroundColor: theme === 'light' 
                  ? 'rgba(255,255,255,0.30)' 
                  : 'rgba(17,24,39,0.30)',
                border: theme === 'light'
                  ? '1px solid rgba(255,255,255,0.40)'
                  : '1px solid rgba(55,65,81,0.50)',
                borderRadius: '12px',
                padding: '8px',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* View Mode Toggles */}
                {enable2D && enable3D && (
                  <div
                    style={{
                      display: 'flex',
                      backgroundColor: 'rgba(0,0,0,0.20)',
                      borderRadius: '8px',
                      padding: '2px'
                    }}
                  >
                    <button
                      onClick={switchTo2DMode}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: viewMode === '2D' ? '#3b82f6' : 'transparent',
                        color: viewMode === '2D' ? 'white' : (theme === 'dark' ? '#e5e7eb' : '#374151'),
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        minWidth: '36px',
                        textAlign: 'center',
                        boxShadow: viewMode === '2D' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none'
                      }}
                      title="Switch to 2D Top-Down View"
                    >
                      2D
                    </button>
                    <button
                      onClick={switchTo3DMode}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: viewMode === '3D' ? '#3b82f6' : 'transparent',
                        color: viewMode === '3D' ? 'white' : (theme === 'dark' ? '#e5e7eb' : '#374151'),
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        minWidth: '36px',
                        textAlign: 'center',
                        boxShadow: viewMode === '3D' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none'
                      }}
                      title="Switch to 3D Perspective View"
                    >
                      3D
                    </button>
                  </div>
                )}

                {/* Divider */}
                <div
                  style={{
                    height: '1px',
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.20)'
                  }}
                />

                {/* Theme Toggle */}
                {onThemeChange && (
                  <button
                    onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                    style={{
                      padding: '6px',
                      backgroundColor: theme === 'dark' 
                        ? 'rgba(251,191,36,0.20)' 
                        : 'rgba(59,130,246,0.20)',
                      color: theme === 'dark' ? '#fbbf24' : '#3b82f6',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: 'scale(1)',
                      ':hover': {
                        transform: 'scale(1.05)',
                        backgroundColor: theme === 'dark' 
                          ? 'rgba(251,191,36,0.30)' 
                          : 'rgba(59,130,246,0.30)'
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.05)';
                      e.target.style.backgroundColor = theme === 'dark' 
                        ? 'rgba(251,191,36,0.30)' 
                        : 'rgba(59,130,246,0.30)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.backgroundColor = theme === 'dark' 
                        ? 'rgba(251,191,36,0.20)' 
                        : 'rgba(59,130,246,0.20)';
                    }}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  >
                    {theme === 'dark' ? (
                      <SunIcon style={{ width: '16px', height: '16px' }} />
                    ) : (
                      <MoonIcon style={{ width: '16px', height: '16px' }} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lighting Controls Panel */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              zIndex: 1002
            }}
          >
            {/* Lighting Toggle Button */}
            <button
              onClick={() => setLightingPanelOpen(!lightingPanelOpen)}
              style={{
                backgroundColor: theme === 'light' 
                  ? 'rgba(255,255,255,0.30)' 
                  : 'rgba(17,24,39,0.30)',
                border: theme === 'light'
                  ? '1px solid rgba(255,255,255,0.40)'
                  : '1px solid rgba(55,65,81,0.50)',
                borderRadius: '12px',
                padding: '8px 12px',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                color: theme === 'dark' ? '#e5e7eb' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Lighting Controls"
            >
              💡 Lighting
            </button>

            {/* Lighting Panel */}
            {lightingPanelOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '60px',
                  right: 0,
                  width: '280px',
                  backgroundColor: theme === 'light' 
                    ? 'rgba(255,255,255,0.35)' 
                    : 'rgba(17,24,39,0.35)',
                  border: theme === 'light'
                    ? '1px solid rgba(255,255,255,0.40)'
                    : '1px solid rgba(55,65,81,0.50)',
                  borderRadius: '12px',
                  padding: '16px',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 12px 48px rgba(0,0,0,0.15)',
                  color: theme === 'dark' ? '#e5e7eb' : '#374151',
                  fontSize: '13px'
                }}
              >
                <div style={{ marginBottom: '12px', fontWeight: '600', fontSize: '14px' }}>
                  ☀️ Lighting Settings
                </div>

                {/* Time of Day Toggle */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ marginBottom: '6px', fontSize: '12px', opacity: 0.8 }}>
                    Time of Day
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleLightingChange({ timeOfDay: 'day' })}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        backgroundColor: lightingSettings.timeOfDay === 'day' ? '#3b82f6' : 'transparent',
                        color: lightingSettings.timeOfDay === 'day' ? 'white' : (theme === 'dark' ? '#e5e7eb' : '#374151'),
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      🌅 Day
                    </button>
                    <button
                      onClick={() => handleLightingChange({ timeOfDay: 'night' })}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        backgroundColor: lightingSettings.timeOfDay === 'night' ? '#3b82f6' : 'transparent',
                        color: lightingSettings.timeOfDay === 'night' ? 'white' : (theme === 'dark' ? '#e5e7eb' : '#374151'),
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      🌙 Night
                    </button>
                  </div>
                </div>

                {/* Sun Intensity */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>☀️ Sun Intensity</span>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>{lightingSettings.sunIntensity.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={lightingSettings.sunIntensity}
                    onChange={(e) => handleLightingChange({ sunIntensity: parseFloat(e.target.value) })}
                    style={{
                      width: '100%',
                      height: '4px',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '2px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* Sky Intensity */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>🌌 Sky Intensity</span>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>{lightingSettings.skyIntensity.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={lightingSettings.skyIntensity}
                    onChange={(e) => handleLightingChange({ skyIntensity: parseFloat(e.target.value) })}
                    style={{
                      width: '100%',
                      height: '4px',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '2px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* Ambient Intensity */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>🔆 Ambient</span>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>{lightingSettings.ambientIntensity.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={lightingSettings.ambientIntensity}
                    onChange={(e) => handleLightingChange({ ambientIntensity: parseFloat(e.target.value) })}
                    style={{
                      width: '100%',
                      height: '4px',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '2px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* Quick Presets */}
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ marginBottom: '8px', fontSize: '12px', opacity: 0.8 }}>
                    Quick Presets
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleLightingChange({ 
                        sunIntensity: 0.7, 
                        skyIntensity: 0.4, 
                        ambientIntensity: 1.1,
                        timeOfDay: 'day'
                      })}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '4px',
                        color: theme === 'dark' ? '#e5e7eb' : '#374151',
                        cursor: 'pointer',
                        fontSize: '10px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      ⚖️ Balanced
                    </button>
                    <button
                      onClick={() => handleLightingChange({ 
                        sunIntensity: 1.2, 
                        skyIntensity: 0.7, 
                        ambientIntensity: 1.3,
                        timeOfDay: 'day'
                      })}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '4px',
                        color: theme === 'dark' ? '#e5e7eb' : '#374151',
                        cursor: 'pointer',
                        fontSize: '10px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      🌞 Bright
                    </button>
                    <button
                      onClick={() => handleLightingChange({ 
                        sunIntensity: 0.5, 
                        skyIntensity: 0.3, 
                        ambientIntensity: 0.9,
                        timeOfDay: 'day'
                      })}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '4px',
                        color: theme === 'dark' ? '#e5e7eb' : '#374151',
                        cursor: 'pointer',
                        fontSize: '10px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      ☁️ Soft
                    </button>
                    <button
                      onClick={() => handleLightingChange({ 
                        sunIntensity: 0.3, 
                        skyIntensity: 0.15, 
                        ambientIntensity: 0.6,
                        timeOfDay: 'night'
                      })}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '4px',
                        color: theme === 'dark' ? '#e5e7eb' : '#374151',
                        cursor: 'pointer',
                        fontSize: '10px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      🌙 Night
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default XeokitViewport; 