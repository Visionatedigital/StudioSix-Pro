#!/usr/bin/env node

/**
 * Model Discovery Script for Supabase Storage
 * 
 * This script scans the models_fbx bucket and generates a manifest
 * of all available models, categories, and their metadata.
 * 
 * Usage: node scripts/discover-models.js
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// Supabase configuration
const SUPABASE_URL = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const BUCKET_NAME = 'models_fbx';
const OUTPUT_FILE = './public/models-manifest.json';

/**
 * Fetch URL and return parsed JSON
 */
async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Check if a file exists at the given URL
 */
async function checkFileExists(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

/**
 * Discover all categories by checking known patterns and specific files
 */
async function discoverCategories() {
  console.log('🔍 Discovering categories by testing known model files...');
  
  // Test for known categories with specific model files we know exist
  const categoryTests = [
    {
      name: 'Side Tables',
      testFile: 'Side-Table_01-330pl.jpg'
    },
    {
      name: 'chairs',
      testFile: 'CGT_Chair_001.jpg'
    },
    {
      name: 'Lounge Chairs', 
      testFile: 'CGT_Chair_001.jpg' // You might have different names
    }
  ];
  
  const discoveredCategories = [];
  
  for (const test of categoryTests) {
    const thumbnailTestUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(test.name)}/thumbnails/${test.testFile}`;
    
    console.log(`   Testing category "${test.name}" with file: ${test.testFile}`);
    console.log(`   URL: ${thumbnailTestUrl}`);
    
    const exists = await checkFileExists(thumbnailTestUrl);
    if (exists) {
      discoveredCategories.push(test.name);
      console.log(`   ✅ Found category: ${test.name}`);
    } else {
      console.log(`   ❌ Category not found: ${test.name}`);
    }
  }
  
  // Also test with more flexible naming
  if (discoveredCategories.length === 0) {
    console.log('🔍 No categories found with exact names, trying alternate patterns...');
    
    // Test URL-encoded spaces
    const alternateTests = [
      'Side%20Tables',
      'Lounge%20Chairs',
      'chairs'
    ];
    
    for (const altName of alternateTests) {
      const testUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${altName}/thumbnails/`;
      console.log(`   Testing alternate: ${altName}`);
      
      if (await checkFileExists(testUrl)) {
        const decodedName = decodeURIComponent(altName);
        discoveredCategories.push(decodedName);
        console.log(`   ✅ Found with alternate naming: ${decodedName}`);
      }
    }
  }
  
  return discoveredCategories;
}

/**
 * Discover models in a category by scanning for common patterns
 */
async function discoverModelsInCategory(categoryName) {
  console.log(`📋 Discovering models in category: ${categoryName}`);
  
  const models = [];
  const baseUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(categoryName)}`;
  
  // Common model naming patterns - adjust based on your naming convention
  const commonPatterns = [
    // Side Tables patterns
    'Side-Table_01-330pl', 'Side-Table_02-330pl', 'Side-Table_03-330pl',
    'Side-Table_04-330pl', 'Side-Table_05-330pl', 'Side-Table_06-330pl',
    'Side-Table_07-330pl', 'Side-Table_08-330pl', 'Side-Table_09-330pl',
    'Side-Table_10-330pl', 'Side-Table_11-330pl', 'Side-Table_12-330pl',
    'Side-Table_13-330pl', 'Side-Table_14-330pl', 'Side-Table_15-330pl',
    'Side-Table_16-330pl', 'Side-Table_17-330pl', 'Side-Table_18-330pl',
    'Side-Table_19-330pl', 'Side-Table_20-330pl',
    
    // Chair patterns
    'CGT_Chair_001', 'CGT_Chair_002', 'CGT_Chair_003', 'CGT_Chair_004', 'CGT_Chair_005',
    'Chair_001', 'Chair_002', 'Chair_003', 'Chair_004', 'Chair_005',
    
    // Generic patterns for other categories
    `${categoryName.replace(/\s+/g, '-')}_001`,
    `${categoryName.replace(/\s+/g, '-')}_002`,
    `${categoryName.replace(/\s+/g, '-')}_003`,
    `${categoryName.replace(/\s+/g, '-')}_004`,
    `${categoryName.replace(/\s+/g, '-')}_005`,
    
    // More generic patterns
    'Model_001', 'Model_002', 'Model_003', 'Model_004', 'Model_005'
  ];
  
  // Try numbered sequences up to 50
  for (let i = 1; i <= 50; i++) {
    const paddedNum = i.toString().padStart(3, '0');
    commonPatterns.push(
      `${categoryName.replace(/\s+/g, '-')}_${paddedNum}`,
      `${categoryName.toLowerCase().replace(/\s+/g, '-')}_${paddedNum}`,
      `${categoryName.toUpperCase().replace(/\s+/g, '_')}_${paddedNum}`
    );
  }
  
  for (const pattern of commonPatterns) {
    const thumbnailUrl = `${baseUrl}/thumbnails/${pattern}.jpg`;
    const fbxUrl = `${baseUrl}/models/${pattern}.fbx`;
    
    const thumbnailExists = await checkFileExists(thumbnailUrl);
    
    if (thumbnailExists) {
      const model = {
        id: `${categoryName.toLowerCase().replace(/\s+/g, '_')}_${pattern}`,
        name: pattern,
        displayName: pattern.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        category: categoryName,
        type: 'model',
        format: 'fbx',
        thumbnail: `${pattern}.jpg`,
        thumbnailUrl: thumbnailUrl,
        modelUrl: fbxUrl,
        model_url: fbxUrl,
        file_size_mb: 'Unknown', // Could be determined with HEAD request
        polygon_count: 'Unknown',
        has_textures: true,
        cached: false
      };
      
      models.push(model);
      console.log(`   ✅ Found model: ${pattern}`);
    }
  }
  
  return models;
}

/**
 * Generate the complete models manifest
 */
async function generateManifest() {
  console.log('🚀 Starting model discovery...\n');
  
  const manifest = {
    generated_at: new Date().toISOString(),
    bucket_name: BUCKET_NAME,
    supabase_url: SUPABASE_URL,
    categories: [],
    models: [],
    stats: {
      total_categories: 0,
      total_models: 0
    }
  };
  
  // Discover categories
  const categories = await discoverCategories();
  
  for (const categoryName of categories) {
    const categoryModels = await discoverModelsInCategory(categoryName);
    
    if (categoryModels.length > 0) {
      manifest.categories.push({
        name: categoryName,
        displayName: categoryName,
        icon: getCategoryIcon(categoryName),
        model_count: categoryModels.length,
        type: 'supabase'
      });
      
      manifest.models.push(...categoryModels);
    }
  }
  
  manifest.stats.total_categories = manifest.categories.length;
  manifest.stats.total_models = manifest.models.length;
  
  return manifest;
}

/**
 * Get appropriate icon for category
 */
function getCategoryIcon(categoryName) {
  const iconMap = {
    'Side Tables': 'table',
    'chairs': 'chair',
    'Lounge Chairs': 'armchair',
    'Coffee Tables': 'coffee-table',
    'Dining Tables': 'dining-table',
    'Sofas': 'sofa',
    'Beds': 'bed',
    'Dressers': 'dresser',
    'Bookshelves': 'bookshelf',
    'Desks': 'desk',
    'Bar Stools': 'stool',
    'Nightstands': 'nightstand',
    'Armchairs': 'armchair',
    'Benches': 'bench',
    'Cabinets': 'cabinet',
    'Wardrobes': 'wardrobe'
  };
  
  return iconMap[categoryName] || 'furniture';
}

/**
 * Main execution
 */
async function main() {
  try {
    const manifest = await generateManifest();
    
    // Ensure public directory exists
    await fs.mkdir('./public', { recursive: true });
    
    // Write manifest file
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
    
    console.log('\n✅ Model discovery complete!');
    console.log(`📄 Manifest saved to: ${OUTPUT_FILE}`);
    console.log(`📊 Found ${manifest.stats.total_categories} categories with ${manifest.stats.total_models} models total\n`);
    
    // Print summary
    console.log('📋 Category Summary:');
    for (const category of manifest.categories) {
      console.log(`   ${category.displayName}: ${category.model_count} models`);
    }
    
  } catch (error) {
    console.error('❌ Error during discovery:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateManifest, discoverCategories, discoverModelsInCategory };
