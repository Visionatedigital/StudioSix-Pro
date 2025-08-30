/**
 * IntelligentCADService - Advanced AI-Powered CAD Command Processing
 * 
 * Combines NLP parsing, intelligent step planning, and execution
 * Acts as the brain of the sequential execution system
 */

import NLPParser from './NLPParser.js';
import StepPlanner from './StepPlanner.js';

class IntelligentCADService {
  constructor(cadEngine) {
    this.cadEngine = cadEngine;
    this.nlpParser = new NLPParser();
    this.stepPlanner = new StepPlanner();
    
    this.conversationHistory = [];
    this.projectContext = {
      createdObjects: [],
      currentFloor: 'Ground Floor',
      workingArea: { x: 0, y: 0, width: 50, height: 50 },
      activeProject: null
    };

    console.log('🧠 IntelligentCADService: Initialized with advanced NLP and planning capabilities');
  }

  /**
   * Main processing method - takes natural language and returns execution plan
   */
  async processRequest(userInput, additionalContext = {}) {
    console.log('🧠 IntelligentCADService: Processing request:', userInput);

    try {
      // Step 1: Parse natural language
      const nlpAnalysis = this.nlpParser.parse(userInput);
      
      // Step 2: Add context from conversation history and project state
      const enrichedAnalysis = this.enrichWithContext(nlpAnalysis, additionalContext);
      
      // Step 3: Generate intelligent execution plan
      const executionPlan = this.stepPlanner.generatePlan(enrichedAnalysis);
      
      // Step 4: Validate and optimize plan
      const validatedPlan = this.validatePlan(executionPlan);
      
      // Step 5: Add to conversation history
      this.addToConversationHistory(userInput, nlpAnalysis, validatedPlan);
      
      console.log('🧠 IntelligentCADService: Generated execution plan:', validatedPlan);
      
      return {
        success: true,
        plan: validatedPlan,
        analysis: enrichedAnalysis,
        suggestions: this.generateSuggestions(enrichedAnalysis),
        confidence: enrichedAnalysis.confidence
      };

    } catch (error) {
      console.error('🧠 IntelligentCADService: Error processing request:', error);
      
      return {
        success: false,
        error: error.message,
        fallbackPlan: this.generateFallbackPlan(userInput),
        suggestions: ['Could you try rephrasing your request?', 'Try being more specific about what you want to create.']
      };
    }
  }

  /**
   * Enrich NLP analysis with conversation and project context
   */
  enrichWithContext(analysis, additionalContext) {
    let enriched = { ...analysis };
    
    // Add project context
    enriched.projectContext = {
      ...this.projectContext,
      ...additionalContext
    };

    // Resolve pronouns and references from conversation history
    enriched = this.resolveReferences(enriched);
    
    // Infer missing information from project state
    enriched = this.inferFromProjectState(enriched);
    
    // Add spatial context if objects exist
    enriched = this.addSpatialContext(enriched);

    return enriched;
  }

  /**
   * Resolve references like "it", "the room", "next to it"
   */
  resolveReferences(analysis) {
    const lastCreated = this.getLastCreatedObject();
    const recentRooms = this.getRecentlyCreatedRooms();
    
    // Replace pronouns with actual references
    if (analysis.originalInput.includes(' it ') || analysis.originalInput.includes('the ')) {
      if (lastCreated) {
        analysis.contextualReferences = {
          lastObject: lastCreated,
          referenceType: lastCreated.type
        };
      }
    }

    return analysis;
  }

  /**
   * Infer information from current project state
   */
  inferFromProjectState(analysis) {
    // If no dimensions specified, use context from existing objects
    if (analysis.dimensions.length === 0) {
      const similarObjects = this.findSimilarObjects(analysis.entities);
      if (similarObjects.length > 0) {
        analysis.inferredDimensions = this.extractDimensionsFromObjects(similarObjects);
      }
    }

    // Infer materials from project standards
    if (analysis.materials.length === 0) {
      analysis.inferredMaterials = this.getProjectStandardMaterials();
    }

    return analysis;
  }

  /**
   * Add spatial context based on existing objects
   */
  addSpatialContext(analysis) {
    const existingObjects = this.cadEngine.getAllObjects();
    
    if (existingObjects.length > 0) {
      analysis.spatialContext = {
        availableSpace: this.calculateAvailableSpace(),
        nearbyObjects: this.findNearbyObjects(analysis.spatial),
        suggestedPositions: this.suggestPositions(analysis)
      };
    }

    return analysis;
  }

  /**
   * Validate the generated plan for feasibility
   */
  validatePlan(plan) {
    const validatedPlan = { ...plan };
    const issues = [];

    // Check for space constraints
    if (this.wouldExceedWorkingArea(plan)) {
      issues.push('Plan exceeds available working area');
      validatedPlan.steps = this.adjustForSpaceConstraints(plan.steps);
    }

    // Check for material conflicts
    const materialIssues = this.checkMaterialCompatibility(plan);
    if (materialIssues.length > 0) {
      issues.push(...materialIssues);
    }

    // Check structural feasibility
    const structuralIssues = this.checkStructuralFeasibility(plan);
    if (structuralIssues.length > 0) {
      issues.push(...structuralIssues);
    }

    // Add validation results to plan
    validatedPlan.validation = {
      isValid: issues.length === 0,
      issues: issues,
      confidence: issues.length === 0 ? plan.confidence : Math.max(0.3, plan.confidence - 0.2)
    };

    return validatedPlan;
  }

  /**
   * Generate suggestions based on analysis
   */
  generateSuggestions(analysis) {
    const suggestions = [];

    // Low confidence suggestions
    if (analysis.confidence < 0.6) {
      suggestions.push(...this.nlpParser.getSuggestions(analysis));
    }

    // Contextual suggestions
    if (analysis.entities.length > 0) {
      const entity = analysis.entities[0];
      
      if (entity.type === 'room') {
        suggestions.push('Would you like me to add doors and windows?');
        suggestions.push('Should I use standard room proportions?');
      }
      
      if (entity.type === 'building') {
        suggestions.push('How many floors should the building have?');
        suggestions.push('Would you like a specific architectural style?');
      }
    }

    // Improvement suggestions
    if (analysis.dimensions.length === 0) {
      suggestions.push('Specifying dimensions will help me create exactly what you want');
    }

    if (analysis.materials.length === 0) {
      suggestions.push('I can suggest materials based on the structure type');
    }

    return suggestions;
  }

  /**
   * Generate fallback plan for failed parsing
   */
  generateFallbackPlan(userInput) {
    return {
      id: `fallback_${Date.now()}`,
      title: 'Basic Structure Creation',
      description: 'I\'ll create a basic structure based on common patterns',
      totalSteps: 1,
      steps: [{
        id: 'step_1',
        number: 1,
        title: 'Create Basic Structure',
        description: 'Creating a standard 4m × 3m room',
        action: 'createBasicRoom',
        params: { width: 4, depth: 3, height: 2.5 },
        status: 'pending',
        estimatedTime: '3 seconds'
      }],
      confidence: 0.3,
      isFallback: true
    };
  }

  /**
   * Advanced execution with real-time learning
   */
  async executeStep(step) {
    console.log('🧠 IntelligentCADService: Executing intelligent step:', step.title);

    try {
      const startTime = Date.now();
      
      // Pre-execution validation
      const canExecute = this.validateStepExecution(step);
      if (!canExecute.valid) {
        throw new Error(canExecute.reason);
      }

      // Execute with the CAD engine
      const result = await this.executeWithCADEngine(step);
      
      // Post-execution analysis
      const executionTime = Date.now() - startTime;
      this.learnFromExecution(step, result, executionTime);
      
      // Update project context
      this.updateProjectContext(step, result);

      return {
        success: true,
        result: result,
        executionTime: executionTime,
        learningData: {
          actualTime: executionTime,
          estimatedTime: step.estimatedTime
        }
      };

    } catch (error) {
      console.error('🧠 IntelligentCADService: Step execution failed:', error);
      
      return {
        success: false,
        error: error.message,
        step: step,
        suggestedFix: this.suggestStepFix(step, error)
      };
    }
  }

  /**
   * Execute step with appropriate CAD engine method
   */
  async executeWithCADEngine(step) {
    switch (step.action) {
      case 'createSlab':
        return this.cadEngine.createObject('slab', step.params);
        
      case 'createPerimeterWalls':
        return this.createPerimeterWalls(step.params);
        
      case 'createWall':
        return this.cadEngine.createObject('wall', step.params);
        
      case 'createDoor':
        return this.createDoor(step.params);
        
      case 'createWindows':
        return this.createWindows(step.params);
        
      case 'applyWallJoinery':
        return this.cadEngine.applyWallJoinery(step.params);
        
      case 'createBasicRoom':
        return this.createBasicRoom(step.params);
        
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  /**
   * Specialized CAD operations
   */
  createPerimeterWalls(params) {
    const { width, depth, height, thickness, material } = params;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const wallIds = [];

    // Create all four walls
    const walls = [
      { start: { x: -halfWidth, y: 0, z: -halfDepth }, end: { x: halfWidth, y: 0, z: -halfDepth } },
      { start: { x: halfWidth, y: 0, z: -halfDepth }, end: { x: halfWidth, y: 0, z: halfDepth } },
      { start: { x: halfWidth, y: 0, z: halfDepth }, end: { x: -halfWidth, y: 0, z: halfDepth } },
      { start: { x: -halfWidth, y: 0, z: halfDepth }, end: { x: -halfWidth, y: 0, z: -halfDepth } }
    ];

    for (const wall of walls) {
      const wallId = this.cadEngine.createObject('wall', {
        startPoint: wall.start,
        endPoint: wall.end,
        height, thickness, material
      });
      wallIds.push(wallId);
    }

    return { wallIds, count: wallIds.length };
  }

  createDoor(params) {
    // Implementation would integrate with door creation system
    console.log('🚪 Creating door with advanced parameters:', params);
    return { doorId: `door_${Date.now()}`, type: 'door' };
  }

  createWindows(params) {
    const windows = [];
    for (let i = 0; i < params.count; i++) {
      windows.push({ windowId: `window_${Date.now()}_${i}`, type: 'window' });
    }
    return { windows, count: windows.length };
  }

  createBasicRoom(params) {
    // Fallback room creation
    const slabId = this.cadEngine.createObject('slab', {
      width: params.width,
      depth: params.depth,
      thickness: 0.2,
      material: 'concrete',
      centerPosition: { x: 0, y: 0, z: 0 }
    });

    return { roomId: `room_${Date.now()}`, slabId, type: 'basic_room' };
  }

  /**
   * Learning and optimization methods
   */
  learnFromExecution(step, result, executionTime) {
    // Store execution data for future optimization
    const learningData = {
      action: step.action,
      params: step.params,
      estimatedTime: step.estimatedTime,
      actualTime: executionTime,
      success: result.success !== false,
      timestamp: new Date().toISOString()
    };

    // In a real implementation, this would update ML models or databases
    console.log('🧠 Learning from execution:', learningData);
  }

  /**
   * Utility methods
   */
  addToConversationHistory(input, analysis, plan) {
    this.conversationHistory.push({
      input,
      analysis,
      plan,
      timestamp: new Date().toISOString()
    });

    // Keep only last 10 conversations for context
    if (this.conversationHistory.length > 10) {
      this.conversationHistory.shift();
    }
  }

  updateProjectContext(step, result) {
    if (result.success !== false) {
      this.projectContext.createdObjects.push({
        step: step.title,
        action: step.action,
        result: result,
        timestamp: new Date().toISOString()
      });
    }
  }

  getLastCreatedObject() {
    return this.projectContext.createdObjects[this.projectContext.createdObjects.length - 1] || null;
  }

  getRecentlyCreatedRooms() {
    return this.projectContext.createdObjects.filter(obj => 
      obj.action.includes('room') || obj.action.includes('Room')
    );
  }

  findSimilarObjects(entities) {
    // Find existing objects similar to what user wants to create
    return this.projectContext.createdObjects.filter(obj => 
      entities.some(entity => obj.action.toLowerCase().includes(entity.type.toLowerCase()))
    );
  }

  // Placeholder implementations for validation methods
  wouldExceedWorkingArea(plan) { return false; }
  adjustForSpaceConstraints(steps) { return steps; }
  checkMaterialCompatibility(plan) { return []; }
  checkStructuralFeasibility(plan) { return []; }
  validateStepExecution(step) { return { valid: true }; }
  suggestStepFix(step, error) { return 'Try adjusting the parameters'; }
  calculateAvailableSpace() { return { width: 50, height: 50 }; }
  findNearbyObjects(spatial) { return []; }
  suggestPositions(analysis) { return []; }
  extractDimensionsFromObjects(objects) { return { width: 4, depth: 3 }; }
  getProjectStandardMaterials() { return [{ type: 'concrete', confidence: 0.8 }]; }
}

export default IntelligentCADService;