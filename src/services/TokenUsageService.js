/**
 * Token Usage Service for StudioSix
 * 
 * Provides precise token usage tracking and cost calculation
 * for all AI operations including chat, rendering, and BIM processing.
 */

import subscriptionService from './SubscriptionService';

class TokenUsageService {
  constructor() {
    this.storageKey = 'studiosix_token_usage';
    this.currentUserId = null;
    this.usageChangeListeners = new Set();
    
    // Initialize auth listener
    this.initAuthListener();
    
    // Token cost models for accurate billing
    this.tokenCosts = {
      // AI Model token costs (based on actual API costs)
      models: {
        'gpt-3.5-turbo': {
          inputTokenCost: 0.001,    // $0.001 per 1K tokens
          outputTokenCost: 0.002,   // $0.002 per 1K tokens
          baseUnits: 1              // 1 unit per token
        },
        'gpt-4': {
          inputTokenCost: 0.03,     // $0.03 per 1K tokens
          outputTokenCost: 0.06,    // $0.06 per 1K tokens  
          baseUnits: 3              // 3x cost multiplier
        },
        'claude-3.5-sonnet': {
          inputTokenCost: 0.003,    // $0.003 per 1K tokens
          outputTokenCost: 0.015,   // $0.015 per 1K tokens
          baseUnits: 2              // 2x cost multiplier
        }
      },
      
      // Image generation costs (converted to token equivalents)
      imageGeneration: {
        '512x512': {
          cost: 0.016,              // ~$0.016 per image (DALL-E 2)
          tokenEquivalent: 100      // = 100 tokens
        },
        '768x768': {
          cost: 0.032,              // Higher res costs more
          tokenEquivalent: 200      // = 200 tokens
        },
        '1024x1024': {
          cost: 0.040,              // $0.04 per image (DALL-E 3)
          tokenEquivalent: 300      // = 300 tokens
        },
        '2048x2048': {
          cost: 0.080,              // Premium quality
          tokenEquivalent: 500      // = 500 tokens
        }
      },
      
      // BIM processing costs (computational complexity)
      bimOperations: {
        'ifc_export': {
          cost: 0.02,               // Processing cost
          tokenEquivalent: 50       // = 50 tokens
        },
        'dwg_export': {
          cost: 0.03,               // More complex
          tokenEquivalent: 75       // = 75 tokens
        },
        'rvt_export': {
          cost: 0.04,               // Most complex
          tokenEquivalent: 100      // = 100 tokens
        }
      }
    };
    
    // Load usage data
    this.loadUsageData();
  }

  /**
   * Initialize authentication listener
   */
  initAuthListener() {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('auth-state-change', (event) => {
      const { user } = event.detail || {};
      this.handleUserChange(user);
    });
    
    this.getCurrentUser();
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser() {
    try {
      const manualAuthUser = localStorage.getItem('studiosix_manual_auth_user');
      if (manualAuthUser) {
        const user = JSON.parse(manualAuthUser);
        this.handleUserChange(user);
        return user;
      }
      
      const supabaseSession = localStorage.getItem('sb-studiosix-auth-token');
      if (supabaseSession) {
        try {
          const session = JSON.parse(supabaseSession);
          if (session?.user) {
            this.handleUserChange(session.user);
            return session.user;
          }
        } catch (e) {}
      }
    } catch (error) {
      console.warn('Failed to get current user:', error);
    }
    
    this.handleUserChange(null);
    return null;
  }

  /**
   * Handle user change
   */
  handleUserChange(user) {
    const newUserId = user?.id || user?.email || null;
    
    if (newUserId !== this.currentUserId) {
      console.log('📊 Token Usage: User changed from', this.currentUserId, 'to', newUserId);
      this.currentUserId = newUserId;
      this.loadUsageData();
      this.notifyUsageChange();
    }
  }

  /**
   * Get user-specific storage key
   */
  getUserStorageKey() {
    if (this.currentUserId) {
      return `${this.storageKey}_${this.currentUserId}`;
    }
    return `${this.storageKey}_anonymous`;
  }

  /**
   * Load usage data from storage
   */
  loadUsageData() {
    try {
      const storageKey = this.getUserStorageKey();
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        this.usage = JSON.parse(stored);
        this.resetMonthlyUsageIfNeeded();
      } else {
        this.usage = this.createDefaultUsage();
        this.saveUsageData();
      }
    } catch (error) {
      console.warn('Failed to load token usage data:', error);
      this.usage = this.createDefaultUsage();
    }
  }

  /**
   * Create default usage structure
   */
  createDefaultUsage() {
    const now = new Date();
    
    return {
      userId: this.currentUserId,
      createdAt: now.toISOString(),
      
      // Current month usage
      currentMonth: {
        year: now.getFullYear(),
        month: now.getMonth(),
        aiTokens: 0,
        imageRenders: 0,
        bimOperations: 0,
        totalCost: 0
      },
      
      // Daily usage tracking
      daily: {
        [now.toDateString()]: {
          aiTokens: 0,
          imageRenders: 0,
          bimOperations: 0,
          totalCost: 0
        }
      },
      
      // Session usage (resets on app reload)
      session: {
        aiTokens: 0,
        imageRenders: 0, 
        bimOperations: 0,
        totalCost: 0,
        startedAt: now.toISOString()
      },
      
      // All-time totals
      lifetime: {
        aiTokens: 0,
        imageRenders: 0,
        bimOperations: 0,
        totalCost: 0,
        firstUsage: now.toISOString()
      },
      
      // Detailed operation logs (last 100 operations)
      operations: []
    };
  }

  /**
   * Reset monthly usage if new month
   */
  resetMonthlyUsageIfNeeded() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    if (this.usage.currentMonth.year !== currentYear || 
        this.usage.currentMonth.month !== currentMonth) {
      
      console.log('📊 Resetting monthly usage for new month:', currentYear, currentMonth);
      
      this.usage.currentMonth = {
        year: currentYear,
        month: currentMonth,
        aiTokens: 0,
        imageRenders: 0,
        bimOperations: 0,
        totalCost: 0
      };
      
      this.saveUsageData();
    }
  }

  /**
   * Save usage data to storage
   */
  saveUsageData() {
    try {
      const storageKey = this.getUserStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(this.usage));
    } catch (error) {
      console.error('Failed to save token usage data:', error);
    }
  }

  /**
   * Calculate precise token cost for AI request
   */
  calculateAITokenCost(model, inputTokens, outputTokens) {
    const modelCost = this.tokenCosts.models[model];
    if (!modelCost) {
      console.warn(`Unknown model for cost calculation: ${model}`);
      return { tokens: inputTokens + outputTokens, cost: 0, units: 1 };
    }
    
    const inputCost = (inputTokens / 1000) * modelCost.inputTokenCost;
    const outputCost = (outputTokens / 1000) * modelCost.outputTokenCost;
    const totalCost = inputCost + outputCost;
    const totalTokens = inputTokens + outputTokens;
    const units = totalTokens * modelCost.baseUnits;
    
    return {
      tokens: totalTokens,
      cost: totalCost,
      units: Math.ceil(units), // Round up for billing
      breakdown: {
        inputTokens,
        outputTokens,
        inputCost,
        outputCost,
        model
      }
    };
  }

  /**
   * Calculate image generation cost
   */
  calculateImageCost(resolution, format = 'jpg') {
    const imageCost = this.tokenCosts.imageGeneration[resolution];
    if (!imageCost) {
      console.warn(`Unknown resolution for cost calculation: ${resolution}`);
      return { cost: 0, units: 100 }; // Default fallback
    }
    
    // Format modifiers
    let formatMultiplier = 1;
    if (format === 'png-transparent') formatMultiplier = 1.2;
    if (format === 'tiff') formatMultiplier = 1.5;
    if (format === 'exr') formatMultiplier = 2;
    
    return {
      cost: imageCost.cost * formatMultiplier,
      units: Math.ceil(imageCost.tokenEquivalent * formatMultiplier),
      resolution,
      format
    };
  }

  /**
   * Calculate BIM operation cost  
   */
  calculateBIMCost(operation) {
    const bimCost = this.tokenCosts.bimOperations[operation];
    if (!bimCost) {
      console.warn(`Unknown BIM operation for cost calculation: ${operation}`);
      return { cost: 0, units: 50 }; // Default fallback
    }
    
    return {
      cost: bimCost.cost,
      units: bimCost.tokenEquivalent,
      operation
    };
  }

  /**
   * Record AI chat usage
   */
  recordAIUsage(model, inputTokens, outputTokens, metadata = {}) {
    const cost = this.calculateAITokenCost(model, inputTokens, outputTokens);
    const now = new Date();
    const today = now.toDateString();
    
    // Update usage counters
    this.usage.currentMonth.aiTokens += cost.units;
    this.usage.currentMonth.totalCost += cost.cost;
    
    this.usage.session.aiTokens += cost.units;
    this.usage.session.totalCost += cost.cost;
    
    this.usage.lifetime.aiTokens += cost.units;
    this.usage.lifetime.totalCost += cost.cost;
    
    // Daily tracking
    if (!this.usage.daily[today]) {
      this.usage.daily[today] = { aiTokens: 0, imageRenders: 0, bimOperations: 0, totalCost: 0 };
    }
    this.usage.daily[today].aiTokens += cost.units;
    this.usage.daily[today].totalCost += cost.cost;
    
    // Log operation
    this.logOperation('ai_chat', {
      model,
      inputTokens,
      outputTokens,
      cost: cost.cost,
      units: cost.units,
      metadata
    });
    
    // Update subscription usage
    subscriptionService.recordUsage('ai_chat', {
      model,
      tokens: cost.units
    });
    
    this.saveUsageData();
    this.notifyUsageChange();
    
    return cost;
  }

  /**
   * Record image render usage
   */
  recordImageUsage(resolution, format = 'jpg', metadata = {}) {
    const cost = this.calculateImageCost(resolution, format);
    const now = new Date();
    const today = now.toDateString();
    
    // Update usage counters  
    this.usage.currentMonth.imageRenders += 1;
    this.usage.currentMonth.totalCost += cost.cost;
    
    this.usage.session.imageRenders += 1;
    this.usage.session.totalCost += cost.cost;
    
    this.usage.lifetime.imageRenders += 1;
    this.usage.lifetime.totalCost += cost.cost;
    
    // Daily tracking
    if (!this.usage.daily[today]) {
      this.usage.daily[today] = { aiTokens: 0, imageRenders: 0, bimOperations: 0, totalCost: 0 };
    }
    this.usage.daily[today].imageRenders += 1;
    this.usage.daily[today].totalCost += cost.cost;
    
    // Log operation
    this.logOperation('image_render', {
      resolution,
      format,
      cost: cost.cost,
      units: cost.units,
      metadata
    });
    
    // Update subscription usage
    subscriptionService.recordUsage('image_render');
    
    this.saveUsageData();
    this.notifyUsageChange();
    
    return cost;
  }

  /**
   * Record BIM operation usage
   */
  recordBIMUsage(operation, metadata = {}) {
    const cost = this.calculateBIMCost(operation);
    const now = new Date();
    const today = now.toDateString();
    
    // Update usage counters
    this.usage.currentMonth.bimOperations += 1;
    this.usage.currentMonth.totalCost += cost.cost;
    
    this.usage.session.bimOperations += 1;
    this.usage.session.totalCost += cost.cost;
    
    this.usage.lifetime.bimOperations += 1;
    this.usage.lifetime.totalCost += cost.cost;
    
    // Daily tracking
    if (!this.usage.daily[today]) {
      this.usage.daily[today] = { aiTokens: 0, imageRenders: 0, bimOperations: 0, totalCost: 0 };
    }
    this.usage.daily[today].bimOperations += 1;
    this.usage.daily[today].totalCost += cost.cost;
    
    // Log operation
    this.logOperation('bim_operation', {
      operation,
      cost: cost.cost,
      units: cost.units,
      metadata
    });
    
    this.saveUsageData();
    this.notifyUsageChange();
    
    return cost;
  }

  /**
   * Log individual operation
   */
  logOperation(type, details) {
    const operation = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      type,
      timestamp: new Date().toISOString(),
      userId: this.currentUserId,
      ...details
    };
    
    this.usage.operations.unshift(operation);
    
    // Keep only last 100 operations to prevent storage bloat
    if (this.usage.operations.length > 100) {
      this.usage.operations = this.usage.operations.slice(0, 100);
    }
  }

  /**
   * Get current usage statistics
   */
  getUsageStats() {
    return {
      currentMonth: { ...this.usage.currentMonth },
      session: { ...this.usage.session },
      lifetime: { ...this.usage.lifetime },
      today: this.usage.daily[new Date().toDateString()] || 
             { aiTokens: 0, imageRenders: 0, bimOperations: 0, totalCost: 0 }
    };
  }

  /**
   * Get usage history for specific period
   */
  getUsageHistory(days = 30) {
    const history = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      
      history.push({
        date: dateStr,
        usage: this.usage.daily[dateStr] || 
               { aiTokens: 0, imageRenders: 0, bimOperations: 0, totalCost: 0 }
      });
    }
    
    return history.reverse();
  }

  /**
   * Get recent operations log
   */
  getRecentOperations(limit = 20) {
    return this.usage.operations.slice(0, limit);
  }

  /**
   * Check if usage is approaching limits
   */
  getUsageWarnings() {
    const subscription = subscriptionService.getSubscription();
    const tier = subscriptionService.getCurrentTier();
    const warnings = [];
    
    // Check AI token limit
    const tokenUsagePercent = tier.limits.aiTokensPerMonth > 0 ?
      (subscription.usage.aiTokensThisMonth / tier.limits.aiTokensPerMonth) * 100 : 0;
    
    if (tokenUsagePercent > 90) {
      warnings.push({
        type: 'ai_tokens',
        level: 'critical',
        message: 'You\'ve used 90% of your AI tokens this month',
        remaining: tier.limits.aiTokensPerMonth - subscription.usage.aiTokensThisMonth
      });
    } else if (tokenUsagePercent > 75) {
      warnings.push({
        type: 'ai_tokens', 
        level: 'warning',
        message: 'You\'ve used 75% of your AI tokens this month',
        remaining: tier.limits.aiTokensPerMonth - subscription.usage.aiTokensThisMonth
      });
    }
    
    // Check render limit
    const renderUsagePercent = tier.limits.imageRendersPerMonth > 0 ?
      (subscription.usage.imageRendersThisMonth / tier.limits.imageRendersPerMonth) * 100 : 0;
    
    if (renderUsagePercent > 90) {
      warnings.push({
        type: 'image_renders',
        level: 'critical', 
        message: 'You\'ve used 90% of your image renders this month',
        remaining: tier.limits.imageRendersPerMonth - subscription.usage.imageRendersThisMonth
      });
    } else if (renderUsagePercent > 75) {
      warnings.push({
        type: 'image_renders',
        level: 'warning',
        message: 'You\'ve used 75% of your image renders this month', 
        remaining: tier.limits.imageRendersPerMonth - subscription.usage.imageRendersThisMonth
      });
    }
    
    return warnings;
  }

  /**
   * Get projected monthly cost
   */
  getProjectedMonthlyCost() {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const costSoFar = this.usage.currentMonth.totalCost;
    
    if (daysElapsed === 0) return 0;
    
    const dailyAverage = costSoFar / daysElapsed;
    return dailyAverage * daysInMonth;
  }

  /**
   * Listen for usage changes
   */
  onUsageChange(listener) {
    this.usageChangeListeners.add(listener);
    return () => this.usageChangeListeners.delete(listener);
  }

  /**
   * Notify usage change listeners
   */
  notifyUsageChange() {
    this.usageChangeListeners.forEach(listener => {
      try {
        listener(this.usage);
      } catch (error) {
        console.error('Error in usage change listener:', error);
      }
    });
  }

  /**
   * Reset session usage
   */
  resetSessionUsage() {
    this.usage.session = {
      aiTokens: 0,
      imageRenders: 0,
      bimOperations: 0,
      totalCost: 0,
      startedAt: new Date().toISOString()
    };
    
    this.saveUsageData();
    this.notifyUsageChange();
  }

  /**
   * Get detailed usage info for debugging
   */
  getUsageInfo() {
    return {
      currentUserId: this.currentUserId,
      storageKey: this.getUserStorageKey(),
      usage: this.usage,
      warnings: this.getUsageWarnings(),
      projectedCost: this.getProjectedMonthlyCost()
    };
  }
}

// Export singleton instance
const tokenUsageService = new TokenUsageService();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.tokenUsageService = tokenUsageService;
  console.log('📊 Token Usage Service available at window.tokenUsageService');
}

export default tokenUsageService;