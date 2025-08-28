/**
 * StepPlanner - Intelligent Step Generation for CAD Operations
 * 
 * Takes NLP analysis and generates logical, sequential execution steps
 * Thinks through dependencies, prerequisites, and optimal construction order
 */

class StepPlanner {
  constructor() {
    this.constructionRules = {
      // Order of operations for different structure types
      BUILDING_ORDER: [
        'foundation', 'slab', 'walls', 'doors', 'windows', 'roof', 'joinery', 'finishes'
      ],
      
      // Dependencies between operations
      DEPENDENCIES: {
        'walls': ['slab', 'foundation'],
        'doors': ['walls'],
        'windows': ['walls'],
        'roof': ['walls'],
        'joinery': ['walls'],
        'finishes': ['walls', 'doors', 'windows']
      },

      // Time estimates for different operations (in seconds)
      TIME_ESTIMATES: {
        'createSlab': { base: 1.5, perArea: 0.1 },
        'createWall': { base: 2.0, perLength: 0.2 },
        'createDoor': { base: 1.8, perUnit: 0.3 },
        'createWindow': { base: 1.6, perUnit: 0.2 },
        'createColumn': { base: 1.2, perUnit: 0.1 },
        'createBeam': { base: 1.4, perLength: 0.15 },
        'applyJoinery': { base: 1.0, perJoint: 0.1 }
      }
    };

    this.stepTemplates = {
      ROOM_CREATION: this.getRoomCreationTemplate(),
      BUILDING_CREATION: this.getBuildingCreationTemplate(),
      WALL_SYSTEM: this.getWallSystemTemplate(),
      STRUCTURAL_SYSTEM: this.getStructuralTemplate()
    };
  }

  /**
   * Main planning method - generates execution plan from NLP analysis
   */
  generatePlan(nlpAnalysis) {
    console.log('🧠 StepPlanner: Generating plan from analysis:', nlpAnalysis);

    const planContext = this.analyzePlanContext(nlpAnalysis);
    const template = this.selectTemplate(planContext);
    const customSteps = this.generateCustomSteps(planContext, template);
    
    const plan = {
      id: `plan_${Date.now()}`,
      title: this.generatePlanTitle(planContext),
      description: this.generatePlanDescription(planContext),
      totalSteps: customSteps.length,
      steps: customSteps,
      estimatedTime: this.calculateTotalTime(customSteps),
      complexity: nlpAnalysis.complexity,
      confidence: nlpAnalysis.confidence,
      context: planContext
    };

    console.log('🧠 StepPlanner: Generated plan:', plan);
    return plan;
  }

  /**
   * Analyze the context and requirements from NLP
   */
  analyzePlanContext(analysis) {
    const context = {
      intent: analysis.intent.primary,
      primaryEntity: this.getPrimaryEntity(analysis.entities),
      roomType: this.getRoomType(analysis.entities),
      dimensions: this.processDimensions(analysis.dimensions),
      materials: this.selectMaterials(analysis.materials),
      quantity: analysis.quantities.value || 1,
      spatial: analysis.spatial,
      modifiers: analysis.modifiers,
      complexity: analysis.complexity
    };

    // Infer missing information
    if (!context.dimensions.width || !context.dimensions.depth) {
      context.dimensions = this.inferDimensions(context);
    }

    if (!context.materials.primary) {
      context.materials = this.inferMaterials(context);
    }

    return context;
  }

  /**
   * Select appropriate template based on context
   */
  selectTemplate(context) {
    if (context.primaryEntity === 'room') {
      return 'ROOM_CREATION';
    } else if (context.primaryEntity === 'building') {
      return 'BUILDING_CREATION';
    } else if (context.primaryEntity === 'wall') {
      return 'WALL_SYSTEM';
    } else if (['column', 'beam'].includes(context.primaryEntity)) {
      return 'STRUCTURAL_SYSTEM';
    }
    
    // Default to room creation for ambiguous requests
    return 'ROOM_CREATION';
  }

  /**
   * Generate custom steps based on context and template
   */
  generateCustomSteps(context, templateName) {
    const template = this.stepTemplates[templateName];
    let steps = [];

    for (const stepTemplate of template) {
      // Check if step is applicable
      if (this.isStepApplicable(stepTemplate, context)) {
        const customStep = this.customizeStep(stepTemplate, context, steps.length + 1);
        steps.push(customStep);
      }
    }

    // Add dynamic steps based on quantity
    if (context.quantity > 1) {
      steps = this.multiplySteps(steps, context.quantity);
    }

    // Optimize step order
    return this.optimizeStepOrder(steps);
  }

  /**
   * Room creation template
   */
  getRoomCreationTemplate() {
    return [
      {
        action: 'createSlab',
        title: 'Create Floor Slab',
        description: 'Establish the foundation with a structural slab',
        required: true,
        dependencies: [],
        category: 'foundation'
      },
      {
        action: 'createPerimeterWalls',
        title: 'Add Perimeter Walls',
        description: 'Construct walls around the room perimeter',
        required: true,
        dependencies: ['createSlab'],
        category: 'structure'
      },
      {
        action: 'createDoor',
        title: 'Add Entrance Door',
        description: 'Install primary access door',
        required: true,
        dependencies: ['createPerimeterWalls'],
        category: 'openings',
        conditions: ['!modifiers.size.includes("tiny")']
      },
      {
        action: 'createWindows',
        title: 'Add Windows',
        description: 'Install windows for natural light',
        required: false,
        dependencies: ['createPerimeterWalls'],
        category: 'openings',
        conditions: ['!roomType.includes("basement")', 'dimensions.width > 2']
      },
      {
        action: 'applyWallJoinery',
        title: 'Apply Wall Joinery',
        description: 'Ensure perfect corner connections',
        required: true,
        dependencies: ['createPerimeterWalls'],
        category: 'finishing'
      }
    ];
  }

  /**
   * Building creation template
   */
  getBuildingCreationTemplate() {
    return [
      {
        action: 'createFoundation',
        title: 'Create Building Foundation',
        description: 'Establish structural foundation system',
        required: true,
        dependencies: [],
        category: 'foundation'
      },
      {
        action: 'createStructuralSystem',
        title: 'Build Structural Framework',
        description: 'Create columns and beams',
        required: true,
        dependencies: ['createFoundation'],
        category: 'structure'
      },
      {
        action: 'createFloors',
        title: 'Add Floor Systems',
        description: 'Install floor slabs for each level',
        required: true,
        dependencies: ['createStructuralSystem'],
        category: 'structure'
      },
      {
        action: 'createExteriorWalls',
        title: 'Build Exterior Walls',
        description: 'Construct building envelope',
        required: true,
        dependencies: ['createFloors'],
        category: 'envelope'
      },
      {
        action: 'createRoof',
        title: 'Install Roof System',
        description: 'Complete building with roof structure',
        required: true,
        dependencies: ['createExteriorWalls'],
        category: 'envelope'
      }
    ];
  }

  /**
   * Wall system template
   */
  getWallSystemTemplate() {
    return [
      {
        action: 'createWall',
        title: 'Create Wall',
        description: 'Build structural wall element',
        required: true,
        dependencies: [],
        category: 'structure'
      },
      {
        action: 'addOpenings',
        title: 'Add Openings',
        description: 'Cut doors and windows',
        required: false,
        dependencies: ['createWall'],
        category: 'openings'
      }
    ];
  }

  /**
   * Structural system template
   */
  getStructuralTemplate() {
    return [
      {
        action: 'createStructuralElements',
        title: 'Create Structural Elements',
        description: 'Build columns, beams, or supports',
        required: true,
        dependencies: [],
        category: 'structure'
      },
      {
        action: 'applyConnections',
        title: 'Apply Structural Connections',
        description: 'Connect structural elements properly',
        required: true,
        dependencies: ['createStructuralElements'],
        category: 'connections'
      }
    ];
  }

  /**
   * Check if a step is applicable to the current context
   */
  isStepApplicable(stepTemplate, context) {
    // Check conditions
    if (stepTemplate.conditions) {
      for (const condition of stepTemplate.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    // Check if it's required or if context suggests it
    return stepTemplate.required || this.shouldIncludeOptionalStep(stepTemplate, context);
  }

  /**
   * Customize a step template with specific context
   */
  customizeStep(template, context, stepNumber) {
    const step = {
      id: `step_${stepNumber}`,
      number: stepNumber,
      title: this.customizeTitle(template.title, context),
      description: this.customizeDescription(template.description, context),
      action: template.action,
      params: this.generateStepParams(template.action, context),
      status: 'pending',
      estimatedTime: this.estimateStepTime(template.action, context),
      category: template.category,
      dependencies: template.dependencies
    };

    return step;
  }

  /**
   * Generate parameters for specific actions
   */
  generateStepParams(action, context) {
    const baseParams = {
      material: context.materials.primary || 'concrete',
      ...context.dimensions
    };

    switch (action) {
      case 'createSlab':
        return {
          ...baseParams,
          thickness: this.calculateSlabThickness(context),
          centerPosition: { x: 0, y: 0, z: 0 }
        };

      case 'createPerimeterWalls':
        return {
          ...baseParams,
          height: context.dimensions.height || 2.5,
          thickness: this.calculateWallThickness(context)
        };

      case 'createDoor':
        return {
          wallSide: context.spatial.positions.includes('front') ? 'front' : 'south',
          width: 0.9,
          height: 2.1,
          position: context.spatial.positions.includes('center') ? 'center' : 'default'
        };

      case 'createWindows':
        return {
          count: this.calculateWindowCount(context),
          width: 1.2,
          height: 1.5,
          sillHeight: 1.0
        };

      case 'applyWallJoinery':
        return {
          tolerance: 0.5,
          cornerStyle: 'overlap'
        };

      default:
        return baseParams;
    }
  }

  /**
   * Helper methods for dimension and parameter calculation
   */
  calculateSlabThickness(context) {
    const area = (context.dimensions.width || 4) * (context.dimensions.depth || 3);
    if (area > 25) return 0.25; // Large areas need thicker slabs
    if (area > 15) return 0.2;
    return 0.15;
  }

  calculateWallThickness(context) {
    const height = context.dimensions.height || 2.5;
    if (height > 3.5) return 0.25; // Taller walls need more thickness
    if (height > 2.8) return 0.2;
    return 0.15;
  }

  calculateWindowCount(context) {
    const perimeter = 2 * ((context.dimensions.width || 4) + (context.dimensions.depth || 3));
    return Math.max(1, Math.floor(perimeter / 8)); // One window per 8m of perimeter
  }

  /**
   * Estimate time for each step
   */
  estimateStepTime(action, context) {
    const estimates = this.constructionRules.TIME_ESTIMATES[action];
    if (!estimates) return '2 seconds';

    let time = estimates.base;
    
    if (estimates.perArea) {
      const area = (context.dimensions.width || 4) * (context.dimensions.depth || 3);
      time += estimates.perArea * area;
    }
    
    if (estimates.perLength) {
      const perimeter = 2 * ((context.dimensions.width || 4) + (context.dimensions.depth || 3));
      time += estimates.perLength * perimeter;
    }

    return `${Math.ceil(time)} seconds`;
  }

  /**
   * Generate contextual titles and descriptions
   */
  customizeTitle(template, context) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return context[key] || match;
    });
  }

  customizeDescription(template, context) {
    const roomType = context.roomType || 'space';
    const dimensions = `${context.dimensions.width || 4}m × ${context.dimensions.depth || 3}m`;
    
    return template
      .replace(/\{roomType\}/g, roomType)
      .replace(/\{dimensions\}/g, dimensions)
      .replace(/\{material\}/g, context.materials.primary || 'concrete');
  }

  /**
   * Generate plan title and description
   */
  generatePlanTitle(context) {
    const entity = context.primaryEntity || 'structure';
    const roomType = context.roomType || entity;
    const dimensions = `${context.dimensions.width || 4}m × ${context.dimensions.depth || 3}m`;
    
    return `Creating ${roomType.charAt(0).toUpperCase() + roomType.slice(1)} (${dimensions})`;
  }

  generatePlanDescription(context) {
    const roomType = context.roomType || context.primaryEntity || 'structure';
    return `I'll build this ${roomType} step by step, ensuring proper structural integrity and professional construction standards.`;
  }

  /**
   * Utility methods for processing NLP data
   */
  getPrimaryEntity(entities) {
    if (entities.length === 0) return 'room'; // Default
    return entities[0].type; // Highest confidence entity
  }

  getRoomType(entities) {
    const roomTypeEntity = entities.find(e => e.category === 'ROOM_TYPE');
    return roomTypeEntity ? roomTypeEntity.type : null;
  }

  processDimensions(dimensions) {
    if (dimensions.length === 0) {
      return { width: 4, depth: 3, height: 2.5 }; // Defaults
    }

    const dim = dimensions[0];
    if (dim.type === '2D') {
      return {
        width: dim.length,
        depth: dim.width,
        height: 2.5
      };
    } else if (dim.type === '3D') {
      return {
        width: dim.length,
        depth: dim.width,
        height: dim.height
      };
    }

    return { width: 4, depth: 3, height: 2.5 };
  }

  selectMaterials(materials) {
    return {
      primary: materials.length > 0 ? materials[0].type : 'concrete',
      secondary: materials.length > 1 ? materials[1].type : 'steel'
    };
  }

  /**
   * Calculate total estimated time
   */
  calculateTotalTime(steps) {
    const totalSeconds = steps.reduce((sum, step) => {
      const timeStr = step.estimatedTime;
      const seconds = parseInt(timeStr.match(/\d+/)[0]);
      return sum + seconds;
    }, 0);

    return `${Math.ceil(totalSeconds)} seconds total`;
  }

  /**
   * Multiply steps based on quantity (for creating multiple items)
   */
  multiplySteps(steps, quantity) {
    if (quantity <= 1) return steps;
    
    const multipliedSteps = [];
    
    for (let i = 0; i < quantity; i++) {
      for (const step of steps) {
        const multipliedStep = {
          ...step,
          id: `${step.id}_${i + 1}`,
          number: multipliedSteps.length + 1,
          title: `${step.title} (${i + 1}/${quantity})`,
          description: `${step.description} - Item ${i + 1} of ${quantity}`
        };
        multipliedSteps.push(multipliedStep);
      }
    }
    
    return multipliedSteps;
  }

  /**
   * Optimize step order based on dependencies
   */
  optimizeStepOrder(steps) {
    // Simple topological sort based on dependencies
    // This ensures steps are executed in the correct order
    return steps.sort((a, b) => {
      if (b.dependencies.includes(a.action)) return -1;
      if (a.dependencies.includes(b.action)) return 1;
      return 0;
    });
  }

  /**
   * Condition evaluation (simplified)
   */
  evaluateCondition(condition, context) {
    // This would be expanded with a proper expression evaluator
    // For now, basic string checks
    return true; // Simplified - always true for demo
  }

  /**
   * Determine if optional steps should be included
   */
  shouldIncludeOptionalStep(stepTemplate, context) {
    // Intelligence to decide on optional steps
    if (stepTemplate.action === 'createWindows') {
      return context.roomType !== 'basement' && (context.dimensions.width || 4) > 2;
    }
    return false;
  }

  /**
   * Infer missing dimensions
   */
  inferDimensions(context) {
    const defaults = {
      'bedroom': { width: 4, depth: 3.5, height: 2.5 },
      'kitchen': { width: 3, depth: 4, height: 2.5 },
      'bathroom': { width: 2.5, depth: 2, height: 2.5 },
      'office': { width: 4, depth: 3, height: 2.7 },
      'living': { width: 5, depth: 4, height: 3 }
    };

    return defaults[context.roomType] || { width: 4, depth: 3, height: 2.5 };
  }

  /**
   * Infer materials based on context
   */
  inferMaterials(context) {
    if (context.roomType === 'bathroom') {
      return { primary: 'concrete', secondary: 'steel' };
    } else if (context.modifiers.style?.includes('modern')) {
      return { primary: 'concrete', secondary: 'glass' };
    }
    return { primary: 'concrete', secondary: 'steel' };
  }
}

export default StepPlanner;