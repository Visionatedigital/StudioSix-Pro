/**
 * Project History Integration
 * Handles saving and loading command history with project files
 * Ensures data integrity and state consistency across sessions
 */

import commandHistory from './commandHistory.js';

class ProjectHistoryIntegration {
  constructor() {
    this.isLoading = false;
    this.isSaving = false;
    this.autoSaveEnabled = true;
    this.autoSaveInterval = 30000; // 30 seconds
    this.autoSaveTimer = null;
    this.lastAutoSave = 0;
  }

  // Save project with command history
  async saveProject(projectData, includeHistory = true) {
    if (this.isSaving) {
      console.warn('Save operation already in progress');
      return null;
    }

    this.isSaving = true;

    try {
      const saveData = {
        ...projectData,
        metadata: {
          ...projectData.metadata,
          lastSaved: new Date().toISOString(),
          version: projectData.version || '1.0.0',
          saveVersion: commandHistory.getCurrentCommandInfo().saveVersion
        }
      };

      // Include command history if requested
      if (includeHistory) {
        saveData.commandHistory = commandHistory.serialize();
      }

      // Validate save data
      this.validateSaveData(saveData);

      // Create backup before saving
      const backupData = this.createBackup(saveData);

      // Perform the actual save operation
      const result = await this.performSave(saveData);

      if (result.success) {
        // Mark command history as saved
        commandHistory.markAsSaved();
        
        // Update auto-save timestamp
        this.lastAutoSave = Date.now();
        
        // Emit save event
        this.emitSaveEvent('projectSaved', {
          projectData: saveData,
          backup: backupData,
          includeHistory
        });

        console.log('Project saved successfully with command history');
      }

      return result;

    } catch (error) {
      console.error('Failed to save project:', error);
      this.emitSaveEvent('saveError', { error, projectData });
      throw error;
    } finally {
      this.isSaving = false;
    }
  }

  // Load project with command history
  async loadProject(projectPath, loadHistory = true) {
    if (this.isLoading) {
      console.warn('Load operation already in progress');
      return null;
    }

    this.isLoading = true;

    try {
      // Load project data
      const projectData = await this.performLoad(projectPath);

      // Validate loaded data
      this.validateLoadData(projectData);

      // Load command history if available and requested
      if (loadHistory && projectData.commandHistory) {
        try {
          commandHistory.deserialize(projectData.commandHistory);
          console.log('Command history loaded successfully');
        } catch (historyError) {
          console.warn('Failed to load command history, starting with clean history:', historyError);
          commandHistory.clear();
        }
      } else {
        // Start with clean history if no history data or not requested
        commandHistory.clear();
      }

      // Emit load event
      this.emitSaveEvent('projectLoaded', {
        projectData,
        historyLoaded: loadHistory && !!projectData.commandHistory
      });

      console.log('Project loaded successfully');
      return projectData;

    } catch (error) {
      console.error('Failed to load project:', error);
      this.emitSaveEvent('loadError', { error, projectPath });
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Auto-save functionality
  enableAutoSave(interval = 30000) {
    this.autoSaveEnabled = true;
    this.autoSaveInterval = interval;
    this.startAutoSave();
  }

  disableAutoSave() {
    this.autoSaveEnabled = false;
    this.stopAutoSave();
  }

  startAutoSave() {
    this.stopAutoSave(); // Clear existing timer

    if (!this.autoSaveEnabled) return;

    this.autoSaveTimer = setInterval(async () => {
      try {
        if (commandHistory.isDirty() && !this.isSaving && !this.isLoading) {
          const timeSinceLastSave = Date.now() - this.lastAutoSave;
          if (timeSinceLastSave >= this.autoSaveInterval) {
            await this.performAutoSave();
          }
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, this.autoSaveInterval);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  async performAutoSave() {
    // This would be implemented by the specific project manager
    console.log('Auto-save triggered');
    this.emitSaveEvent('autoSaveTriggered', {
      isDirty: commandHistory.isDirty(),
      historySize: commandHistory.getCurrentCommandInfo().historySize
    });
  }

  // Create new project with clean history
  createNewProject(projectData) {
    commandHistory.clear();
    
    const newProjectData = {
      ...projectData,
      metadata: {
        ...projectData.metadata,
        created: new Date().toISOString(),
        version: '1.0.0',
        saveVersion: 0
      },
      commandHistory: commandHistory.serialize()
    };

    this.emitSaveEvent('projectCreated', { projectData: newProjectData });
    return newProjectData;
  }

  // Validate save data integrity
  validateSaveData(saveData) {
    if (!saveData) {
      throw new Error('Save data is required');
    }

    if (!saveData.metadata) {
      throw new Error('Project metadata is required');
    }

    if (saveData.commandHistory) {
      if (!saveData.commandHistory.commands || !Array.isArray(saveData.commandHistory.commands)) {
        throw new Error('Invalid command history format');
      }
    }

    return true;
  }

  // Validate loaded data integrity
  validateLoadData(loadData) {
    if (!loadData) {
      throw new Error('No data loaded');
    }

    if (loadData.commandHistory) {
      if (!loadData.commandHistory.commands || !Array.isArray(loadData.commandHistory.commands)) {
        console.warn('Invalid command history format, will be ignored');
        delete loadData.commandHistory;
      }
    }

    return true;
  }

  // Create backup of current state
  createBackup(saveData) {
    return {
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(saveData)),
      historySize: saveData.commandHistory ? saveData.commandHistory.commands.length : 0
    };
  }

  // Get project state summary
  getProjectState() {
    const historyInfo = commandHistory.getCurrentCommandInfo();
    
    return {
      isDirty: historyInfo.isDirty,
      historySize: historyInfo.historySize,
      canUndo: historyInfo.canUndo,
      canRedo: historyInfo.canRedo,
      saveVersion: historyInfo.saveVersion,
      lastAutoSave: this.lastAutoSave,
      autoSaveEnabled: this.autoSaveEnabled,
      isLoading: this.isLoading,
      isSaving: this.isSaving
    };
  }

  // Export project data for sharing (without sensitive history)
  exportProjectForSharing(projectData, options = {}) {
    const {
      includeHistory = false,
      includeMetadata = true,
      anonymize = false
    } = options;

    const exportData = { ...projectData };

    // Remove or modify sensitive data
    if (!includeHistory) {
      delete exportData.commandHistory;
    }

    if (anonymize && exportData.metadata) {
      delete exportData.metadata.author;
      delete exportData.metadata.lastSaved;
      delete exportData.metadata.created;
    }

    if (!includeMetadata) {
      delete exportData.metadata;
    }

    return exportData;
  }

  // Import project data (with validation)
  async importProject(importData, options = {}) {
    const {
      preserveHistory = true,
      validateData = true
    } = options;

    if (validateData) {
      this.validateLoadData(importData);
    }

    // Clean up imported data
    const cleanData = { ...importData };
    
    if (!preserveHistory) {
      delete cleanData.commandHistory;
    }

    // Load the imported project
    return await this.loadProject(cleanData, preserveHistory);
  }

  // Abstract methods to be implemented by specific project managers
  async performSave(saveData) {
    // Override this method in specific implementations
    throw new Error('performSave must be implemented by subclass');
  }

  async performLoad(projectPath) {
    // Override this method in specific implementations
    throw new Error('performLoad must be implemented by subclass');
  }

  // Event system
  emitSaveEvent(event, data) {
    // Override this method to integrate with your event system
    console.log(`Project event: ${event}`, data);
  }

  // Get migration helpers for version updates
  getMigrationHelpers() {
    return {
      // Migrate command history from older versions
      migrateCommandHistory: (oldHistory) => {
        if (!oldHistory || !oldHistory.commands) {
          return null;
        }

        // Add any necessary migrations here
        return oldHistory;
      },

      // Migrate project data structure
      migrateProjectData: (oldData, fromVersion, toVersion) => {
        let migratedData = { ...oldData };

        // Add version-specific migrations here
        if (fromVersion < '1.1.0' && toVersion >= '1.1.0') {
          // Example migration
          migratedData.metadata = {
            ...migratedData.metadata,
            migrated: true,
            fromVersion,
            toVersion
          };
        }

        return migratedData;
      }
    };
  }

  // Cleanup resources
  cleanup() {
    this.stopAutoSave();
    commandHistory.cleanup();
  }
}

// Browser-specific implementation using localStorage
class BrowserProjectManager extends ProjectHistoryIntegration {
  constructor() {
    super();
    this.storageKey = 'freecad_ai_project';
    this.backupKey = 'freecad_ai_project_backup';
  }

  async performSave(saveData) {
    try {
      // Create backup of current data
      const currentData = localStorage.getItem(this.storageKey);
      if (currentData) {
        localStorage.setItem(this.backupKey, currentData);
      }

      // Save new data
      localStorage.setItem(this.storageKey, JSON.stringify(saveData));
      
      return { success: true, path: this.storageKey };
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return { success: false, error };
    }
  }

  async performLoad(projectPath = this.storageKey) {
    try {
      const data = localStorage.getItem(projectPath);
      if (!data) {
        throw new Error('No project data found');
      }

      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      throw error;
    }
  }

  // Browser-specific auto-save
  async performAutoSave() {
    try {
      const currentProject = await this.getCurrentProject();
      if (currentProject) {
        await this.saveProject(currentProject, true);
        console.log('Auto-save completed');
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  async getCurrentProject() {
    try {
      return await this.performLoad();
    } catch (error) {
      return null;
    }
  }
}

// Export instances
const projectHistoryIntegration = new ProjectHistoryIntegration();
const browserProjectManager = new BrowserProjectManager();

export default projectHistoryIntegration;
export { 
  ProjectHistoryIntegration, 
  BrowserProjectManager,
  browserProjectManager 
}; 