/**
 * Manual Wall Joinery Fix
 * Bypasses the infinite loop issue in applyWallJoinery
 */

function manualJoineryFix() {
  console.log('🔧 MANUAL JOINERY FIX - Bypassing infinite loop');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Get all walls
  const walls = Array.from(engine.objects.values()).filter(obj => obj.type === 'wall');
  console.log(`Found ${walls.length} walls`);
  
  if (walls.length < 2) {
    console.log('Need at least 2 walls for joinery');
    return;
  }
  
  // Manual intersection detection (bypass the buggy method)
  console.log('🔍 Manual intersection detection...');
  const tolerance = 0.05;
  const intersections = [];
  
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const wall1 = walls[i];
      const wall2 = walls[j];
      
      const w1Start = wall1.params?.startPoint;
      const w1End = wall1.params?.endPoint;
      const w2Start = wall2.params?.startPoint;
      const w2End = wall2.params?.endPoint;
      
      if (!w1Start || !w1End || !w2Start || !w2End) continue;
      
      // Check endpoint connections
      const connections = [
        { w1Point: 'start', w2Point: 'start', p1: w1Start, p2: w2Start },
        { w1Point: 'start', w2Point: 'end', p1: w1Start, p2: w2End },
        { w1Point: 'end', w2Point: 'start', p1: w1End, p2: w2Start },
        { w1Point: 'end', w2Point: 'end', p1: w1End, p2: w2End }
      ];
      
      connections.forEach(conn => {
        const distance = Math.sqrt(
          Math.pow(conn.p1.x - conn.p2.x, 2) + 
          Math.pow(conn.p1.z - conn.p2.z, 2)
        );
        
        if (distance <= tolerance) {
          intersections.push({
            wall1: wall1.id,
            wall2: wall2.id,
            connection: { w1Point: conn.w1Point, w2Point: conn.w2Point },
            distance: distance,
            position: conn.p1
          });
          console.log(`🔗 Found intersection: ${wall1.id}(${conn.w1Point}) ↔ ${wall2.id}(${conn.w2Point}) at distance ${distance.toFixed(4)}m`);
        }
      });
    }
  }
  
  console.log(`Found ${intersections.length} intersections`);
  
  if (intersections.length === 0) {
    console.log('❌ No intersections found for joinery');
    return;
  }
  
  // Manual joinery application for each intersection
  console.log('🔧 Applying joinery manually...');
  
  intersections.forEach((intersection, index) => {
    console.log(`Processing intersection ${index + 1}:`, intersection);
    
    const wall1 = engine.objects.get(intersection.wall1);
    const wall2 = engine.objects.get(intersection.wall2);
    
    if (!wall1 || !wall2) return;
    
    const thickness = wall1.params?.thickness || wall1.params?.width || 0.2;
    const halfThickness = thickness / 2;
    
    // Apply butt joint logic
    const conn = intersection.connection;
    
    // For wall1
    if (conn.w1Point === 'start') {
      wall1.params.startAdjustment = halfThickness;
    } else {
      wall1.params.endAdjustment = halfThickness;
    }
    
    // For wall2  
    if (conn.w2Point === 'start') {
      wall2.params.startAdjustment = halfThickness;
    } else {
      wall2.params.endAdjustment = halfThickness;
    }
    
    // Calculate adjusted points for wall1
    const w1Start = wall1.params.startPoint;
    const w1End = wall1.params.endPoint;
    const w1Vector = { x: w1End.x - w1Start.x, z: w1End.z - w1Start.z };
    const w1Length = Math.sqrt(w1Vector.x * w1Vector.x + w1Vector.z * w1Vector.z);
    const w1Unit = { x: w1Vector.x / w1Length, z: w1Vector.z / w1Length };
    
    const startAdjust1 = wall1.params.startAdjustment || 0;
    const endAdjust1 = wall1.params.endAdjustment || 0;
    
    wall1.params.adjustedStartPoint = {
      x: w1Start.x + w1Unit.x * startAdjust1,
      y: w1Start.y,
      z: w1Start.z + w1Unit.z * startAdjust1
    };
    
    wall1.params.adjustedEndPoint = {
      x: w1End.x - w1Unit.x * endAdjust1,
      y: w1End.y,
      z: w1End.z - w1Unit.z * endAdjust1
    };
    
    wall1.params.actualLength = w1Length - startAdjust1 - endAdjust1;
    wall1.params.adjustForJoinery = true;
    
    // Calculate adjusted points for wall2
    const w2Start = wall2.params.startPoint;
    const w2End = wall2.params.endPoint;
    const w2Vector = { x: w2End.x - w2Start.x, z: w2End.z - w2Start.z };
    const w2Length = Math.sqrt(w2Vector.x * w2Vector.x + w2Vector.z * w2Vector.z);
    const w2Unit = { x: w2Vector.x / w2Length, z: w2Vector.z / w2Length };
    
    const startAdjust2 = wall2.params.startAdjustment || 0;
    const endAdjust2 = wall2.params.endAdjustment || 0;
    
    wall2.params.adjustedStartPoint = {
      x: w2Start.x + w2Unit.x * startAdjust2,
      y: w2Start.y,
      z: w2Start.z + w2Unit.z * startAdjust2
    };
    
    wall2.params.adjustedEndPoint = {
      x: w2End.x - w2Unit.x * endAdjust2,
      y: w2End.y,
      z: w2End.z - w2Unit.z * endAdjust2
    };
    
    wall2.params.actualLength = w2Length - startAdjust2 - endAdjust2;
    wall2.params.adjustForJoinery = true;
    
    console.log(`Applied joinery to walls ${wall1.id} and ${wall2.id}`);
  });
  
  // Update mesh positions using the fixed logic
  console.log('🔄 Updating mesh positions...');
  
  walls.forEach(wall => {
    if (wall.params.adjustForJoinery && wall.params.adjustedStartPoint && wall.params.adjustedEndPoint) {
      // Calculate adjusted center
      const adjustedCenter = {
        x: (wall.params.adjustedStartPoint.x + wall.params.adjustedEndPoint.x) / 2,
        y: wall.params.height / 2,
        z: (wall.params.adjustedStartPoint.z + wall.params.adjustedEndPoint.z) / 2
      };
      
      // Update 3D mesh position
      if (wall.mesh3D) {
        wall.mesh3D.position.set(adjustedCenter.x, adjustedCenter.y, adjustedCenter.z);
        console.log(`Updated 3D mesh for ${wall.id}:`, adjustedCenter);
      }
      
      // Update 2D mesh position
      if (wall.mesh2D) {
        wall.mesh2D.position.set(adjustedCenter.x, 0, adjustedCenter.z);
        console.log(`Updated 2D mesh for ${wall.id}:`, { x: adjustedCenter.x, z: adjustedCenter.z });
      }
      
      // Update wall object position
      wall.position = adjustedCenter;
    }
  });
  
  // Force viewport refresh
  console.log('🔄 Forcing viewport refresh...');
  engine.emit('objects_changed', {
    objects: engine.getAllObjects(),
    reason: 'manual_joinery_fix'
  });
  
  console.log('✅ Manual joinery fix complete!');
  console.log('Check both 2D and 3D viewports - walls should now show proper corner connections');
  
  return intersections;
}

// Create walls and apply manual fix
function testManualJoineryFix() {
  console.log('🧪 TESTING MANUAL JOINERY FIX');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Clear scene
  console.log('🧹 Clearing scene...');
  engine.objects.clear();
  engine.scene3D.clear();
  engine.scene2D.clear();
  
  // Create test walls
  console.log('🏗️ Creating test walls...');
  
  const wall1Id = engine.createObject('wall', {
    length: 2,
    height: 2.5,
    thickness: 0.2,
    material: 'concrete',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 2, y: 0, z: 0 }
  });
  
  const wall2Id = engine.createObject('wall', {
    length: 1.5,
    height: 2.5,
    thickness: 0.2,
    material: 'concrete',
    startPoint: { x: 2, y: 0, z: 0 },
    endPoint: { x: 2, y: 0, z: 1.5 }
  });
  
  console.log(`Created walls: ${wall1Id}, ${wall2Id}`);
  
  // Wait for creation, then apply manual fix
  setTimeout(() => {
    console.log('🔧 Applying manual joinery fix...');
    manualJoineryFix();
  }, 1000);
  
  return { wall1Id, wall2Id };
}

// Make functions globally available
window.manualJoineryFix = manualJoineryFix;
window.testManualJoineryFix = testManualJoineryFix;

console.log(`
🔧 MANUAL JOINERY FIX LOADED

Available functions:
- manualJoineryFix() - Apply joinery manually, bypassing infinite loop
- testManualJoineryFix() - Create test walls and apply manual fix

This bypasses the infinite loop issue in applyWallJoinery by:
1. Manual intersection detection
2. Direct application of joinery parameters 
3. Manual mesh position updates
4. Viewport refresh

Usage: Run testManualJoineryFix() to test with new walls
       Or manualJoineryFix() to fix existing walls
`);