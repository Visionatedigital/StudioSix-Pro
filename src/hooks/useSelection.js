/**
 * useSelection Hook
 * React hook for enhanced selection functionality with multi-selection and intelligent picking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import SelectionManager, { SelectionMethods, SelectionFilters } from '../utils/selectionManager.js';

const useSelection = (scene, camera, renderer, raycaster) => {
  // Selection state
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectionMethod, setSelectionMethodState] = useState(SelectionMethods.SINGLE);
  const [activeFilters, setActiveFiltersState] = useState([SelectionFilters.ALL]);
  const [isMultiSelecting, setIsMultiSelecting] = useState(false);
  const [selectionCount, setSelectionCount] = useState(0);
  const [hoveredObject, setHoveredObject] = useState(null);
  
  // Manager reference
  const selectionManager = useRef(null);
  const unsubscribeRefs = useRef([]);
  
  // Mouse state for selection operations
  const [mouseState, setMouseState] = useState({
    isDown: false,
    startPoint: null,
    currentPoint: null,
    button: null
  });

  // Initialize selection manager
  useEffect(() => {
    if (!scene || !camera || !renderer || !raycaster) return;

    selectionManager.current = new SelectionManager(scene, camera, renderer, raycaster);

    // Subscribe to selection events
    const unsubSelectionChanged = selectionManager.current.on('selectionChanged', (data) => {
      setSelectedObjects(data.selected);
      setSelectionCount(data.selected.length);
    });

    const unsubMethodChanged = selectionManager.current.on('selectionMethodChanged', (data) => {
      setSelectionMethodState(data.method);
    });

    const unsubFiltersChanged = selectionManager.current.on('filtersChanged', (data) => {
      setActiveFiltersState(data.filters);
    });

    const unsubGroupCreated = selectionManager.current.on('groupCreated', (data) => {
      console.log('Group created:', data.groupId);
    });

    const unsubGroupDeleted = selectionManager.current.on('groupDeleted', (data) => {
      console.log('Group deleted:', data.groupId);
    });

    unsubscribeRefs.current = [
      unsubSelectionChanged,
      unsubMethodChanged,
      unsubFiltersChanged,
      unsubGroupCreated,
      unsubGroupDeleted
    ];

    // Cleanup on unmount
    return () => {
      unsubscribeRefs.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      
      if (selectionManager.current) {
        selectionManager.current.cleanup();
      }
    };
  }, [scene, camera, renderer, raycaster]);

  // Selection method control
  const setSelectionMethod = useCallback((method) => {
    if (selectionManager.current) {
      selectionManager.current.setSelectionMethod(method);
    }
  }, []);

  // Filter control
  const setSelectionFilters = useCallback((filters) => {
    if (selectionManager.current) {
      selectionManager.current.setSelectionFilters(filters);
    }
  }, []);

  // Single object selection
  const selectObject = useCallback((screenPoint, addToSelection = false) => {
    if (!selectionManager.current) return null;
    return selectionManager.current.selectObject(screenPoint, addToSelection);
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    if (selectionManager.current) {
      selectionManager.current.clearSelection();
    }
  }, []);

  // Select all objects
  const selectAll = useCallback(() => {
    if (!selectionManager.current) return;
    
    const allObjects = selectionManager.current.getSelectableObjects();
    const filteredObjects = allObjects.filter(obj => 
      selectionManager.current.passesSelectionFilters(obj)
    );
    
    selectionManager.current.setSelection(filteredObjects);
  }, []);

  // Invert selection
  const invertSelection = useCallback(() => {
    if (!selectionManager.current) return;
    
    const allObjects = selectionManager.current.getSelectableObjects();
    const filteredObjects = allObjects.filter(obj => 
      selectionManager.current.passesSelectionFilters(obj)
    );
    
    const currentSelected = new Set(selectedObjects);
    const invertedSelection = filteredObjects.filter(obj => !currentSelected.has(obj));
    
    selectionManager.current.setSelection(invertedSelection);
  }, [selectedObjects]);

  // Mouse event handlers for selection
  const handleMouseDown = useCallback((event) => {
    if (!selectionManager.current) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    setMouseState({
      isDown: true,
      startPoint: point,
      currentPoint: point,
      button: event.button
    });

    const addToSelection = event.ctrlKey || event.metaKey;

    switch (selectionMethod) {
      case SelectionMethods.SINGLE:
        selectObject(point, addToSelection);
        break;
        
      case SelectionMethods.WINDOW:
      case SelectionMethods.CROSSING:
        selectionManager.current.startWindowSelection(point);
        setIsMultiSelecting(true);
        break;
        
      case SelectionMethods.LASSO:
        selectionManager.current.startLassoSelection(point);
        setIsMultiSelecting(true);
        break;
        
      case SelectionMethods.POLYGONAL:
        if (event.button === 0) { // Left click
          if (!isMultiSelecting) {
            selectionManager.current.startPolygonalSelection();
            setIsMultiSelecting(true);
          }
          selectionManager.current.addPolygonPoint(point);
        } else if (event.button === 2) { // Right click - finish selection
          const results = selectionManager.current.finishPolygonalSelection(addToSelection);
          setIsMultiSelecting(false);
        }
        break;
    }
  }, [renderer, selectionMethod, selectObject, isMultiSelecting]);

  const handleMouseMove = useCallback((event) => {
    if (!selectionManager.current) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // Update hover highlighting
    if (!mouseState.isDown) {
      const intersections = selectionManager.current.getIntersectionsAtPoint(point);
      const newHoveredObject = intersections.length > 0 ? intersections[0].object : null;
      
      if (newHoveredObject !== hoveredObject) {
        // Unhighlight previous object
        if (hoveredObject && !selectedObjects.includes(hoveredObject)) {
          selectionManager.current.unhighlightObject(hoveredObject);
        }
        
        // Highlight new object
        if (newHoveredObject && !selectedObjects.includes(newHoveredObject)) {
          selectionManager.current.highlightObject(newHoveredObject, selectionManager.current.highlightMaterial);
        }
        
        setHoveredObject(newHoveredObject);
      }
    }

    // Handle multi-selection updates
    if (mouseState.isDown && isMultiSelecting) {
      setMouseState(prev => ({ ...prev, currentPoint: point }));

      switch (selectionMethod) {
        case SelectionMethods.WINDOW:
        case SelectionMethods.CROSSING:
          selectionManager.current.updateWindowSelection(point);
          break;
          
        case SelectionMethods.LASSO:
          selectionManager.current.updateLassoSelection(point);
          break;
      }
    }
  }, [renderer, mouseState.isDown, isMultiSelecting, selectionMethod, hoveredObject, selectedObjects]);

  const handleMouseUp = useCallback((event) => {
    if (!selectionManager.current || !mouseState.isDown) return;

    const addToSelection = event.ctrlKey || event.metaKey;

    if (isMultiSelecting) {
      switch (selectionMethod) {
        case SelectionMethods.WINDOW:
        case SelectionMethods.CROSSING:
          selectionManager.current.finishWindowSelection(addToSelection);
          setIsMultiSelecting(false);
          break;
          
        case SelectionMethods.LASSO:
          selectionManager.current.finishLassoSelection(addToSelection);
          setIsMultiSelecting(false);
          break;
      }
    }

    setMouseState({
      isDown: false,
      startPoint: null,
      currentPoint: null,
      button: null
    });
  }, [mouseState.isDown, isMultiSelecting, selectionMethod]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((event) => {
    if (!selectionManager.current) return;

    switch (event.key.toLowerCase()) {
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          selectAll();
        }
        break;
        
      case 'i':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          invertSelection();
        }
        break;
        
      case 'escape':
        clearSelection();
        if (isMultiSelecting) {
          setIsMultiSelecting(false);
          selectionManager.current.clearTemporarySelection();
        }
        break;
        
      case 'delete':
      case 'backspace':
        if (selectedObjects.length > 0) {
          // Emit delete event for selected objects
          selectionManager.current.emit('deleteRequested', {
            objects: selectedObjects
          });
        }
        break;
    }
  }, [selectAll, invertSelection, clearSelection, isMultiSelecting, selectedObjects]);

  // Register event listeners
  useEffect(() => {
    if (!renderer || !renderer.domElement) return;

    const canvas = renderer.domElement;
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    // Prevent context menu on right click for polygonal selection
    const preventContextMenu = (e) => {
      if (selectionMethod === SelectionMethods.POLYGONAL) {
        e.preventDefault();
      }
    };
    canvas.addEventListener('contextmenu', preventContextMenu);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [renderer, handleMouseDown, handleMouseMove, handleMouseUp, handleKeyDown, selectionMethod]);

  // Group management functions
  const createGroup = useCallback((groupId, objectIds = null) => {
    if (!selectionManager.current) return false;
    
    const objects = objectIds || selectedObjects.map(obj => obj.uuid);
    return selectionManager.current.createGroup(groupId, objects);
  }, [selectedObjects]);

  const deleteGroup = useCallback((groupId) => {
    if (!selectionManager.current) return false;
    return selectionManager.current.deleteGroup(groupId);
  }, []);

  const selectGroup = useCallback((groupId) => {
    if (!selectionManager.current) return false;
    return selectionManager.current.selectGroup(groupId);
  }, []);

  const addToGroup = useCallback((groupId, objectIds = null) => {
    if (!selectionManager.current) return false;
    
    const objects = objectIds || selectedObjects.map(obj => obj.uuid);
    return selectionManager.current.addToGroup(groupId, objects);
  }, [selectedObjects]);

  const removeFromGroup = useCallback((groupId, objectIds = null) => {
    if (!selectionManager.current) return false;
    
    const objects = objectIds || selectedObjects.map(obj => obj.uuid);
    return selectionManager.current.removeFromGroup(groupId, objects);
  }, [selectedObjects]);

  // Selection transformation helpers
  const getSelectionBounds = useCallback(() => {
    if (!selectionManager.current || selectedObjects.length === 0) return null;

    const bounds = new THREE.Box3();
    selectedObjects.forEach(object => {
      const objectBounds = selectionManager.current.getObjectBoundingBox(object);
      if (objectBounds) {
        bounds.union(objectBounds);
      }
    });

    return bounds.isEmpty() ? null : bounds;
  }, [selectedObjects]);

  const getSelectionCenter = useCallback(() => {
    const bounds = getSelectionBounds();
    return bounds ? bounds.getCenter(new THREE.Vector3()) : null;
  }, [getSelectionBounds]);

  // Priority management
  const setObjectPriority = useCallback((object, priority) => {
    if (selectionManager.current) {
      selectionManager.current.setObjectPriority(object, priority);
    }
  }, []);

  // Selection validation
  const validateSelection = useCallback(() => {
    if (!selectionManager.current) return [];

    return selectedObjects.filter(obj => {
      return obj && obj.parent && selectionManager.current.isObjectSelectable(obj);
    });
  }, [selectedObjects]);

  // Get selection statistics
  const getSelectionStats = useCallback(() => {
    const validObjects = validateSelection();
    const stats = {
      total: validObjects.length,
      byType: {},
      byLayer: {},
      bounds: getSelectionBounds()
    };

    validObjects.forEach(obj => {
      const type = obj.userData?.type || 'unknown';
      const layer = obj.userData?.layer || 'default';
      
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      stats.byLayer[layer] = (stats.byLayer[layer] || 0) + 1;
    });

    return stats;
  }, [validateSelection, getSelectionBounds]);

  // Return hook interface
  return {
    // Selection state
    selectedObjects,
    selectedGroups,
    selectionCount,
    hoveredObject,
    isMultiSelecting,
    selectionMethod,
    activeFilters,
    mouseState,

    // Selection methods
    selectObject,
    clearSelection,
    selectAll,
    invertSelection,
    setSelectionMethod,
    setSelectionFilters,

    // Group management
    createGroup,
    deleteGroup,
    selectGroup,
    addToGroup,
    removeFromGroup,

    // Selection utilities
    getSelectionBounds,
    getSelectionCenter,
    getSelectionStats,
    validateSelection,
    setObjectPriority,

    // Selection state queries
    hasSelection: selectionCount > 0,
    isSelected: (object) => selectedObjects.includes(object),
    
    // Manager access for advanced usage
    selectionManager: selectionManager.current,

    // Available constants
    SelectionMethods,
    SelectionFilters
  };
};

export default useSelection; 