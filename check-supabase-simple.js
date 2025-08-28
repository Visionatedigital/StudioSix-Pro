/**
 * Simple Supabase Schema Check (Node.js compatible)
 */

import { createClient } from '@supabase/supabase-js';

// Use your Supabase credentials directly
const supabaseUrl = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cm9vcXZ3eGR3dm51aHBlcHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NzUxMzAsImV4cCI6MjA2OTQ1MTEzMH0.fW8hwOwQ1nxMScr2yZTnWNxFTrCJimn2L1y7avTapBc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSupabaseSchema() {
  console.log('🔍 Checking Supabase database schema...\n');
  
  try {
    // Test 1: Check if user_profiles table exists
    console.log('📋 Testing user_profiles table...');
    const { data: userProfiles, error: userProfilesError } = await supabase
      .from('user_profiles')
      .select('id, subscription_tier')
      .limit(1);
    
    if (userProfilesError) {
      console.log('❌ user_profiles table ERROR:', userProfilesError.message);
      console.log('   Code:', userProfilesError.code);
      
      if (userProfilesError.code === '42P01') {
        console.log('   → Table does NOT exist - schema needs deployment');
      }
    } else {
      console.log('✅ user_profiles table EXISTS');
      console.log('   Data sample:', userProfiles);
    }
    
    // Test 2: Check if subscription_usage_history table exists  
    console.log('\n📊 Testing subscription_usage_history table...');
    const { data: usageData, error: usageError } = await supabase
      .from('subscription_usage_history')
      .select('id, usage_type')
      .limit(1);
    
    if (usageError) {
      console.log('❌ subscription_usage_history table ERROR:', usageError.message);
      if (usageError.code === '42P01') {
        console.log('   → Table does NOT exist - schema needs deployment');
      }
    } else {
      console.log('✅ subscription_usage_history table EXISTS');
    }
    
    // Test 3: Check available functions
    console.log('\n🔧 Testing database functions...');
    const { data: funcData, error: funcError } = await supabase.rpc('get_subscription_limits', {
      user_tier: 'free'
    });
    
    if (funcError) {
      console.log('❌ get_subscription_limits function ERROR:', funcError.message);
      if (funcError.code === '42883') {
        console.log('   → Function does NOT exist - schema needs deployment');
      }
    } else {
      console.log('✅ get_subscription_limits function EXISTS');
      console.log('   Free tier limits:', funcData);
    }
    
    // Summary
    console.log('\n📋 SUMMARY');
    console.log('===========');
    if (userProfilesError?.code === '42P01') {
      console.log('❌ Subscription schema NOT deployed to Supabase');
      console.log('   Next step: Run /database/user-subscriptions-schema.sql in Supabase SQL Editor');
      console.log('   URL: https://supabase.com/dashboard/project/zwrooqvwxdwvnuhpepta/sql');
    } else if (!userProfilesError) {
      console.log('✅ Subscription schema IS deployed to Supabase');
      console.log('   System ready for subscription tracking!');
    } else {
      console.log('⚠️ Unable to determine schema status');
      console.log('   Check Supabase dashboard manually');
    }
    
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    console.log('   Check your internet connection and Supabase credentials');
  }
}

checkSupabaseSchema();