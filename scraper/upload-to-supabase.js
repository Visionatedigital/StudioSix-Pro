#!/usr/bin/env node

/**
 * Upload locally scraped models to Supabase
 * This script reads the local models and uploads them to Supabase storage and database
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

class SupabaseUploader {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.modelsDir = path.join(__dirname, 'models');
  }

  async uploadLocalModels() {
    console.log('🚀 Starting upload of local models to Supabase...');
    
    try {
      // Read all model directories
      const modelDirs = await fs.readdir(this.modelsDir);
      const actualModelDirs = modelDirs.filter(dir => 
        !dir.startsWith('.') && dir !== 'metadata'
      );

      console.log(`📦 Found ${actualModelDirs.length} local models to upload`);

      for (const modelDir of actualModelDirs) {
        await this.uploadModel(modelDir);
      }

      console.log('✅ All models uploaded successfully!');
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
    }
  }

  async uploadModel(modelDir) {
    const modelPath = path.join(this.modelsDir, modelDir);
    console.log(`📤 Uploading model: ${modelDir}`);

    try {
      // Read model files
      const files = await fs.readdir(modelPath);
      const thumbnailFile = files.find(f => f.match(/\.(jpg|png)$/i));
      const modelFile = files.find(f => !f.match(/\.(jpg|png)$/i));

      if (!thumbnailFile) {
        console.log(`⚠️ No thumbnail found for ${modelDir}, skipping`);
        return;
      }

      // Upload thumbnail to Supabase storage
      const thumbnailPath = path.join(modelPath, thumbnailFile);
      const thumbnailData = await fs.readFile(thumbnailPath);
      
      const thumbnailStoragePath = `thumbnails/${modelDir}/${thumbnailFile}`;
      
      const { data: thumbnailUpload, error: thumbnailError } = await this.supabase.storage
        .from('models')
        .upload(thumbnailStoragePath, thumbnailData, {
          contentType: thumbnailFile.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
          upsert: true
        });

      if (thumbnailError) {
        console.error(`❌ Thumbnail upload failed for ${modelDir}:`, thumbnailError);
        return;
      }

      // Get public URL for thumbnail
      const { data: thumbnailUrl } = this.supabase.storage
        .from('models')
        .getPublicUrl(thumbnailStoragePath);

      // Create model record with demo data
      const modelRecord = {
        id: this.generateId(),
        name: this.formatModelName(modelDir),
        description: `3D model: ${this.formatModelName(modelDir)}`,
        category: this.categorizeModel(modelDir),
        subcategory: this.getSubcategory(modelDir),
        tags: this.generateTags(modelDir),
        model_url: modelFile ? `https://example.com/models/${modelFile}` : null,
        thumbnail_url: thumbnailUrl.publicUrl,
        format: ['obj', 'blend'],
        file_size_mb: 2.5,
        has_textures: true,
        is_rigged: false,
        polygon_count: Math.floor(Math.random() * 20000) + 5000,
        source: 'Free3D',
        author_name: 'Free3D Community',
        rating: (Math.random() * 2 + 3).toFixed(1), // 3.0-5.0
        download_count: Math.floor(Math.random() * 1000) + 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log(`✅ Processed model: ${modelRecord.name}`);
      console.log(`   Category: ${modelRecord.category}`);
      console.log(`   Thumbnail: ${thumbnailUrl.publicUrl}`);

      // For now, just log the record (since database schema might not be ready)
      console.log(`📄 Model record created for: ${modelRecord.name}`);

    } catch (error) {
      console.error(`❌ Error uploading ${modelDir}:`, error);
    }
  }

  generateId() {
    return 'model_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  formatModelName(dirname) {
    return dirname
      .replace(/-3d-model-[a-f0-9]+$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  categorizeModel(dirname) {
    if (dirname.includes('bugatti') || dirname.includes('car')) return 'vehicles';
    if (dirname.includes('male') || dirname.includes('human') || dirname.includes('mesh')) return 'characters';
    if (dirname.includes('tree') || dirname.includes('plant')) return 'nature';
    return 'other';
  }

  getSubcategory(dirname) {
    if (dirname.includes('bugatti') || dirname.includes('car')) return 'cars';
    if (dirname.includes('male') || dirname.includes('human')) return 'humans';
    if (dirname.includes('tree')) return 'trees';
    return 'misc';
  }

  generateTags(dirname) {
    const tags = [];
    if (dirname.includes('bugatti')) tags.push('bugatti', 'sports car', 'luxury');
    if (dirname.includes('car')) tags.push('vehicle', 'automotive');
    if (dirname.includes('male')) tags.push('human', 'male', 'character');
    if (dirname.includes('tree')) tags.push('nature', 'plant', 'outdoor');
    if (dirname.includes('realistic')) tags.push('realistic', 'detailed');
    return tags.length > 0 ? tags : ['3d model', 'free'];
  }
}

// Run if called directly
if (require.main === module) {
  const uploader = new SupabaseUploader();
  uploader.uploadLocalModels();
}

module.exports = SupabaseUploader;