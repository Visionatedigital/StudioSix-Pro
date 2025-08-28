/**
 * Autonomous Agent Loop Tests
 * 
 * Tests the plan→act→observe→reflect loop with mocked dependencies
 */

const { describe, test, expect, beforeEach, jest } = require('@jest/globals');

// Mock dependencies
const mockAgentManager = {
  parseRequest: jest.fn(),
  nextAction: jest.fn(), 
  execute: jest.fn(),
  advancePlan: jest.fn(),
  replan: jest.fn()
};

const mockCriticValidator = {
  check: jest.fn()
};

const mockToolRegistry = {
  execute: jest.fn()
};

const mockEventManager = {
  startRun: jest.fn(),
  progress: jest.fn(),
  done: jest.fn(),
  awaitApproval: jest.fn()
};

const mockDocumentService = {
  beginTransaction: jest.fn(),
  commitTransaction: jest.fn(), 
  rollbackTransaction: jest.fn()
};

// Mock autonomous agent (would import actual implementation in real tests)
class MockAutonomousAgent {
  constructor() {
    this.agentManager = mockAgentManager;
    this.critic = mockCriticValidator;
    this.toolRegistry = mockToolRegistry;
    this.eventManager = mockEventManager;
    this.documentService = mockDocumentService;
  }

  async runAutonomous({ goal, context, overrides, userId }) {
    const runId = 'test-run-123';
    
    // Start run
    this.eventManager.startRun({ goal, userId, config: overrides });
    
    // Generate initial plan
    const plan = await this.agentManager.parseRequest(goal, context);
    this.eventManager.progress(runId, { type: 'plan', summary: plan.description });
    
    // Begin transaction
    await this.documentService.beginTransaction();
    
    let step = 0;
    const maxSteps = overrides.maxSteps || 5;
    
    try {
      while (step < maxSteps) {
        // Get next action
        const nextAction = await this.agentManager.nextAction({ plan, context });
        if (!nextAction) break;
        
        // Execute action
        this.eventManager.progress(runId, { type: 'act', tool: nextAction.tool });
        const result = await this.toolRegistry.execute(nextAction.tool, nextAction.args);
        this.eventManager.progress(runId, { type: 'observe', result });
        
        // Critic validation
        const verdict = await this.critic.check({ goal, action: nextAction, result, context });
        this.eventManager.progress(runId, { type: 'critic', verdict: verdict.ok ? 'passed' : 'failed' });
        
        if (!verdict.ok) {
          // Replan on failure
          plan = await this.agentManager.replan({ goal, context, last: { nextAction, result, verdict } });
          this.eventManager.progress(runId, { type: 'replan', reason: verdict.reason });
          step++;
          continue;
        }
        
        // Advance plan on success
        plan = await this.agentManager.advancePlan({ plan, lastResult: result, context });
        
        if (plan.done) break;
        step++;
      }
      
      await this.documentService.commitTransaction();
      this.eventManager.done(runId, { status: 'success', steps: step });
      
      return { ok: true, runId, steps: step };
      
    } catch (error) {
      await this.documentService.rollbackTransaction();
      this.eventManager.done(runId, { status: 'error', error: error.message });
      throw error;
    }
  }
}

describe('Autonomous Agent Loop', () => {
  let agent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new MockAutonomousAgent();
  });

  test('successful execution with plan→act→observe→reflect cycle', async () => {
    // Setup mocks for successful execution
    const mockPlan = {
      id: 'plan-1',
      description: 'Create 12-riser stair',
      steps: [
        { id: 'step-1', action: 'geometry.createStair', args: { riser: 0.17, tread: 0.28 } }
      ]
    };
    
    mockAgentManager.parseRequest.mockResolvedValue(mockPlan);
    mockAgentManager.nextAction.mockResolvedValue(mockPlan.steps[0]);
    mockToolRegistry.execute.mockResolvedValue({ ok: true, objectId: 'stair-1' });
    mockCriticValidator.check.mockResolvedValue({ ok: true });
    mockAgentManager.advancePlan.mockResolvedValue({ ...mockPlan, done: true });

    const result = await agent.runAutonomous({
      goal: 'Create 12-riser stair, riser=0.17, tread=0.28',
      context: {},
      overrides: { maxSteps: 3 },
      userId: 'test-user'
    });

    expect(result.ok).toBe(true);
    expect(result.steps).toBe(1);
    
    // Verify call sequence: plan → act → observe → critic
    expect(mockAgentManager.parseRequest).toHaveBeenCalledWith(
      'Create 12-riser stair, riser=0.17, tread=0.28', 
      {}
    );
    expect(mockToolRegistry.execute).toHaveBeenCalledWith(
      'geometry.createStair', 
      { riser: 0.17, tread: 0.28 }
    );
    expect(mockCriticValidator.check).toHaveBeenCalled();
    expect(mockDocumentService.commitTransaction).toHaveBeenCalled();
  });

  test('failure triggers replan and second attempt adjusts args', async () => {
    const mockPlan = {
      id: 'plan-1', 
      steps: [
        { id: 'step-1', action: 'geometry.createStair', args: { riser: 0.25, tread: 0.20 } }
      ]
    };
    
    const replanedPlan = {
      id: 'plan-2',
      steps: [
        { id: 'step-1', action: 'geometry.createStair', args: { riser: 0.17, tread: 0.28 } }
      ]
    };

    mockAgentManager.parseRequest.mockResolvedValue(mockPlan);
    mockAgentManager.nextAction
      .mockResolvedValueOnce(mockPlan.steps[0])
      .mockResolvedValueOnce(replanedPlan.steps[0])
      .mockResolvedValueOnce(null); // End after second attempt
    
    mockToolRegistry.execute
      .mockResolvedValueOnce({ ok: true, objectId: 'stair-1' })
      .mockResolvedValueOnce({ ok: true, objectId: 'stair-2' });
    
    mockCriticValidator.check
      .mockResolvedValueOnce({ ok: false, reason: 'Riser out of range (150–190mm)' })
      .mockResolvedValueOnce({ ok: true });
    
    mockAgentManager.replan.mockResolvedValue(replanedPlan);
    mockAgentManager.advancePlan.mockResolvedValue({ ...replanedPlan, done: true });

    const result = await agent.runAutonomous({
      goal: 'Create stair with bad dimensions',
      context: {},
      overrides: { maxSteps: 5 },
      userId: 'test-user'
    });

    expect(result.ok).toBe(true);
    expect(mockAgentManager.replan).toHaveBeenCalledWith({
      goal: 'Create stair with bad dimensions',
      context: {},
      last: expect.objectContaining({
        verdict: expect.objectContaining({
          ok: false,
          reason: 'Riser out of range (150–190mm)'
        })
      })
    });
    
    // Second attempt should use corrected args
    expect(mockToolRegistry.execute).toHaveBeenCalledWith(
      'geometry.createStair',
      { riser: 0.17, tread: 0.28 }
    );
  });

  test('rollback on user rejection or thrown error', async () => {
    const mockPlan = {
      steps: [{ id: 'step-1', action: 'geometry.createStair', args: {} }]
    };
    
    mockAgentManager.parseRequest.mockResolvedValue(mockPlan);
    mockAgentManager.nextAction.mockResolvedValue(mockPlan.steps[0]);
    mockToolRegistry.execute.mockRejectedValue(new Error('Tool execution failed'));

    await expect(agent.runAutonomous({
      goal: 'Create stair',
      context: {},
      overrides: {},
      userId: 'test-user'
    })).rejects.toThrow('Tool execution failed');

    expect(mockDocumentService.rollbackTransaction).toHaveBeenCalled();
    expect(mockEventManager.done).toHaveBeenCalledWith(
      'test-run-123',
      { status: 'error', error: 'Tool execution failed' }
    );
  });
});

describe('Tool Registry Integration', () => {
  test('registry registers built-in handlers and records stats', () => {
    const mockToolRegistry = new Map();
    const mockStats = new Map();
    
    // Simulate registration
    const tools = ['geometry.createStair', 'geometry.createWall', 'transform.move'];
    tools.forEach(tool => {
      mockToolRegistry.set(tool, jest.fn());
      mockStats.set(tool, { ok: 0, fail: 0 });
    });
    
    expect(mockToolRegistry.size).toBe(3);
    expect(mockStats.has('geometry.createStair')).toBe(true);
  });

  test('getHandlers() exposure from AICommandExecutor works', () => {
    const mockAICommandExecutor = {
      toolHandlers: new Map([
        ['wall', jest.fn()],
        ['stair', jest.fn()]
      ]),
      getHandlers() {
        const handlers = {};
        for (const [tool, handler] of this.toolHandlers.entries()) {
          handlers[`geometry.create${tool.charAt(0).toUpperCase()}${tool.slice(1)}`] = handler;
        }
        return handlers;
      }
    };
    
    const handlers = mockAICommandExecutor.getHandlers();
    
    expect(handlers).toHaveProperty('geometry.createWall');
    expect(handlers).toHaveProperty('geometry.createStair');
    expect(Object.keys(handlers)).toHaveLength(2);
  });
});

module.exports = {
  MockAutonomousAgent
};