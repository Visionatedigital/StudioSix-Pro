/**
 * Subscription Service for StudioSix
 * 
 * Manages user subscription tiers, limits, and monetization logic.
 * Enforces usage limits based on subscription plans.
 * Integrates with database for persistent subscription tracking.
 */

import userDatabaseService from './UserDatabaseService';

class SubscriptionService {
  constructor() {
    this.storageKey = 'studiosix_subscription';
    this.currentUserId = null;
    this.subscriptionChangeListeners = new Set();
    this.databaseProfile = null;
    this.profileCache = new Map();
    this.cacheExpiry = 2 * 60 * 1000; // 2 minutes
    
    // Initialize auth listener
    this.initAuthListener();
    
    // Initialize database service
    userDatabaseService.initialize();
    
    // Define subscription tiers with exact limits from requirements
    this.tiers = {
      free: {
        id: 'free',
        name: 'Free Tier — Starter Plan',
        price: 0,
        currency: 'USD',
        period: 'month',
        description: 'Best for students, hobbyists, and new users',
        limits: {
          // AI Chat limits
          aiTokensPerMonth: 5000,           // 5K tokens/month
          // Render limits  
          imageRendersPerMonth: 20,         // 20 renders/month
          maxImageResolution: '512x512',    // Up to 512px
          imageFormats: ['jpg'],            // Low-res JPG only
          // Model access
          availableModels: ['gpt-3.5-turbo'], // Basic model only
          availableRenderModels: ['sdxl-base'], // Basic SDXL
          // Feature limits
          maxProjectSize: 1,                // 1 project
          cloudStorage: 0,                  // No cloud storage
          teamSeats: 1,                     // Individual only
          support: 'community',             // Community support
          // Tool restrictions
          restrictedTools: ['advanced-stairs', 'complex-geometry', 'parametric-tools'],
          canExportBIM: false,              // No BIM export
          canExportHighRes: false           // No high-res export
        },
        features: [
          '5,000 AI tokens/month',
          '20 image renders/month',
          'Basic AI model access',
          'Simple geometry tools only',
          'Community support'
        ]
      },
      
      pro: {
        id: 'pro',
        name: 'Pro Tier — Designer Plan',
        price: 19,
        currency: 'USD', 
        period: 'month',
        description: 'Best for freelancers and small firms',
        limits: {
          // AI Chat limits
          aiTokensPerMonth: 50000,          // 50K tokens/month
          // Render limits
          imageRendersPerMonth: 200,        // 200 renders/month
          maxImageResolution: '768x768',    // Up to 768px
          imageFormats: ['jpg', 'png'],     // JPG + PNG
          // Model access
          availableModels: ['gpt-3.5-turbo', 'gpt-4'], // Basic + Advanced
          availableRenderModels: ['sdxl-base', 'sdxl-refiner'], // Enhanced SDXL
          // Feature limits
          maxProjectSize: 10,               // 10 projects
          cloudStorage: 1000,               // 1GB storage (MB)
          teamSeats: 1,                     // Individual
          support: 'priority',              // Priority support (72h)
          // Tool access
          restrictedTools: ['enterprise-tools'], // Most tools available
          canExportBIM: true,               // IFC/DWG export
          canExportHighRes: false           // No 4K export
        },
        features: [
          '50,000 AI tokens/month', 
          '200 image renders/month',
          'Advanced AI models',
          'BIM exports (IFC/DWG)',
          'Priority support (72h)',
          '1GB cloud storage'
        ]
      },
      
      studio: {
        id: 'studio',
        name: 'Studio Tier — Professional Plan',
        price: 59,
        currency: 'USD',
        period: 'month', 
        description: 'Best for professional architects and small/medium firms',
        limits: {
          // AI Chat limits
          aiTokensPerMonth: 200000,         // 200K tokens/month
          // Render limits
          imageRendersPerMonth: 1000,       // 1K renders/month
          maxImageResolution: '1024x1024',  // Up to 1024px
          imageFormats: ['jpg', 'png', 'png-transparent'], // All formats
          // Model access
          availableModels: ['gpt-3.5-turbo', 'gpt-4', 'claude-3.5-sonnet'], // All models
          availableRenderModels: ['sdxl-base', 'sdxl-refiner', 'sdxl-style'], // All render models
          // Feature limits
          maxProjectSize: 100,              // 100 projects
          cloudStorage: 5000,               // 5GB storage (MB)
          teamSeats: 5,                     // Up to 5 team members
          support: 'email',                 // Email support (48h)
          // Tool access
          restrictedTools: [],              // All tools available
          canExportBIM: true,               // All BIM formats
          canExportHighRes: true,           // 4K renders
          canExport4K: true                 // 4K downloads
        },
        features: [
          '200,000 AI tokens/month',
          '1,000 image renders/month', 
          'All AI models (GPT-4, Claude)',
          'High-quality 4K exports',
          'Team collaboration (5 seats)',
          'Email support (48h SLA)',
          '5GB cloud storage'
        ]
      },
      
      enterprise: {
        id: 'enterprise',
        name: 'StudioSix Enterprise',
        price: 299,
        currency: 'USD',
        period: 'month',
        description: 'Custom enterprise solutions',
        limits: {
          // AI Chat limits
          aiTokensPerMonth: 1000000,        // 1M tokens/month (scalable)
          // Render limits
          imageRendersPerMonth: -1,         // Unlimited renders
          maxImageResolution: '2048x2048',  // Up to 2048px+
          imageFormats: ['jpg', 'png', 'png-transparent', 'tiff', 'exr'], // All formats
          // Model access
          availableModels: 'all',           // All models + custom
          availableRenderModels: 'all',     // All + custom fine-tuned
          // Feature limits
          maxProjectSize: -1,               // Unlimited projects
          cloudStorage: 50000,              // 50GB+ storage
          teamSeats: -1,                    // Unlimited seats
          support: 'dedicated',             // Dedicated account manager (24h)
          // Tool access
          restrictedTools: [],              // All tools + enterprise
          canExportBIM: true,               // All formats + custom
          canExportHighRes: true,           // Unlimited high-res
          canExport4K: true,                // 4K+ with textures
          hasAPIAccess: true,               // API integration
          hasOnPremOption: true,            // On-prem deployment
          hasCustomModels: true             // Custom AI models
        },
        features: [
          'Custom token packages (1M+ tokens)',
          'Unlimited image renders',
          'Custom fine-tuned AI models',
          'Unlimited 4K+ exports',
          'Unlimited team collaboration',
          'Dedicated account manager (24h SLA)', 
          '50GB+ cloud storage',
          'API integrations',
          'On-premise deployment option'
        ]
      }
    };

    // Token cost mapping for different operations
    this.tokenCosts = {
      // AI Chat costs (tokens per request type)
      aiChat: {
        'gpt-3.5-turbo': 1,      // 1 token = 1 usage unit
        'gpt-4': 3,              // GPT-4 costs 3x more
        'claude-3.5-sonnet': 2   // Claude costs 2x
      },
      
      // Image generation costs (converted to token equivalents)
      imageRender: {
        '512x512': 100,    // Small image = 100 tokens
        '768x768': 200,    // Medium image = 200 tokens  
        '1024x1024': 300,  // Large image = 300 tokens
        '2048x2048': 500   // XL image = 500 tokens
      },
      
      // BIM operations (heavy processing)
      bimExport: {
        'ifc': 50,         // IFC export = 50 tokens
        'dwg': 75,         // DWG export = 75 tokens
        'rvt': 100         // Revit export = 100 tokens
      }
    };
    
    // Load user subscription
    this.loadUserSubscription();
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
    
    // Try to get current user immediately
    this.getCurrentUser();
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser() {
    try {
      // Try manual auth first
      const manualAuthUser = localStorage.getItem('studiosix_manual_auth_user');
      if (manualAuthUser) {
        const user = JSON.parse(manualAuthUser);
        this.handleUserChange(user);
        return user;
      }
      
      // Fall back to Supabase session
      const supabaseSession = localStorage.getItem('sb-studiosix-auth-token');
      if (supabaseSession) {
        try {
          const session = JSON.parse(supabaseSession);
          if (session?.user) {
            this.handleUserChange(session.user);
            return session.user;
          }
        } catch (e) {
          // Handle gracefully
        }
      }
    } catch (error) {
      console.warn('Failed to get current user:', error);
    }
    
    this.handleUserChange(null);
    return null;
  }

  /**
   * Handle user change (login/logout)
   */
  handleUserChange(user) {
    const newUserId = user?.id || user?.email || null;
    
    if (newUserId !== this.currentUserId) {
      console.log('💰 Subscription: User changed from', this.currentUserId, 'to', newUserId);
      this.currentUserId = newUserId;
      this.loadUserSubscription();
      this.notifySubscriptionChange();
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
   * Load user subscription from storage
   */
  loadUserSubscription() {
    try {
      const storageKey = this.getUserStorageKey();
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        this.subscription = this.validateSubscription(parsed);
      } else {
        // New user - default to free tier
        this.subscription = this.createDefaultSubscription();
        this.saveUserSubscription();
      }
    } catch (error) {
      console.warn('Failed to load subscription:', error);
      this.subscription = this.createDefaultSubscription();
    }
  }

  /**
   * Create default free subscription for new users
   */
  createDefaultSubscription() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    return {
      userId: this.currentUserId,
      tierId: 'free',
      status: 'active',
      createdAt: now.toISOString(),
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: nextMonth.toISOString(),
      usage: {
        aiTokensThisMonth: 0,
        imageRendersThisMonth: 0,
        lastResetDate: now.toDateString()
      },
      limits: { ...this.tiers.free.limits }
    };
  }

  /**
   * Validate and upgrade subscription data structure
   */
  validateSubscription(subscription) {
    const tier = this.tiers[subscription.tierId] || this.tiers.free;
    
    // Reset monthly usage if new month
    const today = new Date().toDateString();
    if (subscription.usage?.lastResetDate !== today) {
      const now = new Date();
      if (now.getDate() === 1) { // First day of month
        subscription.usage.aiTokensThisMonth = 0;
        subscription.usage.imageRendersThisMonth = 0;
        subscription.usage.lastResetDate = today;
      }
    }
    
    // Update limits to match current tier definition
    subscription.limits = { ...tier.limits };
    
    return subscription;
  }

  /**
   * Save user subscription to storage
   */
  saveUserSubscription() {
    try {
      const storageKey = this.getUserStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(this.subscription));
      console.log('💰 Subscription saved for user:', this.currentUserId || 'anonymous');
    } catch (error) {
      console.error('Failed to save subscription:', error);
    }
  }

  /**
   * Get current user subscription
   * Now integrates with database for persistent storage
   */
  async getSubscription() {
    try {
      const profile = await this.getDatabaseProfile();
      if (profile && !profile.fallback) {
        // Use database profile
        return {
          tierId: profile.subscription_tier,
          status: profile.subscription_status,
          startedAt: profile.subscription_started_at,
          billingPeriodStart: profile.current_billing_period_start,
          billingPeriodEnd: profile.current_billing_period_end,
          usage: {
            aiTokensThisMonth: profile.usage_ai_tokens_this_month,
            imageRendersThisMonth: profile.usage_image_renders_this_month,
            bimExportsThisMonth: profile.usage_bim_exports_this_month
          },
          lifetime: {
            totalTokens: profile.total_ai_tokens_used,
            totalRenders: profile.total_image_renders_used,
            totalCost: profile.total_cost_incurred
          },
          stripe: {
            customerId: profile.stripe_customer_id,
            subscriptionId: profile.stripe_subscription_id
          },
          profile: profile
        };
      }
    } catch (error) {
      console.error('❌ Error fetching database profile, using local fallback:', error);
    }
    
    // Fallback to local storage
    return { ...this.subscription };
  }

  /**
   * Get current tier information
   * Now integrates with database profile
   */
  async getCurrentTier() {
    try {
      const subscription = await this.getSubscription();
      const tierId = subscription?.tierId || subscription?.profile?.subscription_tier || 'free';
      return this.tiers[tierId] || this.tiers.free;
    } catch (error) {
      console.error('❌ Error getting current tier:', error);
      return this.tiers[this.subscription?.tierId] || this.tiers.free;
    }
  }

  /**
   * Get database profile with caching
   */
  async getDatabaseProfile() {
    if (!this.currentUserId) {
      console.log('⚠️ No current user ID for database profile fetch');
      return null;
    }
    
    const cacheKey = `profile_${this.currentUserId}`;
    const cached = this.profileCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    
    try {
      const profile = await userDatabaseService.getUserProfile(this.currentUserId);
      this.profileCache.set(cacheKey, { data: profile, timestamp: Date.now() });
      return profile;
    } catch (error) {
      console.error('❌ Error fetching database profile:', error);
      return null;
    }
  }

  /**
   * Get all available tiers
   */
  getAllTiers() {
    return { ...this.tiers };
  }

  /**
   * Check if user can perform an action based on limits
   * Now uses database for accurate usage tracking
   */
  async canPerformAction(actionType, actionDetails = {}) {
    try {
      // First try database check for accuracy
      const canPerform = await userDatabaseService.canPerformAction(
        this.currentUserId, 
        actionType, 
        actionDetails.tokens || actionDetails.amount || 1
      );
      
      if (canPerform !== undefined) {
        console.log(`🔍 Database permission check: ${actionType} = ${canPerform}`);
        return canPerform;
      }
    } catch (error) {
      console.error('❌ Database permission check failed, using local fallback:', error);
    }
    
    // Fallback to local logic
    const tier = await this.getCurrentTier();
    const subscription = await this.getSubscription();
    const usage = subscription?.usage || this.subscription?.usage || {};
    
    switch (actionType) {
      case 'ai_chat':
        const modelCost = this.tokenCosts.aiChat[actionDetails.model] || 1;
        const tokensNeeded = (actionDetails.tokens || 1000) * modelCost;
        return (usage.aiTokensThisMonth || 0) + tokensNeeded <= tier.limits.aiTokensPerMonth;
        
      case 'image_render':
        if (tier.limits.imageRendersPerMonth === -1) return true; // Unlimited
        return (usage.imageRendersThisMonth || 0) < tier.limits.imageRendersPerMonth;
        
      case 'model_access':
        const availableModels = tier.limits.availableModels;
        if (availableModels === 'all') return true;
        return Array.isArray(availableModels) && availableModels.includes(actionDetails.model);
        
      case 'export_bim':
        return tier.limits.canExportBIM;
        
      case 'export_high_res':
        return tier.limits.canExportHighRes;
        
      default:
        return false;
    }
  }

  /**
   * Record usage for an action
   * Now persists to database for accurate tracking
   */
  async recordUsage(actionType, actionDetails = {}) {
    try {
      const amount = actionDetails.tokens || actionDetails.amount || 1;
      const metadata = {
        model: actionDetails.model,
        cost: actionDetails.cost || 0,
        description: actionDetails.description || `${actionType} usage`,
        ...actionDetails
      };
      
      // Record to database first
      const success = await userDatabaseService.recordUsage(
        this.currentUserId,
        actionType,
        amount,
        metadata
      );
      
      if (success) {
        console.log(`✅ Usage recorded to database: ${actionType} x${amount}`);
        // Clear cache to force refresh
        this.profileCache.clear();
        this.notifySubscriptionChange();
        return true;
      }
    } catch (error) {
      console.error('❌ Database usage recording failed, using local fallback:', error);
    }
    
    // Fallback to local recording
    if (!this.subscription) {
      console.log('⚠️ No subscription found for local usage recording');
      return false;
    }
    
    switch (actionType) {
      case 'ai_chat':
        const modelCost = this.tokenCosts.aiChat[actionDetails.model] || 1;
        const tokensUsed = (actionDetails.tokens || 1000) * modelCost;
        this.subscription.usage.aiTokensThisMonth += tokensUsed;
        break;
        
      case 'image_render':
        this.subscription.usage.imageRendersThisMonth += 1;
        break;
    }
    
    this.saveUserSubscription();
    this.notifySubscriptionChange();
    return true;
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    const tier = this.getCurrentTier();
    const usage = this.subscription.usage;
    
    return {
      aiTokens: {
        used: usage.aiTokensThisMonth,
        limit: tier.limits.aiTokensPerMonth,
        percentage: tier.limits.aiTokensPerMonth > 0 ? 
          (usage.aiTokensThisMonth / tier.limits.aiTokensPerMonth) * 100 : 0
      },
      imageRenders: {
        used: usage.imageRendersThisMonth,
        limit: tier.limits.imageRendersPerMonth,
        percentage: tier.limits.imageRendersPerMonth > 0 ?
          (usage.imageRendersThisMonth / tier.limits.imageRendersPerMonth) * 100 : 0
      }
    };
  }

  /**
   * Upgrade user to new tier
   */
  /**
   * Upgrade user to new tier
   * Now persists to database
   */
  async upgradeTo(tierId, reason = 'user_upgrade') {
    if (!this.tiers[tierId]) {
      throw new Error(`Invalid tier: ${tierId}`);
    }
    
    try {
      // Update in database first
      const success = await userDatabaseService.changeSubscriptionTier(
        this.currentUserId,
        tierId,
        reason
      );
      
      if (success) {
        console.log(`✅ Subscription upgraded to ${tierId} in database`);
        // Clear cache to force refresh
        this.profileCache.clear();
        this.notifySubscriptionChange();
        return true;
      }
    } catch (error) {
      console.error('❌ Database tier upgrade failed, using local fallback:', error);
    }
    
    // Fallback to local upgrade
    if (!this.subscription) {
      console.log('⚠️ No subscription found for local upgrade');
      return false;
    }
    
    this.subscription.tierId = tierId;
    this.subscription.limits = { ...this.tiers[tierId].limits };
    this.subscription.upgradedAt = new Date().toISOString();
    
    this.saveUserSubscription();
    this.notifySubscriptionChange();
    
    console.log(`💰 User upgraded to: ${this.tiers[tierId].name} (local)`);
    return true;
  }

  /**
   * Get upgrade recommendations
   */
  getUpgradeRecommendations() {
    const currentTier = this.getCurrentTier();
    const usage = this.getUsageStats();
    const recommendations = [];
    
    // Check if approaching limits
    if (usage.aiTokens.percentage > 80) {
      recommendations.push({
        type: 'ai_tokens',
        message: 'You\'re approaching your AI token limit',
        suggestedTier: this.getNextTier(currentTier.id),
        urgency: 'high'
      });
    }
    
    if (usage.imageRenders.percentage > 80) {
      recommendations.push({
        type: 'image_renders', 
        message: 'You\'re approaching your render limit',
        suggestedTier: this.getNextTier(currentTier.id),
        urgency: 'high'
      });
    }
    
    return recommendations;
  }

  /**
   * Get next tier suggestion
   */
  getNextTier(currentTierId) {
    const tiers = ['free', 'pro', 'studio', 'enterprise'];
    const currentIndex = tiers.indexOf(currentTierId);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  }

  /**
   * Listen for subscription changes
   */
  onSubscriptionChange(listener) {
    this.subscriptionChangeListeners.add(listener);
    return () => this.subscriptionChangeListeners.delete(listener);
  }

  /**
   * Notify subscription change listeners
   */
  notifySubscriptionChange() {
    this.subscriptionChangeListeners.forEach(listener => {
      try {
        listener(this.subscription);
      } catch (error) {
        console.error('Error in subscription change listener:', error);
      }
    });
  }

  /**
   * Get monetization info for debugging
   */
  getMonetizationInfo() {
    return {
      currentUserId: this.currentUserId,
      tier: this.getCurrentTier(),
      subscription: this.subscription,
      usage: this.getUsageStats(),
      recommendations: this.getUpgradeRecommendations(),
      storageKey: this.getUserStorageKey()
    };
  }
}

// Export singleton instance
const subscriptionService = new SubscriptionService();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.subscriptionService = subscriptionService;
  console.log('💰 Subscription Service available at window.subscriptionService');
}

export default subscriptionService;