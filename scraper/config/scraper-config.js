const path = require('path');

const config = {
  // Free3D website configuration
  site: {
    baseUrl: 'https://free3d.com',
    freeModelsUrl: 'https://free3d.com/3d-models/free',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },

  // Browser configuration
  browser: {
    headless: true,
    slowMo: 100, // Add delay between actions (ms)
    timeout: 30000, // 30 seconds timeout
    viewport: {
      width: 1920,
      height: 1080
    }
  },

  // TASK 8: Enhanced Anti-detection measures
  antiDetection: {
    // SUBTASK 8.1: Enhanced randomized delays (2-7 seconds)
    minDelay: 2000,    // 2 seconds minimum
    maxDelay: 7000,    // 7 seconds maximum
    
    // Page interaction delays
    clickDelay: 800,
    scrollDelay: 1200,
    
    // Request delays
    requestInterval: 3000, // 3 seconds between requests
    
    // SUBTASK 8.2: Proxy rotation configuration
    proxy: {
      enabled: false, // Set to true when proxies are available
      rotationInterval: 10, // Change proxy every N requests
      maxFailures: 3, // Max failures before disabling proxy
      testUrl: 'https://httpbin.org/ip' // URL for testing proxy connectivity
    },
    
    // SUBTASK 8.3: Extensive user agent rotation (moved to RateLimiter)
    userAgentRotation: {
      enabled: true,
      includeDesktop: true,
      includeMobile: true,
      browserTypes: ['chrome', 'firefox', 'safari', 'edge']
    },
    
    // SUBTASK 8.4: Enhanced exponential backoff
    exponentialBackoff: {
      enabled: true,
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 60000,
      multiplier: 2,
      jitter: true
    }
  },

  // File paths
  paths: {
    models: path.join(__dirname, '../models'),
    logs: path.join(__dirname, '../logs'),
    metadata: path.join(__dirname, '../models/metadata.json')
  },

  // Scraping limits
  limits: {
    maxModelsPerSession: 10,  // Start small for testing
    maxConcurrentDownloads: 3,
    maxRetries: 5, // TASK 8: Increased for better resilience
    maxFileSize: 50 * 1024 * 1024,  // 50MB max file size
    
    // SUBTASK 8.5: Enhanced error handling limits
    maxConsecutiveFailures: 5, // Stop after N consecutive failures
    maxAuthRequiredSkips: 10,  // Max models requiring auth to skip
    maxDownloadFailures: 15,   // Max download failures before stopping
    errorThreshold: 0.3,       // Stop if error rate exceeds 30%
    cooldownPeriod: 300000     // 5 min cooldown after hitting limits
  },

  // File types to download
  fileTypes: {
    models: ['.obj', '.mtl'],
    textures: ['.jpg', '.jpeg', '.png', '.bmp'],
    archives: ['.zip', '.rar', '.7z']
  },

  // Logging configuration
  logging: {
    level: 'info', // 'debug', 'info', 'warn', 'error'
    logToFile: true,
    logToConsole: true
  }
};

module.exports = config; 