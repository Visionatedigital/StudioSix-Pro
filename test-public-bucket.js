/**
 * Test public bucket access now that it's public
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cm9vcXZ3eGR3dm51aHBlcHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NzUxMzAsImV4cCI6MjA2OTQ1MTEzMH0.fW8hwOwQ1nxMScr2yZTnWNxFTrCJimn2L1y7avTapBc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPublicAccess() {
  console.log('🔓 Testing public bucket access...');
  
  try {
    // Test bucket listing
    console.log('\n📦 Listing all buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('❌ Buckets error:', bucketsError);
    } else {
      console.log('✅ Available buckets:', buckets.map(b => `${b.name} (${b.public ? 'public' : 'private'})`));
    }
    
    // Test models_fbx bucket root
    console.log('\n📁 Testing models_fbx root...');
    const { data: rootData, error: rootError } = await supabase.storage
      .from('models_fbx')
      .list('', { limit: 100 });
    
    if (rootError) {
      console.error('❌ Root error:', rootError);
    } else {
      console.log('✅ Root contents:', rootData.length, 'items');
      rootData.forEach((item, i) => {
        console.log(`   ${i+1}. ${item.name} ${item.metadata ? '(file)' : '(folder)'}`);
      });
    }
    
    // Test direct public URL
    console.log('\n🌐 Testing public URL...');
    const { data: urlData } = supabase.storage
      .from('models_fbx')
      .getPublicUrl('test');
    console.log('📎 Base public URL:', urlData.publicUrl.replace('/test', ''));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPublicAccess().then(() => {
  console.log('\n✅ Public access test completed');
}).catch(err => {
  console.error('❌ Test failed:', err);
});


