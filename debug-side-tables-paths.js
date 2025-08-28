#!/usr/bin/env node

/**
 * Debug Side Tables Path Variations
 * Test different folder naming conventions for Side Tables
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

async function debugSideTablesPaths() {
  console.log('🔍 Testing Side Tables path variations...\n');
  
  const variations = [
    'Side Tables',           // Original with space
    'Side%20Tables',         // URL encoded space
    'Side_Tables',           // Underscore
    'SideTables',           // No space
    'side-tables',          // Lowercase with dash
    'side_tables',          // Lowercase with underscore
    'sidetables',           // Lowercase no space
    'Side-Tables',          // Dash instead of space
    'SIDE TABLES',          // Uppercase with space
    'SIDE_TABLES'           // Uppercase with underscore
  ];
  
  const subfolders = ['models', 'thumbnails'];
  const extensions = ['fbx', 'jpg'];
  
  for (const variation of variations) {
    console.log(`\n📁 Testing folder: "${variation}"`);
    
    for (let i = 0; i < subfolders.length; i++) {
      const subfolder = subfolders[i];
      const extension = extensions[i];
      const filename = `${MODEL_NAME}.${extension}`;
      
      // Test the URL
      const url = `${BASE_URL}/${variation}/${subfolder}/${filename}`;
      process.stdout.write(`   ${subfolder}/${filename}... `);
      
      const result = await testUrl(url);
      
      if (result.success) {
        console.log(`✅ SUCCESS (${result.status})`);
      } else {
        console.log(`❌ Failed (${result.status})`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 Testing known working thumbnails vs models...\n');
  
  // We know thumbnails work with "Side%20Tables", let's verify models don't
  const knownWorkingPath = 'Side%20Tables';
  
  const thumbnailUrl = `${BASE_URL}/${knownWorkingPath}/thumbnails/${MODEL_NAME}.jpg`;
  const modelUrl = `${BASE_URL}/${knownWorkingPath}/models/${MODEL_NAME}.fbx`;
  
  console.log('Thumbnail URL test:');
  const thumbResult = await testUrl(thumbnailUrl);
  console.log(`   ${thumbResult.success ? '✅' : '❌'} ${thumbnailUrl}`);
  
  console.log('\nModel URL test:');
  const modelResult = await testUrl(modelUrl);
  console.log(`   ${modelResult.success ? '✅' : '❌'} ${modelUrl}`);
  
  if (thumbResult.success && !modelResult.success) {
    console.log('\n⚠️  ISSUE IDENTIFIED: Thumbnails exist but models don\'t in the expected location');
    console.log('    This suggests the folder structure might be different for models');
  }
}

if (require.main === module) {
  debugSideTablesPaths().catch(console.error);
}

module.exports = { debugSideTablesPaths };