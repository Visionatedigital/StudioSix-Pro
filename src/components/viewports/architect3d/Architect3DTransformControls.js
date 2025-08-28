/**
 * Architect3D Transform Controls
 * 
 * Provides SketchUp-like transform controls for 3D objects
 * Supports translate, rotate, and scale operations
 */

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export class Architect3DTransformControls extends THREE.EventDispatcher {
  constructor(camera, domElement, scene, orbitControls) {
    super();

    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;
    this.orbitControls = orbitControls;
    
    // Transform controls instance
    this.transformControls = null;
    
    // Currently selected object
    this.selectedObject = null;
    
    // Transform modes
    this.modes = {
      TRANSLATE: 'translate',
      ROTATE: 'rotate', 
      SCALE: 'scale'
    };
    
    this.currentMode = this.modes.TRANSLATE;
    
    // State
    this.enabled = true;
    this.visible = false;
    this.needsVisualUpdate = false;
    
    this.init();
  }

  init() {
    console.log('🎛️ Initializing Architect3D Transform Controls');
    
    // Create transform controls
    this.transformControls = new TransformControls(this.camera, this.domElement);
    this.transformControls.addEventListener('change', this.onTransformChange.bind(this));
    this.transformControls.addEventListener('dragging-changed', this.onDraggingChanged.bind(this));
    this.transformControls.addEventListener('objectChange', this.onObjectChange.bind(this));
    
    // Configure transform controls
    this.transformControls.setMode(this.currentMode);
    this.transformControls.setSpace('local'); // Start with local space
    this.transformControls.showX = true;
    this.transformControls.showY = true;
    this.transformControls.showZ = true;
    
    // Set initial size and appearance
    this.transformControls.setSize(1.2);
    
    // Add to scene
    this.scene.add(this.transformControls);
    
    // Initially hidden
    this.transformControls.visible = false;
    
    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    console.log('✅ Architect3D Transform Controls initialized');
  }

  setupKeyboardShortcuts() {
    this.keyDownHandler = (event) => {
      if (!this.enabled) return;
      
      // Prevent shortcuts when typing in inputs or content editable areas
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true' ||
        activeElement.getAttribute('role') === 'textbox'
      );
      
      if (isInputFocused) return;
      
      const key = event.key.toLowerCase();
      
      // Handle shortcuts that work without object selection
      switch (key) {
        case 'escape':
          if (this.selectedObject) {
            console.log('🎛️ TRANSFORM: Escape pressed, deselecting object');
            this.deselectObject();
            event.preventDefault();
            event.stopPropagation();
          }
          break;
          
        case 'delete':
        case 'backspace':
          if (this.selectedObject) {
            console.log('🎛️ TRANSFORM: Delete key pressed, removing selected object');
            this.deleteSelectedObject();
            event.preventDefault();
            event.stopPropagation();
          }
          break;
      }
      
      // Handle shortcuts that require object selection
      if (!this.selectedObject) return;
      
      switch (key) {
        case 'g': // Grab/Move (like Blender)
        case 't': // Translate
          this.setMode(this.modes.TRANSLATE);
          event.preventDefault();
          break;
          
        case 'r': // Rotate
          this.setMode(this.modes.ROTATE);
          event.preventDefault();
          break;
          
        case 's': // Scale
          this.setMode(this.modes.SCALE);
          event.preventDefault();
          break;
          
        case 'x': // Constrain to X-axis
          this.constrainToAxis('x');
          event.preventDefault();
          break;
          
        case 'y': // Constrain to Y-axis
          this.constrainToAxis('y');
          event.preventDefault();
          break;
          
        case 'z': // Constrain to Z-axis
          this.constrainToAxis('z');
          event.preventDefault();
          break;
      }
    };

    this.keyUpHandler = (event) => {
      if (!this.enabled || !this.selectedObject) return;
      
      const key = event.key.toLowerCase();
      
      switch (key) {
        case 'shift':
          // Toggle world/local space with Shift
          this.toggleSpace();
          event.preventDefault();
          break;
          
        case 'x':
        case 'y':
        case 'z':
          // Remove axis constraints when key is released
          if (event.type === 'keyup') {
            this.removeAxisConstraints();
            event.preventDefault();
          }
          break;
      }
    };

    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
  }

  /**
   * Attach transform controls to an object
   */
  attachToObject(object) {
    if (!object) {
      this.deselectObject();
      return;
    }

    console.log('🎛️ TRANSFORM: Attaching controls to object:', object.userData?.id || 'unknown');
    
    this.selectedObject = object;
    this.transformControls.attach(object);
    this.transformControls.visible = true;
    this.visible = true;
    
    // Temporarily disable orbit controls when transforming
    if (this.orbitControls) {
      this.orbitControls.enabled = false;
    }
    
    // Dispatch selection event
    this.dispatchEvent({
      type: 'object-attached',
      object: object
    });
  }

  /**
   * Detach transform controls from current object
   */
  deselectObject() {
    if (this.selectedObject) {
      console.log('🎛️ TRANSFORM: Detaching controls from object:', this.selectedObject.userData?.id || 'unknown');
    }
    
    this.selectedObject = null;
    this.transformControls.detach();
    this.transformControls.visible = false;
    this.visible = false;
    
    // Re-enable orbit controls
    if (this.orbitControls) {
      this.orbitControls.enabled = true;
    }
    
    // Dispatch deselection event
    this.dispatchEvent({
      type: 'object-detached'
    });
  }

  /**
   * Delete the currently selected object
   */
  deleteSelectedObject() {
    if (!this.selectedObject) return;

    const objectId = this.selectedObject.userData?.id;
    const objectType = this.selectedObject.userData?.type;
    const objectName = this.selectedObject.userData?.originalObject?.name || objectId;

    console.log('🗑️ TRANSFORM: Deleting object:', { objectId, objectType, objectName });

    // Show confirmation notification
    this.showDeleteNotification(objectName);

    // Dispatch delete event for the application to handle
    this.dispatchEvent({
      type: 'object-delete-requested',
      objectId: objectId,
      objectType: objectType,
      object: this.selectedObject
    });

    // Deselect the object first
    this.deselectObject();
  }

  /**
   * Show deletion notification
   */
  showDeleteNotification(objectName) {
    // Create a subtle notification element
    const notification = document.createElement('div');
    notification.textContent = `🗑️ Deleted ${objectName}`;
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(220, 38, 38, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      z-index: 10000;
      pointer-events: none;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: deleteNotification 2s ease-out forwards;
    `;

    // Add animation keyframes if not already added
    if (!document.querySelector('#delete-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'delete-notification-styles';
      style.textContent = `
        @keyframes deleteNotification {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.05);
          }
          25% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          85% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove notification after animation
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 2000);
  }

  /**
   * Set transform mode (translate, rotate, scale)
   */
  setMode(mode) {
    if (!Object.values(this.modes).includes(mode)) {
      console.warn('🎛️ TRANSFORM: Invalid mode:', mode);
      return;
    }
    
    const previousMode = this.currentMode;
    this.currentMode = mode;
    this.transformControls.setMode(mode);
    
    // Force immediate visual update of transform controls
    if (this.selectedObject && this.transformControls.visible) {
      this.needsVisualUpdate = true;
      this.forceTransformControlsUpdate();
    }
    
    console.log('🎛️ TRANSFORM: Mode changed to:', mode);
    
    // Show subtle visual feedback for keyboard shortcut activation
    if (previousMode !== mode) {
      this.showModeChangeNotification(mode);
    }
    
    // Dispatch mode change event
    this.dispatchEvent({
      type: 'mode-changed',
      mode: mode
    });
  }

  /**
   * Force immediate visual update of transform controls
   */
  forceTransformControlsUpdate() {
    if (!this.transformControls || !this.selectedObject) return;
    
    // Force the controls to update their visual representation immediately
    try {
      // Update the transform controls internal state
      this.transformControls.updateMatrixWorld();
      
      // Force a visual refresh by changing a property that triggers re-render
      const currentSize = this.transformControls.size;
      this.transformControls.setSize(currentSize + 0.001);
      
      // Immediately set it back to trigger the visual update
      requestAnimationFrame(() => {
        if (this.transformControls) {
          this.transformControls.setSize(currentSize);
          
          // Ensure the controls are visible and updated
          if (this.selectedObject) {
            this.transformControls.visible = true;
            
            // Manually trigger the helper update
            if (this.transformControls.children) {
              this.transformControls.children.forEach(child => {
                if (child.updateMatrixWorld) {
                  child.updateMatrixWorld(true);
                }
              });
            }
          }
        }
      });
    } catch (error) {
      console.warn('🎛️ TRANSFORM: Error forcing update:', error);
    }
  }

  /**
   * Show subtle notification when mode changes via keyboard
   */
  showModeChangeNotification(mode) {
    // Create a subtle notification element
    const notification = document.createElement('div');
    notification.textContent = `${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode`;
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 500;
      z-index: 10000;
      pointer-events: none;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      animation: transformNotification 1.5s ease-out forwards;
    `;

    // Add animation keyframes if not already added
    if (!document.querySelector('#transform-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'transform-notification-styles';
      style.textContent = `
        @keyframes transformNotification {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          80% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove notification after animation
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 1500);
  }

  /**
   * Toggle between world and local space
   */
  toggleSpace() {
    const currentSpace = this.transformControls.space;
    const newSpace = currentSpace === 'world' ? 'local' : 'world';
    this.transformControls.setSpace(newSpace);
    
    console.log('🎛️ TRANSFORM: Space changed to:', newSpace);
    
    // Dispatch space change event
    this.dispatchEvent({
      type: 'space-changed',
      space: newSpace
    });
  }

  /**
   * Constrain transformation to specific axis
   */
  constrainToAxis(axis) {
    // Reset all axes first
    this.transformControls.showX = false;
    this.transformControls.showY = false;
    this.transformControls.showZ = false;
    
    // Enable specific axis
    switch (axis.toLowerCase()) {
      case 'x':
        this.transformControls.showX = true;
        break;
      case 'y':
        this.transformControls.showY = true;
        break;
      case 'z':
        this.transformControls.showZ = true;
        break;
    }
    
    console.log('🎛️ TRANSFORM: Constrained to axis:', axis.toUpperCase());
  }

  /**
   * Remove axis constraints (show all axes)
   */
  removeAxisConstraints() {
    this.transformControls.showX = true;
    this.transformControls.showY = true;
    this.transformControls.showZ = true;
    
    console.log('🎛️ TRANSFORM: Axis constraints removed');
  }

  /**
   * Handle transform change events
   */
  onTransformChange() {
    // This fires during transformation
    this.dispatchEvent({
      type: 'transform-change',
      object: this.selectedObject
    });
  }

  /**
   * Handle dragging state change
   */
  onDraggingChanged(event) {
    const isDragging = event.value;
    
    // Disable/enable orbit controls during dragging
    if (this.orbitControls) {
      this.orbitControls.enabled = !isDragging;
    }
    
    console.log('🎛️ TRANSFORM: Dragging state:', isDragging ? 'started' : 'ended');
    
    // Dispatch dragging event
    this.dispatchEvent({
      type: 'dragging-changed',
      dragging: isDragging,
      object: this.selectedObject
    });
  }

  /**
   * Handle object change events (when transformation is complete)
   */
  onObjectChange() {
    if (!this.selectedObject) return;
    
    console.log('🎛️ TRANSFORM: Object transformation completed');
    
    // Dispatch object change event
    this.dispatchEvent({
      type: 'object-changed',
      object: this.selectedObject,
      position: this.selectedObject.position.clone(),
      rotation: this.selectedObject.rotation.clone(),
      scale: this.selectedObject.scale.clone()
    });
  }

  /**
   * Update transform controls (call this in render loop)
   */
  update() {
    // Handle visual updates when mode changes
    if (this.needsVisualUpdate) {
      this.needsVisualUpdate = false;
      
      // Force another update frame to ensure visual changes are applied
      if (this.transformControls && this.transformControls.visible) {
        this.transformControls.updateMatrixWorld(true);
      }
    }
  }

  /**
   * Enable/disable transform controls
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.transformControls.enabled = enabled;
    
    if (!enabled) {
      this.deselectObject();
    }
  }

  /**
   * Get current transform state
   */
  getTransformState() {
    if (!this.selectedObject) return null;
    
    return {
      object: this.selectedObject,
      mode: this.currentMode,
      space: this.transformControls.space,
      position: this.selectedObject.position.clone(),
      rotation: this.selectedObject.rotation.clone(),
      scale: this.selectedObject.scale.clone()
    };
  }

  /**
   * Cleanup
   */
  dispose() {
    console.log('🧹 Disposing Architect3D Transform Controls');
    
    this.deselectObject();
    
    if (this.transformControls) {
      this.scene.remove(this.transformControls);
      this.transformControls.dispose();
    }
    
    // Remove event listeners
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler);
    }
    if (this.keyUpHandler) {
      document.removeEventListener('keyup', this.keyUpHandler);
    }
  }
}
