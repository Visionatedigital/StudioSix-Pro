#!/usr/bin/env node

/**
 * Discover Actual Models Script
 * 
 * This script checks what models actually exist in your Supabase bucket
 * and generates an accurate manifest based on real files.
 */

const https = require('https');

const SUPABASE_URL = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const BUCKET_NAME = 'models_fbx';

/**
 * Check if a URL returns 200 OK
 */
function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

/**
 * Test a range of numbered models for a category
 */
async function testModelRange(category, basePattern, start = 1, end = 30) {
  console.log(`\n🔍 Testing ${category} models (${basePattern})...`);
  const existingModels = [];
  
  for (let i = start; i <= end; i++) {
    const paddedNum = i.toString().padStart(2, '0');
    const modelName = basePattern.replace('{num}', paddedNum);
    const thumbnailUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(category)}/thumbnails/${modelName}.jpg`;
    
    process.stdout.write(`   Testing ${modelName}... `);
    
    const exists = await checkUrl(thumbnailUrl);
    if (exists) {
      console.log('✅ EXISTS');
      existingModels.push({
        name: modelName,
        displayName: generateDisplayName(modelName, i)
      });
    } else {
      console.log('❌ Missing');
    }
  }
  
  return existingModels;
}

/**
 * Generate a nice display name for a model
 */
function generateDisplayName(modelName, index) {
  if (modelName.includes('Side-Table')) {
    const styles = [
      'Modern', 'Classic', 'Minimalist', 'Contemporary', 'Elegant', 
      'Wooden', 'Glass', 'Industrial', 'Vintage', 'Scandinavian',
      'Rustic', 'Marble', 'Metal', 'Round', 'Square', 
      'Oval', 'Hexagon', 'Luxury', 'Designer', 'Premium'
    ];
    const style = styles[(index - 1) % styles.length];
    return `${style} Side Table ${index.toString().padStart(2, '0')}`;
  }
  
  if (modelName.includes('CGT_Chair')) {
    const styles = [
      'Modern Office', 'Executive', 'Ergonomic', 'Designer', 'Conference',
      'Task', 'Gaming', 'Lounge', 'Dining', 'Accent'
    ];
    const style = styles[(index - 1) % styles.length];
    return `${style} Chair ${index.toString().padStart(3, '0')}`;
  }
  
  return modelName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Main discovery function
 */
async function discoverActualModels() {
  console.log('🚀 Discovering actual models in Supabase bucket...\n');
  
  const categories = [];
  
  // Test Side Tables
  const sideTables = await testModelRange('Side Tables', 'Side-Table_{num}-330pl', 1, 25);
  if (sideTables.length > 0) {
    categories.push({
      name: 'Side Tables',
      displayName: 'Side Tables',
      icon: 'table',
      type: 'supabase',
      models: sideTables
    });
  }
  
  // Test Chairs
  const chairs = await testModelRange('chairs', 'CGT_Chair_{num}', 1, 10);
  if (chairs.length > 0) {
    categories.push({
      name: 'chairs',
      displayName: 'Chairs', 
      icon: 'chair',
      type: 'supabase',
      models: chairs
    });
  }
  
  // Test other potential categories
  const otherCategories = ['Lounge Chairs', 'Coffee Tables', 'Desks'];
  
  for (const category of otherCategories) {
    console.log(`\n🔍 Testing ${category} for any models...`);
    
    // Test common patterns
    const patterns = [
      `${category.replace(/\s+/g, '-')}_001`,
      `${category.replace(/\s+/g, '_')}_001`, 
      `${category.split(' ')[0]}_001`
    ];
    
    for (const pattern of patterns) {
      const thumbnailUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(category)}/thumbnails/${pattern}.jpg`;
      const exists = await checkUrl(thumbnailUrl);
      
      if (exists) {
        console.log(`   ✅ Found pattern: ${pattern}`);
        // Could expand this category if needed
        break;
      }
    }
  }
  
  // Generate summary
  console.log('\n📊 DISCOVERY SUMMARY:');
  console.log('='.repeat(50));
  
  let totalModels = 0;
  categories.forEach(cat => {
    console.log(`${cat.displayName}: ${cat.models.length} models`);
    totalModels += cat.models.length;
  });
  
  console.log(`\nTotal: ${totalModels} models across ${categories.length} categories`);
  
  // Generate manifest code
  console.log('\n📝 UPDATED MANIFEST CODE:');
  console.log('='.repeat(50));
  console.log('Copy this into src/services/SupabaseModelsManifest.js:\n');
  
  console.log('export const MODEL_MANIFEST = {');
  console.log('  categories: [');
  
  categories.forEach((cat, catIndex) => {
    console.log('    {');
    console.log(`      name: '${cat.name}',`);
    console.log(`      displayName: '${cat.displayName}',`);
    console.log(`      icon: '${cat.icon}',`);
    console.log(`      type: '${cat.type}',`);
    console.log('      models: [');
    
    cat.models.forEach((model, modelIndex) => {
      const comma = modelIndex < cat.models.length - 1 ? ',' : '';
      console.log(`        { name: '${model.name}', displayName: '${model.displayName}' }${comma}`);
    });
    
    console.log('      ]');
    const comma = catIndex < categories.length - 1 ? ',' : '';
    console.log(`    }${comma}`);
  });
  
  console.log('  ]');
  console.log('};');
  
  return categories;
}

// Run discovery
if (require.main === module) {
  discoverActualModels().catch(console.error);
}

module.exports = { discoverActualModels };

