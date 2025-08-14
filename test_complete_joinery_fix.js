/**
 * Complete Wall Joinery Fix Test Script
 * Tests both 3D engine fixes and 2D viewport rendering fixes
 */

// Test the complete joinery system with both 3D and 2D fixes
function testCompleteJoineryFix() {
  console.log('🧪 TESTING COMPLETE WALL JOINERY FIX (3D Engine + 2D Viewport)');
  
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
  
  // Test with L-shaped walls that should show joinery
  console.log('\n🧪 TEST: Creating L-shaped walls for joinery test');
  
  const wall1Id = engine.createObject('wall', {
    length: 5,
    height: 2.7,
    thickness: 0.2,
    material: 'concrete',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 5, y: 0, z: 0 }
  });
  
  const wall2Id = engine.createObject('wall', {
    length: 4,
    height: 2.7,
    thickness: 0.2,
    material: 'concrete',
    startPoint: { x: 5, y: 0, z: 0 },
    endPoint: { x: 5, y: 0, z: 4 }
  });
  
  console.log(`Created L-shaped walls: ${wall1Id}, ${wall2Id}`);
  
  // Apply joinery with enhanced settings after walls are created
  setTimeout(() => {
    console.log('\n🔧 Applying joinery with tight tolerance...');
    engine.applyWallJoinery({
      tolerance: 0.01,      // Very tight for clean joints
      cornerStyle: 'butt',  // Force butt joints
      tightCorners: true    // Enhanced detection
    });
    
    // Test validation after joinery is applied
    setTimeout(() => {
      console.log('\n📊 VALIDATION: Checking joinery results');
      
      const wall1 = engine.getObject(wall1Id);
      const wall2 = engine.getObject(wall2Id);
      
      // Test 1: Check if joinery was applied to objects
      const wall1HasJoinery = wall1.params.adjustForJoinery;
      const wall2HasJoinery = wall2.params.adjustForJoinery;
      
      console.log('Wall joinery status:', {
        wall1: {
          hasJoinery: wall1HasJoinery,
          adjustments: {
            start: wall1.params.startAdjustment?.toFixed(3),
            end: wall1.params.endAdjustment?.toFixed(3)
          },
          adjustedPoints: {
            start: wall1.params.adjustedStartPoint,
            end: wall1.params.adjustedEndPoint
          }
        },
        wall2: {
          hasJoinery: wall2HasJoinery,
          adjustments: {
            start: wall2.params.startAdjustment?.toFixed(3),
            end: wall2.params.endAdjustment?.toFixed(3)
          },
          adjustedPoints: {
            start: wall2.params.adjustedStartPoint,
            end: wall2.params.adjustedEndPoint
          }
        }
      });
      
      // Test 2: Check 3D mesh positions
      const wall1MeshCorrect = wall1HasJoinery && wall1.params.adjustedStartPoint && wall1.params.adjustedEndPoint;
      const wall2MeshCorrect = wall2HasJoinery && wall2.params.adjustedStartPoint && wall2.params.adjustedEndPoint;
      
      if (wall1MeshCorrect && wall2MeshCorrect) {
        const wall1ExpectedCenter = {
          x: (wall1.params.adjustedStartPoint.x + wall1.params.adjustedEndPoint.x) / 2,
          y: wall1.params.height / 2,
          z: (wall1.params.adjustedStartPoint.z + wall1.params.adjustedEndPoint.z) / 2
        };
        
        const wall2ExpectedCenter = {
          x: (wall2.params.adjustedStartPoint.x + wall2.params.adjustedEndPoint.x) / 2,
          y: wall2.params.height / 2,
          z: (wall2.params.adjustedStartPoint.z + wall2.params.adjustedEndPoint.z) / 2
        };
        
        const wall1PosMatch = Math.abs(wall1.mesh3D.position.x - wall1ExpectedCenter.x) < 0.01 &&
                             Math.abs(wall1.mesh3D.position.z - wall1ExpectedCenter.z) < 0.01;
        const wall2PosMatch = Math.abs(wall2.mesh3D.position.x - wall2ExpectedCenter.x) < 0.01 &&
                             Math.abs(wall2.mesh3D.position.z - wall2ExpectedCenter.z) < 0.01;
        
        console.log('3D Mesh position validation:', {
          wall1: {
            expected: wall1ExpectedCenter,
            actual: wall1.mesh3D.position,
            matches: wall1PosMatch
          },
          wall2: {
            expected: wall2ExpectedCenter,
            actual: wall2.mesh3D.position,
            matches: wall2PosMatch
          }
        });
        
        // Test 3: Check 2D mesh positions  
        const wall1Mesh2DMatch = Math.abs(wall1.mesh2D.position.x - wall1ExpectedCenter.x) < 0.01 &&
                                Math.abs(wall1.mesh2D.position.z - wall1ExpectedCenter.z) < 0.01;
        const wall2Mesh2DMatch = Math.abs(wall2.mesh2D.position.x - wall2ExpectedCenter.x) < 0.01 &&
                                Math.abs(wall2.mesh2D.position.z - wall2ExpectedCenter.z) < 0.01;
        
        console.log('2D Mesh position validation:', {
          wall1: {
            expected: { x: wall1ExpectedCenter.x, z: wall1ExpectedCenter.z },
            actual: wall1.mesh2D.position,
            matches: wall1Mesh2DMatch
          },
          wall2: {
            expected: { x: wall2ExpectedCenter.x, z: wall2ExpectedCenter.z },
            actual: wall2.mesh2D.position,
            matches: wall2Mesh2DMatch
          }
        });
        
        // Final assessment
        const allTestsPassed = wall1PosMatch && wall2PosMatch && wall1Mesh2DMatch && wall2Mesh2DMatch;
        
        if (allTestsPassed) {
          console.log('✅ SUCCESS: All joinery fixes working correctly!');
          console.log('  ✅ 3D Engine: Joinery calculations and mesh positioning');
          console.log('  ✅ 2D Viewport: Adjusted coordinate rendering');
          console.log('  ✅ Both viewports should now show proper corner connections');
        } else {
          console.log('❌ PARTIAL: Some issues remain:');
          if (!wall1PosMatch || !wall2PosMatch) console.log('  ❌ 3D mesh positioning issues');
          if (!wall1Mesh2DMatch || !wall2Mesh2DMatch) console.log('  ❌ 2D mesh positioning issues');
        }
        
      } else {
        console.log('⚠️ WARNING: Adjusted points not calculated properly');
      }
      
      // Test 4: Overall joinery info
      const joineryInfo = engine.getJoineryInfo();
      console.log('\nOverall joinery summary:', joineryInfo);
      
      // Force viewport refresh to ensure changes are visible
      setTimeout(() => {
        console.log('\n🔄 Forcing viewport refresh to display changes...');
        
        // Trigger object update for both walls
        engine.emit('objects_changed', {
          objects: engine.getAllObjects(),
          reason: 'test_validation'
        });
        
        console.log('✅ Test complete! Check both 2D and 3D viewports for proper corner connections.');
      }, 300);
      
    }, 800);
  }, 1000);
  
  return { wall1Id, wall2Id };
}

// Test a complete rectangular room
function testRoomJoineryComplete() {
  console.log('\n🏠 TESTING COMPLETE ROOM JOINERY');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Clear existing objects
  engine.objects.clear();
  engine.scene3D.clear();
  engine.scene2D.clear();
  
  // Create a 4x3 meter room
  const roomWalls = [
    { start: { x: 0, y: 0, z: 0 }, end: { x: 4, y: 0, z: 0 }, name: 'South Wall' },
    { start: { x: 4, y: 0, z: 0 }, end: { x: 4, y: 0, z: 3 }, name: 'East Wall' },
    { start: { x: 4, y: 0, z: 3 }, end: { x: 0, y: 0, z: 3 }, name: 'North Wall' },
    { start: { x: 0, y: 0, z: 3 }, end: { x: 0, y: 0, z: 0 }, name: 'West Wall' }
  ];
  
  const wallIds = roomWalls.map((wall, index) => {
    const length = Math.sqrt(
      Math.pow(wall.end.x - wall.start.x, 2) + 
      Math.pow(wall.end.z - wall.start.z, 2)
    );
    
    const wallId = engine.createObject('wall', {
      length: length,
      height: 2.7,
      thickness: 0.2,
      material: 'concrete',
      startPoint: wall.start,
      endPoint: wall.end
    });
    
    console.log(`Created ${wall.name}: ${wallId} (${length.toFixed(1)}m)`);
    return wallId;
  });
  
  // Apply joinery to the room
  setTimeout(() => {
    console.log('🔧 Applying room joinery...');
    engine.applyWallJoinery({
      tolerance: 0.01,
      cornerStyle: 'butt',
      tightCorners: true
    });
    
    // Validate all corners
    setTimeout(() => {
      console.log('\n📊 Room joinery validation:');
      
      const joineryInfo = engine.getJoineryInfo();
      const expectedIntersections = 4; // 4 corners
      const expectedWallsWithJoinery = 4; // All 4 walls
      
      console.log(`Found ${joineryInfo.intersections.length}/${expectedIntersections} intersections`);
      console.log(`Applied joinery to ${joineryInfo.wallsWithJoinery}/${expectedWallsWithJoinery} walls`);
      
      if (joineryInfo.intersections.length === expectedIntersections && 
          joineryInfo.wallsWithJoinery === expectedWallsWithJoinery) {
        console.log('✅ SUCCESS: Complete room joinery applied correctly!');
        console.log('  All 4 corners should show clean connections in both 2D and 3D');
      } else {
        console.log('⚠️ WARNING: Room joinery not complete');
      }
      
      // Force refresh
      setTimeout(() => {
        engine.emit('objects_changed', {
          objects: engine.getAllObjects(),
          reason: 'room_test_validation'
        });
        console.log('🔄 Room test complete - check viewports!');
      }, 200);
      
    }, 1000);
  }, 1500);
  
  return wallIds;
}

// Manual joinery refresh function
function forceJoineryRefresh() {
  console.log('🔧 MANUAL: Force refreshing joinery...');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Apply joinery with enhanced settings
  engine.applyWallJoinery({
    tolerance: 0.01,
    cornerStyle: 'butt',
    tightCorners: true
  });
  
  // Force viewport refresh
  setTimeout(() => {
    engine.emit('objects_changed', {
      objects: engine.getAllObjects(),
      reason: 'manual_refresh'
    });
    console.log('✅ Manual joinery refresh complete');
  }, 500);
}

// Make functions globally available
window.testCompleteJoineryFix = testCompleteJoineryFix;
window.testRoomJoineryComplete = testRoomJoineryComplete;
window.forceJoineryRefresh = forceJoineryRefresh;

console.log(`
🔧 COMPLETE WALL JOINERY FIX TEST SCRIPT LOADED

Available functions:
- testCompleteJoineryFix() - Test L-corner with complete fixes
- testRoomJoineryComplete() - Test full room with 4 corners  
- forceJoineryRefresh() - Manual joinery refresh

The fixes include:
✅ 3D Engine Fixes:
  - Proper mesh position updates after joinery calculations
  - Enhanced viewport refresh timing
  - Coordinate synchronization between calculations and visuals

✅ 2D Viewport Fixes:  
  - renderArchitecturalWall uses adjusted start/end points
  - Correct position and rotation calculations from joinery data
  - All rendering elements use adjusted coordinates and transforms

Usage: Open browser console and run testCompleteJoineryFix()
`);