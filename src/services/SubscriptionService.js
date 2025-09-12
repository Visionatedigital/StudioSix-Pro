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
    
    // Demo users who should bypass all render limits (for presentations)
    this.demoUnlimitedEmails = new Set([
      'visionatedigital@gmail.com'
    ]);
    
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
          imageRendersPerMonth: 3,          // 3 renders/month (Free requirement)
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
          imageRendersPerMonth: 50,         // 50 renders/month (Pro requirement)
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
          imageRendersPerMonth: 200,        // 200 renders/month (Studio requirement)
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
    
    // Centralized credit costs (credits per action)
    this.creditCosts = {
      image_render: 100,
      video_render: 250
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

      // Discover Supabase auth token key dynamically (sb-<ref>-auth-token)
      const sessionKey = Object.keys(localStorage).find(k => /sb-.*-auth-token$/.test(k));
      const supabaseSession = sessionKey ? localStorage.getItem(sessionKey) : null;
      if (supabaseSession) {
        try {
          const session = JSON.parse(supabaseSession);
          if (session?.user) {
            this.handleUserChange(session.user);
            return session.user;
          }
        } catch (e) { /* ignore */ }
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
    // Defensive: fallback limits to avoid crash if tiers not initialized
    const fallbackLimits = {
      aiTokensPerMonth: 5000,
      imageRendersPerMonth: 3,
      maxImageResolution: '512x512',
      imageFormats: ['jpg'],
      availableModels: ['gpt-3.5-turbo'],
      availableRenderModels: ['sdxl-base'],
      maxProjectSize: 1,
      cloudStorage: 0,
      teamSeats: 1,
      support: 'community',
      restrictedTools: [],
      canExportBIM: false,
      canExportHighRes: false
    };
    const freeLimits = (this && this.tiers && this.tiers.free && this.tiers.free.limits)
      ? { ...this.tiers.free.limits }
      : fallbackLimits;
    
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
      // Credit wallet (centralized). Free users start with 300 credits.
      credits: 300,
      // Back-compat alias; kept in sync with credits
      renderCredits: 300,
      limits: freeLimits
    };
  }

  /**
   * Validate and upgrade subscription data structure
   */
  validateSubscription(subscription) {
    const tier = (this && this.tiers && (this.tiers[subscription.tierId] || this.tiers.free)) || { limits: { aiTokensPerMonth: 5000, imageRendersPerMonth: 3 } };
    
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
    subscription.limits = { ...(tier && tier.limits ? tier.limits : { aiTokensPerMonth: 5000, imageRendersPerMonth: 3 }) };
    // Ensure credits wallet exists
    if (typeof subscription.credits !== 'number' || isNaN(subscription.credits)) {
      subscription.credits = (subscription.tierId === 'free') ? 300 : 0;
    }
    // Keep legacy renderCredits in sync
    if (typeof subscription.renderCredits !== 'number' || isNaN(subscription.renderCredits)) {
      subscription.renderCredits = subscription.credits;
    } else if (subscription.renderCredits !== subscription.credits) {
      subscription.renderCredits = subscription.credits;
    }
    
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
        // Sync local wallet credits from database profile if available
        try {
          const dbCredits = Number((profile && (profile.render_credits ?? profile.credits)) || 0);
          if (!Number.isNaN(dbCredits)) {
            if (!this.subscription) {
              this.subscription = this.createDefaultSubscription();
            }
            const localCredits = Number(this.subscription.credits || 0);
            if (localCredits !== dbCredits) {
              this.subscription.credits = dbCredits;
              this.subscription.renderCredits = dbCredits; // keep legacy alias in sync
              this.saveUserSubscription();
              this.notifySubscriptionChange();
            }
          }
        } catch (_) { /* non-fatal */ }

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
          // Expose wallet credits directly from DB for consumers that read from getSubscription()
          credits: Number((profile && (profile.render_credits ?? profile.credits)) || 0),
          renderCredits: Number((profile && (profile.render_credits ?? profile.credits)) || 0),
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
   * Force refresh credits from the database and sync local wallet
   */
  async refreshCreditsFromDatabase() {
    try {
      // Clear cache to force DB fetch
      try { this.profileCache.clear(); } catch {}
      const profile = await this.getDatabaseProfile();
      if (profile && !profile.fallback) {
        const dbCredits = Number((profile && (profile.render_credits ?? profile.credits)) || 0);
        if (!Number.isNaN(dbCredits)) {
          if (!this.subscription) {
            this.subscription = this.createDefaultSubscription();
          }
          if (this.subscription.credits !== dbCredits) {
            this.subscription.credits = dbCredits;
            this.subscription.renderCredits = dbCredits;
            this.saveUserSubscription();
            this.notifySubscriptionChange();
          }
        }
      }
    } catch (_) { /* non-fatal */ }
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
      // Bypass limits for demo allowlist users
      if (await this.isUnlimitedDemoUser()) {
        if (actionType === 'image_render' || actionType === 'video_render') return true;
      }

      // Credits-gated actions
      if (actionType === 'video_render' || actionType === 'image_render') {
        const perUnit = this.creditCosts[actionType] || 0;
        const units = Number(actionDetails.units || 1);
        const needed = Number(actionDetails.amount) || (perUnit * units);
        const available = (this.subscription && typeof this.subscription.credits === 'number') ? this.subscription.credits : 0;
        return available >= needed;
      }
      
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
        // Fallback to credits check
        return ((this.subscription?.credits || 0) >= ((this.creditCosts.image_render) || 100));
      case 'video_render':
        // Fallback to credits check
        return ((this.subscription?.credits || 0) >= ((this.creditCosts.video_render) || 250));
        
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
      // Skip recording for demo allowlist users (unlimited renders)
      if (await this.isUnlimitedDemoUser()) {
        if (actionType === 'image_render' || actionType === 'video_render') return true;
      }
      
      const amount = actionDetails.tokens || actionDetails.amount || 1;
      const metadata = {
        model: actionDetails.model,
        cost: actionDetails.cost || 0,
        description: actionDetails.description || `${actionType} usage`,
        ...actionDetails
      };

      // Handle credits-gated actions locally first
      if (actionType === 'video_render' || actionType === 'image_render') {
        const perUnit = this.creditCosts[actionType] || 0;
        const units = Number(actionDetails.units || 1);
        const needed = Number(actionDetails.amount) || (perUnit * units);
        // Attempt DB record (best-effort, may be no-op)
        try { await userDatabaseService.recordUsage(this.currentUserId, actionType, needed, metadata); } catch (_) {}
        // Deduct from local wallet
        const ok = this.deductCredits(needed);
        // Also increment monthly counters for analytics
        if (ok && actionType === 'image_render') {
          try { this.subscription.usage.imageRendersThisMonth = (this.subscription.usage.imageRendersThisMonth || 0) + 1; } catch {}
        }
        this.saveUserSubscription();
        this.notifySubscriptionChange();
        return ok;
      }
      
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
      case 'video_render':
        // Already handled via credits above
        break;
    }
    
    this.saveUserSubscription();
    this.notifySubscriptionChange();
    return true;
  }

  /**
   * Get current render credits balance
   */
  getCredits() {
    return (this.subscription && typeof this.subscription.credits === 'number') ? this.subscription.credits : 0;
  }
  // Back-compat alias
  getRenderCredits() { return this.getCredits(); }

  /**
   * Add render credits (e.g., after purchase)
   */
  addCredits(amount) {
    const add = Number(amount || 0);
    if (!this.subscription) return false;
    this.subscription.credits = Math.max(0, (this.subscription.credits || 0) + add);
    this.subscription.renderCredits = this.subscription.credits; // keep in sync
    this.saveUserSubscription();
    this.notifySubscriptionChange();
    return true;
  }
  // Back-compat alias
  addRenderCredits(amount) { return this.addCredits(amount); }

  /**
   * Deduct render credits; returns true if successful
   */
  deductCredits(amount) {
    const need = Number(amount || 0);
    if (!this.subscription) return false;
    const have = Number(this.subscription.credits || 0);
    if (have < need) return false;
    this.subscription.credits = have - need;
    this.subscription.renderCredits = this.subscription.credits; // keep in sync
    this.saveUserSubscription();
    this.notifySubscriptionChange();
    return true;
  }
  // Back-compat alias
  deductRenderCredits(amount) { return this.deductCredits(amount); }

  /**
   * Check whether the current user is a demo allowlist user
   */
  async isUnlimitedDemoUser() {
    try {
      const profile = await this.getDatabaseProfile();
      let email = profile?.email;
      
      if (!email && typeof localStorage !== 'undefined') {
        try {
          const manual = localStorage.getItem('studiosix_manual_auth_user');
          if (manual) {
            const u = JSON.parse(manual);
            email = u?.email || email;
          }
          if (!email) {
            const sessionKey = Object.keys(localStorage).find(k => /sb-.*-auth-token$/.test(k));
            const raw = sessionKey ? localStorage.getItem(sessionKey) : null;
            if (raw) {
              const session = JSON.parse(raw);
              email = session?.user?.email || email;
            }
          }
        } catch (_) { /* ignore */ }
      }
      
      return !!email && this.demoUnlimitedEmails.has(String(email).toLowerCase());
    } catch (_) {
      return false;
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    const tier = this.getCurrentTier();
    const usage = (this.subscription && this.subscription.usage) ? this.subscription.usage : { aiTokensThisMonth: 0, imageRendersThisMonth: 0 };
    const limits = (tier && tier.limits) ? tier.limits : { aiTokensPerMonth: 0, imageRendersPerMonth: 0 };
    
    return {
      aiTokens: {
        used: usage.aiTokensThisMonth || 0,
        limit: limits.aiTokensPerMonth || 0,
        percentage: (limits.aiTokensPerMonth && limits.aiTokensPerMonth > 0) ? 
          ((usage.aiTokensThisMonth || 0) / limits.aiTokensPerMonth) * 100 : 0
      },
      imageRenders: {
        used: usage.imageRendersThisMonth || 0,
        limit: limits.imageRendersPerMonth || 0,
        percentage: (limits.imageRendersPerMonth && limits.imageRendersPerMonth > 0) ?
          ((usage.imageRendersThisMonth || 0) / limits.imageRendersPerMonth) * 100 : 0
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