#!/usr/bin/env node

/**
 * Real Bucket Contents Discovery
 * 
 * This script discovers what's actually in the Supabase bucket by testing
 * known working patterns and expanding from there.
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
 * Test Side Tables with different polygon counts
 */
async function discoverSideTables() {
  console.log('\n🔍 Discovering Side Tables...');
  const models = [];
  
  // Test the patterns we know work
  const knownPatterns = [
    'Side-Table_01-330pl',  // We know this one works
    'Side-Table_02-1050pl', // Test this one
    'Side-Table_03-1600pl', 
    'Side-Table_04-1600pl',
    'Side-Table_05-400pl',
    'Side-Table_06-2000pl',
    'Side-Table_07-1400pl',
    'Side-Table_08-800pl',
    'Side-Table_09-4700pl',
    'Side-Table_10-900pl',
    'Side-Table_11-1400pl',
    'Side-Table_12-1300pl',
    'Side-Table_13-800pl',
    'Side-Table_14-4000pl',
    'Side-Table_15-2200pl',
    'Side-Table_16-2100pl',
    'Side-Table_17-2500pl',
    'Side-Table_18-1000pl',
    'Side-Table_19-1550pl',
    'Side-Table_20-5400pl'
  ];
  
  for (const pattern of knownPatterns) {
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/Side%20Tables/thumbnails/${pattern}.jpg`;
    
    process.stdout.write(`   Testing ${pattern}... `);
    const exists = await checkUrl(url);
    
    if (exists) {
      console.log('✅ EXISTS');
      models.push({
        name: pattern,
        thumbnailUrl: url,
        modelUrl: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/Side%20Tables/models/${pattern}.fbx`
      });
    } else {
      console.log('❌ Missing');
    }
  }
  
  return models;
}

/**
 * Test Chairs with CGT_Chair pattern
 */
async function discoverChairs() {
  console.log('\n🔍 Discovering Chairs...');
  const models = [];
  
  // Test CGT_Chair pattern up to 010
  for (let i = 1; i <= 10; i++) {
    const paddedNum = i.toString().padStart(3, '0');
    const pattern = `CGT_Chair_${paddedNum}`;
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/chairs/thumbnails/${pattern}.jpg`;
    
    process.stdout.write(`   Testing ${pattern}... `);
    const exists = await checkUrl(url);
    
    if (exists) {
      console.log('✅ EXISTS');
      models.push({
        name: pattern,
        thumbnailUrl: url,
        modelUrl: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/chairs/models/${pattern}.fbx`
      });
    } else {
      console.log('❌ Missing');
      // If we haven't found any yet and we're past 5, break
      if (models.length === 0 && i > 5) break;
    }
  }
  
  return models;
}

/**
 * Test other potential categories
 */
async function discoverOtherCategories() {
  console.log('\n🔍 Testing other potential categories...');
  const categories = [];
  
  const categoryTests = [
    { name: 'Lounge Chairs', patterns: ['Lounge_Chair_01', 'CGT_Chair_001', 'Lounge-Chair-01'] },
    { name: 'sofas', patterns: ['Sofa_01', 'CGT_Sofa_001', 'Sofa-01'] },
    { name: 'tables', patterns: ['Table_01', 'CGT_Table_001', 'Table-01'] },
    { name: 'stools', patterns: ['Stool_01', 'CGT_Stool_001', 'Stool-01'] },
    { name: 'armchairs', patterns: ['Armchair_01', 'CGT_Armchair_001', 'Armchair-01'] },
    { name: 'lighting', patterns: ['Light_01', 'Lamp_01', 'CGT_Light_001'] },
    { name: 'lamps', patterns: ['Lamp_01', 'CGT_Lamp_001', 'Table-Lamp-01'] }
  ];
  
  for (const category of categoryTests) {
    console.log(`\n   Testing category: ${category.name}`);
    
    for (const pattern of category.patterns) {
      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(category.name)}/thumbnails/${pattern}.jpg`;
      
      process.stdout.write(`      Testing ${pattern}... `);
      const exists = await checkUrl(url);
      
      if (exists) {
        console.log('✅ FOUND!');
        categories.push({
          name: category.name,
          workingPattern: pattern,
          testUrl: url
        });
        break; // Found working pattern for this category
      } else {
        console.log('❌');
      }
    }
  }
  
  return categories;
}

/**
 * Main discovery function
 */
async function discoverRealContents() {
  console.log('🚀 Discovering real Supabase bucket contents...');
  console.log(`📦 Bucket: ${BUCKET_NAME}`);
  console.log(`🔗 Base URL: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`);
  
  const discovery = {
    generatedAt: new Date().toISOString(),
    bucketName: BUCKET_NAME,
    baseUrl: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`,
    categories: []
  };
  
  // Discover Side Tables
  const sideTables = await discoverSideTables();
  if (sideTables.length > 0) {
    discovery.categories.push({
      name: 'Side Tables',
      displayName: 'Side Tables',
      icon: 'table',
      modelCount: sideTables.length,
      models: sideTables
    });
  }
  
  // Discover Chairs
  const chairs = await discoverChairs();
  if (chairs.length > 0) {
    discovery.categories.push({
      name: 'chairs',
      displayName: 'Chairs',
      icon: 'chair',
      modelCount: chairs.length,
      models: chairs
    });
  }
  
  // Test other categories
  const otherCategories = await discoverOtherCategories();
  for (const category of otherCategories) {
    console.log(`\n🔍 Found working category: ${category.name} with pattern: ${category.workingPattern}`);
    // You can expand these manually if you find working patterns
  }
  
  // Generate summary
  console.log('\n📊 DISCOVERY SUMMARY:');
  console.log('='.repeat(50));
  
  let totalModels = 0;
  discovery.categories.forEach(cat => {
    console.log(`${cat.displayName}: ${cat.modelCount} models`);
    totalModels += cat.modelCount;
  });
  
  if (otherCategories.length > 0) {
    console.log('\n🎯 Categories with working patterns (for manual expansion):');
    otherCategories.forEach(cat => {
      console.log(`   ${cat.name}: pattern "${cat.workingPattern}" works`);
    });
  }
  
  console.log(`\nTotal confirmed: ${totalModels} models across ${discovery.categories.length} categories`);
  
  // Save discovery results
  const fs = require('fs').promises;
  await fs.writeFile('./public/bucket-discovery.json', JSON.stringify(discovery, null, 2));
  console.log('\n💾 Results saved to public/bucket-discovery.json');
  
  return discovery;
}

// Run discovery
if (require.main === module) {
  discoverRealContents().catch(console.error);
}

module.exports = { discoverRealContents };