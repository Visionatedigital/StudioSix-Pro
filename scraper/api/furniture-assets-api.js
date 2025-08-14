/**
 * TASK 7: Supabase API Endpoints for Furniture Assets
 * Provides comprehensive API access to the furniture_assets database
 */

require('dotenv').config();
const SupabaseClient = require('../supabase-client');
const logger = require('../utils/logger');

class FurnitureAssetsAPI {
  constructor() {
    this.supabaseClient = new SupabaseClient();
    this.isInitialized = false;
    this.database = null;
  }

  /**
   * Initialize the API connection
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return true;
      }

      logger.info('🚀 Initializing Furniture Assets API...');
      
      // Initialize Supabase client
      await this.supabaseClient.initialize();
      this.database = this.supabaseClient.client;
      this.isInitialized = true;

      logger.info('✅ Furniture Assets API initialized successfully');
      return true;

    } catch (error) {
      logger.error('❌ Failed to initialize Furniture Assets API:', error);
      throw error;
    }
  }

  /**
   * SUBTASK 7.2: List All Models
   * Retrieve a paginated list of all models from the database
   */
  async listAllModels(options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const {
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'desc',
        category = null,
        isFree = null
      } = options;

      logger.info(`📋 Listing models: page ${page}, limit ${limit}, sort by ${sortBy} ${sortOrder}`);

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Build the query
      let query = this.database
        .from('furniture_assets')
        .select(`
          id,
          name,
          description,
          category,
          subcategory,
          tags,
          model_url,
          thumbnail_url,
          source,
          author_name,
          format,
          has_textures,
          is_rigged,
          has_animations,
          is_free,
          rating,
          download_count,
          created_at
        `);

      // Apply filters
      if (category) {
        query = query.eq('category', category);
      }

      if (isFree !== null) {
        query = query.eq('is_free', isFree);
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      const { data: models, error, count } = await query;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Get total count for pagination
      const { count: totalCount, error: countError } = await this.database
        .from('furniture_assets')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        logger.warn('⚠️ Failed to get total count:', countError.message);
      }

      const result = {
        success: true,
        data: models,
        pagination: {
          page,
          limit,
          total: totalCount || models.length,
          totalPages: Math.ceil((totalCount || models.length) / limit),
          hasNext: (page * limit) < (totalCount || models.length),
          hasPrev: page > 1
        },
        filters: {
          category,
          isFree,
          sortBy,
          sortOrder
        }
      };

      logger.info(`✅ Retrieved ${models.length} models (total: ${totalCount})`);
      return result;

    } catch (error) {
      logger.error('❌ Failed to list models:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: null
      };
    }
  }

  /**
   * SUBTASK 7.3: Fetch Model Details by ID
   * Retrieve detailed information about a specific model
   */
  async getModelById(modelId) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info(`🔍 Fetching model details for ID: ${modelId}`);

      const { data: model, error } = await this.database
        .from('furniture_assets')
        .select('*')
        .eq('id', modelId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Model not found',
            data: null
          };
        }
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Parse tags if they're stored as JSON string
      if (model.tags && typeof model.tags === 'string') {
        try {
          model.tags = JSON.parse(model.tags);
        } catch (e) {
          logger.warn('⚠️ Failed to parse tags as JSON:', e.message);
        }
      }

      logger.info(`✅ Retrieved model: ${model.name}`);
      return {
        success: true,
        data: model,
        error: null
      };

    } catch (error) {
      logger.error(`❌ Failed to fetch model ${modelId}:`, error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * SUBTASK 7.4: Full-Text Search by Tags
   * Search for models using full-text search on tags and other fields
   */
  async searchModels(searchQuery, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const {
        page = 1,
        limit = 20,
        category = null,
        isFree = null,
        hasTextures = null,
        isRigged = null
      } = options;

      logger.info(`🔍 Searching models for: "${searchQuery}"`);

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Build the search query
      let query = this.database
        .from('furniture_assets')
        .select(`
          id,
          name,
          description,
          category,
          subcategory,
          tags,
          model_url,
          thumbnail_url,
          author_name,
          rating,
          download_count,
          created_at
        `);

      // Full-text search on multiple fields
      const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0);
      
      // Apply search across multiple fields
      if (searchTerms.length > 0) {
        // Search in name, description, and tags
        const searchConditions = searchTerms.map(term => 
          `name.ilike.%${term}%,description.ilike.%${term}%,tags.cs.["${term}"]`
        );
        
        // Use OR conditions for flexible matching
        query = query.or(searchConditions.join(','));
      }

      // Apply additional filters
      if (category) {
        query = query.eq('category', category);
      }

      if (isFree !== null) {
        query = query.eq('is_free', isFree);
      }

      if (hasTextures !== null) {
        query = query.eq('has_textures', hasTextures);
      }

      if (isRigged !== null) {
        query = query.eq('is_rigged', isRigged);
      }

      // Apply pagination and sorting (by relevance/download count)
      query = query
        .order('download_count', { ascending: false })
        .order('rating', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      const { data: models, error } = await query;

      if (error) {
        throw new Error(`Search query failed: ${error.message}`);
      }

      const result = {
        success: true,
        data: models,
        searchQuery,
        pagination: {
          page,
          limit,
          total: models.length,
          hasNext: models.length === limit,
          hasPrev: page > 1
        },
        filters: {
          category,
          isFree,
          hasTextures,
          isRigged
        }
      };

      logger.info(`✅ Search found ${models.length} models for "${searchQuery}"`);
      return result;

    } catch (error) {
      logger.error(`❌ Search failed for "${searchQuery}":`, error);
      return {
        success: false,
        error: error.message,
        data: [],
        searchQuery,
        pagination: null
      };
    }
  }

  /**
   * SUBTASK 7.5: Filter Models by Tags
   * Filter models based on specific tags using exact matching
   */
  async filterByTags(tags, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const {
        page = 1,
        limit = 20,
        matchAll = false, // true = AND logic, false = OR logic
        category = null,
        isFree = null
      } = options;

      logger.info(`🏷️ Filtering models by tags: [${tags.join(', ')}] (${matchAll ? 'AND' : 'OR'} logic)`);

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Build the query
      let query = this.database
        .from('furniture_assets')
        .select(`
          id,
          name,
          description,
          category,
          subcategory,
          tags,
          model_url,
          thumbnail_url,
          author_name,
          rating,
          download_count,
          created_at
        `);

      // Apply tag filtering
      if (tags && tags.length > 0) {
        if (matchAll) {
          // AND logic - model must have ALL specified tags
          for (const tag of tags) {
            query = query.contains('tags', JSON.stringify([tag]));
          }
        } else {
          // OR logic - model must have ANY of the specified tags
          const tagConditions = tags.map(tag => `tags.cs.["${tag}"]`);
          query = query.or(tagConditions.join(','));
        }
      }

      // Apply additional filters
      if (category) {
        query = query.eq('category', category);
      }

      if (isFree !== null) {
        query = query.eq('is_free', isFree);
      }

      // Apply pagination and sorting
      query = query
        .order('download_count', { ascending: false })
        .order('rating', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      const { data: models, error } = await query;

      if (error) {
        throw new Error(`Tag filtering failed: ${error.message}`);
      }

      const result = {
        success: true,
        data: models,
        tags,
        matchAll,
        pagination: {
          page,
          limit,
          total: models.length,
          hasNext: models.length === limit,
          hasPrev: page > 1
        },
        filters: {
          category,
          isFree,
          matchAll
        }
      };

      logger.info(`✅ Tag filtering found ${models.length} models`);
      return result;

    } catch (error) {
      logger.error(`❌ Tag filtering failed:`, error);
      return {
        success: false,
        error: error.message,
        data: [],
        tags,
        pagination: null
      };
    }
  }

  /**
   * Get Popular Models
   * Retrieve models sorted by download count and rating
   */
  async getPopularModels(options = {}) {
    try {
      const {
        limit = 10,
        category = null,
        timeframe = 'all' // 'week', 'month', 'all'
      } = options;

      logger.info(`🔥 Getting popular models (limit: ${limit}, category: ${category || 'all'})`);

      let query = this.database
        .from('furniture_assets')
        .select(`
          id,
          name,
          category,
          subcategory,
          thumbnail_url,
          rating,
          download_count,
          created_at
        `);

      // Apply category filter
      if (category) {
        query = query.eq('category', category);
      }

      // Apply timeframe filter
      if (timeframe !== 'all') {
        const daysAgo = timeframe === 'week' ? 7 : 30;
        const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', cutoffDate);
      }

      // Sort by popularity metrics
      query = query
        .order('download_count', { ascending: false })
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(limit);

      const { data: models, error } = await query;

      if (error) {
        throw new Error(`Popular models query failed: ${error.message}`);
      }

      logger.info(`✅ Retrieved ${models.length} popular models`);
      return {
        success: true,
        data: models,
        options: { limit, category, timeframe }
      };

    } catch (error) {
      logger.error('❌ Failed to get popular models:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Get Categories with Counts
   * Retrieve all categories with model counts
   */
  async getCategories() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('📂 Getting categories with counts...');

      const { data: categories, error } = await this.database
        .from('furniture_category_stats')
        .select('*')
        .order('model_count', { ascending: false });

      if (error) {
        throw new Error(`Categories query failed: ${error.message}`);
      }

      logger.info(`✅ Retrieved ${categories.length} categories`);
      return {
        success: true,
        data: categories
      };

    } catch (error) {
      logger.error('❌ Failed to get categories:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Get API Statistics
   * Retrieve database statistics and health metrics
   */
  async getStats() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('📊 Getting API statistics...');

      // Get total model count
      const { count: totalModels, error: countError } = await this.database
        .from('furniture_assets')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        throw new Error(`Count query failed: ${countError.message}`);
      }

      // Get category breakdown
      const { data: categoryStats, error: categoryError } = await this.database
        .from('furniture_category_stats')
        .select('category, model_count')
        .order('model_count', { ascending: false })
        .limit(10);

      if (categoryError) {
        throw new Error(`Category stats query failed: ${categoryError.message}`);
      }

      // Get recent additions
      const { data: recentModels, error: recentError } = await this.database
        .from('furniture_assets')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .select('*', { count: 'exact', head: true });

      const stats = {
        totalModels,
        categoriesCount: categoryStats.length,
        topCategories: categoryStats,
        recentAdditions: recentModels?.length || 0,
        lastUpdated: new Date().toISOString()
      };

      logger.info(`✅ API stats: ${totalModels} total models, ${categoryStats.length} categories`);
      return {
        success: true,
        data: stats
      };

    } catch (error) {
      logger.error('❌ Failed to get stats:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
}

module.exports = FurnitureAssetsAPI; 