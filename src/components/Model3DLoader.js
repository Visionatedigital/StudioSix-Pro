/**
 * 3D Model Loader Component
 * 
 * Loads and renders 3D models from URLs in various formats
 * Integrates with furniture/fixture import system
 */

import React, { useRef, useState, useEffect, Suspense } from 'react';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Box } from '@react-three/drei';
import * as THREE from 'three';

/**
 * 3D Model Loading Component
 */
const Model3DLoader = ({ 
  modelUrl, 
  format, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  materialColor = '#8B4513',
  isSelected = false,
  isHovered = false,
  viewportTheme = 'dark',
  onClick,
  onPointerOver,
  onPointerOut,
  fallbackDimensions = [1, 1, 1]
}) => {
  const meshRef = useRef();
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Determine the primary format to load
  const primaryFormat = Array.isArray(format) ? format[0] : format;
  const formatLower = primaryFormat?.toLowerCase() || 'obj';
  
  console.log('🎨 Model3DLoader: Loading model', {
    url: modelUrl,
    format: formatLower,
    position,
    rotation,
    scale
  });

  /**
   * OBJ Model Loader Component
   */
  const OBJModel = ({ url }) => {
    const [obj, setObj] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
      const loader = new OBJLoader();
      
      loader.load(
        url,
        // onLoad
        (loadedObj) => {
          setIsLoading(false);
          setLoadError(false);
          
          // Apply materials and scaling
          loadedObj.traverse((child) => {
            if (child.isMesh) {
              // Apply material color if no existing material
              if (!child.material || !child.material.map) {
                child.material = new THREE.MeshStandardMaterial({
                  color: materialColor,
                  roughness: 0.7,
                  metalness: 0.1
                });
              }
              
              // Enable shadows
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          // Auto-scale model to reasonable size
          const box = new THREE.Box3().setFromObject(loadedObj);
          const size = box.getSize(new THREE.Vector3());
          const maxSize = Math.max(size.x, size.y, size.z);
          
          if (maxSize > 5) {
            // Scale down large models
            const scaleFactor = 2 / maxSize;
            loadedObj.scale.multiplyScalar(scaleFactor);
          } else if (maxSize < 0.1) {
            // Scale up tiny models
            const scaleFactor = 1 / maxSize;
            loadedObj.scale.multiplyScalar(scaleFactor);
          }
          
          console.log('✅ OBJ model loaded successfully', {
            originalSize: size,
            finalScale: loadedObj.scale
          });
          
          setObj(loadedObj);
        },
        // onProgress
        (progress) => {
          console.log('📥 OBJ loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        // onError
        (error) => {
          console.error('❌ Failed to load OBJ model:', error);
          setLoadError(true);
          setIsLoading(false);
          setError(error);
        }
      );
    }, [url, materialColor]);
    
    if (error) return null;
    if (!obj) return null;
    
    return <primitive object={obj} />;
  };

  /**
   * FBX Model Loader Component
   */
  const FBXModel = ({ url }) => {
    const [fbx, setFbx] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
      const loader = new FBXLoader();
      
      loader.load(
        url,
        // onLoad
        (loadedFbx) => {
          setIsLoading(false);
          setLoadError(false);
          
          // Apply materials and scaling
          loadedFbx.traverse((child) => {
            if (child.isMesh) {
              if (!child.material || !child.material.map) {
                child.material = new THREE.MeshStandardMaterial({
                  color: materialColor,
                  roughness: 0.6,
                  metalness: 0.2
                });
              }
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          // Auto-scale model
          const box = new THREE.Box3().setFromObject(loadedFbx);
          const size = box.getSize(new THREE.Vector3());
          const maxSize = Math.max(size.x, size.y, size.z);
          
          if (maxSize > 5) {
            const scaleFactor = 2 / maxSize;
            loadedFbx.scale.multiplyScalar(scaleFactor);
          } else if (maxSize < 0.1) {
            const scaleFactor = 1 / maxSize;
            loadedFbx.scale.multiplyScalar(scaleFactor);
          }
          
          console.log('✅ FBX model loaded successfully');
          setFbx(loadedFbx);
        },
        // onProgress
        (progress) => {
          console.log('📥 FBX loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        // onError
        (error) => {
          console.error('❌ Failed to load FBX model:', error);
          setLoadError(true);
          setIsLoading(false);
          setError(error);
        }
      );
    }, [url, materialColor]);
    
    if (error) return null;
    if (!fbx) return null;
    
    return <primitive object={fbx} />;
  };

  /**
   * GLTF Model Loader Component
   */
  const GLTFModel = ({ url }) => {
    const [gltf, setGltf] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
      const loader = new GLTFLoader();
      
      loader.load(
        url,
        // onLoad
        (loadedGltf) => {
          setIsLoading(false);
          setLoadError(false);
          
          // Apply materials and scaling
          loadedGltf.scene.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          // Auto-scale model
          const box = new THREE.Box3().setFromObject(loadedGltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const maxSize = Math.max(size.x, size.y, size.z);
          
          if (maxSize > 5) {
            const scaleFactor = 2 / maxSize;
            loadedGltf.scene.scale.multiplyScalar(scaleFactor);
          } else if (maxSize < 0.1) {
            const scaleFactor = 1 / maxSize;
            loadedGltf.scene.scale.multiplyScalar(scaleFactor);
          }
          
          console.log('✅ GLTF model loaded successfully');
          setGltf(loadedGltf);
        },
        // onProgress
        (progress) => {
          console.log('📥 GLTF loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        // onError
        (error) => {
          console.error('❌ Failed to load GLTF model:', error);
          setLoadError(true);
          setIsLoading(false);
          setError(error);
        }
      );
    }, [url, materialColor]);
    
    if (error) return null;
    if (!gltf?.scene) return null;
    
    return <primitive object={gltf.scene} />;
  };

  /**
   * Fallback Box Component
   */
  const FallbackBox = () => {
    const materialProps = {
      color: isSelected 
        ? (viewportTheme === 'light' ? '#8b5cf6' : '#a855f7')
        : materialColor,
      emissive: isSelected 
        ? (viewportTheme === 'light' ? '#7c3aed' : '#3730a3')
        : (isHovered ? (viewportTheme === 'light' ? '#6366f1' : '#4c1d95') : '#000000'),
      emissiveIntensity: isSelected ? 0.15 : (isHovered ? 0.08 : 0),
      roughness: isSelected ? 0.2 : 0.7,
      metalness: isSelected ? 0.3 : 0.1,
      transparent: isHovered && !isSelected,
      opacity: isHovered && !isSelected ? 0.9 : 1.0
    };

    return (
      <Box args={fallbackDimensions}>
        <meshStandardMaterial {...materialProps} />
      </Box>
    );
  };

  /**
   * Loading Placeholder Component
   */
  const LoadingPlaceholder = () => (
    <Box args={fallbackDimensions}>
      <meshStandardMaterial 
        color="#64748b" 
        emissive="#1e293b"
        emissiveIntensity={0.1}
        roughness={0.8}
        metalness={0.0}
        transparent
        opacity={0.7}
      />
    </Box>
  );

  /**
   * Model Content Renderer
   */
  const ModelContent = () => {
    // If model URL is not available or there's an error, show fallback
    if (!modelUrl || loadError) {
      console.log('📦 Using fallback box for model:', { modelUrl, loadError });
      return <FallbackBox />;
    }

    // Select appropriate loader based on format
    switch (formatLower) {
      case 'obj':
        return <OBJModel url={modelUrl} />;
      case 'fbx':
        return <FBXModel url={modelUrl} />;
      case 'gltf':
      case 'glb':
        return <GLTFModel url={modelUrl} />;
      default:
        console.warn(`🤔 Unsupported model format: ${formatLower}, using fallback`);
        return <FallbackBox />;
    }
  };

  return (
    <group
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <Suspense fallback={<LoadingPlaceholder />}>
        <ModelContent />
      </Suspense>
      
      {/* Enhanced selection outline */}
      {isSelected && (
        <Box args={fallbackDimensions} position={[0, 0, 0]}>
          <meshBasicMaterial 
            color={viewportTheme === 'light' ? '#8b5cf6' : '#a855f7'}
            wireframe={true}
            transparent={true}
            opacity={0.6}
          />
        </Box>
      )}
      
      {/* Hover highlight effect */}
      {isHovered && !isSelected && (
        <Box args={fallbackDimensions} position={[0, 0, 0]} scale={[1.02, 1.02, 1.02]}>
          <meshBasicMaterial 
            color={viewportTheme === 'light' ? '#6366f1' : '#4c1d95'}
            wireframe={true}
            transparent={true}
            opacity={0.3}
          />
        </Box>
      )}
    </group>
  );
};

export default Model3DLoader; 