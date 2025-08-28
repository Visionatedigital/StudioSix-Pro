/**
 * Architect3D Orbit Controls
 * 
 * Enhanced OrbitControls based on architect3d's implementation
 * Provides smooth camera controls with damping and auto-rotation
 */

import * as THREE from 'three';

const STATE = {
  NONE: -1,
  ROTATE: 0,
  DOLLY: 1,
  PAN: 2,
  TOUCH_ROTATE: 3,
  TOUCH_PAN: 4,
  TOUCH_DOLLY_PAN: 5,
  TOUCH_DOLLY_ROTATE: 6
};

export class Architect3DOrbitControls extends THREE.EventDispatcher {
  constructor(object, domElement) {
    super();

    this.object = object;
    this.domElement = domElement || document;

    // Set to false to disable this control
    this.enabled = true;
    this.needsUpdate = true;

    // "target" sets the location of focus, where the object orbits around
    this.target = new THREE.Vector3();

    // How far you can dolly in and out (PerspectiveCamera only)
    this.minDistance = 0;
    this.maxDistance = Infinity;

    // How far you can zoom in and out (OrthographicCamera only)
    this.minZoom = 0;
    this.maxZoom = Infinity;

    // How far you can orbit vertically, upper and lower limits.
    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    // How far you can orbit horizontally, upper and lower limits.
    this.minAzimuthAngle = -Infinity; // radians
    this.maxAzimuthAngle = Infinity; // radians

    // Set to true to enable damping (inertia)
    this.enableDamping = false;
    this.dampingFactor = 0.05;

    // This option enables dollying in and out
    this.enableZoom = true;
    this.zoomSpeed = 1.0;

    // Set to false to disable rotating
    this.enableRotate = true;
    this.rotateSpeed = 1.0;

    // Set to false to disable panning
    this.enablePan = true;
    this.panSpeed = 1.0;
    this.screenSpacePanning = true;
    this.keyPanSpeed = 7.0;

    // Set to true to automatically rotate around the target
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60

    // Set to false to disable use of the keys
    this.enableKeys = true;

    // The four arrow keys
    this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

    // Mouse buttons
    this.mouseButtons = { 
      LEFT: THREE.MOUSE.ROTATE, 
      MIDDLE: THREE.MOUSE.DOLLY, 
      RIGHT: THREE.MOUSE.PAN 
    };

    // Touch fingers
    this.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    // For reset
    this.target0 = this.target.clone();
    this.position0 = this.object.position.clone();
    this.zoom0 = this.object.zoom;

    // Internal state
    this.state = STATE.NONE;

    this.EPS = 0.000001;

    // current position in spherical coordinates
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();

    this.scale = 1;
    this.panOffset = new THREE.Vector3();
    this.zoomChanged = false;

    this.rotateStart = new THREE.Vector2();
    this.rotateEnd = new THREE.Vector2();
    this.rotateDelta = new THREE.Vector2();

    this.panStart = new THREE.Vector2();
    this.panEnd = new THREE.Vector2();
    this.panDelta = new THREE.Vector2();

    this.dollyStart = new THREE.Vector2();
    this.dollyEnd = new THREE.Vector2();
    this.dollyDelta = new THREE.Vector2();

    this.init();
  }

  init() {
    console.log('🎮 Initializing Architect3D Orbit Controls');
    console.log('🔍 ORBIT CONTROLS DEBUG: Dom element:', this.domElement);
    console.log('🔍 ORBIT CONTROLS DEBUG: Element type:', this.domElement.tagName);
    console.log('🔍 ORBIT CONTROLS DEBUG: Element classes:', this.domElement.className);
    
    // Set up event listeners with debugging
    this.domElement.addEventListener('contextmenu', this.onContextMenu.bind(this), false);

    this.domElement.addEventListener('mousedown', (e) => {
      // console.log('🎮 ORBIT CONTROLS: mousedown received', {
      //   button: e.button,
      //   target: e.target.tagName,
      //   defaultPrevented: e.defaultPrevented
      // });
      this.onMouseDown(e);
    }, false);
    
    this.domElement.addEventListener('wheel', (e) => {
      // console.log('🎮 ORBIT CONTROLS: wheel received');
      this.onMouseWheel(e);
    }, false);

    this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), false);
    this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), false);
    this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), false);

    this.domElement.addEventListener('keydown', this.onKeyDown.bind(this), false);

    // Force an update at start
    this.update();
  }

  getPolarAngle() {
    return this.spherical.phi;
  }

  getAzimuthalAngle() {
    return this.spherical.theta;
  }

  saveState() {
    this.target0.copy(this.target);
    this.position0.copy(this.object.position);
    this.zoom0 = this.object.zoom;
  }

  reset() {
    this.target.copy(this.target0);
    this.object.position.copy(this.position0);
    this.object.zoom = this.zoom0;

    this.object.updateProjectionMatrix();
    this.dispatchEvent({ type: 'change' });

    this.update();

    this.state = STATE.NONE;
  }

  update() {
    // Initialize static variables if not already created
    if (!this._offset) {
      this._offset = new THREE.Vector3();
      this._quat = new THREE.Quaternion().setFromUnitVectors(this.object.up, new THREE.Vector3(0, 1, 0));
      this._quatInverse = this._quat.clone().invert();
      this._lastPosition = new THREE.Vector3();
      this._lastQuaternion = new THREE.Quaternion();
    }

    const position = this.object.position;

    this._offset.copy(position).sub(this.target);

    // rotate offset to "y-axis-is-up" space
    this._offset.applyQuaternion(this._quat);

    // angle from z-axis around y-axis
    this.spherical.setFromVector3(this._offset);

    if (this.autoRotate && this.state === STATE.NONE) {
      this.rotateLeft(this.getAutoRotationAngle());
    }

    if (this.enableDamping) {
      this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
      this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;
    } else {
      this.spherical.theta += this.sphericalDelta.theta;
      this.spherical.phi += this.sphericalDelta.phi;
    }

    // restrict theta to be between desired limits
    this.spherical.theta = Math.max(this.minAzimuthAngle, Math.min(this.maxAzimuthAngle, this.spherical.theta));

    // restrict phi to be between desired limits
    this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));

    this.spherical.makeSafe();

    this.spherical.radius *= this.scale;

    // restrict radius to be between desired limits
    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

    // move target to panned location
    if (this.enableDamping === true) {
      this.target.addScaledVector(this.panOffset, this.dampingFactor);
    } else {
      this.target.add(this.panOffset);
    }

    this._offset.setFromSpherical(this.spherical);

    // rotate offset back to "camera-up-vector-is-up" space
    this._offset.applyQuaternion(this._quatInverse);

    position.copy(this.target).add(this._offset);

    this.object.lookAt(this.target);

    if (this.enableDamping === true) {
      this.sphericalDelta.theta *= (1 - this.dampingFactor);
      this.sphericalDelta.phi *= (1 - this.dampingFactor);
      this.panOffset.multiplyScalar(1 - this.dampingFactor);
    } else {
      this.sphericalDelta.set(0, 0, 0);
      this.panOffset.set(0, 0, 0);
    }

    this.scale = 1;

    // update condition is:
    // min(camera displacement, camera rotation in radians)^2 > EPS
    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

    if (this.zoomChanged ||
        this._lastPosition.distanceToSquared(this.object.position) > this.EPS ||
        8 * (1 - this._lastQuaternion.dot(this.object.quaternion)) > this.EPS) {
      
      this.dispatchEvent({ type: 'change' });

      this._lastPosition.copy(this.object.position);
      this._lastQuaternion.copy(this.object.quaternion);
      this.zoomChanged = false;
      
      // Flag that we need an update
      this.needsUpdate = true;

      return true;
    }

    return false;
  }

  getAutoRotationAngle() {
    return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
  }

  getZoomScale() {
    return Math.pow(0.95, this.zoomSpeed);
  }

  rotateLeft(angle) {
    this.sphericalDelta.theta -= angle;
  }

  rotateUp(angle) {
    this.sphericalDelta.phi -= angle;
  }

  panLeft(distance, objectMatrix) {
    const v = new THREE.Vector3();
    v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
    v.multiplyScalar(-distance);
    this.panOffset.add(v);
  }

  panUp(distance, objectMatrix) {
    const v = new THREE.Vector3();
    if (this.screenSpacePanning === true) {
      v.setFromMatrixColumn(objectMatrix, 1);
    } else {
      v.setFromMatrixColumn(objectMatrix, 0);
      v.crossVectors(this.object.up, v);
    }
    v.multiplyScalar(distance);
    this.panOffset.add(v);
  }

  pan(deltaX, deltaY) {
    const element = this.domElement === document ? this.domElement.body : this.domElement;
    const offset = new THREE.Vector3();

    if (this.object.isPerspectiveCamera) {
      // perspective
      const position = this.object.position;
      offset.copy(position).sub(this.target);
      let targetDistance = offset.length();

      // half of the fov is center to top of screen
      targetDistance *= Math.tan((this.object.fov / 2) * Math.PI / 180.0);

      // we use only clientHeight here so aspect ratio does not distort speed
      this.panLeft(2 * deltaX * targetDistance / element.clientHeight, this.object.matrix);
      this.panUp(2 * deltaY * targetDistance / element.clientHeight, this.object.matrix);

    } else if (this.object.isOrthographicCamera) {
      // orthographic
      this.panLeft(deltaX * (this.object.right - this.object.left) / this.object.zoom / element.clientWidth, this.object.matrix);
      this.panUp(deltaY * (this.object.top - this.object.bottom) / this.object.zoom / element.clientHeight, this.object.matrix);

    } else {
      // camera neither orthographic nor perspective
      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
      this.enablePan = false;
    }
  }

  dollyIn(dollyScale) {
    if (this.object.isPerspectiveCamera) {
      this.scale /= dollyScale;
    } else if (this.object.isOrthographicCamera) {
      this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom * dollyScale));
      this.object.updateProjectionMatrix();
      this.zoomChanged = true;
    } else {
      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
      this.enableZoom = false;
    }
  }

  dollyOut(dollyScale) {
    if (this.object.isPerspectiveCamera) {
      this.scale *= dollyScale;
    } else if (this.object.isOrthographicCamera) {
      this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / dollyScale));
      this.object.updateProjectionMatrix();
      this.zoomChanged = true;
    } else {
      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.');
      this.enableZoom = false;
    }
  }

  // Event handlers
  handleMouseDownRotate(event) {
    this.rotateStart.set(event.clientX, event.clientY);
  }

  handleMouseDownDolly(event) {
    this.dollyStart.set(event.clientX, event.clientY);
  }

  handleMouseDownPan(event) {
    this.panStart.set(event.clientX, event.clientY);
  }

  handleMouseMoveRotate(event) {
    this.rotateEnd.set(event.clientX, event.clientY);
    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);

    const element = this.domElement === document ? this.domElement.body : this.domElement;

    this.rotateLeft(2 * Math.PI * this.rotateDelta.x / element.clientHeight); // yes, height
    this.rotateUp(2 * Math.PI * this.rotateDelta.y / element.clientHeight);

    this.rotateStart.copy(this.rotateEnd);
    this.update();
  }

  handleMouseMoveDolly(event) {
    this.dollyEnd.set(event.clientX, event.clientY);
    this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

    if (this.dollyDelta.y > 0) {
      this.dollyIn(this.getZoomScale());
    } else if (this.dollyDelta.y < 0) {
      this.dollyOut(this.getZoomScale());
    }

    this.dollyStart.copy(this.dollyEnd);
    this.update();
  }

  handleMouseMovePan(event) {
    this.panEnd.set(event.clientX, event.clientY);
    this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);

    this.pan(this.panDelta.x, this.panDelta.y);

    this.panStart.copy(this.panEnd);
    this.update();
  }

  handleMouseWheel(event) {
    if (event.deltaY < 0) {
      this.dollyOut(this.getZoomScale());
    } else if (event.deltaY > 0) {
      this.dollyIn(this.getZoomScale());
    }

    this.update();
  }

  // Event listener methods
  onMouseDown(event) {
    // console.log('🎮 ORBIT CONTROLS: onMouseDown handler called', {
    //   enabled: this.enabled,
    //   button: event.button,
    //   enableRotate: this.enableRotate,
    //   enablePan: this.enablePan
    // });

    if (this.enabled === false) {
      console.log('🎮 ORBIT CONTROLS: onMouseDown - controls disabled, exiting');
      return;
    }

    // Prevent the browser from scrolling.
    event.preventDefault();
    console.log('🎮 ORBIT CONTROLS: onMouseDown - prevented default');

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.
    this.domElement.focus ? this.domElement.focus() : window.focus();

    let mouseAction;

    switch (event.button) {
      case 0:
        mouseAction = this.mouseButtons.LEFT;
        break;
      case 1:
        mouseAction = this.mouseButtons.MIDDLE;
        break;
      case 2:
        mouseAction = this.mouseButtons.RIGHT;
        break;
      default:
        mouseAction = -1;
    }

    console.log('🎮 ORBIT CONTROLS: Mouse button mapping:', {
      eventButton: event.button,
      mouseAction: mouseAction,
      mouseButtons: this.mouseButtons,
      'THREE.MOUSE.ROTATE': THREE.MOUSE.ROTATE,
      'THREE.MOUSE.PAN': THREE.MOUSE.PAN,
      'THREE.MOUSE.DOLLY': THREE.MOUSE.DOLLY
    });

    switch (mouseAction) {
      case THREE.MOUSE.DOLLY:
        if (this.enableZoom === false) return;
        this.handleMouseDownDolly(event);
        this.state = STATE.DOLLY;
        break;

      case THREE.MOUSE.ROTATE:
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          if (this.enablePan === false) return;
          this.handleMouseDownPan(event);
          this.state = STATE.PAN;
        } else {
          if (this.enableRotate === false) return;
          this.handleMouseDownRotate(event);
          this.state = STATE.ROTATE;
        }
        break;

      case THREE.MOUSE.PAN:
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          if (this.enableRotate === false) return;
          this.handleMouseDownRotate(event);
          this.state = STATE.ROTATE;
        } else {
          if (this.enablePan === false) return;
          this.handleMouseDownPan(event);
          this.state = STATE.PAN;
        }
        break;

      default:
        this.state = STATE.NONE;
    }

    if (this.state !== STATE.NONE) {
      console.log('🎮 ORBIT CONTROLS: Setting up drag listeners, state:', this.state);
      document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
      document.addEventListener('mouseup', this.onMouseUp.bind(this), false);
      this.dispatchEvent({ type: 'start' });
    } else {
      console.log('🎮 ORBIT CONTROLS: State is NONE, not setting up drag listeners');
    }
  }

  onMouseMove(event) {
    // Only log mousemove if we're in a drag state
    if (this.state !== STATE.NONE) {
      console.log('🎮 ORBIT CONTROLS: onMouseMove called, state:', this.state);
    }
    if (this.enabled === false) return;

    event.preventDefault();

    switch (this.state) {
      case STATE.ROTATE:
        if (this.enableRotate === false) return;
        this.handleMouseMoveRotate(event);
        break;

      case STATE.DOLLY:
        if (this.enableZoom === false) return;
        this.handleMouseMoveDolly(event);
        break;

      case STATE.PAN:
        if (this.enablePan === false) return;
        this.handleMouseMovePan(event);
        break;
    }
  }

  onMouseUp(event) {
    if (this.enabled === false) return;

    document.removeEventListener('mousemove', this.onMouseMove.bind(this), false);
    document.removeEventListener('mouseup', this.onMouseUp.bind(this), false);

    this.dispatchEvent({ type: 'end' });
    this.state = STATE.NONE;
  }

  onMouseWheel(event) {
    console.log('🎮 ORBIT CONTROLS: onMouseWheel handler called', {
      enabled: this.enabled,
      enableZoom: this.enableZoom,
      state: this.state,
      deltaY: event.deltaY
    });

    if (this.enabled === false || this.enableZoom === false || (this.state !== STATE.NONE && this.state !== STATE.ROTATE)) {
      console.log('🎮 ORBIT CONTROLS: onMouseWheel - conditions not met, exiting');
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    console.log('🎮 ORBIT CONTROLS: onMouseWheel - prevented default and handling wheel');

    this.dispatchEvent({ type: 'start' });
    this.handleMouseWheel(event);
    this.dispatchEvent({ type: 'end' });
  }

  onKeyDown(event) {
    if (this.enabled === false || this.enableKeys === false || this.enablePan === false) return;

    switch (event.keyCode) {
      case this.keys.UP:
        this.pan(0, this.keyPanSpeed);
        this.update();
        break;

      case this.keys.BOTTOM:
        this.pan(0, -this.keyPanSpeed);
        this.update();
        break;

      case this.keys.LEFT:
        this.pan(this.keyPanSpeed, 0);
        this.update();
        break;

      case this.keys.RIGHT:
        this.pan(-this.keyPanSpeed, 0);
        this.update();
        break;
    }
  }

  onTouchStart(event) {
    if (this.enabled === false) return;

    event.preventDefault();

    switch (event.touches.length) {
      case 1:
        switch (this.touches.ONE) {
          case THREE.TOUCH.ROTATE:
            if (this.enableRotate === false) return;
            this.handleTouchStartRotate(event);
            this.state = STATE.TOUCH_ROTATE;
            break;

          case THREE.TOUCH.PAN:
            if (this.enablePan === false) return;
            this.handleTouchStartPan(event);
            this.state = STATE.TOUCH_PAN;
            break;

          default:
            this.state = STATE.NONE;
        }
        break;

      case 2:
        switch (this.touches.TWO) {
          case THREE.TOUCH.DOLLY_PAN:
            if (this.enableZoom === false && this.enablePan === false) return;
            this.handleTouchStartDollyPan(event);
            this.state = STATE.TOUCH_DOLLY_PAN;
            break;

          case THREE.TOUCH.DOLLY_ROTATE:
            if (this.enableZoom === false && this.enableRotate === false) return;
            this.handleTouchStartDollyRotate(event);
            this.state = STATE.TOUCH_DOLLY_ROTATE;
            break;

          default:
            this.state = STATE.NONE;
        }
        break;

      default:
        this.state = STATE.NONE;
    }

    if (this.state !== STATE.NONE) {
      this.dispatchEvent({ type: 'start' });
    }
  }

  onTouchMove(event) {
    if (this.enabled === false) return;

    event.preventDefault();
    event.stopPropagation();

    switch (this.state) {
      case STATE.TOUCH_ROTATE:
        if (this.enableRotate === false) return;
        this.handleTouchMoveRotate(event);
        this.update();
        break;

      case STATE.TOUCH_PAN:
        if (this.enablePan === false) return;
        this.handleTouchMovePan(event);
        this.update();
        break;

      case STATE.TOUCH_DOLLY_PAN:
        if (this.enableZoom === false && this.enablePan === false) return;
        this.handleTouchMoveDollyPan(event);
        this.update();
        break;

      case STATE.TOUCH_DOLLY_ROTATE:
        if (this.enableZoom === false && this.enableRotate === false) return;
        this.handleTouchMoveDollyRotate(event);
        this.update();
        break;

      default:
        this.state = STATE.NONE;
    }
  }

  onTouchEnd(event) {
    if (this.enabled === false) return;

    this.dispatchEvent({ type: 'end' });
    this.state = STATE.NONE;
  }

  onContextMenu(event) {
    if (this.enabled === false) return;
    event.preventDefault();
  }

  // Touch handlers (simplified implementations)
  handleTouchStartRotate(event) {
    if (event.touches.length == 1) {
      this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
      this.rotateStart.set(x, y);
    }
  }

  handleTouchStartPan(event) {
    if (event.touches.length == 1) {
      this.panStart.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
      this.panStart.set(x, y);
    }
  }

  handleTouchStartDollyPan(event) {
    if (this.enableZoom) this.handleTouchStartDolly(event);
    if (this.enablePan) this.handleTouchStartPan(event);
  }

  handleTouchStartDollyRotate(event) {
    if (this.enableZoom) this.handleTouchStartDolly(event);
    if (this.enableRotate) this.handleTouchStartRotate(event);
  }

  handleTouchStartDolly(event) {
    const dx = event.touches[0].pageX - event.touches[1].pageX;
    const dy = event.touches[0].pageY - event.touches[1].pageY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    this.dollyStart.set(0, distance);
  }

  handleTouchMoveRotate(event) {
    if (event.touches.length == 1) {
      this.rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
      this.rotateEnd.set(x, y);
    }

    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);

    const element = this.domElement === document ? this.domElement.body : this.domElement;

    this.rotateLeft(2 * Math.PI * this.rotateDelta.x / element.clientHeight);
    this.rotateUp(2 * Math.PI * this.rotateDelta.y / element.clientHeight);

    this.rotateStart.copy(this.rotateEnd);
  }

  handleTouchMovePan(event) {
    if (event.touches.length == 1) {
      this.panEnd.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
      this.panEnd.set(x, y);
    }

    this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);

    this.pan(this.panDelta.x, this.panDelta.y);

    this.panStart.copy(this.panEnd);
  }

  handleTouchMoveDollyPan(event) {
    if (this.enableZoom) this.handleTouchMoveDolly(event);
    if (this.enablePan) this.handleTouchMovePan(event);
  }

  handleTouchMoveDollyRotate(event) {
    if (this.enableZoom) this.handleTouchMoveDolly(event);
    if (this.enableRotate) this.handleTouchMoveRotate(event);
  }

  handleTouchMoveDolly(event) {
    const dx = event.touches[0].pageX - event.touches[1].pageX;
    const dy = event.touches[0].pageY - event.touches[1].pageY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    this.dollyEnd.set(0, distance);
    this.dollyDelta.set(0, Math.pow(this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed));

    this.dollyIn(this.dollyDelta.y);

    this.dollyStart.copy(this.dollyEnd);
  }

  // Cleanup
  dispose() {
    console.log('🧹 Disposing Architect3D Orbit Controls');

    this.domElement.removeEventListener('contextmenu', this.onContextMenu, false);
    this.domElement.removeEventListener('mousedown', this.onMouseDown, false);
    this.domElement.removeEventListener('wheel', this.onMouseWheel, false);

    this.domElement.removeEventListener('touchstart', this.onTouchStart, false);
    this.domElement.removeEventListener('touchend', this.onTouchEnd, false);
    this.domElement.removeEventListener('touchmove', this.onTouchMove, false);

    document.removeEventListener('mousemove', this.onMouseMove, false);
    document.removeEventListener('mouseup', this.onMouseUp, false);

    this.domElement.removeEventListener('keydown', this.onKeyDown, false);
  }
}