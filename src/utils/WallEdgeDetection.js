/**
 * Wall Edge Detection Utility
 * 
 * Provides sophisticated wall edge detection for 2D viewport interactions
 * Supports precise edge detection, hover states, intelligent snap points, and placement validation
 */

/**
 * Represents different types of snap points
 */
const SNAP_TYPES = {
  CENTER: 'center',           // Wall center point
  CORNER: 'corner',           // Wall corner/endpoint
  QUARTER: 'quarter',         // 25% and 75% along wall
  THIRD: 'third',            // 33% and 66% along wall  
  OFFSET: 'offset',          // User-defined offset from edges
  CONTINUOUS: 'continuous'    // Any point along wall edge
};

/**
 * Represents a specific snap point on a wall
 */
class SnapPoint {
  constructor(wallId, edgeType, position, snapType, ratio = 0, metadata = {}) {
    this.wallId = wallId;
    this.edgeType = edgeType;
    this.position = position;      // {x, y} in world coordinates
    this.snapType = snapType;      // SNAP_TYPES value
    this.ratio = ratio;           // 0-1 position along edge
    this.metadata = metadata;     // Additional data (offset distance, etc.)
    this.priority = this.calculatePriority();
  }

  calculatePriority() {
    // Higher priority snap points take precedence when multiple are nearby
    const priorities = {
      [SNAP_TYPES.CORNER]: 10,
      [SNAP_TYPES.CENTER]: 8,
      [SNAP_TYPES.QUARTER]: 6,
      [SNAP_TYPES.THIRD]: 5,
      [SNAP_TYPES.OFFSET]: 7,
      [SNAP_TYPES.CONTINUOUS]: 1
    };
    return priorities[this.snapType] || 1;
  }

  /**
   * Calculate distance from a point to this snap point
   */
  distanceToPoint(point) {
    const dx = point.x - this.position.x;
    const dy = point.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * Represents a wall edge with start and end points
 */
class WallEdge {
  constructor(wallId, edgeType, startPoint, endPoint, thickness = 0.2) {
    this.wallId = wallId;
    this.edgeType = edgeType; // 'top', 'bottom', 'left', 'right'
    this.startPoint = startPoint; // {x, y} in world coordinates
    this.endPoint = endPoint;     // {x, y} in world coordinates
    this.thickness = thickness;
    this.length = this.calculateLength();
    this.direction = this.calculateDirection();
    this.normal = this.calculateNormal();
    this.snapPoints = this.generateSnapPoints();
  }

  calculateLength() {
    const dx = this.endPoint.x - this.startPoint.x;
    const dy = this.endPoint.y - this.startPoint.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  calculateDirection() {
    const dx = this.endPoint.x - this.startPoint.x;
    const dy = this.endPoint.y - this.startPoint.y;
    const length = this.length;
    return length > 0 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
  }

  calculateNormal() {
    // Calculate perpendicular normal vector (pointing inward)
    const dir = this.direction;
    return { x: -dir.y, y: dir.x };
  }

  /**
   * Generate intelligent snap points along this edge
   */
  generateSnapPoints() {
    const snapPoints = [];
    
    // Corner points (start and end)
    snapPoints.push(new SnapPoint(
      this.wallId, this.edgeType, 
      { x: this.startPoint.x, y: this.startPoint.y }, 
      SNAP_TYPES.CORNER, 0, { position: 'start' }
    ));
    
    snapPoints.push(new SnapPoint(
      this.wallId, this.edgeType, 
      { x: this.endPoint.x, y: this.endPoint.y }, 
      SNAP_TYPES.CORNER, 1, { position: 'end' }
    ));

    // Only add intermediate points if wall is long enough
    if (this.length >= 1.0) {
      // Center point
      const centerPos = this.getPlacementPoint(0.5);
      snapPoints.push(new SnapPoint(
        this.wallId, this.edgeType, 
        { x: centerPos.x, y: centerPos.y }, 
        SNAP_TYPES.CENTER, 0.5
      ));

      // Quarter points (if wall is long enough)
      if (this.length >= 2.0) {
        const quarterPos = this.getPlacementPoint(0.25);
        const threeQuarterPos = this.getPlacementPoint(0.75);
        
        snapPoints.push(new SnapPoint(
          this.wallId, this.edgeType, 
          { x: quarterPos.x, y: quarterPos.y }, 
          SNAP_TYPES.QUARTER, 0.25
        ));
        
        snapPoints.push(new SnapPoint(
          this.wallId, this.edgeType, 
          { x: threeQuarterPos.x, y: threeQuarterPos.y }, 
          SNAP_TYPES.QUARTER, 0.75
        ));
      }

      // Third points (for architectural spacing)
      if (this.length >= 3.0) {
        const thirdPos = this.getPlacementPoint(1/3);
        const twoThirdPos = this.getPlacementPoint(2/3);
        
        snapPoints.push(new SnapPoint(
          this.wallId, this.edgeType, 
          { x: thirdPos.x, y: thirdPos.y }, 
          SNAP_TYPES.THIRD, 1/3
        ));
        
        snapPoints.push(new SnapPoint(
          this.wallId, this.edgeType, 
          { x: twoThirdPos.x, y: twoThirdPos.y }, 
          SNAP_TYPES.THIRD, 2/3
        ));
      }
    }

    return snapPoints;
  }

  /**
   * Generate offset snap points at specified distance from corners
   */
  generateOffsetSnapPoints(offsetDistance = 0.5) {
    const offsetPoints = [];
    
    if (this.length > offsetDistance * 2) {
      // Offset from start
      const startOffsetRatio = offsetDistance / this.length;
      const startOffsetPos = this.getPlacementPoint(startOffsetRatio);
      offsetPoints.push(new SnapPoint(
        this.wallId, this.edgeType,
        { x: startOffsetPos.x, y: startOffsetPos.y },
        SNAP_TYPES.OFFSET, startOffsetRatio,
        { offsetDistance, from: 'start' }
      ));

      // Offset from end
      const endOffsetRatio = 1 - (offsetDistance / this.length);
      const endOffsetPos = this.getPlacementPoint(endOffsetRatio);
      offsetPoints.push(new SnapPoint(
        this.wallId, this.edgeType,
        { x: endOffsetPos.x, y: endOffsetPos.y },
        SNAP_TYPES.OFFSET, endOffsetRatio,
        { offsetDistance, from: 'end' }
      ));
    }

    return offsetPoints;
  }

  /**
   * Calculate distance from a point to this edge
   */
  distanceToPoint(point) {
    // Vector from start to point
    const toPointX = point.x - this.startPoint.x;
    const toPointY = point.y - this.startPoint.y;

    // Project onto edge direction
    const projection = toPointX * this.direction.x + toPointY * this.direction.y;
    
    // Clamp projection to edge bounds
    const clampedProjection = Math.max(0, Math.min(this.length, projection));
    
    // Find closest point on edge
    const closestX = this.startPoint.x + clampedProjection * this.direction.x;
    const closestY = this.startPoint.y + clampedProjection * this.direction.y;
    
    // Calculate distance
    const dx = point.x - closestX;
    const dy = point.y - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return {
      distance,
      closestPoint: { x: closestX, y: closestY },
      projectionRatio: clampedProjection / this.length,
      isWithinBounds: projection >= 0 && projection <= this.length
    };
  }

  /**
   * Check if a point is near this edge within tolerance
   */
  isPointNear(point, tolerance = 0.1) {
    const result = this.distanceToPoint(point);
    return result.distance <= tolerance && result.isWithinBounds;
  }

  /**
   * Get placement point along this edge at given ratio (0-1)
   */
  getPlacementPoint(ratio = 0.5) {
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    return {
      x: this.startPoint.x + clampedRatio * (this.endPoint.x - this.startPoint.x),
      y: this.startPoint.y + clampedRatio * (this.endPoint.y - this.startPoint.y),
      ratio: clampedRatio,
      edge: this
    };
  }

  /**
   * Find the best snap point near a given point
   */
  findBestSnapPoint(point, tolerance = 0.15) {
    const candidates = [];
    
    // Check discrete snap points first
    this.snapPoints.forEach(snapPoint => {
      const distance = snapPoint.distanceToPoint(point);
      if (distance <= tolerance) {
        candidates.push({
          snapPoint,
          distance,
          priority: snapPoint.priority
        });
      }
    });
    
    // If no discrete snap points, allow continuous placement
    if (candidates.length === 0) {
      const edgeResult = this.distanceToPoint(point);
      if (edgeResult.distance <= tolerance && edgeResult.isWithinBounds) {
        const continuousPos = this.getPlacementPoint(edgeResult.projectionRatio);
        const continuousSnapPoint = new SnapPoint(
          this.wallId, this.edgeType,
          { x: continuousPos.x, y: continuousPos.y },
          SNAP_TYPES.CONTINUOUS, edgeResult.projectionRatio
        );
        
        candidates.push({
          snapPoint: continuousSnapPoint,
          distance: edgeResult.distance,
          priority: continuousSnapPoint.priority
        });
      }
    }
    
    if (candidates.length === 0) return null;
    
    // Sort by priority (higher first), then by distance (closer first)
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.distance - b.distance;
    });
    
    return candidates[0];
  }
}

/**
 * Enhanced Wall Edge Detection System with Intelligent Snapping
 */
class WallEdgeDetector {
  constructor(config = {}) {
    this.wallEdges = new Map(); // wallId -> edges[]
    this.wallSnapPoints = new Map(); // wallId -> snapPoints[]
    
    // Configurable snap settings
    this.config = {
      snapTolerance: config.snapTolerance || 0.15, // meters
      hoverTolerance: config.hoverTolerance || 0.08, // meters
      defaultOffsetDistance: config.defaultOffsetDistance || 0.5, // meters
      enabledSnapTypes: config.enabledSnapTypes || [
        SNAP_TYPES.CORNER,
        SNAP_TYPES.CENTER,
        SNAP_TYPES.QUARTER,
        SNAP_TYPES.THIRD,
        SNAP_TYPES.OFFSET,
        SNAP_TYPES.CONTINUOUS
      ],
      snapPriority: config.snapPriority || true, // Prefer higher priority snaps
      showSnapGuides: config.showSnapGuides !== false, // Visual guides
      minWallLengthForSnaps: config.minWallLengthForSnaps || 1.0 // Minimum wall length
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    // Regenerate snap points with new config
    this.regenerateSnapPoints();
  }

  /**
   * Update wall edges from wall objects
   */
  updateWallEdges(wallObjects) {
    this.wallEdges.clear();
    this.wallSnapPoints.clear();
    
    wallObjects.forEach(wall => {
      if (wall.type === 'wall' && wall.params) {
        const edges = this.extractWallEdges(wall);
        this.wallEdges.set(wall.id, edges);
        
        // Generate snap points for this wall
        const snapPoints = this.generateWallSnapPoints(wall.id, edges);
        this.wallSnapPoints.set(wall.id, snapPoints);
      }
    });
    
    console.log(`🎯 Enhanced Wall Detection: Updated ${this.wallEdges.size} walls with intelligent snap points`);
  }

  /**
   * Generate all snap points for a wall
   */
  generateWallSnapPoints(wallId, edges) {
    const allSnapPoints = [];
    
    edges.forEach(edge => {
      // Add built-in snap points from edge
      edge.snapPoints.forEach(snapPoint => {
        if (this.config.enabledSnapTypes.includes(snapPoint.snapType)) {
          allSnapPoints.push(snapPoint);
        }
      });
      
      // Add offset snap points if enabled
      if (this.config.enabledSnapTypes.includes(SNAP_TYPES.OFFSET)) {
        const offsetPoints = edge.generateOffsetSnapPoints(this.config.defaultOffsetDistance);
        allSnapPoints.push(...offsetPoints);
      }
    });
    
    return allSnapPoints;
  }

  /**
   * Regenerate snap points for all walls (when config changes)
   */
  regenerateSnapPoints() {
    this.wallSnapPoints.clear();
    this.wallEdges.forEach((edges, wallId) => {
      const snapPoints = this.generateWallSnapPoints(wallId, edges);
      this.wallSnapPoints.set(wallId, snapPoints);
    });
  }

  /**
   * Extract edge geometries from a wall object
   */
  extractWallEdges(wall) {
    const params = wall.params;
    const thickness = params.thickness || 0.2;
    
    // Use adjusted points if available, otherwise fall back to start/end points
    const startPoint = params.adjustedStartPoint || params.startPoint;
    const endPoint = params.adjustedEndPoint || params.endPoint;
    
    if (!startPoint || !endPoint) {
      console.warn('Wall missing start/end points:', wall.id);
      return [];
    }

    // Calculate wall direction and perpendicular offset
    const wallDirection = {
      x: endPoint.x - startPoint.x,
      z: endPoint.z - startPoint.z
    };
    const wallLength = Math.sqrt(wallDirection.x * wallDirection.x + wallDirection.z * wallDirection.z);
    
    if (wallLength === 0) return [];
    
    // Normalize direction
    wallDirection.x /= wallLength;
    wallDirection.z /= wallLength;
    
    // Calculate perpendicular direction (for thickness)
    const perpendicular = {
      x: -wallDirection.z,
      z: wallDirection.x
    };
    
    // Calculate corner points of wall rectangle
    const halfThickness = thickness / 2;
    
    const corners = {
      topLeft: {
        x: startPoint.x + perpendicular.x * halfThickness,
        y: startPoint.z + perpendicular.z * halfThickness
      },
      topRight: {
        x: endPoint.x + perpendicular.x * halfThickness,
        y: endPoint.z + perpendicular.z * halfThickness
      },
      bottomRight: {
        x: endPoint.x - perpendicular.x * halfThickness,
        y: endPoint.z - perpendicular.z * halfThickness
      },
      bottomLeft: {
        x: startPoint.x - perpendicular.x * halfThickness,
        y: startPoint.z - perpendicular.z * halfThickness
      }
    };

    // Create edges for all four sides of the wall
    return [
      new WallEdge(wall.id, 'top', corners.topLeft, corners.topRight, thickness),
      new WallEdge(wall.id, 'right', corners.topRight, corners.bottomRight, thickness),
      new WallEdge(wall.id, 'bottom', corners.bottomRight, corners.bottomLeft, thickness),
      new WallEdge(wall.id, 'left', corners.bottomLeft, corners.topLeft, thickness)
    ];
  }

  /**
   * Find the best snap point near a given point (Enhanced)
   */
  findBestSnapPoint(point, tolerance = null, preferredSnapTypes = null) {
    const actualTolerance = tolerance || this.config.snapTolerance;
    const allowedSnapTypes = preferredSnapTypes || this.config.enabledSnapTypes;
    const candidates = [];
    
    // Check all snap points across all walls
    this.wallSnapPoints.forEach((snapPoints, wallId) => {
      snapPoints.forEach(snapPoint => {
        if (!allowedSnapTypes.includes(snapPoint.snapType)) return;
        
        const distance = snapPoint.distanceToPoint(point);
        if (distance <= actualTolerance) {
          candidates.push({
            snapPoint,
            wallId,
            distance,
            priority: snapPoint.priority
          });
        }
      });
    });
    
    // If no discrete snap points and continuous is allowed, check edges
    if (candidates.length === 0 && allowedSnapTypes.includes(SNAP_TYPES.CONTINUOUS)) {
      this.wallEdges.forEach((edges, wallId) => {
        edges.forEach(edge => {
          const bestSnapResult = edge.findBestSnapPoint(point, actualTolerance);
          if (bestSnapResult && bestSnapResult.snapType === SNAP_TYPES.CONTINUOUS) {
            candidates.push({
              snapPoint: bestSnapResult,
              wallId,
              distance: bestSnapResult.distance,
              priority: bestSnapResult.priority
            });
          }
        });
      });
    }
    
    if (candidates.length === 0) return null;
    
    // Sort by priority (higher first), then by distance (closer first)
    if (this.config.snapPriority) {
      candidates.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.distance - b.distance;
      });
    } else {
      // Sort by distance only
      candidates.sort((a, b) => a.distance - b.distance);
    }
    
    const bestCandidate = candidates[0];
    
    // Add debug information
    console.log(`🎯 Best snap found: ${bestCandidate.snapPoint.snapType} at distance ${bestCandidate.distance.toFixed(3)}m (priority: ${bestCandidate.priority})`);
    
    return {
      snapPoint: bestCandidate.snapPoint,
      wallId: bestCandidate.wallId,
      distance: bestCandidate.distance,
      priority: bestCandidate.priority,
      snapInfo: {
        type: bestCandidate.snapPoint.snapType,
        position: bestCandidate.snapPoint.position,
        ratio: bestCandidate.snapPoint.ratio,
        metadata: bestCandidate.snapPoint.metadata
      }
    };
  }

  /**
   * Find wall edges near a point (Legacy support)
   */
  findNearbyEdges(point, tolerance = null) {
    const actualTolerance = tolerance || this.config.hoverTolerance;
    const nearbyEdges = [];
    
    this.wallEdges.forEach((edges, wallId) => {
      edges.forEach(edge => {
        const result = edge.distanceToPoint(point);
        if (result.distance <= actualTolerance && result.isWithinBounds) {
          nearbyEdges.push({
            edge,
            wallId,
            distance: result.distance,
            closestPoint: result.closestPoint,
            projectionRatio: result.projectionRatio
          });
        }
      });
    });
    
    // Sort by distance
    nearbyEdges.sort((a, b) => a.distance - b.distance);
    
    return nearbyEdges;
  }

  /**
   * Find the closest edge to a point within tolerance (Legacy support)
   */
  findClosestEdge(point, tolerance = null) {
    const nearbyEdges = this.findNearbyEdges(point, tolerance);
    return nearbyEdges.length > 0 ? nearbyEdges[0] : null;
  }

  /**
   * Check if a point is near any wall edge
   */
  isPointNearWallEdge(point, tolerance = null) {
    return this.findClosestEdge(point, tolerance) !== null;
  }

  /**
   * Enhanced snap position calculation with intelligent snapping
   */
  getSnapPosition(point, objectWidth = 0.9, snapMode = 'auto') {
    let bestSnap = null;
    
    if (snapMode === 'auto' || snapMode === 'snap') {
      // Try intelligent snap points first
      bestSnap = this.findBestSnapPoint(point);
    }
    
    if (!bestSnap && (snapMode === 'auto' || snapMode === 'continuous')) {
      // Fall back to legacy continuous placement
      const closestEdge = this.findClosestEdge(point, this.config.snapTolerance);
      
      if (closestEdge) {
        const edge = closestEdge.edge;
        const ratio = closestEdge.projectionRatio;
        
        // Ensure object fits within edge bounds
        const minRatio = (objectWidth / 2) / edge.length;
        const maxRatio = 1 - minRatio;
        
        if (ratio >= minRatio && ratio <= maxRatio) {
          const placementPoint = edge.getPlacementPoint(ratio);
          
          bestSnap = {
            snapPoint: {
              position: { x: placementPoint.x, y: placementPoint.y },
              snapType: SNAP_TYPES.CONTINUOUS,
              ratio: ratio
            },
            wallId: edge.wallId,
            distance: closestEdge.distance,
            snapInfo: {
              type: SNAP_TYPES.CONTINUOUS,
              position: placementPoint,
              ratio: ratio
            }
          };
        }
      }
    }
    
    if (!bestSnap) return null;
    
    // Get the edge for this wall to calculate normal and direction
    const wallEdges = this.wallEdges.get(bestSnap.wallId);
    const edge = wallEdges ? wallEdges.find(e => e.edgeType === 'top' || e.edgeType === 'bottom') : null;
    
    return {
      position: bestSnap.snapPoint.position,
      wallId: bestSnap.wallId,
      edge: edge,
      normal: edge ? edge.normal : { x: 0, y: 1 },
      canPlace: true,
      wallDirection: edge ? edge.direction : { x: 1, y: 0 },
      snapInfo: bestSnap.snapInfo,
      snapType: bestSnap.snapPoint.snapType,
      distance: bestSnap.distance
    };
  }

  /**
   * Enhanced placement validation with snap point awareness
   */
  validatePlacement(point, objectWidth = 0.9, objectHeight = 2.1, existingObjects = [], snapMode = 'auto') {
    const snapPos = this.getSnapPosition(point, objectWidth, snapMode);
    
    if (!snapPos) {
      return { valid: false, reason: 'No suitable snap point found' };
    }
    
    // Enhanced conflict detection considering snap points
    const conflicts = existingObjects.filter(obj => {
      if (!obj.wallId || obj.wallId !== snapPos.wallId) return false;
      
      const distance = Math.sqrt(
        Math.pow(obj.position.x - snapPos.position.x, 2) +
        Math.pow(obj.position.y - snapPos.position.y, 2)
      );
      
      const minDistance = (objectWidth + (obj.width || 0.9)) / 2 + 0.1; // 10cm clearance
      return distance < minDistance;
    });
    
    if (conflicts.length > 0) {
      return { 
        valid: false, 
        reason: 'Conflicts with existing objects',
        conflicts: conflicts,
        snapInfo: snapPos.snapInfo
      };
    }
    
    return { 
      valid: true, 
      snapPosition: snapPos,
      placementInfo: {
        wallId: snapPos.wallId,
        position: snapPos.position,
        rotation: Math.atan2(snapPos.wallDirection.y, snapPos.wallDirection.x),
        wallNormal: snapPos.normal,
        snapType: snapPos.snapType,
        snapInfo: snapPos.snapInfo
      }
    };
  }

  /**
   * Get all snap points for visualization/debugging
   */
  getAllSnapPoints(snapType = null) {
    const allSnapPoints = [];
    
    this.wallSnapPoints.forEach((snapPoints, wallId) => {
      snapPoints.forEach(snapPoint => {
        if (!snapType || snapPoint.snapType === snapType) {
          allSnapPoints.push({ wallId, snapPoint });
        }
      });
    });
    
    return allSnapPoints;
  }

  /**
   * Get snap points for a specific wall
   */
  getWallSnapPoints(wallId, snapType = null) {
    const snapPoints = this.wallSnapPoints.get(wallId) || [];
    
    if (snapType) {
      return snapPoints.filter(sp => sp.snapType === snapType);
    }
    
    return snapPoints;
  }

  /**
   * Get all wall edges for rendering/debugging
   */
  getAllEdges() {
    const allEdges = [];
    this.wallEdges.forEach((edges, wallId) => {
      edges.forEach(edge => allEdges.push({ wallId, edge }));
    });
    return allEdges;
  }

  /**
   * Get walls that would be suitable for object placement (Enhanced)
   */
  getPlacementCandidateWalls(objectType = 'door', snapMode = 'auto') {
    const candidates = [];
    
    this.wallEdges.forEach((edges, wallId) => {
      // For most objects, we want the longer edges (top/bottom)
      const suitableEdges = edges.filter(edge => 
        edge.edgeType === 'top' || edge.edgeType === 'bottom'
      );
      
      suitableEdges.forEach(edge => {
        if (edge.length >= this.config.minWallLengthForSnaps) {
          const snapPointCount = this.getWallSnapPoints(wallId).length;
          
          candidates.push({
            wallId,
            edge,
            suitabilityScore: edge.length * (1 + snapPointCount * 0.1), // Bonus for more snap points
            snapPointCount,
            hasSnapPoints: snapPointCount > 0
          });
        }
      });
    });
    
    return candidates.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  }
}

// Enhanced singleton instance for the application with intelligent snapping
const wallEdgeDetector = new WallEdgeDetector({
  snapTolerance: 0.15,
  hoverTolerance: 0.08,
  defaultOffsetDistance: 0.5,
  enabledSnapTypes: [
    SNAP_TYPES.CORNER,
    SNAP_TYPES.CENTER,
    SNAP_TYPES.QUARTER,
    SNAP_TYPES.THIRD,
    SNAP_TYPES.OFFSET,
    SNAP_TYPES.CONTINUOUS
  ],
  snapPriority: true,
  showSnapGuides: true,
  minWallLengthForSnaps: 1.0
});

// Export all classes and the singleton instance
export { 
  SNAP_TYPES,
  SnapPoint, 
  WallEdge, 
  WallEdgeDetector, 
  wallEdgeDetector 
}; 