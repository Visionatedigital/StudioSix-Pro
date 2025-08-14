import React, { useMemo, useRef, useEffect } from 'react';
import { extend, useFrame } from '@react-three/fiber';
import { Line, Text, Html } from '@react-three/drei';
import * as THREE from 'three';

// Extend Three.js with custom materials if needed
extend({ Line });

/**
 * Constraint Visualization Overlay - Renders geometric constraints in the 3D scene
 * Shows constraint indicators, labels, and status visualizations
 */
const ConstraintVisualizationOverlay = ({
  constraints = [],
  entities = [],
  showLabels = true,
  showStatus = true,
  opacity = 0.8,
  theme = 'dark'
}) => {
  const groupRef = useRef();

  // Color scheme for different constraint states
  const colorScheme = useMemo(() => ({
    satisfied: '#10b981',      // Green
    violated: '#ef4444',       // Red
    conflicted: '#f59e0b',     // Amber
    disabled: '#6b7280',       // Gray
    selected: '#3b82f6',       // Blue
    preview: '#8b5cf6'         // Purple
  }), []);

  // Priority color mapping
  const priorityColors = useMemo(() => ({
    critical: '#dc2626',
    high: '#ea580c',
    normal: '#059669',
    low: '#64748b',
    suggestion: '#7c3aed'
  }), []);

  // Helper function to get entity position
  const getEntityPosition = (entityId) => {
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return new THREE.Vector3(0, 0, 0);
    
    // Handle different entity types
    switch (entity.type) {
      case 'point':
        return new THREE.Vector3(entity.x || 0, entity.y || 0, entity.z || 0);
      case 'line':
        // Return midpoint for lines
        const start = new THREE.Vector3(entity.startX || 0, entity.startY || 0, entity.startZ || 0);
        const end = new THREE.Vector3(entity.endX || 0, entity.endY || 0, entity.endZ || 0);
        return start.clone().add(end).multiplyScalar(0.5);
      case 'arc':
      case 'circle':
        return new THREE.Vector3(entity.centerX || 0, entity.centerY || 0, entity.centerZ || 0);
      default:
        return new THREE.Vector3(0, 0, 0);
    }
  };

  // Helper function to get entity direction (for lines)
  const getEntityDirection = (entityId) => {
    const entity = entities.find(e => e.id === entityId);
    if (!entity || entity.type !== 'line') return new THREE.Vector3(1, 0, 0);
    
    const start = new THREE.Vector3(entity.startX || 0, entity.startY || 0, entity.startZ || 0);
    const end = new THREE.Vector3(entity.endX || 0, entity.endY || 0, entity.endZ || 0);
    return end.clone().sub(start).normalize();
  };

  // Generate constraint visualization data
  const constraintVisuals = useMemo(() => {
    return constraints.map(constraint => {
      const visual = {
        id: constraint.id,
        type: constraint.type,
        color: constraint.satisfied 
          ? colorScheme.satisfied 
          : constraint.conflicted 
            ? colorScheme.conflicted 
            : colorScheme.violated,
        priority: constraint.priority,
        priorityColor: priorityColors[constraint.priority] || priorityColors.normal,
        label: constraint.label || constraint.type,
        enabled: constraint.enabled !== false,
        entities: constraint.entities || []
      };

      // Generate specific visualization based on constraint type
      switch (constraint.type) {
        case 'distance':
          if (visual.entities.length >= 2) {
            const pos1 = getEntityPosition(visual.entities[0]);
            const pos2 = getEntityPosition(visual.entities[1]);
            const midpoint = pos1.clone().add(pos2).multiplyScalar(0.5);
            
            visual.elements = [{
              type: 'line',
              points: [pos1, pos2],
              midpoint,
              value: constraint.value,
              unit: 'm'
            }];
          }
          break;

        case 'parallel':
          if (visual.entities.length >= 2) {
            const pos1 = getEntityPosition(visual.entities[0]);
            const pos2 = getEntityPosition(visual.entities[1]);
            const dir1 = getEntityDirection(visual.entities[0]);
            const dir2 = getEntityDirection(visual.entities[1]);
            
            // Create parallel indicator arrows
            const offset = 0.5;
            visual.elements = [
              {
                type: 'arrow',
                position: pos1.clone().add(new THREE.Vector3(0, 0, offset)),
                direction: dir1,
                length: 1.0
              },
              {
                type: 'arrow', 
                position: pos2.clone().add(new THREE.Vector3(0, 0, offset)),
                direction: dir2,
                length: 1.0
              }
            ];
          }
          break;

        case 'perpendicular':
          if (visual.entities.length >= 2) {
            const pos1 = getEntityPosition(visual.entities[0]);
            const pos2 = getEntityPosition(visual.entities[1]);
            const dir1 = getEntityDirection(visual.entities[0]);
            const dir2 = getEntityDirection(visual.entities[1]);
            
            // Create perpendicular indicator
            const intersectPoint = pos1.clone().add(pos2).multiplyScalar(0.5);
            visual.elements = [{
              type: 'perpendicular',
              position: intersectPoint,
              direction1: dir1,
              direction2: dir2,
              size: 0.3
            }];
          }
          break;

        case 'coincident':
          if (visual.entities.length >= 2) {
            const pos1 = getEntityPosition(visual.entities[0]);
            const pos2 = getEntityPosition(visual.entities[1]);
            const midpoint = pos1.clone().add(pos2).multiplyScalar(0.5);
            
            visual.elements = [{
              type: 'coincident',
              position: midpoint,
              size: 0.2
            }];
          }
          break;

        case 'fixed':
          if (visual.entities.length >= 1) {
            const pos = getEntityPosition(visual.entities[0]);
            visual.elements = [{
              type: 'fixed',
              position: pos,
              size: 0.25
            }];
          }
          break;

        case 'angle':
          if (visual.entities.length >= 2) {
            const pos1 = getEntityPosition(visual.entities[0]);
            const pos2 = getEntityPosition(visual.entities[1]);
            const dir1 = getEntityDirection(visual.entities[0]);
            const dir2 = getEntityDirection(visual.entities[1]);
            const intersectPoint = pos1.clone().add(pos2).multiplyScalar(0.5);
            
            visual.elements = [{
              type: 'angle',
              position: intersectPoint,
              direction1: dir1,
              direction2: dir2,
              value: constraint.value,
              unit: '°',
              radius: 0.5
            }];
          }
          break;

        default:
          visual.elements = [];
      }

      return visual;
    });
  }, [constraints, entities, colorScheme, priorityColors]);

  // Render distance constraint
  const renderDistanceConstraint = (element, visual) => (
    <group key={`distance-${visual.id}`}>
      {/* Distance line */}
      <Line
        points={element.points}
        color={visual.color}
        lineWidth={2}
        transparent
        opacity={opacity}
      />
      
      {/* Distance label */}
      {showLabels && (
        <Html position={element.midpoint} center>
          <div className={`px-2 py-1 rounded text-xs font-medium pointer-events-none ${
            theme === 'dark' 
              ? 'bg-gray-800 bg-opacity-90 text-white border border-gray-600' 
              : 'bg-white bg-opacity-90 text-gray-900 border border-gray-300'
          }`}>
            {element.value?.toFixed(2) || 0}{element.unit}
          </div>
        </Html>
      )}
      
      {/* Priority indicator */}
      {showStatus && (
        <mesh position={element.midpoint}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color={visual.priorityColor} transparent opacity={opacity} />
        </mesh>
      )}
    </group>
  );

  // Render parallel constraint
  const renderParallelConstraint = (element, visual, index) => (
    <group key={`parallel-${visual.id}-${index}`}>
      {/* Arrow geometry */}
      <mesh position={element.position}>
        <coneGeometry args={[0.05, element.length, 8]} />
        <meshBasicMaterial color={visual.color} transparent opacity={opacity} />
      </mesh>
      
      {/* Arrow direction line */}
      <Line
        points={[
          element.position,
          element.position.clone().add(element.direction.clone().multiplyScalar(element.length))
        ]}
        color={visual.color}
        lineWidth={1}
        transparent
        opacity={opacity * 0.7}
      />
    </group>
  );

  // Render perpendicular constraint  
  const renderPerpendicularConstraint = (element, visual) => (
    <group key={`perpendicular-${visual.id}`}>
      {/* Right angle indicator */}
      <Line
        points={[
          element.position.clone().add(element.direction1.clone().multiplyScalar(element.size)),
          element.position.clone().add(element.direction1.clone().multiplyScalar(element.size))
            .add(element.direction2.clone().multiplyScalar(element.size)),
          element.position.clone().add(element.direction2.clone().multiplyScalar(element.size))
        ]}
        color={visual.color}
        lineWidth={2}
        transparent
        opacity={opacity}
      />
      
      {/* Corner square */}
      <mesh position={element.position}>
        <boxGeometry args={[element.size * 0.3, element.size * 0.3, 0.02]} />
        <meshBasicMaterial color={visual.color} transparent opacity={opacity * 0.5} />
      </mesh>
    </group>
  );

  // Render coincident constraint
  const renderCoincidentConstraint = (element, visual) => (
    <group key={`coincident-${visual.id}`}>
      {/* Coincident indicator - crossed circles */}
      <mesh position={element.position}>
        <ringGeometry args={[element.size * 0.8, element.size, 12]} />
        <meshBasicMaterial color={visual.color} transparent opacity={opacity} />
      </mesh>
      <mesh position={element.position} rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[element.size * 0.8, element.size, 12]} />
        <meshBasicMaterial color={visual.color} transparent opacity={opacity} />
      </mesh>
    </group>
  );

  // Render fixed constraint
  const renderFixedConstraint = (element, visual) => (
    <group key={`fixed-${visual.id}`}>
      {/* Fixed anchor symbol */}
      <mesh position={element.position}>
        <boxGeometry args={[element.size, element.size, element.size * 0.2]} />
        <meshBasicMaterial color={visual.color} transparent opacity={opacity} />
      </mesh>
      
      {/* Fixed symbol lines */}
      <Line
        points={[
          element.position.clone().add(new THREE.Vector3(-element.size, -element.size, 0)),
          element.position.clone().add(new THREE.Vector3(element.size, element.size, 0))
        ]}
        color={visual.color}
        lineWidth={2}
        transparent
        opacity={opacity}
      />
      <Line
        points={[
          element.position.clone().add(new THREE.Vector3(-element.size, element.size, 0)),
          element.position.clone().add(new THREE.Vector3(element.size, -element.size, 0))
        ]}
        color={visual.color}
        lineWidth={2}
        transparent
        opacity={opacity}
      />
    </group>
  );

  // Render angle constraint
  const renderAngleConstraint = (element, visual) => {
    // Create arc points for angle visualization
    const angle = (element.value || 90) * Math.PI / 180;
    const arcPoints = [];
    const steps = 16;
    
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * angle;
      const point = element.position.clone()
        .add(element.direction1.clone().multiplyScalar(element.radius * Math.cos(t)))
        .add(element.direction2.clone().multiplyScalar(element.radius * Math.sin(t)));
      arcPoints.push(point);
    }

    return (
      <group key={`angle-${visual.id}`}>
        {/* Angle arc */}
        <Line
          points={arcPoints}
          color={visual.color}
          lineWidth={2}
          transparent
          opacity={opacity}
        />
        
        {/* Angle value label */}
        {showLabels && (
          <Html position={element.position} center>
            <div className={`px-2 py-1 rounded text-xs font-medium pointer-events-none ${
              theme === 'dark' 
                ? 'bg-gray-800 bg-opacity-90 text-white border border-gray-600' 
                : 'bg-white bg-opacity-90 text-gray-900 border border-gray-300'
            }`}>
              {element.value?.toFixed(1) || 0}{element.unit}
            </div>
          </Html>
        )}
      </group>
    );
  };

  // Main render function for each constraint element
  const renderConstraintElement = (visual, element, index) => {
    if (!visual.enabled) return null;

    switch (element.type) {
      case 'line':
        return renderDistanceConstraint(element, visual);
      case 'arrow':
        return renderParallelConstraint(element, visual, index);
      case 'perpendicular':
        return renderPerpendicularConstraint(element, visual);
      case 'coincident':
        return renderCoincidentConstraint(element, visual);
      case 'fixed':
        return renderFixedConstraint(element, visual);
      case 'angle':
        return renderAngleConstraint(element, visual);
      default:
        return null;
    }
  };

  // Animation frame for updating dynamic elements
  useFrame((state, delta) => {
    if (groupRef.current) {
      // Could add pulsing animation for violated constraints
      // or other dynamic visual effects
    }
  });

  return (
    <group ref={groupRef}>
      {constraintVisuals.map(visual => 
        visual.elements?.map((element, index) => 
          renderConstraintElement(visual, element, index)
        )
      )}
    </group>
  );
};

export default ConstraintVisualizationOverlay; 