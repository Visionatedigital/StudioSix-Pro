#!/usr/bin/env node

/**
 * Get Paystack Account Information
 * This will help us find your public key
 */

require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

async function getAccountInfo() {
  console.log('🔍 Fetching Paystack Account Information...');
  console.log('===============================================');
  
  if (!PAYSTACK_SECRET_KEY) {
    console.log('❌ PAYSTACK_SECRET_KEY not found in environment variables');
    return;
  }

  try {
    // Get account information
    const response = await fetch('https://api.paystack.co/integration', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.status && result.data) {
      const data = result.data;
      
      console.log('✅ Account Information Retrieved:');
      console.log(`   Business Name: ${data.business_name || 'Not set'}`);
      console.log(`   Domain: ${data.domain || 'Not set'}`);
      console.log(`   Live Mode: ${data.live_mode ? '🔴 LIVE' : '🟡 TEST'}`);
      console.log(`   Account ID: ${data.integration_id}`);
      
      // The public key follows a pattern based on the integration
      const keyPrefix = data.live_mode ? 'pk_live_' : 'pk_test_';
      console.log('\n📋 Configuration needed:');
      console.log(`   Your public key should start with: ${keyPrefix}`);
      console.log('   You can find it in your Paystack Dashboard → Settings → API Keys');
      
      if (data.live_mode) {
        console.log('\n🔴 PRODUCTION WARNING:');
        console.log('   You are using LIVE keys. Real payments will be processed.');
        console.log('   Make sure your business is verified before going live.');
      }
      
    } else {
      console.log('❌ Unexpected response format:', result);
    }

  } catch (error) {
    console.error('❌ Error fetching account info:', error.message);
    
    if (error.message.includes('401')) {
      console.log('   → Invalid or expired secret key');
    } else if (error.message.includes('403')) {
      console.log('   → Insufficient permissions');
    } else if (error.message.includes('network')) {
      console.log('   → Network connection issue');
    }
  }
}

// Also check existing plans
async function getExistingPlans() {
  console.log('\n📋 Checking Existing Subscription Plans...');
  console.log('==========================================');
  
  try {
    const response = await fetch('https://api.paystack.co/plan', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.status && result.data) {
      const plans = result.data;
      
      if (plans.length === 0) {
        console.log('   No plans found. You\'ll need to create subscription plans.');
        console.log('   Use the API endpoints or create them manually in Paystack Dashboard.');
      } else {
        console.log(`   Found ${plans.length} existing plan(s):`);
        plans.forEach((plan, index) => {
          const amount = (plan.amount / 100).toFixed(2);
          console.log(`   ${index + 1}. ${plan.name} - ${plan.currency} ${amount}/${plan.interval}`);
          console.log(`      Code: ${plan.plan_code}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error fetching plans:', error.message);
  }
}

async function main() {
  await getAccountInfo();
  await getExistingPlans();
  
  console.log('\n🚀 Next Steps:');
  console.log('1. Get your public key from Paystack Dashboard → Settings → API Keys');
  console.log('2. Update REACT_APP_PAYSTACK_PUBLIC_KEY in your .env file');
  console.log('3. Create subscription plans if none exist');
  console.log('4. Test the pricing page integration');
  console.log('5. Set up webhooks for production notifications');
}

main().catch(console.error);