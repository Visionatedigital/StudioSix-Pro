/**
 * Architect3D Controller
 * 
 * Adapted from architect3d's Controller class
 * Handles object selection, dragging, and interaction
 */

import * as THREE from 'three';

// Controller states
export const CONTROLLER_STATES = {
  UNSELECTED: 0,
  SELECTED: 1,
  DRAGGING: 2,
  ROTATING: 3,
  ROTATING_FREE: 4,
  PANNING: 5
};

export class Architect3DController extends THREE.EventDispatcher {
  constructor(three, model, camera, element, controls) {
    super();

    this.three = three;
    this.model = model;
    this.camera = camera;
    this.element = element;
    this.controls = controls;
    this.scene = model.scene;

    this.enabled = true;
    this.needsUpdate = true;

    // Interaction state
    this.state = CONTROLLER_STATES.UNSELECTED;
    this.selectedObject = null;
    this.intersectedObject = null;
    this.mouseoverObject = null;

    // Mouse tracking
    this.mouse = new THREE.Vector2();
    this.mouseDown = false;
    this.mouseMoved = false;

    // Raycasting
    this.raycaster = new THREE.Raycaster();

    // Ground plane for interaction
    this.groundPlane = null;

    this.init();
  }

  init() {
    console.log('🎮 Initializing Architect3D Controller');

    // Create ground plane for click detection
    this.createGroundPlane();

    // Set up event listeners
    this.setupEventListeners();
  }

  createGroundPlane() {
    // Create a very small ground plane that's only for object placement
    const size = 5; // Very small plane - only for tool placement near origin
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshBasicMaterial({ 
      visible: false,
      side: THREE.DoubleSide
    });

    this.groundPlane = new THREE.Mesh(geometry, material);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = 0;
    this.groundPlane.name = 'groundPlane';

    // Start with ground plane disabled for navigation
    this.groundPlane.visible = false;
    this.isGroundPlaneActive = false;

    console.log('🏗️ CONTROLLER: Created small ground plane with size:', size, 'active:', this.isGroundPlaneActive);
    this.scene.add(this.groundPlane);
  }

  setupEventListeners() {
    // Bind methods to preserve context
    this.boundMouseDown = (e) => this.onMouseDown(e);
    this.boundMouseMove = (e) => this.onMouseMove(e);
    this.boundMouseUp = (e) => this.onMouseUp(e);
    this.boundClick = (e) => this.onClick(e);
    this.boundTouchStart = (e) => this.onTouchStart(e);
    this.boundTouchMove = (e) => this.onTouchMove(e);
    this.boundTouchEnd = (e) => this.onTouchEnd(e);

    // Mouse events with passive listeners where appropriate
    this.element.addEventListener('mousedown', this.boundMouseDown, false);
    this.element.addEventListener('mousemove', this.boundMouseMove, { passive: true });
    this.element.addEventListener('mouseup', this.boundMouseUp, false);
    this.element.addEventListener('click', this.boundClick, false);

    // Touch events for mobile with passive listeners
    this.element.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.boundTouchEnd, { passive: true });
  }

  updateMouse(event) {
    const rect = this.element.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  getIntersections(mouse, objects = null) {
    this.raycaster.setFromCamera(mouse, this.camera);

    const targets = objects || this.scene.children.filter(child => {
      // Filter for interactive objects
      return child.userData && child.userData.id && child !== this.groundPlane;
    });

    return this.raycaster.intersectObjects(targets, true);
  }

  onMouseDown(event) {
    console.log('🎮 CONTROLLER: mousedown received', { button: event.button });

    if (!this.enabled) {
      console.log('🎮 CONTROLLER: mousedown - controller disabled, ignoring');
      return;
    }

    this.updateMouse(event);

    this.mouseDown = true;
    this.mouseMoved = false;

    // Check if we're clicking on an interactive object before preventing default
    const intersects = this.getIntersections(this.mouse);
    let hasInteractableObject = false;

    if (intersects.length > 0) {
      console.log('🎮 CONTROLLER: mousedown - found intersections:', intersects.length);
      const intersect = intersects[0];
      const object = this.findInteractableObject(intersect.object);
      hasInteractableObject = object && object.userData.id;
      console.log('🎮 CONTROLLER: mousedown - has interactable object:', hasInteractableObject);
    }

    const hasGroundIntersection = this.checkGroundIntersection();
    console.log('🎮 CONTROLLER: mousedown - ground intersection:', hasGroundIntersection, 'ground active:', this.isGroundPlaneActive);

    // Only prevent default if we're interacting with an object 
    // OR if we're in a tool placement mode and clicking on ground
    const isToolActive = false; // TODO: Get this from the viewport/app state
    const shouldInterceptGroundClick = hasGroundIntersection && isToolActive;

    if (hasInteractableObject || shouldInterceptGroundClick) {
      console.log('🎮 CONTROLLER: mousedown - preventing default and handling interaction', {
        hasInteractableObject,
        shouldInterceptGroundClick,
        isToolActive
      });
      event.preventDefault();
      this.handleObjectInteraction();
    } else {
      console.log('🎮 CONTROLLER: mousedown - letting orbit controls handle event', {
        hasInteractableObject,
        hasGroundIntersection,
        isToolActive
      });
    }
    // Otherwise, let the orbit controls handle the event
  }

  onMouseMove(event) {
    if (!this.enabled) return;

    this.updateMouse(event);
    this.mouseMoved = true;

    // Handle hover effects
    this.handleHover();

    // Handle dragging
    if (this.mouseDown && this.selectedObject) {
      this.handleDrag();
    }
  }

  onMouseUp(event) {
    if (!this.enabled) return;

    this.mouseDown = false;

    if (this.state === CONTROLLER_STATES.DRAGGING) {
      this.switchState(CONTROLLER_STATES.SELECTED);
    }
  }

  onClick(event) {
    if (!this.enabled || this.mouseMoved) return;

    this.updateMouse(event);

    // Check if we're clicking on an interactive object or ground before preventing default
    const intersects = this.getIntersections(this.mouse);
    let hasInteractableObject = false;

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const object = this.findInteractableObject(intersect.object);
      hasInteractableObject = object && object.userData.id;
    }

    // Only prevent default and handle click if we're interacting with something meaningful
    const isToolActive = false; // TODO: Get this from the viewport/app state
    const hasGroundIntersection = this.checkGroundIntersection();
    const shouldInterceptGroundClick = hasGroundIntersection && isToolActive;

    if (hasInteractableObject || shouldInterceptGroundClick) {
      console.log('🎮 CONTROLLER: onClick - preventing default and handling click', {
        hasInteractableObject,
        shouldInterceptGroundClick,
        isToolActive
      });
      event.preventDefault();
      this.handleClick();
    } else {
      console.log('🎮 CONTROLLER: onClick - letting orbit controls handle event', {
        hasInteractableObject,
        hasGroundIntersection,
        isToolActive
      });
    }
    // Otherwise, let the orbit controls handle the event
  }

  onTouchStart(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.onMouseDown(mouseEvent);
    }
  }

  onTouchMove(event) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.onMouseMove(mouseEvent);
    }
  }

  onTouchEnd(event) {
    const mouseEvent = new MouseEvent('mouseup', {});
    this.onMouseUp(mouseEvent);
  }

  handleObjectInteraction() {
    // Check for object intersections
    const intersects = this.getIntersections(this.mouse);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const object = this.findInteractableObject(intersect.object);

      if (object && object.userData.id) {
        this.selectObject(object);
        return;
      }
    }

    // Check for ground click
    this.checkGroundClick();
  }

  findInteractableObject(object) {
    // Traverse up the hierarchy to find an object with userData.id
    let current = object;
    while (current) {
      if (current.userData && current.userData.id) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  selectObject(object) {
    // Deselect previous object
    if (this.selectedObject) {
      this.deselectObject();
    }

    this.selectedObject = object;
    this.switchState(CONTROLLER_STATES.SELECTED);

    console.log('🎯 Object selected:', object.userData.id);

    // Attach transform controls to selected object
    if (this.three && this.three.transformControls) {
      this.three.transformControls.attachToObject(object);
    }

    // Dispatch event
    this.dispatchEvent({
      type: 'itemSelected',
      item: {
        id: object.userData.id,
        type: object.userData.type,
        object: object,
        originalObject: object.userData.originalObject
      }
    });
  }

  deselectObject() {
    if (this.selectedObject) {
      console.log('🎯 Object deselected:', this.selectedObject.userData.id);
      
      // Detach transform controls
      if (this.three && this.three.transformControls) {
        this.three.transformControls.deselectObject();
      }
      
      this.selectedObject = null;
      this.switchState(CONTROLLER_STATES.UNSELECTED);

      this.dispatchEvent({
        type: 'itemUnselected'
      });
    }
  }

  handleClick() {
    // Check for object clicks first
    const intersects = this.getIntersections(this.mouse);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const object = this.findInteractableObject(intersect.object);

      if (object && object.userData.id) {
        this.selectObject(object);
        return;
      }
    }

    // Check for ground/floor clicks
    this.checkGroundClick();
  }

  checkGroundIntersection() {
    // Only check ground intersection if ground plane is active (tool placement mode)
    if (!this.isGroundPlaneActive) {
      return false;
    }
    
    // Check if mouse is over ground plane (for determining if we should handle the event)
    const groundIntersects = this.getIntersections(this.mouse, [this.groundPlane]);
    return groundIntersects.length > 0;
  }

  checkGroundClick() {
    // Check if clicking on ground plane
    const groundIntersects = this.getIntersections(this.mouse, [this.groundPlane]);

    if (groundIntersects.length > 0) {
      const point = groundIntersects[0].point;
      
      console.log('🏠 Floor clicked at:', point);

      this.dispatchEvent({
        type: 'floorClicked',
        item: { type: 'floor' },
        point: point
      });

      // Deselect any selected object
      this.deselectObject();
      return;
    }

    // Nothing was clicked
    console.log('🌌 Nothing clicked');
    this.dispatchEvent({
      type: 'nothingClicked'
    });

    this.deselectObject();
  }

  // Method to enable/disable ground plane for tool placement
  setGroundPlaneActive(active) {
    this.isGroundPlaneActive = active;
    this.groundPlane.visible = active;
    console.log('🏗️ CONTROLLER: Ground plane active:', active);
  }

  handleHover() {
    const intersects = this.getIntersections(this.mouse);
    
    if (intersects.length > 0) {
      const object = this.findInteractableObject(intersects[0].object);
      
      if (object !== this.mouseoverObject) {
        // Remove previous hover
        if (this.mouseoverObject) {
          this.setObjectHover(this.mouseoverObject, false);
        }

        // Set new hover
        this.mouseoverObject = object;
        if (object) {
          this.setObjectHover(object, true);
        }
      }
    } else {
      // No hover
      if (this.mouseoverObject) {
        this.setObjectHover(this.mouseoverObject, false);
        this.mouseoverObject = null;
      }
    }
  }

  setObjectHover(object, isHovering) {
    if (!object || !object.material) return;

    if (isHovering) {
      // Add hover effect
      if (object.material.emissive) {
        object.material.emissive.setHex(0x333333);
      }
    } else {
      // Remove hover effect
      if (object.material.emissive) {
        object.material.emissive.setHex(0x000000);
      }
    }
  }

  handleDrag() {
    if (!this.selectedObject) return;

    // Get intersection with ground plane for drag position
    const groundIntersects = this.getIntersections(this.mouse, [this.groundPlane]);

    if (groundIntersects.length > 0) {
      const newPosition = groundIntersects[0].point;
      
      // Update object position
      this.selectedObject.position.x = newPosition.x;
      this.selectedObject.position.z = newPosition.z;

      // Update the original object in the CAD engine if available
      if (this.selectedObject.userData.originalObject) {
        const originalObj = this.selectedObject.userData.originalObject;
        originalObj.position = {
          x: newPosition.x,
          y: originalObj.position?.y || 0,
          z: newPosition.z
        };
      }

      this.needsUpdate = true;
    }

    this.switchState(CONTROLLER_STATES.DRAGGING);
  }

  switchState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.needsUpdate = true;
    }
  }

  isRotating() {
    return this.state === CONTROLLER_STATES.ROTATING || 
           this.state === CONTROLLER_STATES.ROTATING_FREE;
  }

  // Cleanup
  dispose() {
    console.log('🧹 Disposing Architect3D Controller');

    if (this.element) {
      this.element.removeEventListener('mousedown', this.boundMouseDown);
      this.element.removeEventListener('mousemove', this.boundMouseMove);
      this.element.removeEventListener('mouseup', this.boundMouseUp);
      this.element.removeEventListener('click', this.boundClick);
      this.element.removeEventListener('touchstart', this.boundTouchStart);
      this.element.removeEventListener('touchmove', this.boundTouchMove);
      this.element.removeEventListener('touchend', this.boundTouchEnd);
    }

    if (this.groundPlane) {
      this.scene.remove(this.groundPlane);
      this.groundPlane.geometry?.dispose();
      this.groundPlane.material?.dispose();
    }

    // Clear references
    this.selectedObject = null;
    this.intersectedObject = null;
    this.mouseoverObject = null;
  }
}