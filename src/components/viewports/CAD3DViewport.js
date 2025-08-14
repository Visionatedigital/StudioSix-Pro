/**
 * CAD 3D Viewport Component
 * 
 * Restored original Three.js-based 3D viewport design with standalone CAD engine
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import standaloneCADEngine from '../../services/StandaloneCADEngine';
import Model3DLoader from '../Model3DLoader';

/**
 * Standalone CAD Object Component - Renders objects from StandaloneCADEngine
 */
const FreeCADObject = ({ object, selectedObjects = new Set(), hoveredObject, onObjectClick, viewportTheme }) => {
  const meshRef = useRef();
  const isSelected = selectedObjects.has(object.id);
  const isHovered = hoveredObject === object.id;

  // DEBUG: Log what objects are being rendered in FreeCADObject
  console.log('🎭 FreeCADObject rendering:', {
    'ID': object.id,
    'TYPE': object.type,
    'HAS modelUrl': !!(object.modelUrl || object.model_url),
    'modelUrl': object.modelUrl,
    'model_url': object.model_url,
    'HAS mesh3D': !!object.mesh3D
  });

  // For furniture and fixture objects with 3D models, use Model3DLoader
  if ((object.type === 'furniture' || object.type === 'fixture') && (object.modelUrl || object.model_url)) {
    console.log('🎨 FreeCADObject: Using Model3DLoader for', object.type, object.id, {
      modelUrl: object.modelUrl || object.model_url,
      format: object.format
    });
    
    // Use same positioning logic as App.js CADObject component
    // Furniture and fixtures should be on ground level, bottom-aligned
    const meshPosition = [
      object.position?.x || 0, 
      (object.height || 1.0) / 2, // Position at half height above ground
      object.position?.z || 0
    ];
    const meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    
    return (
      <Model3DLoader
        modelUrl={object.modelUrl || object.model_url}
        format={object.format}
        position={meshPosition}
        rotation={meshRotation}
        scale={[1, 1, 1]}
        materialColor={object.materialColor || '#8B4513'}
        isSelected={isSelected}
        isHovered={isHovered}
        viewportTheme={viewportTheme}
        onClick={onObjectClick ? (event) => {
          event.stopPropagation();
          onObjectClick(object.id, object);
        } : undefined}
        onPointerOver={(e) => {
          e.stopPropagation();
          // Could add hover effects here
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          // Could remove hover effects here
        }}
        fallbackDimensions={[object.width || 1, object.height || 1, object.depth || 1]}
      />
    );
  }

  // Use the pre-built mesh from StandaloneCADEngine if available
  if (object.mesh3D) {
    // Use the existing mesh3D directly for better performance and consistency
    return (
      <primitive 
        ref={meshRef}
        object={object.mesh3D}
        onClick={onObjectClick ? (e) => {
          e.stopPropagation();
          onObjectClick(object.id, object);
        } : undefined}
      />
    );
  }

  // Fallback: Create geometry for legacy objects
  
  const createGeometry = () => {
    const scaleUp = (value, minSize = 0.5) => {
      if (!value || value === 0) return minSize;
      if (value < 0.01) return Math.max(value * 1000, minSize);
      if (value > 1000) return Math.max(value / 1000, minSize);
      return Math.max(value, minSize);
    };
    
    const geometryArgs = (() => {
      switch (object.type) {
        case 'slab':
          const slabLength = scaleUp(object.width, 5.0);
          const slabThickness = scaleUp(object.thickness, 0.3);
          const slabWidth = scaleUp(object.depth, 4.0);
          return [slabLength, slabThickness, slabWidth];
        case 'wall':
          const length = scaleUp(object.length, 2.0);
          const height = scaleUp(object.height, 2.5);
          const thickness = scaleUp(object.thickness, 0.2);
          return [length, height, thickness];
        case 'door':
          const doorWidth = scaleUp(object.width, 0.9);
          const doorHeight = scaleUp(object.height, 2.1);
          const doorThickness = scaleUp(object.thickness, 0.05);
          return [doorWidth, doorHeight, doorThickness];
        case 'window':
          const windowWidth = scaleUp(object.width, 1.2);
          const windowHeight = scaleUp(object.height, 1.4);
          const windowThickness = scaleUp(object.thickness, 0.05);
          return [windowWidth, windowHeight, windowThickness];
        case 'column':
          const columnWidth = scaleUp(object.width, 0.4);
          const columnHeight = scaleUp(object.height, 3.0);
          const columnDepth = scaleUp(object.depth, 0.4);
          return [columnWidth, columnHeight, columnDepth];
        default:
          return [scaleUp(object.width || 1), scaleUp(object.height || object.thickness || 1), scaleUp(object.depth || 1)];
      }
    })();
    
    return <boxGeometry args={geometryArgs} />;
  };

  // Material based on object type and material property
  const getMaterial = () => {
    let baseColor = object.materialColor;
    
    // If no specific color, use type-based colors
    if (!baseColor) {
      switch (object.type) {
        case 'wall':
          baseColor = object.material === 'concrete' ? '#6b7280' : '#8b7d6b';
          break;
        case 'slab':
          baseColor = '#9ca3af'; // Light grey for slabs/floors
          break;
        case 'door':
          baseColor = '#deb887'; // Burlywood for doors
          break;
        case 'window':
          baseColor = '#60a5fa'; // Light blue for windows
          break;
        case 'column':
          baseColor = '#6b7280'; // Dark grey for columns
          break;
        default:
          baseColor = object.material === 'concrete' ? '#6b7280' : '#708090';
      }
    }
    
    const color = viewportTheme === 'light' ? baseColor : baseColor;
    
    // Special handling for windows (semi-transparent)
    const isWindow = object.type === 'window';
    
    return (
      <meshStandardMaterial
        color={color}
        roughness={isWindow ? 0.1 : 0.8}
        metalness={isWindow ? 0.0 : 0.1}
        transparent={isHovered || isWindow}
        opacity={isWindow ? 0.6 : (isHovered ? 0.9 : 1.0)}
      />
    );
  };

  // Position from CAD engine
  const position = object.position ? [object.position.x, object.position.y, object.position.z] : [0, 0, 0];

  return (
    <group>
      {/* Main object mesh */}
      <mesh
        ref={meshRef}
        position={position}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onObjectClick?.(object.id, object);
        }}
      >
        {createGeometry()}
        {getMaterial()}
      </mesh>
      
      {/* Enhanced selection outline */}
      {isSelected && (
        <mesh position={position}>
          {createGeometry()}
          <meshBasicMaterial 
            color={viewportTheme === 'light' ? '#8b5cf6' : '#a855f7'}
            wireframe={true}
            transparent={true}
            opacity={0.6}
          />
        </mesh>
      )}
      
      {/* Hover highlight effect */}
      {isHovered && !isSelected && (
        <mesh position={position} scale={[1.02, 1.02, 1.02]}>
          {createGeometry()}
          <meshBasicMaterial 
            color={viewportTheme === 'light' ? '#60a5fa' : '#3b82f6'}
            transparent={true}
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  );
};

/**
 * Scene Content Component - Renders CAD objects and environment
 */
const Scene3DContent = ({ 
  selectedTool, 
  onObjectClick, 
  viewportTheme, 
  controlsRef,
  onGroundClick
}) => {
  const [objects, setObjects] = useState([]);
  const [selectedObjects, setSelectedObjects] = useState(new Set());

  // DEBUG: Log objects state changes
  useEffect(() => {
    console.log('🎬 Scene3DContent objects updated:', {
      'Object count': objects.length,
      'Objects': objects.map(obj => ({
        id: obj.id,
        type: obj.type,
        hasModelUrl: !!(obj.modelUrl || obj.model_url),
        modelUrl: obj.modelUrl,
        model_url: obj.model_url
      }))
    });
  }, [objects]);

  // Sync with CAD engine
  useEffect(() => {
    const updateObjects = () => {
      console.log('🔄 Scene3DContent updateObjects called');
      const allObjects = standaloneCADEngine.getAllObjects();
      console.log('🎭 Scene3DContent received objects:', allObjects.length);
      setObjects(allObjects);
    };

    const updateSelection = (data) => {
      setSelectedObjects(new Set(data.selectedObjects || []));
    };

    standaloneCADEngine.addEventListener('object_created', updateObjects);
    standaloneCADEngine.addEventListener('object_updated', updateObjects);
    standaloneCADEngine.addEventListener('object_deleted', updateObjects);
    standaloneCADEngine.addEventListener('selection_changed', updateSelection);
    standaloneCADEngine.addEventListener('model_state', (data) => {
      setObjects(data.objects || []);
    });

    // Initialize
    updateObjects();
    setSelectedObjects(new Set(standaloneCADEngine.getSelectedObjects().map(obj => obj.id)));

    return () => {
      standaloneCADEngine.removeEventListener('object_created', updateObjects);
      standaloneCADEngine.removeEventListener('object_updated', updateObjects);
      standaloneCADEngine.removeEventListener('object_deleted', updateObjects);
      standaloneCADEngine.removeEventListener('selection_changed', updateSelection);
      standaloneCADEngine.removeEventListener('model_state', updateObjects);
    };
  }, []);

  // Ground click handler
  const handleGroundClick = useCallback((event) => {
    const intersectionPoint = event.point;
    const position = {
      x: intersectionPoint.x,
      y: intersectionPoint.y,
      z: intersectionPoint.z
    };
    onGroundClick?.(position);
  }, [onGroundClick]);

  return (
    <>
      {/* Simple, natural lighting */}
      <ambientLight 
        intensity={viewportTheme === 'light' ? 0.6 : 0.4}
      />
      
      <directionalLight
        position={[10, 10, 5]}
        intensity={viewportTheme === 'light' ? 1.0 : 0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Simple ground plane */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshLambertMaterial 
          color={viewportTheme === 'light' ? '#f1f5f9' : '#1e293b'}
        />
      </mesh>

      {/* Clean grid */}
      <gridHelper 
        args={[
          50, 
          50, 
          viewportTheme === 'light' ? '#cbd5e1' : '#374151',
          viewportTheme === 'light' ? '#e2e8f0' : '#4b5563'
        ]} 
        position={[0, 0, 0]}
      />

      {/* Enhanced navigation controls */}
      <OrbitControls 
        ref={controlsRef}
        enablePan={selectedTool === 'pan' || selectedTool === 'pointer'} 
        enableZoom={true} 
        enableRotate={selectedTool === 'orbit' || selectedTool === 'pointer'}
        maxPolarAngle={Math.PI * 0.48}
        minDistance={3}
        maxDistance={50}
        mouseButtons={{
          LEFT: selectedTool === 'pan' ? 2 : selectedTool === 'orbit' ? 0 : 0,
          MIDDLE: 1, // Zoom
          RIGHT: selectedTool === 'pan' ? 0 : 2
        }}
      />

      {/* Invisible ground plane for click detection */}
      <mesh 
        position={[0, -0.02, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleGroundClick}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      
      {/* CAD Objects */}
      {objects.map(object => (
        <FreeCADObject 
          key={object.id} 
          object={object}
          selectedObjects={selectedObjects}
          hoveredObject={null}
          onObjectClick={onObjectClick}
          viewportTheme={viewportTheme}
        />
      ))}

    </>
  );
};

/**
 * CAD 3D Viewport Component
 */
const CAD3DViewport = ({ 
  className = "",
  theme = "dark",
  selectedTool = "pointer",
  onObjectClick,
  onObjectHover,
  onGroundClick,
  style = {}
}) => {
  const controlsRef = useRef();
  
  // Navigation tool handlers
  const handleZoomFit = useCallback(() => {
    if (controlsRef.current) {
      const objects = standaloneCADEngine.getAllObjects();
      if (objects.length > 0) {
        // Calculate bounding box of all objects
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        objects.forEach(obj => {
          const pos = obj.position || { x: 0, y: 0, z: 0 };
          const size = obj.width || obj.depth || obj.thickness || 2;
          
          minX = Math.min(minX, pos.x - size/2);
          maxX = Math.max(maxX, pos.x + size/2);
          minY = Math.min(minY, pos.y - size/2);
          maxY = Math.max(maxY, pos.y + size/2);
          minZ = Math.min(minZ, pos.z - size/2);
          maxZ = Math.max(maxZ, pos.z + size/2);
        });
        
        // Set camera to fit all objects
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        
        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;
        const maxSize = Math.max(sizeX, sizeY, sizeZ);
        
        controlsRef.current.target.set(centerX, centerY, centerZ);
        const distance = Math.max(maxSize * 1.5, 5);
        controlsRef.current.object.position.set(
          centerX + distance * 0.7, 
          centerY + distance * 0.5, 
          centerZ + distance * 0.7
        );
        controlsRef.current.update();
      }
    }
  }, []);

  // Get cursor style based on selected tool
  const getCursorStyle = () => {
    switch(selectedTool) {
      case 'wall':
        return 'crosshair';
      case 'slab':
        return 'crosshair';
      case 'door':
        return 'crosshair';
      case 'window':
        return 'crosshair';
      case 'column':
        return 'crosshair';
      case 'pan':
        return 'grab';
      case 'orbit':
        return 'grab';
      case 'pointer':
      default:
        return 'default';
    }
  };

  return (
    <div 
      className={`cad-3d-viewport relative w-full h-full ${className}`}
      style={{
        ...style,
        cursor: getCursorStyle()
      }}
    >
      <Canvas
        camera={{ 
          position: [8, 6, 8], 
          fov: 60
        }}
        shadows
        className="w-full h-full"
        gl={{ preserveDrawingBuffer: true }}
        style={{ 
          background: theme === 'light' 
            ? 'linear-gradient(to bottom, #e0f2fe 0%, #f8fafc 100%)' 
            : 'linear-gradient(to bottom, #1e293b 0%, #0f172a 100%)'
        }}
      >
        <Scene3DContent 
          selectedTool={selectedTool}
          onObjectClick={onObjectClick}
          viewportTheme={theme}
          controlsRef={controlsRef}
          onGroundClick={onGroundClick}
        />
      </Canvas>
      
      {/* Navigation buttons (bottom right) */}
      <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
        <button
          onClick={() => {
            if (controlsRef.current) {
              controlsRef.current.reset();
            }
          }}
          className={`w-10 h-10 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center justify-center hover:scale-105 ${
            theme === 'dark' 
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
          onClick={handleZoomFit}
          className={`w-10 h-10 rounded-xl backdrop-blur-md border transition-all duration-200 flex items-center justify-center hover:scale-105 ${
            theme === 'dark' 
              ? 'bg-gray-900/40 border-gray-700/50 text-gray-300 hover:bg-gray-800/60 hover:border-gray-600/70' 
              : 'bg-white/40 border-gray-200/50 text-gray-700 hover:bg-white/60 hover:border-gray-300/70'
          }`}
          title="Fit All Objects"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <path d="M9 9h6v6"/>
            <path d="M9 15L15 9"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CAD3DViewport;