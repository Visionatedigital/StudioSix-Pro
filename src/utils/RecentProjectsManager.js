/**
 * Recent Projects Manager
 * Tracks recently opened/created projects and manages project metadata
 * Now supports user-specific projects with Supabase integration
 */

import supabaseProjectsService from '../services/SupabaseProjectsService';

class RecentProjectsManager {
  constructor() {
    this.storageKey = 'studiosix_recent_projects';
    this.maxRecentProjects = 10;
    this.currentUserId = null;
  }

  /**
   * Set the current user ID for all operations
   */
  setCurrentUser(userId) {
    this.currentUserId = userId;
    console.log('👤 RecentProjectsManager: Set current user:', userId);
  }

  /**
   * Clear the current user (for sign out)
   */
  clearCurrentUser() {
    this.currentUserId = null;
    console.log('👤 RecentProjectsManager: Cleared current user');
  }

  /**
   * Generate a unique project ID
   */
  generateProjectId() {
    return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Create a new project with unique metadata
   */
  createNewProject(projectConfig) {
    const projectId = this.generateProjectId();
    const now = new Date();
    
    const newProject = {
      id: projectId,
      name: projectConfig.projectData?.name || 
            projectConfig.template?.title || 
            'Untitled Project',
      description: projectConfig.projectData?.description || 
                  projectConfig.template?.description || 
                  '',
      type: this.getProjectTypeFromTemplate(projectConfig.template?.id),
      template: projectConfig.template,
      projectData: projectConfig.projectData,
      
      // Metadata
      createdAt: now.toISOString(),
      lastModified: now.toISOString(),
      lastOpened: now.toISOString(),
      progress: 0,
      version: '1.0.0',
      
      // File paths (for future use)
      localPath: null,
      thumbnailPath: null,
      
      // Status
      isNew: true,
      hasUnsavedChanges: false,
      saved: false,
      
      // User association
      userId: this.currentUserId,
      userEmail: projectConfig.userEmail
    };

    // Don't automatically add to recent projects - only add when saved
    // Projects will be added to recent projects via addToRecentProjects() when they're first saved
    
    console.log('🆕 Created new project (not in recent projects yet):', newProject.name, 'ID:', projectId);
    return newProject;
  }

  /**
   * Get project type from template ID
   */
  getProjectTypeFromTemplate(templateId) {
    const typeMap = {
      'residential-home': 'Residential',
      'commercial-office': 'Commercial', 
      'retail-space': 'Retail',
      'custom-project': 'Custom',
      'imported-file': 'Imported'
    };
    return typeMap[templateId] || 'Custom';
  }

  /**
   * Update an existing project's metadata
   */
  async updateProject(projectId, updates) {
    // Try Supabase first
    if (this.currentUserId && supabaseProjectsService.isAvailable()) {
      try {
        const result = await supabaseProjectsService.updateProject(
          this.currentUserId, 
          projectId, 
          updates
        );
        if (result.success) {
          console.log('✅ Updated project in Supabase:', result.data.name);
          return result.data;
        }
      } catch (error) {
        console.warn('⚠️ Failed to update project in Supabase, falling back to localStorage:', error);
      }
    }

    // Fallback to localStorage
    const recentProjects = this.getRecentProjects();
    const projectIndex = recentProjects.findIndex(p => p.id === projectId);
    
    if (projectIndex !== -1) {
      const updatedProject = {
        ...recentProjects[projectIndex],
        ...updates,
        lastModified: new Date().toISOString(),
        isNew: false
      };
      
      recentProjects[projectIndex] = updatedProject;
      this.saveRecentProjects(recentProjects);
      
      console.log('📝 Updated project in localStorage:', updatedProject.name);
      return updatedProject;
    }
    
    return null;
  }

  /**
   * Mark a project as opened (updates lastOpened timestamp)
   */
  async markProjectOpened(projectId) {
    // Try Supabase first
    if (this.currentUserId && supabaseProjectsService.isAvailable()) {
      try {
        const result = await supabaseProjectsService.markProjectOpened(
          this.currentUserId, 
          projectId
        );
        if (result.success) {
          console.log('✅ Marked project as opened in Supabase:', projectId);
          return result.data;
        }
      } catch (error) {
        console.warn('⚠️ Failed to mark project as opened in Supabase:', error);
      }
    }

    // Fallback to localStorage
    return await this.updateProject(projectId, {
      lastOpened: new Date().toISOString()
    });
  }

  /**
   * Update project progress
   */
  updateProgress(projectId, progress) {
    return this.updateProject(projectId, { progress });
  }

  /**
   * Add project to recent projects (when saved for the first time)
   */
  async addToRecentProjects(project) {
    if (!project || !project.id) {
      console.error('❌ Cannot add invalid project to recent projects');
      return;
    }

    // Mark project as saved
    const savedProject = {
      ...project,
      saved: true,
      lastOpened: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    // Try to save to Supabase first
    if (this.currentUserId && supabaseProjectsService.isAvailable()) {
      try {
        const result = await supabaseProjectsService.saveProject(
          this.currentUserId, 
          savedProject
        );
        if (result.success) {
          console.log('✅ Saved project to Supabase:', savedProject.name);
          return savedProject;
        }
      } catch (error) {
        console.warn('⚠️ Failed to save project to Supabase, falling back to localStorage:', error);
      }
    }

    // Fallback to localStorage
    const recentProjects = this.getRecentProjects();
    
    // Remove existing entry if it exists
    const existingIndex = recentProjects.findIndex(p => p.id === project.id);
    if (existingIndex !== -1) {
      recentProjects.splice(existingIndex, 1);
    }
    
    // Add to the beginning
    recentProjects.unshift(savedProject);
    
    // Keep only the most recent projects
    if (recentProjects.length > this.maxRecentProjects) {
      recentProjects.splice(this.maxRecentProjects);
    }
    
    this.saveRecentProjects(recentProjects);
    console.log('📥 Added project to localStorage recent projects:', savedProject.name);
    
    return savedProject;
  }

  /**
   * Get recent projects - tries Supabase first, then localStorage
   */
  async getRecentProjects() {
    // Try Supabase first if user is authenticated
    if (this.currentUserId && supabaseProjectsService.isAvailable()) {
      try {
        const result = await supabaseProjectsService.getUserProjects(this.currentUserId);
        if (result.success && result.projects.length > 0) {
          console.log(`📋 Loaded ${result.projects.length} projects from Supabase`);
          return result.projects;
        }
      } catch (error) {
        console.warn('⚠️ Failed to load projects from Supabase, falling back to localStorage:', error);
      }
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(this.storageKey);
      const projects = stored ? JSON.parse(stored) : [];
      console.log(`📋 Loaded ${projects.length} projects from localStorage`);
      return projects;
    } catch (error) {
      console.error('Failed to load projects from localStorage:', error);
      return [];
    }
  }

  /**
   * Save recent projects to localStorage (backup/fallback)
   */
  saveRecentProjects(projects) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(projects));
    } catch (error) {
      console.error('Failed to save projects to localStorage:', error);
    }
  }

  /**
   * Get a specific project by ID
   */
  async getProject(projectId) {
    const recentProjects = await this.getRecentProjects();
    return recentProjects.find(project => project.id === projectId) || null;
  }

  /**
   * Remove a project from recent projects
   */
  async removeProject(projectId) {
    // Try Supabase first
    if (this.currentUserId && supabaseProjectsService.isAvailable()) {
      try {
        const result = await supabaseProjectsService.deleteProject(
          this.currentUserId, 
          projectId
        );
        if (result.success) {
          console.log('🗑️ Removed project from Supabase:', projectId);
          return;
        }
      } catch (error) {
        console.warn('⚠️ Failed to remove project from Supabase:', error);
      }
    }

    // Fallback to localStorage
    const recentProjects = await this.getRecentProjects();
    const filteredProjects = recentProjects.filter(project => project.id !== projectId);
    this.saveRecentProjects(filteredProjects);
    console.log('🗑️ Removed project from localStorage:', projectId);
  }

  /**
   * Clear all recent projects
   */
  async clearRecentProjects() {
    // Clear from Supabase
    if (this.currentUserId && supabaseProjectsService.isAvailable()) {
      try {
        const result = await supabaseProjectsService.clearUserProjects(this.currentUserId);
        if (result.success) {
          console.log('🧹 Cleared all projects from Supabase');
        }
      } catch (error) {
        console.warn('⚠️ Failed to clear projects from Supabase:', error);
      }
    }

    // Clear from localStorage
    localStorage.removeItem(this.storageKey);
    console.log('🧹 Cleared all projects from localStorage');
  }

  /**
   * Get time ago string for display
   */
  getTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Get recent projects formatted for UI display
   */
  async getRecentProjectsForUI() {
    const projects = await this.getRecentProjects();
    
    // Filter only saved projects and add time ago
    return projects
      .filter(project => project.saved !== false)
      .map(project => ({
        ...project,
        timeAgo: this.getTimeAgo(project.lastModified || project.createdAt)
      }))
      .slice(0, this.maxRecentProjects);
  }

  /**
   * Search projects by name or description
   */
  async searchProjects(query) {
    const projects = await this.getRecentProjects();
    const lowercaseQuery = query.toLowerCase();
    
    return projects.filter(project => 
      project.name.toLowerCase().includes(lowercaseQuery) ||
      (project.description && project.description.toLowerCase().includes(lowercaseQuery))
    );
  }
}

// Export singleton instance
const recentProjectsManager = new RecentProjectsManager();
export default recentProjectsManager; 