/**
 * Wall Joinery Fixes Test Script
 * Run this in the browser console to test the fixes for wall joinery rendering
 */

// Test the enhanced wall joinery system with fixed positioning
function testJoineryFixes() {
  console.log('🧪 TESTING WALL JOINERY FIXES');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Clear existing objects to start fresh
  console.log('🧹 Clearing existing objects...');
  engine.objects.clear();
  engine.scene3D.clear();
  engine.scene2D.clear();
  
  // Test 1: Simple L-shaped corner
  console.log('\n🧪 TEST 1: L-shaped corner joinery');
  
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
  
  console.log(`Created test walls: ${wall1Id}, ${wall2Id}`);
  
  // Apply joinery with enhanced settings
  setTimeout(() => {
    console.log('🔧 Applying enhanced joinery...');
    engine.applyWallJoinery({
      tolerance: 0.02,      // Very tight tolerance
      cornerStyle: 'butt',  // Force butt joints for clean corners
      tightCorners: true    // Enhanced corner detection
    });
    
    // Test 2: Validate results
    setTimeout(() => {
      console.log('\n🔍 TEST 2: Validating joinery results');
      
      const wall1 = engine.getObject(wall1Id);
      const wall2 = engine.getObject(wall2Id);
      
      console.log('Wall 1 joinery status:', {
        hasJoinery: wall1.params.adjustForJoinery,
        adjustments: {
          start: wall1.params.startAdjustment,
          end: wall1.params.endAdjustment
        },
        positions: {
          original: {
            start: wall1.params.startPoint,
            end: wall1.params.endPoint
          },
          adjusted: {
            start: wall1.params.adjustedStartPoint,
            end: wall1.params.adjustedEndPoint
          }
        },
        meshPositions: {
          mesh3D: wall1.mesh3D.position,
          mesh2D: wall1.mesh2D.position
        }
      });
      
      console.log('Wall 2 joinery status:', {
        hasJoinery: wall2.params.adjustForJoinery,
        adjustments: {
          start: wall2.params.startAdjustment,
          end: wall2.params.endAdjustment
        },
        positions: {
          original: {
            start: wall2.params.startPoint,
            end: wall2.params.endPoint
          },
          adjusted: {
            start: wall2.params.adjustedStartPoint,
            end: wall2.params.adjustedEndPoint
          }
        },
        meshPositions: {
          mesh3D: wall2.mesh3D.position,
          mesh2D: wall2.mesh2D.position
        }
      });
      
      // Check if corners are properly connected
      const joineryInfo = engine.getJoineryInfo();
      console.log('\n📊 Overall joinery info:', joineryInfo);
      
      // Test 3: Visual validation
      if (joineryInfo.intersections.length > 0) {
        console.log('✅ SUCCESS: Intersections detected and joinery applied');
        
        // Check if mesh positions match adjusted points
        const wall1AdjustedCenter = {
          x: (wall1.params.adjustedStartPoint.x + wall1.params.adjustedEndPoint.x) / 2,
          z: (wall1.params.adjustedStartPoint.z + wall1.params.adjustedEndPoint.z) / 2
        };
        
        const wall2AdjustedCenter = {
          x: (wall2.params.adjustedStartPoint.x + wall2.params.adjustedEndPoint.x) / 2,
          z: (wall2.params.adjustedStartPoint.z + wall2.params.adjustedEndPoint.z) / 2
        };
        
        const mesh1PosCorrect = Math.abs(wall1.mesh3D.position.x - wall1AdjustedCenter.x) < 0.01 &&
                               Math.abs(wall1.mesh3D.position.z - wall1AdjustedCenter.z) < 0.01;
        const mesh2PosCorrect = Math.abs(wall2.mesh3D.position.x - wall2AdjustedCenter.x) < 0.01 &&
                               Math.abs(wall2.mesh3D.position.z - wall2AdjustedCenter.z) < 0.01;
        
        if (mesh1PosCorrect && mesh2PosCorrect) {
          console.log('✅ SUCCESS: Mesh positions match adjusted coordinates');
        } else {
          console.log('⚠️ WARNING: Mesh positions may not match adjusted coordinates');
        }
        
      } else {
        console.log('❌ ISSUE: No intersections detected');
      }
      
    }, 600);
  }, 1000);
  
  return { wall1Id, wall2Id };
}

// Test complex room with multiple corners
function testComplexRoom() {
  console.log('\n🧪 TESTING COMPLEX ROOM JOINERY');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Clear existing objects
  engine.objects.clear();
  engine.scene3D.clear();
  engine.scene2D.clear();
  
  // Create a rectangular room
  const walls = [
    { start: { x: 0, y: 0, z: 0 }, end: { x: 6, y: 0, z: 0 } },    // Bottom wall
    { start: { x: 6, y: 0, z: 0 }, end: { x: 6, y: 0, z: 4 } },    // Right wall
    { start: { x: 6, y: 0, z: 4 }, end: { x: 0, y: 0, z: 4 } },    // Top wall
    { start: { x: 0, y: 0, z: 4 }, end: { x: 0, y: 0, z: 0 } }     // Left wall
  ];
  
  const wallIds = walls.map((wall, index) => {
    const wallId = engine.createObject('wall', {
      length: Math.sqrt(
        Math.pow(wall.end.x - wall.start.x, 2) + 
        Math.pow(wall.end.z - wall.start.z, 2)
      ),
      height: 2.7,
      thickness: 0.2,
      material: 'concrete',
      startPoint: wall.start,
      endPoint: wall.end
    });
    console.log(`Created room wall ${index + 1}: ${wallId}`);
    return wallId;
  });
  
  // Apply joinery to the room
  setTimeout(() => {
    console.log('🔧 Applying joinery to rectangular room...');
    engine.applyWallJoinery({
      tolerance: 0.02,
      cornerStyle: 'butt',
      tightCorners: true
    });
    
    // Validate room joinery
    setTimeout(() => {
      console.log('\n📊 Room joinery validation:');
      
      const joineryInfo = engine.getJoineryInfo();
      console.log('Total intersections found:', joineryInfo.intersections.length);
      console.log('Walls with joinery applied:', joineryInfo.wallsWithJoinery);
      
      if (joineryInfo.intersections.length === 4 && joineryInfo.wallsWithJoinery === 4) {
        console.log('✅ SUCCESS: All 4 corners properly joined');
      } else {
        console.log('⚠️ WARNING: Not all corners properly joined');
      }
      
      // Check each wall's joinery status
      wallIds.forEach((wallId, index) => {
        const wall = engine.getObject(wallId);
        console.log(`Wall ${index + 1} (${wallId}):`, {
          hasJoinery: wall.params.adjustForJoinery,
          startAdj: wall.params.startAdjustment?.toFixed(3),
          endAdj: wall.params.endAdjustment?.toFixed(3)
        });
      });
      
    }, 800);
  }, 1500);
  
  return wallIds;
}

// Make functions globally available
window.testJoineryFixes = testJoineryFixes;
window.testComplexRoom = testComplexRoom;

console.log(`
🔧 WALL JOINERY FIXES TEST SCRIPT LOADED

Available functions:
- testJoineryFixes() - Test L-shaped corner with fixes
- testComplexRoom() - Test rectangular room with 4 corners

Run these tests to verify that the joinery fixes work correctly.
The fixes include:
1. ✅ Proper mesh position updates after joinery adjustments
2. ✅ Enhanced viewport refresh after joinery application  
3. ✅ Correct coordinate synchronization between 2D and 3D views

Usage: Open browser console and call testJoineryFixes() or testComplexRoom()
`);