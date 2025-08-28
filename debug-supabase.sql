-- Debug Supabase Issues
-- Run these queries one by one to identify the problem

-- 1. Check if table exists and its structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_projects'
ORDER BY ordinal_position;

-- 2. Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_projects';

-- 3. Try a simple insert to test the schema
INSERT INTO user_projects (
  user_id, 
  project_id, 
  name, 
  type,
  saved
) VALUES (
  'test_debug_user',
  'test_debug_project',
  'Debug Test Project',
  'Test',
  true
) ON CONFLICT (user_id, project_id) DO UPDATE SET
  name = EXCLUDED.name,
  last_modified = NOW();

-- 4. Try a simple select
SELECT user_id, project_id, name, saved, created_at 
FROM user_projects 
WHERE user_id = 'test_debug_user'
LIMIT 1;

-- 5. Clean up test data
DELETE FROM user_projects WHERE user_id = 'test_debug_user';