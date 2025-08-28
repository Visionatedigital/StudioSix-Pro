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
   * Check if Supabase is available and table exists
   */
  async isAvailable() {
    if (!supabase) {
      console.warn('⚠️ Supabase client not initialized');
      return false;
    }

    // For manual auth users, bypass Supabase authentication and just check table access
    try {
      // console.log('🔍 Testing user_projects table access...');
      
      // Use service role or admin mode to test table existence
      // This bypasses RLS for the availability check
      const { data, error } = await supabase
        .from('user_projects')
        .select('count')
        .limit(1);
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Table doesn't exist
          console.warn('⚠️ user_projects table does not exist. Please run the Supabase setup SQL.');
          console.warn('📖 See SUPABASE_SETUP.md for instructions');
          return false;
        } else {
          console.warn('⚠️ Supabase query error during availability check:', error);
          return false;
        }
      }
      
      // console.log('✅ Supabase user_projects table is accessible');
      return true;
    } catch (err) {
      console.warn('⚠️ Supabase connection test failed:', err.message);
      return false;
    }
  }

  /**
   * Create the projects table (run this once)
   */
  async createProjectsTable() {
    if (!await this.isAvailable()) {
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
   * Save a project for a specific user (supports manual auth)
   */
  async saveProject(userId, project) {
    if (!await this.isAvailable()) {
      console.warn('⚠️ Supabase not available, skipping project save');
      return { success: false, error: 'Supabase not available' };
    }

    try {
      console.log('💾 Attempting to save project to Supabase:', project.name);
      
      // Create minimal project data first to test
      const projectData = {
        user_id: userId,
        project_id: project.id,
        name: project.name || 'Untitled Project',
        description: project.description || '',
        type: project.type || 'Project',
        saved: true,
        format: project.format || 'six.bim'
      };

      console.log('💾 Project data to save:', projectData);

      // Try simple insert first without upsert
      const { data, error } = await supabase
        .from(this.tableName)
        .insert([projectData])
        .select();

      if (error) {
        console.error('❌ Failed to save project:', error);
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // If it's a conflict error, try update instead
        if (error.code === '23505') {
          console.log('🔄 Conflict detected, trying update instead...');
          const { data: updateData, error: updateError } = await supabase
            .from(this.tableName)
            .update(projectData)
            .eq('user_id', userId)
            .eq('project_id', project.id)
            .select();
            
          if (updateError) {
            console.error('❌ Update also failed:', updateError);
            return { success: false, error: updateError.message };
          }
          
          console.log('✅ Project updated successfully');
          return { success: true, data: updateData[0] };
        }
        
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
    if (!await this.isAvailable()) {
      console.warn('⚠️ Supabase not available, returning empty projects');
      return { success: false, error: 'Supabase not available', projects: [] };
    }

    try {
      console.log('🔍 Fetching projects for user:', userId);
      
      // First try a simpler query to test basic access
      const { data: testData, error: testError } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .limit(5);

      if (testError) {
        console.error('❌ Basic query failed:', testError);
        return { success: false, error: testError.message, projects: [] };
      }

      console.log('✅ Basic query succeeded, found records:', testData?.length || 0);

      // Now try the full query without saved filter first
      const { data: allData, error: allError } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .order('last_modified', { ascending: false });

      if (allError) {
        console.error('❌ Query without saved filter failed:', allError);
        return { success: false, error: allError.message, projects: [] };
      }

      console.log('✅ Query without saved filter succeeded, found records:', allData?.length || 0);

      // Filter saved projects in JavaScript instead of SQL to avoid type issues
      const data = allData.filter(project => project.saved === true);
      
      console.log('✅ Final filtered data:', data?.length || 0, 'saved projects');

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
    if (!await this.isAvailable()) {
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
    if (!await this.isAvailable()) {
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
    if (!await this.isAvailable()) {
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