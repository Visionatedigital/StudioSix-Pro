/**
 * Wall Joinery Debug Utility
 * 
 * Provides debugging tools for wall joinery rendering issues
 */

class WallJoineryDebugger {
  constructor() {
    this.enabled = true; // Set to false to disable debug logging
  }

  /**
   * Debug wall joinery state for a given wall object
   */
  debugWallState(wall) {
    if (!this.enabled) return;

    console.group(`🔍 Wall ${wall.id} Debug Info`);
    
    console.log('📍 Basic Properties:', {
      type: wall.type,
      length: wall.length,
      thickness: wall.thickness,
      material: wall.material
    });

    if (wall.params) {
      console.log('🔧 Wall Parameters:', {
        length: wall.params.length,
        thickness: wall.params.thickness,
        material: wall.params.material,
        adjustForJoinery: wall.params.adjustForJoinery,
        startAdjustment: wall.params.startAdjustment,
        endAdjustment: wall.params.endAdjustment,
        actualLength: wall.params.actualLength
      });

      console.log('📍 Position Data:', {
        originalPosition: wall.position,
        startPoint: wall.params.startPoint,
        endPoint: wall.params.endPoint,
        adjustedStartPoint: wall.params.adjustedStartPoint,
        adjustedEndPoint: wall.params.adjustedEndPoint
      });

      // Calculate what the adjusted center should be
      if (wall.params.adjustedStartPoint && wall.params.adjustedEndPoint) {
        const adjustedCenter = {
          x: (wall.params.adjustedStartPoint.x + wall.params.adjustedEndPoint.x) / 2,
          y: (wall.params.adjustedStartPoint.y + wall.params.adjustedEndPoint.y) / 2,
          z: (wall.params.adjustedStartPoint.z + wall.params.adjustedEndPoint.z) / 2
        };
        console.log('🎯 Calculated Adjusted Center:', adjustedCenter);
        
        const centerDelta = {
          x: adjustedCenter.x - wall.position.x,
          y: adjustedCenter.y - wall.position.y,
          z: adjustedCenter.z - wall.position.z
        };
        console.log('📏 Center Position Delta:', centerDelta);
      }
    }

    console.groupEnd();
  }

  /**
   * Debug all walls in the scene
   */
  debugAllWalls(objects) {
    if (!this.enabled) return;

    const walls = objects.filter(obj => obj.type === 'wall');
    console.group(`🏗️ All Walls Debug (${walls.length} walls)`);
    
    walls.forEach(wall => this.debugWallState(wall));
    
    console.groupEnd();
  }

  /**
   * Debug wall intersections
   */
  debugWallIntersections(walls) {
    if (!this.enabled) return;

    console.group('🔗 Wall Intersections Debug');
    
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const wall1 = walls[i];
        const wall2 = walls[j];
        
        if (this.wallsIntersect(wall1, wall2)) {
          console.log(`🔗 Intersection found: Wall ${wall1.id} ↔ Wall ${wall2.id}`);
          console.log('  Wall 1:', {
            start: wall1.params?.startPoint,
            end: wall1.params?.endPoint,
            adjustedStart: wall1.params?.adjustedStartPoint,
            adjustedEnd: wall1.params?.adjustedEndPoint
          });
          console.log('  Wall 2:', {
            start: wall2.params?.startPoint,
            end: wall2.params?.endPoint,
            adjustedStart: wall2.params?.adjustedStartPoint,
            adjustedEnd: wall2.params?.adjustedEndPoint
          });
        }
      }
    }
    
    console.groupEnd();
  }

  /**
   * Simple wall intersection check (basic endpoint proximity)
   */
  wallsIntersect(wall1, wall2) {
    const tolerance = 0.1; // 10cm tolerance
    
    const getPoints = (wall) => {
      const params = wall.params;
      if (!params) return null;
      
      return {
        start: params.adjustedStartPoint || params.startPoint,
        end: params.adjustedEndPoint || params.endPoint
      };
    };

    const points1 = getPoints(wall1);
    const points2 = getPoints(wall2);
    
    if (!points1 || !points2) return false;

    // Check if any endpoints are close to each other
    const pointsToCheck = [
      [points1.start, points2.start],
      [points1.start, points2.end],
      [points1.end, points2.start],
      [points1.end, points2.end]
    ];

    return pointsToCheck.some(([p1, p2]) => {
      if (!p1 || !p2) return false;
      const distance = Math.sqrt(
        Math.pow(p1.x - p2.x, 2) + 
        Math.pow(p1.z - p2.z, 2)
      );
      return distance < tolerance;
    });
  }

  /**
   * Debug viewport wall rendering
   */
  debugWallRendering(wall, pos2d, actualLength, thickness) {
    if (!this.enabled) return;

    console.log(`🎨 Rendering Wall ${wall.id}:`, {
      pos2d: pos2d,
      actualLength: actualLength,
      thickness: thickness,
      lengthPixels: actualLength * 100,
      thicknessPixels: thickness * 100,
      hasJoinery: !!wall.params?.adjustForJoinery,
      adjustments: {
        start: wall.params?.startAdjustment,
        end: wall.params?.endAdjustment
      }
    });
  }

  /**
   * Enable or disable debug logging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`🔍 Wall Joinery Debug: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Force refresh wall joinery (calls CAD engine)
   */
  async forceJoineryRefresh(standaloneCADEngine) {
    if (!this.enabled) return;

    console.log('🔄 Force refreshing wall joinery...');
    
    if (standaloneCADEngine && standaloneCADEngine.forceWallJoineryRefresh) {
      standaloneCADEngine.forceWallJoineryRefresh();
      console.log('✅ Joinery refresh triggered');
    } else {
      console.warn('⚠️ CAD engine or forceWallJoineryRefresh method not available');
    }
  }
}

// Singleton instance
const wallJoineryDebugger = new WallJoineryDebugger();

// Global debug functions for easy console access
window.debugWalls = (objects) => wallJoineryDebugger.debugAllWalls(objects);
window.debugWallJoinery = (enabled = true) => wallJoineryDebugger.setEnabled(enabled);
window.forceWallJoinery = (cadEngine) => wallJoineryDebugger.forceJoineryRefresh(cadEngine);

export { WallJoineryDebugger, wallJoineryDebugger }; 