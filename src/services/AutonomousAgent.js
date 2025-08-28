/**
 * AutonomousAgent - Plan→Act→Observe→Reflect loop implementation
 * 
 * Provides autonomous execution with adaptive re-planning on failure
 * Integrates with existing AgentManager, CriticValidator, and tool registry
 * Maintains backward compatibility with current sequential execution UX
 */

import agentManager from './AgentManager';
import criticValidator from './CriticValidator';
import agentConfigService from './AgentConfigService';
import toolCapabilityRegistry, { ToolStats } from './ToolCapabilityRegistry';
import documentCheckpointService, { beginTxn, commitTxn, rollbackTxn } from './DocumentCheckpointService';
import eventManager from './EventManager';
import subscriptionService from './SubscriptionService';
import tokenUsageService from './TokenUsageService';

class AutonomousAgent {
  constructor() {
    this.activeRuns = new Map();
    this.runHistory = [];
    this.maxHistorySize = 50;
    
    console.log('🤖 AutonomousAgent: Initialized with plan→act→observe→reflect capability');
  }

  /**
   * Run autonomous agent with full plan→act→observe→reflect loop
   */
  async runAutonomous({ goal, context, overrides = {}, userId }) {
    // Get effective configuration
    const config = agentConfigService.withOverrides(overrides);
    
    // Validate configuration
    const validation = agentConfigService.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Check subscription limits
    try {
      subscriptionService.checkUsageLimits('autonomous_agent', { 
        estimatedSteps: config.maxSteps 
      });
    } catch (error) {
      throw new Error(`Subscription limit: ${error.message}`);
    }

    // Start run tracking
    const runId = eventManager.startRun({ 
      goal, 
      userId, 
      config,
      metadata: { type: 'autonomous', overrides }
    });

    // Track active run
    const runContext = {
      runId,
      goal,
      context,
      config,
      userId,
      startTime: Date.now(),
      step: 0,
      plan: null,
      status: 'planning'
    };

    this.activeRuns.set(runId, runContext);

    try {
      const result = await this.executeAutonomousRun(runContext);
      
      // Add to history
      this.addToHistory(runContext, result);
      
      return result;
      
    } catch (error) {
      console.error('❌ AutonomousAgent: Run failed:', error);
      
      eventManager.done(runId, { 
        status: 'error', 
        error: error.message,
        step: runContext.step
      });
      
      return { 
        ok: false, 
        runId, 
        error: error.message,
        step: runContext.step
      };
      
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  /**
   * Execute the main autonomous run loop
   */
  async executeAutonomousRun(runContext) {
    const { runId, goal, context, config } = runContext;
    
    // Step 1: Initial Planning
    eventManager.progress(runId, { 
      type: 'phase', 
      phase: 'planning',
      summary: 'Analyzing request and generating execution plan'
    });

    let plan = await this.generateInitialPlan(goal, context);
    runContext.plan = plan;
    runContext.status = 'executing';

    eventManager.progress(runId, { 
      type: 'plan', 
      summary: plan?.title || plan?.description,
      steps: this.summarizeSteps(plan?.steps),
      confidence: plan?.confidence || 0.8
    });

    // Begin transaction for rollback capability
    let transaction = null;
    if (config.enableCheckpoints) {
      transaction = await beginTxn();
    }

    try {
      // Step 2: Execute plan with adaptive re-planning
      while (runContext.step < config.maxSteps && 
             Date.now() - runContext.startTime < config.maxMillis) {
        
        // Get next action from plan
        const nextAction = await this.getNextAction({ plan, context });
        if (!nextAction) break; // Plan completed

        // Step 3: Approval gating (if required)
        const needsApproval = this.shouldRequestApproval(config.approvalMode, nextAction);
        if (needsApproval) {
          const approved = await eventManager.awaitApproval(runId, nextAction);
          if (!approved) {
            throw new Error('User rejected action');
          }
        }

        // Step 4: Act (execute the action)
        eventManager.progress(runId, { 
          type: 'act', 
          tool: nextAction.tool, 
          args: this.scrubArgs(nextAction.args),
          step: runContext.step + 1
        });

        const actionResult = await this.executeAction(nextAction);
        
        // Record tool usage statistics
        ToolStats.record(nextAction.tool, actionResult?.ok !== false);

        // Step 5: Observe (analyze results)
        eventManager.progress(runId, { 
          type: 'observe', 
          result: this.scrubResult(actionResult),
          success: actionResult?.ok !== false
        });

        // Step 6: Critic validation (if enabled)
        let criticVerdict = { ok: true };
        if (config.enableCritic) {
          criticVerdict = await criticValidator.check({ 
            goal, 
            action: nextAction, 
            result: actionResult, 
            context 
          });

          eventManager.progress(runId, { 
            type: 'critic', 
            verdict: criticVerdict.ok ? 'passed' : 'failed',
            reason: criticVerdict.reason,
            category: criticVerdict.category
          });
        }

        // Step 7: Reflect and adapt
        if (!criticVerdict.ok || actionResult?.ok === false) {
          // Re-planning needed
          eventManager.progress(runId, { 
            type: 'reflect',
            issue: criticVerdict.reason || actionResult?.error,
            action: 'replanning'
          });

          plan = await this.replan({ 
            goal, 
            context, 
            originalPlan: plan,
            failedAction: nextAction, 
            failure: { result: actionResult, verdict: criticVerdict }
          });

          eventManager.progress(runId, { 
            type: 'replan', 
            reason: criticVerdict.reason || actionResult?.error,
            newPlan: this.summarizeSteps(plan?.steps)
          });

          runContext.step++;
          continue; // Retry with new plan
        }

        // Step successful - advance plan
        plan = await this.advancePlan({ 
          plan, 
          completedAction: nextAction,
          result: actionResult, 
          context 
        });

        runContext.plan = plan;
        runContext.step++;

        // Check if plan is complete
        if (plan?.done || !plan?.steps?.length) break;
      }

      // Commit transaction
      if (transaction && config.enableCheckpoints) {
        await commitTxn();
      }

      // Run completed successfully
      eventManager.done(runId, { 
        status: 'success', 
        steps: runContext.step,
        duration: Date.now() - runContext.startTime
      });

      return { 
        ok: true, 
        runId, 
        steps: runContext.step,
        duration: Date.now() - runContext.startTime,
        finalPlan: plan
      };

    } catch (error) {
      // Rollback on error
      if (transaction && config.enableCheckpoints) {
        await rollbackTxn();
      }
      
      throw error;
    }
  }

  /**
   * Generate initial execution plan
   */
  async generateInitialPlan(goal, context) {
    try {
      // Use existing AgentManager's intelligent parsing
      const plan = await agentManager.parseRequest(goal, context);
      
      // Add autonomous agent metadata
      return {
        ...plan,
        type: 'autonomous',
        confidence: plan.confidence || 0.8,
        adaptable: true,
        created: Date.now()
      };
      
    } catch (error) {
      console.error('❌ AutonomousAgent: Plan generation failed:', error);
      throw new Error(`Failed to generate plan: ${error.message}`);
    }
  }

  /**
   * Get next action from current plan
   */
  async getNextAction({ plan, context }) {
    if (!plan?.steps?.length) return null;
    
    // Find next pending step
    const nextStep = plan.steps.find(step => 
      step.status === 'pending' || !step.status
    );

    if (!nextStep) return null; // All steps completed

    // Convert step to action format
    return {
      tool: nextStep.action,
      args: nextStep.params || {},
      stepId: nextStep.id,
      stepNumber: nextStep.number,
      description: nextStep.description
    };
  }

  /**
   * Execute a single action using the tool registry
   */
  async executeAction(action) {
    try {
      // Check if tool is allowed
      if (!agentConfigService.isToolAllowed(action.tool)) {
        throw new Error(`Tool '${action.tool}' not allowed in current configuration`);
      }

      // Execute through tool registry for stats tracking
      const result = await toolCapabilityRegistry.execute(action.tool, action.args);
      
      return result;
      
    } catch (error) {
      console.error(`❌ AutonomousAgent: Action execution failed:`, error);
      return { 
        ok: false, 
        error: error.message,
        tool: action.tool,
        args: action.args
      };
    }
  }

  /**
   * Replan when an action fails or critic rejects
   */
  async replan({ goal, context, originalPlan, failedAction, failure }) {
    try {
      // Add failure context to help with replanning
      const enhancedContext = {
        ...context,
        previousPlan: originalPlan,
        failedAction,
        failure,
        replanning: true
      };

      // Get tool recommendations based on success rates
      const recommendedTools = toolCapabilityRegistry.getRecommendedTools(
        this.extractToolCategory(failedAction.tool), 
        0.6 // Lower threshold for replanning
      );

      enhancedContext.recommendedTools = recommendedTools;

      // Generate new plan with failure awareness
      const newPlan = await agentManager.parseRequest(goal, enhancedContext);
      
      return {
        ...newPlan,
        type: 'replan',
        confidence: Math.max((newPlan.confidence || 0.8) - 0.1, 0.5), // Slightly lower confidence
        replanned: true,
        originalFailure: failure.verdict?.reason || failure.result?.error,
        replanCount: (originalPlan.replanCount || 0) + 1
      };
      
    } catch (error) {
      console.error('❌ AutonomousAgent: Replanning failed:', error);
      throw new Error(`Failed to replan: ${error.message}`);
    }
  }

  /**
   * Advance plan after successful action
   */
  async advancePlan({ plan, completedAction, result, context }) {
    if (!plan?.steps) return plan;

    // Mark corresponding step as completed
    const updatedSteps = plan.steps.map(step => {
      if (step.id === completedAction.stepId) {
        return {
          ...step,
          status: 'completed',
          result: this.scrubResult(result),
          completedAt: Date.now()
        };
      }
      return step;
    });

    // Check if all steps are completed
    const pendingSteps = updatedSteps.filter(step => 
      step.status !== 'completed' && step.status !== 'skipped'
    );

    return {
      ...plan,
      steps: updatedSteps,
      done: pendingSteps.length === 0,
      progress: (updatedSteps.length - pendingSteps.length) / updatedSteps.length
    };
  }

  /**
   * Determine if approval is needed for an action
   */
  shouldRequestApproval(mode, action) {
    if (mode === 'never') return false;
    if (mode === 'always') return true;
    
    // 'destructive' mode - check for destructive operations
    const destructiveTools = [
      'geometry.delete',
      'selection.delete', 
      'document.clear',
      'transform.split',
      'geometry.booleanSubtract'
    ];
    
    return destructiveTools.some(tool => action.tool.includes(tool));
  }

  /**
   * Get active runs for a user
   */
  getActiveRuns(userId = null) {
    const runs = Array.from(this.activeRuns.values());
    
    if (userId) {
      return runs.filter(run => run.userId === userId);
    }
    
    return runs;
  }

  /**
   * Force stop a running autonomous agent
   */
  async forceStop(runId, reason = 'User requested stop') {
    const runContext = this.activeRuns.get(runId);
    if (!runContext) {
      return { ok: false, error: 'Run not found or already completed' };
    }

    try {
      // Rollback transaction if active
      if (runContext.config.enableCheckpoints) {
        await rollbackTxn();
      }
      
      // Stop via event manager
      eventManager.forceStopRun(runId, reason);
      
      // Clean up
      this.activeRuns.delete(runId);
      
      return { ok: true, runId, reason };
      
    } catch (error) {
      console.error('❌ AutonomousAgent: Force stop failed:', error);
      return { ok: false, runId, error: error.message };
    }
  }

  /**
   * Get run statistics and performance metrics
   */
  getStatistics() {
    const activeRuns = this.activeRuns.size;
    const totalHistoryRuns = this.runHistory.length;
    
    // Calculate success rate from history
    const successfulRuns = this.runHistory.filter(run => run.result?.ok === true).length;
    const successRate = totalHistoryRuns > 0 ? successfulRuns / totalHistoryRuns : 0;
    
    // Calculate average steps and duration
    const completedRuns = this.runHistory.filter(run => run.result?.steps);
    const avgSteps = completedRuns.length > 0 ? 
      completedRuns.reduce((sum, run) => sum + run.result.steps, 0) / completedRuns.length : 0;
    const avgDuration = completedRuns.length > 0 ?
      completedRuns.reduce((sum, run) => sum + (run.result.duration || 0), 0) / completedRuns.length : 0;

    return {
      activeRuns,
      totalHistoryRuns,
      successRate,
      avgSteps: Math.round(avgSteps),
      avgDuration: Math.round(avgDuration),
      toolStats: toolCapabilityRegistry.getStatistics(),
      recentRuns: this.runHistory.slice(-5).map(run => ({
        goal: run.goal.substring(0, 50) + (run.goal.length > 50 ? '...' : ''),
        success: run.result?.ok,
        steps: run.result?.steps,
        duration: run.result?.duration
      }))
    };
  }

  /**
   * Add completed run to history
   */
  addToHistory(runContext, result) {
    this.runHistory.push({
      runId: runContext.runId,
      goal: runContext.goal,
      userId: runContext.userId,
      config: runContext.config,
      result,
      completedAt: Date.now()
    });

    // Trim history to max size
    if (this.runHistory.length > this.maxHistorySize) {
      this.runHistory.splice(0, this.runHistory.length - this.maxHistorySize);
    }
  }

  /**
   * Extract tool category from tool name
   */
  extractToolCategory(toolName) {
    const parts = toolName.split('.');
    return parts[0] || 'unknown';
  }

  /**
   * Summarize plan steps for event streaming
   */
  summarizeSteps(steps) {
    if (!steps) return [];
    
    return steps.map(step => ({
      id: step.id,
      title: step.title,
      description: step.description,
      action: step.action,
      status: step.status
    }));
  }

  /**
   * Scrub action arguments for event streaming
   */
  scrubArgs(args) {
    if (!args) return {};
    
    // Remove potentially sensitive data
    const scrubbed = { ...args };
    delete scrubbed.apiKey;
    delete scrubbed.credentials;
    
    return scrubbed;
  }

  /**
   * Scrub result data for event streaming
   */
  scrubResult(result) {
    if (!result) return null;
    
    return {
      ok: result.ok,
      error: result.error,
      summary: result.summary,
      // Omit detailed internal data
      objectId: result.objectId,
      objectsCreated: result.objectsCreated?.length,
      measurements: result.measurements ? Object.keys(result.measurements) : null
    };
  }

  /**
   * Clean up old history (memory hygiene)
   */
  cleanupHistory(maxAge = 86400000) { // 24 hours
    const cutoff = Date.now() - maxAge;
    const before = this.runHistory.length;
    
    this.runHistory = this.runHistory.filter(run => 
      run.completedAt > cutoff
    );
    
    const cleaned = before - this.runHistory.length;
    if (cleaned > 0) {
      console.log(`🧹 AutonomousAgent: Cleaned ${cleaned} old run records`);
    }
  }
}

// Export singleton instance
const autonomousAgent = new AutonomousAgent();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.autonomousAgent = autonomousAgent;
  console.log('🤖 AutonomousAgent available at window.autonomousAgent');
}

export default autonomousAgent;