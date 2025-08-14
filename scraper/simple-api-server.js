#!/usr/bin/env node

/**
 * Simple API Server for Scraped 3D Models
 * Serves models data from Supabase storage without complex routing
 */

require('dotenv').config();
const http = require('http');
const url = require('url');
const SupabaseModelsService = require('./supabase-models-service');

class SimpleAPIServer {
  constructor() {
    this.modelsService = new SupabaseModelsService();
    this.port = process.env.API_PORT || 3001;
  }

  async handleRequest(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const query = parsedUrl.query;

    console.log(`📡 ${req.method} ${path}`);

    try {
      // Route handling
      if (path === '/health') {
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }));
        return;
      }

      if (path === '/api/models') {
        const category = query.category;
        const result = category 
          ? await this.modelsService.getModelsByCategory(category)
          : await this.modelsService.getAvailableModels();
        
        res.statusCode = 200;
        res.end(JSON.stringify(result));
        return;
      }

      if (path === '/api/categories') {
        const result = await this.modelsService.getCategories();
        res.statusCode = 200;
        res.end(JSON.stringify(result));
        return;
      }

      if (path === '/api/search') {
        const searchQuery = query.q || query.query;
        if (!searchQuery) {
          res.statusCode = 400;
          res.end(JSON.stringify({
            success: false,
            error: 'Missing search query',
            message: 'Please provide a search query using ?q=your-search-term'
          }));
          return;
        }

        const result = await this.modelsService.searchModels(searchQuery, { category: query.category });
        res.statusCode = 200;
        res.end(JSON.stringify(result));
        return;
      }

      // Default API info
      if (path === '/api' || path === '/api/') {
        res.statusCode = 200;
        res.end(JSON.stringify({
          name: 'Simple 3D Models API',
          version: '1.0.0',
          description: 'API for scraped 3D models from Supabase storage',
          endpoints: {
            'GET /api/models': 'List all scraped models',
            'GET /api/models?category=vehicles': 'Filter models by category',
            'GET /api/search?q=car': 'Search models',
            'GET /api/categories': 'Get available categories'
          }
        }));
        return;
      }

      // 404 Not Found
      res.statusCode = 404;
      res.end(JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        message: `The endpoint ${req.method} ${path} does not exist`
      }));

    } catch (error) {
      console.error('❌ Server error:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      }));
    }
  }

  start() {
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    server.listen(this.port, () => {
      console.log('🎉 Simple API Server started successfully!');
      console.log(`📡 Server running on port ${this.port}`);
      console.log(`🔗 API Base URL: http://localhost:${this.port}`);
      console.log(`💓 Health Check: http://localhost:${this.port}/health`);
      console.log('\n📋 Available Endpoints:');
      console.log('   • GET  /api/models          - List all scraped models');
      console.log('   • GET  /api/models?category=vehicles - Filter by category');
      console.log('   • GET  /api/search?q=car    - Search models');
      console.log('   • GET  /api/categories      - List categories');
      console.log('\n🚀 Furniture popup should now show real scraped models!');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => server.close());
    process.on('SIGINT', () => server.close());
  }
}

// Start server if called directly
if (require.main === module) {
  const server = new SimpleAPIServer();
  server.start();
}

module.exports = SimpleAPIServer;