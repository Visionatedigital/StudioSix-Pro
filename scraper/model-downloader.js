const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const config = require('./config/scraper-config');
const logger = require('./utils/logger');
const ScraperUtils = require('./utils/scraper-utils');

class ModelDownloader {
  constructor(navigator) {
    this.navigator = navigator;
    this.page = navigator.page;
    this.downloadedCount = 0;
  }

  /**
   * Navigate to a model's detail page and find download links
   */
  async getModelDownloadInfo(model) {
    try {
      logger.info(`🔍 Getting download info for: ${model.title}`);
      
      // Navigate to the model detail page
      const detailUrl = model.detailPageUrl.startsWith('http') 
        ? model.detailPageUrl 
        : `${config.site.baseUrl}${model.detailPageUrl}`;
        
      await this.page.goto(detailUrl, { 
        waitUntil: 'networkidle',
        timeout: 60000 
      });

      // Wait for page to load
      await this.page.waitForLoadState('domcontentloaded');
      await ScraperUtils.randomDelay(500, 2000);

      // Extract download information from the detail page
      const downloadInfo = await this.page.evaluate(() => {
        const info = {
          title: document.title,
          downloadLinks: [],
          isActuallyFree: false,
          error: null
        };

        try {
          // Look for download buttons/links
          const downloadSelectors = [
            'a[href*=".obj"]',
            'a[href*=".zip"]',
            'a[href*="download"]',
            '.download-btn',
            '.download-link',
            '[class*="download"]',
            'button[class*="download"]'
          ];

          downloadSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              const href = el.href;
              const text = el.textContent.trim();
              
              if (href && (href.includes('.obj') || href.includes('.zip') || text.toLowerCase().includes('download'))) {
                info.downloadLinks.push({
                  url: href,
                  text: text,
                  isObjFile: href.includes('.obj'),
                  isZipFile: href.includes('.zip')
                });
              }
            });
          });

          // Check if model is actually free (not premium)
          const freeIndicators = document.querySelectorAll('*');
          for (const el of freeIndicators) {
            const text = el.textContent.toLowerCase();
            if (text.includes('free') && !text.includes('premium') && !text.includes('$')) {
              info.isActuallyFree = true;
              break;
            }
          }

          // Also check if there are no premium/payment indicators
          const premiumIndicators = ['premium', '$', 'buy', 'purchase', 'pay'];
          const pageText = document.body.textContent.toLowerCase();
          const hasPremiumIndicators = premiumIndicators.some(indicator => 
            pageText.includes(indicator) && !pageText.includes('free')
          );
          
          if (!hasPremiumIndicators && info.downloadLinks.length > 0) {
            info.isActuallyFree = true;
          }

          return info;
          
        } catch (error) {
          info.error = error.message;
          return info;
        }
      });

      logger.info(`📋 Download info for "${model.title}":`, {
        downloadLinksFound: downloadInfo.downloadLinks.length,
        hasObjFiles: downloadInfo.downloadLinks.some(link => link.isObjFile),
        isActuallyFree: downloadInfo.isActuallyFree,
        error: downloadInfo.error
      });

      return downloadInfo;

    } catch (error) {
      logger.error(`❌ Failed to get download info for "${model.title}"`, error);
      return { 
        title: model.title, 
        downloadLinks: [], 
        isActuallyFree: false, 
        error: error.message 
      };
    }
  }

  /**
   * Download a single file with progress tracking
   */
  async downloadFile(url, filename, downloadPath) {
    try {
      // Ensure download directory exists
      await fs.ensureDir(downloadPath);
      
      const filePath = path.join(downloadPath, filename);
      
      // Check if file already exists
      if (await fs.pathExists(filePath)) {
        logger.info(`📁 File already exists: ${filename}`);
        const stats = await fs.stat(filePath);
        return {
          success: true,
          filePath: filePath,
          size: stats.size,
          alreadyExists: true
        };
      }

      logger.downloadStart(filename, url);

      // Configure request with anti-detection headers
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 120000, // 2 minutes timeout for large files
        headers: {
          'User-Agent': ScraperUtils.getRandomUserAgent(),
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': config.site.baseUrl,
          'DNT': '1'
        }
      });

      // Check file size
      const contentLength = parseInt(response.headers['content-length'], 10);
      if (contentLength && contentLength > config.limits.maxFileSize) {
        const formatFileSize = (bytes) => {
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          if (bytes === 0) return '0 Bytes';
          const i = Math.floor(Math.log(bytes) / Math.log(1024));
          return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        };
        throw new Error(`File too large: ${formatFileSize(contentLength)} (max: ${formatFileSize(config.limits.maxFileSize)})`);
      }

      // Create write stream
      const writer = fs.createWriteStream(filePath);
      
      // Pipe the response to file
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          try {
            const stats = await fs.stat(filePath);
            logger.downloadComplete(filename, stats.size);
            resolve({
              success: true,
              filePath: filePath,
              size: stats.size,
              alreadyExists: false
            });
          } catch (error) {
            reject(error);
          }
        });
        
        writer.on('error', (error) => {
          logger.downloadError(filename, error);
          reject(error);
        });

        response.data.on('error', (error) => {
          logger.downloadError(filename, error);
          reject(error);
        });
      });

    } catch (error) {
      logger.downloadError(filename, error);
      throw error;
    }
  }

  /**
   * Download model files (.obj, .mtl, textures) and thumbnail
   */
  async downloadModel(model, downloadInfo) {
    try {
      logger.info(`📦 Starting download for: ${model.title}`);
      
      const modelSlug = ScraperUtils.createSafeFilename(model.title);
      const modelDir = path.join(config.paths.models, modelSlug);
      
      const results = {
        modelTitle: model.title,
        modelSlug: modelSlug,
        modelDir: modelDir,
        downloads: [],
        thumbnail: null,
        success: false,
        error: null
      };

      // Ensure model directory exists
      await fs.ensureDir(modelDir);

      // Download thumbnail first
      if (model.thumbnail) {
        try {
          const thumbnailExt = path.extname(model.thumbnail) || '.jpg';
          const thumbnailFilename = `thumbnail${thumbnailExt}`;
          
          const thumbnailResult = await this.downloadFile(
            model.thumbnail, 
            thumbnailFilename, 
            modelDir
          );
          
          results.thumbnail = thumbnailResult;
          
        } catch (thumbnailError) {
          logger.warn(`⚠️ Failed to download thumbnail for ${model.title}:`, thumbnailError.message);
        }
      }

      // Download model files
      for (const link of downloadInfo.downloadLinks) {
        try {
          // Add random delay between downloads
          await ScraperUtils.randomDelay(1000, 3000);
          
          const url = link.url.startsWith('http') ? link.url : `${config.site.baseUrl}${link.url}`;
          const filename = path.basename(url).split('?')[0] || `model-file-${Date.now()}`;
          
          const downloadResult = await this.downloadFile(url, filename, modelDir);
          downloadResult.linkInfo = link;
          
          results.downloads.push(downloadResult);
          
        } catch (downloadError) {
          logger.warn(`⚠️ Failed to download ${link.url}:`, downloadError.message);
          results.downloads.push({
            success: false,
            error: downloadError.message,
            linkInfo: link
          });
        }
      }

      // Check if we got at least one successful download
      const successfulDownloads = results.downloads.filter(d => d.success);
      results.success = successfulDownloads.length > 0;

      if (results.success) {
        this.downloadedCount++;
        logger.info(`✅ Successfully downloaded model: ${model.title} (${successfulDownloads.length} files)`);
      } else {
        logger.warn(`⚠️ No files downloaded for model: ${model.title}`);
      }

      return results;

    } catch (error) {
      logger.error(`❌ Failed to download model: ${model.title}`, error);
      return {
        modelTitle: model.title,
        success: false,
        error: error.message,
        downloads: [],
        thumbnail: null
      };
    }
  }

  /**
   * Get download statistics
   */
  getStats() {
    return {
      modelsDownloaded: this.downloadedCount,
      downloadPath: config.paths.models
    };
  }
}

module.exports = ModelDownloader; 