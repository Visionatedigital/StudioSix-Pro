/**
 * Selection Manager
 * Enhanced selection system with multi-selection algorithms, intelligent picking, and grouping
 */

import * as THREE from 'three';

// Selection methods enum
export const SelectionMethods = {
  SINGLE: 'single',
  WINDOW: 'window',
  CROSSING: 'crossing',
  LASSO: 'lasso',
  POLYGONAL: 'polygonal'
};

// Selection filters enum
export const SelectionFilters = {
  ALL: 'all',
  WALLS: 'walls',
  DOORS: 'doors',
  WINDOWS: 'windows',
  SLABS: 'slabs',
  ROOFS: 'roofs',
  STAIRS: 'stairs',
  CONSTRAINTS: 'constraints',
  GROUPS: 'groups'
};

// Selection priority levels for intelligent picking
export const SelectionPriority = {
  HIGHEST: 5,    // Active tool entities
  HIGH: 4,       // Recently modified entities
  NORMAL: 3,     // Standard entities
  LOW: 2,        // Background/reference entities
  LOWEST: 1      // Hidden/disabled entities
};

class SelectionManager {
  constructor(scene, camera, renderer, raycaster) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.raycaster = raycaster;
    
    // Selection state
    this.selectedObjects = new Set();
    this.selectedGroups = new Set();
    this.lastSelected = null;
    this.selectionBox = null;
    this.selectionMode = SelectionMethods.SINGLE;
    this.activeFilters = new Set([SelectionFilters.ALL]);
    
    // Multi-selection state
    this.isMultiSelecting = false;
    this.selectionStartPoint = null;
    this.selectionPath = [];
    this.temporarySelection = new Set();
    
    // Grouping system
    this.groups = new Map(); // groupId -> Set of objectIds
    this.objectToGroups = new Map(); // objectId -> Set of groupIds
    
    // Intelligent picking
    this.proximityThreshold = 50; // pixels
    this.occlusionTolerance = 0.1;
    this.visibilityCache = new Map();
    this.priorityMap = new Map();
    
    // Performance optimization
    this.selectionQuadTree = null;
    this.lastUpdateTime = 0;
    this.updateThreshold = 16; // ~60fps
    
    // Event system
    this.eventListeners = new Map();
    
    // Initialize selection helpers
    this.initializeSelectionHelpers();
  }

  // Initialize selection visual helpers
  initializeSelectionHelpers() {
    // Selection box for window/crossing selection
    this.selectionBox = this.createSelectionBox();
    
    // Lasso line for lasso selection
    this.lassoLine = this.createLassoLine();
    
    // Highlight materials
    this.highlightMaterial = new THREE.MeshLambertMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3
    });
    
    this.selectedMaterial = new THREE.MeshLambertMaterial({
      color: 0x0077ff,
      transparent: true,
      opacity: 0.5
    });
  }

  // Create selection box helper
  createSelectionBox() {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x0077ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    
    const box = new THREE.Mesh(geometry, material);
    box.visible = false;
    this.scene.add(box);
    
    return box;
  }

  // Create lasso line helper
  createLassoLine() {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2
    });
    
    const line = new THREE.Line(geometry, material);
    line.visible = false;
    this.scene.add(line);
    
    return line;
  }

  // Event system
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
    
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in selection event listener for ${event}:`, error);
        }
      });
    }
  }

  // Set selection method
  setSelectionMethod(method) {
    this.selectionMode = method;
    this.clearTemporarySelection();
    this.emit('selectionMethodChanged', { method });
  }

  // Set selection filters
  setSelectionFilters(filters) {
    this.activeFilters = new Set(filters);
    this.updateVisibilityCache();
    this.emit('filtersChanged', { filters: Array.from(this.activeFilters) });
  }

  // Single object selection
  selectObject(screenPoint, addToSelection = false) {
    const intersections = this.getIntersectionsAtPoint(screenPoint);
    const candidates = this.filterAndPrioritizeCandidates(intersections);
    
    if (candidates.length === 0) {
      if (!addToSelection) {
        this.clearSelection();
      }
      return null;
    }

    // Intelligent picking - select best candidate
    const selected = this.selectBestCandidate(candidates, screenPoint);
    
    if (selected) {
      if (addToSelection) {
        this.addToSelection(selected);
      } else {
        this.setSelection([selected]);
      }
      
      this.lastSelected = selected;
      return selected;
    }

    return null;
  }

  // Window selection (select objects inside rectangle)
  startWindowSelection(startPoint) {
    this.isMultiSelecting = true;
    this.selectionStartPoint = startPoint;
    this.selectionMode = SelectionMethods.WINDOW;
    this.selectionBox.visible = true;
    this.updateSelectionBox(startPoint, startPoint);
  }

  // Update window selection
  updateWindowSelection(currentPoint) {
    if (!this.isMultiSelecting || !this.selectionStartPoint) return;
    
    this.updateSelectionBox(this.selectionStartPoint, currentPoint);
    
    // Get objects in selection area
    const objectsInArea = this.getObjectsInRectangle(
      this.selectionStartPoint, 
      currentPoint,
      this.selectionMode === SelectionMethods.WINDOW
    );
    
    // Update temporary selection
    this.setTemporarySelection(objectsInArea);
  }

  // Finish window/crossing selection
  finishWindowSelection(addToSelection = false) {
    if (!this.isMultiSelecting) return;
    
    const selectedObjects = Array.from(this.temporarySelection);
    
    if (addToSelection) {
      selectedObjects.forEach(obj => this.addToSelection(obj));
    } else {
      this.setSelection(selectedObjects);
    }
    
    this.isMultiSelecting = false;
    this.selectionStartPoint = null;
    this.selectionBox.visible = false;
    this.clearTemporarySelection();
    
    return selectedObjects;
  }

  // Lasso selection
  startLassoSelection(startPoint) {
    this.isMultiSelecting = true;
    this.selectionMode = SelectionMethods.LASSO;
    this.selectionPath = [startPoint];
    this.lassoLine.visible = true;
    this.updateLassoLine();
  }

  // Update lasso selection
  updateLassoSelection(currentPoint) {
    if (!this.isMultiSelecting || this.selectionMode !== SelectionMethods.LASSO) return;
    
    this.selectionPath.push(currentPoint);
    this.updateLassoLine();
    
    // Get objects in lasso area
    const objectsInArea = this.getObjectsInPolygon(this.selectionPath);
    this.setTemporarySelection(objectsInArea);
  }

  // Finish lasso selection
  finishLassoSelection(addToSelection = false) {
    if (!this.isMultiSelecting) return;
    
    const selectedObjects = Array.from(this.temporarySelection);
    
    if (addToSelection) {
      selectedObjects.forEach(obj => this.addToSelection(obj));
    } else {
      this.setSelection(selectedObjects);
    }
    
    this.isMultiSelecting = false;
    this.selectionPath = [];
    this.lassoLine.visible = false;
    this.clearTemporarySelection();
    
    return selectedObjects;
  }

  // Polygonal selection
  startPolygonalSelection() {
    this.isMultiSelecting = true;
    this.selectionMode = SelectionMethods.POLYGONAL;
    this.selectionPath = [];
  }

  addPolygonPoint(point) {
    if (this.selectionMode !== SelectionMethods.POLYGONAL) return;
    
    this.selectionPath.push(point);
    this.updateLassoLine();
    
    // Update selection preview
    const objectsInArea = this.getObjectsInPolygon(this.selectionPath);
    this.setTemporarySelection(objectsInArea);
  }

  finishPolygonalSelection(addToSelection = false) {
    if (!this.isMultiSelecting) return;
    
    // Close the polygon
    if (this.selectionPath.length > 2) {
      this.selectionPath.push(this.selectionPath[0]);
    }
    
    const selectedObjects = Array.from(this.temporarySelection);
    
    if (addToSelection) {
      selectedObjects.forEach(obj => this.addToSelection(obj));
    } else {
      this.setSelection(selectedObjects);
    }
    
    this.isMultiSelecting = false;
    this.selectionPath = [];
    this.lassoLine.visible = false;
    this.clearTemporarySelection();
    
    return selectedObjects;
  }

  // Get intersections at screen point
  getIntersectionsAtPoint(screenPoint) {
    // Convert screen coordinates to normalized device coordinates
    const mouse = new THREE.Vector2(
      (screenPoint.x / this.renderer.domElement.clientWidth) * 2 - 1,
      -(screenPoint.y / this.renderer.domElement.clientHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);
    
    // Get all selectable objects in the scene
    const selectableObjects = this.getSelectableObjects();
    const intersections = this.raycaster.intersectObjects(selectableObjects, true);
    
    return intersections.filter(intersection => 
      this.isObjectSelectable(intersection.object)
    );
  }

  // Filter and prioritize selection candidates
  filterAndPrioritizeCandidates(intersections) {
    const candidates = intersections
      .filter(intersection => this.passesSelectionFilters(intersection.object))
      .map(intersection => ({
        object: intersection.object,
        distance: intersection.distance,
        point: intersection.point,
        priority: this.getObjectPriority(intersection.object),
        proximity: this.calculateProximity(intersection)
      }))
      .sort((a, b) => {
        // Sort by priority first, then by distance
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.distance - b.distance; // Closer objects first
      });

    return candidates;
  }

  // Select best candidate using intelligent picking
  selectBestCandidate(candidates, screenPoint) {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].object;

    // If multiple candidates have the same priority, use proximity
    const topPriority = candidates[0].priority;
    const topCandidates = candidates.filter(c => c.priority === topPriority);

    if (topCandidates.length === 1) {
      return topCandidates[0].object;
    }

    // Use proximity to cursor for final decision
    let bestCandidate = topCandidates[0];
    let minProximity = bestCandidate.proximity;

    for (let i = 1; i < topCandidates.length; i++) {
      if (topCandidates[i].proximity < minProximity) {
        minProximity = topCandidates[i].proximity;
        bestCandidate = topCandidates[i];
      }
    }

    return bestCandidate.object;
  }

  // Calculate proximity score for intelligent picking
  calculateProximity(intersection) {
    // Project 3D point to screen space
    const screenPoint = intersection.point.clone();
    screenPoint.project(this.camera);
    
    // Convert to pixel coordinates
    const screenX = (screenPoint.x + 1) * this.renderer.domElement.clientWidth / 2;
    const screenY = (-screenPoint.y + 1) * this.renderer.domElement.clientHeight / 2;
    
    // Calculate distance from cursor (this would need cursor position)
    // For now, return distance from camera
    return intersection.distance;
  }

  // Get objects in rectangle (window/crossing selection)
  getObjectsInRectangle(startPoint, endPoint, windowMode = true) {
    const selectableObjects = this.getSelectableObjects();
    const objectsInArea = [];

    const minX = Math.min(startPoint.x, endPoint.x);
    const maxX = Math.max(startPoint.x, endPoint.x);
    const minY = Math.min(startPoint.y, endPoint.y);
    const maxY = Math.max(startPoint.y, endPoint.y);

    selectableObjects.forEach(object => {
      if (!this.passesSelectionFilters(object)) return;

      const boundingBox = this.getObjectBoundingBox(object);
      if (!boundingBox) return;

      const screenBounds = this.projectBoundingBoxToScreen(boundingBox);
      
      if (windowMode) {
        // Window selection: object must be completely inside rectangle
        if (screenBounds.minX >= minX && screenBounds.maxX <= maxX &&
            screenBounds.minY >= minY && screenBounds.maxY <= maxY) {
          objectsInArea.push(object);
        }
      } else {
        // Crossing selection: object just needs to intersect rectangle
        if (screenBounds.maxX >= minX && screenBounds.minX <= maxX &&
            screenBounds.maxY >= minY && screenBounds.minY <= maxY) {
          objectsInArea.push(object);
        }
      }
    });

    return objectsInArea;
  }

  // Get objects in polygon (lasso/polygonal selection)
  getObjectsInPolygon(polygonPoints) {
    const selectableObjects = this.getSelectableObjects();
    const objectsInArea = [];

    selectableObjects.forEach(object => {
      if (!this.passesSelectionFilters(object)) return;

      const boundingBox = this.getObjectBoundingBox(object);
      if (!boundingBox) return;

      const screenBounds = this.projectBoundingBoxToScreen(boundingBox);
      const centerPoint = {
        x: (screenBounds.minX + screenBounds.maxX) / 2,
        y: (screenBounds.minY + screenBounds.maxY) / 2
      };

      if (this.pointInPolygon(centerPoint, polygonPoints)) {
        objectsInArea.push(object);
      }
    });

    return objectsInArea;
  }

  // Point in polygon test
  pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
          (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Get selectable objects from scene
  getSelectableObjects() {
    const selectableObjects = [];
    
    this.scene.traverse(object => {
      if (this.isObjectSelectable(object)) {
        selectableObjects.push(object);
      }
    });
    
    return selectableObjects;
  }

  // Check if object is selectable
  isObjectSelectable(object) {
    // Check if object has selectable userData
    if (object.userData && object.userData.selectable === false) {
      return false;
    }
    
    // Check if object is visible
    if (!object.visible) {
      return false;
    }
    
    // Check if object has geometry
    if (!object.geometry && !object.children.length) {
      return false;
    }
    
    return true;
  }

  // Check if object passes current selection filters
  passesSelectionFilters(object) {
    if (this.activeFilters.has(SelectionFilters.ALL)) {
      return true;
    }
    
    const objectType = object.userData?.type || 'unknown';
    
    for (const filter of this.activeFilters) {
      switch (filter) {
        case SelectionFilters.WALLS:
          if (objectType === 'wall') return true;
          break;
        case SelectionFilters.DOORS:
          if (objectType === 'door') return true;
          break;
        case SelectionFilters.WINDOWS:
          if (objectType === 'window') return true;
          break;
        case SelectionFilters.SLABS:
          if (objectType === 'slab') return true;
          break;
        case SelectionFilters.ROOFS:
          if (objectType === 'roof') return true;
          break;
        case SelectionFilters.STAIRS:
          if (objectType === 'stairs') return true;
          break;
        case SelectionFilters.CONSTRAINTS:
          if (objectType === 'constraint') return true;
          break;
        case SelectionFilters.GROUPS:
          if (this.objectToGroups.has(object.uuid)) return true;
          break;
      }
    }
    
    return false;
  }

  // Get object priority for intelligent picking
  getObjectPriority(object) {
    // Check custom priority
    if (object.userData?.priority !== undefined) {
      return object.userData.priority;
    }
    
    // Check cached priority
    if (this.priorityMap.has(object.uuid)) {
      return this.priorityMap.get(object.uuid);
    }
    
    // Default priority based on object type
    const objectType = object.userData?.type || 'unknown';
    
    switch (objectType) {
      case 'activeEntity':
        return SelectionPriority.HIGHEST;
      case 'recentlyModified':
        return SelectionPriority.HIGH;
      case 'wall':
      case 'door':
      case 'window':
      case 'slab':
      case 'roof':
      case 'stairs':
        return SelectionPriority.NORMAL;
      case 'constraint':
      case 'helper':
        return SelectionPriority.LOW;
      default:
        return SelectionPriority.LOWEST;
    }
  }

  // Set object priority
  setObjectPriority(object, priority) {
    this.priorityMap.set(object.uuid, priority);
    object.userData.priority = priority;
  }

  // Get object bounding box
  getObjectBoundingBox(object) {
    const box = new THREE.Box3();
    box.setFromObject(object);
    
    if (box.isEmpty()) {
      return null;
    }
    
    return box;
  }

  // Project bounding box to screen coordinates
  projectBoundingBoxToScreen(boundingBox) {
    const corners = [
      new THREE.Vector3(boundingBox.min.x, boundingBox.min.y, boundingBox.min.z),
      new THREE.Vector3(boundingBox.max.x, boundingBox.min.y, boundingBox.min.z),
      new THREE.Vector3(boundingBox.min.x, boundingBox.max.y, boundingBox.min.z),
      new THREE.Vector3(boundingBox.max.x, boundingBox.max.y, boundingBox.min.z),
      new THREE.Vector3(boundingBox.min.x, boundingBox.min.y, boundingBox.max.z),
      new THREE.Vector3(boundingBox.max.x, boundingBox.min.y, boundingBox.max.z),
      new THREE.Vector3(boundingBox.min.x, boundingBox.max.y, boundingBox.max.z),
      new THREE.Vector3(boundingBox.max.x, boundingBox.max.y, boundingBox.max.z)
    ];

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    corners.forEach(corner => {
      corner.project(this.camera);
      
      const screenX = (corner.x + 1) * this.renderer.domElement.clientWidth / 2;
      const screenY = (-corner.y + 1) * this.renderer.domElement.clientHeight / 2;
      
      minX = Math.min(minX, screenX);
      maxX = Math.max(maxX, screenX);
      minY = Math.min(minY, screenY);
      maxY = Math.max(maxY, screenY);
    });

    return { minX, maxX, minY, maxY };
  }

  // Update selection box visual
  updateSelectionBox(startPoint, endPoint) {
    if (!this.selectionBox) return;

    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerY = (startPoint.y + endPoint.y) / 2;

    // Convert screen coordinates to world coordinates
    const worldStart = this.screenToWorld(startPoint);
    const worldEnd = this.screenToWorld(endPoint);
    const worldCenter = new THREE.Vector3(
      (worldStart.x + worldEnd.x) / 2,
      (worldStart.y + worldEnd.y) / 2,
      (worldStart.z + worldEnd.z) / 2
    );

    this.selectionBox.position.copy(worldCenter);
    this.selectionBox.scale.set(
      Math.abs(worldEnd.x - worldStart.x),
      Math.abs(worldEnd.y - worldStart.y),
      1
    );
  }

  // Update lasso line visual
  updateLassoLine() {
    if (!this.lassoLine || this.selectionPath.length < 2) return;

    const worldPoints = this.selectionPath.map(point => this.screenToWorld(point));
    const positions = new Float32Array(worldPoints.length * 3);

    worldPoints.forEach((point, index) => {
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    });

    this.lassoLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.lassoLine.geometry.setDrawRange(0, worldPoints.length);
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(screenPoint) {
    const mouse = new THREE.Vector2(
      (screenPoint.x / this.renderer.domElement.clientWidth) * 2 - 1,
      -(screenPoint.y / this.renderer.domElement.clientHeight) * 2 + 1
    );

    const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
    vector.unproject(this.camera);

    const dir = vector.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / dir.z;
    const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));

    return pos;
  }

  // Selection management
  setSelection(objects) {
    this.clearSelection();
    objects.forEach(obj => this.addToSelection(obj, false));
    this.emit('selectionChanged', {
      selected: Array.from(this.selectedObjects),
      type: 'set'
    });
  }

  addToSelection(object, emitEvent = true) {
    if (this.selectedObjects.has(object)) return;

    this.selectedObjects.add(object);
    this.highlightObject(object, this.selectedMaterial);

    if (emitEvent) {
      this.emit('selectionChanged', {
        selected: Array.from(this.selectedObjects),
        added: [object],
        type: 'add'
      });
    }
  }

  removeFromSelection(object, emitEvent = true) {
    if (!this.selectedObjects.has(object)) return;

    this.selectedObjects.delete(object);
    this.unhighlightObject(object);

    if (emitEvent) {
      this.emit('selectionChanged', {
        selected: Array.from(this.selectedObjects),
        removed: [object],
        type: 'remove'
      });
    }
  }

  clearSelection() {
    this.selectedObjects.forEach(obj => this.unhighlightObject(obj));
    this.selectedObjects.clear();
    this.emit('selectionChanged', {
      selected: [],
      type: 'clear'
    });
  }

  // Temporary selection (for preview during multi-selection)
  setTemporarySelection(objects) {
    this.clearTemporarySelection();
    objects.forEach(obj => {
      if (!this.selectedObjects.has(obj)) {
        this.temporarySelection.add(obj);
        this.highlightObject(obj, this.highlightMaterial);
      }
    });
  }

  clearTemporarySelection() {
    this.temporarySelection.forEach(obj => this.unhighlightObject(obj));
    this.temporarySelection.clear();
  }

  // Object highlighting
  highlightObject(object, material) {
    if (object.userData.originalMaterial === undefined) {
      object.userData.originalMaterial = object.material;
    }
    object.material = material;
  }

  unhighlightObject(object) {
    if (object.userData.originalMaterial !== undefined) {
      object.material = object.userData.originalMaterial;
    }
  }

  // Group management
  createGroup(groupId, objectIds = []) {
    if (this.groups.has(groupId)) {
      console.warn(`Group ${groupId} already exists`);
      return false;
    }

    const group = new Set(objectIds);
    this.groups.set(groupId, group);

    // Update object-to-groups mapping
    objectIds.forEach(objectId => {
      if (!this.objectToGroups.has(objectId)) {
        this.objectToGroups.set(objectId, new Set());
      }
      this.objectToGroups.get(objectId).add(groupId);
    });

    this.emit('groupCreated', { groupId, objectIds });
    return true;
  }

  addToGroup(groupId, objectIds) {
    if (!this.groups.has(groupId)) {
      console.warn(`Group ${groupId} does not exist`);
      return false;
    }

    const group = this.groups.get(groupId);
    const addedObjects = [];

    objectIds.forEach(objectId => {
      if (!group.has(objectId)) {
        group.add(objectId);
        addedObjects.push(objectId);

        // Update object-to-groups mapping
        if (!this.objectToGroups.has(objectId)) {
          this.objectToGroups.set(objectId, new Set());
        }
        this.objectToGroups.get(objectId).add(groupId);
      }
    });

    if (addedObjects.length > 0) {
      this.emit('groupModified', { groupId, added: addedObjects });
    }

    return addedObjects.length > 0;
  }

  removeFromGroup(groupId, objectIds) {
    if (!this.groups.has(groupId)) {
      console.warn(`Group ${groupId} does not exist`);
      return false;
    }

    const group = this.groups.get(groupId);
    const removedObjects = [];

    objectIds.forEach(objectId => {
      if (group.has(objectId)) {
        group.delete(objectId);
        removedObjects.push(objectId);

        // Update object-to-groups mapping
        const objectGroups = this.objectToGroups.get(objectId);
        if (objectGroups) {
          objectGroups.delete(groupId);
          if (objectGroups.size === 0) {
            this.objectToGroups.delete(objectId);
          }
        }
      }
    });

    if (removedObjects.length > 0) {
      this.emit('groupModified', { groupId, removed: removedObjects });
    }

    return removedObjects.length > 0;
  }

  deleteGroup(groupId) {
    if (!this.groups.has(groupId)) {
      console.warn(`Group ${groupId} does not exist`);
      return false;
    }

    const group = this.groups.get(groupId);
    const objectIds = Array.from(group);

    // Remove group from object-to-groups mapping
    objectIds.forEach(objectId => {
      const objectGroups = this.objectToGroups.get(objectId);
      if (objectGroups) {
        objectGroups.delete(groupId);
        if (objectGroups.size === 0) {
          this.objectToGroups.delete(objectId);
        }
      }
    });

    this.groups.delete(groupId);
    this.emit('groupDeleted', { groupId, objectIds });

    return true;
  }

  selectGroup(groupId) {
    if (!this.groups.has(groupId)) {
      console.warn(`Group ${groupId} does not exist`);
      return false;
    }

    const group = this.groups.get(groupId);
    const objects = Array.from(group).map(id => this.scene.getObjectByProperty('uuid', id)).filter(obj => obj);
    
    this.setSelection(objects);
    this.selectedGroups.add(groupId);
    
    return true;
  }

  getObjectGroups(objectId) {
    return this.objectToGroups.get(objectId) || new Set();
  }

  getGroupObjects(groupId) {
    return this.groups.get(groupId) || new Set();
  }

  // Utility methods
  getSelectedObjects() {
    return Array.from(this.selectedObjects);
  }

  getSelectedGroups() {
    return Array.from(this.selectedGroups);
  }

  isSelected(object) {
    return this.selectedObjects.has(object);
  }

  getSelectionCount() {
    return this.selectedObjects.size;
  }

  hasSelection() {
    return this.selectedObjects.size > 0;
  }

  // Update visibility cache for performance
  updateVisibilityCache() {
    this.visibilityCache.clear();
    // This would be populated based on current view frustum
  }

  // Cleanup
  cleanup() {
    this.clearSelection();
    this.clearTemporarySelection();
    
    if (this.selectionBox) {
      this.scene.remove(this.selectionBox);
    }
    
    if (this.lassoLine) {
      this.scene.remove(this.lassoLine);
    }
    
    this.eventListeners.clear();
    this.groups.clear();
    this.objectToGroups.clear();
  }
}

export default SelectionManager; 