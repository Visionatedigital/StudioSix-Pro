import { Vector2 } from 'three';
import { Wall } from './architect3d/model/Wall.js';
import { Corner } from './architect3d/model/Corner.js';
import { WallTypes } from './architect3d/core/constants.js';
import { Utils } from './architect3d/core/utils.js';
import { Configuration, configWallThickness, configWallHeight, cornerTolerance } from './architect3d/core/configuration.js';
import standaloneCADEngine from './StandaloneCADEngine';

/**
 * Enhanced Wall Service with Architect3D's Corner/Joinery Logic
 * Provides sophisticated wall creation, corner detection, and room formation capabilities
 */
export class Architect3DWallService {
  constructor() {
    // Active walls, corners, and rooms
    this.walls = [];
    this.corners = [];
    this.rooms = [];
    
    // Event listeners
    this.listeners = {
      wallAdded: [],
      wallUpdated: [],
      wallRemoved: [],
      cornerAdded: [],
      cornerMoved: [],
      roomCreated: [],
      roomUpdated: []
    };

    // Configuration
    // Convert UI/pixel tolerance to world meters if needed (assume 100 px = 1 m)
    const defaultCornerToleranceMeters = (typeof cornerTolerance === 'number')
      ? (cornerTolerance > 1 ? cornerTolerance / 100 : cornerTolerance)
      : 0.05; // fallback 5 cm

    this.config = {
      snapToAxis: true,
      autoMergeCorners: true,
      cornerTolerance: Math.max(0.02, Math.min(0.25, defaultCornerToleranceMeters)), // clamp 2–25 cm
      wallThickness: Configuration.getNumericValue(configWallThickness),
      wallHeight: Configuration.getNumericValue(configWallHeight)
    };

    // Preview/guide settings  
    this.axisSnapToleranceDeg = 35; // degrees (more aggressive for easier snapping)
    this.guideTolerance = 0.05; // 5 cm alignment tolerance

    console.log('🏗️ Architect3DWallService initialized with enhanced corner/joinery logic');
  }

  /**
   * Update service configuration (can be called by wall tool)
   * @param {Object} config - Configuration updates
   */
  updateConfiguration(config) {
    if (config.snapToAxis !== undefined) {
      this.config.snapToAxis = config.snapToAxis;
      if (this.debug) console.log('🔧 Updated snapToAxis:', config.snapToAxis);
    }
    if (config.axisSnapToleranceDeg !== undefined) {
      this.axisSnapToleranceDeg = config.axisSnapToleranceDeg;
      if (this.debug) console.log('🔧 Updated axisSnapToleranceDeg:', config.axisSnapToleranceDeg);
    }
    if (config.cornerTolerance !== undefined) {
      this.config.cornerTolerance = config.cornerTolerance;
      if (this.debug) console.log('🔧 Updated cornerTolerance:', config.cornerTolerance);
    }
    if (config.autoMergeCorners !== undefined) {
      this.config.autoMergeCorners = config.autoMergeCorners;
      if (this.debug) console.log('🔧 Updated autoMergeCorners:', config.autoMergeCorners);
    }
  }

  /**
   * Create a new wall with advanced corner logic
   * @param {Object} params - Wall creation parameters
   * @returns {Object} Created wall object
   */
  createWall(params) {
    if (this.debug) console.log('🧱 Creating wall with advanced corner logic:', params);

    const {
      startPoint,
      endPoint,
      wallType = 'straight',
      thickness = this.config.wallThickness,
      height = this.config.wallHeight,
      material = 'concrete',
      enableAutoMerge = true,
      bezierControlPoints = null
    } = params;

    try {
      // Find or create corners at start and end points
      const startCorner = this.findOrCreateCorner(startPoint, enableAutoMerge);
      const endCorner = this.findOrCreateCorner(endPoint, enableAutoMerge);

      // Prevent zero-length or identical-corner walls
      const sameCorner = startCorner && endCorner && startCorner.id === endCorner.id;
      const distance = startCorner && endCorner ? Utils.distance(startCorner.location, endCorner.location) : Infinity;
      if (sameCorner || distance < 1e-6) {
        console.warn('🚫 Skipping wall creation: start and end coincide or are too close', {
          sameCorner,
          distance
        });
        return null;
      }

      // Prevent duplicate walls between the same pair of corners (in any order)
      const existing = this.walls.find(w => {
        const a = w.getStart().id;
        const b = w.getEnd().id;
        return (a === startCorner.id && b === endCorner.id) || (a === endCorner.id && b === startCorner.id);
      });
      if (existing) {
        console.warn('⚠️ Duplicate wall prevented. Returning existing wall object.');
        return this.wallToObject(existing);
      }

      // Create wall with architect3d logic
      const wall = this.createWallBetweenCorners(startCorner, endCorner, {
        wallType: wallType === 'curved' ? WallTypes.CURVED : WallTypes.STRAIGHT,
        thickness,
        height,
        material,
        bezierControlPoints
      });

      // Update room detection
      this.updateRoomDetection();

      // Notify listeners
      this.notifyListeners('wallAdded', { wall, corners: [startCorner, endCorner] });

      if (this.debug) console.log('✅ Wall created successfully with ID:', wall.id);
      // Mirror to CAD engine so walls render in 2D/3D unified
      try {
        const wallParamsForCAD = {
          startPoint: { x: startCorner.location.x, y: 0, z: startCorner.location.y },
          endPoint: { x: endCorner.location.x, y: 0, z: endCorner.location.y },
          thickness: (this.config.wallThickness || 20) / 100, // cm → m
          height: (this.config.wallHeight || 270) / 100,       // cm → m
          material: material,
          length: wall.wallLength(),
          autoExtend: false
        };
        // Targeted debug for 2D→3D sync
        console.log('WALL_MIRROR', {
          id: wall.id,
          worldStart: wallParamsForCAD.startPoint,
          worldEnd: wallParamsForCAD.endPoint,
          lengthM: wallParamsForCAD.length,
          thicknessM: wallParamsForCAD.thickness,
          heightM: wallParamsForCAD.height
        });
        standaloneCADEngine.createObject('wall', wallParamsForCAD);
      } catch (cadError) {
        console.warn('⚠️ Failed to mirror wall to CAD engine:', cadError);
      }

      return {
        id: wall.id,
        type: 'wall',
        startPoint: startCorner.location,
        endPoint: endCorner.location,
        length: wall.wallLength(),
        thickness: wall.thickness,
        height: wall.height,
        wallType: wallType,
        material: material,
        corners: [startCorner.id, endCorner.id]
      };

    } catch (error) {
      console.error('❌ Failed to create wall:', error);
      throw error;
    }
  }

  /**
   * Find existing corner or create new one with intelligent merging
   * @param {Vector2} point - Point to find/create corner at
   * @param {Boolean} enableAutoMerge - Whether to enable auto-merging
   * @returns {Corner} Corner instance
   */
  findOrCreateCorner(point, enableAutoMerge = true) {
    if (this.debug) console.log('🔍 Finding or creating corner at:', point);

    // Check if there's an existing corner within tolerance
    if (enableAutoMerge) {
      const existingCorner = this.findNearbyCorner(point, this.config.cornerTolerance);
      if (existingCorner) {
        console.log('📍 Found existing corner:', existingCorner.id);
        return existingCorner;
      }
    }

    // Create new corner
    const corner = new Corner(this, point.x, point.y);
    this.corners.push(corner);
    
    console.log('✨ Created new corner:', corner.id);
    this.notifyListeners('cornerAdded', { corner });
    
    return corner;
  }

  /**
   * Find nearby corner within tolerance
   * @param {Vector2} point - Search point
   * @param {Number} tolerance - Search tolerance
   * @returns {Corner|null} Found corner or null
   */
  findNearbyCorner(point, tolerance) {
    // Add null safety check
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
      console.warn('⚠️ findNearbyCorner: Invalid point provided:', point);
      return null;
    }

    if (this.debug) console.log('🔍 findNearbyCorner: Searching for corner near', point, 'with tolerance', tolerance);
    if (this.debug) console.log('🔍 Available corners:', this.corners.length);

    for (const corner of this.corners) {
      if (!corner || !corner.location) {
        console.warn('⚠️ Invalid corner found:', corner);
        continue;
      }
      
      try {
        const distance = corner.distanceFrom(point);
        if (this.debug) console.log('🔍 Corner', corner.id, 'distance:', distance);
        
        if (distance < tolerance) {
          if (this.debug) console.log('✅ Found nearby corner:', corner.id);
          return corner;
        }
      } catch (error) {
        console.error('❌ Error calculating distance for corner:', corner.id, error);
      }
    }
    
    console.log('🔍 No nearby corner found');
    return null;
  }

  /**
   * Create wall between two corners
   * @param {Corner} startCorner - Start corner
   * @param {Corner} endCorner - End corner
   * @param {Object} options - Wall options
   * @returns {Wall} Created wall
   */
  createWallBetweenCorners(startCorner, endCorner, options) {
    const {
      wallType = WallTypes.STRAIGHT,
      thickness = this.config.wallThickness,
      height = this.config.wallHeight,
      material = 'concrete',
      bezierControlPoints = null
    } = options;

    // Create wall with bezier control points for curved walls
    let wall;
    if (wallType === WallTypes.CURVED && bezierControlPoints) {
      wall = new Wall(startCorner, endCorner, bezierControlPoints.a, bezierControlPoints.b);
    } else {
      wall = new Wall(startCorner, endCorner);
    }

    // Set wall properties
    wall.thickness = thickness;
    wall.height = height;
    wall.material = material;
    wall.wallType = wallType;

    this.walls.push(wall);
    return wall;
  }

  /**
   * Update existing wall with enhanced logic
   * @param {String} wallId - Wall ID to update
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated wall object
   */
  updateWall(wallId, updates) {
    console.log('🔧 Updating wall:', wallId, updates);

    const wall = this.findWallById(wallId);
    if (!wall) {
      throw new Error(`Wall not found: ${wallId}`);
    }

    try {
      // Update basic properties
      if (updates.thickness !== undefined) {
        wall.thickness = updates.thickness;
      }
      if (updates.height !== undefined) {
        wall.height = updates.height;
      }
      if (updates.material !== undefined) {
        wall.material = updates.material;
      }

      // Handle wall type changes
      if (updates.wallType !== undefined) {
        const newWallType = updates.wallType === 'curved' ? WallTypes.CURVED : WallTypes.STRAIGHT;
        wall.wallType = newWallType;
      }

      // Handle length changes with intelligent corner movement
      if (updates.length !== undefined && updates.length !== wall.wallLength()) {
        this.resizeWall(wall, updates.length);
      }

      // Update room detection after changes
      this.updateRoomDetection();

      // Notify listeners
      this.notifyListeners('wallUpdated', { wall, updates });

      console.log('✅ Wall updated successfully');
      return this.wallToObject(wall);

    } catch (error) {
      console.error('❌ Failed to update wall:', error);
      throw error;
    }
  }

  /**
   * Resize wall intelligently based on connected walls
   * @param {Wall} wall - Wall to resize
   * @param {Number} newLength - New length
   */
  resizeWall(wall, newLength) {
    // Use architect3d's intelligent wall sizing logic
    wall.wallSize = newLength;
  }

  /**
   * Detect and create rooms from connected walls
   */
  updateRoomDetection() {
    if (this.debug) console.log('🏠 Updating room detection...');
    
    // Clear existing rooms
    this.rooms = [];

    // Find closed wall loops using corner connectivity
    const roomPolygons = this.findClosedWallLoops();
    
    for (const polygon of roomPolygons) {
      const room = this.createRoomFromPolygon(polygon);
      if (room) {
        this.rooms.push(room);
        this.notifyListeners('roomCreated', { room });
      }
    }

    if (this.debug) console.log(`🏠 Detected ${this.rooms.length} rooms`);
  }

  /**
   * Find closed loops of connected walls
   * @returns {Array} Array of room polygons
   */
  findClosedWallLoops() {
    const visitedWalls = new Set();
    const roomPolygons = [];

    for (const wall of this.walls) {
      if (visitedWalls.has(wall.id)) continue;

      const loop = this.traceWallLoop(wall, visitedWalls);
      if (loop && loop.length >= 3) {
        roomPolygons.push(loop);
      }
    }

    return roomPolygons;
  }

  /**
   * Trace a loop of connected walls starting from given wall
   * @param {Wall} startWall - Starting wall
   * @param {Set} visitedWalls - Set of visited wall IDs
   * @returns {Array} Array of corner positions forming the loop
   */
  traceWallLoop(startWall, visitedWalls) {
    const loop = [];
    let currentWall = startWall;
    let currentCorner = startWall.getStart();
    
    const startCorner = currentCorner;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops

    do {
      if (iterations++ > maxIterations) break;
      
      loop.push(currentCorner.location.clone());
      visitedWalls.add(currentWall.id);

      // Find next wall connected to current corner
      const nextCorner = currentWall.oppositeCorner(currentCorner);
      if (!nextCorner) break;

      const nextWalls = nextCorner.wallStarts.concat(nextCorner.wallEnds)
                                             .filter(w => w !== currentWall && !visitedWalls.has(w.id));
      
      if (nextWalls.length === 0) break;

      currentWall = nextWalls[0]; // Take first available wall
      currentCorner = nextCorner;

    } while (currentCorner !== startCorner && iterations < maxIterations);

    return currentCorner === startCorner && loop.length >= 3 ? loop : null;
  }

  /**
   * Create room from polygon
   * @param {Array} polygon - Array of corner positions
   * @returns {Object} Room object
   */
  createRoomFromPolygon(polygon) {
    if (polygon.length < 3) return null;

    const area = Utils.polygonArea(polygon);
    const center = this.calculatePolygonCenter(polygon);

    const room = {
      id: Utils.guide(),
      type: 'room',
      polygon: polygon,
      area: area,
      center: center,
      perimeter: this.calculatePolygonPerimeter(polygon)
    };

    return room;
  }

  /**
   * Calculate polygon center (centroid)
   * @param {Array} polygon - Polygon vertices
   * @returns {Vector2} Center point
   */
  calculatePolygonCenter(polygon) {
    let x = 0, y = 0;
    for (const point of polygon) {
      x += point.x;
      y += point.y;
    }
    return new Vector2(x / polygon.length, y / polygon.length);
  }

  /**
   * Calculate polygon perimeter
   * @param {Array} polygon - Polygon vertices
   * @returns {Number} Perimeter length
   */
  calculatePolygonPerimeter(polygon) {
    let perimeter = 0;
    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      perimeter += Utils.distance(current, next);
    }
    return perimeter;
  }

  /**
   * Find wall by ID
   * @param {String} wallId - Wall ID
   * @returns {Wall|null} Wall or null
   */
  findWallById(wallId) {
    return this.walls.find(wall => wall.id === wallId) || null;
  }

  /**
   * Convert wall to plain object
   * @param {Wall} wall - Wall instance
   * @returns {Object} Wall object
   */
  wallToObject(wall) {
    return {
      id: wall.id,
      type: 'wall',
      startPoint: wall.getStart().location,
      endPoint: wall.getEnd().location,
      length: wall.wallLength(),
      thickness: wall.thickness,
      height: wall.height,
      wallType: wall.wallType === WallTypes.CURVED ? 'curved' : 'straight',
      material: wall.material,
      corners: [wall.getStart().id, wall.getEnd().id]
    };
  }

  /**
   * Get all walls
   * @returns {Array} Array of wall objects
   */
  getWalls() {
    return this.walls.map(wall => this.wallToObject(wall));
  }

  /**
   * Get all corners
   * @returns {Array} Array of corner objects
   */
  getCorners() {
    return this.corners.map(corner => ({
      id: corner.id,
      type: 'corner',
      position: corner.location,
      elevation: corner.elevation,
      connectedWalls: corner.wallStarts.concat(corner.wallEnds).map(w => w.id),
      angles: corner.angles
    }));
  }

  /**
   * Get all rooms
   * @returns {Array} Array of room objects
   */
  getRooms() {
    return this.rooms;
  }

  /**
   * Remove wall and update corner connections
   * @param {String} wallId - Wall ID to remove
   */
  removeWall(wallId) {
    console.log('🗑️ Removing wall:', wallId);

    const wallIndex = this.walls.findIndex(wall => wall.id === wallId);
    if (wallIndex === -1) {
      throw new Error(`Wall not found: ${wallId}`);
    }

    const wall = this.walls[wallIndex];
    
    // Remove wall (this will also handle corner cleanup)
    wall.remove();
    
    // Remove from our array
    this.walls.splice(wallIndex, 1);

    // Update room detection
    this.updateRoomDetection();

    // Notify listeners
    this.notifyListeners('wallRemoved', { wallId });

    console.log('✅ Wall removed successfully');
  }

  /**
   * Add event listener
   * @param {String} event - Event name
   * @param {Function} callback - Callback function
   */
  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Remove event listener
   * @param {String} event - Event name
   * @param {Function} callback - Callback function
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
   * Notify event listeners
   * @param {String} event - Event name
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      }
    }
  }

  /**
   * Update configuration
   * @param {Object} config - Configuration updates
   */
  updateConfig(config) {
    Object.assign(this.config, config);
    
    // Update global configuration
    if (config.wallThickness) {
      Configuration.setValue(configWallThickness, config.wallThickness);
    }
    if (config.wallHeight) {
      Configuration.setValue(configWallHeight, config.wallHeight);
    }
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Clear all walls, corners, and rooms
   */
  clear() {
    console.log('🧹 Clearing all walls, corners, and rooms');
    
    this.walls = [];
    this.corners = [];
    this.rooms = [];
    
    console.log('✅ Architect3DWallService cleared');
  }

  // Floorplan interface methods (required by Corner class)
  getCorners() {
    return this.corners;
  }

  getWalls() {
    return this.walls;
  }

  newWall(startCorner, endCorner) {
    return this.createWallBetweenCorners(startCorner, endCorner, {});
  }

  update(redraw = true) {
    if (redraw) {
      this.updateRoomDetection();
    }
  }

  // Metadata for rooms (required by Corner class)
  metaroomsdata = {};

  /**
   * Start wall drawing mode
   */
  startWallDrawing() {
    console.log('🏗️ Architect3D Wall Drawing Mode Started');
    this.isDrawingMode = true;
    this.currentDrawingWall = null;
    
    // Emit drawing mode start event
    this.notifyListeners('drawingModeStarted', { mode: 'wall' });
  }

  /**
   * Stop wall drawing mode
   */
  stopWallDrawing() {
    console.log('🏗️ Architect3D Wall Drawing Mode Stopped');
    this.isDrawingMode = false;
    this.currentDrawingWall = null;
    
    // Emit drawing mode stop event
    this.notifyListeners('drawingModeStopped', { mode: 'wall' });
  }

  /**
   * Convert architect3d data to StudioSix format
   * @param {Object} data - Architect3D data (optional)
   * @returns {Object} StudioSix formatted data
   */
  toStudioSixFormat(data = null) {
    console.log('📄 toStudioSixFormat called with:', data);
    console.log('📄 Current walls:', this.walls.length);
    console.log('📄 Current corners:', this.corners.length);
    console.log('📄 Current rooms:', this.rooms.length);
    
    // Important: Do NOT use the Floorplan interface getWalls/getCorners here,
    // they return engine entities. We need plain data objects for rendering.
    // Exclude invalid/degenerate walls (start==end or ~zero length)
    const wallsData = this.walls
      .filter(w => {
        try {
          const s = w.getStart().location;
          const e = w.getEnd().location;
          return Utils.distance(s, e) > 1e-6;
        } catch (e) {
          return false;
        }
      })
      .map(wall => this.wallToObject(wall));
    const cornersData = this.corners.map(corner => ({
      id: corner.id,
      type: 'corner',
      // Architect3D Corner uses XY; our 2D renderer maps XZ, so keep XY here
      // and let the viewport convert to XZ when rendering
      position: corner.location,
      elevation: corner.elevation,
      connectedWalls: corner.wallStarts.concat(corner.wallEnds).map(w => w.id),
      angles: corner.angles
    }));
    const roomsData = this.rooms; // Already plain objects built via createRoomFromPolygon
    
    return {
      walls: wallsData,
      corners: cornersData,
      rooms: roomsData
    };
  }

  /**
   * Get current drawing state
   * @returns {Object} Drawing state
   */
  getDrawingState() {
    return {
      isDrawing: this.isDrawingMode || false,
      currentWall: this.currentDrawingWall,
      wallCount: this.walls.length,
      cornerCount: this.corners.length,
      roomCount: this.rooms.length
    };
  }

  /**
   * Handle mouse move events during wall drawing
   * @param {Object} event - Mouse event
   * @param {Object} position - World position
   */
  handleMouseMove(event, position) {
    if (this.debug) {
      console.log('🖱️ Architect3D handleMouseMove called with:', {
        event: event ? 'present' : 'null',
        position,
        isDrawingMode: this.isDrawingMode,
        currentDrawingWall: this.currentDrawingWall ? 'present' : 'null'
      });
    }

    if (!this.isDrawingMode) {
      console.log('🖱️ Not in drawing mode, ignoring mouse move');
      return;
    }

    // Add null safety check for position
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      console.warn('⚠️ handleMouseMove: Invalid position provided:', position);
      return;
    }

    if (this.debug) console.log('🖱️ Architect3D mouse move with valid position:', position);
    
    // Update current drawing wall preview
    if (this.currentDrawingWall && this.currentDrawingWall.startPoint) {
      let preview = position;
      // Enhanced axis snapping: 0°/45°/90°/135°/180°/225°/270°/315° relative to start point
      const start = this.currentDrawingWall.startPoint;
      const dx = position.x - start.x;
      const dy = position.y - start.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
      
      // Critical angles (90°, 270°) - vertical movement with very aggressive snapping  
      const verticalAngles = [90, 270];
      // Horizontal angles (0°, 180°) with very aggressive snapping
      const horizontalAngles = [0, 180]; 
      // Diagonal angles (45°, 135°, 225°, 315°) with moderate snapping  
      const diagonalAngles = [45, 135, 225, 315];
      
      // Ultra-aggressive snapping for vertical/horizontal as requested
      const verticalTolerance = Math.min(45, this.axisSnapToleranceDeg * 1.3); // Extra aggressive for vertical
      const horizontalTolerance = Math.min(45, this.axisSnapToleranceDeg * 1.3); // Extra aggressive for horizontal  
      const diagonalTolerance = Math.min(25, this.axisSnapToleranceDeg * 0.7); // 25 degrees max for diagonals
      
      let snapped = false;
      let snapAngle = null;
      
      // Only apply angle snapping if snapToAxis is enabled in config
      if (this.config.snapToAxis) {
        
        // Check vertical angles first (most aggressive - moving up/down)
        for (const a of verticalAngles) {
          const diff = Math.min(Math.abs(angleDeg - a), 360 - Math.abs(angleDeg - a));
          if (diff <= verticalTolerance || (event && event.shiftKey)) {
            snapAngle = a;
            snapped = true;
            break;
          }
        }
        
        // Check horizontal angles if no vertical snap (most aggressive - moving left/right)
        if (!snapped) {
          for (const a of horizontalAngles) {
            const diff = Math.min(Math.abs(angleDeg - a), 360 - Math.abs(angleDeg - a));
            if (diff <= horizontalTolerance || (event && event.shiftKey)) {
              snapAngle = a;
              snapped = true;
              break;
            }
          }
        }
        
        // Check diagonal angles if no cardinal snap (moderate snapping)
        if (!snapped) {
          for (const a of diagonalAngles) {
            const diff = Math.min(Math.abs(angleDeg - a), 360 - Math.abs(angleDeg - a));
            if (diff <= diagonalTolerance) {
              snapAngle = a;
              snapped = true;
              break;
            }
          }
        }
      }
      
      // Apply the snap if found
      if (snapped && snapAngle !== null) {
        const snapRad = (snapAngle * Math.PI) / 180;
        preview = {
          x: start.x + distance * Math.cos(snapRad),
          y: start.y + distance * Math.sin(snapRad)
        };
      }
      
      this.currentDrawingWall.previewEndPoint = preview;
      this.currentDrawingWall.isSnapped = snapped;
      this.currentDrawingWall.snapAngle = snapAngle;
      
      // Find nearby corners for snapping
      const nearbyCorner = this.findNearbyCorner(position, this.config.cornerTolerance);
      if (nearbyCorner) {
        console.log('🧲 Snapping to corner:', nearbyCorner.id);
        this.currentDrawingWall.previewEndPoint = nearbyCorner.location;
        this.currentDrawingWall.snapTarget = nearbyCorner;
      } else {
        this.currentDrawingWall.snapTarget = null;
      }

      // Compute guide lines: alignment with existing corner endpoints (orthogonal guides)
      const guides = [];
      for (const corner of this.corners) {
        const alignedX = Math.abs(preview.x - corner.location.x) <= this.guideTolerance;
        const alignedY = Math.abs(preview.y - corner.location.y) <= this.guideTolerance;
        if (alignedX || alignedY) {
          guides.push({ x: corner.location.x, y: corner.location.y, vertical: alignedX, horizontal: alignedY });
        }
      }

      // Emit preview update (with guides and snap flag)
      if (typeof window !== 'undefined' && window.A3D_DEBUG) {
        console.log('A3D_PREVIEW_EMIT', { start: this.currentDrawingWall.startPoint, end: this.currentDrawingWall.previewEndPoint, snapped, guides: guides.length });
      }
      this.notifyListeners('wallPreview', {
        // Provide explicit start/end for viewport preview rendering
        start: { x: this.currentDrawingWall.startPoint.x, y: this.currentDrawingWall.startPoint.y },
        end: { x: this.currentDrawingWall.previewEndPoint.x, y: this.currentDrawingWall.previewEndPoint.y },
        isValid: true,
        snapped,
        guides,
        snapTarget: this.currentDrawingWall.snapTarget
          ? { id: this.currentDrawingWall.snapTarget.id, position: this.currentDrawingWall.snapTarget.location }
          : null
      });
    }
  }

  /**
   * Handle mouse click events during wall drawing
   * @param {Object} event - Mouse event
   * @param {Object} position - World position
   */
  handleMouseClick(event, position) {
    console.log('🖱️ Architect3D handleMouseClick called with:', {
      event: event ? 'present' : 'null',
      position,
      isDrawingMode: this.isDrawingMode,
      currentDrawingWall: this.currentDrawingWall ? 'present' : 'null'
    });

    if (!this.isDrawingMode) {
      console.log('🖱️ Not in drawing mode, ignoring mouse click');
      return;
    }

    // Add null safety check for position
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      console.warn('⚠️ handleMouseClick: Invalid position provided:', position);
      return;
    }

    console.log('🖱️ Architect3D mouse click with valid position:', position);

    if (!this.currentDrawingWall) {
      // Start new wall
      this.currentDrawingWall = {
        startPoint: position,
        previewEndPoint: position,
        firstPoint: position,
        lastCommittedEnd: null,
        snapTarget: null
      };
      
      console.log('🏗️ Started new wall at:', position);
      this.notifyListeners('wallDrawingStarted', { startPoint: position });
      // Emit an initial preview so the UI can show a marker/zero-length segment immediately
      this.notifyListeners('wallPreview', {
        start: { x: position.x, y: position.y },
        end: { x: position.x, y: position.y },
        isValid: true,
        snapTarget: null
      });
    } else {
      // Complete current segment
      const endPoint = this.currentDrawingWall.snapTarget 
        ? this.currentDrawingWall.snapTarget.location 
        : position;

      try {
        // Create the wall using the enhanced service
        const wallParams = {
          startPoint: this.currentDrawingWall.startPoint,
          endPoint: endPoint,
          wallType: 'straight',
          thickness: this.config.wallThickness,
          height: this.config.wallHeight,
          enableAutoMerge: this.config.autoMergeCorners
        };

        console.log('🏗️ Creating wall with params:', wallParams);
        const wall = this.createWall(wallParams);
        console.log('🏗️ Completed wall:', wall);

        // Continuous drawing: start next segment from this end point
        this.currentDrawingWall.startPoint = endPoint;
        this.currentDrawingWall.previewEndPoint = endPoint;
        this.currentDrawingWall.lastCommittedEnd = endPoint;
        this.currentDrawingWall.snapTarget = null;

        // Auto-close if close to the first point
        const closeToFirst = Utils.distance(this.currentDrawingWall.firstPoint, endPoint) <= this.config.cornerTolerance;
        if (closeToFirst) {
          this.stopWallDrawing();
          this.notifyListeners('wallDrawingCompleted', { wall, closed: true });
          this.currentDrawingWall = null;
          return;
        }
        
        // Otherwise, keep drawing and emit preview anchor update
        this.notifyListeners('wallPreview', {
          start: { x: this.currentDrawingWall.startPoint.x, y: this.currentDrawingWall.startPoint.y },
          end: { x: this.currentDrawingWall.previewEndPoint.x, y: this.currentDrawingWall.previewEndPoint.y },
          isValid: true,
          snapTarget: null
        });
      } catch (error) {
        console.error('❌ Failed to create wall:', error);
        this.currentDrawingWall = null;
      }
    }
  }

  /**
   * Handle key press events (e.g., Escape to cancel)
   * @param {Object} event - Keyboard event
   */
  handleKeyPress(event) {
    if (!this.isDrawingMode) return;

    if (event.key === 'Escape') {
      console.log('🚫 Wall drawing cancelled');
      this.currentDrawingWall = null;
      this.stopWallDrawing();
      this.notifyListeners('wallDrawingCancelled', {});
    }
  }

  /**
   * Handle mouse double-click (finish wall sequence)
   * @param {Object} event - Mouse event
   * @param {Object} position - World position
   */
  handleMouseDoubleClick(event, position) {
    if (!this.isDrawingMode) return;

    console.log('🖱️ Architect3D double-click - finishing wall sequence');
    this.stopWallDrawing();
    this.notifyListeners('wallDrawingCompleted', {});
  }

  /**
   * Handle right-click (context menu/cancel)
   * @param {Object} event - Mouse event
   * @param {Object} position - World position
   */
  handleRightClick(event, position) {
    if (!this.isDrawingMode) return;

    console.log('🖱️ Architect3D right-click - cancelling current wall');
    this.currentDrawingWall = null;
    this.notifyListeners('wallDrawingCancelled', {});
  }

  /**
   * Handle click events (alias for handleMouseClick for compatibility)
   * @param {Object} position - World position
   * @returns {Boolean} Whether click was handled
   */
  handleClick(position) {
    console.log('🖱️ Architect3D handleClick called with:', position);
    
    // Add null safety check for position
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      console.warn('⚠️ handleClick: Invalid position provided:', position);
      return false;
    }
    
    if (!this.isDrawingMode) {
      console.log('🖱️ Not in drawing mode, ignoring click');
      return false;
    }

    // Use the existing handleMouseClick method
    this.handleMouseClick(null, position);
    return true;
  }

  /**
   * Sync adjusted endpoints from CAD engine back to Architect3D corner system
   * This fixes the mismatch between 2D rendering and 3D geometry
   * @param {Object} cadEngineObjects - Objects from CAD engine with adjusted endpoints
   */
  syncAdjustedEndpoints(cadEngineObjects) {
    if (!cadEngineObjects) return;

    console.log('🔄 Syncing adjusted endpoints from CAD engine to Architect3D corners...');

    Object.values(cadEngineObjects).forEach(cadObject => {
      if (cadObject.type === 'wall' && cadObject.params?.adjustedStartPoint && cadObject.params?.adjustedEndPoint) {
        // Find corresponding Architect3D wall
        const architect3DWall = this.walls.find(wall => wall.id === cadObject.id);
        
        if (architect3DWall) {
          // Update corner locations to match adjusted 3D endpoints
          const adjustedStart = cadObject.params.adjustedStartPoint;
          const adjustedEnd = cadObject.params.adjustedEndPoint;
          
          // Update start corner
          if (architect3DWall.startCorner) {
            architect3DWall.startCorner.location.x = adjustedStart.x;
            architect3DWall.startCorner.location.y = adjustedStart.z; // Note: Architect3D uses Y for Z-world
            console.log(`📍 Updated wall ${cadObject.id} start corner to:`, architect3DWall.startCorner.location);
          }
          
          // Update end corner  
          if (architect3DWall.endCorner) {
            architect3DWall.endCorner.location.x = adjustedEnd.x;
            architect3DWall.endCorner.location.y = adjustedEnd.z; // Note: Architect3D uses Y for Z-world
            console.log(`📍 Updated wall ${cadObject.id} end corner to:`, architect3DWall.endCorner.location);
          }

          // Store adjusted endpoints on the Architect3D wall for direct access
          architect3DWall.adjustedStartPoint = adjustedStart;
          architect3DWall.adjustedEndPoint = adjustedEnd;
          
          console.log(`✅ Synced wall ${cadObject.id} endpoints: 2D corners now match 3D geometry`);
        }
      }
    });
    
    // Trigger room recalculation with updated corner positions
    this.calculateRooms();
    console.log('🏠 Room calculation updated with synced endpoints');
  }
}