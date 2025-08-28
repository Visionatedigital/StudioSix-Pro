# 🐛 Pricing Page Debug Guide

## ✅ Runtime Errors Fixed

The "Failed to fetch" errors have been resolved with:

- ✅ **Timeout protection** - API calls timeout after 3-5 seconds
- ✅ **Fallback data** - Uses hardcoded exchange rates if APIs fail
- ✅ **Graceful degradation** - Defaults to ZAR/South Africa if location detection fails
- ✅ **Better error handling** - Catches and logs all network issues

## 🔍 Debug Information

When you visit the pricing page, check your browser console (F12 → Console) to see:

```
🌍 Initializing pricing with location detection...
📍 Detected location: South Africa (ZA)
💱 Using currency: ZAR
💰 Using ZAR (base currency)
✅ Pricing initialization complete
```

## 🌐 How Currency Detection Works

1. **Try IP geolocation** → Get country from your IP address
2. **If that fails** → Try backup API
3. **If that fails** → Default to South Africa (ZA) and ZAR currency
4. **Get exchange rates** → Only if currency != ZAR
5. **If exchange rates fail** → Use hardcoded fallback rates

## 🧪 Test Different Scenarios

### Test 1: Normal Operation
- Visit: `http://localhost:3000/pricing`
- Should show prices in your local currency (or ZAR if detection fails)

### Test 2: Force ZAR Mode
- Open browser console (F12)
- Paste: `localStorage.setItem('force_currency', 'ZAR')`
- Refresh page
- Should show prices in ZAR

### Test 3: Force USD Mode  
- Open browser console (F12)
- Paste: `localStorage.setItem('force_currency', 'USD')`
- Refresh page
- Should show prices converted to USD

## 📊 Expected Pricing Display

### For ZAR (South African users):
- **Pro Monthly**: R352/month
- **Pro Yearly**: R3,515/year
- **Studio Monthly**: R1,092/month  
- **Studio Yearly**: R10,915/year

### For USD (US users):
- **Pro Monthly**: ~$19/month (R352 × 0.054)
- **Pro Yearly**: ~$190/year (R3,515 × 0.054)
- **Studio Monthly**: ~$59/month (R1,092 × 0.054)
- **Studio Yearly**: ~$590/year (R10,915 × 0.054)

### For EUR (European users):
- **Pro Monthly**: ~€17/month (R352 × 0.049)
- **Pro Yearly**: ~€172/year (R3,515 × 0.049)

## 💳 Payment Flow Test

1. **Select a plan** → Click "Upgrade to Pro" or "Upgrade to Studio"
2. **Paystack popup** → Should open with ZAR amount (always R352, R1092, etc.)
3. **Test card**: Use `4084 0840 8408 4081` for successful test
4. **Success page** → Should redirect to `/payment/success`

## 🚨 Common Issues & Solutions

### Issue: "Failed to fetch" errors
**Solution**: ✅ Fixed with timeout and fallbacks

### Issue: Prices show as "R0" or "NaN"
**Solution**: Check console for initialization errors

### Issue: Wrong currency detected
**Solution**: Geolocation APIs might be blocked, will default to ZAR

### Issue: Exchange rates not working
**Solution**: Uses fallback rates, may be slightly outdated but functional

## 🛠️ Manual Currency Override

If you want to test specific currencies without changing location:

```javascript
// In browser console (F12)
localStorage.setItem('force_currency', 'USD');  // or EUR, GBP, etc.
location.reload();
```

## ✅ Current Status

- ✅ Runtime errors resolved
- ✅ Fallback systems working
- ✅ ZAR Paystack integration active
- ✅ Multi-currency display functional
- ✅ Payment flow operational

Your pricing page should now work smoothly without runtime errors!