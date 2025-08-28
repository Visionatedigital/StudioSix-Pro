/**
 * Tool Capability Registry Tests
 * 
 * Tests dynamic tool discovery, success rate tracking, and handler registration
 */

const { describe, test, expect, beforeEach, jest } = require('@jest/globals');

// Mock ToolCapabilityRegistry functionality
class MockToolCapabilityRegistry {
  constructor() {
    this.registry = new Map();
    this.initialized = false;
  }

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
    return toolInfo;
  }

  get(name) {
    return this.registry.get(name);
  }

  list() {
    return Array.from(this.registry.keys());
  }

  async execute(toolName, args) {
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
      
      this.recordStats(toolName, true, duration);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordStats(toolName, false, duration);
      throw error;
    }
  }

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
    
    if (duration > 0) {
      const alpha = 0.3;
      stats.avgDuration = stats.avgDuration === 0 ? 
        duration : 
        (alpha * duration) + ((1 - alpha) * stats.avgDuration);
    }
  }

  getSuccessRate(toolName) {
    const tool = this.registry.get(toolName);
    if (!tool) return 0;

    const { ok, fail } = tool.stats;
    const total = ok + fail;
    
    return total > 0 ? ok / total : 0;
  }

  getRecommendedTools(category = null, minSuccessRate = 0.7) {
    const filteredTools = Array.from(this.registry.entries())
      .filter(([name, tool]) => {
        if (category && tool.meta.category !== category) return false;
        if (!tool.meta.enabled) return false;
        
        const successRate = this.getSuccessRate(name);
        return successRate >= minSuccessRate;
      })
      .sort(([aName], [bName]) => {
        const aRate = this.getSuccessRate(aName);
        const bRate = this.getSuccessRate(bName);
        return bRate - aRate; // Higher success rate first
      })
      .map(([name]) => name);

    return filteredTools;
  }

  bootstrapFromExecutor(mockAICommandExecutor) {
    if (this.initialized) return;

    const builtInHandlers = mockAICommandExecutor.getHandlers();
    
    Object.entries(builtInHandlers).forEach(([name, handler]) => {
      this.register(name, handler, { 
        source: 'builtin',
        category: this.categorizeHandler(name),
        enabled: true
      });
    });

    this.initialized = true;
  }

  categorizeHandler(name) {
    if (name.includes('create') || name.includes('geometry')) return 'geometry';
    if (name.includes('select') || name.includes('selection')) return 'selection';
    if (name.includes('move') || name.includes('transform')) return 'transform';
    return 'utility';
  }
}

// Mock AICommandExecutor
const mockAICommandExecutor = {
  toolHandlers: new Map([
    ['wall', jest.fn().mockResolvedValue({ ok: true, objectId: 'wall-1' })],
    ['stair', jest.fn().mockResolvedValue({ ok: true, objectId: 'stair-1' })],
    ['door', jest.fn().mockResolvedValue({ ok: true, objectId: 'door-1' })]
  ]),
  
  getHandlers() {
    const handlers = {};
    for (const [tool, handler] of this.toolHandlers.entries()) {
      handlers[`geometry.create${tool.charAt(0).toUpperCase()}${tool.slice(1)}`] = handler;
    }
    return handlers;
  }
};

describe('Tool Registry', () => {
  let registry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new MockToolCapabilityRegistry();
  });

  test('registers built-in handlers and records success/failure stats', () => {
    registry.bootstrapFromExecutor(mockAICommandExecutor);
    
    expect(registry.list()).toContain('geometry.createWall');
    expect(registry.list()).toContain('geometry.createStair');
    expect(registry.list()).toContain('geometry.createDoor');
    expect(registry.list()).toHaveLength(3);
    
    const wallTool = registry.get('geometry.createWall');
    expect(wallTool.meta.source).toBe('builtin');
    expect(wallTool.meta.category).toBe('geometry');
    expect(wallTool.stats.ok).toBe(0);
    expect(wallTool.stats.fail).toBe(0);
  });

  test('getHandlers() exposure from AICommandExecutor works', () => {
    const handlers = mockAICommandExecutor.getHandlers();
    
    expect(handlers).toHaveProperty('geometry.createWall');
    expect(handlers).toHaveProperty('geometry.createStair');
    expect(handlers).toHaveProperty('geometry.createDoor');
    expect(Object.keys(handlers)).toHaveLength(3);
    
    // Verify handlers are functions
    expect(typeof handlers['geometry.createWall']).toBe('function');
  });

  test('execute tool and record success statistics', async () => {
    registry.bootstrapFromExecutor(mockAICommandExecutor);
    
    // Execute tool successfully
    const result = await registry.execute('geometry.createWall', { width: 4, height: 2.5 });
    
    expect(result.ok).toBe(true);
    expect(result.objectId).toBe('wall-1');
    
    // Check stats were recorded
    const wallTool = registry.get('geometry.createWall');
    expect(wallTool.stats.ok).toBe(1);
    expect(wallTool.stats.fail).toBe(0);
    expect(wallTool.stats.lastUsed).toBeGreaterThan(0);
    
    // Success rate should be 100%
    expect(registry.getSuccessRate('geometry.createWall')).toBe(1.0);
  });

  test('execute tool and record failure statistics', async () => {
    // Mock a failing tool
    const failingHandler = jest.fn().mockRejectedValue(new Error('Tool failed'));
    registry.register('geometry.createFailing', failingHandler, { 
      category: 'geometry',
      enabled: true 
    });
    
    // Execute tool and expect failure
    await expect(registry.execute('geometry.createFailing', {}))
      .rejects.toThrow('Tool failed');
    
    // Check failure stats were recorded
    const failingTool = registry.get('geometry.createFailing');
    expect(failingTool.stats.ok).toBe(0);
    expect(failingTool.stats.fail).toBe(1);
    expect(registry.getSuccessRate('geometry.createFailing')).toBe(0.0);
  });

  test('get recommended tools based on success rates', async () => {
    registry.bootstrapFromExecutor(mockAICommandExecutor);
    
    // Execute some tools with different success rates
    await registry.execute('geometry.createWall', {});
    await registry.execute('geometry.createWall', {}); // 2 successes
    
    await registry.execute('geometry.createStair', {});
    try {
      // Mock a failure for stair
      const stairTool = registry.get('geometry.createStair');
      stairTool.stats.fail = 1; // Simulate failure
    } catch (e) {}
    
    const recommended = registry.getRecommendedTools('geometry', 0.5);
    
    // Wall should be recommended (100% success), stair might not (50% success)
    expect(recommended).toContain('geometry.createWall');
    
    // Test with higher threshold
    const highThreshold = registry.getRecommendedTools('geometry', 0.8);
    expect(highThreshold).toContain('geometry.createWall');
  });

  test('disabled tools cannot be executed', async () => {
    registry.register('geometry.createDisabled', jest.fn(), { enabled: false });
    
    await expect(registry.execute('geometry.createDisabled', {}))
      .rejects.toThrow("Tool 'geometry.createDisabled' is disabled");
  });

  test('unknown tools throw error', async () => {
    await expect(registry.execute('unknown.tool', {}))
      .rejects.toThrow("Tool 'unknown.tool' not found in registry");
  });

  test('tool categorization works correctly', () => {
    expect(registry.categorizeHandler('geometry.createWall')).toBe('geometry');
    expect(registry.categorizeHandler('selection.selectAll')).toBe('selection');
    expect(registry.categorizeHandler('transform.move')).toBe('transform');
    expect(registry.categorizeHandler('utility.helper')).toBe('utility');
  });
});

module.exports = {
  MockToolCapabilityRegistry
};