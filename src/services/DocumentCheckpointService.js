/**
 * DocumentCheckpointService - Transactional checkpoints for multi-step operations
 * 
 * Provides transactional semantics for autonomous agent operations
 * Wraps CAD engine's checkpoint/undo APIs for rollback capability
 */

import standaloneCADEngine from './StandaloneCADEngine';

class DocumentCheckpointService {
  constructor() {
    this.transactionDepth = 0;
    this.checkpoints = [];
    this.transactionId = 0;
    this.isEnabled = true;
    
    console.log('📝 DocumentCheckpointService: Initialized');
  }

  /**
   * Begin a new transaction with checkpoint
   */
  async beginTransaction() {
    if (!this.isEnabled) {
      console.log('📝 DocumentCheckpoint: Checkpoints disabled, skipping');
      return { transactionId: null, success: true };
    }

    try {
      this.transactionDepth++;
      const txnId = ++this.transactionId;
      
      // Create checkpoint in CAD engine
      const checkpoint = await this.createCheckpoint(txnId);
      
      this.checkpoints.push({
        id: txnId,
        depth: this.transactionDepth,
        timestamp: Date.now(),
        checkpoint,
        objects: standaloneCADEngine.getAllObjects().map(obj => ({ ...obj })) // Snapshot
      });

      console.log(`📝 DocumentCheckpoint: Transaction ${txnId} started (depth: ${this.transactionDepth})`);
      
      return {
        transactionId: txnId,
        success: true,
        depth: this.transactionDepth
      };
      
    } catch (error) {
      console.error('❌ DocumentCheckpoint: Failed to begin transaction:', error);
      this.transactionDepth = Math.max(0, this.transactionDepth - 1);
      return {
        transactionId: null,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Commit the current transaction
   */
  async commitTransaction() {
    if (!this.isEnabled || this.transactionDepth === 0) {
      return { success: true };
    }

    try {
      this.transactionDepth--;
      
      // Only finalize when we reach the root transaction
      if (this.transactionDepth === 0) {
        // Finalize all checkpoints - CAD engine can clean up undo history
        const finalizedCount = this.checkpoints.length;
        this.checkpoints = [];
        
        console.log(`📝 DocumentCheckpoint: Committed ${finalizedCount} checkpoints`);
      }

      return { success: true, depth: this.transactionDepth };
      
    } catch (error) {
      console.error('❌ DocumentCheckpoint: Failed to commit transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rollback to the last checkpoint
   */
  async rollbackTransaction() {
    if (!this.isEnabled) {
      console.log('📝 DocumentCheckpoint: Checkpoints disabled, skipping rollback');
      return { success: true };
    }

    try {
      if (this.checkpoints.length === 0) {
        console.warn('⚠️ DocumentCheckpoint: No checkpoints to rollback to');
        return { success: true, rolledBack: false };
      }

      // Find the most recent checkpoint
      const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
      
      // Restore to checkpoint state
      await this.restoreCheckpoint(lastCheckpoint);
      
      // Clear all checkpoints from this rollback point
      const rolledBackCount = this.checkpoints.length;
      this.checkpoints = [];
      this.transactionDepth = 0;

      console.log(`📝 DocumentCheckpoint: Rolled back ${rolledBackCount} checkpoints to transaction ${lastCheckpoint.id}`);
      
      return { 
        success: true, 
        rolledBack: true,
        checkpointId: lastCheckpoint.id,
        objectsRestored: lastCheckpoint.objects.length
      };
      
    } catch (error) {
      console.error('❌ DocumentCheckpoint: Failed to rollback transaction:', error);
      this.transactionDepth = 0;
      this.checkpoints = [];
      
      return { 
        success: false, 
        error: error.message,
        rolledBack: false 
      };
    }
  }

  /**
   * Create a checkpoint in the CAD engine
   */
  async createCheckpoint(transactionId) {
    try {
      // If CAD engine has native checkpoint support, use it
      if (typeof standaloneCADEngine.createCheckpoint === 'function') {
        return await standaloneCADEngine.createCheckpoint(`agent_txn_${transactionId}`);
      }
      
      // Otherwise, create our own snapshot
      return {
        id: `agent_txn_${transactionId}`,
        timestamp: Date.now(),
        objectCount: standaloneCADEngine.getAllObjects().length,
        engineState: this.captureEngineState()
      };
      
    } catch (error) {
      console.error('❌ DocumentCheckpoint: Failed to create checkpoint:', error);
      throw error;
    }
  }

  /**
   * Restore to a specific checkpoint
   */
  async restoreCheckpoint(checkpoint) {
    try {
      // If CAD engine has native restore support, use it
      if (typeof standaloneCADEngine.restoreCheckpoint === 'function') {
        await standaloneCADEngine.restoreCheckpoint(checkpoint.checkpoint);
        return;
      }
      
      // Otherwise, manually restore state
      await this.restoreEngineState(checkpoint);
      
    } catch (error) {
      console.error('❌ DocumentCheckpoint: Failed to restore checkpoint:', error);
      throw error;
    }
  }

  /**
   * Capture current CAD engine state for manual checkpointing
   */
  captureEngineState() {
    try {
      return {
        objects: standaloneCADEngine.getAllObjects().map(obj => ({ ...obj })),
        selections: standaloneCADEngine.getSelectedObjects ? 
                   Array.from(standaloneCADEngine.getSelectedObjects()) : [],
        viewport: standaloneCADEngine.getViewportState ? 
                 standaloneCADEngine.getViewportState() : {},
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ DocumentCheckpoint: Failed to capture engine state:', error);
      return { objects: [], selections: [], viewport: {}, timestamp: Date.now() };
    }
  }

  /**
   * Restore CAD engine state from snapshot
   */
  async restoreEngineState(checkpoint) {
    try {
      const state = checkpoint.objects || checkpoint.checkpoint?.engineState;
      if (!state) {
        throw new Error('No state data in checkpoint');
      }

      // Clear current scene
      if (typeof standaloneCADEngine.clearAll === 'function') {
        standaloneCADEngine.clearAll();
      }

      // Restore objects
      if (state.objects) {
        for (const obj of state.objects) {
          try {
            standaloneCADEngine.restoreObject(obj);
          } catch (objError) {
            console.warn(`⚠️ DocumentCheckpoint: Failed to restore object ${obj.id}:`, objError);
          }
        }
      }

      // Restore selections if available
      if (state.selections && typeof standaloneCADEngine.setSelectedObjects === 'function') {
        standaloneCADEngine.setSelectedObjects(new Set(state.selections));
      }

      console.log(`📝 DocumentCheckpoint: Restored ${state.objects?.length || 0} objects`);
      
    } catch (error) {
      console.error('❌ DocumentCheckpoint: Failed to restore engine state:', error);
      throw error;
    }
  }

  /**
   * Get current transaction status
   */
  getTransactionStatus() {
    return {
      depth: this.transactionDepth,
      checkpointCount: this.checkpoints.length,
      inTransaction: this.transactionDepth > 0,
      enabled: this.isEnabled,
      lastCheckpoint: this.checkpoints.length > 0 ? 
                     this.checkpoints[this.checkpoints.length - 1].timestamp : null
    };
  }

  /**
   * Enable or disable checkpoint system
   */
  setEnabled(enabled) {
    const wasEnabled = this.isEnabled;
    this.isEnabled = enabled;
    
    if (wasEnabled && !enabled) {
      // Cleanup when disabling
      this.checkpoints = [];
      this.transactionDepth = 0;
    }
    
    console.log(`📝 DocumentCheckpoint: ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Manual checkpoint creation (for testing or special cases)
   */
  async createManualCheckpoint(label = 'manual') {
    const result = await this.beginTransaction();
    if (result.success) {
      console.log(`📝 DocumentCheckpoint: Manual checkpoint "${label}" created`);
    }
    return result;
  }

  /**
   * Cleanup old checkpoints (memory hygiene)
   */
  cleanupOldCheckpoints(maxAge = 300_000) { // 5 minutes
    const now = Date.now();
    const before = this.checkpoints.length;
    
    this.checkpoints = this.checkpoints.filter(checkpoint => 
      (now - checkpoint.timestamp) < maxAge
    );
    
    const removed = before - this.checkpoints.length;
    if (removed > 0) {
      console.log(`📝 DocumentCheckpoint: Cleaned up ${removed} old checkpoints`);
    }
  }
}

// Export singleton instance
const documentCheckpointService = new DocumentCheckpointService();

// Convenience exports matching the original interface
export const beginTxn = () => documentCheckpointService.beginTransaction();
export const commitTxn = () => documentCheckpointService.commitTransaction();  
export const rollbackTxn = () => documentCheckpointService.rollbackTransaction();

// Make available for debugging
if (typeof window !== 'undefined') {
  window.documentCheckpointService = documentCheckpointService;
  console.log('📝 DocumentCheckpointService available at window.documentCheckpointService');
}

export default documentCheckpointService;