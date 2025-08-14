/**
 * MTL (Material Library) Parser for OBJ models
 * Parses .mtl files and converts properties to xeokit-compatible materials
 */
class MTLParser {
  constructor() {
    this.materials = new Map();
    this.currentMaterial = null;
  }

  /**
   * Parse MTL file and return material definitions
   * @param {File} file - The MTL file to parse
   * @param {File[]} textureFiles - Optional array of texture files
   * @returns {Promise<Map>} Map of material name to material properties
   */
  async parseMTLFile(file, textureFiles = []) {
    const text = await this.readFileAsText(file);
    const materials = this.parseMTLText(text, file.name);
    
    // Load textures if available
    if (textureFiles.length > 0) {
      await this.loadTextures(materials, textureFiles);
    }
    
    return materials;
  }

  /**
   * Load texture files referenced by materials
   * @param {Map} materials - Map of materials
   * @param {File[]} textureFiles - Array of texture files
   */
  async loadTextures(materials, textureFiles) {
    console.log(`🖼️ Loading textures for ${materials.size} materials...`);
    
    // Create a map of texture file names to files for quick lookup
    const textureMap = new Map();
    textureFiles.forEach(file => {
      const fileName = file.name.toLowerCase();
      textureMap.set(fileName, file);
      
      // Also map without extension for flexible matching
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
      textureMap.set(nameWithoutExt, file);
    });

    // Process each material
    for (const [materialName, material] of materials) {
      await this.loadMaterialTextures(material, textureMap, materialName);
    }
  }

  /**
   * Load textures for a specific material
   * @param {Object} material - Material object
   * @param {Map} textureMap - Map of texture file names to File objects
   * @param {string} materialName - Name of the material for logging
   */
  async loadMaterialTextures(material, textureMap, materialName) {
    const textureTypes = [
      { prop: 'diffuseMap', key: 'diffuseTexture' },
      { prop: 'specularMap', key: 'specularTexture' },
      { prop: 'normalMap', key: 'normalTexture' },
      { prop: 'alphaMap', key: 'alphaTexture' }
    ];

    for (const { prop, key } of textureTypes) {
      if (material[prop]) {
        const textureFile = this.findTextureFile(material[prop], textureMap);
        if (textureFile) {
          try {
            console.log(`🖼️ Loading texture for ${materialName}.${prop}: ${textureFile.name}`);
            const textureData = await this.loadTextureFile(textureFile);
            material[key] = textureData;
          } catch (error) {
            console.warn(`⚠️ Failed to load texture ${material[prop]} for ${materialName}:`, error);
          }
        } else {
          console.warn(`⚠️ Texture file not found: ${material[prop]} for ${materialName}`);
        }
      }
    }
  }

  /**
   * Find texture file by name with flexible matching
   * @param {string} texturePath - Texture path from MTL
   * @param {Map} textureMap - Map of available texture files
   * @returns {File|null} Matching texture file or null
   */
  findTextureFile(texturePath, textureMap) {
    const textureName = texturePath.toLowerCase();
    
    // Try exact match first
    if (textureMap.has(textureName)) {
      return textureMap.get(textureName);
    }
    
    // Try without path (just filename)
    const fileName = textureName.split(/[/\\]/).pop();
    if (textureMap.has(fileName)) {
      return textureMap.get(fileName);
    }
    
    // Try without extension
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    if (textureMap.has(nameWithoutExt)) {
      return textureMap.get(nameWithoutExt);
    }
    
    // Try partial matches
    for (const [key, file] of textureMap) {
      if (key.includes(nameWithoutExt) || nameWithoutExt.includes(key)) {
        return file;
      }
    }
    
    return null;
  }

  /**
   * Load a texture file as image data
   * @param {File} textureFile - The texture file to load
   * @returns {Promise<Object>} Texture data object
   */
  async loadTextureFile(textureFile) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          image: img,
          file: textureFile,
          width: img.width,
          height: img.height,
          format: this.getTextureFormat(textureFile.name)
        });
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to load texture image: ${textureFile.name}`));
      };
      
      // Create object URL for the image
      const url = URL.createObjectURL(textureFile);
      img.src = url;
    });
  }

  /**
   * Determine texture format from file extension
   * @param {string} fileName - The texture file name
   * @returns {string} Texture format
   */
  getTextureFormat(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'jpeg';
      case 'png':
        return 'png';
      case 'bmp':
        return 'bmp';
      case 'tga':
        return 'tga';
      default:
        return 'unknown';
    }
  }

  /**
   * Parse MTL text content
   * @param {string} mtlText - MTL file content as text
   * @param {string} fileName - Original file name for path resolution
   * @returns {Map} Map of material name to material properties
   */
  parseMTLText(mtlText, fileName = 'unknown.mtl') {
    const lines = mtlText.split('\n');
    this.materials = new Map();
    this.currentMaterial = null;

    console.log(`🎨 Parsing MTL file: ${fileName} (${lines.length} lines)`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;

      this.parseLine(line, fileName);
    }

    console.log(`✅ Parsed ${this.materials.size} materials from ${fileName}`);
    return this.materials;
  }

  /**
   * Parse a single MTL line
   * @param {string} line - Line to parse
   * @param {string} fileName - Base file name for relative paths
   */
  parseLine(line, fileName) {
    const parts = line.split(/\s+/);
    const command = parts[0];

    switch (command) {
      case 'newmtl':
        // Start new material definition
        const materialName = parts.slice(1).join(' ');
        this.currentMaterial = {
          name: materialName,
          // Default values following MTL specification
          diffuse: [0.8, 0.8, 0.8],        // Kd - diffuse color
          ambient: [0.2, 0.2, 0.2],        // Ka - ambient color
          specular: [1.0, 1.0, 1.0],       // Ks - specular color
          emissive: [0.0, 0.0, 0.0],       // Ke - emissive color
          shininess: 0.0,                   // Ns - specular exponent
          opacity: 1.0,                     // d/Tr - transparency
          opticalDensity: 1.0,             // Ni - optical density
          illumination: 2,                  // illum - illumination model
          // Texture maps
          diffuseMap: null,                 // map_Kd
          ambientMap: null,                 // map_Ka
          specularMap: null,                // map_Ks
          normalMap: null,                  // map_Bump or bump
          alphaMap: null,                   // map_d
          // Xeokit-specific properties (computed)
          xeokitMaterial: null
        };
        this.materials.set(materialName, this.currentMaterial);
        console.log(`🎨 Started material: "${materialName}"`);
        break;

      case 'Kd':
        // Diffuse color
        if (this.currentMaterial && parts.length >= 4) {
          this.currentMaterial.diffuse = [
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3])
          ];
        }
        break;

      case 'Ka':
        // Ambient color
        if (this.currentMaterial && parts.length >= 4) {
          this.currentMaterial.ambient = [
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3])
          ];
        }
        break;

      case 'Ks':
        // Specular color
        if (this.currentMaterial && parts.length >= 4) {
          this.currentMaterial.specular = [
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3])
          ];
        }
        break;

      case 'Ke':
        // Emissive color
        if (this.currentMaterial && parts.length >= 4) {
          this.currentMaterial.emissive = [
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3])
          ];
        }
        break;

      case 'Ns':
        // Specular exponent (shininess)
        if (this.currentMaterial && parts.length >= 2) {
          this.currentMaterial.shininess = parseFloat(parts[1]);
        }
        break;

      case 'd':
      case 'Tr':
        // Transparency (d = opacity, Tr = transparency)
        if (this.currentMaterial && parts.length >= 2) {
          const value = parseFloat(parts[1]);
          this.currentMaterial.opacity = command === 'Tr' ? (1.0 - value) : value;
        }
        break;

      case 'Ni':
        // Optical density (index of refraction)
        if (this.currentMaterial && parts.length >= 2) {
          this.currentMaterial.opticalDensity = parseFloat(parts[1]);
        }
        break;

      case 'illum':
        // Illumination model
        if (this.currentMaterial && parts.length >= 2) {
          this.currentMaterial.illumination = parseInt(parts[1]);
        }
        break;

      case 'map_Kd':
        // Diffuse texture map
        if (this.currentMaterial && parts.length >= 2) {
          this.currentMaterial.diffuseMap = this.resolveTexturePath(parts.slice(1).join(' '), fileName);
        }
        break;

      case 'map_Ka':
        // Ambient texture map
        if (this.currentMaterial && parts.length >= 2) {
          this.currentMaterial.ambientMap = this.resolveTexturePath(parts.slice(1).join(' '), fileName);
        }
        break;

      case 'map_Ks':
        // Specular texture map
        if (this.currentMaterial && parts.length >= 2) {
          this.currentMaterial.specularMap = this.resolveTexturePath(parts.slice(1).join(' '), fileName);
        }
        break;

      case 'map_Bump':
      case 'bump':
        // Normal/bump map
        if (this.currentMaterial && parts.length >= 2) {
          this.currentMaterial.normalMap = this.resolveTexturePath(parts.slice(1).join(' '), fileName);
        }
        break;

      case 'map_d':
        // Alpha/transparency map
        if (this.currentMaterial && parts.length >= 2) {
          this.currentMaterial.alphaMap = this.resolveTexturePath(parts.slice(1).join(' '), fileName);
        }
        break;

      default:
        // Ignore unknown commands
        break;
    }
  }

  /**
   * Resolve texture path relative to MTL file
   * @param {string} texturePath - Texture path from MTL file
   * @param {string} mtlFileName - MTL file name for relative resolution
   * @returns {string} Resolved texture path
   */
  resolveTexturePath(texturePath, mtlFileName) {
    // For now, return the texture path as-is
    // In a real implementation, you might want to resolve relative paths
    // based on the MTL file location
    return texturePath.trim();
  }

  /**
   * Convert MTL material to xeokit material format
   * @param {Object} mtlMaterial - Parsed MTL material
   * @returns {Object} Xeokit-compatible material properties
   */
  convertToXeokitMaterial(mtlMaterial) {
    const xeokitMaterial = {
      // Basic PBR properties
      diffuse: mtlMaterial.diffuse,
      specular: mtlMaterial.specular,
      emissive: mtlMaterial.emissive,
      alpha: mtlMaterial.opacity,
      
      // Convert shininess to glossiness (0-1 range)
      // MTL shininess ranges from 0-1000, xeokit glossiness from 0-1
      glossiness: Math.min(mtlMaterial.shininess / 128.0, 1.0),
      
      // Specular F0 (Fresnel reflectance at normal incidence)
      // Approximate based on optical density if available
      specularF0: mtlMaterial.opticalDensity > 1 ? 
        Math.min((mtlMaterial.opticalDensity - 1) / (mtlMaterial.opticalDensity + 1), 0.9) : 0.04,
      
      // Alpha blending mode
      alphaMode: mtlMaterial.opacity < 1.0 ? "blend" : "opaque",
      
      // Line width for wireframe (default)
      lineWidth: 1.0
    };

    // Add loaded textures to xeokit material
    if (mtlMaterial.diffuseTexture) {
      xeokitMaterial.diffuseMap = mtlMaterial.diffuseTexture.image;
      console.log(`🖼️ Added diffuse texture: ${mtlMaterial.diffuseTexture.file.name}`);
    }
    
    if (mtlMaterial.specularTexture) {
      xeokitMaterial.specularMap = mtlMaterial.specularTexture.image;
      console.log(`🖼️ Added specular texture: ${mtlMaterial.specularTexture.file.name}`);
    }
    
    if (mtlMaterial.normalTexture) {
      xeokitMaterial.normalMap = mtlMaterial.normalTexture.image;
      console.log(`🖼️ Added normal texture: ${mtlMaterial.normalTexture.file.name}`);
    }
    
    if (mtlMaterial.alphaTexture) {
      xeokitMaterial.alphaMap = mtlMaterial.alphaTexture.image;
      console.log(`🖼️ Added alpha texture: ${mtlMaterial.alphaTexture.file.name}`);
      // Ensure alpha blending is enabled if alpha texture is present
      xeokitMaterial.alphaMode = "blend";
    }

    // Store texture file references for debugging/metadata
    if (mtlMaterial.diffuseMap || mtlMaterial.specularMap || mtlMaterial.normalMap || mtlMaterial.alphaMap) {
      xeokitMaterial.textureReferences = {
        diffuse: mtlMaterial.diffuseMap,
        specular: mtlMaterial.specularMap,
        normal: mtlMaterial.normalMap,
        alpha: mtlMaterial.alphaMap
      };
    }

    // Cache the converted material
    mtlMaterial.xeokitMaterial = xeokitMaterial;
    
    return xeokitMaterial;
  }

  /**
   * Get all materials converted to xeokit format
   * @returns {Map} Map of material name to xeokit material properties
   */
  getXeokitMaterials() {
    const xeokitMaterials = new Map();
    
    for (const [name, mtlMaterial] of this.materials) {
      if (!mtlMaterial.xeokitMaterial) {
        this.convertToXeokitMaterial(mtlMaterial);
      }
      xeokitMaterials.set(name, mtlMaterial.xeokitMaterial);
    }
    
    return xeokitMaterials;
  }

  /**
   * Read file as text
   * @param {File} file - File to read
   * @returns {Promise<string>} File content as text
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Create a default material for objects without MTL
   * @param {string} name - Material name
   * @param {Array} color - RGB color array [r, g, b]
   * @returns {Object} Xeokit material properties
   */
  static createDefaultMaterial(name = 'default', color = [0.7, 0.7, 0.9]) {
    return {
      diffuse: color,
      specular: [0.3, 0.3, 0.3],
      emissive: [0.0, 0.0, 0.0],
      alpha: 1.0,
      glossiness: 0.4,
      specularF0: 0.04,
      alphaMode: "opaque",
      lineWidth: 1.0
    };
  }
}

export default MTLParser;