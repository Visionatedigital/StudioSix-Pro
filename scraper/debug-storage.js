require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function debugStorage() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  console.log('🔍 Debugging Supabase Storage...');

  try {
    // List buckets
    console.log('\n1. Listing all buckets...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('Buckets error:', bucketsError);
    } else {
      console.log('Buckets:', buckets.map(b => b.name));
    }

    // List root of models bucket
    console.log('\n2. Listing root of models bucket...');
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from('models')
      .list('', { limit: 100 });
    
    if (rootError) {
      console.error('Root error:', rootError);
    } else {
      console.log('Root files/folders:', rootFiles.map(f => ({ name: f.name, type: f.metadata ? 'file' : 'folder' })));
    }

    // List thumbnails directory
    console.log('\n3. Listing thumbnails directory...');
    const { data: thumbFiles, error: thumbError } = await supabase.storage
      .from('models')
      .list('thumbnails', { limit: 100 });
    
    if (thumbError) {
      console.error('Thumbnails error:', thumbError);
    } else {
      console.log('Thumbnails folders:', thumbFiles.map(f => f.name));
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugStorage();