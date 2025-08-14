#!/usr/bin/env node

/**
 * TASK 7: REST API Server for Furniture Assets
 * Express.js server providing HTTP endpoints for the Furniture Assets API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const FurnitureAssetsAPI = require('./furniture-assets-api');
const logger = require('../utils/logger');

class FurnitureAssetsServer {
  constructor() {
    this.app = express();
    this.api = new FurnitureAssetsAPI();
    this.port = process.env.API_PORT || 3001;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      credentials: true
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // Request logging middleware
    this.app.use((req, res, next) => {
      logger.info(`📡 ${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      });
    });

    // API documentation endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Furniture Assets API',
        version: '1.0.0',
        description: 'API for searching and retrieving 3D furniture model metadata',
        endpoints: {
          'GET /api/models': 'List all models with pagination and filtering',
          'GET /api/models/:id': 'Get specific model by ID',
          'GET /api/search': 'Full-text search across models',
          'GET /api/tags': 'Filter models by tags',
          'GET /api/popular': 'Get popular models',
          'GET /api/categories': 'Get categories with counts',
          'GET /api/stats': 'Get API statistics'
        },
        documentation: 'https://docs.example.com/api'
      });
    });

    // SUBTASK 7.2: List all models endpoint
    this.app.get('/api/models', async (req, res) => {
      try {
        const options = {
          page: parseInt(req.query.page) || 1,
          limit: Math.min(parseInt(req.query.limit) || 50, 100), // Max 100 items
          sortBy: req.query.sortBy || 'created_at',
          sortOrder: req.query.sortOrder || 'desc',
          category: req.query.category || null,
          isFree: req.query.isFree ? req.query.isFree === 'true' : null
        };

        const result = await this.api.listAllModels(options);
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(500).json({
            success: false,
            error: result.error,
            message: 'Failed to retrieve models'
          });
        }
      } catch (error) {
        logger.error('❌ /api/models error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    // SUBTASK 7.3: Get model by ID endpoint
    this.app.get('/api/models/:id', async (req, res) => {
      try {
        const modelId = req.params.id;
        
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(modelId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid model ID format',
            message: 'Model ID must be a valid UUID'
          });
        }

        const result = await this.api.getModelById(modelId);
        
        if (result.success) {
          res.json(result);
        } else if (result.error === 'Model not found') {
          res.status(404).json({
            success: false,
            error: 'Model not found',
            message: `No model found with ID: ${modelId}`
          });
        } else {
          res.status(500).json({
            success: false,
            error: result.error,
            message: 'Failed to retrieve model'
          });
        }
      } catch (error) {
        logger.error(`❌ /api/models/:id error:`, error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    // SUBTASK 7.4: Full-text search endpoint
    this.app.get('/api/search', async (req, res) => {
      try {
        const searchQuery = req.query.q || req.query.query;
        
        if (!searchQuery || searchQuery.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Missing search query',
            message: 'Please provide a search query using ?q=your-search-term'
          });
        }

        const options = {
          page: parseInt(req.query.page) || 1,
          limit: Math.min(parseInt(req.query.limit) || 20, 50), // Max 50 for search
          category: req.query.category || null,
          isFree: req.query.isFree ? req.query.isFree === 'true' : null,
          hasTextures: req.query.hasTextures ? req.query.hasTextures === 'true' : null,
          isRigged: req.query.isRigged ? req.query.isRigged === 'true' : null
        };

        const result = await this.api.searchModels(searchQuery.trim(), options);
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(500).json({
            success: false,
            error: result.error,
            message: 'Search failed'
          });
        }
      } catch (error) {
        logger.error('❌ /api/search error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    // SUBTASK 7.5: Filter by tags endpoint
    this.app.get('/api/tags', async (req, res) => {
      try {
        const tagsParam = req.query.tags;
        
        if (!tagsParam) {
          return res.status(400).json({
            success: false,
            error: 'Missing tags parameter',
            message: 'Please provide tags using ?tags=tag1,tag2,tag3'
          });
        }

        const tags = tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        
        if (tags.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No valid tags provided',
            message: 'Please provide at least one valid tag'
          });
        }

        const options = {
          page: parseInt(req.query.page) || 1,
          limit: Math.min(parseInt(req.query.limit) || 20, 50), // Max 50 for filtering
          matchAll: req.query.matchAll === 'true',
          category: req.query.category || null,
          isFree: req.query.isFree ? req.query.isFree === 'true' : null
        };

        const result = await this.api.filterByTags(tags, options);
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(500).json({
            success: false,
            error: result.error,
            message: 'Tag filtering failed'
          });
        }
      } catch (error) {
        logger.error('❌ /api/tags error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    // Popular models endpoint
    this.app.get('/api/popular', async (req, res) => {
      try {
        const options = {
          limit: Math.min(parseInt(req.query.limit) || 10, 50),
          category: req.query.category || null,
          timeframe: req.query.timeframe || 'all'
        };

        const result = await this.api.getPopularModels(options);
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(500).json({
            success: false,
            error: result.error,
            message: 'Failed to get popular models'
          });
        }
      } catch (error) {
        logger.error('❌ /api/popular error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    // Categories endpoint
    this.app.get('/api/categories', async (req, res) => {
      try {
        const result = await this.api.getCategories();
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(500).json({
            success: false,
            error: result.error,
            message: 'Failed to get categories'
          });
        }
      } catch (error) {
        logger.error('❌ /api/categories error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    // Statistics endpoint
    this.app.get('/api/stats', async (req, res) => {
      try {
        const result = await this.api.getStats();
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(500).json({
            success: false,
            error: result.error,
            message: 'Failed to get statistics'
          });
        }
      } catch (error) {
        logger.error('❌ /api/stats error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error.message
        });
      }
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: `The endpoint ${req.method} ${req.baseUrl} does not exist`,
        availableEndpoints: [
          'GET /health',
          'GET /api',
          'GET /api/models',
          'GET /api/models/:id',
          'GET /api/search',
          'GET /api/tags',
          'GET /api/popular',
          'GET /api/categories',
          'GET /api/stats'
        ]
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('❌ Unhandled error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  }

  /**
   * Initialize the API and start the server
   */
  async start() {
    try {
      // Initialize the API
      logger.info('🚀 Initializing Furniture Assets API...');
      await this.api.initialize();

      // Start the server
      this.server = this.app.listen(this.port, () => {
        logger.info(`🎉 Furniture Assets API Server started successfully!`);
        logger.info(`📡 Server running on port ${this.port}`);
        logger.info(`🔗 API Documentation: http://localhost:${this.port}/api`);
        logger.info(`💓 Health Check: http://localhost:${this.port}/health`);
        console.log('\n🚀 TASK 7 COMPLETE: API Server Ready! 🚀');
        console.log(`\n📋 Available Endpoints:`);
        console.log(`   • GET  /api/models          - List all models`);
        console.log(`   • GET  /api/models/:id      - Get model by ID`);
        console.log(`   • GET  /api/search?q=term   - Full-text search`);
        console.log(`   • GET  /api/tags?tags=a,b   - Filter by tags`);
        console.log(`   • GET  /api/popular         - Popular models`);
        console.log(`   • GET  /api/categories      - Categories list`);
        console.log(`   • GET  /api/stats           - API statistics`);
        console.log(`\n🌐 Base URL: http://localhost:${this.port}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.stop());
      process.on('SIGINT', () => this.stop());

    } catch (error) {
      logger.error('❌ Failed to start API server:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop() {
    try {
      logger.info('🛑 Stopping API server...');
      
      if (this.server) {
        this.server.close(() => {
          logger.info('✅ API server stopped gracefully');
          process.exit(0);
        });
      }
    } catch (error) {
      logger.error('❌ Error stopping server:', error);
      process.exit(1);
    }
  }
}

// Start server if called directly
if (require.main === module) {
  const server = new FurnitureAssetsServer();
  server.start();
}

module.exports = FurnitureAssetsServer; 