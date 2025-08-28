/**
 * Real Supabase Models Service - Uses Actual Bucket Contents
 * 
 * This service provides access to the real models in your Supabase bucket
 * based on the actual discovery of what exists, not hardcoded assumptions.
 * 
 * Discovered Categories:
 * - Side Tables: 20 models (Side-Table_01-330pl to Side-Table_20-5400pl)
 * - Chairs: 10 models (CGT_Chair_001 to CGT_Chair_010)
 * - Sofas: 10 models (CGT_Sofa_001 to CGT_Sofa_010)
 * - Stools: 8 models (CGT_Stool_001 to CGT_Stool_008)
 */

const SUPABASE_URL = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const BUCKET_NAME = 'models_fbx';
const BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`;
const PROXY_URL = 'http://localhost:8002/api'; // AI proxy server with image proxy

class RealSupabaseService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
    this.manifest = null;
    this.initialized = false;
  }

  /**
   * Initialize the service with real bucket data
   */
  async initialize() {
    if (this.initialized) {
      console.log('🔄 RealSupabaseService already initialized, skipping...');
      return;
    }
    
    console.log('🚀 Initializing RealSupabaseService with actual bucket contents...');
    
    try {
      // Try to load the bucket discovery data
      console.log('📡 Fetching bucket discovery data from /bucket-discovery.json...');
      const response = await fetch('/bucket-discovery.json');
      console.log('📡 Bucket discovery response status:', response.status, response.statusText);
      
      if (response.ok) {
        const discoveryData = await response.json();
        console.log('📊 Loaded bucket discovery data successfully!');
        console.log('📊 Discovery data structure:', {
          generatedAt: discoveryData.generatedAt,
          bucketName: discoveryData.bucketName,
          baseUrl: discoveryData.baseUrl,
          categoriesCount: discoveryData.categories?.length || 0,
          firstCategory: discoveryData.categories?.[0]?.name,
          firstCategoryModels: discoveryData.categories?.[0]?.models?.length || 0
        });
        
        this.manifest = {
          generatedAt: discoveryData.generatedAt,
          bucketName: discoveryData.bucketName,
          baseUrl: discoveryData.baseUrl,
          categories: discoveryData.categories,
          totalModels: discoveryData.categories.reduce((sum, cat) => sum + cat.modelCount, 0),
          totalCategories: discoveryData.categories.length
        };
        
        console.log('✅ Manifest created from discovery data:', {
          totalModels: this.manifest.totalModels,
          totalCategories: this.manifest.totalCategories,
          categoryNames: this.manifest.categories.map(c => c.name)
        });
      } else {
        console.warn('⚠️ Bucket discovery data not found, HTTP status:', response.status);
        console.warn('⚠️ Using fallback hardcoded data');
        this.manifest = this.getFallbackManifest();
      }
    } catch (error) {
      console.error('❌ Failed to load bucket discovery data:', error);
      console.warn('⚠️ Using fallback hardcoded data');
      this.manifest = this.getFallbackManifest();
    }
    
    this.initialized = true;
    console.log(`✅ Service initialized with ${this.manifest.totalModels} models across ${this.manifest.totalCategories} categories`);
  }

  /**
   * Get fallback manifest when bucket discovery fails
   */
  getFallbackManifest() {
    return {
      generatedAt: new Date().toISOString(),
      bucketName: BUCKET_NAME,
      baseUrl: BASE_URL,
      categories: [
        {
          name: 'Side Tables',
          displayName: 'Side Tables',
          icon: 'table',
          description: 'Modern and classic side tables',
          modelCount: 20
        },
        {
          name: 'chairs',
          displayName: 'Chairs',
          icon: 'chair',
          description: 'Office and dining chairs',
          modelCount: 10
        },
        {
          name: 'sofas',
          displayName: 'Sofas',
          icon: 'sofa',
          description: 'Living room sofas and couches',
          modelCount: 10
        },
        {
          name: 'stools',
          displayName: 'Stools',
          icon: 'stool',
          description: 'Bar stools and accent seating',
          modelCount: 8
        }
      ],
      totalModels: 48,
      totalCategories: 4
    };
  }

  /**
   * Get proxied thumbnail URL to avoid CORS/COEP issues
   * Uses the image proxy to bypass Cross-Origin-Embedder-Policy restrictions
   */
  getProxiedThumbnailUrl(directUrl) {
    if (!directUrl) return directUrl;
    
    // Use proxy to handle COEP/CORS issues
    const proxiedUrl = `${PROXY_URL}/proxy-image?url=${encodeURIComponent(directUrl)}`;
    console.log(`🔄 Proxying thumbnail URL:`, {
      original: directUrl,
      proxied: proxiedUrl
    });
    return proxiedUrl;
  }

  /**
   * Generate display name for models
   */
  generateDisplayName(modelName, categoryName, index) {
    if (categoryName === 'Side Tables') {
      const styles = [
        'Modern', 'Classic', 'Minimalist', 'Contemporary', 'Elegant',
        'Wooden', 'Glass', 'Industrial', 'Vintage', 'Scandinavian',
        'Rustic', 'Marble', 'Metal', 'Round', 'Square',
        'Oval', 'Hexagon', 'Luxury', 'Designer', 'Premium'
      ];
      const style = styles[(index - 1) % styles.length];
      return `${style} Side Table ${index.toString().padStart(2, '0')}`;
    }
    
    if (categoryName === 'chairs') {
      const styles = [
        'Modern Office', 'Executive', 'Ergonomic', 'Designer', 'Conference',
        'Task', 'Gaming', 'Lounge', 'Dining', 'Accent'
      ];
      const style = styles[(index - 1) % styles.length];
      return `${style} Chair ${index.toString().padStart(2, '0')}`;
    }
    
    if (categoryName === 'sofas') {
      const styles = [
        'Modern', 'Sectional', 'Loveseat', 'Chesterfield', 'Mid-Century',
        'Contemporary', 'Leather', 'Fabric', 'L-Shaped', 'Modular'
      ];
      const style = styles[(index - 1) % styles.length];
      return `${style} Sofa ${index.toString().padStart(2, '0')}`;
    }
    
    if (categoryName === 'stools') {
      const styles = [
        'Bar', 'Counter', 'Swivel', 'Backless', 'Industrial',
        'Modern', 'Adjustable', 'Wooden'
      ];
      const style = styles[(index - 1) % styles.length];
      return `${style} Stool ${index.toString().padStart(2, '0')}`;
    }
    
    // Default cleanup
    return modelName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/(\d+)pl$/, ''); // Remove polygon count suffix
  }

  /**
   * Extract polygon count from model name
   */
  extractPolygonCount(modelName) {
    const match = modelName.match(/(\d+)pl$/);
    return match ? `${match[1]} polygons` : 'Unknown';
  }

  /**
   * Get all available categories
   */
  async getCategories() {
    await this.initialize();
    
    const cacheKey = 'categories';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const categories = this.manifest.categories.map(cat => ({
      name: cat.name,
      displayName: cat.displayName,
      icon: cat.icon,
      description: cat.description,
      model_count: cat.modelCount
    }));

    this.cache.set(cacheKey, {
      data: categories,
      timestamp: Date.now()
    });

    console.log(`📂 Returning ${categories.length} categories:`, categories.map(c => c.displayName).join(', '));
    return categories;
  }

  /**
   * Get models for a specific category
   */
  async getCategoryModels(categoryName) {
    console.log(`🔍 getCategoryModels called for category: "${categoryName}"`);
    await this.initialize();
    
    const cacheKey = `category_${categoryName}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`💾 Returning cached data for category "${categoryName}" (${cached.data.length} models)`);
      return cached.data;
    }

    console.log(`📊 Manifest has ${this.manifest.categories.length} categories:`, this.manifest.categories.map(c => c.name));

    const models = [];

    // Find the category in our manifest
    const categoryData = this.manifest.categories.find(cat => 
      cat.name === categoryName || cat.displayName === categoryName
    );

    console.log(`🔍 Looking for category "${categoryName}" in manifest...`);
    console.log(`📋 Found category data:`, categoryData ? {
      name: categoryData.name,
      displayName: categoryData.displayName,
      modelCount: categoryData.modelCount,
      modelsLength: categoryData.models?.length
    } : 'NOT FOUND');

    if (categoryData && categoryData.models) {
      console.log(`✅ Using real discovered data for "${categoryName}" (${categoryData.models.length} models)`);
      
      // Use real discovered data
      categoryData.models.forEach((model, index) => {
        const proxiedThumbnailUrl = this.getProxiedThumbnailUrl(model.thumbnailUrl);
        const processedModel = {
          id: this.generateModelId(categoryName, index),
          name: model.name,
          displayName: this.generateDisplayName(model.name, categoryName, index + 1),
          category: categoryName,
          thumbnailUrl: proxiedThumbnailUrl,
          directThumbnailUrl: model.thumbnailUrl,
          thumbnail_url: proxiedThumbnailUrl, // Use proxied URL to avoid COEP issues
          modelUrl: model.modelUrl,
          model_url: model.modelUrl,
          format: ['fbx'],
          has_textures: true,
          polygon_count: this.extractPolygonCount(model.name),
          type: 'model'
        };
        
        if (index < 3) { // Log first 3 models for debugging
          console.log(`🖼️ Model ${index + 1}:`, {
            name: processedModel.name,
            displayName: processedModel.displayName,
            thumbnailUrl: processedModel.thumbnail_url
          });
        }
        
        models.push(processedModel);
      });
    } else {
      // Fallback to hardcoded generation if discovery data is missing
      console.warn(`⚠️ No discovery data for category "${categoryName}", using fallback generation`);
      models.push(...this.generateFallbackModels(categoryName));
    }

    this.cache.set(cacheKey, {
      data: models,
      timestamp: Date.now()
    });

    console.log(`📋 Generated ${models.length} models for category "${categoryName}"`);
    console.log(`🖼️ First model thumbnail URL: ${models[0]?.thumbnail_url || 'NO MODELS'}`);
    return models;
  }

  /**
   * Generate model ID from category and index
   */
  generateModelId(categoryName, index) {
    const prefix = categoryName.toLowerCase().replace(/\s+/g, '_');
    return `${prefix}_${index + 1}`;
  }

  /**
   * Fallback model generation when discovery data is missing
   */
  generateFallbackModels(categoryName) {
    const models = [];
    
    if (categoryName === 'Side Tables') {
      // Generate all 20 Side Table models with actual file names
      for (let i = 1; i <= 20; i++) {
        const polygonCounts = ['330pl', '1050pl', '1600pl', '1600pl', '400pl', '2000pl', '1400pl', '800pl', '4700pl', '900pl', '1400pl', '1300pl', '800pl', '4000pl', '2200pl', '2100pl', '2500pl', '1000pl', '1550pl', '5400pl'];
        const polygonCount = polygonCounts[i - 1] || '1000pl';
        const modelName = `Side-Table_${i.toString().padStart(2, '0')}-${polygonCount}`;
        const directThumbnailUrl = `${BASE_URL}/Side%20Tables/thumbnails/${modelName}.jpg`;
        
        models.push({
          id: `side_table_${i}`,
          name: modelName,
          displayName: this.generateDisplayName(modelName, categoryName, i),
          category: categoryName,
          thumbnailUrl: this.getProxiedThumbnailUrl(directThumbnailUrl),
          directThumbnailUrl: directThumbnailUrl,
          thumbnail_url: directThumbnailUrl,
          modelUrl: `${BASE_URL}/Side%20Tables/models/${modelName}.fbx`,
          model_url: `${BASE_URL}/Side%20Tables/models/${modelName}.fbx`,
          format: ['fbx'],
          has_textures: true,
          polygon_count: this.extractPolygonCount(modelName),
          type: 'model'
        });
      }
    } else if (categoryName === 'chairs') {
      // Generate all 10 Chair models
      for (let i = 1; i <= 10; i++) {
        const modelName = `CGT_Chair_${i.toString().padStart(3, '0')}`;
        const directThumbnailUrl = `${BASE_URL}/chairs/thumbnails/${modelName}.jpg`;
        
        models.push({
          id: `chair_${i}`,
          name: modelName,
          displayName: this.generateDisplayName(modelName, categoryName, i),
          category: categoryName,
          thumbnailUrl: this.getProxiedThumbnailUrl(directThumbnailUrl),
          directThumbnailUrl: directThumbnailUrl,
          thumbnail_url: directThumbnailUrl,
          modelUrl: `${BASE_URL}/chairs/models/${modelName}.fbx`,
          model_url: `${BASE_URL}/chairs/models/${modelName}.fbx`,
          format: ['fbx'],
          has_textures: true,
          polygon_count: 'Unknown',
          type: 'model'
        });
      }
    } else if (categoryName === 'sofas') {
      // Generate all 10 Sofa models
      for (let i = 1; i <= 10; i++) {
        const modelName = `CGT_Sofa_${i.toString().padStart(3, '0')}`;
        const directThumbnailUrl = `${BASE_URL}/sofas/thumbnails/${modelName}.jpg`;
        
        models.push({
          id: `sofa_${i}`,
          name: modelName,
          displayName: this.generateDisplayName(modelName, categoryName, i),
          category: categoryName,
          thumbnailUrl: this.getProxiedThumbnailUrl(directThumbnailUrl),
          directThumbnailUrl: directThumbnailUrl,
          thumbnail_url: directThumbnailUrl,
          modelUrl: `${BASE_URL}/sofas/models/${modelName}.fbx`,
          model_url: `${BASE_URL}/sofas/models/${modelName}.fbx`,
          format: ['fbx'],
          has_textures: true,
          polygon_count: 'Unknown',
          type: 'model'
        });
      }
    } else if (categoryName === 'stools') {
      // Generate all 8 Stool models
      for (let i = 1; i <= 8; i++) {
        const modelName = `CGT_Stool_${i.toString().padStart(3, '0')}`;
        const directThumbnailUrl = `${BASE_URL}/stools/thumbnails/${modelName}.jpg`;
        
        models.push({
          id: `stool_${i}`,
          name: modelName,
          displayName: this.generateDisplayName(modelName, categoryName, i),
          category: categoryName,
          thumbnailUrl: this.getProxiedThumbnailUrl(directThumbnailUrl),
          directThumbnailUrl: directThumbnailUrl,
          thumbnail_url: directThumbnailUrl,
          modelUrl: `${BASE_URL}/stools/models/${modelName}.fbx`,
          model_url: `${BASE_URL}/stools/models/${modelName}.fbx`,
          format: ['fbx'],
          has_textures: true,
          polygon_count: 'Unknown',
          type: 'model'
        });
      }
    }

    return models;
  }

  /**
   * Get all models from all categories
   */
  async getAllModels() {
    await this.initialize();
    
    const categories = await this.getCategories();
    const allModels = [];

    for (const category of categories) {
      const categoryModels = await this.getCategoryModels(category.name);
      allModels.push(...categoryModels);
    }

    console.log(`📦 Collected ${allModels.length} total models from all categories`);
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
   * Get service statistics
   */
  async getStats() {
    await this.initialize();
    
    return {
      totalCategories: this.manifest.totalCategories,
      totalModels: this.manifest.totalModels,
      lastUpdated: this.manifest.generatedAt,
      categories: this.manifest.categories.map(cat => ({
        name: cat.displayName,
        modelCount: cat.modelCount
      }))
    };
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
    console.log('🔄 RealSupabaseService cache cleared');
  }

  /**
   * Validate that a model URL exists (for testing)
   */
  async validateModel(category, modelName) {
    const url = `${BASE_URL}/${encodeURIComponent(category)}/thumbnails/${modelName}.jpg`;
    
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
const realSupabaseService = new RealSupabaseService();
export default realSupabaseService;