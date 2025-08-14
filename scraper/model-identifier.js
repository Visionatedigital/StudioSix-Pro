const Free3DNavigator = require('./free3d-navigator');
const logger = require('./utils/logger');
const ScraperUtils = require('./utils/scraper-utils');

class ModelIdentifier {
  constructor(navigator) {
    this.navigator = navigator;
    this.page = navigator.page;
  }

  /**
   * Analyze the page structure to identify model listing elements
   */
  async analyzePage() {
    try {
      logger.info('🔍 Analyzing page structure for model elements...');
      
      const analysis = await this.page.evaluate(() => {
        const results = {
          pageInfo: {
            url: window.location.href,
            title: document.title,
            totalElements: document.querySelectorAll('*').length
          },
          potentialModelContainers: [],
          allClasses: new Set(),
          allIds: new Set(),
          linkElements: [],
          imageElements: []
        };

        // Collect all classes and IDs for analysis
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.className && typeof el.className === 'string') {
            el.className.split(' ').forEach(cls => {
              if (cls.trim()) results.allClasses.add(cls.trim());
            });
          }
          if (el.id) results.allIds.add(el.id);
        });

        // Look for potential model containers with keywords
        const modelKeywords = ['model', 'product', 'item', 'card', 'grid', 'result', 'listing'];
        const containerSelectors = [];
        
        modelKeywords.forEach(keyword => {
          // Check for classes containing the keyword
          Array.from(results.allClasses).forEach(cls => {
            if (cls.toLowerCase().includes(keyword)) {
              containerSelectors.push(`.${cls}`);
            }
          });
          
          // Check for IDs containing the keyword
          Array.from(results.allIds).forEach(id => {
            if (id.toLowerCase().includes(keyword)) {
              containerSelectors.push(`#${id}`);
            }
          });
        });

        // Test each potential selector
        containerSelectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              results.potentialModelContainers.push({
                selector: selector,
                count: elements.length,
                hasImages: Array.from(elements).some(el => el.querySelector('img')),
                hasLinks: Array.from(elements).some(el => el.querySelector('a')),
                hasText: Array.from(elements).some(el => el.textContent.trim().length > 0),
                sampleHtml: elements[0] ? elements[0].outerHTML.substring(0, 500) : ''
              });
            }
          } catch (e) {
            // Ignore invalid selectors
          }
        });

        // Find all links that might be download links
        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
          const href = link.href.toLowerCase();
          const text = link.textContent.toLowerCase();
          
          if (href.includes('.obj') || href.includes('.mtl') || href.includes('.zip') ||
              href.includes('download') || text.includes('download') || text.includes('.obj')) {
            results.linkElements.push({
              href: link.href,
              text: link.textContent.trim(),
              className: link.className,
              hasObjFile: href.includes('.obj')
            });
          }
        });

        // Find all images that might be thumbnails
        const images = document.querySelectorAll('img[src]');
        images.forEach(img => {
          const src = img.src.toLowerCase();
          const alt = (img.alt || '').toLowerCase();
          
          if (src.includes('thumb') || src.includes('preview') || src.includes('model') ||
              alt.includes('thumb') || alt.includes('preview') || alt.includes('model')) {
            results.imageElements.push({
              src: img.src,
              alt: img.alt,
              className: img.className,
              width: img.width,
              height: img.height
            });
          }
        });

        // Convert Sets to Arrays for JSON serialization
        results.allClasses = Array.from(results.allClasses).sort();
        results.allIds = Array.from(results.allIds).sort();

        return results;
      });

      logger.info('📊 Page Analysis Results:', {
        url: analysis.pageInfo.url,
        title: analysis.pageInfo.title,
        totalElements: analysis.pageInfo.totalElements,
        potentialContainers: analysis.potentialModelContainers.length,
        downloadLinks: analysis.linkElements.length,
        thumbnailImages: analysis.imageElements.length,
        totalClasses: analysis.allClasses.length,
        totalIds: analysis.allIds.length
      });

      return analysis;

    } catch (error) {
      logger.error('❌ Failed to analyze page structure', error);
      throw error;
    }
  }

  /**
   * Find the best selector for model listings based on analysis
   */
  async findBestModelSelector() {
    try {
      const analysis = await this.analyzePage();
      
      // Score potential selectors based on various criteria
      const scoredSelectors = analysis.potentialModelContainers.map(container => {
        let score = 0;
        
        // Higher score for more elements (likely a listing)
        if (container.count > 5) score += 3;
        else if (container.count > 1) score += 2;
        else score += 1;
        
        // Higher score if containers have images (thumbnails)
        if (container.hasImages) score += 3;
        
        // Higher score if containers have links (download/detail links)
        if (container.hasLinks) score += 2;
        
        // Higher score if containers have meaningful text
        if (container.hasText) score += 1;
        
        // Prefer selectors with model-related keywords
        const selector = container.selector.toLowerCase();
        if (selector.includes('model')) score += 3;
        if (selector.includes('product')) score += 2;
        if (selector.includes('item')) score += 2;
        if (selector.includes('card')) score += 2;
        if (selector.includes('result')) score += 2;
        
        return { ...container, score };
      });

      // Sort by score and return the best one
      scoredSelectors.sort((a, b) => b.score - a.score);
      
      const bestSelector = scoredSelectors[0];
      
      if (bestSelector) {
        logger.info(`🎯 Best model selector identified: ${bestSelector.selector} (score: ${bestSelector.score}, count: ${bestSelector.count})`);
        return bestSelector;
      } else {
        logger.warn('⚠️ No suitable model selector found');
        return null;
      }

    } catch (error) {
      logger.error('❌ Failed to find best model selector', error);
      throw error;
    }
  }

    /**
   * Extract model information from the page using identified selectors
   */
  async extractModels(limit = 10) {
    try {
      logger.info(`📦 Extracting models (limit: ${limit})...`);
      
      // Use the working simple approach
      const models = await this.page.evaluate((maxModels) => {
        const containers = document.querySelectorAll('.search-result');
        const extractedModels = [];

        for (let i = 0; i < Math.min(containers.length, maxModels); i++) {
          const container = containers[i];
          const img = container.querySelector('img');
          const link = container.querySelector('a');
          const text = container.textContent || '';
          
          if (img && link) {
            extractedModels.push({
              index: i,
              title: img.alt || img.title || `Model ${i + 1}`,
              thumbnail: img.src,
              thumbnailAlt: img.alt,
              detailPageUrl: link.href,
              hasObjFormat: text.includes('.obj'),
              hasBlendFormat: text.includes('.blend'),
              isFree: text.includes('FREE'),
              downloads: (text.match(/[\d,]+(?=\s*$)/) || [])[0],
              textContent: text.replace(/\s+/g, ' ').trim(),
              extractedAt: new Date().toISOString()
            });
          }
        }

        return extractedModels;
      }, limit);

      logger.info(`✅ Extracted ${models.length} models using selector: .search-result`);
      
      // Log details of extracted models
      models.forEach((model, index) => {
        logger.modelFound(model.title, model.detailPageUrl);
        logger.debug(`📦 Model ${index + 1} details:`, {
          title: model.title,
          thumbnail: model.thumbnail ? 'Yes' : 'No',
          detailPage: model.detailPageUrl ? 'Yes' : 'No',
          hasObjFormat: model.hasObjFormat,
          isFree: model.isFree,
          downloads: model.downloads
        });
      });

      return models;

    } catch (error) {
      logger.error('❌ Failed to extract models', error);
      throw error;
    }
  }

  /**
   * Filter models to only include those with .obj files
   */
  filterObjModels(models) {
    const objModels = models.filter(model => {
      return model.hasObjFormat === true;
    });

    logger.info(`🎯 Filtered to ${objModels.length} models with .obj files (from ${models.length} total)`);
    
    objModels.forEach((model, index) => {
      logger.info(`🎯 .obj Model ${index + 1}: ${model.title}`);
    });
    
    return objModels;
  }
}

module.exports = ModelIdentifier; 