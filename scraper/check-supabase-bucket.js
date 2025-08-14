#!/usr/bin/env node

/**
 * Check Supabase bucket configuration and create if needed
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

class SupabaseBucketChecker {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async checkAndCreateBucket() {
    console.log('🔍 Checking Supabase storage configuration...');
    
    try {
      // List all buckets
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      
      if (listError) {
        console.error('❌ Failed to list buckets:', listError.message);
        return false;
      }
      
      console.log(`📂 Found ${buckets.length} buckets:`);
      buckets.forEach(bucket => {
        console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
      });
      
      // Check if models bucket exists
      const modelsBucket = buckets.find(bucket => bucket.name === 'models');
      
      if (!modelsBucket) {
        console.log('\n🔧 Creating "models" bucket...');
        
        const { data, error } = await this.supabase.storage.createBucket('models', {
          public: true,
          allowedMimeTypes: ['application/octet-stream', 'model/obj', 'model/fbx'],
          fileSizeLimit: 50 * 1024 * 1024 // 50MB
        });
        
        if (error) {
          console.error('❌ Failed to create bucket:', error.message);
          return false;
        }
        
        console.log('✅ Models bucket created successfully!');
      } else {
        console.log('✅ Models bucket already exists');
      }
      
      // Test file upload to verify permissions
      console.log('\n🧪 Testing file upload...');
      
      const testData = 'v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2 3';
      const testPath = 'test/test-model.obj';
      
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('models')
        .upload(testPath, testData, {
          contentType: 'application/octet-stream',
          upsert: true
        });
      
      if (uploadError) {
        console.error('❌ Test upload failed:', uploadError.message);
        return false;
      }
      
      console.log('✅ Test upload successful');
      
      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('models')
        .getPublicUrl(testPath);
      
      console.log(`🔗 Test file URL: ${urlData.publicUrl}`);
      
      // Clean up test file
      await this.supabase.storage.from('models').remove([testPath]);
      console.log('🧹 Test file cleaned up');
      
      return true;
      
    } catch (error) {
      console.error('❌ Bucket check failed:', error.message);
      return false;
    }
  }
}

// CLI usage
if (require.main === module) {
  const checker = new SupabaseBucketChecker();
  
  checker.checkAndCreateBucket()
    .then(success => {
      if (success) {
        console.log('\n✨ Supabase storage is ready!');
      } else {
        console.log('\n❌ Supabase storage setup failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = SupabaseBucketChecker;