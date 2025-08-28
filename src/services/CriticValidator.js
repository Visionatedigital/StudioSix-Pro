/**
 * CriticValidator - Design quality and safety validation
 * 
 * Provides lightweight validation rules for autonomous agent actions
 * Includes architectural standards, safety constraints, and design quality checks
 */

import standaloneCADEngine from './StandaloneCADEngine';

class CriticValidator {
  constructor() {
    this.rules = new Map();
    this.loadDefaultRules();
    
    console.log('🔍 CriticValidator: Initialized with architectural validation rules');
  }

  /**
   * Main validation entry point
   * @param {Object} params - Validation parameters
   * @param {string} params.goal - Original user goal
   * @param {Object} params.action - Action that was executed  
   * @param {Object} params.result - Result from action execution
   * @param {Object} params.context - Current project context
   * @returns {Object} Validation result with ok/reason
   */
  async check({ goal, action, result, context }) {
    try {
      // If action failed, that's automatically a problem
      if (result?.ok === false) {
        return { 
          ok: false, 
          reason: result.error || 'Tool execution failed',
          category: 'execution'
        };
      }

      // Get the appropriate validator for this action
      const validator = this.getValidator(action?.tool);
      if (!validator) {
        // No specific rules for this tool, assume it's okay
        return { ok: true };
      }

      // Run the validator
      const validation = await validator({ goal, action, result, context });
      
      // Add metadata
      return {
        ...validation,
        tool: action.tool,
        timestamp: Date.now(),
        validator: validator.name || 'unknown'
      };
      
    } catch (error) {
      console.error('❌ CriticValidator: Validation error:', error);
      return { 
        ok: false, 
        reason: `Validation failed: ${error.message}`,
        category: 'validator_error'
      };
    }
  }

  /**
   * Load default architectural validation rules
   */
  loadDefaultRules() {
    // Stair validation rules (building codes)
    this.addRule('geometry.createStair', this.validateStair.bind(this));
    this.addRule('geometry.editStair', this.validateStair.bind(this));
    
    // Wall validation rules
    this.addRule('geometry.createWall', this.validateWall.bind(this));
    this.addRule('geometry.editWall', this.validateWall.bind(this));
    
    // Door and window rules
    this.addRule('geometry.createDoor', this.validateDoor.bind(this));
    this.addRule('geometry.createWindow', this.validateWindow.bind(this));
    
    // Structural validation
    this.addRule('geometry.createColumn', this.validateColumn.bind(this));
    this.addRule('geometry.createBeam', this.validateBeam.bind(this));
    
    // Spatial validation
    this.addRule('geometry.createSlab', this.validateSlab.bind(this));
    this.addRule('geometry.createRoof', this.validateRoof.bind(this));
    
    // Transform validation
    this.addRule('transform.move', this.validateTransform.bind(this));
    this.addRule('transform.rotate', this.validateTransform.bind(this));
    this.addRule('transform.scale', this.validateScale.bind(this));
  }

  /**
   * Add or update a validation rule
   */
  addRule(toolName, validator) {
    this.rules.set(toolName, validator);
    console.log(`🔍 CriticValidator: Added rule for ${toolName}`);
  }

  /**
   * Get validator function for a tool
   */
  getValidator(toolName) {
    return this.rules.get(toolName);
  }

  /**
   * Validate stair creation/modification against building codes
   */
  async validateStair({ action, result, context }) {
    const args = action.args || {};
    const { riser, tread, landingAt, width, height } = args;

    // Riser height validation (150-190mm typical)
    if (riser && (riser < 0.15 || riser > 0.19)) {
      return { 
        ok: false, 
        reason: `Riser height ${(riser * 1000).toFixed(0)}mm out of range (150-190mm)`,
        category: 'building_code'
      };
    }

    // Tread depth validation (250-320mm typical)
    if (tread && (tread < 0.25 || tread > 0.32)) {
      return { 
        ok: false, 
        reason: `Tread depth ${(tread * 1000).toFixed(0)}mm out of range (250-320mm)`,
        category: 'building_code'
      };
    }

    // 2R + T rule (typical range: 600-650mm)
    if (riser && tread) {
      const formula = (2 * riser) + tread;
      if (formula < 0.60 || formula > 0.65) {
        return {
          ok: false,
          reason: `2R + T = ${(formula * 1000).toFixed(0)}mm violates comfort rule (600-650mm)`,
          category: 'ergonomics'
        };
      }
    }

    // Landing depth validation
    if (landingAt && width && result?.measurements?.landingDepth) {
      if (result.measurements.landingDepth < width) {
        return {
          ok: false,
          reason: 'Landing depth must be at least equal to stair width',
          category: 'building_code'
        };
      }
    }

    // Maximum riser count without landing (typically 18 steps)
    if (height && riser) {
      const stepCount = Math.ceil(height / riser);
      if (stepCount > 18 && !landingAt) {
        return {
          ok: false,
          reason: `${stepCount} steps without landing exceeds limit (18 max)`,
          category: 'building_code'
        };
      }
    }

    return { ok: true, category: 'building_code' };
  }

  /**
   * Validate wall creation/modification
   */
  async validateWall({ action, result, context }) {
    const args = action.args || {};
    const { thickness, height, startPoint, endPoint } = args;

    // Wall thickness validation (minimum 100mm for structural)
    if (thickness && thickness < 0.10) {
      return {
        ok: false,
        reason: `Wall thickness ${(thickness * 1000).toFixed(0)}mm below minimum (100mm)`,
        category: 'structural'
      };
    }

    // Wall height validation (maximum 4.5m for typical residential)
    if (height && height > 4.5) {
      return {
        ok: false,
        reason: `Wall height ${height.toFixed(1)}m exceeds typical limit (4.5m)`,
        category: 'structural'
      };
    }

    // Wall length validation (minimum 0.3m)
    if (startPoint && endPoint) {
      const length = Math.sqrt(
        Math.pow(endPoint.x - startPoint.x, 2) + 
        Math.pow(endPoint.z - startPoint.z, 2)
      );
      if (length < 0.3) {
        return {
          ok: false,
          reason: `Wall length ${(length * 1000).toFixed(0)}mm below minimum (300mm)`,
          category: 'practical'
        };
      }
    }

    return { ok: true, category: 'structural' };
  }

  /**
   * Validate door creation
   */
  async validateDoor({ action, result, context }) {
    const args = action.args || {};
    const { width, height } = args;

    // Door width validation (minimum 800mm, maximum 1200mm)
    if (width) {
      if (width < 0.80) {
        return {
          ok: false,
          reason: `Door width ${(width * 1000).toFixed(0)}mm below minimum (800mm)`,
          category: 'accessibility'
        };
      }
      if (width > 1.20) {
        return {
          ok: false,
          reason: `Door width ${(width * 1000).toFixed(0)}mm exceeds typical maximum (1200mm)`,
          category: 'practical'
        };
      }
    }

    // Door height validation (minimum 2000mm, maximum 2400mm)
    if (height) {
      if (height < 2.00) {
        return {
          ok: false,
          reason: `Door height ${(height * 1000).toFixed(0)}mm below minimum (2000mm)`,
          category: 'building_code'
        };
      }
      if (height > 2.40) {
        return {
          ok: false,
          reason: `Door height ${(height * 1000).toFixed(0)}mm exceeds typical maximum (2400mm)`,
          category: 'practical'
        };
      }
    }

    return { ok: true, category: 'building_code' };
  }

  /**
   * Validate window creation
   */
  async validateWindow({ action, result, context }) {
    const args = action.args || {};
    const { width, height, sillHeight } = args;

    // Window width validation (minimum 600mm for egress)
    if (width && width < 0.60) {
      return {
        ok: false,
        reason: `Window width ${(width * 1000).toFixed(0)}mm may not meet egress requirements (600mm min)`,
        category: 'building_code'
      };
    }

    // Sill height validation (minimum 800mm for safety)
    if (sillHeight && sillHeight < 0.80) {
      return {
        ok: false,
        reason: `Sill height ${(sillHeight * 1000).toFixed(0)}mm below safety minimum (800mm)`,
        category: 'safety'
      };
    }

    return { ok: true, category: 'building_code' };
  }

  /**
   * Validate structural columns
   */
  async validateColumn({ action, result, context }) {
    const args = action.args || {};
    const { diameter, height, material } = args;

    // Column diameter validation (minimum 200mm for concrete)
    if (diameter && material === 'concrete' && diameter < 0.20) {
      return {
        ok: false,
        reason: `Concrete column diameter ${(diameter * 1000).toFixed(0)}mm below minimum (200mm)`,
        category: 'structural'
      };
    }

    // Column height validation (check slenderness ratio)
    if (diameter && height) {
      const slenderness = height / diameter;
      if (slenderness > 25) {
        return {
          ok: false,
          reason: `Column slenderness ratio ${slenderness.toFixed(1)} exceeds limit (25)`,
          category: 'structural'
        };
      }
    }

    return { ok: true, category: 'structural' };
  }

  /**
   * Validate beam dimensions
   */
  async validateBeam({ action, result, context }) {
    const args = action.args || {};
    const { width, height, span } = args;

    // Beam depth-to-span ratio (typical minimum 1:12 for timber)
    if (height && span) {
      const ratio = span / height;
      if (ratio > 20) {
        return {
          ok: false,
          reason: `Beam span-to-depth ratio ${ratio.toFixed(1)} may be inadequate (20 max typical)`,
          category: 'structural'
        };
      }
    }

    return { ok: true, category: 'structural' };
  }

  /**
   * Validate slab creation
   */
  async validateSlab({ action, result, context }) {
    const args = action.args || {};
    const { thickness, span } = args;

    // Slab thickness validation (minimum span/30 for concrete)
    if (thickness && span) {
      const minThickness = span / 30;
      if (thickness < minThickness) {
        return {
          ok: false,
          reason: `Slab thickness ${(thickness * 1000).toFixed(0)}mm insufficient for ${span.toFixed(1)}m span (min ${(minThickness * 1000).toFixed(0)}mm)`,
          category: 'structural'
        };
      }
    }

    return { ok: true, category: 'structural' };
  }

  /**
   * Validate roof creation
   */
  async validateRoof({ action, result, context }) {
    const args = action.args || {};
    const { pitch, span } = args;

    // Roof pitch validation (minimum 10 degrees for drainage)
    if (pitch && pitch < 10) {
      return {
        ok: false,
        reason: `Roof pitch ${pitch}° below minimum for proper drainage (10° min)`,
        category: 'building_code'
      };
    }

    return { ok: true, category: 'building_code' };
  }

  /**
   * Validate transform operations
   */
  async validateTransform({ action, result, context }) {
    const args = action.args || {};
    const { objectId, delta } = args;

    // Check if transform would cause object to go underground
    if (delta && delta.y < 0) {
      const obj = standaloneCADEngine.getObject(objectId);
      if (obj && obj.position.y + delta.y < -0.1) {
        return {
          ok: false,
          reason: 'Transform would place object below ground level',
          category: 'practical'
        };
      }
    }

    return { ok: true, category: 'geometric' };
  }

  /**
   * Validate scale operations
   */
  async validateScale({ action, result, context }) {
    const args = action.args || {};
    const { factor } = args;

    // Prevent extreme scaling
    if (factor && (factor < 0.1 || factor > 10.0)) {
      return {
        ok: false,
        reason: `Scale factor ${factor} is extreme (0.1-10.0 range recommended)`,
        category: 'practical'
      };
    }

    return { ok: true, category: 'geometric' };
  }

  /**
   * Get all available validation categories
   */
  getCategories() {
    return [
      'building_code',
      'structural', 
      'safety',
      'accessibility',
      'ergonomics',
      'practical',
      'geometric',
      'execution'
    ];
  }

  /**
   * Get validation statistics
   */
  getStatistics() {
    return {
      totalRules: this.rules.size,
      categories: this.getCategories(),
      rulesPerCategory: this.getCategories().reduce((acc, cat) => {
        acc[cat] = Array.from(this.rules.values()).filter(rule => 
          rule.toString().includes(cat)
        ).length;
        return acc;
      }, {})
    };
  }
}

// Export singleton instance
const criticValidator = new CriticValidator();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.criticValidator = criticValidator;
  console.log('🔍 CriticValidator available at window.criticValidator');
}

export default criticValidator;