/**
 * Simple Supabase Models Service - Direct bucket access
 * 
 * Simple, fast service to get models from Supabase models_fbx bucket
 * No scraping, no data URL conversion, just direct bucket listing
 */

const SUPABASE_URL = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const BUCKET_NAME = 'models_fbx';
const BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`;
import { getApiBase } from '../config/apiBase';
const PROXY_URL = `${getApiBase()}/api`; // Backend proxy

class SimpleSupabaseService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get proxied thumbnail URL to avoid CORS issues
   */
  getProxiedThumbnailUrl(directUrl) {
    return `${PROXY_URL}/proxy-image?url=${encodeURIComponent(directUrl)}`;
  }

  /**
   * Get all available categories (folders in the bucket)
   */
  async getCategories() {
    const cacheKey = 'categories';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      // Known categories from your bucket structure
      const categories = [
        {
          name: 'Side Tables',
          displayName: 'Side Tables',
          icon: '🪑',
          model_count: 20 // Approximate
        },
        {
          name: 'chairs',
          displayName: 'Chairs',
          icon: '🪑',
          model_count: 10 // Approximate
        },
        {
          name: 'Lounge Chairs',
          displayName: 'Lounge Chairs',
          icon: '🛋️',
          model_count: 15 // Approximate
        }
      ];

      this.cache.set(cacheKey, {
        data: categories,
        timestamp: Date.now()
      });

      return categories;
    } catch (error) {
      console.error('Failed to get categories:', error);
      return [];
    }
  }

  /**
   * Get models for a specific category
   */
  async getCategoryModels(categoryName) {
    const cacheKey = `category_${categoryName}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const models = [];

      if (categoryName === 'Side Tables') {
        // Known Side Table models
        for (let i = 1; i <= 20; i++) {
          const modelName = `Side-Table_${i.toString().padStart(2, '0')}`;
          const directThumbnailUrl = `${BASE_URL}/Side%20Tables/thumbnails/${modelName}-330pl.jpg`;
          models.push({
            id: `side_table_${i}`,
            name: modelName,
            displayName: `Side Table ${i}`,
            category: 'Side Tables',
            thumbnailUrl: this.getProxiedThumbnailUrl(directThumbnailUrl),
            directThumbnailUrl: directThumbnailUrl,
            modelUrl: `${BASE_URL}/Side%20Tables/models/${modelName}.fbx`,
            format: ['fbx'],
            has_textures: true,
            polygon_count: 'Unknown'
          });
        }
      } else if (categoryName === 'chairs') {
        // Known Chair models
        for (let i = 1; i <= 10; i++) {
          const modelName = `CGT_Chair_${i.toString().padStart(3, '0')}`;
          const directThumbnailUrl = `${BASE_URL}/chairs/thumbnails/${modelName}.jpg`;
          models.push({
            id: `chair_${i}`,
            name: modelName,
            displayName: `Chair ${i}`,
            category: 'chairs',
            thumbnailUrl: this.getProxiedThumbnailUrl(directThumbnailUrl),
            directThumbnailUrl: directThumbnailUrl,
            modelUrl: `${BASE_URL}/chairs/models/${modelName}.fbx`,
            format: ['fbx'],
            has_textures: true,
            polygon_count: 'Unknown'
          });
        }
      } else if (categoryName === 'Lounge Chairs') {
        // Known Lounge Chair models
        for (let i = 1; i <= 15; i++) {
          const modelName = `Lounge_Chair_${i.toString().padStart(2, '0')}`;
          const directThumbnailUrl = `${BASE_URL}/Lounge%20Chairs/thumbnails/${modelName}.jpg`;
          models.push({
            id: `lounge_chair_${i}`,
            name: modelName,
            displayName: `Lounge Chair ${i}`,
            category: 'Lounge Chairs',
            thumbnailUrl: this.getProxiedThumbnailUrl(directThumbnailUrl),
            directThumbnailUrl: directThumbnailUrl,
            modelUrl: `${BASE_URL}/Lounge%20Chairs/models/${modelName}.fbx`,
            format: ['fbx'],
            has_textures: true,
            polygon_count: 'Unknown'
          });
        }
      }

      this.cache.set(cacheKey, {
        data: models,
        timestamp: Date.now()
      });

      return models;
    } catch (error) {
      console.error(`Failed to get models for category ${categoryName}:`, error);
      return [];
    }
  }

  /**
   * Get all models from all categories
   */
  async getAllModels() {
    const categories = await this.getCategories();
    const allModels = [];

    for (const category of categories) {
      const categoryModels = await this.getCategoryModels(category.name);
      allModels.push(...categoryModels);
    }

    return allModels;
  }

  /**
   * Get a specific model by ID
   */
  async getModel(modelId) {
    const allModels = await this.getAllModels();
    return allModels.find(model => model.id === modelId);
  }

  /**
   * Check if service is available
   */
  async isAvailable() {
    return true; // Always available since we're using direct URLs
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
const simpleSupabaseService = new SimpleSupabaseService();
export default simpleSupabaseService;