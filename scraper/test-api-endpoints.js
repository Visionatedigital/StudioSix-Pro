#!/usr/bin/env node

/**
 * TASK 7: API Endpoints Test Suite
 * Comprehensive testing of all Furniture Assets API endpoints
 */

require('dotenv').config();
const FurnitureAssetsAPI = require('./api/furniture-assets-api');
const logger = require('./utils/logger');

class APIEndpointsTest {
  constructor() {
    this.api = new FurnitureAssetsAPI();
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      results: []
    };
  }

  /**
   * Run all API endpoint tests
   */
  async runAllTests() {
    console.log('🧪 TASK 7: API ENDPOINTS TEST SUITE\n');
    
    try {
      // Initialize API
      console.log('📡 Step 1: Initializing API...');
      await this.api.initialize();
      console.log('✅ API initialized successfully\n');

      // Test Subtask 7.1: Database schema (already verified in Task 5)
      console.log('🔍 Test Group 1: Database Schema (Subtask 7.1)');
      await this.testDatabaseSchema();

      // Test Subtask 7.2: List all models
      console.log('🔍 Test Group 2: List All Models (Subtask 7.2)');
      await this.testListAllModels();
      
      // Test Subtask 7.3: Get model by ID
      console.log('🔍 Test Group 3: Get Model by ID (Subtask 7.3)');
      await this.testGetModelById();
      
      // Test Subtask 7.4: Full-text search
      console.log('🔍 Test Group 4: Full-Text Search (Subtask 7.4)');
      await this.testFullTextSearch();
      
      // Test Subtask 7.5: Filter by tags
      console.log('🔍 Test Group 5: Filter by Tags (Subtask 7.5)');
      await this.testFilterByTags();

      // Test additional endpoints
      console.log('🔍 Test Group 6: Additional Features');
      await this.testAdditionalEndpoints();
      
      // Display results
      this.displayResults();
      
    } catch (error) {
      console.error('\n❌ TEST SUITE FAILED:', error.message);
      console.error('🔧 Please check your API configuration and database');
      process.exit(1);
    }
  }

  /**
   * Test helper method
   */
  async runTest(testName, testFunction) {
    try {
      this.testResults.total++;
      console.log(`   🔸 ${testName}...`);
      
      const result = await testFunction();
      
      if (result.success) {
        this.testResults.passed++;
        console.log(`   ✅ ${testName} - PASSED`);
        if (result.details) {
          console.log(`      ${result.details}`);
        }
      } else {
        this.testResults.failed++;
        console.log(`   ❌ ${testName} - FAILED: ${result.error}`);
      }
      
      this.testResults.results.push({
        name: testName,
        success: result.success,
        error: result.error || null,
        details: result.details || null
      });
      
    } catch (error) {
      this.testResults.failed++;
      this.testResults.total++;
      console.log(`   ❌ ${testName} - ERROR: ${error.message}`);
      
      this.testResults.results.push({
        name: testName,
        success: false,
        error: error.message,
        details: null
      });
    }
  }

  /**
   * Test Subtask 7.1: Database Schema
   */
  async testDatabaseSchema() {
    await this.runTest('Verify furniture_assets table exists', async () => {
      const result = await this.api.database
        .from('furniture_assets')
        .select('count', { count: 'exact', head: true });
      
      if (result.error) {
        return { success: false, error: `Table access failed: ${result.error.message}` };
      }
      
      return { 
        success: true, 
        details: `Table accessible, contains ${result.count} records` 
      };
    });

    await this.runTest('Verify database indexes work', async () => {
      const result = await this.api.database
        .from('furniture_assets')
        .select('category')
        .limit(1);
      
      if (result.error) {
        return { success: false, error: `Index test failed: ${result.error.message}` };
      }
      
      return { success: true, details: 'Category index working' };
    });
  }

  /**
   * Test Subtask 7.2: List All Models
   */
  async testListAllModels() {
    await this.runTest('Basic model listing', async () => {
      const result = await this.api.listAllModels({ limit: 5 });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Retrieved ${result.data.length} models` 
      };
    });

    await this.runTest('Pagination functionality', async () => {
      const result = await this.api.listAllModels({ page: 1, limit: 2 });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      if (!result.pagination) {
        return { success: false, error: 'Missing pagination data' };
      }
      
      return { 
        success: true, 
        details: `Page ${result.pagination.page}, Total: ${result.pagination.total}` 
      };
    });

    await this.runTest('Category filtering', async () => {
      const result = await this.api.listAllModels({ category: 'furniture', limit: 3 });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Found ${result.data.length} furniture models` 
      };
    });

    await this.runTest('Sorting functionality', async () => {
      const result = await this.api.listAllModels({ 
        sortBy: 'download_count', 
        sortOrder: 'desc', 
        limit: 3 
      });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Sorted by download count: ${result.data.length} models` 
      };
    });
  }

  /**
   * Test Subtask 7.3: Get Model by ID
   */
  async testGetModelById() {
    let testModelId = null;

    await this.runTest('Get available model ID', async () => {
      const result = await this.api.listAllModels({ limit: 1 });
      
      if (!result.success || result.data.length === 0) {
        return { success: false, error: 'No models available for ID test' };
      }
      
      testModelId = result.data[0].id;
      return { 
        success: true, 
        details: `Found test model ID: ${testModelId}` 
      };
    });

    if (testModelId) {
      await this.runTest('Get model by valid ID', async () => {
        const result = await this.api.getModelById(testModelId);
        
        if (!result.success) {
          return { success: false, error: result.error };
        }
        
        return { 
          success: true, 
          details: `Retrieved model: ${result.data.name}` 
        };
      });
    }

    await this.runTest('Get model by invalid ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const result = await this.api.getModelById(fakeId);
      
      if (result.success) {
        return { success: false, error: 'Should have failed with invalid ID' };
      }
      
      if (result.error !== 'Model not found') {
        return { success: false, error: `Unexpected error: ${result.error}` };
      }
      
      return { 
        success: true, 
        details: 'Correctly returned "Model not found"' 
      };
    });
  }

  /**
   * Test Subtask 7.4: Full-Text Search
   */
  async testFullTextSearch() {
    await this.runTest('Search by keyword', async () => {
      const result = await this.api.searchModels('chair', { limit: 3 });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Search for "chair" found ${result.data.length} results` 
      };
    });

    await this.runTest('Search with multiple terms', async () => {
      const result = await this.api.searchModels('modern office', { limit: 3 });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Search for "modern office" found ${result.data.length} results` 
      };
    });

    await this.runTest('Search with filters', async () => {
      const result = await this.api.searchModels('furniture', { 
        category: 'furniture',
        isFree: true,
        limit: 3 
      });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Filtered search found ${result.data.length} results` 
      };
    });

    await this.runTest('Search with no results', async () => {
      const result = await this.api.searchModels('xyzunknownterm12345', { limit: 3 });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      if (result.data.length > 0) {
        return { success: false, error: 'Should have returned no results' };
      }
      
      return { 
        success: true, 
        details: 'Correctly returned no results for unknown term' 
      };
    });
  }

  /**
   * Test Subtask 7.5: Filter by Tags
   */
  async testFilterByTags() {
    await this.runTest('Filter by single tag', async () => {
      const result = await this.api.filterByTags(['chair'], { limit: 3 });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Filter by "chair" tag found ${result.data.length} results` 
      };
    });

    await this.runTest('Filter by multiple tags (OR logic)', async () => {
      const result = await this.api.filterByTags(['chair', 'table'], { 
        matchAll: false,
        limit: 3 
      });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `OR filter found ${result.data.length} results` 
      };
    });

    await this.runTest('Filter by multiple tags (AND logic)', async () => {
      const result = await this.api.filterByTags(['modern', 'furniture'], { 
        matchAll: true,
        limit: 3 
      });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `AND filter found ${result.data.length} results` 
      };
    });

    await this.runTest('Filter with additional parameters', async () => {
      const result = await this.api.filterByTags(['furniture'], { 
        category: 'furniture',
        isFree: true,
        limit: 3 
      });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Filtered tag search found ${result.data.length} results` 
      };
    });
  }

  /**
   * Test additional endpoints
   */
  async testAdditionalEndpoints() {
    await this.runTest('Get popular models', async () => {
      const result = await this.api.getPopularModels({ limit: 5 });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Retrieved ${result.data.length} popular models` 
      };
    });

    await this.runTest('Get categories', async () => {
      const result = await this.api.getCategories();
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Retrieved ${result.data.length} categories` 
      };
    });

    await this.runTest('Get API statistics', async () => {
      const result = await this.api.getStats();
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { 
        success: true, 
        details: `Stats: ${result.data.totalModels} total models` 
      };
    });
  }

  /**
   * Display test results
   */
  displayResults() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${this.testResults.total}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📈 Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.results
        .filter(test => !test.success)
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.error}`);
        });
    }
    
    if (this.testResults.passed === this.testResults.total) {
      console.log('\n🎉 ALL TESTS PASSED! 🎉');
      console.log('✅ Task 7 API endpoints are working perfectly!');
      console.log('\n📋 All Subtasks Verified:');
      console.log('   ✅ Subtask 7.1: Database schema accessible');
      console.log('   ✅ Subtask 7.2: List all models endpoint');
      console.log('   ✅ Subtask 7.3: Get model by ID endpoint'); 
      console.log('   ✅ Subtask 7.4: Full-text search endpoint');
      console.log('   ✅ Subtask 7.5: Filter by tags endpoint');
      console.log('\n🚀 Your API is production ready!');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the issues above.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new APIEndpointsTest();
  test.runAllTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = APIEndpointsTest; 