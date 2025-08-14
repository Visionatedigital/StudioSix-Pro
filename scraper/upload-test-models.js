#!/usr/bin/env node

/**
 * Upload test model files to Supabase storage
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

class TestModelUploader {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.modelsDir = path.join(__dirname, '..', 'public', 'models');
  }

  async uploadTestModels() {
    console.log('🚀 Starting test model upload to Supabase...');
    
    // Models to upload based on our database
    const models = [
      {
        id: 'bugatti-chiron-sports-car-abc123',
        filename: 'bugatti-chiron-sports-car-abc123.obj'
      },
      {
        id: 'modern-office-chair-def456',
        filename: 'modern-office-chair-def456.obj'
      },
      {
        id: 'realistic-oak-tree-ghi789',
        filename: 'realistic-oak-tree-ghi789.obj'
      },
      {
        id: 'human-male-base-mesh-jkl012',
        filename: 'human-male-base-mesh-jkl012.obj'
      }
    ];

    let uploadedCount = 0;

    for (const model of models) {
      try {
        console.log(`\n📦 Uploading ${model.filename}...`);
        
        const modelPath = path.join(this.modelsDir, model.filename);
        const modelData = await fs.readFile(modelPath);
        const storagePath = `models/${model.filename}`;
        
        // Upload to Supabase storage
        const { data, error } = await this.supabase.storage
          .from('models')
          .upload(storagePath, modelData, {
            contentType: 'application/octet-stream',
            upsert: true // Overwrite if exists
          });
        
        if (error) {
          console.error(`❌ Failed to upload ${model.filename}:`, error.message);
          continue;
        }
        
        // Get public URL to verify
        const { data: urlData } = this.supabase.storage
          .from('models')
          .getPublicUrl(storagePath);
        
        console.log(`✅ Successfully uploaded: ${model.filename}`);
        console.log(`🔗 Public URL: ${urlData.publicUrl}`);
        
        uploadedCount++;
        
      } catch (error) {
        console.error(`❌ Error uploading ${model.filename}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Upload complete! ${uploadedCount}/${models.length} models uploaded.`);
    return uploadedCount;
  }

  async verifyUploads() {
    console.log('\n🔍 Verifying uploaded files...');
    
    try {
      const { data: files, error } = await this.supabase.storage
        .from('models')
        .list('models', {
          limit: 100,
          offset: 0
        });
      
      if (error) {
        console.error('❌ Failed to list files:', error.message);
        return;
      }
      
      console.log(`📂 Found ${files.length} files in storage:`);
      files.forEach(file => {
        console.log(`  - ${file.name} (${(file.metadata?.size / 1024).toFixed(1)} KB)`);
      });
      
    } catch (error) {
      console.error('❌ Verification failed:', error.message);
    }
  }
}

// CLI usage
if (require.main === module) {
  const uploader = new TestModelUploader();
  
  uploader.uploadTestModels()
    .then(count => uploader.verifyUploads())
    .then(() => {
      console.log('\n✨ Test model upload process complete!');
      console.log('🔗 You can now test the import functionality in the app.');
    })
    .catch(error => {
      console.error('❌ Upload process failed:', error);
      process.exit(1);
    });
}

module.exports = TestModelUploader;