/**
 * CAD to Xeokit Converter
 * 
 * Converts CAD objects from StandaloneCADEngine (Three.js format) to Xeokit geometry
 */

export class CADToXeokitConverter {
  constructor() {
    this.loadedModels = new Map(); // cadObjectId -> xeokitModelId
    this.sceneModelDebugLogged = false; // Flag to log SceneModel properties only once
  }

  /**
   * Convert a single CAD object to xeokit geometry using SceneModel API
   * @param {Object} cadObject - CAD object from StandaloneCADEngine
   * @param {Object} sceneModel - Xeokit SceneModel instance
   * @returns {Object} Created entity and mesh info
   */
  convertCADObject(cadObject, sceneModel) {
    // Converting CAD object (start of coordinate transformation pipeline)

    // SceneModel debugging disabled for cleaner coordinate debugging

    try {
      // Track if geometry transformation succeeds (used throughout the function)
      let transformationSucceeded = false;
      
      // Extract geometry from Three.js mesh
      const geometry = this.extractGeometryFromThreeMesh(cadObject.mesh3D);
      
      if (!geometry) {
        console.warn(`⚠️ No geometry found for CAD object ${cadObject.id}`);
        return null;
      }

      // Create material and IDs (material debugging disabled)
      const materialProps = this.convertCADMaterial(cadObject);
      const meshId = `cad_mesh_${cadObject.id}`;
      const entityId = `cad_entity_${cadObject.id}`;

      // Check if mesh already exists
      let mesh;
      let existingMesh = null;
      
              // Check for existing mesh (details suppressed for cleaner logs)
        try {
          if (sceneModel.meshes && sceneModel.meshes[meshId]) {
            existingMesh = sceneModel.meshes[meshId];
          } else if (sceneModel.getMesh && typeof sceneModel.getMesh === 'function') {
            existingMesh = sceneModel.getMesh(meshId);
          }
        } catch (error) {
          // Mesh check failed, will create new
        }
        
        if (existingMesh) {
          mesh = existingMesh;
        } else {
          // 📍 COORDINATE TRANSFORMATION DEBUG
          console.log(`🎯 [${cadObject.id}] Original position:`, cadObject.position);
          console.log(`🎯 [${cadObject.id}] Original rotation:`, cadObject.rotation);
        
        // Attempt geometry transformation with validation
        let transformedPositions;
        
        try {
          // Normalize rotation to object format
          let rotationObj;
          if (typeof cadObject.rotation === 'number') {
            // Wall rotation is around Y-axis (vertical axis) for horizontal orientation changes
            rotationObj = { x: 0, y: cadObject.rotation, z: 0 };
            console.log(`🔄 [${cadObject.id}] Converted rotation ${cadObject.rotation.toFixed(3)} to Y-axis rotation (${(cadObject.rotation * 180 / Math.PI).toFixed(1)}°)`);
          } else if (cadObject.rotation && typeof cadObject.rotation === 'object') {
            rotationObj = cadObject.rotation;
          } else {
            rotationObj = { x: 0, y: 0, z: 0 };
          }
          
          transformedPositions = this.transformGeometryToWorldPosition(
            geometry.positions, 
            cadObject.position, 
            rotationObj
          );
          
          // Validate transformed geometry
          const isValid = transformedPositions && 
                         transformedPositions.length === geometry.positions.length &&
                         !transformedPositions.some(v => isNaN(v) || !isFinite(v));
          
          if (isValid) {
            console.log(`🎯 [${cadObject.id}] Geometry transformation SUCCESS`);
            transformationSucceeded = true;
          } else {
            console.warn(`🎯 [${cadObject.id}] Transformation FAILED - using fallback`);
            transformedPositions = geometry.positions;
          }
        } catch (error) {
          console.error(`❌ Geometry transformation failed:`, error);
          transformedPositions = geometry.positions; // Fallback to original
        }

        // Create mesh with transformed geometry (details suppressed)
        const meshConfig = {
          id: meshId,
          primitive: "triangles",
          positions: transformedPositions,
          normals: geometry.normals,
          indices: geometry.indices,
          ...materialProps
        };
        
        mesh = sceneModel.createMesh(meshConfig);
        if (!mesh) {
          console.error(`❌ Failed to create mesh for ${cadObject.type}`);
          return null;
        }
      }

      // Check if entity already exists (details suppressed)
      let existingEntity = null;
      try {
        if (sceneModel.objects && sceneModel.objects[entityId]) {
          existingEntity = sceneModel.objects[entityId];
        } else if (sceneModel.getObject && typeof sceneModel.getObject === 'function') {
          existingEntity = sceneModel.getObject(entityId);
        }
      } catch (error) {
        // Entity check failed, will create new
      }
      
      if (existingEntity) {
        return { entityId: existingEntity.id, meshId: meshId, reused: true };
      }

      // 📍 DETAILED COORDINATE MAPPING DEBUG
      console.log(`🏗️ [${cadObject.id}] Creating entity with coordinate mapping:`);
      console.log(`📍 [${cadObject.id}] CAD Object position:`, cadObject.position);
      console.log(`📍 [${cadObject.id}] CAD Object params:`, cadObject.params);
      
      // DETAILED POSITION DEBUGGING
      if (cadObject.params && cadObject.params.startPoint && cadObject.params.endPoint) {
        console.log(`📍 DETAILED POSITION DEBUG for ${cadObject.id}:`);
        console.log(`  ➡️ Start Point:`, cadObject.params.startPoint);
        console.log(`  ➡️ End Point:`, cadObject.params.endPoint);
        console.log(`  ➡️ Calculated Position:`, cadObject.position);
        console.log(`  ➡️ Three.js Mesh Position:`, cadObject.mesh3D?.position);
        
        // Calculate expected position from start/end points
        const expectedCenter = {
          x: (cadObject.params.startPoint.x + cadObject.params.endPoint.x) / 2,
          y: (cadObject.params.startPoint.y + cadObject.params.endPoint.y) / 2,
          z: (cadObject.params.startPoint.z + cadObject.params.endPoint.z) / 2
        };
        console.log(`  ➡️ Expected Center from Start/End:`, expectedCenter);
        
        // Check if there's a mismatch
        const positionMismatch = Math.abs(cadObject.position.x - expectedCenter.x) > 0.1 || 
                               Math.abs(cadObject.position.z - expectedCenter.z) > 0.1;
        if (positionMismatch) {
          console.warn(`⚠️ POSITION MISMATCH detected for ${cadObject.id}!`);
          console.warn(`   Expected:`, expectedCenter);
          console.warn(`   Actual:`, cadObject.position);
        }
      }
      
      // Log original drawing coordinates if available
      if (cadObject.params?.startPoint || cadObject.params?.endPoint) {
        console.log(`📏 Original drawing coordinates:`, {
          startPoint: cadObject.params.startPoint,
          endPoint: cadObject.params.endPoint,
          calculatedCenter: cadObject.position
        });
      }

      const entityConfig = {
        id: entityId,
        meshIds: [meshId],
        isObject: true
      };

      // Apply positioning based on transformation success
      if (transformationSucceeded) {
        console.log(`🎯 [${cadObject.id}] Using PRE-TRANSFORMED geometry`);
      } else {
        console.log(`🎯 [${cadObject.id}] Using ENTITY POSITIONING fallback`);
        if (cadObject.position && (cadObject.position.x !== 0 || cadObject.position.y !== 0 || cadObject.position.z !== 0)) {
          entityConfig.position = [cadObject.position.x, cadObject.position.y, cadObject.position.z];
          console.log(`🎯 [${cadObject.id}] Applied fallback position:`, entityConfig.position);
        }
        if (cadObject.rotation && (cadObject.rotation.x !== 0 || cadObject.rotation.y !== 0 || cadObject.rotation.z !== 0)) {
          entityConfig.rotation = [cadObject.rotation.x, cadObject.rotation.y, cadObject.rotation.z];
          console.log(`🎯 [${cadObject.id}] Applied fallback rotation:`, entityConfig.rotation);
        }
      }

      // Apply scale if available (scale is not affected by vertex transformation)
      if (cadObject.mesh3D?.scale) {
        const scale = cadObject.mesh3D.scale;
        if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) {
          entityConfig.scale = [scale.x, scale.y, scale.z];
          console.log(`📏 Applied scale to entity:`, entityConfig.scale);
        }
      }

      // Entity creation (mesh validation details suppressed)

      let entity;
      try {
        entity = sceneModel.createEntity(entityConfig);
      } catch (error) {
        console.error(`❌ Error creating entity ${entityId}:`, error);
        return null;
      }
      
      if (!entity) {
        console.error(`❌ Failed to create entity for ${cadObject.type} - createEntity returned null/undefined`);
        return null;
      }

      // Link mesh to entity (details suppressed)
      if (!entity.meshIds || entity.meshIds.length === 0) {
        entity.meshIds = [meshId];
      }

      // Apply positioning if using fallback mode (details suppressed)
      if (!transformationSucceeded) {
        if (entityConfig.position && (!entity.position || entity.position === 'not set')) {
          entity.position = entityConfig.position;
        }
        if (entityConfig.rotation && (!entity.rotation || entity.rotation === 'not set')) {
          entity.rotation = entityConfig.rotation;
        }
      }
      
      if (entityConfig.scale && (!entity.scale || entity.scale === 'not set')) {
        entity.scale = entityConfig.scale;
      }
      
      // 🎯 COORDINATE TRANSFORMATION SUCCESS VERIFICATION
      if (transformationSucceeded) {
        console.log(`✅ [${cadObject.id}] COORDINATE MAPPING SUCCESS:`);
        console.log(`   📍 2D Drawing: Start[${cadObject.params?.startPoint?.x}, ${cadObject.params?.startPoint?.z}] → End[${cadObject.params?.endPoint?.x}, ${cadObject.params?.endPoint?.z}]`);
        console.log(`   📍 3D Position: [${cadObject.position.x}, ${cadObject.position.y}, ${cadObject.position.z}]`);
        console.log(`   📍 Geometry transformed to world coordinates successfully`);
        console.log(`   📍 AABB will be calculated after scene finalization`);
      } else {
        console.warn(`⚠️ [${cadObject.id}] Using entity-level positioning fallback`);
        console.log(`   📍 Expected 3D Position: [${cadObject.position.x}, ${cadObject.position.y}, ${cadObject.position.z}]`);
      }

      return {
        cadObjectId: cadObject.id,
        meshId,
        entityId,
        mesh,
        entity
      };

    } catch (error) {
      console.error(`❌ Failed to convert CAD object ${cadObject.id}:`, error);
      return null;
    }
  }

  /**
   * Extract geometry data from Three.js mesh
   * @param {THREE.Mesh} threeMesh - Three.js mesh object
   * @returns {Object} Geometry data with positions, normals, indices
   */
  extractGeometryFromThreeMesh(threeMesh) {
    if (!threeMesh) {
      console.warn('⚠️ Invalid Three.js mesh');
      return null;
    }

    let geometry;
    
    // Handle THREE.Group (e.g., enhanced doors with multiple components)
    if (threeMesh.isGroup || threeMesh.type === 'Group') {
      console.log('🔧 Processing THREE.Group with', threeMesh.children.length, 'children');
      
      // Find the first mesh child with geometry (main door panel)
      const meshChild = threeMesh.children.find(child => 
        child.isMesh && child.geometry
      );
      
      if (!meshChild) {
        console.warn('⚠️ No mesh children found in group');
        return null;
      }
      
      console.log('🎯 Using main mesh child for door geometry');
      geometry = meshChild.geometry;
    } else if (!threeMesh.geometry) {
      console.warn('⚠️ No geometry found in mesh');
      return null;
    } else {
      geometry = threeMesh.geometry;
    }
    
    // Get positions
    const positionAttribute = geometry.attributes.position;
    if (!positionAttribute) {
      console.warn('⚠️ No position attribute found in geometry');
      return null;
    }

    const positions = Array.from(positionAttribute.array);

    // Get normals (compute if not present)
    let normals;
    if (geometry.attributes.normal) {
      normals = Array.from(geometry.attributes.normal.array);
    } else {
      console.log('🔧 Computing normals for geometry...');
      geometry.computeVertexNormals();
      normals = geometry.attributes.normal ? 
        Array.from(geometry.attributes.normal.array) : 
        this.generateDefaultNormals(positions);
    }

    // Get indices
    let indices;
    if (geometry.index) {
      indices = Array.from(geometry.index.array);
    } else {
      // Generate indices for non-indexed geometry
      indices = this.generateIndicesFromPositions(positions);
    }

    console.log(`📐 Extracted geometry: ${positions.length/3} vertices, ${indices.length/3} triangles`);

    return {
      positions,
      normals,
      indices
    };
  }

  /**
   * Transform geometry vertices from local space to world position
   * @param {Float32Array} positions - Original vertex positions 
   * @param {Object} worldPosition - Target world position {x, y, z}
   * @param {Object} rotation - Rotation angles {x, y, z} in radians
   * @returns {Float32Array} Transformed vertex positions
   */
  transformGeometryToWorldPosition(positions, worldPosition, rotation) {
    // Input validation (details suppressed for cleaner logs)
    
    // Input validation
    if (!positions || positions.length === 0) {
      throw new Error('Invalid positions array');
    }
    if (!worldPosition || typeof worldPosition.x !== 'number') {
      throw new Error('Invalid world position');
    }
    
    const transformedPositions = new Float32Array(positions.length);
    
    // Ensure rotation values are numbers (default to 0 if undefined/invalid)
    const rotX = (rotation && typeof rotation.x === 'number') ? rotation.x : 0;
    const rotY = (rotation && typeof rotation.y === 'number') ? rotation.y : 0;
    const rotZ = (rotation && typeof rotation.z === 'number') ? rotation.z : 0;
    
    // Precompute rotation matrices
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
    
    // Debug: Log which rotations will be applied
    if (rotX !== 0) console.log(`🔄 Applying X rotation: ${rotX} radians (${(rotX * 180 / Math.PI).toFixed(1)}°)`);
    if (rotY !== 0) console.log(`🔄 Applying Y rotation: ${rotY} radians (${(rotY * 180 / Math.PI).toFixed(1)}°) - Wall orientation`);
    if (rotZ !== 0) console.log(`🔄 Applying Z rotation: ${rotZ} radians (${(rotZ * 180 / Math.PI).toFixed(1)}°)`);
    
    // Transform each vertex (positions array is [x1,y1,z1, x2,y2,z2, ...])
    for (let i = 0; i < positions.length; i += 3) {
      let x = positions[i];
      let y = positions[i + 1]; 
      let z = positions[i + 2];
      
      // Apply Y rotation (around vertical axis) - most common for walls
      if (rotY !== 0) {
        const newX = x * cosY - z * sinY;
        const newZ = x * sinY + z * cosY;
        x = newX;
        z = newZ;
      }
      
      // Apply X rotation if needed
      if (rotX !== 0) {
        const newY = y * cosX - z * sinX;
        const newZ = y * sinX + z * cosX;
        y = newY;
        z = newZ;
      }
      
      // Apply Z rotation if needed  
      if (rotZ !== 0) {
        const newX = x * cosZ - y * sinZ;
        const newY = x * sinZ + y * cosZ;
        x = newX;
        y = newY;
      }
      
      // Translate to world position
      transformedPositions[i] = x + worldPosition.x;
      transformedPositions[i + 1] = y + worldPosition.y;
      transformedPositions[i + 2] = z + worldPosition.z;
    }
    
    // Transformation output validated (details suppressed for cleaner logs)
    
    return transformedPositions;
  }

  /**
   * Convert CAD object material properties to xeokit format
   * @param {Object} cadObject - CAD object with material info
   * @returns {Object} Xeokit material properties
   */
  convertCADMaterial(cadObject) {
    // Get material info from CAD object
    let material = cadObject.mesh3D?.material;
    
    // Handle THREE.Group (extract material from first mesh child)
    if (cadObject.mesh3D && (cadObject.mesh3D.isGroup || cadObject.mesh3D.type === 'Group')) {
      const meshChild = cadObject.mesh3D.children.find(child => 
        child.isMesh && child.material
      );
      material = meshChild?.material;
    }
    
    let materialProps = {
      color: [0.8, 0.8, 0.8], // Default gray color
      opacity: 1.0,
      metallic: 0.0,
      roughness: 0.8
    };

    // Use Three.js material colors if available
    if (material && material.color) {
      // Convert Three.js color to RGB array
      materialProps.color = [
        material.color.r,
        material.color.g,
        material.color.b
      ];
    }

    if (material && material.transparent) {
      materialProps.opacity = material.opacity || 1.0;
    }

    // Apply type-specific material properties
    switch (cadObject.type) {
      case 'wall':
        materialProps.roughness = 0.9;
        materialProps.metallic = 0.0;
        break;
      case 'door':
        materialProps.roughness = 0.3;
        materialProps.metallic = 0.1;
        break;
      case 'window':
        materialProps.opacity = 0.7;
        materialProps.roughness = 0.1;
        materialProps.metallic = 0.0;
        break;
      case 'column':
        materialProps.roughness = 0.7;
        materialProps.metallic = 0.2;
        break;
      default:
        // Keep defaults
        break;
    }

    console.log(`🎨 Material properties for ${cadObject.type}:`, materialProps);
    return materialProps;
  }

  /**
   * Generate default normals for positions
   * @param {Array} positions - Position array
   * @returns {Array} Normals array
   */
  generateDefaultNormals(positions) {
    const normals = [];
    for (let i = 0; i < positions.length; i += 9) { // Every 3 vertices (triangle)
      // Simple upward-facing normal for now
      normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
    }
    return normals;
  }

  /**
   * Generate indices from position array for non-indexed geometry
   * @param {Array} positions - Position array
   * @returns {Array} Indices array
   */
  generateIndicesFromPositions(positions) {
    const indices = [];
    const vertexCount = positions.length / 3;
    
    for (let i = 0; i < vertexCount; i++) {
      indices.push(i);
    }
    
    return indices;
  }

  /**
   * Update an existing xeokit entity from a CAD object
   * @param {Object} cadObject - Updated CAD object
   * @param {Object} sceneModel - Xeokit SceneModel instance
   * @param {string} existingEntityId - ID of existing entity to update
   */
  updateCADObject(cadObject, sceneModel, existingEntityId) {
    console.log(`🔄 Updating xeokit entity ${existingEntityId} from CAD object ${cadObject.id}`);
    
    try {
      // For now, we'll remove and recreate
      // In the future, we could implement more efficient updates
      const entity = sceneModel.objects[existingEntityId];
      if (entity) {
        // Remove existing meshes
        if (entity.meshIds) {
          entity.meshIds.forEach(meshId => {
            if (sceneModel.meshes[meshId]) {
              sceneModel.destroyMesh(meshId);
            }
          });
        }
        sceneModel.destroyEntity(existingEntityId);
      }

      // Recreate with new geometry
      return this.convertCADObject(cadObject, sceneModel);

    } catch (error) {
      console.error(`❌ Failed to update CAD object ${cadObject.id}:`, error);
      return null;
    }
  }

  /**
   * Remove a CAD object from xeokit scene
   * @param {string} cadObjectId - CAD object ID
   * @param {Object} sceneModel - Xeokit SceneModel instance
   */
  removeCADObject(cadObjectId, sceneModel) {
    console.log(`🗑️ Removing CAD object ${cadObjectId} from xeokit scene`);
    
    const entityId = `cad_entity_${cadObjectId}`;
    const meshId = `cad_mesh_${cadObjectId}`;

    try {
      // Remove entity
      if (sceneModel.objects[entityId]) {
        sceneModel.destroyEntity(entityId);
      }

      // Remove mesh
      if (sceneModel.meshes[meshId]) {
        sceneModel.destroyMesh(meshId);
      }

      this.loadedModels.delete(cadObjectId);
      console.log(`✅ Successfully removed CAD object ${cadObjectId} from xeokit`);

    } catch (error) {
      console.error(`❌ Failed to remove CAD object ${cadObjectId}:`, error);
    }
  }

  /**
   * Clear all CAD objects from xeokit scene
   * @param {Object} sceneModel - Xeokit SceneModel instance
   */
  clearAllCADObjects(sceneModel) {
    console.log('🧹 Clearing all CAD objects from xeokit scene');
    
    this.loadedModels.forEach((xeokitModelId, cadObjectId) => {
      this.removeCADObject(cadObjectId, sceneModel);
    });
    
    this.loadedModels.clear();
    console.log('✅ All CAD objects cleared from xeokit scene');
  }
}

export default new CADToXeokitConverter();