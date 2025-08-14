#!/usr/bin/env node

/**
 * Fix Supabase bucket permissions to make it public
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

class BucketPermissionsFixer {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async fixBucketPermissions() {
    console.log('🔧 Fixing bucket permissions...');
    
    try {
      // Update bucket to be public
      const { data, error } = await this.supabase.storage.updateBucket('models', {
        public: true
      });
      
      if (error) {
        console.error('❌ Failed to update bucket:', error.message);
        return false;
      }
      
      console.log('✅ Models bucket is now public');
      
      // Test public access
      console.log('\n🧪 Testing public access...');
      
      const testData = 'v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2 3';
      const testPath = 'test/public-test.obj';
      
      // Upload test file
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
      
      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('models')
        .getPublicUrl(testPath);
      
      console.log(`🔗 Testing URL: ${urlData.publicUrl}`);
      
      // Test HTTP access
      const response = await fetch(urlData.publicUrl);
      if (response.ok) {
        const content = await response.text();
        console.log('✅ Public access working!');
        console.log(`📄 Downloaded content: ${content.substring(0, 50)}...`);
      } else {
        console.error(`❌ Public access failed: ${response.status} ${response.statusText}`);
      }
      
      // Clean up
      await this.supabase.storage.from('models').remove([testPath]);
      console.log('🧹 Test file cleaned up');
      
      return true;
      
    } catch (error) {
      console.error('❌ Permission fix failed:', error.message);
      return false;
    }
  }
}

// CLI usage
if (require.main === module) {
  const fixer = new BucketPermissionsFixer();
  
  fixer.fixBucketPermissions()
    .then(success => {
      if (success) {
        console.log('\n✨ Bucket permissions fixed! Models should now be publicly accessible.');
      } else {
        console.log('\n❌ Failed to fix bucket permissions');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = BucketPermissionsFixer;