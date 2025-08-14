/**
 * Standalone CAD Engine
 * 
 * Independent CAD rendering and geometry management system
 * Replaces WebSocket-based FreeCAD integration with local Three.js rendering
 */

import * as THREE from 'three';
import { Door, Window } from '../models/BIMObjects.js';
import { CommandFactory } from '../commands/architecturalCommands.js';
import commandHistory from '../utils/commandHistory.js';

class StandaloneCADEngine {
  constructor() {
    this.objects = new Map(); // objectId -> CADObject
    this.nextObjectId = 1;
    this.listeners = new Map(); // event -> [callbacks]
    
    // Scene management
    this.scene3D = new THREE.Scene();
    this.scene2D = new THREE.Scene();
    
    // Enhanced materials - PROFESSIONAL CAD STYLE (matching 2D colors)
    this.materials = {
      // Core materials
      concrete: new THREE.MeshLambertMaterial({ color: 0x6b7280, roughness: 0.8 }), // Concrete grey
      tiles: new THREE.MeshLambertMaterial({ color: 0xf3f4f6, roughness: 0.3 }), // Ceramic tiles
      wood: new THREE.MeshLambertMaterial({ color: 0xd97706, roughness: 0.6 }), // Natural wood
      marble: new THREE.MeshLambertMaterial({ color: 0xf9fafb, roughness: 0.1, metalness: 0.1 }), // Polished marble
      granite: new THREE.MeshLambertMaterial({ color: 0x374151, roughness: 0.4 }), // Natural granite
      steel: new THREE.MeshLambertMaterial({ color: 0x64748b, roughness: 0.2, metalness: 0.8 }), // Steel deck
      carpet: new THREE.MeshLambertMaterial({ color: 0x8b5cf6, roughness: 0.9 }), // Soft carpet
      vinyl: new THREE.MeshLambertMaterial({ color: 0x10b981, roughness: 0.5 }), // Vinyl flooring
      stone: new THREE.MeshLambertMaterial({ color: 0x6b7280, roughness: 0.7 }), // Natural stone
      precast: new THREE.MeshLambertMaterial({ color: 0x9ca3af, roughness: 0.6 }), // Precast concrete
      
      // Legacy materials for compatibility
      brick: new THREE.MeshLambertMaterial({ color: 0xd4a574, roughness: 0.7 }),
      aluminum: new THREE.MeshLambertMaterial({ color: 0xd6dde6, roughness: 0.3, metalness: 0.6 }),
      glass: new THREE.MeshLambertMaterial({ color: 0xf0f8ff, transparent: true, opacity: 0.4, roughness: 0.1 }),
      drywall: new THREE.MeshLambertMaterial({ color: 0xfafafa, roughness: 0.5 }),
      composite: new THREE.MeshLambertMaterial({ color: 0x8b7d6b, roughness: 0.6 }),
      upvc: new THREE.MeshLambertMaterial({ color: 0xf3f4f6, roughness: 0.4 }),
      fiberglass: new THREE.MeshLambertMaterial({ color: 0x6b7280, roughness: 0.5 }),
      pvc: new THREE.MeshLambertMaterial({ color: 0xf3f4f6, roughness: 0.4 }),
      
      // Special materials
      wireframe: new THREE.MeshBasicMaterial({ wireframe: true, color: 0x00ff00 }),
      selected: new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.5 }),
      preview: new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.3 })
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
        
      case 'wall':
        console.log('🧱 WALL GEOMETRY DEBUG: Creating wall geometry...');
        console.log('🧱 WALL GEOMETRY DEBUG: Wall params received:', params);
        
        const wallResult = this.createWallGeometry(params);
        geometry = wallResult.geometry;
        mesh3D = wallResult.mesh3D;
        mesh2D = wallResult.mesh2D;
        
        console.log('🧱 WALL GEOMETRY DEBUG: Wall geometry created successfully');
        console.log('🧱 WALL GEOMETRY DEBUG: 3D mesh position:', mesh3D.position);
        console.log('🧱 WALL GEOMETRY DEBUG: Geometry type:', geometry?.type);
        break;
        
      case 'door':
        console.log('🚪 Creating door geometry...');
        const doorResult = this.createDoorGeometry(params);
        geometry = doorResult.geometry;
        mesh3D = doorResult.mesh3D;
        mesh2D = doorResult.mesh2D;
        console.log('🚪 Door geometry created, position:', mesh3D.position);
        break;
        
      case 'window':
        console.log('🪟 Creating window geometry...');
        const windowResult = this.createWindowGeometry(params);
        geometry = windowResult.geometry;
        mesh3D = windowResult.mesh3D;
        mesh2D = windowResult.mesh2D;
        console.log('🪟 Window geometry created, position:', mesh3D.position);
        break;
        
      case 'column':
        console.log('🏢 Creating column geometry...');
        const columnResult = this.createColumnGeometry(params);
        geometry = columnResult.geometry;
        mesh3D = columnResult.mesh3D;
        mesh2D = columnResult.mesh2D;
        console.log('🏢 Column geometry created, position:', mesh3D.position);
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
        console.warn(`Unknown object type: ${type}`);
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
      
      // Use a debounced joinery call to prevent multiple simultaneous attempts
      this.scheduleJoineryUpdate();
    }
    
    return objectId;
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
      const result = this.applyWallJoinery();
      
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
   * Create slab geometry and meshes
   */
  createSlabGeometry(params) {
    console.log('🏗️ SLAB CREATION DEBUG: createSlabGeometry called with params:', params);
    
    const { 
      width = 5, 
      depth = 5, 
      thickness = 0.2, 
      material = 'concrete', 
      shape = 'rectangular',
      startPoint = null,
      endPoint = null
    } = params;
    
    // Calculate actual dimensions and position if start/end points are provided
    let actualWidth = width;
    let actualDepth = depth;
    let centerPosition = { x: 0, y: thickness / 2, z: 0 };
    
    if (startPoint && endPoint) {
      actualWidth = Math.abs(endPoint.x - startPoint.x);
      actualDepth = Math.abs(endPoint.z - startPoint.z);
      centerPosition = {
        x: (startPoint.x + endPoint.x) / 2,
        y: thickness / 2, // Half thickness above ground
        z: (startPoint.z + endPoint.z) / 2
      };
    }
    
    let geometry;
    
    if (shape === 'circular') {
      // Circular slab
      const radius = Math.min(actualWidth, actualDepth) / 2;
      geometry = new THREE.CylinderGeometry(radius, radius, thickness, 32);
    } else {
      // Rectangular slab (default)
      geometry = new THREE.BoxGeometry(actualWidth, thickness, actualDepth);
    }
    
    // Get material
    const mat = this.materials[material] || this.materials.concrete;
    
    // Create 3D mesh
    const mesh3D = new THREE.Mesh(geometry, mat.clone());
    mesh3D.userData = { objectId: null, type: 'slab' }; // Will be set by caller
    
    // Set position
    mesh3D.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    
    // Create 2D representation (top-down view for slab)
    const geometry2D = new THREE.PlaneGeometry(actualWidth, actualDepth);
    const material2D = new THREE.MeshBasicMaterial({ 
      color: mat.color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const mesh2D = new THREE.Mesh(geometry2D, material2D);
    mesh2D.rotation.x = -Math.PI / 2; // Lay flat for top-down view
    mesh2D.userData = { objectId: null, type: 'slab' }; // Will be set by caller
    
    // Set position for 2D mesh
    mesh2D.position.set(centerPosition.x, 0, centerPosition.z);
    
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
      skipJoinery = false      // Skip joinery adjustments (for property updates)
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
        console.log(`🔧 WALL UPDATE: Adjusting wall length from ${calculatedLength.toFixed(2)}m to ${length.toFixed(2)}m`);
        
        // Calculate direction unit vector
        const dirX = deltaX / calculatedLength;
        const dirZ = deltaZ / calculatedLength;
        
        // Adjust endPoint to match the desired length
        adjustedEndPoint = {
          x: adjustedStartPoint.x + (dirX * length),
          y: adjustedStartPoint.y,
          z: adjustedStartPoint.z + (dirZ * length)
        };
        
        console.log(`🔧 WALL UPDATE: Adjusted endPoint from [${deltaX.toFixed(2)}, ${deltaZ.toFixed(2)}] to [${(dirX * length).toFixed(2)}, ${(dirZ * length).toFixed(2)}]`);
        
        // Use the desired length
        originalLength = length;
        rotationY = Math.atan2(dirZ, dirX);
      } else {
        // Use calculated length from points
        originalLength = calculatedLength;
        rotationY = Math.atan2(deltaZ, deltaX);
      }
      
      // Apply joinery adjustments by modifying the actual start and end points (skip for property updates)
      if (adjustForJoinery && (startAdjustment > 0 || endAdjustment > 0) && !shouldSkipJoinery) {
        console.log(`🔧 Applying CAD joinery adjustments: start=${startAdjustment}, end=${endAdjustment}`);
        
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
        
        // Recalculate based on adjusted points
        const adjustedDeltaX = adjustedEndPoint.x - adjustedStartPoint.x;
        const adjustedDeltaZ = adjustedEndPoint.z - adjustedStartPoint.z;
        actualLength = Math.sqrt(adjustedDeltaX * adjustedDeltaX + adjustedDeltaZ * adjustedDeltaZ);
        
        // Center position is at the center of the adjusted wall
        centerPosition = {
          x: (adjustedStartPoint.x + adjustedEndPoint.x) / 2,
          y: height / 2,
          z: (adjustedStartPoint.z + adjustedEndPoint.z) / 2
        };
        
        console.log(`🔧 Wall adjusted: ${originalLength.toFixed(2)}m → ${actualLength.toFixed(2)}m`);
      } else {
        // Standard center position using adjusted points
        actualLength = originalLength;
        centerPosition = {
          x: (adjustedStartPoint.x + adjustedEndPoint.x) / 2,
          y: height / 2,
          z: (adjustedStartPoint.z + adjustedEndPoint.z) / 2
        };
      }
    }
    
    // Create standard wall geometry (vertical box) - always use BoxGeometry for reliability
    const geometry = new THREE.BoxGeometry(actualLength, height, thickness);
    
    // Get material
    const mat = this.materials[material] || this.materials.concrete;
    
    // Create 3D mesh
    const mesh3D = new THREE.Mesh(geometry, mat.clone());
    mesh3D.userData = { objectId: null, type: 'wall' };
    
    // Set position and rotation
    mesh3D.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    if (rotationY !== 0) {
      mesh3D.rotation.y = rotationY;
    }
    
    // Create 2D representation - ARCHITECTURAL FLOOR PLAN STYLE
    const mesh2D = this.createArchitecturalWall2D(actualLength, thickness, centerPosition, rotationY, material);
    mesh2D.userData = { objectId: null, type: 'wall' };
    
    return {
      geometry: geometry,
      mesh3D: mesh3D,
      mesh2D: mesh2D,
      actualLength: actualLength,
      adjustedStartPoint: adjustedStartPoint,
      adjustedEndPoint: adjustedEndPoint
    };
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
        tolerance: 0.25,        // 25cm tolerance for much easier connections (increased due to user frustration)
        cornerStyle: 'butt',    // butt, miter, overlap
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
    
    // Group intersections by position to handle multiple walls meeting at one point
    const intersectionGroups = this.groupIntersectionsByPosition(intersections);
    
    intersectionGroups.forEach((group, groupIndex) => {
        console.log(`🏗️ PROCESSING: Intersection group ${groupIndex + 1} with ${group.length} walls`);
      
      if (group.length === 2) {
        // Two walls meeting - create proper corner joint
          console.log(`🔨 CORNER: Creating corner joint for group ${groupIndex + 1}`);
          this.createCornerJoint(group[0], settings);
      } else if (group.length > 2) {
        // Multiple walls meeting - create T-junction or cross
          console.log(`🔧 MULTI: Creating multi-wall joint for group ${groupIndex + 1}`);
          this.createMultiWallJoint(group, settings);
        }
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
    
    // Get the actual thickness of the through wall
    const throughWallThickness = throughWall.params.thickness || throughWall.params.width || 0.2;
    
    // The butt wall is shortened by half the through wall's thickness
    // This creates a proper architectural butt joint where walls meet at their centerlines
    const adjustment = throughWallThickness / 2;
    
    console.log(`🔧 Using through wall thickness: ${throughWallThickness}m, adjustment: ${adjustment}m`);
    
    let startAdj = 0, endAdj = 0;
    if (buttConnection === 'start') {
      startAdj = adjustment;
    } else {
      endAdj = adjustment;
    }
    
    // Rebuild the butt wall with adjustment
    console.log(`🔧 BUTT JOINT: Applying adjustments to wall ${buttWall.id}:`, { startAdj, endAdj });
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
   */
  createOverlapJoint(wall1Obj, wall2Obj, connection, thickness) {
    console.log(`🔧 Creating overlap joint between ${wall1Obj.id} and ${wall2Obj.id}`);
    
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
    
    console.log(`🔧 Overlap joint: ${extendingWall.id} extends, ${shortenedWall.id} is shortened`);
    
    // The shortened wall is reduced by the full thickness of the extending wall
    const extendingWallThickness = extendingWall.params.thickness || extendingWall.params.width || 0.2;
    const adjustment = extendingWallThickness;
    
    console.log(`🔧 Using extending wall thickness: ${extendingWallThickness}m, adjustment: ${adjustment}m`);
    
    let startAdj = 0, endAdj = 0;
    if (shortenedConnection === 'start') {
      startAdj = adjustment;
    } else {
      endAdj = adjustment;
    }
    
    // Rebuild the shortened wall with adjustment
    console.log(`🔧 OVERLAP JOINT: Applying adjustments to wall ${shortenedWall.id}:`, { startAdj, endAdj });
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
  createDoorGeometry(params) {
    const { 
      width = 0.9, 
      height = 2.1, 
      thickness = 0.05, 
      material = 'wood',
      frameWidth = 0.05,
      openingDirection = 'right',
      startPoint = null,
      endPoint = null,
      hostWallId = null,
      insertionPosition = 0.5,
      insertionMode = 'create_standalone'
    } = params;
    
    // Calculate position
    let centerPosition = { x: 0, y: height / 2, z: 0 };
    let wallOrientation = 0;
    
    if (insertionMode === 'insert_in_wall' && hostWallId) {
      // Find the host wall
      const hostWall = this.objects.get(hostWallId);
      if (!hostWall) {
        console.warn(`Host wall ${hostWallId} not found for door insertion`);
        return this.createDoorGeometry({ ...params, insertionMode: 'create_standalone' });
      }
      
      // Calculate position along the wall
      const wallLength = hostWall.params.length || 3.0;
      const wallThickness = hostWall.params.thickness || 0.2;
      
      // Calculate insertion position along wall
      const distanceFromStart = insertionPosition * wallLength;
      
      // Get wall position and rotation
      const wallPos = hostWall.mesh3D.position;
      const wallRotation = hostWall.mesh3D.rotation.y || 0;
      wallOrientation = wallRotation;
      
      // Calculate door position based on wall geometry
      const cosRotation = Math.cos(wallRotation);
      const sinRotation = Math.sin(wallRotation);
      
      centerPosition = {
        x: wallPos.x + (distanceFromStart - wallLength / 2) * cosRotation,
        y: height / 2,
        z: wallPos.z + (distanceFromStart - wallLength / 2) * sinRotation
      };
      
      console.log(`🚪 Door positioned in wall ${hostWallId} at position ${insertionPosition} (${distanceFromStart.toFixed(1)}m from start)`);
      
      // Create wall opening
      this.createWallOpening(hostWallId, {
        type: 'door',
        width: width,
        height: height,
        position: distanceFromStart,
        offset: 0 // Doors typically start at floor level
      });
      
    } else if (startPoint && endPoint) {
      centerPosition = {
        x: (startPoint.x + endPoint.x) / 2,
        y: height / 2,
        z: (startPoint.z + endPoint.z) / 2
      };
    }
    
    // Create professional door geometry with proper frame and panels
    const doorGroup = new THREE.Group();
    
    // Get materials
    const doorMat = this.materials[material] || this.materials.wood;
    const frameMat = this.materials.wood ? this.materials.wood.clone() : doorMat.clone();
    frameMat.color = frameMat.color.clone().multiplyScalar(0.7); // Darker for frame
    
    // Professional door frame (jamb) - full size
    const frameDepth = Math.max(frameWidth, 0.05); // Minimum 5cm frame
    const jamberGeometry = new THREE.BoxGeometry(width + frameDepth * 2, height + frameDepth, frameDepth);
    const jamber = new THREE.Mesh(jamberGeometry, frameMat.clone());
    jamber.position.set(0, 0, -frameDepth/2);
    doorGroup.add(jamber);
    
    // Door panel (main door surface) - recessed into frame
    const panelGeometry = new THREE.BoxGeometry(width - 0.01, height - 0.01, thickness);
    const doorPanel = new THREE.Mesh(panelGeometry, doorMat.clone());
    doorPanel.position.set(0, 0, thickness/2 - frameDepth/2);
    doorGroup.add(doorPanel);
    
    // Door panels (classic 6-panel door style for wood)
    if (material === 'wood') {
      const panelInset = 0.005; // 5mm inset
      const panelThickness = thickness * 0.3;
      
      // Create 6 traditional door panels
      const panelConfigs = [
        { x: -width/4, y: height/3, w: width/2.5, h: height/4 },
        { x: width/4, y: height/3, w: width/2.5, h: height/4 },
        { x: -width/4, y: 0, w: width/2.5, h: height/4 },
        { x: width/4, y: 0, w: width/2.5, h: height/4 },
        { x: -width/4, y: -height/3, w: width/2.5, h: height/4 },
        { x: width/4, y: -height/3, w: width/2.5, h: height/4 }
      ];
      
      panelConfigs.forEach(config => {
        const smallPanelGeom = new THREE.BoxGeometry(config.w, config.h, panelThickness);
        const smallPanel = new THREE.Mesh(smallPanelGeom, doorMat.clone());
        smallPanel.position.set(config.x, config.y, thickness/2 - frameDepth/2 + panelInset);
        doorGroup.add(smallPanel);
      });
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
      geometry: panelGeometry, // Use panel geometry for reference
      mesh3D: mesh3D,
      mesh2D: mesh2D
    };
  }

  /**
   * Create window geometry and meshes
   */
  createWindowGeometry(params) {
    const { 
      width = 1.2, 
      height = 1.4, 
      thickness = 0.05, 
      material = 'aluminum',
      frameWidth = 0.05,
      glazingLayers = 2,
      startPoint = null,
      endPoint = null,
      hostWallId = null,
      insertionPosition = 0.5,
      insertionMode = 'create_standalone',
      sillHeight = 0.9
    } = params;
    
    // Calculate position
    let centerPosition = { x: 0, y: height / 2 + sillHeight, z: 0 }; 
    let wallOrientation = 0;
    
    if (insertionMode === 'insert_in_wall' && hostWallId) {
      // Find the host wall
      const hostWall = this.objects.get(hostWallId);
      if (!hostWall) {
        console.warn(`Host wall ${hostWallId} not found for window insertion`);
        return this.createWindowGeometry({ ...params, insertionMode: 'create_standalone' });
      }
      
      // Calculate position along the wall
      const wallLength = hostWall.params.length || 3.0;
      const wallThickness = hostWall.params.thickness || 0.2;
      
      // Calculate insertion position along wall
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
      
      console.log(`🪟 Window positioned in wall ${hostWallId} at position ${insertionPosition} (${distanceFromStart.toFixed(1)}m from start)`);
      
      // Create wall opening
      this.createWallOpening(hostWallId, {
        type: 'window',
        width: width,
        height: height,
        position: distanceFromStart,
        offset: sillHeight // Windows have a sill height offset
      });
      
    } else if (startPoint && endPoint) {
      centerPosition = {
        x: (startPoint.x + endPoint.x) / 2,
        y: height / 2 + sillHeight,
        z: (startPoint.z + endPoint.z) / 2
      };
    }
    
    // Create window frame geometry
    const frameGeometry = new THREE.BoxGeometry(width, height, thickness);
    
    // Get material
    const mat = this.materials[material] || this.materials.aluminum;
    
    // Create 3D mesh
    const mesh3D = new THREE.Mesh(frameGeometry, mat.clone());
    mesh3D.userData = { objectId: null, type: 'window' };
    mesh3D.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    
    // Apply wall orientation if inserted in wall
    if (insertionMode === 'insert_in_wall' && hostWallId) {
      mesh3D.rotation.y = wallOrientation;
    }
    
    // Create 2D representation (top-down view)
    const geometry2D = new THREE.PlaneGeometry(width, thickness);
    const material2D = new THREE.MeshBasicMaterial({ 
      color: mat.color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const mesh2D = new THREE.Mesh(geometry2D, material2D);
    mesh2D.userData = { objectId: null, type: 'window' };
    mesh2D.position.set(centerPosition.x, 0, centerPosition.z);
    
    // Apply wall orientation to 2D representation as well
    if (insertionMode === 'insert_in_wall' && hostWallId) {
      mesh2D.rotation.z = wallOrientation;
    }
    
    return {
      geometry: frameGeometry,
      mesh3D: mesh3D,
      mesh2D: mesh2D
    };
  }

  /**
   * Create column geometry and meshes
   */
  createColumnGeometry(params) {
    const { 
      width = 0.4, 
      depth = 0.4, 
      height = 3.0, 
      material = 'concrete',
      shape = 'rectangular', // 'rectangular', 'circular'
      startPoint = null,
      endPoint = null
    } = params;
    
    // Calculate position
    let centerPosition = { x: 0, y: height / 2, z: 0 };
    
    if (startPoint && endPoint) {
      centerPosition = {
        x: (startPoint.x + endPoint.x) / 2,
        y: height / 2,
        z: (startPoint.z + endPoint.z) / 2
      };
    }
    
    let geometry;
    
    if (shape === 'circular') {
      // Circular column
      const radius = Math.min(width, depth) / 2;
      geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    } else {
      // Rectangular column (default)
      geometry = new THREE.BoxGeometry(width, height, depth);
    }
    
    // Get material
    const mat = this.materials[material] || this.materials.concrete;
    
    // Create 3D mesh
    const mesh3D = new THREE.Mesh(geometry, mat.clone());
    mesh3D.userData = { objectId: null, type: 'column' };
    mesh3D.position.set(centerPosition.x, centerPosition.y, centerPosition.z);
    
    // Create 2D representation (top-down view)
    const geometry2D = shape === 'circular' 
      ? new THREE.CircleGeometry(Math.min(width, depth) / 2, 16)
      : new THREE.PlaneGeometry(width, depth);
    const material2D = new THREE.MeshBasicMaterial({ 
      color: mat.color, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const mesh2D = new THREE.Mesh(geometry2D, material2D);
    mesh2D.userData = { objectId: null, type: 'column' };
    mesh2D.position.set(centerPosition.x, 0, centerPosition.z);
    
    return {
      geometry: geometry,
      mesh3D: mesh3D,
      mesh2D: mesh2D
    };
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
      position = { x: 0, y: 0, z: 0 }
    } = params;
    
    // Create 3D geometry based on furniture type
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
    console.log(`📦 getAllObjects called - objects map size: ${this.objects.size}`);
    const objectArray = Array.from(this.objects.values());
    console.log(`📦 Raw objects:`, objectArray.map(obj => ({id: obj.id, type: obj.type})));
    const serialized = objectArray.map(obj => this.serializeObject(obj));
    console.log(`📦 Serialized objects:`, serialized.length);
    return serialized;
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
      // Add computed properties for compatibility
      position: cadObject.mesh3D ? {
        x: cadObject.mesh3D.position.x,
        y: cadObject.mesh3D.position.y,
        z: cadObject.mesh3D.position.z
      } : { x: 0, y: 0, z: 0 },
      // Add rotation information for 2D rendering
      rotation: cadObject.mesh3D ? cadObject.mesh3D.rotation.y : 0
    };
    
    console.log(`✅ SERIALIZE DEBUG: Serialized object ${cadObject.id}:`, {
      hasParams: !!serialized.params,
      paramsInSerialized: serialized.params
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
}

// Export singleton instance
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