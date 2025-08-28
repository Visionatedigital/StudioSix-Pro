/**
 * Check current Supabase database schema
 */

import { supabase } from './src/config/supabase.js';

async function checkSupabaseSchema() {
  console.log('🔍 Checking current Supabase database schema...\n');
  
  try {
    // Check if user_profiles table exists
    console.log('📋 Checking for user_profiles table...');
    const { data: userProfiles, error: userProfilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);
    
    if (userProfilesError) {
      if (userProfilesError.code === '42P01') {
        console.log('❌ user_profiles table does NOT exist');
        console.log('   Schema needs to be deployed to Supabase\n');
      } else {
        console.log('❌ Error checking user_profiles:', userProfilesError.message);
      }
    } else {
      console.log('✅ user_profiles table EXISTS');
      console.log('   Sample data:', userProfiles);
    }
    
    // Check if subscription_usage_history table exists
    console.log('📋 Checking for subscription_usage_history table...');
    const { data: usageHistory, error: usageError } = await supabase
      .from('subscription_usage_history')
      .select('*')
      .limit(1);
    
    if (usageError) {
      if (usageError.code === '42P01') {
        console.log('❌ subscription_usage_history table does NOT exist');
      } else {
        console.log('❌ Error checking subscription_usage_history:', usageError.message);
      }
    } else {
      console.log('✅ subscription_usage_history table EXISTS');
    }
    
    // Check current auth users
    console.log('\n👥 Checking current authenticated users...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      console.log('✅ Current user:', user.email || user.id);
    } else {
      console.log('ℹ️ No current user authenticated');
    }
    
    // Check existing tables in public schema
    console.log('\n📊 Checking all public tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tablesError) {
      console.log('❌ Could not list tables:', tablesError.message);
    } else {
      console.log('📋 Existing public tables:', tables?.map(t => t.table_name) || []);
    }
    
  } catch (error) {
    console.error('❌ Error checking Supabase schema:', error);
  }
}

checkSupabaseSchema();