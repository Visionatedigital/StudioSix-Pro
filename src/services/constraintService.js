import constraintSystemBindings from '../utils/constraintSystemBindings';

/**
 * Constraint Service - Direct integration with local constraint system
 * Provides local constraint solving without WebSocket/backend dependencies
 */
class ConstraintService {
  constructor() {
    this.constraintSystem = constraintSystemBindings;
    this.subscribers = new Map(); // Event subscribers
    this.isInitialized = false;
  }

  // Initialize the constraint service
  async initialize() {
    try {
      if (this.isInitialized) return true;
      
      console.log('Initializing local constraint service...');
      
      // Initialize the constraint system bindings
      await this.constraintSystem.initialize();
      
      // Subscribe to constraint system events
      this.setupEventForwarding();
      
      this.isInitialized = true;
      this.notifySubscribers('connection', { status: 'connected' });
      
      console.log('Local constraint service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to initialize constraint service:', error);
      this.notifySubscribers('error', { error });
      throw error;
    }
  }

  // Setup event forwarding from constraint system to subscribers
  setupEventForwarding() {
    // Forward constraint system events to our subscribers
    this.constraintSystem.on('entityUpdated', (data) => {
      this.notifySubscribers('entityUpdated', data.entity);
    });

    this.constraintSystem.on('constraintUpdated', (data) => {
      this.notifySubscribers('constraintUpdated', data.constraint);
    });

    this.constraintSystem.on('constraintCreated', (data) => {
      this.notifySubscribers('constraintCreated', data.constraint);
    });

    this.constraintSystem.on('constraintDeleted', (data) => {
      this.notifySubscribers('constraintDeleted', data);
    });

    this.constraintSystem.on('constraintsSolved', (data) => {
      this.notifySubscribers('solverStatus', data);
      
      // Emit individual constraint status updates
      if (data.constraints) {
        data.constraints.forEach(constraint => {
          if (constraint.satisfied) {
            this.notifySubscribers('constraintSatisfied', { constraintId: constraint.id });
          } else {
            this.notifySubscribers('constraintViolated', { constraintId: constraint.id });
          }
        });
      }
    });

    this.constraintSystem.on('entityCreated', (data) => {
      this.notifySubscribers('entityCreated', data.entity);
    });

    this.constraintSystem.on('entityDeleted', (data) => {
      this.notifySubscribers('entityDeleted', data);
    });

    this.constraintSystem.on('systemReset', (data) => {
      this.notifySubscribers('systemReset', data);
    });

    this.constraintSystem.on('updateError', (data) => {
      this.notifySubscribers('error', data);
    });
  }

  // Event subscription management (same interface as before)
  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  // Notify all subscribers of an event
  notifySubscribers(event, data) {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} subscriber:`, error);
        }
      });
    }
  }

  // === CONSTRAINT MANAGEMENT API ===

  // Create a new constraint
  async createConstraint(constraintData) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const constraint = await this.constraintSystem.createConstraint(constraintData);
      return constraint;
      
    } catch (error) {
      console.error('Failed to create constraint:', error);
      throw new Error(error.message || 'Failed to create constraint');
    }
  }

  // Get all constraints
  async getConstraints(filters = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      let constraints = await this.constraintSystem.getConstraints();
      
      // Apply filters
      if (filters.type) {
        constraints = constraints.filter(c => c.type === filters.type);
      }
      if (filters.status) {
        const satisfied = filters.status === 'satisfied';
        constraints = constraints.filter(c => c.satisfied === satisfied);
      }
      if (filters.priority) {
        constraints = constraints.filter(c => c.priority === filters.priority);
      }
      
      return { constraints };
      
    } catch (error) {
      console.error('Failed to get constraints:', error);
      throw new Error(error.message || 'Failed to get constraints');
    }
  }

  // Get a specific constraint by ID
  async getConstraint(constraintId) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const constraints = await this.constraintSystem.getConstraints();
      const constraint = constraints.find(c => c.id === constraintId);
      
      if (!constraint) {
        throw new Error(`Constraint ${constraintId} not found`);
      }
      
      return constraint;
      
    } catch (error) {
      console.error('Failed to get constraint:', error);
      throw new Error(error.message || 'Failed to get constraint');
    }
  }

  // Update an existing constraint
  async updateConstraint(constraintId, updates) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const constraint = await this.constraintSystem.updateConstraint(constraintId, updates);
      return constraint;
      
    } catch (error) {
      console.error('Failed to update constraint:', error);
      throw new Error(error.message || 'Failed to update constraint');
    }
  }

  // Delete a constraint
  async deleteConstraint(constraintId) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const success = await this.constraintSystem.deleteConstraint(constraintId);
      return { success };
      
    } catch (error) {
      console.error('Failed to delete constraint:', error);
      throw new Error(error.message || 'Failed to delete constraint');
    }
  }

  // === ENTITY MANAGEMENT API ===

  // Get all geometric entities
  async getEntities(filters = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      let entities = await this.constraintSystem.getEntities();
      
      // Apply filters
      if (filters.type) {
        entities = entities.filter(e => e.type === filters.type);
      }
      
      return { entities };
      
    } catch (error) {
      console.error('Failed to get entities:', error);
      throw new Error(error.message || 'Failed to get entities');
    }
  }

  // Get a specific entity by ID
  async getEntity(entityId) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const entities = await this.constraintSystem.getEntities();
      const entity = entities.find(e => e.id === entityId);
      
      if (!entity) {
        throw new Error(`Entity ${entityId} not found`);
      }
      
      return entity;
      
    } catch (error) {
      console.error('Failed to get entity:', error);
      throw new Error(error.message || 'Failed to get entity');
    }
  }

  // Update entity properties
  async updateEntity(entityId, updates) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const entity = await this.constraintSystem.updateEntity(entityId, updates);
      return entity;
      
    } catch (error) {
      console.error('Failed to update entity:', error);
      throw new Error(error.message || 'Failed to update entity');
    }
  }

  // Create a new entity
  async createEntity(type, properties) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const entity = await this.constraintSystem.createEntity(type, properties);
      return entity;
      
    } catch (error) {
      console.error('Failed to create entity:', error);
      throw new Error(error.message || 'Failed to create entity');
    }
  }

  // Delete an entity
  async deleteEntity(entityId) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const success = await this.constraintSystem.deleteEntity(entityId);
      return { success };
      
    } catch (error) {
      console.error('Failed to delete entity:', error);
      throw new Error(error.message || 'Failed to delete entity');
    }
  }

  // === CONSTRAINT SOLVER API ===

  // Solve constraints
  async solveConstraints(options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const result = await this.constraintSystem.solveConstraints(options);
      return result;
      
    } catch (error) {
      console.error('Failed to solve constraints:', error);
      throw new Error(error.message || 'Failed to solve constraints');
    }
  }

  // Get solver status
  async getSolverStatus() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const status = await this.constraintSystem.getSystemStatus();
      return status;
      
    } catch (error) {
      console.error('Failed to get solver status:', error);
      throw new Error(error.message || 'Failed to get solver status');
    }
  }

  // Validate constraints without solving
  async validateConstraints(constraintIds = []) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const validation = await this.constraintSystem.validateConstraints();
      
      // Filter results if specific constraint IDs provided
      if (constraintIds.length > 0) {
        const filtered = {
          ...validation,
          issues: validation.issues.filter(issue => 
            constraintIds.includes(issue.constraintId)
          )
        };
        return filtered;
      }
      
      return validation;
      
    } catch (error) {
      console.error('Failed to validate constraints:', error);
      throw new Error(error.message || 'Failed to validate constraints');
    }
  }

  // === CONSTRAINT SYSTEM MANAGEMENT ===

  // Get system status and metrics
  async getSystemStatus() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const status = await this.constraintSystem.getSystemStatus();
      return status;
      
    } catch (error) {
      console.error('Failed to get system status:', error);
      throw new Error(error.message || 'Failed to get system status');
    }
  }

  // Reset constraint system
  async resetSystem() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      await this.constraintSystem.resetSystem();
      return { success: true };
      
    } catch (error) {
      console.error('Failed to reset system:', error);
      throw new Error(error.message || 'Failed to reset system');
    }
  }

  // Export constraints and entities
  async exportSystem(format = 'json') {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const entities = await this.constraintSystem.getEntities();
      const constraints = await this.constraintSystem.getConstraints();
      const status = await this.constraintSystem.getSystemStatus();
      
      const exportData = {
        format,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        system: status,
        entities,
        constraints
      };
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json'
        });
        return blob;
      }
      
      throw new Error(`Unsupported export format: ${format}`);
      
    } catch (error) {
      console.error('Failed to export system:', error);
      throw new Error(error.message || 'Failed to export system');
    }
  }

  // Import constraints and entities
  async importSystem(file) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate import data
      if (!importData.entities || !importData.constraints) {
        throw new Error('Invalid import data format');
      }
      
      // Reset system first
      await this.constraintSystem.resetSystem();
      
      // Import entities
      for (const entityData of importData.entities) {
        await this.constraintSystem.createEntity(entityData.type, entityData);
      }
      
      // Import constraints
      for (const constraintData of importData.constraints) {
        await this.constraintSystem.createConstraint(constraintData);
      }
      
      return { 
        success: true, 
        entitiesImported: importData.entities.length,
        constraintsImported: importData.constraints.length
      };
      
    } catch (error) {
      console.error('Failed to import system:', error);
      throw new Error(error.message || 'Failed to import system');
    }
  }

  // === UTILITY METHODS ===

  // Cleanup resources
  cleanup() {
    this.subscribers.clear();
    if (this.constraintSystem) {
      this.constraintSystem.cleanup();
    }
  }

  // Check if service is initialized
  isConnected() {
    return this.isInitialized;
  }

  // Get connection status
  getConnectionStatus() {
    return this.isInitialized ? 'connected' : 'disconnected';
  }

  // Force initialization (useful for testing)
  async forceInitialize() {
    this.isInitialized = false;
    return await this.initialize();
  }

  // Get performance metrics
  getPerformanceMetrics() {
    if (!this.isInitialized) return null;
    return this.constraintSystem.getPerformanceMetrics();
  }

  // Get memory usage
  getMemoryUsage() {
    if (!this.isInitialized) return null;
    return this.constraintSystem.getMemoryUsage();
  }
}

// Export singleton instance
const constraintService = new ConstraintService();
export default constraintService; 