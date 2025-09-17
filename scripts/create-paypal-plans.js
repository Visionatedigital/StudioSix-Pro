#!/usr/bin/env node
/*
 * Create PayPal Subscription Product and Plans (Pro, Studio)
 *
 * Usage (env):
 *   PAYPAL_MODE=sandbox \
 *   PAYPAL_CLIENT_ID=YOUR_ID \
 *   PAYPAL_CLIENT_SECRET=YOUR_SECRET \
 *   node scripts/create-paypal-plans.js --pro 19 --studio 49
 *
 * Or pass credentials as flags:
 *   node scripts/create-paypal-plans.js \
 *     --mode sandbox \
 *     --client-id YOUR_ID \
 *     --secret YOUR_SECRET \
 *     --pro 19 --studio 49
 *
 * Output: plan IDs printed to stdout and saved to paypal-plans.json
 */

(async () => {
  try {
    const args = Object.create(null);
    process.argv.slice(2).forEach((a, i, arr) => {
      if (a.startsWith('--')) {
        const key = a.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        const val = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true;
        args[key] = val;
      }
    });

    const MODE = (args.mode || process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
    const API_BASE = MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    const CLIENT_ID = args.clientId || process.env.PAYPAL_CLIENT_ID;
    const CLIENT_SECRET = args.secret || process.env.PAYPAL_CLIENT_SECRET;
    const PRICE_PRO = Number(args.pro || 19);
    const PRICE_STUDIO = Number(args.studio || 49);
    const PRODUCT_NAME = args.productName || 'StudioSix Subscription';

    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET');
      process.exit(1);
    }

    const b64 = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    async function oauthToken() {
      const r = await fetch(`${API_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${b64}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(`PayPal OAuth failed: ${r.status} ${JSON.stringify(j)}`);
      }
      return j.access_token;
    }

    function planBody(productId, name, amount) {
      return {
        product_id: productId,
        name,
        status: 'ACTIVE',
        billing_cycles: [
          {
            frequency: { interval_unit: 'MONTH', interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: { fixed_price: { value: amount.toFixed(2), currency_code: 'USD' } }
          }
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3
        },
        taxes: { percentage: '0', inclusive: false }
      };
    }

    const access = await oauthToken();

    // Create product
    const productRes = await fetch(`${API_BASE}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access}`
      },
      body: JSON.stringify({
        name: PRODUCT_NAME,
        description: 'StudioSix subscription product',
        type: 'SERVICE',
        category: 'SOFTWARE'
      })
    });
    const productJson = await productRes.json();
    if (!productRes.ok) {
      throw new Error(`Create product failed: ${productRes.status} ${JSON.stringify(productJson)}`);
    }
    const productId = productJson.id;

    // Create Pro plan
    const proRes = await fetch(`${API_BASE}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access}`
      },
      body: JSON.stringify(planBody(productId, 'StudioSix Pro Monthly', PRICE_PRO))
    });
    const proJson = await proRes.json();
    if (!proRes.ok) {
      throw new Error(`Create Pro plan failed: ${proRes.status} ${JSON.stringify(proJson)}`);
    }
    const proPlanId = proJson.id;

    // Create Studio plan
    const studioRes = await fetch(`${API_BASE}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access}`
      },
      body: JSON.stringify(planBody(productId, 'StudioSix Studio Monthly', PRICE_STUDIO))
    });
    const studioJson = await studioRes.json();
    if (!studioRes.ok) {
      throw new Error(`Create Studio plan failed: ${studioRes.status} ${JSON.stringify(studioJson)}`);
    }
    const studioPlanId = studioJson.id;

    // Save to file
    const fs = await import('fs');
    const out = {
      mode: MODE,
      product_id: productId,
      plans: {
        pro: proPlanId,
        studio: studioPlanId
      },
      created_at: new Date().toISOString()
    };
    fs.writeFileSync('paypal-plans.json', JSON.stringify(out, null, 2));

    console.log('\n✅ PayPal subscription assets created');
    console.log(`Mode: ${MODE}`);
    console.log(`Product ID: ${productId}`);
    console.log(`Pro Plan ID: ${proPlanId}`);
    console.log(`Studio Plan ID: ${studioPlanId}`);
    console.log('\nSaved to paypal-plans.json');
    console.log('\nNext steps:');
    console.log('1) Set front-end env vars or pass via URL once:');
    console.log(`   REACT_APP_PAYPAL_CLIENT_ID=${CLIENT_ID}`);
    console.log(`   REACT_APP_PAYPAL_PLAN_PRO=${proPlanId}`);
    console.log(`   REACT_APP_PAYPAL_PLAN_STUDIO=${studioPlanId}`);
    console.log('   or open:');
    console.log(`   /app/pricing?discount=70&tiers=pro,studio&paypal_client_id=${CLIENT_ID}&paypal_plan_pro=${proPlanId}&paypal_plan_studio=${studioPlanId}`);
  } catch (e) {
    console.error('❌ Failed to create PayPal plans:', e.message);
    process.exit(1);
  }
})();



