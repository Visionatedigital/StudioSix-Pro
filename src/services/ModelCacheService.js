/**
 * Model Cache Service
 * Handles downloading, caching, and managing 3D models from Supabase
 */

class ModelCacheService {
  constructor() {
    this.cacheDir = '/models'; // Public directory path
    this.thumbnailDir = '/thumbnails';
    this.dbUrl = '/models-database.json';
    this.cachedModels = new Map();
  }

  /**
   * Load models database from public directory
   */
  async loadModelsDatabase() {
    try {
      const response = await fetch(this.dbUrl);
      if (!response.ok) {
        throw new Error(`Failed to load models database: ${response.status}`);
      }
      
      const database = await response.json();
      console.log(`📚 Loaded ${database.totalModels} models from database`);
      return database;
    } catch (error) {
      console.error('❌ Failed to load models database:', error);
      return { models: [], categories: [], totalModels: 0 };
    }
  }

  /**
   * Get all available models
   */
  async getAvailableModels(options = {}) {
    const database = await this.loadModelsDatabase();
    let models = database.models || [];

    // Apply filters
    if (options.category) {
      models = models.filter(model => model.category === options.category);
    }

    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      models = models.filter(model =>
        model.name.toLowerCase().includes(searchTerm) ||
        model.description.toLowerCase().includes(searchTerm) ||
        model.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Apply pagination
    const page = options.page || 1;
    const limit = options.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedModels = models.slice(startIndex, endIndex);

    return {
      success: true,
      data: paginatedModels,
      pagination: {
        total: models.length,
        page: page,
        totalPages: Math.ceil(models.length / limit)
      }
    };
  }

  /**
   * Get categories with model counts
   */
  async getCategories() {
    const database = await this.loadModelsDatabase();
    return {
      success: true,
      data: database.categories || []
    };
  }

  /**
   * Import model into user's project
   * Downloads from Supabase if not cached, stores locally
   */
  async importModel(modelData) {
    try {
      console.log(`📦 Importing model: ${modelData.name}`);

      // Check if already cached locally
      const localPath = await this.getCachedModelPath(modelData.id);
      if (localPath) {
        console.log(`⚡ Using cached model: ${modelData.name}`);
        return {
          success: true,
          modelPath: localPath,
          thumbnailPath: this.getCachedThumbnailPath(modelData.id),
          cached: true
        };
      }

      // Download from Supabase
      console.log(`☁️ Downloading from Supabase: ${modelData.name}`);
      const downloadResult = await this.downloadModelFromSupabase(modelData);
      
      if (!downloadResult.success) {
        throw new Error(downloadResult.error);
      }

      // Cache locally for future use
      const cacheResult = await this.cacheModelLocally(modelData, downloadResult.modelBlob, downloadResult.thumbnailBlob);

      console.log(`✅ Model imported successfully: ${modelData.name}`);
      return {
        success: true,
        modelPath: cacheResult.modelUrl,
        thumbnailPath: cacheResult.thumbnailUrl,
        cached: false
      };

    } catch (error) {
      console.error(`❌ Failed to import model ${modelData.name}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download model from Supabase storage
   */
  async downloadModelFromSupabase(modelData) {
    try {
      // Download model file
      const modelResponse = await fetch(modelData.model_url);
      if (!modelResponse.ok) {
        throw new Error(`Failed to download model: ${modelResponse.status}`);
      }
      const modelBlob = await modelResponse.blob();

      // Download thumbnail
      const thumbnailResponse = await fetch(modelData.thumbnail_url);
      if (!thumbnailResponse.ok) {
        throw new Error(`Failed to download thumbnail: ${thumbnailResponse.status}`);
      }
      const thumbnailBlob = await thumbnailResponse.blob();

      return {
        success: true,
        modelBlob,
        thumbnailBlob
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cache model locally in browser storage or IndexedDB
   */
  async cacheModelLocally(modelData, modelBlob, thumbnailBlob) {
    try {
      // For web apps, we'll use the browser's cache API or store in memory
      // In a real implementation, you might use IndexedDB for persistence
      
      const modelUrl = URL.createObjectURL(modelBlob);
      const thumbnailUrl = URL.createObjectURL(thumbnailBlob);

      // Store in memory cache
      this.cachedModels.set(modelData.id, {
        modelUrl,
        thumbnailUrl,
        modelData,
        cachedAt: Date.now()
      });

      // Also store in localStorage for basic persistence
      const cacheData = {
        id: modelData.id,
        name: modelData.name,
        format: modelData.format,
        cachedAt: Date.now()
      };

      const existingCache = JSON.parse(localStorage.getItem('cachedModels') || '[]');
      const updatedCache = existingCache.filter(item => item.id !== modelData.id);
      updatedCache.push(cacheData);
      localStorage.setItem('cachedModels', JSON.stringify(updatedCache));

      console.log(`💾 Cached model locally: ${modelData.name}`);
      return {
        modelUrl,
        thumbnailUrl
      };

    } catch (error) {
      console.error('❌ Failed to cache model:', error);
      return false;
    }
  }

  /**
   * Get cached model path (check memory cache first)
   */
  async getCachedModelPath(modelId) {
    // Check memory cache
    const cached = this.cachedModels.get(modelId);
    if (cached) {
      return cached.modelUrl;
    }

    // Check localStorage for reference
    const cachedList = JSON.parse(localStorage.getItem('cachedModels') || '[]');
    const cachedItem = cachedList.find(item => item.id === modelId);
    
    return cachedItem ? `${this.cacheDir}/${modelId}` : null;
  }

  /**
   * Get cached thumbnail path
   */
  getCachedThumbnailPath(modelId) {
    const cached = this.cachedModels.get(modelId);
    if (cached) {
      return cached.thumbnailUrl;
    }
    return `${this.thumbnailDir}/${modelId}`;
  }

  /**
   * Clear cache (cleanup)
   */
  clearCache() {
    // Revoke object URLs to free memory
    this.cachedModels.forEach(cached => {
      URL.revokeObjectURL(cached.modelUrl);
      URL.revokeObjectURL(cached.thumbnailUrl);
    });
    
    this.cachedModels.clear();
    localStorage.removeItem('cachedModels');
    console.log('🗑️ Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const cachedList = JSON.parse(localStorage.getItem('cachedModels') || '[]');
    return {
      totalCached: cachedList.length,
      memoryCache: this.cachedModels.size,
      lastCached: cachedList.length > 0 ? Math.max(...cachedList.map(item => item.cachedAt)) : null
    };
  }

  /**
   * Preload model for faster access
   */
  async preloadModel(modelData) {
    if (this.cachedModels.has(modelData.id)) {
      return true; // Already loaded
    }

    try {
      const result = await this.importModel(modelData);
      return result.success;
    } catch (error) {
      console.error(`❌ Failed to preload model ${modelData.name}:`, error);
      return false;
    }
  }
}

export default ModelCacheService;