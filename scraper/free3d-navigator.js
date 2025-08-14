const { chromium } = require('playwright');
const config = require('./config/scraper-config');
const logger = require('./utils/logger');
const ScraperUtils = require('./utils/scraper-utils');

class Free3DNavigator {
  constructor() {
    this.browser = null;
    this.page = null;
    this.context = null;
  }

  /**
   * Initialize the browser and create a new page
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing Free3D Navigator...');
      
      // Launch browser with anti-detection settings
      this.browser = await chromium.launch({
        headless: config.browser.headless,
        slowMo: config.browser.slowMo,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      // Create browser context with anti-detection settings
      this.context = await this.browser.newContext({
        viewport: config.browser.viewport,
        userAgent: ScraperUtils.getRandomUserAgent(),
        locale: 'en-US',
        timezoneId: 'America/New_York'
      });

      // Create new page
      this.page = await this.context.newPage();

      // Set additional headers for better stealth
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      // Set timeout
      this.page.setDefaultTimeout(config.browser.timeout);

      // TASK 8: Initialize enhanced rate limiter
      await ScraperUtils.initializeRateLimiter(); // No proxies by default
      
      logger.info('✅ Browser and rate limiter initialized successfully');
      return true;

    } catch (error) {
      logger.error('❌ Failed to initialize browser', error);
      throw error;
    }
  }

  /**
   * Navigate to Free3D website and verify access
   */
  async navigateToFree3D() {
    try {
      logger.scrapingStart(config.site.baseUrl);
      
      // TASK 8: Apply rate limiting before navigation
      await ScraperUtils.randomDelay('request');
      
      // Navigate to Free3D
      await this.page.goto(config.site.baseUrl, { 
        waitUntil: 'networkidle',
        timeout: 60000 
      });

      // Wait for page to load completely with enhanced delays
      await this.page.waitForLoadState('domcontentloaded');
      await ScraperUtils.randomDelay('page'); // TASK 8: Page-specific delay

      // Verify we're on the correct site
      const title = await this.page.title();
      logger.info(`📄 Page loaded: ${title}`);

      // Check if we can access the site (not blocked)
      const isAccessible = await this.page.evaluate(() => {
        return !document.body.textContent.includes('Access Denied') && 
               !document.body.textContent.includes('Blocked') &&
               !document.body.textContent.includes('Captcha');
      });

      if (!isAccessible) {
        throw new Error('Site access appears to be blocked or requires CAPTCHA');
      }

      logger.info('✅ Successfully accessed Free3D website');
      return true;

    } catch (error) {
      logger.error('❌ Failed to navigate to Free3D', error);
      throw error;
    }
  }

  /**
   * Navigate to the free models section
   */
  async navigateToFreeModels() {
    try {
      logger.info('🔍 Navigating to free models section...');
      
      // TASK 8: Apply rate limiting before navigation
      await ScraperUtils.randomDelay('request');
      
      // Direct navigation to free models page
      const freeModelsUrl = config.site.freeModelsUrl;
      await this.page.goto(freeModelsUrl, { 
        waitUntil: 'networkidle',
        timeout: 60000 
      });

      // Wait for content to load with enhanced delays
      await this.page.waitForLoadState('domcontentloaded');
      await ScraperUtils.randomDelay('page'); // TASK 8: Page-specific delay

      // Verify we're on the free models page
      const currentUrl = this.page.url();
      logger.info(`📍 Current URL: ${currentUrl}`);

      // Check for model listings on the page
      const hasModels = await this.page.evaluate(() => {
        // Look for common model listing elements
        const modelElements = document.querySelectorAll([
          '.model-item',
          '.product-item', 
          '.grid-item',
          '[class*="model"]',
          '[class*="product"]',
          'article',
          '.card'
        ].join(','));
        
        return modelElements.length > 0;
      });

      if (!hasModels) {
        logger.warn('⚠️ No model listings found on the page');
      } else {
        logger.info('✅ Free models page loaded with model listings');
      }

      return true;

    } catch (error) {
      logger.error('❌ Failed to navigate to free models section', error);
      throw error;
    }
  }

  /**
   * Navigate specifically to .obj models
   */
  async navigateToObjModels() {
    try {
      logger.info('🎯 Filtering for .obj models...');
      
      // Navigate to .obj specific page
      const objModelsUrl = `${config.site.baseUrl}/3d-models/obj`;
      await this.page.goto(objModelsUrl, { 
        waitUntil: 'networkidle',
        timeout: 60000 
      });

      // Wait for content to load
      await this.page.waitForLoadState('domcontentloaded');
      await ScraperUtils.randomDelay();

      logger.info('✅ Navigated to .obj models section');
      return true;

    } catch (error) {
      logger.error('❌ Failed to navigate to .obj models', error);
      throw error;
    }
  }

  /**
   * Get page content and basic statistics
   */
  async getPageInfo() {
    try {
      const pageInfo = await this.page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          modelCount: document.querySelectorAll([
            '.model-item',
            '.product-item', 
            '.grid-item',
            '[class*="model"]',
            'article',
            '.card'
          ].join(',')).length,
          hasLoadMoreButton: !!document.querySelector([
            '[class*="load-more"]',
            '[class*="pagination"]',
            '.next',
            '[class*="show-more"]'
          ].join(',')),
          bodyText: document.body.textContent.substring(0, 500) + '...'
        };
      });

      logger.info('📊 Page Information:', pageInfo);
      return pageInfo;

    } catch (error) {
      logger.error('❌ Failed to get page info', error);
      throw error;
    }
  }

  /**
   * Handle pagination or infinite scroll
   */
  async loadMoreModels() {
    try {
      logger.info('📄 Attempting to load more models...');
      
      // Look for pagination or load more buttons
      const loadMoreButton = await this.page.$([
        '[class*="load-more"]',
        '[class*="show-more"]',
        '.pagination .next',
        'button:has-text("Load More")',
        'a:has-text("Next")'
      ].join(','));

      if (loadMoreButton) {
        await loadMoreButton.click();
        await this.page.waitForLoadState('networkidle');
        await ScraperUtils.randomDelay();
        logger.info('✅ Loaded more models');
        return true;
      } else {
        logger.info('ℹ️ No load more button found');
        return false;
      }

    } catch (error) {
      logger.warn('⚠️ Failed to load more models', error);
      return false;
    }
  }

  /**
   * Close the browser
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        logger.info('🔒 Browser closed successfully');
      }
    } catch (error) {
      logger.error('❌ Error closing browser', error);
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async takeScreenshot(filename = 'debug-screenshot.png') {
    try {
      const screenshotPath = `${config.paths.logs}/${filename}`;
      await this.page.screenshot({ 
        path: screenshotPath, 
        fullPage: true 
      });
      logger.info(`📸 Screenshot saved: ${screenshotPath}`);
      return screenshotPath;
    } catch (error) {
      logger.error('❌ Failed to take screenshot', error);
      return null;
    }
  }
}

module.exports = Free3DNavigator; 