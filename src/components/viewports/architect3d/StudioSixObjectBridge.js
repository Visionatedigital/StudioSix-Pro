/**
 * StudioSix Object Bridge
 * 
 * Converts StudioSix objects to architect3d-compatible format
 * Handles the interaction between the two systems
 * Enhanced with 3D model loading support
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export class StudioSixObjectBridge {
  constructor() {
    this.objectMap = new Map(); // Maps StudioSix object IDs to three.js objects
    this.reverseMap = new Map(); // Maps three.js objects to StudioSix objects
  }

  /**
   * Create a three.js representation of a StudioSix object
   */
  async createThreeJSObject(studioSixObject) {
    console.log('🔗 Creating Three.js object for:', studioSixObject.type, studioSixObject.id);

    // Check if already created
    if (this.objectMap.has(studioSixObject.id)) {
      return this.objectMap.get(studioSixObject.id);
    }

    // For furniture/fixtures/doors/windows/stairs/roofs with 3D models, load the actual model
    if ((studioSixObject.type === 'furniture' || studioSixObject.type === 'fixture' || 
         studioSixObject.type === 'door' || studioSixObject.type === 'window' || 
         studioSixObject.type === 'stair' || studioSixObject.type === 'roof') && 
        (studioSixObject.modelUrl || studioSixObject.model_url)) {
      
      console.log('🎨 Loading 3D model for:', studioSixObject.type, studioSixObject.id, {
        modelUrl: studioSixObject.modelUrl || studioSixObject.model_url,
        format: studioSixObject.format,
        isLocal: studioSixObject.isLocal,
        localModel: studioSixObject.localModel
      });
      
      try {
        const loaded3DObject = await this.load3DModel(studioSixObject);
        return loaded3DObject;
      } catch (error) {
        console.error('❌ Failed to load 3D model for', studioSixObject.type, studioSixObject.id, ':', error);
        console.log('🔄 Falling back to basic geometry for:', studioSixObject.type);
        // Fall through to geometry fallback
      }
    } else {
      if (studioSixObject.type === 'stair') {
        console.log('🔄 Stair without modelUrl, using basic geometry:', {
          hasModelUrl: !!(studioSixObject.modelUrl || studioSixObject.model_url),
          type: studioSixObject.type,
          id: studioSixObject.id,
          modelUrl: studioSixObject.modelUrl,
          localModel: studioSixObject.localModel
        });
      }
    }

    // Fallback: Create geometry-based object
    return this.createGeometryObject(studioSixObject);
  }

  /**
   * Create geometry-based object (for non-3D model objects or fallback)
   */
  createGeometryObject(studioSixObject) {
    let geometry, material, mesh;

    // Create geometry based on object type
    geometry = this.createGeometry(studioSixObject);
    material = this.createMaterial(studioSixObject);

    // Create mesh
    mesh = new THREE.Mesh(geometry, material);

    // Set position
    if (studioSixObject.position) {
      mesh.position.set(
        studioSixObject.position.x || 0,
        studioSixObject.position.y || 0,
        studioSixObject.position.z || 0
      );
    }

    // Set rotation (supports either full Euler object or numeric yaw)
    if (studioSixObject.rotation !== undefined && studioSixObject.rotation !== null) {
      if (typeof studioSixObject.rotation === 'number') {
        mesh.rotation.set(0, studioSixObject.rotation, 0);
      } else {
        mesh.rotation.set(
          studioSixObject.rotation.x || 0,
          studioSixObject.rotation.y || 0,
          studioSixObject.rotation.z || 0
        );
      }
    }

    // Enable shadows
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Store metadata
    mesh.userData = {
      id: studioSixObject.id,
      type: studioSixObject.type,
      originalObject: studioSixObject,
      isStudioSixObject: true
    };

    // Store in maps for lookup
    this.objectMap.set(studioSixObject.id, mesh);
    this.reverseMap.set(mesh, studioSixObject);

    return mesh;
  }

  /**
   * Create geometry based on object type and dimensions
   */
  createGeometry(obj) {
    const scaleUp = (value, minSize = 0.1) => {
      if (!value || value === 0) return minSize;
      if (value < 0.01) return Math.max(value * 1000, minSize);
      if (value > 1000) return Math.max(value / 1000, minSize);
      return Math.max(value, minSize);
    };

    switch (obj.type) {
      case 'slab':
        return new THREE.BoxGeometry(
          scaleUp(obj.width, 5.0),
          scaleUp(obj.thickness, 0.3),
          scaleUp(obj.depth, 4.0)
        );

      case 'ramp':
        return this.createRampGeometry(obj);

      case 'stair':
        return this.createStairGeometry(obj);

      case 'roof':
        return this.createRoofGeometry(obj);

      case 'wall':
        return new THREE.BoxGeometry(
          scaleUp(obj.length, 2.0),
          scaleUp(obj.height, 2.5),
          scaleUp(obj.thickness, 0.2)
        );

      case 'door':
        return new THREE.BoxGeometry(
          scaleUp(obj.width, 0.9),
          scaleUp(obj.height, 2.1),
          scaleUp(obj.thickness, 0.05)
        );

      case 'window':
        return new THREE.BoxGeometry(
          scaleUp(obj.width, 1.2),
          scaleUp(obj.height, 1.4),
          scaleUp(obj.thickness, 0.05)
        );

      case 'column':
        return new THREE.BoxGeometry(
          scaleUp(obj.width, 0.4),
          scaleUp(obj.height, 3.0),
          scaleUp(obj.depth, 0.4)
        );

      case 'furniture':
      case 'fixture':
        // For furniture, create a placeholder box if no 3D model
        return new THREE.BoxGeometry(
          scaleUp(obj.width, 1.0),
          scaleUp(obj.height, 1.0),
          scaleUp(obj.depth, 1.0)
        );

      default:
        return new THREE.BoxGeometry(
          scaleUp(obj.width || 1),
          scaleUp(obj.height || obj.thickness || 1),
          scaleUp(obj.depth || 1)
        );
    }
  }

  /**
   * Create material based on object properties
   */
  createMaterial(obj) {
    let baseColor = obj.materialColor;

    // Default colors by type
    if (!baseColor) {
      switch (obj.type) {
        case 'wall':
          baseColor = obj.material === 'concrete' ? '#6b7280' : '#8b7d6b';
          break;
        case 'slab':
          baseColor = '#9ca3af';
          break;
        case 'ramp':
          // Color based on material
          switch (obj.material) {
            case 'concrete':
              baseColor = '#6b7280';
              break;
            case 'asphalt':
              baseColor = '#374151';
              break;
            case 'steel':
              baseColor = '#708090';
              break;
            case 'wood':
              baseColor = '#92400e';
              break;
            case 'rubber':
              baseColor = '#1f2937';
              break;
            default:
              baseColor = '#8b7d6b';
          }
          break;
        case 'stair':
          // Color based on material
          switch (obj.material) {
            case 'concrete':
              baseColor = '#888888';
              break;
            case 'wood':
              baseColor = '#8B4513';
              break;
            case 'steel':
              baseColor = '#708090';
              break;
            case 'stone':
              baseColor = '#696969';
              break;
            default:
              baseColor = '#888888'; // Default concrete
          }
          break;
        case 'roof':
          // Color based on roof material
          switch (obj.material) {
            case 'asphalt_shingles':
              baseColor = '#444444';
              break;
            case 'clay_tiles':
              baseColor = '#CC6633';
              break;
            case 'metal':
              baseColor = '#888888';
              break;
            case 'slate':
              baseColor = '#334455';
              break;
            case 'wood_shingles':
              baseColor = '#996633';
              break;
            case 'membrane':
              baseColor = '#DDDDDD';
              break;
            default:
              baseColor = '#666666'; // Default roof color
          }
          break;
        case 'door':
          baseColor = '#deb887';
          break;
        case 'window':
          baseColor = '#60a5fa';
          break;
        case 'column':
          baseColor = '#6b7280';
          break;
        case 'furniture':
          baseColor = '#8B4513';
          break;
        case 'fixture':
          baseColor = '#708090';
          break;
        default:
          baseColor = '#708090';
      }
    }

    // Special handling for windows (semi-transparent)
    const isWindow = obj.type === 'window';
    
    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: isWindow ? 0.1 : 0.8,
      metalness: isWindow ? 0.0 : 0.1,
      transparent: isWindow,
      opacity: isWindow ? 0.6 : 1.0,
      side: THREE.FrontSide, // Ensure solid rendering
      wireframe: false // Explicitly disable wireframe
    });
    
    // Special debugging for ramps
    if (obj.type === 'ramp') {
      console.log('🛤️ RAMP MATERIAL DEBUG: Created material for ramp:', {
        color: baseColor,
        transparent: material.transparent,
        opacity: material.opacity,
        side: material.side,
        wireframe: material.wireframe
      });
    }

    return material;
  }

  /**
   * Update an existing three.js object from StudioSix data
   */
  updateThreeJSObject(studioSixObject) {
    const mesh = this.objectMap.get(studioSixObject.id);
    if (!mesh) return null;

    console.log('🔄 Updating three.js object:', studioSixObject.type, studioSixObject.id);

    // For ramps, we need to recreate the geometry when properties change
    if (studioSixObject.type === 'ramp') {
      console.log('🛤️ LIVE UPDATE: Recreating ramp geometry for property changes');
      
      try {
        // Create new geometry with updated parameters
        const newGeometry = this.createRampGeometry(studioSixObject);
        
        // Dispose old geometry to prevent memory leaks
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        
        // Apply new geometry
        mesh.geometry = newGeometry;
        
        // Update material if needed
        const newMaterial = this.createMaterial(studioSixObject);
        if (mesh.material) {
          mesh.material.dispose();
        }
        mesh.material = newMaterial;
        
        console.log('🛤️ LIVE UPDATE: Ramp geometry updated successfully');
        
      } catch (error) {
        console.error('🛤️ LIVE UPDATE ERROR: Failed to update ramp geometry:', error);
      }
    }

    // Update position
    if (studioSixObject.position) {
      mesh.position.set(
        studioSixObject.position.x || 0,
        studioSixObject.position.y || 0,
        studioSixObject.position.z || 0
      );
    }

    // Update rotation
    if (studioSixObject.rotation) {
      mesh.rotation.set(
        studioSixObject.rotation.x || 0,
        studioSixObject.rotation.y || 0,
        studioSixObject.rotation.z || 0
      );
    }

    // Update material color if changed
    if (studioSixObject.materialColor && mesh.material.color) {
      mesh.material.color.setHex(
        studioSixObject.materialColor.replace('#', '0x')
      );
    }

    return mesh;
  }

  /**
   * Remove a three.js object
   */
  removeThreeJSObject(objectId) {
    const mesh = this.objectMap.get(objectId);
    if (mesh) {
      // Clean up geometry and material
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();

      // Remove from maps
      const originalObject = this.reverseMap.get(mesh);
      this.objectMap.delete(objectId);
      this.reverseMap.delete(mesh);

      return mesh;
    }
    return null;
  }

  /**
   * Get three.js object by StudioSix ID
   */
  getThreeJSObject(objectId) {
    return this.objectMap.get(objectId);
  }

  /**
   * Get StudioSix object by three.js mesh
   */
  getStudioSixObject(mesh) {
    return this.reverseMap.get(mesh);
  }

  /**
   * Get all three.js objects
   */
  getAllThreeJSObjects() {
    return Array.from(this.objectMap.values());
  }

  /**
   * Clear all objects
   */
  clear() {
    // Dispose of all geometries and materials
    for (const mesh of this.objectMap.values()) {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    }

    this.objectMap.clear();
    this.reverseMap.clear();
  }

  /**
   * Sync with StudioSix objects - creates, updates, or removes as needed
   */
  async syncWithStudioSixObjects(studioSixObjects, scene) {
    const existingIds = new Set(this.objectMap.keys());
    const currentIds = new Set(studioSixObjects.map(obj => obj.id));

    // Remove objects that no longer exist
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const mesh = this.removeThreeJSObject(id);
        if (mesh && scene) {
          scene.remove(mesh);
        }
      }
    }

    // Add or update objects
    for (const obj of studioSixObjects) {
      const existingMesh = this.objectMap.get(obj.id);
      
      if (existingMesh) {
        // Update existing object
        this.updateThreeJSObject(obj);
      } else {
        // Create new object (now async)
        const mesh = await this.createThreeJSObject(obj);
        if (mesh && scene) {
          scene.add(mesh);
        }
      }
    }
  }

  /**
   * Load actual 3D model for furniture/fixtures
   */
  async load3DModel(studioSixObject) {
    const modelUrl = studioSixObject.modelUrl || studioSixObject.model_url;
    const format = Array.isArray(studioSixObject.format) ? studioSixObject.format[0] : studioSixObject.format;
    const formatLower = format?.toLowerCase() || 'fbx';

    console.log('📦 Loading 3D model:', {
      id: studioSixObject.id,
      modelUrl,
      format: formatLower
    });

    let loadedObject = null;

    // Load based on format
    switch (formatLower) {
      case 'fbx':
        loadedObject = await this.loadFBX(modelUrl);
        break;
      case 'obj':
        loadedObject = await this.loadOBJ(modelUrl);
        break;
      case 'gltf':
      case 'glb':
        loadedObject = await this.loadGLTF(modelUrl);
        break;
      default:
        throw new Error(`Unsupported model format: ${formatLower}`);
    }

    if (loadedObject) {
      // Apply positioning and properties
      this.apply3DModelProperties(loadedObject, studioSixObject);
      
      // Store mappings
      this.objectMap.set(studioSixObject.id, loadedObject);
      this.reverseMap.set(loadedObject, studioSixObject);

      console.log('✅ 3D model loaded successfully:', studioSixObject.id);
      return loadedObject;
    }

    throw new Error('Failed to load 3D model');
  }

  /**
   * Load FBX model
   */
  async loadFBX(url) {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      loader.load(
        url,
        (fbx) => {
          console.log('✅ FBX loaded:', fbx);
          resolve(fbx);
        },
        (progress) => {
          console.log('📊 FBX loading progress:', progress);
        },
        (error) => {
          console.error('❌ FBX loading error:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load OBJ model
   */
  async loadOBJ(url) {
    return new Promise((resolve, reject) => {
      const loader = new OBJLoader();
      loader.load(
        url,
        (obj) => {
          console.log('✅ OBJ loaded:', obj);
          resolve(obj);
        },
        (progress) => {
          console.log('📊 OBJ loading progress:', progress);
        },
        (error) => {
          console.error('❌ OBJ loading error:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Load GLTF/GLB model
   */
  async loadGLTF(url) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          console.log('✅ GLTF loaded:', gltf);
          resolve(gltf.scene);
        },
        (progress) => {
          console.log('📊 GLTF loading progress:', progress);
        },
        (error) => {
          console.error('❌ GLTF loading error:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Apply properties to loaded 3D model
   */
  apply3DModelProperties(loadedObject, studioSixObject) {
    // Set position
    if (studioSixObject.position) {
      loadedObject.position.set(
        studioSixObject.position.x || 0,
        studioSixObject.position.y || 0,
        studioSixObject.position.z || 0
      );
    }

    // Apply automatic orientation correction for common model orientations
    this.correctModelOrientation(loadedObject, studioSixObject);

    // Set rotation (after orientation correction)
    if (studioSixObject.rotation) {
      loadedObject.rotation.set(
        studioSixObject.rotation.x || 0,
        studioSixObject.rotation.y || 0,
        studioSixObject.rotation.z || 0
      );
    }

    // Set scale
    if (studioSixObject.scale) {
      loadedObject.scale.set(
        studioSixObject.scale.x || 1,
        studioSixObject.scale.y || 1,
        studioSixObject.scale.z || 1
      );
    }

    // Auto-scale model to reasonable size if needed (before ground positioning)
    const box = new THREE.Box3().setFromObject(loadedObject);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    
    // More reasonable scaling for staircases (allow larger models)
    if (studioSixObject.type === 'stair') {
      if (maxSize > 15) { // Allow staircases up to 15 units before scaling
        const scaleFactor = 10 / maxSize; // Scale to max 10 units, not 2
        loadedObject.scale.multiplyScalar(scaleFactor);
        console.log('🏗️ STAIR: Auto-scaled large staircase by factor:', scaleFactor);
      } else if (maxSize < 0.5) {
        const scaleFactor = 2 / maxSize;
        loadedObject.scale.multiplyScalar(scaleFactor);
        console.log('🏗️ STAIR: Auto-scaled small staircase by factor:', scaleFactor);
      } else {
        console.log('🏗️ STAIR: No scaling needed, size is reasonable:', maxSize.toFixed(1));
      }
    } else {
      // Original scaling logic for non-staircase objects
      if (maxSize > 5) {
        const scaleFactor = 2 / maxSize;
        loadedObject.scale.multiplyScalar(scaleFactor);
        console.log('🔧 Auto-scaled large model by factor:', scaleFactor);
      } else if (maxSize < 0.1) {
        const scaleFactor = 1 / maxSize;
        loadedObject.scale.multiplyScalar(scaleFactor);
        console.log('🔧 Auto-scaled small model by factor:', scaleFactor);
      }
    }

    // Apply automatic ground positioning after orientation and scaling
    this.positionOnGround(loadedObject, studioSixObject);

    // Apply materials and shadows
    loadedObject.traverse((child) => {
      if (child.isMesh) {
        // Apply material color if no textures
        if (!child.material || !child.material.map) {
          child.material = new THREE.MeshStandardMaterial({
            color: studioSixObject.materialColor || '#8B4513',
            roughness: 0.7,
            metalness: 0.1
          });
        }
        
        // Enable shadows
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Store metadata
    loadedObject.userData = {
      id: studioSixObject.id,
      type: studioSixObject.type,
      originalObject: studioSixObject,
      isStudioSixObject: true,
      is3DModel: true
    };
  }

  /**
   * Correct model orientation for proper upright display
   * Many 3D models are created with different "up" axes
   */
  correctModelOrientation(loadedObject, studioSixObject) {
    // Calculate bounding box to determine current orientation
    const box = new THREE.Box3().setFromObject(loadedObject);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Only show debug for staircases
    if (studioSixObject.type === 'stair') {
      console.log(`🏗️ STAIR: Fixing orientation for ${studioSixObject.id}`);
      console.log(`🏗️ STAIR: Dimensions X:${size.x.toFixed(1)} Y:${size.y.toFixed(1)} Z:${size.z.toFixed(1)}`);
    }

    // Check if model appears to be lying down (width or depth much larger than height)
    const aspectRatio = {
      xy: size.x / size.y, // width to height
      zy: size.z / size.y, // depth to height
      xz: size.x / size.z   // width to depth
    };

    let correctionApplied = false;
    let rotationApplied = null;

    // General orientation cases - reduced logging
    // Case 1: Model is lying on its side (X-axis is up)
    if (aspectRatio.xy > 2 && size.x > size.y && size.x > size.z) {
      loadedObject.rotation.z = Math.PI / 2; // Rotate 90° around Z-axis
      rotationApplied = 'z-axis +90°';
      correctionApplied = true;
    }
    // Case 2: Model is lying flat (Z-axis is up, common in many 3D software)
    else if (aspectRatio.zy > 2 && size.z > size.y) {
      // Try both directions and see which makes more sense based on center position
      if (center.z < 0) {
        loadedObject.rotation.x = Math.PI / 2; // Rotate +90° around X-axis
        rotationApplied = 'x-axis +90°';
      } else {
        loadedObject.rotation.x = -Math.PI / 2; // Rotate -90° around X-axis
        rotationApplied = 'x-axis -90°';
      }
      correctionApplied = true;
    }
    // Case 3: Model is on its back (Z-axis is up, but smaller than other dimensions)
    else if (aspectRatio.zy > 1.5 && size.z > size.y) {
      loadedObject.rotation.x = -Math.PI / 2; // Rotate -90° around X-axis
      rotationApplied = 'x-axis -90°';
      correctionApplied = true;
    }

    // For staircase-specific corrections based on type
    if (studioSixObject.type === 'stair') {
      // If no correction was applied from general cases, apply stair-specific logic
      if (!correctionApplied) {
        
        // NEW APPROACH: Try different rotations for different dimension cases
        if (size.x > size.y && size.x > size.z) {
          console.log('🏗️ STAIR FIX: X is largest → trying Z-axis +90° rotation');
          loadedObject.rotation.z = Math.PI / 2; // Rotate 90° around Z-axis
          rotationApplied = 'stair z-axis +90°';
          correctionApplied = true;
        } else if (size.z > size.y && size.z > size.x) {
          console.log('🏗️ STAIR FIX: Z is largest → trying Y-axis +90° rotation');
          loadedObject.rotation.y = Math.PI / 2; // Rotate 90° around Y-axis
          rotationApplied = 'stair y-axis +90°';
          correctionApplied = true;
        }
        
        // Case 2: Height already correct (Y-axis is tallest)
        else if (size.y > size.x && size.y > size.z) {
          console.log('🏗️ STAIR FIX: Y is largest → no rotation needed (already upright)');
          // Height is correct, no rotation needed
        }
        
        // Case 3: Default correction if no clear orientation
        if (!correctionApplied) {
          console.log('🏗️ STAIR FIX: Applying default staircase orientation (X-axis -90°)');
          loadedObject.rotation.x = -Math.PI / 2; // Rotate to make model upright
          rotationApplied = 'stair default x-axis -90°';
          correctionApplied = true;
        }
      }
    }
    
    // For furniture-specific corrections based on type
    else if (studioSixObject.type === 'furniture') {
      const subtype = studioSixObject.subtype || '';
      
      // Chairs often need specific orientation
      if (subtype.includes('chair') || subtype.includes('seat')) {
        // Additional chair-specific logic if needed
        if (!correctionApplied && aspectRatio.zy > 1.2) {
          console.log('🪑 CHAIR: Applying chair-specific orientation correction');
          loadedObject.rotation.x = -Math.PI / 2; // Negative rotation for upright
          rotationApplied = 'chair x-axis -90°';
          correctionApplied = true;
        }
      }
      
      // Tables often need different handling
      else if (subtype.includes('table') || subtype.includes('desk') || subtype.includes('surface')) {
        // Tables should generally be flat, so less aggressive correction
        if (!correctionApplied && aspectRatio.zy > 3) {
          console.log('🪑 TABLE: Applying table-specific orientation correction');
          loadedObject.rotation.x = -Math.PI / 2; // Negative rotation for upright
          rotationApplied = 'table x-axis -90°';
          correctionApplied = true;
        }
      }
    }

    // Final result logging for staircases only
    if (studioSixObject.type === 'stair' && correctionApplied) {
      console.log(`🏗️ STAIR: Applied ${rotationApplied} rotation`);
    }

    if (correctionApplied) {
      // Recalculate bounding box after rotation
      loadedObject.updateMatrixWorld(true);
      const newBox = new THREE.Box3().setFromObject(loadedObject);
      const newSize = newBox.getSize(new THREE.Vector3());
      
      console.log('🧭 ORIENTATION: Model dimensions after correction:', {
        width: newSize.x.toFixed(2),
        height: newSize.y.toFixed(2),
        depth: newSize.z.toFixed(2)
      });
      
      // Verify the correction improved the orientation
      const newAspectRatio = {
        xy: newSize.x / newSize.y,
        zy: newSize.z / newSize.y
      };
      
      if (newSize.y > Math.max(newSize.x, newSize.z)) {
        console.log('✅ ORIENTATION: Correction successful - height is now the largest dimension');
      } else {
        console.log('⚠️ ORIENTATION: Correction may need adjustment - height is not the largest dimension');
      }
    } else {
      console.log('✅ ORIENTATION: Model orientation appears correct, no correction needed');
    }
  }

  /**
   * Position the model on the ground plane (Y = 0)
   * Calculates the bottom of the bounding box and adjusts Y position
   */
  positionOnGround(loadedObject, studioSixObject) {
    // Update the object's world matrix to ensure accurate bounding box calculation
    loadedObject.updateMatrixWorld(true);
    
    // Calculate bounding box after all transformations
    const box = new THREE.Box3().setFromObject(loadedObject);
    const min = box.min;
    const max = box.max;
    const center = box.getCenter(new THREE.Vector3());
    
    console.log('🏠 GROUND POSITIONING: Model bounding box before ground adjustment:', {
      min: { x: min.x.toFixed(2), y: min.y.toFixed(2), z: min.z.toFixed(2) },
      max: { x: max.x.toFixed(2), y: max.y.toFixed(2), z: max.z.toFixed(2) },
      center: { x: center.x.toFixed(2), y: center.y.toFixed(2), z: center.z.toFixed(2) }
    });

    // Calculate how much to adjust Y position to place bottom on ground (Y = 0)
    const groundLevel = 0; // Ground plane is at Y = 0
    const bottomY = min.y;
    const yAdjustment = groundLevel - bottomY;
    
    console.log('🏠 GROUND POSITIONING: Adjusting Y position by:', yAdjustment.toFixed(2));
    
    // Apply the Y adjustment while preserving X and Z positions
    const currentX = studioSixObject.position?.x || 0;
    const currentZ = studioSixObject.position?.z || 0;
    
    loadedObject.position.set(
      currentX,
      yAdjustment, // This will place the bottom of the object at Y = 0
      currentZ
    );
    
    // Update world matrix again after position change
    loadedObject.updateMatrixWorld(true);
    
    // Verify the positioning
    const finalBox = new THREE.Box3().setFromObject(loadedObject);
    const finalMin = finalBox.min;
    const finalCenter = finalBox.getCenter(new THREE.Vector3());
    
    console.log('🏠 GROUND POSITIONING: Final position after ground adjustment:', {
      objectPosition: {
        x: loadedObject.position.x.toFixed(2),
        y: loadedObject.position.y.toFixed(2),
        z: loadedObject.position.z.toFixed(2)
      },
      boundingBoxMin: {
        x: finalMin.x.toFixed(2),
        y: finalMin.y.toFixed(2),
        z: finalMin.z.toFixed(2)
      },
      center: {
        x: finalCenter.x.toFixed(2),
        y: finalCenter.y.toFixed(2),
        z: finalCenter.z.toFixed(2)
      }
    });
    
    // Check if the object is now properly on the ground
    if (Math.abs(finalMin.y) < 0.01) { // Within 1cm tolerance
      console.log('✅ GROUND POSITIONING: Object successfully positioned on ground plane');
    } else {
      console.log('⚠️ GROUND POSITIONING: Object may not be perfectly on ground, bottom Y:', finalMin.y.toFixed(3));
    }
  }

  /**
   * Create custom ramp geometry with slope
   */
  createRampGeometry(obj) {
    const width = Math.max(obj.width || 5.0, 0.1);
    const depth = Math.max(obj.depth || 5.0, 0.1);
    const thickness = Math.max(obj.thickness || 0.2, 0.01);
    const height = Math.max(obj.height || 1.0, 0.01);
    const slopeDirection = obj.slopeDirection || 'north';

    console.log('🛤️ Creating ramp geometry:', {
      width, depth, thickness, height, slopeDirection
    });
    
    console.log('🛤️ RAMP GEOMETRY DEBUG: Input parameters validated:', {
      width: width.toFixed(3),
      depth: depth.toFixed(3), 
      thickness: thickness.toFixed(3),
      height: height.toFixed(3),
      slopeDirection
    });

    // SIMPLIFIED APPROACH: Create ramp using THREE.js built-in geometry as base
    // then modify vertices for slope
    const baseGeometry = new THREE.BoxGeometry(width, thickness + height, depth);
    
    // Get the position attribute
    const positions = baseGeometry.attributes.position;
    const vertices = positions.array;
    
    // Modify vertices to create slope based on direction
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = vertices[i + 2];
      
      // Only modify top vertices (y > 0)
      if (y > 0) {
        switch (slopeDirection) {
          case 'north': // Slope up toward +Z
            vertices[i + 1] = thickness + (height * (z + depth/2) / depth);
            break;
          case 'south': // Slope up toward -Z  
            vertices[i + 1] = thickness + (height * (-z + depth/2) / depth);
            break;
          case 'east': // Slope up toward +X
            vertices[i + 1] = thickness + (height * (x + width/2) / width);
            break;
          case 'west': // Slope up toward -X
            vertices[i + 1] = thickness + (height * (-x + width/2) / width);
            break;
        }
      }
    }
    
    // Mark positions as needing update
    positions.needsUpdate = true;
    
    // Recompute normals for proper lighting
    baseGeometry.computeVertexNormals();
    
    console.log('🛤️ RAMP GEOMETRY DEBUG: Simplified ramp geometry created');
    
    return baseGeometry;
  }

  /**
   * Create stair geometry
   * Creates a simplified stair representation as a single box with stepped appearance
   */
  createStairGeometry(obj) {
    console.log('🏗️ STAIR GEOMETRY DEBUG: Creating stair geometry for object:', obj);
    
    const stepWidth = Math.max(obj.stepWidth || 1.2, 0.1);
    const numberOfSteps = Math.max(obj.numberOfSteps || 16, 1);
    const treadDepth = Math.max(obj.treadDepth || 0.25, 0.05);
    const riserHeight = Math.max(obj.riserHeight || 0.18, 0.05);
    const totalRun = numberOfSteps * treadDepth;
    const totalRise = numberOfSteps * riserHeight;
    
    console.log('🏗️ STAIR GEOMETRY DEBUG: Calculated parameters:', {
      stepWidth,
      numberOfSteps,
      treadDepth,
      riserHeight,
      totalRun,
      totalRise
    });
    
    // For now, create a simplified ramp-like geometry to represent the stair
    // This shows the overall volume and slope of the staircase
    const stairGeometry = new THREE.BoxGeometry(stepWidth, totalRise / 2, totalRun);
    
    // Position the geometry so it sits on the ground and slopes upward
    stairGeometry.translate(0, totalRise / 4, 0);
    
    console.log('🏗️ STAIR GEOMETRY DEBUG: Simplified stair geometry created with', numberOfSteps, 'steps');
    
    return stairGeometry;
  }

  /**
   * Create basic roof geometry representation
   */
  createRoofGeometry(obj) {
    console.log('🏠 ROOF GEOMETRY DEBUG: Creating roof geometry for object:', obj);
    
    const width = Math.max(obj.width || 12.0, 0.1);
    const length = Math.max(obj.length || 16.0, 0.1);
    const height = Math.max(obj.height || 4.0, 0.1);
    const pitch = Math.max(obj.pitch || 30, 0); // degrees
    const overhang = Math.max(obj.overhang || 0.6, 0);
    const thickness = Math.max(obj.thickness || 0.2, 0.05);
    
    console.log('🏠 ROOF GEOMETRY DEBUG: Calculated parameters:', {
      width,
      length,
      height,
      pitch,
      overhang,
      thickness,
      roofType: obj.roofType
    });
    
    // Create different geometries based on roof type
    let roofGeometry;
    
    switch (obj.roofType) {
      case 'flat':
        // Flat roof - simple box
        roofGeometry = new THREE.BoxGeometry(
          width + overhang * 2,
          thickness,
          length + overhang * 2
        );
        break;
        
      case 'shed':
        // Shed roof - sloped box
        roofGeometry = new THREE.BoxGeometry(
          width + overhang * 2,
          height,
          length + overhang * 2
        );
        // TODO: Could add slope modification here
        break;
        
      case 'gable':
      case 'hip':
      case 'gambrel':
      case 'mansard':
      default:
        // For complex roofs, create a simple peaked representation
        // Main roof volume
        roofGeometry = new THREE.BoxGeometry(
          width + overhang * 2,
          height,
          length + overhang * 2
        );
        // TODO: Could create actual peaked geometry here
        break;
    }
    
    // Position the roof geometry to sit properly
    roofGeometry.translate(0, height / 2, 0);
    
    console.log('🏠 ROOF GEOMETRY DEBUG: Roof geometry created for type:', obj.roofType);
    
    return roofGeometry;
  }
}