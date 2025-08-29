/**
 * CAD 2D Viewport Component
 * 
 * Restored original SVG-based 2D viewport design with standalone CAD engine integration
 * Shows top-down orthographic view of CAD objects with drafting capabilities
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { flushSync } from 'react-dom';
import * as martinez from 'martinez-polygon-clipping';
import standaloneCADEngine from '../../services/StandaloneCADEngine';
import { wallEdgeDetector, SNAP_TYPES } from '../../utils/WallEdgeDetection';
import { wallJoineryDebugger } from '../../utils/WallJoineryDebug';
import ifcService from '../../services/IFCService';
import * as Door2DRenderer from '../../plan2d/door2dRenderer';

// Toggle architect3D debug logging for this viewport only
const A3D_DEBUG = false;


/**
 * CAD 2D Viewport Component
 */
const CAD2DViewport = ({ 
  className = "",
  theme = "dark", 
  selectedTool = "pointer",
  currentFloor = "ground",
  onObjectClick,
  onObjectHover,
  onGroundClick,
  onDraftCurrentPointUpdate, // 🌉 COORDINATE BRIDGE: Callback to send snapped coordinates to App.js
  onIFCImport, // Callback to pass IFC data to parent for Xeokit display
  doorParams, // Door tool parameters for preview
  architect3DService, // 🏗️ Architect3D Wall Service for advanced wall creation
  onToolChange, // Callback to change the active tool
  style = {}
}) => {
  const svgRef = useRef(null);
  const [viewCenter, setViewCenter] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [objects, setObjects] = useState([]);
  const [selectedObjects, setSelectedObjects] = useState(new Set());
  const [hoveredElement, setHoveredElement] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  
  // Wall edge detection state
  const [hoveredWallEdge, setHoveredWallEdge] = useState(null);
  const [nearbyEdges, setNearbyEdges] = useState([]);
  const [wallSelectionMode, setWallSelectionMode] = useState(false);
  
  // Wall selection state
  const [hoveredWalls, setHoveredWalls] = useState(new Set());
  const [selectableWalls, setSelectableWalls] = useState(new Set());
  
  // 2D Drafting state
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftStartPoint, setDraftStartPoint] = useState(null);
  const [draftCurrentPoint, setDraftCurrentPoint] = useState(null);
  const [draftPreview, setDraftPreview] = useState(null);

  // Door placement cursor tracking
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  
  // 2D CAD Block placement state
  const [pendingCADBlock, setPendingCADBlock] = useState(null);
  const [cadBlockCursorPos, setCadBlockCursorPos] = useState({ x: 0, y: 0 });
  const [cadBlockSVGContent, setCadBlockSVGContent] = useState('');
  const cadBlockGhostContent = useMemo(() => {
    if (!cadBlockSVGContent) return '';
    try {
      // Strip outer <svg> wrapper to safely inject into current SVG
      return cadBlockSVGContent.replace(/<\/?svg[^>]*>/g, '');
    } catch {
      return cadBlockSVGContent;
    }
  }, [cadBlockSVGContent]);

  // Unified Element Selection System
  const detectElementType = useCallback((element) => {
    if (!element) return null;
    
    // Detect element type based on properties
    if (element.type) return element.type;
    if (element.params?.type) return element.params.type;
    if (element.geometry?.type) return element.geometry.type;
    
    // Fallback detection based on properties
    if (element.params?.thickness || element.thickness) return 'wall';
    if (element.params?.width && element.params?.height) return 'door';
    if (element.params?.radius) return 'column';
    if (element.mesh2D) return 'mesh_object';
    
    return 'unknown';
  }, []);

  const getElementProperties = useCallback((element) => {
    const elementType = detectElementType(element);
    
    const baseProperties = {
      id: element.id,
      type: elementType,
      position: element.position,
      rotation: element.rotation,
      visible: element.visible !== false
    };

    // Add type-specific properties
    switch (elementType) {
      case 'wall':
        return {
          ...baseProperties,
          thickness: element.params?.thickness || element.thickness || 0.2,
          height: element.params?.height || element.height || 2.7,
          material: element.params?.material || element.material || 'concrete',
          length: element.params?.length || element.length,
          startPoint: element.params?.startPoint,
          endPoint: element.params?.endPoint
        };
      
      case 'door':
        return {
          ...baseProperties,
          width: element.params?.width || element.width || 0.9,
          height: element.params?.height || element.height || 2.1,
          thickness: element.params?.thickness || element.thickness || 0.05,
          opening: element.params?.opening || 'right',
          material: element.params?.material || element.material || 'wood'
        };
      
      case 'window':
        return {
          ...baseProperties,
          width: element.params?.width || element.width || 1.2,
          height: element.params?.height || element.height || 1.5,
          sillHeight: element.params?.sillHeight || element.sillHeight || 0.9,
          material: element.params?.material || element.material || 'glass'
        };
      
      case 'column':
        return {
          ...baseProperties,
          radius: element.params?.radius || element.radius || 0.2,
          height: element.params?.height || element.height || 2.7,
          material: element.params?.material || element.material || 'concrete'
        };
      
      default:
        // Return all available properties for unknown types
        return {
          ...baseProperties,
          ...element.params,
          geometry: element.geometry,
          mesh2D: !!element.mesh2D
        };
    }
  }, [detectElementType]);

  const handleElementHover = useCallback((element, isHovering) => {
    if (isHovering) {
      setHoveredElement(element);
      onObjectHover?.(element?.id, getElementProperties(element));
    } else {
      setHoveredElement(null);
      onObjectHover?.(null, null);
    }
  }, [onObjectHover, getElementProperties]);

  const handleElementSelection = useCallback((element) => {
    if (element) {
      const properties = getElementProperties(element);
      setSelectedElement(element);
      setSelectedObjects(new Set([element.id]));
      standaloneCADEngine.selectObject(element.id);
      onObjectClick?.(element.id, properties);
    } else {
      setSelectedElement(null);
      setSelectedObjects(new Set());
      standaloneCADEngine.clearSelection();
      onObjectClick?.(null, null);
    }
  }, [onObjectClick, getElementProperties]);



  // IFC Import System
  const [ifcImporting, setIfcImporting] = useState(false);

  const importIFCFile = useCallback(async (file) => {
    try {
      setIfcImporting(true);
      console.log('📥 2D Viewport: Importing IFC file:', file.name);

      // Initialize IFC service if needed
      if (!ifcService.isInitialized) {
        await ifcService.initialize();
      }

      // Parse IFC file to extract 2D elements
      const ifcData = await ifcService.loadIFCFile(file, 'imported_model');
      console.log('📊 IFC Data extracted:', ifcData);

      // Convert IFC data to 2D viewport objects
      const viewport2DObjects = convertIFCTo2D(ifcData);
      console.log('🎯 2D Viewport objects created:', viewport2DObjects);

      // Add imported objects to the 2D viewport
      if (viewport2DObjects.length > 0) {
        setObjects(prevObjects => [...prevObjects, ...viewport2DObjects]);
        
        // Also add to standalone CAD engine for consistency
        viewport2DObjects.forEach(obj => {
          standaloneCADEngine.addObject(obj);
        });
      }

      // Notify parent component for 3D display in Xeokit
      if (onIFCImport) {
        onIFCImport(file, ifcData, viewport2DObjects);
      }

      console.log('✅ IFC import completed successfully');
      return { success: true, objects2D: viewport2DObjects, ifcData };

    } catch (error) {
      console.error('❌ IFC import failed:', error);
      return { success: false, error: error.message };
    } finally {
      setIfcImporting(false);
    }
  }, [onIFCImport]);

  const convertIFCTo2D = useCallback((ifcData) => {
    const objects2D = [];
    
    // Convert IFC walls to 2D objects
    if (ifcData.walls) {
      ifcData.walls.forEach((wall, index) => {
        objects2D.push({
          id: `ifc_wall_${index}`,
          type: 'wall',
          params: {
            thickness: wall.thickness || 0.2,
            height: wall.height || 2.7,
            material: wall.material || 'concrete',
            startPoint: wall.startPoint,
            endPoint: wall.endPoint,
            length: wall.length
          },
          position: wall.position,
          imported: true,
          source: 'ifc'
        });
      });
    }

    // Convert IFC doors to 2D objects  
    if (ifcData.doors) {
      ifcData.doors.forEach((door, index) => {
        objects2D.push({
          id: `ifc_door_${index}`,
          type: 'door',
          params: {
            width: door.width || 0.9,
            height: door.height || 2.1,
            thickness: door.thickness || 0.05,
            opening: door.opening || 'right',
            material: door.material || 'wood'
          },
          position: door.position,
          imported: true,
          source: 'ifc'
        });
      });
    }

    // Convert IFC windows to 2D objects
    if (ifcData.windows) {
      ifcData.windows.forEach((window, index) => {
        objects2D.push({
          id: `ifc_window_${index}`,
          type: 'window',
          params: {
            width: window.width || 1.2,
            height: window.height || 1.5,
            sillHeight: window.sillHeight || 0.9,
            material: window.material || 'glass'
          },
          position: window.position,
          imported: true,
          source: 'ifc'
        });
      });
    }

    return objects2D;
  }, []);

  // Handle drag and drop for IFC files
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const ifcFiles = files.filter(file => 
      file.name.toLowerCase().endsWith('.ifc') || 
      file.type === 'application/ifc' ||
      file.type === 'text/plain' // IFC files often appear as text/plain
    );

    if (ifcFiles.length > 0) {
      console.log('🎯 IFC files dropped:', ifcFiles.map(f => f.name));
      
      for (const file of ifcFiles) {
        await importIFCFile(file);
      }
    }
  }, [importIFCFile]);

  // Expose IFC import function
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.cad2dViewportImportIFC = importIFCFile;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.cad2dViewportImportIFC;
      }
    };
  }, [importIFCFile]);

  // 2D CAD Block placement functions
  const startSVGPlacement = useCallback(async (blockData) => {
    console.log('🎨 CAD2DViewport: Starting SVG placement for:', blockData.name);
    
    try {
      // Load SVG content
      console.log('📥 Loading SVG content from:', blockData.path);
      const response = await fetch(encodeURI(blockData.path));
      if (!response.ok) {
        throw new Error(`Failed to load SVG: ${response.statusText}`);
      }
      const svgContent = await response.text();
      
      // Set up placement state
      setPendingCADBlock(blockData);
      // Normalize SVG so it fits our ghost and placement rendering cleanly
      const normalized = svgContent
        .replace(/\swidth="[^"]*"/gi, '')
        .replace(/\sheight="[^"]*"/gi, '')
        .replace(/<svg(\s|>)/i, '<svg preserveAspectRatio="xMidYMid meet" ');
      setCadBlockSVGContent(normalized);
      setCadBlockCursorPos({ x: 0, y: 0 });
      
      console.log('✅ CAD2DViewport: SVG placement ready - cursor will follow mouse until clicked');
      
    } catch (error) {
      console.error('❌ Failed to start SVG placement:', error);
      setPendingCADBlock(null);
      setCadBlockSVGContent('');
    }
  }, []);

  const completeSVGPlacement = useCallback((worldPosition) => {
    if (!pendingCADBlock) return;
    
    console.log('🎯 CAD2DViewport: Placing SVG block at position:', worldPosition);
    
    // Create a new 2D CAD object
    // Extract basic viewBox dimensions for proper scaling/handles
    let viewBox = { minX: 0, minY: 0, width: 1, height: 1 };
    try {
      const vbMatch = cadBlockSVGContent.match(/viewBox="([^"]+)"/i);
      if (vbMatch) {
        const parts = vbMatch[1].split(/\s+/).map(Number);
        if (parts.length === 4 && parts.every(n => !isNaN(n))) {
          viewBox = { minX: parts[0], minY: parts[1], width: Math.max(1, parts[2]), height: Math.max(1, parts[3]) };
        }
      }
    } catch {}

    const cadBlock = {
      id: `cad2d-block-${Date.now()}`,
      type: '2d-cad-block',
      name: pendingCADBlock.name,
      position: { x: worldPosition.x, y: worldPosition.y, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      category: pendingCADBlock.category,
      subcategory: pendingCADBlock.subcategory,
      svgPath: pendingCADBlock.path,
      svgContent: cadBlockSVGContent,
      svgViewBox: viewBox,
      scale: { x: 1, y: 1, z: 1 },
      visible: true
    };
    
    // Add to objects list for rendering
    setObjects(prevObjects => [...prevObjects, cadBlock]);
    
    // Also add to standalone CAD engine
    standaloneCADEngine.addObject(cadBlock);
    
    // Clear placement state
    setPendingCADBlock(null);
    setCadBlockSVGContent('');
    setCadBlockCursorPos({ x: 0, y: 0 });
    
    console.log('✅ CAD2DViewport: SVG block placed successfully:', cadBlock.name);
    
    return cadBlock;
  }, [pendingCADBlock, cadBlockSVGContent]);

  // Expose placement functions to parent component
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.cad2DViewportRef = { current: { startSVGPlacement } };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.cad2DViewportRef;
      }
    };
  }, [startSVGPlacement]);

  // Check for pending CAD block on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.pendingCAD2DBlock) {
      startSVGPlacement(window.pendingCAD2DBlock);
      delete window.pendingCAD2DBlock;
    }
  }, [startSVGPlacement]);
  
  // Continuous drawing state for room creation
  const [isContinuousDrawing, setIsContinuousDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]); // Array of points for the current drawing sequence
  const [currentPreviewEnd, setCurrentPreviewEnd] = useState(null); // Current mouse position for preview
  
  // Professional door placement workflow state
  const [doorPlacementStep, setDoorPlacementStep] = useState(0); // 0: none, 1: positioning, 2: swing direction
  const [doorPlacementData, setDoorPlacementData] = useState(null);
  const [doorSwingDirection, setDoorSwingDirection] = useState('right'); // 'left' or 'right'

  const viewportTheme = theme;

  // Create unified element handlers (defined after state declarations to avoid hoisting issues)
  const createUnifiedElementHandlers = useCallback((element) => {
    // Disable wall selection when door tool is active for placement
    if (selectedTool === 'door' && element.type === 'wall') {
      return {
        onClick: (e) => {
          e.stopPropagation();
          // Don't select walls when door tool is active - let the SVG mouse handler take care of door placement
          window.console.warn('🚪 Wall clicked but door tool is active - ignoring wall selection');
        },
        style: { cursor: 'crosshair' },
        className: 'door-placement-target'
      };
    }
    
    return {
      onMouseEnter: () => handleElementHover(element, true),
      onMouseLeave: () => handleElementHover(element, false),
      onClick: (e) => {
        e.stopPropagation();
        handleElementSelection(element);
      },
      style: { cursor: 'pointer' },
      className: 'selectable-element'
    };
  }, [handleElementHover, handleElementSelection, selectedTool, doorPlacementStep]);

  // Handle escape key and door swing direction toggle
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isContinuousDrawing || isDrafting) {
          console.log('🚫 ESC pressed - canceling drawing');
          finishContinuousDrawing();
        } else if (doorPlacementStep > 0) {
          console.log('🚫 ESC pressed - canceling door placement');
          resetDoorPlacement();
        }
      } else if (event.key === 'Tab' && doorPlacementStep >= 1) {
        // Toggle swing direction during both step 1 and step 2
        event.preventDefault();
        const newDirection = doorSwingDirection === 'right' ? 'left' : 'right';
        setDoorSwingDirection(newDirection);
        console.log('🚪 Tab pressed - toggle door swing direction to:', newDirection);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isContinuousDrawing, isDrafting, doorPlacementStep, doorSwingDirection]);

  // Reset door placement when tool changes away from door
  useEffect(() => {
    if (selectedTool !== 'door' && doorPlacementStep > 0) {
      resetDoorPlacement();
    }
  }, [selectedTool, doorPlacementStep]);

  // Sanity checks for debugging
  useEffect(() => {
    console.warn("👀 CAD2DViewport mounted");
    return () => console.warn("👋 CAD2DViewport unmounted");
  }, []);

  useEffect(() => {
    console.warn("🔁 objects changed →", objects.length);
    // Also check if objects contains doors
    const doors = objects.filter(obj => obj.type === 'door');
    if (doors.length > 0) {
      console.warn("🚪 DOORS IN OBJECTS STATE:", doors.map(d => d.id));
    }
  }, [objects]);

  // Door tool workflow management
  useEffect(() => {
    if (selectedTool === 'door') {
      // Automatically set to step 1 when door tool is activated
      console.log('🚪 Door tool useEffect: setting step to 1, current step:', doorPlacementStep);
      setDoorPlacementStep(1);
      window.console.warn('🚪 Door tool ready for placement');
    } else {
      // Reset step when switching away from door tool
      setDoorPlacementStep(0);
    }
  }, [selectedTool]);

  // Reset cursor when switching away from opening tool
  useEffect(() => {
    if (svgRef.current && selectedTool !== 'opening') {
      svgRef.current.style.cursor = 'default';
    }
  }, [selectedTool]);

  // Calculate proper wall intersection points for corner joinery
  const calculateWallIntersections = useCallback((points, wallThickness) => {
    if (points.length <= 2) return points;
    
    console.log('🎯 Calculating wall intersections for proper corners...');
    const adjustedPoints = [...points];
    const halfThickness = wallThickness * 0.5;
    
    // Process each interior point (not the first or last)
    for (let i = 1; i < points.length - 1; i++) {
      const prevPoint = points[i - 1];
      const currentPoint = points[i];
      const nextPoint = points[i + 1];
      
      // Calculate wall directions
      const dir1 = {
        x: currentPoint.x - prevPoint.x,
        z: currentPoint.z - prevPoint.z
      };
      const dir2 = {
        x: nextPoint.x - currentPoint.x,
        z: nextPoint.z - currentPoint.z
      };
      
      // Normalize directions
      const len1 = Math.sqrt(dir1.x * dir1.x + dir1.z * dir1.z);
      const len2 = Math.sqrt(dir2.x * dir2.x + dir2.z * dir2.z);
      
      if (len1 > 0 && len2 > 0) {
        dir1.x /= len1;
        dir1.z /= len1;
        dir2.x /= len2;
        dir2.z /= len2;
        
        // Calculate wall centerlines extended
        const line1Start = {
          x: prevPoint.x - dir1.x * halfThickness,
          z: prevPoint.z - dir1.z * halfThickness
        };
        const line1End = {
          x: currentPoint.x + dir1.x * halfThickness,
          z: currentPoint.z + dir1.z * halfThickness
        };
        
        const line2Start = {
          x: currentPoint.x - dir2.x * halfThickness,
          z: currentPoint.z - dir2.z * halfThickness
        };
        const line2End = {
          x: nextPoint.x + dir2.x * halfThickness,
          z: nextPoint.z + dir2.z * halfThickness
        };
        
        // Find intersection of the two wall centerlines
        const intersection = lineIntersection(line1Start, line1End, line2Start, line2End);
        
        if (intersection) {
          console.log(`🎯 Adjusted corner ${i}: (${currentPoint.x.toFixed(3)}, ${currentPoint.z.toFixed(3)}) -> (${intersection.x.toFixed(3)}, ${intersection.z.toFixed(3)})`);
          adjustedPoints[i] = {
            x: intersection.x,
            y: currentPoint.y, // Keep same height
            z: intersection.z
          };
        }
      }
    }
    
    return adjustedPoints;
  }, []);
  
  // Helper function to find intersection of two lines
  const lineIntersection = useCallback((p1, p2, p3, p4) => {
    const x1 = p1.x, y1 = p1.z, x2 = p2.x, y2 = p2.z;
    const x3 = p3.x, y3 = p3.z, x4 = p4.x, y4 = p4.z;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) {
      // Lines are parallel
      return null;
    }
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    
    return {
      x: x1 + t * (x2 - x1),
      z: y1 + t * (y2 - y1)
    };
  }, []);

  // Function to create walls with proper joinery
  const createWallsWithJoinery = (points) => {
    if (points.length < 2) return [];
    
    console.log('🏗️ Creating walls with proper corner joinery for points:', points);
    const createdWalls = [];
    const wallThickness = 0.2; // Wall thickness in meters
    
    // Calculate proper intersection points for corner joinery
    const adjustedPoints = calculateWallIntersections(points, wallThickness);
    
    // Create walls between adjusted intersection points
    for (let i = 0; i < adjustedPoints.length - 1; i++) {
      const startPoint = adjustedPoints[i];
      const endPoint = adjustedPoints[i + 1];
      
      // Calculate wall direction vector
      const deltaX = endPoint.x - startPoint.x;
      const deltaZ = endPoint.z - startPoint.z;
      const length = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
      
      if (length > 0.1) { // Minimum wall length
        console.log(`🧱 WALL CREATION DEBUG - Segment ${i + 1} (PROPER CORNERS):`, {
          'length': length.toFixed(3),
          'startPoint (adjusted)': {
            x: startPoint.x.toFixed(3),
            y: startPoint.y.toFixed(3),
            z: startPoint.z.toFixed(3)
          },
          'endPoint (adjusted)': {
            x: endPoint.x.toFixed(3),
            y: endPoint.y.toFixed(3),
            z: endPoint.z.toFixed(3)
          }
        });
        
        const wallId = standaloneCADEngine.createObject('wall', {
          length: length,
          height: 2.5,
          thickness: wallThickness,
          material: 'concrete',
          startPoint: startPoint,
          endPoint: endPoint,
          autoExtend: true,  // Enable auto-extend for better corner connections
          forceCornerExtension: true  // Force extension for proper corner joinery
        });
        
        console.log(`🧱 WALL CREATED: ID ${wallId} with proper corner intersection`);
        
        createdWalls.push({
          id: wallId,
          startPoint,
          endPoint,
          length
        });
        
        console.log(`✅ Created wall ${i + 1}: ${wallId}`);
      }
    }
    
    // Apply joinery after all walls are created
    if (createdWalls.length > 1) {
      console.log('🔧 FIXED: Applying structural joinery to connected walls (anti-loop)...');
      
      // FIXED: Use debounced scheduling instead of direct setTimeout call
      if (standaloneCADEngine.scheduleJoineryUpdate) {
        standaloneCADEngine.scheduleJoineryUpdate();
        console.log('✅ Wall joinery scheduled successfully (debounced)');
      } else {
        // Fallback for older CAD engine versions
        console.log('⚠️ Using fallback joinery method');
        setTimeout(() => {
          standaloneCADEngine.updateWallJoinery();
        }, 400);
      }
      
      // Force refresh the 2D viewport to show joinery changes
      setTimeout(() => {
        console.log('🔄 Refreshing 2D viewport after joinery...');
        const refreshedObjects = standaloneCADEngine.getAllObjects();
        setObjects(refreshedObjects);
        
        // Update wall edge detector with refreshed wall data
        const wallObjects = refreshedObjects.filter(obj => obj.type === 'wall');
        if (wallObjects.length > 0) {
          wallEdgeDetector.updateWallEdges(wallObjects);
          console.log('🔍 Updated wall edge detector after joinery refresh');
        }
      }, 150);
    }
    
    return createdWalls;
  };

  // Function to finish continuous drawing
  const finishContinuousDrawing = () => {
    console.log('✅ Finishing continuous drawing sequence');
    
    // Create all walls at once if we have enough points
    if (drawingPoints.length >= 2) {
      const createdWalls = createWallsWithJoinery(drawingPoints);
      console.log(`🏠 Room completed with ${createdWalls.length} walls`);
      
      // Force refresh to show all created walls
      setTimeout(() => {
        const refreshedObjects = standaloneCADEngine.getAllObjects();
        setObjects(refreshedObjects);
      }, 100);
    }
    
    // Reset all drawing state
    setIsContinuousDrawing(false);
    setDrawingPoints([]);
    setCurrentPreviewEnd(null);
    setIsDrafting(false);
    setDraftStartPoint(null);
    setDraftCurrentPoint(null);
    setDraftPreview(null);
  };

  // Function to reset door placement workflow
  const resetDoorPlacement = () => {
    setDoorPlacementStep(0);
    setDoorPlacementData(null);
    setDoorSwingDirection('right');
  };

  // Update wall edge detector when objects change
  useEffect(() => {
    if (objects.length > 0) {
      const wallObjects = objects.filter(obj => obj.type === 'wall');
      wallEdgeDetector.updateWallEdges(wallObjects);
      console.log('🔍 Updated wall edge detector with', wallObjects.length, 'walls');
    }
  }, [objects]);

  // Sync with CAD engine
  useEffect(() => {
    const updateObjects = () => {
      console.log('🔄 2D Viewport: Updating objects from CAD engine...');
      const allObjects = standaloneCADEngine.getAllObjects();
      console.log('📊 2D Viewport: Received objects from engine:', allObjects);
      console.log('📊 2D Viewport: Total object count:', allObjects.length);
      
      // Detailed debugging for each object
      allObjects.forEach((obj, index) => {
        console.log(`📦 2D Viewport Object ${index}:`, {
          id: obj.id,
          type: obj.type,
          position: obj.position,
          params: obj.params,
          hasPosition: !!obj.position,
          hasParams: !!obj.params,
          fullObject: obj
        });
        
        // Extra debugging for walls to track property changes
        if (obj.type === 'wall') {
          console.log(`🧱 2D Viewport: Wall ${obj.id} details:`, {
            length: obj.length || obj.params?.length,
            height: obj.height || obj.params?.height,
            thickness: obj.thickness || obj.params?.thickness,
            material: obj.material || obj.params?.material,
            lastUpdated: obj.params?.lastUpdated || 'unknown'
          });
        }
      });
      
      // Filter objects by current floor
      const floorObjects = allObjects.filter(obj => {
        // For now, we'll show all objects if they don't have floor info
        // In a real implementation, objects would have a floor property
        return !obj.floor || obj.floor === currentFloor;
      });
      
      console.log('🏢 2D Viewport: Objects for current floor:', floorObjects);
      console.log('🏢 2D Viewport: Floor objects count:', floorObjects.length);
      
      // Force a state update even if the objects array looks the same
      setObjects([...floorObjects]);
      console.log('✅ 2D Viewport: Object state updated, should trigger re-render');
    };

    const updateSelection = (data) => {
      console.log('🎯 2D Viewport: Selection changed:', data);
      setSelectedObjects(new Set(data.selectedObjects || []));
    };

    const handleObjectCreated = (data) => {
      console.log('➕ 2D Viewport: Object created event received:', data);
      updateObjects();
    };

    const handleObjectUpdated = (data) => {
      console.log('🔄 2D Viewport: Object updated event received:', data);
      console.log('🔄 2D Viewport: Event data details:', {
        hasObject: !!data.object,
        objectId: data.objectId,
        timestamp: data.timestamp,
        objectType: data.object?.type,
        fullEventData: data
      });
      updateObjects();
    };

    const handleObjectDeleted = (data) => {
      console.log('🗑️ 2D Viewport: Object deleted event received:', data);
      updateObjects();
    };

    const handleModelState = (data) => {
      console.log('📊 2D Viewport: Model state event received:', data);
      setObjects(data.objects || []);
    };

    const handleObjectsChanged = (data) => {
      console.log('🔄 2D Viewport: Objects changed event received:', data);
      updateObjects(); // Force refresh from engine
    };

    standaloneCADEngine.addEventListener('object_created', handleObjectCreated);
    standaloneCADEngine.addEventListener('object_updated', handleObjectUpdated);
    standaloneCADEngine.addEventListener('object_deleted', handleObjectDeleted);
    standaloneCADEngine.addEventListener('selection_changed', updateSelection);
    standaloneCADEngine.addEventListener('model_state', handleModelState);
    standaloneCADEngine.addEventListener('objects_changed', handleObjectsChanged);

    console.log('🎧 2D Viewport: Event listeners registered');

    // Initialize
    updateObjects();
    setSelectedObjects(new Set(standaloneCADEngine.getSelectedObjects().map(obj => obj.id)));

    return () => {
      console.log('🧹 2D Viewport: Cleaning up event listeners');
      standaloneCADEngine.removeEventListener('object_created', handleObjectCreated);
      standaloneCADEngine.removeEventListener('object_updated', handleObjectUpdated);
      standaloneCADEngine.removeEventListener('object_deleted', handleObjectDeleted);
      standaloneCADEngine.removeEventListener('selection_changed', updateSelection);
      standaloneCADEngine.removeEventListener('model_state', handleModelState);
      standaloneCADEngine.removeEventListener('objects_changed', handleObjectsChanged);
    };
  }, [currentFloor]);

  // Tools that support click-and-drag drafting
  const isDraftingTool = useCallback((tool) => {
    return ['wall', 'beam', 'slab', 'ramp'].includes(tool);
  }, []);

  // Tools that support wall placement
  const isWallPlacementTool = useCallback((tool) => {
    return ['door', 'window'].includes(tool);
  }, []);

  // Find wall surface for door placement (not just edges)
  const findWallSurfaceAtPoint = useCallback((point, objects, tolerance = 0.5) => {
    try {
      if (!point || !objects) return null;
      
      const walls = objects.filter(obj => obj.type === 'wall');
    
    for (const wall of walls) {
      if (!wall || !wall.params) continue;
      
      const params = wall.params;
      const thickness = params.thickness || 0.2;
      
      // Use adjusted points if available
      const startPoint = params.adjustedStartPoint || params.startPoint;
      const endPoint = params.adjustedEndPoint || params.endPoint;
      
      if (!startPoint || !endPoint || 
          typeof startPoint.x !== 'number' || typeof startPoint.z !== 'number' ||
          typeof endPoint.x !== 'number' || typeof endPoint.z !== 'number') {
        continue;
      }
      
      // Calculate wall direction and perpendicular
      const wallDir = {
        x: endPoint.x - startPoint.x,
        z: endPoint.z - startPoint.z
      };
      const wallLength = Math.sqrt(wallDir.x * wallDir.x + wallDir.z * wallDir.z);
      
      if (wallLength === 0) continue;
      
      // Normalize direction
      wallDir.x /= wallLength;
      wallDir.z /= wallLength;
      
      // Perpendicular direction (for thickness)
      const perpDir = {
        x: -wallDir.z,
        z: wallDir.x
      };
      
      // Calculate wall center line
      const centerStart = {
        x: startPoint.x,
        y: startPoint.z
      };
      const centerEnd = {
        x: endPoint.x,
        y: endPoint.z
      };
      
      // Validate required variables before using
      if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' ||
          !centerStart || typeof centerStart.x !== 'number' || typeof centerStart.y !== 'number' ||
          !centerEnd || typeof centerEnd.x !== 'number' || typeof centerEnd.y !== 'number') {
        continue;
      }
      
      // Project point onto wall center line
      const toPoint = {
        x: point.x - centerStart.x,
        y: point.y - centerStart.y
      };
      
      const wallDirection2D = {
        x: centerEnd.x - centerStart.x,
        y: centerEnd.y - centerStart.y
      };
      
      // Calculate projection ratio (0 to 1 along wall)
      const projectionDot = toPoint.x * wallDirection2D.x + toPoint.y * wallDirection2D.y;
      const wallLengthSq = wallDirection2D.x * wallDirection2D.x + wallDirection2D.y * wallDirection2D.y;
      const projectionRatio = Math.max(0, Math.min(1, projectionDot / wallLengthSq));
      
      // Find closest point on wall center line
      const closestPoint = {
        x: centerStart.x + wallDirection2D.x * projectionRatio,
        y: centerStart.y + wallDirection2D.y * projectionRatio
      };
      
      // Calculate distance from point to wall center line
      const distanceVector = {
        x: point.x - closestPoint.x,
        y: point.y - closestPoint.y
      };
      const distance = Math.sqrt(distanceVector.x * distanceVector.x + distanceVector.y * distanceVector.y);
      
      // Check if point is within wall thickness + tolerance
      if (distance <= (thickness / 2) + tolerance) {
        return {
          wallId: wall.id,
          distance: distance,
          closestPoint: { x: closestPoint.x, y: closestPoint.y },
          projectionRatio: projectionRatio,
          wallWidth: thickness,
          wallCenter: {
            start: centerStart,
            end: centerEnd
          },
          edge: {
            edgeType: 'surface', // Custom type for wall surface
            angle: Math.atan2(wallDirection2D.y, wallDirection2D.x),
            getPlacementPoint: (ratio) => ({
              x: centerStart.x + wallDirection2D.x * ratio,
              y: centerStart.y + wallDirection2D.y * ratio,
              z: 0
            })
          }
        };
      }
    }
    
    return null;
    } catch (error) {
      console.error('🚪 Error in findWallSurfaceAtPoint:', error);
      console.error('🚪 Point:', point, 'Objects count:', objects?.length);
      return null;
    }
  }, []);

  // Debug: Log current tool selection and update wall selection mode
  useEffect(() => {
    // Initialize cursor position for door tool
    if (selectedTool === 'door') {
      setCursorPosition({ x: 0, y: 0 });
      window.console.warn('🚪 Door tool activated');
    }
    
    // Enable wall selection mode for door/window tools and wall tool
    const isWallMode = isWallPlacementTool(selectedTool) || selectedTool === 'wall';
    setWallSelectionMode(isWallMode);
    
    if (isWallMode) {
      // Mark all walls as selectable when entering wall selection mode
      const wallIds = new Set(objects.filter(obj => obj.type === 'wall').map(obj => obj.id));
      setSelectableWalls(wallIds);
      if (selectedTool === 'door') {
        window.console.warn('🚪 Wall selection mode enabled for door placement. Walls available:', wallIds.size);
      }
    } else {
      setSelectableWalls(new Set());
    }
    
    // Clear any previous hover state when changing tools
    setHoveredWallEdge(null);
    setNearbyEdges([]);
    setHoveredWalls(new Set());
  }, [selectedTool, isDraftingTool, isWallPlacementTool]);

  // Convert 3D position to 2D plan view (X-Z plane, Y is height)
  // Using standard CAD coordinate system: 1 unit = 1 meter
  const to2D = useCallback((pos3d) => {
    try {
      // Defensive: accept inputs shaped as XY (architect3d) or XZ (app world)
      if (!pos3d || (typeof pos3d.x !== 'number' && typeof pos3d.z !== 'number')) {
        return { x: 400, y: 300 };
      }
      
    const scale = 100 * zoom; // Increased scale for more intuitive drawing (100px per meter)
      if (!isFinite(scale) || scale === 0) {
        console.warn('🔧 to2D: Invalid scale', { zoom, scale });
        return { x: 400, y: 300 };
      }
      
      const x = typeof pos3d.x === 'number' ? pos3d.x : 0;
      // If z is missing but y exists (architect3d XY), treat y as z
      const z = typeof pos3d.z === 'number' ? pos3d.z : (typeof pos3d.y === 'number' ? pos3d.y : 0);
      
      const result = {
        x: 400 + Math.round((x - viewCenter.x) * scale),
        y: 300 + Math.round((z - viewCenter.y) * scale)
      };
      
      if (!isFinite(result.x) || !isFinite(result.y)) {
        console.warn('🔧 to2D: Non-finite result', { pos3d, result, viewCenter, scale });
        return { x: 400, y: 300 };
      }
      
      return result;
    } catch (error) {
      console.error('🔧 to2D: Exception caught', error, { pos3d, viewCenter, zoom });
      return { x: 400, y: 300 };
    }
  }, [viewCenter, zoom]);

  // Convert 2D click back to 3D position
  const to3D = useCallback((pos2d) => {
    const scale = 100 * zoom; // Match the scale above
    const xWorld = viewCenter.x + (pos2d.x - 400) / scale;
    const zWorld = viewCenter.y + (pos2d.y - 300) / scale;
    const worldPos = { x: xWorld, y: 0, z: zWorld };

    // Optional: enable this if you need transform diagnostics
    // if (A3D_DEBUG) console.log('🔄 COORDINATE TRANSFORM DEBUG:', { pos2d, zoom, scale, viewCenter, worldPos });
    
    return worldPos;
  }, [viewCenter, zoom]);

  // Helper function to find the nearest wall to a position
  const findNearestWall = useCallback((position) => {
    const walls = objects.filter(obj => obj.type === 'wall');
    let nearestWall = null;
    let minDistance = Infinity;
    
    walls.forEach(wall => {
      if (!wall.startPoint || !wall.endPoint) return;
      
      // Calculate distance from position to wall line segment
      const wallStart = { x: wall.startPoint.x, z: wall.startPoint.z };
      const wallEnd = { x: wall.endPoint.x, z: wall.endPoint.z };
      const pos = { x: position.x, z: position.z };
      
      // Calculate closest point on line segment to position
      const A = pos.x - wallStart.x;
      const B = pos.z - wallStart.z;
      const C = wallEnd.x - wallStart.x;
      const D = wallEnd.z - wallStart.z;
      
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      
      if (lenSq === 0) return; // Degenerate wall
      
      let param = dot / lenSq;
      param = Math.max(0, Math.min(1, param)); // Clamp to line segment
      
      const closestPoint = {
        x: wallStart.x + param * C,
        z: wallStart.z + param * D
      };
      
      const distance = Math.sqrt(
        Math.pow(pos.x - closestPoint.x, 2) + 
        Math.pow(pos.z - closestPoint.z, 2)
      );
      
      // Consider wall if click is within reasonable distance (1 meter)
      if (distance < minDistance && distance <= 1.0) {
        minDistance = distance;
        nearestWall = wall;
      }
    });
    
    return nearestWall;
  }, [objects]);

  // Handle SVG mouse down for drafting or selection
  const handleSvgMouseDown = useCallback((event) => {
    window.console.warn('🖱️ SVG MOUSE DOWN EVENT START:', {
      selectedTool: selectedTool,
      button: event.button,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      timestamp: Date.now()
    });
    
    // Prevent tool switching during door placement
    if (selectedTool === 'door' && doorPlacementStep >= 1) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Debug door tool clicks
    if (selectedTool === 'door') {
      window.console.warn('🚪 DOOR TOOL SVG CLICK:', { 
        tool: selectedTool, 
        step: doorPlacementStep,
        wallMode: wallSelectionMode,
        hoveredEdge: !!hoveredWallEdge,
        hoveredEdgeId: hoveredWallEdge?.wallId || 'none'
      });
    }

    // Handle panning first
    if (event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: event.clientX, y: event.clientY });
      return;
    }

    const rect = svgRef.current.getBoundingClientRect();
    const clickPos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // Check if clicking on an object
    let clickedObject = null;
    for (const object of objects) {
      const pos2d = to2D(object.position);
      const scale = 40 * zoom;
      const objWidth = (object.length || object.width || 1) * scale;
      const objHeight = (object.thickness || object.depth || object.width || 1) * scale;
      
      if (clickPos.x >= pos2d.x - objWidth/2 && 
          clickPos.x <= pos2d.x + objWidth/2 && 
          clickPos.y >= pos2d.y - objHeight/2 && 
          clickPos.y <= pos2d.y + objHeight/2) {
        clickedObject = object;
        break;
      }
    }

    if (clickedObject) {
      // Select object using unified system
      window.console.warn('🎯 CLICKED ON OBJECT:', clickedObject.id, clickedObject.type);
      handleElementSelection(clickedObject);
    } else if (wallSelectionMode && selectedTool === 'door') {
      window.console.warn('🎯 WALL SELECTION MODE + HOVERED WALL EDGE PATH');
      // Handle professional door/window placement workflow
      window.console.warn('🚪 Wall edge clicked for', selectedTool, 'placement');
      
      const worldPos = to3D(clickPos);
      const queryPoint = { x: worldPos.x, y: worldPos.z };
      
      // Get object dimensions based on tool type
      const objectDimensions = {
        door: { width: 0.9, height: 2.1, thickness: 0.05 },
        window: { width: 1.2, height: 1.4, thickness: 0.05 }
      };
      
      const dims = objectDimensions[selectedTool] || objectDimensions.door;
        
        if (selectedTool === 'door') {
        // For doors, detect wall surface at click point
        const clickWallEdge = findWallSurfaceAtPoint(queryPoint, objects);
        window.console.warn('🚪 Wall surface at click:', !!clickWallEdge);
        
        if (clickWallEdge) {
          window.console.warn('✅ Valid door placement found on wall surface:', clickWallEdge.wallId);
          // Professional door placement workflow
          if (doorPlacementStep === 1) {
            // Step 1: Immediate door creation with default swing direction (single-click placement)
            // Use door parameters from tool if available
            const actualDoorParams = doorParams || {};
            window.console.warn('🚪 Creating door now with params:', actualDoorParams);
            const doorId = standaloneCADEngine.createObject('door', {
              width: actualDoorParams.width || dims.width,
              height: actualDoorParams.height || dims.height,
              thickness: actualDoorParams.thickness || dims.thickness,
              wallId: clickWallEdge.wallId,
              position: {
                x: clickWallEdge.closestPoint.x,
                y: dims.height / 2,
                z: clickWallEdge.closestPoint.y
              },
              rotation: {
                x: 0,
                y: clickWallEdge.edge.angle,
                z: 0
              },
              material: actualDoorParams.material || 'wood',
              openingDirection: actualDoorParams.openingDirection || doorSwingDirection,
              frameWidth: actualDoorParams.frameWidth || 0.05,
              insertionMode: 'insert_in_wall',
              hostWallId: clickWallEdge.wallId
            });
            
            window.console.warn(`✅ Door placed with single click - ID:`, doorId);
            
            // Force refresh objects to show new door
            if (doorId) {
              const currentObjects = standaloneCADEngine.getAllObjects();
              window.console.warn('🚪 Refreshing objects after door creation. Total objects:', currentObjects.length);
              window.console.warn('🚪 Door object:', currentObjects.find(obj => obj.id === doorId));
              window.console.warn('🚪 ALL OBJECTS:', currentObjects.map(obj => ({ id: obj.id, type: obj.type })));
              
              // Use flushSync to force React to re-render immediately
              console.warn('🔥 CALLING setObjects with flushSync, objects:', currentObjects.length);
              flushSync(() => {
                setObjects([...currentObjects]);
                console.warn('🔥 setObjects called inside flushSync');
              });
              console.warn('🔥 flushSync completed');
            }
            
            // Clear placement data but keep door tool active for continuous placement
            setDoorPlacementData(null);
            setDoorSwingDirection('right');
            
            // Clear hover state after placement
            setHoveredWallEdge(null);
            setNearbyEdges([]);
            
            // Keep door tool active (step 1) for multiple door placements
            // User can switch to pointer tool manually if desired
          } else {
            window.console.warn('🚪 No hovered wall edge found for door placement');
            window.console.warn('🚪 Available walls:', objects.filter(obj => obj.type === 'wall').length);
            window.console.warn('🚪 Wall selection mode:', wallSelectionMode);
          }
          }
        } else {
        // For non-door tools, use the original wall edge detection and validation
        const placement = wallEdgeDetector.validatePlacement(
          queryPoint, 
          dims.width, 
          dims.height, 
          objects.filter(obj => obj.type === selectedTool)
        );
        
        if (placement.valid) {
          console.log('✅ Valid placement found:', placement.placementInfo);
          
          // Windows use immediate placement (no swing direction needed)
          const objectId = standaloneCADEngine.createObject(selectedTool, {
            width: dims.width,
            height: dims.height,
            thickness: dims.thickness,
            wallId: placement.placementInfo.wallId,
            position: {
              x: placement.placementInfo.position.x,
              y: dims.height / 2,
              z: placement.placementInfo.position.y
            },
            rotation: {
              x: 0,
              y: placement.placementInfo.rotation,
              z: 0
            },
            material: 'glass'
          });
          
          console.log(`✅ ${selectedTool} placed on wall with ID:`, objectId);
          
          // Clear hover state after placement
          setHoveredWallEdge(null);
          setNearbyEdges([]);
      } else {
          console.warn('❌ Invalid placement for non-door tool');
        }
      }
    } else {
      window.console.warn('🎯 NO CLICK CONDITIONS MET:', {
        clickedObject: !!clickedObject,
        wallSelectionMode: wallSelectionMode,
        hoveredWallEdge: !!hoveredWallEdge,
        selectedTool: selectedTool
      });
    }

    if (selectedTool === 'opening') {
      // 🕳️ OPENING: Handle opening tool
      console.log('🕳️ OPENING: Opening tool clicked in 2D viewport');
      
      const worldPos3D = to3D(clickPos);
      console.log('🕳️ OPENING: Click position:', { clickPos, worldPos3D });
      
      // Find the nearest wall to create an opening
      const nearestWall = findNearestWall(worldPos3D);
      if (nearestWall) {
        console.log('🕳️ OPENING: Found nearest wall:', nearestWall.id);
        
        // Create an opening object on the wall
        const opening = {
          id: `opening_${Date.now()}`,
          type: 'opening',
          wallId: nearestWall.id,
          position: worldPos3D,
          width: 1.0, // Default 1m wide opening
          height: 2.0, // Default 2m high opening
          created: new Date().toISOString()
        };
        
        // Add opening to the CAD engine
        const addedOpening = standaloneCADEngine.addObject(opening);
        
        if (addedOpening) {
          console.log('🕳️ OPENING: Created opening:', opening.id);
          
          // Force objects refresh to show the opening
          const currentObjects = standaloneCADEngine.getAllObjects();
          setObjects([...currentObjects]);
        } else {
          console.warn('🕳️ OPENING: Failed to add opening to CAD engine');
        }
      } else {
        console.warn('🕳️ OPENING: No wall found near click position');
      }
    } else if (selectedTool && selectedTool !== 'pointer') {
      console.log(`🖱️ 2D Viewport: Mouse down with tool "${selectedTool}"`);
      
      if (isDraftingTool(selectedTool)) {
        let worldPos = to3D(clickPos);
        
        // Apply automatic angle snapping for wall drawing (same as mouse move logic)
        if (selectedTool === 'wall' && draftStartPoint) {
          const deltaX = worldPos.x - draftStartPoint.x;
          const deltaZ = worldPos.z - draftStartPoint.z;
          const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
          
          if (distance > 0.1) { // Minimum distance to avoid division by zero
            // Calculate current angle in radians with higher precision
            let angle = Math.atan2(deltaZ, deltaX);
            
            // Normalize angle to 0-2π range
            if (angle < 0) angle += 2 * Math.PI;
            
            // Same cardinal-only angle snapping as mouse move
            const cardinalAngles = [
              0,                           // 0° - East (horizontal right)
              Math.PI / 2,                 // 90° - North (vertical up)  
              Math.PI,                     // 180° - West (horizontal left)
              3 * Math.PI / 2              // 270° - South (vertical down)
            ];
            
            // Gentle tolerance for cardinal directions only - no diagonal snapping
            const cardinalTolerance = Math.PI / 9; // 20 degree tolerance for horizontal/vertical only
            
            let snappedAngle = null;
            
            // Check cardinal directions only - users have full freedom for angled walls
            for (const snapAngle of cardinalAngles) {
              let diff = Math.abs(angle - snapAngle);
              if (diff > Math.PI) {
                diff = 2 * Math.PI - diff;
              }
              
              if (diff <= cardinalTolerance || (event.shiftKey)) {
                snappedAngle = snapAngle;
                break;
              }
            }
            
            // Apply snapping if found (same logic as mouse move)
            if (snappedAngle !== null) {
              // Round to exact cardinal directions for perfect precision
              const tolerance = 0.01; // Small tolerance for float comparison
              if (Math.abs(snappedAngle - 0) < tolerance || Math.abs(snappedAngle - 2 * Math.PI) < tolerance) {
                snappedAngle = 0; // Perfect horizontal (right)
              } else if (Math.abs(snappedAngle - Math.PI) < tolerance) {
                snappedAngle = Math.PI; // Perfect horizontal (left)
              } else if (Math.abs(snappedAngle - Math.PI / 2) < tolerance) {
                snappedAngle = Math.PI / 2; // Perfect vertical (up)
              } else if (Math.abs(snappedAngle - 3 * Math.PI / 2) < tolerance) {
                snappedAngle = 3 * Math.PI / 2; // Perfect vertical (down)
              }
              
              // Calculate snapped position with high precision
              const cosAngle = Math.cos(snappedAngle);
              const sinAngle = Math.sin(snappedAngle);
              
              // Round to avoid floating point drift for cardinal directions
              const precision = 0.0001;
              const roundedCos = Math.abs(cosAngle) < precision ? 0 : (Math.abs(Math.abs(cosAngle) - 1) < precision ? Math.sign(cosAngle) : cosAngle);
              const roundedSin = Math.abs(sinAngle) < precision ? 0 : (Math.abs(Math.abs(sinAngle) - 1) < precision ? Math.sign(sinAngle) : sinAngle);
              
              worldPos = {
                x: Number((draftStartPoint.x + distance * roundedCos).toFixed(6)),
                y: worldPos.y, // Keep Y unchanged
                z: Number((draftStartPoint.z + distance * roundedSin).toFixed(6))
              };
              
              console.log('🎯 AUTOMATIC ANGLE SNAP ON CLICK:', {
                'original cursor pos': to3D(clickPos),
                'snapped pos': worldPos,
                'snapped angle (deg)': (snappedAngle * 180 / Math.PI).toFixed(0)
              });
            }
          }
        }
        
        // 🏠 ROOM CLOSURE SNAPPING ON CLICK: Apply same logic as mouse move
        if (!event.shiftKey && selectedTool === 'wall') {
          const existingWalls = objects.filter(obj => obj.type === 'wall');
          const snapDistance = 50.0; // Same aggressive snap radius as mouse move
          
          if (existingWalls.length >= 2) {
            console.log('\n🏠 ROOM CLOSURE ON CLICK: Checking for snap opportunities...');
            
            // Get all wall endpoints (same logic as mouse move)
            const allEndpoints = [];
            existingWalls.forEach((wall, index) => {
              if (wall.params?.adjustedStartPoint && wall.params?.adjustedEndPoint) {
                allEndpoints.push({
                  point: wall.params.adjustedStartPoint,
                  wallId: wall.id,
                  type: 'start',
                  wallIndex: index,
                  isFirstWall: index === 0
                });
                allEndpoints.push({
                  point: wall.params.adjustedEndPoint,
                  wallId: wall.id,
                  type: 'end',
                  wallIndex: index,
                  isFirstWall: index === 0
                });
              }
            });
            
            // Find closest endpoint within snap distance
            let closestEndpoint = null;
            let minDistance = snapDistance;
            
            allEndpoints.forEach(endpoint => {
              const distance = Math.sqrt(
                Math.pow(worldPos.x - endpoint.point.x, 2) + 
                Math.pow(worldPos.z - endpoint.point.z, 2)
              );
              
              if (distance < minDistance) {
                minDistance = distance;
                closestEndpoint = endpoint;
              }
            });
            
            // Apply snapping if close enough
            if (closestEndpoint) {
              console.log(`🎯 ROOM CLOSURE SNAP ON CLICK! Snapping to ${closestEndpoint.wallId} ${closestEndpoint.type}`);
              console.log(`  Distance: ${minDistance.toFixed(2)}px (threshold: ${snapDistance}px)`);
              
              worldPos = {
                x: closestEndpoint.point.x,
                y: worldPos.y,
                z: closestEndpoint.point.z
              };
              
              if (closestEndpoint.isFirstWall && closestEndpoint.type === 'start') {
                console.log('🏁 ROOM CLOSURE ON CLICK: Perfect room closure to first wall start!');
              }
            }
          }
        }
        
        if (selectedTool === 'wall') {
          // Wall drawing with continuous point collection
          if (!isContinuousDrawing) {
            // First click: Start continuous drawing mode
            console.log('🎨 Starting continuous wall drawing');
            setIsContinuousDrawing(true);
            setDrawingPoints([worldPos]);
            setIsDrafting(true);
            setDraftStartPoint(worldPos);
            setDraftCurrentPoint(worldPos);
            console.log('📍 First point:', worldPos);
          } else {
            // Additional clicks: Add points to sequence
            console.log('📍 Adding point to sequence:', worldPos);
            console.log('📍 ROOM CLOSURE DEBUG: Point added to drawingPoints:', {
              x: worldPos.x.toFixed(3),
              y: worldPos.y.toFixed(3), 
              z: worldPos.z.toFixed(3)
            });
            setDrawingPoints(prev => [...prev, worldPos]);
            setDraftStartPoint(worldPos); // Move start point for next segment preview
            setDraftCurrentPoint(worldPos);
          }
        } else if (!isDrafting) {
          // Non-wall tools: Start regular drafting mode
          console.log('🎨 2D Viewport: Starting drafting mode for', selectedTool);
          setIsDrafting(true);
          setDraftStartPoint(worldPos);
          setDraftCurrentPoint(worldPos);
        } else {
          // Second click: Complete the drafting
          console.log('✅ 2D Viewport: Completing drafting for', selectedTool);
          console.log('📍 2D Viewport: End point:', worldPos);
          if (selectedTool === 'slab') {
            const width = Math.abs(worldPos.x - draftStartPoint.x);
            const depth = Math.abs(worldPos.z - draftStartPoint.z);
            
            if (width > 0.1 && depth > 0.1) { // Minimum slab dimensions
              console.log('🏗️ Creating slab:', {
                width,
                depth,
                startPoint: draftStartPoint,
                endPoint: worldPos
              });
              
              // Use CAD engine to create slab
              const slabId = standaloneCADEngine.createObject('slab', {
                width: width,
                depth: depth,
                thickness: 0.2, // Standard slab thickness
                material: 'concrete',
                shape: 'rectangular',
                startPoint: draftStartPoint,
                endPoint: worldPos
              });
              
              console.log('✅ Slab created with ID:', slabId);
            }
            
            // Reset drafting state for non-wall tools
            setIsDrafting(false);
            setDraftStartPoint(null);
            setDraftCurrentPoint(null);
            setDraftPreview(null);
          } else if (selectedTool === 'ramp') {
            const width = Math.abs(worldPos.x - draftStartPoint.x);
            const depth = Math.abs(worldPos.z - draftStartPoint.z);
            
            if (width > 0.1 && depth > 0.1) { // Minimum ramp dimensions
              console.log('🛤️ Creating ramp via drag:', {
                width,
                depth,
                startPoint: draftStartPoint,
                endPoint: worldPos
              });
              
              // Calculate ramp properties based on drag
              const centerX = (draftStartPoint.x + worldPos.x) / 2;
              const centerZ = (draftStartPoint.z + worldPos.z) / 2;
              
              // Determine slope direction based on drag direction
              const deltaX = worldPos.x - draftStartPoint.x;
              const deltaZ = worldPos.z - draftStartPoint.z;
              
              let slopeDirection = 'north';
              if (Math.abs(deltaX) > Math.abs(deltaZ)) {
                slopeDirection = deltaX > 0 ? 'east' : 'west';
              } else {
                slopeDirection = deltaZ > 0 ? 'north' : 'south';
              }
              
              // Use CAD engine to create ramp
              const rampId = standaloneCADEngine.createObject('ramp', {
                width: width,
                depth: depth,
                thickness: 0.2, // Standard ramp thickness
                height: 1.0, // Default rise height
                material: 'concrete',
                shape: 'rectangular',
                slopeDirection: slopeDirection,
                grade: (1.0 / depth) * 100, // Calculate grade from height and depth
                isRamp: true,
                type: 'ramp',
                position: { x: centerX, y: 0, z: centerZ },
                startPoint: draftStartPoint,
                endPoint: worldPos
              });
              
              console.log('✅ Ramp created with ID:', rampId);
            }
            
            // Reset drafting state for non-wall tools
            setIsDrafting(false);
            setDraftStartPoint(null);
            setDraftCurrentPoint(null);
            setDraftPreview(null);
          // Wall clicks are handled above in the continuous drawing logic
          } else if (selectedTool === 'beam') {
            const deltaX = worldPos.x - draftStartPoint.x;
            const deltaZ = worldPos.z - draftStartPoint.z;
            const length = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
            
            if (length > 0.1) { // Minimum beam length
              const centerX = (draftStartPoint.x + worldPos.x) / 2;
              const centerZ = (draftStartPoint.z + worldPos.z) / 2;
              
              // Create beam (similar to wall but elevated and smaller)
              const beamId = standaloneCADEngine.createObject('wall', { // Using wall geometry for now
                length: length,
                height: 0.5, // Beam height
                thickness: 0.3, // Beam thickness
                material: 'steel',
                startPoint: draftStartPoint,
                endPoint: worldPos
              });
              
              // Position the beam mesh if created successfully
              if (beamId) {
                const cadObject = standaloneCADEngine.objects.get(beamId);
                if (cadObject && cadObject.mesh3D) {
                  cadObject.mesh3D.position.set(centerX, 2.5, centerZ); // Elevated beam position
                }
                if (cadObject && cadObject.mesh2D) {
                  cadObject.mesh2D.position.set(centerX, 0, centerZ);
                }
              }
            }
          }
          
          // Clear drafting state after successful creation
          setIsDrafting(false);
          setDraftStartPoint(null);
          setDraftCurrentPoint(null);
          setDraftPreview(null);
          
          console.log('🧹 2D Viewport: Drafting mode cleared');
        }
      } else {
        // RAMP TOOL FIX: Handle ground clicks for creation tools (but only for non-drafting tools)
        const creationTools = ['stair', 'column', 'door', 'window', 'furniture', 'fixture'];
        if (creationTools.includes(selectedTool)) {
          console.log(`🏗️ 2D VIEWPORT GROUND CLICK: ${selectedTool} tool detected, calling onGroundClick`);
          const worldPos = to3D(clickPos);
          console.log(`🏗️ 2D VIEWPORT GROUND CLICK: Position:`, worldPos);
          onGroundClick?.(worldPos);
        } else {
          // Clear selection if clicking on empty space with pointer tool
          handleElementSelection(null);
        }
      }
    } else {
      // 🎨 2D CAD BLOCK: Handle click-to-place for pending CAD blocks
      if (pendingCADBlock) {
        const worldPos = to3D(clickPos);
        console.log('🎯 2D CAD BLOCK: Placing block at world position:', worldPos);
        
        const placedBlock = completeSVGPlacement(worldPos);
        if (placedBlock) {
          console.log('✅ 2D CAD BLOCK: Block placed successfully, auto-returning to select tool');
          
          // Auto-return to select tool as requested
          if (onToolChange) {
            onToolChange('pointer');
          }
        }
        return;
      }

      // RAMP TOOL FIX: Handle ground clicks for creation tools (but only for non-drafting tools)
      const creationTools = ['stair', 'column', 'door', 'window', 'furniture', 'fixture'];
      if (creationTools.includes(selectedTool)) {
        console.log(`🏗️ 2D VIEWPORT GROUND CLICK: ${selectedTool} tool detected, calling onGroundClick`);
        const worldPos = to3D(clickPos);
        console.log(`🏗️ 2D VIEWPORT GROUND CLICK: Position:`, worldPos);
        onGroundClick?.(worldPos);
      } else {
        // Deselect all
        handleElementSelection(null);
      }
    }
  }, [selectedTool, objects, to2D, to3D, zoom, isDraftingTool, isDrafting, draftStartPoint, handleElementSelection, onGroundClick, pendingCADBlock, completeSVGPlacement, onToolChange]);

  // Handle mouse move for panning and drafting preview
  const handleSvgMouseMove = useCallback((event) => {
    if (isPanning) {
      const deltaX = (event.clientX - lastPanPoint.x) / (40 * zoom);
      const deltaY = (event.clientY - lastPanPoint.y) / (40 * zoom);
      
      setViewCenter(prev => ({
        x: prev.x - deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: event.clientX, y: event.clientY });
    } else if (selectedTool === 'opening') {
      // 🕳️ OPENING: Handle opening tool mouse move for preview
      if (!svgRef.current) return;
      
      const rect = svgRef.current.getBoundingClientRect();
      const movePos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      const worldPos3D = to3D(movePos);
      
      // Find nearest wall for opening preview
      const nearestWall = findNearestWall(worldPos3D);
      if (nearestWall) {
        // Update cursor to indicate wall is available for opening
        svgRef.current.style.cursor = 'crosshair';
      } else {
        // Use default cursor when no walls nearby instead of not-allowed
        svgRef.current.style.cursor = 'default';
      }
    } else if (pendingCADBlock) {
      // 🎨 2D CAD BLOCK: Handle cursor-following ghost mode
      if (!svgRef.current) return;
      
      const rect = svgRef.current.getBoundingClientRect();
      const movePos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      // Update cursor position for CAD block ghost preview
      setCadBlockCursorPos(movePos);
      
      // Set cursor style for CAD block placement
      svgRef.current.style.cursor = 'crosshair';
    } else if (selectedTool === 'door' || (wallSelectionMode && !isDrafting)) {
      // Handle door tool cursor tracking and wall edge detection for door/window placement
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (!rect || typeof event.clientX === 'undefined' || typeof event.clientY === 'undefined') return;
      
      const mousePos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      // Update cursor position for door tool preview with validation
      if (selectedTool === 'door' && isFinite(mousePos.x) && isFinite(mousePos.y)) {
        setCursorPosition(mousePos);
      }
      
      const worldPos = to3D(mousePos);
      const queryPoint = { x: worldPos.x, y: worldPos.z }; // Convert 3D to 2D for wall edge detection
      
      // Find nearby wall surfaces for door placement tools
      if (isWallPlacementTool(selectedTool)) {
        if (selectedTool === 'door') {
          // For doors, find wall surfaces instead of edges
          
          let wallSurface = null;
          try {
            wallSurface = findWallSurfaceAtPoint(queryPoint, objects);
            // Wall surface detection completed
            
          setNearbyEdges(wallSurface ? [wallSurface] : []);
          setHoveredWallEdge(wallSurface);
          } catch (error) {
            window.console.warn('🚪 DOOR TOOL: Error in findWallSurfaceAtPoint:', error);
            setNearbyEdges([]);
            setHoveredWallEdge(null);
          }
          
          if (wallSurface) {
            window.console.warn('🚪 ✅ Wall surface detected for door placement:', wallSurface.wallId);
          }
        } else {
          // For other tools, use edge detection
        const nearby = wallEdgeDetector.findNearbyEdges(queryPoint);
        setNearbyEdges(nearby);
        
        const closestEdge = nearby.length > 0 ? nearby[0] : null;
        setHoveredWallEdge(closestEdge);
        
        if (closestEdge) {
          console.log('🎯 Hovering over wall edge:', {
            wallId: closestEdge.wallId,
            edgeType: closestEdge.edge.edgeType,
            distance: closestEdge.distance.toFixed(3) + 'm'
          });
          }
        }
      } else {
        // Clear edge detection for other tools
        setNearbyEdges([]);
        setHoveredWallEdge(null);
      }
      
      // Also check for wall body hovering for visual feedback
      const hoveredWallIds = new Set();
      try {
      objects.filter(obj => obj.type === 'wall').forEach(wall => {
        if (selectableWalls.has(wall.id) && wall.params) {
          // Check if mouse is over this wall's body (more generous than edge detection)
          const startPoint = wall.params.adjustedStartPoint || wall.params.startPoint;
          const endPoint = wall.params.adjustedEndPoint || wall.params.endPoint;
          
          if (!startPoint || !endPoint || 
              typeof startPoint.x !== 'number' || typeof startPoint.z !== 'number' ||
              typeof endPoint.x !== 'number' || typeof endPoint.z !== 'number') {
            return;
          }
          
          // Use wall center point for position
          const centerPoint = {
            x: (startPoint.x + endPoint.x) / 2,
            y: 0,
            z: (startPoint.z + endPoint.z) / 2
          };
          const pos2d = to2D(centerPoint);
          const wallLength = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) + 
            Math.pow(endPoint.z - startPoint.z, 2)
          ) * 100 * zoom;
          const wallThickness = Math.max(6, (wall.params.thickness || 0.2) * 100 * zoom);
          
          // Safety check for pos2d before using it
          if (!pos2d || typeof pos2d.x !== 'number' || typeof pos2d.y !== 'number') {
            return;
          }
          
          // Simple bounding box check for wall body hovering
          if (mousePos.x >= pos2d.x - wallLength/2 && 
              mousePos.x <= pos2d.x + wallLength/2 && 
              mousePos.y >= pos2d.y - wallThickness/2 && 
              mousePos.y <= pos2d.y + wallThickness/2) {
            hoveredWallIds.add(wall.id);
          }
        }
      });
      
      setHoveredWalls(hoveredWallIds);
      } catch (error) {
        console.error('🚪 Error in wall hover detection:', error);
        setHoveredWalls(new Set());
      }
    } else if (isDrafting && draftStartPoint) {
      const rect = svgRef.current.getBoundingClientRect();
      const movePos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      const worldPos = to3D(movePos);
      setDraftCurrentPoint(worldPos);
      setCurrentPreviewEnd(worldPos); // Update preview end point for continuous drawing
      
      // Update preview
      if (selectedTool === 'slab') {
        const width = Math.abs(worldPos.x - draftStartPoint.x);
        const depth = Math.abs(worldPos.z - draftStartPoint.z);
        setDraftPreview({
          type: 'slab',
          start: draftStartPoint,
          end: worldPos,
          width: width.toFixed(2),
          depth: depth.toFixed(2)
        });
      } else if (selectedTool === 'ramp') {
        const width = Math.abs(worldPos.x - draftStartPoint.x);
        const depth = Math.abs(worldPos.z - draftStartPoint.z);
        
        // Calculate slope direction based on drag direction
        const deltaX = worldPos.x - draftStartPoint.x;
        const deltaZ = worldPos.z - draftStartPoint.z;
        
        let slopeDirection = 'north';
        if (Math.abs(deltaX) > Math.abs(deltaZ)) {
          slopeDirection = deltaX > 0 ? 'east' : 'west';
        } else {
          slopeDirection = deltaZ > 0 ? 'north' : 'south';
        }
        
        setDraftPreview({
          type: 'ramp',
          start: draftStartPoint,
          end: worldPos,
          width: width.toFixed(2),
          depth: depth.toFixed(2),
          slopeDirection: slopeDirection
        });
      } else if (selectedTool === 'wall') {
        let finalWorldPos = worldPos;
        let snappedAngleDeg = null;
        
        // AUTOMATIC AGGRESSIVE ANGLE SNAPPING: Snap to cardinal directions (90/180) and diagonal (45) angles
        if (draftStartPoint) {
          const deltaX = worldPos.x - draftStartPoint.x;
          const deltaZ = worldPos.z - draftStartPoint.z;
          const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
          
          if (distance > 0.1) { // Minimum distance to avoid division by zero
            // Calculate current angle in radians with higher precision
            let angle = Math.atan2(deltaZ, deltaX);
            
            // Normalize angle to 0-2π range
            if (angle < 0) angle += 2 * Math.PI;
            
            // Only snap to cardinal directions (0°, 90°, 180°, 270°) for horizontal/vertical walls
            const cardinalAngles = [
              0,                           // 0° - East (horizontal right)
              Math.PI / 2,                 // 90° - North (vertical up)  
              Math.PI,                     // 180° - West (horizontal left)
              3 * Math.PI / 2              // 270° - South (vertical down)
            ];
            
            // Gentle tolerance for cardinal directions only - no diagonal snapping
            const cardinalTolerance = Math.PI / 9; // 20 degree tolerance for horizontal/vertical only
            
            let snappedAngle = null;
            
            // Check cardinal directions only - users have full freedom for angled walls
            for (const snapAngle of cardinalAngles) {
              let diff = Math.abs(angle - snapAngle);
              if (diff > Math.PI) {
                diff = 2 * Math.PI - diff;
              }
              
              if (diff <= cardinalTolerance || (event.shiftKey)) {
                snappedAngle = snapAngle;
                break;
              }
            }
            
            // Apply snapping if found
            if (snappedAngle !== null) {
              // Round to exact cardinal directions for perfect precision
              const tolerance = 0.01; // Small tolerance for float comparison
              if (Math.abs(snappedAngle - 0) < tolerance || Math.abs(snappedAngle - 2 * Math.PI) < tolerance) {
                snappedAngle = 0; // Perfect horizontal (right)
              } else if (Math.abs(snappedAngle - Math.PI) < tolerance) {
                snappedAngle = Math.PI; // Perfect horizontal (left)
              } else if (Math.abs(snappedAngle - Math.PI / 2) < tolerance) {
                snappedAngle = Math.PI / 2; // Perfect vertical (up)
              } else if (Math.abs(snappedAngle - 3 * Math.PI / 2) < tolerance) {
                snappedAngle = 3 * Math.PI / 2; // Perfect vertical (down)
              }
              
              // Calculate snapped position with high precision
              const cosAngle = Math.cos(snappedAngle);
              const sinAngle = Math.sin(snappedAngle);
              
              // Round to avoid floating point drift for cardinal directions
              const precision = 0.0001;
              const roundedCos = Math.abs(cosAngle) < precision ? 0 : (Math.abs(Math.abs(cosAngle) - 1) < precision ? Math.sign(cosAngle) : cosAngle);
              const roundedSin = Math.abs(sinAngle) < precision ? 0 : (Math.abs(Math.abs(sinAngle) - 1) < precision ? Math.sign(sinAngle) : sinAngle);
              
              finalWorldPos = {
                x: Number((draftStartPoint.x + distance * roundedCos).toFixed(6)),
                y: worldPos.y, // Keep Y unchanged
                z: Number((draftStartPoint.z + distance * roundedSin).toFixed(6))
              };
              
              snappedAngleDeg = (snappedAngle * 180 / Math.PI).toFixed(0);
              console.log('🎯 AUTOMATIC ANGLE SNAP:', {
                'original angle (deg)': (angle * 180 / Math.PI).toFixed(1),
                'snapped angle (deg)': snappedAngleDeg,
                'distance': distance.toFixed(6),
                'type': 'cardinal direction (horizontal/vertical)',
                'tolerance used': 'gentle (20°)',
                'finalWorldPos': finalWorldPos
              });
              
              // 🌉 COORDINATE BRIDGE: Send snapped coordinates to App.js
              if (onDraftCurrentPointUpdate) {
                onDraftCurrentPointUpdate(finalWorldPos);
              }
            }
          }
        }
        
        // 🏠 ROOM CLOSURE SNAPPING: Aggressively snap to first wall start when closing rooms
        if (!event.shiftKey) { // Only apply room closure when not shift-locked
          const existingWalls = objects.filter(obj => obj.type === 'wall');
          const snapDistance = 50.0; // More aggressive 50px snap radius for better UX
          
          if (existingWalls.length >= 2) { // Need at least 2 existing walls to consider room closure
            console.log('\n🏠 ROOM CLOSURE: Checking for snap opportunities...');
            console.log(`  Current position: [${finalWorldPos.x.toFixed(2)}, ${finalWorldPos.z.toFixed(2)}]`);
            console.log(`  Existing walls: ${existingWalls.length}`);
            
            // Get all wall endpoints
            const allEndpoints = [];
            existingWalls.forEach((wall, index) => {
              if (wall.params?.adjustedStartPoint && wall.params?.adjustedEndPoint) {
                allEndpoints.push({
                  point: wall.params.adjustedStartPoint,
                  wallId: wall.id,
                  type: 'start',
                  wallIndex: index,
                  isFirstWall: index === 0
                });
                allEndpoints.push({
                  point: wall.params.adjustedEndPoint,
                  wallId: wall.id,
                  type: 'end',
                  wallIndex: index,
                  isFirstWall: index === 0
                });
              }
            });
            
            console.log(`  Total endpoints to check: ${allEndpoints.length}`);
            
            // Find closest endpoint within snap distance
            let closestEndpoint = null;
            let minDistance = snapDistance;
            
            allEndpoints.forEach(endpoint => {
              const distance = Math.sqrt(
                Math.pow(finalWorldPos.x - endpoint.point.x, 2) + 
                Math.pow(finalWorldPos.z - endpoint.point.z, 2)
              );
              
              console.log(`  📍 ${endpoint.wallId} ${endpoint.type}: [${endpoint.point.x.toFixed(2)}, ${endpoint.point.z.toFixed(2)}] → distance: ${distance.toFixed(2)}px`);
              
              if (distance < minDistance) {
                minDistance = distance;
                closestEndpoint = endpoint;
              }
            });
            
            // Apply snapping if close enough
            if (closestEndpoint) {
              console.log(`🎯 ROOM CLOSURE SNAP! Snapping to ${closestEndpoint.wallId} ${closestEndpoint.type}`);
              console.log(`  Original: [${finalWorldPos.x.toFixed(2)}, ${finalWorldPos.z.toFixed(2)}]`);
              console.log(`  Snapped:  [${closestEndpoint.point.x.toFixed(2)}, ${closestEndpoint.point.z.toFixed(2)}]`);
              console.log(`  Distance: ${minDistance.toFixed(2)}px (threshold: ${snapDistance}px)`);
              
              finalWorldPos = {
                x: closestEndpoint.point.x,
                y: finalWorldPos.y, // Keep Y unchanged
                z: closestEndpoint.point.z
              };
              
              // Highlight first wall start for better UX
              if (closestEndpoint.isFirstWall && closestEndpoint.type === 'start') {
                console.log('🏁 ROOM CLOSURE: Snapping to FIRST WALL START - perfect room closure!');
              }
            } else {
              console.log('❌ ROOM CLOSURE: No endpoints within snap distance');
            }
          } else {
            console.log('🏠 ROOM CLOSURE: Not enough walls for room closure detection');
          }
        }
        
        // 🌉 COORDINATE BRIDGE: Always send current coordinates to App.js (snapped or unsnapped)
        if (onDraftCurrentPointUpdate && !event.shiftKey) {
          // Send unsnapped coordinates when shift is not pressed
          console.log('🌉 COORDINATE BRIDGE: Sending unsnapped coordinates to App.js', {
            worldPos: finalWorldPos,
            isShiftPressed: false
          });
          onDraftCurrentPointUpdate(finalWorldPos);
        }

        const deltaX = finalWorldPos.x - draftStartPoint.x;
        const deltaZ = finalWorldPos.z - draftStartPoint.z;
        const length = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
        
        // Update the preview end point for continuous drawing with shift lock support
        if (isContinuousDrawing) {
          setCurrentPreviewEnd(finalWorldPos);
        } else {
          setDraftPreview({
            type: 'wall',
            start: draftStartPoint,
            end: finalWorldPos,
            length: length.toFixed(2),
            thickness: '0.2',
            shiftLocked: event.shiftKey, // Track shift lock state for UI indicator
            snappedAngle: snappedAngleDeg // Include snapped angle for display
          });
        }
      } else if (selectedTool === 'beam') {
        const deltaX = worldPos.x - draftStartPoint.x;
        const deltaZ = worldPos.z - draftStartPoint.z;
        const length = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
        setDraftPreview({
          type: 'beam',
          start: draftStartPoint,
          end: worldPos,
          length: length.toFixed(2),
          thickness: '0.3'
        });
      }
    }
  }, [isPanning, lastPanPoint, zoom, isDrafting, draftStartPoint, selectedTool, to3D]);

  const handleSvgMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle mouse wheel for zooming
  const handleWheel = useCallback((event) => {
    event.preventDefault();
    
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Convert mouse position to world coordinates before zoom
    const worldPosBeforeZoom = to3D({ x: mouseX, y: mouseY });
    
    // Natural zoom: trackpad/wheel delta positive -> zoom out, negative -> zoom in
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));
    
    if (newZoom !== zoom) {
      // Convert the same mouse position to world coordinates after zoom using helper to3D math
      const worldPosAfterZoom = (() => {
        const scale = 100 * newZoom;
        const xWorld = viewCenter.x + (mouseX - 400) / scale;
        const zWorld = viewCenter.y + (mouseY - 300) / scale;
        return { x: xWorld, y: 0, z: zWorld };
      })();
      
      // Calculate the difference and adjust view center to maintain cursor position
      const deltaX = worldPosBeforeZoom.x - worldPosAfterZoom.x;
      const deltaZ = worldPosBeforeZoom.z - worldPosAfterZoom.z;
      
      setZoom(newZoom);
      setViewCenter(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaZ
      }));
    }
  }, [zoom, viewCenter, to3D]);

  // Render drafting preview
  const renderDraftPreview = useCallback(() => {
    // Handle continuous wall drawing preview
    if (isContinuousDrawing && drawingPoints.length > 0 && currentPreviewEnd) {
      return renderContinuousWallPreview();
    }

    // Handle regular tool previews (slab, single wall, etc.)
    if (!draftPreview || !draftStartPoint || !draftCurrentPoint) return null;

    const start2D = to2D(draftPreview.start);
    const end2D = to2D(draftPreview.end);

    const previewColor = viewportTheme === 'light' ? '#3b82f6' : '#60a5fa';
    const textColor = viewportTheme === 'light' ? '#1e40af' : '#93c5fd';

    if (draftPreview.type === 'slab') {
      const x = Math.min(start2D.x, end2D.x);
      const y = Math.min(start2D.y, end2D.y);
      const width = Math.abs(end2D.x - start2D.x);
      const height = Math.abs(end2D.y - start2D.y);
      
      return (
        <g key="draft-preview">
          {/* Preview rectangle */}
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={previewColor}
            fillOpacity="0.3"
            stroke={previewColor}
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* Corner points */}
          <circle cx={start2D.x} cy={start2D.y} r="4" fill={previewColor} />
          <circle cx={end2D.x} cy={end2D.y} r="4" fill={previewColor} />
          
          {/* Dimension text */}
          <text
            x={x + width/2}
            y={y + height/2 - 8}
            fill={textColor}
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {draftPreview.width}m × {draftPreview.depth}m
          </text>
        </g>
      );
    } else if (draftPreview.type === 'ramp') {
      const x = Math.min(start2D.x, end2D.x);
      const y = Math.min(start2D.y, end2D.y);
      const width = Math.abs(end2D.x - start2D.x);
      const height = Math.abs(end2D.y - start2D.y);
      
      // Calculate slope direction indicator
      const deltaX = draftPreview.end.x - draftPreview.start.x;
      const deltaZ = draftPreview.end.z - draftPreview.start.z;
      
      let arrowDirection = 'north';
      if (Math.abs(deltaX) > Math.abs(deltaZ)) {
        arrowDirection = deltaX > 0 ? 'east' : 'west';
      } else {
        arrowDirection = deltaZ > 0 ? 'north' : 'south';
      }
      
      // Arrow coordinates for slope direction
      const centerX = x + width/2;
      const centerY = y + height/2;
      let arrowX1 = centerX, arrowY1 = centerY;
      let arrowX2 = centerX, arrowY2 = centerY;
      
      switch(arrowDirection) {
        case 'north': arrowX2 = centerX; arrowY2 = centerY - 20; break;
        case 'south': arrowX2 = centerX; arrowY2 = centerY + 20; break;
        case 'east': arrowX2 = centerX + 20; arrowY2 = centerY; break;
        case 'west': arrowX2 = centerX - 20; arrowY2 = centerY; break;
      }
      
      return (
        <g key="ramp-draft-preview">
          {/* Preview rectangle */}
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={previewColor}
            fillOpacity="0.3"
            stroke={previewColor}
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* Slope direction arrow */}
          <line
            x1={arrowX1}
            y1={arrowY1}
            x2={arrowX2}
            y2={arrowY2}
            stroke={previewColor}
            strokeWidth="3"
            markerEnd="url(#arrow)"
          />
          
          {/* Size label */}
          <text
            x={centerX}
            y={centerY + 35}
            fill={textColor}
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {draftPreview.width}m × {draftPreview.depth}m ramp
          </text>
          
          {/* Slope direction label */}
          <text
            x={centerX}
            y={centerY - 25}
            fill={textColor}
            fontSize="10"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            ↗ {arrowDirection.toUpperCase()}
          </text>
        </g>
      );
    } else if (draftPreview.type === 'wall') {
      // Wall preview is now handled by renderContinuousWallPreview()
      // This branch is kept for compatibility but should not be reached in continuous mode
      return null;
    } else if (draftPreview.type === 'beam') {
      // Line preview for beams only
      return (
        <g key="draft-preview">
          {/* Preview line */}
          <line
            x1={start2D.x}
            y1={start2D.y}
            x2={end2D.x}
            y2={end2D.y}
            stroke={previewColor}
            strokeWidth="4"
            strokeDasharray="5,5"
          />
          
          {/* Start and end points */}
          <circle cx={start2D.x} cy={start2D.y} r="4" fill={previewColor} />
          <circle cx={end2D.x} cy={end2D.y} r="4" fill={previewColor} />
          
          {/* Length text */}
          <text
            x={(start2D.x + end2D.x) / 2}
            y={(start2D.y + end2D.y) / 2 - 8}
            fill={textColor}
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {draftPreview.length}m beam
          </text>
        </g>
      );
    }

    return null;
  }, [draftPreview, draftStartPoint, draftCurrentPoint, to2D, viewportTheme]);

  // Render dynamic wall gap that moves with cursor during door placement
  const renderDynamicWallGap = useCallback((wallSurface, doorWidth, doorPos2D, wallRotation) => {
    try {
      if (!wallSurface || !wallSurface.wallCenter || !doorWidth || !doorPos2D) return null;
    
    const wallCenter = wallSurface.wallCenter;
    if (!wallCenter.start || !wallCenter.end) return null;
    
    const wallLength = Math.sqrt(
      Math.pow(wallCenter.end.x - wallCenter.start.x, 2) + 
      Math.pow(wallCenter.end.y - wallCenter.start.y, 2)
    ) * 100 * zoom;
    
    const wallThickness = (wallSurface.wallWidth || 0.2) * 100 * zoom;
    
    // Safety check for wallCenter coordinates
    if (typeof wallCenter.start.x !== 'number' || typeof wallCenter.start.y !== 'number' ||
        typeof wallCenter.end.x !== 'number' || typeof wallCenter.end.y !== 'number') {
      return null;
    }
    
    const wallStart2D = to2D({ x: wallCenter.start.x, y: 0, z: wallCenter.start.y });
    const wallEnd2D = to2D({ x: wallCenter.end.x, y: 0, z: wallCenter.end.y });
    
    // Safety check for to2D results
    if (!wallStart2D || !wallEnd2D || 
        typeof wallStart2D.x !== 'number' || typeof wallStart2D.y !== 'number' ||
        typeof wallEnd2D.x !== 'number' || typeof wallEnd2D.y !== 'number') {
      return null;
    }
    
    // Calculate gap position along wall
    const gapRatio = typeof wallSurface.projectionRatio === 'number' ? wallSurface.projectionRatio : 0.5;
    const gapCenterX = wallStart2D.x + (wallEnd2D.x - wallStart2D.x) * gapRatio;
    const gapCenterY = wallStart2D.y + (wallEnd2D.y - wallStart2D.y) * gapRatio;
    
    // Calculate wall segments before and after the gap
    const halfDoorWidth = doorWidth / 2;
    const gapStartRatio = Math.max(0, gapRatio - (halfDoorWidth / wallLength));
    const gapEndRatio = Math.min(1, gapRatio + (halfDoorWidth / wallLength));
    
    // Wall segment before gap
    const segment1Start = wallStart2D;
    const segment1End = {
      x: wallStart2D.x + (wallEnd2D.x - wallStart2D.x) * gapStartRatio,
      y: wallStart2D.y + (wallEnd2D.y - wallStart2D.y) * gapStartRatio
    };
    
    // Wall segment after gap  
    const segment2Start = {
      x: wallStart2D.x + (wallEnd2D.x - wallStart2D.x) * gapEndRatio,
      y: wallStart2D.y + (wallEnd2D.y - wallStart2D.y) * gapEndRatio
    };
    const segment2End = wallEnd2D;
    
    return (
      <g key={`wall-gap-${wallSurface.wallId}`}>
        {/* Wall segment before door gap */}
        {gapStartRatio > 0 && (
          <line
            x1={segment1Start.x}
            y1={segment1Start.y}
            x2={segment1End.x}
            y2={segment1End.y}
            stroke="#666"
            strokeWidth={wallThickness}
            strokeLinecap="square"
            opacity="0.7"
          />
        )}
        
        {/* Wall segment after door gap */}
        {gapEndRatio < 1 && (
          <line
            x1={segment2Start.x}
            y1={segment2Start.y}
            x2={segment2End.x}
            y2={segment2End.y}
            stroke="#666"
            strokeWidth={wallThickness}
            strokeLinecap="square"
            opacity="0.7"
          />
        )}
        
        {/* Gap indicators */}
        <line
          x1={segment1End.x}
          y1={segment1End.y}
          x2={segment2Start.x}
          y2={segment2Start.y}
          stroke="none"
          strokeWidth="2"
          strokeDasharray="4,4"
          opacity="0.8"
        />
      </g>
    );
    } catch (error) {
      console.error('🚪 Error in renderDynamicWallGap:', error);
      console.error('🚪 WallSurface:', wallSurface, 'DoorWidth:', doorWidth, 'DoorPos2D:', doorPos2D, 'WallRotation:', wallRotation);
      return null;
    }
  }, [to2D, zoom]);

  // Render door cursor preview using architectural symbol
  const renderDoorCursorPreview = useCallback((position, doorParams) => {
    if (!position || !doorParams) return null;
    if (!isFinite(position.x) || !isFinite(position.y)) return null;
    const px_per_mm = Math.max(0.01, zoom * 0.1);
    const params = {
      width_mm: (doorParams.width || 0.9) * 1000,
      wall_thickness_mm: (doorParams.thickness || 0.1) * 1000,
      hinge: 'left',
      swing: 'in',
      angle_deg: 90,
      px_per_mm,
      stroke_px: 2
    };
    const svg = Door2DRenderer.makeDoor2DSVG(params);
    const wrapped = Door2DRenderer.wrapWithTransform(svg, position.x, position.y, 0);
    return (<g pointerEvents="none" dangerouslySetInnerHTML={{ __html: wrapped }} />);
  }, [zoom]);

  // Render door aligned to wall using architectural symbol
  const renderDoorWallAlignedPreview = useCallback((wallEdge, doorParams) => {
    if (!wallEdge || !wallEdge.wallCenter || !doorParams) return null;
    const doorPlacementPoint = wallEdge.closestPoint;
    const doorPosition = to2D({ x: doorPlacementPoint.x, y: 0, z: doorPlacementPoint.y });
    const wallStart = to2D({ x: wallEdge.wallCenter.start.x, y: 0, z: wallEdge.wallCenter.start.y });
    const wallEnd = to2D({ x: wallEdge.wallCenter.end.x, y: 0, z: wallEdge.wallCenter.end.y });
    const wallAngleDeg = Math.atan2(wallEnd.y - wallStart.y, wallEnd.x - wallStart.x) * 180 / Math.PI;
    const px_per_mm = Math.max(0.01, zoom * 0.1);
    const params = {
      width_mm: (doorParams.width || 0.9) * 1000,
      wall_thickness_mm: (wallEdge.wallWidth || doorParams.thickness || 0.1) * 1000,
      hinge: 'left',
      swing: 'in',
      angle_deg: 90,
      px_per_mm,
      stroke_px: 2
    };
    const svg = Door2DRenderer.makeDoor2DSVG(params);
    const wrapped = Door2DRenderer.wrapWithTransform(svg, doorPosition.x, doorPosition.y, wallAngleDeg);
    return (<g pointerEvents="none" dangerouslySetInnerHTML={{ __html: wrapped }} />);
  }, [to2D, zoom]);

  // Render door with swing direction options
  const renderDoorSwingPreview = useCallback((placementData, swingDirection, doorParams) => {
    if (!placementData || !placementData.position || !doorParams) return null;
    
    const position = to2D(placementData.position);
    if (!position || typeof position.x === 'undefined' || typeof position.y === 'undefined') {
      console.warn('🚪 renderDoorSwingPreview: Invalid 2D position from to2D');
      return null;
    }
    const px_per_mm = Math.max(0.01, zoom * 0.1);
    
    const door2DParams = {
      width_mm: (doorParams.width || 0.9) * 1000,
      wall_thickness_mm: (placementData.wallWidth || doorParams.thickness || 0.1) * 1000,
      hinge: swingDirection === 'left' ? 'left' : 'right',
      swing: 'in',
      angle_deg: 90, // Full open to show swing direction clearly
      px_per_mm: px_per_mm,
      stroke_px: 2
    };
    
    try {
      const doorSVG = Door2DRenderer.makeDoor2DSVG(door2DParams);
      const rotation = placementData.rotation || 0;
      const wrappedSVG = Door2DRenderer.wrapWithTransform(doorSVG, position.x, position.y, rotation);
      
      return (
        <g 
          stroke="#f59e0b" 
          strokeWidth="3"
          opacity="0.9"
          pointerEvents="none"
          dangerouslySetInnerHTML={{ 
            __html: wrappedSVG.replace(/^<g[^>]*>/, '').replace(/<\/g>$/, '')
          }}
        />
      );
    } catch (error) {
      // Fallback swing preview
      const doorWidth = (doorParams.width || 0.9) * zoom * 100;
      const wallThickness = (placementData.wallWidth || doorParams.thickness || 0.1) * zoom * 100;
      
      return (
        <g stroke="#f59e0b" strokeWidth="3" opacity="0.9" pointerEvents="none">
          <rect
            x={position.x - doorWidth/2}
            y={position.y - wallThickness/2}
            width={doorWidth}
            height={wallThickness}
            fill="none"
          />
          {/* Swing direction indicator */}
          <path
            d={`M ${position.x - doorWidth/2} ${position.y} 
                A ${doorWidth} ${doorWidth} 0 0 ${swingDirection === 'right' ? 1 : 0} 
                ${position.x + doorWidth/2} ${position.y}`}
            fill="none"
            strokeDasharray="6,3"
          />
        </g>
      );
    }
  }, [to2D, zoom]);

  // Render professional door placement preview
  const renderDoorPlacementPreview = useCallback(() => {
    if (selectedTool !== 'door') return null;
    
    // Get door parameters from the tool or use defaults
    const currentDoorParams = doorParams || {
      width: 0.9,
      height: 2.1, 
      thickness: 0.1,
      selectedModel: null
    };
    
    // Stage 1: Cursor preview when no wall is hovered
    if (doorPlacementStep === 0 && !hoveredWallEdge) {
      // Ensure cursorPosition is valid before rendering
      if (!cursorPosition || typeof cursorPosition.x === 'undefined' || typeof cursorPosition.y === 'undefined') {
        return null;
      }
      
      // Don't show preview at the initial (0, 0) position - wait for real mouse movement
      if (cursorPosition.x === 0 && cursorPosition.y === 0) {
        return null;
      }
      
      return (
        <g className="door-cursor-preview">
          {renderDoorCursorPreview(cursorPosition, currentDoorParams)}
        </g>
      );
    }
    
    // Stage 2: Wall alignment preview - Show whenever hovering over wall
    if (hoveredWallEdge) {
      return (
        <g className="door-wall-preview">
          {renderDoorWallAlignedPreview(hoveredWallEdge, currentDoorParams)}
        </g>
      );
    }
    
    // Stage 3: Position fixed, showing swing direction options
    if (doorPlacementStep === 1 && doorPlacementData) {
      return (
        <g className="door-swing-preview">
          {renderDoorSwingPreview(doorPlacementData, doorSwingDirection, currentDoorParams)}
        </g>
      );
    }
    
    return null;
  }, [selectedTool, doorPlacementStep, hoveredWallEdge, doorPlacementData, doorSwingDirection, doorParams, cursorPosition, renderDoorCursorPreview, renderDoorWallAlignedPreview, renderDoorSwingPreview]);
  // Render material pattern for walls - PROFESSIONAL CAD PATTERNS
  const renderMaterialPattern = useCallback((material, size) => {
    switch (material) {
      case 'concrete':
        // Light stippled pattern for concrete (CAD standard)
        return (
          <>
            <circle cx={size/6} cy={size/6} r="0.3" fill="#999999" opacity="0.3"/>
            <circle cx={size/2} cy={size/4} r="0.3" fill="#999999" opacity="0.3"/>
            <circle cx={5*size/6} cy={size/3} r="0.3" fill="#999999" opacity="0.3"/>
            <circle cx={size/4} cy={2*size/3} r="0.3" fill="#999999" opacity="0.3"/>
            <circle cx={3*size/4} cy={5*size/6} r="0.3" fill="#999999" opacity="0.3"/>
          </>
        );
      case 'brick':
        // Professional brick hatching (45-degree lines spaced evenly - CAD standard)
        return (
          <>
            <line x1="0" y1="0" x2={size} y2={size} stroke="#8b6f3d" strokeWidth="0.8" opacity="0.6"/>
            <line x1="0" y1={size/3} x2={2*size/3} y2={size} stroke="#8b6f3d" strokeWidth="0.8" opacity="0.6"/>
            <line x1={size/3} y1="0" x2={size} y2={2*size/3} stroke="#8b6f3d" strokeWidth="0.8" opacity="0.6"/>
            <line x1="0" y1={2*size/3} x2={size/3} y2={size} stroke="#8b6f3d" strokeWidth="0.8" opacity="0.6"/>
            <line x1={2*size/3} y1="0" x2={size} y2={size/3} stroke="#8b6f3d" strokeWidth="0.8" opacity="0.6"/>
          </>
        );
      case 'wood':
        // Wood grain lines (horizontal with slight variation)
        return (
          <>
            <line x1="0" y1={size/4} x2={size} y2={size/4} stroke="#c4a57a" strokeWidth="0.6" opacity="0.5"/>
            <line x1="0" y1={size/2} x2={size} y2={size/2} stroke="#c4a57a" strokeWidth="0.8" opacity="0.4"/>
            <line x1="0" y1={3*size/4} x2={size} y2={3*size/4} stroke="#c4a57a" strokeWidth="0.6" opacity="0.5"/>
            <path d={`M0,${size/6} Q${size/2},${size/8} ${size},${size/6}`} fill="none" stroke="#c4a57a" strokeWidth="0.4" opacity="0.3"/>
          </>
        );
      case 'steel':
        // Steel cross hatching (CAD standard)
        return (
          <>
            <line x1="0" y1="0" x2={size} y2={size} stroke="#6a7a8a" strokeWidth="0.6" opacity="0.4"/>
            <line x1="0" y1={size} x2={size} y2="0" stroke="#6a7a8a" strokeWidth="0.6" opacity="0.4"/>
            <line x1="0" y1={size/2} x2={size/2} y2={size} stroke="#6a7a8a" strokeWidth="0.6" opacity="0.4"/>
            <line x1={size/2} y1="0" x2={size} y2={size/2} stroke="#6a7a8a" strokeWidth="0.6" opacity="0.4"/>
          </>
        );
      case 'stone':
        // Stone random texture pattern
        return (
          <>
            <circle cx={size/7} cy={size/5} r="0.4" fill="#7a7a7a" opacity="0.4"/>
            <circle cx={3*size/7} cy={size/3} r="0.6" fill="#7a7a7a" opacity="0.3"/>
            <circle cx={5*size/7} cy={size/6} r="0.3" fill="#7a7a7a" opacity="0.5"/>
            <circle cx={size/5} cy={3*size/5} r="0.5" fill="#7a7a7a" opacity="0.4"/>
            <circle cx={4*size/7} cy={4*size/5} r="0.4" fill="#7a7a7a" opacity="0.3"/>
            <circle cx={6*size/7} cy={2*size/3} r="0.3" fill="#7a7a7a" opacity="0.4"/>
          </>
        );
      case 'aluminum':
        // Aluminum - light diagonal lines
        return (
          <>
            <line x1="0" y1="0" x2={size} y2={size} stroke="#a0a8b0" strokeWidth="0.4" opacity="0.3"/>
            <line x1="0" y1={size/2} x2={size/2} y2={size} stroke="#a0a8b0" strokeWidth="0.4" opacity="0.3"/>
            <line x1={size/2} y1="0" x2={size} y2={size/2} stroke="#a0a8b0" strokeWidth="0.4" opacity="0.3"/>
          </>
        );
      case 'glass':
        // Glass - very light stippling
        return (
          <>
            <circle cx={size/3} cy={size/4} r="0.2" fill="#8fa8c7" opacity="0.2"/>
            <circle cx={2*size/3} cy={3*size/4} r="0.2" fill="#8fa8c7" opacity="0.2"/>
          </>
        );
      default:
        // Light stippling for unknown materials
        return (
          <>
            <circle cx={size/4} cy={size/4} r="0.3" fill="#aaaaaa" opacity="0.3"/>
            <circle cx={3*size/4} cy={3*size/4} r="0.3" fill="#aaaaaa" opacity="0.3"/>
          </>
        );
    }
  }, []);

  // Calculate corner intersection points for proper wall joining
  const calculateCornerExtensions = useCallback((wallGroup) => {
    const extendedWalls = [];
    
    wallGroup.forEach(wall => {
      if (!wall.params) return;
      
      let startPoint = wall.params.adjustedStartPoint || wall.params.startPoint;
      let endPoint = wall.params.adjustedEndPoint || wall.params.endPoint;
      const thickness = wall.params.thickness || wall.params.width || wall.thickness || wall.width || 0.2;
      
      if (!startPoint || !endPoint) return;
      
      // Find walls connected to this wall's start and end points
      const tolerance = 0.1;
      let connectedAtStart = null;
      let connectedAtEnd = null;
      
      wallGroup.forEach(otherWall => {
        if (otherWall.id === wall.id || !otherWall.params) return;
        
        const otherStart = otherWall.params.adjustedStartPoint || otherWall.params.startPoint;
        const otherEnd = otherWall.params.adjustedEndPoint || otherWall.params.endPoint;
        
        if (!otherStart || !otherEnd) return;
        
        // Check if this wall's start connects to other wall
        if ((Math.abs(startPoint.x - otherStart.x) < tolerance && Math.abs(startPoint.z - otherStart.z) < tolerance) ||
            (Math.abs(startPoint.x - otherEnd.x) < tolerance && Math.abs(startPoint.z - otherEnd.z) < tolerance)) {
          connectedAtStart = otherWall;
        }
        
        // Check if this wall's end connects to other wall
        if ((Math.abs(endPoint.x - otherStart.x) < tolerance && Math.abs(endPoint.z - otherStart.z) < tolerance) ||
            (Math.abs(endPoint.x - otherEnd.x) < tolerance && Math.abs(endPoint.z - otherEnd.z) < tolerance)) {
          connectedAtEnd = otherWall;
        }
      });
      
      // Extend wall endpoints to proper corner intersections
      if (connectedAtStart) {
        const extendedStart = calculateCornerIntersection(wall, connectedAtStart, startPoint, true);
        if (extendedStart) startPoint = extendedStart;
      }
      
      if (connectedAtEnd) {
        const extendedEnd = calculateCornerIntersection(wall, connectedAtEnd, endPoint, false);
        if (extendedEnd) endPoint = extendedEnd;
      }
      
      extendedWalls.push({
        ...wall,
        extendedStartPoint: startPoint,
        extendedEndPoint: endPoint
      });
    });
    
    return extendedWalls;
  }, []);
  
  // Calculate the intersection point of two wall's outer edges at a corner
  const calculateCornerIntersection = useCallback((wall1, wall2, connectionPoint, isWall1Start) => {
    if (!wall1.params || !wall2.params) return null;
    
    // Get wall directions and thicknesses
    const wall1Start = wall1.params.adjustedStartPoint || wall1.params.startPoint;
    const wall1End = wall1.params.adjustedEndPoint || wall1.params.endPoint;
    const wall2Start = wall2.params.adjustedStartPoint || wall2.params.startPoint;
    const wall2End = wall2.params.adjustedEndPoint || wall2.params.endPoint;
    
    if (!wall1Start || !wall1End || !wall2Start || !wall2End) return null;
    
    const thickness1 = (wall1.params.thickness || wall1.params.width || wall1.thickness || wall1.width || 0.2) / 2;
    const thickness2 = (wall2.params.thickness || wall2.params.width || wall2.thickness || wall2.width || 0.2) / 2;
    
    // Calculate wall1 direction vector
    const wall1Dir = {
      x: wall1End.x - wall1Start.x,
      z: wall1End.z - wall1Start.z
    };
    const wall1Length = Math.sqrt(wall1Dir.x * wall1Dir.x + wall1Dir.z * wall1Dir.z);
    if (wall1Length === 0) return null;
    
    wall1Dir.x /= wall1Length;
    wall1Dir.z /= wall1Length;
    
    // Calculate wall2 direction vector  
    const wall2Dir = {
      x: wall2End.x - wall2Start.x,
      z: wall2End.z - wall2Start.z
    };
    const wall2Length = Math.sqrt(wall2Dir.x * wall2Dir.x + wall2Dir.z * wall2Dir.z);
    if (wall2Length === 0) return null;
    
    wall2Dir.x /= wall2Length;
    wall2Dir.z /= wall2Length;
    
    // Calculate perpendicular vectors (for wall thickness)
    const wall1Perp = { x: -wall1Dir.z, z: wall1Dir.x };
    const wall2Perp = { x: -wall2Dir.z, z: wall2Dir.x };
    
    // Determine which side of each wall to extend
    // For now, extend by half thickness in the perpendicular direction
    const extensionDistance = Math.max(thickness1, thickness2);
    
    // Calculate the corner intersection point
    // This is a simplified approach - extend the connection point slightly outward
    let cornerPoint = { ...connectionPoint };
    
    // Apply small extension to ensure clean corner joining
    if (isWall1Start) {
      cornerPoint.x -= wall1Dir.x * extensionDistance;
      cornerPoint.z -= wall1Dir.z * extensionDistance;
    } else {
      cornerPoint.x += wall1Dir.x * extensionDistance;
      cornerPoint.z += wall1Dir.z * extensionDistance;
    }
    
    return cornerPoint;
  }, []);

  // Helper function to check if two edges overlap (making them internal)
  const edgesOverlap = useCallback((edge1, edge2, tolerance = 2) => {
    // Check if edges are parallel and overlapping
    const edge1Vector = {
      x: edge1.end.x - edge1.start.x,
      y: edge1.end.y - edge1.start.y
    };
    const edge2Vector = {
      x: edge2.end.x - edge2.start.x,
      y: edge2.end.y - edge2.start.y
    };
    
    // Calculate edge lengths
    const edge1Length = Math.sqrt(edge1Vector.x * edge1Vector.x + edge1Vector.y * edge1Vector.y);
    const edge2Length = Math.sqrt(edge2Vector.x * edge2Vector.x + edge2Vector.y * edge2Vector.y);
    
    if (edge1Length === 0 || edge2Length === 0) return false;
    
    // Normalize vectors
    const edge1Unit = { x: edge1Vector.x / edge1Length, y: edge1Vector.y / edge1Length };
    const edge2Unit = { x: edge2Vector.x / edge2Length, y: edge2Vector.y / edge2Length };
    
    // Check if edges are parallel (dot product close to 1 or -1)
    const dotProduct = Math.abs(edge1Unit.x * edge2Unit.x + edge1Unit.y * edge2Unit.y);
    const isParallel = dotProduct > 0.99; // Allow for small floating point errors
    
    if (!isParallel) return false;
    
    // Check if edges are close enough to overlap
    const distanceToEdge2Start = pointToLineDistance(edge2.start, edge1.start, edge1.end);
    const distanceToEdge2End = pointToLineDistance(edge2.end, edge1.start, edge1.end);
    
    if (distanceToEdge2Start > tolerance && distanceToEdge2End > tolerance) return false;
    
    // Check if there's actual overlap along the line
    const edge1StartOnLine = projectPointOnLine(edge1.start, edge2.start, edge2.end);
    const edge1EndOnLine = projectPointOnLine(edge1.end, edge2.start, edge2.end);
    const edge2StartOnLine = projectPointOnLine(edge2.start, edge1.start, edge1.end);
    const edge2EndOnLine = projectPointOnLine(edge2.end, edge1.start, edge1.end);
    
    // Check for overlap in projection
    const edge1Range = [Math.min(edge1StartOnLine, edge1EndOnLine), Math.max(edge1StartOnLine, edge1EndOnLine)];
    const edge2Range = [Math.min(edge2StartOnLine, edge2EndOnLine), Math.max(edge2StartOnLine, edge2EndOnLine)];
    
    return !(edge1Range[1] < edge2Range[0] || edge2Range[1] < edge1Range[0]);
  }, []);
  
  // Helper function to calculate distance from point to line
  const pointToLineDistance = useCallback((point, lineStart, lineEnd) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    const param = dot / lenSq;
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);
  
  // Helper function to project point onto line and return distance along line
  const projectPointOnLine = useCallback((point, lineStart, lineEnd) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return 0;
    
    return dot / lenSq;
  }, []);

  // Find walls that connect to the given wall (WITH DEBUGGING)
  const findConnectedWalls = useCallback((targetWall, allWalls) => {
    const connected = [];
    const tolerance = 5.0; // ULTRA-STRICT: Only group walls that are virtually touching (5px tolerance)
    
    console.log(`\n🔍 FINDING CONNECTIONS for wall ${targetWall.id}:`);
    
    if (!targetWall.params) {
      console.log('❌ Target wall has no params');
      return connected;
    }
    
    const targetStart = targetWall.params.startPoint || targetWall.params.adjustedStartPoint;
    const targetEnd = targetWall.params.endPoint || targetWall.params.adjustedEndPoint;
    
    if (!targetStart || !targetEnd) {
      console.log('❌ Target wall missing start/end points');
      return connected;
    }
    
    console.log('🎯 Target wall endpoints:');
    console.log('  Start:', targetStart);
    console.log('  End:', targetEnd);
    console.log(`  Tolerance: ${tolerance}m`);
    
    allWalls.forEach(wall => {
      if (wall.id === targetWall.id || wall.type !== 'wall' || !wall.params) return;
      
      const wallStart = wall.params.startPoint || wall.params.adjustedStartPoint;
      const wallEnd = wall.params.endPoint || wall.params.adjustedEndPoint;
      
      if (!wallStart || !wallEnd) return;
      
      console.log(`\n  🔍 Checking wall ${wall.id}:`);
      console.log('    Start:', wallStart);
      console.log('    End:', wallEnd);
      
      // Check if walls share endpoints (within tolerance)
      const distances = [
        { type: 'target-start-to-wall-start', dist: Math.sqrt((targetStart.x - wallStart.x)**2 + (targetStart.z - wallStart.z)**2) },
        { type: 'target-start-to-wall-end', dist: Math.sqrt((targetStart.x - wallEnd.x)**2 + (targetStart.z - wallEnd.z)**2) },
        { type: 'target-end-to-wall-start', dist: Math.sqrt((targetEnd.x - wallStart.x)**2 + (targetEnd.z - wallStart.z)**2) },
        { type: 'target-end-to-wall-end', dist: Math.sqrt((targetEnd.x - wallEnd.x)**2 + (targetEnd.z - wallEnd.z)**2) }
      ];
      
      console.log('    Distances:', distances);
      
      const isConnected = distances.some(d => d.dist < tolerance);
      
      if (isConnected) {
        const connectedDistance = distances.find(d => d.dist < tolerance);
        console.log(`    ✅ CONNECTED via ${connectedDistance.type} (${connectedDistance.dist.toFixed(3)}m)`);
        connected.push(wall);
      } else {
        console.log(`    ❌ Not connected (min distance: ${Math.min(...distances.map(d => d.dist)).toFixed(3)}m)`);
      }
    });
    
    console.log(`🔗 Found ${connected.length} connected walls for wall ${targetWall.id}`);
    return connected;
  }, []);
  
  // Create a unified path for connected walls with proper corner extensions
  const createUnifiedWallPath = useCallback((wallGroup) => {
    if (!wallGroup.length) return null;
    
    // Calculate corner extensions for proper wall joining
    const extendedWalls = calculateCornerExtensions(wallGroup);
    const wallData = [];
    
    extendedWalls.forEach(wall => {
      if (!wall.params) return;
      
      // Use extended corner points instead of original endpoints
      const startPoint = wall.extendedStartPoint || wall.params.adjustedStartPoint || wall.params.startPoint;
      const endPoint = wall.extendedEndPoint || wall.params.adjustedEndPoint || wall.params.endPoint;
      const thickness = (wall.params.thickness || wall.params.width || wall.thickness || wall.width || 0.2) * 100 * zoom;
      
      if (!startPoint || !endPoint) return;
      
      // Convert to 2D coordinates
      const start2D = to2D(startPoint);
      const end2D = to2D(endPoint);
      
      wallData.push({
        wall,
        start2D,
        end2D,
        thickness,
        startPoint,
        endPoint
      });
    });
    
    return wallData;
  }, [to2D, zoom, calculateCornerExtensions]);

  // Create professional wall joinery with miter joints and unified polygons - PROFESSIONAL CAD (WITH DEBUGGING)
  const createProfessionalWallJoinery = useCallback((wallGroup) => {
    console.log('\n🎯 PROFESSIONAL CAD: Creating miter joints for', wallGroup.length, 'walls');
    console.log('🔍 Wall group details:', wallGroup.map(w => ({
      id: w.id,
      startPoint: w.params?.adjustedStartPoint || w.params?.startPoint,
      endPoint: w.params?.adjustedEndPoint || w.params?.endPoint,
      thickness: w.params?.thickness || w.thickness
    })));
    
    if (!wallGroup.length) {
      console.log('❌ No walls in group');
      return null;
    }
    
    // Step 1: Convert each wall to a polygon with proper thickness
    console.log('\n📐 STEP 1: Converting walls to polygons...');
    const wallPolygons = wallGroup.map((wall, index) => {
      console.log(`\n  🔍 Processing wall ${index} (${wall.id}):`);
      
      if (!wall.params) {
        console.log('    ❌ No params');
        return null;
      }
      
      const startPoint = wall.params.adjustedStartPoint || wall.params.startPoint;
      const endPoint = wall.params.adjustedEndPoint || wall.params.endPoint;
      const thickness = (wall.params.thickness || wall.params.width || wall.thickness || wall.width || 0.2) * 100 * zoom;
      
      console.log('    Start point:', startPoint);
      console.log('    End point:', endPoint);
      console.log('    Thickness:', thickness);
      
      if (!startPoint || !endPoint) {
        console.log('    ❌ Missing start/end point');
        return null;
      }
      
      const start2D = to2D(startPoint);
      const end2D = to2D(endPoint);
      
      console.log('    Start 2D:', start2D);
      console.log('    End 2D:', end2D);
      
      const polygon = createWallPolygon(start2D, end2D, thickness, wall);
      console.log('    ✅ Polygon created:', polygon);
      
      return polygon;
    }).filter(Boolean);
    
    console.log(`📐 STEP 1 RESULT: Created ${wallPolygons.length} wall polygons`);
    
    if (wallPolygons.length === 0) {
      console.log('❌ No valid wall polygons created');
      return null;
    }
    
    // Step 2: Apply miter joints for connected walls
    console.log('\n🔧 STEP 2: Applying miter joints...');
    const miteredPolygons = applyMiterJoints(wallPolygons, wallGroup);
    console.log('🔧 STEP 2 RESULT: Miter joints applied');
    
    // Step 3: Use polygon boolean operations to create unified geometry
    console.log('\n🔄 STEP 3: Creating unified geometry...');
    const unifiedGeometry = unifyWallPolygons(miteredPolygons);
    console.log('🔄 STEP 3 RESULT: Unified geometry created');
    
    const result = {
      wallGroup,
      miteredPolygons,
      unifiedGeometry
    };
    
    console.log('\n✅ PROFESSIONAL CAD RESULT:', {
      wallGroupCount: result.wallGroup.length,
      miteredPolygonsCount: result.miteredPolygons.length,
      unifiedGeometryType: typeof result.unifiedGeometry,
      unifiedGeometryLength: result.unifiedGeometry?.length || 0
    });
    
    return result;
  }, [to2D, zoom]);

  // Convert wall centerline to polygon with proper thickness - PROFESSIONAL CAD (WITH DEBUGGING)
  const createWallPolygon = useCallback((start2D, end2D, thickness, wall) => {
    console.log(`\n📐 CREATING WALL POLYGON for ${wall.id}:`);
    console.log('  Start 2D:', start2D);
    console.log('  End 2D:', end2D);
    console.log('  Thickness (pixels):', thickness);
    console.log('  Original thickness param:', wall.params?.thickness || wall.thickness);
    console.log('  Zoom factor:', zoom);
    
    // Calculate perpendicular vector for wall thickness
    const dx = end2D.x - start2D.x;
    const dy = end2D.y - start2D.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    console.log('  Wall length (pixels):', length.toFixed(2));
    
    if (length === 0) {
      console.log('  ❌ Zero length wall');
      return null;
    }
    
    // Unit direction vector
    const unitX = dx / length;
    const unitY = dy / length;
    
    console.log('  Direction vector:', { x: unitX.toFixed(3), y: unitY.toFixed(3) });
    
    // Perpendicular offset vector (thickness/2)
    const offsetX = -(dy / length) * (thickness / 2);
    const offsetZ = (dx / length) * (thickness / 2);
    
    console.log('  Offset vector:', { x: offsetX.toFixed(3), z: offsetZ.toFixed(3) });
    
    // Create wall polygon (4 corners) - Counter-clockwise winding (will be closed later)
    const polygon = [
      [start2D.x + offsetX, start2D.y + offsetZ], // p1: start + offset
      [end2D.x + offsetX, end2D.y + offsetZ],     // p2: end + offset  
      [end2D.x - offsetX, end2D.y - offsetZ],     // p3: end - offset
      [start2D.x - offsetX, start2D.y - offsetZ]  // p4: start - offset
    ];
    
    console.log('  Polygon corners:', polygon.map((p, i) => `P${i+1}:[${p[0].toFixed(2)}, ${p[1].toFixed(2)}]`));
    
    const result = {
      polygon,
      wall,
      start2D,
      end2D,
      thickness,
      centerline: { start: start2D, end: end2D },
      direction: { x: unitX, y: unitY }
    };
    
    console.log('  ✅ Wall polygon created successfully');
    return result;
  }, [zoom]);

  // Apply miter joints to connected walls - PROFESSIONAL CAD GEOMETRY (WITH DEBUGGING)
  const applyMiterJoints = useCallback((wallPolygons, wallGroup) => {
    console.log('\n🔧 MITER JOINTS: Processing', wallPolygons.length, 'wall polygons');
    console.log('📐 Wall polygons before miter:', wallPolygons.map((wp, i) => ({
      index: i,
      wallId: wp.wall?.id,
      polygon: wp.polygon,
      centerline: wp.centerline,
      direction: wp.direction
    })));
    
    const miteredPolygons = wallPolygons.map(wallPoly => ({ ...wallPoly }));
    const tolerance = 25.0; // Increased to 25px connection tolerance for user drawing imprecision
    
    let miterJointsApplied = 0;
    
    // Find all wall connections and apply miter joints
    for (let i = 0; i < wallPolygons.length; i++) {
      for (let j = i + 1; j < wallPolygons.length; j++) {
        const wallA = wallPolygons[i];
        const wallB = wallPolygons[j];
        
        if (!wallA || !wallB) continue;
        
        console.log(`\n🔍 Checking connection between wall ${wallA.wall?.id} (${i}) and wall ${wallB.wall?.id} (${j})`);
        
        // Check if walls are connected at their endpoints
        const connection = findWallConnection(wallA, wallB, tolerance);
        
        if (connection) {
          console.log(`🔗 CONNECTED: Wall ${i} and ${j} at ${connection.type}`);
          console.log('  Connection details:', connection);
          
          // Calculate miter joint for this connection
          const miterJoint = calculateMiterJoint(wallA, wallB, connection);
          
          if (miterJoint) {
            console.log('✅ Miter joint calculated:', {
              angle: (miterJoint.angle * 180 / Math.PI).toFixed(1) + '°',
              miterLength: miterJoint.miterLength.toFixed(3) + 'm',
              extensionA: miterJoint.extensionA,
              extensionB: miterJoint.extensionB
            });
            
            // Apply miter extensions to both walls
            console.log('📐 Applying miter extensions...');
            applyMiterExtension(miteredPolygons[i], miterJoint.extensionA);
            applyMiterExtension(miteredPolygons[j], miterJoint.extensionB);
            miterJointsApplied++;
          } else {
            console.log('❌ Failed to calculate miter joint (walls too parallel?)');
          }
        } else {
          console.log('❌ Walls not connected');
        }
      }
    }
    
    console.log(`🔧 MITER JOINTS SUMMARY: Applied ${miterJointsApplied} joints to ${wallPolygons.length} walls`);
    console.log('📐 Wall polygons after miter:', miteredPolygons.map((wp, i) => ({
      index: i,
      wallId: wp.wall?.id,
      polygon: wp.polygon
    })));
    
    return miteredPolygons;
  }, []);

  // Find connection between two walls (shared endpoints) - WITH DEBUGGING
  const findWallConnection = useCallback((wallA, wallB, tolerance) => {
    console.log(`\n🔍 CONNECTION CHECK: ${wallA.wall.id} ↔ ${wallB.wall.id}`);
    console.log('  Wall A centerline:', wallA.centerline);
    console.log('  Wall B centerline:', wallB.centerline);
    console.log('  Tolerance:', tolerance);
    
    const endpoints = [
      { wall: 'A', point: wallA.centerline.start, type: 'start' },
      { wall: 'A', point: wallA.centerline.end, type: 'end' },
      { wall: 'B', point: wallB.centerline.start, type: 'start' },
      { wall: 'B', point: wallB.centerline.end, type: 'end' }
    ];
    
    console.log('  Endpoints to check:');
    endpoints.forEach((ep, i) => {
      console.log(`    ${i}: Wall ${ep.wall} ${ep.type} = [${ep.point.x.toFixed(2)}, ${ep.point.y.toFixed(2)}]`);
    });
    
    // Check all endpoint combinations
    for (let i = 0; i < 2; i++) {
      for (let j = 2; j < 4; j++) {
        const pointA = endpoints[i];
        const pointB = endpoints[j];
        
        const distance = Math.sqrt(
          Math.pow(pointA.point.x - pointB.point.x, 2) + 
          Math.pow(pointA.point.y - pointB.point.y, 2)
        );
        
        console.log(`  🔍 ${pointA.wall}-${pointA.type} vs ${pointB.wall}-${pointB.type}:`);
        console.log(`    [${pointA.point.x.toFixed(2)}, ${pointA.point.y.toFixed(2)}] ↔ [${pointB.point.x.toFixed(2)}, ${pointB.point.y.toFixed(2)}]`);
        console.log(`    Distance: ${distance.toFixed(2)}px (tolerance: ${tolerance}px)`);
        
        if (distance <= tolerance) {
          console.log(`    ✅ CONNECTION FOUND! Distance ${distance.toFixed(2)} <= ${tolerance}`);
          return {
            type: `${pointA.type}-${pointB.type}`,
            pointA: pointA.point,
            pointB: pointB.point,
            wallAEnd: pointA.type,
            wallBEnd: pointB.type
          };
        } else {
          console.log(`    ❌ Too far: ${distance.toFixed(2)} > ${tolerance}`);
        }
      }
    }
    
    console.log('  ❌ NO CONNECTION FOUND');
    return null;
  }, []);

  // Calculate miter joint geometry for two connected walls
  const calculateMiterJoint = useCallback((wallA, wallB, connection) => {
    const dirA = wallA.direction;
    const dirB = wallB.direction;
    
    // Calculate angle between walls
    const dotProduct = dirA.x * dirB.x + dirA.y * dirB.y;
    const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
    
    // Skip miter if walls are nearly parallel (avoid division by zero)
    if (Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1) {
      return null;
    }
    
    // Calculate angle bisector
    const bisectorX = dirA.x + dirB.x;
    const bisectorY = dirA.y + dirB.y;
    const bisectorLength = Math.sqrt(bisectorX * bisectorX + bisectorY * bisectorY);
    
    if (bisectorLength === 0) return null;
    
    const bisectorUnit = {
      x: bisectorX / bisectorLength,
      y: bisectorY / bisectorLength
    };
    
    // Calculate miter extension length
    const halfAngle = angle / 2;
    const rawMiterLength = Math.abs(wallA.thickness / (2 * Math.sin(halfAngle)));
    
    console.log('🧮 MITER CALCULATION DETAILS:');
    console.log('  Half angle:', (halfAngle * 180 / Math.PI).toFixed(1) + '°');
    console.log('  Wall A thickness:', wallA.thickness.toFixed(3));
    console.log('  Wall B thickness:', wallB.thickness.toFixed(3));
    console.log('  Sin(half angle):', Math.sin(halfAngle).toFixed(6));
    console.log('  Raw miter length:', rawMiterLength.toFixed(3));
    
    // Fix: Limit excessive miter extensions more aggressively
    const avgThickness = (wallA.thickness + wallB.thickness) / 2;
    const maxMiterLength = avgThickness * 0.5; // Much more conservative limit
    const clampedMiterLength = Math.min(rawMiterLength, maxMiterLength);
    
    console.log('  Average thickness:', avgThickness.toFixed(3));
    console.log('  Max allowed miter:', maxMiterLength.toFixed(3)); 
    console.log('  Final clamped miter:', clampedMiterLength.toFixed(3));
    
    return {
      connectionPoint: connection.pointA,
      bisector: bisectorUnit,
      miterLength: clampedMiterLength,
      angle: angle,
      extensionA: {
        end: connection.wallAEnd,
        extension: clampedMiterLength
      },
      extensionB: {
        end: connection.wallBEnd,
        extension: clampedMiterLength
      }
    };
  }, []);

  // Apply miter extension to a wall polygon (WITH DEBUGGING)
  const applyMiterExtension = useCallback((wallPoly, extension) => {
    console.log(`\n🔧 APPLYING MITER EXTENSION:`);
    console.log('  Wall ID:', wallPoly.wall?.id);
    console.log('  Extension:', extension);
    console.log('  Polygon before:', wallPoly.polygon.map(p => `[${p[0].toFixed(2)}, ${p[1].toFixed(2)}]`));
    
    if (!extension || extension.extension <= 0) {
      console.log('  ❌ No extension to apply');
      return;
    }
    
    const { polygon, direction } = wallPoly;
    const extLength = extension.extension;
    
    console.log('  Direction vector:', { x: direction.x.toFixed(3), y: direction.y.toFixed(3) });
    console.log('  Extension length:', extLength.toFixed(3));
    console.log('  Extension end:', extension.end);
    
    if (extension.end === 'start') {
      console.log('  📐 Extending START end of wall');
      // Extend start end of wall
      const oldP1 = [polygon[0][0], polygon[0][1]];
      const oldP4 = [polygon[3][0], polygon[3][1]];
      
      polygon[0][0] -= direction.x * extLength; // p1
      polygon[0][1] -= direction.y * extLength;
      polygon[3][0] -= direction.x * extLength; // p4
      polygon[3][1] -= direction.y * extLength;
      
      console.log(`    P1: [${oldP1[0].toFixed(2)}, ${oldP1[1].toFixed(2)}] → [${polygon[0][0].toFixed(2)}, ${polygon[0][1].toFixed(2)}]`);
      console.log(`    P4: [${oldP4[0].toFixed(2)}, ${oldP4[1].toFixed(2)}] → [${polygon[3][0].toFixed(2)}, ${polygon[3][1].toFixed(2)}]`);
    } else {
      console.log('  📐 Extending END end of wall');
      // Extend end end of wall
      const oldP2 = [polygon[1][0], polygon[1][1]];
      const oldP3 = [polygon[2][0], polygon[2][1]];
      
      polygon[1][0] += direction.x * extLength; // p2
      polygon[1][1] += direction.y * extLength;
      polygon[2][0] += direction.x * extLength; // p3
      polygon[2][1] += direction.y * extLength;
      
      console.log(`    P2: [${oldP2[0].toFixed(2)}, ${oldP2[1].toFixed(2)}] → [${polygon[1][0].toFixed(2)}, ${polygon[1][1].toFixed(2)}]`);
      console.log(`    P3: [${oldP3[0].toFixed(2)}, ${oldP3[1].toFixed(2)}] → [${polygon[2][0].toFixed(2)}, ${polygon[2][1].toFixed(2)}]`);
    }
    
    console.log('  Polygon after:', wallPoly.polygon.map(p => `[${p[0].toFixed(2)}, ${p[1].toFixed(2)}]`));
    console.log('  ✅ Extension applied successfully');
  }, []);

  // Detect if wall polygons form a closed room (to avoid interior fill overlap)
  const detectClosedRoom = useCallback((miteredPolygons) => {
    if (miteredPolygons.length < 3) return false; // Need at least 3 walls for a room
    
    // Check if walls form a closed loop by examining connections
    const walls = miteredPolygons.map(mp => mp.wall);
    const tolerance = 60.0; // Generous tolerance to match room closure snapping (50px + buffer)
    
    // Get all wall endpoints - use both adjusted and original points
    const allEndpoints = [];
    walls.forEach(wall => {
      const startPoint = wall.params?.adjustedStartPoint || wall.params?.startPoint;
      const endPoint = wall.params?.adjustedEndPoint || wall.params?.endPoint;
      
      if (startPoint && endPoint) {
        allEndpoints.push({
          point: startPoint,
          wallId: wall.id,
          type: 'start'
        });
        allEndpoints.push({
          point: endPoint,
          wallId: wall.id,
          type: 'end'
        });
      } else {
        console.log(`⚠️ Wall ${wall.id} missing endpoints:`, {
          adjustedStart: wall.params?.adjustedStartPoint,
          adjustedEnd: wall.params?.adjustedEndPoint,
          originalStart: wall.params?.startPoint,
          originalEnd: wall.params?.endPoint
        });
      }
    });
    
    console.log(`🏠 CLOSED ROOM DEBUG: Found ${allEndpoints.length} endpoints from ${walls.length} walls`);
    allEndpoints.forEach((ep, i) => {
      console.log(`  ${i}: ${ep.wallId} ${ep.type} = [${ep.point.x.toFixed(2)}, ${ep.point.z.toFixed(2)}]`);
    });
    
    // Count connections - each endpoint should connect to exactly one other endpoint
    let connectionCount = 0;
    const connections = [];
    for (let i = 0; i < allEndpoints.length; i++) {
      for (let j = i + 1; j < allEndpoints.length; j++) {
        if (allEndpoints[i].wallId === allEndpoints[j].wallId) continue; // Skip same wall
        
        const distance = Math.sqrt(
          Math.pow(allEndpoints[i].point.x - allEndpoints[j].point.x, 2) + 
          Math.pow(allEndpoints[i].point.z - allEndpoints[j].point.z, 2)
        );
        
        console.log(`🏠 Distance ${allEndpoints[i].wallId}-${allEndpoints[i].type} ↔ ${allEndpoints[j].wallId}-${allEndpoints[j].type}: ${distance.toFixed(2)}px (tolerance: ${tolerance}px)`);
        
        if (distance <= tolerance) {
          connectionCount++;
          connections.push(`${allEndpoints[i].wallId}-${allEndpoints[i].type} ↔ ${allEndpoints[j].wallId}-${allEndpoints[j].type} (${distance.toFixed(2)}px)`);
        }
      }
    }
    
    console.log(`🏠 Found ${connectionCount} connections:`, connections);
    
    // For a closed room, we should have exactly walls.length connections
    const isClosed = connectionCount === walls.length;
    console.log(`🏠 CLOSED ROOM DETECTION: ${walls.length} walls, ${connectionCount} connections → ${isClosed ? 'CLOSED' : 'OPEN'}`);
    
    // 🔍 DEBUG: Additional analysis for closed room detection
    if (!isClosed && walls.length >= 4) {
      console.log('🔍 CLOSED ROOM DEBUG: Not detected as closed, analyzing why...');
      console.log(`   Expected connections: ${walls.length}, Actual: ${connectionCount}`);
      console.log(`   Tolerance used: ${tolerance}px`);
      console.log('   Suggestion: Room might be closed but tolerance too strict, or endpoints not aligned');
      
      // Check if we're close to the target number of connections
      if (connectionCount >= walls.length - 1) {
        console.log('🏠 FORCE CLOSED: Very close to expected connections, treating as closed room');
        return true;
      }
    }
    
    return isClosed;
  }, []);

  // Note: Removed createInteriorBoundary function - now using simpler individual polygon approach for closed rooms

  // Use polygon boolean operations to create unified wall geometry - PROFESSIONAL CAD (WITH DEBUGGING)
  const unifyWallPolygons = useCallback((miteredPolygons) => {
    if (miteredPolygons.length === 0) {
      console.log('🔄 POLYGON UNION: No polygons to merge');
      return [];
    }
    if (miteredPolygons.length === 1) {
      console.log('🔄 POLYGON UNION: Only one polygon, returning as-is');
      return miteredPolygons[0].polygon;
    }
    
    try {
      console.log('\n🔄 POLYGON UNION: Merging', miteredPolygons.length, 'wall polygons');
      
      // Check if this is a closed room to handle fill overlap
      const isClosedRoom = detectClosedRoom(miteredPolygons);
      
      console.log('🔍 Input polygons:', miteredPolygons.map((wp, i) => ({
        index: i,
        wallId: wp.wall?.id,
        polygonPoints: wp.polygon.length,
        polygon: wp.polygon
      })));
      
      // Convert to martinez format (array of arrays of coordinate pairs) - CLOSE POLYGONS HERE
      const polygonArray = miteredPolygons.map((wallPoly, i) => {
        // Close polygon: add first point as last point for Martinez
        const openPolygon = wallPoly.polygon;
        const closedPolygon = [...openPolygon, openPolygon[0]];
        
        console.log(`📐 Wall ${i} (${wallPoly.wall?.id}) - closing polygon:`);
        console.log(`  Before close: ${openPolygon.length} points`);
        console.log(`  After close: ${closedPolygon.length} points`);
        console.log(`  First point: [${openPolygon[0][0].toFixed(2)}, ${openPolygon[0][1].toFixed(2)}]`);
        console.log(`  Last point: [${closedPolygon[closedPolygon.length-1][0].toFixed(2)}, ${closedPolygon[closedPolygon.length-1][1].toFixed(2)}]`);
        
        const polygon = [closedPolygon];
        console.log(`📐 Wall ${i} martinez format:`, polygon);
        return polygon;
      });
      
      console.log('📐 All polygons in martinez format:', polygonArray);
      
      // DEBUG: Log exact polygon coordinates before union
      console.log('\n📍 DETAILED POLYGON COORDINATES BEFORE UNION:');
      polygonArray.forEach((poly, i) => {
        console.log(`  Polygon ${i} (${miteredPolygons[i].wall?.id}):`);
        poly[0].forEach((point, j) => {
          console.log(`    Point ${j}: [${point[0].toFixed(2)}, ${point[1].toFixed(2)}]`);
        });
        
        // Check for potential issues using closed polygon
        const points = poly[0]; // This is now the closed polygon
        const area = Math.abs(points.slice(0, -1).reduce((acc, point, idx) => {
          const nextIdx = (idx + 1) % (points.length - 1); // Exclude duplicate closing point
          const nextPoint = points[nextIdx];
          return acc + (point[0] * nextPoint[1] - nextPoint[0] * point[1]);
        }, 0) / 2);
        console.log(`    Area: ${area.toFixed(2)} pixels²`);
        
        // Check if polygon is closed (first and last points same)
        const first = points[0];
        const last = points[points.length - 1];
        const isClosed = (Math.abs(first[0] - last[0]) < 0.01 && Math.abs(first[1] - last[1]) < 0.01);
        console.log(`    Closed: ${isClosed} (${points.length} points)`);
      });
      
      // Perform union operation using martinez-polygon-clipping
      let result = polygonArray[0];
      console.log('\n🚀 Starting union with:', result);
      
      for (let i = 1; i < polygonArray.length; i++) {
        console.log(`\n🔄 Union step ${i}: Merging with polygon ${i}`);
        console.log('  Current result:', result);
        console.log('  Adding polygon:', polygonArray[i]);
        
        const newResult = martinez.union(result, polygonArray[i]);
        console.log('  Union result:', newResult);
        result = newResult;
      }
      
      // 🏠 CLOSED ROOM FIX: For closed rooms OR 4+ walls, return individual polygons to avoid interior fill
      // Force individual rendering for any room with 4+ walls to prevent interior fill issues
      const shouldUseIndividualPolygons = isClosedRoom || miteredPolygons.length >= 4;
      
      if (shouldUseIndividualPolygons) {
        console.log('\n🏠 USING INDIVIDUAL POLYGONS: Avoiding interior fill...');
        console.log(`🏠 Reason: ${isClosedRoom ? 'Detected closed room' : 'Room has 4+ walls'} (${miteredPolygons.length} walls)`);
        console.log('🏠 Returning individual polygons instead of unified geometry to prevent interior fills');
        
        // Return a special marker indicating this should use individual polygons
        return {
          isClosedRoom: true, // Mark as closed room to trigger individual rendering
          individualPolygons: miteredPolygons.map(mp => mp.polygon)
        };
      }
      
      console.log('\n✅ POLYGON UNION: Final success!');
      console.log('  Result type:', typeof result);
      console.log('  Result length:', result?.length || 0);
      console.log('  Final unified geometry:', result);
      
      return result;
      
    } catch (error) {
      console.warn('\n⚠️ POLYGON UNION: Failed, falling back to individual polygons');
      console.error('Error details:', error);
      console.log('Fallback: returning individual polygons');
      const fallback = miteredPolygons.map(wp => wp.polygon);
      console.log('Fallback polygons:', fallback);
      return fallback;
    }
  }, [detectClosedRoom]);

  // Generate SVG path from unified polygon geometry - PROFESSIONAL CAD RENDERING (FIXED)
  const generateSVGPath = useCallback((polygonGeometry) => {
    console.log('\n🎨 SVG PATH GENERATION (FIXED):');
    console.log('  Input geometry:', polygonGeometry);
    console.log('  Input type:', typeof polygonGeometry);
    console.log('  Input length:', polygonGeometry?.length);
    
    if (!polygonGeometry || polygonGeometry.length === 0) {
      console.log('❌ SVG PATH: No geometry provided');
      return '';
    }
    
    try {
      let pathData = '';
      
      // Martinez returns format: [[[outer_ring], [hole1], [hole2]], [[outer_ring2]]]
      // We need to handle each multi-polygon and each ring within it
      
      if (Array.isArray(polygonGeometry)) {
        // Normalize: if geometry is a single ring [[x,y]...], wrap to [[ring]]
        if (polygonGeometry.length > 0 && Array.isArray(polygonGeometry[0]) && typeof polygonGeometry[0][0] === 'number') {
          polygonGeometry = [ [ polygonGeometry ] ];
        }
        console.log('🔍 Processing Martinez polygon array...');
        
        polygonGeometry.forEach((multiPolygon, mpIndex) => {
          console.log(`\n📐 Multi-polygon ${mpIndex}:`, multiPolygon);
          
          if (Array.isArray(multiPolygon)) {
            multiPolygon.forEach((ring, ringIndex) => {
              console.log(`  📍 Ring ${ringIndex}:`, ring);
              console.log(`  📍 Ring length:`, ring?.length);
              const previewPoints = Array.isArray(ring) && typeof ring[0]?.[0] === 'number' ? ring.slice(0,3) : [];
              console.log(`  📍 First few points:`, previewPoints);
              
              if (!Array.isArray(ring) || ring.length === 0) {
                console.log('    ⚠️ Empty ring, skipping');
                return;
              }
              
              // Ensure we have valid coordinate pairs
              if (ring.length < 3 || typeof ring[0]?.[0] !== 'number') {
                console.log('    ⚠️ Ring has less than 3 points, skipping');
                return;
              }
              
              // Start new path for each ring
              const firstPoint = ring[0];
              if (!firstPoint || firstPoint.length < 2) {
                console.log('    ⚠️ Invalid first point:', firstPoint);
                return;
              }
              
              const moveCommand = `M${firstPoint[0]},${firstPoint[1]}`;
              pathData += moveCommand;
              console.log(`    Move: ${moveCommand}`);
              
              // Add line segments for remaining points
              for (let i = 1; i < ring.length; i++) {
                const point = ring[i];
                if (!point || point.length < 2) {
                  console.log(`    ⚠️ Invalid point ${i}:`, point);
                  continue;
                }
                
                const lineCommand = `L${point[0]},${point[1]}`;
                pathData += lineCommand;
                if (i <= 3) console.log(`    Line ${i}: ${lineCommand}`);
              }
              
              // Close path
              pathData += 'Z';
              console.log(`    Close: Z`);
            });
          }
        });
      }
      
      console.log('\n✅ SVG PATH GENERATION: Success!');
      console.log('  Final SVG path length:', pathData.length);
      console.log('  Final SVG path preview:', pathData.substring(0, 100) + '...');
      
      return pathData;
      
    } catch (error) {
      console.warn('\n⚠️ SVG PATH: Generation failed');
      console.error('Error details:', error);
      console.log('  Falling back to simple polygon rendering...');
      
      // Fallback: try to render as simple polygons
      try {
        let fallbackPath = '';
        if (Array.isArray(polygonGeometry) && polygonGeometry.length > 0) {
          const firstPoly = polygonGeometry[0];
          if (Array.isArray(firstPoly) && firstPoly.length > 0) {
            const ring = firstPoly[0];
            if (Array.isArray(ring) && ring.length > 2) {
              fallbackPath = `M${ring[0][0]},${ring[0][1]}`;
              for (let i = 1; i < ring.length; i++) {
                fallbackPath += `L${ring[i][0]},${ring[i][1]}`;
              }
              fallbackPath += 'Z';
            }
          }
        }
        console.log('  Fallback path:', fallbackPath);
        return fallbackPath;
      } catch (fallbackError) {
        console.error('  Fallback also failed:', fallbackError);
        return '';
      }
    }
  }, []);
  
  // Calculate convex hull using Graham scan algorithm - PROFESSIONAL CAD GEOMETRY (LEGACY)
  const calculateConvexHull = useCallback((points) => {
    if (points.length <= 3) return points;
    
    // Find the bottom-most point (and left-most in case of tie)
    let start = points[0];
    for (let i = 1; i < points.length; i++) {
      if (points[i].y < start.y || (points[i].y === start.y && points[i].x < start.x)) {
        start = points[i];
      }
    }
    
    // Sort points by polar angle relative to start point
    const sortedPoints = points.filter(p => p !== start).sort((a, b) => {
      const angleA = Math.atan2(a.y - start.y, a.x - start.x);
      const angleB = Math.atan2(b.y - start.y, b.x - start.x);
      if (Math.abs(angleA - angleB) < 1e-10) {
        // If angles are equal, sort by distance
        const distA = Math.sqrt((a.x - start.x) ** 2 + (a.y - start.y) ** 2);
        const distB = Math.sqrt((b.x - start.x) ** 2 + (b.y - start.y) ** 2);
        return distA - distB;
      }
      return angleA - angleB;
    });
    
    // Build convex hull using Graham scan
    const hull = [start];
    
    for (const point of sortedPoints) {
      // Remove points that make clockwise turn
      while (hull.length > 1) {
        const p1 = hull[hull.length - 2];
        const p2 = hull[hull.length - 1];
        const cross = (p2.x - p1.x) * (point.y - p1.y) - (p2.y - p1.y) * (point.x - p1.x);
        if (cross > 0) break; // Counter-clockwise turn, keep point
        hull.pop(); // Clockwise turn, remove point
      }
      hull.push(point);
    }
    
    return hull;
  }, []);

  // Render professional wall joinery with miter joints and unified geometry - PROFESSIONAL CAD
  const renderProfessionalWallJoinery = useCallback((wallGroups) => {
    if (!wallGroups || !wallGroups.length) return [];
    
    return wallGroups.map((joineryData, groupIndex) => {
      if (!joineryData || !joineryData.wallGroup) return null;
      
      const { wallGroup, miteredPolygons, unifiedGeometry } = joineryData;
      const firstWall = wallGroup[0];
      
      // Get material configuration for the wall group
      const material = firstWall.params?.material || firstWall.material || 'concrete';
      
      // Material-specific colors and patterns - PROFESSIONAL CAD STYLE
      const materialConfig = {
        concrete: { fill: '#4a5568', strokeColor: '#2d3748' }, // Dark grey to hide corner intersections
        brick: { fill: '#975a16', strokeColor: '#7c2d12' }, // Darker brick color
        wood: { fill: '#92400e', strokeColor: '#78350f' }, // Darker wood tone
        steel: { fill: '#475569', strokeColor: '#334155' }, // Darker steel blue-grey
        stone: { fill: '#57534e', strokeColor: '#44403c' }, // Darker stone
        aluminum: { fill: '#64748b', strokeColor: '#475569' }, // Darker metallic
        glass: { fill: '#60a5fa', strokeColor: '#3b82f6' }, // Darker blue
        drywall: { fill: '#6b7280', strokeColor: '#4b5563' } // Darker off-white
      };
      
      const config = materialConfig[material] || materialConfig.concrete;
      
      // Determine stroke style based on selection state of any wall in group
      const isSelected = wallGroup.some(wall => selectedObjects.has(wall.id));
      const isHovered = wallGroup.some(wall => hoveredWalls.has(wall.id));
      
      let strokeColor, strokeWidth, fillColor, fillOpacity;
      
      if (isSelected) {
        strokeColor = '#7c3aed'; // Purple for selected
        strokeWidth = 3;
        fillColor = '#ddd6fe'; // Light purple fill
        fillOpacity = 0.6;
      } else if (isHovered) {
        strokeColor = '#3b82f6'; // Blue for hovered
        strokeWidth = 2.5;
        fillColor = '#dbeafe'; // Light blue fill
        fillOpacity = 0.7;
      } else {
        strokeColor = config.strokeColor; // Material-specific stroke
        strokeWidth = 2;
        fillColor = config.fill; // Material-specific fill
        fillOpacity = 0.8;
      }
      
      // Create unique pattern ID for this wall group
      const patternId = `wall-group-pattern-${material}-${groupIndex}`;
      
      // Check if this is a closed room with individual polygons
      const isClosedRoom = unifiedGeometry && unifiedGeometry.isClosedRoom;
      const individualPolygons = isClosedRoom ? unifiedGeometry.individualPolygons : null;
      
      // Generate SVG path from unified geometry (only for non-closed rooms)
      // SAFETY: Never generate SVG path if we have individual polygons or 4+ walls
      const svgPath = (isClosedRoom || miteredPolygons.length >= 4) ? null : generateSVGPath(unifiedGeometry);
      
      
      return (
        <g key={`professional-wall-group-${groupIndex}`}>
          
          {/* Define material pattern for this wall group */}
          <defs>
            <pattern
              id={patternId}
              patternUnits="userSpaceOnUse"
              width="12"
              height="12"
            >
              <rect width="12" height="12" fill={fillColor} />
              {renderMaterialPattern(material, 12)}
            </pattern>
          </defs>
          
          {/* Individual wall click areas (invisible but functional) */}
          {wallGroup.map(wall => {
            const startPoint = wall.params?.adjustedStartPoint || wall.params?.startPoint;
            const endPoint = wall.params?.adjustedEndPoint || wall.params?.endPoint;
            const thickness = (wall.params?.thickness || wall.params?.width || wall.thickness || wall.width || 0.2) * 100 * zoom;
            
            if (!startPoint || !endPoint) return null;
            
            const start2D = to2D(startPoint);
            const end2D = to2D(endPoint);
            const dx = end2D.x - start2D.x;
            const dy = end2D.y - start2D.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) return null;
            
            const midX = (start2D.x + end2D.x) / 2;
            const midY = (start2D.y + end2D.y) / 2;
            const rotation = Math.atan2(dy, dx) * 180 / Math.PI;
            const transform = `translate(${midX}, ${midY}) rotate(${rotation}) translate(${-midX}, ${-midY})`;
            
            return (
              <rect
                key={`click-area-${wall.id}`}
                x={midX - length/2}
                y={midY - thickness/2}
                width={length}
                height={thickness}
                fill="transparent"
                stroke="none"
                transform={transform}
                {...createUnifiedElementHandlers(wall)}
              />
            );
          })}
          
          {/* PROFESSIONAL CAD: Unified wall geometry with material-based fills (for open walls with less than 4 walls) */}
          {svgPath && !isClosedRoom && miteredPolygons.length < 4 && (
            <path
              key={`unified-walls-${groupIndex}`}
              d={svgPath}
              fill={`url(#${patternId})`}
              fillOpacity={fillOpacity}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="miter"
              strokeLinecap="square"
              style={{ pointerEvents: 'none' }}
            />
          )}
          
          {/* CLOSED ROOM: Individual wall polygons to avoid interior fill overlap */}
          {isClosedRoom && individualPolygons && individualPolygons.map((polygon, polyIndex) => {
            if (!polygon || polygon.length === 0) return null;
            
            const points = polygon.map(p => `${p[0]},${p[1]}`).join(' ');
            
            return (
              <g key={`closed-room-wall-group-${polyIndex}`}>
                {/* Wall fill without stroke */}
                <polygon
                  points={points}
                  fill={`url(#${patternId})`}
                  fillOpacity={fillOpacity}
                  stroke="none"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Outer perimeter stroke only */}
                <polygon
                  points={points}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="miter"
                  strokeLinecap="square"
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            );
          })}
          
          {/* Fallback: Individual wall polygons if unified geometry fails (for open walls) */}
          {!svgPath && !isClosedRoom && miteredPolygons && miteredPolygons.map((wallPoly, polyIndex) => {
            if (!wallPoly || !wallPoly.polygon) return null;
            
            const points = wallPoly.polygon.map(p => `${p[0]},${p[1]}`).join(' ');
            
            return (
              <polygon
                key={`miter-wall-${polyIndex}`}
                points={points}
                fill={`url(#${patternId})`}
                fillOpacity={fillOpacity}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinejoin="miter"
                strokeLinecap="square"
                style={{ pointerEvents: 'none' }}
              />
            );
          })}
        </g>
      );
    }).filter(Boolean);
  }, [selectedObjects, hoveredWalls, onObjectClick, renderMaterialPattern, to2D, zoom]);

  // Smart Wall Grouping: Separate distinct architectural structures
  const createSmartWallGroups = useCallback((walls) => {
    try {
      if (!walls || !Array.isArray(walls)) {
        console.warn('🚪 createSmartWallGroups: Invalid walls input:', walls);
        return [];
      }
      
    const wallCentroids = walls.map(wall => {
        try {
          if (!wall) {
            console.warn('🚪 createSmartWallGroups: Null wall encountered');
            return null;
          }
          
          if (!wall.params) {
            console.warn(`🚪 createSmartWallGroups: Wall ${wall.id} missing params`);
            return null;
          }
          
          const start = wall.params.adjustedStartPoint || wall.params.startPoint;
          const end = wall.params.adjustedEndPoint || wall.params.endPoint;
          
          if (!start || !end) {
            console.warn(`🚪 createSmartWallGroups: Wall ${wall.id} missing start/end points:`, { start, end });
            return null;
          }
          
          if (typeof start.x !== 'number' || typeof start.z !== 'number' ||
              typeof end.x !== 'number' || typeof end.z !== 'number') {
            console.warn(`🚪 createSmartWallGroups: Wall ${wall.id} has invalid coordinates:`, { start, end });
            return null;
          }
      
      return {
        wall,
        centroid: {
          x: (start.x + end.x) / 2,
          z: (start.z + end.z) / 2
        },
        bounds: {
          minX: Math.min(start.x, end.x),
          maxX: Math.max(start.x, end.x),
          minZ: Math.min(start.z, end.z),
          maxZ: Math.max(start.z, end.z)
        }
      };
        } catch (wallError) {
          console.error(`🚪 createSmartWallGroups: Error processing wall ${wall?.id}:`, wallError);
          return null;
        }
    }).filter(Boolean);
    
    const spatialGroups = [];
    const processed = new Set();
    
    for (const wallData of wallCentroids) {
      if (processed.has(wallData.wall.id)) continue;
      
      const cluster = [wallData];
      processed.add(wallData.wall.id);
      const clusterBounds = { ...wallData.bounds };
      
      for (const otherWallData of wallCentroids) {
        if (processed.has(otherWallData.wall.id)) continue;
        
        const clusterCenterX = (clusterBounds.minX + clusterBounds.maxX) / 2;
        const clusterCenterZ = (clusterBounds.minZ + clusterBounds.maxZ) / 2;
        
        const distance = Math.sqrt(
          Math.pow(otherWallData.centroid.x - clusterCenterX, 2) + 
          Math.pow(otherWallData.centroid.z - clusterCenterZ, 2)
        );
        
        const spatialThreshold = 100 + (cluster.length * 50);
        
        if (distance <= spatialThreshold) {
          cluster.push(otherWallData);
          processed.add(otherWallData.wall.id);
          
          clusterBounds.minX = Math.min(clusterBounds.minX, otherWallData.bounds.minX);
          clusterBounds.maxX = Math.max(clusterBounds.maxX, otherWallData.bounds.maxX);
          clusterBounds.minZ = Math.min(clusterBounds.minZ, otherWallData.bounds.minZ);
          clusterBounds.maxZ = Math.max(clusterBounds.maxZ, otherWallData.bounds.maxZ);
        }
      }
      
      spatialGroups.push({
        walls: cluster.map(wd => wd.wall),
        bounds: clusterBounds,
        centroid: {
          x: (clusterBounds.minX + clusterBounds.maxX) / 2,
          z: (clusterBounds.minZ + clusterBounds.maxZ) / 2
        }
      });
    }
    
    return spatialGroups.map(group => group.walls);
    } catch (error) {
      console.error('🚪 CRITICAL ERROR in createSmartWallGroups:', error);
      console.error('🚪 Walls causing error:', walls);
      return []; // Return empty array on error
    }
  }, []);

  // Create professional wall joinery with miter joints
  const createProfessionalWallPaths = useCallback((walls) => {
    const wallJoineryGroups = [];
    const smartGroups = createSmartWallGroups(walls);
    
    smartGroups.forEach((wallGroup) => {
      const joineryData = createProfessionalWallJoinery(wallGroup);
      if (joineryData) {
        wallJoineryGroups.push(joineryData);
      }
    });
    
    return wallJoineryGroups;
  }, [createSmartWallGroups, createProfessionalWallJoinery]);

  // Render architectural wall with proper styling
  const renderArchitecturalWall = useCallback((object, pos2d, props, isSelected, transform) => {
    const material = object.params?.material || object.material || 'concrete';
    const thickness = (object.params?.thickness || object.params?.width || object.thickness || object.width || 0.2) * 100 * zoom;
    
    // Use actual length with joinery adjustments if available
    let actualLength = object.params?.actualLength || object.params?.length || object.length || 4;
    if (object.params?.adjustForJoinery && (object.params?.startAdjustment || object.params?.endAdjustment)) {
      // Apply joinery length adjustments
      const startAdj = object.params?.startAdjustment || 0;
      const endAdj = object.params?.endAdjustment || 0;
      actualLength = actualLength - startAdj - endAdj;
      console.log(`🔧 Wall ${object.id} joinery: original=${(object.params?.length || object.length || 4).toFixed(3)}m, adjusted=${actualLength.toFixed(3)}m`);
      
      // Debug wall state when joinery is applied
      wallJoineryDebugger.debugWallState(object);
    }
    const length = actualLength * 100 * zoom;
    
    // Debug wall rendering
    wallJoineryDebugger.debugWallRendering(object, pos2d, actualLength, thickness / (100 * zoom));
    
    // Wall selection state checks
    const isSelectable = selectableWalls.has(object.id);
    const isHovered = hoveredWalls.has(object.id);
    const hasNearbyEdge = nearbyEdges.some(edge => edge.wallId === object.id);
    
    // Material-specific colors and patterns - PROFESSIONAL CAD STYLE
    const materialConfig = {
      concrete: { fill: '#4a5568', strokeColor: '#2d3748' }, // Dark grey to hide corner intersections
      brick: { fill: '#975a16', strokeColor: '#7c2d12' }, // Darker brick color
      wood: { fill: '#92400e', strokeColor: '#78350f' }, // Darker wood tone
      steel: { fill: '#475569', strokeColor: '#334155' }, // Darker steel blue-grey
      stone: { fill: '#57534e', strokeColor: '#44403c' }, // Darker stone
      aluminum: { fill: '#64748b', strokeColor: '#475569' }, // Darker metallic
      glass: { fill: '#60a5fa', strokeColor: '#3b82f6' }, // Darker blue
      drywall: { fill: '#6b7280', strokeColor: '#4b5563' } // Darker off-white
    };
    
    const config = materialConfig[material] || materialConfig.concrete;
    
    // Dynamic styling based on state
    let strokeColor, strokeWidth, fillOpacity, glowEffect;
    
    if (isSelected) {
      strokeColor = '#8b5cf6';
      strokeWidth = 3;
      fillOpacity = 0.6; // More visible when selected
    } else if (hasNearbyEdge) {
      strokeColor = '#10b981'; // Green for edge-ready
      strokeWidth = 3;
      fillOpacity = 0.5;
      glowEffect = true;
    } else if (isHovered && isSelectable) {
      strokeColor = '#3b82f6'; // Blue for hover
      strokeWidth = 2;
      fillOpacity = 0.7; // More visible when hovered
    } else if (isSelectable) {
      strokeColor = config.strokeColor; // Use material-specific stroke color
      strokeWidth = 1.5;
      fillOpacity = 0.8; // Material fills are now visible!
    } else {
      strokeColor = config.strokeColor; // Use material-specific stroke color
      strokeWidth = 1.5;
      fillOpacity = 0.8; // Material fills are now visible!
    }
    
    // No longer override material fills - show the actual material colors!
    
    // Calculate pattern ID for unique patterns
    const patternId = `wall-pattern-${material}-${object.id}`;
    
    return (
      <g key={object.id}>
        {/* Define pattern for this wall */}
        <defs>
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={Math.max(8, thickness / 4)}
            height={Math.max(8, thickness / 4)}
          >
            {renderMaterialPattern(material, Math.max(8, thickness / 4))}
          </pattern>
        </defs>
        
        {/* Glow effect for edge-ready walls */}
        {glowEffect && (
          <rect
            x={pos2d.x - length/2 - 2}
            y={pos2d.y - thickness/2 - 2}
            width={length + 4}
            height={thickness + 4}
            fill="none"
            stroke="#10b981"
            strokeWidth="6"
            strokeOpacity="0.3"
            rx="2"
            transform={transform}
          />
        )}
        
        {/* Wall base fill */}
        <rect
          x={pos2d.x - length/2}
          y={pos2d.y - thickness/2}
          width={length}
          height={thickness}
          fill={config.fill}
          fillOpacity={fillOpacity}
          transform={transform}
        />
        
        {/* Wall fill with material pattern */}
        <rect
          x={pos2d.x - length/2}
          y={pos2d.y - thickness/2}
          width={length}
          height={thickness}
          fill={`url(#${patternId})`}
          fillOpacity={Math.min(0.4, fillOpacity + 0.1)}
          transform={transform}
        />
        
        {/* Heavy outline (architectural convention) with clean corners */}
        <rect
          x={pos2d.x - length/2}
          y={pos2d.y - thickness/2}
          width={length}
          height={thickness}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="miter"
          strokeLinecap="square"
          transform={transform}
          {...createUnifiedElementHandlers(object)}
        />
        
        {/* Center line removed per user request */}
        
        {/* Inner detail lines for thick walls */}
        {thickness > 30 && ( // Only for thick walls when zoomed in
          <g transform={transform}>
            <line
              x1={pos2d.x - length/2}
              y1={pos2d.y - thickness/4}
              x2={pos2d.x + length/2}
              y2={pos2d.y - thickness/4}
              stroke="#333333"
              strokeWidth="1"
              opacity="0.8"
            />
            <line
              x1={pos2d.x - length/2}
              y1={pos2d.y + thickness/4}
              x2={pos2d.x + length/2}
              y2={pos2d.y + thickness/4}
              stroke="#333333"
              strokeWidth="1"
              opacity="0.8"
            />
          </g>
        )}
        
        {/* Joint indicators for walls with joinery adjustments */}
        {(object.params?.adjustForJoinery || object.params?.startAdjustment || object.params?.endAdjustment) && (
          <g transform={transform}>
            {/* Start joint indicator */}
            {object.params?.startAdjustment > 0 && (
              <circle
                cx={pos2d.x - length/2}
                cy={pos2d.y}
                r="3"
                fill="#10b981"
                stroke="#065f46"
                strokeWidth="1"
                opacity="0.8"
              />
            )}
            {/* End joint indicator */}
            {object.params?.endAdjustment > 0 && (
              <circle
                cx={pos2d.x + length/2}
                cy={pos2d.y}
                r="3"
                fill="#10b981"
                stroke="#065f46"
                strokeWidth="1"
                opacity="0.8"
              />
            )}
          </g>
        )}
      </g>
    );
  }, [zoom, onObjectClick, renderMaterialPattern, selectableWalls, hoveredWalls, nearbyEdges]);

  // Render snap indicators for wall endpoints - DISABLED
  const renderSnapIndicators = useCallback(() => {
    // Return null to hide the green endpoint circles
    return null;
  }, [selectedTool, objects, to2D]);

  // Render slab in 2D with proper architectural styling
  const renderSlab2D = useCallback((object, pos2d, props, isSelected) => {
    console.log(`🏗️ SLAB RENDER DEBUG: renderSlab2D called for ${object.id}:`, {
      object: object,
      pos2d: pos2d,
      props: props,
      isSelected: isSelected
    });
    
    const strokeColor = isSelected 
      ? (viewportTheme === 'light' ? '#8b5cf6' : '#a855f7')
      : (viewportTheme === 'light' ? '#374151' : '#6b7280');
    const strokeWidth = isSelected ? 2 : 1;
    
    // Slab dimensions
    const width = props.width;
    const height = props.height;
    const rotation = props.rotation ? (props.rotation * 180 / Math.PI) : 0;
    
    // Transform for rotation
    const transform = rotation !== 0 ? 
      `rotate(${rotation} ${pos2d.x} ${pos2d.y})` : '';
    
    // Enhanced material pattern based on slab type
    const getMaterialPattern = () => {
      const material = object.material || 'concrete';
      const patternId = `${material}-${object.id}`;
      
      switch (material) {
        case 'concrete':
          return (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="8" height="8">
              <rect width="8" height="8" fill="#6b7280" opacity="0.3"/>
              <circle cx="4" cy="4" r="1" fill="#4b5563" opacity="0.5"/>
            </pattern>
          );
        case 'tiles':
          return (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="16" height="16">
              <rect width="16" height="16" fill="#4a5568" opacity="0.4"/>
              <rect x="0" y="0" width="16" height="16" fill="none" stroke="#d1d5db" strokeWidth="0.5" opacity="0.6"/>
              <rect x="8" y="8" width="8" height="8" fill="#e5e7eb" opacity="0.3"/>
            </pattern>
          );
        case 'wood':
          return (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="12" height="12">
              <rect width="12" height="12" fill="#d97706" opacity="0.2"/>
              <line x1="0" y1="6" x2="12" y2="6" stroke="#92400e" strokeWidth="1" opacity="0.3"/>
              <line x1="0" y1="3" x2="12" y2="3" stroke="#92400e" strokeWidth="0.5" opacity="0.2"/>
              <line x1="0" y1="9" x2="12" y2="9" stroke="#92400e" strokeWidth="0.5" opacity="0.2"/>
            </pattern>
          );
        case 'marble':
          return (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="20" height="20">
              <rect width="20" height="20" fill="#f9fafb" opacity="0.3"/>
              <path d="M0,0 Q10,5 20,0 Q15,10 20,20 Q10,15 0,20 Q5,10 0,0" fill="#e5e7eb" opacity="0.4"/>
              <path d="M20,0 Q10,5 0,0 Q5,10 0,20 Q10,15 20,20 Q15,10 20,0" fill="#d1d5db" opacity="0.3"/>
            </pattern>
          );
        case 'granite':
          return (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="15" height="15">
              <rect width="15" height="15" fill="#374151" opacity="0.3"/>
              <circle cx="3" cy="3" r="1" fill="#1f2937" opacity="0.5"/>
              <circle cx="12" cy="8" r="0.8" fill="#1f2937" opacity="0.4"/>
              <circle cx="7" cy="12" r="1.2" fill="#1f2937" opacity="0.6"/>
              <circle cx="15" cy="2" r="0.6" fill="#1f2937" opacity="0.3"/>
            </pattern>
          );
        case 'steel':
          return (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="10" height="10">
              <rect width="10" height="10" fill="#64748b" opacity="0.2"/>
              <line x1="0" y1="0" x2="10" y2="10" stroke="#475569" strokeWidth="0.5" opacity="0.4"/>
              <line x1="10" y1="0" x2="0" y2="10" stroke="#475569" strokeWidth="0.5" opacity="0.4"/>
            </pattern>
          );
        case 'carpet':
          return (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="6" height="6">
              <rect width="6" height="6" fill="#8b5cf6" opacity="0.3"/>
              <circle cx="3" cy="3" r="0.5" fill="#7c3aed" opacity="0.5"/>
              <circle cx="1" cy="1" r="0.3" fill="#7c3aed" opacity="0.4"/>
              <circle cx="5" cy="5" r="0.3" fill="#7c3aed" opacity="0.4"/>
            </pattern>
          );
        case 'vinyl':
          return (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="14" height="14">
              <rect width="14" height="14" fill="#10b981" opacity="0.3"/>
              <rect x="0" y="0" width="14" height="14" fill="none" stroke="#059669" strokeWidth="0.5" opacity="0.4"/>
              <line x1="7" y1="0" x2="7" y2="14" stroke="#059669" strokeWidth="0.3" opacity="0.3"/>
              <line x1="0" y1="7" x2="14" y2="7" stroke="#059669" strokeWidth="0.3" opacity="0.3"/>
            </pattern>
          );
        case 'stone':
          return (
            <pattern id={patternId} patternUnits="userSpaceOnUse" width="18" height="18">
              <rect width="18" height="18" fill="#6b7280" opacity="0.3"/>
              <path d="M0,0 L6,3 L12,0 L18,3 L18,9 L12,6 L6,9 L0,6 Z" fill="#4b5563" opacity="0.4"/>
              <path d="M0,9 L6,12 L12,9 L18,12 L18,18 L12,15 L6,18 L0,15 Z" fill="#374151" opacity="0.3"/>
            </pattern>
          );
        default:
          return null;
      }
    };
    
    const materialPattern = getMaterialPattern();
    
    return (
      <g key={object.id} transform={transform}>
        {/* Material pattern definition */}
        {materialPattern && (
          <defs>
            {materialPattern}
          </defs>
        )}
        
        {/* Slab fill */}
        <rect
          x={pos2d.x - width/2}
          y={pos2d.y - height/2}
          width={width}
          height={height}
          fill={materialPattern ? `url(#${object.material || 'concrete'}-${object.id})` : props.color}
          fillOpacity={0.7}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          {...createUnifiedElementHandlers(object)}
        />
        
        {/* Slab label (optional) */}
        {isSelected && (
          <text
            x={pos2d.x}
            y={pos2d.y}
            fill={strokeColor}
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
            className="pointer-events-none select-none"
          >
            {object.material || 'Slab'}
          </text>
        )}
      </g>
    );
  }, [viewportTheme, onObjectClick]);

  // Render architectural door in 2D with proper blueprint styling using Door2DRenderer
  const renderDoor2D = useCallback((object, pos2d, props, isSelected) => {
    console.log(`🚪 RENDER_DOOR2D CALLED: Object ${object?.id}, pos2d:`, pos2d, 'props:', props, 'isSelected:', isSelected);
    
    // Add null checks for required parameters
    if (!object || !pos2d || !props || typeof pos2d.x === 'undefined' || typeof pos2d.y === 'undefined') {
      console.warn('Door2D render: Missing required parameters', { object: !!object, pos2d, props: !!props });
      return null;
    }
    
    const strokeColor = isSelected 
      ? (viewportTheme === 'light' ? '#8b5cf6' : '#a855f7')
      : (viewportTheme === 'light' ? '#1f2937' : '#d1d5db');
    
    try {
      // Calculate viewport scale (px per mm) 
      // Adjust scale factor based on zoom level
      const px_per_mm = Math.max(0.01, zoom * 0.1);
      
      // Prepare door parameters for Door2DRenderer
      const door2DParams = {
        width_mm: (props.width || 0.9) * 1000, // Convert meters to mm
        wall_thickness_mm: (props.thickness || 0.1) * 1000, // Convert meters to mm
        hinge: props.openingDirection === 'left' ? 'left' : 'right',
        swing: 'in', // Default to inward swing
        angle_deg: 90, // Standard 90-degree opening
        px_per_mm: px_per_mm,
        stroke_px: isSelected ? 2 : 1
      };
      
      // Generate door SVG using Door2DRenderer
      const doorSVG = Door2DRenderer.makeDoor2DSVG(door2DParams);
      
      // Apply world positioning transform
      const rotation = props.rotation ? (props.rotation * 180 / Math.PI) : 0;
      const wrappedSVG = Door2DRenderer.wrapWithTransform(
        doorSVG, 
        pos2d.x, 
        pos2d.y, 
        rotation
      );
      
      return (
        <g 
          key={object.id}
          id={`door-${object.id}`}
          stroke={strokeColor}
          className="door-2d"
          {...createUnifiedElementHandlers(object)}
          dangerouslySetInnerHTML={{ 
            __html: wrappedSVG.replace('<g transform=', '<g transform=').replace(/^<g[^>]*>/, '').replace(/<\/g>$/, '')
          }}
        />
      );
    } catch (error) {
      console.warn('Door2DRenderer failed, using fallback door representation:', error);
      
      // Fallback: Simple door representation  
      const safeZoom = zoom || 1;
      const doorWidth = (props.width || 0.9) * safeZoom * 100; // Convert to pixels
      const wallThickness = (props.thickness || 0.1) * safeZoom * 100;
      const rotation = (props.rotation && typeof props.rotation === 'number') ? (props.rotation * 180 / Math.PI) : 0;
      const safeX = pos2d.x || 0;
      const safeY = pos2d.y || 0;
    
    return (
        <g 
          key={object.id || 'unknown-door'} 
          transform={rotation !== 0 ? `rotate(${rotation} ${safeX} ${safeY})` : ''}
          {...(createUnifiedElementHandlers ? createUnifiedElementHandlers(object) : {})}
        >
          {/* Simple door opening */}
        <rect
            x={safeX - doorWidth/2}
            y={safeY - wallThickness/2}
          width={doorWidth}
          height={wallThickness}
          fill="white"
            stroke={strokeColor}
            strokeWidth={isSelected ? 2 : 1}
          />
          {/* Door leaf line */}
        <line
            x1={safeX - doorWidth/2}
            y1={safeY}
            x2={safeX + doorWidth/2}
            y2={safeY}
            stroke={strokeColor}
            strokeWidth={isSelected ? 3 : 2}
          strokeLinecap="round"
        />
          {/* Simple swing arc */}
        <path
            d={`M ${safeX - doorWidth/2} ${safeY} 
                A ${doorWidth} ${doorWidth} 0 0 1 
                ${safeX + doorWidth/2} ${safeY}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1"
            strokeDasharray="2,2"
            opacity="0.5"
          />
      </g>
    );
    }
  }, [viewportTheme, zoom, createUnifiedElementHandlers]);

  // Render architectural stair in 2D with step indicators
  const renderStair2D = useCallback((object, pos2d, props, isSelected) => {
    const strokeColor = isSelected 
      ? (viewportTheme === 'light' ? '#8b5cf6' : '#a855f7')
      : (viewportTheme === 'light' ? '#1f2937' : '#d1d5db');
    const strokeWidth = isSelected ? 2 : 1;
    const fillColor = props.color;
    
    // Calculate step lines
    const numberOfSteps = props.numberOfSteps || 16;
    const stepLines = [];
    const stepSpacing = props.height / numberOfSteps;
    
    // Create step indicator lines
    for (let i = 1; i < numberOfSteps; i++) {
      const stepY = pos2d.y - props.height/2 + (i * stepSpacing);
      stepLines.push(
        <line
          key={`step-${i}`}
          x1={pos2d.x - props.width/2}
          y1={stepY}
          x2={pos2d.x + props.width/2}
          y2={stepY}
          stroke={strokeColor}
          strokeWidth={0.5}
          opacity={0.6}
        />
      );
    }
    
    // Calculate rotation
    const rotation = props.rotation ? (props.rotation * 180 / Math.PI) : 0;
    const transform = rotation !== 0 ? 
      `rotate(${rotation} ${pos2d.x} ${pos2d.y})` : '';
    
    return (
      <g
        key={`stair-${object.id}`}
        onClick={() => onObjectClick(object.id, object)}
        className="cursor-pointer"
        transform={transform}
      >
        {/* Main stair outline */}
        <rect
          x={pos2d.x - props.width/2}
          y={pos2d.y - props.height/2}
          width={props.width}
          height={props.height}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={0.7}
        />
        
        {/* Step indicator lines */}
        {stepLines}
        
        {/* Direction arrow (pointing up the stair flow) */}
        <polygon
          points={`${pos2d.x},${pos2d.y - props.height/4} ${pos2d.x - 4},${pos2d.y} ${pos2d.x + 4},${pos2d.y}`}
          fill={strokeColor}
          opacity={0.5}
        />
        
        {/* Stair label */}
        {isSelected && (
          <text
            x={pos2d.x}
            y={pos2d.y + props.height/2 + 15}
            textAnchor="middle"
            fontSize="10"
            fill={strokeColor}
            className="pointer-events-none select-none"
          >
            {numberOfSteps} Steps
          </text>
        )}
      </g>
    );
  }, [viewportTheme, onObjectClick]);

  // Render object as 2D shape
  const renderObject2D = useCallback((object) => {
    // SIMPLE DEBUG: Log every object being processed
    console.log(`🎨 RENDER_OBJECT2D: Processing ${object.id} (${object.type})`);
    
    console.log(`🎨 2D Viewport: Rendering object ${object.id} (${object.type}):`, {
      position: object.position,
      params: object.params,
      hasPosition: !!object.position,
      objectKeys: Object.keys(object)
    });
    
    // DOOR DEBUG: Extra logging for door objects
    if (object.type === 'door') {
      console.log(`🚪 DOOR RENDER DEBUG: Door object ${object.id}:`, {
        type: object.type,
        params: object.params,
        position: object.position,
        mesh3D_position: object.mesh3D?.position,
        allProperties: Object.keys(object)
      });
    }

    // Use adjusted position for walls with joinery, otherwise use original position
    // For door objects, use mesh3D.position if position is not available
    let renderPosition = object.position;
    if (!renderPosition && object.mesh3D?.position) {
      renderPosition = {
        x: object.mesh3D.position.x,
        y: object.mesh3D.position.y,
        z: object.mesh3D.position.z
      };
      console.warn(`🚪 Using mesh3D.position for door ${object.id}:`, renderPosition);
    }
    
    if (object.type === 'wall' && object.params?.adjustForJoinery) {
      const startPoint = object.params?.adjustedStartPoint || object.params?.startPoint;
      const endPoint = object.params?.adjustedEndPoint || object.params?.endPoint;
      
      if (startPoint && endPoint) {
        // Calculate adjusted center position
        renderPosition = {
          x: (startPoint.x + endPoint.x) / 2,
          y: (startPoint.y + endPoint.y) / 2, // Keep original Y
          z: (startPoint.z + endPoint.z) / 2
        };
        console.log(`🎯 Wall ${object.id} using adjusted center:`, renderPosition);
      }
    }
    
    const pos2d = to2D(renderPosition);
    const isSelected = selectedObjects.has(object.id);
    const scale = 100 * zoom; // Match the coordinate conversion scale
    
    // Rendering object in 2D viewport
    
    // Determine object dimensions and color based on type
    const getObjectProps = () => {
      switch (object.type) {
        case '2d-cad-block': {
          // Use SVG viewBox to compute default footprint, scale with zoom
          const vb = object.svgViewBox || { width: 100, height: 100 };
          const base = 1; // 1 meter default normalized unit
          const aspect = vb.width / Math.max(1, vb.height);
          const width = base * aspect * 100 * zoom;
          const height = base * 100 * zoom;
          return {
            width,
            height,
            shape: 'svg-block'
          };
        }
        case 'wall':
          // For walls, width = length, height = thickness for top-down view
          const wallLength = object.length || 4;
          const wallThickness = Math.max(0.2, object.thickness || 0.2); // Ensure minimum thickness
          
          // Calculate thickness with zoom-independent visibility
          const actualThicknessPx = wallThickness * scale; // Real thickness in pixels
          const constrainedThickness = Math.max(6, Math.min(actualThicknessPx, 50)); // Constrain between 6-50px
          
          // Wall thickness calculations complete
          
          return {
            width: wallLength * scale,
            height: constrainedThickness, // Zoom-stable thickness
            color: '#4a5568', // Darker sterilized gray to hide intersections
            shape: 'rect',
            rotation: object.rotation || 0
          };
        case 'slab':
          return {
            width: (object.width || 5) * scale,
            height: (object.depth || 5) * scale,
            color: object.materialColor || object.color || '#6b7280',
            shape: 'rect'
          };
        case 'door':
          const doorProps = {
            width: (object.width || 0.9) * scale,
            height: (object.thickness || 0.05) * scale,
            color: '#8b5a3c', // Wood brown color for doors
            shape: 'door',
            rotation: object.rotation || 0,
            openingDirection: object.params?.openingDirection || 'right'
          };
          console.log(`🚪 DOOR PROPS DEBUG: Object ${object.id} props:`, doorProps);
          return doorProps;
        case 'opening':
          return {
            width: (object.width || 1.0) * scale,
            height: (object.height || 0.1) * scale, // Thin representation for opening
            color: '#ef4444', // Red color to indicate opening
            shape: 'opening',
            rotation: object.rotation || 0,
            wallId: object.wallId
          };
        case 'furniture':
        case 'fixture':
          return {
            width: (object.width || 1) * scale,
            height: (object.depth || 1) * scale,
            color: object.materialColor || '#8B4513', // Brown for furniture
            shape: 'furniture',
            rotation: object.rotation || 0
          };
        case 'stair':
          // Stair top-view: shows footprint with step indicators
          // Use model-specific dimensions when available
          const stairWidth = (object.dimensions?.width || object.stepWidth || 1.2) * scale;
          const stairRun = (object.dimensions?.totalRun || object.totalRun || 4.0) * scale;
          const numberOfSteps = object.dimensions?.numberOfSteps || object.numberOfSteps || 16;
          
          console.log('🏗️ 2D STAIR RENDER: Object data:', {
            objectId: object.id,
            dimensions: object.dimensions,
            stepWidth: object.stepWidth,
            totalRun: object.totalRun,
            numberOfSteps: numberOfSteps,
            calculatedWidth: stairWidth,
            calculatedRun: stairRun
          });
          
          return {
            width: stairWidth,
            height: stairRun,
            color: object.material === 'wood' ? '#8B4513' : '#888888',
            shape: 'stair',
            rotation: object.rotation || 0,
            numberOfSteps: numberOfSteps,
            stairType: object.type || 'straight'
          };
        default:
          return {
            width: (object.width || 1) * scale,
            height: (object.depth || object.thickness || 1) * scale,
            color: object.materialColor || object.color || '#6b7280',
            shape: 'rect'
          };
      }
    };
    
    const props = getObjectProps();
    const strokeColor = isSelected 
      ? (viewportTheme === 'light' ? '#8b5cf6' : '#a855f7')
      : (viewportTheme === 'light' ? '#1f2937' : '#374151'); // Darker stroke for sterilized look
    const strokeWidth = isSelected ? 3 : 1.5; // Slightly thicker for definition
    
    // DOOR DEBUG: Log shape check
    if (object.type === 'door') {
      console.log(`🚪 DOOR SHAPE CHECK: Object ${object.id}, props.shape:`, props.shape, 'object.type:', object.type);
    }
    
    if (props.shape === 'door') {
      console.log(`🚪 DOOR SHAPE MATCH: Calling renderDoor2D for object ${object.id}`);
      // Render professional door with frame, leaf, and swing arc
      return renderDoor2D(object, pos2d, props, isSelected);
    }
    
    if (props.shape === 'opening') {
      // Render opening as a dashed red rectangle to show gap in wall
      return (
        <rect
          key={`opening-${object.id}`}
          x={pos2d.x - props.width / 2}
          y={pos2d.y - props.height / 2}
          width={props.width}
          height={props.height}
          fill="none"
          stroke={props.color}
          strokeWidth="2"
          strokeDasharray="5,3"
          transform={`rotate(${props.rotation} ${pos2d.x} ${pos2d.y})`}
          className={`opening ${isSelected ? 'selected' : ''}`}
        />
      );
    }
    
    if (props.shape === 'stair') {
      // Render stair top-view with step indicators
      return renderStair2D(object, pos2d, props, isSelected);
    }
    
    if (object.type === 'slab') {
      console.log(`🏗️ SLAB RENDER DEBUG: Found slab object ${object.id}, calling renderSlab2D`);
      console.log(`🏗️ SLAB RENDER DEBUG: Slab props:`, props);
      console.log(`🏗️ SLAB RENDER DEBUG: Slab pos2d:`, pos2d);
      console.log(`🏗️ SLAB RENDER DEBUG: Slab isSelected:`, isSelected);
      
      // Render slab with dedicated function for proper styling
      const renderedSlab = renderSlab2D(object, pos2d, props, isSelected);
      console.log(`🏗️ SLAB RENDER DEBUG: renderSlab2D result:`, renderedSlab);
      return renderedSlab;
    }
    
    if (props.shape === 'svg-block') {
      // Render raw SVG content centered at position
      const transform = `translate(${pos2d.x}, ${pos2d.y})`;
      // Wrap content so it can be scaled uniformly; initial scale 1 maps to viewBox
      return (
        <g key={object.id} transform={transform} {...createUnifiedElementHandlers(object)}>
          <g transform={`translate(${- (props.width/2)}, ${- (props.height/2)})`}>
            <g dangerouslySetInnerHTML={{ __html: (object.svgContent || '').replace(/<\/?svg[^>]*>/g, '') }} />
          </g>
        </g>
      );
    }

    if (props.shape === 'rect') {
      // Calculate rotation for walls
      const rotation = props.rotation ? (props.rotation * 180 / Math.PI) : 0;
      const transform = rotation !== 0 ? 
        `rotate(${rotation} ${pos2d.x} ${pos2d.y})` : '';
      
      // Check if this is a wall object - use CAD Engine mesh2D for perfect synchronization
      const isWall = object.type === 'wall' || object.type === 'Wall';
      
      if (isWall) {
        // Use CAD Engine's mesh2D directly for 100% synchronization
        const cadEngineRender = renderCADEngineMesh2D(object);
        if (cadEngineRender) {
          console.log(`✅ Using CAD Engine mesh2D for wall ${object.id}`);
          return cadEngineRender;
        } else {
          console.warn(`⚠️ Falling back to custom rendering for wall ${object.id} - missing mesh2D`);
          return renderArchitecturalWall(object, pos2d, props, isSelected, transform);
        }
      }
      
      return (
        <g key={object.id}>
          {/* Scale/transform handles for 2D CAD block selection */}
          {object.type === '2d-cad-block' && selectedObjects.has(object.id) && (() => {
            const bboxPadding = 10;
            const pos = to2D(object.position);
            const w = (object.svgViewBox?.width || 100) * zoom;
            const h = (object.svgViewBox?.height || 100) * zoom;
            const x = pos.x - w/2 - bboxPadding;
            const y = pos.y - h/2 - bboxPadding;
            const bw = w + bboxPadding*2;
            const bh = h + bboxPadding*2;
            return (
              <g key={`${object.id}-handles`}>
                <rect x={x} y={y} width={bw} height={bh} fill="none" stroke="#22d3ee" strokeDasharray="6,3" strokeWidth={1.5} />
                {/* Simple bottom-right scale handle */}
                <rect x={x + bw - 8} y={y + bh - 8} width={8} height={8} fill="#22d3ee" />
              </g>
            );
          })()}
          <rect
            x={pos2d.x - props.width/2}
            y={pos2d.y - props.height/2}
            width={props.width}
            height={props.height}
            fill={props.color}
            fillOpacity={isSelected ? 0.8 : 0.6}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            transform={transform}
            {...createUnifiedElementHandlers(object)}
          />
          
          {/* Object label - removed per user request */}
        </g>
      );
    }
    
    return null;
  }, [to2D, selectedObjects, zoom, viewportTheme, onObjectClick, renderDoor2D, renderSlab2D]);

  // Render wall edge highlights for hover/selection mode
  const renderWallEdgeHighlights = useCallback(() => {
    if (!wallSelectionMode || nearbyEdges.length === 0) return null;
    
    // Skip edge highlighting for door tool (it has its own preview)
    if (selectedTool === 'door') return null;
    
    const highlights = [];
    
    nearbyEdges.forEach((edgeInfo, index) => {
      try {
      const edge = edgeInfo.edge;
      const isClosest = index === 0; // First edge is closest
        
        // Validate edge has required properties
        if (!edge || !edge.startPoint || !edge.endPoint ||
            typeof edge.startPoint.x !== 'number' || typeof edge.startPoint.y !== 'number' ||
            typeof edge.endPoint.x !== 'number' || typeof edge.endPoint.y !== 'number') {
          console.warn('🚪 Invalid edge object in nearbyEdges:', { edge, edgeInfo });
          return; // Skip this edge
        }
      
      // Convert edge points to 2D
      const start2D = to2D({ x: edge.startPoint.x, y: 0, z: edge.startPoint.y });
      const end2D = to2D({ x: edge.endPoint.x, y: 0, z: edge.endPoint.y });
      
      // Validate to2D results
      if (!start2D || !end2D || typeof start2D.y !== 'number' || typeof end2D.y !== 'number') {
        console.warn('🚪 Invalid to2D result for edge:', { start2D, end2D });
        return; // Skip this edge
      }
      
      const highlightColor = isClosest ? '#10b981' : '#3b82f6';
      const highlightWidth = isClosest ? 4 : 2;
      const opacity = isClosest ? 0.8 : 0.4;
      
      highlights.push(
        <line
          key={`edge-highlight-${edgeInfo.wallId}-${edge.edgeType}`}
          x1={start2D.x}
          y1={start2D.y}
          x2={end2D.x}
          y2={end2D.y}
          stroke={highlightColor}
          strokeWidth={highlightWidth}
          opacity={opacity}
          strokeDasharray={isClosest ? "none" : "5,5"}
          className="pointer-events-none"
        />
      );
      } catch (error) {
        console.error('🚪 Error rendering edge highlight:', error, { edgeInfo, index });
        return null; // Skip this edge on error
      }
    });
    
    return <g className="wall-edge-highlights">{highlights}</g>;
  }, [wallSelectionMode, nearbyEdges, to2D]);

  // Render object placement preview on wall
  const renderWallPlacementPreview = useCallback(() => {
    if (!wallSelectionMode || !hoveredWallEdge || !selectedTool) return null;
    
    const objectDimensions = {
      door: { width: 0.9, height: 2.1, color: '#8B4513' },
      window: { width: 1.2, height: 1.4, color: '#87CEEB' }
    };
    
    const dims = objectDimensions[selectedTool];
    if (!dims) return null;
    
    // Get placement position
    const edge = hoveredWallEdge.edge;
    if (!edge || typeof edge.getPlacementPoint !== 'function') {
      console.warn('Invalid edge object in renderWallPlacementPreview:', edge);
      return null;
    }
    
    const placementPoint = edge.getPlacementPoint(hoveredWallEdge.projectionRatio);
    const pos2D = to2D({ x: placementPoint.x, y: 0, z: placementPoint.y });
    
    // Calculate object size in screen space
    const objWidth = dims.width * 100 * zoom;
    const objHeight = 8; // Fixed height in screen space for visibility
    
    // Calculate rotation based on wall direction - use edge.angle instead of edge.direction
    const wallAngle = (edge.angle || 0) * 180 / Math.PI;
    
    return (
      <g className="placement-preview">
        {/* Preview rectangle */}
        <rect
          x={pos2D.x - objWidth/2}
          y={pos2D.y - objHeight/2}
          width={objWidth}
          height={objHeight}
          fill={dims.color}
          fillOpacity="0.5"
          stroke="#ffffff"
          strokeWidth="2"
          strokeDasharray="4,4"
          transform={`rotate(${wallAngle} ${pos2D.x} ${pos2D.y})`}
        />
        
        {/* Center indicator */}
        <circle
          cx={pos2D.x}
          cy={pos2D.y}
          r="4"
          fill="#10b981"
          stroke="#ffffff"
          strokeWidth="2"
        />
        
        {/* Dimension label */}
        <text
          x={pos2D.x}
          y={pos2D.y - objHeight/2 - 12}
          fill="#10b981"
          fontSize="11"
          fontWeight="bold"
          textAnchor="middle"
          className="pointer-events-none select-none"
        >
          {selectedTool} ({dims.width}m)
        </text>
      </g>
    );
  }, [wallSelectionMode, hoveredWallEdge, selectedTool, to2D, zoom]);

  // Render continuous wall drawing preview
  const renderContinuousWallPreview = useCallback(() => {
    if (!drawingPoints.length || !currentPreviewEnd) return null;

    const previewColor = viewportTheme === 'light' ? '#3b82f6' : '#60a5fa';
    const textColor = viewportTheme === 'light' ? '#1e40af' : '#93c5fd';
    
    // Create a complete sequence including the current preview segment
    const completeSequence = [...drawingPoints, currentPreviewEnd];
    
    const elements = [];
    
    // Render all wall segments in the sequence
    for (let i = 0; i < completeSequence.length - 1; i++) {
      const startPoint = completeSequence[i];
      const endPoint = completeSequence[i + 1];
      const start2D = to2D(startPoint);
      const end2D = to2D(endPoint);
      
      const deltaX = end2D.x - start2D.x;
      const deltaY = end2D.y - start2D.y;
      const wallLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (wallLength > 1) { // Only render if segment is long enough
        const midX = (start2D.x + end2D.x) / 2;
        const midY = (start2D.y + end2D.y) / 2;
        
        // Calculate wall thickness with zoom-independent visibility
        const actualThickness = 0.2 * 100 * zoom;
        const wallThickness = Math.max(8, Math.min(actualThickness, 40));
        
        // Calculate wall angle for rotation
        const wallAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        
                 const isCurrentSegment = i === completeSequence.length - 2;
         const segmentOpacity = isCurrentSegment ? 0.5 : 0.7;
         const segmentColor = isCurrentSegment ? '#10b981' : previewColor;
        
        elements.push(
          <g key={`wall-preview-${i}`}>
            {/* Wall thickness rectangle */}
            <rect
              x={midX - wallLength / 2}
              y={midY - wallThickness / 2}
              width={wallLength}
              height={wallThickness}
              fill={segmentColor}
              stroke="#ffffff"
              strokeWidth="2"
              opacity={segmentOpacity}
              transform={`rotate(${wallAngle} ${midX} ${midY})`}
            />
            
            {/* Center line */}
            <line
              x1={start2D.x}
              y1={start2D.y}
              x2={end2D.x}
              y2={end2D.y}
              stroke="#ffffff"
              strokeWidth="1"
              strokeDasharray="4,2"
              opacity="0.6"
            />
            
            {/* Length label for current segment */}
            {isCurrentSegment && (
              <text
                x={midX}
                y={midY - wallThickness/2 - 8}
                fill={textColor}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                className="pointer-events-none select-none"
              >
                {(wallLength / (100 * zoom)).toFixed(2)}m
              </text>
            )}
            
            {/* Sequence number */}
            <circle
              cx={start2D.x}
              cy={start2D.y}
              r="6"
              fill={segmentColor}
              stroke="#ffffff"
              strokeWidth="2"
              opacity="0.9"
            />
            <text
              x={start2D.x}
              y={start2D.y + 1}
              fill="white"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              className="pointer-events-none select-none"
            >
              {i + 1}
            </text>
          </g>
        );
      }
    }
    
    // Show connection points
    completeSequence.forEach((point, index) => {
      const pos2D = to2D(point);
      const isEndPoint = index === completeSequence.length - 1;
      elements.push(
        <circle
          key={`point-${index}`}
          cx={pos2D.x}
          cy={pos2D.y}
          r="4"
          fill={isEndPoint ? '#10b981' : '#ef4444'}
          stroke="#ffffff"
          strokeWidth="2"
          opacity="0.9"
        />
      );
    });
    
    return <g key="continuous-wall-preview">{elements}</g>;
  }, [drawingPoints, currentPreviewEnd, viewportTheme, to2D, zoom]);

  /**
 * Render individual Three.js mesh geometry as SVG elements
 */
const renderMesh2DGeometry = useCallback((object, mesh, pos2d, rotation, index) => {
  const geometry = mesh.geometry;
  const material = mesh.material;

  // Get dimensions based on geometry type
  let width, height;
  
  if (geometry.type === 'BufferGeometry') {
    // Calculate bounding box to get dimensions
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    
    const bbox = geometry.boundingBox;
    width = (bbox.max.x - bbox.min.x) * 100 * zoom; // Convert to pixels
    
    // For 2D top-down view, use Y dimension for height (wall thickness)
    // If Y dimension is also 0, fall back to default wall thickness
    const bboxHeight = bbox.max.y - bbox.min.y;
    if (bboxHeight > 0) {
      height = bboxHeight * 100 * zoom;
    } else {
      // Fallback to standard wall thickness (0.2m = 20cm)
      height = 0.2 * 100 * zoom;
      console.log(`⚠️ Using fallback thickness for ${object.id}: ${height}px`);
    }
    
    console.log(`🎨 BufferGeometry for ${object.id}:`, {
      bbox: bbox,
      width: width,
      height: height,
      bboxHeight: bboxHeight,
      zoom: zoom,
      usingFallback: bboxHeight <= 0
    });
  } else if (geometry.type === 'PlaneGeometry') {
    width = geometry.parameters.width * 100 * zoom; // Convert to pixels
    height = geometry.parameters.height * 100 * zoom;
  } else {
    // Handle other geometry types as needed
    console.log(`⚠️ Unhandled geometry type: ${geometry.type} for object ${object.id}`);
    return null;
  }

  // Get color from material - Sterilized professional look
  let fillColor = '#4a5568'; // Darker gray to hide corner intersections
  let strokeColor = '#1f2937'; // Dark charcoal/black for sharp outlines
  let fillOpacity = 0.9; // Opaque but softer appearance
  let strokeWidth = 1.5; // Slightly thicker outline for definition

  if (material) {
    console.log(`🎨 Material for ${object.id}:`, {
      type: material.type,
      color: material.color,
      opacity: material.opacity,
      hasColor: !!material.color,
      colorConstructor: material.color?.constructor?.name,
      colorR: material.color?.r,
      colorG: material.color?.g,
      colorB: material.color?.b
    });

    if (material.color) {
      const color = material.color;
      console.log(`🔍 Detailed color analysis for ${object.id}:`, {
        colorObject: color,
        keys: Object.keys(color),
        r: color.r,
        g: color.g,
        b: color.b,
        isThreeColor: color.isColor,
        hasGetHex: typeof color.getHex === 'function',
        hasGetHexString: typeof color.getHexString === 'function'
      });
      
      // Handle Three.js Color objects
      if (color.isColor || color.constructor?.name === 'Color') {
        if (typeof color.getHex === 'function') {
          // Use getHex() method for Three.js Color
          const hex = color.getHex();
          fillColor = `#${hex.toString(16).padStart(6, '0')}`;
          console.log(`✅ Using Three.js getHex(): ${fillColor}`);
        } else if (color.r !== undefined && color.g !== undefined && color.b !== undefined) {
          // Fallback to direct RGB access
          fillColor = `rgb(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)})`;
          console.log(`✅ Using direct RGB access: ${fillColor}`);
        }
      } 
      // Handle regular color objects with r,g,b properties
      else if (typeof color === 'object' && color.r !== undefined) {
        fillColor = `rgb(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)})`;
        console.log(`✅ Using object RGB: ${fillColor}`);
      } 
      // Handle string colors
      else if (typeof color === 'string') {
        fillColor = color;
        console.log(`✅ Using string color: ${fillColor}`);
      } 
      // Handle numeric colors
      else if (typeof color === 'number') {
        fillColor = `#${color.toString(16).padStart(6, '0')}`;
        console.log(`✅ Using numeric color: ${fillColor}`);
      }
      
      // If we still have black or very dark color, use sterilized default
      if (fillColor === 'rgb(0, 0, 0)' || fillColor === '#000000' || fillColor === '#000') {
        fillColor = '#4a5568'; // Darker sterilized gray fallback
        console.log(`⚠️ Detected black color, using sterilized fallback: ${fillColor}`);
      }
      
      // Override: Always use sterilized black outline for walls regardless of material
      if (object.type === 'wall' || object.type === 'Wall') {
        strokeColor = '#1f2937'; // Sterilized dark charcoal/black outline
        fillColor = '#4a5568';   // Darker sterilized gray fill to hide intersections
        console.log(`🎯 Applied sterilized wall styling for ${object.id}`);
      } else {
        // Use material-based stroke for non-walls
        strokeColor = fillColor;
      }
    }
    
    if (material.opacity !== undefined) {
      fillOpacity = Math.max(0.3, material.opacity); // Ensure minimum visibility
    }
  } else {
    console.log(`⚠️ No material found for ${object.id}, using default colors`);
  }

  console.log(`🎨 Final colors for ${object.id}:`, {
    fillColor,
    strokeColor,
    fillOpacity,
    strokeWidth
  });

  // Apply selection and hover states
  const isSelected = selectedObjects.has(object.id);
  const isHovered = hoveredWalls.has(object.id);
  const isSelectable = selectableWalls.has(object.id);
  const hasNearbyEdge = nearbyEdges.some(edge => edge.wallId === object.id);

  // Enhanced visual states
  if (isSelected) {
    strokeColor = '#8b5cf6';
    strokeWidth = 3;
    fillOpacity = Math.min(0.4, fillOpacity + 0.2);
  } else if (hasNearbyEdge) {
    strokeColor = '#10b981';
    strokeWidth = 2.5;
    fillOpacity = Math.min(0.35, fillOpacity + 0.15);
  } else if (isHovered) {
    strokeColor = '#3b82f6';
    strokeWidth = 2;
    fillOpacity = Math.min(0.3, fillOpacity + 0.1);
  } else if (isSelectable) {
    // Keep sterilized colors for selectable walls
    if (object.type === 'wall' || object.type === 'Wall') {
      strokeColor = '#1f2937'; // Maintain sterilized outline
    } else {
      strokeColor = '#6b7280';
    }
    fillOpacity = Math.min(0.25, fillOpacity + 0.05);
  }

  // Calculate transform for rotation
  const transform = rotation !== 0 
    ? `translate(${pos2d.x}, ${pos2d.y}) rotate(${rotation * 180 / Math.PI}) translate(${-pos2d.x}, ${-pos2d.y})`
    : '';

  return (
    <g key={`mesh-geometry-${object.id}-${index}`}>
      {/* Fill without stroke to avoid overlapping borders */}
    <rect
      x={pos2d.x - width / 2}
      y={pos2d.y - height / 2}
      width={width}
      height={height}
      fill={fillColor}
      fillOpacity={fillOpacity}
        stroke="none"
      transform={transform}
      {...createUnifiedElementHandlers(object)}
    />
      {/* Separate stroke path for clean corners */}
      <rect
        x={pos2d.x - width / 2}
        y={pos2d.y - height / 2}
        width={width}
        height={height}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="miter"
        strokeLinecap="square"
        transform={transform}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}, [zoom, selectedObjects, hoveredWalls, selectableWalls, nearbyEdges, onObjectClick]);

/**
 * Render CAD Engine's mesh2D objects directly in 2D SVG
 * This ensures 100% synchronization with the CAD engine's calculated geometry
 */
const renderCADEngineMesh2D = useCallback((object) => {
  if (!object.mesh2D) {
    console.warn(`Object ${object.id} missing mesh2D data`);
    return null;
  }

  // Get the CAD engine's mesh2D object
  const mesh2D = object.mesh2D;
  const meshPosition = mesh2D.position;
  const meshRotation = mesh2D.rotation;

  // Convert 3D mesh position to 2D screen coordinates
  const pos2d = to2D(meshPosition);

  console.log(`🎨 Rendering CAD Engine mesh2D for ${object.id}:`, {
    meshPosition,
    meshRotation,
    pos2d,
    meshType: mesh2D.type,
    hasChildren: mesh2D.children?.length > 0
  });

  // Handle Three.js Group objects (walls use groups with multiple elements)
  if (mesh2D.type === 'Group' && mesh2D.children) {
    return (
      <g key={`mesh2d-${object.id}`}>
        {mesh2D.children.map((child, index) => {
          if (child.type === 'Mesh' && child.geometry) {
            return renderMesh2DGeometry(object, child, pos2d, meshRotation.z, index);
          }
          return null;
        })}
      </g>
    );
  }

  // Handle single mesh objects
  if (mesh2D.type === 'Mesh' && mesh2D.geometry) {
    return renderMesh2DGeometry(object, mesh2D, pos2d, meshRotation.z, 0);
  }

  return null;
}, [to2D, renderMesh2DGeometry]);

  // Door/Window apertures invalidation (declare BEFORE hooks that depend on it)
  const [apertureTick, setApertureTick] = useState(0);
  useEffect(() => {
    const onApertures = () => setApertureTick(t => (t + 1) % 1e9);
    document.addEventListener('wall:aperturesChanged', onApertures);
    return () => document.removeEventListener('wall:aperturesChanged', onApertures);
  }, []);

  // 🏗️ ARCHITECT3D: Render architect3d walls and corners (disabled - skylight tool removed)
  const renderArchitect3DWalls = useCallback(() => {
    // This function was previously used for skylight tool which has been removed
    // Keeping function for backward compatibility but returning empty array
    return [];
  }, []);

  // 🏗️ ARCHITECT3D: Render wall preview
  const [architect3DPreviewData, setArchitect3DPreviewData] = useState(null);
  const [previewTick, setPreviewTick] = useState(0);
  const lastArchitect3DWorldPosRef = useRef(null);
  
  // Listen to architect3d preview events
  useEffect(() => {
    if (!architect3DService) return;
    
    const handlePreview = (data) => setArchitect3DPreviewData(data);
    // Expose service globally so the 3D viewport can subscribe (temporary bridge)
    if (typeof window !== 'undefined') {
      window.__architect3DService = architect3DService;
    }
    const triggerRerender = () => setArchitect3DPreviewData(prev => ({ ...(prev || {}), _v: (prev?._v || 0) + 1 }));
    architect3DService.addEventListener('wallPreview', handlePreview);
    architect3DService.addEventListener('wallDrawingStarted', triggerRerender);
    architect3DService.addEventListener('wallDrawingCompleted', triggerRerender);
    architect3DService.addEventListener('wallAdded', triggerRerender);
    
    return () => {
      architect3DService.removeEventListener('wallPreview', handlePreview);
      architect3DService.removeEventListener('wallDrawingStarted', triggerRerender);
      architect3DService.removeEventListener('wallDrawingCompleted', triggerRerender);
      architect3DService.removeEventListener('wallAdded', triggerRerender);
    };
  }, [architect3DService]);

  // Small timer to animate preview even without mouse movement
  useEffect(() => {
    if (!architect3DPreviewData) return;
    const id = setInterval(() => setPreviewTick(t => (t + 1) % 1e9), 120);
    return () => clearInterval(id);
  }, [architect3DPreviewData]);

  const renderArchitect3DPreview = useCallback(() => {
    // If no event-driven preview, synthesize from the last known mouse position
    const data = (architect3DPreviewData && architect3DPreviewData.isValid)
      ? architect3DPreviewData
      : (architect3DService && architect3DService.currentDrawingWall && lastArchitect3DWorldPosRef.current
          ? { start: architect3DService.currentDrawingWall.startPoint, end: lastArchitect3DWorldPosRef.current, isValid: true }
          : null);
    if (!architect3DService || !data || !data.start || !data.end) return null;
    
    // Validate start and end points have required properties
    if (typeof data.start.x !== 'number' || typeof data.start.y !== 'number' ||
        typeof data.end.x !== 'number' || typeof data.end.y !== 'number') {
      console.warn('🏗️ Architect3D preview: Invalid start/end coordinates', data);
      return null;
    }
    
    const startPos2d = to2D({ x: data.start.x, y: 0, z: data.start.y });
    const endPos2d = to2D({ x: data.end.x, y: 0, z: data.end.y });
    
    // Validate to2D results
    if (!startPos2d || !endPos2d || 
        typeof startPos2d.x !== 'number' || typeof startPos2d.y !== 'number' ||
        typeof endPos2d.x !== 'number' || typeof endPos2d.y !== 'number') {
      console.warn('🏗️ Architect3D preview: Invalid 2D position from to2D conversion');
      return null;
    }
    const dx = endPos2d.x - startPos2d.x;
    const dy = endPos2d.y - startPos2d.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const thicknessPx = (Math.max(data.thickness || 0.2, 0.1)) * 100 * zoom;
    const cx = (startPos2d.x + endPos2d.x) / 2;
    const cy = (startPos2d.y + endPos2d.y) / 2;
    const snapColor = data.snapped ? (theme === 'dark' ? '#22c55e' : '#16a34a') : (theme === 'dark' ? '#fbbf24' : '#f59e0b');
    const guides = Array.isArray(data.guides) ? data.guides : [];

    // Dev: minimal runtime log
    if (typeof window !== 'undefined' && (window.A3D_DEBUG || A3D_DEBUG)) {
      console.log('A3D_PREVIEW', { start: data.start, end: data.end, snapped: !!data.snapped, guides: guides.length });
    }
    
    return (
      <g className="architect3d-wall-preview">
        {guides.map((g, i) => {
          if (!g) return null;
          
          if (g.vertical && typeof g.x === 'number' && data.start && typeof data.start.y === 'number') {
            const x = to2D({ x: g.x, y: 0, z: data.start.y }).x;
            return <line key={`gv-${i}`} x1={x} y1={-10000} x2={x} y2={10000} stroke="#60a5fa" strokeDasharray="4,4" opacity="0.35" />;
          }
          if (g.horizontal && typeof g.y === 'number' && data.start && typeof data.start.x === 'number') {
            const y = to2D({ x: data.start.x, y: 0, z: g.y }).y;
            return <line key={`gh-${i}`} x1={-10000} y1={y} x2={10000} y2={y} stroke="#60a5fa" strokeDasharray="4,4" opacity="0.35" />;
          }
          return null;
        })}
      <line
        x1={startPos2d.x}
        y1={startPos2d.y}
        x2={endPos2d.x}
        y2={endPos2d.y}
          stroke={snapColor}
          strokeWidth="2"
          strokeDasharray="10,8"
          style={{ strokeDashoffset: (Date.now()/60)%18 }}
          opacity="0.9"
        />
        <g transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
          <rect x={-len/2} y={-thicknessPx/2} width={len} height={thicknessPx} fill="#4a5568" opacity="0.5" />
          <rect x={-len/2} y={-thicknessPx/2} width={Math.max(6, (len*((Date.now()/500)%1)))} height={thicknessPx} fill={snapColor} opacity="0.2" />
        </g>
      </g>
    );
  }, [architect3DService, to2D, theme, architect3DPreviewData, zoom, previewTick]);

  return (
    <div 
      className={`cad-2d-viewport relative w-full h-full ${className}`}
      style={style}
    >
      <svg 
        ref={svgRef}
        className="w-full h-full cursor-crosshair"
        style={{ 
          background: viewportTheme === 'light' ? '#f8fafc' : '#1e293b'
        }}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid lines */}
        <defs>
          {(() => {
            const scale = 100 * zoom; // px per meter (shared with to2D/to3D)
            const gridSizePx = 1 * scale; // 1m grid
            // Offset so grid feels "stationary" relative to world origin as we pan/zoom
            const offsetX = ((400 - (viewCenter.x * scale)) % gridSizePx + gridSizePx) % gridSizePx;
            const offsetY = ((300 - (viewCenter.y * scale)) % gridSizePx + gridSizePx) % gridSizePx;
            return (
          <pattern
            id="grid"
                x={-offsetX}
                y={-offsetY}
                width={gridSizePx}
                height={gridSizePx}
            patternUnits="userSpaceOnUse"
          >
            <path
                  d={`M ${gridSizePx} 0 L 0 0 0 ${gridSizePx}`}
              fill="none"
              stroke={viewportTheme === 'light' ? '#e5e7eb' : '#374151'}
              strokeWidth="1"
            />
          </pattern>
            );
          })()}
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        
        {/* CAD Objects */}
        {(() => {
          try {
          // Only log when there are actually objects to render  
          if (objects.length > 0) {
            console.warn(`🗂️ 2D Viewport: Rendering ${objects.length} objects`);
            console.warn(`🗂️ OBJECTS TYPES:`, objects.map(obj => ({ id: obj.id, type: obj.type })));
          }
          
          // Make objects available globally for debugging
          window.debugObjects = objects;
          
            // Separate objects by type for proper rendering order
            const slabs = objects.filter(obj => obj && obj.type === 'slab');
            const walls = objects.filter(obj => obj && obj.type === 'wall' && obj.params);
            const nonWalls = objects.filter(obj => obj && obj.type !== 'wall' && obj.type !== 'slab');
            
            // DEBUG: Check if doors are in the objects array
            const doors = objects.filter(obj => obj && obj.type === 'door');
            if (doors.length > 0) {
              console.warn(`🚪 OBJECTS DEBUG: Found ${doors.length} doors in objects array:`, doors.map(d => ({ id: d.id, type: d.type, hasPosition: !!d.position, position: d.position })));
              console.warn(`🚪 OBJECTS DEBUG: NonWalls count: ${nonWalls.length}, includes doors:`, nonWalls.filter(obj => obj.type === 'door').length);
              console.warn(`🚪 OBJECTS DEBUG: Door objects full data:`, doors);
            }
            // Only log slab details if there are slabs
            if (slabs.length > 0) {
              console.log(`🏗️ Found ${slabs.length} slabs, ${walls.length} walls, ${nonWalls.length} other objects`);
            }
            
            // Validate wall objects before processing
            const validWalls = walls.filter(wall => {
              if (!wall.params) {
                console.warn(`🚪 Wall ${wall.id} missing params`);
                return false;
              }
              
              const startPoint = wall.params.adjustedStartPoint || wall.params.startPoint;
              const endPoint = wall.params.adjustedEndPoint || wall.params.endPoint;
              
              if (!startPoint || !endPoint || 
                  typeof startPoint.x !== 'number' || typeof startPoint.z !== 'number' ||
                  typeof endPoint.x !== 'number' || typeof endPoint.z !== 'number') {
                console.warn(`🚪 Wall ${wall.id} has invalid coordinates:`, { startPoint, endPoint });
                return false;
              }
              
              return true;
            });
            
            // Only log if there are walls
            if (validWalls.length > 0) {
              console.log(`🧱 ${validWalls.length} walls rendered`);
            }
          
            // Create professional wall joinery with miter joints
            const wallJoineryGroups = createProfessionalWallPaths(validWalls);
          
            const renderedWalls = renderProfessionalWallJoinery(wallJoineryGroups) || [];
            const renderedSlabs = slabs.map(object => {
              try {
                console.log(`🏗️ Rendering slab ${object.id} at bottom layer:`, {
                  position: object.position,
                  params: object.params,
                  type: object.type
                });
                return renderObject2D(object);
              } catch (err) {
                console.error(`🏗️ Error rendering slab ${object.id}:`, err);
                return null;
              }
            }).filter(Boolean);
            const renderedNonWalls = nonWalls.map(object => {
              try {
                return renderObject2D(object);
              } catch (err) {
                console.error(`🚪 Error rendering object ${object.id}:`, err);
                return null;
              }
            }).filter(Boolean);
          
            return [
              // Render slabs FIRST (bottom layer)
              ...renderedSlabs,
              // Render unified wall paths with clean corners
              ...renderedWalls,
              // Render non-wall objects last (top layer)
              ...renderedNonWalls
            ];
          } catch (error) {
            console.error('🚪 CRITICAL ERROR in object rendering:', error);
            console.error('🚪 Objects causing error:', objects);
            return [<text key="error" x="10" y="30" fill="red">Error rendering objects - check console</text>];
          }
        })()}
        
        {/* Snap indicators for wall endpoints */}
        {renderSnapIndicators()}
        
        {/* Wall edge highlights for door/window placement */}
        {renderWallEdgeHighlights()}
        
        {/* Wall placement preview for doors/windows - DISABLED, using door-specific preview instead */}
        {/* {renderWallPlacementPreview()} */}
        
        {/* Connection indicators are now handled in the continuous preview */}
        
        {/* Draft preview */}
        {renderDraftPreview()}
        
        {/* 🏗️ ARCHITECT3D: Render architect3d walls and corners */}
        {renderArchitect3DWalls()}
        
        {/* 🏗️ ARCHITECT3D: Render wall preview */}
        {renderArchitect3DPreview()}
        
        {/* Professional door placement preview */}
        {renderDoorPlacementPreview()}
        
        {/* 2D CAD Block Ghost Preview */}
        {pendingCADBlock && cadBlockGhostContent && (
          <g
            pointerEvents="none"
            opacity="0.7"
            transform={`translate(${cadBlockCursorPos.x.toFixed(2)}, ${cadBlockCursorPos.y.toFixed(2)})`}
            dangerouslySetInnerHTML={{ __html: cadBlockGhostContent }}
          />
        )}
      </svg>
      
      {/* Viewport overlay info */}
      <div className="absolute top-2 left-2 pointer-events-none">
        <div className={`px-2 py-1 rounded text-xs font-mono ${
          viewportTheme === 'dark' 
            ? 'bg-black/70 text-blue-400' 
            : 'bg-white/90 text-blue-600'
        }`}>
          2D Plan View - {currentFloor === 'ground' ? 'Ground Floor' : 
                         currentFloor === 'first' ? 'First Floor' : 
                         currentFloor.replace('floor', 'Floor ')}
        </div>
      </div>
      
      {/* Scale indicator */}
      <div className="absolute top-2 right-2 pointer-events-none">
        <div className={`px-2 py-1 rounded text-xs font-mono ${
          viewportTheme === 'dark' 
            ? 'bg-black/70 text-gray-400' 
            : 'bg-white/90 text-gray-600'
        }`}>
          1:{Math.round(1/zoom)} • {zoom.toFixed(2)}x
        </div>
      </div>

      {/* Continuous Drawing UI */}
      {isContinuousDrawing && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="flex flex-col items-center space-y-3">
            {/* Status indicator */}
            <div className={`px-4 py-2 rounded-xl backdrop-blur-md border transition-all duration-300 ${
              viewportTheme === 'dark'
                ? 'bg-slate-900/80 border-slate-700/60 text-white'
                : 'bg-white/80 border-white/60 text-gray-900'
            }`} style={{ 
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(16px)'
            }}>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">
                  Drawing Room • {Math.max(0, drawingPoints.length - 1)} segment{Math.max(0, drawingPoints.length - 1) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Done button */}
            <button
              onClick={finishContinuousDrawing}
              className={`px-6 py-3 rounded-xl backdrop-blur-md border transition-all duration-200 pointer-events-auto transform hover:scale-105 active:scale-95 ${
                viewportTheme === 'dark'
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30 hover:border-blue-500/60'
                  : 'bg-blue-600/20 border-blue-500/40 text-blue-600 hover:bg-blue-600/30 hover:border-blue-500/60'
              }`}
              style={{ 
                boxShadow: '0 8px 32px rgba(59, 130, 246, 0.15)',
                backdropFilter: 'blur(16px)'
              }}
            >
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold">✓ Done</span>
                <span className="text-xs opacity-75">(ESC)</span>
              </div>
            </button>
          </div>
        </div>
      )}
      
      {/* Viewport controls */}
      <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
        {/* Enhanced Wall Joinery Debug Tools */}
        <div className="flex flex-col space-y-1">
          <button
            onClick={() => {
              console.log('🚨 ========== EMERGENCY JOINERY FIX ==========');
              
              // Run comprehensive diagnostic and fix
              const success = standaloneCADEngine.emergencyJoineryDiagnostic();
              
              if (success) {
                console.log('✅ EMERGENCY FIX SUCCESSFUL - Joinery applied');
              } else {
                console.error('❌ EMERGENCY FIX FAILED - Manual intervention required');
                
                // Last resort: Force recreate all walls with perfect endpoints
                console.log('🚨 LAST RESORT: Attempting wall endpoint correction...');
                const walls = standaloneCADEngine.getAllObjects().filter(obj => obj.type === 'wall');
                
                if (walls.length >= 4) {
                  // For a rectangle, ensure perfect corner connections
                  const rect = walls.slice(0, 4);
                  console.log('🔧 Correcting rectangle corners...');
                  
                  // This would require manual coordinate fixing based on your specific rectangle
                  console.log('💡 Suggestion: Try redrawing one wall to trigger auto-extend');
                }
              }
              
              // Refresh viewport regardless
              setTimeout(() => {
                const refreshedObjects = standaloneCADEngine.getAllObjects();
                setObjects(refreshedObjects);
                console.log('🔄 Viewport refreshed after emergency diagnostic');
              }, 500);
            }}
            className={`w-10 h-10 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center justify-center hover:scale-105 ${
              viewportTheme === 'dark' 
                ? 'bg-red-900/40 border-red-700/50 text-red-300 hover:bg-red-800/60 hover:border-red-600/70' 
                : 'bg-red-100/40 border-red-300/50 text-red-700 hover:bg-red-200/60 hover:border-red-400/70'
            }`}
            title="Emergency Joinery Fix (30cm tolerance)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </button>
          
          <button
            onClick={() => {
              console.log('🔍 COMPREHENSIVE WALL ANALYSIS:');
              const walls = standaloneCADEngine.getAllObjects().filter(obj => obj.type === 'wall');
              console.log(`📊 Total walls found: ${walls.length}`);
              
              walls.forEach((wall, idx) => {
                console.log(`  Wall ${idx + 1} (${wall.id}):`, {
                  start: wall.params?.startPoint,
                  end: wall.params?.endPoint,
                  length: wall.params?.length?.toFixed(3) + 'm',
                  hasJoinery: !!wall.params?.adjustForJoinery,
                  hasAutoExtend: !!wall.params?.autoExtend
                });
              });
              
              // Manual distance check between all wall endpoints
              console.log('🔍 ENDPOINT DISTANCE MATRIX:');
              for (let i = 0; i < walls.length; i++) {
                for (let j = i + 1; j < walls.length; j++) {
                  const w1 = walls[i], w2 = walls[j];
                  if (w1.params?.startPoint && w1.params?.endPoint && w2.params?.startPoint && w2.params?.endPoint) {
                    const distances = [
                      { desc: `${w1.id}.start → ${w2.id}.start`, dist: standaloneCADEngine.distance3D(w1.params.startPoint, w2.params.startPoint) },
                      { desc: `${w1.id}.start → ${w2.id}.end`, dist: standaloneCADEngine.distance3D(w1.params.startPoint, w2.params.endPoint) },
                      { desc: `${w1.id}.end → ${w2.id}.start`, dist: standaloneCADEngine.distance3D(w1.params.endPoint, w2.params.startPoint) },
                      { desc: `${w1.id}.end → ${w2.id}.end`, dist: standaloneCADEngine.distance3D(w1.params.endPoint, w2.params.endPoint) }
                    ];
                    const closest = distances.reduce((min, d) => d.dist < min.dist ? d : min);
                    console.log(`  ${closest.desc} = ${closest.dist.toFixed(3)}m ${closest.dist <= 0.3 ? '✅ CLOSE' : '❌ FAR'}`);
                  }
                }
              }
            }}
            className={`w-10 h-10 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center justify-center hover:scale-105 ${
              viewportTheme === 'dark' 
                ? 'bg-blue-900/40 border-blue-700/50 text-blue-300 hover:bg-blue-800/60 hover:border-blue-600/70' 
                : 'bg-blue-100/40 border-blue-300/50 text-blue-700 hover:bg-blue-200/60 hover:border-blue-400/70'
            }`}
            title="Analyze Wall Connections"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
        </div>
        
        <button
          onClick={() => {
            setZoom(1);
            setViewCenter({ x: 0, y: 0 });
          }}
          className={`w-10 h-10 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center justify-center hover:scale-105 ${
            viewportTheme === 'dark' 
              ? 'bg-gray-900/40 border-gray-700/50 text-gray-300 hover:bg-gray-800/60 hover:border-gray-600/70' 
              : 'bg-white/40 border-gray-200/50 text-gray-700 hover:bg-white/60 hover:border-gray-300/70'
          }`}
          title="Reset View"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
        </button>
        <button
          onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
          className={`w-10 h-10 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center justify-center hover:scale-105 ${
            viewportTheme === 'dark' 
              ? 'bg-gray-900/40 border-gray-700/50 text-gray-300 hover:bg-gray-800/60 hover:border-gray-600/70' 
              : 'bg-white/40 border-gray-200/50 text-gray-700 hover:bg-white/60 hover:border-gray-300/70'
          }`}
          title="Zoom In"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
          className={`w-10 h-10 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center justify-center hover:scale-105 ${
            viewportTheme === 'dark' 
              ? 'bg-gray-900/40 border-gray-700/50 text-gray-300 hover:bg-gray-800/60 hover:border-gray-600/70' 
              : 'bg-white/40 border-gray-200/50 text-gray-700 hover:bg-white/60 hover:border-gray-300/70'
          }`}
          title="Zoom Out"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
      </div>
      
      {/* Drafting instructions */}
      {isDrafting && (
        <div className="absolute bottom-4 left-4 pointer-events-none">
          <div className={`px-2 py-1 rounded-md shadow-md text-xs ${
            viewportTheme === 'dark' 
              ? 'bg-yellow-900/90 text-yellow-200' 
              : 'bg-yellow-100/90 text-yellow-800'
          }`}>
            Click second point to complete {selectedTool}
          </div>
        </div>
      )}
      
      {/* Drawing instructions */}
      {selectedTool && selectedTool !== 'pointer' && !isDrafting && (
        <div className="absolute bottom-4 left-4 pointer-events-none">
          <div className={`px-3 py-2 rounded-md shadow-md text-xs ${
            viewportTheme === 'dark' 
              ? 'bg-black/70 text-gray-300' 
              : 'bg-white/90 text-gray-700'
          }`}>
            {isDraftingTool(selectedTool) 
              ? `Click and drag to draw ${selectedTool}` 
              : isWallPlacementTool(selectedTool)
                ? `🏗️ Hover near wall edges to place ${selectedTool}`
                : `Click to place ${selectedTool}`
            }
            <br />
            <span className="text-xs opacity-75">
              {wallSelectionMode 
                ? 'Walls will highlight when near • Click on highlighted edge to place'
                : 'Middle-drag to pan • Wheel to zoom'
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CAD2DViewport;