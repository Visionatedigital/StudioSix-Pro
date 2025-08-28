/**
 * Manual Wall Corner Fix Script
 * 
 * Run this in the browser console to force wall corners to join properly
 */

// Function to manually fix wall corners
function fixWallCorners() {
  console.log('🔧 MANUAL FIX: Forcing wall corner joinery...');
  
  // Get the CAD engine from the app
  const cadEngine = window.standaloneCADEngine;
  
  if (!cadEngine) {
    console.error('❌ CAD Engine not found. Make sure the app is loaded.');
    return;
  }
  
  // Force refresh wall joinery with enhanced settings
  console.log('🔧 Applying enhanced overlap joinery...');
  
  const result = cadEngine.applyWallJoinery({
    tolerance: 1.0,           // Very generous 1m tolerance
    cornerStyle: 'overlap',   // Use overlap joints for best results
    tightCorners: false,
    autoExtend: true
  });
  
  if (result) {
    console.log('✅ Wall corner fix applied successfully!');
    console.log('🔄 If gaps persist, try calling fixWallCorners() again');
  } else {
    console.log('❌ Wall corner fix failed. Check if walls are close enough to each other.');
    console.log('💡 Try moving walls closer together (within 1 meter) and run again.');
  }
  
  return result;
}

// Function to debug wall positions
function debugWallPositions() {
  console.log('🔍 DEBUGGING: Wall positions and distances...');
  
  const cadEngine = window.standaloneCADEngine;
  if (!cadEngine) {
    console.error('❌ CAD Engine not found.');
    return;
  }
  
  const walls = Array.from(cadEngine.objects.values()).filter(obj => obj.type === 'wall');
  console.log(`📊 Found ${walls.length} walls:`);
  
  walls.forEach((wall, index) => {
    console.log(`Wall ${index + 1} (${wall.id}):`);
    console.log(`  Start: [${wall.params?.startPoint?.x?.toFixed(2)}, ${wall.params?.startPoint?.z?.toFixed(2)}]`);
    console.log(`  End: [${wall.params?.endPoint?.x?.toFixed(2)}, ${wall.params?.endPoint?.z?.toFixed(2)}]`);
    console.log(`  Length: ${(wall.params?.length || 0).toFixed(2)}m`);
    console.log(`  Thickness: ${(wall.params?.thickness || 0.2).toFixed(2)}m`);
  });
  
  // Check distances between wall endpoints
  if (walls.length >= 2) {
    console.log('\n🔍 Wall endpoint distances:');
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const wall1 = walls[i];
        const wall2 = walls[j];
        
        const distances = [
          { name: `Wall${i+1}.start ↔ Wall${j+1}.start`, 
            dist: Math.sqrt(
              Math.pow(wall1.params.startPoint.x - wall2.params.startPoint.x, 2) + 
              Math.pow(wall1.params.startPoint.z - wall2.params.startPoint.z, 2)
            ) },
          { name: `Wall${i+1}.start ↔ Wall${j+1}.end`, 
            dist: Math.sqrt(
              Math.pow(wall1.params.startPoint.x - wall2.params.endPoint.x, 2) + 
              Math.pow(wall1.params.startPoint.z - wall2.params.endPoint.z, 2)
            ) },
          { name: `Wall${i+1}.end ↔ Wall${j+1}.start`, 
            dist: Math.sqrt(
              Math.pow(wall1.params.endPoint.x - wall2.params.startPoint.x, 2) + 
              Math.pow(wall1.params.endPoint.z - wall2.params.startPoint.z, 2)
            ) },
          { name: `Wall${i+1}.end ↔ Wall${j+1}.end`, 
            dist: Math.sqrt(
              Math.pow(wall1.params.endPoint.x - wall2.params.endPoint.x, 2) + 
              Math.pow(wall1.params.endPoint.z - wall2.params.endPoint.z, 2)
            ) }
        ];
        
        distances.forEach(d => {
          if (d.dist < 1.0) { // Within 1m
            console.log(`  ${d.name}: ${d.dist.toFixed(3)}m ${d.dist < 0.5 ? '✅ CLOSE' : '⚠️ MEDIUM'}`);
          }
        });
      }
    }
  }
}

// Make functions available globally
window.fixWallCorners = fixWallCorners;
window.debugWallPositions = debugWallPositions;

console.log('🔧 Wall corner fix script loaded!');
console.log('📞 Run fixWallCorners() to fix wall corners');
console.log('🔍 Run debugWallPositions() to see wall positions');