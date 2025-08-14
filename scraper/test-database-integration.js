#!/usr/bin/env node

/**
 * Task 6 Database Integration Test
 * Verifies that metadata insertion into Supabase works correctly
 */

require('dotenv').config();
const SupabaseUploader = require('./supabase-uploader');
const ModelCategorizer = require('./utils/model-categorizer');
const logger = require('./utils/logger');

class DatabaseIntegrationTest {
  constructor() {
    this.uploader = new SupabaseUploader();
    this.categorizer = new ModelCategorizer();
  }

  async runTests() {
    console.log('🧪 TASK 6 DATABASE INTEGRATION TEST\n');
    
    try {
      // Initialize uploader
      console.log('📡 Step 1: Initializing Supabase uploader...');
      await this.uploader.initialize();
      console.log('✅ Uploader initialized\n');

      // Test 1: Test metadata preparation
      console.log('🔍 Test 1: Testing metadata preparation...');
      await this.testMetadataPreparation();
      
      // Test 2: Test database insertion
      console.log('🔍 Test 2: Testing database insertion...');
      await this.testDatabaseInsertion();
      
      // Test 3: Test duplicate detection
      console.log('🔍 Test 3: Testing duplicate detection...');
      await this.testDuplicateDetection();
      
      // Test 4: Test database queries
      console.log('🔍 Test 4: Testing database queries...');
      await this.testDatabaseQueries();
      
      console.log('\n🎉 ALL TESTS PASSED! 🎉');
      console.log('✅ Task 6 database integration is working perfectly!');
      
    } catch (error) {
      console.error('\n❌ TEST FAILED:', error.message);
      console.error('🔧 Please check your database schema and configuration');
      process.exit(1);
    }
  }

  async testMetadataPreparation() {
    // Mock scraped metadata
    const mockMetadata = {
      title: 'Test Office Chair Model',
      description: 'A modern ergonomic office chair for testing',
      tags: ['chair', 'office', 'furniture', 'modern'],
      formats: ['obj', 'mtl', 'fbx'],
      author: {
        name: 'Test Author',
        profileUrl: 'https://example.com/author'
      },
      stats: {
        downloads: 150,
        rating: 4.5,
        views: 1200
      },
      license: 'Creative Commons',
      isFree: true,
      originalUrl: 'https://free3d.com/test-model'
    };

    // Mock file URLs
    const mockFileUrls = {
      modelUrl: 'https://storage.supabase.co/test/models/chair.obj',
      thumbnailUrl: 'https://storage.supabase.co/test/thumbnails/chair.jpg',
      downloadUrl: 'https://storage.supabase.co/test/models/chair.obj'
    };

    // Mock categorization
    const mockCategorization = this.categorizer.categorizeModel(mockMetadata);

    // Test metadata preparation
    const preparedMetadata = this.uploader.prepareMetadataForDatabase(mockMetadata, mockFileUrls, mockCategorization);

    // Verify prepared metadata structure
    const requiredFields = ['name', 'category', 'model_url', 'source', 'tags'];
    for (const field of requiredFields) {
      if (!preparedMetadata.hasOwnProperty(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    console.log('   ✅ Metadata preparation successful');
    console.log(`   📝 Name: ${preparedMetadata.name}`);
    console.log(`   📂 Category: ${preparedMetadata.category}/${preparedMetadata.subcategory}`);
    console.log(`   🏷️  Tags: ${preparedMetadata.tags}`);
    console.log(`   🔗 Model URL: ${preparedMetadata.model_url}\n`);

    return preparedMetadata;
  }

  async testDatabaseInsertion() {
    // Create test metadata
    const testMetadata = {
      name: `Test Model ${Date.now()}`,
      description: 'Test model for database integration',
      category: 'furniture',
      subcategory: 'interior/chairs',
      tags: JSON.stringify(['test', 'chair', 'furniture']),
      model_url: `https://test.com/models/test-${Date.now()}.obj`,
      thumbnail_url: `https://test.com/thumbnails/test-${Date.now()}.jpg`,
      source: 'Free3D',
      author_name: 'Test Author',
      format: ['obj', 'mtl'],
      has_textures: true,
      is_free: true,
      extraction_confidence: 85,
      categorization_confidence: 90
    };

    // Test database insertion
    const result = await this.uploader.insertMetadataToDatabase(testMetadata);

    if (!result.success || !result.isNew) {
      throw new Error('Database insertion failed');
    }

    console.log('   ✅ Database insertion successful');
    console.log(`   🆔 Record ID: ${result.modelId}`);
    console.log(`   📝 Model: ${result.modelData.name}`);
    console.log(`   📂 Category: ${result.modelData.category}/${result.modelData.subcategory}\n`);

    // Store test ID for cleanup
    this.testModelId = result.modelId;
    return result;
  }

  async testDuplicateDetection() {
    // Test with same model URL (should detect duplicate)
    const duplicateMetadata = {
      name: 'Duplicate Test Model',
      description: 'This should be detected as duplicate',
      category: 'furniture',
      subcategory: 'interior/tables',
      tags: JSON.stringify(['test', 'duplicate']),
      model_url: `https://test.com/models/test-${Date.now()}.obj`, // Same URL pattern
      source: 'Free3D'
    };

    // First insert
    const firstResult = await this.uploader.insertMetadataToDatabase(duplicateMetadata);
    
    // Second insert with same URL (should detect duplicate)
    const secondResult = await this.uploader.insertMetadataToDatabase(duplicateMetadata);

    if (secondResult.isNew) {
      throw new Error('Duplicate detection failed - same model inserted twice');
    }

    console.log('   ✅ Duplicate detection working');
    console.log(`   🔄 Detected existing model: ${secondResult.modelId}\n`);

    return secondResult;
  }

  async testDatabaseQueries() {
    // Test basic query
    const { data: allModels, error: queryError } = await this.uploader.database
      .from('furniture_assets')
      .select('id, name, category, created_at')
      .limit(5);

    if (queryError) {
      throw new Error(`Database query failed: ${queryError.message}`);
    }

    console.log('   ✅ Database queries working');
    console.log(`   📊 Found ${allModels.length} models in database`);

    // Test search by category
    const { data: furnitureModels, error: categoryError } = await this.uploader.database
      .from('furniture_assets')
      .select('id, name, subcategory')
      .eq('category', 'furniture')
      .limit(3);

    if (categoryError) {
      throw new Error(`Category query failed: ${categoryError.message}`);
    }

    console.log(`   🪑 Found ${furnitureModels.length} furniture models`);

    // Test tag search
    const { data: taggedModels, error: tagError } = await this.uploader.database
      .from('furniture_assets')
      .select('id, name, tags')
      .contains('tags', JSON.stringify(['test']))
      .limit(3);

    if (tagError) {
      console.warn(`   ⚠️  Tag search note: ${tagError.message}`);
    } else {
      console.log(`   🏷️  Found ${taggedModels.length} models with test tags`);
    }

    console.log('');
    return { allModels, furnitureModels, taggedModels };
  }

  async cleanup() {
    try {
      if (this.testModelId) {
        console.log('🧹 Cleaning up test data...');
        const { error } = await this.uploader.database
          .from('furniture_assets')
          .delete()
          .eq('id', this.testModelId);

        if (error) {
          console.warn('⚠️  Cleanup note:', error.message);
        } else {
          console.log('✅ Test data cleaned up');
        }
      }
    } catch (error) {
      console.warn('⚠️  Cleanup note:', error.message);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const test = new DatabaseIntegrationTest();
  test.runTests()
    .then(() => test.cleanup())
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = DatabaseIntegrationTest; 