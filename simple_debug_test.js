/**
 * Simple Debug Test for Wall Joinery
 * Run this to create two walls and see exactly what happens
 */

function simpleJoineryDebugTest() {
  console.log('🔍 SIMPLE JOINERY DEBUG TEST');
  console.log('This will create two walls and show detailed debug output');
  
  if (!window.standaloneCADEngine) {
    console.error('❌ StandaloneCADEngine not available');
    return;
  }
  
  const engine = window.standaloneCADEngine;
  
  // Clear everything
  console.log('🧹 Clearing scene...');
  engine.objects.clear();
  engine.scene3D.clear();
  engine.scene2D.clear();
  
  // Create two simple walls that should connect
  console.log('\n🏗️ Creating two walls that should connect at (2,0,0)...');
  
  console.log('Creating Wall 1: (0,0,0) to (2,0,0)');
  const wall1Id = engine.createObject('wall', {
    length: 2,
    height: 2.5,
    thickness: 0.2,
    material: 'concrete',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 2, y: 0, z: 0 }
  });
  
  console.log('Creating Wall 2: (2,0,0) to (2,0,1.5)');
  const wall2Id = engine.createObject('wall', {
    length: 1.5,
    height: 2.5,
    thickness: 0.2,
    material: 'concrete',
    startPoint: { x: 2, y: 0, z: 0 },
    endPoint: { x: 2, y: 0, z: 1.5 }
  });
  
  console.log(`\n✅ Created walls: ${wall1Id} and ${wall2Id}`);
  
  // Wait for creation to complete, then check initial state
  setTimeout(() => {
    console.log('\n📊 INITIAL STATE CHECK:');
    
    const wall1 = engine.getObject(wall1Id);
    const wall2 = engine.getObject(wall2Id);
    
    console.log('Wall 1 initial state:', {
      id: wall1.id,
      position: wall1.position,
      mesh3DPos: wall1.mesh3D?.position,
      mesh2DPos: wall1.mesh2D?.position,
      startPoint: wall1.params?.startPoint,
      endPoint: wall1.params?.endPoint,
      hasJoinery: wall1.params?.adjustForJoinery
    });
    
    console.log('Wall 2 initial state:', {
      id: wall2.id,
      position: wall2.position,
      mesh3DPos: wall2.mesh3D?.position,
      mesh2DPos: wall2.mesh2D?.position,
      startPoint: wall2.params?.startPoint,
      endPoint: wall2.params?.endPoint,
      hasJoinery: wall2.params?.adjustForJoinery
    });
    
    // Now apply joinery
    console.log('\n🔧 APPLYING JOINERY...');
    console.log('Watch for debug output from applyWallJoinery...');
    
    engine.applyWallJoinery({
      tolerance: 0.05,
      cornerStyle: 'butt',
      tightCorners: true
    });
    
    // Check state after joinery
    setTimeout(() => {
      console.log('\n📊 POST-JOINERY STATE CHECK:');
      
      const wall1After = engine.getObject(wall1Id);
      const wall2After = engine.getObject(wall2Id);
      
      console.log('Wall 1 after joinery:', {
        id: wall1After.id,
        position: wall1After.position,
        mesh3DPos: wall1After.mesh3D?.position,
        mesh2DPos: wall1After.mesh2D?.position,
        hasJoinery: wall1After.params?.adjustForJoinery,
        adjustedStartPoint: wall1After.params?.adjustedStartPoint,
        adjustedEndPoint: wall1After.params?.adjustedEndPoint,
        startAdjustment: wall1After.params?.startAdjustment,
        endAdjustment: wall1After.params?.endAdjustment,
        actualLength: wall1After.params?.actualLength
      });
      
      console.log('Wall 2 after joinery:', {
        id: wall2After.id,
        position: wall2After.position,
        mesh3DPos: wall2After.mesh3D?.position,
        mesh2DPos: wall2After.mesh2D?.position,
        hasJoinery: wall2After.params?.adjustForJoinery,
        adjustedStartPoint: wall2After.params?.adjustedStartPoint,
        adjustedEndPoint: wall2After.params?.adjustedEndPoint,
        startAdjustment: wall2After.params?.startAdjustment,
        endAdjustment: wall2After.params?.endAdjustment,
        actualLength: wall2After.params?.actualLength
      });
      
      // Check joinery info
      const joineryInfo = engine.getJoineryInfo();
      console.log('\nJoinery Info:', joineryInfo);
      
      // Force viewport refresh to trigger 2D rendering debug
      console.log('\n🔄 FORCING VIEWPORT REFRESH...');
      console.log('Watch for debug output from 2D viewport rendering...');
      
      engine.emit('objects_changed', {
        objects: engine.getAllObjects(),
        reason: 'debug_test'
      });
      
      console.log('\n✅ DEBUG TEST COMPLETE');
      console.log('Check the console output above to see:');
      console.log('1. Initial wall state');
      console.log('2. Joinery calculation process');
      console.log('3. Final wall state after joinery');
      console.log('4. 2D viewport rendering debug output');
      
    }, 800);
    
  }, 1000);
  
  return { wall1Id, wall2Id };
}

window.simpleJoineryDebugTest = simpleJoineryDebugTest;

console.log(`
🔍 SIMPLE JOINERY DEBUG TEST LOADED

Run: simpleJoineryDebugTest()

This will:
1. Create two walls that should connect at a corner
2. Apply joinery 
3. Show detailed debug output at each step
4. Help identify exactly where the issue is occurring

The debug output will show you:
- Wall creation and initial positions
- Joinery calculation process  
- Final wall states after joinery
- 2D viewport rendering process
`);