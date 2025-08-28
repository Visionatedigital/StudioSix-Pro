/**
 * Local Models Service
 * Manages local 3D models for doors, windows, and other architectural elements
 */

class LocalModelsService {
  constructor() {
    this.modelsCache = new Map();
    this.manifestsCache = new Map();
    this.baseUrl = '/models'; // Public models directory
  }

  /**
   * Load manifest for a specific model type
   */
  async loadManifest(modelType) {
    if (this.manifestsCache.has(modelType)) {
      return this.manifestsCache.get(modelType);
    }

    try {
      const manifestUrl = `${this.baseUrl}/${modelType}/${modelType}-manifest.json`;
      console.log(`📋 Loading ${modelType} manifest from:`, manifestUrl);
      
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to load ${modelType} manifest: ${response.status}`);
      }

      const manifest = await response.json();
      this.manifestsCache.set(modelType, manifest);
      
      console.log(`✅ Loaded ${modelType} manifest:`, manifest.models.length, 'models');
      return manifest;
    } catch (error) {
      console.error(`❌ Failed to load ${modelType} manifest:`, error);
      return null;
    }
  }

  /**
   * Get all available models for a specific type
   */
  async getAvailableModels(modelType) {
    const manifest = await this.loadManifest(modelType);
    if (!manifest || !manifest.models) {
      return [];
    }

    return manifest.models.map(model => ({
      ...model,
      localUrl: `${this.baseUrl}/${modelType}/${model.files.model}`,
      thumbnailUrl: `/thumbnails/${modelType}/${model.files.thumbnail}`,
      type: modelType,
      isLocal: true
    }));
  }

  /**
   * Get a specific model by ID
   */
  async getModelById(modelType, modelId) {
    const models = await this.getAvailableModels(modelType);
    return models.find(model => model.id === modelId);
  }

  /**
   * Get models by category
   */
  async getModelsByCategory(modelType, category) {
    const models = await this.getAvailableModels(modelType);
    return models.filter(model => model.category === category);
  }

  /**
   * Get models by subcategory
   */
  async getModelsBySubcategory(modelType, subcategory) {
    const models = await this.getAvailableModels(modelType);
    return models.filter(model => model.subcategory === subcategory);
  }

  /**
   * Get a random model of a specific type
   */
  async getRandomModel(modelType) {
    const models = await this.getAvailableModels(modelType);
    if (models.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * models.length);
    return models[randomIndex];
  }

  /**
   * Get default model for a type (first one in the list)
   */
  async getDefaultModel(modelType) {
    const models = await this.getAvailableModels(modelType);
    return models.length > 0 ? models[0] : null;
  }

  /**
   * Get local model URL for use in 3D loading
   */
  getLocalModelUrl(modelType, fileName) {
    return `${this.baseUrl}/${modelType}/${fileName}`;
  }

  /**
   * Check if a model file exists locally
   */
  async checkModelExists(modelType, fileName) {
    try {
      const url = this.getLocalModelUrl(modelType, fileName);
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.warn(`⚠️ Model check failed for ${modelType}/${fileName}:`, error);
      return false;
    }
  }

  /**
   * Create object parameters for StandaloneCADEngine
   */
  createObjectParams(model, position = { x: 0, y: 0, z: 0 }) {
    // Map model type to CAD object type
    let objectType = model.type;
    if (model.type === 'doors') objectType = 'door';
    else if (model.type === 'windows') objectType = 'window';
    else if (model.type === 'staircases') objectType = 'stair';
    else if (model.type === 'roofs') objectType = 'roof';
    
    return {
      id: `${objectType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: objectType,
      subtype: model.category,
      name: model.name,
      position: position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      dimensions: model.dimensions,
      modelUrl: model.localUrl,
      format: ['fbx'],
      category: model.category,
      description: model.description,
      tags: model.tags,
      properties: model.properties,
      isLocal: true,
      localModel: true,
      selectedModel: model.id
    };
  }

  /**
   * Clear cache (useful for development/testing)
   */
  clearCache() {
    this.modelsCache.clear();
    this.manifestsCache.clear();
    console.log('🧹 Local models cache cleared');
  }

  /**
   * Get summary of available local models
   */
  async getModelsSummary() {
    const summary = {};
    
    for (const modelType of ['doors', 'windows', 'staircases', 'roofs']) {
      const models = await this.getAvailableModels(modelType);
      summary[modelType] = {
        total: models.length,
        categories: [...new Set(models.map(m => m.category))],
        subcategories: [...new Set(models.map(m => m.subcategory))]
      };
    }
    
    return summary;
  }
}

// Create and export singleton instance
const localModelsService = new LocalModelsService();
export default localModelsService;
