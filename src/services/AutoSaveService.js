/**
 * AutoSave Service
 * Handles automatic saving of project state, integrating with existing project management
 * Provides silent autosave with recovery capabilities and smart batching
 */

import recentProjectsManager from '../utils/RecentProjectsManager';
import supabaseProjectsService from './SupabaseProjectsService';
import commandHistory from '../utils/commandHistory';

class AutoSaveService {
  constructor() {
    // Configuration
    this.enabled = true;
    this.autoSaveInterval = 30000; // 30 seconds
    this.maxRetries = 3;
    this.debounceDelay = 2000; // 2 seconds debounce
    
    // State
    this.currentProject = null;
    this.currentUserId = null;
    this.lastSaveTimestamp = 0;
    this.lastChangeTimestamp = 0;
    this.pendingChanges = false;
    this.isAutoSaving = false;
    this.saveQueue = [];
    
    // Timers
    this.autoSaveTimer = null;
    this.debounceTimer = null;
    
    // Statistics
    this.stats = {
      totalAutoSaves: 0,
      successfulSaves: 0,
      failedSaves: 0,
      lastAutoSave: null,
      averageSaveTime: 0
    };
    
    // Event listeners for UI updates
    this.listeners = new Set();
    
    console.log('💾 AutoSave Service initialized');
  }

  /**
   * Initialize autosave for a project
   */
  startAutoSave(project, userId) {
    console.log('🚀 Starting autosave for project:', project.name);
    
    this.currentProject = project;
    this.currentUserId = userId;
    this.lastSaveTimestamp = Date.now();
    this.lastChangeTimestamp = Date.now();
    this.pendingChanges = false;
    
    // Set user in RecentProjectsManager if not already set
    if (recentProjectsManager.currentUserId !== userId) {
      recentProjectsManager.setCurrentUser(userId);
    }
    
    // Start the autosave timer
    this.startTimer();
    
    // Emit status update
    this.emitStatusUpdate('started', { projectName: project.name });
  }

  /**
   * Stop autosave (when project is closed or app shuts down)
   */
  async stopAutoSave(performFinalSave = true) {
    console.log('🛑 Stopping autosave');
    
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // Perform final save if there are pending changes
    if (performFinalSave && this.pendingChanges && this.currentProject) {
      console.log('💾 Performing final autosave before stopping...');
      await this.performAutoSave();
    }
    
    this.currentProject = null;
    this.currentUserId = null;
    this.pendingChanges = false;
    
    this.emitStatusUpdate('stopped');
  }

  /**
   * Mark that the project has changes that need to be saved
   */
  markChanges(changeDetails = {}) {
    if (!this.currentProject || !this.enabled) return;
    
    this.lastChangeTimestamp = Date.now();
    this.pendingChanges = true;
    
    // Update project metadata
    if (this.currentProject) {
      this.currentProject.lastModified = new Date().toISOString();
      this.currentProject.hasUnsavedChanges = true;
    }
    
    // Debounced save - wait for user to stop making changes
    this.scheduleAutoSave();
    
    this.emitStatusUpdate('changes_detected', { changeDetails });
  }

  /**
   * Schedule an autosave with debouncing
   */
  scheduleAutoSave() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      if (this.pendingChanges && !this.isAutoSaving) {
        this.performAutoSave();
      }
    }, this.debounceDelay);
  }

  /**
   * Start the periodic autosave timer
   */
  startTimer() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(() => {
      if (this.pendingChanges && !this.isAutoSaving) {
        this.performAutoSave();
      }
    }, this.autoSaveInterval);
  }

  /**
   * Perform the actual autosave operation
   */
  async performAutoSave() {
    if (!this.currentProject || !this.currentUserId || this.isAutoSaving) {
      return;
    }
    
    this.isAutoSaving = true;
    const saveStartTime = Date.now();
    
    try {
      console.log('💾 Performing autosave for:', this.currentProject.name);
      
      // Capture current project state
      const projectToSave = {
        ...this.currentProject,
        lastModified: new Date().toISOString(),
        progress: this.calculateProgress(),
        commandHistory: this.captureCommandHistory(),
        autoSaved: true,
        saved: true // Mark as saved so it appears in recent projects
      };
      
      // Try to save to cloud first
      let saveResult = null;
      if (supabaseProjectsService.isAvailable()) {
        saveResult = await supabaseProjectsService.saveProject(
          this.currentUserId, 
          projectToSave
        );
      }
      
      // Always save to RecentProjectsManager (handles localStorage fallback)
      await recentProjectsManager.addToRecentProjects(projectToSave);
      
      // Update current project reference
      this.currentProject = projectToSave;
      this.pendingChanges = false;
      this.lastSaveTimestamp = Date.now();
      
      // Update statistics
      this.stats.totalAutoSaves++;
      this.stats.successfulSaves++;
      this.stats.lastAutoSave = new Date().toISOString();
      
      const saveTime = Date.now() - saveStartTime;
      this.stats.averageSaveTime = (this.stats.averageSaveTime + saveTime) / 2;
      
      console.log(`✅ Autosave completed in ${saveTime}ms`);
      this.emitStatusUpdate('saved', { 
        saveTime, 
        cloudSaved: saveResult?.success,
        projectName: projectToSave.name 
      });
      
    } catch (error) {
      console.error('❌ Autosave failed:', error);
      this.stats.failedSaves++;
      this.emitStatusUpdate('error', { error: error.message });
      
      // Retry after a delay
      setTimeout(() => {
        if (this.pendingChanges) {
          this.performAutoSave();
        }
      }, 5000);
      
    } finally {
      this.isAutoSaving = false;
    }
  }

  /**
   * Calculate project progress based on command history and project state
   */
  calculateProgress() {
    if (!this.currentProject) return 0;
    
    // Simple progress calculation based on commands executed
    const commandInfo = commandHistory.getCurrentCommandInfo();
    const baseProgress = Math.min(commandInfo.historySize * 2, 80); // Commands contribute up to 80%
    
    // Add progress for having project data
    let additionalProgress = 0;
    if (this.currentProject.projectData?.name) additionalProgress += 5;
    if (this.currentProject.projectData?.description) additionalProgress += 5;
    if (this.currentProject.template) additionalProgress += 10;
    
    return Math.min(baseProgress + additionalProgress, 100);
  }

  /**
   * Capture command history for project state
   */
  captureCommandHistory() {
    try {
      return commandHistory.serialize();
    } catch (error) {
      console.warn('⚠️ Failed to capture command history:', error);
      return null;
    }
  }

  /**
   * Get current autosave status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      isAutoSaving: this.isAutoSaving,
      pendingChanges: this.pendingChanges,
      currentProject: this.currentProject?.name || null,
      lastSave: this.stats.lastAutoSave,
      timeSinceLastSave: this.lastSaveTimestamp ? Date.now() - this.lastSaveTimestamp : null,
      timeSinceLastChange: this.lastChangeTimestamp ? Date.now() - this.lastChangeTimestamp : null,
      stats: { ...this.stats }
    };
  }

  /**
   * Configure autosave settings
   */
  configure(options = {}) {
    if (options.enabled !== undefined) this.enabled = options.enabled;
    if (options.autoSaveInterval) this.autoSaveInterval = options.autoSaveInterval;
    if (options.debounceDelay) this.debounceDelay = options.debounceDelay;
    
    console.log('⚙️ AutoSave configured:', { 
      enabled: this.enabled, 
      interval: this.autoSaveInterval,
      debounce: this.debounceDelay 
    });
    
    // Restart timer with new interval
    if (this.currentProject && this.enabled) {
      this.startTimer();
    }
  }

  /**
   * Force an immediate autosave
   */
  async forceSave() {
    if (!this.currentProject) {
      console.warn('⚠️ No active project to save');
      return false;
    }
    
    console.log('🔄 Force saving project...');
    await this.performAutoSave();
    return !this.pendingChanges;
  }

  /**
   * Recover unsaved projects on app startup
   */
  async recoverUnsavedProjects(userId) {
    console.log('🔄 Checking for unsaved projects to recover...');
    
    try {
      // Check localStorage for projects with unsaved changes
      const localProjects = JSON.parse(localStorage.getItem('studiosix_recent_projects') || '[]');
      const unsavedProjects = localProjects.filter(p => 
        p.hasUnsavedChanges && 
        p.userId === userId &&
        p.autoSaved
      );
      
      if (unsavedProjects.length > 0) {
        console.log(`📦 Found ${unsavedProjects.length} projects with unsaved changes`);
        return unsavedProjects;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Failed to recover unsaved projects:', error);
      return [];
    }
  }

  /**
   * Event listener management
   */
  addEventListener(listener) {
    this.listeners.add(listener);
  }

  removeEventListener(listener) {
    this.listeners.delete(listener);
  }

  emitStatusUpdate(type, data = {}) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      status: this.getStatus(),
      ...data
    };
    
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('❌ Error in autosave event listener:', error);
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopAutoSave(false);
    this.listeners.clear();
    console.log('🔥 AutoSave Service destroyed');
  }
}

// Export singleton instance
export const autoSaveService = new AutoSaveService();
export default autoSaveService;