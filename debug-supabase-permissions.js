/**
 * Debug Supabase permissions for models_fbx bucket
 */
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cm9vcXZ3eGR3dm51aHBlcHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NzUxMzAsImV4cCI6MjA2OTQ1MTEzMH0.fW8hwOwQ1nxMScr2yZTnWNxFTrCJimn2L1y7avTapBc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugPermissions() {
  console.log('🔐 Debugging Supabase permissions...');
  
  try {
    // Test 1: Check current user/session
    console.log('\n👤 Checking current session...');
    const { data: session } = await supabase.auth.getSession();
    console.log('Session:', session.session ? 'Active' : 'None');
    
    // Test 2: Try direct bucket access (this might give more specific error)
    console.log('\n📦 Testing direct bucket access...');
    try {
      const { data, error } = await supabase.storage
        .from('models_fbx')
        .list('');
      
      if (error) {
        console.log('❌ Direct access error:', error);
      } else {
        console.log('✅ Direct access successful:', data);
      }
    } catch (directError) {
      console.log('❌ Direct access exception:', directError.message);
    }
    
    // Test 3: Try public URL without authentication
    console.log('\n🌐 Testing public URL access...');
    const fetch = require('node-fetch');
    
    try {
      const response = await fetch('https://zwrooqvwxdwvnuhpepta.supabase.co/storage/v1/object/public/models_fbx/');
      console.log('📊 Public URL response status:', response.status);
      console.log('📊 Public URL response headers:', Object.fromEntries(response.headers));
      
      if (response.status === 200) {
        const text = await response.text();
        console.log('📄 Public URL content preview:', text.substring(0, 200));
      }
    } catch (fetchError) {
      console.log('❌ Public URL fetch error:', fetchError.message);
    }
    
    // Test 4: Try alternative bucket names
    console.log('\n🔍 Testing alternative bucket names...');
    const alternativeNames = ['models-fbx', 'modelsfbx', 'models_FBX', 'Models_fbx'];
    
    for (const bucketName of alternativeNames) {
      try {
        const { data, error } = await supabase.storage.from(bucketName).list('', { limit: 1 });
        if (!error) {
          console.log(`✅ Found alternative bucket: ${bucketName}`);
        } else {
          console.log(`❌ Bucket ${bucketName} error: ${error.message}`);
        }
      } catch (err) {
        console.log(`❌ Bucket ${bucketName} exception: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugPermissions().then(() => {
  console.log('\n✅ Permission debug completed');
}).catch(err => {
  console.error('❌ Debug script failed:', err);
});

