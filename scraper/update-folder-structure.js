#!/usr/bin/env node

/**
 * Update Supabase Folder Structure Script
 * Creates the detailed hierarchical folder structure for organized model storage
 */

require('dotenv').config();
const SupabaseClient = require('./supabase-client');
const ModelCategorizer = require('./utils/model-categorizer');
const logger = require('./utils/logger');

async function updateFolderStructure() {
  console.log('🚀 Updating Supabase folder structure with detailed categorization...\n');
  
  const supabaseClient = new SupabaseClient();
  const categorizer = new ModelCategorizer();
  
  try {
    // Step 1: Initialize client
    console.log('📡 Step 1: Initializing Supabase client...');
    await supabaseClient.initialize();
    console.log('✅ Client initialized successfully\n');
    
    // Step 2: Get all category paths from the categorizer
    console.log('🗂️  Step 2: Gathering all category paths...');
    const allCategories = categorizer.getAllCategories();
    const categoryStats = categorizer.getCategoryStats();
    
    console.log(`📊 Found ${allCategories.length} detailed categories across ${Object.keys(categoryStats).length} main categories:`);
    for (const [mainCat, count] of Object.entries(categoryStats)) {
      console.log(`   • ${mainCat}: ${count} subcategories`);
    }
    console.log('');
    
    // Step 3: Create folder structure for models, thumbnails, and metadata
    const folderTypes = ['models', 'thumbnails', 'metadata'];
    let totalFolders = 0;
    let createdFolders = 0;
    
    for (const folderType of folderTypes) {
      console.log(`📁 Creating ${folderType} folder structure...`);
      
      for (const categoryPath of allCategories) {
        const fullPath = `${folderType}/${categoryPath}`;
        totalFolders++;
        
        try {
          // Create folder by uploading a placeholder file
          const placeholderContent = JSON.stringify({
            folderType: folderType,
            category: categoryPath,
            createdAt: new Date().toISOString(),
            description: `Auto-generated folder for ${categoryPath} ${folderType}`
          });
          
          const { data, error } = await supabaseClient.client.storage
            .from(supabaseClient.config.storage.bucketName)
            .upload(`${fullPath}/.folder-placeholder.json`, placeholderContent, {
              contentType: 'application/json',
              upsert: true
            });
          
          if (!error) {
            createdFolders++;
            logger.debug(`✅ Created: ${fullPath}`);
          } else {
            logger.warn(`⚠️  Folder ${fullPath} might already exist`);
          }
          
        } catch (error) {
          logger.warn(`⚠️  Failed to create folder ${fullPath}:`, error.message);
        }
      }
      
      console.log(`   ✅ ${folderType} folders processed\n`);
    }
    
    // Step 4: Create category mapping file
    console.log('📋 Step 4: Creating category mapping reference...');
    const mappingData = {
      generatedAt: new Date().toISOString(),
      totalCategories: allCategories.length,
      categoryStats: categoryStats,
      categories: allCategories,
      folderStructure: {
        description: "Hierarchical folder structure for 3D model organization",
        examples: {
          "Sofa model": "models/furniture/interior/sofas/model-name.obj",
          "Car model": "models/vehicles/cars/model-name.obj",
          "Tree model": "models/nature/trees/model-name.obj"
        }
      }
    };
    
    const { data: mappingUpload, error: mappingError } = await supabaseClient.client.storage
      .from(supabaseClient.config.storage.bucketName)
      .upload('category-mapping.json', JSON.stringify(mappingData, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
    
    if (!mappingError) {
      console.log('✅ Category mapping file created\n');
    }
    
    // Step 5: Verification
    console.log('🔍 Step 5: Verifying folder structure...');
    const { data: bucketFiles, error: listError } = await supabaseClient.client.storage
      .from(supabaseClient.config.storage.bucketName)
      .list('', { limit: 1000 });
    
    if (!listError) {
      const folderCount = bucketFiles.filter(file => file.name.includes('/')).length;
      console.log(`✅ Verification complete: ${folderCount} folders visible in bucket\n`);
    }
    
    // Success summary
    console.log('🎉 FOLDER STRUCTURE UPDATE COMPLETE! 🎉\n');
    console.log('📋 Summary:');
    console.log(`   • Total categories: ${allCategories.length}`);
    console.log(`   • Main categories: ${Object.keys(categoryStats).length}`);
    console.log(`   • Folders processed: ${totalFolders}`);
    console.log(`   • Successfully created: ${createdFolders}`);
    console.log(`   • Bucket name: ${supabaseClient.config.storage.bucketName}\n`);
    
    console.log('🎯 Your model organization structure:');
    console.log('📁 models/');
    console.log('   ├── furniture/');
    console.log('   │   ├── interior/');
    console.log('   │   │   ├── sofas/');
    console.log('   │   │   ├── chairs/');
    console.log('   │   │   ├── desks/');
    console.log('   │   │   ├── tv-stands/');
    console.log('   │   │   └── ...30+ more categories');
    console.log('   │   └── exterior/');
    console.log('   │       ├── patio-sets/');
    console.log('   │       ├── benches/');
    console.log('   │       └── ...10+ more categories');
    console.log('   ├── vehicles/');
    console.log('   │   ├── cars/');
    console.log('   │   ├── trucks/');
    console.log('   │   └── ...8+ more categories');
    console.log('   └── architecture/, nature/, electronics/...\n');
    
    console.log('🚀 Your scraper will now automatically organize models into these folders!');
    console.log('💡 Next: Run your scraper to start building your organized 3D model library\n');
    
  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   • Check your .env file has the correct Supabase credentials');
    console.error('   • Verify your Supabase project is active');
    console.error('   • Ensure your service role key has admin permissions\n');
    process.exit(1);
  }
}

// Run update if called directly
if (require.main === module) {
  updateFolderStructure();
}

module.exports = updateFolderStructure; 