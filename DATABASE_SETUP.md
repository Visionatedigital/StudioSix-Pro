# Database Setup for User Projects

This document contains the SQL commands needed to set up the user projects table in Supabase.

## Prerequisites

- Supabase project set up
- Authentication enabled
- Access to SQL Editor in Supabase Dashboard

## Setup Instructions

### 1. Create the User Projects Table

Go to your Supabase Dashboard → SQL Editor and run the following SQL:

```sql
-- Create user_projects table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_last_modified ON user_projects(last_modified DESC);
CREATE INDEX IF NOT EXISTS idx_user_projects_saved ON user_projects(saved);
```

### 2. Set Up Row Level Security (RLS)

Enable RLS and create policies to ensure users can only access their own projects:

```sql
-- Enable Row Level Security
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own projects
CREATE POLICY "Users can view own projects" ON user_projects
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own projects
CREATE POLICY "Users can insert own projects" ON user_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own projects
CREATE POLICY "Users can update own projects" ON user_projects
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own projects
CREATE POLICY "Users can delete own projects" ON user_projects
  FOR DELETE USING (auth.uid() = user_id);
```

### 3. Create Helper Functions (Optional)

```sql
-- Function to get user projects with formatted data
CREATE OR REPLACE FUNCTION get_user_projects(user_uuid UUID)
RETURNS TABLE(
  project_id TEXT,
  name TEXT,
  description TEXT,
  type TEXT,
  template JSONB,
  project_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  last_modified TIMESTAMP WITH TIME ZONE,
  last_opened TIMESTAMP WITH TIME ZONE,
  progress INTEGER,
  version TEXT,
  saved BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.project_id,
    up.name,
    up.description,
    up.type,
    up.template,
    up.project_data,
    up.created_at,
    up.last_modified,
    up.last_opened,
    up.progress,
    up.version,
    up.saved
  FROM user_projects up
  WHERE up.user_id = user_uuid
    AND up.saved = true
  ORDER BY up.last_modified DESC;
END;
$$;
```

## Verification

After running these commands, verify the setup:

1. **Check Table Creation:**
   ```sql
   SELECT * FROM user_projects LIMIT 1;
   ```

2. **Check RLS Policies:**
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'user_projects';
   ```

3. **Test Project Creation:**
   - Create a new project in your app
   - Save it
   - Check if it appears in the database

## Table Structure

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | References auth.users(id) |
| `project_id` | TEXT | App-generated project ID |
| `name` | TEXT | Project name |
| `description` | TEXT | Project description |
| `type` | TEXT | Project type (Residential, Commercial, etc.) |
| `template` | JSONB | Template configuration |
| `project_data` | JSONB | Additional project data |
| `created_at` | TIMESTAMP | Creation timestamp |
| `last_modified` | TIMESTAMP | Last modification timestamp |
| `last_opened` | TIMESTAMP | Last opened timestamp |
| `progress` | INTEGER | Project completion percentage |
| `version` | TEXT | Project version |
| `local_path` | TEXT | Local file path (if any) |
| `thumbnail_path` | TEXT | Thumbnail image path |
| `file_path` | TEXT | Saved file path |
| `format` | TEXT | File format |
| `saved` | BOOLEAN | Whether project is saved |
| `has_unsaved_changes` | BOOLEAN | Whether project has unsaved changes |

## Security Features

- **Row Level Security**: Users can only access their own projects
- **Foreign Key Constraint**: Projects are automatically deleted when user is deleted
- **Unique Constraint**: Prevents duplicate projects per user
- **Indexes**: Optimized for common query patterns

## Troubleshooting

### Common Issues:

1. **RLS Policy Errors**: Make sure `auth.uid()` is available and user is authenticated
2. **Permission Denied**: Check if RLS policies are correctly set up
3. **Foreign Key Violations**: Ensure user exists in `auth.users` table

### Reset Table (if needed):
```sql
-- CAUTION: This will delete all project data
DROP TABLE IF EXISTS user_projects CASCADE;
```

Then re-run the setup commands above. 