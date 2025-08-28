/**
 * AgentConfigService - Central configuration for autonomous agent behavior
 * 
 * Manages default settings and per-run overrides for autonomous execution
 * Integrates with AISettingsService for persistence when appropriate
 */

import aiSettingsService from './AISettingsService';

/**
 * @typedef {Object} AgentConfig
 * @property {number} maxSteps - Maximum steps per autonomous run
 * @property {number} maxMillis - Maximum time per autonomous run 
 * @property {('always'|'never'|'destructive')} approvalMode - When to request user approval
 * @property {string[]} allowedTools - Tools that agent can use
 * @property {boolean} enableCritic - Enable design quality and safety validation
 * @property {boolean} enableLearning - Enable outcome tracking and learning
 * @property {boolean} enableCheckpoints - Enable transactional checkpoints/rollback
 * @property {number} historyLimit - Max conversation history items to keep
 */

const DEFAULTS = {
  maxSteps: 12,
  maxMillis: 60_000, // 1 minute
  approvalMode: 'destructive', // Request approval for destructive operations only
  allowedTools: [
    // Selection tools
    'selection.select',
    'selection.clear',
    // Geometry creation
    'geometry.createWall',
    'geometry.createSlab', 
    'geometry.createDoor',
    'geometry.createWindow',
    'geometry.createColumn',
    'geometry.createStair',
    'geometry.createRoof',
    // Geometry modification
    'geometry.editWall',
    'geometry.editSlab',
    'geometry.editStair',
    // Transform operations
    'transform.move',
    'transform.rotate',
    'transform.scale',
    // Document operations
    'document.commitCheckpoint',
    'document.undo',
    'document.redo',
    // Analysis
    'analysis.structural',
    'analysis.spatial'
  ],
  enableCritic: true,
  enableLearning: true,
  enableCheckpoints: true,
  historyLimit: 20 // Keep last 20 conversation items
};

class AgentConfigService {
  constructor() {
    this.cache = null;
    this.listeners = new Set();
    
    // Listen for AI settings changes to update cached config
    aiSettingsService.onSettingsChange(() => {
      this.cache = null;
      this.notifyListeners();
    });
  }

  /**
   * Get default agent configuration
   */
  getDefaults() {
    return { ...DEFAULTS };
  }

  /**
   * Get effective configuration with per-run overrides
   */
  withOverrides(runOverrides = {}) {
    const base = this.getEffectiveDefaults();
    return { ...base, ...runOverrides };
  }

  /**
   * Get defaults potentially modified by user settings
   */
  getEffectiveDefaults() {
    if (this.cache) return this.cache;

    const aiSettings = aiSettingsService.getChatSettings();
    const base = { ...DEFAULTS };

    // Apply user preferences from AI settings if available
    if (aiSettings.agentConfig) {
      Object.assign(base, aiSettings.agentConfig);
    }

    this.cache = base;
    return base;
  }

  /**
   * Update default configuration and persist to AI settings
   */
  async updateDefaults(newDefaults) {
    try {
      const currentSettings = aiSettingsService.getChatSettings();
      const updatedSettings = {
        ...currentSettings,
        agentConfig: { ...DEFAULTS, ...newDefaults }
      };

      await aiSettingsService.updateChatSettings(updatedSettings);
      this.cache = null;
      this.notifyListeners();
      
      console.log('🤖 AgentConfig: Defaults updated and persisted');
      return true;
    } catch (error) {
      console.error('❌ AgentConfig: Failed to update defaults:', error);
      return false;
    }
  }

  /**
   * Validate configuration object
   */
  validateConfig(config) {
    const errors = [];

    if (typeof config.maxSteps !== 'number' || config.maxSteps < 1 || config.maxSteps > 100) {
      errors.push('maxSteps must be a number between 1 and 100');
    }

    if (typeof config.maxMillis !== 'number' || config.maxMillis < 1000 || config.maxMillis > 300_000) {
      errors.push('maxMillis must be a number between 1000 and 300000 (5 minutes)');
    }

    if (!['always', 'never', 'destructive'].includes(config.approvalMode)) {
      errors.push('approvalMode must be "always", "never", or "destructive"');
    }

    if (!Array.isArray(config.allowedTools)) {
      errors.push('allowedTools must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration for UI display
   */
  getConfigForDisplay() {
    const config = this.getEffectiveDefaults();
    return {
      ...config,
      maxStepsDisplay: `${config.maxSteps} steps`,
      maxTimeDisplay: `${Math.round(config.maxMillis / 1000)}s`,
      approvalModeDisplay: {
        always: 'Every step',
        never: 'Never',
        destructive: 'Destructive only'
      }[config.approvalMode],
      toolCount: config.allowedTools.length
    };
  }

  /**
   * Listen for configuration changes
   */
  onConfigChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners of configuration changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.getEffectiveDefaults());
      } catch (error) {
        console.error('❌ AgentConfig: Listener error:', error);
      }
    });
  }

  /**
   * Reset to factory defaults
   */
  async resetToDefaults() {
    try {
      const currentSettings = aiSettingsService.getChatSettings();
      const updatedSettings = { ...currentSettings };
      delete updatedSettings.agentConfig;

      await aiSettingsService.updateChatSettings(updatedSettings);
      this.cache = null;
      this.notifyListeners();
      
      console.log('🤖 AgentConfig: Reset to factory defaults');
      return true;
    } catch (error) {
      console.error('❌ AgentConfig: Failed to reset defaults:', error);
      return false;
    }
  }

  /**
   * Check if a tool is allowed in current configuration
   */
  isToolAllowed(toolName, config = null) {
    const effectiveConfig = config || this.getEffectiveDefaults();
    return effectiveConfig.allowedTools.includes(toolName);
  }

  /**
   * Get memory hygiene settings
   */
  getMemorySettings() {
    const config = this.getEffectiveDefaults();
    return {
      historyLimit: config.historyLimit,
      enableLearning: config.enableLearning,
      pruneOldData: true
    };
  }
}

// Export singleton instance
const agentConfigService = new AgentConfigService();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.agentConfigService = agentConfigService;
  console.log('🤖 AgentConfigService available at window.agentConfigService');
}

export default agentConfigService;