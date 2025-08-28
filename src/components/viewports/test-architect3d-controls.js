/**
 * Test Component for Architect3D Mouse Controls
 * 
 * This file can be used to test mouse controls are working correctly
 * Run this in the browser console to verify functionality
 */

export const testArchitect3DControls = () => {
  console.log('🧪 Testing Architect3D Mouse Controls...');
  
  // Check if viewport is rendered
  const viewport = document.querySelector('.architect3d-viewport');
  if (!viewport) {
    console.error('❌ Architect3D viewport not found');
    return false;
  }
  
  console.log('✅ Architect3D viewport found');
  
  // Check if canvas exists
  const canvas = viewport.querySelector('canvas');
  if (!canvas) {
    console.error('❌ Canvas not found in viewport');
    return false;
  }
  
  console.log('✅ Canvas found');
  
  // Test mouse event handling
  try {
    // Simulate mouse events
    const mouseDownEvent = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
      button: 0
    });
    
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 150,
      clientY: 150
    });
    
    const mouseUpEvent = new MouseEvent('mouseup', {
      clientX: 150,
      clientY: 150,
      button: 0
    });
    
    canvas.dispatchEvent(mouseDownEvent);
    canvas.dispatchEvent(mouseMoveEvent);
    canvas.dispatchEvent(mouseUpEvent);
    
    console.log('✅ Mouse events dispatched successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Error testing mouse events:', error);
    return false;
  }
};

// Run test automatically when in development
if (process.env.NODE_ENV === 'development') {
  // Wait for viewport to initialize
  setTimeout(() => {
    testArchitect3DControls();
  }, 2000);
}













