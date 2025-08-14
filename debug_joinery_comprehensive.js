/**
 * Comprehensive Wall Joinery Debugging Script
 * This will help us understand exactly what's happening at each step
 */

// Enable comprehensive debugging
function enableJoineryDebugging() {
  console.log('🔍 ENABLING COMPREHENSIVE JOINERY DEBUGGING');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Override the applyWallJoinery method to add debugging
  const originalApplyWallJoinery = engine.applyWallJoinery.bind(engine);
  
  engine.applyWallJoinery = function(joinerySettings = null) {
    console.log('\n🔧 ========== JOINERY DEBUG: applyWallJoinery CALLED ==========');
    console.log('Settings:', joinerySettings);
    
    // Get walls before joinery
    const wallsBefore = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
    console.log(`📊 Walls before joinery: ${wallsBefore.length}`);
    
    wallsBefore.forEach((wall, index) => {
      console.log(`Wall ${index + 1} (${wall.id}) BEFORE:`, {
        position: wall.position,
        mesh3DPos: wall.mesh3D?.position,
        mesh2DPos: wall.mesh2D?.position,
        params: {
          startPoint: wall.params?.startPoint,
          endPoint: wall.params?.endPoint,
          adjustedStartPoint: wall.params?.adjustedStartPoint,
          adjustedEndPoint: wall.params?.adjustedEndPoint,
          adjustForJoinery: wall.params?.adjustForJoinery,
          startAdjustment: wall.params?.startAdjustment,
          endAdjustment: wall.params?.endAdjustment,
          actualLength: wall.params?.actualLength
        }
      });
    });
    
    // Call original method
    const result = originalApplyWallJoinery(joinerySettings);
    
    // Get walls after joinery
    const wallsAfter = Array.from(this.objects.values()).filter(obj => obj.type === 'wall');
    console.log(`📊 Walls after joinery: ${wallsAfter.length}`);
    
    wallsAfter.forEach((wall, index) => {
      console.log(`Wall ${index + 1} (${wall.id}) AFTER:`, {
        position: wall.position,
        mesh3DPos: wall.mesh3D?.position,
        mesh2DPos: wall.mesh2D?.position,
        params: {
          startPoint: wall.params?.startPoint,
          endPoint: wall.params?.endPoint,
          adjustedStartPoint: wall.params?.adjustedStartPoint,
          adjustedEndPoint: wall.params?.adjustedEndPoint,
          adjustForJoinery: wall.params?.adjustForJoinery,
          startAdjustment: wall.params?.startAdjustment,
          endAdjustment: wall.params?.endAdjustment,
          actualLength: wall.params?.actualLength
        }
      });
      
      // Check if mesh positions match what they should be
      if (wall.params?.adjustForJoinery && wall.params?.adjustedStartPoint && wall.params?.adjustedEndPoint) {
        const expectedCenter = {
          x: (wall.params.adjustedStartPoint.x + wall.params.adjustedEndPoint.x) / 2,
          y: wall.params.height / 2,
          z: (wall.params.adjustedStartPoint.z + wall.params.adjustedEndPoint.z) / 2
        };
        
        const mesh3DMatch = Math.abs(wall.mesh3D.position.x - expectedCenter.x) < 0.01 &&
                           Math.abs(wall.mesh3D.position.z - expectedCenter.z) < 0.01;
        const mesh2DMatch = Math.abs(wall.mesh2D.position.x - expectedCenter.x) < 0.01 &&
                           Math.abs(wall.mesh2D.position.z - expectedCenter.z) < 0.01;
        
        console.log(`🎯 Position Check for Wall ${wall.id}:`, {
          expectedCenter,
          mesh3DMatch,
          mesh2DMatch,
          mesh3DActual: { x: wall.mesh3D.position.x, z: wall.mesh3D.position.z },
          mesh2DActual: { x: wall.mesh2D.position.x, z: wall.mesh2D.position.z }
        });
      }
    });
    
    console.log('🔧 ========== JOINERY DEBUG: applyWallJoinery COMPLETE ==========\n');
    return result;
  };
  
  console.log('✅ Joinery debugging enabled - applyWallJoinery method overridden');
}

// Debug the intersection analysis specifically
function debugIntersectionAnalysis() {
  console.log('\n🔍 DEBUGGING INTERSECTION ANALYSIS');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Get current walls
  const walls = Array.from(engine.objects.values()).filter(obj => obj.type === 'wall');
  console.log(`📊 Analyzing ${walls.length} walls for intersections`);
  
  walls.forEach((wall, index) => {
    console.log(`\nWall ${index + 1} (${wall.id}) data:`, {
      startPoint: wall.params?.startPoint,
      endPoint: wall.params?.endPoint,
      length: wall.params?.length,
      thickness: wall.params?.thickness || wall.params?.width
    });
  });
  
  // Manually check intersections
  const tolerance = 0.1;
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
      
      // Check all endpoint combinations
      const checks = [
        { w1Point: 'start', w2Point: 'start', p1: w1Start, p2: w2Start },
        { w1Point: 'start', w2Point: 'end', p1: w1Start, p2: w2End },
        { w1Point: 'end', w2Point: 'start', p1: w1End, p2: w2Start },
        { w1Point: 'end', w2Point: 'end', p1: w1End, p2: w2End }
      ];
      
      checks.forEach(check => {
        const distance = Math.sqrt(
          Math.pow(check.p1.x - check.p2.x, 2) + 
          Math.pow(check.p1.z - check.p2.z, 2)
        );
        
        console.log(`Distance between ${wall1.id}(${check.w1Point}) and ${wall2.id}(${check.w2Point}): ${distance.toFixed(4)}m`);
        
        if (distance <= tolerance) {
          intersections.push({
            wall1: wall1.id,
            wall2: wall2.id,
            connection: { w1Point: check.w1Point, w2Point: check.w2Point },
            distance: distance,
            position: check.p1
          });
          console.log(`🔗 INTERSECTION FOUND: ${wall1.id}(${check.w1Point}) ↔ ${wall2.id}(${check.w2Point}) at distance ${distance.toFixed(4)}m`);
        }
      });
    }
  }
  
  console.log(`\n📊 Manual intersection analysis found ${intersections.length} intersections:`, intersections);
  
  // Compare with engine's analysis
  const engineIntersections = engine.analyzeWallIntersections(tolerance);
  console.log(`📊 Engine intersection analysis found ${engineIntersections.length} intersections:`, engineIntersections);
  
  return { manual: intersections, engine: engineIntersections };
}

// Debug the 2D viewport rendering
function debug2DViewportRendering() {
  console.log('\n📺 DEBUGGING 2D VIEWPORT RENDERING');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  const walls = Array.from(engine.objects.values()).filter(obj => obj.type === 'wall');
  
  walls.forEach(wall => {
    console.log(`\n🧱 Wall ${wall.id} 2D rendering data:`, {
      // Object data
      objectPosition: wall.position,
      objectParams: {
        startPoint: wall.params?.startPoint,
        endPoint: wall.params?.endPoint,
        adjustedStartPoint: wall.params?.adjustedStartPoint,
        adjustedEndPoint: wall.params?.adjustedEndPoint,
        adjustForJoinery: wall.params?.adjustForJoinery,
        actualLength: wall.params?.actualLength,
        startAdjustment: wall.params?.startAdjustment,
        endAdjustment: wall.params?.endAdjustment
      },
      
      // Mesh data
      mesh2DPosition: wall.mesh2D?.position,
      mesh2DRotation: wall.mesh2D?.rotation,
      mesh2DType: wall.mesh2D?.type,
      
      // Expected calculations
      originalCenter: wall.params?.startPoint && wall.params?.endPoint ? {
        x: (wall.params.startPoint.x + wall.params.endPoint.x) / 2,
        z: (wall.params.startPoint.z + wall.params.endPoint.z) / 2
      } : null,
      
      adjustedCenter: wall.params?.adjustedStartPoint && wall.params?.adjustedEndPoint ? {
        x: (wall.params.adjustedStartPoint.x + wall.params.adjustedEndPoint.x) / 2,
        z: (wall.params.adjustedStartPoint.z + wall.params.adjustedEndPoint.z) / 2
      } : null
    });
    
    // Check if renderArchitecturalWall would get the right data
    if (wall.params?.adjustForJoinery) {
      console.log(`🎯 Wall ${wall.id} should use adjusted coordinates in 2D rendering`);
      
      if (wall.params?.adjustedStartPoint && wall.params?.adjustedEndPoint) {
        const expectedRotation = Math.atan2(
          wall.params.adjustedEndPoint.z - wall.params.adjustedStartPoint.z,
          wall.params.adjustedEndPoint.x - wall.params.adjustedStartPoint.x
        );
        console.log(`📐 Expected rotation: ${(expectedRotation * 180 / Math.PI).toFixed(2)}°`);
      }
    }
  });
}

// Test with simple walls and full debugging
function testWithFullDebugging() {
  console.log('\n🧪 TESTING WITH FULL DEBUGGING');
  
  enableJoineryDebugging();
  
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
  
  // Create simple L-shape
  console.log('🏗️ Creating simple L-shaped walls...');
  
  const wall1Id = engine.createObject('wall', {
    length: 3,
    height: 2.5,
    thickness: 0.2,
    material: 'concrete',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 3, y: 0, z: 0 }
  });
  
  const wall2Id = engine.createObject('wall', {
    length: 2,
    height: 2.5,
    thickness: 0.2,
    material: 'concrete',
    startPoint: { x: 3, y: 0, z: 0 },
    endPoint: { x: 3, y: 0, z: 2 }
  });
  
  console.log(`Created walls: ${wall1Id}, ${wall2Id}`);
  
  // Debug initial state
  setTimeout(() => {
    console.log('\n📊 INITIAL STATE (before joinery):');
    debugIntersectionAnalysis();
    debug2DViewportRendering();
    
    // Apply joinery
    console.log('\n🔧 Applying joinery...');
    engine.applyWallJoinery({
      tolerance: 0.05,
      cornerStyle: 'butt',
      tightCorners: true
    });
    
    // Debug after joinery
    setTimeout(() => {
      console.log('\n📊 FINAL STATE (after joinery):');
      debugIntersectionAnalysis();
      debug2DViewportRendering();
      
      // Force viewport refresh
      setTimeout(() => {
        console.log('\n🔄 Forcing viewport refresh...');
        engine.emit('objects_changed', {
          objects: engine.getAllObjects(),
          reason: 'debug_test'
        });
        
        console.log('✅ Debug test complete - check console output above for issues');
      }, 300);
      
    }, 800);
  }, 1000);
  
  return { wall1Id, wall2Id };
}

// Step-by-step joinery debugging
function stepByStepJoineryDebug() {
  console.log('\n🔍 STEP-BY-STEP JOINERY DEBUG');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  console.log('Step 1: Get current walls');
  const walls = Array.from(engine.objects.values()).filter(obj => obj.type === 'wall');
  console.log(`Found ${walls.length} walls`);
  
  console.log('Step 2: Analyze intersections');
  const intersections = engine.analyzeWallIntersections(0.05);
  console.log(`Found ${intersections.length} intersections:`, intersections);
  
  if (intersections.length === 0) {
    console.log('❌ No intersections found - check wall positioning');
    return;
  }
  
  console.log('Step 3: Check joinery application');
  intersections.forEach((intersection, index) => {
    console.log(`Intersection ${index + 1}:`, intersection);
    
    const wall1 = engine.objects.get(intersection.wall1);
    const wall2 = engine.objects.get(intersection.wall2);
    
    console.log(`Wall1 ${intersection.wall1} before:`, {
      adjustForJoinery: wall1.params?.adjustForJoinery,
      startAdjustment: wall1.params?.startAdjustment,
      endAdjustment: wall1.params?.endAdjustment
    });
    
    console.log(`Wall2 ${intersection.wall2} before:`, {
      adjustForJoinery: wall2.params?.adjustForJoinery,
      startAdjustment: wall2.params?.startAdjustment,
      endAdjustment: wall2.params?.endAdjustment
    });
  });
  
  console.log('Step 4: Manual joinery application');
  engine.applyWallJoinery({
    tolerance: 0.05,
    cornerStyle: 'butt',
    tightCorners: true
  });
  
  console.log('Step 5: Check results');
  intersections.forEach((intersection, index) => {
    const wall1 = engine.objects.get(intersection.wall1);
    const wall2 = engine.objects.get(intersection.wall2);
    
    console.log(`Wall1 ${intersection.wall1} after:`, {
      adjustForJoinery: wall1.params?.adjustForJoinery,
      startAdjustment: wall1.params?.startAdjustment,
      endAdjustment: wall1.params?.endAdjustment,
      adjustedStartPoint: wall1.params?.adjustedStartPoint,
      adjustedEndPoint: wall1.params?.adjustedEndPoint
    });
    
    console.log(`Wall2 ${intersection.wall2} after:`, {
      adjustForJoinery: wall2.params?.adjustForJoinery,
      startAdjustment: wall2.params?.startAdjustment,
      endAdjustment: wall2.params?.endAdjustment,
      adjustedStartPoint: wall2.params?.adjustedStartPoint,
      adjustedEndPoint: wall2.params?.adjustedEndPoint
    });
  });
}

// Global functions
window.enableJoineryDebugging = enableJoineryDebugging;
window.debugIntersectionAnalysis = debugIntersectionAnalysis;
window.debug2DViewportRendering = debug2DViewportRendering;
window.testWithFullDebugging = testWithFullDebugging;
window.stepByStepJoineryDebug = stepByStepJoineryDebug;

console.log(`
🔍 COMPREHENSIVE JOINERY DEBUGGING LOADED

Available functions:
- enableJoineryDebugging() - Override applyWallJoinery with debug logging
- debugIntersectionAnalysis() - Check intersection detection
- debug2DViewportRendering() - Check 2D viewport wall data
- testWithFullDebugging() - Create test walls with full debug output  
- stepByStepJoineryDebug() - Step through joinery process manually

Usage: 
1. First run testWithFullDebugging() to create test walls and see full debug output
2. Or run stepByStepJoineryDebug() on existing walls
3. Check console for detailed information at each step
`);