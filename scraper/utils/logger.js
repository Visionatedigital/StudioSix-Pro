const fs = require('fs-extra');
const path = require('path');
const config = require('../config/scraper-config');

class Logger {
  constructor() {
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    this.currentLevel = this.logLevels[config.logging.level] || 1;
    this.logFile = path.join(config.paths.logs, `scraper-${new Date().toISOString().split('T')[0]}.log`);
    
    // Ensure log directory exists
    fs.ensureDirSync(config.paths.logs);
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    let formattedMessage = `${prefix} ${message}`;
    
    if (data) {
      formattedMessage += `\nData: ${JSON.stringify(data, null, 2)}`;
    }
    
    return formattedMessage;
  }

  log(level, message, data = null) {
    if (this.logLevels[level] < this.currentLevel) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, data);

    // Console logging with colors
    if (config.logging.logToConsole) {
      const colors = {
        debug: '\x1b[36m',  // Cyan
        info: '\x1b[32m',   // Green
        warn: '\x1b[33m',   // Yellow
        error: '\x1b[31m'   // Red
      };
      const reset = '\x1b[0m';
      
      console.log(`${colors[level]}${formattedMessage}${reset}`);
    }

    // File logging
    if (config.logging.logToFile) {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    }
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  // Special methods for scraping activities
  scrapingStart(url) {
    this.info(`🚀 Starting scraping session for: ${url}`);
  }

  scrapingEnd(stats) {
    this.info(`✅ Scraping session completed`, stats);
  }

  modelFound(modelName, url) {
    this.info(`📦 Found model: ${modelName}`, { url });
  }

  downloadStart(filename, url) {
    this.info(`⬇️ Starting download: ${filename}`, { url });
  }

  downloadComplete(filename, size) {
    this.info(`✅ Download complete: ${filename} (${this.formatFileSize(size)})`);
  }

  downloadError(filename, error) {
    this.error(`❌ Download failed: ${filename}`, { error: error.message });
  }

  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger; 