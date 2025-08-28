#!/usr/bin/env node

/**
 * Discover the actual Side Tables folder structure
 */

const https = require('https');

const BASE_URL = 'https://zwrooqvwxdwvnuhpepta.supabase.co/storage/v1/object/public/models_fbx';
const MODEL_NAME = 'Side-Table_01-330pl';

function testUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { method: 'HEAD' }, (res) => {
      resolve({ url, status: res.statusCode, success: res.statusCode === 200 });
    }).on('error', () => resolve({ url, status: 'ERROR', success: false }));
  });
}

async function discoverStructure() {
  console.log('🔍 Discovering Side Tables actual structure...\n');
  
  // We know thumbnails work here
  const workingThumbnailPath = 'Side%20Tables/thumbnails';
  
  // Test various model folder possibilities
  const modelFolderTests = [
    'Side%20Tables/models',       // Expected but failing
    'Side%20Tables/fbx',          // Alternative name
    'Side%20Tables/files',        // Alternative name  
    'Side%20Tables/3d',           // Alternative name
    'Side%20Tables',              // Maybe models are in root
    'models/Side%20Tables',       // Maybe models are in top-level models folder
    'fbx/Side%20Tables',          // Maybe fbx is top level
    'Side%20Tables/Side-Tables',  // Maybe duplicate structure
    'SideTables/models',          // Different folder name for models
    'side-tables/models',         // Lowercase for models
  ];
  
  console.log('📁 Testing model folder locations:\n');
  
  for (const testPath of modelFolderTests) {
    const url = `${BASE_URL}/${testPath}/${MODEL_NAME}.fbx`;
    process.stdout.write(`   ${testPath}/... `);
    
    const result = await testUrl(url);
    
    if (result.success) {
      console.log(`✅ FOUND! (${result.status})`);
    } else {
      console.log(`❌ (${result.status})`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 Testing if Side Tables models might be in a different category...\n');
  
  // Test if Side Tables models might be under a different category name
  const possibleCategories = [
    'tables',
    'furniture', 
    'Tables',
    'side_tables',
    'coffee_tables',
    'occasional_tables'
  ];
  
  for (const category of possibleCategories) {
    const url = `${BASE_URL}/${category}/models/${MODEL_NAME}.fbx`;
    process.stdout.write(`   ${category}/models/... `);
    
    const result = await testUrl(url);
    
    if (result.success) {
      console.log(`✅ FOUND! (${result.status})`);
    } else {
      console.log(`❌ (${result.status})`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Testing if models might be in root with different structure...\n');
  
  // Test if models are in root bucket with category prefix
  const rootTests = [
    `Side-Table_01-330pl.fbx`,                    // Direct in root
    `Side_Tables_Side-Table_01-330pl.fbx`,       // Category prefix
    `models/Side-Table_01-330pl.fbx`,            // In models folder
    `Side%20Tables_Side-Table_01-330pl.fbx`,     // URL encoded prefix
  ];
  
  for (const testFile of rootTests) {
    const url = `${BASE_URL}/${testFile}`;
    process.stdout.write(`   ${testFile}... `);
    
    const result = await testUrl(url);
    
    if (result.success) {
      console.log(`✅ FOUND! (${result.status})`);
    } else {
      console.log(`❌ (${result.status})`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

if (require.main === module) {
  discoverStructure().catch(console.error);
}

module.exports = { discoverStructure };