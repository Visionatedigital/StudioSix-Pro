#!/usr/bin/env node

/**
 * Setup script for door models
 * This script helps organize and catalog door .fbx files
 */

const fs = require('fs');
const path = require('path');

const DOORS_DIR = path.join(__dirname, '../public/models/doors');
const MANIFEST_FILE = path.join(DOORS_DIR, 'doors-manifest.json');

function setupDoorModels() {
  console.log('🚪 Setting up door models...');
  
  // Ensure doors directory exists
  if (!fs.existsSync(DOORS_DIR)) {
    fs.mkdirSync(DOORS_DIR, { recursive: true });
    console.log('✅ Created doors directory:', DOORS_DIR);
  }

  // Scan for existing .fbx files
  const fbxFiles = fs.readdirSync(DOORS_DIR)
    .filter(file => file.toLowerCase().endsWith('.fbx'))
    .sort();

  console.log(`📁 Found ${fbxFiles.length} FBX files in doors directory`);

  if (fbxFiles.length === 0) {
    console.log('⚠️  No FBX files found. Please copy your door .fbx files to:');
    console.log('   ', DOORS_DIR);
    console.log('');
    console.log('📝 After adding files, run this script again to update the manifest.');
    return;
  }

  // Generate manifest from found files
  const models = fbxFiles.map((fileName, index) => {
    const baseName = path.basename(fileName, '.fbx');
    const id = `door_${String(index + 1).padStart(3, '0')}`;
    
    // Try to extract info from filename
    const isDouble = /double|twin/i.test(fileName);
    const isGlass = /glass|glazed/i.test(fileName);
    const isCommercial = /commercial|office|steel/i.test(fileName);
    
    return {
      id: id,
      name: baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      fileName: fileName,
      category: isCommercial ? 'commercial' : 'residential',
      subcategory: isDouble ? 'double' : isGlass ? 'glass' : 'single',
      dimensions: {
        width: isDouble ? 1.6 : 0.9,
        height: 2.1,
        depth: 0.05
      },
      description: `${isCommercial ? 'Commercial' : 'Residential'} ${isDouble ? 'double' : isGlass ? 'glass' : 'single'} door`,
      tags: [
        isCommercial ? 'commercial' : 'residential',
        isDouble ? 'double' : 'single',
        ...(isGlass ? ['glass'] : ['standard'])
      ]
    };
  });

  // Create manifest
  const manifest = {
    doors: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      models: models
    }
  };

  // Write manifest
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  console.log('✅ Updated doors manifest with', models.length, 'models');
  console.log('📄 Manifest saved to:', MANIFEST_FILE);

  // Log summary
  console.log('\n📊 Door Models Summary:');
  const categories = {};
  models.forEach(model => {
    const key = `${model.category}/${model.subcategory}`;
    categories[key] = (categories[key] || 0) + 1;
  });
  
  Object.entries(categories).forEach(([category, count]) => {
    console.log(`   ${category}: ${count} models`);
  });

  console.log('\n🎯 Next steps:');
  console.log('   1. Start your development server');
  console.log('   2. Use the Door Tool to select from local models');
  console.log('   3. Models will load from public/models/doors/');
}

if (require.main === module) {
  setupDoorModels();
}

module.exports = { setupDoorModels };











