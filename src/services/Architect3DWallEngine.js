/**
 * Architect3D-Style Wall Drawing Engine
 * 
 * Complete wall drawing system with intelligent snapping, measurement,
 * corner detection, and professional 2D/3D rendering
 */

import * as THREE from 'three';

// Wall drawing states
export const WALL_DRAWING_STATES = {
  IDLE: 'idle',
  DRAWING: 'drawing',
  CONTINUING: 'continuing',
  CLOSING: 'closing'
};

// Snap types for intelligent wall placement
export const SNAP_TYPES = {
  NONE: 'none',
  GRID: 'grid',
  ENDPOINT: 'endpoint',
  MIDPOINT: 'midpoint',
  PERPENDICULAR: 'perpendicular',
  PARALLEL: 'parallel',
  INTERSECTION: 'intersection',
  EXTENSION: 'extension',
  CORNER: 'corner'
};

// Wall types
export const WALL_TYPES = {
  INTERIOR: 'interior',
  EXTERIOR: 'exterior',
  PARTITION: 'partition',
  STRUCTURAL: 'structural'
};

/**
 * Snap Point - represents a point where walls can snap to
 */
class SnapPoint {
  constructor(position, type, source = null, metadata = {}) {
    this.position = position;      // {x, y, z}
    this.type = type;             // SNAP_TYPES
    this.source = source;         // wall/object that created this snap point
    this.metadata = metadata;     // additional information
    this.priority = this.calculatePriority();
  }

  calculatePriority() {
    const priorities = {
      [SNAP_TYPES.ENDPOINT]: 10,
      [SNAP_TYPES.CORNER]: 10,
      [SNAP_TYPES.INTERSECTION]: 9,
      [SNAP_TYPES.PERPENDICULAR]: 8,
      [SNAP_TYPES.MIDPOINT]: 7,
      [SNAP_TYPES.PARALLEL]: 6,
      [SNAP_TYPES.EXTENSION]: 5,
      [SNAP_TYPES.GRID]: 4,
      [SNAP_TYPES.NONE]: 1
    };
    return priorities[this.type] || 1;
  }

  distanceToPoint(point) {
    const dx = point.x - this.position.x;
    const dy = point.y - this.position.y;
    const dz = (point.z || 0) - (this.position.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

/**
 * Wall Segment - represents a single wall between two points
 */
class WallSegment {
  constructor(startPoint, endPoint, config = {}) {
    this.id = config.id || this.generateId();
    this.startPoint = { ...startPoint };
    this.endPoint = { ...endPoint };
    
    // Wall properties
    this.thickness = config.thickness || 0.2;
    this.height = config.height || 2.5;
    this.material = config.material || 'concrete';
    this.wallType = config.wallType || WALL_TYPES.INTERIOR;
    
    // Visual properties
    this.color = config.color || '#8b7d6b';
    this.opacity = config.opacity || 1.0;
    
    // Calculated properties
    this.length = this.calculateLength();
    this.angle = this.calculateAngle();
    this.direction = this.calculateDirection();
    this.normal = this.calculateNormal();
    
    // Connection properties
    this.startConnection = null;
    this.endConnection = null;
    this.connectedWalls = new Set();
    
    // State
    this.isSelected = false;
    this.isHovered = false;
    this.isTemporary = config.isTemporary || false;
  }

  generateId() {
    return `wall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  calculateLength() {
    const dx = this.endPoint.x - this.startPoint.x;
    const dy = this.endPoint.y - this.startPoint.y;
    const dz = (this.endPoint.z || 0) - (this.startPoint.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  calculateAngle() {
    return Math.atan2(
      this.endPoint.y - this.startPoint.y,
      this.endPoint.x - this.startPoint.x
    );
  }

  calculateDirection() {
    const length = this.length;
    if (length === 0) return { x: 1, y: 0, z: 0 };
    
    return {
      x: (this.endPoint.x - this.startPoint.x) / length,
      y: (this.endPoint.y - this.startPoint.y) / length,
      z: ((this.endPoint.z || 0) - (this.startPoint.z || 0)) / length
    };
  }

  calculateNormal() {
    // Calculate perpendicular to wall direction (for 2D)
    return {
      x: -this.direction.y,
      y: this.direction.x,
      z: 0
    };
  }

  // Get center point of wall
  getCenter() {
    return {
      x: (this.startPoint.x + this.endPoint.x) / 2,
      y: (this.startPoint.y + this.endPoint.y) / 2,
      z: (this.startPoint.z + this.endPoint.z) / 2
    };
  }

  // Get wall corners (for rendering)
  getCorners() {
    const halfThickness = this.thickness / 2;
    const normal = this.normal;
    
    return {
      topLeft: {
        x: this.startPoint.x + normal.x * halfThickness,
        y: this.startPoint.y + normal.y * halfThickness,
        z: this.startPoint.z || 0
      },
      topRight: {
        x: this.endPoint.x + normal.x * halfThickness,
        y: this.endPoint.y + normal.y * halfThickness,
        z: this.endPoint.z || 0
      },
      bottomRight: {
        x: this.endPoint.x - normal.x * halfThickness,
        y: this.endPoint.y - normal.y * halfThickness,
        z: this.endPoint.z || 0
      },
      bottomLeft: {
        x: this.startPoint.x - normal.x * halfThickness,
        y: this.startPoint.y - normal.y * halfThickness,
        z: this.startPoint.z || 0
      }
    };
  }

  // Check if point is on wall line
  isPointOnWall(point, tolerance = 0.1) {
    const distanceToLine = this.distanceToLine(point);
    return distanceToLine <= tolerance;
  }

  // Calculate distance from point to wall line
  distanceToLine(point) {
    const A = this.endPoint.y - this.startPoint.y;
    const B = this.startPoint.x - this.endPoint.x;
    const C = this.endPoint.x * this.startPoint.y - this.startPoint.x * this.endPoint.y;
    
    return Math.abs(A * point.x + B * point.y + C) / Math.sqrt(A * A + B * B);
  }

  // Get closest point on wall to given point
  getClosestPointOnWall(point) {
    const dx = this.endPoint.x - this.startPoint.x;
    const dy = this.endPoint.y - this.startPoint.y;
    
    if (dx === 0 && dy === 0) return this.startPoint;
    
    const t = Math.max(0, Math.min(1, 
      ((point.x - this.startPoint.x) * dx + (point.y - this.startPoint.y) * dy) / 
      (dx * dx + dy * dy)
    ));
    
    return {
      x: this.startPoint.x + t * dx,
      y: this.startPoint.y + t * dy,
      z: this.startPoint.z || 0
    };
  }

  // Update wall geometry when endpoints change
  updateGeometry(startPoint, endPoint) {
    this.startPoint = { ...startPoint };
    this.endPoint = { ...endPoint };
    this.length = this.calculateLength();
    this.angle = this.calculateAngle();
    this.direction = this.calculateDirection();
    this.normal = this.calculateNormal();
  }

  // Clone wall segment
  clone() {
    return new WallSegment(this.startPoint, this.endPoint, {
      id: this.generateId(),
      thickness: this.thickness,
      height: this.height,
      material: this.material,
      wallType: this.wallType,
      color: this.color,
      opacity: this.opacity
    });
  }
}

/**
 * Wall Drawing Engine - Main class for architect3d-style wall drawing
 */
export class Architect3DWallEngine {
  constructor(config = {}) {
    // Configuration
    this.config = {
      snapTolerance: config.snapTolerance || 0.15,
      gridSize: config.gridSize || 0.5,
      minWallLength: config.minWallLength || 0.1,
      maxWallLength: config.maxWallLength || 50.0,
      defaultThickness: config.defaultThickness || 0.2,
      defaultHeight: config.defaultHeight || 2.5,
      angleLockIncrement: config.angleLockIncrement || 15, // degrees
      enableGridSnap: config.enableGridSnap !== false,
      enableAngleLock: config.enableAngleLock !== false,
      enableSmartSnapping: config.enableSmartSnapping !== false,
      autoCloseRooms: config.autoCloseRooms !== false,
      showMeasurements: config.showMeasurements !== false,
      showSnapGuides: config.showSnapGuides !== false
    };

    // State
    this.state = WALL_DRAWING_STATES.IDLE;
    this.walls = new Map();
    this.snapPoints = [];
    this.currentWall = null;
    this.previewWall = null;
    this.startPoint = null;
    this.currentPoint = null;
    
    // Drawing options
    this.isAngleLocked = false;
    this.lockedAngle = 0;
    this.isShiftPressed = false;
    this.isCtrlPressed = false;
    
    // Event listeners
    this.listeners = new Map();
    
    // Initialize
    this.initialize();
  }

  initialize() {
    console.log('🏗️ Initializing Architect3D Wall Engine');
    this.generateSnapPoints();
  }

  /**
   * Event handling
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

  dispatchEvent(event, data = {}) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Wall drawing control
   */
  startDrawing(point, options = {}) {
    console.log('🖊️ Starting wall drawing at:', point);
    
    const snappedPoint = this.getSnappedPoint(point);
    this.startPoint = snappedPoint;
    this.currentPoint = snappedPoint;
    this.state = WALL_DRAWING_STATES.DRAWING;
    
    this.dispatchEvent('drawingStarted', {
      startPoint: this.startPoint,
      snapType: snappedPoint.snapType
    });
  }

  continueDrawing(point) {
    if (this.state === WALL_DRAWING_STATES.IDLE) return;
    
    const snappedPoint = this.getSnappedPoint(point);
    this.currentPoint = snappedPoint;
    
    // Update preview wall
    this.updatePreviewWall();
    
    this.dispatchEvent('drawingContinued', {
      currentPoint: this.currentPoint,
      previewWall: this.previewWall
    });
  }

  finishWallSegment(point = null) {
    if (this.state === WALL_DRAWING_STATES.IDLE) return null;
    
    const endPoint = point ? this.getSnappedPoint(point) : this.currentPoint;
    
    // Validate wall segment
    if (!this.isValidWallSegment(this.startPoint, endPoint)) {
      console.warn('Invalid wall segment - too short or invalid');
      return null;
    }
    
    // Create wall segment
    const wall = new WallSegment(this.startPoint, endPoint, {
      thickness: this.config.defaultThickness,
      height: this.config.defaultHeight
    });
    
    // Add to walls collection
    this.walls.set(wall.id, wall);
    
    // Update snap points
    this.generateSnapPoints();
    
    // Check for room closure
    if (this.config.autoCloseRooms) {
      this.checkRoomClosure(wall);
    }
    
    // Continue drawing from end point
    this.startPoint = endPoint;
    this.state = WALL_DRAWING_STATES.CONTINUING;
    
    this.dispatchEvent('wallCreated', {
      wall: wall,
      canContinue: true
    });
    
    console.log('✅ Wall segment created:', wall.id, `(${wall.length.toFixed(2)}m)`);
    return wall;
  }

  finishDrawing() {
    console.log('🏁 Finishing wall drawing');
    
    this.state = WALL_DRAWING_STATES.IDLE;
    this.startPoint = null;
    this.currentPoint = null;
    this.previewWall = null;
    this.isAngleLocked = false;
    
    this.dispatchEvent('drawingFinished', {
      wallCount: this.walls.size
    });
  }

  cancelDrawing() {
    console.log('❌ Canceling wall drawing');
    
    this.state = WALL_DRAWING_STATES.IDLE;
    this.startPoint = null;
    this.currentPoint = null;
    this.previewWall = null;
    this.isAngleLocked = false;
    
    this.dispatchEvent('drawingCanceled');
  }

  /**
   * Intelligent snapping system
   */
  getSnappedPoint(point) {
    if (!this.config.enableSmartSnapping) {
      return { ...point, snapType: SNAP_TYPES.NONE };
    }
    
    const snapCandidates = [];
    
    // Grid snapping
    if (this.config.enableGridSnap) {
      const gridPoint = this.snapToGrid(point);
      snapCandidates.push({
        ...gridPoint,
        snapType: SNAP_TYPES.GRID,
        distance: this.distance2D(point, gridPoint)
      });
    }
    
    // Snap to existing points
    this.snapPoints.forEach(snapPoint => {
      const distance = snapPoint.distanceToPoint(point);
      if (distance <= this.config.snapTolerance) {
        snapCandidates.push({
          ...snapPoint.position,
          snapType: snapPoint.type,
          distance: distance,
          priority: snapPoint.priority
        });
      }
    });
    
    // Angle locking (if shift pressed or angle locked)
    if (this.isAngleLocked || this.isShiftPressed) {
      const angleLockedPoint = this.applyAngleLock(point);
      if (angleLockedPoint) {
        snapCandidates.push({
          ...angleLockedPoint,
          snapType: SNAP_TYPES.PARALLEL,
          distance: this.distance2D(point, angleLockedPoint),
          priority: 8
        });
      }
    }
    
    // Find best snap candidate
    if (snapCandidates.length === 0) {
      return { ...point, snapType: SNAP_TYPES.NONE };
    }
    
    // Sort by priority, then by distance
    snapCandidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.distance - b.distance; // Closer distance first
    });
    
    const bestSnap = snapCandidates[0];
    return {
      x: bestSnap.x,
      y: bestSnap.y,
      z: bestSnap.z || 0,
      snapType: bestSnap.snapType
    };
  }

  snapToGrid(point) {
    const gridSize = this.config.gridSize;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
      z: point.z || 0
    };
  }

  applyAngleLock(point) {
    if (!this.startPoint) return null;
    
    const dx = point.x - this.startPoint.x;
    const dy = point.y - this.startPoint.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Lock to increments (0°, 15°, 30°, 45°, etc.)
    const increment = this.config.angleLockIncrement * Math.PI / 180;
    const lockedAngle = Math.round(angle / increment) * increment;
    
    return {
      x: this.startPoint.x + distance * Math.cos(lockedAngle),
      y: this.startPoint.y + distance * Math.sin(lockedAngle),
      z: point.z || 0
    };
  }

  generateSnapPoints() {
    this.snapPoints = [];
    
    // Generate snap points from all walls
    this.walls.forEach(wall => {
      // Endpoints
      this.snapPoints.push(new SnapPoint(
        wall.startPoint,
        SNAP_TYPES.ENDPOINT,
        wall,
        { wallId: wall.id, pointType: 'start' }
      ));
      
      this.snapPoints.push(new SnapPoint(
        wall.endPoint,
        SNAP_TYPES.ENDPOINT,
        wall,
        { wallId: wall.id, pointType: 'end' }
      ));
      
      // Midpoint
      this.snapPoints.push(new SnapPoint(
        wall.getCenter(),
        SNAP_TYPES.MIDPOINT,
        wall,
        { wallId: wall.id, pointType: 'center' }
      ));
    });
    
    // Generate intersection points
    this.generateIntersectionPoints();
  }

  generateIntersectionPoints() {
    const wallArray = Array.from(this.walls.values());
    
    for (let i = 0; i < wallArray.length; i++) {
      for (let j = i + 1; j < wallArray.length; j++) {
        const intersection = this.getWallIntersection(wallArray[i], wallArray[j]);
        if (intersection) {
          this.snapPoints.push(new SnapPoint(
            intersection,
            SNAP_TYPES.INTERSECTION,
            [wallArray[i], wallArray[j]],
            { wall1: wallArray[i].id, wall2: wallArray[j].id }
          ));
        }
      }
    }
  }

  getWallIntersection(wall1, wall2) {
    // Line intersection calculation
    const x1 = wall1.startPoint.x, y1 = wall1.startPoint.y;
    const x2 = wall1.endPoint.x, y2 = wall1.endPoint.y;
    const x3 = wall2.startPoint.x, y3 = wall2.startPoint.y;
    const x4 = wall2.endPoint.x, y4 = wall2.endPoint.y;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null; // Parallel lines
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    // Check if intersection is within both line segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1),
        z: 0
      };
    }
    
    return null;
  }

  /**
   * Wall validation and management
   */
  isValidWallSegment(startPoint, endPoint) {
    const length = this.distance2D(startPoint, endPoint);
    return length >= this.config.minWallLength && length <= this.config.maxWallLength;
  }

  updatePreviewWall() {
    if (!this.startPoint || !this.currentPoint) {
      this.previewWall = null;
      return;
    }
    
    this.previewWall = new WallSegment(this.startPoint, this.currentPoint, {
      isTemporary: true,
      opacity: 0.7
    });
  }

  checkRoomClosure(newWall) {
    // Check if the new wall closes a room by connecting to existing walls
    const tolerance = this.config.snapTolerance;
    
    // Find walls that connect to start or end points
    const connectedAtStart = this.findConnectedWalls(newWall.startPoint, tolerance);
    const connectedAtEnd = this.findConnectedWalls(newWall.endPoint, tolerance);
    
    if (connectedAtStart.length > 0 && connectedAtEnd.length > 0) {
      console.log('🏠 Room closure detected with new wall:', newWall.id);
      this.dispatchEvent('roomClosed', {
        newWall: newWall,
        connectedWalls: [...connectedAtStart, ...connectedAtEnd]
      });
    }
  }

  findConnectedWalls(point, tolerance) {
    const connected = [];
    
    this.walls.forEach(wall => {
      if (this.distance2D(point, wall.startPoint) <= tolerance ||
          this.distance2D(point, wall.endPoint) <= tolerance) {
        connected.push(wall);
      }
    });
    
    return connected;
  }

  /**
   * Wall management
   */
  selectWall(wallId) {
    const wall = this.walls.get(wallId);
    if (wall) {
      wall.isSelected = true;
      this.dispatchEvent('wallSelected', { wall });
    }
  }

  deselectWall(wallId) {
    const wall = this.walls.get(wallId);
    if (wall) {
      wall.isSelected = false;
      this.dispatchEvent('wallDeselected', { wall });
    }
  }

  deleteWall(wallId) {
    const wall = this.walls.get(wallId);
    if (wall) {
      this.walls.delete(wallId);
      this.generateSnapPoints();
      this.dispatchEvent('wallDeleted', { wall });
      console.log('🗑️ Wall deleted:', wallId);
    }
  }

  updateWallProperties(wallId, properties) {
    const wall = this.walls.get(wallId);
    if (wall) {
      Object.assign(wall, properties);
      this.dispatchEvent('wallUpdated', { wall });
    }
  }

  /**
   * Utility functions
   */
  distance2D(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distance3D(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const dz = (point2.z || 0) - (point1.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * State management
   */
  setKeyState(key, pressed) {
    switch (key) {
      case 'Shift':
        this.isShiftPressed = pressed;
        break;
      case 'Control':
      case 'Meta':
        this.isCtrlPressed = pressed;
        break;
    }
  }

  toggleAngleLock() {
    this.isAngleLocked = !this.isAngleLocked;
    console.log('🔒 Angle lock:', this.isAngleLocked ? 'ON' : 'OFF');
  }

  /**
   * Export/Import
   */
  exportWalls() {
    const wallData = [];
    this.walls.forEach(wall => {
      wallData.push({
        id: wall.id,
        startPoint: wall.startPoint,
        endPoint: wall.endPoint,
        thickness: wall.thickness,
        height: wall.height,
        material: wall.material,
        wallType: wall.wallType,
        color: wall.color
      });
    });
    return wallData;
  }

  importWalls(wallData) {
    this.walls.clear();
    
    wallData.forEach(data => {
      const wall = new WallSegment(data.startPoint, data.endPoint, {
        id: data.id,
        thickness: data.thickness,
        height: data.height,
        material: data.material,
        wallType: data.wallType,
        color: data.color
      });
      this.walls.set(wall.id, wall);
    });
    
    this.generateSnapPoints();
    this.dispatchEvent('wallsImported', { count: this.walls.size });
  }

  /**
   * Cleanup
   */
  dispose() {
    this.walls.clear();
    this.snapPoints = [];
    this.listeners.clear();
    this.state = WALL_DRAWING_STATES.IDLE;
    console.log('🧹 Architect3D Wall Engine disposed');
  }
}

export default Architect3DWallEngine;













