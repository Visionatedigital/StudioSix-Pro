/**
 * AI Service for StudioSix
 * 
 * Handles communication with multiple AI providers:
 * - OpenAI (GPT-4, GPT-4 Turbo, GPT-3.5 Turbo)
 * - Anthropic Claude (Claude 3.5 Sonnet, Claude 3 Haiku)
 * 
 * Provides unified interface for architectural AI assistance
 */

class AIService {
  constructor() {
    // Use simple AI proxy server to avoid CORS issues
    this.proxyUrl = process.env.REACT_APP_AI_PROXY_URL || 'http://localhost:8002';
    this.aiChatEndpoint = `${this.proxyUrl}/api/ai-chat`;
    this.testConnectionsEndpoint = `${this.proxyUrl}/api/ai-chat/test-connections`;
    
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
- Include relevant architectural terminology

You focus on consultation and guidance rather than direct tool manipulation.`
    };
  }

  /**
   * Send message to AI with context via backend proxy
   */
  async sendMessage(message, selectedModel = 'gpt-4', mode = 'agent', context = {}) {
    if (!this.models[selectedModel]) {
      throw new Error(`Unsupported model: ${selectedModel}`);
    }

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for AI requests
      
      const response = await fetch(this.aiChatEndpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          model: selectedModel,
          mode: mode,
          context: context
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        message: data.message,
        model: data.model,
        provider: data.provider,
        usage: data.usage
      };
      
    } catch (error) {
      console.error(`❌ AI Service error with ${selectedModel}:`, error);
      const errorMessage = error.name === 'AbortError' 
        ? 'Request timeout - AI service took too long to respond'
        : `Failed to get response from ${selectedModel}: ${error.message}`;
      throw new Error(errorMessage);
    }
  }


  /**
   * Get available models
   */
  getAvailableModels() {
    return Object.keys(this.models).map(key => ({
      id: key,
      name: this.getModelDisplayName(key),
      provider: this.models[key].provider
    }));
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
}

// Export singleton instance
const aiService = new AIService();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.aiService = aiService;
  console.log('🤖 AI Service available at window.aiService');
}

export default aiService;