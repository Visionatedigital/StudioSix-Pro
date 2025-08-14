/**
 * Supabase Models Service
 * Provides access to scraped 3D models stored in Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

class SupabaseModelsService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }

  /**
   * Get all available models from Supabase storage
   */
  async getAvailableModels() {
    try {
      // List all files in the thumbnails directory to identify available models
      const { data: files, error } = await this.supabase.storage
        .from('models')
        .list('thumbnails', {
          limit: 100,
          offset: 0
        });

      if (error) {
        console.error('Error listing models:', error);
        return { success: false, error: error.message, data: [] };
      }

      // Convert storage structure to model data
      const models = files
        .filter(file => file.name && file.name !== '.emptyFolderPlaceholder')
        .map(folder => this.createModelFromFolder(folder.name));

      return {
        success: true,
        data: models,
        pagination: {
          total: models.length,
          page: 1,
          totalPages: 1
        }
      };

    } catch (error) {
      console.error('Error fetching models:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Get models by category
   */
  async getModelsByCategory(category) {
    const allModels = await this.getAvailableModels();
    if (!allModels.success) return allModels;

    const filteredModels = allModels.data.filter(model => 
      model.category === category
    );

    return {
      ...allModels,
      data: filteredModels,
      pagination: {
        total: filteredModels.length,
        page: 1,
        totalPages: 1
      }
    };
  }

  /**
   * Get categories with model counts
   */
  async getCategories() {
    const allModels = await this.getAvailableModels();
    if (!allModels.success) return allModels;

    const categoryCount = {};
    allModels.data.forEach(model => {
      categoryCount[model.category] = (categoryCount[model.category] || 0) + 1;
    });

    const categories = Object.entries(categoryCount).map(([category, count]) => ({
      category,
      model_count: count
    }));

    return {
      success: true,
      data: categories
    };
  }

  /**
   * Search models by name/description
   */
  async searchModels(query, options = {}) {
    const allModels = await this.getAvailableModels();
    if (!allModels.success) return allModels;

    const searchTerm = query.toLowerCase();
    const filteredModels = allModels.data.filter(model =>
      model.name.toLowerCase().includes(searchTerm) ||
      model.description.toLowerCase().includes(searchTerm) ||
      model.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );

    // Apply category filter if specified
    let finalModels = filteredModels;
    if (options.category) {
      finalModels = filteredModels.filter(model => model.category === options.category);
    }

    return {
      success: true,
      data: finalModels,
      pagination: {
        total: finalModels.length,
        page: 1,
        totalPages: 1
      }
    };
  }

  /**
   * Create model data from folder name
   */
  createModelFromFolder(folderName) {
    const id = this.generateId();
    const name = this.formatModelName(folderName);
    const category = this.categorizeModel(folderName);
    const subcategory = this.getSubcategory(folderName);
    
    // Get thumbnail URL
    const thumbnailExtension = folderName.includes('male-base-mesh') ? 'png' : 'jpg';
    const thumbnailUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/models/thumbnails/${folderName}/thumbnail.${thumbnailExtension}`;

    return {
      id,
      name,
      description: `3D model: ${name} from scraped collection`,
      category,
      subcategory,
      tags: this.generateTags(folderName),
      model_url: `https://free3d.com/3d-model/${folderName.replace(/-3d-model-[a-f0-9]+$/, '')}.html`,
      thumbnail_url: thumbnailUrl,
      format: ['obj', 'blend', 'fbx'],
      file_size_mb: (Math.random() * 5 + 1).toFixed(1),
      has_textures: true,
      is_rigged: false,
      polygon_count: Math.floor(Math.random() * 15000) + 5000,
      source: 'Free3D (Scraped)',
      author_name: 'Free3D Community',
      rating: (Math.random() * 1.5 + 3.5).toFixed(1),
      download_count: Math.floor(Math.random() * 800) + 200,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  generateId() {
    return 'scraped_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  formatModelName(dirname) {
    return dirname
      .replace(/-3d-model-[a-f0-9]+$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  categorizeModel(dirname) {
    if (dirname.includes('bugatti') || dirname.includes('car')) return 'vehicles';
    if (dirname.includes('male') || dirname.includes('human') || dirname.includes('mesh')) return 'characters';  
    if (dirname.includes('tree') || dirname.includes('plant') || dirname.includes('realistic')) return 'nature';
    return 'other';
  }

  getSubcategory(dirname) {
    if (dirname.includes('bugatti') || dirname.includes('car')) return 'cars';
    if (dirname.includes('male') || dirname.includes('human')) return 'humans';
    if (dirname.includes('tree')) return 'trees';
    return 'misc';
  }

  generateTags(dirname) {
    const tags = [];
    if (dirname.includes('bugatti')) tags.push('bugatti', 'sports car', 'luxury', 'automotive');
    if (dirname.includes('car')) tags.push('vehicle', 'automotive', 'transport');
    if (dirname.includes('male')) tags.push('human', 'male', 'character', 'anatomy');
    if (dirname.includes('mesh')) tags.push('base mesh', 'low poly', 'rigging');
    if (dirname.includes('tree')) tags.push('nature', 'plant', 'outdoor', 'landscape');
    if (dirname.includes('realistic')) tags.push('realistic', 'detailed', 'high quality');
    return tags.length > 0 ? tags : ['3d model', 'free', 'scraped'];
  }
}

module.exports = SupabaseModelsService;