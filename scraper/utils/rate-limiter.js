/**
 * TASK 8: Enhanced Rate Limiting and Anti-Detection System
 * Comprehensive rate limiting with human-like behavior simulation
 */

const logger = require('./logger');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

class RateLimiter {
  constructor() {
    // SUBTASK 8.1: Enhanced delay configuration (2-7 seconds)
    this.delayConfig = {
      minDelay: 2000,    // 2 seconds minimum
      maxDelay: 7000,    // 7 seconds maximum
      requestDelay: 3000, // Base request delay
      pageLoadDelay: 1500, // Additional delay after page loads
      clickDelay: 800,    // Delay after clicks
      scrollDelay: 1200   // Delay after scrolling
    };

    // SUBTASK 8.2: Proxy rotation system
    this.proxyPool = [];
    this.currentProxyIndex = 0;
    this.proxyRotationEnabled = false;
    this.proxyFailures = new Map(); // Track proxy failures

    // SUBTASK 8.3: Extensive User-Agent rotation
    this.userAgents = [
      // Chrome on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      
      // Chrome on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      
      // Chrome on Linux
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      
      // Firefox on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0',
      
      // Firefox on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:119.0) Gecko/20100101 Firefox/119.0',
      
      // Safari on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
      
      // Edge on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
      
      // Mobile browsers
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
      'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    ];

    // SUBTASK 8.4: Exponential backoff configuration
    this.backoffConfig = {
      maxRetries: 5,
      baseDelay: 1000,      // 1 second base
      maxDelay: 60000,      // 60 seconds maximum
      multiplier: 2,        // Exponential factor
      jitter: true          // Add randomness to delays
    };

    // SUBTASK 8.5: Error handling tracking
    this.errorStats = {
      rateLimited: 0,
      downloadFailures: 0,
      authRequired: 0,
      networkErrors: 0,
      totalRequests: 0,
      successfulRequests: 0
    };

    // Request timing tracking
    this.lastRequestTime = 0;
    this.requestHistory = [];
  }

  /**
   * SUBTASK 8.1: Generate human-like randomized delays (2-7 seconds)
   */
  async randomDelay(type = 'request') {
    let min, max;
    
    switch (type) {
      case 'request':
        min = this.delayConfig.minDelay;
        max = this.delayConfig.maxDelay;
        break;
      case 'page':
        min = this.delayConfig.pageLoadDelay;
        max = this.delayConfig.pageLoadDelay + 1000;
        break;
      case 'click':
        min = this.delayConfig.clickDelay;
        max = this.delayConfig.clickDelay + 500;
        break;
      case 'scroll':
        min = this.delayConfig.scrollDelay;
        max = this.delayConfig.scrollDelay + 800;
        break;
      default:
        min = this.delayConfig.minDelay;
        max = this.delayConfig.maxDelay;
    }

    // Generate human-like delay with slight bias toward middle values
    const range = max - min;
    const bias = 0.3; // Bias toward center
    let random = Math.random();
    
    // Apply bias to make delays more human-like
    if (random < bias) {
      random = 0.3 + (random / bias) * 0.4; // Center-biased
    }
    
    const delay = Math.floor(min + (random * range));
    
    logger.debug(`⏱️ Human-like delay: ${delay}ms (type: ${type})`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return delay;
  }

  /**
   * SUBTASK 8.1: Ensure minimum time between requests
   */
  async enforceRequestInterval() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = this.delayConfig.requestDelay;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      logger.debug(`⏱️ Enforcing request interval: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestHistory.push(this.lastRequestTime);

    // Keep only last 100 requests for analysis
    if (this.requestHistory.length > 100) {
      this.requestHistory.shift();
    }
  }

  /**
   * SUBTASK 8.2: Initialize proxy pool for rotation
   */
  async initializeProxyPool(proxies = []) {
    try {
      if (proxies.length === 0) {
        logger.info('⚡ No proxies provided, running in direct mode');
        this.proxyRotationEnabled = false;
        return;
      }

      logger.info(`🔄 Initializing proxy pool with ${proxies.length} proxies`);
      this.proxyPool = proxies.map(proxy => ({
        url: proxy,
        failures: 0,
        lastUsed: 0,
        active: true,
        agent: new HttpsProxyAgent(proxy)
      }));

      // Test each proxy
      await this.testProxyPool();
      
      const activeProxies = this.proxyPool.filter(p => p.active);
      if (activeProxies.length > 0) {
        this.proxyRotationEnabled = true;
        logger.info(`✅ Proxy rotation enabled with ${activeProxies.length} active proxies`);
      } else {
        logger.warn('⚠️ No working proxies found, running in direct mode');
        this.proxyRotationEnabled = false;
      }

    } catch (error) {
      logger.error('❌ Failed to initialize proxy pool:', error);
      this.proxyRotationEnabled = false;
    }
  }

  /**
   * SUBTASK 8.2: Test proxy pool connectivity
   */
  async testProxyPool() {
    logger.info('🧪 Testing proxy connectivity...');
    
    const testPromises = this.proxyPool.map(async (proxy, index) => {
      try {
        const response = await axios.get('https://httpbin.org/ip', {
          httpsAgent: proxy.agent,
          timeout: 10000,
          headers: { 'User-Agent': this.getRandomUserAgent() }
        });
        
        if (response.status === 200) {
          proxy.active = true;
          logger.debug(`✅ Proxy ${index + 1} working: ${response.data.origin}`);
        } else {
          proxy.active = false;
          logger.warn(`❌ Proxy ${index + 1} failed: status ${response.status}`);
        }
      } catch (error) {
        proxy.active = false;
        proxy.failures++;
        logger.warn(`❌ Proxy ${index + 1} failed: ${error.message}`);
      }
    });

    await Promise.all(testPromises);
  }

  /**
   * SUBTASK 8.2: Get next proxy for rotation
   */
  getNextProxy() {
    if (!this.proxyRotationEnabled || this.proxyPool.length === 0) {
      return null;
    }

    const activeProxies = this.proxyPool.filter(p => p.active);
    if (activeProxies.length === 0) {
      logger.warn('⚠️ No active proxies available');
      return null;
    }

    // Simple round-robin rotation
    const proxy = activeProxies[this.currentProxyIndex % activeProxies.length];
    this.currentProxyIndex++;
    proxy.lastUsed = Date.now();

    logger.debug(`🔄 Using proxy: ${proxy.url}`);
    return proxy;
  }

  /**
   * SUBTASK 8.3: Get random user agent with device diversity
   */
  getRandomUserAgent() {
    const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    logger.debug(`🎭 Using User-Agent: ${userAgent.substring(0, 50)}...`);
    return userAgent;
  }

  /**
   * SUBTASK 8.3: Get matching browser headers for user agent
   */
  getMatchingHeaders(userAgent) {
    const headers = {
      'User-Agent': userAgent,
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };

    // Customize based on browser type
    if (userAgent.includes('Chrome')) {
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
      headers['Sec-Fetch-Site'] = 'none';
      headers['Sec-Fetch-Mode'] = 'navigate';
      headers['Sec-Fetch-User'] = '?1';
      headers['Sec-Fetch-Dest'] = 'document';
    } else if (userAgent.includes('Firefox')) {
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
    } else if (userAgent.includes('Safari')) {
      headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    }

    return headers;
  }

  /**
   * SUBTASK 8.4: Exponential backoff with jitter for rate limit handling
   */
  async exponentialBackoff(attempt, error = null) {
    if (attempt >= this.backoffConfig.maxRetries) {
      throw new Error(`Max retries (${this.backoffConfig.maxRetries}) exceeded`);
    }

    let delay = this.backoffConfig.baseDelay * Math.pow(this.backoffConfig.multiplier, attempt);
    
    // Cap at maximum delay
    delay = Math.min(delay, this.backoffConfig.maxDelay);
    
    // Add jitter to avoid thundering herd
    if (this.backoffConfig.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    // Handle specific HTTP response codes
    if (error && error.response) {
      const status = error.response.status;
      
      if (status === 429) { // Too Many Requests
        this.errorStats.rateLimited++;
        
        // Check for Retry-After header
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
          const retryDelay = parseInt(retryAfter) * 1000; // Convert to milliseconds
          delay = Math.max(delay, retryDelay);
          logger.warn(`⏱️ Rate limited! Server requested ${retryAfter}s delay`);
        } else {
          logger.warn(`⏱️ Rate limited! Using exponential backoff: ${Math.round(delay)}ms`);
        }
      } else if (status >= 500) {
        logger.warn(`🔧 Server error ${status}, retrying with backoff: ${Math.round(delay)}ms`);
      }
    }

    logger.info(`⏳ Exponential backoff: attempt ${attempt + 1}, waiting ${Math.round(delay)}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return delay;
  }

  /**
   * SUBTASK 8.5: Enhanced error detection and handling
   */
  detectErrorType(error, url = '', content = '') {
    const errorInfo = {
      type: 'unknown',
      recoverable: true, // TASK 8: Allow retry for unknown errors
      skipModel: false,
      message: error.message || 'Unknown error'
    };

    // Network and timeout errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || 
        error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      errorInfo.type = 'network';
      errorInfo.recoverable = true;
      this.errorStats.networkErrors++;
    }
    
    // HTTP status code errors
    else if (error.response) {
      const status = error.response.status;
      
      if (status === 429) {
        errorInfo.type = 'rate_limit';
        errorInfo.recoverable = true;
      } else if (status === 401 || status === 403) {
        errorInfo.type = 'auth_required';
        errorInfo.skipModel = true;
        this.errorStats.authRequired++;
      } else if (status === 404) {
        errorInfo.type = 'not_found';
        errorInfo.skipModel = true;
      } else if (status >= 500) {
        errorInfo.type = 'server_error';
        errorInfo.recoverable = true;
      }
    }
    
    // Content-based error detection
    else if (content && (content.includes('login') || content.includes('sign in') || 
             content.includes('authentication required'))) {
      errorInfo.type = 'auth_required';
      errorInfo.skipModel = true;
      this.errorStats.authRequired++;
    }
    
    // Download-specific errors
    else if (url && url.includes('download') && errorInfo.message && (
             errorInfo.message.includes('File not found') ||
             errorInfo.message.includes('Access denied') ||
             errorInfo.message.includes('Premium required'))) {
      errorInfo.type = 'download_failed';
      errorInfo.skipModel = true;
      this.errorStats.downloadFailures++;
    }

    logger.debug(`🔍 Error analysis: ${errorInfo.type} (recoverable: ${errorInfo.recoverable}, skip: ${errorInfo.skipModel})`);
    return errorInfo;
  }

  /**
   * SUBTASK 8.5: Retry with comprehensive error handling
   */
  async retryWithErrorHandling(operation, context = {}) {
    let lastError = null;
    
    for (let attempt = 0; attempt < this.backoffConfig.maxRetries; attempt++) {
      try {
        this.errorStats.totalRequests++;
        
        // Ensure rate limiting between attempts
        if (attempt > 0) {
          await this.exponentialBackoff(attempt - 1, lastError);
        }
        
        // Always enforce request interval
        await this.enforceRequestInterval();
        
        // Add random delay for human-like behavior
        await this.randomDelay('request');
        
        // Execute the operation
        const result = await operation(attempt);
        
        this.errorStats.successfulRequests++;
        logger.debug(`✅ Operation succeeded on attempt ${attempt + 1}`);
        return result;
        
      } catch (error) {
        lastError = error;
        const errorInfo = this.detectErrorType(error, context.url, context.content);
        
        logger.warn(`❌ Attempt ${attempt + 1} failed: ${errorInfo.type} - ${errorInfo.message}`);
        
        // If error indicates we should skip this model, don't retry
        if (errorInfo.skipModel) {
          logger.info(`⏭️ Skipping model due to ${errorInfo.type}: ${context.modelName || 'unknown'}`);
          throw new Error(`SKIP_MODEL: ${errorInfo.type} - ${errorInfo.message}`);
        }
        
        // If error is not recoverable, don't retry
        if (!errorInfo.recoverable && attempt === 0) {
          logger.error(`💥 Non-recoverable error: ${errorInfo.type}`);
          throw error;
        }
        
        // On final attempt, throw the error
        if (attempt === this.backoffConfig.maxRetries - 1) {
          logger.error(`💥 All retry attempts exhausted for ${errorInfo.type}`);
          throw error;
        }
      }
    }
  }

  /**
   * Get rate limiting statistics
   */
  getStats() {
    const totalErrors = this.errorStats.rateLimited + this.errorStats.downloadFailures + 
                       this.errorStats.authRequired + this.errorStats.networkErrors;
    
    return {
      ...this.errorStats,
      totalErrors,
      successRate: this.errorStats.totalRequests > 0 ? 
        (this.errorStats.successfulRequests / this.errorStats.totalRequests * 100).toFixed(1) : 0,
      avgRequestInterval: this.getAverageRequestInterval(),
      proxyStats: {
        enabled: this.proxyRotationEnabled,
        totalProxies: this.proxyPool.length,
        activeProxies: this.proxyPool.filter(p => p.active).length
      }
    };
  }

  /**
   * Calculate average request interval
   */
  getAverageRequestInterval() {
    if (this.requestHistory.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < this.requestHistory.length; i++) {
      intervals.push(this.requestHistory[i] - this.requestHistory[i - 1]);
    }
    
    return Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.errorStats = {
      rateLimited: 0,
      downloadFailures: 0,
      authRequired: 0,
      networkErrors: 0,
      totalRequests: 0,
      successfulRequests: 0
    };
    this.requestHistory = [];
    logger.info('📊 Rate limiter statistics reset');
  }
}

module.exports = RateLimiter; 