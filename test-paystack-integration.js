#!/usr/bin/env node

/**
 * Paystack Integration Test
 * 
 * Tests the Paystack integration endpoints and functionality
 * Run: node test-paystack-integration.js
 */

require('dotenv').config();

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:8080';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

console.log('🧪 StudioSix Paystack Integration Test');
console.log('=====================================');
console.log(`Server URL: ${SERVER_URL}`);
console.log(`Paystack Secret Key: ${PAYSTACK_SECRET_KEY ? '✅ Configured' : '❌ Missing'}`);
console.log(`Paystack Public Key: ${PAYSTACK_PUBLIC_KEY ? '✅ Configured' : '❌ Missing'}`);
console.log('');

async function testServerHealth() {
  console.log('1. Testing server health...');
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Server is healthy');
      console.log(`   Status: ${data.status}`);
      console.log(`   Port: ${data.port}`);
      return true;
    } else {
      console.log('❌ Server health check failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot connect to server');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testPaymentInitialization() {
  console.log('2. Testing payment initialization...');
  
  if (!PAYSTACK_SECRET_KEY) {
    console.log('⏭️  Skipped (no secret key configured)');
    return false;
  }

  try {
    const testPayment = {
      email: 'test@studiosix.ai',
      amount: 1900, // $19 in cents
      currency: 'USD',
      plan: 'pro',
      billing_cycle: 'monthly',
      metadata: {
        test: true,
        user_id: 'test_user_123'
      }
    };

    const response = await fetch(`${SERVER_URL}/api/payments/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayment)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Payment initialization successful');
      console.log(`   Reference: ${result.data.reference}`);
      console.log(`   Authorization URL: ${result.data.authorization_url ? '✅ Generated' : '❌ Missing'}`);
      return result.data.reference;
    } else {
      console.log('❌ Payment initialization failed');
      console.log(`   Message: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Payment initialization error');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testPaymentVerification(reference) {
  if (!reference) {
    console.log('3. Skipping payment verification (no reference)');
    return false;
  }

  console.log('3. Testing payment verification...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/payments/verify/${reference}`);
    const result = await response.json();

    if (response.ok) {
      console.log('✅ Payment verification endpoint working');
      console.log(`   Status: ${result.data?.status || 'pending'}`);
      console.log(`   Amount: ${result.data?.amount ? (result.data.amount / 100) : 'unknown'}`);
      return true;
    } else {
      console.log('❌ Payment verification failed');
      console.log(`   Message: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Payment verification error');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testPlanManagement() {
  console.log('4. Testing plan management...');

  if (!PAYSTACK_SECRET_KEY) {
    console.log('⏭️  Skipped (no secret key configured)');
    return false;
  }

  try {
    // Test getting existing plans
    const getResponse = await fetch(`${SERVER_URL}/api/payments/plans`);
    const getResult = await getResponse.json();

    if (getResponse.ok) {
      console.log('✅ Plan fetching works');
      console.log(`   Found ${getResult.data?.length || 0} existing plans`);
    } else {
      console.log('❌ Plan fetching failed');
      console.log(`   Message: ${getResult.message}`);
    }

    // Test creating a test plan
    const testPlan = {
      name: 'Test Plan',
      amount: 5, // $5
      interval: 'monthly',
      description: 'Test plan for integration testing',
      plan_code: `test_plan_${Date.now()}`
    };

    const createResponse = await fetch(`${SERVER_URL}/api/payments/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPlan)
    });

    const createResult = await createResponse.json();

    if (createResponse.ok && createResult.status) {
      console.log('✅ Plan creation works');
      console.log(`   Created plan: ${createResult.data?.plan_code}`);
      return true;
    } else {
      console.log('⚠️  Plan creation failed (may already exist)');
      console.log(`   Message: ${createResult.message}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Plan management error');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testPaystackDirectConnection() {
  console.log('5. Testing direct Paystack connection...');

  if (!PAYSTACK_SECRET_KEY) {
    console.log('⏭️  Skipped (no secret key configured)');
    return false;
  }

  try {
    const response = await fetch('https://api.paystack.co/plan', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Direct Paystack connection works');
      console.log(`   Account has ${result.data?.length || 0} plans`);
      return true;
    } else {
      console.log('❌ Direct Paystack connection failed');
      console.log(`   Status: ${response.status}`);
      console.log(`   Message: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Direct Paystack connection error');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testClientSideConfiguration() {
  console.log('6. Testing client-side configuration...');
  
  console.log(`   REACT_APP_PAYSTACK_PUBLIC_KEY: ${process.env.REACT_APP_PAYSTACK_PUBLIC_KEY ? '✅ Set' : '❌ Missing'}`);
  
  if (process.env.REACT_APP_PAYSTACK_PUBLIC_KEY) {
    const key = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
    const isTestKey = key.startsWith('pk_test_');
    const isLiveKey = key.startsWith('pk_live_');
    
    if (isTestKey) {
      console.log('   ✅ Test public key detected');
    } else if (isLiveKey) {
      console.log('   🔴 Live public key detected');
    } else {
      console.log('   ⚠️  Public key format may be invalid');
    }
    
    return isTestKey || isLiveKey;
  }
  
  return false;
}

async function runTests() {
  const results = [];
  
  results.push(await testServerHealth());
  results.push(await testClientSideConfiguration());
  results.push(await testPaystackDirectConnection());
  
  const paymentRef = await testPaymentInitialization();
  results.push(!!paymentRef);
  
  results.push(await testPaymentVerification(paymentRef));
  results.push(await testPlanManagement());
  
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total} tests`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Paystack integration is ready.');
  } else if (passed >= 3) {
    console.log('⚠️  Most tests passed. Check configuration for remaining issues.');
  } else {
    console.log('❌ Multiple test failures. Check your Paystack configuration.');
  }
  
  console.log('\n🚀 Next Steps:');
  console.log('1. Set environment variables if any are missing');
  console.log('2. Test the pricing page in your browser');
  console.log('3. Try a test payment with card: 4084084084084081');
  console.log('4. Verify the payment success page works');
  console.log('5. Set up webhooks for production');
  
  return passed === total;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner error:', error);
    process.exit(1);
  });