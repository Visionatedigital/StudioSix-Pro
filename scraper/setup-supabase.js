#!/usr/bin/env node

/**
 * Supabase Storage Setup Script
 * Sets up the bucket and folder structure for the Free3D model scraper
 */

require('dotenv').config();
const SupabaseClient = require('./supabase-client');
const logger = require('./utils/logger');

async function setupSupabaseStorage() {
  console.log('🚀 Starting Supabase Storage Setup...\n');
  
  const supabaseClient = new SupabaseClient();
  
  try {
    // Step 1: Initialize client
    console.log('📡 Step 1: Initializing Supabase client...');
    await supabaseClient.initialize();
    console.log('✅ Client initialized successfully\n');
    
    // Step 2: Setup bucket and folder structure
    console.log('🗂️  Step 2: Setting up storage bucket and folders...');
    await supabaseClient.setupBucket();
    console.log('✅ Bucket setup completed\n');
    
    // Step 3: Verify setup
    console.log('🔍 Step 3: Verifying setup...');
    
    // Simple verification - check if bucket exists and is accessible
    const { data, error } = await supabaseClient.client.storage.listBuckets();
    
    if (error) {
      console.log('❌ Verification failed:', error.message);
    } else {
      const bucketExists = data.some(bucket => bucket.name === supabaseClient.config.storage.bucketName);
      
      if (bucketExists) {
        console.log('✅ Verification passed!\n');
        
        console.log('🎉 SUPABASE SETUP COMPLETE! 🎉\n');
        console.log('📋 Summary:');
        console.log(`   • Bucket Name: ${supabaseClient.config.storage.bucketName}`);
        console.log(`   • Project URL: ${supabaseClient.config.connection.url}`);
        console.log(`   • Storage Ready: ✅`);
        console.log(`   • Policies Configured: ✅\n`);
        
        console.log('🚀 Your scraper is now ready to upload models to Supabase!');
        console.log('💡 Next: Run the scraper to start downloading and uploading models\n');
        
      } else {
        console.log('❌ Verification failed: Bucket not found.');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   • Check your .env file has the correct Supabase credentials');
    console.error('   • Verify your Supabase project is active');
    console.error('   • Ensure your service role key has admin permissions\n');
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupSupabaseStorage();
}

module.exports = setupSupabaseStorage; 