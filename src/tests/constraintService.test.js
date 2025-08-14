/**
 * Constraint Service Integration Tests
 * Tests for the service layer that bridges the constraint system with the UI
 */

import constraintService from '../services/constraintService';

describe('Constraint Service Integration', () => {
  beforeEach(async () => {
    // Ensure service is initialized
    await constraintService.initialize();
  });

  afterEach(() => {
    constraintService.cleanup();
  });

  describe('Service Initialization', () => {
    test('should initialize successfully', async () => {
      expect(constraintService.isConnected()).toBe(true);
      expect(constraintService.getConnectionStatus()).toBe('connected');
    });

    test('should handle multiple initialization calls', async () => {
      await constraintService.initialize();
      await constraintService.initialize(); // Should not throw
      expect(constraintService.isConnected()).toBe(true);
    });

    test('should provide performance metrics', () => {
      const metrics = constraintService.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });

    test('should provide memory usage info', () => {
      const usage = constraintService.getMemoryUsage();
      expect(usage).toBeDefined();
      expect(usage.entities).toBeDefined();
      expect(usage.constraints).toBeDefined();
    });
  });

  describe('Entity Management API', () => {
    test('should create and retrieve entities', async () => {
      const entity = await constraintService.createEntity('point', {
        x: 1.0,
        y: 2.0,
        z: 3.0
      });

      expect(entity.id).toBeDefined();
      expect(entity.type).toBe('point');

      const retrieved = await constraintService.getEntity(entity.id);
      expect(retrieved.id).toBe(entity.id);
      expect(retrieved.x).toBe(1.0);
    });

    test('should list entities with filters', async () => {
      await constraintService.createEntity('point', { x: 0, y: 0, z: 0 });
      await constraintService.createEntity('line', {
        startX: 0, startY: 0, startZ: 0,
        endX: 1, endY: 1, endZ: 0
      });

      const allEntities = await constraintService.getEntities();
      expect(allEntities.entities.length).toBe(2);

      const pointsOnly = await constraintService.getEntities({ type: 'point' });
      expect(pointsOnly.entities.length).toBe(1);
      expect(pointsOnly.entities[0].type).toBe('point');
    });

    test('should update entity properties', async () => {
      const entity = await constraintService.createEntity('point', {
        x: 1.0,
        y: 2.0,
        z: 3.0
      });

      const updated = await constraintService.updateEntity(entity.id, {
        x: 5.0,
        y: 6.0
      });

      expect(updated.x).toBe(5.0);
      expect(updated.y).toBe(6.0);
      expect(updated.z).toBe(3.0); // Should remain unchanged
    });

    test('should delete entities', async () => {
      const entity = await constraintService.createEntity('point', {
        x: 1.0,
        y: 2.0,
        z: 3.0
      });

      const result = await constraintService.deleteEntity(entity.id);
      expect(result.success).toBe(true);

      await expect(constraintService.getEntity(entity.id))
        .rejects.toThrow('Entity');
    });

    test('should handle non-existent entity requests', async () => {
      await expect(constraintService.getEntity('nonexistent'))
        .rejects.toThrow('Entity nonexistent not found');
    });
  });

  describe('Constraint Management API', () => {
    let point1, point2;

    beforeEach(async () => {
      point1 = await constraintService.createEntity('point', { x: 0, y: 0, z: 0 });
      point2 = await constraintService.createEntity('point', { x: 1, y: 0, z: 0 });
    });

    test('should create and retrieve constraints', async () => {
      const constraint = await constraintService.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0,
        priority: 'normal'
      });

      expect(constraint.id).toBeDefined();
      expect(constraint.type).toBe('distance');

      const retrieved = await constraintService.getConstraint(constraint.id);
      expect(retrieved.id).toBe(constraint.id);
      expect(retrieved.parameters.value).toBe(2.0);
    });

    test('should list constraints with filters', async () => {
      await constraintService.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0,
        priority: 'high'
      });

      const line1 = await constraintService.createEntity('line', {
        startX: 0, startY: 0, startZ: 0,
        endX: 1, endY: 0, endZ: 0
      });
      const line2 = await constraintService.createEntity('line', {
        startX: 0, startY: 1, startZ: 0,
        endX: 1, endY: 1, endZ: 0
      });

      await constraintService.createConstraint({
        type: 'parallel',
        entities: [line1.id, line2.id],
        priority: 'normal'
      });

      const allConstraints = await constraintService.getConstraints();
      expect(allConstraints.constraints.length).toBe(2);

      const distanceOnly = await constraintService.getConstraints({ type: 'distance' });
      expect(distanceOnly.constraints.length).toBe(1);
      expect(distanceOnly.constraints[0].type).toBe('distance');

      const highPriority = await constraintService.getConstraints({ priority: 'high' });
      expect(highPriority.constraints.length).toBe(1);
      expect(highPriority.constraints[0].priority).toBe('high');
    });

    test('should update constraint properties', async () => {
      const constraint = await constraintService.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0,
        priority: 'normal'
      });

      const updated = await constraintService.updateConstraint(constraint.id, {
        value: 3.0,
        priority: 'high'
      });

      expect(updated.parameters.value).toBe(3.0);
      expect(updated.priority).toBe('high');
    });

    test('should delete constraints', async () => {
      const constraint = await constraintService.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      const result = await constraintService.deleteConstraint(constraint.id);
      expect(result.success).toBe(true);

      await expect(constraintService.getConstraint(constraint.id))
        .rejects.toThrow('Constraint');
    });

    test('should handle non-existent constraint requests', async () => {
      await expect(constraintService.getConstraint('nonexistent'))
        .rejects.toThrow('Constraint nonexistent not found');
    });
  });

  describe('Solver Integration', () => {
    test('should solve constraints and return results', async () => {
      const point1 = await constraintService.createEntity('point', { x: 0, y: 0, z: 0 });
      const point2 = await constraintService.createEntity('point', { x: 1, y: 0, z: 0 });

      await constraintService.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      const result = await constraintService.solveConstraints();

      expect(result.success).toBe(true);
      expect(result.converged).toBe(true);
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.entities).toBeDefined();
      expect(result.constraints).toBeDefined();
    });

    test('should get solver status', async () => {
      const status = await constraintService.getSolverStatus();

      expect(status).toBeDefined();
      expect(status.initialized).toBe(true);
      expect(status.entityCount).toBeDefined();
      expect(status.constraintCount).toBeDefined();
    });

    test('should validate constraints', async () => {
      const point1 = await constraintService.createEntity('point', { x: 0, y: 0, z: 0 });
      const point2 = await constraintService.createEntity('point', { x: 1, y: 0, z: 0 });

      const constraint = await constraintService.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      const validation = await constraintService.validateConstraints([constraint.id]);

      expect(validation.valid).toBeDefined();
      expect(validation.issues).toBeDefined();
    });

    test('should handle solver configuration options', async () => {
      const point1 = await constraintService.createEntity('point', { x: 0, y: 0, z: 0 });
      const point2 = await constraintService.createEntity('point', { x: 1, y: 0, z: 0 });

      await constraintService.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      const result = await constraintService.solveConstraints({
        maxIterations: 50,
        tolerance: 1e-6,
        algorithm: 'iterative'
      });

      expect(result.config.maxIterations).toBe(50);
      expect(result.config.tolerance).toBe(1e-6);
      expect(result.config.algorithm).toBe('iterative');
    });
  });

  describe('System Management', () => {
    test('should get system status', async () => {
      const status = await constraintService.getSystemStatus();

      expect(status.initialized).toBe(true);
      expect(status.entityCount).toBeDefined();
      expect(status.constraintCount).toBeDefined();
      expect(status.memory).toBeDefined();
      expect(status.performance).toBeDefined();
    });

    test('should reset system', async () => {
      // Create some data
      await constraintService.createEntity('point', { x: 1, y: 2, z: 3 });
      const point1 = await constraintService.createEntity('point', { x: 0, y: 0, z: 0 });
      const point2 = await constraintService.createEntity('point', { x: 1, y: 0, z: 0 });
      await constraintService.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      // Verify data exists
      const entitiesBefore = await constraintService.getEntities();
      const constraintsBefore = await constraintService.getConstraints();
      expect(entitiesBefore.entities.length).toBeGreaterThan(0);
      expect(constraintsBefore.constraints.length).toBeGreaterThan(0);

      // Reset
      const result = await constraintService.resetSystem();
      expect(result.success).toBe(true);

      // Verify data is cleared
      const entitiesAfter = await constraintService.getEntities();
      const constraintsAfter = await constraintService.getConstraints();
      expect(entitiesAfter.entities.length).toBe(0);
      expect(constraintsAfter.constraints.length).toBe(0);
    });
  });

  describe('Import/Export', () => {
    test('should export system data', async () => {
      // Create some test data
      const point1 = await constraintService.createEntity('point', { x: 0, y: 0, z: 0 });
      const point2 = await constraintService.createEntity('point', { x: 1, y: 0, z: 0 });
      await constraintService.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      const blob = await constraintService.exportSystem('json');

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');

      // Verify content
      const text = await blob.text();
      const data = JSON.parse(text);
      expect(data.format).toBe('json');
      expect(data.entities).toBeDefined();
      expect(data.constraints).toBeDefined();
      expect(data.entities.length).toBe(2);
      expect(data.constraints.length).toBe(1);
    });

    test('should import system data', async () => {
      // Create export data
      const exportData = {
        format: 'json',
        version: '1.0.0',
        entities: [
          { id: 'entity_1', type: 'point', x: 1, y: 2, z: 3 },
          { id: 'entity_2', type: 'point', x: 4, y: 5, z: 6 }
        ],
        constraints: [
          {
            id: 'constraint_1',
            type: 'distance',
            entities: ['entity_1', 'entity_2'],
            parameters: { value: 2.0 },
            priority: 'normal'
          }
        ]
      };

      const file = new Blob([JSON.stringify(exportData)], { type: 'application/json' });

      const result = await constraintService.importSystem(file);

      expect(result.success).toBe(true);
      expect(result.entitiesImported).toBe(2);
      expect(result.constraintsImported).toBe(1);

      // Verify imported data
      const entities = await constraintService.getEntities();
      const constraints = await constraintService.getConstraints();
      expect(entities.entities.length).toBe(2);
      expect(constraints.constraints.length).toBe(1);
    });

    test('should handle invalid import data', async () => {
      const invalidData = { invalid: 'data' };
      const file = new Blob([JSON.stringify(invalidData)], { type: 'application/json' });

      await expect(constraintService.importSystem(file))
        .rejects.toThrow('Invalid import data format');
    });
  });

  describe('Event Subscription', () => {
    test('should subscribe to events', (done) => {
      const unsubscribe = constraintService.subscribe('entityCreated', (entity) => {
        expect(entity.type).toBe('point');
        unsubscribe();
        done();
      });

      constraintService.createEntity('point', { x: 1, y: 2, z: 3 });
    });

    test('should unsubscribe from events', () => {
      let eventFired = false;
      const unsubscribe = constraintService.subscribe('entityCreated', () => {
        eventFired = true;
      });

      unsubscribe();
      constraintService.createEntity('point', { x: 1, y: 2, z: 3 });

      // Give event time to fire
      setTimeout(() => {
        expect(eventFired).toBe(false);
      }, 100);
    });

    test('should handle multiple subscribers', (done) => {
      let count = 0;
      const checkComplete = () => {
        count++;
        if (count === 2) done();
      };

      const unsubscribe1 = constraintService.subscribe('entityCreated', checkComplete);
      const unsubscribe2 = constraintService.subscribe('entityCreated', checkComplete);

      constraintService.createEntity('point', { x: 1, y: 2, z: 3 });

      // Cleanup
      setTimeout(() => {
        unsubscribe1();
        unsubscribe2();
      }, 200);
    });
  });

  describe('Error Handling', () => {
    test('should handle service errors gracefully', async () => {
      // Try to operate on non-existent entities
      await expect(constraintService.updateEntity('nonexistent', { x: 1 }))
        .rejects.toThrow();

      await expect(constraintService.deleteEntity('nonexistent'))
        .rejects.toThrow();
    });

    test('should handle constraint errors gracefully', async () => {
      await expect(constraintService.updateConstraint('nonexistent', { value: 1 }))
        .rejects.toThrow();

      await expect(constraintService.deleteConstraint('nonexistent'))
        .rejects.toThrow();
    });

    test('should handle invalid constraint creation', async () => {
      await expect(constraintService.createConstraint({
        type: 'distance',
        entities: ['nonexistent1', 'nonexistent2'],
        value: 2.0
      })).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    test('should handle concurrent operations', async () => {
      const promises = [];

      // Create entities concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(constraintService.createEntity('point', { 
          x: i, y: i, z: 0 
        }));
      }

      const entities = await Promise.all(promises);
      expect(entities.length).toBe(10);

      const allEntities = await constraintService.getEntities();
      expect(allEntities.entities.length).toBe(10);
    });

    test('should maintain performance under load', async () => {
      const entityCount = 50;
      const startTime = performance.now();

      // Create many entities
      for (let i = 0; i < entityCount; i++) {
        await constraintService.createEntity('point', { 
          x: Math.random() * 10, 
          y: Math.random() * 10, 
          z: 0 
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(2000); // Should complete in under 2 seconds

      const entities = await constraintService.getEntities();
      expect(entities.entities.length).toBe(entityCount);
    });
  });
}); 