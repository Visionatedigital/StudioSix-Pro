/**
 * User Database Service
 * Manages user subscription data in Supabase database
 */

import { auth, supabase, isAuthConfigured } from '../config/supabase';

class UserDatabaseService {
  constructor() {
    this.initialized = false;
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    
    // Listen for auth state changes to clear cache
    if (typeof window !== 'undefined') {
      window.addEventListener('auth-state-change', () => {
        this.clearCache();
      });
    }
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('🔄 Initializing UserDatabaseService...');
    
    if (!isAuthConfigured) {
      console.warn('⚠️ Supabase not configured, database service will use local fallback');
    }
    
    this.initialized = true;
    console.log('✅ UserDatabaseService initialized');
  }

  /**
   * Get current user ID from auth
   */
  getCurrentUserId() {
    const user = auth.getCurrentUser();
    return user?.id || user?.user?.id || null;
  }

  /**
   * Get user profile with subscription data
   */
  async getUserProfile(userId = null) {
    await this.initialize();
    
    const targetUserId = userId || this.getCurrentUserId();
    if (!targetUserId) {
      console.log('⚠️ No user ID available for getUserProfile');
      return this.getFallbackUserProfile();
    }

    const cacheKey = `profile_${targetUserId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log('💾 Returning cached user profile');
      return cached.data;
    }

    try {
      if (!isAuthConfigured) {
        console.log('📊 Using fallback user profile (no Supabase)');
        const fallback = this.getFallbackUserProfile(targetUserId);
        this.cache.set(cacheKey, { data: fallback, timestamp: Date.now() });
        return fallback;
      }

      console.log('📊 Fetching user profile from database for user:', targetUserId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create it
          console.log('👤 Creating new user profile...');
          return await this.createUserProfile(targetUserId);
        }
        console.error('❌ Error fetching user profile:', error);
        const fallback = this.getFallbackUserProfile(targetUserId);
        this.cache.set(cacheKey, { data: fallback, timestamp: Date.now() });
        return fallback;
      }

      console.log('✅ User profile fetched successfully:', data);
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;

    } catch (error) {
      console.error('❌ Error in getUserProfile:', error);
      const fallback = this.getFallbackUserProfile(targetUserId);
      this.cache.set(cacheKey, { data: fallback, timestamp: Date.now() });
      return fallback;
    }
  }

  /**
   * Create a new user profile
   */
  async createUserProfile(userId, userData = {}) {
    await this.initialize();
    
    if (!isAuthConfigured) {
      console.log('📊 Creating fallback user profile (no Supabase)');
      return this.getFallbackUserProfile(userId);
    }

    try {
      const user = auth.getCurrentUser();
      const email = user?.email || userData.email || `user_${userId}@example.com`;
      const fullName = userData.full_name || userData.firstName || user?.user_metadata?.full_name || email.split('@')[0];

      const profileData = {
        id: userId,
        email: email,
        full_name: fullName,
        first_name: userData.firstName || fullName.split(' ')[0],
        subscription_tier: 'free',
        subscription_status: 'active',
        subscription_started_at: new Date().toISOString(),
        current_billing_period_start: new Date().toISOString(),
        current_billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        usage_ai_tokens_this_month: 0,
        usage_image_renders_this_month: 0,
        usage_bim_exports_this_month: 0,
        total_ai_tokens_used: 0,
        total_image_renders_used: 0,
        total_bim_exports_used: 0,
        total_cost_incurred: 0,
        is_trial_used: false,
        onboarding_completed: false,
        preferred_ai_model: 'gpt-3.5-turbo'
      };

      console.log('👤 Creating user profile with data:', profileData);

      const { data, error } = await supabase
        .from('user_profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user profile:', error);
        return this.getFallbackUserProfile(userId);
      }

      console.log('✅ User profile created successfully:', data);
      this.clearCache(); // Clear cache to force refresh
      return data;

    } catch (error) {
      console.error('❌ Error in createUserProfile:', error);
      return this.getFallbackUserProfile(userId);
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, updates) {
    await this.initialize();
    
    const targetUserId = userId || this.getCurrentUserId();
    if (!targetUserId) {
      console.log('⚠️ No user ID available for updateUserProfile');
      return false;
    }

    try {
      if (!isAuthConfigured) {
        console.log('📊 Simulating profile update (no Supabase)');
        this.clearCache();
        return true;
      }

      console.log('📝 Updating user profile:', targetUserId, updates);

      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetUserId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating user profile:', error);
        return false;
      }

      console.log('✅ User profile updated successfully:', data);
      this.clearCache(); // Clear cache to force refresh
      return true;

    } catch (error) {
      console.error('❌ Error in updateUserProfile:', error);
      return false;
    }
  }

  /**
   * Change user subscription tier
   */
  async changeSubscriptionTier(userId, newTier, reason = 'user_upgrade') {
    await this.initialize();
    
    const targetUserId = userId || this.getCurrentUserId();
    if (!targetUserId) {
      console.log('⚠️ No user ID available for changeSubscriptionTier');
      return false;
    }

    try {
      const currentProfile = await this.getUserProfile(targetUserId);
      const oldTier = currentProfile.subscription_tier;

      if (oldTier === newTier) {
        console.log('ℹ️ User already on requested tier:', newTier);
        return true;
      }

      const updates = {
        subscription_tier: newTier,
        subscription_updated_at: new Date().toISOString()
      };

      // If upgrading to a paid tier, reset billing period
      if (newTier !== 'free' && oldTier === 'free') {
        const now = new Date();
        updates.current_billing_period_start = now.toISOString();
        updates.current_billing_period_end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const success = await this.updateUserProfile(targetUserId, updates);
      
      if (success) {
        // Log the subscription change
        await this.logSubscriptionChange(targetUserId, oldTier, newTier, reason);
        console.log(`✅ Subscription tier changed from ${oldTier} to ${newTier}`);
      }

      return success;

    } catch (error) {
      console.error('❌ Error in changeSubscriptionTier:', error);
      return false;
    }
  }

  /**
   * Record user usage
   */
  async recordUsage(userId, usageType, amount = 1, metadata = {}) {
    await this.initialize();
    
    const targetUserId = userId || this.getCurrentUserId();
    if (!targetUserId) {
      console.log('⚠️ No user ID available for recordUsage');
      return false;
    }

    try {
      if (!isAuthConfigured) {
        console.log('📊 Simulating usage recording (no Supabase)');
        return true;
      }

      console.log('📊 Recording usage:', { targetUserId, usageType, amount, metadata });

      // Use the database function for atomic usage recording
      const { data, error } = await supabase.rpc('record_user_usage', {
        p_user_id: targetUserId,
        p_usage_type: usageType,
        p_amount: amount,
        p_model_used: metadata.model,
        p_cost: metadata.cost || 0,
        p_description: metadata.description,
        p_metadata: metadata
      });

      if (error) {
        console.error('❌ Error recording usage:', error);
        return false;
      }

      console.log('✅ Usage recorded successfully');
      this.clearCache(); // Clear cache to force refresh
      return true;

    } catch (error) {
      console.error('❌ Error in recordUsage:', error);
      return false;
    }
  }

  /**
   * Check if user can perform an action
   */
  async canPerformAction(userId, actionType, amount = 1) {
    await this.initialize();
    
    const targetUserId = userId || this.getCurrentUserId();
    if (!targetUserId) {
      console.log('⚠️ No user ID available for canPerformAction');
      return false;
    }

    try {
      if (!isAuthConfigured) {
        console.log('📊 Simulating action check (no Supabase)');
        return true; // Allow all actions when no database
      }

      const { data, error } = await supabase.rpc('can_user_perform_action', {
        p_user_id: targetUserId,
        p_action_type: actionType,
        p_amount: amount
      });

      if (error) {
        console.error('❌ Error checking action permission:', error);
        return false;
      }

      console.log(`🔍 Action permission check: ${actionType} x${amount} = ${data ? 'ALLOWED' : 'DENIED'}`);
      return data;

    } catch (error) {
      console.error('❌ Error in canPerformAction:', error);
      return false;
    }
  }

  /**
   * Get subscription limits for a tier
   */
  async getSubscriptionLimits(tier) {
    await this.initialize();
    
    try {
      if (!isAuthConfigured) {
        console.log('📊 Using fallback subscription limits (no Supabase)');
        return this.getFallbackLimits(tier);
      }

      const { data, error } = await supabase.rpc('get_subscription_limits', {
        user_tier: tier
      });

      if (error) {
        console.error('❌ Error fetching subscription limits:', error);
        return this.getFallbackLimits(tier);
      }

      return data;

    } catch (error) {
      console.error('❌ Error in getSubscriptionLimits:', error);
      return this.getFallbackLimits(tier);
    }
  }

  /**
   * Log subscription change
   */
  async logSubscriptionChange(userId, oldTier, newTier, reason, metadata = {}) {
    if (!isAuthConfigured) {
      console.log('📊 Simulating subscription change log (no Supabase)');
      return true;
    }

    try {
      const { error } = await supabase
        .from('subscription_changes_log')
        .insert({
          user_id: userId,
          old_tier: oldTier,
          new_tier: newTier,
          old_status: 'active',
          new_status: 'active',
          change_reason: reason,
          metadata: metadata
        });

      if (error) {
        console.error('❌ Error logging subscription change:', error);
        return false;
      }

      console.log('✅ Subscription change logged successfully');
      return true;

    } catch (error) {
      console.error('❌ Error in logSubscriptionChange:', error);
      return false;
    }
  }

  /**
   * Get fallback user profile when database is unavailable
   */
  getFallbackUserProfile(userId = 'fallback_user') {
    return {
      id: userId,
      email: 'user@example.com',
      full_name: 'Test User',
      first_name: 'Test',
      subscription_tier: 'free',
      subscription_status: 'active',
      subscription_started_at: new Date().toISOString(),
      current_billing_period_start: new Date().toISOString(),
      current_billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      usage_ai_tokens_this_month: 0,
      usage_image_renders_this_month: 0,
      usage_bim_exports_this_month: 0,
      total_ai_tokens_used: 0,
      total_image_renders_used: 0,
      total_bim_exports_used: 0,
      total_cost_incurred: 0,
      is_trial_used: false,
      onboarding_completed: false,
      preferred_ai_model: 'gpt-3.5-turbo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      fallback: true
    };
  }

  /**
   * Get fallback subscription limits
   */
  getFallbackLimits(tier) {
    const limits = {
      free: {
        aiTokensPerMonth: 5000,
        imageRendersPerMonth: 20,
        bimExportsPerMonth: 0,
        availableModels: ['gpt-3.5-turbo'],
        maxImageResolution: 512,
        supportLevel: 'community'
      },
      pro: {
        aiTokensPerMonth: 50000,
        imageRendersPerMonth: 200,
        bimExportsPerMonth: 10,
        availableModels: ['gpt-3.5-turbo', 'gpt-4'],
        maxImageResolution: 768,
        supportLevel: 'priority',
        cloudStorage: '1GB'
      },
      studio: {
        aiTokensPerMonth: 200000,
        imageRendersPerMonth: 1000,
        bimExportsPerMonth: 50,
        availableModels: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-5-sonnet-20241022'],
        maxImageResolution: 1024,
        supportLevel: 'priority',
        cloudStorage: '5GB',
        teamSeats: 5
      },
      enterprise: {
        aiTokensPerMonth: 1000000,
        imageRendersPerMonth: -1,
        bimExportsPerMonth: -1,
        availableModels: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-5-sonnet-20241022', 'custom'],
        maxImageResolution: 4096,
        supportLevel: 'dedicated',
        cloudStorage: '50GB',
        teamSeats: -1,
        customModels: true
      }
    };

    return limits[tier] || limits.free;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🔄 UserDatabaseService cache cleared');
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(userId = null) {
    const profile = await this.getUserProfile(userId);
    const limits = await this.getSubscriptionLimits(profile.subscription_tier);

    return {
      aiTokens: {
        used: profile.usage_ai_tokens_this_month,
        limit: limits.aiTokensPerMonth,
        percentage: limits.aiTokensPerMonth > 0 ? (profile.usage_ai_tokens_this_month / limits.aiTokensPerMonth) * 100 : 0,
        remaining: Math.max(0, limits.aiTokensPerMonth - profile.usage_ai_tokens_this_month)
      },
      imageRenders: {
        used: profile.usage_image_renders_this_month,
        limit: limits.imageRendersPerMonth,
        percentage: limits.imageRendersPerMonth > 0 ? (profile.usage_image_renders_this_month / limits.imageRendersPerMonth) * 100 : 0,
        remaining: limits.imageRendersPerMonth === -1 ? -1 : Math.max(0, limits.imageRendersPerMonth - profile.usage_image_renders_this_month)
      },
      bimExports: {
        used: profile.usage_bim_exports_this_month,
        limit: limits.bimExportsPerMonth,
        percentage: limits.bimExportsPerMonth > 0 ? (profile.usage_bim_exports_this_month / limits.bimExportsPerMonth) * 100 : 0,
        remaining: limits.bimExportsPerMonth === -1 ? -1 : Math.max(0, limits.bimExportsPerMonth - profile.usage_bim_exports_this_month)
      },
      totalCost: profile.total_cost_incurred,
      tier: profile.subscription_tier,
      status: profile.subscription_status
    };
  }
}

// Export singleton instance
const userDatabaseService = new UserDatabaseService();
export default userDatabaseService;