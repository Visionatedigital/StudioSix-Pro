/**
 * ToolCapabilityRegistry - Dynamic tool registry with success tracking
 * 
 * Decorates AICommandExecutor's handlers with metadata and outcome statistics
 * Supports dynamic capability discovery and tool performance tracking
 */

import aiCommandExecutor from './AICommandExecutor';

class ToolCapabilityRegistry {
  constructor() {
    this.registry = new Map();
    this.stats = new Map();
    this.capabilities = new Map();
    this.initialized = false;
    
    this.bootstrapFromExecutor();
    console.log('🛠️ ToolCapabilityRegistry: Initialized with dynamic capability tracking');
  }

  /**
   * Bootstrap registry from existing AICommandExecutor handlers
   */
  bootstrapFromExecutor() {
    if (this.initialized) return;

    try {
      // Get built-in handlers from AICommandExecutor
      const builtInHandlers = this.extractExecutorHandlers();
      
      Object.entries(builtInHandlers).forEach(([name, handler]) => {
        this.register(name, handler, { 
          source: 'builtin',
          category: this.categorizeHandler(name),
          enabled: true,
          lastUsed: null
        });
      });

      // Register additional capabilities we know about
      this.registerKnownCapabilities();
      
      this.initialized = true;
      console.log(`🛠️ ToolCapabilityRegistry: Bootstrapped with ${this.registry.size} tools`);
      
    } catch (error) {
      console.error('❌ ToolCapabilityRegistry: Bootstrap failed:', error);
      this.registerFallbackCapabilities();
      this.initialized = true;
    }
  }

  /**
   * Extract handler functions from AICommandExecutor
   */
  extractExecutorHandlers() {
    const handlers = {};

    // Try to get handlers via public API
    if (typeof aiCommandExecutor.getHandlers === 'function') {
      return aiCommandExecutor.getHandlers();
    }

    // Fallback: Extract from known handler patterns in AICommandExecutor
    const knownTools = [
      'wall', 'slab', 'door', 'window', 'column', 'roof', 'stair',
      'beam', 'furniture', 'light', 'camera'
    ];

    knownTools.forEach(tool => {
      const handlerName = `create${tool.charAt(0).toUpperCase()}${tool.slice(1)}`;
      if (typeof aiCommandExecutor[handlerName] === 'function') {
        handlers[`geometry.create${tool.charAt(0).toUpperCase()}${tool.slice(1)}`] = 
          aiCommandExecutor[handlerName].bind(aiCommandExecutor);
      }
    });

    return handlers;
  }

  /**
   * Register known capabilities that may not be exposed directly
   */
  registerKnownCapabilities() {
    const knownCapabilities = [
      // Selection operations
      { name: 'selection.select', category: 'selection', description: 'Select objects in the scene' },
      { name: 'selection.clear', category: 'selection', description: 'Clear current selection' },
      { name: 'selection.invert', category: 'selection', description: 'Invert current selection' },
      
      // Transform operations  
      { name: 'transform.move', category: 'transform', description: 'Move objects in 3D space' },
      { name: 'transform.rotate', category: 'transform', description: 'Rotate objects around axes' },
      { name: 'transform.scale', category: 'transform', description: 'Scale objects uniformly or non-uniformly' },
      
      // Geometry editing
      { name: 'geometry.editWall', category: 'geometry', description: 'Modify wall properties' },
      { name: 'geometry.editSlab', category: 'geometry', description: 'Modify slab properties' },
      { name: 'geometry.editStair', category: 'geometry', description: 'Modify stair properties' },
      
      // Analysis operations
      { name: 'analysis.structural', category: 'analysis', description: 'Analyze structural feasibility' },
      { name: 'analysis.spatial', category: 'analysis', description: 'Analyze spatial relationships' },
      
      // Document operations
      { name: 'document.commitCheckpoint', category: 'document', description: 'Create document checkpoint' },
      { name: 'document.undo', category: 'document', description: 'Undo last operation' },
      { name: 'document.redo', category: 'document', description: 'Redo last undone operation' }
    ];

    knownCapabilities.forEach(cap => {
      if (!this.registry.has(cap.name)) {
        this.register(cap.name, this.createProxyHandler(cap.name), {
          source: 'known',
          category: cap.category,
          description: cap.description,
          enabled: true
        });
      }
    });
  }

  /**
   * Register fallback capabilities when bootstrap fails
   */
  registerFallbackCapabilities() {
    const fallbackTools = ['wall', 'slab', 'door', 'window'];
    
    fallbackTools.forEach(tool => {
      const name = `geometry.create${tool.charAt(0).toUpperCase()}${tool.slice(1)}`;
      this.register(name, this.createProxyHandler(name), {
        source: 'fallback',
        category: 'geometry',
        enabled: true
      });
    });
  }

  /**
   * Create a proxy handler for tools we know about but can't directly access
   */
  createProxyHandler(toolName) {
    return async (args) => {
      try {
        // Try to route through AICommandExecutor
        if (typeof aiCommandExecutor.executeTool === 'function') {
          return await aiCommandExecutor.executeTool(toolName, args);
        }
        
        // Or try a generic execution method
        const [category, operation] = toolName.split('.');
        if (category === 'geometry' && aiCommandExecutor.createObject) {
          const objectType = operation.replace('create', '').toLowerCase();
          return await aiCommandExecutor.createObject(objectType, args);
        }
        
        throw new Error(`No handler available for ${toolName}`);
        
      } catch (error) {
        console.error(`❌ ToolCapabilityRegistry: Proxy handler failed for ${toolName}:`, error);
        return { ok: false, error: error.message };
      }
    };
  }

  /**
   * Register a tool with metadata
   */
  register(name, handler, meta = {}) {
    const toolInfo = {
      handler,
      meta: {
        category: 'uncategorized',
        description: '',
        enabled: true,
        source: 'manual',
        ...meta
      },
      stats: { ok: 0, fail: 0, lastUsed: null, avgDuration: 0 }
    };

    this.registry.set(name, toolInfo);
    console.log(`🛠️ ToolCapabilityRegistry: Registered ${name} (${toolInfo.meta.category})`);
    return toolInfo;
  }

  /**
   * Get tool handler and metadata
   */
  get(name) {
    return this.registry.get(name);
  }

  /**
   * Get handler function directly
   */
  getHandler(name) {
    const tool = this.registry.get(name);
    return tool?.handler;
  }

  /**
   * List all available tools
   */
  list(category = null) {
    const tools = Array.from(this.registry.keys());
    
    if (!category) return tools;
    
    return tools.filter(name => {
      const tool = this.registry.get(name);
      return tool?.meta.category === category;
    });
  }

  /**
   * Get tools by category
   */
  getByCategory(category) {
    const tools = {};
    
    for (const [name, toolInfo] of this.registry.entries()) {
      if (toolInfo.meta.category === category) {
        tools[name] = toolInfo;
      }
    }
    
    return tools;
  }

  /**
   * Execute a tool and record statistics
   */
  async execute(toolName, args = {}) {
    const tool = this.registry.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in registry`);
    }

    if (!tool.meta.enabled) {
      throw new Error(`Tool '${toolName}' is disabled`);
    }

    const startTime = Date.now();
    
    try {
      const result = await tool.handler(args);
      const duration = Date.now() - startTime;
      
      // Record successful execution
      this.recordStats(toolName, true, duration);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failed execution  
      this.recordStats(toolName, false, duration);
      
      throw error;
    }
  }

  /**
   * Record execution statistics
   */
  recordStats(toolName, success, duration = 0) {
    const tool = this.registry.get(toolName);
    if (!tool) return;

    const stats = tool.stats;
    
    if (success) {
      stats.ok++;
    } else {
      stats.fail++;
    }
    
    stats.lastUsed = Date.now();
    
    // Update average duration (exponential moving average)
    if (duration > 0) {
      const alpha = 0.3; // Smoothing factor
      stats.avgDuration = stats.avgDuration === 0 ? 
        duration : 
        (alpha * duration) + ((1 - alpha) * stats.avgDuration);
    }

    console.log(`📊 ToolCapabilityRegistry: ${toolName} ${success ? 'succeeded' : 'failed'} (${duration}ms)`);
  }

  /**
   * Get tool success rate
   */
  getSuccessRate(toolName) {
    const tool = this.registry.get(toolName);
    if (!tool) return 0;

    const { ok, fail } = tool.stats;
    const total = ok + fail;
    
    return total > 0 ? ok / total : 0;
  }

  /**
   * Get recommended tools based on success rates and usage
   */
  getRecommendedTools(category = null, minSuccessRate = 0.7) {
    const tools = category ? this.getByCategory(category) : Object.fromEntries(this.registry);
    
    return Object.entries(tools)
      .filter(([name, tool]) => {
        const successRate = this.getSuccessRate(name);
        return tool.meta.enabled && successRate >= minSuccessRate;
      })
      .sort(([aName], [bName]) => {
        // Sort by success rate and recent usage
        const aRate = this.getSuccessRate(aName);
        const bRate = this.getSuccessRate(bName);
        const aRecent = tools[aName].stats.lastUsed || 0;
        const bRecent = tools[bName].stats.lastUsed || 0;
        
        // Primary: success rate, Secondary: recent usage
        if (Math.abs(aRate - bRate) > 0.1) {
          return bRate - aRate; // Higher success rate first
        }
        return bRecent - aRecent; // More recently used first
      })
      .map(([name]) => name);
  }

  /**
   * Categorize handler based on name pattern
   */
  categorizeHandler(name) {
    if (name.includes('create') || name.includes('geometry')) return 'geometry';
    if (name.includes('select') || name.includes('selection')) return 'selection';
    if (name.includes('move') || name.includes('transform')) return 'transform';
    if (name.includes('analyze') || name.includes('analysis')) return 'analysis';
    if (name.includes('document') || name.includes('undo')) return 'document';
    return 'utility';
  }

  /**
   * Enable/disable a tool
   */
  setEnabled(toolName, enabled) {
    const tool = this.registry.get(toolName);
    if (tool) {
      tool.meta.enabled = enabled;
      console.log(`🛠️ ToolCapabilityRegistry: ${toolName} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get comprehensive registry statistics
   */
  getStatistics() {
    const categories = {};
    let totalExecutions = 0;
    let totalSuccesses = 0;

    for (const [name, tool] of this.registry.entries()) {
      const category = tool.meta.category;
      const executions = tool.stats.ok + tool.stats.fail;
      
      if (!categories[category]) {
        categories[category] = { tools: 0, executions: 0, successes: 0 };
      }
      
      categories[category].tools++;
      categories[category].executions += executions;
      categories[category].successes += tool.stats.ok;
      
      totalExecutions += executions;
      totalSuccesses += tool.stats.ok;
    }

    return {
      totalTools: this.registry.size,
      totalExecutions,
      overallSuccessRate: totalExecutions > 0 ? totalSuccesses / totalExecutions : 0,
      categories,
      mostUsedTool: this.getMostUsedTool(),
      bestPerformingTool: this.getBestPerformingTool()
    };
  }

  /**
   * Get most frequently used tool
   */
  getMostUsedTool() {
    let maxUsage = 0;
    let mostUsed = null;

    for (const [name, tool] of this.registry.entries()) {
      const usage = tool.stats.ok + tool.stats.fail;
      if (usage > maxUsage) {
        maxUsage = usage;
        mostUsed = name;
      }
    }

    return mostUsed;
  }

  /**
   * Get best performing tool (highest success rate with min usage)
   */
  getBestPerformingTool(minUsage = 3) {
    let bestRate = 0;
    let bestTool = null;

    for (const [name, tool] of this.registry.entries()) {
      const usage = tool.stats.ok + tool.stats.fail;
      if (usage >= minUsage) {
        const rate = this.getSuccessRate(name);
        if (rate > bestRate) {
          bestRate = rate;
          bestTool = name;
        }
      }
    }

    return bestTool;
  }

  /**
   * Clean up old statistics (memory hygiene)
   */
  cleanupStats(maxAge = 86400000) { // 24 hours
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const [name, tool] of this.registry.entries()) {
      if (tool.stats.lastUsed && tool.stats.lastUsed < cutoff) {
        // Reset old stats but keep the tool registered
        tool.stats = { ok: 0, fail: 0, lastUsed: null, avgDuration: 0 };
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 ToolCapabilityRegistry: Cleaned stats for ${cleaned} tools`);
    }
  }
}

// Create singleton instance
const toolCapabilityRegistry = new ToolCapabilityRegistry();

// Convenience object for external usage (matches original interface)
export const ToolStats = {
  record: (name, ok) => toolCapabilityRegistry.recordStats(name, ok),
  get: (name) => toolCapabilityRegistry.get(name)?.stats,
  getSuccessRate: (name) => toolCapabilityRegistry.getSuccessRate(name)
};

// Make available for debugging
if (typeof window !== 'undefined') {
  window.toolCapabilityRegistry = toolCapabilityRegistry;
  console.log('🛠️ ToolCapabilityRegistry available at window.toolCapabilityRegistry');
}

export default toolCapabilityRegistry;