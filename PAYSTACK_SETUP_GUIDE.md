# Paystack Integration Setup Guide

This guide will help you set up Paystack payment integration for StudioSix Pro's pricing and subscription system.

## 🏗️ What Was Built

### Components Created/Updated
- ✅ **PaystackService** (`src/services/PaystackService.js`) - Client-side payment handling
- ✅ **PricingPage** (`src/components/PricingPage.js`) - Enhanced with error handling and validation
- ✅ **PaymentSuccess** (`src/components/PaymentSuccess.js`) - Payment callback and verification page
- ✅ **Server API** (`simple-server.js`) - Paystack backend integration endpoints

### Features Implemented
- 🌍 **Multi-currency support** with automatic location detection
- 💳 **Secure payment processing** through Paystack API
- 🔄 **Subscription management** with plan creation and billing cycles
- ✅ **Payment verification** and success/failure handling
- 📧 **Email notifications** and receipt handling
- 🛡️ **Error handling** with user-friendly messages
- 📱 **Responsive design** for all screen sizes

## 🔧 Setup Instructions

### 1. Get Paystack API Keys

1. **Sign up** at [https://paystack.com](https://paystack.com)
2. **Verify your business** (required for live payments)
3. **Get your API keys** from the Paystack Dashboard:
   - Go to Settings → API Keys & Webhooks
   - Copy your **Public Key** (starts with `pk_test_` or `pk_live_`)
   - Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

### 2. Environment Variables

Add these variables to your `.env` file:

```bash
# Paystack Configuration
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here

# For React App (must start with REACT_APP_)
REACT_APP_PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here

# Optional: Frontend URL for payment callbacks
FRONTEND_URL=http://localhost:3000
```

### 3. Install Dependencies

The integration uses existing dependencies, but ensure these are installed:

```bash
npm install express cors dotenv node-fetch
```

### 4. Create Subscription Plans in Paystack

You can either:

**Option A: Use the API endpoint** (recommended)
```bash
# Create Pro Monthly Plan
curl -X POST http://localhost:8080/api/payments/plans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "StudioSix Pro Monthly",
    "amount": 19,
    "interval": "monthly",
    "description": "StudioSix Pro subscription - monthly billing",
    "plan_code": "studiosix_pro_monthly"
  }'

# Create Pro Yearly Plan
curl -X POST http://localhost:8080/api/payments/plans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "StudioSix Pro Yearly",
    "amount": 190,
    "interval": "annually",
    "description": "StudioSix Pro subscription - yearly billing",
    "plan_code": "studiosix_pro_yearly"
  }'
```

**Option B: Create manually** in Paystack Dashboard
- Go to Customers → Plans
- Create plans matching your pricing tiers

### 5. Set Up Webhooks (Optional but Recommended)

1. **In Paystack Dashboard**, go to Settings → API Keys & Webhooks
2. **Add webhook URL**: `https://yourdomain.com/api/payments/webhook`
3. **Select events**:
   - `charge.success` - Payment completed
   - `subscription.create` - New subscription
   - `subscription.not_renew` - Subscription cancelled

### 6. Update App Routing

Add payment success route to your main App.js:

```jsx
import PaymentSuccess from './components/PaymentSuccess';

// Add this route
<Route path="/payment/success" element={<PaymentSuccess />} />
```

## 🧪 Testing

### Test Mode Setup
1. Use **test API keys** (starting with `pk_test_` and `sk_test_`)
2. **Test card numbers**:
   - Success: `4084084084084081`
   - Insufficient funds: `4000000000000002`
   - Declined: `4000000000000069`

### Test the Integration

1. **Start your servers**:
   ```bash
   # Terminal 1: Backend
   node simple-server.js
   
   # Terminal 2: Frontend  
   npm start
   ```

2. **Test payment flow**:
   - Navigate to pricing page
   - Select a plan
   - Complete test payment
   - Verify success page shows

3. **Check server logs** for payment events:
   ```bash
   # You should see logs like:
   💳 Payment initialization request: {...}
   ✅ Payment initialized successfully: studiosix_...
   🔔 Paystack webhook received: charge.success
   ```

### Verification Checklist

- [ ] Environment variables are set correctly
- [ ] Pricing page loads and shows plans
- [ ] Currency detection works for your location
- [ ] Payment initialization succeeds (check browser console)
- [ ] Paystack payment page opens correctly
- [ ] Payment success page displays after completion
- [ ] Server logs show successful payment processing
- [ ] Webhook events are received (if configured)

## 🚀 Going Live

### Pre-Launch Checklist

1. **Switch to Live Keys**:
   ```bash
   PAYSTACK_PUBLIC_KEY=pk_live_your_live_key
   PAYSTACK_SECRET_KEY=sk_live_your_live_key
   REACT_APP_PAYSTACK_PUBLIC_KEY=pk_live_your_live_key
   ```

2. **Verify Business** on Paystack (required for live transactions)

3. **Update webhook URLs** to your production domain

4. **Test with small amounts** before full launch

5. **Set up monitoring** for payment failures and errors

### Security Considerations

- ✅ **Never expose secret keys** in frontend code
- ✅ **Use HTTPS** for all payment-related pages
- ✅ **Validate webhooks** using signature verification
- ✅ **Implement rate limiting** on payment endpoints
- ✅ **Log payment attempts** for debugging and monitoring

## 📋 API Endpoints Reference

### Payment Initialization
```http
POST /api/payments/initialize
Content-Type: application/json

{
  "email": "user@example.com",
  "amount": 1900, // Amount in kobo/cents
  "currency": "USD",
  "plan": "pro",
  "billing_cycle": "monthly"
}
```

### Payment Verification  
```http
GET /api/payments/verify/{reference}
```

### Plan Management
```http
GET /api/payments/plans        // List all plans
POST /api/payments/plans       // Create new plan
```

### Webhook Endpoint
```http
POST /api/payments/webhook     // Paystack webhook notifications
```

## 🛠️ Troubleshooting

### Common Issues

1. **"Paystack public key not found"**
   - Ensure `REACT_APP_PAYSTACK_PUBLIC_KEY` is set in `.env`
   - Restart your development server after adding env vars

2. **Payment initialization fails**
   - Check server logs for detailed error messages
   - Verify secret key is correct and has proper permissions
   - Ensure user is signed in before attempting payment

3. **Currency conversion not working**
   - Check internet connection (uses external exchange rate API)
   - Fallback to USD if geolocation fails

4. **Payment success page not loading**
   - Verify routing is set up correctly
   - Check that callback URL matches your frontend URL

5. **Webhooks not received**
   - Use ngrok for local testing: `ngrok http 8080`
   - Update webhook URL in Paystack dashboard
   - Check webhook signature validation

### Debug Mode

Enable debug logging by adding to your `.env`:
```bash
DEBUG=paystack:*
NODE_ENV=development
```

## 📞 Support

For Paystack-specific issues:
- [Paystack Documentation](https://paystack.com/docs)
- [Paystack Support](https://paystack.com/contact)

For StudioSix integration issues:
- Check server logs for detailed error messages
- Review browser console for client-side errors
- Contact support@studiosix.ai with payment reference numbers

## 🎉 Success!

Your Paystack integration is now ready! Users can:
- ✅ View pricing in their local currency
- ✅ Subscribe to plans with secure payments
- ✅ Manage their subscriptions
- ✅ Receive email confirmations
- ✅ Get proper error handling and support

The pricing page is now production-ready with full Paystack integration!