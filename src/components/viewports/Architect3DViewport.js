/**
 * Architect3D Viewport Component
 * 
 * Advanced 3D viewport using architect3d's smooth rendering system
 * This is a complete replacement viewport with better performance and interaction
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import standaloneCADEngine from '../../services/StandaloneCADEngine';
import { Architect3DWallService } from '../../services/Architect3DWallService';

// Import architect3d's core classes
import { Architect3DMain } from './architect3d/Architect3DMain';
import { StudioSixObjectBridge } from './architect3d/StudioSixObjectBridge';
import TransformControlsToolbar from './TransformControlsToolbar';

/**
 * Architect3D Viewport Component
 */
const Architect3DViewport = ({ 
  className = "",
  theme = "dark",
  selectedTool = "pointer",
  onObjectClick,
  onObjectHover,
  onGroundClick,
  style = {}
}) => {
  const containerRef = useRef();
  const canvasRef = useRef();
  const architect3DRef = useRef();
  const objectBridgeRef = useRef();
  const onObjectClickRef = useRef(onObjectClick);
  const onGroundClickRef = useRef(onGroundClick);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [architect3DServiceVersion, setArchitect3DServiceVersion] = useState(0);
  const architect3DServiceRef = useRef(null);
  
  // Transform controls state
  const [transformMode, setTransformMode] = useState('translate');
  const [transformSpace, setTransformSpace] = useState('local');
  const [selectedObject, setSelectedObject] = useState(null);

  // Update refs when props change
  useEffect(() => {
    onObjectClickRef.current = onObjectClick;
  }, [onObjectClick]);

  useEffect(() => {
    onGroundClickRef.current = onGroundClick;
  }, [onGroundClick]);

  // Initialize the architect3d system
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || isInitialized) return;

    console.log('🏗️ Initializing Architect3D Viewport');

    try {
      // Create object bridge
      objectBridgeRef.current = new StudioSixObjectBridge();

      // Create a simple model/scene structure that architect3d expects
      const mockModel = {
        scene: new THREE.Scene(),
        floorplan: {
          getCenter: () => new THREE.Vector3(0, 0, 0),
          getSize: () => new THREE.Vector3(20, 0, 20),
          addEventListener: () => {},
          removeEventListener: () => {},
          wallEdgePlanes: () => [],
          floorPlanes: () => []
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        exportForBlender: () => {},
        switchWireframe: () => {}
      };

      // Initialize architect3d's Main class
      const architect3DOptions = {
        resize: true,
        pushHref: false,
        spin: false, // Disable auto-spin initially
        spinSpeed: 0.00002,
        clickPan: true,
        canMoveFixedItems: true
      };

      console.log('🔍 VIEWPORT DEBUG: Container element:', {
        container: containerRef.current,
        containerTag: containerRef.current?.tagName,
        containerClasses: containerRef.current?.className,
        containerId: containerRef.current?.id,
        canvas: canvasRef.current,
        canvasTag: canvasRef.current?.tagName
      });

      // Add debugging event listeners to container
      if (containerRef.current) {
        containerRef.current.addEventListener('mousedown', (e) => {
          console.log('🔍 VIEWPORT CONTAINER: mousedown captured', {
            target: e.target,
            currentTarget: e.currentTarget,
            button: e.button,
            defaultPrevented: e.defaultPrevented
          });
        }, true); // Use capture phase

        containerRef.current.addEventListener('wheel', (e) => {
          console.log('🔍 VIEWPORT CONTAINER: wheel captured', {
            target: e.target,
            currentTarget: e.currentTarget,
            defaultPrevented: e.defaultPrevented
          });
        }, true); // Use capture phase
      }

      architect3DRef.current = new Architect3DMain(
        mockModel, 
        containerRef.current, 
        canvasRef.current, 
        architect3DOptions
      );

      // Set up event listeners for object interaction
      architect3DRef.current.addEventListener('itemSelected', (event) => {
        console.log('🎯 Object selected:', event.item);
        setSelectedObjectId(event.item?.id || null);
        setSelectedObject(event.item?.object || null);
        // Use refs to avoid dependency issues
        if (onObjectClickRef.current) {
          onObjectClickRef.current(event.item?.id, event.item);
        }
      });

      architect3DRef.current.addEventListener('itemUnselected', () => {
        console.log('🎯 Object deselected');
        setSelectedObjectId(null);
        setSelectedObject(null);
      });

      // Transform controls events
      architect3DRef.current.addEventListener('transform-mode-changed', (event) => {
        console.log('🎛️ Transform mode changed:', event.mode);
        setTransformMode(event.mode);
      });

      architect3DRef.current.addEventListener('object-transformed', (event) => {
        console.log('🎛️ Object transformed:', event.object.userData?.id);
        // You can add additional logic here to update the application state
      });

      architect3DRef.current.addEventListener('object-delete-requested', (event) => {
        console.log('🗑️ Object deletion requested:', event.objectId);
        handleObjectDeletion(event.objectId, event.objectType);
      });

      architect3DRef.current.addEventListener('floorClicked', (event) => {
        console.log('🏠 Floor clicked:', event.item);
        if (event.point && onGroundClickRef.current) {
          onGroundClickRef.current({
            x: event.point.x,
            y: event.point.y,
            z: event.point.z
          });
        }
      });

      architect3DRef.current.addEventListener('nothingClicked', () => {
        console.log('🌌 Nothing clicked');
        setSelectedObjectId(null);
      });

      // Start the render loop for smooth controls
      architect3DRef.current.startRenderLoop();
      
      setIsInitialized(true);
      console.log('✅ Architect3D Viewport initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Architect3D Viewport:', error);
    }

    // Cleanup
    return () => {
      if (architect3DRef.current) {
        // Clean up the architect3d instance
        architect3DRef.current.dispose?.();
        architect3DRef.current = null;
      }
      if (objectBridgeRef.current) {
        // Clean up the object bridge
        objectBridgeRef.current.clear();
        objectBridgeRef.current = null;
      }
      setIsInitialized(false);
    };
  }, []); // Remove dependencies to prevent re-initialization

  // Initialize architect3d service event bridge for 3D refresh
  useEffect(() => {
    if (!architect3DServiceRef.current) {
      // Try to find a shared service instance if the app passes it via window or elsewhere
      architect3DServiceRef.current = (window && window.__architect3DService) ? window.__architect3DService : null;
    }
    if (!architect3DServiceRef.current || !architect3DRef.current) return;
    
    const bump = () => setArchitect3DServiceVersion(v => v + 1);
    architect3DServiceRef.current.addEventListener('wallAdded', bump);
    architect3DServiceRef.current.addEventListener('wallUpdated', bump);
    architect3DServiceRef.current.addEventListener('wallRemoved', bump);
    architect3DServiceRef.current.addEventListener('roomCreated', bump);
    architect3DServiceRef.current.addEventListener('roomUpdated', bump);
    
    return () => {
      architect3DServiceRef.current.removeEventListener('wallAdded', bump);
      architect3DServiceRef.current.removeEventListener('wallUpdated', bump);
      architect3DServiceRef.current.removeEventListener('wallRemoved', bump);
      architect3DServiceRef.current.removeEventListener('roomCreated', bump);
      architect3DServiceRef.current.removeEventListener('roomUpdated', bump);
    };
  }, [isInitialized]);

  // Sync objects from StandaloneCADEngine
  useEffect(() => {
    if (!architect3DRef.current || !objectBridgeRef.current || !isInitialized) return;

    const updateObjects = async () => {
      console.log('🔄 Updating objects in Architect3D Viewport');
      const allObjects = standaloneCADEngine.getAllObjects();
      
      try {
        // Use the object bridge to sync objects with the scene (now async)
        await objectBridgeRef.current.syncWithStudioSixObjects(
          allObjects,
          architect3DRef.current.getScene()
        );

        // Force re-render
        architect3DRef.current.ensureNeedsUpdate();
        console.log('✅ Objects updated successfully in Architect3D Viewport');
      } catch (error) {
        console.error('❌ Failed to update objects in Architect3D Viewport:', error);
      }
    };

    const updateSelection = (data) => {
      const selectedIds = new Set(data.selectedObjects || []);
      setSelectedObjectId(selectedIds.size > 0 ? Array.from(selectedIds)[0] : null);
    };

    // Subscribe to CAD engine events
    standaloneCADEngine.addEventListener('object_created', updateObjects);
    standaloneCADEngine.addEventListener('object_updated', updateObjects);
    standaloneCADEngine.addEventListener('object_deleted', updateObjects);
    standaloneCADEngine.addEventListener('selection_changed', updateSelection);

    // Initialize with existing objects
    updateObjects();

    return () => {
      standaloneCADEngine.removeEventListener('object_created', updateObjects);
      standaloneCADEngine.removeEventListener('object_updated', updateObjects);
      standaloneCADEngine.removeEventListener('object_deleted', updateObjects);
      standaloneCADEngine.removeEventListener('selection_changed', updateSelection);
    };
  }, [isInitialized, architect3DServiceVersion]);

  // Handle window resize and additional mouse control setup
  useEffect(() => {
    if (!architect3DRef.current) return;

    const handleResize = () => {
      architect3DRef.current.updateWindowSize();
    };

    // Prevent context menu on right-click for better UX
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    // Disable text selection while dragging
    const handleSelectStart = (e) => {
      if (e.target === containerRef.current || containerRef.current?.contains(e.target)) {
        e.preventDefault();
      }
    };

    window.addEventListener('resize', handleResize);
    if (containerRef.current) {
      containerRef.current.addEventListener('contextmenu', handleContextMenu);
      containerRef.current.addEventListener('selectstart', handleSelectStart);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) {
        containerRef.current.removeEventListener('contextmenu', handleContextMenu);
        containerRef.current.removeEventListener('selectstart', handleSelectStart);
      }
    };
  }, [isInitialized]);

  // Update cursor based on selected tool
  const getCursorStyle = () => {
    switch(selectedTool) {
      case 'wall':
      case 'slab':
      case 'door':
      case 'window':
      case 'column':
        return 'crosshair';
      case 'pan':
      case 'orbit':
        return 'grab';
      case 'pointer':
      default:
        return 'default';
    }
  };

  // Handle tool changes with enhanced control modes
  useEffect(() => {
    if (!architect3DRef.current) return;

    // Update controls based on tool
    const controls = architect3DRef.current.controls;
    if (controls) {
      switch(selectedTool) {
        case 'pan':
          // Pan-only mode: disable rotation, enable panning and zoom
          controls.enableRotate = false;
          controls.enablePan = true;
          controls.enableZoom = true;
          controls.panSpeed = 1.2; // Faster panning in pan mode
          break;
        case 'orbit':
          // Orbit-only mode: enable rotation and zoom, disable panning
          controls.enableRotate = true;
          controls.enablePan = false;
          controls.enableZoom = true;
          controls.rotateSpeed = 0.8; // Faster rotation in orbit mode
          break;
        case 'pointer':
        default:
          // Default mode: enable all interactions with balanced speeds
          controls.enableRotate = true;
          controls.enablePan = true;
          controls.enableZoom = true;
          controls.rotateSpeed = 0.6;
          controls.panSpeed = 1.0;
          break;
      }
      
      // Force controls update
      controls.update();
    }

    // Update cursor
    if (architect3DRef.current.setCursorStyle) {
      architect3DRef.current.setCursorStyle(getCursorStyle());
    }
  }, [selectedTool]);

  // Enhanced navigation functions
  const handleResetView = useCallback(() => {
    if (architect3DRef.current) {
      // Stop any auto-rotation
      if (architect3DRef.current.controls) {
        architect3DRef.current.controls.autoRotate = false;
      }
      architect3DRef.current.centerCamera();
      architect3DRef.current.ensureNeedsUpdate();
    }
  }, []);

  const handleZoomFit = useCallback(() => {
    if (architect3DRef.current) {
      architect3DRef.current.centerCamera();
      architect3DRef.current.ensureNeedsUpdate();
    }
  }, []);

  // Keyboard shortcuts for navigation
  useEffect(() => {
    if (!isInitialized) return;

    const handleKeyDown = (e) => {
      // Only handle if the viewport container is focused or no input is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.contentEditable === 'true'
      );

      if (isInputFocused) return;

      switch(e.code) {
        case 'KeyF':
          // F key: Fit all objects
          e.preventDefault();
          handleZoomFit();
          break;
        case 'KeyH':
          // H key: Reset view
          e.preventDefault();
          handleResetView();
          break;
        case 'Escape':
          // Escape key: Deselect object and exit transform mode
          e.preventDefault();
          if (architect3DRef.current) {
            architect3DRef.current.deselectObject();
          }
          break;
          
        case 'Delete':
        case 'Backspace':
          // Delete/Backspace key: Delete selected object
          e.preventDefault();
          if (selectedObject && selectedObjectId) {
            handleObjectDeletion(selectedObjectId, selectedObject.userData?.type || 'furniture');
          }
          break;
        case 'Space':
          // Space: Stop auto-rotation and reset to pointer tool
          e.preventDefault();
          if (architect3DRef.current?.controls) {
            architect3DRef.current.controls.autoRotate = false;
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInitialized, handleResetView, handleZoomFit]);

  // Transform control handlers
  const handleTransformModeChange = useCallback((mode) => {
    if (architect3DRef.current) {
      architect3DRef.current.setTransformMode(mode);
    }
  }, []);

  const handleSpaceToggle = useCallback(() => {
    if (architect3DRef.current && architect3DRef.current.transformControls) {
      architect3DRef.current.transformControls.toggleSpace();
      const newSpace = transformSpace === 'local' ? 'world' : 'local';
      setTransformSpace(newSpace);
    }
  }, [transformSpace]);

  // Object deletion handler
  const handleObjectDeletion = useCallback((objectId, objectType) => {
    try {
      console.log('🗑️ VIEWPORT: Handling object deletion:', { objectId, objectType });
      
      // Remove from StandaloneCADEngine
      const success = standaloneCADEngine.deleteObject(objectId);
      
      if (success) {
        console.log('✅ VIEWPORT: Object deleted successfully:', objectId);
        
        // Clear selection state
        setSelectedObjectId(null);
        setSelectedObject(null);
        
        // Update viewports
        standaloneCADEngine.emit('object_deleted', { objectId, objectType });
      } else {
        console.warn('⚠️ VIEWPORT: Failed to delete object:', objectId);
      }
    } catch (error) {
      console.error('❌ VIEWPORT: Error deleting object:', error);
    }
  }, []);

  return (
    <div 
      className={`architect3d-viewport relative w-full h-full ${className}`}
      style={{
        ...style,
        cursor: getCursorStyle()
      }}
    >
      {/* Main container for architect3d */}
      <div 
        ref={containerRef}
        className="w-full h-full"
        style={{
          background: theme === 'light' 
            ? 'linear-gradient(to bottom, #e0f2fe 0%, #f8fafc 100%)' 
            : 'linear-gradient(to bottom, #1e293b 0%, #0f172a 100%)'
        }}
      >
        {/* Canvas will be injected here by architect3d */}
        <canvas 
          ref={canvasRef}
          className="w-full h-full"
        />
      </div>

      {/* Transform Controls Toolbar */}
      <TransformControlsToolbar
        currentMode={transformMode}
        onModeChange={handleTransformModeChange}
        isObjectSelected={!!selectedObject}
        currentSpace={transformSpace}
        onSpaceToggle={handleSpaceToggle}
      />
      
      {/* Enhanced Navigation controls */}
      <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
        <button
          onClick={handleResetView}
          className={`w-10 h-10 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center justify-center hover:scale-105 ${
            theme === 'dark' 
              ? 'bg-gray-900/60 border-gray-700/50 text-gray-300 hover:bg-gray-800/80 hover:border-gray-600/70' 
              : 'bg-white/60 border-gray-200/50 text-gray-700 hover:bg-white/80 hover:border-gray-300/70'
          }`}
          title="Reset View (H)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
        </button>
        <button
          onClick={handleZoomFit}
          className={`w-10 h-10 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center justify-center hover:scale-105 ${
            theme === 'dark' 
              ? 'bg-gray-900/60 border-gray-700/50 text-gray-300 hover:bg-gray-800/80 hover:border-gray-600/70' 
              : 'bg-white/60 border-gray-200/50 text-gray-700 hover:bg-white/80 hover:border-gray-300/70'
          }`}
          title="Fit All Objects (F)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <path d="M9 9h6v6"/>
            <path d="M9 15L15 9"/>
          </svg>
        </button>
      </div>

      {/* Mouse Control Instructions */}
      {selectedTool === 'pointer' && (
        <div className="absolute top-4 left-4 max-w-sm">
          <div className={`p-3 rounded-lg backdrop-blur-md border text-xs ${
            theme === 'dark'
              ? 'bg-gray-900/60 border-gray-700/50 text-gray-300'
              : 'bg-white/60 border-gray-200/50 text-gray-700'
          }`}>
            <div className="font-medium mb-2">Mouse Controls:</div>
            <div className="space-y-1 opacity-90">
              <div>• <strong>Left:</strong> Orbit around scene</div>
              <div>• <strong>Right:</strong> Pan view</div>
              <div>• <strong>Wheel:</strong> Zoom in/out</div>
              <div>• <strong>F:</strong> Fit all objects</div>
              <div>• <strong>H:</strong> Reset view</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Status display */}
      {selectedObjectId && (
        <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
          <div className="flex items-center space-x-2">
            <span className="font-medium">{selectedObjectId}</span>
            <span className="text-gray-300">•</span>
            <span className="text-xs text-gray-400">
              Advanced 3D Viewport (Architect3D)
            </span>
          </div>
        </div>
      )}

      {/* Initialization status */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="bg-white/90 dark:bg-gray-800/90 px-4 py-2 rounded-lg text-sm">
            Initializing Advanced 3D Viewport...
          </div>
        </div>
      )}
    </div>
  );
};


export default Architect3DViewport;