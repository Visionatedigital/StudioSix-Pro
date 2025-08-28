/**
 * Architect3D Lights
 * 
 * Adapted from architect3d's Lights class
 * Provides sophisticated lighting for better material rendering
 */

import * as THREE from 'three';

export class Architect3DLights extends THREE.EventDispatcher {
  constructor(scene, floorplan) {
    super();

    this.scene = scene;
    this.floorplan = floorplan;
    this.height = 300;
    this.tolerance = 10;

    // Light references
    this.hemisphereLight = null;
    this.directionalLight = null;
    this.ambientLight = null;

    this.init();
  }

  init() {
    console.log('💡 Initializing Architect3D Lights');

    // Create ambient light for overall illumination
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(this.ambientLight);

    // Create hemisphere light for natural sky lighting
    this.hemisphereLight = new THREE.HemisphereLight(
      0xffffff, // sky color
      0x444444, // ground color
      0.8       // intensity
    );
    this.hemisphereLight.position.set(0, this.height, 0);
    this.scene.add(this.hemisphereLight);

    // Create directional light for sun/shadow casting
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.directionalLight.position.set(100, this.height, 100);
    this.directionalLight.castShadow = true;

    // Configure shadow properties for better quality
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 1;
    this.directionalLight.shadow.camera.far = this.height + this.tolerance;
    this.directionalLight.shadow.bias = -0.0001;

    // Set shadow camera bounds
    const shadowSize = 100;
    this.directionalLight.shadow.camera.left = -shadowSize;
    this.directionalLight.shadow.camera.right = shadowSize;
    this.directionalLight.shadow.camera.top = shadowSize;
    this.directionalLight.shadow.camera.bottom = -shadowSize;

    this.scene.add(this.directionalLight);
    this.scene.add(this.directionalLight.target);

    // Update shadow camera based on floorplan
    this.updateShadowCamera();

    // Listen for floorplan updates
    if (this.floorplan && this.floorplan.addEventListener) {
      this.floorplan.addEventListener('updated', () => {
        this.updateShadowCamera();
      });
    }

    console.log('✅ Architect3D Lights initialized');
  }

  updateShadowCamera() {
    if (!this.directionalLight || !this.floorplan) return;

    try {
      const size = this.floorplan.getSize();
      const center = this.floorplan.getCenter();

      // Calculate optimal shadow camera bounds
      const maxDimension = Math.max(size.x, size.z) + this.tolerance;
      const shadowBounds = maxDimension / 2;

      // Position the directional light
      const lightPos = new THREE.Vector3(
        center.x + maxDimension * 0.3,
        this.height,
        center.z + maxDimension * 0.3
      );

      this.directionalLight.position.copy(lightPos);
      this.directionalLight.target.position.copy(center);

      // Update shadow camera bounds
      this.directionalLight.shadow.camera.left = -shadowBounds;
      this.directionalLight.shadow.camera.right = shadowBounds;
      this.directionalLight.shadow.camera.top = shadowBounds;
      this.directionalLight.shadow.camera.bottom = -shadowBounds;

      // Update the shadow camera projection
      this.directionalLight.shadow.camera.updateProjectionMatrix();

      console.log('💡 Shadow camera updated for bounds:', shadowBounds);
    } catch (error) {
      console.warn('⚠️ Could not update shadow camera:', error);
    }
  }

  setIntensity(hemisphereIntensity = 0.8, directionalIntensity = 1.0, ambientIntensity = 0.4) {
    if (this.hemisphereLight) {
      this.hemisphereLight.intensity = hemisphereIntensity;
    }
    if (this.directionalLight) {
      this.directionalLight.intensity = directionalIntensity;
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = ambientIntensity;
    }
  }

  setTheme(isDark = false) {
    if (isDark) {
      // Dark theme lighting
      this.setIntensity(0.6, 0.8, 0.3);
      
      if (this.hemisphereLight) {
        this.hemisphereLight.color.setHex(0x8899bb);
        this.hemisphereLight.groundColor.setHex(0x334455);
      }
    } else {
      // Light theme lighting
      this.setIntensity(0.8, 1.0, 0.4);
      
      if (this.hemisphereLight) {
        this.hemisphereLight.color.setHex(0xffffff);
        this.hemisphereLight.groundColor.setHex(0x444444);
      }
    }
  }

  getDirLight() {
    return this.directionalLight;
  }

  getHemisphereLight() {
    return this.hemisphereLight;
  }

  getAmbientLight() {
    return this.ambientLight;
  }

  // Cleanup
  dispose() {
    console.log('🧹 Disposing Architect3D Lights');

    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }

    if (this.hemisphereLight) {
      this.scene.remove(this.hemisphereLight);
      this.hemisphereLight = null;
    }

    if (this.directionalLight) {
      this.scene.remove(this.directionalLight);
      this.scene.remove(this.directionalLight.target);
      
      if (this.directionalLight.shadow && this.directionalLight.shadow.map) {
        this.directionalLight.shadow.map.dispose();
      }
      
      this.directionalLight = null;
    }
  }
}