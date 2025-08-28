/**
 * Architect3D Main Class
 * 
 * Adapted from architect3d's Main class for React integration
 * Handles the core 3D scene, camera, renderer, and controls
 */

import * as THREE from 'three';
import { Architect3DController } from './Architect3DController';
import { Architect3DLights } from './Architect3DLights';
import { Architect3DOrbitControls } from './Architect3DOrbitControls';
import { Architect3DTransformControls } from './Architect3DTransformControls';

// Event constants
export const EVENTS = {
  ITEM_SELECTED: 'itemSelected',
  ITEM_UNSELECTED: 'itemUnselected',
  WALL_CLICKED: 'wallClicked',
  FLOOR_CLICKED: 'floorClicked',
  NOTHING_CLICKED: 'nothingClicked',
  CAMERA_MOVED: 'cameraMoved',
  UPDATED: 'updated'
};

export class Architect3DMain extends THREE.EventDispatcher {
  constructor(model, element, canvasElement, opts = {}) {
    super();

    // Default options
    const defaultOptions = {
      resize: true,
      pushHref: false,
      spin: false,
      spinSpeed: 0.00002,
      clickPan: true,
      canMoveFixedItems: true
    };

    this.options = { ...defaultOptions, ...opts };
    this.pauseRender = false;
    this.model = model;
    this.scene = model.scene;
    this.element = element;
    this.canvasElement = canvasElement;

    // Camera setup
    this.cameraNear = 1;
    this.cameraFar = 10000;
    this.camera = null;
    this.controls = null;
    this.renderer = null;
    this.controller = null;
    this.transformControls = null;

    // Render state
    this.needsUpdate = false;
    this.lastRender = Date.now();

    // Mouse state
    this.mouseOver = false;
    this.hasClicked = false;

    // Scene components
    this.lights = null;

    // Dimensions
    this.elementHeight = null;
    this.elementWidth = null;
    this.heightMargin = 0;
    this.widthMargin = 0;

    // Initialize
    this.init();
  }

  createRenderer() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvasElement,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xFFFFFF, 0);
    
    return renderer;
  }

  init() {
    console.log('🏗️ Initializing Architect3D Main');

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      50, // fov
      1, // aspect (will be updated)
      this.cameraNear,
      this.cameraFar
    );
    
    // Set initial camera position
    this.camera.position.set(8, 6, 8);
    this.camera.lookAt(0, 0, 0);
    
    console.log('🎥 CAMERA: Initial camera setup:', {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      fov: this.camera.fov,
      near: this.camera.near,
      far: this.camera.far
    });

    // Create renderer
    this.renderer = this.createRenderer();

    console.log('🔍 ARCHITECT3D MAIN DEBUG: Creating orbit controls with element:', {
      element: this.element,
      elementTag: this.element?.tagName,
      elementClasses: this.element?.className,
      elementId: this.element?.id
    });

    // Create orbit controls with smooth settings
    this.controls = new Architect3DOrbitControls(this.camera, this.element);
    this.controls.autoRotate = this.options.spin;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05; // Smoother damping
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.maxDistance = 500;
    this.controls.minDistance = 2;
    this.controls.screenSpacePanning = true;
    this.controls.rotateSpeed = 0.5; // Smoother rotation
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 0.8;

    console.log('🔍 ARCHITECT3D MAIN DEBUG: Orbit controls created with settings:', {
      enableRotate: this.controls.enableRotate,
      enableZoom: this.controls.enableZoom,
      enablePan: this.controls.enablePan,
      enabled: this.controls.enabled
    });

    // Create lighting system
    this.lights = new Architect3DLights(this.scene, this.model.floorplan);

    // Create controller for object interaction
    this.controller = new Architect3DController(
      this,
      this.model,
      this.camera,
      this.element,
      this.controls
    );

    // Create transform controls
    this.transformControls = new Architect3DTransformControls(
      this.camera,
      this.element,
      this.scene,
      this.controls
    );

    // Set up transform controls event listeners
    this.setupTransformControlsEvents();

    // Set up event forwarding from controller
    this.controller.addEventListener(EVENTS.ITEM_SELECTED, (event) => {
      this.dispatchEvent({ type: EVENTS.ITEM_SELECTED, item: event.item });
    });

    this.controller.addEventListener(EVENTS.ITEM_UNSELECTED, (event) => {
      this.dispatchEvent({ type: EVENTS.ITEM_UNSELECTED });
    });

    this.controller.addEventListener(EVENTS.WALL_CLICKED, (event) => {
      this.dispatchEvent({ type: EVENTS.WALL_CLICKED, item: event.wall });
    });

    this.controller.addEventListener(EVENTS.FLOOR_CLICKED, (event) => {
      this.dispatchEvent({ type: EVENTS.FLOOR_CLICKED, item: event.item, point: event.point });
    });

    this.controller.addEventListener(EVENTS.NOTHING_CLICKED, (event) => {
      this.dispatchEvent({ type: EVENTS.NOTHING_CLICKED });
    });

    // Handle window resizing
    this.updateWindowSize();

    // Set up animation loop
    this.startRenderLoop();

    // Add ground plane, grid, and environment
    this.createGroundPlane();
    this.createGrid();
    this.createEnvironment();

    // Position camera nicely
    this.centerCamera();

    // Mouse event handlers for spin control
    this.element.addEventListener('mouseenter', () => { this.mouseOver = true; });
    this.element.addEventListener('mouseleave', () => { this.mouseOver = false; });
    this.element.addEventListener('click', () => { this.hasClicked = true; });

    console.log('✅ Architect3D Main initialized');
  }

  setupTransformControlsEvents() {
    // Forward transform control events
    this.transformControls.addEventListener('object-attached', (event) => {
      console.log('🎛️ MAIN: Object attached to transform controls');
      this.dispatchEvent({ type: 'transform-attached', object: event.object });
    });

    this.transformControls.addEventListener('object-detached', (event) => {
      console.log('🎛️ MAIN: Object detached from transform controls');
      this.dispatchEvent({ type: 'transform-detached' });
    });

    this.transformControls.addEventListener('object-changed', (event) => {
      console.log('🎛️ MAIN: Object transformed');
      this.dispatchEvent({ 
        type: 'object-transformed', 
        object: event.object,
        position: event.position,
        rotation: event.rotation,
        scale: event.scale
      });
      this.needsUpdate = true;
    });

    this.transformControls.addEventListener('mode-changed', (event) => {
      console.log('🎛️ MAIN: Transform mode changed to:', event.mode);
      this.dispatchEvent({ type: 'transform-mode-changed', mode: event.mode });
    });

    this.transformControls.addEventListener('object-delete-requested', (event) => {
      console.log('🎛️ MAIN: Object deletion requested:', event.objectId);
      this.dispatchEvent({ 
        type: 'object-delete-requested', 
        objectId: event.objectId,
        objectType: event.objectType,
        object: event.object
      });
    });
  }

  startRenderLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      this.render();
    };
    animate();
  }

  updateWindowSize() {
    if (!this.element) return;

    const rect = this.element.getBoundingClientRect();
    this.elementWidth = rect.width;
    this.elementHeight = rect.height;
    this.heightMargin = rect.top;
    this.widthMargin = rect.left;

    // Update camera
    this.camera.aspect = this.elementWidth / this.elementHeight;
    this.camera.updateProjectionMatrix();

    // Update renderer
    this.renderer.setSize(this.elementWidth, this.elementHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.needsUpdate = true;
  }

  createGroundPlane() {
    // Create a large ground plane
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.8
    });

    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -0.01;
    this.groundPlane.receiveShadow = true;
    this.groundPlane.name = 'groundPlane';

    this.scene.add(this.groundPlane);
  }

  createGrid() {
    // Create grid helper for better spatial reference
    this.gridHelper = new THREE.GridHelper(
      100, // size
      100, // divisions
      0xcccccc, // center line color
      0xe0e0e0  // grid color
    );
    this.gridHelper.position.y = 0;
    this.gridHelper.name = 'gridHelper';

    this.scene.add(this.gridHelper);
  }

  createEnvironment() {
    // Create a simple sky gradient background
    this.scene.background = new THREE.Color(0xf0f8ff); // Light blue sky

    // Add some atmospheric perspective with fog
    this.scene.fog = new THREE.Fog(0xf0f8ff, 50, 200);
  }

  centerCamera() {
    const center = this.model.floorplan.getCenter();
    const size = this.model.floorplan.getSize();

    // Set camera target
    this.controls.target.copy(center);

    // Position camera at a good viewing angle
    const distance = Math.max(size.x, size.z) * 1.5;
    const cameraPos = new THREE.Vector3(
      center.x + distance * 0.7,
      center.y + distance * 0.5,
      center.z + distance * 0.7
    );

    this.camera.position.copy(cameraPos);
    this.controls.update();
  }

  spin() {
    if (this.controls) {
      this.controls.autoRotate = this.options.spin && !this.mouseOver && !this.hasClicked;
    }
  }

  stopSpin() {
    this.hasClicked = true;
    if (this.controls) {
      this.controls.autoRotate = false;
    }
  }

  setCursorStyle(cursorStyle) {
    if (this.element) {
      this.element.style.cursor = cursorStyle;
    }
  }

  ensureNeedsUpdate() {
    this.needsUpdate = true;
  }

  shouldRender() {
    return (
      this.needsUpdate ||
      (this.controls && this.controls.needsUpdate) ||
      (this.controller && this.controller.needsUpdate) ||
      (this.model && this.model.scene && this.model.scene.needsUpdate)
    );
  }

  render(forced = false) {
    if (this.pauseRender && !forced) {
      return;
    }

    this.spin();

    if (this.shouldRender() || forced) {
      // Update controls
      if (this.controls) {
        this.controls.update();
        this.controls.needsUpdate = false;
      }

      // Update controller
      if (this.controller) {
        this.controller.needsUpdate = false;
      }

      // Update transform controls
      if (this.transformControls) {
        this.transformControls.update();
      }

      // Render scene
      this.renderer.render(this.scene, this.camera);

      // Reset flags
      this.needsUpdate = false;
      if (this.model && this.model.scene) {
        this.model.scene.needsUpdate = false;
      }
    }

    this.lastRender = Date.now();
  }

  // Getters
  getScene() {
    return this.scene;
  }

  getCamera() {
    return this.camera;
  }

  getRenderer() {
    return this.renderer;
  }

  getController() {
    return this.controller;
  }

  getTransformControls() {
    return this.transformControls;
  }

  // Transform control methods
  selectObject(object) {
    if (this.transformControls) {
      this.transformControls.attachToObject(object);
    }
  }

  deselectObject() {
    if (this.transformControls) {
      this.transformControls.deselectObject();
    }
  }

  setTransformMode(mode) {
    if (this.transformControls) {
      this.transformControls.setMode(mode);
    }
  }

  getTransformState() {
    return this.transformControls ? this.transformControls.getTransformState() : null;
  }

  // Cleanup
  dispose() {
    console.log('🧹 Disposing Architect3D Main');

    if (this.transformControls) {
      this.transformControls.dispose();
    }

    if (this.controller) {
      this.controller.dispose();
    }

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.lights) {
      this.lights.dispose();
    }

    // Clean up ground plane and grid
    if (this.groundPlane) {
      this.scene.remove(this.groundPlane);
      this.groundPlane.geometry?.dispose();
      this.groundPlane.material?.dispose();
    }

    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose?.();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    // Remove event listeners
    if (this.element) {
      this.element.removeEventListener('mouseenter', () => { this.mouseOver = true; });
      this.element.removeEventListener('mouseleave', () => { this.mouseOver = false; });
      this.element.removeEventListener('click', () => { this.hasClicked = true; });
    }
  }
}