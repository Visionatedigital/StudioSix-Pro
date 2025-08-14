const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const SupabaseClient = require('./supabase-client');
const supabaseConfig = require('./config/supabase-config');
const logger = require('./utils/logger');
const ScraperUtils = require('./utils/scraper-utils');

class SupabaseUploader {
  constructor() {
    this.supabaseClient = new SupabaseClient();
    this.config = supabaseConfig;
    this.uploadStats = {
      totalUploads: 0,
      successfulUploads: 0,
      failedUploads: 0,
      totalBytes: 0,
      modelFiles: 0,
      thumbnails: 0,
      metadataFiles: 0
    };
    this.isInitialized = false;
  }

  /**
   * Initialize the uploader and Supabase connection
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return true;
      }

      logger.info('🚀 Initializing Supabase uploader...');
      
      // Initialize Supabase client
      await this.supabaseClient.initialize();
      
      // Verify bucket exists
      const testResult = await this.supabaseClient.testConnection();
      if (!testResult.connectionOk || !testResult.bucketExists) {
        throw new Error('Supabase bucket not accessible. Run bucket setup first.');
      }

      this.storage = this.supabaseClient.getStorageClient();
      this.isInitialized = true;

      logger.info('✅ Supabase uploader initialized successfully');
      return true;

    } catch (error) {
      logger.error('❌ Failed to initialize Supabase uploader:', error);
      throw error;
    }
  }

  /**
   * Determine the appropriate category for a model based on its metadata
   */
  categorizeModel(metadata) {
    try {
      const categories = metadata.categories || [];
      const tags = metadata.tags || [];
      const title = (metadata.title || '').toLowerCase();
      
      // Combine all text for analysis
      const allText = [...categories, ...tags, title].join(' ').toLowerCase();

      // Category mapping based on keywords
      const categoryMappings = {
        vehicles: ['car', 'vehicle', 'truck', 'bike', 'motorcycle', 'bus', 'van', 'jeep', 'suv', 'sports car', 'automobile'],
        characters: ['character', 'human', 'person', 'people', 'man', 'woman', 'boy', 'girl', 'figure', 'anatomy', 'body'],
        furniture: ['furniture', 'chair', 'table', 'desk', 'bed', 'sofa', 'couch', 'cabinet', 'shelf', 'lamp'],
        architecture: ['building', 'house', 'architecture', 'structure', 'tower', 'bridge', 'wall', 'door', 'window'],
        nature: ['tree', 'plant', 'flower', 'nature', 'rock', 'stone', 'wood', 'leaf', 'grass', 'mountain'],
        electronics: ['phone', 'computer', 'laptop', 'electronics', 'device', 'gadget', 'technology', 'robot'],
        weapons: ['gun', 'weapon', 'sword', 'knife', 'pistol', 'rifle', 'blade', 'military'],
        sports: ['sports', 'ball', 'sport', 'game', 'equipment', 'athletic', 'fitness'],
        abstract: ['abstract', 'geometric', 'shape', 'pattern', 'art', 'design', 'concept']
      };

      // Find the best matching category
      for (const [category, keywords] of Object.entries(categoryMappings)) {
        for (const keyword of keywords) {
          if (allText.includes(keyword)) {
            logger.debug(`📂 Categorized as "${category}" based on keyword: ${keyword}`);
            return category;
          }
        }
      }

      // Default category
      logger.debug('📂 No specific category found, using "other"');
      return 'other';

    } catch (error) {
      logger.warn('⚠️ Error categorizing model, using "other":', error.message);
      return 'other';
    }
  }

  /**
   * Generate a safe filename for upload
   */
  generateSafeFilename(originalFilename, metadata, fileType = 'model') {
    try {
      const ext = path.extname(originalFilename);
      const baseName = path.basename(originalFilename, ext);
      
      // Create a safe base name from model title
      let safeName = metadata.title ? 
        ScraperUtils.createSafeFilename(metadata.title) : 
        ScraperUtils.createSafeFilename(baseName);

      // Add type prefix if needed
      if (fileType === 'thumbnail') {
        safeName = `thumb_${safeName}`;
      } else if (fileType === 'metadata') {
        safeName = `meta_${safeName}`;
      }

      // Add UUID if naming config requires it
      if (this.config.upload.naming.includeHash) {
        const hash = uuidv4().split('-')[0]; // First 8 characters
        safeName = `${safeName}_${hash}`;
      }

      // Add timestamp if required
      if (this.config.upload.naming.includeTimestamp) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        safeName = `${safeName}_${timestamp}`;
      }

      // Combine with extension
      const finalName = `${safeName}${ext}`;

      // Ensure filename length is within limits
      if (finalName.length > this.config.upload.naming.maxLength) {
        const maxBase = this.config.upload.naming.maxLength - ext.length - 1;
        return `${safeName.substring(0, maxBase)}${ext}`;
      }

      return finalName;

    } catch (error) {
      logger.warn('⚠️ Error generating safe filename, using fallback:', error.message);
      return `${fileType}_${uuidv4()}${path.extname(originalFilename)}`;
    }
  }

  /**
   * Upload a single file to Supabase storage
   */
  async uploadFile(localFilePath, remotePath, metadata = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info(`📤 Uploading file: ${path.basename(localFilePath)} -> ${remotePath}`);

      // Read file
      const fileBuffer = await fs.readFile(localFilePath);
      const fileSize = fileBuffer.length;
      
      // Check file size limit
      if (fileSize > this.config.storage.maxFileSize) {
        throw new Error(`File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB (max: ${(this.config.storage.maxFileSize / 1024 / 1024).toFixed(2)}MB)`);
      }

      // Determine MIME type
      const ext = path.extname(localFilePath).toLowerCase();
      const mimeType = this.getMimeType(ext);

      if (!this.config.storage.allowedMimeTypes.includes(mimeType)) {
        throw new Error(`File type not allowed: ${ext} (${mimeType})`);
      }

      // Create blob from buffer
      const blob = new Blob([fileBuffer], { type: mimeType });

      // Upload with retry logic
      let lastError;
      for (let attempt = 1; attempt <= this.config.upload.retryAttempts; attempt++) {
        try {
          const { data, error } = await this.storage.upload(
            remotePath,
            blob,
            {
              cacheControl: this.config.urls.publicUrls.cacheTtl.toString(),
              upsert: false, // Don't overwrite existing files
              contentType: mimeType
            }
          );

          if (error) {
            throw new Error(error.message);
          }

          // Update statistics
          this.uploadStats.totalUploads++;
          this.uploadStats.successfulUploads++;
          this.uploadStats.totalBytes += fileSize;

          logger.info(`✅ Upload successful: ${remotePath} (${(fileSize / 1024).toFixed(1)}KB)`);

          return {
            success: true,
            path: data.path,
            fullPath: data.fullPath,
            size: fileSize,
            mimeType: mimeType,
            uploadedAt: new Date().toISOString()
          };

        } catch (uploadError) {
          lastError = uploadError;
          logger.warn(`⚠️ Upload attempt ${attempt} failed: ${uploadError.message}`);
          
          if (attempt < this.config.upload.retryAttempts) {
            await new Promise(resolve => setTimeout(resolve, this.config.upload.retryDelay * attempt));
          }
        }
      }

      // All attempts failed
      this.uploadStats.totalUploads++;
      this.uploadStats.failedUploads++;
      throw new Error(`Upload failed after ${this.config.upload.retryAttempts} attempts: ${lastError.message}`);

    } catch (error) {
      logger.error(`❌ Failed to upload ${localFilePath}:`, error);
      throw error;
    }
  }

  /**
   * Upload all files for a scraped model
   */
  async uploadModel(modelData, downloadResult) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info(`📦 Uploading complete model: ${modelData.title}`);

      const category = this.categorizeModel(modelData);
      const uploadResults = {
        modelTitle: modelData.title,
        category: category,
        uploads: {
          modelFiles: [],
          thumbnail: null,
          metadata: null
        },
        urls: {
          modelFiles: [],
          thumbnail: null,
          metadata: null
        },
        totalSize: 0,
        success: false
      };

      // Upload model files
      if (downloadResult.downloads && downloadResult.downloads.length > 0) {
        logger.info(`📄 Uploading ${downloadResult.downloads.length} model files...`);
        
        for (const download of downloadResult.downloads) {
          if (download.success && download.filePath) {
            try {
              const filename = this.generateSafeFilename(
                path.basename(download.filePath), 
                modelData, 
                'model'
              );
              const remotePath = `${this.config.folders.models}/${category}/${filename}`;
              
              const uploadResult = await this.uploadFile(download.filePath, remotePath, modelData);
              uploadResults.uploads.modelFiles.push(uploadResult);
              uploadResults.totalSize += uploadResult.size;
              this.uploadStats.modelFiles++;

              logger.info(`✅ Model file uploaded: ${filename}`);

            } catch (fileError) {
              logger.warn(`⚠️ Failed to upload model file ${download.filePath}:`, fileError.message);
            }
          }
        }
      }

      // Upload thumbnail
      if (downloadResult.thumbnail && downloadResult.thumbnail.success && downloadResult.thumbnail.filePath) {
        try {
          logger.info('🖼️ Uploading thumbnail...');
          
          const filename = this.generateSafeFilename(
            path.basename(downloadResult.thumbnail.filePath), 
            modelData, 
            'thumbnail'
          );
          const remotePath = `${this.config.folders.thumbnails}/${category}/${filename}`;
          
          const uploadResult = await this.uploadFile(downloadResult.thumbnail.filePath, remotePath, modelData);
          uploadResults.uploads.thumbnail = uploadResult;
          uploadResults.totalSize += uploadResult.size;
          this.uploadStats.thumbnails++;

          logger.info(`✅ Thumbnail uploaded: ${filename}`);

        } catch (thumbError) {
          logger.warn(`⚠️ Failed to upload thumbnail:`, thumbError.message);
        }
      }

      // Upload metadata
      try {
        logger.info('📋 Uploading metadata...');
        
        // Create metadata file content
        const metadataContent = {
          ...modelData,
          uploadInfo: {
            uploadedAt: new Date().toISOString(),
            category: category,
            uploader: 'Free3D-Scraper',
            supabasePaths: {
              models: uploadResults.uploads.modelFiles.map(f => f.path),
              thumbnail: uploadResults.uploads.thumbnail?.path,
              metadata: null // Will be filled after upload
            }
          }
        };

        // Create temporary metadata file
        const metadataFilename = this.generateSafeFilename(`${modelData.title}.json`, modelData, 'metadata');
        const tempMetadataPath = path.join(downloadResult.modelDir, 'temp_metadata.json');
        await fs.writeJson(tempMetadataPath, metadataContent, { spaces: 2 });

        const remotePath = `${this.config.folders.metadata}/${category}/${metadataFilename}`;
        const uploadResult = await this.uploadFile(tempMetadataPath, remotePath, modelData);
        
        uploadResults.uploads.metadata = uploadResult;
        uploadResults.totalSize += uploadResult.size;
        this.uploadStats.metadataFiles++;

        // Clean up temp file
        await fs.unlink(tempMetadataPath);

        logger.info(`✅ Metadata uploaded: ${metadataFilename}`);

      } catch (metaError) {
        logger.warn(`⚠️ Failed to upload metadata:`, metaError.message);
      }

      // Determine overall success
      uploadResults.success = (
        uploadResults.uploads.modelFiles.length > 0 || 
        uploadResults.uploads.thumbnail !== null || 
        uploadResults.uploads.metadata !== null
      );

      if (uploadResults.success) {
        logger.info(`✅ Model upload completed: ${modelData.title} (${uploadResults.uploads.modelFiles.length} files, ${(uploadResults.totalSize / 1024).toFixed(1)}KB)`);
      } else {
        logger.warn(`⚠️ No files uploaded for model: ${modelData.title}`);
      }

      return uploadResults;

    } catch (error) {
      logger.error(`❌ Failed to upload model ${modelData.title}:`, error);
      return {
        modelTitle: modelData.title,
        success: false,
        error: error.message,
        uploads: { modelFiles: [], thumbnail: null, metadata: null },
        totalSize: 0
      };
    }
  }

  /**
   * Get MIME type for file extension
   */
  getMimeType(extension) {
    const mimeTypes = {
      '.obj': 'application/octet-stream',
      '.mtl': 'text/plain',
      '.zip': 'application/zip',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.json': 'application/json',
      '.txt': 'text/plain'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Generate public or signed URLs for uploaded files
   */
  async generateUrls(uploadResults) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🔗 Generating access URLs...');

      const urls = {
        modelFiles: [],
        thumbnail: null,
        metadata: null
      };

      // Generate URLs for model files (signed URLs for security)
      for (const modelFile of uploadResults.uploads.modelFiles) {
        const { data: signedUrl, error } = await this.storage.createSignedUrl(
          modelFile.path,
          this.config.urls.signedUrlExpiry.model
        );

        if (!error && signedUrl) {
          urls.modelFiles.push({
            path: modelFile.path,
            signedUrl: signedUrl.signedUrl,
            expiresAt: new Date(Date.now() + this.config.urls.signedUrlExpiry.model * 1000).toISOString()
          });
        }
      }

      // Generate URL for thumbnail (public URL for easy access)
      if (uploadResults.uploads.thumbnail) {
        const { data: publicUrl } = this.storage.getPublicUrl(uploadResults.uploads.thumbnail.path);
        urls.thumbnail = {
          path: uploadResults.uploads.thumbnail.path,
          publicUrl: publicUrl.publicUrl
        };
      }

      // Generate URL for metadata (signed URL)
      if (uploadResults.uploads.metadata) {
        const { data: signedUrl, error } = await this.storage.createSignedUrl(
          uploadResults.uploads.metadata.path,
          this.config.urls.signedUrlExpiry.metadata
        );

        if (!error && signedUrl) {
          urls.metadata = {
            path: uploadResults.uploads.metadata.path,
            signedUrl: signedUrl.signedUrl,
            expiresAt: new Date(Date.now() + this.config.urls.signedUrlExpiry.metadata * 1000).toISOString()
          };
        }
      }

      logger.info(`✅ Generated URLs: ${urls.modelFiles.length} model files, ${urls.thumbnail ? 1 : 0} thumbnail, ${urls.metadata ? 1 : 0} metadata`);

      return urls;

    } catch (error) {
      logger.error('❌ Failed to generate URLs:', error);
      return {
        modelFiles: [],
        thumbnail: null,
        metadata: null,
        error: error.message
      };
    }
  }

  /**
   * Get upload statistics
   */
  getStats() {
    return {
      ...this.uploadStats,
      successRate: this.uploadStats.totalUploads > 0 ? 
        (this.uploadStats.successfulUploads / this.uploadStats.totalUploads * 100).toFixed(1) : 0,
      totalSizeMB: (this.uploadStats.totalBytes / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Reset upload statistics
   */
  resetStats() {
    this.uploadStats = {
      totalUploads: 0,
      successfulUploads: 0,
      failedUploads: 0,
      totalBytes: 0,
      modelFiles: 0,
      thumbnails: 0,
      metadataFiles: 0
    };
  }
}

module.exports = SupabaseUploader; 