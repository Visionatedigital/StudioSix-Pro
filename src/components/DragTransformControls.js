/**
 * Drag Transform Controls Component
 * 
 * Provides drag and drop functionality for 3D CAD objects
 * Supports both position dragging and scaling/resizing
 */

import React, { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import standaloneCADEngine from '../services/StandaloneCADEngine';

const DragTransformControls = ({ 
  selectedObjectId, 
  transformMode = 'translate', // 'translate' or 'scale'
  onTransformStart,
  onTransformEnd,
  onTransform
}) => {
  const { camera, gl, scene } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState(null);
  const [dragStartObjectPosition, setDragStartObjectPosition] = useState(null);
  const [dragStartScale, setDragStartScale] = useState(null);
  
  const raycaster = useRef(new THREE.Raycaster());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)); // XZ plane at Y=0
  const intersection = useRef(new THREE.Vector3());
  
  // Handle pointer events
  useEffect(() => {
    if (!selectedObjectId) return;

    const object = standaloneCADEngine.getObject(selectedObjectId);
    if (!object || !object.mesh3D) return;

    const mesh = object.mesh3D;
    
    const handlePointerDown = (event) => {
      event.stopPropagation();
      
      // Convert mouse coordinates to normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Set up raycaster
      raycaster.current.setFromCamera(mouse, camera);
      
      // Find intersection with the ground plane for dragging
      raycaster.current.ray.intersectPlane(plane.current, intersection.current);
      
      setIsDragging(true);
      setDragStartPosition(intersection.current.clone());
      setDragStartObjectPosition(mesh.position.clone());
      setDragStartScale({
        x: mesh.scale.x,
        y: mesh.scale.y,
        z: mesh.scale.z
      });
      
      onTransformStart?.(selectedObjectId, transformMode);
      
      console.log(`🖱️ Started ${transformMode} for object ${selectedObjectId}`);
    };

    const handlePointerMove = (event) => {
      if (!isDragging) return;
      
      event.stopPropagation();
      
      // Convert mouse coordinates
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Get current intersection
      raycaster.current.setFromCamera(mouse, camera);
      raycaster.current.ray.intersectPlane(plane.current, intersection.current);
      
      if (transformMode === 'translate') {
        // Calculate new position
        const delta = intersection.current.clone().sub(dragStartPosition);
        const newPosition = dragStartObjectPosition.clone().add(delta);
        
        // Update object position
        standaloneCADEngine.updateObjectPosition(selectedObjectId, {
          x: newPosition.x,
          y: newPosition.y,
          z: newPosition.z
        });
        
        onTransform?.(selectedObjectId, 'position', {
          x: newPosition.x,
          y: newPosition.y,
          z: newPosition.z
        });
      } else if (transformMode === 'scale') {
        // Calculate scale factor based on mouse movement
        const delta = intersection.current.clone().sub(dragStartPosition);
        const scaleFactor = 1 + (delta.length() / 2); // Adjust sensitivity
        
        // Determine scale direction (positive for outward, negative for inward)
        const scaleDirection = delta.dot(new THREE.Vector3(1, 0, 1)) > 0 ? 1 : -1;
        const finalScaleFactor = 1 + (scaleDirection * (scaleFactor - 1) * 0.1);
        
        const newScale = {
          width: object.params.width * finalScaleFactor,
          height: object.params.height * finalScaleFactor,
          depth: object.params.depth * finalScaleFactor
        };
        
        // Prevent negative or too small scales
        newScale.width = Math.max(0.1, newScale.width);
        newScale.height = Math.max(0.1, newScale.height);
        newScale.depth = Math.max(0.1, newScale.depth);
        
        // Update object scale
        standaloneCADEngine.updateObjectScale(selectedObjectId, newScale);
        
        onTransform?.(selectedObjectId, 'scale', newScale);
      }
    };

    const handlePointerUp = (event) => {
      if (!isDragging) return;
      
      event.stopPropagation();
      
      setIsDragging(false);
      setDragStartPosition(null);
      setDragStartObjectPosition(null);
      setDragStartScale(null);
      
      onTransformEnd?.(selectedObjectId, transformMode);
      
      console.log(`🖱️ Finished ${transformMode} for object ${selectedObjectId}`);
    };

    // Add event listeners to the mesh
    mesh.addEventListener?.('pointerdown', handlePointerDown);
    gl.domElement.addEventListener('pointermove', handlePointerMove);
    gl.domElement.addEventListener('pointerup', handlePointerUp);
    
    // Cleanup
    return () => {
      mesh.removeEventListener?.('pointerdown', handlePointerDown);
      gl.domElement.removeEventListener('pointermove', handlePointerMove);
      gl.domElement.removeEventListener('pointerup', handlePointerUp);
    };
  }, [selectedObjectId, transformMode, isDragging, camera, gl, onTransformStart, onTransformEnd, onTransform]);

  // Visual feedback for transform mode
  useFrame(() => {
    if (!selectedObjectId || !isDragging) return;
    
    const object = standaloneCADEngine.getObject(selectedObjectId);
    if (!object || !object.mesh3D) return;
    
    // Add visual feedback (could be glow, outline, etc.)
    if (transformMode === 'translate') {
      // Maybe add translation indicators
    } else if (transformMode === 'scale') {
      // Maybe add scale indicators
    }
  });

  return null; // This component doesn't render anything itself
};

export default DragTransformControls;