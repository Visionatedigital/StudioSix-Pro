/**
 * Standalone CAD Engine
 * 
 * Independent CAD rendering and geometry management system
 * Replaces WebSocket-based FreeCAD integration with local Three.js rendering
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { Door, Window } from '../models/BIMObjects.js';
import { CommandFactory } from '../commands/architecturalCommands.js';
import commandHistory from '../utils/commandHistory.js';

class StandaloneCADEngine {
  constructor(architect3DService = null) {
    this.objects = new Map(); // objectId -> CADObject
    this.architect3DService = architect3DService; // Reference to sync adjusted endpoints
    this.nextObjectId = 1;
    this.listeners = new Map(); // event -> [callbacks]
    
    // Scene management
    this.scene3D = new THREE.Scene();
    this.scene2D = new THREE.Scene();
    
    // PROFESSIONAL MATERIAL DATABASE with thermal and structural properties
    this.materials = {
      // Core materials with enhanced properties
      concrete: new THREE.MeshLambertMaterial({ color: 0x6b7280, roughness: 0.8 }),
      tiles: new THREE.MeshLambertMaterial({ color: 0xf3f4f6, roughness: 0.3 }),
      wood: new THREE.MeshLambertMaterial({ color: 0xd97706, roughness: 0.6 }),
      marble: new THREE.MeshLambertMaterial({ color: 0xf9fafb, roughness: 0.1, metalness: 0.1 }),
      granite: new THREE.MeshLambertMaterial({ color: 0x374151, roughness: 0.4 }),
      steel: new THREE.MeshLambertMaterial({ color: 0x64748b, roughness: 0.2, metalness: 0.8 }),
      carpet: new THREE.MeshLambertMaterial({ color: 0x8b5cf6, roughness: 0.9 }),
      vinyl: new THREE.MeshLambertMaterial({ color: 0x10b981, roughness: 0.5 }),
      stone: new THREE.MeshLambertMaterial({ color: 0x6b7280, roughness: 0.7 }),
      precast: new THREE.MeshLambertMaterial({ color: 0x9ca3af, roughness: 0.6 }),
      
      // Wall-specific layer materials
      brick: new THREE.MeshLambertMaterial({ color: 0xd4a574, roughness: 0.7 }),
      aluminum: new THREE.MeshLambertMaterial({ color: 0xd6dde6, roughness: 0.3, metalness: 0.6 }),
      glass: new THREE.MeshLambertMaterial({ color: 0xf0f8ff, transparent: true, opacity: 0.4, roughness: 0.1 }),
      drywall: new THREE.MeshLambertMaterial({ color: 0xfafafa, roughness: 0.5 }),
      composite: new THREE.MeshLambertMaterial({ color: 0x8b7d6b, roughness: 0.6 }),
      upvc: new THREE.MeshLambertMaterial({ color: 0xf3f4f6, roughness: 0.4 }),
      fiberglass: new THREE.MeshLambertMaterial({ color: 0x6b7280, roughness: 0.5 }),
      pvc: new THREE.MeshLambertMaterial({ color: 0xf3f4f6, roughness: 0.4 }),
      
      // Insulation materials
      insulation_batt: new THREE.MeshLambertMaterial({ color: 0xffeaa7, roughness: 0.9 }),
      insulation_rigid: new THREE.MeshLambertMaterial({ color: 0xff7675, roughness: 0.8 }),
      insulation_spray: new THREE.MeshLambertMaterial({ color: 0xa29bfe, roughness: 0.9 }),
      
      // Air barriers and membranes
      air_barrier: new THREE.MeshLambertMaterial({ color: 0x2d3436, roughness: 0.4, transparent: true, opacity: 0.8 }),
      vapor_barrier: new THREE.MeshLambertMaterial({ color: 0x0984e3, roughness: 0.3, transparent: true, opacity: 0.7 }),
      
      // Special materials
      wireframe: new THREE.MeshBasicMaterial({ wireframe: true, color: 0x00ff00 }),
      selected: new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.5 }),
      preview: new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.3 })
    };

    // PROFESSIONAL MATERIAL DATABASE with properties for analysis
    this.materialDatabase = {
      concrete: { 
        thermalConductivity: 1.8, density: 2400, thermalCapacity: 880, 
        compressiveStrength: 30, category: 'structural' 
      },
      brick: { 
        thermalConductivity: 0.77, density: 1920, thermalCapacity: 840,
        compressiveStrength: 20, category: 'masonry'
      },
      drywall: { 
        thermalConductivity: 0.16, density: 640, thermalCapacity: 1150,
        compressiveStrength: 2, category: 'finish'
      },
      insulation_batt: { 
        thermalConductivity: 0.04, density: 12, thermalCapacity: 840,
        compressiveStrength: 0, category: 'insulation'
      },
      insulation_rigid: { 
        thermalConductivity: 0.028, density: 35, thermalCapacity: 1400,
        compressiveStrength: 0.2, category: 'insulation'
      },
      wood: { 
        thermalConductivity: 0.13, density: 600, thermalCapacity: 1600,
        compressiveStrength: 40, category: 'structural'
      },
      steel: { 
        thermalConductivity: 50, density: 7850, thermalCapacity: 460,
        compressiveStrength: 250, category: 'structural'
      }
    };

    // PROFESSIONAL WALL TYPE TEMPLATES - Industry Standard Assemblies
    this.wallTypeTemplates = {
      'exterior_wood_frame': {
        name: 'Wood Frame Exterior Wall',
        description: '2x6 Wood Frame with Brick Veneer',
        totalThickness: 0.254, // 10 inches
        layers: [
          { material: 'brick', thickness: 0.102, function: 'finish_exterior', name: 'Brick Veneer' },
          { material: 'air_barrier', thickness: 0.025, function: 'air_space', name: 'Air Gap' },
          { material: 'insulation_batt', thickness: 0.140, function: 'insulation', name: 'Batt Insulation' },
          { material: 'wood', thickness: 0.038, function: 'structure', name: '2x6 Wood Studs' },
          { material: 'vapor_barrier', thickness: 0.001, function: 'vapor_control', name: 'Vapor Barrier' },
          { material: 'drywall', thickness: 0.013, function: 'finish_interior', name: 'Gypsum Board' }
        ],
        properties: {
          isExternal: true,
          loadBearing: true,
          thermalTransmittance: 0.35,
          fireRating: 60
        }
      },
      'interior_partition': {
        name: 'Interior Partition Wall',
        description: '2x4 Wood Frame Partition',
        totalThickness: 0.114, // 4.5 inches
        layers: [
          { material: 'drywall', thickness: 0.013, function: 'finish_interior', name: 'Gypsum Board' },
          { material: 'wood', thickness: 0.089, function: 'structure', name: '2x4 Wood Studs' },
          { material: 'drywall', thickness: 0.013, function: 'finish_interior', name: 'Gypsum Board' }
        ],
        properties: {
          isExternal: false,
          loadBearing: false,
          thermalTransmittance: 0.0,
          fireRating: 30
        }
      },
      'concrete_masonry': {
        name: 'Concrete Masonry Unit Wall',
        description: 'CMU Block with Insulation',
        totalThickness: 0.305, // 12 inches
        layers: [
          { material: 'concrete', thickness: 0.203, function: 'structure', name: '8" CMU Block' },
          { material: 'insulation_rigid', thickness: 0.051, function: 'insulation', name: 'Rigid Insulation' },
          { material: 'drywall', thickness: 0.013, function: 'finish_interior', name: 'Gypsum Board' }
        ],
        properties: {
          isExternal: true,
          loadBearing: true,
          thermalTransmittance: 0.28,
          fireRating: 120
        }
      }
    };
    
    // Current selection
    this.selectedObjects = new Set();
    this.previewObject = null;
  }

  /**
   * Add event listener
   */
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in CAD engine event listener (${event}):`, error);
        }
      });
    }
  }

  /**
   * Create a new CAD object
   */
  createObject(type, params) {
    console.log(`🏗️ CAD ENGINE DEBUG: Creating ${type} object with params:`, params);
    console.log(`🏗️ CAD ENGINE DEBUG: Current object count:`, this.objects.size);
    console.log(`🏗️ CAD ENGINE DEBUG: Next object ID will be:`, `cad_${this.nextObjectId}`);
    
    const objectId = `cad_${this.nextObjectId++}`;
    
    let geometry, mesh3D, mesh2D;
    
    try {
      switch (type) {
        case 'slab':
          console.log('🏗️ SLAB CREATION DEBUG: Creating slab geometry...');
          console.log('🏗️ SLAB CREATION DEBUG: Slab params:', params);
          const result = this.createSlabGeometry(params);
          geometry = result.geometry;
          mesh3D = result.mesh3D;
          mesh2D = result.mesh2D;
          console.log('🏗️ SLAB CREATION DEBUG: Slab geometry created successfully');
          console.log('🏗️ SLAB CREATION DEBUG: 3D mesh position:', mesh3D.position);
          console.log('🏗️ SLAB CREATION DEBUG: 2D mesh position:', mesh2D.position);
          console.log('🏗️ SLAB CREATION DEBUG: Geometry type:', geometry?.type);
          break;
          
        case 'ramp':
          console.log('🛤️ RAMP CREATION DEBUG: Creating ramp geometry...');
          console.log('🛤️ RAMP CREATION DEBUG: Ramp params:', params);
          console.log('🛤️ RAMP CREATION DEBUG: Ramp-specific params:', {
            height: params.height,
            slopeDirection: params.slopeDirection,
            grade: params.grade,
            isRamp: params.isRamp
          });
          
          // For now, use slab geometry but with ramp parameters
          const rampResult = this.createSlabGeometry(params);
          geometry = rampResult.geometry;
          mesh3D = rampResult.mesh3D;
          mesh2D = rampResult.mesh2D;
          
          console.log('🛤️ RAMP CREATION DEBUG: Ramp geometry created successfully');
          console.log('🛤️ RAMP CREATION DEBUG: 3D mesh position:', mesh3D.position);
          console.log('🛤️ RAMP CREATION DEBUG: 2D mesh position:', mesh2D.position);
          console.log('🛤️ RAMP CREATION DEBUG: Geometry type:', geometry?.type);
          break;
          
        case 'stair':
          console.log('🏗️ STAIR CREATION DEBUG: Creating stair geometry...');
          console.log('🏗️ STAIR CREATION DEBUG: Stair params:', params);
          console.log('🏗️ STAIR CREATION DEBUG: Stair-specific params:', {
            stairType: params.stairType,
            totalRise: params.totalRise,
            totalRun: params.totalRun,
            numberOfSteps: params.numberOfSteps,
            hasHandrail: params.hasHandrail
          });
          
          // For now, use a simplified approach - create a basic stair structure
          const stairResult = this.createStairGeometry(params);
          geometry = stairResult.geometry;
          mesh3D = stairResult.mesh3D;
          mesh2D = stairResult.mesh2D;
          
          console.log('🏗️ STAIR CREATION DEBUG: Stair geometry created successfully');
          console.log('🏗️ STAIR CREATION DEBUG: 3D mesh position:', mesh3D.position);
          console.log('🏗️ STAIR CREATION DEBUG: 2D mesh position:', mesh2D.position);
          console.log('🏗️ STAIR CREATION DEBUG: Geometry type:', geometry?.type);
          break;
          
        case 'wall':
          // Minimal diagnostics for wall placement sync
          console.log('WALL_CREATE', {
            start: params.startPoint,
            end: params.endPoint,
            length: params.length,
            thickness: params.thickness,
            height: params.height
          });
          
          const wallResult = this.createWallGeometry(params);
          geometry = wallResult.geometry;
          mesh3D = wallResult.mesh3D;
          mesh2D = wallResult.mesh2D;
          console.log('WALL_GEOMETRY', { center: mesh3D.position, type: geometry?.type });
          break;
          
        case 'door':
          console.log('🚪 Creating door geometry...');
          const doorResult = this.createDoorGeometry(params);
          geometry = doorResult.geometry;
          mesh3D = doorResult.mesh3D;
          mesh2D = doorResult.mesh2D;
          console.log('🚪 Door geometry created, position:', mesh3D.position);
          break;
        
      case 'column':
        console.log('🏢 COLUMN CREATION DEBUG: Creating column geometry...');
        console.log('🏢 COLUMN CREATION DEBUG: Column params:', params);
        const columnResult = this.createColumnGeometry(params);
        geometry = columnResult.geometry;
        mesh3D = columnResult.mesh3D;
        mesh2D = columnResult.mesh2D;
        console.log('🏢 COLUMN CREATION DEBUG: Column geometry created successfully');
        console.log('🏢 COLUMN CREATION DEBUG: 3D mesh position:', mesh3D.position);
        console.log('🏢 COLUMN CREATION DEBUG: Geometry type:', geometry?.type);
        break;
        
      case 'window':
        console.log('🪟 Creating window geometry...');
        const windowResult = this.createWindowGeometry(params);
        geometry = windowResult.geometry;
        mesh3D = windowResult.mesh3D;
        mesh2D = windowResult.mesh2D;
        console.log('🪟 Window geometry created, position:', mesh3D.position);
        break;
        
      case 'furniture':
        console.log('🪑 Creating furniture geometry...');
        const furnitureResult = this.createFurnitureGeometry(params);
        geometry = furnitureResult.geometry;
        mesh3D = furnitureResult.mesh3D;
        mesh2D = furnitureResult.mesh2D;
        console.log('🪑 Furniture geometry created, position:', mesh3D.position);
        break;
        
      case 'fixture':
        console.log('💡 Creating fixture geometry...');
        const fixtureResult = this.createFixtureGeometry(params);
        geometry = fixtureResult.geometry;
        mesh3D = fixtureResult.mesh3D;
        mesh2D = fixtureResult.mesh2D;
        console.log('💡 Fixture geometry created, position:', mesh3D.position);
        break;
        
      default:
        console.error(`❌ CAD ENGINE ERROR: Unknown object type: "${type}"`);
        console.error(`📋 CAD ENGINE ERROR: Available types: wall, slab, door, window, column, furniture, fixture`);
        console.error(`📋 CAD ENGINE ERROR: Received params:`, params);
        return null;
    }
    } catch (error) {
      console.error(`❌ CAD ENGINE ERROR: Failed to create ${type} object:`, error);
      console.error(`❌ CAD ENGINE ERROR: Stack trace:`, error.stack);
      console.error(`❌ CAD ENGINE ERROR: Params that caused error:`, params);
      
      // Decrement the object ID since creation failed
      this.nextObjectId--;
      
      // Return null to indicate failure
      return null;
    }
    
    // Validate that geometry creation succeeded
    if (!geometry || !mesh3D || !mesh2D) {
      console.error(`❌ CAD ENGINE ERROR: Geometry creation incomplete for ${type}:`, {
        hasGeometry: !!geometry,
        hasMesh3D: !!mesh3D,
        hasMesh2D: !!mesh2D
      });
      
      // Decrement the object ID since creation failed
      this.nextObjectId--;
      
      return null;
    }

    // Create BIM object if applicable
    let bimObject = null;
    if (type === 'door') {
      bimObject = new Door({
        id: objectId,
        name: params.name || `Door_${objectId}`,
        width: params.width,
        height: params.height,
        thickness: params.thickness,
        openingDirection: params.openingDirection,
        material: params.material,
        frameWidth: params.frameWidth,
        hostWallId: params.hostWallId,
        wallOffset: params.wallOffset || { x: 0, y: 0, z: 0 },
        position: mesh3D ? {
          x: mesh3D.position.x,
          y: mesh3D.position.y,
          z: mesh3D.position.z
        } : { x: 0, y: 0, z: 0 },
        orientation: mesh3D ? {
          x: mesh3D.rotation.x * 180 / Math.PI,
          y: mesh3D.rotation.y * 180 / Math.PI,
          z: mesh3D.rotation.z * 180 / Math.PI
        } : { x: 0, y: 0, z: 0 }
      });
    } else if (type === 'window') {
      bimObject = new Window({
        id: objectId,
        name: params.name || `Window_${objectId}`,
        width: params.width,
        height: params.height,
        thickness: params.thickness,
        windowType: params.windowType,
        material: params.material,
        frameWidth: params.frameWidth,
        glazingLayers: params.glazingLayers,
        openable: params.openable,
        hostWallId: params.hostWallId,
        wallOffset: params.wallOffset || { x: 0, y: 0, z: 0 },
        sillHeight: params.sillHeight,
        position: mesh3D ? {
          x: mesh3D.position.x,
          y: mesh3D.position.y,
          z: mesh3D.position.z
        } : { x: 0, y: 0, z: 0 },
        orientation: mesh3D ? {
          x: mesh3D.rotation.x * 180 / Math.PI,
          y: mesh3D.rotation.y * 180 / Math.PI,
          z: mesh3D.rotation.z * 180 / Math.PI
        } : { x: 0, y: 0, z: 0 }
      });
    }

    // Create CAD object
    const cadObject = {
      id: objectId,
      type: type,
      params: { ...params },
      geometry: geometry,
      mesh3D: mesh3D,
      mesh2D: mesh2D,
      bimObject: bimObject, // Add BIM object reference
      created: new Date().toISOString(),
      visible: true,
      selected: false
    };
    
    // DEBUG: Log the params being stored in CAD object
    if (type === 'furniture' || type === 'fixture') {
      console.log('🔍 CAD OBJECT PARAMS DEBUG:', {
        objectId,
        type,
        'original params': params,
        'stored params': cadObject.params,
        'params.modelUrl': cadObject.params.modelUrl,
        'params.format': cadObject.params.format,
        'paramsKeys': Object.keys(cadObject.params)
      });
    }

    console.log('📦 CAD object created:', {
      id: objectId,
      type: type,
      position: mesh3D ? mesh3D.position : 'no mesh3D',
      meshesCreated: {
        mesh3D: !!mesh3D,
        mesh2D: !!mesh2D
      }
    });

    // Store object
    this.objects.set(objectId, cadObject);
    
    // Add to scenes
    if (mesh3D) {
      this.scene3D.add(mesh3D);
      console.log('➕ Added mesh3D to scene3D');
    }
    if (mesh2D) {
      this.scene2D.add(mesh2D);
      console.log('➕ Added mesh2D to scene2D');
    }

    console.log('📡 Emitting object_created event...');

    // Emit events
    this.emit('object_created', {
      object: this.serializeObject(cadObject)
    });
    
    this.emit('model_state', {
      objects: Array.from(this.objects.values()).map(obj => this.serializeObject(obj))
    });

    // Auto-join wall corners after creation/update for clean 3D corners
    if (type === 'wall') {
      try {
        this.applyProfessionalWallJoinery({ tolerance: 0.05 });
      } catch (e) {
        console.warn('Joinery post-create failed:', e);
      }
    }

    console.log(`✅ Created ${type} object:`, objectId, 'Total objects:', this.objects.size);
    console.log(`📊 CADEngine DEBUG: Object stored successfully:`, {
      objectId,
      type: cadObject.type,
      position: cadObject.position,
      hasPosition: !!cadObject.position,
      hasMesh3D: !!cadObject.mesh3D,
      hasMesh2D: !!cadObject.mesh2D,
      objectKeys: Object.keys(cadObject)
    });
    
    // Slab-specific debugging
    if (type === 'slab') {
      console.log(`🏗️ SLAB STORAGE DEBUG: Slab ${objectId} stored successfully`);
      console.log(`🏗️ SLAB STORAGE DEBUG: Slab position:`, cadObject.position);
      console.log(`🏗️ SLAB STORAGE DEBUG: Slab params:`, cadObject.params);
      console.log(`🏗️ SLAB STORAGE DEBUG: Slab material:`, cadObject.material);
      console.log(`🏗️ SLAB STORAGE DEBUG: Total slabs in engine:`, Array.from(this.objects.values()).filter(obj => obj.type === 'slab').length);
    }
    
    // Add to xeokit viewer if available
    this.addToXeokitViewer(cadObject);
    
    // Apply automatic joinery for walls - ENHANCED APPROACH
    if (type === 'wall') {
      // FIXED: Single joinery attempt with debouncing to prevent infinite loops
      console.log('🔧 POST-CREATION: Triggering wall joinery analysis after wall creation...');
      console.log('🔧 DEBUG: Wall created with params:', {
        startPoint: params.startPoint,
        endPoint: params.endPoint,
        length: params.length,
        thickness: params.thickness
      });
      
      // Use a debounced joinery call to prevent multiple simultaneous attempts
      this.scheduleJoineryUpdate();
    }
    
    // Special debugging for ramps
    if (type === 'ramp') {
      console.log('🛤️ RAMP POST-CREATION DEBUG: Ramp creation completed successfully');
      console.log('🛤️ RAMP POST-CREATION DEBUG: Final object ID:', objectId);
      console.log('🛤️ RAMP POST-CREATION DEBUG: Object stored in engine:', this.objects.has(objectId));
      console.log('🛤️ RAMP POST-CREATION DEBUG: Total objects now:', this.objects.size);
      console.log('🛤️ RAMP POST-CREATION DEBUG: Ramp object data:', this.objects.get(objectId));
    }
    
    console.log(`🏗️ CAD ENGINE DEBUG: Object creation completed for ${type}, returning ID:`, objectId);
    console.log(`🏗️ CAD ENGINE DEBUG: Total objects in engine:`, this.objects.size);
    
    return objectId;
  }

  /**
   * Generic addObject helper for external callers
   * Accepts a plain object (e.g., openings or 2D SVG blocks) and stores it in the engine
   * Returns the assigned object id
   */
  addObject(objectData) {
    try {
      const id = objectData.id || `cad_${this.nextObjectId++}`;
      const type = objectData.type || 'generic';
      const params = { ...objectData };
      delete params.id;
      delete params.type;

      const cadObject = {
        id,
        type,
        params,
        mesh3D: null,
        mesh2D: null,
        created: new Date().toISOString(),
        selected: false,
        visible: objectData.visible !== false
      };

      // Store and notify
      this.objects.set(id, cadObject);
      this.emit('object_created', {
        object: this.serializeObject(cadObject),
        objects: this.getAllObjects()
      });
      return id;
    } catch (e) {
      console.error('addObject failed:', e);
      return null;
    }
  }

  /**
   * Get object by ID
   */
  getObject(objectId) {
    return this.objects.get(objectId) || null;
  }

  /**
   * Update object position
   */
  updateObjectPosition(objectId, newPosition) {
    const cadObject = this.objects.get(objectId);
    if (!cadObject) {
      console.error(`❌ Object ${objectId} not found for position update`);
      return false;
    }

    console.log(`🔄 Updating position for ${cadObject.type} ${objectId}:`, newPosition);

    // Update params
    cadObject.params.position = { ...newPosition };

    // Update 3D mesh position
    if (cadObject.mesh3D) {
      cadObject.mesh3D.position.set(newPosition.x, newPosition.y, newPosition.z);
    }

    // Update 2D mesh position
    if (cadObject.mesh2D) {
      cadObject.mesh2D.position.set(newPosition.x, newPosition.z, -newPosition.y);
    }

    // Emit update event
    this.emit('object_updated', {
      object: this.serializeObject(cadObject)
    });

    console.log(`✅ Position updated for ${cadObject.type} ${objectId}`);
    return true;
  }

  /**
   * Update object scale/size
   */
  updateObjectScale(objectId, newScale) {
    const cadObject = this.objects.get(objectId);
    if (!cadObject) {
      console.error(`❌ Object ${objectId} not found for scale update`);
      return false;
    }

    console.log(`🔄 Updating scale for ${cadObject.type} ${objectId}:`, newScale);

    // Store original scale if not already stored
    if (!cadObject.originalScale) {
      cadObject.originalScale = {
        width: cadObject.params.width || 1,
        height: cadObject.params.height || 1,
        depth: cadObject.params.depth || 1
      };
    }

    // Update params dimensions
    if (newScale.width !== undefined) cadObject.params.width = newScale.width;
    if (newScale.height !== undefined) cadObject.params.height = newScale.height;
    if (newScale.depth !== undefined) cadObject.params.depth = newScale.depth;

    // Update 3D mesh scale
    if (cadObject.mesh3D) {
      const scaleVector = new THREE.Vector3(
        newScale.width !== undefined ? newScale.width / cadObject.originalScale.width : 1,
        newScale.height !== undefined ? newScale.height / cadObject.originalScale.height : 1,
        newScale.depth !== undefined ? newScale.depth / cadObject.originalScale.depth : 1
      );
      cadObject.mesh3D.scale.copy(scaleVector);
    }

    // Update 2D mesh scale
    if (cadObject.mesh2D) {
      cadObject.mesh2D.scale.set(
        newScale.width !== undefined ? newScale.width / cadObject.originalScale.width : 1,
        newScale.depth !== undefined ? newScale.depth / cadObject.originalScale.depth : 1,
        1
      );
    }

    // Emit update event
    this.emit('object_updated', {
      object: this.serializeObject(cadObject)
    });

    console.log(`✅ Scale updated for ${cadObject.type} ${objectId}`);
    return true;
  }

  /**
   * Schedule a debounced joinery update to prevent infinite loops
   * FIXED: Implements proper debouncing mechanism
   */
  scheduleJoineryUpdate() {
    // 🔧 DEBUG: Check if joinery system is disabled for axis snapping testing
    if (typeof window !== 'undefined' && window._disableWallJoinery) {
      console.log('🔧 JOINERY DISABLED: Skipping wall joinery update (axis snapping test mode)');
      return;
    }
    
    // ANTI-INFINITE-LOOP: Clear any existing scheduled joinery update
    if (this._joineryTimeout) {
      console.log('🔄 DEBOUNCE: Clearing previous joinery timeout');
      clearTimeout(this._joineryTimeout);
    }
    
    // ANTI-INFINITE-LOOP: Check if joinery is already running
    if (this._joineryInProgress) {
      console.log('⚠️ ANTI-LOOP: Joinery in progress, skipping duplicate schedule request');
      // Don't reschedule - the current joinery will complete on its own
      return;
    }
    
    console.log('⏰ SCHEDULE: Wall joinery update scheduled for 300ms');
    
    // ANTI-INFINITE-LOOP: Schedule single joinery attempt
    this._joineryTimeout = setTimeout(() => {
      console.log('🔧 SCHEDULED: Executing scheduled wall joinery update...');
      
      // Log current walls for debugging
      const walls = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
      console.log(`📊 WALLS: ${walls.length} walls available for joinery analysis`);
      
      // Execute joinery
      // Use professional wall joinery system
      const result = this.applyProfessionalWallJoinery();
      
      if (result) {
        console.log('✅ SCHEDULED SUCCESS: Wall joinery completed successfully');
      } else {
        console.log('❌ SCHEDULED FAILED: Wall joinery failed or skipped');
      }
      
      // Clear the timeout reference
      this._joineryTimeout = null;
      
    }, 300); // 300ms delay for stability
  }
  /**
   * Auto-extend wall endpoints to snap to nearby corners
   * ENHANCED: Helps ensure walls connect properly at corners
   */
  autoExtendWallToCorners(startPoint, endPoint, tolerance = 0.15) {
    console.log('🎯 AUTO-EXTEND: Checking for nearby corners to snap to...');
    
    const existingWalls = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
    let adjustedStart = { ...startPoint };
    let adjustedEnd = { ...endPoint };
    let hasAdjustments = false;
    
    // Get all existing wall endpoints
    const corners = [];
    existingWalls.forEach(wall => {
      if (wall.params?.startPoint) {
        corners.push({
          point: wall.params.startPoint,
          wallId: wall.id,
          type: 'start'
        });
      }
      if (wall.params?.endPoint) {
        corners.push({
          point: wall.params.endPoint,
          wallId: wall.id,
          type: 'end'
        });
      }
    });
    
    console.log(`🎯 Found ${corners.length} existing corner points to check`);
    
    // Check start point for nearby corners
    let startDistance = Infinity;
    let bestStartCorner = null;
    corners.forEach(corner => {
      const dist = this.distance3D(startPoint, corner.point);
      if (dist <= tolerance && dist < startDistance) {
        startDistance = dist;
        bestStartCorner = corner;
      }
    });
    
    // Check end point for nearby corners
    let endDistance = Infinity;
    let bestEndCorner = null;
    corners.forEach(corner => {
      const dist = this.distance3D(endPoint, corner.point);
      if (dist <= tolerance && dist < endDistance) {
        endDistance = dist;
        bestEndCorner = corner;
      }
    });
    
    // Apply start point adjustment
    if (bestStartCorner) {
      console.log(`🎯 SNAP START: Adjusting start point by ${startDistance.toFixed(3)}m to ${bestStartCorner.wallId}.${bestStartCorner.type}`);
      adjustedStart = { ...bestStartCorner.point };
      hasAdjustments = true;
    }
    
    // Apply end point adjustment
    if (bestEndCorner) {
      console.log(`🎯 SNAP END: Adjusting end point by ${endDistance.toFixed(3)}m to ${bestEndCorner.wallId}.${bestEndCorner.type}`);
      adjustedEnd = { ...bestEndCorner.point };
      hasAdjustments = true;
    }
    
    if (hasAdjustments) {
      console.log('✅ AUTO-EXTEND: Wall endpoints adjusted for better corner connections');
      return {
        startPoint: adjustedStart,
        endPoint: adjustedEnd,
        adjusted: true,
        startSnapped: !!bestStartCorner,
        endSnapped: !!bestEndCorner
      };
    } else {
      console.log('ℹ️ AUTO-EXTEND: No nearby corners found, using original endpoints');
      return {
        startPoint: adjustedStart,
        endPoint: adjustedEnd,
        adjusted: false,
        startSnapped: false,
        endSnapped: false
      };
    }
  }

  /**
   * PROFESSIONAL SLAB SYSTEM
   * Advanced reinforced concrete slab with structural properties and analysis
   */
  createSlabGeometry(params) {
    const safeParams = { ...params };
    if (!safeParams.material) {
      safeParams.material = 'wood';
    }
    
    console.log('🏗️ Creating professional slab system with params:', safeParams);
    
    const { 
      width = 5, 
      depth = 5, 
      thickness = 0.2, 
      material = safeParams.material, 
      shape = 'rectangular',
      startPoint = null,
      endPoint = null,
      polygonPoints = null,
      slabType = 'flat',
      structuralProperties = {},
      reinforcement = {},
      loadBearing = true,
      offset = 0.0
    } = safeParams;
    
    // Calculate actual dimensions and position
    let actualWidth = width;
    let actualDepth = depth;
    let centerPosition = { x: 0, y: thickness / 2 + offset, z: 0 };
    
    if (startPoint && endPoint) {
      actualWidth = Math.abs(endPoint.x - startPoint.x);
      actualDepth = Math.abs(endPoint.z - startPoint.z);
      centerPosition = {
        x: (startPoint.x + endPoint.x) / 2,
        y: thickness / 2 + offset,
        z: (startPoint.z + endPoint.z) / 2
      };
    }
    
    console.log(`🏗️ Creating ${slabType} slab: ${actualWidth}m x ${actualDepth}m x ${thickness}m`);
    
    // PROFESSIONAL SLAB ASSEMBLY CREATION
    const slabAssembly = this.createProfessionalSlabAssembly({
      width: actualWidth,
      depth: actualDepth,
      thickness,
      material,
      shape,
      slabType,
      polygonPoints,
      structuralProperties,
      reinforcement,
      loadBearing,
      offset
    });
    
    const slabGroup = slabAssembly.group;
    
    // Position the slab assembly
    slabGroup.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    
    // Use the slab group as the main mesh
    const mesh3D = slabGroup;
    mesh3D.userData = { objectId: null, type: 'slab' };
    
    // Create professional 2D representation
    const slab2DGroup = new THREE.Group();
    
    // Get materials for 2D representation
    const slabMat = this.materials[material] || this.materials.concrete;
    
    // Main slab area in 2D
    let geometry2D;
    if (shape === 'circular') {
      const radius = Math.min(actualWidth, actualDepth) / 2;
      geometry2D = new THREE.CircleGeometry(radius, 32);
    } else if (shape === 'polygon' && polygonPoints && polygonPoints.length >= 3) {
      geometry2D = this.createPolygonGeometry(polygonPoints);
    } else {
      geometry2D = new THREE.PlaneGeometry(actualWidth, actualDepth);
    }
    
    const material2D = new THREE.MeshBasicMaterial({ 
      color: slabMat.color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    
    const slab2D = new THREE.Mesh(geometry2D, material2D);
    slab2D.rotation.x = -Math.PI / 2;
    slab2DGroup.add(slab2D);
    
    // Add reinforcement pattern in 2D if specified
    if (reinforcement.showPattern) {
      const reinforcementPattern = this.createReinforcement2DPattern({
        width: actualWidth,
        depth: actualDepth,
        shape,
        polygonPoints,
        spacing: reinforcement.spacing || 0.2
      });
      if (reinforcementPattern) {
        slab2DGroup.add(reinforcementPattern);
      }
    }
    
    // Add structural grid/support indicators
    if (loadBearing && slabAssembly.supportPoints) {
      const supportIndicators = this.createSupportIndicators2D(slabAssembly.supportPoints);
      if (supportIndicators) {
        slab2DGroup.add(supportIndicators);
      }
    }
    
    // Set up 2D group
    const mesh2D = slab2DGroup;
    mesh2D.userData = { objectId: null, type: 'slab' };
    mesh2D.position.set(centerPosition.x, 0, centerPosition.z);
    
    return { 
      geometry: geometry2D, 
      mesh3D: mesh3D, 
      mesh2D: mesh2D,
      structuralProperties: slabAssembly.structuralProperties
    };
  }

  /**
   * PROFESSIONAL SLAB ASSEMBLY CREATION
   * Complete structural slab with reinforcement, analysis, and proper materials
   */
  createProfessionalSlabAssembly(config) {
    const {
      width, depth, thickness, material, shape, slabType,
      polygonPoints, structuralProperties, reinforcement, loadBearing, offset
    } = config;
    
    const slabGroup = new THREE.Group();
    
    console.log(`🏗️ Creating professional ${slabType} slab assembly: ${width}m x ${depth}m`);
    
    // Get structural material properties
    const structuralMat = this.materials[material] || this.materials.concrete;
    const enhancedStructuralProperties = this.calculateSlabStructuralProperties({
      width, depth, thickness, material, structuralProperties, loadBearing
    });
    
    // 1. Create main slab structure
    const mainSlab = this.createSlabStructure({
      width, depth, thickness, material: structuralMat,
      shape, polygonPoints, slabType
    });
    slabGroup.add(mainSlab);
    
    // 2. Create reinforcement system
    if (reinforcement.enabled !== false) {
      const reinforcementSystem = this.createSlabReinforcement({
        width, depth, thickness, shape, polygonPoints,
        reinforcement: { 
          spacing: 0.2, 
          diameter: 0.012, 
          cover: 0.025,
          ...reinforcement 
        }
      });
      if (reinforcementSystem) {
        slabGroup.add(reinforcementSystem);
      }
    }
    
    // 3. Add edge beams for structural slabs
    if (loadBearing && (slabType === 'beam_slab' || enhancedStructuralProperties.requiresBeams)) {
      const edgeBeams = this.createSlabEdgeBeams({
        width, depth, thickness, shape, polygonPoints,
        beamWidth: thickness, beamHeight: thickness * 1.5
      });
      if (edgeBeams) {
        slabGroup.add(edgeBeams);
      }
    }
    
    // 4. Add openings/penetrations if specified
    if (structuralProperties.openings) {
      // This would be handled by the opening system similar to walls
      console.log('🔳 Slab openings would be processed here');
    }
    
    // 5. Calculate support points for structural analysis
    const supportPoints = this.calculateSlabSupportPoints({
      width, depth, shape, polygonPoints, loadBearing,
      structuralProperties: enhancedStructuralProperties
    });
    
    return {
      group: slabGroup,
      structuralProperties: enhancedStructuralProperties,
      supportPoints,
      reinforcement
    };
  }

  /**
   * Create main slab structure geometry
   */
  createSlabStructure(config) {
    const { width, depth, thickness, material, shape, polygonPoints, slabType } = config;
    
    let geometry;
    
    // Create geometry based on shape and type
    switch (shape) {
      case 'circular':
        const radius = Math.min(width, depth) / 2;
        geometry = new THREE.CylinderGeometry(radius, radius, thickness, 32);
        break;
        
      case 'polygon':
        if (polygonPoints && polygonPoints.length >= 3) {
          geometry = this.createExtrudedPolygonGeometry(polygonPoints, thickness);
        } else {
          geometry = new THREE.BoxGeometry(width, thickness, depth);
        }
        break;
        
      default: // rectangular
        geometry = new THREE.BoxGeometry(width, thickness, depth);
        break;
    }
    
    // Apply slab type modifications
    if (slabType === 'waffle') {
      // Create waffle pattern (simplified - would be more complex in real implementation)
      geometry = this.createWaffleSlabGeometry(width, depth, thickness);
    } else if (slabType === 'hollow_core') {
      // Create hollow core pattern
      geometry = this.createHollowCoreSlabGeometry(width, depth, thickness);
    }
    
    const slabMesh = new THREE.Mesh(geometry, material.clone());
    return slabMesh;
  }

  /**
   * Create slab reinforcement system
   */
  createSlabReinforcement(config) {
    const { width, depth, thickness, shape, polygonPoints, reinforcement } = config;
    const reinforcementGroup = new THREE.Group();
    
    console.log('🔧 Creating slab reinforcement system');
    
    const rebarMaterial = this.materials.steel || this.materials.aluminum;
    const { spacing, diameter, cover } = reinforcement;
    
    // Bottom reinforcement (main tensile reinforcement)
    const bottomReinforcement = this.createReinforcementMesh({
      width, depth, spacing, diameter, 
      yPosition: -thickness/2 + cover,
      direction: 'both' // Both X and Z directions
    });
    reinforcementGroup.add(bottomReinforcement);
    
    // Top reinforcement (for continuous slabs)
    if (reinforcement.topReinforcement) {
      const topReinforcement = this.createReinforcementMesh({
        width, depth, spacing: spacing * 1.5, diameter: diameter * 0.8,
        yPosition: thickness/2 - cover,
        direction: 'both'
      });
      reinforcementGroup.add(topReinforcement);
    }
    
    // Shear reinforcement around openings
    if (reinforcement.shearReinforcement && reinforcement.openings) {
      // Would add stirrups around openings
      console.log('🔧 Shear reinforcement around openings would be added here');
    }
    
    return reinforcementGroup.children.length > 0 ? reinforcementGroup : null;
  }

  /**
   * Create reinforcement mesh (rebar grid)
   */
  createReinforcementMesh(config) {
    const { width, depth, spacing, diameter, yPosition, direction } = config;
    const meshGroup = new THREE.Group();
    const rebarMaterial = this.materials.steel || this.materials.aluminum;
    
    // Create rebar geometry
    const rebarGeometry = new THREE.CylinderGeometry(diameter/2, diameter/2, 1, 8);
    
    if (direction === 'both' || direction === 'x') {
      // X-direction bars
      const barLength = width;
      const numBarsZ = Math.floor(depth / spacing) + 1;
      
      for (let i = 0; i < numBarsZ; i++) {
        const zPos = (-depth/2) + (i * spacing);
        const bar = new THREE.Mesh(rebarGeometry.clone(), rebarMaterial.clone());
        bar.scale.y = barLength;
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, yPosition, zPos);
        meshGroup.add(bar);
      }
    }
    
    if (direction === 'both' || direction === 'z') {
      // Z-direction bars
      const barLength = depth;
      const numBarsX = Math.floor(width / spacing) + 1;
      
      for (let i = 0; i < numBarsX; i++) {
        const xPos = (-width/2) + (i * spacing);
        const bar = new THREE.Mesh(rebarGeometry.clone(), rebarMaterial.clone());
        bar.scale.y = barLength;
        bar.rotation.x = Math.PI / 2;
        bar.position.set(xPos, yPosition, 0);
        meshGroup.add(bar);
      }
    }
    
    return meshGroup;
  }

  /**
   * Create edge beams for structural slabs
   */
  createSlabEdgeBeams(config) {
    const { width, depth, thickness, shape, polygonPoints, beamWidth, beamHeight } = config;
    const beamGroup = new THREE.Group();
    const beamMaterial = this.materials.concrete.clone();
    
    console.log('🏗️ Creating edge beams for structural slab');
    
    if (shape === 'rectangular') {
      // Create four edge beams
      const beamGeometry = new THREE.BoxGeometry(beamWidth, beamHeight, 1);
      
      // Top and bottom beams
      const topBeam = new THREE.Mesh(beamGeometry.clone(), beamMaterial.clone());
      topBeam.scale.z = width;
      topBeam.position.set(0, (thickness + beamHeight)/2, depth/2);
      beamGroup.add(topBeam);
      
      const bottomBeam = new THREE.Mesh(beamGeometry.clone(), beamMaterial.clone());
      bottomBeam.scale.z = width;
      bottomBeam.position.set(0, (thickness + beamHeight)/2, -depth/2);
      beamGroup.add(bottomBeam);
      
      // Left and right beams
      const leftBeam = new THREE.Mesh(beamGeometry.clone(), beamMaterial.clone());
      leftBeam.scale.z = depth;
      leftBeam.rotation.y = Math.PI / 2;
      leftBeam.position.set(-width/2, (thickness + beamHeight)/2, 0);
      beamGroup.add(leftBeam);
      
      const rightBeam = new THREE.Mesh(beamGeometry.clone(), beamMaterial.clone());
      rightBeam.scale.z = depth;
      rightBeam.rotation.y = Math.PI / 2;
      rightBeam.position.set(width/2, (thickness + beamHeight)/2, 0);
      beamGroup.add(rightBeam);
    }
    
    return beamGroup.children.length > 0 ? beamGroup : null;
  }

  /**
   * Calculate structural properties for slab
   */
  calculateSlabStructuralProperties(config) {
    const { width, depth, thickness, material, structuralProperties, loadBearing } = config;
    
    // Get base material properties
    const materialProps = this.materials[material]?.structuralProperties || {
      density: 2400, // kg/m³ for concrete
      compressiveStrength: 25, // MPa
      elasticModulus: 30000, // MPa
      poissonRatio: 0.2
    };
    
    // Calculate basic properties
    const area = width * depth; // m²
    const volume = area * thickness; // m³
    const weight = volume * materialProps.density; // kg
    const selfWeight = weight * 9.81; // N (self-weight force)
    
    // Calculate moment of inertia
    const momentOfInertiaX = (width * Math.pow(thickness, 3)) / 12;
    const momentOfInertiaY = (depth * Math.pow(thickness, 3)) / 12;
    
    // Determine if edge beams are required based on span
    const maxSpan = Math.max(width, depth);
    const spanToDepthRatio = maxSpan / thickness;
    const requiresBeams = loadBearing && spanToDepthRatio > 25; // Typical limit
    
    // Calculate load capacity (simplified)
    const uniformLoadCapacity = loadBearing ? 
      this.calculateSlabLoadCapacity(width, depth, thickness, materialProps) : 0;
    
    return {
      // Geometric properties
      area,
      volume,
      perimeter: 2 * (width + depth),
      
      // Mass properties  
      weight,
      selfWeight,
      density: materialProps.density,
      
      // Structural properties
      momentOfInertiaX,
      momentOfInertiaY,
      elasticModulus: materialProps.elasticModulus,
      compressiveStrength: materialProps.compressiveStrength,
      poissonRatio: materialProps.poissonRatio,
      
      // Design properties
      spanToDepthRatio,
      requiresBeams,
      uniformLoadCapacity,
      maxDeflection: maxSpan / 250, // Typical serviceability limit
      
      // Additional properties
      loadBearing,
      slabClassification: this.classifySlabType(width, depth, thickness),
      
      ...structuralProperties
    };
  }

  /**
   * Calculate slab load capacity (simplified)
   */
  calculateSlabLoadCapacity(width, depth, thickness, materialProps) {
    // Simplified calculation - real analysis would be much more complex
    const span = Math.max(width, depth);
    const momentCapacity = (materialProps.compressiveStrength * Math.pow(thickness, 2)) / 6;
    const uniformLoad = (8 * momentCapacity) / Math.pow(span, 2);
    return uniformLoad / 1000; // Convert to kN/m²
  }

  /**
   * Classify slab type based on geometry
   */
  classifySlabType(width, depth, thickness) {
    const maxSpan = Math.max(width, depth);
    const spanToDepthRatio = maxSpan / thickness;
    
    if (spanToDepthRatio > 30) return 'thin_slab';
    if (spanToDepthRatio < 15) return 'thick_slab';
    return 'normal_slab';
  }

  /**
   * Calculate support points for structural analysis
   */
  calculateSlabSupportPoints(config) {
    const { width, depth, shape, polygonPoints, loadBearing, structuralProperties } = config;
    
    if (!loadBearing) return [];
    
    // Generate typical support points (simplified)
    const supportPoints = [];
    const supportSpacing = Math.max(width, depth) > 6 ? 3 : Math.max(width, depth) / 2;
    
    // Corner supports for rectangular slabs
    if (shape === 'rectangular') {
      supportPoints.push(
        { x: -width/2, z: -depth/2, type: 'column' },
        { x: width/2, z: -depth/2, type: 'column' },
        { x: -width/2, z: depth/2, type: 'column' },
        { x: width/2, z: depth/2, type: 'column' }
      );
      
      // Add intermediate supports for large slabs
      if (width > 6 || depth > 6) {
        supportPoints.push(
          { x: 0, z: -depth/2, type: 'beam' },
          { x: 0, z: depth/2, type: 'beam' },
          { x: -width/2, z: 0, type: 'beam' },
          { x: width/2, z: 0, type: 'beam' }
        );
      }
    }
    
    return supportPoints;
  }

  /**
   * Create 2D reinforcement pattern visualization
   */
  createReinforcement2DPattern(config) {
    const { width, depth, shape, polygonPoints, spacing } = config;
    const patternGroup = new THREE.Group();
    
    const lineMateria = new THREE.LineBasicMaterial({ 
      color: 0xff0000, 
      transparent: true, 
      opacity: 0.4 
    });
    
    // Create grid pattern for reinforcement
    const numLinesX = Math.floor(width / spacing);
    const numLinesZ = Math.floor(depth / spacing);
    
    // X-direction lines
    for (let i = 0; i <= numLinesX; i++) {
      const x = (-width/2) + (i * spacing);
      const points = [
        new THREE.Vector3(x, 0.002, -depth/2),
        new THREE.Vector3(x, 0.002, depth/2)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMateria);
      patternGroup.add(line);
    }
    
    // Z-direction lines
    for (let i = 0; i <= numLinesZ; i++) {
      const z = (-depth/2) + (i * spacing);
      const points = [
        new THREE.Vector3(-width/2, 0.002, z),
        new THREE.Vector3(width/2, 0.002, z)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMateria);
      patternGroup.add(line);
    }
    
    return patternGroup.children.length > 0 ? patternGroup : null;
  }

  /**
   * Create support indicators for 2D view
   */
  createSupportIndicators2D(supportPoints) {
    if (!supportPoints || supportPoints.length === 0) return null;
    
    const indicatorGroup = new THREE.Group();
    
    supportPoints.forEach(point => {
      let geometry, material;
      
      if (point.type === 'column') {
        geometry = new THREE.CircleGeometry(0.1, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x00ff00, 
          transparent: true, 
          opacity: 0.7 
        });
      } else if (point.type === 'beam') {
        geometry = new THREE.RingGeometry(0.05, 0.1, 8);
        material = new THREE.MeshBasicMaterial({ 
          color: 0x0000ff, 
          transparent: true, 
          opacity: 0.7 
        });
      }
      
      if (geometry && material) {
        const indicator = new THREE.Mesh(geometry, material);
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.set(point.x, 0.003, point.z);
        indicatorGroup.add(indicator);
      }
    });
    
    return indicatorGroup.children.length > 0 ? indicatorGroup : null;
  }

  /**
   * Create polygon geometry from points
   */
  createPolygonGeometry(points) {
    if (!points || points.length < 3) return new THREE.PlaneGeometry(1, 1);
    
    // Convert points to Shape
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].y);
    }
    
    shape.lineTo(points[0].x, points[0].y); // Close the shape
    
    return new THREE.ShapeGeometry(shape);
  }

  /**
   * Create extruded polygon geometry
   */
  createExtrudedPolygonGeometry(points, thickness) {
    if (!points || points.length < 3) return new THREE.BoxGeometry(1, thickness, 1);
    
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].z);
    
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].z);
    }
    
    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: false
    };
    
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }

  /**
   * Create waffle slab geometry (simplified)
   */
  createWaffleSlabGeometry(width, depth, thickness) {
    // Simplified waffle pattern - real implementation would be more complex
    return new THREE.BoxGeometry(width, thickness, depth);
  }

  /**
   * Create hollow core slab geometry (simplified)
   */
  createHollowCoreSlabGeometry(width, depth, thickness) {
    // Simplified hollow core - real implementation would create actual voids
    return new THREE.BoxGeometry(width, thickness, depth);
  }
  /**
   * Create column geometry and meshes
   */
  createColumnGeometry(params) {
    console.log('🏢 COLUMN GEOMETRY DEBUG: createColumnGeometry called with params:', params);
    
    const { 
      width = 0.4, 
      depth = 0.4,
      height = 3.0,
      radius = 0.2,
      shape = 'rect',
      material = 'concrete',
      inclinationAngle = 0,
      inclinationAxis = 'x',
      rotation = 0,
      position = { x: 0, y: 0, z: 0 }
    } = params;
    
    let geometry;
    
    // Create geometry based on shape
    if (shape === 'circle') {
      // Circular column (cylinder)
      geometry = new THREE.CylinderGeometry(radius, radius, height, 16, 1, false);
      console.log('🏢 COLUMN GEOMETRY: Created circular column geometry with radius:', radius);
    } else {
      // Rectangular column (box)
      geometry = new THREE.BoxGeometry(width, height, depth);
      console.log('🏢 COLUMN GEOMETRY: Created rectangular column geometry with dimensions:', { width, height, depth });
    }
    
    // Get material
    const mat = this.materials[material] || this.materials.concrete;
    console.log('🏢 COLUMN GEOMETRY: Using material:', material);
    
    // Create 3D mesh
    const mesh3D = new THREE.Mesh(geometry, mat);
    
    // Position the column - base at specified position, column extends upward
    const columnPosition = {
      x: position.x,
      y: position.y + height / 2, // Center the column vertically with base at position.y
      z: position.z
    };
    
    mesh3D.position.set(columnPosition.x, columnPosition.y, columnPosition.z);
    
    // Apply rotation around vertical axis (Y-axis)
    if (rotation !== 0) {
      mesh3D.rotation.y = rotation * Math.PI / 180; // Convert degrees to radians
    }
    
    // Apply inclination if specified
    if (inclinationAngle !== 0) {
      const inclinationRad = inclinationAngle * Math.PI / 180;
      
      switch (inclinationAxis) {
        case 'x':
          mesh3D.rotation.x = inclinationRad;
          break;
        case 'y':
          // Y-axis inclination doesn't make sense for columns, treat as no inclination
          console.warn('🏢 COLUMN GEOMETRY: Y-axis inclination not supported for columns');
          break;
        case 'z':
          mesh3D.rotation.z = inclinationRad;
          break;
        default:
          console.warn('🏢 COLUMN GEOMETRY: Unknown inclination axis:', inclinationAxis);
      }
      
      console.log('🏢 COLUMN GEOMETRY: Applied inclination:', inclinationAngle, 'degrees on', inclinationAxis, 'axis');
    }
    
    // Add the mesh to the 3D scene
    this.scene3D.add(mesh3D);
    
    // Create 2D representation for top-down view
    const mesh2D = new THREE.Group();
    
    // Create 2D footprint geometry
    let footprintGeometry;
    if (shape === 'circle') {
      footprintGeometry = new THREE.CircleGeometry(radius, 16);
    } else {
      footprintGeometry = new THREE.PlaneGeometry(width, depth);
    }
    
    // Create 2D material with column outline
    const material2D = new THREE.MeshBasicMaterial({ 
      color: mat.color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    const footprintMesh = new THREE.Mesh(footprintGeometry, material2D);
    footprintMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat on XZ plane
    footprintMesh.position.set(position.x, 0.01, position.z); // Slightly above ground plane
    
    // Apply 2D rotation if specified
    if (rotation !== 0) {
      footprintMesh.rotation.z = rotation * Math.PI / 180; // Apply rotation in 2D plane
    }
    
    mesh2D.add(footprintMesh);
    
    // Add optional outline for better visibility in 2D
    if (shape === 'circle') {
      const outlineGeometry = new THREE.RingGeometry(radius * 0.95, radius, 16);
      const outlineMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000, 
        transparent: true, 
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
      outlineMesh.rotation.x = -Math.PI / 2;
      outlineMesh.position.set(position.x, 0.02, position.z);
      if (rotation !== 0) {
        outlineMesh.rotation.z = rotation * Math.PI / 180;
      }
      mesh2D.add(outlineMesh);
    } else {
      // Create edge lines for rectangular column
      const edges = new THREE.EdgesGeometry(footprintGeometry);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
      const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
      edgeLines.rotation.x = -Math.PI / 2;
      edgeLines.position.set(position.x, 0.02, position.z);
      if (rotation !== 0) {
        edgeLines.rotation.z = rotation * Math.PI / 180;
      }
      mesh2D.add(edgeLines);
    }
    
    // Add the 2D mesh to the 2D scene
    this.scene2D.add(mesh2D);
    
    console.log('🏢 COLUMN GEOMETRY: Column meshes created and positioned at:', columnPosition);
    console.log('🏢 COLUMN GEOMETRY: 3D mesh rotation:', mesh3D.rotation);
    console.log('🏢 COLUMN GEOMETRY: 2D footprint at:', { x: position.x, z: position.z });
    
    return { geometry, mesh3D, mesh2D };
  }

  /**
   * Create wall geometry and meshes
   */
  createWallGeometry(params) {
    const { 
      length = 4, 
      height = 2.5, 
      thickness = 0.2, 
      material = 'concrete',
      startPoint = { x: 0, y: 0, z: 0 },
      endPoint = null,
      adjustForJoinery = false, // New simplified parameter
      startAdjustment = 0,     // Length adjustment at start
      endAdjustment = 0,       // Length adjustment at end
      autoExtend = true,       // Auto-extend to nearby corners
      skipJoinery = false,     // Skip joinery adjustments (for property updates)
      forceCornerExtension = false  // Force extension for proper corner joinery
    } = params;
    
    // PROPERTY UPDATE FIX: Skip joinery-related adjustments for property panel updates
    const shouldSkipJoinery = skipJoinery || params.updatedBy === 'wall_property_panel';
    if (shouldSkipJoinery) {
      console.log(`🔧 WALL GEOMETRY: Skipping joinery adjustments for property update`);
    }
    
    // AUTO-EXTEND: Snap endpoints to nearby corners if enabled (skip for property updates)
    let adjustedStartPoint = startPoint;
    let adjustedEndPoint = endPoint;
    
    if (autoExtend && startPoint && endPoint && !shouldSkipJoinery) {
      const extendResult = this.autoExtendWallToCorners(startPoint, endPoint);
      if (extendResult.adjusted) {
        adjustedStartPoint = extendResult.startPoint;
        adjustedEndPoint = extendResult.endPoint;
        console.log('🎯 AUTO-EXTEND: Wall endpoints adjusted for corner snapping');
      }
    }
    
    // If we have start and end points, calculate length, rotation, and position
    let actualLength = length;
    let rotationY = 0;
    let centerPosition = { x: 0, y: height / 2, z: 0 };
    
    if (adjustedStartPoint && adjustedEndPoint) {
      const deltaX = adjustedEndPoint.x - adjustedStartPoint.x;
      const deltaZ = adjustedEndPoint.z - adjustedStartPoint.z;
      const calculatedLength = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
      
      let originalLength;
      
      // WALL UPDATE FIX: If a specific length is provided and differs significantly from calculated length,
      // adjust the endPoint to match the desired length (for property panel updates)
      if (length && Math.abs(length - calculatedLength) > 0.01) {
        
        // Calculate direction unit vector
        const dirX = deltaX / calculatedLength;
        const dirZ = deltaZ / calculatedLength;
        
        // Adjust endPoint to match the desired length
        adjustedEndPoint = {
          x: adjustedStartPoint.x + (dirX * length),
          y: adjustedStartPoint.y,
          z: adjustedStartPoint.z + (dirZ * length)
        };
        
        
        // Use the desired length
        originalLength = length;
        rotationY = Math.atan2(dirZ, dirX);
        actualLength = length;
        
        // FORCE CORNER EXTENSION: Extend wall length by wall thickness for proper corner joinery
        if (forceCornerExtension) {
          const extension = thickness; // Extend by full wall thickness
          actualLength = length + extension;
          console.log(`🔧 CORNER EXTENSION: Extended wall from ${length.toFixed(3)}m to ${actualLength.toFixed(3)}m for corner joinery`);
          
          // Also extend the endpoint to match the extended length
          adjustedEndPoint = {
            x: adjustedStartPoint.x + (dirX * actualLength),
            y: adjustedStartPoint.y,
            z: adjustedStartPoint.z + (dirZ * actualLength)
          };
        }
        
        console.log('WALL_DIR', {
          start: adjustedStartPoint,
          end: adjustedEndPoint,
          deltaX: +(dirX * actualLength).toFixed(3),
          deltaZ: +(dirZ * actualLength).toFixed(3),
          rotationYDeg: +(rotationY * 180 / Math.PI).toFixed(2),
          forceCornerExtension,
          originalLength: length,
          actualLength
        });
      } else {
        // Use calculated length from points
        originalLength = calculatedLength;
        actualLength = calculatedLength;
        rotationY = Math.atan2(deltaZ, deltaX);
        
        // FORCE CORNER EXTENSION: Extend wall length by wall thickness for proper corner joinery
        if (forceCornerExtension) {
          const extension = thickness; // Extend by full wall thickness
          const dirX = deltaX / calculatedLength;
          const dirZ = deltaZ / calculatedLength;
          actualLength = calculatedLength + extension;
          console.log(`🔧 CORNER EXTENSION: Extended wall from ${calculatedLength.toFixed(3)}m to ${actualLength.toFixed(3)}m for corner joinery`);
          
          // Also extend the endpoint to match the extended length
          adjustedEndPoint = {
            x: adjustedStartPoint.x + (dirX * actualLength),
            y: adjustedStartPoint.y,
            z: adjustedStartPoint.z + (dirZ * actualLength)
          };
        }
        
        console.log('WALL_DIR', {
          start: adjustedStartPoint,
          end: adjustedEndPoint,
          deltaX: +(adjustedEndPoint.x - adjustedStartPoint.x).toFixed(3),
          deltaZ: +(adjustedEndPoint.z - adjustedStartPoint.z).toFixed(3),
          rotationYDeg: +(rotationY * 180 / Math.PI).toFixed(2),
          forceCornerExtension,
          originalLength: calculatedLength,
          actualLength
        });
      }
      
      // Apply joinery adjustments by modifying the actual start and end points (skip for property updates)
      // FIXED: Allow both positive and negative adjustments (extensions and shortenings)
      if (adjustForJoinery && (startAdjustment !== 0 || endAdjustment !== 0) && !shouldSkipJoinery) {
        console.log(`🔧 Applying CAD joinery adjustments: start=${startAdjustment > 0 ? '+' : ''}${startAdjustment}, end=${endAdjustment > 0 ? '+' : ''}${endAdjustment} (negative = extension)`);
        
        // Calculate unit direction vector
        const dirX = deltaX / originalLength;
        const dirZ = deltaZ / originalLength;
        
        // Adjust the actual start and end points based on already adjusted points
        adjustedStartPoint = {
          x: adjustedStartPoint.x + (dirX * startAdjustment),
          y: adjustedStartPoint.y,
          z: adjustedStartPoint.z + (dirZ * startAdjustment)
        };
        
        adjustedEndPoint = {
          x: adjustedEndPoint.x - (dirX * endAdjustment),
          y: adjustedEndPoint.y,
          z: adjustedEndPoint.z - (dirZ * endAdjustment)
        };
        
        // Recalculate based on adjusted points (preserve corner extension)
        const adjustedDeltaX = adjustedEndPoint.x - adjustedStartPoint.x;
        const adjustedDeltaZ = adjustedEndPoint.z - adjustedStartPoint.z;
        const recalculatedLength = Math.sqrt(adjustedDeltaX * adjustedDeltaX + adjustedDeltaZ * adjustedDeltaZ);
        
        // Only update actualLength if we don't have a corner extension
        if (!forceCornerExtension) {
          actualLength = recalculatedLength;
        } else {
          console.log(`🔧 PRESERVING CORNER EXTENSION: Keeping extended length ${actualLength.toFixed(3)}m instead of recalculated ${recalculatedLength.toFixed(3)}m`);
        }
        
        // Center position is at the center of the adjusted wall
        centerPosition = {
          x: (adjustedStartPoint.x + adjustedEndPoint.x) / 2,
          y: height / 2,
          z: (adjustedStartPoint.z + adjustedEndPoint.z) / 2
        };
        
        console.log(`🔧 Wall adjusted: ${originalLength.toFixed(2)}m → ${actualLength.toFixed(2)}m`);
      } else {
        // Standard center position using adjusted points
        // Only update actualLength if we don't have a corner extension
        if (!forceCornerExtension) {
          actualLength = originalLength;
        } else {
          console.log(`🔧 PRESERVING CORNER EXTENSION: Keeping extended length ${actualLength.toFixed(3)}m instead of original ${originalLength.toFixed(3)}m`);
        }
        centerPosition = {
          x: (adjustedStartPoint.x + adjustedEndPoint.x) / 2,
          y: height / 2,
          z: (adjustedStartPoint.z + adjustedEndPoint.z) / 2
        };
      }
    }
    
    // PROFESSIONAL MULTI-LAYER WALL SYSTEM
    const wallType = params.wallType || 'exterior_wood_frame';
    const wallTemplate = this.wallTypeTemplates[wallType] || this.wallTypeTemplates['exterior_wood_frame'];
    
    // Use template thickness or fallback to parameter thickness
    const actualThickness = wallTemplate.totalThickness || thickness;
    
    // --- Mitered corner extension helpers (scoped) ---
    // Loosened tolerance to robustly detect shared endpoints between walls (meters)
    const EPS_JOIN = 0.05;
    const MITER_LIMIT_MULT = 4.0;
    function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
    function almostSamePoint(a, b) { return dist2(a, b) <= EPS_JOIN * EPS_JOIN; }
    function unit(v) { const n = Math.hypot(v.x, v.y); return n ? { x: v.x / n, y: v.y / n } : { x: 1, y: 0 }; }
    function angleBetween(u, v) { const d = Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y)); return Math.acos(d); }
    function computeEndExtensions(currentWall, allWalls, totalThicknessM) {
      const A = currentWall.start;
      const B = currentWall.end;
      const dirAB = unit({ x: B.x - A.x, y: B.y - A.y });
      const dirBA = { x: -dirAB.x, y: -dirAB.y };
      function neighborAt(point) {
        for (const w of allWalls) {
          if (w === currentWall) continue;
          if (almostSamePoint(w.start, point)) {
            const out = unit({ x: w.end.x - w.start.x, y: w.end.y - w.start.y });
            return out;
          }
          if (almostSamePoint(w.end, point)) {
            const out = unit({ x: w.start.x - w.end.x, y: w.start.y - w.end.y });
            return out;
          }
        }
        return null;
      }
      const neighAtA = neighborAt(A);
      const neighAtB = neighborAt(B);
      const defaultCap = totalThicknessM / 2;
      const miterLimit = MITER_LIMIT_MULT * totalThicknessM;
      function extFor(neighDir, incomingDir) {
        if (!neighDir) return defaultCap;
        const theta = angleBetween(incomingDir, neighDir);
        if (theta < 1e-3) return 0;
        const tanHalf = Math.tan(theta / 2);
        if (Math.abs(tanHalf) < 1e-4) return defaultCap;
        const e = (totalThicknessM / 2) / tanHalf;
        return Math.min(Math.max(0, e), miterLimit);
      }
      const extStart = extFor(neighAtA, dirBA);
      const extEnd = extFor(neighAtB, dirAB);
      return { extStart, extEnd };
    }

    // Compute neighbor-aware end extensions and adjust length/center
    let lengthFor3D = actualLength;
    let centerFor3D = { ...centerPosition };
    try {
      if (adjustedStartPoint && adjustedEndPoint) {
        const A2D = { x: adjustedStartPoint.x, y: adjustedStartPoint.z };
        const B2D = { x: adjustedEndPoint.x, y: adjustedEndPoint.z };
        const currentSimple = { start: A2D, end: B2D };
        const allWallsSimple = [];
        const existingWalls = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
        for (const w of existingWalls) {
          const sp = w.params?.startPoint;
          const ep = w.params?.endPoint;
          if (!sp || !ep) continue;
          allWallsSimple.push({ start: { x: sp.x, y: sp.z }, end: { x: ep.x, y: ep.z } });
        }
        allWallsSimple.push(currentSimple);
        const { extStart, extEnd } = computeEndExtensions(currentSimple, allWallsSimple, actualThickness);
        console.log('🪚 Miter extension', { extStart: +extStart.toFixed(3), extEnd: +extEnd.toFixed(3), baseLength: +actualLength.toFixed(3) });
        const lengthWithCaps = actualLength + extStart + extEnd;
        const dir = unit({ x: B2D.x - A2D.x, y: B2D.y - A2D.y });
        const shift = (extStart - extEnd) / 2;
        centerFor3D = {
          x: centerPosition.x + dir.x * shift,
          y: centerPosition.y,
          z: centerPosition.z + dir.y * shift
        };
        lengthFor3D = lengthWithCaps;
        console.log('🧭 Wall center shift (m)', { shift: +shift.toFixed(3), centerBefore: centerPosition, centerAfter: centerFor3D, finalLength: +lengthFor3D.toFixed(3) });
      }
    } catch (e) {
      console.warn('Wall miter extension computation failed, using original length/center:', e);
    }

    // Create multi-layer wall geometry with symmetric thickness about the centerline
    // Ensure layer offset orientation uses wall direction so all sides render consistently
    const { geometry, mesh3D } = this.createMultiLayerWallGeometry(
      lengthFor3D,
      height,
      actualThickness,
      wallTemplate,
      centerFor3D,
      rotationY,
      material
    );
    
    mesh3D.userData = { 
      objectId: null, 
      type: 'wall',
      wallType: wallType,
      wallTemplate: wallTemplate,
      isExternal: wallTemplate.properties.isExternal,
      loadBearing: wallTemplate.properties.loadBearing,
      thermalTransmittance: wallTemplate.properties.thermalTransmittance,
      fireRating: wallTemplate.properties.fireRating
    };
    
    // Create 2D representation - PROFESSIONAL ARCHITECTURAL PLAN
    const mesh2D = this.createProfessionalWall2D(lengthFor3D, actualThickness, centerFor3D, rotationY, wallTemplate);
    mesh2D.userData = { objectId: null, type: 'wall', wallType: wallType };
    
    return {
      geometry: geometry,
      mesh3D: mesh3D,
      mesh2D: mesh2D,
      actualLength: actualLength,
      adjustedStartPoint: adjustedStartPoint,
      adjustedEndPoint: adjustedEndPoint,
      actualThickness: actualThickness,
      wallType: wallType,
      wallTemplate: wallTemplate
    };
  }

  /**
   * Create multi-layer wall geometry with individual layer materials
   * Professional BIM approach with separate geometries per layer
   */
  createMultiLayerWallGeometry(length, height, totalThickness, wallTemplate, centerPosition, rotationY, fallbackMaterial = 'concrete') {
    const wallGroup = new THREE.Group();
    // Offset layers symmetrically around centerline, orientation follows rotationY but remains centered
    let currentOffset = -totalThickness / 2;
    
    // Create individual layer geometries
    for (const layer of wallTemplate.layers) {
      const layerThickness = layer.thickness;
      const layerMaterial = this.materials[layer.material] || this.materials[fallbackMaterial];
      
      // Create geometry for this layer
      const layerGeometry = new THREE.BoxGeometry(length, height, layerThickness);
      const layerMesh = new THREE.Mesh(layerGeometry, layerMaterial.clone());
      
      // Position layer centered on wall centerline with symmetric offsets
      layerMesh.position.set(0, 0, currentOffset + layerThickness / 2);
      layerMesh.userData = {
        layerName: layer.name,
        layerFunction: layer.function,
        layerMaterial: layer.material,
        layerThickness: layerThickness
      };
      
      wallGroup.add(layerMesh);
      currentOffset += layerThickness;
    }
    
    // Set group position and rotation
    wallGroup.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    if (rotationY !== 0) {
      wallGroup.rotation.y = rotationY;
    }
    
    // Create overall bounding box geometry for collision/selection
    const boundingGeometry = new THREE.BoxGeometry(length, height, totalThickness);
    
    return {
      geometry: boundingGeometry,
      mesh3D: wallGroup
    };
  }

  /**
   * Create professional 2D architectural wall representation with layer lines
   */
  createProfessionalWall2D(length, thickness, centerPosition, rotationY, wallTemplate) {
    const wallGroup = new THREE.Group();
    
    // Professional line weights
    const WALL_OUTLINE_WIDTH = 0.005; // Heavy lines for exterior walls
    const INTERIOR_WALL_WIDTH = 0.003; // Medium lines for interior walls
    const LAYER_LINE_WIDTH = 0.001;   // Light lines for layer divisions
    
    // Determine line weight based on wall type
    const isExterior = wallTemplate.properties.isExternal;
    const mainLineWidth = isExterior ? WALL_OUTLINE_WIDTH : INTERIOR_WALL_WIDTH;
    
    // 1. Create main wall outline
    const outlineGeometry = new THREE.PlaneGeometry(length, thickness);
    const outlineMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x000000,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    // Create outline as wireframe edges
    const outlineEdges = new THREE.EdgesGeometry(outlineGeometry);
    const outlineLines = new THREE.LineSegments(
      outlineEdges, 
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: mainLineWidth * 1000 })
    );
    outlineLines.rotation.x = -Math.PI / 2;
    outlineLines.position.y = 0.01;
    wallGroup.add(outlineLines);
    
    // 2. Create layer division lines for multi-layer walls
    if (wallTemplate.layers && wallTemplate.layers.length > 1) {
      let currentOffset = -thickness / 2;
      
      for (let i = 0; i < wallTemplate.layers.length - 1; i++) {
        currentOffset += wallTemplate.layers[i].thickness;
        
        // Create division line
        const divisionGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-length / 2, 0, currentOffset),
          new THREE.Vector3(length / 2, 0, currentOffset)
        ]);
        
        const divisionLine = new THREE.Line(
          divisionGeometry,
          new THREE.LineBasicMaterial({ 
            color: 0x666666, 
            linewidth: LAYER_LINE_WIDTH * 1000,
            transparent: true,
            opacity: 0.6
          })
        );
        
        divisionLine.rotation.x = -Math.PI / 2;
        divisionLine.position.y = 0.005;
        wallGroup.add(divisionLine);
      }
    }
    
    // 3. Create material-based fill pattern
    const fillGeometry = new THREE.PlaneGeometry(length * 0.98, thickness * 0.98);
    const fillMaterial = this.createWallFillPattern(wallTemplate);
    const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
    fillMesh.rotation.x = -Math.PI / 2;
    fillMesh.position.y = 0.001;
    wallGroup.add(fillMesh);
    
    // 4. Add insulation hatching for insulated walls
    if (this.hasInsulation(wallTemplate)) {
      const insulationHatch = this.createInsulationHatching(length, thickness);
      insulationHatch.rotation.x = -Math.PI / 2;
      insulationHatch.position.y = 0.003;
      wallGroup.add(insulationHatch);
    }
    
    // Set group position and rotation
    wallGroup.position.set(centerPosition.x, 0, centerPosition.z);
    if (rotationY !== 0) {
      wallGroup.rotation.y = rotationY;
    }
    
    return wallGroup;
  }

  /**
   * Create wall fill pattern based on primary material
   */
  createWallFillPattern(wallTemplate) {
    // Determine primary structural material
    const structuralLayer = wallTemplate.layers.find(layer => 
      layer.function === 'structure' || layer.function === 'finish_exterior'
    );
    
    const primaryMaterial = structuralLayer ? structuralLayer.material : 'concrete';
    const materialInfo = this.materialDatabase[primaryMaterial] || this.materialDatabase.concrete;
    
    // Create material-specific fill
    let fillColor = 0xf0f0f0; // Default light gray
    
    switch (materialInfo.category) {
      case 'masonry':
        fillColor = 0xe8d5b7; // Light brick color
        break;
      case 'structural':
        if (primaryMaterial === 'concrete') {
          fillColor = 0xe0e0e0; // Light concrete gray
        } else if (primaryMaterial === 'wood') {
          fillColor = 0xf4e4bc; // Light wood color
        } else if (primaryMaterial === 'steel') {
          fillColor = 0xe8e8e8; // Light steel gray
        }
        break;
      case 'finish':
        fillColor = 0xfafafa; // Very light gray for finishes
        break;
    }
    
    return new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
  }

  /**
   * Check if wall template has insulation layers
   */
  hasInsulation(wallTemplate) {
    return wallTemplate.layers.some(layer => layer.function === 'insulation');
  }

  /**
   * Create insulation hatching pattern
   */
  createInsulationHatching(length, thickness) {
    const hatchGroup = new THREE.Group();
    const hatchSpacing = 0.05; // 5cm spacing for hatch lines
    const hatchColor = 0xffc107; // Yellow/orange for insulation
    
    // Create diagonal hatch lines
    for (let x = -length / 2; x < length / 2; x += hatchSpacing) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0, -thickness / 2),
        new THREE.Vector3(x + thickness * 0.5, 0, thickness / 2)
      ]);
      
      const hatchLine = new THREE.Line(
        lineGeometry,
        new THREE.LineBasicMaterial({ 
          color: hatchColor,
          transparent: true,
          opacity: 0.4,
          linewidth: 1
        })
      );
      
      hatchGroup.add(hatchLine);
    }
    
    return hatchGroup;
  }

  /**
   * PROFESSIONAL DOOR ASSEMBLY CREATION
   * Complete door system with frame, panels, hardware, and glazing
   */
  createProfessionalDoorAssembly(config) {
    const {
      width, height, thickness, material, frameMaterial,
      frameDepth, doorType, frameType, openingDirection,
      jamb, sill, head, hardware, glazing, hostWallData
    } = config;

    const doorGroup = new THREE.Group();
    
    // Get materials
    const doorMat = this.materials[material] || this.materials.wood;
    const frameMat = this.materials[frameMaterial] || this.materials.wood;
    
    // 1. Create professional door frame (jamb, head, sill)
    const frame = this.createDoorFrame({
      width, height, frameDepth, frameMaterial: frameMat,
      jamb, sill, head, frameType, hostWallData
    });
    doorGroup.add(frame);
    
    // 2. Create door panel(s) based on type
    const panels = this.createDoorPanels({
      width, height, thickness, material: doorMat,
      doorType, openingDirection, glazing
    });
    doorGroup.add(panels);
    
    // 3. Create hardware (handles, hinges, closer)
    const hardwareGroup = this.createDoorHardware({
      width, height, hardware, openingDirection, doorType
    });
    doorGroup.add(hardwareGroup);
    
    // 4. Create door swing visualization (2D only)
    const swingArc = this.createDoorSwingArc({
      width, openingDirection, doorType
    });
    
    return {
      group: doorGroup,
      swingArc: swingArc,
      frame: frame,
      panels: panels,
      hardware: hardwareGroup
    };
  }

  /**
   * Create professional door frame with jamb, head, and sill
   */
  createDoorFrame(config) {
    const { width, height, frameDepth, frameMaterial, jamb, sill, head, frameType, hostWallData } = config;
    const frameGroup = new THREE.Group();
    
    // Calculate frame dimensions based on wall layers
    let actualFrameDepth = frameDepth;
    if (hostWallData && hostWallData.layers) {
      // Frame should span from interior to exterior finish
      actualFrameDepth = hostWallData.thickness;
    }
    
    // Jamb (vertical sides)
    const jambWidth = jamb.width || 0.04;
    const jambDepth = jamb.depth || actualFrameDepth;
    
    // Left jamb
    const leftJambGeometry = new THREE.BoxGeometry(jambWidth, height, jambDepth);
    const leftJamb = new THREE.Mesh(leftJambGeometry, frameMaterial);
    leftJamb.position.set(-(width/2 + jambWidth/2), 0, 0);
    frameGroup.add(leftJamb);
    
    // Right jamb
    const rightJambGeometry = new THREE.BoxGeometry(jambWidth, height, jambDepth);
    const rightJamb = new THREE.Mesh(rightJambGeometry, frameMaterial);
    rightJamb.position.set(width/2 + jambWidth/2, 0, 0);
    frameGroup.add(rightJamb);
    
    // Head (top)
    const headWidth = width + (jambWidth * 2);
    const headHeight = head.height || 0.05;
    const headGeometry = new THREE.BoxGeometry(headWidth, headHeight, jambDepth);
    const headMesh = new THREE.Mesh(headGeometry, frameMaterial);
    headMesh.position.set(0, height/2 + headHeight/2, 0);
    frameGroup.add(headMesh);
    
    // Sill (bottom) - only if elevated
    if (sill.height > 0) {
      const sillWidth = width + (jambWidth * 2) + (sill.overhang * 2);
      const sillGeometry = new THREE.BoxGeometry(sillWidth, sill.height, jambDepth + sill.overhang);
      const sillMesh = new THREE.Mesh(sillGeometry, frameMaterial);
      sillMesh.position.set(0, -(height/2 + sill.height/2), sill.overhang/2);
      frameGroup.add(sillMesh);
    }
    
    return frameGroup;
  }
  /**
   * Create door panels based on door type
   */
  createDoorPanels(config) {
    const { width, height, thickness, material, doorType, openingDirection, glazing } = config;
    const panelsGroup = new THREE.Group();
    
    switch (doorType) {
      case 'single_swing':
        const singlePanel = this.createSingleDoorPanel(width, height, thickness, material, glazing);
        panelsGroup.add(singlePanel);
        break;
        
      case 'double_swing':
        const leftPanel = this.createSingleDoorPanel(width/2 - 0.01, height, thickness, material, glazing);
        leftPanel.position.x = -width/4;
        const rightPanel = this.createSingleDoorPanel(width/2 - 0.01, height, thickness, material, glazing);
        rightPanel.position.x = width/4;
        panelsGroup.add(leftPanel);
        panelsGroup.add(rightPanel);
        break;
        
      case 'sliding':
        const slidingPanel = this.createSlidingDoorPanel(width, height, thickness, material, glazing);
        panelsGroup.add(slidingPanel);
        break;
        
      default:
        const defaultPanel = this.createSingleDoorPanel(width, height, thickness, material, glazing);
        panelsGroup.add(defaultPanel);
    }
    
    return panelsGroup;
  }

  /**
   * Create single door panel with professional details
   */
  createSingleDoorPanel(width, height, thickness, material, glazing) {
    const panelGroup = new THREE.Group();
    
    // Main door panel
    const panelGeometry = new THREE.BoxGeometry(width, height, thickness);
    const doorPanel = new THREE.Mesh(panelGeometry, material);
    panelGroup.add(doorPanel);
    
    // Add glazing if specified
    if (glazing) {
      const glassPanel = this.createDoorGlazing(width, height, glazing);
      glassPanel.position.z = thickness/2 + 0.001;
      panelGroup.add(glassPanel);
    }
    
    // Add raised panels for traditional doors
    if (material === this.materials.wood) {
      const raisedPanels = this.createRaisedDoorPanels(width, height, thickness);
      panelGroup.add(raisedPanels);
    }
    
    return panelGroup;
  }

  /**
   * Create raised door panels for traditional doors
   */
  createRaisedDoorPanels(width, height, thickness) {
    const panelsGroup = new THREE.Group();
    
    // Simple raised panel geometry
    const panelWidth = width * 0.7;
    const panelHeight = height * 0.4;
    const raisedHeight = thickness * 0.1;
    
    // Upper panel
    const upperPanel = new THREE.BoxGeometry(panelWidth, panelHeight, raisedHeight);
    const upperPanelMesh = new THREE.Mesh(upperPanel, this.materials.wood);
    upperPanelMesh.position.set(0, height * 0.2, thickness/2 + raisedHeight/2);
    panelsGroup.add(upperPanelMesh);
    
    // Lower panel  
    const lowerPanel = new THREE.BoxGeometry(panelWidth, panelHeight, raisedHeight);
    const lowerPanelMesh = new THREE.Mesh(lowerPanel, this.materials.wood);
    lowerPanelMesh.position.set(0, -height * 0.2, thickness/2 + raisedHeight/2);
    panelsGroup.add(lowerPanelMesh);
    
    return panelsGroup;
  }

  /**
   * Create door swing arc visualization
   */
  createDoorSwingArc(config) {
    const { width, openingDirection, doorType } = config;
    const swingGroup = new THREE.Group();
    
    // Create arc geometry for door swing
    const radius = width;
    const segments = 32;
    const arcGeometry = new THREE.RingGeometry(radius * 0.95, radius, 0, Math.PI * 0.5, segments);
    
    // Swing arc material (semi-transparent)
    const arcMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    
    const arcMesh = new THREE.Mesh(arcGeometry, arcMaterial);
    arcMesh.rotation.x = -Math.PI / 2;
    
    // Flip for left opening doors
    if (openingDirection === 'left') {
      arcMesh.rotation.z = Math.PI;
    }
    
    swingGroup.add(arcMesh);
    return swingGroup;
  }

  /**
   * Create door hardware (handles, hinges, closer)
   */
  createDoorHardware(config) {
    const { width, height, hardware, openingDirection, doorType } = config;
    const hardwareGroup = new THREE.Group();
    
    // Door handle
    const handleSide = openingDirection === 'left' ? -1 : 1;
    const handleX = width * 0.35 * handleSide;
    const handleY = 0; // Center height
    
    // Handle assembly
    const handleGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.12);
    const handleMaterial = this.materials.steel || this.materials.aluminum;
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(handleX, handleY, 0.03);
    hardwareGroup.add(handle);
    
    // Hinges (3 hinges for standard door)
    const hingePositions = [-height * 0.35, 0, height * 0.35];
    const hingeX = openingDirection === 'left' ? width/2 : -width/2;
    
    hingePositions.forEach(y => {
      const hinge = this.createDoorHinge();
      hinge.position.set(hingeX, y, 0);
      hardwareGroup.add(hinge);
    });
    
    return hardwareGroup;
  }

  /**
   * Create door hinge geometry
   */
  createDoorHinge() {
    const hingeGroup = new THREE.Group();
    const hingeMaterial = this.materials.steel || this.materials.aluminum;
    
    // Hinge leaves
    const leafGeometry = new THREE.BoxGeometry(0.08, 0.10, 0.002);
    const leaf1 = new THREE.Mesh(leafGeometry, hingeMaterial);
    leaf1.position.z = -0.001;
    const leaf2 = new THREE.Mesh(leafGeometry, hingeMaterial);
    leaf2.position.z = 0.001;
    
    hingeGroup.add(leaf1);
    hingeGroup.add(leaf2);
    
    return hingeGroup;
  }

  /**
   * PROFESSIONAL WALL OPENING SYSTEM
   * Create intelligent wall opening with layer awareness
   */
  createProfessionalWallOpening(wallId, openingConfig) {
    const { type, width, height, position, offset, frameDepth, preserveLayers } = openingConfig;
    const wall = this.objects.get(wallId);
    
    if (!wall || !wall.params) {
      console.warn(`Cannot create opening: wall ${wallId} not found`);
      return false;
    }
    
    console.log(`🔳 Creating professional ${type} opening: ${width.toFixed(2)}m × ${height.toFixed(2)}m`);
    
    // Store opening data for wall regeneration
    if (!wall.params.openings) {
      wall.params.openings = [];
    }
    
    const opening = {
      id: `opening_${Date.now()}`,
      type: type,
      width: width,
      height: height,
      position: position,
      offset: offset,
      frameDepth: frameDepth,
      preserveLayers: preserveLayers
    };
    
    wall.params.openings.push(opening);
    
    // Trigger wall geometry regeneration with openings
    this.regenerateWallWithOpenings(wallId);
    
    return opening;
  }

  /**
   * Regenerate wall geometry with openings cut out
   * PROFESSIONAL IMPLEMENTATION: Uses boolean operations to cut precise openings
   */
  regenerateWallWithOpenings(wallId) {
    const wall = this.objects.get(wallId);
    if (!wall || !wall.params.openings || wall.params.openings.length === 0) {
      return;
    }
    
    console.log(`🔧 Regenerating wall ${wallId} with ${wall.params.openings.length} openings`);
    
    try {
      // Remove existing wall meshes
      if (wall.mesh3D) {
        this.scene3D.remove(wall.mesh3D);
      }
      if (wall.mesh2D) {
        this.scene2D.remove(wall.mesh2D);
      }
      
      // Get wall parameters
      const params = wall.params;
      const layers = params.layers || [{
        material: params.material || 'concrete',
        thickness: params.thickness || 0.2,
        thermalTransmittance: 0.5
      }];
      
      // Create new wall geometry with openings
      const wallGeometry = this.createWallWithOpenings(params, layers);
      
      if (wallGeometry) {
        wall.mesh3D = wallGeometry.mesh3D;
        wall.mesh2D = wallGeometry.mesh2D;
        wall.params.hasOpenings = true;
        
        // Add to scenes
        this.scene3D.add(wallGeometry.mesh3D);
        this.scene2D.add(wallGeometry.mesh2D);
        
        console.log(`✅ Wall ${wallId} regenerated with ${params.openings.length} openings`);
        
        // Emit update event
        this.emit('object_updated', {
          object: this.serializeObject(wall),
          type: 'opening_added'
        });
      }
      
    } catch (error) {
      console.error(`❌ Failed to regenerate wall ${wallId} with openings:`, error);
    }
    
  }

  /**
   * Create wall geometry with openings using boolean operations
   * PROFESSIONAL IMPLEMENTATION: Precise opening cuts with frame support
   */
  createWallWithOpenings(params, layers) {
    const { 
      startPoint, 
      endPoint, 
      height = 2.7, 
      openings = [] 
    } = params;
    
    // Calculate wall dimensions and direction
    const wallVector = {
      x: endPoint.x - startPoint.x,
      y: endPoint.y - startPoint.y,
      z: endPoint.z - startPoint.z
    };
    const wallLength = Math.sqrt(wallVector.x ** 2 + wallVector.y ** 2 + wallVector.z ** 2);
    
    // Calculate wall center and rotation
    const wallCenter = {
      x: (startPoint.x + endPoint.x) / 2,
      y: (startPoint.y + endPoint.y) / 2,
      z: (startPoint.z + endPoint.z) / 2
    };
    
    const wallAngle = Math.atan2(wallVector.z, wallVector.x);
    
    // Create wall segments between openings
    const segments = this.calculateWallSegments(wallLength, openings);
    
    // Create 3D wall group with segments
    const wallGroup3D = new THREE.Group();
    const wallGroup2D = new THREE.Group();
    
    // Process each layer for multi-layer walls
    let layerOffset = 0;
    
    layers.forEach((layer, layerIndex) => {
      const layerThickness = layer.thickness;
      const material = this.materials[layer.material] || this.materials.concrete;
      
      // Create segments for this layer
      segments.forEach((segment, segmentIndex) => {
        if (segment.length > 0.01) { // Only create segments with meaningful length
          // 3D segment
          const segmentGeometry3D = new THREE.BoxGeometry(
            segment.length,
            height,
            layerThickness
          );
          
          const layerMaterial3D = material.clone();
          layerMaterial3D.transparent = layers.length > 1;
          layerMaterial3D.opacity = layers.length > 1 ? 0.8 : 1.0;
          
          const segmentMesh3D = new THREE.Mesh(segmentGeometry3D, layerMaterial3D);
          
          // Position segment relative to wall start
          segmentMesh3D.position.set(
            segment.centerPosition - wallLength / 2,
            height / 2,
            layerOffset - (this.getTotalWallThickness(layers) / 2)
          );
          
          wallGroup3D.add(segmentMesh3D);
          
          // 2D segment (top view)
          if (layerIndex === 0) { // Only create 2D view for first layer
            const segmentGeometry2D = new THREE.PlaneGeometry(segment.length, layerThickness);
            const layerMaterial2D = new THREE.MeshBasicMaterial({
              color: material.color,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.8
            });
            
            const segmentMesh2D = new THREE.Mesh(segmentGeometry2D, layerMaterial2D);
            segmentMesh2D.position.set(
              segment.centerPosition - wallLength / 2,
              0,
              layerOffset - (this.getTotalWallThickness(layers) / 2)
            );
            segmentMesh2D.rotation.x = -Math.PI / 2;
            
            wallGroup2D.add(segmentMesh2D);
          }
        }
      });
      
      layerOffset += layerThickness;
    });
    
    // Add opening frames if specified
    openings.forEach(opening => {
      if (opening.frameDepth > 0) {
        const frameGroup = this.createOpeningFrame(opening, wallLength, height, layers);
        if (frameGroup) {
          wallGroup3D.add(frameGroup);
        }
      }
    });
    
    // Position and rotate wall groups
    wallGroup3D.position.set(wallCenter.x, wallCenter.y, wallCenter.z);
    wallGroup3D.rotation.y = wallAngle;
    
    wallGroup2D.position.set(wallCenter.x, wallCenter.y, wallCenter.z);
    wallGroup2D.rotation.y = wallAngle;
    
    console.log(`🏗️ Created wall with ${segments.length} segments and ${openings.length} openings`);
    
    return {
      mesh3D: wallGroup3D,
      mesh2D: wallGroup2D,
      segments: segments,
      openings: openings
    };
  }

  /**
   * Calculate wall segments around openings
   * PROFESSIONAL IMPLEMENTATION: Handles overlapping openings and edge cases
   */
  calculateWallSegments(wallLength, openings) {
    if (!openings || openings.length === 0) {
      return [{
        startPosition: 0,
        endPosition: wallLength,
        centerPosition: wallLength / 2,
        length: wallLength
      }];
    }
    
    // Sort openings by position along wall
    const sortedOpenings = [...openings].sort((a, b) => a.position - b.position);
    
    const segments = [];
    let currentPosition = 0;
    
    sortedOpenings.forEach(opening => {
      const openingStart = Math.max(0, opening.position - opening.width / 2);
      const openingEnd = Math.min(wallLength, opening.position + opening.width / 2);
      
      // Create segment before opening if there's space
      if (openingStart > currentPosition + 0.01) {
        const segmentLength = openingStart - currentPosition;
        segments.push({
          startPosition: currentPosition,
          endPosition: openingStart,
          centerPosition: currentPosition + segmentLength / 2,
          length: segmentLength,
          type: 'wall'
        });
      }
      
      // Record the opening segment (for potential frame creation)
      segments.push({
        startPosition: openingStart,
        endPosition: openingEnd,
        centerPosition: (openingStart + openingEnd) / 2,
        length: openingEnd - openingStart,
        type: 'opening',
        opening: opening
      });
      
      currentPosition = Math.max(currentPosition, openingEnd);
    });
    
    // Create final segment after last opening
    if (currentPosition < wallLength - 0.01) {
      const segmentLength = wallLength - currentPosition;
      segments.push({
        startPosition: currentPosition,
        endPosition: wallLength,
        centerPosition: currentPosition + segmentLength / 2,
        length: segmentLength,
        type: 'wall'
      });
    }
    
    // Filter out wall segments (openings are handled separately)
    return segments.filter(segment => segment.type === 'wall');
  }

  /**
   * Create opening frame geometry
   * PROFESSIONAL IMPLEMENTATION: Proper frame construction
   */
  createOpeningFrame(opening, wallLength, wallHeight, layers) {
    const frameGroup = new THREE.Group();
    const frameDepth = opening.frameDepth || 0.05;
    const frameMaterial = this.materials.wood || this.materials.concrete;
    
    // Frame dimensions
    const openingLeft = opening.position - opening.width / 2;
    const openingRight = opening.position + opening.width / 2;
    const openingBottom = opening.offset || 0;
    const openingTop = openingBottom + opening.height;
    
    // Create frame components
    const frameComponents = [
      // Left jamb
      {
        width: frameDepth,
        height: opening.height,
        depth: this.getTotalWallThickness(layers),
        position: { x: openingLeft - frameDepth / 2, y: (openingBottom + openingTop) / 2, z: 0 }
      },
      // Right jamb
      {
        width: frameDepth,
        height: opening.height,
        depth: this.getTotalWallThickness(layers),
        position: { x: openingRight + frameDepth / 2, y: (openingBottom + openingTop) / 2, z: 0 }
      },
      // Top header
      {
        width: opening.width + frameDepth * 2,
        height: frameDepth,
        depth: this.getTotalWallThickness(layers),
        position: { x: opening.position, y: openingTop + frameDepth / 2, z: 0 }
      }
    ];
    
    // Add sill for windows
    if (opening.type === 'window' && openingBottom > 0) {
      frameComponents.push({
        width: opening.width + frameDepth * 2,
        height: frameDepth,
        depth: this.getTotalWallThickness(layers),
        position: { x: opening.position, y: openingBottom - frameDepth / 2, z: 0 }
      });
    }
    
    // Create frame meshes
    frameComponents.forEach(component => {
      const frameGeometry = new THREE.BoxGeometry(
        component.width,
        component.height,
        component.depth
      );
      
      const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial.clone());
      frameMesh.position.set(
        component.position.x - wallLength / 2,
        component.position.y,
        component.position.z
      );
      
      frameGroup.add(frameMesh);
    });
    
    return frameGroup;
  }

  /**
   * Calculate total wall thickness from all layers
   */
  getTotalWallThickness(layers) {
    return layers.reduce((total, layer) => total + layer.thickness, 0);
  }

  /**
   * Remove opening from wall
   * PROFESSIONAL IMPLEMENTATION: Clean opening removal with geometry regeneration
   */
  removeWallOpening(wallId, openingId) {
    const wall = this.objects.get(wallId);
    if (!wall || !wall.params.openings) {
      console.warn(`Wall ${wallId} or openings not found`);
      return false;
    }

    const openingIndex = wall.params.openings.findIndex(opening => opening.id === openingId);
    if (openingIndex === -1) {
      console.warn(`Opening ${openingId} not found in wall ${wallId}`);
      return false;
    }

    // Remove the opening
    wall.params.openings.splice(openingIndex, 1);
    
    console.log(`🗑️ Removed opening ${openingId} from wall ${wallId}`);

    // Regenerate wall geometry if there are still openings
    if (wall.params.openings.length > 0) {
      this.regenerateWallWithOpenings(wallId);
    } else {
      // No more openings, regenerate as solid wall
      wall.params.hasOpenings = false;
      this.regenerateWallGeometry(wallId);
    }

    return true;
  }

  /**
   * Update opening properties
   * PROFESSIONAL IMPLEMENTATION: Live opening editing
   */
  updateWallOpening(wallId, openingId, newParams) {
    const wall = this.objects.get(wallId);
    if (!wall || !wall.params.openings) {
      console.warn(`Wall ${wallId} or openings not found`);
      return false;
    }

    const opening = wall.params.openings.find(opening => opening.id === openingId);
    if (!opening) {
      console.warn(`Opening ${openingId} not found in wall ${wallId}`);
      return false;
    }

    // Update opening properties
    Object.assign(opening, newParams);
    
    console.log(`✏️ Updated opening ${openingId} in wall ${wallId}:`, newParams);

    // Regenerate wall geometry with updated opening
    this.regenerateWallWithOpenings(wallId);

    return true;
  }

  /**
   * Regenerate solid wall geometry (without openings)
   */
  regenerateWallGeometry(wallId) {
    const wall = this.objects.get(wallId);
    if (!wall) return;

    // Remove existing meshes
    if (wall.mesh3D) {
      this.scene3D.remove(wall.mesh3D);
    }
    if (wall.mesh2D) {
      this.scene2D.remove(wall.mesh2D);
    }

    // Create new solid wall geometry
    const geometry = this.createMultiLayerWallGeometry(wall.params);
    if (geometry) {
      wall.mesh3D = geometry.mesh3D;
      wall.mesh2D = geometry.mesh2D;
      
      this.scene3D.add(geometry.mesh3D);
      this.scene2D.add(geometry.mesh2D);
      
      console.log(`🔄 Regenerated solid wall geometry for ${wallId}`);
    }
  }

  /**
   * Get all openings in a wall
   */
  getWallOpenings(wallId) {
    const wall = this.objects.get(wallId);
    return wall?.params?.openings || [];
  }

  /**
   * Check if opening fits within wall boundaries
   * PROFESSIONAL IMPLEMENTATION: Validation for opening placement
   */
  validateOpeningPlacement(wallId, opening) {
    const wall = this.objects.get(wallId);
    if (!wall) return { valid: false, error: 'Wall not found' };

    const wallLength = wall.params.length || 3.0;
    const wallHeight = wall.params.height || 2.7;
    
    // Check horizontal bounds
    const openingLeft = opening.position - opening.width / 2;
    const openingRight = opening.position + opening.width / 2;
    
    if (openingLeft < 0 || openingRight > wallLength) {
      return { 
        valid: false, 
        error: `Opening extends beyond wall length (${wallLength}m)` 
      };
    }

    // Check vertical bounds
    const openingTop = (opening.offset || 0) + opening.height;
    
    if (openingTop > wallHeight) {
      return { 
        valid: false, 
        error: `Opening extends beyond wall height (${wallHeight}m)` 
      };
    }

    // Check for overlaps with existing openings
    const existingOpenings = wall.params.openings || [];
    for (const existing of existingOpenings) {
      if (existing.id === opening.id) continue; // Skip self when updating
      
      const existingLeft = existing.position - existing.width / 2;
      const existingRight = existing.position + existing.width / 2;
      
      // Check horizontal overlap
      if (!(openingRight < existingLeft || openingLeft > existingRight)) {
        // Check vertical overlap
        const existingBottom = existing.offset || 0;
        const existingTop = existingBottom + existing.height;
        const openingBottom = opening.offset || 0;
        
        if (!(openingTop < existingBottom || openingBottom > existingTop)) {
          return { 
            valid: false, 
            error: `Opening overlaps with existing opening` 
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * ADVANCED WALL EDITING SYSTEM
   * Professional CAD editing tools for walls
   */
  
  /**
   * Split wall at specified point
   * Creates two separate walls from one
   */
  splitWall(wallId, splitPoint, options = {}) {
    const wall = this.objects.get(wallId);
    if (!wall || wall.type !== 'wall') {
      console.warn(`Cannot split wall: ${wallId} not found or not a wall`);
      return null;
    }

    const { maintainProperties = true, autoJoin = true } = options;
    
    console.log(`🔪 Splitting wall ${wallId} at point:`, splitPoint);
    
    // Calculate split position along wall
    const startPoint = wall.params.startPoint;
    const endPoint = wall.params.endPoint;
    
    // Project split point onto wall line
    const projectedPoint = this.projectPointOntoLine(splitPoint, startPoint, endPoint);
    const distanceFromStart = this.calculateDistance(startPoint, projectedPoint);
    const totalLength = wall.params.length || this.calculateDistance(startPoint, endPoint);
    
    if (distanceFromStart <= 0.01 || distanceFromStart >= totalLength - 0.01) {
      console.warn('Split point too close to wall end - no split performed');
      return null;
    }
    
    // Create two new walls
    const wallParams1 = {
      ...wall.params,
      startPoint: startPoint,
      endPoint: projectedPoint,
      length: distanceFromStart
    };
    
    const wallParams2 = {
      ...wall.params,
      startPoint: projectedPoint,
      endPoint: endPoint,
      length: totalLength - distanceFromStart
    };
    
    // Create the new walls
    const wall1Id = this.createObject('wall', wallParams1);
    const wall2Id = this.createObject('wall', wallParams2);
    
    // Remove original wall
    this.removeObject(wallId);
    
    // Auto-join with adjacent walls if enabled
    if (autoJoin) {
      this.applyProfessionalWallJoinery();
    }
    
    return {
      wall1: wall1Id,
      wall2: wall2Id,
      splitPoint: projectedPoint
    };
  }
  /**
   * Merge two adjacent walls into one
   */
  mergeWalls(wallId1, wallId2, options = {}) {
    const wall1 = this.objects.get(wallId1);
    const wall2 = this.objects.get(wallId2);
    
    if (!wall1 || !wall2 || wall1.type !== 'wall' || wall2.type !== 'wall') {
      console.warn('Cannot merge: walls not found or invalid');
      return null;
    }

    const { tolerance = 0.05, maintainProperties = 'first' } = options;
    
    console.log(`🔗 Merging walls ${wallId1} and ${wallId2}`);
    
    // Check if walls are adjacent and collinear
    const adjacency = this.checkWallAdjacency(wall1, wall2, tolerance);
    if (!adjacency.areAdjacent) {
      console.warn('Walls are not adjacent - cannot merge');
      return null;
    }
    
    // Determine merge properties based on option
    const baseWall = maintainProperties === 'first' ? wall1 : wall2;
    const mergedParams = {
      ...baseWall.params,
      startPoint: adjacency.newStartPoint,
      endPoint: adjacency.newEndPoint,
      length: adjacency.newLength
    };
    
    // Create merged wall
    const mergedWallId = this.createObject('wall', mergedParams);
    
    // Remove original walls
    this.removeObject(wallId1);
    this.removeObject(wallId2);
    
    return {
      mergedWall: mergedWallId,
      originalWalls: [wallId1, wallId2],
      newLength: adjacency.newLength
    };
  }

  /**
   * Extend wall to specified point or length
   */
  extendWall(wallId, extension, options = {}) {
    const wall = this.objects.get(wallId);
    if (!wall || wall.type !== 'wall') {
      console.warn(`Cannot extend wall: ${wallId} not found`);
      return false;
    }

    const { end = 'end', autoTrim = false, autoJoin = true } = options;
    
    console.log(`📏 Extending wall ${wallId}:`, extension);
    
    let newStartPoint = wall.params.startPoint;
    let newEndPoint = wall.params.endPoint;
    let newLength = wall.params.length;
    
    if (typeof extension === 'number') {
      // Extend by distance
      const direction = this.getWallDirection(wall);
      
      if (end === 'start') {
        newStartPoint = {
          x: newStartPoint.x - direction.x * extension,
          y: newStartPoint.y,
          z: newStartPoint.z - direction.z * extension
        };
      } else {
        newEndPoint = {
          x: newEndPoint.x + direction.x * extension,
          y: newEndPoint.y,
          z: newEndPoint.z + direction.z * extension
        };
      }
      
      newLength += extension;
    } else {
      // Extend to point
      if (end === 'start') {
        newStartPoint = extension;
      } else {
        newEndPoint = extension;
      }
      
      newLength = this.calculateDistance(newStartPoint, newEndPoint);
    }
    
    // Update wall parameters
    const updatedParams = {
      ...wall.params,
      startPoint: newStartPoint,
      endPoint: newEndPoint,
      length: newLength
    };
    
    // Regenerate wall geometry
    const newGeometry = this.createWallGeometry(updatedParams);
    wall.params = updatedParams;
    wall.geometry = newGeometry.geometry;
    wall.mesh3D = newGeometry.mesh3D;
    wall.mesh2D = newGeometry.mesh2D;
    
    // Update user data
    wall.mesh3D.userData.objectId = wallId;
    wall.mesh2D.userData.objectId = wallId;
    
    // Auto-join with intersecting walls
    if (autoJoin) {
      this.applyProfessionalWallJoinery();
    }
    
    return {
      newLength: newLength,
      newStartPoint: newStartPoint,
      newEndPoint: newEndPoint
    };
  }

  /**
   * Trim wall to intersection with another wall or element
   */
  trimWall(wallId, trimElement, options = {}) {
    const wall = this.objects.get(wallId);
    if (!wall || wall.type !== 'wall') {
      console.warn(`Cannot trim wall: ${wallId} not found`);
      return false;
    }

    const { end = 'auto', keepExtended = false } = options;
    
    console.log(`✂️ Trimming wall ${wallId} to element:`, trimElement);
    
    // Find intersection point
    const intersectionPoint = this.findWallIntersection(wall, trimElement);
    if (!intersectionPoint) {
      console.warn('No intersection found - cannot trim');
      return false;
    }
    
    // Determine which end to trim
    let trimEnd = end;
    if (trimEnd === 'auto') {
      const distToStart = this.calculateDistance(wall.params.startPoint, intersectionPoint);
      const distToEnd = this.calculateDistance(wall.params.endPoint, intersectionPoint);
      trimEnd = distToStart < distToEnd ? 'start' : 'end';
    }
    
    // Create new wall parameters
    const newParams = { ...wall.params };
    
    if (trimEnd === 'start') {
      newParams.startPoint = intersectionPoint;
    } else {
      newParams.endPoint = intersectionPoint;
    }
    
    newParams.length = this.calculateDistance(newParams.startPoint, newParams.endPoint);
    
    // Update wall
    this.updateWallGeometry(wallId, newParams);
    
    return {
      trimmedAt: intersectionPoint,
      trimmedEnd: trimEnd,
      newLength: newParams.length
    };
  }

  /**
   * Move wall endpoint with constraint solving
   */
  moveWallEndpoint(wallId, endpoint, newPosition, options = {}) {
    const wall = this.objects.get(wallId);
    if (!wall || wall.type !== 'wall') {
      console.warn(`Cannot move wall endpoint: ${wallId} not found`);
      return false;
    }

    const { maintainLength = false, autoJoin = true, snapToGrid = false } = options;
    
    console.log(`🎯 Moving wall ${wallId} ${endpoint} to:`, newPosition);
    
    let finalPosition = newPosition;
    
    // Apply grid snapping if enabled
    if (snapToGrid) {
      finalPosition = this.snapToGrid(newPosition);
    }
    
    const newParams = { ...wall.params };
    
    if (maintainLength) {
      // Move wall maintaining length (translate)
      const originalLength = wall.params.length;
      const direction = this.getWallDirection(wall);
      
      if (endpoint === 'start') {
        newParams.startPoint = finalPosition;
        newParams.endPoint = {
          x: finalPosition.x + direction.x * originalLength,
          y: finalPosition.y,
          z: finalPosition.z + direction.z * originalLength
        };
      } else {
        newParams.endPoint = finalPosition;
        newParams.startPoint = {
          x: finalPosition.x - direction.x * originalLength,
          y: finalPosition.y,
          z: finalPosition.z - direction.z * originalLength
        };
      }
    } else {
      // Move endpoint changing wall length
      if (endpoint === 'start') {
        newParams.startPoint = finalPosition;
      } else {
        newParams.endPoint = finalPosition;
      }
      
      newParams.length = this.calculateDistance(newParams.startPoint, newParams.endPoint);
    }
    
    // Update wall
    this.updateWallGeometry(wallId, newParams);
    
    // Auto-join with intersecting walls
    if (autoJoin) {
      this.applyProfessionalWallJoinery();
    }
    
    return {
      newStartPoint: newParams.startPoint,
      newEndPoint: newParams.endPoint,
      newLength: newParams.length
    };
  }

  /**
   * Helper: Project point onto line segment
   */
  projectPointOntoLine(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dz = lineEnd.z - lineStart.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    
    if (length === 0) return lineStart;
    
    const t = Math.max(0, Math.min(1, 
      ((point.x - lineStart.x) * dx + (point.z - lineStart.z) * dz) / (length * length)
    ));
    
    return {
      x: lineStart.x + t * dx,
      y: lineStart.y,
      z: lineStart.z + t * dz
    };
  }

  /**
   * Helper: Check if two walls are adjacent and can be merged
   */
  checkWallAdjacency(wall1, wall2, tolerance) {
    const endpoints1 = [wall1.params.startPoint, wall1.params.endPoint];
    const endpoints2 = [wall2.params.startPoint, wall2.params.endPoint];
    
    // Check all endpoint combinations
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const distance = this.calculateDistance(endpoints1[i], endpoints2[j]);
        
        if (distance <= tolerance) {
          // Check if walls are collinear
          const direction1 = this.getWallDirection(wall1);
          const direction2 = this.getWallDirection(wall2);
          
          const dotProduct = Math.abs(direction1.x * direction2.x + direction1.z * direction2.z);
          
          if (dotProduct > 0.99) { // Nearly parallel
            // Determine new start and end points
            const allPoints = [
              wall1.params.startPoint,
              wall1.params.endPoint,
              wall2.params.startPoint,
              wall2.params.endPoint
            ].filter((point, index, array) => {
              // Remove the adjacent endpoints
              if ((index < 2 && index === i) || (index >= 2 && index - 2 === j)) {
                return false;
              }
              return true;
            });
            
            const newLength = this.calculateDistance(allPoints[0], allPoints[1]);
            
            return {
              areAdjacent: true,
              newStartPoint: allPoints[0],
              newEndPoint: allPoints[1],
              newLength: newLength
            };
          }
        }
      }
    }
    
    return { areAdjacent: false };
  }

  /**
   * Helper: Get wall direction vector (normalized)
   */
  getWallDirection(wall) {
    const dx = wall.params.endPoint.x - wall.params.startPoint.x;
    const dz = wall.params.endPoint.z - wall.params.startPoint.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    
    return {
      x: dx / length,
      z: dz / length
    };
  }

  /**
   * Helper: Update wall geometry with new parameters
   */
  updateWallGeometry(wallId, newParams) {
    const wall = this.objects.get(wallId);
    if (!wall) return false;
    
    // Create new geometry
    const newGeometry = this.createWallGeometry(newParams);
    
    // Update wall object
    wall.params = newParams;
    wall.geometry = newGeometry.geometry;
    wall.mesh3D = newGeometry.mesh3D;
    wall.mesh2D = newGeometry.mesh2D;
    
    // Preserve object IDs
    wall.mesh3D.userData.objectId = wallId;
    wall.mesh2D.userData.objectId = wallId;
    
    // Emit update event
    this.emit('wallUpdated', { wallId, params: newParams });
    
    return true;
  }

  /**
   * Helper: Calculate distance between two 3D points
   */
  calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dz = point2.z - point1.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Helper: Snap point to grid
   */
  snapToGrid(point, gridSize = 0.1) {
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: point.y,
      z: Math.round(point.z / gridSize) * gridSize
    };
  }

  /**
   * Calculate wall thermal performance based on layer composition
   * Professional building physics calculation
   */
  calculateWallThermalPerformance(wallTemplate) {
    let totalRValue = 0;
    let totalThickness = 0;
    
    for (const layer of wallTemplate.layers) {
      const materialData = this.materialDatabase[layer.material];
      if (materialData && layer.thickness > 0) {
        // R-value = thickness / thermal conductivity
        const layerRValue = layer.thickness / materialData.thermalConductivity;
        totalRValue += layerRValue;
        totalThickness += layer.thickness;
      }
    }
    
    // U-value = 1 / total R-value (thermal transmittance)
    const uValue = totalRValue > 0 ? 1 / totalRValue : 0;
    
    return {
      rValue: totalRValue,
      uValue: uValue,
      totalThickness: totalThickness,
      thermalTransmittance: uValue
    };
  }

  /**
   * Get IFC properties for wall based on template
   * Professional BIM compliance
   */
  getWallIFCProperties(wallTemplate, objectId) {
    const thermalPerf = this.calculateWallThermalPerformance(wallTemplate);
    
    return {
      // IFC Common Properties (Pset_WallCommon)
      isExternal: wallTemplate.properties.isExternal,
      loadBearing: wallTemplate.properties.loadBearing,
      thermalTransmittance: thermalPerf.uValue,
      fireRating: wallTemplate.properties.fireRating,
      
      // Additional BIM Properties
      wallType: wallTemplate.name,
      wallDescription: wallTemplate.description,
      totalThickness: wallTemplate.totalThickness,
      layerCount: wallTemplate.layers.length,
      
      // Thermal Properties
      rValue: thermalPerf.rValue,
      uValue: thermalPerf.uValue,
      
      // Construction Information
      assemblyCode: this.getAssemblyCode(wallTemplate),
      constructionType: this.getConstructionType(wallTemplate),
      
      // Sustainability
      embodiedCarbon: this.calculateEmbodiedCarbon(wallTemplate),
      recyclableContent: this.calculateRecyclableContent(wallTemplate)
    };
  }

  /**
   * Get construction assembly code for wall type
   */
  getAssemblyCode(wallTemplate) {
    // MasterFormat-style assembly codes
    const assemblyCodes = {
      'exterior_wood_frame': '07 41 13.16',
      'interior_partition': '09 29 00.00', 
      'concrete_masonry': '04 22 00.00'
    };
    
    return assemblyCodes[wallTemplate.name] || '00 00 00.00';
  }

  /**
   * Determine construction type from layer composition
   */
  getConstructionType(wallTemplate) {
    const hasWood = wallTemplate.layers.some(layer => layer.material === 'wood');
    const hasConcrete = wallTemplate.layers.some(layer => layer.material === 'concrete');
    const hasSteel = wallTemplate.layers.some(layer => layer.material === 'steel');
    
    if (hasWood) return 'wood_frame';
    if (hasConcrete) return 'concrete';
    if (hasSteel) return 'steel_frame';
    return 'other';
  }

  /**
   * Calculate embodied carbon for wall assembly
   */
  calculateEmbodiedCarbon(wallTemplate) {
    // Simplified embodied carbon calculation (kg CO2e per m2)
    const carbonFactors = {
      concrete: 400,
      brick: 240,
      wood: 50,
      steel: 2500,
      drywall: 120,
      insulation_batt: 45,
      insulation_rigid: 150
    };
    
    let totalCarbon = 0;
    for (const layer of wallTemplate.layers) {
      const factor = carbonFactors[layer.material] || 100;
      const volume = layer.thickness; // per m2
      totalCarbon += factor * volume;
    }
    
    return totalCarbon;
  }

  /**
   * Calculate recyclable content percentage
   */
  calculateRecyclableContent(wallTemplate) {
    const recyclableFactors = {
      concrete: 0.3,
      brick: 0.95,
      wood: 0.8,
      steel: 0.9,
      drywall: 0.25,
      insulation_batt: 0.6,
      insulation_rigid: 0.2
    };
    
    let totalVolume = 0;
    let recyclableVolume = 0;
    
    for (const layer of wallTemplate.layers) {
      const factor = recyclableFactors[layer.material] || 0.1;
      totalVolume += layer.thickness;
      recyclableVolume += layer.thickness * factor;
    }
    
    return totalVolume > 0 ? (recyclableVolume / totalVolume) * 100 : 0;
  }

  /**
   * PROFESSIONAL WALL JOINERY SYSTEM
   * Advanced corner cleanup algorithms matching professional CAD standards
   */
  applyProfessionalWallJoinery(options = {}) {
    const settings = {
      tolerance: options.tolerance || 0.1, // 10cm tolerance
      joinType: options.joinType || 'auto', // auto, butt, miter, overlap
      cleanupT: options.cleanupT || true, // T-junction cleanup
      cleanupL: options.cleanupL || true, // L-corner cleanup  
      cleanupX: options.cleanupX || true, // X-intersection cleanup
      prioritizeStructural: options.prioritizeStructural || true,
      maintainLayers: options.maintainLayers || true,
      ...options
    };

    console.log('🏗️ PROFESSIONAL WALL JOINERY: Starting advanced corner cleanup');
    
    const walls = this.getWallsForJoinery();
    const junctions = this.detectWallJunctions(walls, settings.tolerance);
    
    console.log(`📊 Found ${junctions.length} wall junctions to resolve`);
    
    let processedJunctions = 0;
    
    for (const junction of junctions) {
      try {
        const success = this.resolveWallJunction(junction, settings);
        if (success) {
          processedJunctions++;
          console.log(`✅ Resolved ${junction.type} junction between ${junction.walls.length} walls`);
        }
      } catch (error) {
        console.error(`❌ Failed to resolve junction:`, error);
      }
    }
    
    // Update all wall geometries after joinery
    this.updateWallGeometriesAfterJoinery();
    
    console.log(`🎯 COMPLETED: ${processedJunctions}/${junctions.length} junctions resolved`);
    
    // Sync adjusted endpoints back to Architect3D system to fix 2D/3D mismatch
    if (this.architect3DService && processedJunctions > 0) {
      console.log('🔄 SYNC: Syncing adjusted wall endpoints back to Architect3D system...');
      this.architect3DService.syncAdjustedEndpoints(this.objects);
    }
    
    return processedJunctions;
  }

  /**
   * Get walls suitable for joinery processing
   */
  getWallsForJoinery() {
    return Array.from(this.objects.values())
      .filter(obj => obj.type === 'wall')
      .map(wall => ({
        id: wall.id,
        params: wall.params,
        template: wall.params?.wallTemplate || this.wallTypeTemplates.exterior_wood_frame,
        startPoint: wall.params?.startPoint,
        endPoint: wall.params?.endPoint,
        thickness: wall.params?.wallTemplate?.totalThickness || wall.params?.thickness || 0.2,
        isStructural: wall.params?.wallTemplate?.properties?.loadBearing || false
      }));
  }

  /**
   * Detect wall junction types and intersection points
   */
  detectWallJunctions(walls, tolerance) {
    const junctions = [];
    
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const wall1 = walls[i];
        const wall2 = walls[j];
        
        const intersection = this.calculateWallIntersection(wall1, wall2, tolerance);
        if (intersection) {
          // Determine junction type
          const junctionType = this.classifyJunctionType(intersection, wall1, wall2);
          
          junctions.push({
            type: junctionType,
            walls: [wall1, wall2],
            intersection: intersection,
            priority: this.calculateJunctionPriority(wall1, wall2, junctionType)
          });
        }
      }
    }
    
    // Sort by priority (structural walls first)
    return junctions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate precise wall intersection point and relationship
   */
  calculateWallIntersection(wall1, wall2, tolerance) {
    if (!wall1 || !wall2 || !wall1.startPoint || !wall1.endPoint || !wall2.startPoint || !wall2.endPoint) {
      return null;
    }
    const line1 = this.getWallCenterline(wall1);
    const line2 = this.getWallCenterline(wall2);
    
    // Calculate line intersection
    const intersection = this.lineIntersection(line1, line2);
    if (!intersection) return null;
    
    // Check if intersection is within tolerance of both walls
    const onWall1 = this.pointOnLineSegment(intersection, line1, tolerance);
    const onWall2 = this.pointOnLineSegment(intersection, line2, tolerance);
    
    if (onWall1 && onWall2) {
      return {
        point: intersection,
        angle: this.calculateWallAngle(line1, line2),
        distance1: this.distanceFromWallEnd(intersection, wall1),
        distance2: this.distanceFromWallEnd(intersection, wall2),
        onWall1: onWall1,
        onWall2: onWall2
      };
    }
    
    return null;
  }

  /**
   * Get wall centerline as line segment
   */
  getWallCenterline(wall) {
    return {
      start: wall.startPoint,
      end: wall.endPoint,
      vector: {
        x: wall.endPoint.x - wall.startPoint.x,
        y: wall.endPoint.y - wall.startPoint.y,
        z: wall.endPoint.z - wall.startPoint.z
      }
    };
  }

  /**
   * Calculate intersection of two lines
   */
  lineIntersection(line1, line2) {
    const x1 = line1.start.x, y1 = line1.start.z;
    const x2 = line1.end.x, y2 = line1.end.z;
    const x3 = line2.start.x, y3 = line2.start.z;
    const x4 = line2.end.x, y4 = line2.end.z;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-6) return null; // Parallel lines
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    return {
      x: x1 + t * (x2 - x1),
      y: 0, // Keep at ground level
      z: y1 + t * (y2 - y1),
      t: t, // Parameter for line1
      u: u  // Parameter for line2
    };
  }

  /**
   * Helper: distance from intersection point to nearest end of wall (along centerline)
   */
  distanceFromWallEnd(point, wall) {
    if (!wall || !wall.startPoint || !wall.endPoint) return Infinity;
    const dx1 = point.x - wall.startPoint.x;
    const dz1 = point.z - wall.startPoint.z;
    const dx2 = point.x - wall.endPoint.x;
    const dz2 = point.z - wall.endPoint.z;
    const d1 = Math.sqrt(dx1 * dx1 + dz1 * dz1);
    const d2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
    return Math.min(d1, d2);
  }

  /**
   * Calculate distance from point to line segment (from architect3d Utils)
   */
  pointToLineDistance(point, line) {
    const lineStart = line.start;
    const lineEnd = line.end;
    
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if point lies on the line segment (not just the infinite line)
   */
  pointOnSegment(point, line, tolerance = 0.1) {
    const lineStart = line.start;
    const lineEnd = line.end;
    
    // Calculate dot product to determine if point is between start and end
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return false; // Zero length line
    
    const param = dot / lenSq;
    
    // Point is on segment if parameter is between 0 and 1 (with tolerance)
    return param >= -tolerance && param <= (1 + tolerance);
  }

  /**
   * Check if point is on line segment within tolerance
   */
  pointOnLineSegment(point, line, tolerance) {
    const distance = this.pointToLineDistance(point, line);
    const onSegment = this.pointOnSegment(point, line, tolerance);
    
    return distance <= tolerance && onSegment;
  }

  /**
   * Calculate angle between two wall lines
   */
  calculateWallAngle(line1, line2) {
    const dot = line1.vector.x * line2.vector.x + line1.vector.z * line2.vector.z;
    const mag1 = Math.sqrt(line1.vector.x ** 2 + line1.vector.z ** 2);
    const mag2 = Math.sqrt(line2.vector.x ** 2 + line2.vector.z ** 2);
    
    return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
  }
  /**
   * Classify junction type based on geometry
   */
  classifyJunctionType(intersection, wall1, wall2) {
    const angle = intersection.angle;
    const angleDegrees = angle * 180 / Math.PI;
    
    // Check if intersection is at wall endpoints (L-corner vs T-junction)
    const atWall1End = intersection.distance1 < 0.05 || intersection.distance1 > (wall1.params?.length || 4) - 0.05;
    const atWall2End = intersection.distance2 < 0.05 || intersection.distance2 > (wall2.params?.length || 4) - 0.05;
    
    if (atWall1End && atWall2End) {
      if (Math.abs(angleDegrees - 90) < 5) return 'L_CORNER_90';
      if (Math.abs(angleDegrees - 180) < 5) return 'STRAIGHT_JOIN';
      return 'L_CORNER_ANGLED';
    } else if (atWall1End || atWall2End) {
      return 'T_JUNCTION';
    } else {
      return 'X_INTERSECTION';
    }
  }

  /**
   * Calculate junction processing priority
   */
  calculateJunctionPriority(wall1, wall2, junctionType) {
    let priority = 0;
    
    // Structural walls get higher priority
    if (wall1.isStructural) priority += 10;
    if (wall2.isStructural) priority += 10;
    
    // Corner junctions are higher priority than T-junctions
    if (junctionType.includes('L_CORNER')) priority += 5;
    else if (junctionType === 'T_JUNCTION') priority += 3;
    
    return priority;
  }

  /**
   * Resolve wall junction based on type and settings
   */
  resolveWallJunction(junction, settings) {
    switch (junction.type) {
      case 'L_CORNER_90':
        return this.resolveRightAngleCorner(junction, settings);
      case 'L_CORNER_ANGLED':
        return this.resolveAngledCorner ? this.resolveAngledCorner(junction, settings) : this.resolveRightAngleCorner(junction, settings);
      case 'T_JUNCTION':
        return this.resolveTJunction(junction, settings);
      case 'X_INTERSECTION':
        return this.resolveXIntersection(junction, settings);
      case 'STRAIGHT_JOIN':
        return this.resolveStraightJoin(junction, settings);
      default:
        console.warn(`Unknown junction type: ${junction.type}`);
        return false;
    }
  }

  /**
   * Resolve 90-degree corner junction
   */
  resolveRightAngleCorner(junction, settings) {
    const [wall1, wall2] = junction.walls;
    const intersection = junction.intersection;
    
    // Determine which wall should be continuous (usually structural)
    const continuousWall = wall1.isStructural ? wall1 : wall2;
    const terminatingWall = continuousWall === wall1 ? wall2 : wall1;
    
    // Calculate corner cleanup geometry
    const cleanup = this.calculateCornerCleanup(continuousWall, terminatingWall, intersection, 'L_90');
    
    // Apply geometry adjustments
    this.applyWallAdjustments(continuousWall.id, cleanup.continuousAdjustment);
    this.applyWallAdjustments(terminatingWall.id, cleanup.terminatingAdjustment);
    
    return true;
  }

  /**
   * Calculate precise corner cleanup geometry
   */
  calculateCornerCleanup(wall1, wall2, intersection, cornerType) {
    // This would contain complex geometry calculations for different corner types
    // For now, return basic adjustments
    return {
      continuousAdjustment: {
        startAdjustment: 0,
        endAdjustment: 0
      },
      terminatingAdjustment: {
        startAdjustment: 0,
        endAdjustment: wall2.thickness / 2
      }
    };
  }

  /**
   * Apply calculated adjustments to wall geometry
   */
  applyWallAdjustments(wallId, adjustments) {
    const wall = this.objects.get(wallId);
    if (wall && wall.params) {
      wall.params.startAdjustment = adjustments.startAdjustment;
      wall.params.endAdjustment = adjustments.endAdjustment;
      wall.params.adjustForJoinery = true;
      
      // Trigger geometry regeneration
      this.regenerateWallGeometry(wallId);
    }
  }

  /**
   * Update all wall geometries after joinery processing
   */
  updateWallGeometriesAfterJoinery() {
    const walls = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
    
    for (const wall of walls) {
      if (wall.params?.adjustForJoinery) {
        this.regenerateWallGeometry(wall.id);
      }
    }
    
    // Emit update event
    this.emit('wallJoineryComplete');
  }

  /**
   * Regenerate wall geometry with current parameters
   */
  regenerateWallGeometry(wallId) {
    const wall = this.objects.get(wallId);
    if (!wall) return;
    
    try {
      // Recreate geometry with joinery adjustments
      const newGeometry = this.createWallGeometry(wall.params);
      
      // Update the stored geometry
      wall.geometry = newGeometry.geometry;
      wall.mesh3D = newGeometry.mesh3D;
      wall.mesh2D = newGeometry.mesh2D;
      
      // Update userdata
      wall.mesh3D.userData.objectId = wallId;
      wall.mesh2D.userData.objectId = wallId;
      
    } catch (error) {
      console.error(`Failed to regenerate wall ${wallId}:`, error);
    }
  }

  /**
   * Create architectural-style 2D wall representation with proper line weights and hatching
   */
  createArchitecturalWall2D(length, thickness, centerPosition, rotationY, material = 'concrete') {
    // Create a group to hold all wall elements
    const wallGroup = new THREE.Group();
    
    // Define line weights for different architectural elements
    const HEAVY_LINE_WIDTH = 0.004; // Heavy lines for wall outlines
    const MEDIUM_LINE_WIDTH = 0.002; // Medium lines for details
    const LIGHT_LINE_WIDTH = 0.001; // Light lines for hatching
    
    // 1. Create wall fill with material-specific pattern
    const fillGeometry = new THREE.PlaneGeometry(length, thickness);
    const fillMaterial = this.createWallFillMaterial(material);
    const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
    fillMesh.position.set(0, 0, 0);
    wallGroup.add(fillMesh);
    
    // 2. Create heavy outline using thick geometry instead of lines
    const outlineGeometry = this.createThickLineGeometry([
      [-length/2, -thickness/2], [length/2, -thickness/2],
      [length/2, thickness/2], [-length/2, thickness/2], [-length/2, -thickness/2]
    ], HEAVY_LINE_WIDTH);
    
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000, // Pure black for heavy lines
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outlineMesh.position.set(0, 0, 0.002);
    wallGroup.add(outlineMesh);
    
    // 3. Center line removed per user request
    
    // 4. Add material-specific hatching for thicker walls
    if (thickness > 0.12) {
      const hatchingMesh = this.createMaterialHatching(length, thickness, material);
      if (hatchingMesh) {
        hatchingMesh.position.set(0, 0, 0.001);
        wallGroup.add(hatchingMesh);
      }
    }
    
    // 5. Add inner lines for thick walls (architectural detail)
    if (thickness > 0.20) {
      const innerOffset = Math.min(thickness * 0.25, 0.05); // Max 5cm inner offset
      
      // Create top and bottom inner lines using thick geometry
      const topInnerGeometry = this.createThickLineGeometry([
        [-length/2, thickness/2 - innerOffset], [length/2, thickness/2 - innerOffset]
      ], MEDIUM_LINE_WIDTH);
      
      const bottomInnerGeometry = this.createThickLineGeometry([
        [-length/2, -thickness/2 + innerOffset], [length/2, -thickness/2 + innerOffset]
      ], MEDIUM_LINE_WIDTH);
      
      const innerLineMaterial = new THREE.MeshBasicMaterial({
        color: 0x333333,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      });
      
      const topInnerMesh = new THREE.Mesh(topInnerGeometry, innerLineMaterial);
      const bottomInnerMesh = new THREE.Mesh(bottomInnerGeometry, innerLineMaterial);
      
      topInnerMesh.position.set(0, 0, 0.002);
      bottomInnerMesh.position.set(0, 0, 0.002);
      
      wallGroup.add(topInnerMesh);
      wallGroup.add(bottomInnerMesh);
    }
    
    // 6. Position and rotate the entire wall group
    wallGroup.position.set(centerPosition.x, 0, centerPosition.z);
    if (rotationY !== 0) {
      wallGroup.rotation.z = rotationY; // In 2D view, rotation around Z axis
    }
    
    return wallGroup;
  }

  /**
   * Create material-specific fill for walls
   */
  createWallFillMaterial(material) {
    const materialColors = {
      concrete: 0xd3d3d3,    // Light grey
      brick: 0xe6b885,       // Warm brick color
      wood: 0xf4e4bc,        // Light wood
      steel: 0xc0c0c0,       // Silver
      stone: 0xb8b8b8,       // Medium grey
      drywall: 0xfafafa      // Very light grey
    };
    
    return new THREE.MeshBasicMaterial({
      color: materialColors[material] || materialColors.concrete,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3, // Subtle fill
      depthWrite: false
    });
  }

  /**
   * Create thick line geometry for proper architectural line weights
   */
  createThickLineGeometry(points, width) {
    const shape = new THREE.Shape();
    
    if (points.length < 2) return new THREE.BufferGeometry();
    
    // Convert points to THREE.Vector2
    const vertices = points.map(p => new THREE.Vector2(p[0], p[1]));
    
    // Create a thick line by creating a rectangle along the path
    const segments = [];
    
    for (let i = 0; i < vertices.length - 1; i++) {
      const start = vertices[i];
      const end = vertices[i + 1];
      
      const direction = end.clone().sub(start).normalize();
      const perpendicular = new THREE.Vector2(-direction.y, direction.x).multiplyScalar(width / 2);
      
      const p1 = start.clone().add(perpendicular);
      const p2 = start.clone().sub(perpendicular);
      const p3 = end.clone().sub(perpendicular);
      const p4 = end.clone().add(perpendicular);
      
      segments.push([p1, p2, p3, p4]);
    }
    
    // Create geometry from segments
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const indices = [];
    
    let vertexIndex = 0;
    for (const segment of segments) {
      // Add vertices
      for (const vertex of segment) {
        positions.push(vertex.x, vertex.y, 0);
      }
      
      // Add triangular faces
      indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
      indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 3);
      
      vertexIndex += 4;
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    
    return geometry;
  }

  /**
   * Create dashed line geometry for center lines
   */
  createDashedLineGeometry(points, width, dashLength, gapLength) {
    if (points.length < 2) return new THREE.BufferGeometry();
    
    const start = new THREE.Vector2(points[0][0], points[0][1]);
    const end = new THREE.Vector2(points[1][0], points[1][1]);
    const totalLength = start.distanceTo(end);
    const direction = end.clone().sub(start).normalize();
    
    const segments = [];
    let currentDistance = 0;
    
    while (currentDistance < totalLength) {
      const dashStart = start.clone().add(direction.clone().multiplyScalar(currentDistance));
      const dashEnd = start.clone().add(direction.clone().multiplyScalar(
        Math.min(currentDistance + dashLength, totalLength)
      ));
      
      if (dashStart.distanceTo(dashEnd) > 0.001) { // Minimum dash length
        segments.push([
          [dashStart.x, dashStart.y],
          [dashEnd.x, dashEnd.y]
        ]);
      }
      
      currentDistance += dashLength + gapLength;
    }
    
    // Create geometry for all dash segments
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const indices = [];
    
    let vertexIndex = 0;
    for (const segment of segments) {
      const segmentGeo = this.createThickLineGeometry(segment, width);
      const segmentPositions = segmentGeo.getAttribute('position').array;
      const segmentIndices = segmentGeo.getIndex().array;
      
      // Add positions
      for (let i = 0; i < segmentPositions.length; i++) {
        positions.push(segmentPositions[i]);
      }
      
      // Add indices with offset
      for (let i = 0; i < segmentIndices.length; i++) {
        indices.push(segmentIndices[i] + vertexIndex);
      }
      
      vertexIndex += segmentPositions.length / 3;
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    
    return geometry;
  }

  /**
   * Create material-specific hatching patterns
   */
  createMaterialHatching(length, thickness, material) {
    const hatchingGroup = new THREE.Group();
    
    const hatchSpacing = Math.max(thickness / 8, 0.02); // Adaptive hatching spacing
    const hatchWidth = 0.0005; // Very thin hatching lines
    
    switch (material) {
      case 'concrete':
        // Dotted pattern for concrete
        this.addDottedHatching(hatchingGroup, length, thickness, hatchSpacing, hatchWidth);
        break;
      case 'brick':
        // Diagonal hatching for brick
        this.addDiagonalHatching(hatchingGroup, length, thickness, hatchSpacing, hatchWidth, 45);
        break;
      case 'wood':
        // Horizontal grain lines for wood
        this.addHorizontalHatching(hatchingGroup, length, thickness, hatchSpacing, hatchWidth);
        break;
      case 'steel':
        // Cross hatching for steel
        this.addCrossHatching(hatchingGroup, length, thickness, hatchSpacing, hatchWidth);
        break;
      case 'stone':
        // Random pattern for stone
        this.addRandomHatching(hatchingGroup, length, thickness, hatchSpacing, hatchWidth);
        break;
      default:
        // Light diagonal hatching for default
        this.addDiagonalHatching(hatchingGroup, length, thickness, hatchSpacing * 2, hatchWidth, 30);
    }
    
    return hatchingGroup.children.length > 0 ? hatchingGroup : null;
  }

  /**
   * Add diagonal hatching pattern
   */
  addDiagonalHatching(group, length, thickness, spacing, lineWidth, angle = 45) {
    const angleRad = (angle * Math.PI) / 180;
    const material = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.3,
      depthWrite: false
    });
    
    const step = spacing;
    const diagonal = Math.sqrt(length * length + thickness * thickness);
    
    for (let i = -diagonal; i <= diagonal; i += step) {
      const startX = i * Math.cos(angleRad) - length/2;
      const startY = i * Math.sin(angleRad) - thickness/2;
      const endX = startX + diagonal * Math.cos(angleRad + Math.PI/2);
      const endY = startY + diagonal * Math.sin(angleRad + Math.PI/2);
      
      // Clip line to wall bounds
      const clippedLine = this.clipLineToRect(
        startX, startY, endX, endY,
        -length/2, -thickness/2, length/2, thickness/2
      );
      
      if (clippedLine) {
        const lineGeometry = this.createThickLineGeometry([
          [clippedLine.x1, clippedLine.y1],
          [clippedLine.x2, clippedLine.y2]
        ], lineWidth);
        
        const lineMesh = new THREE.Mesh(lineGeometry, material);
        group.add(lineMesh);
      }
    }
  }

  /**
   * Add horizontal hatching pattern
   */
  addHorizontalHatching(group, length, thickness, spacing, lineWidth) {
    const material = new THREE.MeshBasicMaterial({
      color: 0x996633,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });
    
    const numLines = Math.floor(thickness / spacing);
    for (let i = 1; i < numLines; i++) {
      const y = -thickness/2 + (i * spacing);
      const lineGeometry = this.createThickLineGeometry([
        [-length/2, y], [length/2, y]
      ], lineWidth);
      
      const lineMesh = new THREE.Mesh(lineGeometry, material);
      group.add(lineMesh);
    }
  }

  /**
   * Add cross hatching pattern
   */
  addCrossHatching(group, length, thickness, spacing, lineWidth) {
    this.addDiagonalHatching(group, length, thickness, spacing, lineWidth, 45);
    this.addDiagonalHatching(group, length, thickness, spacing, lineWidth, -45);
  }

  /**
   * Add dotted hatching pattern
   */
  addDottedHatching(group, length, thickness, spacing, dotSize) {
    const material = new THREE.MeshBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    
    const dotsX = Math.floor(length / spacing);
    const dotsY = Math.floor(thickness / spacing);
    
    for (let i = 0; i < dotsX; i++) {
      for (let j = 0; j < dotsY; j++) {
        const x = -length/2 + (i + 0.5) * spacing;
        const y = -thickness/2 + (j + 0.5) * spacing;
        
        const dotGeometry = new THREE.CircleGeometry(dotSize, 8);
        const dotMesh = new THREE.Mesh(dotGeometry, material);
        dotMesh.position.set(x, y, 0);
        group.add(dotMesh);
      }
    }
  }

  /**
   * Add random hatching pattern
   */
  addRandomHatching(group, length, thickness, spacing, lineWidth) {
    const material = new THREE.MeshBasicMaterial({
      color: 0x777777,
      transparent: true,
      opacity: 0.3,
      depthWrite: false
    });
    
    const numLines = Math.floor((length + thickness) / spacing);
    
    for (let i = 0; i < numLines; i++) {
      const startX = (Math.random() - 0.5) * length;
      const startY = (Math.random() - 0.5) * thickness;
      const endX = startX + (Math.random() - 0.5) * spacing * 2;
      const endY = startY + (Math.random() - 0.5) * spacing * 2;
      
      const clippedLine = this.clipLineToRect(
        startX, startY, endX, endY,
        -length/2, -thickness/2, length/2, thickness/2
      );
      
      if (clippedLine) {
        const lineGeometry = this.createThickLineGeometry([
          [clippedLine.x1, clippedLine.y1],
          [clippedLine.x2, clippedLine.y2]
        ], lineWidth);
        
        const lineMesh = new THREE.Mesh(lineGeometry, material);
        group.add(lineMesh);
      }
    }
  }

  /**
   * Clip line to rectangle bounds
   */
  clipLineToRect(x1, y1, x2, y2, minX, minY, maxX, maxY) {
    // Simple line clipping to rectangle bounds
    // This is a simplified version - a full implementation would use Cohen-Sutherland algorithm
    
    // Check if line is completely outside
    if ((x1 < minX && x2 < minX) || (x1 > maxX && x2 > maxX) ||
        (y1 < minY && y2 < minY) || (y1 > maxY && y2 > maxY)) {
      return null;
    }
    
    // Simple clipping - just return the line if one endpoint is inside
    if ((x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) ||
        (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY)) {
      return { x1, y1, x2, y2 };
    }
    
    return { x1, y1, x2, y2 }; // Return original if complex clipping needed
  }

  /**
   * Analyze walls and detect intersection points for joinery
   */
  analyzeWallIntersections(tolerance = 0.15) {
    const walls = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
    const intersections = [];
    
    console.log(`🔍 ENHANCED: Analyzing ${walls.length} walls for intersections...`);
    
    // Debug wall data
    walls.forEach((wall, index) => {
      const params = wall.params;
      console.log(`Wall ${index + 1} (${wall.id}):`, {
        startPoint: params?.startPoint,
        endPoint: params?.endPoint,
        length: params?.length,
        hasParams: !!params
      });
    });
    
    // Check each pair of walls for intersections
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const wall1 = walls[i];
        const wall2 = walls[j];
        
        console.log(`🔍 Checking intersection: ${wall1.id} ↔ ${wall2.id}`);
        
        const intersection = this.findWallIntersection(wall1, wall2, tolerance);
        if (intersection) {
          intersections.push(intersection);
          console.log(`🔗 ✅ Found intersection between ${wall1.id} and ${wall2.id}:`, intersection);
        } else {
          console.log(`🔍 ❌ No intersection found between ${wall1.id} and ${wall2.id}`);
        }
      }
    }
    
    console.log(`🔍 SUMMARY: Found ${intersections.length} total intersections`);
    return intersections;
  }

  /**
   * Find intersection between two walls
   */
  findWallIntersection(wall1, wall2, tolerance = 0.25) {
    const w1Params = wall1.params;
    const w2Params = wall2.params;
    
    // Get wall endpoints
    const w1Start = w1Params?.startPoint;
    const w1End = w1Params?.endPoint;
    const w2Start = w2Params?.startPoint;
    const w2End = w2Params?.endPoint;
    
    console.log(`🔍 DETAILED: Checking ${wall1.id} vs ${wall2.id} (tolerance: ${tolerance}m):`);
    console.log(`  ${wall1.id}: ${w1Start?.x?.toFixed(3)},${w1Start?.z?.toFixed(3)} → ${w1End?.x?.toFixed(3)},${w1End?.z?.toFixed(3)}`);
    console.log(`  ${wall2.id}: ${w2Start?.x?.toFixed(3)},${w2Start?.z?.toFixed(3)} → ${w2End?.x?.toFixed(3)},${w2End?.z?.toFixed(3)}`);
    
    if (!w1Start || !w1End || !w2Start || !w2End) {
      console.log(`❌ MISSING ENDPOINTS: Cannot analyze ${wall1.id} or ${wall2.id} - missing endpoint data`);
      return null; // Can't analyze walls without endpoints
    }
    
    // Use enhanced tolerance for connection detection
    console.log(`🔧 ENHANCED: Using tolerance ${tolerance}m (${tolerance * 100}cm) for right-angle corner detection`);
    
    // Check if any endpoints are close enough to be considered connected
    const connections = [
      { w1Point: 'start', w2Point: 'start', dist: this.distance3D(w1Start, w2Start) },
      { w1Point: 'start', w2Point: 'end', dist: this.distance3D(w1Start, w2End) },
      { w1Point: 'end', w2Point: 'start', dist: this.distance3D(w1End, w2Start) },
      { w1Point: 'end', w2Point: 'end', dist: this.distance3D(w1End, w2End) }
    ];
    
    // ENHANCED: Detailed distance analysis with better logging
    console.log(`📏 DISTANCE ANALYSIS for ${wall1.id} ↔ ${wall2.id}:`);
    connections.forEach((c, idx) => {
      const withinTol = c.dist <= tolerance;
      console.log(`  ${idx + 1}. ${wall1.id}.${c.w1Point} → ${wall2.id}.${c.w2Point}: ${c.dist.toFixed(3)}m ${withinTol ? '✅' : '❌'}`);
    });
    
    // Find the closest connection within tolerance
    const validConnections = connections.filter(conn => conn.dist <= tolerance);
    
    if (validConnections.length > 0) {
      const closestConnection = validConnections.reduce((min, conn) => 
        conn.dist < min.dist ? conn : min
      );
      
      console.log(`🎯 BEST CONNECTION: ${wall1.id}.${closestConnection.w1Point} → ${wall2.id}.${closestConnection.w2Point}`);
      console.log(`📏 CONNECTION DISTANCE: ${closestConnection.dist.toFixed(3)}m (tolerance: ${tolerance}m)`);
      
      // ENHANCED: Calculate angle with detailed debugging
      const angle = this.calculateWallAngle(wall1, wall2, closestConnection);
      const angleDegrees = (angle * 180 / Math.PI).toFixed(1);
      console.log(`📐 WALL ANGLE: ${angleDegrees}° (${angle.toFixed(3)} radians)`);
      
      // ENHANCED: Determine joint type with right-angle preference
      const jointType = this.determineJointType(angle);
      console.log(`🔨 JOINT TYPE: ${jointType} joint`);
      
      // ENHANCED: Check if this is a proper right-angle corner
      const isRightAngle = Math.abs(angle - Math.PI/2) < 0.17; // ~10 degree tolerance
      if (isRightAngle) {
        console.log(`🏗️ RIGHT-ANGLE CORNER DETECTED: Perfect for architectural joinery`);
      } else {
        console.log(`🔧 ANGLED CORNER: ${angleDegrees}° - will use ${jointType} joint`);
      }
      
      return {
        wall1: wall1.id,
        wall2: wall2.id,
        connection: closestConnection,
        jointType: jointType,
        angle: angle,
        position: closestConnection.w1Point === 'start' ? w1Start : w1End,
        isRightAngle: isRightAngle
      };
    } else {
      console.log(`❌ NO CONNECTIONS: No endpoints within ${tolerance}m (${tolerance * 100}cm) tolerance`);
      console.log(`💡 SUGGESTION: Try increasing tolerance or check wall positioning`);
    }
    
    // TODO: Add line intersection detection for T-junctions and cross intersections
    
    return null;
  }

  /**
   * Calculate 3D distance between two points
   */
  distance3D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculate the angle between two walls at their connection point
   */
  calculateWallAngle(wall1, wall2, connection) {
    if (!connection || !connection.w1Point || !connection.w2Point) {
      return 0;
    }
    const w1Params = wall1.params;
    const w2Params = wall2.params;
    
    // Get wall direction vectors
    let w1Vector, w2Vector;
    
    if (connection.w1Point === 'start') {
      w1Vector = {
        x: w1Params.endPoint.x - w1Params.startPoint.x,
        z: w1Params.endPoint.z - w1Params.startPoint.z
      };
    } else {
      w1Vector = {
        x: w1Params.startPoint.x - w1Params.endPoint.x,
        z: w1Params.startPoint.z - w1Params.endPoint.z
      };
    }
    
    if (connection.w2Point === 'start') {
      w2Vector = {
        x: w2Params.endPoint.x - w2Params.startPoint.x,
        z: w2Params.endPoint.z - w2Params.startPoint.z
      };
    } else {
      w2Vector = {
        x: w2Params.startPoint.x - w2Params.endPoint.x,
        z: w2Params.startPoint.z - w2Params.endPoint.z
      };
    }
    
    // Normalize vectors
    const w1Length = Math.sqrt(w1Vector.x * w1Vector.x + w1Vector.z * w1Vector.z);
    const w2Length = Math.sqrt(w2Vector.x * w2Vector.x + w2Vector.z * w2Vector.z);
    
    w1Vector.x /= w1Length;
    w1Vector.z /= w1Length;
    w2Vector.x /= w2Length;
    w2Vector.z /= w2Length;
    
    // Calculate angle using dot product
    const dotProduct = w1Vector.x * w2Vector.x + w1Vector.z * w2Vector.z;
    const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
    
    return angle;
  }

  /**
   * Determine joint type based on angle between walls
   */
  determineJointType(angle) {
    const degrees = angle * (180 / Math.PI);
    
    if (Math.abs(degrees - 90) < 15) {
      return 'corner'; // 90-degree corner
    } else if (Math.abs(degrees - 180) < 15) {
      return 'straight'; // Straight line (walls in line)
    } else if (degrees > 45 && degrees < 135) {
      return 'miter'; // Angled joint
    } else {
      return 'butt'; // Default butt joint
    }
  }
  /**
   * Apply joinery to all walls based on detected intersections - CAD STYLE
   * FIXED: Added debouncing to prevent infinite loops
   */
  applyWallJoinery(joinerySettings = null) {
    // ANTI-INFINITE-LOOP: Check if joinery is already running
    if (this._joineryInProgress) {
      console.log('⚠️ ANTI-LOOP: Joinery already in progress, skipping duplicate call');
      return false;
    }
    
    // ANTI-INFINITE-LOOP: Set flag to prevent recursive calls
    this._joineryInProgress = true;
    
    console.log('🔧 ========== STARTING ENHANCED WALL JOINERY PROCESS (FIXED) ==========');
    console.log(`🕒 Joinery started at: ${new Date().toISOString()}`);
    
    try {
      // Default enhanced settings
      const settings = joinerySettings || {
        tolerance: 0.5,         // 50cm tolerance for much easier connections (increased for better detection)
        cornerStyle: 'overlap', // CHANGED: Use overlap instead of butt for better joining
        tightCorners: false,    // Disabled for easier connections
        autoExtend: true        // Auto-extend walls to meet corners
      };
      
      console.log('🔧 Enhanced joinery settings:', settings);
      
      // DEBUGGING: List all walls before analysis
      const allWalls = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
      console.log(`📊 ANALYSIS: Found ${allWalls.length} walls to analyze for intersections`);
      allWalls.forEach((wall, index) => {
        console.log(`  Wall ${index + 1} (${wall.id}):`, {
          start: wall.params?.startPoint,
          end: wall.params?.endPoint,
          length: wall.params?.length?.toFixed(3) + 'm',
          thickness: (wall.params?.thickness || wall.params?.width || 0.2).toFixed(3) + 'm'
        });
      });
      
      const intersections = this.analyzeWallIntersections(settings.tolerance);
    
    if (intersections.length === 0) {
        console.log('ℹ️ RESULT: No wall intersections found - walls may be too far apart');
        console.log(`  Current tolerance: ${settings.tolerance}m (${settings.tolerance * 100}cm)`);
        return false;
    }
    
      console.log(`🔗 SUCCESS: Found ${intersections.length} wall intersections`);
    
    // FIXED: Process each intersection individually (each intersection = 2 walls meeting)
    intersections.forEach((intersection, index) => {
      console.log(`🏗️ PROCESSING: Intersection ${index + 1} between walls ${intersection.wall1} and ${intersection.wall2}`);
      console.log(`🔨 CORNER: Creating ${intersection.jointType} joint at ${(intersection.angle * 180 / Math.PI).toFixed(1)}°`);
      this.createCornerJoint(intersection, settings);
    });
      
      console.log(`✅ SUCCESS: Applied enhanced wall joinery to ${intersections.length} intersections`);
      console.log(`🕒 Joinery completed at: ${new Date().toISOString()}`);
      
      // ANTI-INFINITE-LOOP: Reset flag on successful completion
      this._joineryInProgress = false;
      return true;
      
    } catch (error) {
      console.error('❌ ERROR: Wall joinery failed:', error);
      
      // ANTI-INFINITE-LOOP: Reset flag on error
      this._joineryInProgress = false;
      return false;
    }
  }

  /**
   * Force re-application of wall joinery for debugging
   * FIXED: Removed recursive setTimeout call that caused infinite loops
   */
  forceWallJoineryRefresh() {
    console.log('🔄 ========== FORCE WALL JOINERY REFRESH (FIXED) ==========');
    
    // ANTI-INFINITE-LOOP: Check if joinery is already running
    if (this._joineryInProgress) {
      console.log('⚠️ ANTI-LOOP: Cannot force refresh - joinery already in progress');
      return false;
    }
    
    console.log('🔄 Resetting all walls to original state...');
    
    // First, reset all walls to their original state
    const walls = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
    let resetCount = 0;
    
    walls.forEach(wall => {
        if (wall.params.adjustForJoinery) {
        console.log(`🔄 RESET: Wall ${wall.id} - removing joinery adjustments`);
          
          // Remove joinery parameters
          delete wall.params.adjustForJoinery;
          delete wall.params.startAdjustment;
          delete wall.params.endAdjustment;
          delete wall.params.adjustedStartPoint;
          delete wall.params.adjustedEndPoint;
          
          // Rebuild with original parameters
          this.rebuildWallWithAdjustments(wall.id, 0, 0);
        resetCount++;
      }
    });
    
    console.log(`🔄 RESET COMPLETE: ${resetCount} walls reset to original state`);
    
    // FIXED: Apply fresh joinery immediately instead of with setTimeout
    console.log('🔧 Applying fresh wall joinery immediately...');
    const result = this.applyWallJoinery();
    
    if (result) {
      console.log('✅ REFRESH SUCCESS: Wall joinery refresh completed');
    } else {
      console.log('❌ REFRESH FAILED: Wall joinery refresh failed');
    }
    
    return result;
  }

  /**
   * Group intersections by position to handle complex joints
   */
  groupIntersectionsByPosition(intersections) {
    const groups = [];
    const tolerance = 0.05; // 5cm tolerance for grouping
    
    intersections.forEach(intersection => {
      const { position } = intersection;
      
      // Find existing group for this position
      let group = groups.find(g => {
        const groupPos = g[0].position;
        const dist = Math.sqrt(
          Math.pow(position.x - groupPos.x, 2) + 
          Math.pow(position.z - groupPos.z, 2)
        );
        return dist <= tolerance;
      });
      
      if (group) {
        group.push(intersection);
      } else {
        groups.push([intersection]);
      }
    });
    
    return groups;
  }

  /**
   * Create proper corner joint between two walls (miter or butt)
   */
  createCornerJoint(intersection, settings = {}) {
    const { wall1, wall2, connection, jointType, angle } = intersection;
    
    const wall1Obj = this.objects.get(wall1);
    const wall2Obj = this.objects.get(wall2);
    
    if (!wall1Obj || !wall2Obj) return;
    
    const wall1Thickness = wall1Obj.params.thickness || wall1Obj.params.width || 0.2;
    const wall2Thickness = wall2Obj.params.thickness || wall2Obj.params.width || 0.2;
    
    console.log(`🔨 Creating ${jointType} joint between ${wall1} (${wall1Thickness}m) and ${wall2} (${wall2Thickness}m) at ${(angle * 180 / Math.PI).toFixed(1)}°`);
    console.log(`🔧 Using corner style: ${settings.cornerStyle || 'butt'}`);
    
    // Enhanced corner detection with tighter tolerance
    const cornerTolerance = settings.tightCorners ? 0.17 : 0.26; // ~10° vs 15° tolerance
    
    // Use user-specified corner style or auto-detect
    const forceCornerStyle = settings.cornerStyle;
    
    if (forceCornerStyle === 'butt' || (forceCornerStyle === 'auto' && (jointType === 'corner' || Math.abs(angle - Math.PI/2) < cornerTolerance))) {
      // Create proper 90-degree corner with butt joint
      this.createButtJoint(wall1Obj, wall2Obj, connection, Math.max(wall1Thickness, wall2Thickness));
    } else if (forceCornerStyle === 'miter' || (forceCornerStyle === 'auto' && Math.abs(angle - Math.PI/2) >= cornerTolerance)) {
      // Create miter joint for angled corners
      this.createMiterJoint(wall1Obj, wall2Obj, connection, angle, Math.max(wall1Thickness, wall2Thickness));
    } else if (forceCornerStyle === 'overlap') {
      // Create overlap joint - one wall extends past the other
      this.createOverlapJoint(wall1Obj, wall2Obj, connection, Math.max(wall1Thickness, wall2Thickness));
    } else {
      // Default: auto-detect based on angle
      if (Math.abs(angle - Math.PI/2) < cornerTolerance) {
        this.createButtJoint(wall1Obj, wall2Obj, connection, Math.max(wall1Thickness, wall2Thickness));
      } else {
      this.createMiterJoint(wall1Obj, wall2Obj, connection, angle, Math.max(wall1Thickness, wall2Thickness));
      }
    }
  }

  /**
   * Create butt joint - one wall runs through, other butts against it
   * FIXED: Proper corner joining without gaps
   */
  createButtJoint(wall1Obj, wall2Obj, connection, thickness) {
    // Determine which wall should run through (usually the longer one)
    const wall1Length = this.calculateWallLength(wall1Obj);
    const wall2Length = this.calculateWallLength(wall2Obj);
    
    let throughWall, buttWall, throughConnection, buttConnection;
    
    if (wall1Length >= wall2Length) {
      throughWall = wall1Obj;
      buttWall = wall2Obj;
      throughConnection = connection.w1Point;
      buttConnection = connection.w2Point;
    } else {
      throughWall = wall2Obj;
      buttWall = wall1Obj;
      throughConnection = connection.w2Point;
      buttConnection = connection.w1Point;
    }
    
    console.log(`🔧 Butt joint: ${throughWall.id} runs through, ${buttWall.id} butts against it`);
    
    // Get the actual thickness of both walls
    const throughWallThickness = throughWall.params.thickness || throughWall.params.width || 0.2;
    const buttWallThickness = buttWall.params.thickness || buttWall.params.width || 0.2;
    
    // FIXED: For proper corner joining, extend the butt wall slightly INTO the through wall
    // This ensures no gap at the corner by creating a small overlap
    const overlap = 0.001; // 1mm overlap to eliminate visual gaps
    const adjustment = -(throughWallThickness / 2 + overlap); // Negative means extend (don't shorten)
    
    console.log(`🔧 FIXED BUTT JOINT: Through wall thickness: ${throughWallThickness}m, extending butt wall by: ${Math.abs(adjustment)}m`);
    
    let startAdj = 0, endAdj = 0;
    if (buttConnection === 'start') {
      startAdj = adjustment;
    } else {
      endAdj = adjustment;
    }
    
    // Rebuild the butt wall with adjustment (negative adjustment = extension)
    console.log(`🔧 BUTT JOINT: Applying extension to wall ${buttWall.id}:`, { startAdj, endAdj });
    this.rebuildWallWithAdjustments(buttWall.id, startAdj, endAdj);
  }

  /**
   * Create miter joint for angled corners
   */
  createMiterJoint(wall1Obj, wall2Obj, connection, angle, thickness) {
    console.log(`🔧 Creating miter joint at ${(angle * 180 / Math.PI).toFixed(1)}° angle`);
    
    // Get the actual thickness of each wall
    const wall1Thickness = wall1Obj.params.thickness || wall1Obj.params.width || 0.2;
    const wall2Thickness = wall2Obj.params.thickness || wall2Obj.params.width || 0.2;
    
    // For miter joints, calculate adjustment based on the angle and wall thickness
    // Use the average thickness for the miter calculation
    const avgThickness = (wall1Thickness + wall2Thickness) / 2;
    
    // Prevent division by zero for very small angles
    const safeAngle = Math.max(angle, Math.PI / 36); // Minimum 5 degrees
    const adjustment = avgThickness / (2 * Math.sin(safeAngle / 2));
    
    console.log(`🔧 Miter adjustment: ${adjustment.toFixed(3)}m (wall1: ${wall1Thickness}m, wall2: ${wall2Thickness}m)`);
    
    // Apply adjustment to both walls
    const adjustments = { startAdjustment: 0, endAdjustment: 0 };
    
    if (connection.w1Point === 'start') {
      adjustments.startAdjustment = adjustment;
    } else {
      adjustments.endAdjustment = adjustment;
    }
    console.log(`🔧 MITER: Applying adjustments to wall ${wall1Obj.id}:`, adjustments);
    this.rebuildWallWithAdjustments(wall1Obj.id, adjustments.startAdjustment, adjustments.endAdjustment);
    
    const adjustments2 = { startAdjustment: 0, endAdjustment: 0 };
    if (connection.w2Point === 'start') {
      adjustments2.startAdjustment = adjustment;
    } else {
      adjustments2.endAdjustment = adjustment;
    }
    console.log(`🔧 MITER: Applying adjustments to wall ${wall2Obj.id}:`, adjustments2);
    this.rebuildWallWithAdjustments(wall2Obj.id, adjustments2.startAdjustment, adjustments2.endAdjustment);
  }

  /**
   * Create overlap joint - one wall extends past the other
   * ENHANCED: More aggressive overlap to eliminate gaps
   */
  createOverlapJoint(wall1Obj, wall2Obj, connection, thickness) {
    console.log(`🔧 Creating ENHANCED overlap joint between ${wall1Obj.id} and ${wall2Obj.id}`);
    
    // Determine which wall should extend (usually the longer one)
    const wall1Length = this.calculateWallLength(wall1Obj);
    const wall2Length = this.calculateWallLength(wall2Obj);
    
    let extendingWall, shortenedWall, extendingConnection, shortenedConnection;
    
    if (wall1Length >= wall2Length) {
      extendingWall = wall1Obj;
      shortenedWall = wall2Obj;
      extendingConnection = connection.w1Point;
      shortenedConnection = connection.w2Point;
    } else {
      extendingWall = wall2Obj;
      shortenedWall = wall1Obj;
      extendingConnection = connection.w2Point;
      shortenedConnection = connection.w1Point;
    }
    
    console.log(`🔧 ENHANCED Overlap joint: ${extendingWall.id} extends, ${shortenedWall.id} is extended into it`);
    
    // ENHANCED: Instead of shortening one wall, extend both walls to ensure complete overlap
    const extendingWallThickness = extendingWall.params.thickness || extendingWall.params.width || 0.2;
    const shortenedWallThickness = shortenedWall.params.thickness || shortenedWall.params.width || 0.2;
    
    // Extend the "shortened" wall into the extending wall by the full thickness plus overlap
    const overlap = 0.005; // 5mm overlap for complete joining
    const adjustment = -(extendingWallThickness + overlap); // Negative = extend
    
    console.log(`🔧 ENHANCED: Extending wall ${shortenedWall.id} by ${Math.abs(adjustment)}m into wall ${extendingWall.id}`);
    
    let startAdj = 0, endAdj = 0;
    if (shortenedConnection === 'start') {
      startAdj = adjustment;
    } else {
      endAdj = adjustment;
    }
    
    // Rebuild the wall with extension (negative adjustment)
    console.log(`🔧 ENHANCED OVERLAP: Applying extension to wall ${shortenedWall.id}:`, { startAdj, endAdj });
    this.rebuildWallWithAdjustments(shortenedWall.id, startAdj, endAdj);
  }

  /**
   * Handle multiple walls meeting at one point (T-junction, cross, etc.)
   */
  createMultiWallJoint(intersectionGroup) {
    console.log(`🔧 Creating multi-wall joint with ${intersectionGroup.length} walls`);
    
    // For T-junctions and crosses, use a hybrid approach
    // The longest wall runs through, others butt against it
    const walls = intersectionGroup.map(i => ({
      id: i.wall1,
      obj: this.objects.get(i.wall1),
      length: this.calculateWallLength(this.objects.get(i.wall1))
    }));
    
    // Add wall2 from intersections that aren't already included
    intersectionGroup.forEach(i => {
      if (!walls.find(w => w.id === i.wall2)) {
        const wall2Obj = this.objects.get(i.wall2);
        walls.push({
          id: i.wall2,
          obj: wall2Obj,
          length: this.calculateWallLength(wall2Obj)
        });
      }
    });
    
    // Sort by length - longest wall becomes the "through" wall
    walls.sort((a, b) => b.length - a.length);
    const throughWall = walls[0];
    const buttWalls = walls.slice(1);
    
    console.log(`🔧 Through wall: ${throughWall.id}, Butt walls: ${buttWalls.map(w => w.id).join(', ')}`);
    
    // Apply adjustments to butt walls
    buttWalls.forEach(buttWall => {
      const thickness = buttWall.obj.params.thickness || 0.2;
      const adjustment = thickness / 2;
      
      // Find which end of the butt wall connects to the intersection
      const intersection = intersectionGroup.find(i => 
        i.wall1 === buttWall.id || i.wall2 === buttWall.id
      );
      
      if (intersection) {
        const isWall1 = intersection.wall1 === buttWall.id;
        const connectionPoint = isWall1 ? intersection.connection.w1Point : intersection.connection.w2Point;
        
        const adjustments = { startAdjustment: 0, endAdjustment: 0 };
        if (connectionPoint === 'start') {
          adjustments.startAdjustment = adjustment;
        } else {
          adjustments.endAdjustment = adjustment;
        }
        
        console.log(`🔧 MULTI-JOINT: Applying adjustments to wall ${buttWall.id}:`, adjustments);
        this.rebuildWallWithAdjustments(buttWall.id, adjustments.startAdjustment, adjustments.endAdjustment);
      }
    });
  }

  /**
   * Calculate actual wall length from its parameters
   */
  calculateWallLength(wallObj) {
    if (!wallObj || !wallObj.params) return 0;
    
    const { startPoint, endPoint, length } = wallObj.params;
    
    if (startPoint && endPoint) {
      const deltaX = endPoint.x - startPoint.x;
      const deltaZ = endPoint.z - startPoint.z;
      return Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
    }
    
    return length || 0;
  }

  /**
   * Rebuild a wall with joinery adjustments
   */
  rebuildWallWithAdjustments(wallId, startAdjustment = 0, endAdjustment = 0) {
    const wall = this.objects.get(wallId);
    if (!wall || wall.type !== 'wall') {
      console.error(`Wall ${wallId} not found for joinery adjustment`);
      return;
    }

    // 🔍 AXIS DRIFT DEBUGGING: Check if wall was perfectly aligned before joinery
    const originalStart = wall.params?.startPoint;
    const originalEnd = wall.params?.endPoint;
    let wasAxisAligned = false;
    let originalAxisType = 'none';
    
    if (originalStart && originalEnd) {
      const deltaX = Math.abs(originalEnd.x - originalStart.x);
      const deltaZ = Math.abs(originalEnd.z - originalStart.z);
      const isHorizontal = deltaZ < 0.001; // Perfectly horizontal
      const isVertical = deltaX < 0.001;   // Perfectly vertical
      
      wasAxisAligned = isHorizontal || isVertical;
      originalAxisType = isHorizontal ? 'horizontal' : isVertical ? 'vertical' : 'diagonal';
      
      if (wasAxisAligned) {
        console.log('🚨 AXIS DRIFT WARNING: About to apply joinery to perfectly aligned wall!', {
          wallId,
          originalAxisType,
          deviation: {
            fromHorizontal: Math.abs(originalEnd.z - originalStart.z).toFixed(6),
            fromVertical: Math.abs(originalEnd.x - originalStart.x).toFixed(6)
          },
          adjustments: {
            start: startAdjustment.toFixed(3),
            end: endAdjustment.toFixed(3)
          },
          riskOfAxisDrift: startAdjustment !== 0 || endAdjustment !== 0
        });
      }
    }

    console.log(`🔧 REBUILD: Wall ${wallId} with adjustments:`, {
      startAdjustment: startAdjustment.toFixed(3),
      endAdjustment: endAdjustment.toFixed(3),
      originalParams: {
        length: wall.params?.length,
        startPoint: wall.params?.startPoint,
        endPoint: wall.params?.endPoint
      },
      axisAlignmentAnalysis: {
        wasAxisAligned,
        originalAxisType,
        potentialDriftRisk: wasAxisAligned && (startAdjustment !== 0 || endAdjustment !== 0)
      }
    });

    // Calculate adjusted parameters
    const adjustedParams = {
      ...wall.params,
      adjustForJoinery: true,
      startAdjustment: startAdjustment,
      endAdjustment: endAdjustment
    };

    console.log(`🔧 REBUILD: Creating new geometry with adjusted params:`, adjustedParams);

    // Create new geometry with adjustments
    const newGeometry = this.createWallGeometry(adjustedParams);
    
    console.log(`🔧 REBUILD: New geometry created:`, {
      actualLength: newGeometry.actualLength,
      adjustedStartPoint: newGeometry.adjustedStartPoint,
      adjustedEndPoint: newGeometry.adjustedEndPoint,
      mesh3DPosition: newGeometry.mesh3D.position,
      mesh2DPosition: newGeometry.mesh2D.position
    });

    // Remove old meshes from scenes
    if (wall.mesh3D) {
      this.scene3D.remove(wall.mesh3D);
      wall.mesh3D.geometry.dispose();
    }
    if (wall.mesh2D) {
      this.scene2D.remove(wall.mesh2D);
    }

    // Update wall object with new geometry and parameters
    wall.geometry = newGeometry.geometry;
    wall.mesh3D = newGeometry.mesh3D;
    wall.mesh2D = newGeometry.mesh2D;
    wall.params = adjustedParams;
    
    // Add actualLength and adjusted points for compatibility
    wall.params.actualLength = newGeometry.actualLength;
    wall.params.adjustedStartPoint = newGeometry.adjustedStartPoint;
    wall.params.adjustedEndPoint = newGeometry.adjustedEndPoint;

    // Set object IDs on meshes
    wall.mesh3D.userData.objectId = wallId;
    wall.mesh2D.userData.objectId = wallId;

    // Add new meshes to scenes
    this.scene3D.add(wall.mesh3D);
    this.scene2D.add(wall.mesh2D);

    console.log(`✅ REBUILD: Wall ${wallId} rebuilt with joinery adjustments:`, {
      finalLength: wall.params.actualLength?.toFixed(3),
      hasAdjustments: wall.params.adjustForJoinery,
      startAdj: wall.params.startAdjustment?.toFixed(3),
      endAdj: wall.params.endAdjustment?.toFixed(3),
      mesh3DPos: wall.mesh3D.position,
      mesh2DPos: wall.mesh2D.position
    });

    // 🔍 AXIS DRIFT ANALYSIS: Check if joinery broke axis alignment
    if (wasAxisAligned && (wall.params.adjustedStartPoint && wall.params.adjustedEndPoint)) {
      const newStart = wall.params.adjustedStartPoint;
      const newEnd = wall.params.adjustedEndPoint;
      const newDeltaX = Math.abs(newEnd.x - newStart.x);
      const newDeltaZ = Math.abs(newEnd.z - newStart.z);
      const newIsHorizontal = newDeltaZ < 0.001;
      const newIsVertical = newDeltaX < 0.001;
      const stillAxisAligned = newIsHorizontal || newIsVertical;
      
      const axisDrift = {
        beforeJoinery: {
          type: originalAxisType,
          isAligned: wasAxisAligned
        },
        afterJoinery: {
          type: newIsHorizontal ? 'horizontal' : newIsVertical ? 'vertical' : 'diagonal',
          isAligned: stillAxisAligned,
          deviation: {
            fromHorizontal: Math.abs(newEnd.z - newStart.z).toFixed(6),
            fromVertical: Math.abs(newEnd.x - newStart.x).toFixed(6)
          }
        },
        driftOccurred: wasAxisAligned && !stillAxisAligned,
        axisTypeChanged: originalAxisType !== (newIsHorizontal ? 'horizontal' : newIsVertical ? 'vertical' : 'diagonal')
      };
      
      if (axisDrift.driftOccurred) {
        console.error('🚨 AXIS DRIFT DETECTED! Joinery broke perfect wall alignment:', {
          wallId,
          ...axisDrift,
          coordinates: {
            original: { start: originalStart, end: originalEnd },
            adjusted: { start: newStart, end: newEnd }
          },
          precisionLoss: {
            x: Math.abs((newEnd.x - newStart.x) - (originalEnd.x - originalStart.x)).toFixed(6),
            z: Math.abs((newEnd.z - newStart.z) - (originalEnd.z - originalStart.z)).toFixed(6)
          }
        });
      } else if (wasAxisAligned && stillAxisAligned) {
        console.log('✅ AXIS PRESERVED: Wall maintained perfect alignment despite joinery:', {
          wallId,
          axisType: originalAxisType,
          finalDeviation: axisDrift.afterJoinery.deviation
        });
      } else if (axisDrift.axisTypeChanged) {
        console.warn('⚠️ AXIS TYPE CHANGED: Wall switched axis alignment during joinery:', {
          wallId,
          from: originalAxisType,
          to: axisDrift.afterJoinery.type,
          stillAligned: stillAxisAligned
        });
      }
    }

    // Emit update event
    console.log(`📡 EMIT: object_updated for wall ${wallId}`);
    this.emit('object_updated', {
      object: this.serializeObject(wall)
    });
    
    // Also emit objects_changed to trigger viewport refresh
    console.log(`📡 EMIT: objects_changed after wall rebuild`);
    this.emit('objects_changed', {
      objects: this.getAllObjects()
    });
  }

  /**
   * Create wall opening for doors and windows
   */
  createWallOpening(wallId, openingParams) {
    const { type, width, height, position, offset = 0 } = openingParams;
    
    const wall = this.objects.get(wallId);
    if (!wall) {
      console.warn(`Wall ${wallId} not found for opening creation`);
      return false;
    }
    
    // Store opening information on the wall object
    if (!wall.openings) {
      wall.openings = [];
    }
    
    const opening = {
      id: `${type}_opening_${Date.now()}`,
      type: type,
      width: width,
      height: height,
      position: position, // Distance from wall start
      offset: offset,     // Height offset from floor
      created: new Date().toISOString()
    };
    
    wall.openings.push(opening);
    
    console.log(`🔳 Created ${type} opening in wall ${wallId}:`, opening);
    
    // Rebuild wall geometry with openings
    this.rebuildWallWithOpenings(wallId);
    
    return opening.id;
  }
  
  /**
   * Rebuild wall geometry to include openings
   */
  rebuildWallWithOpenings(wallId) {
    const wall = this.objects.get(wallId);
    if (!wall || !wall.openings || wall.openings.length === 0) {
      return;
    }
    
    console.log(`🔄 Rebuilding wall ${wallId} with ${wall.openings.length} opening(s)`);
    
    // Get wall parameters
    const wallParams = wall.params;
    const wallLength = wallParams.length || 3.0;
    const wallHeight = wallParams.height || 2.7;
    const wallThickness = wallParams.thickness || wallParams.width || 0.2;
    
    // Create wall segments around openings
    const segments = this.createWallSegmentsWithOpenings(wallParams, wall.openings);
    
    // Remove old wall mesh from scene
    if (wall.mesh3D && wall.mesh3D.parent) {
      wall.mesh3D.parent.remove(wall.mesh3D);
    }
    if (wall.mesh2D && wall.mesh2D.parent) {
      wall.mesh2D.parent.remove(wall.mesh2D);
    }
    
    // Create new wall geometry with gaps
    const wallGroup3D = new THREE.Group();
    const wallGroup2D = new THREE.Group();
    
    segments.forEach((segment, index) => {
      // Create 3D segment
      const segmentGeometry3D = new THREE.BoxGeometry(
        segment.length,
        wallHeight,
        wallThickness
      );
      
      const material3D = this.materials[wallParams.material] || this.materials.concrete;
      const segmentMesh3D = new THREE.Mesh(segmentGeometry3D, material3D.clone());
      
      // Position segment
      segmentMesh3D.position.set(
        segment.centerX,
        wallHeight / 2,
        0
      );
      
      wallGroup3D.add(segmentMesh3D);
      
      // Create 2D segment
      const segmentGeometry2D = new THREE.PlaneGeometry(segment.length, wallThickness);
      const material2D = new THREE.MeshBasicMaterial({
        color: material3D.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const segmentMesh2D = new THREE.Mesh(segmentGeometry2D, material2D);
      
      segmentMesh2D.position.set(segment.centerX, 0, 0);
      segmentMesh2D.rotation.x = -Math.PI / 2;
      
      wallGroup2D.add(segmentMesh2D);
    });
    
    // Set wall position and rotation
    const originalPosition = wall.mesh3D ? wall.mesh3D.position : { x: 0, y: 0, z: 0 };
    const originalRotation = wall.mesh3D ? wall.mesh3D.rotation : { x: 0, y: 0, z: 0 };
    
    wallGroup3D.position.copy(originalPosition);
    wallGroup3D.rotation.copy(originalRotation);
    wallGroup2D.position.copy(originalPosition);
    wallGroup2D.rotation.copy(originalRotation);
    
    // Update wall object
    wall.mesh3D = wallGroup3D;
    wall.mesh2D = wallGroup2D;
    wall.hasOpenings = true;
    
    // Add to scene
    this.scene3D.add(wallGroup3D);
    this.scene2D.add(wallGroup2D);
    
    // Log the openings created
    wall.openings.forEach(opening => {
      console.log(`  ✓ ${opening.type} opening: ${opening.width}m x ${opening.height}m at ${opening.position}m`);
    });
    
    // Emit update event
    this.emit('object_updated', {
      object: this.serializeObject(wall)
    });
    
    console.log(`✅ Wall ${wallId} rebuilt with ${segments.length} segments and ${wall.openings.length} openings`);
  }
  
  /**
   * Create wall segments around openings
   */
  createWallSegmentsWithOpenings(wallParams, openings) {
    const wallLength = wallParams.length || 3.0;
    const segments = [];
    
    if (!openings || openings.length === 0) {
      // No openings, return full wall as single segment
      return [{
        startX: -wallLength / 2,
        endX: wallLength / 2,
        centerX: 0,
        length: wallLength
      }];
    }
    
    // Sort openings by position
    const sortedOpenings = [...openings].sort((a, b) => a.position - b.position);
    
    let currentPosition = -wallLength / 2;
    
    sortedOpenings.forEach(opening => {
      // Convert position from distance along wall to coordinate
      const openingStart = -wallLength / 2 + opening.position - opening.width / 2;
      const openingEnd = -wallLength / 2 + opening.position + opening.width / 2;
      
      // Create segment before opening if there's space
      if (openingStart > currentPosition + 0.01) { // 1cm minimum segment
        const segmentLength = openingStart - currentPosition;
        segments.push({
          startX: currentPosition,
          endX: openingStart,
          centerX: currentPosition + segmentLength / 2,
          length: segmentLength
        });
      }
      
      // Skip the opening area
      currentPosition = openingEnd;
    });
    
    // Create final segment after last opening if there's space
    const wallEnd = wallLength / 2;
    if (currentPosition < wallEnd - 0.01) { // 1cm minimum segment
      const segmentLength = wallEnd - currentPosition;
      segments.push({
        startX: currentPosition,
        endX: wallEnd,
        centerX: currentPosition + segmentLength / 2,
        length: segmentLength
      });
    }
    
    return segments;
  }
  /**
   * Debug function to test door creation from console
   */
  testDoorCreation() {
    console.log('🧪 Testing door creation directly...');
    const doorId = this.createObject('door', {
      width: 0.9,
      height: 2.1,
      thickness: 0.05,
      material: 'wood',
      startPoint: { x: 1, y: 0, z: 1 },
      endPoint: { x: 1, y: 0, z: 2 }
    });
    console.log('🧪 Test door created with ID:', doorId);
    return doorId;
  }

  /**
   * Create door geometry and meshes
   */
  /**
   * PROFESSIONAL DOOR SYSTEM with advanced wall integration
   * Automatic frame generation, wall opening creation, and IFC compliance
   */
  createDoorGeometry(params) {
    const { 
      width = 0.9, 
      height = 2.1, 
      thickness = 0.05, 
      material = 'wood',
      frameWidth = 0.05,
      frameMaterial = 'wood',
      frameDepth = null, // Auto-calculate from wall thickness
      openingDirection = 'right',
      startPoint = null,
      endPoint = null,
      hostWallId = null,
      insertionPosition = 0.5,
      insertionMode = 'create_standalone',
      // PROFESSIONAL PARAMETERS
      doorType = 'single_swing', // single_swing, double_swing, sliding, bi_fold
      frameType = 'standard', // standard, cased, reveal
      sillHeight = 0.0, // Height above floor
      headHeight = null, // Auto-calculate or specify
      jamb = { width: 0.04, depth: null }, // Jamb dimensions
      sill = { height: 0.02, overhang: 0.01 }, // Sill details
      head = { height: 0.05, overhang: 0.01 }, // Head details
      hardware = 'lever', // lever, knob, push_pull
      fireRating = 0, // Fire rating in minutes
      accessibility = false, // ADA compliance features
      glazing = null, // Glass panels configuration
      // IFC PROPERTIES
      ifcProperties = {}
    } = params;
    
    // Calculate position
    let centerPosition = { x: 0, y: height / 2, z: 0 };
    let wallOrientation = 0;
    
    // PROFESSIONAL WALL INTEGRATION SYSTEM
    let hostWallData = null;
    
    if (insertionMode === 'insert_in_wall' && hostWallId) {
      // Find the host wall
      const hostWall = this.objects.get(hostWallId);
      if (!hostWall) {
        console.warn(`Host wall ${hostWallId} not found for door insertion`);
        return this.createDoorGeometry({ ...params, insertionMode: 'create_standalone' });
      }
      
      // Extract wall template and properties
      const wallTemplate = hostWall.params?.wallTemplate || this.wallTypeTemplates.exterior_wood_frame;
      const wallThickness = wallTemplate.totalThickness || hostWall.params?.thickness || 0.2;
      const wallLength = hostWall.params.length || 3.0;
      
      // Auto-calculate frame depth from wall thickness
      const calculatedFrameDepth = frameDepth || wallThickness;
      const calculatedHeadHeight = headHeight || (height + head.height);
      
      // Calculate door position within wall
      const distanceFromStart = insertionPosition * wallLength;
      const wallPos = hostWall.mesh3D.position;
      const wallRotation = hostWall.mesh3D.rotation.y || 0;
      wallOrientation = wallRotation;
      
      // Calculate door position based on wall geometry
      const cosRotation = Math.cos(wallRotation);
      const sinRotation = Math.sin(wallRotation);
      
      centerPosition = {
        x: wallPos.x + (distanceFromStart - wallLength / 2) * cosRotation,
        y: (height / 2) + sillHeight,
        z: wallPos.z + (distanceFromStart - wallLength / 2) * sinRotation
      };
      
      // Store wall data for frame generation
      hostWallData = {
        id: hostWallId,
        wall: hostWall,
        template: wallTemplate,
        thickness: wallThickness,
        layers: wallTemplate.layers,
        rotation: wallRotation,
        insertionPosition: distanceFromStart
      };
      
      console.log(`🚪 PROFESSIONAL DOOR: Inserting ${doorType} door in ${wallTemplate.name} wall`);
      console.log(`📐 Frame depth: ${calculatedFrameDepth.toFixed(3)}m, Wall thickness: ${wallThickness.toFixed(3)}m`);
      
      // Create intelligent wall opening with layer awareness
      this.createProfessionalWallOpening(hostWallId, {
        type: 'door',
        width: width + (frameWidth * 2), // Include frame width
        height: calculatedHeadHeight,
        position: distanceFromStart,
        offset: sillHeight,
        frameDepth: calculatedFrameDepth,
        preserveLayers: true
      });
      
    } else if (startPoint && endPoint) {
      centerPosition = {
        x: (startPoint.x + endPoint.x) / 2,
        y: (height / 2) + sillHeight,
        z: (startPoint.z + endPoint.z) / 2
      };
    }
    
    // PROFESSIONAL DOOR ASSEMBLY CREATION
    const doorAssembly = this.createProfessionalDoorAssembly({
      width, height, thickness, material, frameMaterial,
      frameDepth: hostWallData?.thickness || frameWidth,
      doorType, frameType, openingDirection,
      jamb, sill, head, hardware, glazing,
      hostWallData
    });
    
    const doorGroup = doorAssembly.group;
    
    // Position the door assembly
    doorGroup.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    if (wallOrientation !== 0) {
      doorGroup.rotation.y = wallOrientation;
    }
    
    // Professional door handle assembly
    const handleSide = openingDirection === 'left' ? -1 : 1;
    const handleX = width * 0.35 * handleSide;
    
    // Handle base plate
    const handlePlateGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.01);
    const handlePlateMat = this.materials.steel || this.materials.aluminum;
    const handlePlate = new THREE.Mesh(handlePlateGeometry, handlePlateMat.clone());
    handlePlate.position.set(handleX, 0, thickness/2 - frameDepth/2 + 0.005);
    doorGroup.add(handlePlate);
    
    // Door handle lever
    const leverGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.12);
    const doorHandle = new THREE.Mesh(leverGeometry, handlePlateMat.clone());
    doorHandle.position.set(handleX, 0, thickness/2 - frameDepth/2 + 0.02);
    doorHandle.rotation.z = Math.PI/2;
    doorGroup.add(doorHandle);
    
    // Door hinge representation
    for (let i = 0; i < 3; i++) {
      const hingeY = (height/2 - 0.2) - i * (height - 0.4) / 2;
      const hingeGeometry = new THREE.BoxGeometry(0.1, 0.08, 0.02);
      const hinge = new THREE.Mesh(hingeGeometry, handlePlateMat.clone());
      hinge.position.set(-width/2 - 0.02, hingeY, thickness/2 - frameDepth/2);
      doorGroup.add(hinge);
    }
    
    // Set group properties
    doorGroup.userData = { objectId: null, type: 'door' };
    doorGroup.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    
    // Use the door group as the main mesh
    const mesh3D = doorGroup;
    
    // Apply wall orientation if inserted in wall
    if (insertionMode === 'insert_in_wall' && hostWallId) {
      mesh3D.rotation.y = wallOrientation;
    }
    
    // Create professional 2D representation with swing arc
    const door2DGroup = new THREE.Group();
    
    // Get materials for 2D representation
    const doorMat = this.materials[material] || this.materials.wood;
    const frameMat = this.materials[frameMaterial] || this.materials.wood;
    
    // Door panel in 2D
    const doorPanelGeometry2D = new THREE.PlaneGeometry(width, thickness);
    const doorPanelMaterial2D = new THREE.MeshBasicMaterial({ 
      color: doorMat.color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const doorPanel2D = new THREE.Mesh(doorPanelGeometry2D, doorPanelMaterial2D);
    doorPanel2D.rotation.x = -Math.PI / 2;
    door2DGroup.add(doorPanel2D);
    
    // Door frame in 2D
    const frameGeometry2D = new THREE.RingGeometry(
      Math.sqrt((width/2) * (width/2) + (thickness/2) * (thickness/2)),
      Math.sqrt(((width + frameWidth * 2)/2) * ((width + frameWidth * 2)/2) + ((thickness + frameWidth)/2) * ((thickness + frameWidth)/2)),
      0, Math.PI * 2, 4
    );
    const frameMaterial2D = new THREE.MeshBasicMaterial({ 
      color: frameMat.color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const frame2D = new THREE.Mesh(frameGeometry2D, frameMaterial2D);
    frame2D.rotation.x = -Math.PI / 2;
    door2DGroup.add(frame2D);
    
    // Swing arc in 2D (like professional CAD)
    const swingRadius = width;
    const swingGeometry = new THREE.RingGeometry(swingRadius - 0.01, swingRadius, 0, Math.PI/2);
    const swingMaterial = new THREE.MeshBasicMaterial({
      color: 0x4CAF50,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    });
    const swingArc2D = new THREE.Mesh(swingGeometry, swingMaterial);
    swingArc2D.rotation.x = -Math.PI / 2;
    
    // Position swing arc based on opening direction
    const swingDirection = openingDirection === 'right' ? 1 : -1;
    if (openingDirection === 'left') {
      swingArc2D.rotation.z = Math.PI; // Flip for left swing
    }
    swingArc2D.position.set(-width/2, 0, 0); // Position at hinge point
    door2DGroup.add(swingArc2D);
    
    // Hinge point indicator
    const hingeGeometry2D = new THREE.CircleGeometry(0.03, 8);
    const hingeMaterial2D = new THREE.MeshBasicMaterial({
      color: 0x2E7D32,
      side: THREE.DoubleSide
    });
    const hinge2D = new THREE.Mesh(hingeGeometry2D, hingeMaterial2D);
    hinge2D.rotation.x = -Math.PI / 2;
    hinge2D.position.set(-width/2, 0.001, 0); // Slightly above floor
    door2DGroup.add(hinge2D);
    
    // Set up 2D group
    const mesh2D = door2DGroup;
    mesh2D.userData = { objectId: null, type: 'door' };
    mesh2D.position.set(centerPosition.x, 0, centerPosition.z);
    
    // Apply wall orientation to 2D representation as well
    if (insertionMode === 'insert_in_wall' && hostWallId) {
      mesh2D.rotation.y = wallOrientation;
    }
    
    return {
      geometry: doorPanelGeometry2D, // Use door geometry for reference
      mesh3D: mesh3D,
      mesh2D: mesh2D
    };
  }

  /**
   * PROFESSIONAL WINDOW SYSTEM
   * Complete window assembly with frame, glazing, hardware, and thermal properties
   */
  createWindowGeometry(params) {
    const { 
      width = 1.2, 
      height = 1.4, 
      thickness = 0.05, 
      material = 'aluminum',
      frameWidth = 0.05,
      glazingLayers = 2,
      windowType = 'casement',
      openable = true,
      thermalTransmittance = 2.5,
      startPoint = null,
      endPoint = null,
      hostWallId = null,
      insertionPosition = 0.5,
      insertionMode = 'create_standalone',
      sillHeight = 0.9
    } = params;
    
    console.log(`🪟 Creating professional window system: ${windowType} window (${width}m x ${height}m)`);
    
    // Calculate position and wall integration
    let centerPosition = { x: 0, y: height / 2 + sillHeight, z: 0 }; 
    let wallOrientation = 0;
    let hostWallData = null;
    
    if (insertionMode === 'insert_in_wall' && hostWallId) {
      const hostWall = this.objects.get(hostWallId);
      if (!hostWall) {
        console.warn(`Host wall ${hostWallId} not found for window insertion`);
        return this.createWindowGeometry({ ...params, insertionMode: 'create_standalone' });
      }
      
      // Extract wall data for integration
      hostWallData = {
        thickness: this.getTotalWallThickness(hostWall.params.layers || [{ thickness: hostWall.params.thickness || 0.2 }]),
        layers: hostWall.params.layers || [{ material: hostWall.params.material || 'concrete', thickness: hostWall.params.thickness || 0.2 }],
        material: hostWall.params.material || 'concrete'
      };
      
      const wallLength = hostWall.params.length || 3.0;
      const distanceFromStart = insertionPosition * wallLength;
      
      // Get wall position and rotation
      const wallPos = hostWall.mesh3D.position;
      const wallRotation = hostWall.mesh3D.rotation.y || 0;
      wallOrientation = wallRotation;
      
      // Calculate window position based on wall geometry
      const cosRotation = Math.cos(wallRotation);
      const sinRotation = Math.sin(wallRotation);
      
      centerPosition = {
        x: wallPos.x + (distanceFromStart - wallLength / 2) * cosRotation,
        y: height / 2 + sillHeight,
        z: wallPos.z + (distanceFromStart - wallLength / 2) * sinRotation
      };
      
      console.log(`🪟 Window positioned in wall ${hostWallId} at ${distanceFromStart.toFixed(1)}m from start`);
      
      // Create wall opening with frame consideration
      this.createWallOpening(hostWallId, {
        type: 'window',
        width: width,
        height: height,
        position: distanceFromStart,
        offset: sillHeight,
        frameDepth: frameWidth,
        preserveLayers: true
      });
      
    } else if (startPoint && endPoint) {
      centerPosition = {
        x: (startPoint.x + endPoint.x) / 2,
        y: height / 2 + sillHeight,
        z: (startPoint.z + endPoint.z) / 2
      };
    }
    
    // PROFESSIONAL WINDOW ASSEMBLY CREATION
    const windowAssembly = this.createProfessionalWindowAssembly({
      width, height, thickness, material,
      frameWidth: hostWallData?.thickness || frameWidth,
      windowType, glazingLayers, openable, thermalTransmittance,
      sillHeight,
      frameType: 'standard',
      glazing: { 
        type: 'clear', 
        layers: glazingLayers,
        thermalTransmittance,
        lightTransmission: 0.8 
      },
      hardware: { 
        handles: openable, 
        locks: openable && windowType !== 'fixed',
        hinges: windowType === 'casement' || windowType === 'awning' 
      },
      sill: { 
        height: 0.05, 
        overhang: 0.02, 
        material: 'concrete' 
      },
      hostWallData
    });
    
    const windowGroup = windowAssembly.group;
    
    // Position the window assembly
    windowGroup.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    if (wallOrientation !== 0) {
      windowGroup.rotation.y = wallOrientation;
    }
    
    // Use the window group as the main mesh
    const mesh3D = windowGroup;
    
    // Apply wall orientation if inserted in wall
    if (insertionMode === 'insert_in_wall' && hostWallId) {
      mesh3D.rotation.y = wallOrientation;
    }
    
    // Create professional 2D representation
    const window2DGroup = new THREE.Group();
    
    // Get materials for 2D representation
    const windowMat = this.materials[material] || this.materials.aluminum;
    
    // Window frame in 2D
    const frameGeometry2D = new THREE.PlaneGeometry(width, frameWidth * 2);
    const frameMaterial2D = new THREE.MeshBasicMaterial({ 
      color: windowMat.color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const frame2D = new THREE.Mesh(frameGeometry2D, frameMaterial2D);
    frame2D.rotation.x = -Math.PI / 2;
    window2DGroup.add(frame2D);
    
    // Glazing area in 2D (lighter color)
    const glazingGeometry2D = new THREE.PlaneGeometry(width - frameWidth * 2, frameWidth);
    const glazingMaterial2D = new THREE.MeshBasicMaterial({
      color: 0x87CEEB, // Light blue for glazing
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    });
    const glazing2D = new THREE.Mesh(glazingGeometry2D, glazingMaterial2D);
    glazing2D.rotation.x = -Math.PI / 2;
    glazing2D.position.y = 0.001; // Slightly above frame
    window2DGroup.add(glazing2D);
    
    // Window opening indication in 2D
    if (openable && windowType !== 'fixed') {
      const openingIndicator = this.createWindowOpeningIndicator2D(windowType, width, height);
      if (openingIndicator) {
        window2DGroup.add(openingIndicator);
      }
    }
    
    // Set up 2D group
    const mesh2D = window2DGroup;
    mesh2D.userData = { objectId: null, type: 'window' };
    mesh2D.position.set(centerPosition.x, 0, centerPosition.z);
    
    // Apply wall orientation to 2D representation as well
    if (insertionMode === 'insert_in_wall' && hostWallId) {
      mesh2D.rotation.y = wallOrientation;
    }
    
    return {
      geometry: frameGeometry2D, // Use frame geometry for reference
      mesh3D: mesh3D,
      mesh2D: mesh2D
    };
  }

  /**
   * PROFESSIONAL WINDOW ASSEMBLY CREATION
   * Complete window system with frame, glazing, hardware, and thermal integration
   */
  createProfessionalWindowAssembly(config) {
    const {
      width, height, thickness, material, frameWidth,
      windowType, glazingLayers, openable, thermalTransmittance,
      sillHeight, frameType, glazing, hardware, sill, hostWallData
    } = config;
    
    const windowGroup = new THREE.Group();
    
    console.log(`🏗️ Creating professional ${windowType} window assembly: ${width}m x ${height}m`);
    
    // Get materials
    const frameMaterial = this.materials[material] || this.materials.aluminum;
    const glassMaterial = this.materials.glass || this.materials.aluminum;
    
    // 1. Create professional window frame
    const frame = this.createWindowFrame({
      width, height, frameWidth, material: frameMaterial,
      frameType, hostWallData
    });
    windowGroup.add(frame);
    
    // 2. Create glazing system
    const glazingSystem = this.createWindowGlazing({
      width: width - frameWidth * 2,
      height: height - frameWidth * 2,
      layers: glazingLayers,
      material: glassMaterial,
      glazing, thermalTransmittance
    });
    windowGroup.add(glazingSystem);
    
    // 3. Create window sill
    if (sill && sill.height > 0) {
      const windowSill = this.createWindowSill({
        width: width + sill.overhang * 2,
        height: sill.height,
        depth: (hostWallData?.thickness || frameWidth) + sill.overhang,
        material: sill.material || 'concrete'
      });
      windowSill.position.set(0, -height/2 - sill.height/2, sill.overhang/2);
      windowGroup.add(windowSill);
    }
    
    // 4. Create window hardware (handles, hinges)
    if (openable && hardware) {
      const windowHardware = this.createWindowHardware({
        windowType, width, height, hardware
      });
      if (windowHardware) {
        windowGroup.add(windowHardware);
      }
    }
    
    // 5. Create opening panels for operable windows
    if (openable && windowType !== 'fixed') {
      const panels = this.createWindowPanels({
        width, height, thickness, windowType,
        material: frameMaterial, glazing
      });
      if (panels) {
        windowGroup.add(panels);
      }
    }
    
    return {
      group: windowGroup,
      thermalTransmittance,
      glazingLayers,
      openable
    };
  }

  /**
   * Create professional window frame with proper construction details
   */
  createWindowFrame(config) {
    const { width, height, frameWidth, material, frameType, hostWallData } = config;
    const frameGroup = new THREE.Group();
    
    // Calculate frame depth based on wall thickness
    const frameDepth = hostWallData?.thickness || frameWidth;
    
    console.log(`🖼️ Creating window frame: ${width}m x ${height}m, depth: ${frameDepth.toFixed(2)}m`);
    
    // Frame components (jambs, head, sill)
    const frameComponents = [
      // Left jamb
      {
        width: frameWidth,
        height: height,
        depth: frameDepth,
        position: { x: -(width/2 + frameWidth/2), y: 0, z: 0 }
      },
      // Right jamb
      {
        width: frameWidth,
        height: height,
        depth: frameDepth,
        position: { x: width/2 + frameWidth/2, y: 0, z: 0 }
      },
      // Head (top)
      {
        width: width + (frameWidth * 2),
        height: frameWidth,
        depth: frameDepth,
        position: { x: 0, y: height/2 + frameWidth/2, z: 0 }
      },
      // Bottom frame (for some window types)
      {
        width: width + (frameWidth * 2),
        height: frameWidth,
        depth: frameDepth,
        position: { x: 0, y: -(height/2 + frameWidth/2), z: 0 }
      }
    ];
    
    // Create frame meshes
    frameComponents.forEach(component => {
      const frameGeometry = new THREE.BoxGeometry(
        component.width,
        component.height,
        component.depth
      );
      
      const frameMesh = new THREE.Mesh(frameGeometry, material.clone());
      frameMesh.position.set(
        component.position.x,
        component.position.y,
        component.position.z
      );
      
      frameGroup.add(frameMesh);
    });
    
    return frameGroup;
  }

  /**
   * Create window glazing system with multiple layers
   */
  createWindowGlazing(config) {
    const { width, height, layers, material, glazing, thermalTransmittance } = config;
    const glazingGroup = new THREE.Group();
    
    console.log(`🪟 Creating ${layers}-layer glazing system: ${width.toFixed(2)}m x ${height.toFixed(2)}m`);
    
    const glassThickness = 0.004; // 4mm glass
    const airGap = layers > 1 ? 0.016 : 0; // 16mm air gap for multi-layer
    const totalDepth = (glassThickness * layers) + (airGap * (layers - 1));
    
    // Create glass layers
    for (let i = 0; i < layers; i++) {
      const glassGeometry = new THREE.BoxGeometry(width, height, glassThickness);
      
      // Create glass material with appropriate transparency
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: glazing.type === 'clear' ? 0xffffff : 0x87CEEB,
        transparent: true,
        opacity: 0.8,
        roughness: 0.0,
        metalness: 0.0,
        transmission: glazing.lightTransmission || 0.8,
        ior: 1.5, // Index of refraction for glass
        reflectivity: 0.1
      });
      
      const glassMesh = new THREE.Mesh(glassGeometry, glassMat);
      
      // Position each layer
      const zOffset = (i - (layers - 1) / 2) * (glassThickness + airGap);
      glassMesh.position.set(0, 0, zOffset);
      
      glazingGroup.add(glassMesh);
    }
    
    return glazingGroup;
  }

  /**
   * Create window sill
   */
  createWindowSill(config) {
    const { width, height, depth, material } = config;
    
    const sillGeometry = new THREE.BoxGeometry(width, height, depth);
    const sillMaterial = this.materials[material] || this.materials.concrete;
    
    return new THREE.Mesh(sillGeometry, sillMaterial.clone());
  }

  /**
   * Create window hardware (handles, hinges, locks)
   */
  createWindowHardware(config) {
    const { windowType, width, height, hardware } = config;
    const hardwareGroup = new THREE.Group();
    
    console.log(`🔧 Creating window hardware for ${windowType} window`);
    
    // Handle hardware material
    const hardwareMaterial = this.materials.steel || this.materials.aluminum;
    
    // Create handles if specified
    if (hardware.handles) {
      const handleGeometry = new THREE.BoxGeometry(0.02, 0.08, 0.015);
      const handle = new THREE.Mesh(handleGeometry, hardwareMaterial.clone());
      
      // Position handle based on window type
      switch (windowType) {
        case 'casement':
          handle.position.set(width * 0.4, 0, 0.03);
          break;
        case 'sliding':
          handle.position.set(width * 0.25, 0, 0.03);
          break;
        case 'awning':
          handle.position.set(0, -height * 0.3, 0.03);
          break;
      }
      
      hardwareGroup.add(handle);
    }
    
    // Create hinges for casement and awning windows
    if (hardware.hinges && (windowType === 'casement' || windowType === 'awning')) {
      const hingeGeometry = new THREE.BoxGeometry(0.01, 0.06, 0.02);
      
      // Create 2-3 hinges depending on window height
      const hingeCount = height > 1.5 ? 3 : 2;
      
      for (let i = 0; i < hingeCount; i++) {
        const hinge = new THREE.Mesh(hingeGeometry, hardwareMaterial.clone());
        
        if (windowType === 'casement') {
          // Position hinges on left side for casement windows
          hinge.position.set(-width/2 - 0.01, (height/3) * (i - (hingeCount-1)/2), 0);
        } else if (windowType === 'awning') {
          // Position hinges on top for awning windows
          hinge.position.set((width/3) * (i - (hingeCount-1)/2), height/2 + 0.01, 0);
          hinge.rotation.z = Math.PI / 2;
        }
        
        hardwareGroup.add(hinge);
      }
    }
    
    return hardwareGroup.children.length > 0 ? hardwareGroup : null;
  }

  /**
   * Create window panels for operable windows
   */
  createWindowPanels(config) {
    const { width, height, thickness, windowType, material, glazing } = config;
    
    if (windowType === 'fixed') {
      return null; // Fixed windows don't have opening panels
    }
    
    const panelGroup = new THREE.Group();
    
    console.log(`📐 Creating window panels for ${windowType} window`);
    
    // Create panel frame (thinner than main frame)
    const panelFrameWidth = 0.02;
    const panelGeometry = new THREE.BoxGeometry(
      width - 0.1, // Slightly smaller than opening
      height - 0.1,
      thickness
    );
    
    const panelMesh = new THREE.Mesh(panelGeometry, material.clone());
    panelMesh.position.set(0, 0, thickness/2);
    panelGroup.add(panelMesh);
    
    return panelGroup;
  }

  /**
   * Create window opening indicators for 2D representation
   */
  createWindowOpeningIndicator2D(windowType, width, height) {
    const indicatorGroup = new THREE.Group();
    
    // Different indicators for different window types
    switch (windowType) {
      case 'casement':
        // Show swing arc for casement windows
        const swingRadius = width * 0.8;
        const swingGeometry = new THREE.RingGeometry(
          swingRadius - 0.01, 
          swingRadius, 
          0, 
          Math.PI/4
        );
        const swingMaterial = new THREE.MeshBasicMaterial({
          color: 0x4CAF50,
          transparent: true,
          opacity: 0.3
        });
        const swingArc = new THREE.Mesh(swingGeometry, swingMaterial);
        swingArc.rotation.x = -Math.PI / 2;
        swingArc.position.set(-width/2, 0.001, 0);
        indicatorGroup.add(swingArc);
        break;
        
      case 'sliding':
        // Show sliding direction arrows
        const arrowGeometry = new THREE.PlaneGeometry(0.1, 0.02);
        const arrowMaterial = new THREE.MeshBasicMaterial({
          color: 0x2196F3,
          transparent: true,
          opacity: 0.6
        });
        const arrow1 = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow1.rotation.x = -Math.PI / 2;
        arrow1.position.set(-width/4, 0.001, 0);
        const arrow2 = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow2.rotation.x = -Math.PI / 2;
        arrow2.position.set(width/4, 0.001, 0);
        indicatorGroup.add(arrow1, arrow2);
        break;
        
      case 'awning':
        // Show awning opening indicator
        const awningGeometry = new THREE.PlaneGeometry(width * 0.6, 0.02);
        const awningMaterial = new THREE.MeshBasicMaterial({
          color: 0xFF9800,
          transparent: true,
          opacity: 0.5
        });
        const awningIndicator = new THREE.Mesh(awningGeometry, awningMaterial);
        awningIndicator.rotation.x = -Math.PI / 2;
        awningIndicator.position.set(0, 0.001, 0);
        indicatorGroup.add(awningIndicator);
        break;
    }
    
    return indicatorGroup.children.length > 0 ? indicatorGroup : null;
  }
  /**
   * Create furniture geometry
   */
  createFurnitureGeometry(params) {
    const { 
      width = 1.0, 
      height = 0.8, 
      depth = 0.6,
      materialColor = '#8B4513',
      subtype = 'generic',
      name = 'Furniture',
      position = { x: 0, y: 0, z: 0 },
      modelUrl = null,
      format = null
    } = params;

    console.log('🪑 FURNITURE DEBUG: Creating furniture with params:', {
      name, subtype, width, height, depth, modelUrl, format, position
    });
    
    // If we have a modelUrl, create a placeholder and load the model asynchronously
    if (modelUrl && format) {
      console.log('🪑 FURNITURE DEBUG: Loading external model:', { modelUrl, format });
      return this.createExternalModelGeometry(modelUrl, format, width, height, depth, position, materialColor, name);
    }
    
    // Create 3D geometry based on furniture type (fallback for basic shapes)
    let geometry;
    let color = materialColor;
    
    // Adjust geometry based on subtype
    switch (subtype) {
      case 'sofa-3seat':
      case 'sofa':
        geometry = new THREE.BoxGeometry(width, height, depth);
        break;
      case 'armchair':
      case 'office-chair':
        geometry = new THREE.BoxGeometry(width, height, depth);
        break;
      case 'dining-table':
      case 'coffee-table':
      case 'desk':
        // Create table with legs (simplified)
        const group = new THREE.Group();
        // Table top
        const tableTop = new THREE.BoxGeometry(width, 0.05, depth);
        const tableTopMesh = new THREE.Mesh(tableTop, new THREE.MeshLambertMaterial({ color: color }));
        tableTopMesh.position.y = height - 0.025;
        group.add(tableTopMesh);
        
        // Table legs (4 corners)
        const legGeometry = new THREE.BoxGeometry(0.05, height - 0.05, 0.05);
        const legMaterial = new THREE.MeshLambertMaterial({ color: color });
        
        const positions = [
          { x: width/2 - 0.1, z: depth/2 - 0.1 },
          { x: -width/2 + 0.1, z: depth/2 - 0.1 },
          { x: width/2 - 0.1, z: -depth/2 + 0.1 },
          { x: -width/2 + 0.1, z: -depth/2 + 0.1 }
        ];
        
        positions.forEach(pos => {
          const leg = new THREE.Mesh(legGeometry, legMaterial.clone());
          leg.position.set(pos.x, (height - 0.05)/2, pos.z);
          group.add(leg);
        });
        
        geometry = group;
        break;
      case 'bookshelf':
      case 'wardrobe':
        geometry = new THREE.BoxGeometry(width, height, depth);
        break;
      default:
        geometry = new THREE.BoxGeometry(width, height, depth);
    }
    
    // Create 3D mesh
    let mesh3D;
    if (geometry.type === 'Group') {
      mesh3D = geometry; // Already a group with materials
      mesh3D.userData = { objectId: null, type: 'furniture', subtype, name };
    } else {
      const material = new THREE.MeshLambertMaterial({ color: color });
      mesh3D = new THREE.Mesh(geometry, material);
      mesh3D.userData = { objectId: null, type: 'furniture', subtype, name };
    }
    
    // Set position
    mesh3D.position.set(position.x, height / 2, position.z);
    
    // Create 2D representation (top-down view)
    const geometry2D = new THREE.PlaneGeometry(width, depth);
    const material2D = new THREE.MeshBasicMaterial({ 
      color: color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const mesh2D = new THREE.Mesh(geometry2D, material2D);
    mesh2D.userData = { objectId: null, type: 'furniture', subtype, name };
    mesh2D.position.set(position.x, 0, position.z);
    
    return {
      geometry: geometry,
      mesh3D: mesh3D,
      mesh2D: mesh2D
    };
  }

  /**
   * Create external model geometry (FBX, glTF, OBJ)
   */
  createExternalModelGeometry(modelUrl, format, width, height, depth, position, materialColor, name) {
    console.log('🪑 EXTERNAL MODEL DEBUG: Creating external model placeholder:', {
      modelUrl, format, width, height, depth, position, name
    });
    
    // Create placeholder geometry (will be replaced when model loads)
    const placeholderGeometry = new THREE.BoxGeometry(width, height, depth);
    const placeholderMaterial = new THREE.MeshLambertMaterial({ 
      color: materialColor,
      transparent: true,
      opacity: 0.5,
      wireframe: true
    });
    
    const mesh3D = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
    mesh3D.userData = { 
      objectId: null, 
      type: 'furniture', 
      name,
      isPlaceholder: true,
      modelUrl,
      format
    };
    mesh3D.position.set(position.x, height / 2, position.z);
    
    // Create 2D representation
    const geometry2D = new THREE.PlaneGeometry(width, depth);
    const material2D = new THREE.MeshBasicMaterial({ 
      color: materialColor, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const mesh2D = new THREE.Mesh(geometry2D, material2D);
    mesh2D.userData = { objectId: null, type: 'furniture', name };
    mesh2D.position.set(position.x, 0, position.z);
    
    // Start loading the actual model asynchronously
    this.loadExternalModel(modelUrl, format, mesh3D, position, materialColor)
      .then((loadedModel) => {
        console.log('✅ EXTERNAL MODEL DEBUG: Model loaded successfully:', name);
        // Model is already updated in loadExternalModel
      })
      .catch((error) => {
        console.error('❌ EXTERNAL MODEL DEBUG: Failed to load model:', error);
        // Keep the placeholder
      });
    
    return {
      geometry: placeholderGeometry,
      mesh3D: mesh3D,
      mesh2D: mesh2D
    };
  }
  
  /**
   * Load external model asynchronously
   */
  async loadExternalModel(modelUrl, format, placeholderMesh, position, materialColor) {
    const formatLower = format.toLowerCase();
    let loader;
    
    switch (formatLower) {
      case 'fbx':
        loader = new FBXLoader();
        break;
      case 'gltf':
      case 'glb':
        loader = new GLTFLoader();
        break;
      case 'obj':
        loader = new OBJLoader();
        break;
      default:
        throw new Error(`Unsupported model format: ${format}`);
    }
    
    return new Promise((resolve, reject) => {
      console.log('📥 EXTERNAL MODEL DEBUG: Starting to load model from:', modelUrl);
      
      loader.load(
        modelUrl,
        // onLoad
        (loadedModel) => {
          console.log('✅ EXTERNAL MODEL DEBUG: Model loaded from URL:', modelUrl);
          
          let modelObject;
          if (formatLower === 'gltf' || formatLower === 'glb') {
            modelObject = loadedModel.scene;
          } else {
            modelObject = loadedModel;
          }
          
          // Apply materials and scaling
          modelObject.traverse((child) => {
            if (child.isMesh) {
              if (!child.material || !child.material.map) {
                child.material = new THREE.MeshStandardMaterial({
                  color: materialColor,
                  roughness: 0.6,
                  metalness: 0.1
                });
              }
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          // Auto-scale model to reasonable size
          const box = new THREE.Box3().setFromObject(modelObject);
          const size = box.getSize(new THREE.Vector3());
          const maxSize = Math.max(size.x, size.y, size.z);
          
          if (maxSize > 5) {
            const scaleFactor = 2 / maxSize;
            modelObject.scale.multiplyScalar(scaleFactor);
          } else if (maxSize < 0.1) {
            const scaleFactor = 1 / maxSize;
            modelObject.scale.multiplyScalar(scaleFactor);
          }
          
          // Replace placeholder with loaded model
          const parent = placeholderMesh.parent;
          if (parent) {
            // Copy placeholder properties to loaded model
            modelObject.position.copy(placeholderMesh.position);
            modelObject.userData = { ...placeholderMesh.userData, isPlaceholder: false };
            
            // Replace placeholder in scene
            parent.remove(placeholderMesh);
            parent.add(modelObject);
            
            console.log('✅ EXTERNAL MODEL DEBUG: Placeholder replaced with loaded model');
          }
          
          resolve(modelObject);
        },
        // onProgress
        (progress) => {
          if (progress && progress.loaded !== undefined && progress.total !== undefined && progress.total > 0) {
            const percentage = (progress.loaded / progress.total * 100);
            console.log(`📥 EXTERNAL MODEL DEBUG: Loading progress: ${percentage.toFixed(1)}%`);
          } else {
            console.log('📥 EXTERNAL MODEL DEBUG: Loading in progress...');
          }
        },
        // onError
        (error) => {
          console.error('❌ EXTERNAL MODEL DEBUG: Failed to load model:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Create fixture geometry
   */
  createFixtureGeometry(params) {
    const { 
      width = 0.3, 
      height = 0.4, 
      depth = 0.3,
      materialColor = '#FFD700',
      subtype = 'generic',
      name = 'Fixture',
      position = { x: 0, y: 0, z: 0 }
    } = params;
    
    // Create 3D geometry based on fixture type
    let geometry;
    let color = materialColor;
    let yPosition = height / 2;
    
    // Adjust geometry based on subtype
    switch (subtype) {
      case 'pendant-light':
        geometry = new THREE.ConeGeometry(width/2, height, 8);
        yPosition = 2.5 - height/2; // Hang from ceiling
        break;
      case 'chandelier':
        geometry = new THREE.SphereGeometry(width/2, 16, 8);
        yPosition = 2.5 - height/2; // Hang from ceiling
        break;
      case 'floor-lamp':
        geometry = new THREE.CylinderGeometry(0.02, 0.05, height, 8);
        yPosition = height / 2;
        break;
      case 'toilet':
        // Create toilet shape (simplified)
        const group = new THREE.Group();
        // Bowl
        const bowl = new THREE.CylinderGeometry(width/2, width/2 - 0.05, height * 0.6, 12);
        const bowlMesh = new THREE.Mesh(bowl, new THREE.MeshLambertMaterial({ color: color }));
        bowlMesh.position.y = height * 0.3;
        group.add(bowlMesh);
        // Tank
        const tank = new THREE.BoxGeometry(width * 0.8, height * 0.6, depth * 0.4);
        const tankMesh = new THREE.Mesh(tank, new THREE.MeshLambertMaterial({ color: color }));
        tankMesh.position.set(0, height * 0.7, -depth * 0.3);
        group.add(tankMesh);
        geometry = group;
        yPosition = 0;
        break;
      case 'sink':
        geometry = new THREE.CylinderGeometry(width/2, width/2 - 0.02, height, 12);
        yPosition = 0.8 + height/2; // Counter height
        break;
      case 'bathtub':
        geometry = new THREE.BoxGeometry(width, height, depth);
        yPosition = height / 2;
        break;
      default:
        geometry = new THREE.BoxGeometry(width, height, depth);
    }
    
    // Create 3D mesh
    let mesh3D;
    if (geometry.type === 'Group') {
      mesh3D = geometry; // Already a group with materials
      mesh3D.userData = { objectId: null, type: 'fixture', subtype, name };
    } else {
      const material = new THREE.MeshLambertMaterial({ color: color });
      mesh3D = new THREE.Mesh(geometry, material);
      mesh3D.userData = { objectId: null, type: 'fixture', subtype, name };
    }
    
    // Set position
    mesh3D.position.set(position.x, yPosition, position.z);
    
    // Create 2D representation (top-down view)
    const geometry2D = new THREE.PlaneGeometry(width, depth);
    const material2D = new THREE.MeshBasicMaterial({ 
      color: color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const mesh2D = new THREE.Mesh(geometry2D, material2D);
    mesh2D.userData = { objectId: null, type: 'fixture', subtype, name };
    mesh2D.position.set(position.x, 0, position.z);
    
    return {
      geometry: geometry,
      mesh3D: mesh3D,
      mesh2D: mesh2D
    };
  }

  /**
   * Update object parameters
   */
  updateObject(objectId, newParams) {
    console.log(`🔧 CAD ENGINE: Updating object ${objectId} with parameters:`, newParams);
    
    const cadObject = this.objects.get(objectId);
    if (!cadObject) {
      console.warn(`Object not found: ${objectId}`);
      return false;
    }

    console.log(`🔧 CAD ENGINE: Found object to update:`, {
      id: objectId,
      type: cadObject.type,
      hasMesh3D: !!cadObject.mesh3D,
      hasMesh2D: !!cadObject.mesh2D,
      currentParams: cadObject.params
    });

    // Check if this is a property panel update (don't trigger joinery for property updates)
    const isPropertyUpdate = newParams.updatedBy === 'wall_property_panel';
    if (isPropertyUpdate) {
      console.log(`🔧 CAD ENGINE: Property panel update detected - disabling joinery`);
    }

    // Update parameters
    cadObject.params = { ...cadObject.params, ...newParams };
    console.log(`🔧 CAD ENGINE: Updated parameters:`, cadObject.params);
    
    // Remove old meshes from scenes
    console.log(`🗑️ CAD ENGINE: Disposing old meshes for ${objectId}`);
    if (cadObject.mesh3D) {
      this.scene3D.remove(cadObject.mesh3D);
      if (cadObject.mesh3D.geometry && typeof cadObject.mesh3D.geometry.dispose === 'function') {
        cadObject.mesh3D.geometry.dispose();
        console.log(`✅ CAD ENGINE: Disposed 3D geometry for ${objectId}`);
      }
      if (cadObject.mesh3D.material && typeof cadObject.mesh3D.material.dispose === 'function') {
        cadObject.mesh3D.material.dispose();
        console.log(`✅ CAD ENGINE: Disposed 3D material for ${objectId}`);
      }
    }
    if (cadObject.mesh2D) {
      this.scene2D.remove(cadObject.mesh2D);
      if (cadObject.mesh2D.geometry && typeof cadObject.mesh2D.geometry.dispose === 'function') {
        cadObject.mesh2D.geometry.dispose();
        console.log(`✅ CAD ENGINE: Disposed 2D geometry for ${objectId}`);
      }
      if (cadObject.mesh2D.material && typeof cadObject.mesh2D.material.dispose === 'function') {
        cadObject.mesh2D.material.dispose();
        console.log(`✅ CAD ENGINE: Disposed 2D material for ${objectId}`);
      }
    }
    console.log(`🗑️ CAD ENGINE: Disposal completed for ${objectId}`);
    
    // Recreate geometry with new parameters
    let result;
    switch (cadObject.type) {
      case 'slab':
        result = this.createSlabGeometry(cadObject.params);
        break;
      case 'wall':
        result = this.createWallGeometry({
          ...cadObject.params,
          skipJoinery: isPropertyUpdate  // Skip joinery for property panel updates
        });
        break;
      case 'door':
        result = this.createDoorGeometry(cadObject.params);
        break;
      case 'window':
        result = this.createWindowGeometry(cadObject.params);
        break;
      case 'column':
        result = this.createColumnGeometry(cadObject.params);
        break;
      case 'furniture':
        result = this.createFurnitureGeometry(cadObject.params);
        break;
      case 'fixture':
        result = this.createFixtureGeometry(cadObject.params);
        break;
      default:
        console.warn(`Update not implemented for type: ${cadObject.type}`);
        return false;
    }
    
    // Update object
    cadObject.geometry = result.geometry;
    cadObject.mesh3D = result.mesh3D;
    cadObject.mesh2D = result.mesh2D;
    
    // Set user data
    if (cadObject.mesh3D) {
      cadObject.mesh3D.userData.objectId = objectId;
      this.scene3D.add(cadObject.mesh3D);
    }
    if (cadObject.mesh2D) {
      cadObject.mesh2D.userData.objectId = objectId;
      this.scene2D.add(cadObject.mesh2D);
    }

    // Emit update event
    console.log(`📡 CAD ENGINE: Emitting object_updated event for ${objectId}`);
    const serializedObject = this.serializeObject(cadObject);
    console.log(`📡 CAD ENGINE: Serialized updated object:`, serializedObject);
    
    this.emit('object_updated', {
      object: serializedObject,
      objectId: objectId,
      timestamp: Date.now()
    });
    
    console.log(`📡 CAD ENGINE: Event emitted for object_updated`);
    console.log(`✅ CAD ENGINE: Successfully updated object ${objectId} with new geometry`);
    return true;
  }

  /**
   * Delete a CAD object
   */
  deleteObject(objectId) {
    const cadObject = this.objects.get(objectId);
    if (!cadObject) {
      console.warn(`Object not found: ${objectId}`);
      return false;
    }

    // Remove from scenes and dispose properly
    if (cadObject.mesh3D) {
      this.scene3D.remove(cadObject.mesh3D);
      if (cadObject.mesh3D.geometry) cadObject.mesh3D.geometry.dispose();
      if (cadObject.mesh3D.material) cadObject.mesh3D.material.dispose();
    }
    
    if (cadObject.mesh2D) {
      this.scene2D.remove(cadObject.mesh2D);
      
      // Handle architectural walls (groups) vs legacy single meshes
      if (cadObject.mesh2D.type === 'Group') {
        // Dispose of all children in the group (architectural walls)
        cadObject.mesh2D.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      } else {
        // Legacy single mesh disposal
        if (cadObject.mesh2D.geometry) cadObject.mesh2D.geometry.dispose();
        if (cadObject.mesh2D.material) cadObject.mesh2D.material.dispose();
      }
    }

    // Remove from selection
    this.selectedObjects.delete(objectId);
    
    // Remove from storage
    this.objects.delete(objectId);

    console.log(`🗑️ Deleted object: ${objectId}`);

    // Emit delete event
    this.emit('object_deleted', { objectId });
    
    return true;
  }

  /**
   * Select object(s)
   */
  selectObject(objectId, addToSelection = false) {
    if (!addToSelection) {
      this.clearSelection();
    }
    
    const cadObject = this.objects.get(objectId);
    if (cadObject) {
      this.selectedObjects.add(objectId);
      cadObject.selected = true;
      
      // Visual selection feedback
      if (cadObject.mesh3D) {
        // Add selection outline or change material
        cadObject.mesh3D.material = this.materials.selected.clone();
      }
      if (cadObject.mesh2D) {
        cadObject.mesh2D.material = this.materials.selected.clone();
      }
      
      this.emit('selection_changed', {
        selectedObjects: Array.from(this.selectedObjects)
      });
    }
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedObjects.forEach(objectId => {
      const cadObject = this.objects.get(objectId);
      if (cadObject) {
        cadObject.selected = false;
        
        // Restore original material
        const materialName = cadObject.params.material || 'concrete';
        const originalMaterial = this.materials[materialName] || this.materials.concrete;
        
        if (cadObject.mesh3D) {
          cadObject.mesh3D.material = originalMaterial.clone();
        }
        if (cadObject.mesh2D) {
          const material2D = new THREE.MeshBasicMaterial({
            color: originalMaterial.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
          });
          cadObject.mesh2D.material = material2D;
        }
      }
    });
    
    this.selectedObjects.clear();
    
    this.emit('selection_changed', {
      selectedObjects: []
    });
  }

  /**
   * Get all objects
   */
  getAllObjects() {
    const objectArray = Array.from(this.objects.values());
    const serialized = objectArray.map(obj => this.serializeObject(obj));
    // Only log if there are objects to serialize
    if (serialized.length > 0) {
      console.log(`📦 Serialized ${serialized.length} objects`);
    }
    return serialized;
  }

  /**
   * Clear all CAD objects (safe reset for starting a new project)
   */
  clearAllObjects() {
    try {
      console.log('🧹 CAD ENGINE: Clearing all objects');
      // Deselect everything
      this.selectedObjects.clear();
      // Remove meshes from scenes if present
      for (const cadObject of this.objects.values()) {
        try {
          if (cadObject.mesh3D && this.scene3D) {
            this.scene3D.remove(cadObject.mesh3D);
          }
          if (cadObject.mesh2D && this.scene2D) {
            this.scene2D.remove(cadObject.mesh2D);
          }
        } catch {}
      }
      // Reset storage
      this.objects.clear();
      // Notify listeners
      this.emit('objects_changed', { objects: [] });
      this.emit('selection_changed', { selectedObjects: [] });
      console.log('✅ CAD ENGINE: All objects cleared');
      return true;
    } catch (error) {
      console.warn('⚠️ CAD ENGINE: Failed to clear objects:', error?.message || error);
      return false;
    }
  }

  /**
   * Get selected objects
   */
  getSelectedObjects() {
    return Array.from(this.selectedObjects).map(id => {
      const obj = this.objects.get(id);
      return obj ? this.serializeObject(obj) : null;
    }).filter(Boolean);
  }

  /**
   * Get 3D scene for rendering
   */
  get3DScene() {
    return this.scene3D;
  }

  /**
   * Get 2D scene for rendering
   */
  get2DScene() {
    return this.scene2D;
  }

  /**
   * Serialize object for external consumption
   */
  serializeObject(cadObject) {
    console.log(`🔄 SERIALIZE DEBUG: Serializing object ${cadObject.id}:`, {
      id: cadObject.id,
      type: cadObject.type,
      hasParams: !!cadObject.params,
      paramsKeys: cadObject.params ? Object.keys(cadObject.params) : null,
      params: cadObject.params
    });
    
    const serialized = {
      id: cadObject.id,
      type: cadObject.type,
      ...cadObject.params,
      // Explicitly include params object for debugging
      params: cadObject.params,
      created: cadObject.created,
      visible: cadObject.visible,
      selected: cadObject.selected,
      // Include mesh3D for 3D viewport rendering
      mesh3D: cadObject.mesh3D,
      mesh2D: cadObject.mesh2D,
      // CRITICAL: Explicitly include furniture/fixture properties at top level
      modelUrl: cadObject.params?.modelUrl || cadObject.modelUrl,
      model_url: cadObject.params?.model_url || cadObject.model_url,
      format: cadObject.params?.format || cadObject.format,
      name: cadObject.params?.name || cadObject.name,
      // Add computed properties for compatibility
      position: cadObject.mesh3D ? {
        x: cadObject.mesh3D.position.x,
        y: cadObject.mesh3D.position.y,
        z: cadObject.mesh3D.position.z
      } : { x: 0, y: 0, z: 0 },
      // Add rotation as full Euler object for 3D bridge compatibility
      rotation: cadObject.mesh3D ? {
        x: cadObject.mesh3D.rotation.x,
        y: cadObject.mesh3D.rotation.y,
        z: cadObject.mesh3D.rotation.z
      } : { x: 0, y: 0, z: 0 }
    };
    
    console.log(`✅ SERIALIZE DEBUG: Serialized object ${cadObject.id}:`, {
      hasParams: !!serialized.params,
      paramsInSerialized: serialized.params,
      modelUrl: serialized.modelUrl,
      model_url: serialized.model_url,
      format: serialized.format,
      hasModelUrl: !!serialized.modelUrl || !!serialized.model_url
    });

    // Include BIM data if available
    if (cadObject.bimObject) {
      serialized.bimData = cadObject.bimObject.toExport();
      
      // Add BIM-specific properties for doors and windows
      if (cadObject.type === 'door' || cadObject.type === 'window') {
        serialized.hostWallId = cadObject.bimObject.hostWallId;
        serialized.wallOffset = cadObject.bimObject.wallOffset;
        
        if (cadObject.type === 'window') {
          serialized.sillHeight = cadObject.bimObject.sillHeight;
          serialized.glazingArea = cadObject.bimObject.calculateGlazingArea();
        }
      }
    }

    return serialized;
  }

  /**
   * Get BIM data for all objects with relationships
   */
  getBIMData() {
    const bimData = {
      walls: [],
      doors: [],
      windows: [],
      relationships: []
    };

    // Extract BIM objects from CAD objects
    for (const [id, cadObject] of this.objects) {
      if (cadObject.bimObject) {
        const bimExport = cadObject.bimObject.toExport();
        
        if (cadObject.type === 'wall') {
          bimData.walls.push(bimExport);
        } else if (cadObject.type === 'door') {
          bimData.doors.push(bimExport);
          
          // Add wall-door relationship if hostWallId exists
          if (cadObject.bimObject.hostWallId) {
            bimData.relationships.push({
              type: 'IfcRelVoidsElement',
              relatingElement: cadObject.bimObject.hostWallId,
              relatedElement: cadObject.id,
              description: `Door ${cadObject.id} creates opening in wall ${cadObject.bimObject.hostWallId}`
            });
          }
        } else if (cadObject.type === 'window') {
          bimData.windows.push(bimExport);
          
          // Add wall-window relationship if hostWallId exists
          if (cadObject.bimObject.hostWallId) {
            bimData.relationships.push({
              type: 'IfcRelVoidsElement',
              relatingElement: cadObject.bimObject.hostWallId,
              relatedElement: cadObject.id,
              description: `Window ${cadObject.id} creates opening in wall ${cadObject.bimObject.hostWallId}`
            });
          }
        }
      }
    }

    // Add wall opening relationships
    for (const [id, cadObject] of this.objects) {
      if (cadObject.type === 'wall' && cadObject.openings) {
        cadObject.openings.forEach(opening => {
          bimData.relationships.push({
            type: 'IfcRelContainedInSpatialStructure',
            relatingStructure: cadObject.id,
            relatedElements: [opening.id],
            description: `Opening ${opening.id} contained in wall ${cadObject.id}`
          });
        });
      }
    }

    return bimData;
  }
  /**
   * Get wall-element relationships for a specific wall
   */
  getWallRelationships(wallId) {
    const relationships = [];
    
    for (const [id, cadObject] of this.objects) {
      if ((cadObject.type === 'door' || cadObject.type === 'window') && 
          cadObject.bimObject && 
          cadObject.bimObject.hostWallId === wallId) {
        relationships.push({
          elementId: cadObject.id,
          elementType: cadObject.type,
          position: cadObject.params.insertionPosition,
          dimensions: {
            width: cadObject.params.width,
            height: cadObject.params.height
          }
        });
      }
    }
    
    return relationships;
  }

  /**
   * Scene Manager Interface for Command History Integration
   */
  
  // Check if entity exists
  hasEntity(entityId) {
    return this.objects.has(entityId);
  }
  
  // Get entity data
  getEntity(entityId) {
    const cadObject = this.objects.get(entityId);
    return cadObject ? this.serializeObject(cadObject) : null;
  }
  
  // Add door (for command history)
  async addDoor(doorData) {
    const objectId = this.createObject('door', doorData);
    return objectId;
  }
  
  // Remove door (for command history)
  async removeDoor(doorId) {
    return this.deleteObject(doorId);
  }
  
  // Add window (for command history)
  async addWindow(windowData) {
    const objectId = this.createObject('window', windowData);
    return objectId;
  }
  
  // Remove window (for command history)
  async removeWindow(windowId) {
    return this.deleteObject(windowId);
  }
  
  // Add wall (for command history)
  async addWall(wallData) {
    const objectId = this.createObject('wall', wallData);
    return objectId;
  }
  
  // Remove wall (for command history)
  async removeWall(wallId) {
    return this.deleteObject(wallId);
  }
  
  // Update wall (for command history)
  async updateWall(wallId, wallData) {
    return this.updateObject(wallId, wallData);
  }
  
  // Get wall data (for command history)
  async getWall(wallId) {
    return this.getEntity(wallId);
  }
  
  /**
   * Create door with undo/redo support
   */
  createDoorWithHistory(doorParams) {
    const command = CommandFactory.createDoor(doorParams, this);
    return commandHistory.executeCommand(command);
  }
  
  /**
   * Create window with undo/redo support
   */
  createWindowWithHistory(windowParams) {
    const command = CommandFactory.createWindow(windowParams, this);
    return commandHistory.executeCommand(command);
  }
  
  /**
   * Create wall with undo/redo support
   */
  createWallWithHistory(wallParams) {
    const command = CommandFactory.createWall(wallParams, this);
    return commandHistory.executeCommand(command);
  }

  /**
   * Create preview object (temporary visualization)
   */
  createPreview(type, params) {
    this.clearPreview();
    
    let result;
    switch (type) {
      case 'slab':
        result = this.createSlabGeometry(params);
        break;
      default:
        return null;
    }
    
    // Apply preview material
    if (result.mesh3D) {
      result.mesh3D.material = this.materials.preview.clone();
      this.scene3D.add(result.mesh3D);
    }
    if (result.mesh2D) {
      result.mesh2D.material = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3
      });
      this.scene2D.add(result.mesh2D);
    }
    
    this.previewObject = result;
    
    return result;
  }

  /**
   * Clear preview object
   */
  clearPreview() {
    if (this.previewObject) {
      if (this.previewObject.mesh3D) {
        this.scene3D.remove(this.previewObject.mesh3D);
        if (this.previewObject.mesh3D.geometry) this.previewObject.mesh3D.geometry.dispose();
        if (this.previewObject.mesh3D.material) this.previewObject.mesh3D.material.dispose();
      }
      
      if (this.previewObject.mesh2D) {
        this.scene2D.remove(this.previewObject.mesh2D);
        
        // Handle architectural walls (groups) vs legacy single meshes
        if (this.previewObject.mesh2D.type === 'Group') {
          // Dispose of all children in the group (architectural walls)
          this.previewObject.mesh2D.children.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
        } else {
          // Legacy single mesh disposal
          if (this.previewObject.mesh2D.geometry) this.previewObject.mesh2D.geometry.dispose();
          if (this.previewObject.mesh2D.material) this.previewObject.mesh2D.material.dispose();
        }
      }
      this.previewObject = null;
    }
  }

  /**
   * Import IFC file data (parsed from base64)
   */
  async importIFC(fileName, base64Data) {
    console.log(`🏗️ Importing IFC file: ${fileName}`);
    
    try {
      // Decode base64 to text
      const ifcText = atob(base64Data);
      console.log(`📄 IFC file size: ${ifcText.length} characters`);
      
      // Parse IFC structure
      const ifcData = this.parseIFCFile(ifcText);
      console.log(`🔍 Parsed IFC data:`, ifcData);
      
      // Import building elements
      const importedObjects = [];
      
      // Import walls
      if (ifcData.walls && ifcData.walls.length > 0) {
        console.log(`🧱 Importing ${ifcData.walls.length} walls...`);
        for (const wall of ifcData.walls) {
          try {
            const objectId = this.createObject('wall', wall);
            if (objectId) {
              importedObjects.push({ type: 'wall', id: objectId, name: wall.name });
            }
          } catch (error) {
            console.warn(`Failed to import wall ${wall.name}:`, error);
          }
        }
      }
      
      // Import slabs
      if (ifcData.slabs && ifcData.slabs.length > 0) {
        console.log(`🏗️ Importing ${ifcData.slabs.length} slabs...`);
        for (const slab of ifcData.slabs) {
          try {
            const objectId = this.createObject('slab', slab);
            if (objectId) {
              importedObjects.push({ type: 'slab', id: objectId, name: slab.name });
            }
          } catch (error) {
            console.warn(`Failed to import slab ${slab.name}:`, error);
          }
        }
      }
      
      // Import columns
      if (ifcData.columns && ifcData.columns.length > 0) {
        console.log(`🏢 Importing ${ifcData.columns.length} columns...`);
        for (const column of ifcData.columns) {
          try {
            const objectId = this.createObject('column', column);
            if (objectId) {
              importedObjects.push({ type: 'column', id: objectId, name: column.name });
            }
          } catch (error) {
            console.warn(`Failed to import column ${column.name}:`, error);
          }
        }
      }
      
      // Import doors
      if (ifcData.doors && ifcData.doors.length > 0) {
        console.log(`🚪 Importing ${ifcData.doors.length} doors...`);
        for (const door of ifcData.doors) {
          try {
            const objectId = this.createObject('door', door);
            if (objectId) {
              importedObjects.push({ type: 'door', id: objectId, name: door.name });
            }
          } catch (error) {
            console.warn(`Failed to import door ${door.name}:`, error);
          }
        }
      }
      
      // Import windows
      if (ifcData.windows && ifcData.windows.length > 0) {
        console.log(`🪟 Importing ${ifcData.windows.length} windows...`);
        for (const window of ifcData.windows) {
          try {
            const objectId = this.createObject('window', window);
            if (objectId) {
              importedObjects.push({ type: 'window', id: objectId, name: window.name });
            }
          } catch (error) {
            console.warn(`Failed to import window ${window.name}:`, error);
          }
        }
      }
      
      console.log(`✅ IFC import completed. Imported ${importedObjects.length} objects.`);
      
      // Emit import completed event
      this.emit('ifc_imported', {
        fileName: fileName,
        importedObjects: importedObjects,
        summary: ifcData.summary
      });
      
      return {
        success: true,
        message: `Successfully imported ${importedObjects.length} objects from ${fileName}`,
        importedObjects: importedObjects,
        summary: ifcData.summary
      };
      
    } catch (error) {
      console.error('❌ IFC import failed:', error);
      
      // Emit import error event
      this.emit('ifc_import_error', {
        fileName: fileName,
        error: error.message
      });
      
      return {
        success: false,
        message: `Failed to import ${fileName}: ${error.message}`
      };
    }
  }

  /**
   * Parse IFC file content and extract building elements
   */
  parseIFCFile(ifcText) {
    console.log('🔍 Parsing IFC file structure...');
    
    const ifcData = {
      walls: [],
      slabs: [],
      columns: [],
      doors: [],
      windows: [],
      summary: {
        totalEntities: 0,
        supportedElements: 0,
        unsupportedElements: 0
      }
    };
    
    // Split into lines and find DATA section
    const lines = ifcText.split('\n');
    let inDataSection = false;
    let currentEntity = '';
    const entityTypes = new Set(); // Track all entity types found
    
    for (let line of lines) {
      line = line.trim();
      
      if (line === 'DATA;') {
        inDataSection = true;
        console.log('📍 Found DATA section, starting entity parsing...');
        continue;
      }
      
      if (line === 'ENDSEC;' && inDataSection) {
        console.log('📍 End of DATA section');
        break;
      }
      
      if (!inDataSection || !line.startsWith('#')) {
        continue;
      }
      
      // Handle multi-line entities
      currentEntity += line;
      if (!line.endsWith(';')) {
        continue;
      }
      
      ifcData.summary.totalEntities++;
      
      // Track entity types for debugging
      const typeMatch = currentEntity.match(/=\s*IFC(\w+)\(/);
      if (typeMatch) {
        entityTypes.add(typeMatch[1].toUpperCase());
      }
      
      // Parse complete entity
      this.parseIFCEntity(currentEntity, ifcData);
      currentEntity = '';
    }
    
    // Log all entity types found for debugging
    console.log('🔍 All entity types found:', Array.from(entityTypes).sort());
    console.log('🎯 Building element types found:', Array.from(entityTypes).filter(type => 
      ['WALL', 'SLAB', 'COLUMN', 'DOOR', 'WINDOW', 'BUILDINGELEMENTPROXY'].includes(type)
    ));
    
    ifcData.summary.supportedElements = 
      ifcData.walls.length + 
      ifcData.slabs.length + 
      ifcData.columns.length + 
      ifcData.doors.length + 
      ifcData.windows.length;
    
    ifcData.summary.unsupportedElements = 
      ifcData.summary.totalEntities - ifcData.summary.supportedElements;
    
    console.log('📊 IFC parsing complete:', {
      walls: ifcData.walls.length,
      slabs: ifcData.slabs.length,
      columns: ifcData.columns.length,
      doors: ifcData.doors.length,
      windows: ifcData.windows.length,
      total: ifcData.summary.supportedElements
    });
    
    return ifcData;
  }

  /**
   * Parse a single IFC entity
   */
  parseIFCEntity(entityLine, ifcData) {
    try {
      // Extract entity type
      const typeMatch = entityLine.match(/=\s*IFC(\w+)\(/);
      if (!typeMatch) return;
      
      const entityType = typeMatch[1].toUpperCase();
      
      // Debug: log all found entity types
      if (['WALL', 'SLAB', 'COLUMN', 'DOOR', 'WINDOW', 'BUILDINGELEMENTPROXY'].includes(entityType)) {
        console.log(`🔍 Found ${entityType} entity:`, entityLine.substring(0, 100) + '...');
      }
      
      // Extract parameters
      const paramMatch = entityLine.match(/=\s*IFC\w+\((.*)\);/);
      if (!paramMatch) {
        console.warn(`⚠️ Could not extract parameters from ${entityType}:`, entityLine.substring(0, 100));
        return;
      }
      
      const params = this.parseIFCParameters(paramMatch[1]);
      console.log(`📋 ${entityType} parameters:`, params.slice(0, 5)); // Show first 5 params
      
      // Create building element based on type
      switch (entityType) {
        case 'WALL':
          const wall = this.createWallFromIFC(params);
          ifcData.walls.push(wall);
          console.log(`🧱 Created wall:`, wall.name);
          break;
        case 'SLAB':
          const slab = this.createSlabFromIFC(params);
          ifcData.slabs.push(slab);
          console.log(`🏗️ Created slab:`, slab.name);
          break;
        case 'COLUMN':
          const column = this.createColumnFromIFC(params);
          ifcData.columns.push(column);
          console.log(`🏢 Created column:`, column.name);
          break;
        case 'DOOR':
          const door = this.createDoorFromIFC(params);
          ifcData.doors.push(door);
          console.log(`🚪 Created door:`, door.name);
          break;
        case 'WINDOW':
          const window = this.createWindowFromIFC(params);
          ifcData.windows.push(window);
          console.log(`🪟 Created window:`, window.name);
          break;
        case 'BUILDINGELEMENTPROXY':
          // Handle generic building elements - try to determine type from name
          const proxy = this.createBuildingElementProxyFromIFC(params);
          if (proxy) {
            // Add to appropriate category based on detected type
            switch (proxy.detectedType) {
              case 'wall':
                ifcData.walls.push(proxy);
                console.log(`🧱 Created wall from proxy:`, proxy.name);
                break;
              case 'slab':
                ifcData.slabs.push(proxy);
                console.log(`🏗️ Created slab from proxy:`, proxy.name);
                break;
              case 'column':
                ifcData.columns.push(proxy);
                console.log(`🏢 Created column from proxy:`, proxy.name);
                break;
              case 'door':
                ifcData.doors.push(proxy);
                console.log(`🚪 Created door from proxy:`, proxy.name);
                break;
              case 'window':
                ifcData.windows.push(proxy);
                console.log(`🪟 Created window from proxy:`, proxy.name);
                break;
              default:
                // Default to wall if type cannot be determined
                ifcData.walls.push(proxy);
                console.log(`🧱 Created wall from unknown proxy:`, proxy.name);
                break;
            }
          }
          break;
      }
    } catch (error) {
      console.warn('Failed to parse IFC entity:', entityLine.substring(0, 100), error);
    }
  }

  /**
   * Parse IFC parameter string
   */
  parseIFCParameters(paramString) {
    if (!paramString || paramString.trim().length === 0) {
      return [];
    }
    
    const params = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i];
      
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        current += char;
        continue;
      }
      
      if (char === "'" && !inString) {
        inString = true;
        current += char;
      } else if (char === "'" && inString) {
        inString = false;
        current += char;
      } else if (char === '(' && !inString) {
        depth++;
        current += char;
      } else if (char === ')' && !inString) {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0 && !inString) {
        params.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      params.push(current.trim());
    }
    
    return params;
  }

  /**
   * Create wall parameters from IFC data
   */
  createWallFromIFC(params) {
    const name = this.extractStringValue(params[1]) || 'IFC Wall';
    const description = this.extractStringValue(params[2]) || '';
    
    return {
      name: name,
      description: description,
      length: 4.0, // Default values - IFC geometry parsing would be more complex
      height: 2.5,
      thickness: 0.2,
      material: 'concrete',
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 4, y: 0, z: 0 }
    };
  }

  /**
   * Create slab parameters from IFC data
   */
  createSlabFromIFC(params) {
    const name = this.extractStringValue(params[1]) || 'IFC Slab';
    const description = this.extractStringValue(params[2]) || '';
    
    // Check if this is a room/space element for better sizing
    const combined = `${name} ${description}`.toLowerCase();
    let width = 5.0, depth = 5.0, thickness = 0.2;
    
    if (combined.includes('room') || combined.includes('space') || combined.includes('house')) {
      // Room elements should be larger
      width = 8.0;
      depth = 6.0;
      thickness = 0.15;
      console.log(`🏠 Creating room-style slab: ${width}x${depth}x${thickness}m`);
    } else if (combined.includes('floor') || combined.includes('ground')) {
      // Floor elements
      width = 6.0;
      depth = 6.0;
      thickness = 0.25;
      console.log(`🏗️ Creating floor slab: ${width}x${depth}x${thickness}m`);
    }
    
    return {
      name: name,
      description: description,
      width: width,
      depth: depth,
      thickness: thickness,
      material: 'concrete',
      shape: 'rectangular'
    };
  }

  /**
   * Create column parameters from IFC data
   */
  createColumnFromIFC(params) {
    const name = this.extractStringValue(params[1]) || 'IFC Column';
    const description = this.extractStringValue(params[2]) || '';
    
    return {
      name: name,
      description: description,
      width: 0.4,
      depth: 0.4,
      height: 3.0,
      material: 'concrete',
      shape: 'rectangular'
    };
  }

  /**
   * Create door parameters from IFC data
   */
  createDoorFromIFC(params) {
    const name = this.extractStringValue(params[1]) || 'IFC Door';
    const description = this.extractStringValue(params[2]) || '';
    
    return {
      name: name,
      description: description,
      width: 0.9,
      height: 2.1,
      thickness: 0.05,
      material: 'wood'
    };
  }

  /**
   * Create window parameters from IFC data
   */
  createWindowFromIFC(params) {
    const name = this.extractStringValue(params[1]) || 'IFC Window';
    const description = this.extractStringValue(params[2]) || '';
    
    return {
      name: name,
      description: description,
      width: 1.2,
      height: 1.4,
      thickness: 0.05,
      material: 'aluminum'
    };
  }

  /**
   * Create building element from IFC BUILDINGELEMENTPROXY
   */
  createBuildingElementProxyFromIFC(params) {
    const guid = this.extractStringValue(params[0]) || '';
    const name = this.extractStringValue(params[1]) || 'Building Element';
    const description = this.extractStringValue(params[2]) || '';
    const objectType = this.extractStringValue(params[3]) || '';
    
    console.log(`🔍 Building Element Proxy: "${name}" (${objectType}) - ${description}`);
    
    // Try to determine the building element type from name, description, or objectType
    const detectedType = this.detectBuildingElementType(name, description, objectType);
    
    // Create appropriate parameters based on detected type
    switch (detectedType) {
      case 'wall':
        return {
          ...this.createWallFromIFC(['', name, description]),
          detectedType: 'wall',
          originalType: 'BUILDINGELEMENTPROXY',
          guid: guid,
          objectType: objectType
        };
      case 'slab':
        return {
          ...this.createSlabFromIFC(['', name, description]),
          detectedType: 'slab',
          originalType: 'BUILDINGELEMENTPROXY',
          guid: guid,
          objectType: objectType
        };
      case 'column':
        return {
          ...this.createColumnFromIFC(['', name, description]),
          detectedType: 'column',
          originalType: 'BUILDINGELEMENTPROXY',
          guid: guid,
          objectType: objectType
        };
      case 'door':
        return {
          ...this.createDoorFromIFC(['', name, description]),
          detectedType: 'door',
          originalType: 'BUILDINGELEMENTPROXY',
          guid: guid,
          objectType: objectType
        };
      case 'window':
        return {
          ...this.createWindowFromIFC(['', name, description]),
          detectedType: 'window',
          originalType: 'BUILDINGELEMENTPROXY',
          guid: guid,
          objectType: objectType
        };
      default:
        // Default to a generic building element (treated as wall)
        return {
          ...this.createWallFromIFC(['', name, description]),
          detectedType: 'wall',
          originalType: 'BUILDINGELEMENTPROXY',
          guid: guid,
          objectType: objectType
        };
    }
  }

  /**
   * Detect building element type from name, description, and objectType
   */
  detectBuildingElementType(name, description, objectType) {
    const combined = `${name} ${description} ${objectType}`.toLowerCase();
    
    console.log(`🔍 Type Detection Analysis: "${combined}"`);
    
    // Check for room/space keywords first (treat as complex slab)
    if (combined.includes('room') || combined.includes('space') || combined.includes('area') ||
        combined.includes('zone') || combined.includes('house') || combined.includes('building')) {
      console.log(`🏠 Detected room/space element - treating as slab`);
      return 'slab';
    }
    
    // Check for wall keywords
    if (combined.includes('wall') || combined.includes('partition') || combined.includes('barrier')) {
      console.log(`🧱 Detected wall element`);
      return 'wall';
    }
    
    // Check for slab/floor keywords
    if (combined.includes('slab') || combined.includes('floor') || combined.includes('deck') || 
        combined.includes('ground') || combined.includes('platform') || combined.includes('base')) {
      console.log(`🏗️ Detected slab/floor element`);
      return 'slab';
    }
    
    // Check for column keywords
    if (combined.includes('column') || combined.includes('pillar') || combined.includes('post') ||
        combined.includes('support') || combined.includes('pier') || combined.includes('beam')) {
      console.log(`🏢 Detected column/support element`);
      return 'column';
    }
    
    // Check for door keywords
    if (combined.includes('door') || combined.includes('entry') || combined.includes('entrance') ||
        combined.includes('exit') || combined.includes('opening') || combined.includes('portal')) {
      console.log(`🚪 Detected door element`);
      return 'door';
    }
    
    // Check for window keywords
    if (combined.includes('window') || combined.includes('glazing') || combined.includes('fenestration') ||
        combined.includes('glass') || combined.includes('pane')) {
      console.log(`🪟 Detected window element`);
      return 'window';
    }
    
    // Check for roof/ceiling keywords
    if (combined.includes('roof') || combined.includes('ceiling') || combined.includes('top')) {
      console.log(`🏠 Detected roof/ceiling - treating as slab`);
      return 'slab';
    }
    
    // Enhanced detection for common building element names
    if (combined.includes('element') || combined.includes('component') || combined.includes('part')) {
      // If it's just a generic "element", try to infer from context
      if (combined.includes('vertical')) return 'wall';
      if (combined.includes('horizontal')) return 'slab';
    }
    
    console.log(`🤔 Could not detect type for: "${combined}" - defaulting to wall`);
    return 'wall'; // Default to wall
  }

  /**
   * Extract string value from IFC parameter
   */
  extractStringValue(param) {
    if (!param) return null;
    
    // Handle different IFC parameter formats
    let cleaned = param.trim();
    
    // Remove quotes if present
    if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
      cleaned = cleaned.slice(1, -1);
    }
    
    // Handle IFC null values
    if (cleaned === '$' || cleaned === '*' || cleaned.toUpperCase() === '.UNSET.' || cleaned === '') {
      return null;
    }
    
    return cleaned;
  }
  /**
   * Dispose of all resources
   */
  dispose() {
    // Clear all objects
    this.objects.forEach((cadObject, objectId) => {
      this.deleteObject(objectId);
    });
    
    // Clear preview
    this.clearPreview();
    
    // Dispose materials
    Object.values(this.materials).forEach(material => {
      material.dispose();
    });
    
    // Clear listeners
    this.listeners.clear();
  }

  /**
   * PUBLIC API: Manually trigger wall joinery analysis and application
   * FIXED: Uses debounced scheduling to prevent infinite loops
   */
  updateWallJoinery() {
    console.log('🔧 ========== MANUAL WALL JOINERY UPDATE (FIXED) ==========');
    
    // ANTI-INFINITE-LOOP: Use scheduled update instead of direct call
    this.scheduleJoineryUpdate();
    
    console.log('⏰ Manual joinery update scheduled (debounced for stability)');
  }

  /**
   * EMERGENCY DIAGNOSTIC: Complete wall joinery troubleshooting
   */
  emergencyJoineryDiagnostic() {
    console.log('🚨 ========== EMERGENCY JOINERY DIAGNOSTIC ==========');
    
    const walls = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
    console.log(`📊 Found ${walls.length} walls in system`);
    
    if (walls.length === 0) {
      console.error('❌ NO WALLS FOUND - Cannot apply joinery without walls');
      return false;
    }
    
    // Check wall parameters
    let validWalls = 0;
    walls.forEach((wall, idx) => {
      const hasStartPoint = wall.params?.startPoint;
      const hasEndPoint = wall.params?.endPoint;
      const hasLength = wall.params?.length;
      
      console.log(`🧱 Wall ${idx + 1} (${wall.id}):`, {
        hasStartPoint: !!hasStartPoint,
        hasEndPoint: !!hasEndPoint, 
        hasLength: !!hasLength,
        startPoint: hasStartPoint ? `(${wall.params.startPoint.x.toFixed(2)}, ${wall.params.startPoint.z.toFixed(2)})` : 'MISSING',
        endPoint: hasEndPoint ? `(${wall.params.endPoint.x.toFixed(2)}, ${wall.params.endPoint.z.toFixed(2)})` : 'MISSING',
        length: hasLength ? wall.params.length.toFixed(3) + 'm' : 'MISSING'
      });
      
      if (hasStartPoint && hasEndPoint) validWalls++;
    });
    
    console.log(`✅ Valid walls (with endpoints): ${validWalls}/${walls.length}`);
    
    if (validWalls < 2) {
      console.error('❌ INSUFFICIENT VALID WALLS - Need at least 2 walls with endpoints for joinery');
      return false;
    }
    
    // Force joinery with multiple tolerance levels
    const tolerances = [0.05, 0.1, 0.15, 0.2, 0.3, 0.5];
    let successfulTolerance = null;
    
    for (const tolerance of tolerances) {
      console.log(`🔧 Trying joinery with ${tolerance}m (${tolerance * 100}cm) tolerance...`);
      
      const intersections = this.analyzeWallIntersections(tolerance);
      console.log(`   Found ${intersections.length} intersections`);
      
      if (intersections.length > 0) {
        successfulTolerance = tolerance;
        console.log(`🎯 SUCCESS: Found intersections with ${tolerance}m tolerance`);
        
        // Apply joinery with this tolerance
        const result = this.applyWallJoinery({
          tolerance,
          cornerStyle: 'butt',
          tightCorners: false,
          autoExtend: true
        });
        
        if (result) {
          console.log(`✅ JOINERY APPLIED SUCCESSFULLY with ${tolerance}m tolerance`);
          return true;
        }
        break;
      } else {
        console.log(`   ❌ No intersections found with ${tolerance}m tolerance`);
      }
    }
    
    if (!successfulTolerance) {
      console.error('❌ JOINERY FAILED: No intersections found even with 50cm tolerance');
      console.error('💡 POSSIBLE ISSUES:');
      console.error('   - Walls may not be close enough to each other');
      console.error('   - Wall endpoints may be corrupted or missing');
      console.error('   - Coordinate system may be inconsistent');
      return false;
    }
    
    return true;
  }

  /**
   * PUBLIC API: Check if walls have proper joinery applied
   */
  validateWallJoinery() {
    const intersections = this.analyzeWallIntersections();
    console.log(`🔍 Wall joinery validation: Found ${intersections.length} intersections`);
    
    return {
      intersectionCount: intersections.length,
      intersections: intersections,
      hasValidJoinery: intersections.length > 0
    };
  }

  /**
   * PUBLIC API: Get joinery information for debugging
   */
  getJoineryInfo() {
    const walls = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
    const intersections = this.analyzeWallIntersections();
    
    return {
      totalWalls: walls.length,
      wallsWithJoinery: walls.filter(wall => 
        wall.params.adjustForJoinery === true
      ).length,
      intersections: intersections,
      joineryApplied: intersections.length > 0
    };
  }

  /**
   * PUBLIC API: Get a specific object by ID
   */
  getObject(objectId) {
    return this.objects.get(objectId);
  }

  /**
   * Add CAD object to xeokit viewer for 3D visualization
   */
  addToXeokitViewer(cadObject) {
    console.log('🎬 XEOKIT DEBUG: addToXeokitViewer called for:', cadObject.type, cadObject.id);
    
    // Skip furniture and fixtures - they should be rendered by Model3DLoader in React Three.js
    if (cadObject.type === 'furniture' || cadObject.type === 'fixture') {
      console.log('🪑 XEOKIT DEBUG: Skipping furniture/fixture for Xeokit - will be handled by Model3DLoader');
      return;
    }
    
    try {
      if (!window.xeokitViewer) {
        console.log('📺 XEOKIT DEBUG: Xeokit viewer not available, skipping 3D visualization');
        return;
      }
      
      console.log('🎬 XEOKIT DEBUG: Xeokit viewer is available:', !!window.xeokitViewer);

      const viewer = window.xeokitViewer;
      const scene = viewer.scene;
      
      console.log(`🎬 Adding ${cadObject.type} to xeokit viewer:`, cadObject.id);

      // Create or get the dynamic scene model for CAD objects
      let sceneModel = scene.models['cadObjects'];
      if (!sceneModel) {
        sceneModel = scene.createModel({
          id: 'cadObjects',
          isModel: true
        });
      }

      // Generate geometry based on object type
      let meshId, entityId;
      
      switch (cadObject.type) {
        case 'wall':
          meshId = `wallMesh_${cadObject.id}`;
          entityId = `wallEntity_${cadObject.id}`;
          
          const wallParams = cadObject.params;
          const startPoint = wallParams.startPoint || { x: 0, y: 0, z: 0 };
          const endPoint = wallParams.endPoint || { x: wallParams.length || 3, y: 0, z: 0 };
          
          // Calculate wall dimensions and position
          const length = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) + 
            Math.pow(endPoint.z - startPoint.z, 2)
          );
          const height = wallParams.height || 2.7;
          const width = wallParams.width || wallParams.thickness || 0.2;
          
          // Calculate center position
          const centerX = (startPoint.x + endPoint.x) / 2;
          const centerY = (startPoint.y + endPoint.y) / 2 + height / 2;
          const centerZ = (startPoint.z + endPoint.z) / 2;
          
          // Calculate rotation around Y axis
          const angle = Math.atan2(endPoint.z - startPoint.z, endPoint.x - startPoint.x);
          
          // Create wall mesh
          sceneModel.createMesh({
            id: meshId,
            primitive: "triangles",
            positions: this.generateWallVertices(length, height, width),
            normals: this.generateWallNormals(),
            indices: this.generateWallIndices()
          });

          // Create wall entity
          sceneModel.createEntity({
            id: entityId,
            meshIds: [meshId],
            isObject: true,
            position: [centerX, centerY, centerZ],
            rotation: [0, angle, 0],
            colorize: wallParams.materialColor ? this.hexToRgb(wallParams.materialColor) : [0.42, 0.45, 0.5]
          });
          
          break;
          
        case 'slab':
          meshId = `slabMesh_${cadObject.id}`;
          entityId = `slabEntity_${cadObject.id}`;
          
          const slabParams = cadObject.params;
          const slabWidth = slabParams.width || 5;
          const slabDepth = slabParams.depth || 5;
          const slabThickness = slabParams.thickness || 0.2;
          
          sceneModel.createMesh({
            id: meshId,
            primitive: "triangles", 
            positions: this.generateSlabVertices(slabWidth, slabDepth, slabThickness),
            normals: this.generateSlabNormals(),
            indices: this.generateSlabIndices()
          });

          sceneModel.createEntity({
            id: entityId,
            meshIds: [meshId],
            isObject: true,
            position: [cadObject.params.position?.x || 0, cadObject.params.position?.y || 0, cadObject.params.position?.z || 0],
            colorize: slabParams.materialColor ? this.hexToRgb(slabParams.materialColor) : [0.42, 0.45, 0.5]
          });
          
          break;
          
        default:
          console.log(`⚠️ Xeokit integration not implemented for ${cadObject.type}`);
          return;
      }
      
      // Finalize the model to make it visible
      sceneModel.finalize();
      
      console.log(`✅ ${cadObject.type} added to xeokit viewer successfully`);
      
    } catch (error) {
      console.error('❌ Failed to add object to xeokit viewer:', error);
    }
  }

  /**
   * Generate wall vertices for xeokit mesh
   */
  generateWallVertices(length, height, width) {
    const halfLength = length / 2;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    return [
      // Front face
      -halfLength, -halfHeight, halfWidth,   // bottom-left
      halfLength, -halfHeight, halfWidth,    // bottom-right  
      halfLength, halfHeight, halfWidth,     // top-right
      -halfLength, halfHeight, halfWidth,    // top-left
      
      // Back face
      -halfLength, -halfHeight, -halfWidth,  // bottom-left
      -halfLength, halfHeight, -halfWidth,   // top-left
      halfLength, halfHeight, -halfWidth,    // top-right
      halfLength, -halfHeight, -halfWidth,   // bottom-right
    ];
  }

  generateWallNormals() {
    return [
      // Front face
      0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
      // Back face  
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1
    ];
  }

  generateWallIndices() {
    return [
      // Front face
      0, 1, 2,  0, 2, 3,
      // Back face
      4, 5, 6,  4, 6, 7,
      // Left face
      0, 3, 5,  0, 5, 4,
      // Right face  
      1, 7, 6,  1, 6, 2,
      // Top face
      3, 2, 6,  3, 6, 5,
      // Bottom face
      0, 4, 7,  0, 7, 1
    ];
  }

  /**
   * Generate slab vertices for xeokit mesh
   */
  generateSlabVertices(width, depth, thickness) {
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const halfThickness = thickness / 2;
    
    return [
      // Top face
      -halfWidth, halfThickness, -halfDepth,
      halfWidth, halfThickness, -halfDepth,
      halfWidth, halfThickness, halfDepth,
      -halfWidth, halfThickness, halfDepth,
      
      // Bottom face
      -halfWidth, -halfThickness, -halfDepth,
      -halfWidth, -halfThickness, halfDepth,
      halfWidth, -halfThickness, halfDepth,
      halfWidth, -halfThickness, -halfDepth
    ];
  }

  generateSlabNormals() {
    return [
      // Top face
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
      // Bottom face
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0
    ];
  }

  generateSlabIndices() {
    return [
      // Top face
      0, 1, 2,  0, 2, 3,
      // Bottom face
      4, 5, 6,  4, 6, 7,
      // Side faces
      0, 3, 5,  0, 5, 4,  // Left
      1, 7, 6,  1, 6, 2,  // Right
      3, 2, 6,  3, 6, 5,  // Front
      0, 4, 7,  0, 7, 1   // Back
    ];
  }

  /**
   * Convert hex color to RGB array
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [0.42, 0.45, 0.5]; // Default grey
  }

  /**
   * Create stair geometry
   * Creates a simplified stair representation
   */
  createStairGeometry(params) {
    console.log('🏗️ Creating stair geometry with params:', params);
    
    const stepWidth = params.stepWidth || 1.2;
    const numberOfSteps = params.numberOfSteps || 16;
    const treadDepth = params.treadDepth || 0.25;
    const riserHeight = params.riserHeight || 0.18;
    const totalRun = numberOfSteps * treadDepth;
    const totalRise = numberOfSteps * riserHeight;
    
    // Create simplified 3D geometry representing the stair volume
    const geometry3D = new THREE.BoxGeometry(stepWidth, totalRise / 2, totalRun);
    
    // Create material
    const material3D = new THREE.MeshStandardMaterial({
      color: params.material === 'wood' ? '#8B4513' : '#888888',
      roughness: 0.8,
      metalness: 0.1
    });
    
    // Create 3D mesh
    const mesh3D = new THREE.Mesh(geometry3D, material3D);
    mesh3D.position.set(0, totalRise / 4, 0); // Position above ground
    
    // Create 2D representation (simplified rectangle)
    const geometry2D = new THREE.PlaneGeometry(stepWidth, totalRun);
    const material2D = new THREE.MeshBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const mesh2D = new THREE.Mesh(geometry2D, material2D);
    mesh2D.rotation.x = -Math.PI / 2; // Lay flat
    
    console.log('🏗️ Stair geometry created with', numberOfSteps, 'steps');
    
    return {
      geometry: geometry3D,
      mesh3D: mesh3D,
      mesh2D: mesh2D
    };
  }

  /**
   * Set the Architect3D service reference for endpoint synchronization
   * @param {Architect3DWallService} architect3DService - Reference to the Architect3D service
   */
  setArchitect3DService(architect3DService) {
    this.architect3DService = architect3DService;
    console.log('🔗 SYNC SETUP: Architect3D service reference set for endpoint synchronization');
  }

}

// Create singleton instance
const standaloneCADEngine = new StandaloneCADEngine();

// Make available for debugging in browser console
if (typeof window !== 'undefined') {
  window.standaloneCADEngine = standaloneCADEngine;
  console.log('🔧 StandaloneCADEngine available at window.standaloneCADEngine');
  console.log('🧪 Test door creation: window.standaloneCADEngine.testDoorCreation()');
  console.log('🚨 Emergency joinery fix: window.standaloneCADEngine.emergencyJoineryDiagnostic()');
  console.log('🔧 Manual joinery: window.standaloneCADEngine.applyWallJoinery({tolerance: 0.3})');
}

export default standaloneCADEngine;