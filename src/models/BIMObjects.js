/**
 * BIM Object Schemas - Wall, Door, Window Classes
 * 
 * Professional BIM object classes following IFC standards with xeokit integration.
 * Each class supports:
 * - IFC standard properties (IFCWALLSTANDARDCASE, IFCDOOR, IFCWINDOW)
 * - xeokit EntityID linking for 3D visualization
 * - Material and dimension management
 * - Position and orientation handling
 * - Property validation and constraints
 */

import { IFCWALLSTANDARDCASE, IFCDOOR, IFCWINDOW } from 'web-ifc';

/**
 * Base BIM Object Class - Common functionality for all BIM objects
 */
class BaseBIMObject {
  constructor(config = {}) {
    // Core identification
    this.id = config.id || this.generateId();
    this.name = config.name || `${this.constructor.name}_${Date.now()}`;
    this.description = config.description || '';
    
    // IFC properties
    this.ifcType = config.ifcType;
    this.ifcGUID = config.ifcGUID || this.generateGUID();
    
    // Spatial properties
    this.position = this.validatePosition(config.position) || { x: 0, y: 0, z: 0 };
    this.orientation = this.validateOrientation(config.orientation) || { x: 0, y: 0, z: 0 };
    
    // xeokit integration
    this.xeokitEntityId = config.xeokitEntityId || null;
    this.xeokitMeshIds = config.xeokitMeshIds || [];
    
    // Metadata
    this.created = config.created || new Date().toISOString();
    this.modified = config.modified || new Date().toISOString();
    this.version = config.version || '1.0.0';
    
    // Material properties
    this.material = this.validateMaterial(config.material) || this.getDefaultMaterial();
  }

  /**
   * Generate unique ID for BIM object
   */
  generateId() {
    return `${this.constructor.name.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate IFC GUID (22-character Base64)
   */
  generateGUID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_$';
    let result = '';
    for (let i = 0; i < 22; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Validate position coordinates
   */
  validatePosition(position) {
    if (!position || typeof position !== 'object') return null;
    
    const { x = 0, y = 0, z = 0 } = position;
    return {
      x: typeof x === 'number' ? x : 0,
      y: typeof y === 'number' ? y : 0,
      z: typeof z === 'number' ? z : 0
    };
  }

  /**
   * Validate orientation (rotation in degrees)
   */
  validateOrientation(orientation) {
    if (!orientation || typeof orientation !== 'object') return null;
    
    const { x = 0, y = 0, z = 0 } = orientation;
    return {
      x: this.normalizeAngle(typeof x === 'number' ? x : 0),
      y: this.normalizeAngle(typeof y === 'number' ? y : 0),
      z: this.normalizeAngle(typeof z === 'number' ? z : 0)
    };
  }

  /**
   * Normalize angle to 0-360 range
   */
  normalizeAngle(angle) {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  }

  /**
   * Validate material properties
   */
  validateMaterial(material) {
    if (!material || typeof material !== 'object') return null;
    
    return {
      name: material.name || 'Default Material',
      color: this.validateColor(material.color) || [0.8, 0.8, 0.8],
      roughness: this.clamp(material.roughness || 0.5, 0, 1),
      metalness: this.clamp(material.metalness || 0.0, 0, 1),
      opacity: this.clamp(material.opacity || 1.0, 0, 1),
      texture: material.texture || null,
      properties: material.properties || {}
    };
  }

  /**
   * Validate color array [r, g, b] values 0-1
   */
  validateColor(color) {
    if (!Array.isArray(color) || color.length !== 3) return null;
    return color.map(c => this.clamp(typeof c === 'number' ? c : 0, 0, 1));
  }

  /**
   * Clamp value between min and max
   */
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Get default material for object type
   */
  getDefaultMaterial() {
    return {
      name: 'Default Material',
      color: [0.8, 0.8, 0.8],
      roughness: 0.5,
      metalness: 0.0,
      opacity: 1.0,
      texture: null,
      properties: {}
    };
  }

  /**
   * Update object properties
   */
  updateProperties(updates = {}) {
    Object.keys(updates).forEach(key => {
      if (key === 'position') {
        this.position = this.validatePosition(updates[key]) || this.position;
      } else if (key === 'orientation') {
        this.orientation = this.validateOrientation(updates[key]) || this.orientation;
      } else if (key === 'material') {
        this.material = this.validateMaterial(updates[key]) || this.material;
      } else if (this.hasOwnProperty(key)) {
        this[key] = updates[key];
      }
    });
    
    this.modified = new Date().toISOString();
    return this;
  }

  /**
   * Link to xeokit entity
   */
  linkToXeokit(entityId, meshIds = []) {
    this.xeokitEntityId = entityId;
    this.xeokitMeshIds = Array.isArray(meshIds) ? meshIds : [meshIds];
    this.modified = new Date().toISOString();
    return this;
  }

  /**
   * Export object for IFC/xeokit integration
   */
  toExport() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      ifcType: this.ifcType,
      ifcGUID: this.ifcGUID,
      position: this.position,
      orientation: this.orientation,
      material: this.material,
      xeokitEntityId: this.xeokitEntityId,
      xeokitMeshIds: this.xeokitMeshIds,
      created: this.created,
      modified: this.modified,
      version: this.version
    };
  }
}

/**
 * Wall Class - IFCWALLSTANDARDCASE implementation
 * 
 * Represents architectural walls with standardized properties following IFC standards.
 * Supports structural analysis, thermal properties, and architectural visualization.
 */
class Wall extends BaseBIMObject {
  constructor(config = {}) {
    super({
      ...config,
      ifcType: IFCWALLSTANDARDCASE
    });

    // Wall-specific dimensions
    this.dimensions = this.validateWallDimensions(config.dimensions) || this.getDefaultDimensions();
    
    // Structural properties
    this.structural = this.validateStructuralProperties(config.structural) || this.getDefaultStructural();
    
    // Thermal properties
    this.thermal = this.validateThermalProperties(config.thermal) || this.getDefaultThermal();
    
    // Architectural properties
    this.architectural = this.validateArchitecturalProperties(config.architectural) || this.getDefaultArchitectural();
    
    // Wall type classification
    this.wallType = config.wallType || 'interior';
    this.function = config.function || 'partition';
    
    // Connectivity (for joinery)
    this.connections = config.connections || [];
    this.startPoint = this.validatePosition(config.startPoint) || { x: 0, y: 0, z: 0 };
    this.endPoint = this.validatePosition(config.endPoint) || { x: 3, y: 0, z: 0 };
  }

  /**
   * Validate wall dimensions
   */
  validateWallDimensions(dimensions) {
    if (!dimensions || typeof dimensions !== 'object') return null;
    
    return {
      length: Math.max(dimensions.length || 3.0, 0.1), // Minimum 10cm
      height: Math.max(dimensions.height || 2.4, 0.1), // Minimum 10cm  
      thickness: Math.max(dimensions.thickness || 0.2, 0.01), // Minimum 1cm
      area: (dimensions.length || 3.0) * (dimensions.height || 2.4),
      volume: (dimensions.length || 3.0) * (dimensions.height || 2.4) * (dimensions.thickness || 0.2)
    };
  }

  /**
   * Validate structural properties
   */
  validateStructuralProperties(structural) {
    if (!structural || typeof structural !== 'object') return null;
    
    return {
      isLoadBearing: Boolean(structural.isLoadBearing),
      structuralType: structural.structuralType || 'non-structural',
      reinforcement: structural.reinforcement || 'none',
      fireRating: structural.fireRating || 'unrated',
      acousticRating: this.clamp(structural.acousticRating || 0, 0, 100)
    };
  }

  /**
   * Validate thermal properties
   */
  validateThermalProperties(thermal) {
    if (!thermal || typeof thermal !== 'object') return null;
    
    return {
      thermalTransmittance: Math.max(thermal.thermalTransmittance || 0.3, 0), // U-value
      thermalMass: Math.max(thermal.thermalMass || 100, 0),
      insulationType: thermal.insulationType || 'none',
      vaporBarrier: Boolean(thermal.vaporBarrier)
    };
  }

  /**
   * Validate architectural properties
   */
  validateArchitecturalProperties(architectural) {
    if (!architectural || typeof architectural !== 'object') return null;
    
    return {
      finish: {
        interior: architectural.finish?.interior || 'painted',
        exterior: architectural.finish?.exterior || 'painted'
      },
      baseboard: Boolean(architectural.baseboard),
      crown: Boolean(architectural.crown),
      texture: architectural.texture || 'smooth'
    };
  }

  /**
   * Get default wall dimensions
   */
  getDefaultDimensions() {
    return {
      length: 3.0,
      height: 2.4,
      thickness: 0.2,
      area: 7.2,
      volume: 1.44
    };
  }

  /**
   * Get default structural properties
   */
  getDefaultStructural() {
    return {
      isLoadBearing: false,
      structuralType: 'non-structural',
      reinforcement: 'none',
      fireRating: 'unrated',
      acousticRating: 0
    };
  }

  /**
   * Get default thermal properties
   */
  getDefaultThermal() {
    return {
      thermalTransmittance: 0.3,
      thermalMass: 100,
      insulationType: 'none',
      vaporBarrier: false
    };
  }

  /**
   * Get default architectural properties
   */
  getDefaultArchitectural() {
    return {
      finish: {
        interior: 'painted',
        exterior: 'painted'
      },
      baseboard: false,
      crown: false,
      texture: 'smooth'
    };
  }

  /**
   * Get default material for walls
   */
  getDefaultMaterial() {
    return {
      name: 'Standard Wall Material',
      color: [0.9, 0.9, 0.85], // Light cream
      roughness: 0.8,
      metalness: 0.0,
      opacity: 1.0,
      texture: null,
      properties: {
        density: 1800, // kg/m³
        compressiveStrength: 25, // MPa
        elasticModulus: 30000 // MPa
      }
    };
  }

  /**
   * Calculate wall geometry for xeokit
   */
  generateGeometry() {
    const { length, height, thickness } = this.dimensions;
    
    // Generate vertices for a rectangular wall
    const positions = [
      // Front face
      0, 0, 0,
      length, 0, 0,
      length, height, 0,
      0, height, 0,
      // Back face
      0, 0, thickness,
      length, 0, thickness,
      length, height, thickness,
      0, height, thickness
    ];

    const normals = [
      // Front face
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      // Back face
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1
    ];

    const indices = [
      // Front face
      0, 1, 2, 0, 2, 3,
      // Back face
      4, 6, 5, 4, 7, 6,
      // Top face
      3, 2, 6, 3, 6, 7,
      // Bottom face
      0, 4, 5, 0, 5, 1,
      // Right face
      1, 5, 6, 1, 6, 2,
      // Left face
      0, 3, 7, 0, 7, 4
    ];

    return {
      positions: positions,
      normals: normals,
      indices: indices,
      primitive: 'triangles'
    };
  }

  /**
   * Add connection to another wall (for joinery)
   */
  addConnection(targetWallId, connectionType = 'corner', junction = null) {
    const connection = {
      targetWallId,
      connectionType,
      junction: junction || { x: 0, y: 0, z: 0 },
      created: new Date().toISOString()
    };
    
    this.connections.push(connection);
    this.modified = new Date().toISOString();
    return this;
  }

  /**
   * Update wall dimensions and recalculate dependent properties
   */
  updateDimensions(newDimensions) {
    this.dimensions = this.validateWallDimensions({
      ...this.dimensions,
      ...newDimensions
    });
    
    // Recalculate area and volume
    this.dimensions.area = this.dimensions.length * this.dimensions.height;
    this.dimensions.volume = this.dimensions.area * this.dimensions.thickness;
    
    this.modified = new Date().toISOString();
    return this;
  }

  /**
   * Export wall for IFC/xeokit integration
   */
  toExport() {
    return {
      ...super.toExport(),
      dimensions: this.dimensions,
      structural: this.structural,
      thermal: this.thermal,
      architectural: this.architectural,
      wallType: this.wallType,
      function: this.function,
      connections: this.connections,
      startPoint: this.startPoint,
      endPoint: this.endPoint,
      geometry: this.generateGeometry()
    };
  }

  /**
   * Create xeokit mesh configuration
   */
  getXeokitMeshConfig(meshId) {
    const geometry = this.generateGeometry();
    
    return {
      id: meshId || `${this.id}_mesh`,
      primitive: geometry.primitive,
      positions: geometry.positions,
      normals: geometry.normals,
      indices: geometry.indices,
      colorize: this.material.color
    };
  }

  /**
   * Create xeokit entity configuration
   */
  getXeokitEntityConfig(entityId, meshId) {
    return {
      id: entityId || this.id,
      meshIds: [meshId || `${this.id}_mesh`],
      isObject: true,
      position: [this.position.x, this.position.y, this.position.z],
      rotation: [this.orientation.x, this.orientation.y, this.orientation.z],
      scale: [1, 1, 1]
    };
  }
}

/**
 * Door Class - IFCDOOR implementation
 * 
 * Represents architectural doors with standardized properties following IFC standards.
 * Supports various door types, opening mechanisms, and architectural specifications.
 */
class Door extends BaseBIMObject {
  constructor(config = {}) {
    super({
      ...config,
      ifcType: IFCDOOR
    });

    // Door-specific dimensions
    this.dimensions = this.validateDoorDimensions(config.dimensions) || this.getDefaultDoorDimensions();
    
    // Door functionality properties
    this.functionality = this.validateDoorFunctionality(config.functionality) || this.getDefaultFunctionality();
    
    // Hardware properties
    this.hardware = this.validateDoorHardware(config.hardware) || this.getDefaultHardware();
    
    // Door type and classification
    this.doorType = config.doorType || 'swinging';
    this.operation = config.operation || 'single';
    
    // Opening properties
    this.openingDirection = config.openingDirection || 'inward';
    this.openingAngle = this.clamp(config.openingAngle || 90, 0, 180);
    
    // Fire and security properties
    this.safety = this.validateSafetyProperties(config.safety) || this.getDefaultSafety();
    
    // Host wall connection
    this.hostWallId = config.hostWallId || null;
    this.wallOffset = this.validatePosition(config.wallOffset) || { x: 0, y: 0, z: 0 };
  }

  /**
   * Validate door dimensions
   */
  validateDoorDimensions(dimensions) {
    if (!dimensions || typeof dimensions !== 'object') return null;
    
    return {
      width: Math.max(dimensions.width || 0.8, 0.3), // Minimum 30cm
      height: Math.max(dimensions.height || 2.1, 0.5), // Minimum 50cm
      thickness: Math.max(dimensions.thickness || 0.04, 0.01), // Minimum 1cm
      frameWidth: Math.max(dimensions.frameWidth || 0.1, 0.02), // Minimum 2cm
      frameDepth: Math.max(dimensions.frameDepth || 0.15, 0.05) // Minimum 5cm
    };
  }

  /**
   * Validate door functionality properties
   */
  validateDoorFunctionality(functionality) {
    if (!functionality || typeof functionality !== 'object') return null;
    
    return {
      isExterior: Boolean(functionality.isExterior),
      hasThreshold: Boolean(functionality.hasThreshold),
      weatherSealing: Boolean(functionality.weatherSealing),
      glazedArea: this.clamp(functionality.glazedArea || 0, 0, 1), // Percentage as decimal
      accessibility: Boolean(functionality.accessibility)
    };
  }

  /**
   * Validate door hardware properties
   */
  validateDoorHardware(hardware) {
    if (!hardware || typeof hardware !== 'object') return null;
    
    return {
      handleType: hardware.handleType || 'lever',
      lockType: hardware.lockType || 'cylinder',
      hingeType: hardware.hingeType || 'butt',
      hingeCount: Math.max(hardware.hingeCount || 3, 2), // Minimum 2 hinges
      closerType: hardware.closerType || 'none',
      hardware: hardware.hardware || []
    };
  }

  /**
   * Validate safety properties
   */
  validateSafetyProperties(safety) {
    if (!safety || typeof safety !== 'object') return null;
    
    return {
      fireRating: safety.fireRating || 'unrated',
      emergencyExit: Boolean(safety.emergencyExit),
      panicHardware: Boolean(safety.panicHardware),
      securityLevel: safety.securityLevel || 'standard',
      soundRating: this.clamp(safety.soundRating || 0, 0, 100)
    };
  }

  /**
   * Get default door dimensions
   */
  getDefaultDoorDimensions() {
    return {
      width: 0.8,
      height: 2.1,
      thickness: 0.04,
      frameWidth: 0.1,
      frameDepth: 0.15
    };
  }

  /**
   * Get default functionality properties
   */
  getDefaultFunctionality() {
    return {
      isExterior: false,
      hasThreshold: false,
      weatherSealing: false,
      glazedArea: 0,
      accessibility: false
    };
  }

  /**
   * Get default hardware properties
   */
  getDefaultHardware() {
    return {
      handleType: 'lever',
      lockType: 'cylinder',
      hingeType: 'butt',
      hingeCount: 3,
      closerType: 'none',
      hardware: []
    };
  }

  /**
   * Get default safety properties
   */
  getDefaultSafety() {
    return {
      fireRating: 'unrated',
      emergencyExit: false,
      panicHardware: false,
      securityLevel: 'standard',
      soundRating: 0
    };
  }

  /**
   * Get default material for doors
   */
  getDefaultMaterial() {
    return {
      name: 'Standard Door Material',
      color: [0.6, 0.4, 0.2], // Wood brown
      roughness: 0.7,
      metalness: 0.0,
      opacity: 1.0,
      texture: null,
      properties: {
        density: 600, // kg/m³ (typical wood door)
        thermalConductivity: 0.15, // W/mK
        fireResistance: 20 // minutes
      }
    };
  }

  /**
   * Calculate door geometry for xeokit
   */
  generateGeometry() {
    const { width, height, thickness } = this.dimensions;
    
    // Generate vertices for door panel
    const positions = [
      // Door panel (front face)
      0, 0, 0,
      width, 0, 0,
      width, height, 0,
      0, height, 0,
      // Door panel (back face)  
      0, 0, thickness,
      width, 0, thickness,
      width, height, thickness,
      0, height, thickness
    ];

    const normals = [
      // Front face
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      // Back face
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1
    ];

    const indices = [
      // Front face
      0, 1, 2, 0, 2, 3,
      // Back face
      4, 6, 5, 4, 7, 6,
      // Top face
      3, 2, 6, 3, 6, 7,
      // Bottom face
      0, 4, 5, 0, 5, 1,
      // Right face
      1, 5, 6, 1, 6, 2,
      // Left face
      0, 3, 7, 0, 7, 4
    ];

    return {
      positions: positions,
      normals: normals,
      indices: indices,
      primitive: 'triangles'
    };
  }

  /**
   * Calculate opening area based on opening angle
   */
  calculateOpeningArea() {
    const { width, height } = this.dimensions;
    const radians = (this.openingAngle * Math.PI) / 180;
    return width * height * Math.sin(radians);
  }

  /**
   * Export door for IFC/xeokit integration
   */
  toExport() {
    return {
      ...super.toExport(),
      dimensions: this.dimensions,
      functionality: this.functionality,
      hardware: this.hardware,
      safety: this.safety,
      doorType: this.doorType,
      operation: this.operation,
      openingDirection: this.openingDirection,
      openingAngle: this.openingAngle,
      hostWallId: this.hostWallId,
      wallOffset: this.wallOffset,
      geometry: this.generateGeometry(),
      openingArea: this.calculateOpeningArea()
    };
  }
}

/**
 * Window Class - IFCWINDOW implementation
 * 
 * Represents architectural windows with standardized properties following IFC standards.
 * Supports various window types, glazing specifications, and performance characteristics.
 */
class Window extends BaseBIMObject {
  constructor(config = {}) {
    super({
      ...config,
      ifcType: IFCWINDOW
    });

    // Window-specific dimensions
    this.dimensions = this.validateWindowDimensions(config.dimensions) || this.getDefaultWindowDimensions();
    
    // Glazing properties
    this.glazing = this.validateGlazingProperties(config.glazing) || this.getDefaultGlazing();
    
    // Frame properties
    this.frame = this.validateFrameProperties(config.frame) || this.getDefaultFrame();
    
    // Window type and operation
    this.windowType = config.windowType || 'fixed';
    this.operation = config.operation || 'none';
    
    // Performance properties
    this.performance = this.validatePerformanceProperties(config.performance) || this.getDefaultPerformance();
    
    // Environmental properties
    this.environmental = this.validateEnvironmentalProperties(config.environmental) || this.getDefaultEnvironmental();
    
    // Host wall connection
    this.hostWallId = config.hostWallId || null;
    this.wallOffset = this.validatePosition(config.wallOffset) || { x: 0, y: 0, z: 0 };
    this.sillHeight = Math.max(config.sillHeight || 0.9, 0); // Height from floor to window sill
  }

  /**
   * Validate window dimensions
   */
  validateWindowDimensions(dimensions) {
    if (!dimensions || typeof dimensions !== 'object') return null;
    
    return {
      width: Math.max(dimensions.width || 1.2, 0.3), // Minimum 30cm
      height: Math.max(dimensions.height || 1.5, 0.3), // Minimum 30cm
      depth: Math.max(dimensions.depth || 0.15, 0.05), // Minimum 5cm
      frameWidth: Math.max(dimensions.frameWidth || 0.05, 0.02), // Minimum 2cm
      glazingThickness: Math.max(dimensions.glazingThickness || 0.006, 0.003) // Minimum 3mm
    };
  }

  /**
   * Validate glazing properties
   */
  validateGlazingProperties(glazing) {
    if (!glazing || typeof glazing !== 'object') return null;
    
    return {
      glazingType: glazing.glazingType || 'double',
      paneCount: Math.max(glazing.paneCount || 2, 1),
      lowE: Boolean(glazing.lowE),
      tinted: Boolean(glazing.tinted),
      laminated: Boolean(glazing.laminated),
      tempered: Boolean(glazing.tempered),
      visibleTransmittance: this.clamp(glazing.visibleTransmittance || 0.8, 0, 1),
      solarHeatGainCoefficient: this.clamp(glazing.solarHeatGainCoefficient || 0.5, 0, 1)
    };
  }

  /**
   * Validate frame properties
   */
  validateFrameProperties(frame) {
    if (!frame || typeof frame !== 'object') return null;
    
    return {
      material: frame.material || 'aluminum',
      finish: frame.finish || 'anodized',
      color: this.validateColor(frame.color) || [0.8, 0.8, 0.8],
      thermalBreak: Boolean(frame.thermalBreak),
      weatherSealing: frame.weatherSealing || 'standard'
    };
  }

  /**
   * Validate performance properties
   */
  validatePerformanceProperties(performance) {
    if (!performance || typeof performance !== 'object') return null;
    
    return {
      uValue: Math.max(performance.uValue || 2.5, 0), // W/m²K
      airInfiltration: Math.max(performance.airInfiltration || 0.1, 0), // m³/h·m²
      waterResistance: performance.waterResistance || 'A',
      windLoadResistance: performance.windLoadResistance || 'B',
      acousticPerformance: this.clamp(performance.acousticPerformance || 30, 0, 100) // dB
    };
  }

  /**
   * Validate environmental properties
   */
  validateEnvironmentalProperties(environmental) {
    if (!environmental || typeof environmental !== 'object') return null;
    
    return {
      orientation: environmental.orientation || 'south',
      shading: environmental.shading || 'none',
      ventilation: Boolean(environmental.ventilation),
      daylightFactor: this.clamp(environmental.daylightFactor || 0.02, 0, 1),
      solarGain: this.clamp(environmental.solarGain || 0.5, 0, 1)
    };
  }

  /**
   * Get default window dimensions
   */
  getDefaultWindowDimensions() {
    return {
      width: 1.2,
      height: 1.5,
      depth: 0.15,
      frameWidth: 0.05,
      glazingThickness: 0.006
    };
  }

  /**
   * Get default glazing properties
   */
  getDefaultGlazing() {
    return {
      glazingType: 'double',
      paneCount: 2,
      lowE: false,
      tinted: false,
      laminated: false,
      tempered: false,
      visibleTransmittance: 0.8,
      solarHeatGainCoefficient: 0.5
    };
  }

  /**
   * Get default frame properties
   */
  getDefaultFrame() {
    return {
      material: 'aluminum',
      finish: 'anodized',
      color: [0.8, 0.8, 0.8],
      thermalBreak: false,
      weatherSealing: 'standard'
    };
  }

  /**
   * Get default performance properties
   */
  getDefaultPerformance() {
    return {
      uValue: 2.5,
      airInfiltration: 0.1,
      waterResistance: 'A',
      windLoadResistance: 'B',
      acousticPerformance: 30
    };
  }

  /**
   * Get default environmental properties
   */
  getDefaultEnvironmental() {
    return {
      orientation: 'south',
      shading: 'none',
      ventilation: false,
      daylightFactor: 0.02,
      solarGain: 0.5
    };
  }

  /**
   * Get default material for windows
   */
  getDefaultMaterial() {
    return {
      name: 'Standard Window Material',
      color: [0.9, 0.95, 1.0], // Light blue tint
      roughness: 0.1,
      metalness: 0.0,
      opacity: 0.7, // Semi-transparent
      texture: null,
      properties: {
        density: 2500, // kg/m³ (glass)
        thermalConductivity: 1.0, // W/mK
        solarTransmittance: 0.8
      }
    };
  }

  /**
   * Calculate window geometry for xeokit
   */
  generateGeometry() {
    const { width, height, depth, frameWidth } = this.dimensions;
    
    // Generate vertices for window frame and glazing
    const framePositions = [
      // Outer frame (front face)
      0, 0, 0,
      width, 0, 0,
      width, height, 0,
      0, height, 0,
      // Inner frame (glazing area)
      frameWidth, frameWidth, 0,
      width - frameWidth, frameWidth, 0,
      width - frameWidth, height - frameWidth, 0,
      frameWidth, height - frameWidth, 0,
      // Back face
      0, 0, depth,
      width, 0, depth,
      width, height, depth,
      0, height, depth
    ];

    const normals = [
      // Front faces
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      // Back faces
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1
    ];

    const indices = [
      // Frame faces (excluding glazing area)
      0, 1, 5, 0, 5, 4,  // Bottom frame
      1, 2, 6, 1, 6, 5,  // Right frame  
      2, 3, 7, 2, 7, 6,  // Top frame
      3, 0, 4, 3, 4, 7,  // Left frame
      // Glazing area
      4, 5, 6, 4, 6, 7,
      // Back face
      8, 10, 9, 8, 11, 10
    ];

    return {
      positions: framePositions,
      normals: normals,
      indices: indices,
      primitive: 'triangles'
    };
  }

  /**
   * Calculate glazing area
   */
  calculateGlazingArea() {
    const { width, height, frameWidth } = this.dimensions;
    const glazingWidth = Math.max(width - 2 * frameWidth, 0);
    const glazingHeight = Math.max(height - 2 * frameWidth, 0);
    return glazingWidth * glazingHeight;
  }

  /**
   * Calculate solar heat gain
   */
  calculateSolarHeatGain() {
    const glazingArea = this.calculateGlazingArea();
    return glazingArea * this.glazing.solarHeatGainCoefficient;
  }

  /**
   * Export window for IFC/xeokit integration
   */
  toExport() {
    return {
      ...super.toExport(),
      dimensions: this.dimensions,
      glazing: this.glazing,
      frame: this.frame,
      performance: this.performance,
      environmental: this.environmental,
      windowType: this.windowType,
      operation: this.operation,
      hostWallId: this.hostWallId,
      wallOffset: this.wallOffset,
      sillHeight: this.sillHeight,
      geometry: this.generateGeometry(),
      glazingArea: this.calculateGlazingArea(),
      solarHeatGain: this.calculateSolarHeatGain()
    };
  }
}

export { BaseBIMObject, Wall, Door, Window }; 