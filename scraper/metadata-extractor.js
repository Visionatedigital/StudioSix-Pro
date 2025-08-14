const fs = require('fs-extra');
const path = require('path');
const config = require('./config/scraper-config');
const logger = require('./utils/logger');
const ScraperUtils = require('./utils/scraper-utils');

class MetadataExtractor {
  constructor(navigator) {
    this.navigator = navigator;
    this.page = navigator.page;
    this.extractedModels = [];
  }

  /**
   * Extract comprehensive metadata from a model detail page
   */
  async extractDetailedMetadata(model, downloadInfo) {
    try {
      logger.info(`📋 Extracting detailed metadata for: ${model.title}`);

      // Extract metadata from the current detail page
      const detailedMetadata = await this.page.evaluate(() => {
        const metadata = {
          extractedAt: new Date().toISOString(),
          url: window.location.href,
          title: document.title
        };

        try {
          // Extract title and description
          const titleElement = document.querySelector('h1, .model-title, [class*="title"]');
          metadata.pageTitle = titleElement ? titleElement.textContent.trim() : '';

          // Extract description from various possible locations
          const descriptionSelectors = [
            '.description',
            '.model-description', 
            '[class*="description"]',
            '.content p',
            '.details p',
            'p'
          ];

          for (const selector of descriptionSelectors) {
            const descElement = document.querySelector(selector);
            if (descElement && descElement.textContent.trim().length > 50) {
              metadata.description = descElement.textContent.trim();
              break;
            }
          }

          // Extract categories and tags
          metadata.categories = [];
          metadata.tags = [];

          // Look for breadcrumbs or category links
          const breadcrumbs = document.querySelectorAll('.breadcrumb a, [class*="breadcrumb"] a');
          breadcrumbs.forEach(link => {
            const text = link.textContent.trim();
            if (text && text !== 'Home' && text !== '3D Models') {
              metadata.categories.push(text);
            }
          });

          // Look for tags
          const tagElements = document.querySelectorAll('.tag, .tags a, [class*="tag"] a, .keywords a');
          tagElements.forEach(tag => {
            const text = tag.textContent.trim();
            if (text && text.length > 0) {
              metadata.tags.push(text);
            }
          });

          // Extract file format information
          metadata.formats = [];
          const pageText = document.body.textContent.toLowerCase();
          const formatPatterns = ['.obj', '.mtl', '.fbx', '.dae', '.blend', '.max', '.ma', '.mb'];
          formatPatterns.forEach(format => {
            if (pageText.includes(format)) {
              metadata.formats.push(format.substring(1)); // Remove the dot
            }
          });

          // Extract model statistics
          metadata.stats = {};
          
          // Look for download count
          const downloadElements = document.querySelectorAll('*');
          for (const el of downloadElements) {
            const text = el.textContent;
            const downloadMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:downloads?|times?|hits?)/i);
            if (downloadMatch) {
              metadata.stats.downloads = downloadMatch[1].replace(/,/g, '');
              break;
            }
          }

          // Look for ratings or likes
          const ratingElements = document.querySelectorAll('[class*="rating"], [class*="star"], [class*="like"]');
          ratingElements.forEach(el => {
            const text = el.textContent;
            const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
            if (numberMatch) {
              if (el.className.includes('rating') || el.className.includes('star')) {
                metadata.stats.rating = numberMatch[1];
              } else if (el.className.includes('like')) {
                metadata.stats.likes = numberMatch[1];
              }
            }
          });

          // Extract author information
          metadata.author = {};
          const authorSelectors = [
            '.author', 
            '.creator', 
            '[class*="author"]', 
            '[class*="creator"]',
            '.user-name',
            '.username'
          ];

          for (const selector of authorSelectors) {
            const authorElement = document.querySelector(selector);
            if (authorElement) {
              metadata.author.name = authorElement.textContent.trim();
              
              // Try to get author link
              const authorLink = authorElement.querySelector('a') || authorElement.closest('a');
              if (authorLink) {
                metadata.author.profileUrl = authorLink.href;
              }
              break;
            }
          }

          // Extract license information
          const licenseElements = document.querySelectorAll('*');
          for (const el of licenseElements) {
            const text = el.textContent.toLowerCase();
            if (text.includes('license') || text.includes('creative commons') || text.includes('cc ')) {
              metadata.license = el.textContent.trim();
              break;
            }
          }

          // Extract pricing information
          metadata.pricing = {
            isFree: false,
            isPremium: false,
            price: null
          };

          const pricingText = document.body.textContent.toLowerCase();
          if (pricingText.includes('free')) {
            metadata.pricing.isFree = true;
          }
          if (pricingText.includes('premium') || pricingText.includes('$')) {
            metadata.pricing.isPremium = true;
          }

          // Look for specific price
          const priceMatch = pricingText.match(/\$(\d+(?:\.\d{2})?)/);
          if (priceMatch) {
            metadata.pricing.price = priceMatch[1];
          }

          // Extract technical details
          metadata.technical = {};
          
          // Look for polygon/vertex count
          const polyMatches = pageText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:polygons?|polys?|tris?|triangles?|vertices?|verts?)/i);
          if (polyMatches) {
            metadata.technical.polygonCount = polyMatches[1].replace(/,/g, '');
          }

          // Look for texture information
          if (pageText.includes('texture') || pageText.includes('material')) {
            metadata.technical.hasTextures = true;
          }

          // Look for rigged/animated information
          if (pageText.includes('rigged') || pageText.includes('rig')) {
            metadata.technical.isRigged = true;
          }
          if (pageText.includes('animated') || pageText.includes('animation')) {
            metadata.technical.hasAnimation = true;
          }

          return metadata;

        } catch (error) {
          metadata.extractionError = error.message;
          return metadata;
        }
      });

      // Combine with basic model info and download info
      const completeMetadata = {
        ...model,
        ...detailedMetadata,
        downloadInfo: {
          downloadLinksFound: downloadInfo.downloadLinks.length,
          isActuallyFree: downloadInfo.isActuallyFree,
          downloadLinks: downloadInfo.downloadLinks
        },
        scrapingSession: {
          extractedAt: new Date().toISOString(),
          userAgent: ScraperUtils.getRandomUserAgent(),
          sourceUrl: config.site.baseUrl
        }
      };

      // Clean up the metadata
      completeMetadata.description = completeMetadata.description || 'No description available';
      completeMetadata.categories = [...new Set(completeMetadata.categories || [])]; // Remove duplicates
      completeMetadata.tags = [...new Set(completeMetadata.tags || [])]; // Remove duplicates
      completeMetadata.formats = [...new Set(completeMetadata.formats || [])]; // Remove duplicates

      this.extractedModels.push(completeMetadata);

      logger.info(`✅ Extracted metadata for: ${model.title}`, {
        categories: completeMetadata.categories.length,
        tags: completeMetadata.tags.length,
        formats: completeMetadata.formats.length,
        hasDescription: !!completeMetadata.description,
        hasAuthor: !!completeMetadata.author?.name,
        hasStats: !!completeMetadata.stats?.downloads
      });

      return completeMetadata;

    } catch (error) {
      logger.error(`❌ Failed to extract metadata for: ${model.title}`, error);
      return {
        ...model,
        extractionError: error.message,
        extractedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Save all extracted metadata to JSON files
   */
  async saveMetadata() {
    try {
      if (this.extractedModels.length === 0) {
        logger.warn('⚠️ No metadata to save');
        return false;
      }

      // Create metadata directory
      const metadataDir = path.join(config.paths.models, 'metadata');
      await fs.ensureDir(metadataDir);

      // Save individual model metadata files
      for (const model of this.extractedModels) {
        const filename = `${ScraperUtils.createSafeFilename(model.title)}.json`;
        const filePath = path.join(metadataDir, filename);
        
        await fs.writeJson(filePath, model, { spaces: 2 });
        logger.debug(`💾 Saved individual metadata: ${filename}`);
      }

      // Save combined metadata file
      const combinedPath = path.join(metadataDir, 'all-models.json');
      await fs.writeJson(combinedPath, {
        generatedAt: new Date().toISOString(),
        totalModels: this.extractedModels.length,
        scrapingSource: config.site.baseUrl,
        models: this.extractedModels
      }, { spaces: 2 });

      // Create summary statistics
      const summary = this.generateSummaryStats();
      const summaryPath = path.join(metadataDir, 'summary.json');
      await fs.writeJson(summaryPath, summary, { spaces: 2 });

      logger.info(`✅ Saved metadata for ${this.extractedModels.length} models`, {
        metadataDir: metadataDir,
        individualFiles: this.extractedModels.length,
        combinedFile: 'all-models.json',
        summaryFile: 'summary.json'
      });

      return true;

    } catch (error) {
      logger.error('❌ Failed to save metadata', error);
      throw error;
    }
  }

  /**
   * Generate summary statistics from extracted metadata
   */
  generateSummaryStats() {
    const summary = {
      generatedAt: new Date().toISOString(),
      totalModels: this.extractedModels.length,
      statistics: {
        formats: {},
        categories: {},
        authors: {},
        freeModels: 0,
        premiumModels: 0,
        modelsWithTextures: 0,
        riggedModels: 0,
        animatedModels: 0
      }
    };

    this.extractedModels.forEach(model => {
      // Count formats
      if (model.formats) {
        model.formats.forEach(format => {
          summary.statistics.formats[format] = (summary.statistics.formats[format] || 0) + 1;
        });
      }

      // Count categories
      if (model.categories) {
        model.categories.forEach(category => {
          summary.statistics.categories[category] = (summary.statistics.categories[category] || 0) + 1;
        });
      }

      // Count authors
      if (model.author?.name) {
        summary.statistics.authors[model.author.name] = (summary.statistics.authors[model.author.name] || 0) + 1;
      }

      // Count pricing
      if (model.pricing?.isFree) summary.statistics.freeModels++;
      if (model.pricing?.isPremium) summary.statistics.premiumModels++;

      // Count technical features
      if (model.technical?.hasTextures) summary.statistics.modelsWithTextures++;
      if (model.technical?.isRigged) summary.statistics.riggedModels++;
      if (model.technical?.hasAnimation) summary.statistics.animatedModels++;
    });

    return summary;
  }

  /**
   * Get extraction statistics
   */
  getStats() {
    return {
      modelsProcessed: this.extractedModels.length,
      successfulExtractions: this.extractedModels.filter(m => !m.extractionError).length,
      failedExtractions: this.extractedModels.filter(m => m.extractionError).length
    };
  }
}

module.exports = MetadataExtractor; 