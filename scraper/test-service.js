const SupabaseModelsService = require('./supabase-models-service');

async function testService() {
  const service = new SupabaseModelsService();
  
  console.log('🧪 Testing Supabase Models Service...');
  
  try {
    console.log('\n1. Testing getAvailableModels...');
    const models = await service.getAvailableModels();
    console.log('Models result:', JSON.stringify(models, null, 2));
    
    console.log('\n2. Testing getCategories...');
    const categories = await service.getCategories();
    console.log('Categories result:', JSON.stringify(categories, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testService();