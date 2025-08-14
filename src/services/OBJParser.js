import MTLParser from './MTLParser.js';

/**
 * Enhanced OBJ file parser with MTL material support
 * Extracts geometry data and handles material assignments
 */
class OBJParser {
  constructor() {
    this.vertices = [];
    this.normals = [];
    this.uvs = [];
    this.faces = [];
    this.materials = new Map(); // MTL materials
    this.materialGroups = new Map(); // Groups faces by material
    this.currentMaterial = null;
    this.mtlLibraries = []; // Referenced MTL files
    this.mtlParser = new MTLParser();
  }

  async parseOBJFile(file) {
    const text = await this.readFileAsText(file);
    return this.parseOBJText(text);
  }

  /**
   * Parse OBJ with optional MTL files
   * @param {File} objFile - The OBJ file
   * @param {File[]} mtlFiles - Array of potential MTL files
   * @param {File[]} textureFiles - Array of texture files
   * @returns {Promise<Object>} Parsed geometry and materials
   */
  async parseOBJWithMaterials(objFile, mtlFiles = [], textureFiles = []) {
    // First parse the OBJ file to identify required MTL files
    const objText = await this.readFileAsText(objFile);
    const geometryResult = this.parseOBJText(objText);

    // Try to load referenced MTL files
    if (this.mtlLibraries.length > 0 && mtlFiles.length > 0) {
      await this.loadMTLFiles(mtlFiles, textureFiles);
    }

    return {
      ...geometryResult,
      materials: this.materials,
      materialGroups: this.materialGroups,
      hasMaterials: this.materials.size > 0
    };
  }

  /**
   * Load MTL files that were referenced in the OBJ
   * @param {File[]} mtlFiles - Array of MTL files to check
   * @param {File[]} textureFiles - Array of texture files
   */
  async loadMTLFiles(mtlFiles, textureFiles = []) {
    console.log(`🎨 Loading MTL files for libraries:`, this.mtlLibraries);
    
    for (const mtlLibrary of this.mtlLibraries) {
      // Find matching MTL file (case-insensitive)
      const mtlFile = mtlFiles.find(file => 
        file.name.toLowerCase() === mtlLibrary.toLowerCase() ||
        file.name.toLowerCase().endsWith(mtlLibrary.toLowerCase())
      );

      if (mtlFile) {
        console.log(`📖 Loading MTL file: ${mtlFile.name} for library: ${mtlLibrary}`);
        try {
          const materials = await this.mtlParser.parseMTLFile(mtlFile, textureFiles);
          // Merge materials into our collection
          for (const [name, material] of materials) {
            this.materials.set(name, material);
          }
          console.log(`✅ Loaded ${materials.size} materials from ${mtlFile.name}`);
        } catch (error) {
          console.warn(`⚠️ Failed to load MTL file ${mtlFile.name}:`, error);
        }
      } else {
        console.warn(`⚠️ MTL file not found: ${mtlLibrary}`);
      }
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  parseOBJText(objText) {
    const lines = objText.split('\n');
    
    // Reset arrays and collections
    this.vertices = [];
    this.normals = [];
    this.uvs = [];
    this.faces = [];
    this.materials = new Map();
    this.materialGroups = new Map();
    this.currentMaterial = null;
    this.mtlLibraries = [];

    console.log(`🔍 Parsing OBJ with ${lines.length} lines`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('mtllib ')) {
        // Material library reference
        const mtlFile = line.substring(7).trim();
        this.mtlLibraries.push(mtlFile);
        console.log(`📚 Found MTL library reference: ${mtlFile}`);
      }
      else if (line.startsWith('usemtl ')) {
        // Use material
        const materialName = line.substring(7).trim();
        this.currentMaterial = materialName;
        console.log(`🎨 Switching to material: ${materialName}`);
        
        // Initialize material group if not exists
        if (!this.materialGroups.has(materialName)) {
          this.materialGroups.set(materialName, []);
        }
      }
      else if (line.startsWith('v ')) {
        // Vertex position
        const parts = line.split(/\s+/);
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        this.vertices.push(x, y, z);
      }
      else if (line.startsWith('vn ')) {
        // Vertex normal
        const parts = line.split(/\s+/);
        const nx = parseFloat(parts[1]);
        const ny = parseFloat(parts[2]);
        const nz = parseFloat(parts[3]);
        this.normals.push(nx, ny, nz);
      }
      else if (line.startsWith('vt ')) {
        // Texture coordinate
        const parts = line.split(/\s+/);
        const u = parseFloat(parts[1]);
        const v = parseFloat(parts[2]);
        this.uvs.push(u, v);
      }
      else if (line.startsWith('f ')) {
        // Face
        const parts = line.split(/\s+/).slice(1); // Remove 'f'
        
        // Convert face to triangles (assuming quads or triangles)
        const triangles = [];
        
        if (parts.length === 3) {
          // Triangle
          const triangle = [];
          for (let j = 0; j < 3; j++) {
            const vertexData = parts[j].split('/');
            const vertexIndex = parseInt(vertexData[0]) - 1; // OBJ indices are 1-based
            
            // Validate vertex index
            if (vertexIndex >= 0 && vertexIndex < this.vertices.length / 3) {
              triangle.push(vertexIndex);
              this.faces.push(vertexIndex);
            } else {
              console.warn(`⚠️ Invalid vertex index ${vertexIndex} in face (max: ${this.vertices.length / 3 - 1})`);
            }
          }
          if (triangle.length === 3) {
            triangles.push(triangle);
          }
        } else if (parts.length === 4) {
          // Quad - convert to two triangles
          const indices = [];
          for (let j = 0; j < 4; j++) {
            const vertexData = parts[j].split('/');
            const vertexIndex = parseInt(vertexData[0]) - 1; // OBJ indices are 1-based
            
            // Validate vertex index
            if (vertexIndex >= 0 && vertexIndex < this.vertices.length / 3) {
              indices.push(vertexIndex);
            } else {
              console.warn(`⚠️ Invalid vertex index ${vertexIndex} in quad (max: ${this.vertices.length / 3 - 1})`);
              indices.push(0); // Fallback to first vertex
            }
          }
          
          // Only add triangles if we have valid indices
          if (indices.length === 4) {
            // First triangle: 0, 1, 2
            this.faces.push(indices[0], indices[1], indices[2]);
            triangles.push([indices[0], indices[1], indices[2]]);
            // Second triangle: 0, 2, 3
            this.faces.push(indices[0], indices[2], indices[3]);
            triangles.push([indices[0], indices[2], indices[3]]);
          }
        }

        // Associate triangles with current material
        if (triangles.length > 0 && this.currentMaterial) {
          if (!this.materialGroups.has(this.currentMaterial)) {
            this.materialGroups.set(this.currentMaterial, []);
          }
          this.materialGroups.get(this.currentMaterial).push(...triangles);
        }
      }
    }

    console.log(`✅ Parsed OBJ: ${this.vertices.length / 3} vertices, ${this.faces.length / 3} triangles`);
    console.log(`📚 Found ${this.mtlLibraries.length} MTL library references`);
    console.log(`🎨 Found ${this.materialGroups.size} material groups`);

    // Ensure normals match vertex count
    let finalNormals;
    if (this.normals.length === this.vertices.length) {
      finalNormals = this.normals;
    } else {
      console.log(`🔧 Generating normals: vertices(${this.vertices.length}) != normals(${this.normals.length})`);
      finalNormals = this.generateVertexNormals();
    }

    // Validate data integrity
    const vertexCount = this.vertices.length / 3;
    const normalCount = finalNormals.length / 3;
    
    // Find max index without spread operator to avoid stack overflow
    let maxIndex = -1;
    for (let i = 0; i < this.faces.length; i++) {
      if (this.faces[i] > maxIndex) {
        maxIndex = this.faces[i];
      }
    }
    
    console.log(`🔍 Geometry validation:`, {
      vertices: vertexCount,
      normals: normalCount,
      faces: this.faces.length / 3,
      maxIndex: maxIndex,
      valid: maxIndex < vertexCount && normalCount === vertexCount
    });

    return {
      positions: this.vertices,
      normals: finalNormals,
      indices: this.faces,
      hasNormals: true,
      vertexCount: vertexCount,
      triangleCount: this.faces.length / 3,
      // Material information
      mtlLibraries: this.mtlLibraries,
      materialGroups: this.materialGroups,
      materials: this.materials,
      hasMaterials: this.materials.size > 0
    };
  }



  generateVertexNormals() {
    // Create normals array that matches vertex count exactly
    const normals = new Array(this.vertices.length).fill(0);
    const vertexCount = this.vertices.length / 3;
    
    // Initialize vertex normals to zero
    for (let i = 0; i < vertexCount * 3; i++) {
      normals[i] = 0;
    }
    
    // Calculate face normals and accumulate to vertex normals
    for (let i = 0; i < this.faces.length; i += 3) {
      const i1 = this.faces[i];
      const i2 = this.faces[i + 1];
      const i3 = this.faces[i + 2];
      
      // Skip invalid faces
      if (i1 >= vertexCount || i2 >= vertexCount || i3 >= vertexCount) continue;
      
      // Get vertex positions
      const v1 = [this.vertices[i1 * 3], this.vertices[i1 * 3 + 1], this.vertices[i1 * 3 + 2]];
      const v2 = [this.vertices[i2 * 3], this.vertices[i2 * 3 + 1], this.vertices[i2 * 3 + 2]];
      const v3 = [this.vertices[i3 * 3], this.vertices[i3 * 3 + 1], this.vertices[i3 * 3 + 2]];
      
      // Calculate face normal
      const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
      const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
      
      const normal = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0]
      ];
      
      // Add to vertex normals
      normals[i1 * 3] += normal[0];
      normals[i1 * 3 + 1] += normal[1];
      normals[i1 * 3 + 2] += normal[2];
      
      normals[i2 * 3] += normal[0];
      normals[i2 * 3 + 1] += normal[1];
      normals[i2 * 3 + 2] += normal[2];
      
      normals[i3 * 3] += normal[0];
      normals[i3 * 3 + 1] += normal[1];
      normals[i3 * 3 + 2] += normal[2];
    }
    
    // Normalize all vertex normals
    for (let i = 0; i < vertexCount; i++) {
      const x = normals[i * 3];
      const y = normals[i * 3 + 1];
      const z = normals[i * 3 + 2];
      
      const length = Math.sqrt(x * x + y * y + z * z);
      if (length > 0) {
        normals[i * 3] = x / length;
        normals[i * 3 + 1] = y / length;
        normals[i * 3 + 2] = z / length;
      } else {
        // Fallback normal
        normals[i * 3] = 0;
        normals[i * 3 + 1] = 1;
        normals[i * 3 + 2] = 0;
      }
    }
    
    return normals;
  }

  generateNormals() {
    // Legacy method - create simple normals pointing up
    this.normals = [];
    for (let i = 0; i < this.vertices.length; i += 3) {
      this.normals.push(0, 1, 0); // Simple upward normal
    }
  }
}

export default OBJParser; 