/**
 * AI Service for StudioSix
 * 
 * Handles communication with multiple AI providers:
 * - OpenAI (GPT-4, GPT-4 Turbo, GPT-3.5 Turbo)
 * - Anthropic Claude (Claude 3.5 Sonnet, Claude 3 Haiku)
 * 
 * Provides unified interface for architectural AI assistance
 * Integrates with user-specific AI settings
 */

import aiSettingsService from './AISettingsService';
import subscriptionService from './SubscriptionService';
import tokenUsageService from './TokenUsageService';
import eventManager from './EventManager';
import aiCommandExecutor from './AICommandExecutor'; // Added import for aiCommandExecutor

class AIService {
  constructor() {
    // Use centralized API base
    const { getApiBase } = require('../config/apiBase');
    this.proxyUrl = process.env.REACT_APP_AI_PROXY_URL || getApiBase();
    this.aiChatEndpoint = `${this.proxyUrl}/api/ai-chat`;
    this.testConnectionsEndpoint = `${this.proxyUrl}/api/ai-chat/test-connections`;
    // Route through token-aware aliases to avoid 403 issues
    this.agentRunEndpoint = `${this.proxyUrl}/api/tw/run`;
    this.agentEventsEndpoint = `${this.proxyUrl}/api/tw/events`;
    this.agentToolResultEndpoint = `${this.proxyUrl}/api/agent/tool-result`; // Added new endpoint
    
    // Listen for settings changes to update behavior
    this.settingsUnsubscribe = aiSettingsService.onSettingsChange(() => {
      console.log('🤖 AI Service: Settings changed, updating behavior');
    });
    
    // Model configurations
    this.models = {
      'gpt-4': { provider: 'openai', model: 'gpt-4-0125-preview', maxTokens: 4096 },
      'gpt-4-turbo': { provider: 'openai', model: 'gpt-4-turbo-preview', maxTokens: 4096 },
      'gpt-4-vision': { provider: 'openai', model: 'gpt-4-vision-preview', maxTokens: 4096 },
      'gpt-3.5-turbo': { provider: 'openai', model: 'gpt-3.5-turbo-0125', maxTokens: 4096 },
      'claude-3.5-sonnet': { provider: 'claude', model: 'claude-3-5-sonnet-20241022', maxTokens: 8192 },
      'claude-3-haiku': { provider: 'claude', model: 'claude-3-haiku-20240307', maxTokens: 4096 }
    };
    
    // System prompts for different modes
    this.systemPrompts = {
      agent: `You are an expert architectural AI assistant integrated into StudioSix, a professional CAD application. You can:

🏗️ CREATE OBJECTS: Generate walls, slabs, doors, windows, columns, roofs, and stairs with specific dimensions
🔧 USE TOOLS: Select and activate different architectural tools in the toolbar
👁️ CONTROL VIEWS: Switch between 2D/3D views, zoom, and change themes
📁 MANAGE PROJECTS: Handle floors, save projects, and organize building hierarchy

🔍 VIEWPORT ANALYSIS - YOU HAVE VISUAL CONTEXT:
You receive comprehensive scene analysis that gives you "eyes" to see exactly what's in the viewport:
- DESCRIPTION: A human-readable description of what objects are visible and their spatial relationships
- ROOM ANALYSIS: Whether objects form proper rooms, dimensions, and architectural quality
- DESIGN RECOMMENDATIONS: Specific suggestions for improving the current design
- OBJECT COUNTS: Detailed inventory of all elements (walls, doors, windows, furniture, etc.)
- JOINERY STATUS: Whether walls are properly connected at corners
- SELECTION CONTEXT: What objects are currently selected by the user

🏢 PROJECT TREE & FLOOR MANAGEMENT:
You have complete access to the project's multi-floor structure and can manage floors:
- FLOOR CREATION: Create new floors with custom names and levels
- FLOOR INFORMATION: View all floors, current floor, and floor categories
- PROJECT STRUCTURE: Understand the hierarchical organization of elements
- FLOOR SWITCHING: Guide users to switch between floors in the project tree
- MULTI-LEVEL DESIGN: Help organize designs across multiple building levels

When giving advice, always reference what you can see in the scene analysis. For example:
- "I can see you have a 3m × 5m rectangular room with proper corner connections..."
- "Looking at your current design, I notice the walls aren't properly joined..."
- "Your room layout looks good, but I recommend adding windows for natural light..."

IMPORTANT CONTEXT AWARENESS:
- You can see the current tool selection, selected objects, view mode, and project state
- You have detailed viewport scene analysis with visual context
- Always provide specific, actionable architectural guidance based on what you observe
- Use metric units (meters) by default
- Be concise but comprehensive in your responses
- Include relevant emojis for visual clarity

RESPONSE FORMAT:
- Start by acknowledging what you can see in the viewport
- Provide specific dimensions when creating objects
- Reference existing elements when giving advice
- Explain architectural decisions based on current scene
- End with next suggested steps if relevant

You are NOT just a chatbot - you are an active copilot that can directly control the CAD environment AND see exactly what's in the viewport.`,

      ask: `You are an expert architectural consultant providing guidance for StudioSix CAD users. Your role is to:

📚 PROVIDE EXPERTISE: Answer questions about architecture, building codes, design principles
🔍 ANALYZE PROJECTS: Review current designs and provide professional feedback
👁️ VIEWPORT ANALYSIS: You can see exactly what's in the user's viewport through detailed scene analysis

VISUAL CONTEXT AVAILABLE:
You receive comprehensive scene analysis including:
- Detailed description of all visible objects and their relationships
- Room analysis with dimensions and architectural quality assessment
- Design recommendations specific to the current layout
- Object inventory and spatial arrangement
- Wall joinery status and structural connections

When providing architectural advice, always reference what you can observe in the scene. Base your recommendations on the actual current design state, not hypothetical scenarios.

💡 SUGGEST IMPROVEMENTS: Recommend better approaches, materials, or techniques
📐 EXPLAIN STANDARDS: Clarify architectural standards, dimensions, and best practices

RESPONSE STYLE:
- Professional and educational tone
- Reference relevant building codes and standards when applicable
- Provide practical, implementable advice
- Use clear explanations with examples

You focus on consultation and guidance rather than direct tool manipulation.`
    };
  }

  // NEW: TaskWeaver agent run helper
  async runTaskWeaver(goal, context = {}, model = null, maxSteps = 12) {
    try {
      const runId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const effectiveModel = this.getEffectiveModel(model);
      const pruned = this.pruneContextForMemoryHygiene(context, this.getChatSettings());

      console.log('[TW] runTaskWeaver -> starting', { runId, goal: String(goal).slice(0, 120), model: effectiveModel, maxSteps });

      const resp = await fetch(this.agentRunEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, goal, context: pruned, model: effectiveModel, maxSteps })
      });
      console.log('[TW] runTaskWeaver -> response status', resp.status);
      if (!resp.ok) {
        try { console.warn('[TW] runTaskWeaver -> error body', await resp.json()); } catch {}
        throw new Error('Agent service unavailable');
      }

      // Attach SSE stream to EventManager
      console.log('[TW] attachTaskWeaver -> attaching SSE', { runId, url: this.agentEventsEndpoint });
      this.attachTaskWeaver(runId);
      return { runId };
    } catch (e) {
      console.warn('[TW] runTaskWeaver -> failed', e);
      throw e;
    }
  }

  // NEW: Attach SSE and re-emit minimal events
  attachTaskWeaver(runId) {
    try {
      const url = `${this.agentEventsEndpoint}?runId=${encodeURIComponent(runId)}`;
      console.info('[TW] stream opening');
      const evt = new EventSource(url);
      evt.onopen = () => {
        console.info('[TW] stream open');
      };
      evt.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          // console.debug('[TW] evt:message', data?.type || 'message');
          eventManager.progress(runId, data);
        } catch {
          /* heartbeat or ping */
        }
      };
      evt.addEventListener('plan', (ev) => {
        try { const data = JSON.parse(ev.data); eventManager.progress(runId, data); } catch {}
      });
      evt.addEventListener('act', async (ev) => {
        let payload = null;
        try { payload = JSON.parse(ev.data); } catch { payload = null; }
        if (payload && payload.status === 'start' && payload.tool) {
          // Execute locally via our executor, then report result back
          try {
            const execResult = await (aiCommandExecutor.executeTool ? aiCommandExecutor.executeTool(payload.tool, payload.args || {}) : Promise.resolve({ ok: false, error: { code: 'E_NO_EXEC', title: 'No executor available' } }));
            await fetch(this.agentToolResultEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ runId, tool: payload.tool, result: { ok: true, data: execResult } })
            }).catch(() => {});
            eventManager.progress(runId, { type: 'act', status: 'result', tool: payload.tool, result: { ok: true } });
          } catch (e) {
            console.warn('[TW] local exec failed', e);
            await fetch(this.agentToolResultEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ runId, tool: payload.tool, result: { ok: false, error: { code: 'E_EXEC', title: 'Client exec failed', hint: String(e) } } })
            }).catch(() => {});
            eventManager.progress(runId, { type: 'act', status: 'result', tool: payload.tool, result: { ok: false } });
          }
        }
        try { eventManager.progress(runId, payload || {}); } catch {}
      });
      evt.addEventListener('critic', (ev) => {
        try { const data = JSON.parse(ev.data); eventManager.progress(runId, data); } catch {}
      });
      evt.addEventListener('replan', (ev) => {
        try { const data = JSON.parse(ev.data); eventManager.progress(runId, data); } catch {}
      });
      evt.addEventListener('assistant', (ev) => {
        try {
          const data = JSON.parse(ev.data);
          eventManager.progress(runId, { type: 'assistant', content: data.content });
        } catch {}
      });
      evt.addEventListener('done', (ev) => {
        try { const data = JSON.parse(ev.data); eventManager.done(runId, data); } catch {}
        evt.close();
      });
      evt.onerror = () => {
        console.warn('[TW] stream error');
        try { eventManager.progress(runId, { type: 'error', title: 'Agent stream error' }); } catch {}
        evt.close();
      };
    } catch (e) {
      console.warn('Failed to attach TaskWeaver stream:', e.message);
    }
  }

  /**
   * Get current AI chat settings
   */
  getChatSettings() {
    return aiSettingsService.getChatSettings();
  }

  /**
   * Get current AI render settings
   */
  getRenderSettings() {
    return aiSettingsService.getRenderSettings();
  }

  /**
   * Get BYOK settings for API key management
   */
  getBYOKSettings() {
    return aiSettingsService.getBYOKSettings();
  }

  /**
   * Get effective model and provider based on settings
   */
  getEffectiveModel(requestedModel) {
    const chatSettings = this.getChatSettings();
    
    // If no specific model requested, use settings default
    if (!requestedModel) {
      const provider = chatSettings.provider;
      const model = chatSettings.model;
      
      // Map from settings model ID to our internal model format
      return this.mapSettingsModelToInternal(provider, model);
    }
    
    return requestedModel;
  }

  /**
   * Map settings provider/model to internal model ID
   */
  mapSettingsModelToInternal(provider, modelId) {
    // Map provider and model from settings to our internal model IDs
    const mappings = {
      'openai': {
        'gpt-4': 'gpt-4',
        'gpt-4-turbo': 'gpt-4-turbo', 
        'gpt-3.5-turbo': 'gpt-3.5-turbo'
      },
      'anthropic': {
        'claude-3.5-sonnet': 'claude-3.5-sonnet',
        'claude-3-haiku': 'claude-3-haiku'
      }
    };
    
    return mappings[provider]?.[modelId] || 'gpt-4'; // fallback
  }

  /**
   * Get effective system prompt based on settings
   */
  getEffectiveSystemPrompt(mode) {
    const chatSettings = this.getChatSettings();
    
    // If settings specify custom system prompt, use that
    if (chatSettings.systemPrompt === 'custom' && chatSettings.customSystemPrompt) {
      return chatSettings.customSystemPrompt;
    }
    
    // Map settings prompt mode to our internal modes
    const settingsMode = chatSettings.systemPrompt || 'agent';
    const effectiveMode = mode || settingsMode;
    
    return this.systemPrompts[effectiveMode] || this.systemPrompts.agent;
  }

  /**
   * Check if user has exceeded usage limits (subscription-based)
   */
  async checkUsageLimits(actionType = 'ai_chat', actionDetails = {}) {
    // Check subscription-based limits using Supabase-backed service
    const canPerform = await subscriptionService.canPerformAction(actionType, actionDetails);
    if (!canPerform) {
      const tier = await subscriptionService.getCurrentTier();
      const subscription = await subscriptionService.getSubscription();
      if (actionType === 'ai_chat') {
        throw new Error(`Monthly AI token limit exceeded. Used: ${subscription.usage.aiTokensThisMonth}/${tier.limits.aiTokensPerMonth}. Upgrade to ${subscriptionService.getNextTier(tier.id)} for more tokens.`);
      }
      if (actionType === 'image_render') {
        throw new Error(`Monthly render limit exceeded. Used: ${subscription.usage.imageRendersThisMonth}/${tier.limits.imageRendersPerMonth}. Upgrade to ${subscriptionService.getNextTier(tier.id)} for more renders.`);
      }
      throw new Error(`Usage limit exceeded for ${actionType}. Please upgrade your plan.`);
    }
    return true;
  }

  /**
   * Check if model is available in current subscription
   */
  checkModelAccess(model) {
    const canAccess = subscriptionService.canPerformAction('model_access', { model });
    
    if (!canAccess) {
      const tier = subscriptionService.getCurrentTier();
      const availableModels = Array.isArray(tier.limits.availableModels) 
        ? tier.limits.availableModels.join(', ')
        : 'all models';
      
      throw new Error(`Model "${model}" not available in ${tier.name}. Available: ${availableModels}. Upgrade to access more models.`);
    }
    
    return true;
  }

  /**
   * Send message to AI with context via backend proxy
   */
  async sendMessage(message, selectedModel = null, mode = null, context = {}) {
    try {
      // Get effective model and settings
      const effectiveModel = this.getEffectiveModel(selectedModel);
      const effectiveMode = mode || this.getChatSettings().systemPrompt;
      const systemPrompt = this.getEffectiveSystemPrompt(effectiveMode);
      
      if (!this.models[effectiveModel]) {
        throw new Error(`Unsupported model: ${effectiveModel}`);
      }
      
      // Check subscription-based limits and model access
      this.checkModelAccess(effectiveModel);
      
      // Estimate token usage for limit checking
      const estimatedTokens = this.estimateTokens(message + systemPrompt);
      await this.checkUsageLimits('ai_chat', { 
        model: effectiveModel, 
        tokens: estimatedTokens 
      });
      
      // Get current settings for request parameters
      const chatSettings = this.getChatSettings();
      const byokSettings = this.getBYOKSettings();
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for AI requests
      
      // Apply memory hygiene to context (prune large conversation histories)
      const prunedContext = this.pruneContextForMemoryHygiene(context, chatSettings);

      // Prepare request payload with user settings
      const requestPayload = {
        message: message,
        model: effectiveModel,
        mode: effectiveMode,
        context: prunedContext,
        systemPrompt: systemPrompt,
        settings: {
          temperature: chatSettings.temperature,
          maxTokens: chatSettings.maxTokens,
          contextMemory: chatSettings.contextMemory,
          safetyFilters: chatSettings.safetyFilters
        }
      };
      
      // Add API key if BYOK is enabled
      if (byokSettings.enabled && byokSettings.apiKeys) {
        const modelProvider = this.models[effectiveModel].provider;
        const apiKey = byokSettings.apiKeys[modelProvider];
        if (apiKey) {
          requestPayload.apiKey = apiKey;
          requestPayload.useByok = true;
        }
      }
      
      const response = await fetch(this.aiChatEndpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error: ${response.status}`);
      }

      const data = await response.json();
      
      // Record precise token usage for billing
      const inputTokens = data.usage?.prompt_tokens || this.estimateTokens(message + systemPrompt);
      const llmText = data.message || data.response || '';
      const outputTokens = data.usage?.completion_tokens || this.estimateTokens(llmText);
      
      const cost = tokenUsageService.recordAIUsage(effectiveModel, inputTokens, outputTokens, {
        mode: effectiveMode,
        systemPrompt: systemPrompt.substring(0, 100) + '...', // Truncated for storage
        userId: subscriptionService.currentUserId
      });
      
      console.log('🤖 AI Service: Request completed with subscription enforcement:', {
        model: effectiveModel,
        mode: effectiveMode,
        userId: subscriptionService.currentUserId,
        tier: subscriptionService.getCurrentTier().name,
        cost: cost.cost,
        tokensUsed: cost.units,
        byokEnabled: byokSettings.enabled
      });
      
      return {
        message: llmText,
        model: data.model,
        provider: data.provider,
        usage: {
          ...data.usage,
          cost: cost.cost,
          tokenUnits: cost.units,
          tier: subscriptionService.getCurrentTier().name
        }
      };
      
    } catch (error) {
      console.error(`❌ AI Service error with ${selectedModel || 'settings-based model'}:`, error);
      const errorMessage = error.name === 'AbortError' 
        ? 'Request timeout - AI service took too long to respond'
        : `Failed to get response: ${error.message}`;
      throw new Error(errorMessage);
    }
  }


  /**
   * Get available models (enhanced with settings info)
   */
  getAvailableModels() {
    const chatSettings = this.getChatSettings();
    const currentModel = this.getEffectiveModel();
    
    return Object.keys(this.models).map(key => ({
      id: key,
      name: this.getModelDisplayName(key),
      provider: this.models[key].provider,
      maxTokens: this.models[key].maxTokens,
      isCurrentDefault: key === currentModel,
      isFromSettings: chatSettings.provider && chatSettings.model
    }));
  }

  /**
   * Get current effective model info
   */
  getCurrentModelInfo() {
    const effectiveModel = this.getEffectiveModel();
    const chatSettings = this.getChatSettings();
    const byokSettings = this.getBYOKSettings();
    
    return {
      model: effectiveModel,
      displayName: this.getModelDisplayName(effectiveModel),
      provider: this.models[effectiveModel]?.provider,
      maxTokens: this.models[effectiveModel]?.maxTokens,
      temperature: chatSettings.temperature,
      systemPrompt: chatSettings.systemPrompt,
      usingByok: byokSettings.enabled,
      userId: aiSettingsService.getCurrentUserId()
    };
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Get subscription status and limits
   */
  getSubscriptionStatus() {
    const tier = subscriptionService.getCurrentTier();
    const subscription = subscriptionService.getSubscription();
    const usage = subscriptionService.getUsageStats();
    
    return {
      tier: tier.name,
      tierId: tier.id,
      price: `$${tier.price}/${tier.period}`,
      usage: {
        aiTokens: {
          used: subscription.usage.aiTokensThisMonth,
          limit: tier.limits.aiTokensPerMonth,
          percentage: usage.aiTokens.percentage,
          remaining: tier.limits.aiTokensPerMonth - subscription.usage.aiTokensThisMonth
        },
        imageRenders: {
          used: subscription.usage.imageRendersThisMonth,
          limit: tier.limits.imageRendersPerMonth,
          percentage: usage.imageRenders.percentage,
          remaining: tier.limits.imageRendersPerMonth === -1 ? 'Unlimited' : 
                    tier.limits.imageRendersPerMonth - subscription.usage.imageRendersThisMonth
        }
      },
      availableModels: tier.limits.availableModels,
      canExportBIM: tier.limits.canExportBIM,
      canExportHighRes: tier.limits.canExportHighRes,
      warnings: tokenUsageService.getUsageWarnings(),
      recommendations: subscriptionService.getUpgradeRecommendations()
    };
  }

  /**
   * Create image render with subscription enforcement
   */
  async createImageRender(prompt, resolution = '1024x1024', format = 'jpg') {
    try {
      // Check subscription limits
      await this.checkUsageLimits('image_render');
      
      // Check resolution access
      const tier = subscriptionService.getCurrentTier();
      const maxRes = tier.limits.maxImageResolution;
      if (!this.isResolutionAllowed(resolution, maxRes)) {
        throw new Error(`Resolution ${resolution} not available in ${tier.name}. Max resolution: ${maxRes}. Upgrade for higher resolution.`);
      }
      
      // Check format access
      if (!tier.limits.imageFormats.includes(format)) {
        throw new Error(`Format ${format} not available in ${tier.name}. Available formats: ${tier.limits.imageFormats.join(', ')}.`);
      }
      
      // Record usage and cost
      const cost = tokenUsageService.recordImageUsage(resolution, format, {
        prompt: prompt.substring(0, 100) + '...', // Truncated
        userId: subscriptionService.currentUserId
      });
      
      console.log('🎨 Image Render: Request with subscription enforcement:', {
        resolution,
        format,
        tier: tier.name,
        cost: cost.cost,
        userId: subscriptionService.currentUserId
      });
      
      // Here would be the actual image generation call to your backend
      // For now, return a mock response
      return {
        success: true,
        imageUrl: 'generated_image_url',
        resolution,
        format,
        cost: cost.cost,
        tier: tier.name
      };
      
    } catch (error) {
      console.error('❌ Image Render error:', error);
      throw error;
    }
  }

  /**
   * Check if resolution is allowed in current tier
   */
  isResolutionAllowed(requested, maxAllowed) {
    const resolutions = {
      '512x512': 512,
      '768x768': 768,
      '1024x1024': 1024,
      '2048x2048': 2048
    };
    
    const requestedSize = resolutions[requested] || 512;
    const maxSize = resolutions[maxAllowed] || 512;
    
    return requestedSize <= maxSize;
  }

  /**
   * Export BIM with subscription enforcement
   */
  async exportBIM(format = 'ifc', projectData = {}) {
    try {
      // Check BIM export permission
      const tier = subscriptionService.getCurrentTier();
      if (!tier.limits.canExportBIM) {
        throw new Error(`BIM export not available in ${tier.name}. Upgrade to Pro or higher for BIM exports.`);
      }
      
      // Record usage and cost
      const cost = tokenUsageService.recordBIMUsage(`${format}_export`, {
        format,
        projectSize: JSON.stringify(projectData).length,
        userId: subscriptionService.currentUserId
      });
      
      console.log('📐 BIM Export: Request with subscription enforcement:', {
        format,
        tier: tier.name,
        cost: cost.cost,
        userId: subscriptionService.currentUserId
      });
      
      // Here would be the actual BIM export call
      return {
        success: true,
        format,
        downloadUrl: 'export_download_url',
        cost: cost.cost,
        tier: tier.name
      };
      
    } catch (error) {
      console.error('❌ BIM Export error:', error);
      throw error;
    }
  }

  /**
   * Clean up service resources
   */
  cleanup() {
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
      this.settingsUnsubscribe = null;
    }
  }

  /**
   * Get display name for model
   */
  getModelDisplayName(modelId) {
    const names = {
      'gpt-4': 'GPT-4',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-vision': 'GPT-4 Vision',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'claude-3.5-sonnet': 'Claude 3.5 Sonnet',
      'claude-3-haiku': 'Claude 3 Haiku'
    };
    return names[modelId] || modelId;
  }

  /**
   * Check if model supports vision/images
   */
  supportsVision(modelId) {
    return modelId === 'gpt-4-vision' || modelId.startsWith('claude-3');
  }

  /**
   * Process uploaded files for AI context
   */
  async processUploadedFiles(files) {
    const processedFiles = [];
    
    for (const file of files) {
      if (file.isImage && file.preview) {
        processedFiles.push({
          type: 'image',
          data: file.preview,
          name: file.name,
          description: `Image file: ${file.name}`
        });
      } else if (file.isCADFile) {
        processedFiles.push({
          type: 'cad',
          name: file.name,
          extension: file.extension,
          description: `CAD file: ${file.name} (${file.extension.toUpperCase()})`
        });
      } else {
        processedFiles.push({
          type: 'document',
          name: file.name,
          description: `Document: ${file.name}`
        });
      }
    }
    
    return processedFiles;
  }

  /**
   * Get AI connection status via backend proxy
   */
  async testConnections() {
    // Always return a safe response - never throw
    try {
      // Check if proxy URL is available first
      if (!this.proxyUrl || this.proxyUrl.includes('localhost')) {
        // Localhost proxy may not be running - return offline status
        return {
          openai: false,
          claude: false,
          available: false,
          errors: {
            connection: 'AI proxy server not running (localhost:8001)'
          }
        };
      }

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(this.testConnectionsEndpoint, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      // Always return a safe error response - never throw
      const errorMessage = error.name === 'AbortError' 
        ? 'Connection timeout' 
        : error.message || 'Connection failed';
        
      return {
        openai: false,
        claude: false,
        available: false,
        errors: {
          connection: errorMessage
        }
      };
    }
  }

  /**
   * Apply memory hygiene to context - prune large conversation histories
   */
  pruneContextForMemoryHygiene(context, chatSettings) {
    if (!context) return context;

    const prunedContext = { ...context };
    
    // Get memory limits from agent config if available
    const memoryLimit = chatSettings.contextMemory || 20;
    
    // Prune recent messages if they exceed limit
    if (context.recentMessages && Array.isArray(context.recentMessages)) {
      if (context.recentMessages.length > memoryLimit) {
        prunedContext.recentMessages = context.recentMessages.slice(-memoryLimit);
        console.log(`🧹 AIService: Pruned conversation history from ${context.recentMessages.length} to ${memoryLimit} messages`);
      }
    }
    
    // Prune large file uploads (keep only essential metadata)
    if (context.uploadedFiles && Array.isArray(context.uploadedFiles)) {
      prunedContext.uploadedFiles = context.uploadedFiles.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        isImage: file.isImage,
        isCADFile: file.isCADFile,
        extension: file.extension,
        // Remove large preview data
        preview: file.preview ? '[IMAGE_DATA_PRUNED]' : undefined
      }));
    }
    
    // Prune large object collections
    if (context.objects && Array.isArray(context.objects)) {
      if (context.objects.length > 100) {
        prunedContext.objects = context.objects.slice(0, 100);
        prunedContext.objectsPruned = context.objects.length - 100;
        console.log(`🧹 AIService: Pruned objects list from ${context.objects.length} to 100 items`);
      }
    }
    
    // Prune detailed viewport data, keep only essentials
    if (context.viewport) {
      prunedContext.viewport = {
        type: context.viewport.type,
        camera: context.viewport.camera ? {
          position: context.viewport.camera.position,
          target: context.viewport.camera.target
        } : undefined,
        objects: context.viewport.objects ? 
                 `${context.viewport.objects.length} objects in view` : undefined
        // Remove detailed geometry data
      };
    }
    
    return prunedContext;
  }

  /**
   * Clean up service resources and old data
   */
  performMemoryHygiene() {
    try {
      // Clear any cached data older than 1 hour
      const maxAge = 3600000; // 1 hour
      const cutoff = Date.now() - maxAge;
      
      // This would clean up any internal caches if we had them
      // For now, just log the cleanup
      console.log('🧹 AIService: Performed memory hygiene cleanup');
      
      // Could add cleanup for:
      // - Cached responses
      // - Old conversation contexts
      // - Temporary file references
      
    } catch (error) {
      console.error('❌ AIService: Memory hygiene failed:', error);
    }
  }
}

// Export singleton instance
const aiService = new AIService();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.aiService = aiService;
  console.log('🤖 AI Service available at window.aiService');
}

export default aiService;