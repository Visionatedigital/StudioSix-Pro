#!/usr/bin/env node

/**
 * Add Model CLI Tool
 * 
 * Quick tool to add new models to the manifest.
 * 
 * Usage:
 *   node scripts/add-model.js "Side Tables" "Side-Table_21-330pl" "Luxury Side Table 21"
 *   node scripts/add-model.js "chairs" "CGT_Chair_006" "Premium Office Chair"
 */

const fs = require('fs').promises;
const path = require('path');

const MANIFEST_FILE = './src/services/SupabaseModelsManifest.js';

async function addModel(categoryName, modelName, displayName) {
  try {
    console.log(`🚀 Adding model "${displayName}" to category "${categoryName}"`);
    
    // Read the current manifest file
    const manifestContent = await fs.readFile(MANIFEST_FILE, 'utf8');
    
    // Find the category section
    const categoryPattern = new RegExp(`name: '${categoryName.replace(/'/g, "\\'")}',([\\s\\S]*?)models: \\[([\\s\\S]*?)\\]`, 'g');
    const match = categoryPattern.exec(manifestContent);
    
    if (!match) {
      throw new Error(`Category "${categoryName}" not found in manifest`);
    }
    
    // Create the new model entry
    const newModelEntry = `        { name: '${modelName}', displayName: '${displayName}' },`;
    
    // Find the last model in the array and add after it
    const modelsSection = match[2];
    const lastModelMatch = modelsSection.trim().match(/.*,$/m);
    
    if (lastModelMatch) {
      // Add after the last model
      const updatedModelsSection = modelsSection.replace(
        lastModelMatch[0],
        `${lastModelMatch[0]}\n${newModelEntry}`
      );
      
      const updatedContent = manifestContent.replace(
        match[0],
        match[0].replace(modelsSection, updatedModelsSection)
      );
      
      // Write back to file
      await fs.writeFile(MANIFEST_FILE, updatedContent);
      
      console.log(`✅ Successfully added "${displayName}" to ${categoryName}`);
      console.log(`📄 Updated ${MANIFEST_FILE}`);
      console.log(`\n🔄 Refresh your browser to see the new model!`);
      
    } else {
      throw new Error('Could not find proper insertion point in models array');
    }
    
  } catch (error) {
    console.error('❌ Error adding model:', error.message);
    process.exit(1);
  }
}

// CLI interface
async function main() {
  const [,, categoryName, modelName, displayName] = process.argv;
  
  if (!categoryName || !modelName || !displayName) {
    console.log(`
🔧 Add Model Tool

Usage:
  node scripts/add-model.js <category> <model-name> <display-name>

Examples:
  node scripts/add-model.js "Side Tables" "Side-Table_21-330pl" "Luxury Side Table 21"
  node scripts/add-model.js "chairs" "CGT_Chair_006" "Premium Office Chair"

Available Categories:
  - Side Tables
  - chairs
  
Note: Make sure you've uploaded the FBX and thumbnail files to Supabase first!
`);
    process.exit(1);
  }
  
  await addModel(categoryName, modelName, displayName);
}

if (require.main === module) {
  main();
}

module.exports = { addModel };

