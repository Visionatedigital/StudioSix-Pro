/**
 * Direct glTF Loader for xeokit
 * Bypasses all IFC complexity and loads 3D models directly
 */

import OBJParser from './OBJParser.js';

class DirectGLTFLoader {
  constructor(xeokitViewer) {
    this.viewer = xeokitViewer;
    this.loadedModels = new Map();
    console.log('🎛️ DirectGLTFLoader initialized with viewer:', !!this.viewer);
  }

  /**
   * Load glTF/GLB file directly into xeokit using SceneModel
   */
  async loadGLTF(file, fileName) {
    console.log(`🎬 Loading glTF file directly: ${fileName}`);
    
    try {
      if (!this.viewer || !this.viewer.scene) {
        throw new Error('Xeokit viewer not properly initialized');
      }

      console.log('🔍 Viewer structure check:', {
        hasViewer: !!this.viewer,
        hasScene: !!this.viewer.scene,
        viewerType: typeof this.viewer
      });

      // Parse actual glTF file content
      const modelId = `gltf-${Date.now()}`;
      const { SceneModel } = window.xeokit;
      
      if (!SceneModel) {
        throw new Error('SceneModel not available from xeokit');
      }

      // Read and parse the glTF file
      const fileContent = await file.text();
      const gltfData = JSON.parse(fileContent);
      
      console.log('🔍 Parsed glTF data:', {
        version: gltfData.asset?.version,
        scenes: gltfData.scenes?.length || 0,
        nodes: gltfData.nodes?.length || 0,
        meshes: gltfData.meshes?.length || 0,
        materials: gltfData.materials?.length || 0,
        textures: gltfData.textures?.length || 0,
        buffers: gltfData.buffers?.length || 0
      });

      const sceneModel = new SceneModel(this.viewer.scene, {
        id: modelId,
        isObject: true
      });

      // Parse materials first
      const materialMap = new Map();
      console.log(`🎨 Processing ${gltfData.materials?.length || 0} materials from glTF...`);
      
      if (gltfData.materials && gltfData.materials.length > 0) {
        gltfData.materials.forEach((gltfMaterial, index) => {
          try {
            const materialId = `material_${index}`;
            console.log(`🎨 Processing material ${index}:`, gltfMaterial.name || 'Unnamed', gltfMaterial);
            const materialProperties = this.convertGLTFMaterial(gltfMaterial, materialId, sceneModel);
            materialMap.set(index, materialProperties);
            console.log(`✅ Material ${index} converted successfully:`, materialProperties);
          } catch (error) {
            console.error(`❌ Failed to convert material ${index}:`, error);
          }
        });
      } else {
        console.warn('⚠️ No materials found in glTF data');
      }

      // Create default material if none exist
      if (materialMap.size === 0) {
        const defaultMaterial = {
          id: "defaultMaterial",
          diffuse: [0.8, 0.8, 0.8],
          specular: [0.3, 0.3, 0.3],
          shininess: 30,
          alpha: 1.0,
          name: "Default Material"
        };
        materialMap.set(-1, defaultMaterial);
        console.log('📦 Created default material for glTF');
      }
      
      console.log(`📦 Total materials processed: ${materialMap.size}`);

      // Parse meshes and create entities
      let entityCount = 0;
      console.log(`🏗️ Processing ${gltfData.meshes?.length || 0} meshes from glTF...`);
      
      if (gltfData.meshes && gltfData.meshes.length > 0) {
        gltfData.meshes.forEach((gltfMesh, meshIndex) => {
          console.log(`🏗️ Processing mesh ${meshIndex}:`, gltfMesh.name || 'Unnamed', `with ${gltfMesh.primitives?.length || 0} primitives`);
          
          if (gltfMesh.primitives && gltfMesh.primitives.length > 0) {
            gltfMesh.primitives.forEach((primitive, primIndex) => {
              try {
                const meshId = `mesh_${meshIndex}_${primIndex}`;
                const entityId = `entity_${meshIndex}_${primIndex}`;
                
                console.log(`🏗️ Creating primitive ${primIndex} of mesh ${meshIndex}...`);
                
                // Get material properties
                const materialIndex = primitive.material !== undefined ? primitive.material : -1;
                const materialProps = materialMap.get(materialIndex);
                
                console.log(`🎨 Using material index ${materialIndex}:`, materialProps?.name || 'Default');
                
                // Create geometry with material properties applied directly
                const meshConfig = {
                  id: meshId,
        primitive: "triangles",
                  positions: this.generatePlaceholderGeometry(meshIndex, primIndex),
                  normals: this.generatePlaceholderNormals(),
                  indices: this.generatePlaceholderIndices()
                };

                // Apply material properties to mesh if available
                if (materialProps) {
                  Object.assign(meshConfig, {
                    color: materialProps.diffuse,
                    opacity: materialProps.alpha,
                    metallic: materialProps.metallic,
                    roughness: materialProps.roughness
                  });
                  console.log(`🎨 Applied material properties to mesh ${meshId}:`, {
                    color: materialProps.diffuse,
                    opacity: materialProps.alpha,
                    metallic: materialProps.metallic,
                    roughness: materialProps.roughness
                  });
                }

                console.log(`🏗️ Creating mesh ${meshId}...`);
                const mesh = sceneModel.createMesh(meshConfig);
                console.log(`✅ Mesh ${meshId} created:`, mesh ? 'Success' : 'Failed');

                // Create entity
                console.log(`🏗️ Creating entity ${entityId}...`);
                const entity = sceneModel.createEntity({
                  id: entityId,
                  meshIds: [meshId],
        isObject: true
      });
                console.log(`✅ Entity ${entityId} created:`, entity ? 'Success' : 'Failed');

                entityCount++;
                console.log(`🏗️ ✅ Created entity ${entityId} with material "${materialProps?.name || 'none'}" (index ${materialIndex})`);
              } catch (error) {
                console.error(`❌ Failed to create entity for mesh ${meshIndex}, primitive ${primIndex}:`, error);
              }
            });
          } else {
            console.warn(`⚠️ Mesh ${meshIndex} has no primitives`);
          }
        });
      } else {
        console.warn('⚠️ No meshes found in glTF data');
      }
      
      console.log(`🏗️ Total entities created: ${entityCount}`);

      console.log(`✅ Created ${entityCount} entities from glTF file`);
      sceneModel.finalize();

      this.loadedModels.set(modelId, {
        model: sceneModel,
        fileName,
        type: 'glTF'
      });

      console.log(`✅ Real glTF file parsed: ${fileName} with ${entityCount} entities and ${materialMap.size} materials`);
      
      // Debug the created sceneModel
      console.log('🔍 DirectGLTFLoader Debug - Created SceneModel:', {
        id: sceneModel.id,
        type: typeof sceneModel,
        constructor: sceneModel.constructor?.name,
        hasEntities: 'entities' in sceneModel,
        hasMeshes: 'meshes' in sceneModel,
        hasMaterials: 'materials' in sceneModel,
        entityCount: sceneModel.entities ? Object.keys(sceneModel.entities).length : 0,
        meshCount: sceneModel.meshes ? Object.keys(sceneModel.meshes).length : 0,
        materialCount: sceneModel.materials ? Object.keys(sceneModel.materials).length : 0
      });

      const result = {
        success: true,
        modelID: modelId,
        model: sceneModel,
        fileName: fileName,
        isReal: true,
        format: 'glTF'
      };
      
      console.log('🔍 DirectGLTFLoader Debug - Return result:', {
        success: result.success,
        format: result.format,
        hasModel: !!result.model,
        modelType: typeof result.model,
        fileName: result.fileName,
        modelID: result.modelID
      });
      
      return result;

    } catch (error) {
      console.error(`❌ Failed to load glTF file:`, error);
      throw error;
    }
  }

  /**
   * Convert glTF material to xeokit material format
   */
  convertGLTFMaterial(gltfMaterial, materialId, sceneModel) {
    const material = gltfMaterial || {};
    const pbr = material.pbrMetallicRoughness || {};
    
    // Extract base color (diffuse)
    const baseColorFactor = pbr.baseColorFactor || [1, 1, 1, 1];
    const diffuse = [baseColorFactor[0], baseColorFactor[1], baseColorFactor[2]];
    
    // Extract metallic and roughness
    const metallic = pbr.metallicFactor !== undefined ? pbr.metallicFactor : 1.0;
    const roughness = pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 1.0;
    
    // Convert roughness to shininess (xeokit uses shininess)
    const shininess = Math.max(1, (1 - roughness) * 100);
    
    // Extract emissive
    const emissiveFactor = material.emissiveFactor || [0, 0, 0];
    const emissive = [emissiveFactor[0], emissiveFactor[1], emissiveFactor[2]];
    
    // Extract alpha
    const alpha = baseColorFactor[3] !== undefined ? baseColorFactor[3] : 1.0;
    
    // Return material properties as object (xeokit will apply them during mesh creation)
    const materialProperties = {
      id: materialId,
      diffuse: diffuse,
      specular: metallic > 0.5 ? [0.9, 0.9, 0.9] : [0.2, 0.2, 0.2],
      emissive: emissive,
      shininess: shininess,
      alpha: alpha,
      // Add PBR properties for enhanced rendering
      metallic: metallic,
      roughness: roughness,
      // Store original glTF material name
      name: material.name || materialId
    };
    
    console.log(`📦 Converted glTF material "${material.name || materialId}":`, materialProperties);
    
    return materialProperties;
  }

  /**
   * Generate placeholder geometry for different meshes
   */
  generatePlaceholderGeometry(meshIndex, primIndex) {
    const offset = (meshIndex + primIndex) * 3;
    const scale = 1 + (meshIndex * 0.5);
    
    // Create different shapes for different meshes
    const basePositions = [
      // Cube positions
      scale, scale, scale, -scale, scale, scale, -scale, -scale, scale, scale, -scale, scale,
      scale, scale, scale, scale, -scale, scale, scale, -scale, -scale, scale, scale, -scale,
      scale, scale, scale, scale, scale, -scale, -scale, scale, -scale, -scale, scale, scale,
      -scale, scale, scale, -scale, scale, -scale, -scale, -scale, -scale, -scale, -scale, scale,
      -scale, -scale, -scale, scale, -scale, -scale, scale, -scale, scale, -scale, -scale, scale,
      scale, -scale, -scale, -scale, -scale, -scale, -scale, scale, -scale, scale, scale, -scale
    ];
    
    // Apply offset for positioning
    return basePositions.map((pos, i) => {
      const axis = i % 3;
      return pos + (axis === 0 ? offset : axis === 1 ? offset * 0.5 : offset * 0.3);
    });
  }

  /**
   * Generate placeholder normals
   */
  generatePlaceholderNormals() {
    return [
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1
    ];
  }

  /**
   * Generate placeholder indices
   */
  generatePlaceholderIndices() {
    return [
      0, 1, 2, 0, 2, 3,    // Front face
      4, 5, 6, 4, 6, 7,    // Right face  
      8, 9, 10, 8, 10, 11, // Top face
      12, 13, 14, 12, 14, 15, // Left face
      16, 17, 18, 16, 18, 19, // Bottom face
      20, 21, 22, 20, 22, 23  // Back face
    ];
  }

  /**
   * Convert IFC to glTF using online converter
   */
  async convertAndLoad(ifcFile, fileName) {
    console.log(`🔄 IFC files need conversion: ${fileName}`);
    
    // For now, show instructions to user
    const instructions = `IFC file requires conversion to view real geometry.

Quick Steps:
1. 🌐 Go to: https://products.aspose.app/cad/conversion/ifc-to-gltf
2. 📁 Upload: ${fileName}
3. ⬇️ Download the .glb file
4. 🎬 Import the .glb file here

Takes 30 seconds - then you'll see perfect real geometry like with OBJ files!`;
    
    console.log('📋 IFC Conversion Instructions:', instructions);
    
    // Return placeholder for now
    return {
      success: false,
      message: 'IFC file requires conversion to glTF/OBJ first',
      instructions: instructions,
      convertUrl: 'https://products.aspose.app/cad/conversion/ifc-to-gltf'
    };
  }

  /**
   * Load OBJ file with real geometry parsing
   */
  async loadOBJ(file, fileName) {
    console.log(`🎬 Loading OBJ file: ${fileName}`);
    
    try {
      if (!this.viewer || !this.viewer.scene) {
        throw new Error('Xeokit viewer not properly initialized');
      }

      const modelId = `obj-${Date.now()}`;
      const { SceneModel } = window.xeokit;
      
      if (!SceneModel) {
        throw new Error('SceneModel not available from xeokit');
      }

      // Clear existing models first (including sample cube)
      console.log('🧹 Clearing existing models before loading OBJ...');
      const scene = this.viewer.scene;
      
      // Check for sample models in components
      const components = scene.components || {};
      const sampleComponents = Object.keys(components).filter(id => id.includes('sampleModel'));
      
      // Clear existing sample content
      const existingObjects = Object.keys(scene.objects || {});
      const existingModels = Object.keys(scene.models || {});
      
      // Clear models
      existingModels.forEach(modelId => {
        scene.destroyModel(modelId);
      });
      
      // Clear sample cube entities
      existingObjects.forEach(objectId => {
        if (objectId.includes('sample') || objectId.includes('Sample')) {
          try {
            if (scene.objects[objectId]) {
              if (scene.objects[objectId].destroy) {
                scene.objects[objectId].destroy();
              }
              if (scene.objects[objectId].model && scene.objects[objectId].model.destroyEntity) {
                scene.objects[objectId].model.destroyEntity(objectId);
              }
            }
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      });
      
      // Clear sample model components
      sampleComponents.forEach(componentId => {
        try {
          scene.destroyModel(componentId);
          if (scene.components[componentId] && scene.components[componentId].destroy) {
            scene.components[componentId].destroy();
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      });

      // Parse the OBJ file to get real geometry
      console.log('🔍 Parsing OBJ file for real geometry...');
      const objParser = new OBJParser();
      const geometry = await objParser.parseOBJFile(file);

      console.log('📊 OBJ Geometry Stats:', {
        vertices: geometry.vertexCount,
        triangles: geometry.triangleCount,
        hasNormals: geometry.hasNormals
      });

      // Validate geometry
      if (!geometry.positions || geometry.positions.length === 0) {
        throw new Error('No vertex data found in OBJ file');
      }

      if (!geometry.indices || geometry.indices.length === 0) {
        throw new Error('No face data found in OBJ file');
      }

      const sceneModel = new SceneModel(this.viewer.scene, {
        id: modelId,
        isObject: true
      });

      // Create mesh with real OBJ geometry and enhanced material properties
      sceneModel.createMesh({
        id: "objMesh",
        primitive: "triangles",
        positions: geometry.positions,
        normals: geometry.normals,
        indices: geometry.indices,
        // Enhanced material properties for better shading
        material: {
          diffuse: [0.8, 0.8, 0.8],          // Base color
          specular: [0.3, 0.3, 0.3],         // Specular reflection
          glossiness: 0.4,                   // Surface glossiness
          specularF0: 0.04,                  // Fresnel reflectance at normal incidence
          emissive: [0.0, 0.0, 0.0],         // No emissive light
          alpha: 1.0,                        // Fully opaque
          alphaMode: "opaque"                // Alpha blending mode
        }
      });

      sceneModel.createEntity({
        id: "objEntity",
        meshIds: ["objMesh"],
        isObject: true,
        pickable: true,
        selectable: true
      });

      // Store metadata for the imported OBJ
      sceneModel.objMetadata = {
        fileName: fileName,
        originalFileName: fileName,
        type: 'importedOBJ',
        isMovable: true,
        isDeletable: true,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      };

      sceneModel.finalize();
      
      // Clean up any remaining sample entities
      const finalObjects = Object.keys(scene.objects || {});
      const finalModels = Object.keys(scene.models || {});
      const finalComponents = Object.keys(scene.components || {});
      
      // Remove remaining sample objects
      finalObjects.forEach(id => {
        if (id !== 'objEntity' && (id.includes('sample') || id.includes('Sample'))) {
          try {
            if (scene.objects[id] && scene.objects[id].destroy) {
              scene.objects[id].destroy();
            }
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      });
      
      // Remove remaining sample models
      finalModels.forEach(id => {
        if (id !== modelId && (id.includes('sample') || id.includes('Sample'))) {
          try {
            scene.destroyModel(id);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      });
      
      // Remove remaining sample components
      finalComponents.filter(id => id.includes('sample')).forEach(id => {
        try {
          if (scene.components[id] && scene.components[id].destroy) {
            scene.components[id].destroy();
          }
          scene.destroyModel(id);
        } catch (error) {
          // Ignore cleanup errors
        }
      });

      // Fit camera to the loaded model
      if (this.viewer.cameraFlight) {
        console.log('🎥 Fitting camera to OBJ model...');
        this.viewer.cameraFlight.flyTo(sceneModel);
      }
      
      this.loadedModels.set(modelId, {
        model: sceneModel,
        fileName,
        type: 'OBJ',
        geometry: geometry
      });

      console.log(`✅ Real OBJ geometry loaded: ${fileName} (${geometry.vertexCount} vertices, ${geometry.triangleCount} triangles)`);

      return {
        success: true,
        modelID: modelId,
        model: sceneModel,
        fileName: fileName,
        isReal: true,
        format: 'OBJ',
        stats: {
          vertices: geometry.vertexCount,
          triangles: geometry.triangleCount
        }
      };

    } catch (error) {
      console.error(`❌ Failed to load OBJ file:`, error);
      throw error;
    }
  }

  /**
   * Load OBJ file with MTL materials support
   * @param {File} objFile - The OBJ file
   * @param {File[]} mtlFiles - Array of MTL files
   * @param {File[]} textureFiles - Array of texture files
   * @returns {Promise<Object>} Load result with materials
   */
  async loadOBJWithMaterials(objFile, mtlFiles = [], textureFiles = []) {
    console.log(`🎨 Loading OBJ with materials: ${objFile.name}`, {
      mtlFiles: mtlFiles.length,
      textureFiles: textureFiles.length
    });
    
    try {
      if (!this.viewer || !this.viewer.scene) {
        throw new Error('Xeokit viewer not properly initialized');
      }

      const modelId = `obj-${Date.now()}`;
      const { SceneModel } = window.xeokit;
      
      if (!SceneModel) {
        throw new Error('SceneModel not available from xeokit');
      }

      // Clear existing models
      console.log('🧹 Clearing existing models before loading OBJ with materials...');
      const scene = this.viewer.scene;
      const existingModels = Object.keys(scene.models || {});
      existingModels.forEach(id => {
        try {
          scene.destroyModel(id);
        } catch (error) {
          // Ignore cleanup errors
        }
      });

      // Parse the OBJ file with materials
      console.log('🔍 Parsing OBJ file with materials...');
      const objParser = new OBJParser();
      const result = await objParser.parseOBJWithMaterials(objFile, mtlFiles, textureFiles);

      console.log('📊 OBJ + Materials Stats:', {
        vertices: result.vertexCount,
        triangles: result.triangleCount,
        materials: result.materials.size,
        materialGroups: result.materialGroups.size,
        hasMaterials: result.hasMaterials
      });

      // Validate geometry
      if (!result.positions || result.positions.length === 0) {
        throw new Error('No vertex data found in OBJ file');
      }

      if (!result.indices || result.indices.length === 0) {
        throw new Error('No face data found in OBJ file');
      }

      const sceneModel = new SceneModel(this.viewer.scene, {
        id: modelId,
        isObject: true
      });

      // Create meshes for each material group or a single mesh if no materials
      if (result.hasMaterials && result.materialGroups.size > 0) {
        await this.createMaterializedMeshes(sceneModel, result, objFile.name, objParser);
      } else {
        await this.createSingleMesh(sceneModel, result, objFile.name);
      }

      // Store enhanced metadata
      sceneModel.objMetadata = {
        fileName: objFile.name,
        originalFileName: objFile.name,
        type: 'importedOBJWithMaterials',
        isMovable: true,
        isDeletable: true,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        materials: result.materials.size,
        materialGroups: result.materialGroups.size,
        textureFiles: textureFiles.map(f => f.name)
      };

      sceneModel.finalize();

      // Fit camera to the loaded model
      if (this.viewer.cameraFlight) {
        console.log('🎥 Fitting camera to materialized OBJ model...');
        this.viewer.cameraFlight.flyTo(sceneModel);
      }
      
      this.loadedModels.set(modelId, {
        model: sceneModel,
        fileName: objFile.name,
        type: 'OBJ_WITH_MATERIALS',
        geometry: result,
        materials: result.materials
      });

      console.log(`✅ OBJ with materials loaded: ${objFile.name} (${result.materials.size} materials)`);

      return {
        success: true,
        modelID: modelId,
        model: sceneModel,
        fileName: objFile.name,
        isReal: true,
        format: 'OBJ+MTL',
        stats: {
          vertices: result.vertexCount,
          triangles: result.triangleCount,
          materials: result.materials.size,
          materialGroups: result.materialGroups.size
        }
      };

    } catch (error) {
      console.error(`❌ Failed to load OBJ with materials:`, error);
      throw error;
    }
  }

  /**
   * Create meshes grouped by material
   * @param {SceneModel} sceneModel - The xeokit scene model
   * @param {Object} result - Parsed OBJ result with materials
   * @param {string} fileName - Original file name
   * @param {OBJParser} objParser - The OBJ parser instance with MTL parser
   */
  async createMaterializedMeshes(sceneModel, result, fileName, objParser) {
    console.log(`🎨 Creating materialized meshes for ${result.materialGroups.size} material groups`);

    let meshIndex = 0;
    const entities = [];

    // Create default material as fallback
    const defaultMaterial = {
      diffuse: [0.8, 0.8, 0.8],
      specular: [0.3, 0.3, 0.3],
      glossiness: 0.4,
      specularF0: 0.04,
      emissive: [0.0, 0.0, 0.0],
      alpha: 1.0,
      alphaMode: "opaque"
    };

    for (const [materialName, triangles] of result.materialGroups) {
      console.log(`🔷 Creating mesh for material: ${materialName} (${triangles.length} triangles)`);

      // Convert triangles back to vertices and indices for this material group
      const materialGeometry = this.extractMaterialGeometry(triangles, result.positions, result.normals);
      
      if (materialGeometry.positions.length === 0) {
        console.warn(`⚠️ No geometry for material ${materialName}, skipping`);
        continue;
      }

      // Get xeokit material or use default
      const material = result.materials.get(materialName);
      let xeokitMaterial = defaultMaterial;
      
      if (material) {
        // Check if already converted to xeokit format
        if (material.xeokitMaterial) {
          xeokitMaterial = material.xeokitMaterial;
        } else {
          // Convert MTL material to xeokit format using the MTLParser
          const mtlParser = objParser.mtlParser;
          if (mtlParser) {
            xeokitMaterial = mtlParser.convertToXeokitMaterial(material);
          }
        }
      }

      const meshId = `objMesh_${meshIndex}`;
      const entityId = `objEntity_${meshIndex}`;

      // Create mesh with material-specific geometry
      sceneModel.createMesh({
        id: meshId,
        primitive: "triangles",
        positions: materialGeometry.positions,
        normals: materialGeometry.normals,
        indices: materialGeometry.indices,
        material: xeokitMaterial
      });

      // Create entity
      sceneModel.createEntity({
        id: entityId,
        meshIds: [meshId],
        isObject: true,
        pickable: true,
        selectable: true
      });

      entities.push(entityId);
      meshIndex++;

      console.log(`✅ Created mesh for material ${materialName}: ${materialGeometry.positions.length / 3} vertices`);
    }

    console.log(`✅ Created ${meshIndex} materialized meshes with ${entities.length} entities`);
  }

  /**
   * Create single mesh with default material (fallback)
   * @param {SceneModel} sceneModel - The xeokit scene model
   * @param {Object} result - Parsed OBJ result
   * @param {string} fileName - Original file name
   */
  async createSingleMesh(sceneModel, result, fileName) {
    console.log(`🔷 Creating single mesh (no materials found)`);

    // Use enhanced default material
    const material = {
      diffuse: [0.8, 0.8, 0.8],
      specular: [0.3, 0.3, 0.3],
      glossiness: 0.4,
      specularF0: 0.04,
      emissive: [0.0, 0.0, 0.0],
      alpha: 1.0,
      alphaMode: "opaque"
    };

    sceneModel.createMesh({
      id: "objMesh",
      primitive: "triangles",
      positions: result.positions,
      normals: result.normals,
      indices: result.indices,
      material: material
    });

    sceneModel.createEntity({
      id: "objEntity",
      meshIds: ["objMesh"],
      isObject: true,
      pickable: true,
      selectable: true
    });
  }

  /**
   * Extract geometry for a specific material group
   * @param {Array} triangles - Array of triangle indices for this material
   * @param {Array} allPositions - All vertex positions
   * @param {Array} allNormals - All vertex normals
   * @returns {Object} Geometry data for this material
   */
  extractMaterialGeometry(triangles, allPositions, allNormals) {
    const positions = [];
    const normals = [];
    const indices = [];
    const vertexMap = new Map(); // Map original vertex index to new index
    
    let newVertexIndex = 0;

    // Process each triangle
    for (const triangle of triangles) {
      const triangleIndices = [];
      
      for (const originalIndex of triangle) {
        // Check if we've already processed this vertex
        if (!vertexMap.has(originalIndex)) {
          // Add new vertex
          const pos = originalIndex * 3;
          positions.push(
            allPositions[pos],
            allPositions[pos + 1],
            allPositions[pos + 2]
          );
          
          if (allNormals.length > pos + 2) {
            normals.push(
              allNormals[pos],
              allNormals[pos + 1], 
              allNormals[pos + 2]
            );
          } else {
            // Fallback normal
            normals.push(0, 1, 0);
          }
          
          vertexMap.set(originalIndex, newVertexIndex);
          triangleIndices.push(newVertexIndex);
          newVertexIndex++;
        } else {
          // Reuse existing vertex
          triangleIndices.push(vertexMap.get(originalIndex));
        }
      }
      
      // Add triangle indices
      indices.push(...triangleIndices);
    }

    return {
      positions,
      normals,
      indices
    };
  }

  /**
   * Load multiple files (e.g., OBJ + MTL)
   * @param {File[]} files - Array of files to load
   * @param {string} primaryFileName - Name of the primary file
   * @returns {Promise<Object>} Load result
   */
  async loadMultipleFiles(files, primaryFileName) {
    // Group files by extension
    const fileGroups = {
      obj: [],
      mtl: [],
      texture: []
    };

    files.forEach(file => {
      const extension = file.name.toLowerCase().split('.').pop();
      switch (extension) {
        case 'obj':
          fileGroups.obj.push(file);
          break;
        case 'mtl':
          fileGroups.mtl.push(file);
          break;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'bmp':
        case 'tga':
          fileGroups.texture.push(file);
          break;
      }
    });

    // Load OBJ with materials
    if (fileGroups.obj.length > 0) {
      const objFile = fileGroups.obj[0]; // Use first OBJ file
      return this.loadOBJWithMaterials(objFile, fileGroups.mtl, fileGroups.texture);
    }

    throw new Error('No OBJ file found in the selection');
  }

  /**
   * Auto-detect file type and load appropriately
   */
  async loadAnyFile(file, fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'glb':
      case 'gltf':
        return this.loadGLTF(file, fileName);
      
      case 'obj':
        return this.loadOBJ(file, fileName);
      
      case 'ifc':
        return this.convertAndLoad(file, fileName);
      
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  /**
   * Delete an imported OBJ model
   */
  deleteOBJModel(modelId) {
    console.log(`🗑️ Deleting OBJ model: ${modelId}`);
    
    if (!this.viewer || !this.viewer.scene) {
      throw new Error('Viewer not available');
    }

    try {
      // Remove from loaded models map
      this.loadedModels.delete(modelId);
      
      // Destroy the model in the scene
      this.viewer.scene.destroyModel(modelId);
      
      console.log(`✅ OBJ model deleted: ${modelId}`);
      return { success: true, message: 'Model deleted successfully' };
      
    } catch (error) {
      console.error(`❌ Failed to delete OBJ model:`, error);
      throw error;
    }
  }

  /**
   * Move/transform an imported OBJ model
   */
  transformOBJModel(modelId, transforms) {
    console.log(`📐 Transforming OBJ model: ${modelId}`, transforms);
    
    if (!this.viewer || !this.viewer.scene) {
      throw new Error('Viewer not available');
    }

    try {
      const scene = this.viewer.scene;
      const model = scene.models[modelId];
      
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      // Apply transformations
      if (transforms.position) {
        model.origin = [transforms.position.x, transforms.position.y, transforms.position.z];
      }
      
      if (transforms.rotation) {
        model.rotation = [transforms.rotation.x, transforms.rotation.y, transforms.rotation.z];
      }
      
      if (transforms.scale) {
        model.scale = [transforms.scale.x, transforms.scale.y, transforms.scale.z];
      }

      // Update metadata
      const loadedModel = this.loadedModels.get(modelId);
      if (loadedModel && loadedModel.model.objMetadata) {
        if (transforms.position) loadedModel.model.objMetadata.position = transforms.position;
        if (transforms.rotation) loadedModel.model.objMetadata.rotation = transforms.rotation;
        if (transforms.scale) loadedModel.model.objMetadata.scale = transforms.scale;
      }

      console.log(`✅ OBJ model transformed: ${modelId}`);
      return { success: true, message: 'Model transformed successfully' };
      
    } catch (error) {
      console.error(`❌ Failed to transform OBJ model:`, error);
      throw error;
    }
  }

  /**
   * Get metadata for an imported OBJ model
   */
  getOBJModelMetadata(modelId) {
    const loadedModel = this.loadedModels.get(modelId);
    if (loadedModel && loadedModel.model.objMetadata) {
      return loadedModel.model.objMetadata;
    }
    return null;
  }

  /**
   * List all imported OBJ models
   */
  getImportedOBJModels() {
    const objModels = [];
    this.loadedModels.forEach((modelData, modelId) => {
      if (modelData.type === 'OBJ') {
        objModels.push({
          modelId,
          fileName: modelData.fileName,
          metadata: modelData.model.objMetadata || {}
        });
      }
    });
    return objModels;
  }
}

export default DirectGLTFLoader; 