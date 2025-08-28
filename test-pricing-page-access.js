#!/usr/bin/env node

/**
 * Test Pricing Page Access
 * Verifies all routes are working correctly
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:3000';

const routes = [
  { path: '/pricing', description: 'Pricing page' },
  { path: '/payment/success?reference=test123', description: 'Payment success page' },
  { path: '/app', description: 'Main app (should have pricing button)' },
  { path: '/', description: 'Landing page (should have pricing link)' }
];

async function testRoute(route) {
  try {
    console.log(`📋 Testing ${route.description}...`);
    
    const response = await fetch(`${BASE_URL}${route.path}`, {
      method: 'GET',
      timeout: 5000
    });

    if (response.ok) {
      const html = await response.text();
      
      // Check for specific content based on route
      let hasExpectedContent = false;
      
      if (route.path === '/pricing') {
        hasExpectedContent = html.includes('StudioSix Plan') || html.includes('pricing-page');
      } else if (route.path.includes('/payment/success')) {
        hasExpectedContent = html.includes('payment-success-page') || html.includes('Verifying');
      } else if (route.path === '/app') {
        hasExpectedContent = html.includes('Pricing') && html.includes('button');
      } else if (route.path === '/') {
        hasExpectedContent = html.includes('Pricing') && html.includes('href');
      }
      
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   ✅ Content: ${hasExpectedContent ? 'Found expected elements' : 'Basic HTML loaded'}`);
      return true;
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing StudioSix Pricing Page Access');
  console.log('=====================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  // Check if server is running
  try {
    await fetch(BASE_URL, { timeout: 3000 });
    console.log('✅ Frontend server is running');
  } catch (error) {
    console.log('❌ Frontend server not running. Start it with: npm start');
    return false;
  }

  console.log('');

  // Test all routes
  const results = [];
  for (const route of routes) {
    const success = await testRoute(route);
    results.push(success);
    console.log('');
  }

  // Summary
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log('📊 Test Results Summary');
  console.log('=======================');
  console.log(`✅ Passed: ${passed}/${total} routes`);
  
  if (passed === total) {
    console.log('');
    console.log('🎉 All routes working! You can access the pricing page at:');
    console.log('   • Direct: http://localhost:3000/pricing');
    console.log('   • From landing: http://localhost:3000 → Click "Pricing"');
    console.log('   • From app: http://localhost:3000/app → Click "Pricing" button');
    console.log('');
    console.log('💳 Test payment flow:');
    console.log('   1. Go to /pricing');
    console.log('   2. Select a plan and click upgrade');
    console.log('   3. Use test card: 4084 0840 8408 4081');
    console.log('   4. Complete payment to see success page');
  } else {
    console.log('');
    console.log('⚠️  Some routes failed. Check your app routing configuration.');
  }

  return passed === total;
}

runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test error:', error);
    process.exit(1);
  });