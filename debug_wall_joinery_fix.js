/**
 * Wall Joinery Debug and Fix Script
 * Run this in the browser console when the app is loaded to debug wall joinery issues
 */

// Test wall joinery system
function debugWallJoinerySystem() {
  console.log('🔍 DEBUGGING WALL JOINERY SYSTEM');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Get current walls
  const walls = Array.from(engine.objects.values()).filter(obj => obj.type === 'wall');
  console.log(`📊 Found ${walls.length} walls in scene`);
  
  walls.forEach((wall, index) => {
    console.log(`\n🧱 Wall ${index + 1} (${wall.id}):`);
    console.log('  Basic info:', {
      position: wall.position,
      params: wall.params
    });
    
    if (wall.params) {
      console.log('  Start/End points:', {
        original: {
          start: wall.params.startPoint,
          end: wall.params.endPoint
        },
        adjusted: {
          start: wall.params.adjustedStartPoint,
          end: wall.params.adjustedEndPoint
        }
      });
      
      console.log('  Joinery status:', {
        hasJoinery: wall.params.adjustForJoinery,
        startAdjustment: wall.params.startAdjustment,
        endAdjustment: wall.params.endAdjustment,
        actualLength: wall.params.actualLength
      });
      
      console.log('  Mesh positions:', {
        mesh3D: wall.mesh3D?.position,
        mesh2D: wall.mesh2D?.position
      });
    }
  });
  
  // Test joinery analysis
  console.log('\n🔍 Testing joinery analysis...');
  const intersections = engine.analyzeWallIntersections(0.05);
  console.log(`Found ${intersections.length} intersections:`, intersections);
  
  // Get joinery info
  const joineryInfo = engine.getJoineryInfo();
  console.log('\n📊 Joinery Info:', joineryInfo);
  
  return {
    walls,
    intersections,
    joineryInfo
  };
}

// Test creating L-shaped walls to debug joinery
function testLShapedWalls() {
  console.log('🧪 TESTING L-SHAPED WALLS FOR JOINERY');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Clear existing objects
  engine.objects.clear();
  engine.scene3D.clear();
  engine.scene2D.clear();
  
  // Create two walls forming an L-shape
  const wall1Id = engine.createObject('wall', {
    length: 4,
    height: 2.7,
    thickness: 0.2,
    material: 'concrete',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 4, y: 0, z: 0 }
  });
  
  const wall2Id = engine.createObject('wall', {
    length: 3,
    height: 2.7,
    thickness: 0.2,
    material: 'concrete',
    startPoint: { x: 4, y: 0, z: 0 },
    endPoint: { x: 4, y: 0, z: 3 }
  });
  
  console.log(`Created walls: ${wall1Id}, ${wall2Id}`);
  
  // Wait for creation to complete, then apply joinery
  setTimeout(() => {
    console.log('🔧 Applying joinery to L-shaped walls...');
    engine.applyWallJoinery({
      tolerance: 0.05,
      cornerStyle: 'butt',
      tightCorners: true
    });
    
    // Debug the results
    setTimeout(() => {
      const result = debugWallJoinerySystem();
      console.log('🎯 L-shaped wall test results:', result);
    }, 500);
  }, 1000);
  
  return { wall1Id, wall2Id };
}

// Fix joinery positioning issues
function fixJoineryPositioning() {
  console.log('🔧 ATTEMPTING TO FIX JOINERY POSITIONING');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Force refresh joinery with enhanced settings
  console.log('🔄 Forcing joinery refresh...');
  engine.forceWallJoineryRefresh?.();
  
  // Apply joinery with tight settings
  setTimeout(() => {
    engine.applyWallJoinery({
      tolerance: 0.02,      // Very tight tolerance
      cornerStyle: 'butt',  // Force butt joints
      tightCorners: true    // Enhanced detection
    });
  }, 300);
  
  // Validate results
  setTimeout(() => {
    const validation = engine.validateWallJoinery();
    console.log('✅ Joinery validation:', validation);
    
    // Debug positioning
    const walls = Array.from(engine.objects.values()).filter(obj => obj.type === 'wall');
    walls.forEach(wall => {
      if (wall.params.adjustForJoinery) {
        console.log(`🎯 Wall ${wall.id} joinery positioning:`, {
          originalCenter: {
            x: (wall.params.startPoint.x + wall.params.endPoint.x) / 2,
            z: (wall.params.startPoint.z + wall.params.endPoint.z) / 2
          },
          adjustedCenter: {
            x: (wall.params.adjustedStartPoint.x + wall.params.adjustedEndPoint.x) / 2,
            z: (wall.params.adjustedStartPoint.z + wall.params.adjustedEndPoint.z) / 2
          },
          mesh3DPos: wall.mesh3D.position,
          mesh2DPos: wall.mesh2D.position
        });
      }
    });
  }, 800);
}

// Make functions globally available
window.debugWallJoinerySystem = debugWallJoinerySystem;
window.testLShapedWalls = testLShapedWalls;
window.fixJoineryPositioning = fixJoineryPositioning;

console.log(`
🔧 WALL JOINERY DEBUG TOOLS LOADED

Available functions:
- debugWallJoinerySystem() - Debug current wall joinery state
- testLShapedWalls() - Create L-shaped walls to test joinery
- fixJoineryPositioning() - Attempt to fix positioning issues

Usage: Open browser console and call any of these functions
`);