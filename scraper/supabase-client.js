const { createClient } = require('@supabase/supabase-js');
const supabaseConfig = require('./config/supabase-config');
const logger = require('./utils/logger');

class SupabaseClient {
  constructor() {
    this.client = null;
    this.bucket = null;
    this.isInitialized = false;
    this.config = supabaseConfig;
  }

  /**
   * Initialize the Supabase client with service role for admin operations
   */
  async initialize() {
    try {
      logger.info('🔧 Initializing Supabase client...');

      // Validate environment variables
      if (!this.config.connection.url || this.config.connection.url.includes('your-project')) {
        throw new Error('SUPABASE_URL environment variable not set or invalid');
      }

      if (!this.config.connection.serviceRoleKey || this.config.connection.serviceRoleKey.includes('your-service-role-key')) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not set or invalid');
      }

      // Create Supabase client with service role key for admin operations
      this.client = createClient(
        this.config.connection.url,
        this.config.connection.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Get storage reference
      this.bucket = this.client.storage.from(this.config.storage.bucketName);

      this.isInitialized = true;
      logger.info('✅ Supabase client initialized successfully');
      
      return true;

    } catch (error) {
      logger.error('❌ Failed to initialize Supabase client:', error);
      throw error;
    }
  }

  /**
   * Create the models storage bucket with appropriate policies
   */
  async createBucket() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info(`🪣 Creating storage bucket: ${this.config.storage.bucketName}`);

      // Check if bucket already exists
      const { data: buckets, error: listError } = await this.client.storage.listBuckets();
      
      if (listError) {
        throw new Error(`Failed to list buckets: ${listError.message}`);
      }

      const existingBucket = buckets.find(bucket => bucket.name === this.config.storage.bucketName);
      
      if (existingBucket) {
        logger.info(`✅ Bucket "${this.config.storage.bucketName}" already exists`);
        return { bucket: existingBucket, created: false };
      }

      // Create the bucket
      const { data: bucket, error: createError } = await this.client.storage.createBucket(
        this.config.storage.bucketName,
        {
          public: false, // Files are private by default
          allowedMimeTypes: this.config.storage.allowedMimeTypes,
          fileSizeLimit: this.config.storage.maxFileSize
        }
      );

      if (createError) {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }

      logger.info(`✅ Successfully created bucket: ${this.config.storage.bucketName}`);
      return { bucket, created: true };

    } catch (error) {
      logger.error(`❌ Failed to create bucket: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test the connection and bucket access
   */
  async testConnection() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🧪 Testing Supabase connection and bucket access...');

      // Test 1: List buckets
      const { data: buckets, error: listError } = await this.client.storage.listBuckets();
      
      if (listError) {
        throw new Error(`Bucket listing failed: ${listError.message}`);
      }

      logger.info(`✅ Connection test passed - found ${buckets.length} buckets`);

      // Test 2: Check if our models bucket exists
      const modelsBucket = buckets.find(bucket => bucket.name === this.config.storage.bucketName);
      
      if (!modelsBucket) {
        logger.warn(`⚠️ Models bucket "${this.config.storage.bucketName}" not found`);
        return {
          connectionOk: true,
          bucketExists: false,
          buckets: buckets.map(b => b.name)
        };
      }

      logger.info(`✅ Models bucket "${this.config.storage.bucketName}" found`);

      // Test 3: Try to list files in the bucket (this tests read permissions)
      const { data: files, error: filesError } = await this.bucket.list('', {
        limit: 1
      });

      if (filesError) {
        logger.warn(`⚠️ Bucket access test failed: ${filesError.message}`);
        return {
          connectionOk: true,
          bucketExists: true,
          bucketAccessible: false,
          error: filesError.message
        };
      }

      logger.info(`✅ Bucket access test passed - bucket is accessible`);

      return {
        connectionOk: true,
        bucketExists: true,
        bucketAccessible: true,
        fileCount: files ? files.length : 0
      };

    } catch (error) {
      logger.error('❌ Connection test failed:', error);
      return {
        connectionOk: false,
        error: error.message
      };
    }
  }

  /**
   * Create folder structure in the bucket
   */
  async createFolderStructure() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('📁 Creating folder structure in bucket...');

      const folders = [
        this.config.folders.models,
        this.config.folders.thumbnails,
        this.config.folders.metadata
      ];

      // Add category subfolders
      Object.values(this.config.folders.categories).forEach(category => {
        folders.push(`${this.config.folders.models}/${category}`);
        folders.push(`${this.config.folders.thumbnails}/${category}`);
        folders.push(`${this.config.folders.metadata}/${category}`);
      });

      const results = [];

      for (const folder of folders) {
        try {
          // Create a placeholder file to establish the folder
          // Supabase doesn't have explicit folder creation, so we use empty files
          const placeholderPath = `${folder}/.gitkeep`;
          
          const { data, error } = await this.bucket.upload(
            placeholderPath,
            new Blob([''], { type: 'text/plain' }),
            {
              cacheControl: '3600',
              upsert: true // Don't fail if file already exists
            }
          );

          if (error && !error.message.includes('already exists')) {
            logger.warn(`⚠️ Failed to create folder ${folder}: ${error.message}`);
            results.push({ folder, success: false, error: error.message });
          } else {
            logger.debug(`✅ Created folder: ${folder}`);
            results.push({ folder, success: true });
          }

        } catch (folderError) {
          logger.warn(`⚠️ Error creating folder ${folder}:`, folderError.message);
          results.push({ folder, success: false, error: folderError.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      logger.info(`✅ Folder structure creation completed: ${successCount}/${folders.length} folders`);

      return results;

    } catch (error) {
      logger.error('❌ Failed to create folder structure:', error);
      throw error;
    }
  }

  /**
   * Get bucket statistics and information
   */
  async getBucketInfo() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('📊 Gathering bucket information...');

      // Get bucket details
      const { data: buckets, error: listError } = await this.client.storage.listBuckets();
      
      if (listError) {
        throw new Error(`Failed to get bucket info: ${listError.message}`);
      }

      const bucket = buckets.find(b => b.name === this.config.storage.bucketName);
      
      if (!bucket) {
        return {
          exists: false,
          name: this.config.storage.bucketName
        };
      }

      // Count files in different folders
      const folderStats = {};
      
      for (const [folderKey, folderPath] of Object.entries(this.config.folders)) {
        if (typeof folderPath === 'string') {
          try {
            const { data: files, error } = await this.bucket.list(folderPath, {
              limit: 1000
            });
            
            folderStats[folderKey] = {
              path: folderPath,
              fileCount: files ? files.length : 0,
              error: error ? error.message : null
            };
          } catch (err) {
            folderStats[folderKey] = {
              path: folderPath,
              fileCount: 0,
              error: err.message
            };
          }
        }
      }

      return {
        exists: true,
        name: bucket.name,
        id: bucket.id,
        createdAt: bucket.created_at,
        public: bucket.public,
        allowedMimeTypes: bucket.allowed_mime_types,
        fileSizeLimit: bucket.file_size_limit,
        folderStats
      };

    } catch (error) {
      logger.error('❌ Failed to get bucket info:', error);
      throw error;
    }
  }

  /**
   * Setup complete bucket with structure and policies
   */
  async setupBucket() {
    try {
      logger.info('🚀 Setting up complete Supabase storage bucket...');

      // Step 1: Initialize client
      await this.initialize();

      // Step 2: Create bucket
      const bucketResult = await this.createBucket();

      // Step 3: Create folder structure
      await this.createFolderStructure();

      // Step 4: Test everything
      const testResult = await this.testConnection();

      // Step 5: Get final bucket info
      const bucketInfo = await this.getBucketInfo();

      logger.info('✅ Supabase storage bucket setup completed successfully');

      return {
        bucketCreated: bucketResult.created,
        bucketName: this.config.storage.bucketName,
        testResult,
        bucketInfo
      };

    } catch (error) {
      logger.error('❌ Bucket setup failed:', error);
      throw error;
    }
  }

  /**
   * Get the storage client for file operations
   */
  getStorageClient() {
    if (!this.isInitialized || !this.bucket) {
      throw new Error('Supabase client not initialized. Call initialize() first.');
    }
    return this.bucket;
  }

  /**
   * Get the main Supabase client
   */
  getClient() {
    if (!this.isInitialized || !this.client) {
      throw new Error('Supabase client not initialized. Call initialize() first.');
    }
    return this.client;
  }
}

module.exports = SupabaseClient; 