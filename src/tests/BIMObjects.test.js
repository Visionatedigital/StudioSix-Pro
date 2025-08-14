/**
 * BIM Objects Test Suite
 * 
 * Comprehensive tests for Wall, Door, and Window classes
 * Validates IFC compliance, xeokit integration, and property management
 */

import { BaseBIMObject, Wall, Door, Window } from '../models/BIMObjects';
import { IFCWALLSTANDARDCASE, IFCDOOR, IFCWINDOW } from 'web-ifc';

describe('BIM Objects Schema Tests', () => {
  
  describe('BaseBIMObject', () => {
    let baseObject;

    beforeEach(() => {
      baseObject = new BaseBIMObject({
        name: 'Test Object',
        description: 'Test description'
      });
    });

    test('should create object with default properties', () => {
      expect(baseObject.id).toBeDefined();
      expect(baseObject.name).toBe('Test Object');
      expect(baseObject.description).toBe('Test description');
      expect(baseObject.ifcGUID).toHaveLength(22);
      expect(baseObject.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(baseObject.orientation).toEqual({ x: 0, y: 0, z: 0 });
    });

    test('should generate unique IDs', () => {
      const obj1 = new BaseBIMObject();
      const obj2 = new BaseBIMObject();
      expect(obj1.id).not.toBe(obj2.id);
    });

    test('should validate position coordinates', () => {
      const validPosition = baseObject.validatePosition({ x: 1.5, y: 2.0, z: 3.5 });
      expect(validPosition).toEqual({ x: 1.5, y: 2.0, z: 3.5 });

      const invalidPosition = baseObject.validatePosition({ x: 'invalid', y: null, z: undefined });
      expect(invalidPosition).toEqual({ x: 0, y: 0, z: 0 });
    });

    test('should normalize angles correctly', () => {
      expect(baseObject.normalizeAngle(450)).toBe(90);
      expect(baseObject.normalizeAngle(-90)).toBe(270);
      expect(baseObject.normalizeAngle(180)).toBe(180);
    });

    test('should validate material properties', () => {
      const material = baseObject.validateMaterial({
        name: 'Test Material',
        color: [0.5, 0.7, 0.9],
        roughness: 1.5, // Should be clamped to 1.0
        metalness: -0.1 // Should be clamped to 0.0
      });

      expect(material.name).toBe('Test Material');
      expect(material.color).toEqual([0.5, 0.7, 0.9]);
      expect(material.roughness).toBe(1.0);
      expect(material.metalness).toBe(0.0);
    });

    test('should update properties correctly', () => {
      baseObject.updateProperties({
        name: 'Updated Name',
        position: { x: 10, y: 20, z: 30 }
      });

      expect(baseObject.name).toBe('Updated Name');
      expect(baseObject.position).toEqual({ x: 10, y: 20, z: 30 });
    });

    test('should link to xeokit entity', () => {
      baseObject.linkToXeokit('entity_123', ['mesh_1', 'mesh_2']);
      
      expect(baseObject.xeokitEntityId).toBe('entity_123');
      expect(baseObject.xeokitMeshIds).toEqual(['mesh_1', 'mesh_2']);
    });

    test('should export object correctly', () => {
      const exported = baseObject.toExport();
      
      expect(exported).toHaveProperty('id');
      expect(exported).toHaveProperty('name');
      expect(exported).toHaveProperty('position');
      expect(exported).toHaveProperty('orientation');
      expect(exported).toHaveProperty('material');
      expect(exported).toHaveProperty('created');
      expect(exported).toHaveProperty('modified');
    });
  });

  describe('Wall Class', () => {
    let wall;

    beforeEach(() => {
      wall = new Wall({
        name: 'Test Wall',
        dimensions: {
          length: 5.0,
          height: 3.0,
          thickness: 0.25
        },
        position: { x: 0, y: 0, z: 0 },
        wallType: 'exterior'
      });
    });

    test('should create wall with correct IFC type', () => {
      expect(wall.ifcType).toBe(IFCWALLSTANDARDCASE);
    });

    test('should initialize with correct dimensions', () => {
      expect(wall.dimensions.length).toBe(5.0);
      expect(wall.dimensions.height).toBe(3.0);
      expect(wall.dimensions.thickness).toBe(0.25);
      expect(wall.dimensions.area).toBe(15.0); // 5.0 * 3.0
      expect(wall.dimensions.volume).toBe(3.75); // 5.0 * 3.0 * 0.25
    });

    test('should enforce minimum dimension constraints', () => {
      const smallWall = new Wall({
        dimensions: {
          length: 0.05, // Below minimum
          height: 0.05, // Below minimum
          thickness: 0.005 // Below minimum
        }
      });

      expect(smallWall.dimensions.length).toBe(0.1);
      expect(smallWall.dimensions.height).toBe(0.1);
      expect(smallWall.dimensions.thickness).toBe(0.01);
    });

    test('should have default structural properties', () => {
      expect(wall.structural.isLoadBearing).toBe(false);
      expect(wall.structural.structuralType).toBe('non-structural');
      expect(wall.structural.fireRating).toBe('unrated');
    });

    test('should have default thermal properties', () => {
      expect(wall.thermal.thermalTransmittance).toBe(0.3);
      expect(wall.thermal.insulationType).toBe('none');
      expect(wall.thermal.vaporBarrier).toBe(false);
    });

    test('should have default architectural properties', () => {
      expect(wall.architectural.finish.interior).toBe('painted');
      expect(wall.architectural.finish.exterior).toBe('painted');
      expect(wall.architectural.baseboard).toBe(false);
      expect(wall.architectural.crown).toBe(false);
    });

    test('should generate correct wall geometry', () => {
      const geometry = wall.generateGeometry();
      
      expect(geometry.primitive).toBe('triangles');
      expect(geometry.positions).toHaveLength(24); // 8 vertices * 3 coordinates
      expect(geometry.normals).toHaveLength(24); // 8 normals * 3 coordinates  
      expect(geometry.indices).toHaveLength(36); // 12 triangles * 3 indices
    });

    test('should add wall connections', () => {
      wall.addConnection('wall_2', 'corner', { x: 5, y: 0, z: 0 });
      
      expect(wall.connections).toHaveLength(1);
      expect(wall.connections[0].targetWallId).toBe('wall_2');
      expect(wall.connections[0].connectionType).toBe('corner');
    });

    test('should update dimensions and recalculate properties', () => {
      wall.updateDimensions({
        length: 6.0,
        height: 2.8
      });

      expect(wall.dimensions.length).toBe(6.0);
      expect(wall.dimensions.height).toBe(2.8);
      expect(wall.dimensions.area).toBe(16.8); // 6.0 * 2.8
      expect(wall.dimensions.volume).toBe(4.2); // 6.0 * 2.8 * 0.25
    });

    test('should create xeokit mesh configuration', () => {
      const meshConfig = wall.getXeokitMeshConfig('test_mesh');
      
      expect(meshConfig.id).toBe('test_mesh');
      expect(meshConfig.primitive).toBe('triangles');
      expect(meshConfig.positions).toBeDefined();
      expect(meshConfig.normals).toBeDefined();
      expect(meshConfig.indices).toBeDefined();
      expect(meshConfig.colorize).toEqual(wall.material.color);
    });

    test('should create xeokit entity configuration', () => {
      const entityConfig = wall.getXeokitEntityConfig('test_entity', 'test_mesh');
      
      expect(entityConfig.id).toBe('test_entity');
      expect(entityConfig.meshIds).toEqual(['test_mesh']);
      expect(entityConfig.isObject).toBe(true);
      expect(entityConfig.position).toEqual([0, 0, 0]);
      expect(entityConfig.scale).toEqual([1, 1, 1]);
    });

    test('should export wall with all properties', () => {
      const exported = wall.toExport();
      
      expect(exported.dimensions).toBeDefined();
      expect(exported.structural).toBeDefined();
      expect(exported.thermal).toBeDefined();
      expect(exported.architectural).toBeDefined();
      expect(exported.wallType).toBe('exterior');
      expect(exported.connections).toBeDefined();
      expect(exported.geometry).toBeDefined();
    });

    test('should have appropriate wall material', () => {
      expect(wall.material.name).toBe('Standard Wall Material');
      expect(wall.material.color).toEqual([0.9, 0.9, 0.85]);
      expect(wall.material.properties.density).toBe(1800);
      expect(wall.material.properties.compressiveStrength).toBe(25);
    });

    test('should validate custom structural properties', () => {
      const structuralWall = new Wall({
        structural: {
          isLoadBearing: true,
          structuralType: 'bearing',
          fireRating: 'FR120',
          acousticRating: 85
        }
      });

      expect(structuralWall.structural.isLoadBearing).toBe(true);
      expect(structuralWall.structural.structuralType).toBe('bearing');
      expect(structuralWall.structural.fireRating).toBe('FR120');
      expect(structuralWall.structural.acousticRating).toBe(85);
    });

    test('should validate custom thermal properties', () => {
      const insulatedWall = new Wall({
        thermal: {
          thermalTransmittance: 0.15,
          insulationType: 'mineral_wool',
          vaporBarrier: true
        }
      });

      expect(insulatedWall.thermal.thermalTransmittance).toBe(0.15);
      expect(insulatedWall.thermal.insulationType).toBe('mineral_wool');
      expect(insulatedWall.thermal.vaporBarrier).toBe(true);
    });

    test('should validate custom architectural properties', () => {
      const decorativeWall = new Wall({
        architectural: {
          finish: {
            interior: 'plaster',
            exterior: 'brick'
          },
          baseboard: true,
          crown: true,
          texture: 'rough'
        }
      });

      expect(decorativeWall.architectural.finish.interior).toBe('plaster');
      expect(decorativeWall.architectural.finish.exterior).toBe('brick');
      expect(decorativeWall.architectural.baseboard).toBe(true);
      expect(decorativeWall.architectural.crown).toBe(true);
      expect(decorativeWall.architectural.texture).toBe('rough');
    });
  });

  describe('Door Class', () => {
    let door;

    beforeEach(() => {
      door = new Door({
        name: 'Test Door',
        dimensions: {
          width: 0.9,
          height: 2.0,
          thickness: 0.05
        },
        doorType: 'swinging',
        functionality: {
          isExterior: true,
          weatherSealing: true
        }
      });
    });

    test('should create door with correct IFC type', () => {
      expect(door.ifcType).toBe(IFCDOOR);
    });

    test('should initialize with correct dimensions', () => {
      expect(door.dimensions.width).toBe(0.9);
      expect(door.dimensions.height).toBe(2.0);
      expect(door.dimensions.thickness).toBe(0.05);
      expect(door.dimensions.frameWidth).toBe(0.1);
      expect(door.dimensions.frameDepth).toBe(0.15);
    });

    test('should enforce minimum dimension constraints', () => {
      const smallDoor = new Door({
        dimensions: {
          width: 0.2, // Below minimum
          height: 0.3, // Below minimum
          thickness: 0.005 // Below minimum
        }
      });

      expect(smallDoor.dimensions.width).toBe(0.3);
      expect(smallDoor.dimensions.height).toBe(0.5);
      expect(smallDoor.dimensions.thickness).toBe(0.01);
    });

    test('should have default functionality properties', () => {
      const defaultDoor = new Door();
      expect(defaultDoor.functionality.isExterior).toBe(false);
      expect(defaultDoor.functionality.weatherSealing).toBe(false);
      expect(defaultDoor.functionality.glazedArea).toBe(0);
    });

    test('should have default hardware properties', () => {
      expect(door.hardware.handleType).toBe('lever');
      expect(door.hardware.lockType).toBe('cylinder');
      expect(door.hardware.hingeCount).toBe(3);
    });

    test('should have default safety properties', () => {
      expect(door.safety.fireRating).toBe('unrated');
      expect(door.safety.emergencyExit).toBe(false);
      expect(door.safety.securityLevel).toBe('standard');
    });

    test('should generate correct door geometry', () => {
      const geometry = door.generateGeometry();
      
      expect(geometry.primitive).toBe('triangles');
      expect(geometry.positions).toHaveLength(24); // 8 vertices * 3 coordinates
      expect(geometry.normals).toHaveLength(24);
      expect(geometry.indices).toHaveLength(36); // 12 triangles * 3 indices
    });

    test('should calculate opening area correctly', () => {
      door.openingAngle = 90;
      const openingArea = door.calculateOpeningArea();
      const expectedArea = door.dimensions.width * door.dimensions.height;
      expect(openingArea).toBeCloseTo(expectedArea, 2);
    });

    test('should export door with all properties', () => {
      const exported = door.toExport();
      
      expect(exported.dimensions).toBeDefined();
      expect(exported.functionality).toBeDefined();
      expect(exported.hardware).toBeDefined();
      expect(exported.safety).toBeDefined();
      expect(exported.doorType).toBe('swinging');
      expect(exported.openingArea).toBeDefined();
      expect(exported.geometry).toBeDefined();
    });

    test('should have appropriate door material', () => {
      expect(door.material.name).toBe('Standard Door Material');
      expect(door.material.color).toEqual([0.6, 0.4, 0.2]);
      expect(door.material.properties.density).toBe(600);
    });
  });

  describe('Window Class', () => {
    let window;

    beforeEach(() => {
      window = new Window({
        name: 'Test Window',
        dimensions: {
          width: 1.5,
          height: 1.2,
          depth: 0.2
        },
        windowType: 'casement',
        glazing: {
          glazingType: 'triple',
          lowE: true
        }
      });
    });

    test('should create window with correct IFC type', () => {
      expect(window.ifcType).toBe(IFCWINDOW);
    });

    test('should initialize with correct dimensions', () => {
      expect(window.dimensions.width).toBe(1.5);
      expect(window.dimensions.height).toBe(1.2);
      expect(window.dimensions.depth).toBe(0.2);
      expect(window.dimensions.frameWidth).toBe(0.05);
      expect(window.dimensions.glazingThickness).toBe(0.006);
    });

    test('should enforce minimum dimension constraints', () => {
      const smallWindow = new Window({
        dimensions: {
          width: 0.2, // Below minimum
          height: 0.2, // Below minimum
          depth: 0.02 // Below minimum
        }
      });

      expect(smallWindow.dimensions.width).toBe(0.3);
      expect(smallWindow.dimensions.height).toBe(0.3);
      expect(smallWindow.dimensions.depth).toBe(0.05);
    });

    test('should have correct glazing properties', () => {
      expect(window.glazing.glazingType).toBe('triple');
      expect(window.glazing.lowE).toBe(true);
      expect(window.glazing.paneCount).toBe(2); // Default
      expect(window.glazing.visibleTransmittance).toBe(0.8);
    });

    test('should have default frame properties', () => {
      expect(window.frame.material).toBe('aluminum');
      expect(window.frame.finish).toBe('anodized');
      expect(window.frame.thermalBreak).toBe(false);
    });

    test('should have default performance properties', () => {
      expect(window.performance.uValue).toBe(2.5);
      expect(window.performance.waterResistance).toBe('A');
      expect(window.performance.acousticPerformance).toBe(30);
    });

    test('should have default environmental properties', () => {
      expect(window.environmental.orientation).toBe('south');
      expect(window.environmental.shading).toBe('none');
      expect(window.environmental.daylightFactor).toBe(0.02);
    });

    test('should generate correct window geometry', () => {
      const geometry = window.generateGeometry();
      
      expect(geometry.primitive).toBe('triangles');
      expect(geometry.positions).toHaveLength(36); // 12 vertices * 3 coordinates
      expect(geometry.normals).toHaveLength(36);
      expect(geometry.indices).toHaveLength(30); // 10 triangles * 3 indices
    });

    test('should calculate glazing area correctly', () => {
      const glazingArea = window.calculateGlazingArea();
      const { width, height, frameWidth } = window.dimensions;
      const expectedArea = (width - 2 * frameWidth) * (height - 2 * frameWidth);
      expect(glazingArea).toBeCloseTo(expectedArea, 2);
    });

    test('should calculate solar heat gain correctly', () => {
      const solarHeatGain = window.calculateSolarHeatGain();
      const glazingArea = window.calculateGlazingArea();
      const expectedGain = glazingArea * window.glazing.solarHeatGainCoefficient;
      expect(solarHeatGain).toBeCloseTo(expectedGain, 2);
    });

    test('should export window with all properties', () => {
      const exported = window.toExport();
      
      expect(exported.dimensions).toBeDefined();
      expect(exported.glazing).toBeDefined();
      expect(exported.frame).toBeDefined();
      expect(exported.performance).toBeDefined();
      expect(exported.environmental).toBeDefined();
      expect(exported.windowType).toBe('casement');
      expect(exported.glazingArea).toBeDefined();
      expect(exported.solarHeatGain).toBeDefined();
      expect(exported.geometry).toBeDefined();
    });

    test('should have appropriate window material', () => {
      expect(window.material.name).toBe('Standard Window Material');
      expect(window.material.color).toEqual([0.9, 0.95, 1.0]);
      expect(window.material.opacity).toBe(0.7);
      expect(window.material.properties.density).toBe(2500);
    });

    test('should validate custom glazing properties', () => {
      const customWindow = new Window({
        glazing: {
          glazingType: 'single',
          paneCount: 1,
          tinted: true,
          tempered: true,
          visibleTransmittance: 0.6
        }
      });

      expect(customWindow.glazing.glazingType).toBe('single');
      expect(customWindow.glazing.paneCount).toBe(1);
      expect(customWindow.glazing.tinted).toBe(true);
      expect(customWindow.glazing.tempered).toBe(true);
      expect(customWindow.glazing.visibleTransmittance).toBe(0.6);
    });

    test('should validate custom performance properties', () => {
      const performanceWindow = new Window({
        performance: {
          uValue: 1.2,
          airInfiltration: 0.05,
          waterResistance: 'E',
          acousticPerformance: 45
        }
      });

      expect(performanceWindow.performance.uValue).toBe(1.2);
      expect(performanceWindow.performance.airInfiltration).toBe(0.05);
      expect(performanceWindow.performance.waterResistance).toBe('E');
      expect(performanceWindow.performance.acousticPerformance).toBe(45);
    });
  });

  // Integration Tests
  describe('Integration Tests', () => {
    test('should create wall and link to xeokit viewer', () => {
      const wall = new Wall({
        name: 'Integration Test Wall',
        dimensions: { length: 4.0, height: 2.5, thickness: 0.2 }
      });

      // Simulate xeokit integration
      const meshId = `${wall.id}_mesh`;
      const entityId = wall.id;
      
      wall.linkToXeokit(entityId, [meshId]);
      
      expect(wall.xeokitEntityId).toBe(entityId);
      expect(wall.xeokitMeshIds).toContain(meshId);

      // Verify export includes xeokit information
      const exported = wall.toExport();
      expect(exported.xeokitEntityId).toBe(entityId);
      expect(exported.xeokitMeshIds).toContain(meshId);
    });

    test('should maintain consistency between wall endpoints and dimensions', () => {
      const wall = new Wall({
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 5, y: 0, z: 0 },
        dimensions: { length: 5.0, height: 2.4, thickness: 0.2 }
      });

      const distance = Math.sqrt(
        Math.pow(wall.endPoint.x - wall.startPoint.x, 2) +
        Math.pow(wall.endPoint.y - wall.startPoint.y, 2) +
        Math.pow(wall.endPoint.z - wall.startPoint.z, 2)
      );

      expect(distance).toBe(wall.dimensions.length);
    });

    test('should create door and link to host wall', () => {
      const wall = new Wall({
        name: 'Host Wall',
        dimensions: { length: 5.0, height: 2.5, thickness: 0.2 }
      });

      const door = new Door({
        name: 'Integration Test Door',
        dimensions: { width: 0.8, height: 2.1, thickness: 0.05 },
        hostWallId: wall.id,
        wallOffset: { x: 2.0, y: 0, z: 0 }
      });

      door.linkToXeokit(`${door.id}_entity`, [`${door.id}_mesh`]);

      expect(door.hostWallId).toBe(wall.id);
      expect(door.wallOffset.x).toBe(2.0);
      expect(door.xeokitEntityId).toBe(`${door.id}_entity`);

      // Verify export includes host wall relationship
      const exported = door.toExport();
      expect(exported.hostWallId).toBe(wall.id);
      expect(exported.wallOffset).toEqual({ x: 2.0, y: 0, z: 0 });
    });

    test('should create window and link to host wall', () => {
      const wall = new Wall({
        name: 'Host Wall',
        dimensions: { length: 6.0, height: 3.0, thickness: 0.25 }
      });

      const window = new Window({
        name: 'Integration Test Window',
        dimensions: { width: 1.2, height: 1.5, depth: 0.15 },
        hostWallId: wall.id,
        wallOffset: { x: 3.0, y: 0, z: 0 },
        sillHeight: 0.9
      });

      window.linkToXeokit(`${window.id}_entity`, [`${window.id}_mesh`]);

      expect(window.hostWallId).toBe(wall.id);
      expect(window.sillHeight).toBe(0.9);
      expect(window.xeokitEntityId).toBe(`${window.id}_entity`);

      // Verify solar calculations work correctly
      const glazingArea = window.calculateGlazingArea();
      const solarHeatGain = window.calculateSolarHeatGain();
      expect(glazingArea).toBeGreaterThan(0);
      expect(solarHeatGain).toBeGreaterThan(0);

      // Verify export includes all window-specific data
      const exported = window.toExport();
      expect(exported.hostWallId).toBe(wall.id);
      expect(exported.sillHeight).toBe(0.9);
      expect(exported.glazingArea).toBe(glazingArea);
      expect(exported.solarHeatGain).toBe(solarHeatGain);
    });

    test('should maintain consistency across all BIM object types', () => {
      const wall = new Wall({ name: 'Test Wall' });
      const door = new Door({ name: 'Test Door' });
      const window = new Window({ name: 'Test Window' });

      // All objects should have base BIM properties
      [wall, door, window].forEach(obj => {
        expect(obj.id).toBeDefined();
        expect(obj.ifcGUID).toHaveLength(22);
        expect(obj.position).toEqual({ x: 0, y: 0, z: 0 });
        expect(obj.orientation).toEqual({ x: 0, y: 0, z: 0 });
        expect(obj.material).toBeDefined();
        expect(obj.created).toBeDefined();
        expect(obj.modified).toBeDefined();
        expect(obj.version).toBe('1.0.0');
      });

      // All objects should generate valid geometry
      [wall, door, window].forEach(obj => {
        const geometry = obj.generateGeometry();
        expect(geometry.primitive).toBe('triangles');
        expect(geometry.positions).toBeDefined();
        expect(geometry.normals).toBeDefined();
        expect(geometry.indices).toBeDefined();
      });

      // All objects should export correctly
      [wall, door, window].forEach(obj => {
        const exported = obj.toExport();
        expect(exported.id).toBe(obj.id);
        expect(exported.ifcType).toBeDefined();
        expect(exported.dimensions).toBeDefined();
        expect(exported.geometry).toBeDefined();
      });
    });
  });
});

// Manual test runner for development
if (process.env.NODE_ENV === 'development') {
  console.log('🧪 Running BIM Objects manual tests...');
  
  // Create test wall
  const testWall = new Wall({
    name: 'Manual Test Wall',
    dimensions: { length: 4.5, height: 2.7, thickness: 0.3 },
    wallType: 'exterior',
    structural: {
      isLoadBearing: true,
      fireRating: 'FR90'
    }
  });

  // Create test door
  const testDoor = new Door({
    name: 'Manual Test Door',
    dimensions: { width: 0.9, height: 2.1, thickness: 0.05 },
    doorType: 'swinging',
    hostWallId: testWall.id,
    functionality: {
      isExterior: true,
      weatherSealing: true
    },
    safety: {
      fireRating: 'FR60',
      emergencyExit: true
    }
  });

  // Create test window
  const testWindow = new Window({
    name: 'Manual Test Window',
    dimensions: { width: 1.5, height: 1.2, depth: 0.2 },
    windowType: 'casement',
    hostWallId: testWall.id,
    glazing: {
      glazingType: 'triple',
      lowE: true,
      visibleTransmittance: 0.7
    },
    performance: {
      uValue: 1.2,
      acousticPerformance: 40
    }
  });

  console.log('✅ Test Wall Created:', testWall.name);
  console.log('📐 Wall Dimensions:', testWall.dimensions);
  console.log('🏗️ Wall Structural:', testWall.structural);
  console.log('🎯 Wall IFC Type:', testWall.ifcType);
  
  console.log('✅ Test Door Created:', testDoor.name);
  console.log('📐 Door Dimensions:', testDoor.dimensions);
  console.log('🔧 Door Hardware:', testDoor.hardware);
  console.log('🛡️ Door Safety:', testDoor.safety);
  console.log('🎯 Door IFC Type:', testDoor.ifcType);
  
  console.log('✅ Test Window Created:', testWindow.name);
  console.log('📐 Window Dimensions:', testWindow.dimensions);
  console.log('🪟 Window Glazing:', testWindow.glazing);
  console.log('⚡ Window Performance:', testWindow.performance);
  console.log('🎯 Window IFC Type:', testWindow.ifcType);
  console.log('☀️ Solar Heat Gain:', testWindow.calculateSolarHeatGain());
  
  console.log('📊 Integration Test - All objects linked:');
  console.log('- Door host wall:', testDoor.hostWallId === testWall.id);
  console.log('- Window host wall:', testWindow.hostWallId === testWall.id);
} 