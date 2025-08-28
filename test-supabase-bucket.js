/**
 * Test script to check Supabase bucket structure directly
 */
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cm9vcXZ3eGR3dm51aHBlcHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NzUxMzAsImV4cCI6MjA2OTQ1MTEzMH0.fW8hwOwQ1nxMScr2yZTnWNxFTrCJimn2L1y7avTapBc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testBucketStructure() {
  console.log('🧪 Testing Supabase bucket structure...');
  console.log('🔗 URL:', supabaseUrl);
  
  try {
    // Test 1: List all buckets
    console.log('\n📦 Testing bucket listing...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
    } else {
      console.log('✅ Available buckets:', buckets.map(b => b.name));
      
      // Check if models_fbx exists
      const modelsBucket = buckets.find(b => b.name === 'models_fbx');
      if (modelsBucket) {
        console.log('✅ models_fbx bucket found:', modelsBucket);
      } else {
        console.log('❌ models_fbx bucket not found');
        return;
      }
    }
    
    // Test 2: List models_fbx bucket root
    console.log('\n📂 Testing models_fbx bucket root listing...');
    const { data: rootContents, error: rootError } = await supabase.storage
      .from('models_fbx')
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (rootError) {
      console.error('❌ Failed to list bucket root:', rootError);
    } else {
      console.log('✅ Bucket root contents:');
      console.log('📊 Number of items:', rootContents.length);
      
      rootContents.forEach((item, index) => {
        console.log(`📁 Item ${index + 1}:`, {
          name: item.name,
          id: item.id,
          metadata: item.metadata,
          created_at: item.created_at
        });
      });
    }
    
    // Test 3: Try to access specific folders
    console.log('\n🔍 Testing direct folder access...');
    const testFolders = ['Side Tables', 'chairs', 'Lounge Chairs', 'Side_Tables'];
    
    for (const folderName of testFolders) {
      try {
        console.log(`\n🔍 Testing folder: "${folderName}"`);
        const { data: folderContents, error: folderError } = await supabase.storage
          .from('models_fbx')
          .list(folderName, { limit: 10 });
        
        if (folderError) {
          console.log(`❌ Folder "${folderName}" error:`, folderError.message);
        } else {
          console.log(`✅ Folder "${folderName}" contents:`, folderContents.length, 'items');
          if (folderContents.length > 0) {
            console.log('   📋 First few items:');
            folderContents.slice(0, 3).forEach(item => {
              console.log(`      - ${item.name}`);
            });
          }
        }
      } catch (err) {
        console.log(`❌ Exception accessing folder "${folderName}":`, err.message);
      }
    }
    
    // Test 4: Try public URL approach
    console.log('\n🌐 Testing public URL generation...');
    const { data: publicUrlData } = supabase.storage
      .from('models_fbx')
      .getPublicUrl('Side Tables/thumbnails');
    
    console.log('🔗 Public URL test:', publicUrlData.publicUrl);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBucketStructure().then(() => {
  console.log('\n✅ Bucket structure test completed');
}).catch(err => {
  console.error('❌ Test script failed:', err);
});

