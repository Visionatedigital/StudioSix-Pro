import { supabase } from '../config/supabase';

/**
 * Supabase Projects Service
 * Handles user-specific project storage and retrieval
 */
class SupabaseProjectsService {
  constructor() {
    this.tableName = 'user_projects';
  }

  /**
   * Check if Supabase is available
   */
  isAvailable() {
    return !!supabase;
  }

  /**
   * Create the projects table (run this once)
   */
  async createProjectsTable() {
    if (!this.isAvailable()) {
      throw new Error('Supabase not available');
    }

    // This would typically be done via Supabase SQL editor or migrations
    const tableSchema = `
      CREATE TABLE IF NOT EXISTS user_projects (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT,
        template JSONB,
        project_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_opened TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        progress INTEGER DEFAULT 0,
        version TEXT DEFAULT '1.0.0',
        local_path TEXT,
        thumbnail_path TEXT,
        file_path TEXT,
        format TEXT,
        saved BOOLEAN DEFAULT false,
        has_unsaved_changes BOOLEAN DEFAULT false,
        UNIQUE(user_id, project_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON user_projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_projects_last_modified ON user_projects(last_modified DESC);
    `;

    console.log('📋 Projects table schema ready:', tableSchema);
    return tableSchema;
  }

  /**
   * Save a project for a specific user
   */
  async saveProject(userId, project) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Supabase not available, skipping project save');
      return { success: false, error: 'Supabase not available' };
    }

    try {
      const projectData = {
        user_id: userId,
        project_id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        template: project.template,
        project_data: project.projectData,
        last_modified: new Date().toISOString(),
        last_opened: project.lastOpened || new Date().toISOString(),
        progress: project.progress || 0,
        version: project.version || '1.0.0',
        local_path: project.localPath,
        thumbnail_path: project.thumbnailPath,
        file_path: project.filePath,
        format: project.format,
        saved: true,
        has_unsaved_changes: project.hasUnsavedChanges || false
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .upsert(projectData, {
          onConflict: 'user_id,project_id'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to save project:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Project saved to Supabase:', project.name);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error saving project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all projects for a specific user
   */
  async getUserProjects(userId) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Supabase not available, returning empty projects');
      return { success: false, error: 'Supabase not available', projects: [] };
    }

    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('saved', true)
        .order('last_modified', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch user projects:', error);
        return { success: false, error: error.message, projects: [] };
      }

      // Convert Supabase format back to project format
      const projects = data.map(this.convertFromSupabaseFormat);

      console.log(`📋 Fetched ${projects.length} projects for user:`, userId);
      return { success: true, projects };
    } catch (error) {
      console.error('❌ Error fetching projects:', error);
      return { success: false, error: error.message, projects: [] };
    }
  }

  /**
   * Update a project's metadata
   */
  async updateProject(userId, projectId, updates) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase not available' };
    }

    try {
      const updateData = {
        ...updates,
        last_modified: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to update project:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Project updated in Supabase:', projectId);
      return { success: true, data: this.convertFromSupabaseFormat(data) };
    } catch (error) {
      console.error('❌ Error updating project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(userId, projectId) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase not available' };
    }

    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId);

      if (error) {
        console.error('❌ Failed to delete project:', error);
        return { success: false, error: error.message };
      }

      console.log('🗑️ Project deleted from Supabase:', projectId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark a project as opened (update last_opened timestamp)
   */
  async markProjectOpened(userId, projectId) {
    return await this.updateProject(userId, projectId, {
      last_opened: new Date().toISOString()
    });
  }

  /**
   * Convert Supabase row format to project format
   */
  convertFromSupabaseFormat(row) {
    return {
      id: row.project_id,
      name: row.name,
      description: row.description,
      type: row.type,
      template: row.template,
      projectData: row.project_data,
      createdAt: row.created_at,
      lastModified: row.last_modified,
      lastOpened: row.last_opened,
      progress: row.progress,
      version: row.version,
      localPath: row.local_path,
      thumbnailPath: row.thumbnail_path,
      filePath: row.file_path,
      format: row.format,
      saved: row.saved,
      hasUnsavedChanges: row.has_unsaved_changes,
      userId: row.user_id
    };
  }

  /**
   * Clear all projects for a user (useful for testing)
   */
  async clearUserProjects(userId) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Supabase not available' };
    }

    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Failed to clear projects:', error);
        return { success: false, error: error.message };
      }

      console.log('🧹 Cleared all projects for user:', userId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing projects:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const supabaseProjectsService = new SupabaseProjectsService();
export default supabaseProjectsService; 