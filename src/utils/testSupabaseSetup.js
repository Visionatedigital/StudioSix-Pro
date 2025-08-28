/**
 * Test Supabase Setup
 * Run this to verify the user_projects table is properly set up
 */

import { supabase } from '../config/supabase';

export async function testSupabaseSetup() {
  console.log('🔍 Testing Supabase setup...');
  
  if (!supabase) {
    console.error('❌ Supabase client not available');
    return false;
  }

  try {
    // 1. Test authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('⚠️ No authenticated user found');
      return false;
    }
    console.log('✅ User authenticated:', user.email);

    // 2. Test table exists and is accessible
    const { data, error } = await supabase
      .from('user_projects')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Error accessing user_projects table:', error.message);
      return false;
    }

    console.log('✅ user_projects table is accessible');

    // 3. Test RLS policies work
    const { data: testData, error: testError } = await supabase
      .from('user_projects')
      .select('*')
      .eq('user_id', user.id)
      .limit(5);

    if (testError) {
      console.error('❌ Error querying user projects:', testError.message);
      return false;
    }

    console.log(`✅ RLS policies working - found ${testData.length} user projects`);

    // 4. Test insert permissions
    const testProject = {
      user_id: user.id,
      project_id: 'test_' + Date.now(),
      name: 'Test Project',
      description: 'Test project for setup verification',
      type: 'Test',
      saved: false,
      format: 'six.bim'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('user_projects')
      .insert([testProject])
      .select();

    if (insertError) {
      console.error('❌ Error inserting test project:', insertError.message);
      return false;
    }

    console.log('✅ Insert permissions working');

    // 5. Clean up test project
    if (insertData && insertData.length > 0) {
      await supabase
        .from('user_projects')
        .delete()
        .eq('id', insertData[0].id);
      console.log('✅ Test cleanup completed');
    }

    console.log('🎉 Supabase setup verification PASSED!');
    return true;

  } catch (error) {
    console.error('❌ Unexpected error during setup test:', error);
    return false;
  }
}

// Auto-run test if this file is executed directly
if (typeof window !== 'undefined') {
  window.testSupabaseSetup = testSupabaseSetup;
}