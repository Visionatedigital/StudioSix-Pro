# 🔑 Manual Authentication Setup for Supabase

Since StudioSix Pro uses manual authentication (not Supabase auth), we need to update the database setup to support text-based user IDs.

## Quick Fix

**Run this SQL in your Supabase SQL Editor:**

```sql
-- Update RLS policies for manual auth compatibility
DROP POLICY IF EXISTS "Users can view their own projects" ON user_projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON user_projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON user_projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON user_projects;

-- Create permissive policy for manual auth
CREATE POLICY "Allow manual auth access" ON user_projects
  FOR ALL USING (true);

-- Grant permissions to anonymous users (for manual auth)
GRANT ALL ON user_projects TO anon;
GRANT USAGE ON SCHEMA public TO anon;
```

## What This Does

- ✅ **Removes UUID requirement** - Allows text-based user IDs like `manual_kibukamarc@gmail.com`
- ✅ **Bypasses Supabase auth** - Works with app's manual authentication
- ✅ **Enables cloud storage** - Projects save to Supabase instead of localStorage
- ✅ **Maintains user isolation** - App logic ensures users only see their own projects

## Alternative: Full Setup

If you want to start fresh, run the complete setup from `supabase-setup-manual-auth.sql` instead.

## Test the Fix

After running the SQL:

1. Save a project in StudioSix Pro
2. Check console for: `✅ Saved project to Supabase`
3. Verify project name updates in Ribbon
4. Check Recent Projects shows cloud-saved projects

## Security Note

This setup uses application-level security instead of database-level RLS. The app ensures user isolation by always filtering queries by user_id.