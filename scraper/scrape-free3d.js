#!/usr/bin/env node

/**
 * Free3D Model Scraper with Supabase Integration
 * Main entry point for scraping 3D models from Free3D and uploading to Supabase
 */

require('dotenv').config();
const Free3DNavigator = require('./free3d-navigator');
const ModelDownloader = require('./model-downloader');
const ModelIdentifier = require('./model-identifier');
const MetadataExtractor = require('./metadata-extractor');
const SupabaseUploader = require('./supabase-uploader');
const ModelCategorizer = require('./utils/model-categorizer');
const logger = require('./utils/logger');

class Free3DScraper {
  constructor() {
    this.navigator = new Free3DNavigator();
    this.downloader = null;  // Initialize after navigator
    this.identifier = null;  // Initialize after navigator
    this.metadataExtractor = null;  // Initialize after navigator
    this.uploader = new SupabaseUploader();
    this.categorizer = new ModelCategorizer();
    this.isInitialized = false;
  }

  /**
   * Initialize all components
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing Free3D Scraper...');
      
      // Initialize navigator first
      await this.navigator.initialize();
      
      // Now create components that depend on navigator
      this.downloader = new ModelDownloader(this.navigator);
      this.identifier = new ModelIdentifier(this.navigator);
      this.metadataExtractor = new MetadataExtractor(this.navigator);
      
      // Initialize remaining components
      if (this.downloader.initialize) await this.downloader.initialize();
      if (this.identifier.initialize) await this.identifier.initialize();
      if (this.metadataExtractor.initialize) await this.metadataExtractor.initialize();
      await this.uploader.initialize();
      
      this.isInitialized = true;
      logger.info('✅ All components initialized successfully');
      
    } catch (error) {
      logger.error('❌ Failed to initialize scraper:', error);
      throw error;
    }
  }

  /**
   * Main scraping workflow
   */
  async scrapeModels(options = {}) {
    if (!this.isInitialized) {
      throw new Error('Scraper not initialized. Call initialize() first.');
    }

    const {
      maxModels = 10,
      category = 'all',
      skipExisting = true,
      licenseCheck = true
    } = options;

    logger.info(`🎯 Starting scraping session: ${maxModels} models, category: ${category}`);
    
    let processed = 0;
    let successful = 0;
    let skipped = 0;
    let errors = 0;

         try {
       // Step 1: Navigate to Free3D and get model list
       logger.info('📍 Step 1: Navigating to Free3D...');
       await this.navigator.navigateToFree3D();
       await this.navigator.navigateToFreeModels();
       
       logger.info('🔍 Step 2: Discovering models...');
       const models = await this.identifier.extractModels(maxModels);
       logger.info(`🔍 Found ${models.length} models to process`);

             // Step 3: Process each model
       for (let i = 0; i < models.length; i++) {
         const model = models[i];
         processed++;
         
         logger.info(`\n📦 Processing model ${processed}/${models.length}: ${model.title || model.detailPageUrl}`);
         
         try {
           // Step 3a: Navigate to model detail page
           logger.info(`🔗 Navigating to model detail page: ${model.detailPageUrl}`);
           await this.navigator.page.goto(model.detailPageUrl, { 
             waitUntil: 'networkidle',
             timeout: 60000 
           });
           
           // Step 3b: Extract detailed metadata
                      const basicDownloadInfo = {
             downloadLinks: [],
             isActuallyFree: true
           };
           const metadata = await this.metadataExtractor.extractDetailedMetadata(model, basicDownloadInfo);
           
           // Step 3c: Smart categorization
           const categorization = this.categorizer.categorizeModel(metadata);
           metadata.categorization = categorization;
           
           logger.info(`🏷️ Categorized as: ${categorization.category} (${categorization.confidence}% confidence)`);
           
           // Step 3d: License compliance check
           if (licenseCheck && !this.isLicenseCompliant(metadata)) {
             logger.warn(`⚠️  Skipping model due to license restrictions: ${metadata.title}`);
             skipped++;
             continue;
           }
           
           // Step 3e: Check if already exists (temporarily disabled)
           // TODO: Implement modelExists method in SupabaseUploader
           // if (skipExisting && await this.uploader.modelExists(metadata)) {
           //   logger.info(`⏭️  Model already exists, skipping: ${metadata.title}`);
           //   skipped++;
           //   continue;
           // }
           
           // Step 3f: Get download information
           logger.info(`🔍 About to get download info for: ${model.title}`);
           const downloadInfo = await this.downloader.getModelDownloadInfo(model);
           logger.info(`📊 Download info received:`, downloadInfo);
           
           if (!downloadInfo || downloadInfo.downloadLinks.length === 0) {
             logger.warn(`⚠️  No download links found for: ${metadata.title}`);
             skipped++;
             continue;
           }
           
           // Step 3g: Download model files
           const downloadResult = await this.downloader.downloadModel(model, downloadInfo);
           
           if (!downloadResult.success) {
             logger.error(`❌ Download failed for: ${metadata.title}`);
             errors++;
             continue;
           }
           
           // Step 3h: Upload to Supabase with complete database integration (TASK 6)
           const uploadResult = await this.uploader.uploadModelWithDatabase(downloadResult.files, metadata, categorization);
           
           if (uploadResult.success) {
             logger.info(`✅ Successfully processed: ${metadata.title}`);
             if (uploadResult.databaseResult.isNew) {
               logger.info(`💾 New database record created - ID: ${uploadResult.modelId}`);
             } else {
               logger.info(`📊 Model already exists in database - ID: ${uploadResult.modelId}`);
             }
             successful++;
           } else {
             logger.error(`❌ Upload or database insertion failed for: ${metadata.title}`);
             logger.error(`🔍 Error details: ${uploadResult.error}`);
             errors++;
           }
           
         } catch (error) {
           logger.error(`❌ Error processing model ${model.title || model.detailPageUrl}:`, error);
           errors++;
        }
        
        // Small delay between models to be respectful
        await this.delay(2000);
      }
      
      // Final summary
      logger.info('\n🎉 SCRAPING SESSION COMPLETE!');
      logger.info('📊 Summary:');
      logger.info(`   • Processed: ${processed} models`);
      logger.info(`   • Successful: ${successful} models`);
      logger.info(`   • Skipped: ${skipped} models`);
      logger.info(`   • Errors: ${errors} models`);
      logger.info(`   • Success Rate: ${((successful / processed) * 100).toFixed(1)}%\n`);
      
      return {
        processed,
        successful,
        skipped,
        errors,
        successRate: (successful / processed) * 100
      };
      
    } catch (error) {
      logger.error('❌ Scraping session failed:', error);
      throw error;
    }
  }

  /**
   * Check if model license allows free use
   */
  isLicenseCompliant(metadata) {
    const freeTerms = ['free', 'cc0', 'creative commons', 'public domain', 'royalty free'];
    const restrictedTerms = ['commercial', 'paid', 'premium', 'license required'];
    
    const license = (metadata.license || '').toLowerCase();
    const description = (metadata.description || '').toLowerCase();
    
    // Check for restricted terms
    for (const term of restrictedTerms) {
      if (license.includes(term) || description.includes(term)) {
        return false;
      }
    }
    
    // Check for free terms
    for (const term of freeTerms) {
      if (license.includes(term) || description.includes(term)) {
        return true;
      }
    }
    
    // Default to compliant if no clear indication (will be manually reviewed)
    return true;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      logger.info('🧹 Cleaning up resources...');
      
      if (this.navigator) await this.navigator.close();
      if (this.downloader && this.downloader.cleanup) await this.downloader.cleanup();
      if (this.uploader && this.uploader.cleanup) await this.uploader.cleanup();
      
      logger.info('✅ Cleanup completed');
      
    } catch (error) {
      logger.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * Simple delay utility
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * CLI execution
 */
async function main() {
  const scraper = new Free3DScraper();
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const maxModels = parseInt(args.find(arg => arg.startsWith('--max='))?.split('=')[1]) || 10;
    const category = args.find(arg => arg.startsWith('--category='))?.split('=')[1] || 'all';
    const skipExisting = !args.includes('--no-skip');
    const licenseCheck = !args.includes('--no-license-check');
    
    logger.info('🚀 Starting Free3D Scraper...');
    logger.info(`⚙️  Configuration: max=${maxModels}, category=${category}, skipExisting=${skipExisting}, licenseCheck=${licenseCheck}`);
    
    // Initialize
    await scraper.initialize();
    
    // Start scraping
    const results = await scraper.scrapeModels({
      maxModels,
      category,
      skipExisting,
      licenseCheck
    });
    
    // Success exit
    process.exit(0);
    
  } catch (error) {
    logger.error('💥 Scraper failed:', error);
    process.exit(1);
    
  } finally {
    // Always cleanup
    await scraper.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = Free3DScraper; 