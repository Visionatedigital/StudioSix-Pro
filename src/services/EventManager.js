/**
 * EventManager - WebSocket progress streaming and approval handling
 * 
 * Provides real-time event streaming for autonomous agent runs
 * Handles user approvals and multi-user collaboration
 * Falls back to SSE if WebSocket unavailable
 */

import { v4 as uuid } from 'uuid';

class EventManager {
  constructor() {
    this.listeners = new Map(); // runId -> Set(ws/callbacks)
    this.runs = new Map(); // runId -> run metadata
    this.approvals = new Map(); // runId -> approval resolver
    this.eventHistory = new Map(); // runId -> events[]
    this.maxHistorySize = 100;
    
    console.log('📡 EventManager: Initialized for real-time agent communication');
  }

  /**
   * Start a new autonomous run
   */
  startRun({ goal, userId, cfg, metadata = {} }) {
    const runId = uuid();
    const runData = {
      id: runId,
      goal,
      userId,
      config: cfg,
      metadata,
      startTime: Date.now(),
      status: 'running',
      currentStep: 0
    };

    this.runs.set(runId, runData);
    this.listeners.set(runId, new Set());
    this.eventHistory.set(runId, []);

    const startEvent = { 
      type: 'start', 
      goal, 
      config: this.scrubConfig(cfg),
      userId, 
      metadata,
      ts: Date.now() 
    };

    this.progress(runId, startEvent);
    
    console.log(`📡 EventManager: Started run ${runId} for user ${userId}`);
    return runId;
  }

  /**
   * Send progress update to all listeners
   */
  progress(runId, payload) {
    const event = { 
      runId,
      ...payload, 
      ts: payload.ts || Date.now() 
    };

    // Add to event history
    this.addToHistory(runId, event);

    // Update run metadata
    const run = this.runs.get(runId);
    if (run) {
      run.lastUpdate = event.ts;
      if (event.type === 'act') {
        run.currentStep++;
      }
    }

    // Broadcast to all listeners
    this.broadcast(runId, event);

    // Log important events
    if (['start', 'plan', 'critic', 'replan', 'done', 'error'].includes(event.type)) {
      console.log(`📡 EventManager: ${runId.slice(0, 8)} - ${event.type}`, 
                  this.scrub(event.summary || event.reason || event.status));
    }
  }

  /**
   * Mark run as completed
   */
  done(runId, payload) {
    const run = this.runs.get(runId);
    if (run) {
      run.status = payload.status || 'completed';
      run.endTime = Date.now();
      run.duration = run.endTime - run.startTime;
    }

    const doneEvent = { 
      type: 'done', 
      ...payload, 
      ts: Date.now(),
      duration: run?.duration
    };

    this.progress(runId, doneEvent);
    
    // Clean up approvals
    this.approvals.delete(runId);
    
    console.log(`📡 EventManager: Run ${runId.slice(0, 8)} completed: ${payload.status}`);
  }

  /**
   * Attach a listener (WebSocket or callback)
   */
  attach(runId, listener) {
    const listenersSet = this.listeners.get(runId);
    if (listenersSet) {
      listenersSet.add(listener);
      
      // Send history to new listener if it's a WebSocket
      if (listener.send && this.eventHistory.has(runId)) {
        const history = this.eventHistory.get(runId);
        try {
          listener.send(JSON.stringify({
            type: 'history',
            runId,
            events: history,
            ts: Date.now()
          }));
        } catch (error) {
          console.warn('📡 EventManager: Failed to send history:', error);
        }
      }
    }
    
    console.log(`📡 EventManager: Attached listener to run ${runId.slice(0, 8)}`);
  }

  /**
   * Detach a listener
   */
  detach(runId, listener) {
    const listenersSet = this.listeners.get(runId);
    if (listenersSet) {
      listenersSet.delete(listener);
    }
  }

  /**
   * Broadcast message to all listeners for a run
   */
  broadcast(runId, message) {
    const listenersSet = this.listeners.get(runId);
    if (!listenersSet) return;

    const messageStr = JSON.stringify(message);
    
    // Track failed connections to remove them
    const failedConnections = [];

    listenersSet.forEach(listener => {
      try {
        if (listener.send) {
          // WebSocket listener
          listener.send(messageStr);
        } else if (typeof listener === 'function') {
          // Callback listener
          listener(message);
        }
      } catch (error) {
        console.warn('📡 EventManager: Failed to send to listener:', error);
        failedConnections.push(listener);
      }
    });

    // Remove failed connections
    failedConnections.forEach(listener => {
      listenersSet.delete(listener);
    });
  }

  /**
   * Request approval from user and wait for response
   */
  async awaitApproval(runId, action, timeout = 30000) {
    const approvalId = uuid();
    const approvalRequest = {
      type: 'approval-request',
      approvalId,
      action: this.scrub(action),
      timeout: timeout,
      ts: Date.now()
    };

    this.progress(runId, approvalRequest);

    return new Promise((resolve, reject) => {
      // Store resolver
      this.approvals.set(runId, { resolve, reject, approvalId });

      // Set timeout
      const timeoutId = setTimeout(() => {
        this.approvals.delete(runId);
        this.progress(runId, { 
          type: 'approval-timeout', 
          approvalId,
          ts: Date.now() 
        });
        resolve(false); // Default to rejection on timeout
      }, timeout);

      // Store timeout ID for potential cleanup
      this.approvals.get(runId).timeoutId = timeoutId;
    });
  }

  /**
   * Resolve approval request
   */
  resolveApproval(runId, approved, reason = null) {
    const approval = this.approvals.get(runId);
    if (!approval) {
      console.warn(`📡 EventManager: No pending approval for run ${runId}`);
      return false;
    }

    // Clear timeout
    if (approval.timeoutId) {
      clearTimeout(approval.timeoutId);
    }

    // Send approval response event
    this.progress(runId, {
      type: 'approval-response',
      approvalId: approval.approvalId,
      approved,
      reason,
      ts: Date.now()
    });

    // Resolve the promise
    approval.resolve(approved);
    this.approvals.delete(runId);

    console.log(`📡 EventManager: Approval ${approved ? 'granted' : 'denied'} for run ${runId.slice(0, 8)}`);
    return true;
  }

  /**
   * Get run information
   */
  getRun(runId) {
    return this.runs.get(runId);
  }

  /**
   * Get run history
   */
  getHistory(runId) {
    return this.eventHistory.get(runId) || [];
  }

  /**
   * Get active runs for a user
   */
  getActiveRunsForUser(userId) {
    const activeRuns = [];
    
    for (const [runId, run] of this.runs.entries()) {
      if (run.userId === userId && run.status === 'running') {
        activeRuns.push({
          runId,
          goal: run.goal,
          startTime: run.startTime,
          currentStep: run.currentStep,
          lastUpdate: run.lastUpdate
        });
      }
    }

    return activeRuns;
  }

  /**
   * Add event to history with size management
   */
  addToHistory(runId, event) {
    let history = this.eventHistory.get(runId);
    if (!history) {
      history = [];
      this.eventHistory.set(runId, history);
    }

    history.push(event);

    // Trim history if too long
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  /**
   * Clean up completed runs (memory hygiene)
   */
  cleanup(maxAge = 3600000) { // 1 hour
    const cutoff = Date.now() - maxAge;
    let cleanedRuns = 0;
    let cleanedEvents = 0;

    for (const [runId, run] of this.runs.entries()) {
      if (run.status !== 'running' && run.endTime && run.endTime < cutoff) {
        // Clean up completed run
        this.runs.delete(runId);
        this.listeners.delete(runId);
        this.eventHistory.delete(runId);
        this.approvals.delete(runId);
        cleanedRuns++;
      }
    }

    // Clean up orphaned event histories
    for (const runId of this.eventHistory.keys()) {
      if (!this.runs.has(runId)) {
        this.eventHistory.delete(runId);
        cleanedEvents++;
      }
    }

    if (cleanedRuns > 0 || cleanedEvents > 0) {
      console.log(`🧹 EventManager: Cleaned ${cleanedRuns} runs, ${cleanedEvents} event histories`);
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const totalRuns = this.runs.size;
    const activeRuns = Array.from(this.runs.values()).filter(r => r.status === 'running').length;
    const totalListeners = Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0);
    const pendingApprovals = this.approvals.size;

    return {
      totalRuns,
      activeRuns,
      completedRuns: totalRuns - activeRuns,
      totalListeners,
      pendingApprovals,
      memoryUsage: {
        runs: this.runs.size,
        eventHistories: this.eventHistory.size,
        totalEvents: Array.from(this.eventHistory.values()).reduce((sum, events) => sum + events.length, 0)
      }
    };
  }

  /**
   * Scrub sensitive data from config for broadcasting
   */
  scrubConfig(config) {
    const scrubbed = { ...config };
    // Remove any potentially sensitive configuration
    delete scrubbed.apiKeys;
    delete scrubbed.internalSettings;
    return scrubbed;
  }

  /**
   * Scrub sensitive data from objects
   */
  scrub(obj) {
    if (!obj) return obj;
    
    try {
      // Handle strings and primitives
      if (typeof obj !== 'object') return obj;
      
      // Deep clone and scrub
      const scrubbed = JSON.parse(JSON.stringify(obj));
      
      // Remove known sensitive fields
      const sensitiveFields = ['apiKey', 'password', 'token', 'secret', 'credential'];
      
      const scrubRecursive = (item) => {
        if (typeof item === 'object' && item !== null) {
          for (const key in item) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
              item[key] = '[REDACTED]';
            } else if (typeof item[key] === 'object') {
              scrubRecursive(item[key]);
            }
          }
        }
      };
      
      scrubRecursive(scrubbed);
      return scrubbed;
      
    } catch (error) {
      return obj;
    }
  }

  /**
   * Force stop a run (for emergency situations)
   */
  forceStopRun(runId, reason = 'User terminated') {
    const run = this.runs.get(runId);
    if (run && run.status === 'running') {
      this.done(runId, { 
        status: 'terminated', 
        reason,
        forced: true 
      });
      
      // Clear any pending approvals
      const approval = this.approvals.get(runId);
      if (approval) {
        approval.resolve(false);
        this.approvals.delete(runId);
      }
      
      console.log(`📡 EventManager: Force stopped run ${runId.slice(0, 8)}: ${reason}`);
    }
  }
}

// Export singleton instance
const eventManager = new EventManager();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.eventManager = eventManager;
  console.log('📡 EventManager available at window.eventManager');
}

export default eventManager;