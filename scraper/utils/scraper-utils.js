const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/scraper-config');
const logger = require('./logger');
const RateLimiter = require('./rate-limiter'); // TASK 8: Enhanced rate limiting

class ScraperUtils {
  
  // TASK 8: Initialize enhanced rate limiter
  static rateLimiter = new RateLimiter();
  
  /**
   * TASK 8: Initialize rate limiter with proxy support
   */
  static async initializeRateLimiter(proxies = []) {
    await this.rateLimiter.initializeProxyPool(proxies);
    logger.info('🚀 Enhanced rate limiter initialized for Task 8');
  }
  
  /**
   * TASK 8: Enhanced random delay with human-like behavior
   */
  static async randomDelay(type = 'request') {
    return await this.rateLimiter.randomDelay(type);
  }

  /**
   * TASK 8: Enhanced user agent rotation
   */
  static getRandomUserAgent() {
    return this.rateLimiter.getRandomUserAgent();
  }

  /**
   * Create a safe filename from a model name
   */
  static createSafeFilename(originalName, extension = '') {
    // Remove/replace unsafe characters
    let safeName = originalName
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .toLowerCase()
      .trim();
    
    // Truncate if too long
    if (safeName.length > 50) {
      safeName = safeName.substring(0, 50);
    }
    
    // Add UUID for uniqueness
    const uniqueId = uuidv4().split('-')[0]; // First 8 characters of UUID
    safeName = `${safeName}-${uniqueId}`;
    
    return extension ? `${safeName}${extension}` : safeName;
  }

  /**
   * TASK 8: Enhanced download with rate limiting and error handling
   */
  static async downloadFile(url, filename, downloadPath = config.paths.models) {
    const context = {
      url,
      modelName: filename,
      content: ''
    };

    return await this.rateLimiter.retryWithErrorHandling(async (attempt) => {
      logger.downloadStart(filename, url, attempt > 0 ? ` (attempt ${attempt + 1})` : '');
      
      // Ensure download directory exists
      await fs.ensureDir(downloadPath);
      
      const filePath = path.join(downloadPath, filename);
      
      // Get proxy if available
      const proxy = this.rateLimiter.getNextProxy();
      
      // Get matching headers for current user agent
      const userAgent = this.getRandomUserAgent();
      const headers = this.rateLimiter.getMatchingHeaders(userAgent);
      
      // Configure axios for file download with enhanced settings
      const axiosConfig = {
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 60000, // 60 seconds timeout
        headers: {
          ...headers,
          'Accept': '*/*',
          'Referer': 'https://free3d.com/'
        }
      };
      
      // Add proxy if available
      if (proxy) {
        axiosConfig.httpsAgent = proxy.agent;
      }

      const response = await axios(axiosConfig);

      // SUBTASK 8.5: Enhanced download validation
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check for authentication requirements in headers
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        // Might be a login page instead of file
        throw new Error('Download returned HTML - likely requires authentication');
      }

      // Check file size
      const contentLength = parseInt(response.headers['content-length'], 10);
      if (contentLength && contentLength > config.limits.maxFileSize) {
        throw new Error(`File too large: ${contentLength} bytes (max: ${config.limits.maxFileSize})`);
      }

      // Validate file appears to be legitimate (not too small)
      if (contentLength && contentLength < 1024) { // Less than 1KB
        throw new Error(`File too small: ${contentLength} bytes - likely error page`);
      }

      // Create write stream
      const writer = fs.createWriteStream(filePath);
      
      // Pipe the response to file
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          try {
            const stats = fs.statSync(filePath);
            
            // SUBTASK 8.5: Validate downloaded file
            if (stats.size === 0) {
              fs.unlinkSync(filePath); // Remove empty file
              reject(new Error('Downloaded file is empty'));
              return;
            }
            
            // Check if file is actually HTML (error page)
            const firstBytes = fs.readFileSync(filePath, { start: 0, end: 100 });
            if (firstBytes.toString().includes('<html') || firstBytes.toString().includes('<!DOCTYPE')) {
              fs.unlinkSync(filePath); // Remove HTML file
              reject(new Error('Downloaded file is HTML - likely error or login page'));
              return;
            }
            
            logger.downloadComplete(filename, stats.size);
            resolve({
              success: true,
              filePath: filePath,
              size: stats.size
            });
          } catch (error) {
            reject(error);
          }
        });
        
        writer.on('error', (error) => {
          logger.downloadError(filename, error);
          reject(error);
        });
      });

    }, context);
  }

  /**
   * Extract metadata from a model page
   */
  static extractModelMetadata(page, modelUrl) {
    return page.evaluate((url) => {
      const metadata = {
        url: url,
        extractedAt: new Date().toISOString()
      };

      // Try to extract title
      const titleElement = document.querySelector('h1, .model-title, [class*="title"]');
      metadata.title = titleElement ? titleElement.textContent.trim() : 'Unknown Model';

      // Try to extract description
      const descElements = document.querySelectorAll('.description, .model-description, p');
      let description = '';
      for (const elem of descElements) {
        const text = elem.textContent.trim();
        if (text.length > 50) { // Likely a description
          description = text;
          break;
        }
      }
      metadata.description = description || 'No description available';

      // Try to extract category
      const categoryElement = document.querySelector('.category, .breadcrumb, [class*="category"]');
      metadata.category = categoryElement ? categoryElement.textContent.trim() : 'Uncategorized';

      // Try to extract tags
      const tagElements = document.querySelectorAll('.tag, .tags a, [class*="tag"]');
      metadata.tags = Array.from(tagElements).map(tag => tag.textContent.trim()).filter(tag => tag.length > 0);

      // Try to extract file information
      const fileElements = document.querySelectorAll('a[href*=".obj"], a[href*=".mtl"], a[href*=".zip"]');
      metadata.downloadLinks = Array.from(fileElements).map(link => ({
        url: link.href,
        filename: link.textContent.trim() || link.href.split('/').pop(),
        type: this.getFileType(link.href)
      }));

      // Try to extract thumbnail
      const thumbnailElement = document.querySelector('img[src*="thumb"], .thumbnail img, .preview img');
      metadata.thumbnail = thumbnailElement ? thumbnailElement.src : null;

      return metadata;
    }, modelUrl);
  }

  /**
   * Get file type from URL
   */
  static getFileType(url) {
    const extension = path.extname(url.toLowerCase());
    
    if (config.fileTypes.models.includes(extension)) return 'model';
    if (config.fileTypes.textures.includes(extension)) return 'texture';
    if (config.fileTypes.archives.includes(extension)) return 'archive';
    
    return 'unknown';
  }

  /**
   * Save metadata to JSON file
   */
  static async saveMetadata(metadataArray) {
    try {
      const metadataPath = config.paths.metadata;
      await fs.ensureDir(path.dirname(metadataPath));
      
      // Load existing metadata if it exists
      let existingMetadata = [];
      if (await fs.pathExists(metadataPath)) {
        existingMetadata = await fs.readJson(metadataPath);
      }
      
      // Merge with new metadata
      const mergedMetadata = [...existingMetadata, ...metadataArray];
      
      // Save updated metadata
      await fs.writeJson(metadataPath, mergedMetadata, { spaces: 2 });
      
      logger.info(`💾 Saved metadata for ${metadataArray.length} models to ${metadataPath}`);
      
    } catch (error) {
      logger.error('Failed to save metadata', error);
      throw error;
    }
  }

  /**
   * TASK 8: Enhanced retry with rate limiting and error handling
   */
  static async retry(fn, context = {}) {
    return await this.rateLimiter.retryWithErrorHandling(fn, context);
  }

  /**
   * TASK 8: Get rate limiting statistics
   */
  static getRateLimiterStats() {
    return this.rateLimiter.getStats();
  }

  /**
   * TASK 8: Reset rate limiter statistics
   */
  static resetRateLimiterStats() {
    this.rateLimiter.resetStats();
  }

  /**
   * Check if a URL is valid
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = ScraperUtils; 