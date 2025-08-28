#!/usr/bin/env node

/**
 * ChatGPT Cookie Manager
 * 
 * A standalone script to manage ChatGPT login cookies for the AI render system.
 * Run this script whenever your ChatGPT cookies expire to update them.
 * 
 * Usage:
 *   node chatgpt-cookie-manager.js
 * 
 * The script will:
 * 1. Open a browser window to ChatGPT
 * 2. Wait for you to log in manually
 * 3. Save the cookies to chatgpt-cookies.json
 * 4. Display cookie expiration info
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class ChatGPTCookieManager {
  constructor() {
    this.cookiesPath = path.join(__dirname, 'chatgpt-cookies.json');
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Display current cookie status
   */
  displayCookieStatus() {
    console.log('\n🍪 ChatGPT Cookie Manager');
    console.log('========================');
    
    if (fs.existsSync(this.cookiesPath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf8'));
        console.log(`✅ Cookies file found: ${this.cookiesPath}`);
        console.log(`📊 Number of cookies: ${cookies.length}`);
        
        // Find session-related cookies and their expiration
        const sessionCookies = cookies.filter(cookie => 
          cookie.name.includes('session') || 
          cookie.name.includes('auth') || 
          cookie.name.includes('token') ||
          cookie.domain.includes('openai.com')
        );
        
        if (sessionCookies.length > 0) {
          console.log('\n🔑 Session cookies found:');
          sessionCookies.forEach(cookie => {
            const expires = cookie.expires ? new Date(cookie.expires * 1000) : 'Session only';
            const isExpired = cookie.expires && cookie.expires * 1000 < Date.now();
            const status = isExpired ? '❌ EXPIRED' : '✅ Valid';
            console.log(`   ${cookie.name}: ${status} (expires: ${expires})`);
          });
        }
        
        const oldestExpiry = Math.min(...cookies.filter(c => c.expires).map(c => c.expires * 1000));
        if (oldestExpiry !== Infinity) {
          const daysUntilExpiry = Math.ceil((oldestExpiry - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry > 0) {
            console.log(`\n⏰ Cookies expire in: ${daysUntilExpiry} days`);
          } else {
            console.log(`\n⚠️  Some cookies have expired! Run this script to refresh them.`);
          }
        }
        
      } catch (error) {
        console.log(`❌ Error reading cookies file: ${error.message}`);
      }
    } else {
      console.log(`❌ No cookies file found at: ${this.cookiesPath}`);
      console.log(`   Run this script to create initial cookies.`);
    }
  }

  /**
   * Initialize browser with existing cookies (if any)
   */
  async initializeBrowser() {
    console.log('\n🚀 Launching browser...');
    
    this.browser = await chromium.launch({
      headless: false, // Always visible for manual login
      slowMo: 50,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // Hide automation
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=site-per-process',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-networking',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    });

    // Load existing cookies if available
    if (fs.existsSync(this.cookiesPath)) {
      try {
        console.log('🍪 Loading existing cookies...');
        const cookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf8'));
        await this.context.addCookies(cookies);
        console.log('✅ Existing cookies loaded');
      } catch (error) {
        console.log(`⚠️  Could not load existing cookies: ${error.message}`);
      }
    }

    this.page = await this.context.newPage();

    // Add anti-detection scripts
    await this.page.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: function() {
          return [
            { name: 'Chrome PDF Plugin' },
            { name: 'Chrome PDF Viewer' },
            { name: 'Native Client' }
          ];
        },
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Pass the permissions test
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Mock chrome runtime
      window.chrome = {
        runtime: {},
      };
    });
  }

  /**
   * Navigate to ChatGPT and handle login flow
   */
  async navigateAndLogin() {
    console.log('\n🌐 Navigating to ChatGPT...');
    
    // Enhanced navigation with Cloudflare bypass
    let navigationSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!navigationSuccess && attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Navigation attempt ${attempts}/${maxAttempts}`);
      
      try {
        const response = await this.page.goto('https://chat.openai.com', { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });

        // Check if we got a Cloudflare challenge
        const title = await this.page.title();
        const url = this.page.url();
        
        console.log(`📄 Page title: ${title}`);
        console.log(`🔗 Current URL: ${url}`);

        if (title.includes('Just a moment') || title.includes('Checking your browser') || url.includes('challenges.cloudflare.com')) {
          console.log('🛡️ Cloudflare challenge detected, waiting for bypass...');
          
          // Wait for Cloudflare challenge to complete
          await this.page.waitForFunction(
            () => !document.title.includes('Just a moment') && !document.title.includes('Checking your browser'),
            { timeout: 30000 }
          );
          
          // Additional wait for redirect
          await this.page.waitForTimeout(5000);
          
          // Check if we're now on ChatGPT
          if (this.page.url().includes('chat.openai.com') && !this.page.url().includes('challenges')) {
            console.log('✅ Cloudflare challenge bypassed successfully');
            navigationSuccess = true;
          } else {
            console.log(`⚠️ Still not on ChatGPT: ${this.page.url()}`);
          }
        } else if (url.includes('chat.openai.com')) {
          console.log('✅ Successfully navigated to ChatGPT');
          navigationSuccess = true;
        } else {
          console.log(`⚠️ Unexpected page: ${url}`);
        }

      } catch (error) {
        console.log(`❌ Navigation attempt ${attempts} failed: ${error.message}`);
        if (attempts < maxAttempts) {
          console.log('⏳ Waiting before retry...');
          await this.page.waitForTimeout(5000 + (attempts * 2000));
        }
      }
    }

    if (!navigationSuccess) {
      throw new Error('Failed to navigate to ChatGPT after multiple attempts. Cloudflare may be blocking the request.');
    }

    // Wait for page to stabilize
    await this.page.waitForTimeout(5000);

    // Check current login status
    const isLoggedIn = await this.checkLoginStatus();
    
    if (isLoggedIn) {
      console.log('✅ Already logged in to ChatGPT!');
      return true;
    }

    console.log('\n🔐 Login required. Please log in manually in the browser window.');
    console.log('   1. Click "Log in" button');
    console.log('   2. Enter your credentials');
    console.log('   3. Complete any 2FA/verification');
    console.log('   4. Wait for the chat interface to load');
    console.log('\n⏳ Waiting for login to complete...');

    // Wait for successful login (timeout after 5 minutes)
    const loginSuccess = await this.waitForLogin(300000); // 5 minutes
    
    if (!loginSuccess) {
      throw new Error('Login timeout - please try again');
    }

    console.log('✅ Login successful!');
    return true;
  }

  /**
   * Check if user is currently logged in
   */
  async checkLoginStatus() {
    // Look for chat interface elements that indicate successful login
    const chatElements = [
      '[data-testid="send-button"]',
      'textarea[placeholder*="Message"]',
      '.ProseMirror',
      'text=New chat',
      '[data-testid="conversation-turn"]'
    ];

    for (const selector of chatElements) {
      try {
        const element = await this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          return true;
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    return false;
  }

  /**
   * Wait for login to complete
   */
  async waitForLogin(timeout = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const isLoggedIn = await this.checkLoginStatus();
      
      if (isLoggedIn) {
        return true;
      }

      // Check every 2 seconds
      await this.page.waitForTimeout(2000);
      
      // Show progress every 30 seconds
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed > 0 && elapsed % 30 === 0) {
        const remaining = Math.floor((timeout - (Date.now() - startTime)) / 1000);
        console.log(`⏳ Still waiting for login... (${remaining}s remaining)`);
      }
    }

    return false;
  }

  /**
   * Save current cookies
   */
  async saveCookies() {
    console.log('\n💾 Saving cookies...');
    
    try {
      const cookies = await this.context.cookies();
      
      // Filter to only OpenAI-related cookies for security
      const openaiCookies = cookies.filter(cookie => 
        cookie.domain.includes('openai.com') || 
        cookie.domain.includes('chatgpt.com')
      );
      
      fs.writeFileSync(this.cookiesPath, JSON.stringify(openaiCookies, null, 2));
      
      console.log(`✅ Saved ${openaiCookies.length} cookies to: ${this.cookiesPath}`);
      
      // Display expiration info
      const sessionCookies = openaiCookies.filter(cookie => 
        cookie.name.includes('session') || 
        cookie.name.includes('auth') || 
        cookie.name.includes('token')
      );
      
      if (sessionCookies.length > 0) {
        console.log('\n🔑 Session cookies saved:');
        sessionCookies.forEach(cookie => {
          const expires = cookie.expires ? new Date(cookie.expires * 1000) : 'Session only';
          console.log(`   ${cookie.name}: expires ${expires}`);
        });
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error saving cookies: ${error.message}`);
      return false;
    }
  }

  /**
   * Test the saved cookies by making a quick verification
   */
  async testCookies() {
    console.log('\n🧪 Testing saved cookies...');
    
    // Open a new page with the saved cookies
    const testPage = await this.context.newPage();
    await testPage.goto('https://chat.openai.com', { waitUntil: 'networkidle' });
    await testPage.waitForTimeout(3000);
    
    const isWorking = await this.checkLoginStatus();
    
    if (isWorking) {
      console.log('✅ Cookies are working correctly!');
      console.log('   The AI render system should now work without manual login.');
    } else {
      console.log('⚠️  Cookies may not be working properly.');
      console.log('   You may need to log in again when using AI render.');
    }
    
    await testPage.close();
    return isWorking;
  }

  /**
   * Cleanup browser resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Main execution flow
   */
  async run() {
    try {
      // Show current status
      this.displayCookieStatus();
      
      // Ask user if they want to continue
      console.log('\n❓ Do you want to update/refresh your ChatGPT cookies?');
      console.log('   Press Ctrl+C to cancel, or Enter to continue...');
      
      // Wait for user input (simplified - just proceed)
      await new Promise(resolve => {
        process.stdin.once('data', resolve);
      });
      
      // Initialize browser
      await this.initializeBrowser();
      
      // Navigate and handle login
      await this.navigateAndLogin();
      
      // Save cookies
      const saveSuccess = await this.saveCookies();
      
      if (saveSuccess) {
        // Test the cookies
        await this.testCookies();
        
        console.log('\n🎉 Cookie management complete!');
        console.log('   Your ChatGPT cookies have been updated and saved.');
        console.log('   The AI render system will now use these cookies automatically.');
      }
      
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// CLI interface
if (require.main === module) {
  const manager = new ChatGPTCookieManager();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await manager.cleanup();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Shutting down...');
    await manager.cleanup();
    process.exit(0);
  });
  
  // Run the manager
  manager.run().then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  }).catch((error) => {
    console.error(`\n❌ Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = ChatGPTCookieManager;
