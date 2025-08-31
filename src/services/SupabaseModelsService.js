/**
 * SupabaseModelsService - Robust Service for accessing 3D models stored in Supabase
 * 
 * This service provides fast, reliable access to furniture and fixture models stored in the 
 * Supabase storage bucket 'models_fbx'. The bucket structure is:
 * 
 * models_fbx/
 * ├── Category_Name/
 * │   ├── models/          # FBX files
 * │   ├── thumbnails/      # JPG preview images  
 * │   └── textures/        # Texture files
 * 
 * Features:
 * - Instant loading using predefined manifest
 * - Lazy loading: only thumbnails initially, models on demand
 * - Easy to extend by updating manifest file
 * - Robust and reliable - no discovery delays
 * 
 * @author StudioSix
 */

import SupabaseSmartScraper from './SupabaseSmartScraper.js';

class SupabaseModelsService {
  constructor() {
    this.baseUrl = null;
    this.bucketName = 'models_fbx';
    this.supabaseUrl = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
    const { getApiBase } = require('../config/apiBase');
    this.backendUrl = getApiBase();
    this.manifestCache = null;
    this.manifestCacheTime = null;
    this.cacheExpiry = 15 * 60 * 1000; // 15 minutes - smart scraper cache
    this.smartScraper = new SupabaseSmartScraper();
  }

  /**
   * Initialize the service
   */
  async initialize() {
    this.baseUrl = `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}`;
    console.log('✅ SupabaseModelsService initialized with base URL:', this.baseUrl);
    return true;
  }

  /**
   * Check if the service is available (always true for robust manifest system)
   */
  async isAvailable() {
    console.log('✅ ROBUST: Service always available with manifest system');
    // Since we're using a predefined manifest, the service is always available
    // No need to test backend endpoints that might hang
    return true;
  }

  /**
   * Get the models manifest (smart discovery from actual bucket)
   */
  async getManifest(forceRefresh = false) {
    console.log('🧠 SMART: Getting manifest from smart scraper...');
    
    try {
      // Get discovery results from smart scraper
      const discovery = await this.smartScraper.getDiscovery(forceRefresh);
      
      console.log(`✅ SMART: Discovered ${discovery.stats.total_models} models in ${discovery.stats.total_categories} categories`);
      console.log('📊 SMART Categories:', discovery.categories.map(c => `${c.displayName} (${c.model_count || 0})`).join(', '));
      
      return discovery;
      
    } catch (error) {
      console.error('❌ SMART discovery failed:', error);
      
      // Minimal fallback
      return {
        generated_at: new Date().toISOString(),
        bucket_name: this.bucketName,
        supabase_url: this.supabaseUrl,
        categories: [],
        stats: {
          total_categories: 0,
          total_models: 0
        }
      };
    }
  }



  /**
   * Get available categories from dynamic discovery
   */
  async getCategories(forceRefresh = false) {
    try {
      const manifest = await this.getManifest(forceRefresh);
      return manifest.categories || [];
      
    } catch (error) {
      console.error('❌ Failed to get categories:', error);
      return [];
    }
  }

  /**
   * Get models for a specific category (lightweight - only metadata)
   */
  async getCategoryModels(categoryName, forceRefresh = false) {
    try {
      const manifest = await this.getManifest(forceRefresh);
      
      // Filter models for the specific category
      const categoryModels = manifest.models.filter(model => 
        model.category.toLowerCase() === categoryName.toLowerCase()
      );
      
      console.log(`📋 Found ${categoryModels.length} models in category "${categoryName}"`);
      
      return categoryModels;
      
    } catch (error) {
      console.error(`❌ Failed to get models for category "${categoryName}":`, error);
      return [];
    }
  }

  /**
   * Get all models from all categories (for "All" view)
   */
  async getAllModels(forceRefresh = false, progressCallback = null) {
    try {
      console.log('🧠 SMART: Getting ALL models from all categories with progressive loading...');
      
      const manifest = await this.getManifest(forceRefresh);
      const allModels = [];
      
      for (const category of manifest.categories || []) {
        if (category.models && category.models.length > 0) {
          console.log(`🔄 Loading category: ${category.name} (${category.models.length} models)`);
          
          // Get models for each category (no progressive loading to avoid infinite loops)
          const categoryModels = await this.getCategoryThumbnails(category.name, forceRefresh, null);
          allModels.push(...categoryModels);
          
          console.log(`✅ Loaded ${categoryModels.length} models from category "${category.name}"`);
          
          // Only call progress callback if provided and this is the final result
          if (progressCallback && category === manifest.categories[manifest.categories.length - 1]) {
            progressCallback([...allModels]);
          }
        }
      }
      
      console.log(`✅ SMART: Collected ${allModels.length} models from all categories`);
      return allModels;
      
    } catch (error) {
      console.error('❌ Failed to get all models:', error);
      return [];
    }
  }

  /**
   * Get thumbnails for models in a category (with progressive loading)
   * This uses smart scraping with progressive loading for immediate display
   */
  async getCategoryThumbnails(categoryName, forceRefresh = false, progressCallback = null) {
    try {
      console.log(`🧠 SMART: Getting models with progressive loading in "${categoryName}"`);
      
      // Use smart scraper with progressive loading
      const modelsWithThumbnails = await this.smartScraper.getModelsWithThumbnails(categoryName, progressCallback);
      
      console.log(`✅ SMART: Found ${modelsWithThumbnails.length} models with working thumbnails in "${categoryName}"`);
      
      return modelsWithThumbnails;
      
    } catch (error) {
      console.error(`❌ SMART discovery failed for category "${categoryName}":`, error);
      return [];
    }
  }

  /**
   * Get a specific model's full data (including FBX URL) - called when importing
   */
  async getModel(modelId) {
    try {
      const manifest = await this.getManifest();
      const model = manifest.models.find(m => m.id === modelId);
      
      if (!model) {
        throw new Error(`Model with ID "${modelId}" not found`);
      }
      
      console.log(`📦 Preparing model "${model.displayName}" for import`);
      
      // Return model with full FBX URL for import
      return {
        ...model,
        modelUrl: model.modelUrl,
        model_url: model.modelUrl, // Compatibility
        cached: false // FBX files are always fetched on demand
      };
      
    } catch (error) {
      console.error(`❌ Failed to get model "${modelId}":`, error);
      throw error;
    }
  }

  /**
   * Refresh the manifest cache and clear smart scraper cache
   */
  async refreshManifest() {
    console.log('🔄 SMART: Refreshing smart discovery cache...');
    return await this.smartScraper.refreshDiscovery();
  }

  /**
   * Validate that a specific model exists (using smart scraper)
   */
  async validateModel(category, modelName) {
    console.log(`🧠 SMART: Validating model: ${category}/${modelName}`);
    const result = await this.smartScraper.testUrl(
      `${this.baseUrl}/${encodeURIComponent(category)}/thumbnails/${modelName}.jpg`
    );
    return result.exists;
  }

  /**
   * Add a new model to the manifest (for runtime additions)
   * Note: For permanent additions, update SupabaseModelsManifest.js
   */
  addModel(categoryName, modelData) {
    if (!this.manifestCache) {
      console.warn('⚠️ No manifest cache available, cannot add model');
      return false;
    }

    // Find the category
    const category = this.manifestCache.categories.find(c => c.name === categoryName);
    if (!category) {
      console.warn(`⚠️ Category "${categoryName}" not found`);
      return false;
    }

    // Create the complete model object
    const newModel = {
      id: `${categoryName.toLowerCase().replace(/\s+/g, '_')}_${modelData.name.toLowerCase()}`,
      name: modelData.name,
      displayName: modelData.displayName || modelData.name,
      category: categoryName,
      type: 'model',
      format: 'fbx',
      thumbnail: `${modelData.name}.jpg`,
      thumbnailUrl: `${this.baseUrl}/${encodeURIComponent(categoryName)}/thumbnails/${modelData.name}.jpg`,
      modelUrl: `${this.baseUrl}/${encodeURIComponent(categoryName)}/models/${modelData.name}.fbx`,
      model_url: `${this.baseUrl}/${encodeURIComponent(categoryName)}/models/${modelData.name}.fbx`,
      file_size_mb: modelData.file_size_mb || 'Unknown',
      polygon_count: modelData.polygon_count || 'Unknown',
      has_textures: modelData.has_textures !== false,
      cached: false
    };

    // Add to models array
    this.manifestCache.models.push(newModel);
    
    // Update category count
    category.model_count++;
    
    // Update stats
    this.manifestCache.stats.total_models++;
    
    console.log(`✅ Added model "${modelData.displayName}" to category "${categoryName}"`);
    return true;
  }

  /**
   * Get statistics about the current model collection
   */
  async getStats() {
    try {
      const manifest = await this.getManifest();
      return {
        totalCategories: manifest.stats.total_categories,
        totalModels: manifest.stats.total_models,
        lastUpdated: manifest.generated_at,
        categories: manifest.categories.map(cat => ({
          name: cat.displayName,
          modelCount: cat.model_count
        }))
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      return null;
    }
  }
}

// Export the class and a singleton instance
export { SupabaseModelsService };

// Export singleton instance as default
const supabaseModelsService = new SupabaseModelsService();
export default supabaseModelsService;






