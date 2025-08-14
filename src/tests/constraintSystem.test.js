/**
 * Constraint System Unit Tests
 * Comprehensive test suite for the local constraint system bindings
 */

import constraintSystemBindings from '../utils/constraintSystemBindings';

describe('Constraint System Bindings', () => {
  let constraintSystem;

  beforeEach(async () => {
    constraintSystem = constraintSystemBindings;
    await constraintSystem.initialize();
  });

  afterEach(() => {
    constraintSystem.cleanup();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      expect(constraintSystem.isInitialized).toBe(true);
    });

    test('should have constraint manager', () => {
      expect(constraintSystem.constraintManager).toBeDefined();
      expect(constraintSystem.constraintManager.entities).toBeDefined();
      expect(constraintSystem.constraintManager.constraints).toBeDefined();
    });

    test('should have constraint solver', () => {
      expect(constraintSystem.constraintSolver).toBeDefined();
      expect(typeof constraintSystem.constraintSolver.solve).toBe('function');
    });

    test('should have update engine', () => {
      expect(constraintSystem.updateEngine).toBeDefined();
      expect(constraintSystem.updateEngine.updateQueue).toBeDefined();
    });
  });

  describe('Entity Management', () => {
    test('should create point entity', async () => {
      const entity = await constraintSystem.createEntity('point', {
        x: 1.0,
        y: 2.0,
        z: 3.0
      });

      expect(entity).toBeDefined();
      expect(entity.type).toBe('point');
      expect(entity.x).toBe(1.0);
      expect(entity.y).toBe(2.0);
      expect(entity.z).toBe(3.0);
      expect(entity.id).toMatch(/^entity_/);
    });

    test('should create line entity', async () => {
      const entity = await constraintSystem.createEntity('line', {
        startX: 0.0,
        startY: 0.0,
        startZ: 0.0,
        endX: 1.0,
        endY: 1.0,
        endZ: 0.0
      });

      expect(entity).toBeDefined();
      expect(entity.type).toBe('line');
      expect(entity.startX).toBe(0.0);
      expect(entity.endX).toBe(1.0);
    });

    test('should create circle entity', async () => {
      const entity = await constraintSystem.createEntity('circle', {
        centerX: 0.0,
        centerY: 0.0,
        centerZ: 0.0,
        radius: 5.0
      });

      expect(entity).toBeDefined();
      expect(entity.type).toBe('circle');
      expect(entity.radius).toBe(5.0);
    });

    test('should update entity properties', async () => {
      const entity = await constraintSystem.createEntity('point', {
        x: 1.0,
        y: 2.0,
        z: 3.0
      });

      const updatedEntity = await constraintSystem.updateEntity(entity.id, {
        x: 5.0,
        y: 6.0
      });

      expect(updatedEntity.x).toBe(5.0);
      expect(updatedEntity.y).toBe(6.0);
      expect(updatedEntity.z).toBe(3.0); // Should remain unchanged
    });

    test('should delete entity', async () => {
      const entity = await constraintSystem.createEntity('point', {
        x: 1.0,
        y: 2.0,
        z: 3.0
      });

      const success = await constraintSystem.deleteEntity(entity.id);
      expect(success).toBe(true);

      const entities = await constraintSystem.getEntities();
      expect(entities.find(e => e.id === entity.id)).toBeUndefined();
    });

    test('should list all entities', async () => {
      await constraintSystem.createEntity('point', { x: 1, y: 2, z: 3 });
      await constraintSystem.createEntity('line', { 
        startX: 0, startY: 0, startZ: 0,
        endX: 1, endY: 1, endZ: 0 
      });

      const entities = await constraintSystem.getEntities();
      expect(entities.length).toBe(2);
      expect(entities.find(e => e.type === 'point')).toBeDefined();
      expect(entities.find(e => e.type === 'line')).toBeDefined();
    });
  });

  describe('Constraint Management', () => {
    let point1, point2, line1, line2;

    beforeEach(async () => {
      point1 = await constraintSystem.createEntity('point', { x: 0, y: 0, z: 0 });
      point2 = await constraintSystem.createEntity('point', { x: 1, y: 0, z: 0 });
      line1 = await constraintSystem.createEntity('line', {
        startX: 0, startY: 0, startZ: 0,
        endX: 1, endY: 0, endZ: 0
      });
      line2 = await constraintSystem.createEntity('line', {
        startX: 0, startY: 1, startZ: 0,
        endX: 1, endY: 1, endZ: 0
      });
    });

    test('should create distance constraint', async () => {
      const constraint = await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0,
        priority: 'normal'
      });

      expect(constraint).toBeDefined();
      expect(constraint.type).toBe('distance');
      expect(constraint.entities).toEqual([point1.id, point2.id]);
      expect(constraint.parameters.value).toBe(2.0);
      expect(constraint.id).toMatch(/^constraint_/);
    });

    test('should create parallel constraint', async () => {
      const constraint = await constraintSystem.createConstraint({
        type: 'parallel',
        entities: [line1.id, line2.id],
        priority: 'high'
      });

      expect(constraint).toBeDefined();
      expect(constraint.type).toBe('parallel');
      expect(constraint.entities).toEqual([line1.id, line2.id]);
    });

    test('should create perpendicular constraint', async () => {
      const constraint = await constraintSystem.createConstraint({
        type: 'perpendicular',
        entities: [line1.id, line2.id],
        priority: 'normal'
      });

      expect(constraint).toBeDefined();
      expect(constraint.type).toBe('perpendicular');
    });

    test('should create coincident constraint', async () => {
      const constraint = await constraintSystem.createConstraint({
        type: 'coincident',
        entities: [point1.id, point2.id],
        priority: 'critical'
      });

      expect(constraint).toBeDefined();
      expect(constraint.type).toBe('coincident');
    });

    test('should create fixed constraint', async () => {
      const constraint = await constraintSystem.createConstraint({
        type: 'fixed',
        entities: [point1.id],
        priority: 'high'
      });

      expect(constraint).toBeDefined();
      expect(constraint.type).toBe('fixed');
      expect(constraint.entities.length).toBe(1);
    });

    test('should create angle constraint', async () => {
      const constraint = await constraintSystem.createConstraint({
        type: 'angle',
        entities: [line1.id, line2.id],
        value: 90.0,
        priority: 'normal'
      });

      expect(constraint).toBeDefined();
      expect(constraint.type).toBe('angle');
      expect(constraint.parameters.value).toBe(90.0);
    });

    test('should update constraint properties', async () => {
      const constraint = await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      const updatedConstraint = await constraintSystem.updateConstraint(constraint.id, {
        value: 3.0,
        priority: 'high'
      });

      expect(updatedConstraint.parameters.value).toBe(3.0);
      expect(updatedConstraint.priority).toBe('high');
    });

    test('should delete constraint', async () => {
      const constraint = await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      const success = await constraintSystem.deleteConstraint(constraint.id);
      expect(success).toBe(true);

      const constraints = await constraintSystem.getConstraints();
      expect(constraints.find(c => c.id === constraint.id)).toBeUndefined();
    });

    test('should list all constraints', async () => {
      await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });
      await constraintSystem.createConstraint({
        type: 'parallel',
        entities: [line1.id, line2.id]
      });

      const constraints = await constraintSystem.getConstraints();
      expect(constraints.length).toBe(2);
      expect(constraints.find(c => c.type === 'distance')).toBeDefined();
      expect(constraints.find(c => c.type === 'parallel')).toBeDefined();
    });
  });

  describe('Constraint Solver', () => {
    let point1, point2;

    beforeEach(async () => {
      point1 = await constraintSystem.createEntity('point', { x: 0, y: 0, z: 0 });
      point2 = await constraintSystem.createEntity('point', { x: 1, y: 0, z: 0 });
    });

    test('should solve distance constraint', async () => {
      // Create a distance constraint
      await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      const result = await constraintSystem.solveConstraints();

      expect(result.success).toBe(true);
      expect(result.converged).toBe(true);
      expect(result.iterations).toBeGreaterThan(0);
      
      const entities = await constraintSystem.getEntities();
      const updatedPoint1 = entities.find(e => e.id === point1.id);
      const updatedPoint2 = entities.find(e => e.id === point2.id);
      
      // Calculate actual distance
      const dx = updatedPoint2.x - updatedPoint1.x;
      const dy = updatedPoint2.y - updatedPoint1.y;
      const dz = updatedPoint2.z - updatedPoint1.z;
      const actualDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      expect(actualDistance).toBeCloseTo(2.0, 3);
    });

    test('should handle coincident constraint', async () => {
      // Move points apart first
      await constraintSystem.updateEntity(point2.id, { x: 5, y: 5, z: 0 });

      // Create coincident constraint
      await constraintSystem.createConstraint({
        type: 'coincident',
        entities: [point1.id, point2.id]
      });

      const result = await constraintSystem.solveConstraints();

      expect(result.success).toBe(true);
      
      const entities = await constraintSystem.getEntities();
      const updatedPoint1 = entities.find(e => e.id === point1.id);
      const updatedPoint2 = entities.find(e => e.id === point2.id);
      
      // Points should be at same position (or very close)
      expect(Math.abs(updatedPoint1.x - updatedPoint2.x)).toBeLessThan(0.01);
      expect(Math.abs(updatedPoint1.y - updatedPoint2.y)).toBeLessThan(0.01);
      expect(Math.abs(updatedPoint1.z - updatedPoint2.z)).toBeLessThan(0.01);
    });

    test('should handle parallel lines constraint', async () => {
      const line1 = await constraintSystem.createEntity('line', {
        startX: 0, startY: 0, startZ: 0,
        endX: 1, endY: 1, endZ: 0
      });
      const line2 = await constraintSystem.createEntity('line', {
        startX: 0, startY: 1, startZ: 0,
        endX: 2, endY: 0, endZ: 0
      });

      await constraintSystem.createConstraint({
        type: 'parallel',
        entities: [line1.id, line2.id]
      });

      const result = await constraintSystem.solveConstraints();

      expect(result.success).toBe(true);
      
      const constraints = await constraintSystem.getConstraints();
      const parallelConstraint = constraints.find(c => c.type === 'parallel');
      expect(Math.abs(parallelConstraint.violation)).toBeLessThan(0.01);
    });

    test('should handle multiple constraints', async () => {
      const point3 = await constraintSystem.createEntity('point', { x: 2, y: 0, z: 0 });

      // Create multiple constraints
      await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 1.0
      });
      await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point2.id, point3.id],
        value: 1.0
      });
      await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point3.id],
        value: Math.sqrt(2) // Forms a right triangle
      });

      const result = await constraintSystem.solveConstraints();

      expect(result.success).toBe(true);
      expect(result.constraints.every(c => c.satisfied)).toBe(true);
    });

    test('should detect conflicting constraints', async () => {
      // Create conflicting distance constraints
      await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 1.0
      });
      await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0 // Conflicting distance
      });

      const result = await constraintSystem.solveConstraints();

      // Should still attempt to solve but may not fully satisfy all constraints
      expect(result.violatedConstraints.length).toBeGreaterThan(0);
    });

    test('should respect solver configuration', async () => {
      await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      const result = await constraintSystem.solveConstraints({
        maxIterations: 10,
        tolerance: 1e-3,
        algorithm: 'iterative'
      });

      expect(result.config.maxIterations).toBe(10);
      expect(result.config.tolerance).toBe(1e-3);
      expect(result.config.algorithm).toBe('iterative');
      expect(result.iterations).toBeLessThanOrEqual(10);
    });
  });

  describe('System Validation', () => {
    test('should validate clean system', async () => {
      const validation = await constraintSystem.validateConstraints();
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should detect orphaned constraints', async () => {
      const point1 = await constraintSystem.createEntity('point', { x: 0, y: 0, z: 0 });
      const point2 = await constraintSystem.createEntity('point', { x: 1, y: 0, z: 0 });
      
      const constraint = await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      // Delete one of the entities
      await constraintSystem.deleteEntity(point2.id);

      const validation = await constraintSystem.validateConstraints();
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBe(1);
      expect(validation.issues[0].type).toBe('orphaned_constraint');
      expect(validation.issues[0].constraintId).toBe(constraint.id);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large number of entities', async () => {
      const entityCount = 100;
      const startTime = performance.now();

      // Create many entities
      for (let i = 0; i < entityCount; i++) {
        await constraintSystem.createEntity('point', { 
          x: Math.random() * 10, 
          y: Math.random() * 10, 
          z: 0 
        });
      }

      const endTime = performance.now();
      const creationTime = endTime - startTime;

      expect(creationTime).toBeLessThan(1000); // Should create 100 entities in under 1 second

      const entities = await constraintSystem.getEntities();
      expect(entities.length).toBe(entityCount);
    });

    test('should handle large number of constraints', async () => {
      // Create entities for constraints
      const entities = [];
      for (let i = 0; i < 10; i++) {
        entities.push(await constraintSystem.createEntity('point', { 
          x: i, y: 0, z: 0 
        }));
      }

      const constraintCount = 50;
      const startTime = performance.now();

      // Create many constraints
      for (let i = 0; i < constraintCount; i++) {
        const entity1 = entities[i % entities.length];
        const entity2 = entities[(i + 1) % entities.length];
        
        await constraintSystem.createConstraint({
          type: 'distance',
          entities: [entity1.id, entity2.id],
          value: 1.0 + Math.random()
        });
      }

      const endTime = performance.now();
      const creationTime = endTime - startTime;

      expect(creationTime).toBeLessThan(2000); // Should create constraints reasonably fast

      const constraints = await constraintSystem.getConstraints();
      expect(constraints.length).toBe(constraintCount);
    });

    test('should solve complex system in reasonable time', async () => {
      // Create a complex constraint system
      const entities = [];
      for (let i = 0; i < 5; i++) {
        entities.push(await constraintSystem.createEntity('point', { 
          x: i, y: 0, z: 0 
        }));
      }

      // Create interconnected constraints
      for (let i = 0; i < entities.length - 1; i++) {
        await constraintSystem.createConstraint({
          type: 'distance',
          entities: [entities[i].id, entities[i + 1].id],
          value: 1.0
        });
      }

      const startTime = performance.now();
      const result = await constraintSystem.solveConstraints();
      const endTime = performance.now();
      const solveTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(solveTime).toBeLessThan(500); // Should solve in under 500ms
    });
  });

  describe('Event System', () => {
    test('should emit entity creation events', (done) => {
      const unsubscribe = constraintSystem.on('entityCreated', (data) => {
        expect(data.entity).toBeDefined();
        expect(data.entity.type).toBe('point');
        unsubscribe();
        done();
      });

      constraintSystem.createEntity('point', { x: 1, y: 2, z: 3 });
    });

    test('should emit constraint creation events', (done) => {
      constraintSystem.createEntity('point', { x: 0, y: 0, z: 0 })
        .then(point1 => constraintSystem.createEntity('point', { x: 1, y: 0, z: 0 }))
        .then(point2 => {
          const unsubscribe = constraintSystem.on('constraintCreated', (data) => {
            expect(data.constraint).toBeDefined();
            expect(data.constraint.type).toBe('distance');
            unsubscribe();
            done();
          });

          return constraintSystem.createConstraint({
            type: 'distance',
            entities: [point1.id, point2.id],
            value: 2.0
          });
        });
    });

    test('should emit solver events', (done) => {
      constraintSystem.createEntity('point', { x: 0, y: 0, z: 0 })
        .then(point1 => constraintSystem.createEntity('point', { x: 1, y: 0, z: 0 }))
        .then(point2 => {
          return constraintSystem.createConstraint({
            type: 'distance',
            entities: [point1.id, point2.id],
            value: 2.0
          });
        })
        .then(() => {
          const unsubscribe = constraintSystem.on('constraintsSolved', (data) => {
            expect(data.success).toBeDefined();
            expect(data.iterations).toBeGreaterThan(0);
            unsubscribe();
            done();
          });

          return constraintSystem.solveConstraints();
        });
    });
  });

  describe('Memory Management', () => {
    test('should cleanup resources properly', async () => {
      // Create some entities and constraints
      const point1 = await constraintSystem.createEntity('point', { x: 0, y: 0, z: 0 });
      const point2 = await constraintSystem.createEntity('point', { x: 1, y: 0, z: 0 });
      await constraintSystem.createConstraint({
        type: 'distance',
        entities: [point1.id, point2.id],
        value: 2.0
      });

      const memoryBefore = constraintSystem.getMemoryUsage();
      expect(memoryBefore.entities).toBeGreaterThan(0);
      expect(memoryBefore.constraints).toBeGreaterThan(0);

      // Reset system
      await constraintSystem.resetSystem();

      const memoryAfter = constraintSystem.getMemoryUsage();
      expect(memoryAfter.entities).toBe(0);
      expect(memoryAfter.constraints).toBe(0);
    });

    test('should handle cleanup without memory leaks', () => {
      const listenerCount = 10;
      const unsubscribers = [];

      // Add many event listeners
      for (let i = 0; i < listenerCount; i++) {
        const unsubscribe = constraintSystem.on('test', () => {});
        unsubscribers.push(unsubscribe);
      }

      // Cleanup
      unsubscribers.forEach(unsubscribe => unsubscribe());
      constraintSystem.cleanup();

      const memoryUsage = constraintSystem.getMemoryUsage();
      expect(memoryUsage.eventListeners).toBe(0);
    });
  });
}); 