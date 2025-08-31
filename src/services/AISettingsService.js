/**
 * AI Settings Service
 * 
 * Manages all AI-related settings including:
 * - AI Chat configuration (provider, model, prompts, etc.)
 * - AI Render configuration (provider, model, quality, etc.)
 * - BYOK (Bring Your Own Key) configuration
 * - Usage tracking and caps
 * - Privacy settings
 * 
 * Persists settings in localStorage with reactive updates
 */

class AISettingsService {
  constructor() {
    this.baseStorageKey = 'studiosix_ai_settings';
    this.baseUsageStorageKey = 'studiosix_ai_usage';
    this.settingsChangeListeners = new Set();
    this.currentUserId = null;
    
    // Initialize auth listener to handle user changes
    this.initAuthListener();
    
    // Initialize with default settings
    this.defaultSettings = {
      // AI Chat Settings
      aiChat: {
        provider: 'openai', // 'openai', 'anthropic', 'google', 'mistral', 'xai', 'openrouter'
        model: 'gpt-4',
        systemPrompt: 'agent', // 'agent', 'ask', 'custom'
        customSystemPrompt: '',
        temperature: 0.7,
        maxTokens: 4096,
        contextMemory: true,
        safetyFilters: true
      },
      
      // AI Render Settings
      aiRender: {
        provider: 'openai', // 'openai', 'midjourney', 'stability', 'replicate'
        model: 'dall-e-3',
        preset: 'photorealistic', // 'photorealistic', 'architectural', 'concept', 'technical'
        resolution: '1024x1024',
        steps: 20,
        guidance: 7.5,
        quality: 'high' // 'draft', 'standard', 'high', 'ultra'
      },
      
      // BYOK Configuration
      byok: {
        enabled: false,
        useAppFallback: true,
        apiKeys: {
          openai: '',
          anthropic: '',
          google: '',
          mistral: '',
          xai: '',
          openrouter: '',
          stability: '',
          replicate: ''
        }
      },
      
      // Usage Caps
      usage: {
        dailyLimit: 100, // requests per day
        sessionLimit: 50, // requests per session
        enableLimits: true,
        alertThreshold: 0.8 // alert at 80% of limit
      },
      
      // Privacy Settings
      privacy: {
        sendAnalytics: false,
        storeChatHistory: true,
        allowTraining: false,
        shareUsageData: false
      }
    };
    
    // Load existing settings or use defaults (will be user-specific)
    this.settings = this.loadSettings();
    this.usage = this.loadUsage();
    
    // Available providers and models
    this.providers = {
      openai: {
        name: 'OpenAI',
        chatModels: [
          { id: 'gpt-4', name: 'GPT-4', maxTokens: 8192 },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', maxTokens: 4096 },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', maxTokens: 4096 }
        ],
        renderModels: [
          { id: 'dall-e-3', name: 'DALL-E 3' },
          { id: 'dall-e-2', name: 'DALL-E 2' }
        ]
      },
      anthropic: {
        name: 'Anthropic',
        chatModels: [
          { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', maxTokens: 8192 },
          { id: 'claude-3-haiku', name: 'Claude 3 Haiku', maxTokens: 4096 }
        ],
        renderModels: []
      },
      google: {
        name: 'Google',
        chatModels: [
          { id: 'gemini-pro', name: 'Gemini Pro', maxTokens: 8192 },
          { id: 'gemini-flash', name: 'Gemini Flash', maxTokens: 4096 }
        ],
        renderModels: []
      },
      mistral: {
        name: 'Mistral',
        chatModels: [
          { id: 'mistral-large', name: 'Mistral Large', maxTokens: 8192 },
          { id: 'mistral-medium', name: 'Mistral Medium', maxTokens: 4096 }
        ],
        renderModels: []
      },
      xai: {
        name: 'xAI',
        chatModels: [
          { id: 'grok-1', name: 'Grok 1', maxTokens: 8192 }
        ],
        renderModels: []
      },
      openrouter: {
        name: 'OpenRouter',
        chatModels: [
          { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', maxTokens: 8192 },
          { id: 'openai/gpt-4', name: 'GPT-4', maxTokens: 8192 }
        ],
        renderModels: []
      },
      stability: {
        name: 'Stability AI',
        chatModels: [],
        renderModels: [
          { id: 'stable-diffusion-xl', name: 'Stable Diffusion XL' },
          { id: 'stable-diffusion-3', name: 'Stable Diffusion 3' }
        ]
      },
      replicate: {
        name: 'Replicate',
        chatModels: [],
        renderModels: [
          { id: 'sdxl', name: 'SDXL' },
          { id: 'flux', name: 'Flux' }
        ]
      }
    };
  }

  /**
   * Initialize authentication listener to handle user changes
   */
  initAuthListener() {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;
    
    // Listen for auth state changes
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
      // Try to get user from auth context or manual auth
      const manualAuthUser = localStorage.getItem('studiosix_manual_auth_user');
      if (manualAuthUser) {
        const user = JSON.parse(manualAuthUser);
        this.handleUserChange(user);
        return user;
      }
      
      // Fall back to checking for Supabase session
      const supabaseSession = localStorage.getItem('sb-studiosix-auth-token');
      if (supabaseSession) {
        try {
          const session = JSON.parse(supabaseSession);
          if (session?.user) {
            this.handleUserChange(session.user);
            return session.user;
          }
        } catch (e) {
          // Session format might be different, handle gracefully
        }
      }
    } catch (error) {
      console.warn('Failed to get current user:', error);
    }
    
    // No authenticated user
    this.handleUserChange(null);
    return null;
  }

  /**
   * Handle user change (login/logout)
   */
  handleUserChange(user) {
    const newUserId = user?.id || user?.email || null;
    
    if (newUserId !== this.currentUserId) {
      console.log('🔐 AI Settings: User changed from', this.currentUserId, 'to', newUserId);
      
      const previousUserId = this.currentUserId;
      this.currentUserId = newUserId;
      
      // If user just logged in, try to migrate anonymous settings
      if (!previousUserId && newUserId) {
        this.migrateAnonymousSettings();
      }
      
      // Reload settings for new user
      this.settings = this.loadSettings();
      this.usage = this.loadUsage();
      
      // Notify listeners of settings change
      this.notifySettingsChange();
    }
  }

  /**
   * Migrate anonymous settings to user-specific storage
   */
  migrateAnonymousSettings() {
    try {
      const anonymousSettingsKey = `${this.baseStorageKey}_anonymous`;
      const anonymousUsageKey = `${this.baseUsageStorageKey}_anonymous`;
      
      const userSettingsKey = this.getUserStorageKey(this.baseStorageKey);
      const userUsageKey = this.getUserStorageKey(this.baseUsageStorageKey);
      
      // Check if user doesn't have settings yet and anonymous settings exist
      const userSettings = localStorage.getItem(userSettingsKey);
      const anonymousSettings = localStorage.getItem(anonymousSettingsKey);
      
      if (!userSettings && anonymousSettings) {
        console.log('🔄 Migrating anonymous AI settings to user:', this.currentUserId);
        localStorage.setItem(userSettingsKey, anonymousSettings);
        
        // Optional: Remove anonymous settings after migration
        localStorage.removeItem(anonymousSettingsKey);
      }
      
      // Migrate usage data as well
      const userUsage = localStorage.getItem(userUsageKey);
      const anonymousUsage = localStorage.getItem(anonymousUsageKey);
      
      if (!userUsage && anonymousUsage) {
        console.log('🔄 Migrating anonymous AI usage data to user:', this.currentUserId);
        localStorage.setItem(userUsageKey, anonymousUsage);
        localStorage.removeItem(anonymousUsageKey);
      }
    } catch (error) {
      console.warn('Failed to migrate anonymous settings:', error);
    }
  }

  /**
   * Get user-specific storage key
   */
  getUserStorageKey(baseKey) {
    if (this.currentUserId) {
      return `${baseKey}_${this.currentUserId}`;
    }
    return `${baseKey}_anonymous`;
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const storageKey = this.getUserStorageKey(this.baseStorageKey);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new settings
        return this.mergeWithDefaults(parsed, this.defaultSettings);
      }
    } catch (error) {
      console.warn('Failed to load AI settings:', error);
    }
    return { ...this.defaultSettings };
  }

  /**
   * Load usage data from localStorage
   */
  loadUsage() {
    try {
      const storageKey = this.getUserStorageKey(this.baseUsageStorageKey);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const today = new Date().toDateString();
        
        // Reset daily usage if it's a new day
        if (parsed.lastResetDate !== today) {
          parsed.dailyUsage = { chat: 0, render: 0 };
          parsed.lastResetDate = today;
        }
        
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to load AI usage data:', error);
    }
    
    return {
      dailyUsage: { chat: 0, render: 0 },
      sessionUsage: { chat: 0, render: 0 },
      totalUsage: { chat: 0, render: 0 },
      lastResetDate: new Date().toDateString()
    };
  }

  /**
   * Merge settings with defaults to handle new settings
   */
  mergeWithDefaults(settings, defaults) {
    const merged = { ...defaults };
    for (const key in settings) {
      if (typeof settings[key] === 'object' && !Array.isArray(settings[key])) {
        merged[key] = this.mergeWithDefaults(settings[key], defaults[key] || {});
      } else {
        merged[key] = settings[key];
      }
    }
    return merged;
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      const storageKey = this.getUserStorageKey(this.baseStorageKey);
      localStorage.setItem(storageKey, JSON.stringify(this.settings));
      this.notifySettingsChange();
      console.log('⚙️ AI Settings saved for user:', this.currentUserId || 'anonymous');
    } catch (error) {
      console.error('Failed to save AI settings:', error);
    }
  }

  /**
   * Save usage data to localStorage
   */
  saveUsage() {
    try {
      const storageKey = this.getUserStorageKey(this.baseUsageStorageKey);
      localStorage.setItem(storageKey, JSON.stringify(this.usage));
    } catch (error) {
      console.error('Failed to save AI usage data:', error);
    }
  }

  /**
   * Get all settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Get specific setting section
   */
  getSection(section) {
    return { ...this.settings[section] };
  }

  /**
   * Update specific setting section
   */
  updateSection(section, updates) {
    this.settings[section] = { ...this.settings[section], ...updates };
    this.saveSettings();
  }

  /**
   * Get AI Chat settings
   */
  getChatSettings() {
    return this.getSection('aiChat');
  }

  /**
   * Update AI Chat settings
   */
  updateChatSettings(updates) {
    this.updateSection('aiChat', updates);
  }

  /**
   * Get AI Render settings
   */
  getRenderSettings() {
    return this.getSection('aiRender');
  }

  /**
   * Update AI Render settings
   */
  updateRenderSettings(updates) {
    this.updateSection('aiRender', updates);
  }

  /**
   * Get BYOK settings
   */
  getBYOKSettings() {
    return this.getSection('byok');
  }

  /**
   * Update BYOK settings
   */
  updateBYOKSettings(updates) {
    this.updateSection('byok', updates);
  }

  /**
   * Get usage settings
   */
  getUsageSettings() {
    return this.getSection('usage');
  }

  /**
   * Update usage settings
   */
  updateUsageSettings(updates) {
    this.updateSection('usage', updates);
  }

  /**
   * Get privacy settings
   */
  getPrivacySettings() {
    return this.getSection('privacy');
  }

  /**
   * Update privacy settings
   */
  updatePrivacySettings(updates) {
    this.updateSection('privacy', updates);
  }

  /**
   * Get current usage data
   */
  getUsage() {
    return { ...this.usage };
  }

  /**
   * Track usage for a specific type
   */
  trackUsage(type) {
    this.usage.sessionUsage[type]++;
    this.usage.dailyUsage[type]++;
    this.usage.totalUsage[type]++;
    this.saveUsage();
    
    // Check limits
    this.checkUsageLimits(type);
  }

  /**
   * Check if usage limits are exceeded
   */
  checkUsageLimits(type) {
    if (!this.settings.usage.enableLimits) return;
    
    const dailyUsage = this.usage.dailyUsage[type];
    const sessionUsage = this.usage.sessionUsage[type];
    const dailyLimit = this.settings.usage.dailyLimit;
    const sessionLimit = this.settings.usage.sessionLimit;
    const alertThreshold = this.settings.usage.alertThreshold;
    
    // Check daily limit
    if (dailyUsage >= dailyLimit) {
      console.warn(`Daily ${type} usage limit (${dailyLimit}) exceeded`);
      return; // warn only; Supabase enforces real limits
    }
    
    // Check session limit
    if (sessionUsage >= sessionLimit) {
      console.warn(`Session ${type} usage limit (${sessionLimit}) exceeded`);
      return; // warn only
    }
    
    // Check alert threshold
    if (dailyUsage >= dailyLimit * alertThreshold) {
      console.warn(`${type} usage approaching daily limit: ${dailyUsage}/${dailyLimit}`);
    }
  }

  /**
   * Reset session usage
   */
  resetSessionUsage() {
    this.usage.sessionUsage = { chat: 0, render: 0 };
    this.saveUsage();
  }

  /**
   * Get available providers
   */
  getProviders() {
    return this.providers;
  }

  /**
   * Get models for a specific provider and type
   */
  getModelsForProvider(provider, type = 'chat') {
    const providerData = this.providers[provider];
    if (!providerData) return [];
    
    return type === 'chat' ? providerData.chatModels : providerData.renderModels;
  }

  /**
   * Check if API key is configured for provider
   */
  hasAPIKey(provider) {
    if (!this.settings.byok.enabled) return true; // Using app keys
    return !!this.settings.byok.apiKeys[provider];
  }

  /**
   * Get API key for provider
   */
  getAPIKey(provider) {
    if (!this.settings.byok.enabled) return null; // Use app proxy
    return this.settings.byok.apiKeys[provider] || null;
  }

  /**
   * Update API key for provider
   */
  updateAPIKey(provider, key) {
    this.settings.byok.apiKeys[provider] = key;
    this.saveSettings();
  }

  /**
   * Listen for settings changes
   */
  onSettingsChange(listener) {
    this.settingsChangeListeners.add(listener);
    return () => this.settingsChangeListeners.delete(listener);
  }

  /**
   * Notify all listeners of settings changes
   */
  notifySettingsChange() {
    this.settingsChangeListeners.forEach(listener => {
      try {
        listener(this.settings);
      } catch (error) {
        console.error('Error in settings change listener:', error);
      }
    });
  }

  /**
   * Reset all settings to defaults
   */
  resetToDefaults() {
    this.settings = { ...this.defaultSettings };
    this.saveSettings();
  }

  /**
   * Export settings as JSON
   */
  exportSettings() {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  importSettings(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.settings = this.mergeWithDefaults(imported, this.defaultSettings);
      this.saveSettings();
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  /**
   * Get current user ID
   */
  getCurrentUserId() {
    return this.currentUserId;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUserId;
  }

  /**
   * Get settings info for debugging
   */
  getSettingsInfo() {
    return {
      currentUserId: this.currentUserId,
      storageKey: this.getUserStorageKey(this.baseStorageKey),
      usageStorageKey: this.getUserStorageKey(this.baseUsageStorageKey),
      isAuthenticated: this.isAuthenticated()
    };
  }
}

// Export singleton instance
const aiSettingsService = new AISettingsService();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.aiSettingsService = aiSettingsService;
  console.log('⚙️ AI Settings Service available at window.aiSettingsService');
}

export default aiSettingsService;