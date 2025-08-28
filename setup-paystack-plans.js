#!/usr/bin/env node

/**
 * Setup StudioSix Paystack Subscription Plans
 * Creates the subscription plans needed for the pricing page
 */

require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Current USD to ZAR conversion rate (approximately 18.5 as of 2024)
const USD_TO_ZAR_RATE = 18.5;

const STUDIOSIX_PLANS = [
  {
    name: 'StudioSix Pro Monthly',
    amount: Math.round(19 * USD_TO_ZAR_RATE), // $19 USD ≈ R352 ZAR
    interval: 'monthly',
    currency: 'ZAR',
    description: 'StudioSix Pro subscription - monthly billing with 50,000 AI tokens, 200 image renders, and BIM exports',
    plan_code: 'studiosix_pro_monthly',
    usd_equivalent: 19
  },
  {
    name: 'StudioSix Pro Yearly',
    amount: Math.round(190 * USD_TO_ZAR_RATE), // $190 USD ≈ R3515 ZAR (save 17%)
    interval: 'annually',
    currency: 'ZAR', 
    description: 'StudioSix Pro subscription - yearly billing with 50,000 AI tokens monthly, 200 image renders, and BIM exports',
    plan_code: 'studiosix_pro_yearly',
    usd_equivalent: 190
  },
  {
    name: 'StudioSix Studio Monthly',
    amount: Math.round(59 * USD_TO_ZAR_RATE), // $59 USD ≈ R1092 ZAR
    interval: 'monthly',
    currency: 'ZAR',
    description: 'StudioSix Studio subscription - monthly billing with 200,000 AI tokens, 1,000 image renders, team collaboration',
    plan_code: 'studiosix_studio_monthly',
    usd_equivalent: 59
  },
  {
    name: 'StudioSix Studio Yearly',
    amount: Math.round(590 * USD_TO_ZAR_RATE), // $590 USD ≈ R10915 ZAR (save 17%)
    interval: 'annually',
    currency: 'ZAR',
    description: 'StudioSix Studio subscription - yearly billing with 200,000 AI tokens monthly, 1,000 image renders, team features',
    plan_code: 'studiosix_studio_yearly',
    usd_equivalent: 590
  }
];

async function createPlan(planData) {
  try {
    console.log(`📋 Creating plan: ${planData.name}...`);
    
    const paystackPayload = {
      name: planData.name,
      amount: planData.amount * 100, // Convert to kobo/cents
      interval: planData.interval,
      currency: planData.currency,
      description: planData.description
    };

    const response = await fetch('https://api.paystack.co/plan', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload)
    });

    const result = await response.json();

    if (response.ok && result.status) {
      console.log(`✅ Created: ${result.data.plan_code}`);
      console.log(`   Amount: R${planData.amount}/${planData.interval} (≈$${planData.usd_equivalent} USD)`);
      console.log(`   Plan ID: ${result.data.id}`);
      return { success: true, data: result.data };
    } else {
      if (result.message && result.message.includes('already exists')) {
        console.log(`⚠️  Already exists: ${planData.name}`);
        return { success: true, existed: true };
      } else {
        console.log(`❌ Failed: ${result.message}`);
        return { success: false, error: result.message };
      }
    }

  } catch (error) {
    console.log(`❌ Error creating ${planData.plan_code}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function listExistingPlans() {
  try {
    console.log('🔍 Checking existing plans...\n');
    
    const response = await fetch('https://api.paystack.co/plan', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();

    if (response.ok && result.status) {
      const plans = result.data;
      
      if (plans.length === 0) {
        console.log('   No existing plans found.');
      } else {
        console.log(`   Found ${plans.length} existing plan(s):`);
        plans.forEach((plan, index) => {
          const amount = (plan.amount / 100).toFixed(2);
          console.log(`   ${index + 1}. ${plan.name} - ${plan.currency} ${amount}/${plan.interval}`);
        });
      }
      
      return plans;
    } else {
      console.log('❌ Failed to fetch existing plans');
      return [];
    }
  } catch (error) {
    console.log(`❌ Error fetching plans: ${error.message}`);
    return [];
  }
}

async function setupPlans() {
  console.log('🏗️  StudioSix Paystack Plans Setup');
  console.log('===================================');
  console.log(`Using secret key: ${PAYSTACK_SECRET_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log('');

  if (!PAYSTACK_SECRET_KEY) {
    console.log('❌ PAYSTACK_SECRET_KEY not found in environment variables');
    return false;
  }

  // List existing plans first
  await listExistingPlans();
  console.log('');

  // Create new plans
  console.log('📋 Creating StudioSix subscription plans...\n');
  
  const results = [];
  for (const plan of STUDIOSIX_PLANS) {
    const result = await createPlan(plan);
    results.push({ plan: plan.plan_code, result });
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 Setup Results:');
  console.log('==================');
  
  const successful = results.filter(r => r.result.success).length;
  const total = results.length;
  
  console.log(`✅ Success: ${successful}/${total} plans`);
  
  results.forEach(({ plan, result }) => {
    if (result.success) {
      if (result.existed) {
        console.log(`   ⚠️  ${plan} - Already existed`);
      } else {
        console.log(`   ✅ ${plan} - Created successfully`);
      }
    } else {
      console.log(`   ❌ ${plan} - Failed: ${result.error}`);
    }
  });

  if (successful === total) {
    console.log('\n🎉 All plans are ready!');
    console.log('\n📋 Plan Codes for Integration:');
    STUDIOSIX_PLANS.forEach(plan => {
      console.log(`   ${plan.plan_code} - ${plan.name}`);
    });
    
    console.log('\n🚀 Next Steps:');
    console.log('1. Test the pricing page in your browser');
    console.log('2. Try a test payment (use test mode first)');
    console.log('3. Set up webhooks for payment notifications');
    console.log('4. Configure your production domain in Paystack Dashboard');
    
    return true;
  } else {
    console.log('\n⚠️  Some plans failed to create. Check the errors above.');
    return false;
  }
}

setupPlans()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Setup error:', error);
    process.exit(1);
  });