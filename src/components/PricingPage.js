/**
 * StudioSix Pricing Page
 * 
 * Features:
 * - Real-time currency conversion based on user location
 * - Paystack integration for payments
 * - Responsive design with upgrade incentives
 * - Subscription tier management
 */

import React, { useState, useEffect } from 'react';
import './PricingPage.css';
import subscriptionService from '../services/SubscriptionService';
import paystackService from '../services/PaystackService';
import { useAuth } from '../hooks/useAuth';

const PricingPage = ({ onClose, currentTier = 'free' }) => {
  const { user } = useAuth();
  
  // Add debugging for user state
  useEffect(() => {
    console.log('👤 User state in PricingPage:', { 
      user: user ? { id: user.id, email: user.email } : null,
      hasUser: !!user,
      userEmail: user?.email 
    });
  }, [user]);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRates, setExchangeRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState('ZA');
  const [selectedBilling, setSelectedBilling] = useState('monthly');
  const [upgrading, setUpgrading] = useState(null);
  const [pendingUpgrade, setPendingUpgrade] = useState(null);

  // Base prices in USD (display currency)
  const basePrices = {
    pro: { monthly: 19, yearly: 190 }, // $19/month, $190/year
    studio: { monthly: 59, yearly: 590 }, // $59/month, $590/year
    enterprise: { monthly: 299, yearly: 2990 }, // $299/month, $2990/year
    education: { monthly: 0, yearly: 0 } // Custom pricing - contact sales
  };

  // ZAR conversion rates for Paystack payments (1 USD = ~18.5 ZAR)
  const usdToZarRate = 18.5;

  // Currency symbols mapping
  const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'NGN': '₦',
    'ZAR': 'R',
    'KES': 'KSh',
    'GHS': 'GH₵',
    'CAD': 'C$',
    'AUD': 'A$',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹'
  };

  // Location to currency mapping
  const locationCurrencyMap = {
    'US': 'USD', 'CA': 'CAD', 'GB': 'GBP', 'AU': 'AUD', 'JP': 'JPY',
    'NG': 'NGN', 'ZA': 'ZAR', 'KE': 'KES', 'GH': 'GHS', 'IN': 'INR',
    'CN': 'CNY', 'DE': 'EUR', 'FR': 'EUR', 'ES': 'EUR', 'IT': 'EUR'
  };

  useEffect(() => {
    initializePricing();
    
    // Check for pending upgrade after sign in - immediate check
    setTimeout(() => checkPendingUpgrade(), 100);
    
    // Also check multiple times in case of timing issues
    setTimeout(() => checkPendingUpgrade(), 1000);
    setTimeout(() => checkPendingUpgrade(), 2000);
  }, []);

  useEffect(() => {
    // Check for pending upgrade when user changes (after sign in)
    if (user?.email) {
      console.log('👤 User state updated, checking for pending upgrade:', user.email);
      checkPendingUpgrade();
    }
  }, [user]);

  // Additional effect to check pending upgrade when loading is complete
  useEffect(() => {
    if (!loading && user?.email) {
      console.log('✅ Loading complete, final check for pending upgrade');
      // Use a longer delay to ensure all state is ready
      setTimeout(() => checkPendingUpgrade(), 1000);
    }
  }, [loading, user]);

  // Also check when the component becomes visible again (in case of navigation)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.email) {
        console.log('👀 Page became visible, checking pending upgrade');
        setTimeout(() => checkPendingUpgrade(), 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  const checkPendingUpgrade = () => {
    try {
      const pendingUpgradeData = localStorage.getItem('pending_upgrade');
      console.log('🔍 Checking pending upgrade:', {
        pendingUpgradeData: !!pendingUpgradeData,
        userEmail: user?.email,
        currentPendingUpgrade: !!pendingUpgrade
      });
      
      if (pendingUpgradeData && !pendingUpgrade) {
        const upgradeData = JSON.parse(pendingUpgradeData);
        const timeDiff = new Date() - new Date(upgradeData.timestamp);
        
        console.log('⏰ Time diff:', timeDiff, 'ms (max: 600000ms)');
        
        // Only process if less than 10 minutes old
        if (timeDiff < 10 * 60 * 1000) {
          console.log('🔄 Processing pending upgrade:', upgradeData);
          
          // Set the billing mode that was selected
          setSelectedBilling(upgradeData.billing);
          
          // Set pending upgrade state to show confirmation
          setPendingUpgrade(upgradeData);
          
          // Clear from localStorage
          localStorage.removeItem('pending_upgrade');
        } else {
          console.log('⏰ Pending upgrade expired, clearing');
          // Clear expired pending upgrade
          localStorage.removeItem('pending_upgrade');
        }
      } else {
        console.log('❌ Conditions not met for pending upgrade processing');
      }
    } catch (error) {
      console.warn('Error processing pending upgrade:', error);
      localStorage.removeItem('pending_upgrade');
    }
  };

  const initializePricing = async () => {
    console.log('🌍 Initializing pricing (offline mode)...');
    
    try {
      // Check if user has manually set a currency preference
      const forcedCurrency = localStorage.getItem('force_currency');
      
      if (forcedCurrency) {
        console.log(`🔧 Using forced currency: ${forcedCurrency}`);
        setCurrency(forcedCurrency);
        setUserLocation(getCountryFromCurrency(forcedCurrency));
        
        if (forcedCurrency !== 'ZAR') {
          setExchangeRates(getOfflineExchangeRates(forcedCurrency));
        }
      } else {
        // Try to detect timezone-based location (no external API calls)
        const detectedLocation = getLocationFromTimezone();
        const detectedCurrency = locationCurrencyMap[detectedLocation.country] || 'USD';
        
        console.log(`📍 Detected location: ${detectedLocation.countryName} (${detectedLocation.country})`);
        console.log(`💱 Using currency: ${detectedCurrency}`);
        
        setUserLocation(detectedLocation.country);
        setCurrency(detectedCurrency);

        // Set exchange rates for non-USD currencies
        if (detectedCurrency !== 'USD') {
          const rates = getOfflineExchangeRates(detectedCurrency);
          setExchangeRates(rates);
          console.log(`✅ Exchange rate: 1 USD = ${rates[detectedCurrency]} ${detectedCurrency}`);
        } else {
          console.log('💰 Using USD (base currency)');
        }
      }
    } catch (error) {
      console.warn('⚠️ Pricing initialization failed, using USD defaults:', error.message);
      setCurrency('USD');
      setUserLocation('US');
    } finally {
      console.log('✅ Pricing initialization complete');
      setLoading(false);
    }
  };

  const getLocationFromTimezone = () => {
    try {
      // Get timezone from browser
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log(`🕐 Detected timezone: ${timezone}`);
      
      // Map common timezones to countries
      const timezoneToCountry = {
        'Africa/Johannesburg': { country: 'ZA', countryName: 'South Africa' },
        'America/New_York': { country: 'US', countryName: 'United States' },
        'America/Los_Angeles': { country: 'US', countryName: 'United States' },
        'America/Chicago': { country: 'US', countryName: 'United States' },
        'America/Denver': { country: 'US', countryName: 'United States' },
        'Europe/London': { country: 'GB', countryName: 'United Kingdom' },
        'Europe/Paris': { country: 'FR', countryName: 'France' },
        'Europe/Berlin': { country: 'DE', countryName: 'Germany' },
        'Asia/Tokyo': { country: 'JP', countryName: 'Japan' },
        'Asia/Shanghai': { country: 'CN', countryName: 'China' },
        'Asia/Dubai': { country: 'AE', countryName: 'United Arab Emirates' },
        'Australia/Sydney': { country: 'AU', countryName: 'Australia' },
        'America/Toronto': { country: 'CA', countryName: 'Canada' },
        'Asia/Kolkata': { country: 'IN', countryName: 'India' },
        'Africa/Lagos': { country: 'NG', countryName: 'Nigeria' },
        'Africa/Nairobi': { country: 'KE', countryName: 'Kenya' },
        'Africa/Accra': { country: 'GH', countryName: 'Ghana' }
      };
      
      const location = timezoneToCountry[timezone];
      if (location) {
        return location;
      }
      
      // Fallback based on timezone regions
      if (timezone.startsWith('Africa/')) {
        if (timezone.includes('Johannesburg') || timezone.includes('Cape_Town')) {
          return { country: 'ZA', countryName: 'South Africa' };
        }
        return { country: 'ZA', countryName: 'South Africa' }; // Default to ZA for Africa
      } else if (timezone.startsWith('America/')) {
        return { country: 'US', countryName: 'United States' };
      } else if (timezone.startsWith('Europe/')) {
        return { country: 'GB', countryName: 'United Kingdom' };
      } else if (timezone.startsWith('Asia/')) {
        return { country: 'CN', countryName: 'China' };
      } else if (timezone.startsWith('Australia/')) {
        return { country: 'AU', countryName: 'Australia' };
      }
      
      // Ultimate fallback
      return { country: 'US', countryName: 'United States' };
    } catch (error) {
      console.warn('Timezone detection failed:', error);
      return { country: 'US', countryName: 'United States' };
    }
  };

  const getCountryFromCurrency = (currency) => {
    const currencyToCountry = {
      'USD': 'US', 'EUR': 'DE', 'GBP': 'GB', 'ZAR': 'ZA',
      'CAD': 'CA', 'AUD': 'AU', 'JPY': 'JP', 'CNY': 'CN',
      'INR': 'IN', 'NGN': 'NG', 'KES': 'KE', 'GHS': 'GH'
    };
    return currencyToCountry[currency] || 'US';
  };

  const getOfflineExchangeRates = (targetCurrency) => {
    // Hardcoded exchange rates from USD (approximate values as of 2024)
    const offlineRates = {
      'EUR': 0.91,   // 1 USD ≈ 0.91 EUR
      'GBP': 0.79,   // 1 USD ≈ 0.79 GBP
      'CAD': 1.35,   // 1 USD ≈ 1.35 CAD
      'AUD': 1.50,   // 1 USD ≈ 1.50 AUD
      'JPY': 145,    // 1 USD ≈ 145 JPY
      'CNY': 7.20,   // 1 USD ≈ 7.20 CNY
      'INR': 83,     // 1 USD ≈ 83 INR
      'ZAR': 18.5,   // 1 USD ≈ 18.5 ZAR
      'NGN': 1580,   // 1 USD ≈ 1580 NGN
      'KES': 129,    // 1 USD ≈ 129 KES
      'GHS': 15.7    // 1 USD ≈ 15.7 GHS
    };
    
    return {
      [targetCurrency]: offlineRates[targetCurrency] || 1
    };
  };

  // Removed external API calls to prevent fetch errors

  const convertPrice = (priceUSD) => {
    if (!priceUSD || priceUSD === 0) return 0;
    if (currency === 'USD') return priceUSD;
    
    // Get rate from exchangeRates or fallback to offline rates
    let rate = exchangeRates[currency];
    if (!rate || rate === 1) {
      rate = getOfflineExchangeRates(currency)[currency];
    }
    
    const convertedPrice = Math.round(priceUSD * rate);
    return convertedPrice > 0 ? convertedPrice : priceUSD;
  };

  const formatPrice = (priceUSD) => {
    if (!priceUSD && priceUSD !== 0) return 'N/A';
    
    const convertedPrice = convertPrice(priceUSD);
    const symbol = currencySymbols[currency] || '$';
    
    // Ensure we have a valid price
    if (!convertedPrice && convertedPrice !== 0) return `${symbol}0`;
    
    // Format based on currency
    if (currency === 'JPY' || currency === 'KRW') {
      return `${symbol}${convertedPrice.toLocaleString()}`;
    } else if (convertedPrice >= 1000) {
      return `${symbol}${convertedPrice.toLocaleString()}`;
    } else {
      return `${symbol}${convertedPrice}`;
    }
  };

  const getPricingTiers = () => {
    const tiers = [
      {
        id: 'free',
        name: 'Free Tier',
        subtitle: 'Perfect for trying out StudioSix',
        monthlyPrice: 0,
        yearlyPrice: 0,
        popular: false,
        current: currentTier === 'free',
        features: [
          '5,000 AI tokens per month',
          '20 image renders per month',
          'GPT-3.5 Turbo access',
          'Basic geometry tools',
          'Community support',
          'Up to 512px image resolution'
        ],
        limitations: [
          'No BIM exports',
          'No advanced AI models',
          'Limited tool access'
        ],
        buttonText: currentTier === 'free' ? 'Current Plan' : 'Downgrade',
        disabled: currentTier === 'free'
      },
      {
        id: 'pro',
        name: 'Pro Tier',
        subtitle: 'Best for designers and professionals',
        monthlyPrice: basePrices.pro.monthly,
        yearlyPrice: basePrices.pro.yearly,
        popular: true,
        current: currentTier === 'pro',
        features: [
          '50,000 AI tokens per month',
          '200 image renders per month',
          'GPT-3.5 + GPT-4 access',
          'BIM exports (IFC/DWG)',
          'Priority support (72h SLA)',
          '1GB cloud storage',
          'Up to 768px image resolution'
        ],
        savings: '10x more tokens than Free',
        buttonText: currentTier === 'pro' ? 'Current Plan' : 'Upgrade to Pro',
        disabled: currentTier === 'pro'
      },
      {
        id: 'studio',
        name: 'Studio Tier',
        subtitle: 'For teams and advanced workflows',
        monthlyPrice: basePrices.studio.monthly,
        yearlyPrice: basePrices.studio.yearly,
        popular: false,
        current: currentTier === 'studio',
        features: [
          '200,000 AI tokens per month',
          '1,000 image renders per month',
          'All AI models (GPT-4, Claude 3.5)',
          'High-quality BIM + 4K renders',
          'Team collaboration (5 seats)',
          'Email support (48h SLA)',
          '5GB cloud storage',
          'Up to 1024px image resolution'
        ],
        savings: '4x more tokens than Pro',
        buttonText: currentTier === 'studio' ? 'Current Plan' : 'Upgrade to Studio',
        disabled: currentTier === 'studio'
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        subtitle: 'Custom solutions for large teams',
        monthlyPrice: basePrices.enterprise.monthly,
        yearlyPrice: basePrices.enterprise.yearly,
        popular: false,
        current: currentTier === 'enterprise',
        features: [
          'Custom token packages (1M+ tokens)',
          'Unlimited image renders',
          'Custom fine-tuned AI models',
          'Dedicated account manager',
          'Unlimited team seats',
          '50GB+ cloud storage',
          'On-premise deployment option',
          'API integrations'
        ],
        savings: '5x more tokens than Studio',
        buttonText: currentTier === 'enterprise' ? 'Current Plan' : 'Contact Sales',
        disabled: currentTier === 'enterprise'
      },
      {
        id: 'education',
        name: 'Education',
        subtitle: 'Special pricing for schools and universities',
        monthlyPrice: basePrices.education.monthly,
        yearlyPrice: basePrices.education.yearly,
        popular: false,
        current: currentTier === 'education',
        features: [
          'All Enterprise features included',
          'Unlimited student seats',
          'Classroom management tools',
          'Educational content library',
          'Assignment & project tracking',
          'Gradebook integration',
          'Priority academic support',
          'Curriculum development assistance'
        ],
        savings: 'Massive discounts for education',
        buttonText: currentTier === 'education' ? 'Current Plan' : 'Contact Sales',
        disabled: currentTier === 'education'
      }
    ];

    return tiers;
  };

  const handlePendingUpgrade = (proceed) => {
    console.log('🎯 handlePendingUpgrade called:', { proceed, pendingUpgrade, user: user?.email });
    
    if (proceed && pendingUpgrade) {
      // Check if user is authenticated
      if (!user?.email) {
        console.log('❌ User not authenticated, cannot proceed with upgrade');
        alert('Please sign in to continue with your upgrade.');
        setPendingUpgrade(null);
        return;
      }
      
      // Find the tier and trigger upgrade
      const tiers = getPricingTiers();
      const targetTier = tiers.find(t => t.id === pendingUpgrade.tier);
      if (targetTier) {
        console.log('🚀 Proceeding with pending upgrade:', targetTier.name);
        setPendingUpgrade(null);
        handleUpgrade(targetTier);
      } else {
        console.error('❌ Could not find target tier:', pendingUpgrade.tier);
      }
    } else {
      // Cancel the pending upgrade
      console.log('❌ Cancelling pending upgrade');
      setPendingUpgrade(null);
    }
  };

  const handleUpgrade = async (tier) => {
    console.log('🎯 handleUpgrade called with tier:', tier?.id, 'disabled:', tier?.disabled);
    
    if (tier.disabled || tier.id === 'free') {
      console.log('❌ Upgrade blocked - tier disabled or free:', tier?.id);
      return;
    }
    
    if (tier.id === 'enterprise') {
      console.log('📧 Opening enterprise email contact');
      window.open('mailto:sales@studiosix.ai?subject=Enterprise Inquiry&body=I am interested in StudioSix Enterprise. Please contact me to discuss pricing and features.', '_blank');
      return;
    }

    if (tier.id === 'education') {
      console.log('📧 Opening education email contact');
      window.open('mailto:sales@studiosix.ai?subject=Education Pricing Inquiry&body=I am interested in StudioSix Education pricing for my school/university. Please contact me to discuss educational discounts and features.', '_blank');
      return;
    }

    // Validate user email - redirect to sign in if not authenticated
    if (!user?.email) {
      console.log('❌ User not authenticated, storing pending upgrade and redirecting to auth');
      // Store the intended upgrade tier for after sign in
      localStorage.setItem('pending_upgrade', JSON.stringify({
        tier: tier.id,
        billing: selectedBilling,
        timestamp: new Date().toISOString()
      }));
      
      // Store return URL to come back to pricing page
      localStorage.setItem('auth_return_url', '/pricing');
      
      // Redirect to sign in page
      window.location.href = '/auth/callback';
      return;
    }

    console.log('✅ User authenticated, proceeding with payment flow for:', tier.id);
    console.log('👤 User email:', user.email);
    console.log('💳 Selected billing:', selectedBilling);
    
    setUpgrading(tier.id);

    try {
      console.log('🔧 Validating Paystack configuration...');
      // Validate Paystack configuration
      const configValidation = paystackService.validateConfiguration();
      console.log('⚙️ Config validation result:', configValidation);
      
      if (!configValidation.valid) {
        console.error('❌ Paystack configuration invalid:', configValidation.errors);
        throw new Error(`Payment configuration error: ${configValidation.errors.join(', ')}`);
      }

      console.log('💰 Calculating prices...');
      const priceUSD = selectedBilling === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice;
      const displayPrice = convertPrice(priceUSD);
      const priceZAR = Math.round(priceUSD * usdToZarRate); // Convert USD to ZAR for Paystack

      console.log('💵 Price calculations:', {
        priceUSD,
        displayPrice,
        priceZAR,
        usdToZarRate,
        selectedBilling
      });

      // Validate converted price
      if (!displayPrice || displayPrice <= 0) {
        console.error('❌ Invalid price calculated:', { displayPrice, priceUSD, priceZAR });
        throw new Error('Invalid payment amount calculated');
      }

      console.log('📦 Creating payment data...');
      const paymentData = {
        email: user.email,
        amount: priceZAR * 100, // Use ZAR price for Paystack, expects cents
        currency: 'ZAR', // Always charge in ZAR since that's what Paystack account supports
        plan: tier.id,
        billing_cycle: selectedBilling,
        callback_url: `${window.location.origin}/payment/callback`,
        metadata: {
          user_id: user?.id || 'anonymous',
          user_email: user.email,
          current_tier: currentTier,
          upgrade_tier: tier.id,
          original_price_usd: priceUSD,
          price_zar: priceZAR,
          displayed_price: displayPrice,
          displayed_currency: currency,
          usd_to_zar_rate: usdToZarRate,
          exchange_rate: exchangeRates[currency] || 1,
          user_location: userLocation,
          upgrade_timestamp: new Date().toISOString()
        }
      };

      console.log('💳 Payment data created:', {
        ...paymentData,
        metadata: { ...paymentData.metadata, user_email: '[REDACTED]' }
      });

      console.log('🚀 Calling paystackService.initializePayment...');
      const result = await paystackService.initializePayment(paymentData);
      console.log('📋 Payment initialization result:', result);
      
      if (result.success) {
        console.log('✅ Payment initialization successful!');
        console.log('🔗 Authorization URL:', result.authorization_url);
        console.log('📋 Reference:', result.reference || result.data?.reference);
        
        // Store payment attempt for tracking
        const pendingPayment = {
          reference: result.reference || result.data?.reference,
          plan: tier.id,
          amount: displayPrice,
          currency: currency,
          amount_zar: priceZAR,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('pending_payment', JSON.stringify(pendingPayment));
        console.log('💾 Stored pending payment:', pendingPayment);

        // Redirect to Paystack payment page
        console.log('🚀 Redirecting to Paystack payment page...');
        console.log('🔗 Full redirect URL:', result.authorization_url);
        
        if (result.authorization_url) {
          window.location.href = result.authorization_url;
          console.log('✅ Redirect command executed');
        } else {
          console.error('❌ No authorization_url in result:', result);
          throw new Error('No payment URL received from Paystack');
        }
      } else {
        console.error('❌ Payment initialization failed:', result);
        throw new Error(result.message || 'Payment initialization failed');
      }

    } catch (error) {
      console.error('❌ Upgrade failed with error:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error message:', error.message);
      
      // Show user-friendly error messages
      let errorMessage = 'Payment initialization failed. Please try again.';
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        console.log('🌐 Network error detected');
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('configuration')) {
        console.log('⚙️ Configuration error detected');
        errorMessage = 'Payment system is temporarily unavailable. Please try again later or contact support.';
      } else if (error.message.includes('email')) {
        console.log('📧 Email error detected');
        errorMessage = 'Please sign in with a valid email address to proceed.';
      } else if (error.message.includes('amount')) {
        console.log('💰 Amount error detected');
        errorMessage = 'Invalid payment amount. Please refresh the page and try again.';
      }
      
      console.log('🚨 Showing error to user:', errorMessage);
      
      // Show error in a more user-friendly way
      if (window.confirm(`${errorMessage}\n\nWould you like to contact support for assistance?`)) {
        window.open('mailto:support@studiosix.ai?subject=Payment Issue&body=I encountered an error while trying to upgrade my plan. Error details: ' + error.message, '_blank');
      }
    } finally {
      console.log('🧹 Cleaning up upgrade state');
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="pricing-page">
        <div className="pricing-header">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading pricing information...</p>
          </div>
        </div>
      </div>
    );
  }

  const tiers = getPricingTiers();

  return (
    <div className="pricing-page">
      {onClose && (
        <button className="pricing-close" onClick={onClose}>
          <span>×</span>
        </button>
      )}

      <div className="pricing-header">
        <h1>Choose Your StudioSix Plan</h1>
        <p>Unlock the full potential of AI-powered architectural design</p>
        

        <div className="billing-toggle">
          <button 
            className={selectedBilling === 'monthly' ? 'active' : ''}
            onClick={() => setSelectedBilling('monthly')}
          >
            Monthly
          </button>
          <button 
            className={selectedBilling === 'yearly' ? 'active' : ''}
            onClick={() => setSelectedBilling('yearly')}
          >
            Yearly <span className="savings-badge">Save 17%</span>
          </button>
          <button 
            className={selectedBilling === 'enterprise' ? 'active' : ''}
            onClick={() => setSelectedBilling('enterprise')}
          >
            Enterprise
          </button>
        </div>
      </div>

      {/* Pending upgrade confirmation */}
      {pendingUpgrade && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Welcome back!</h3>
            <p style={{ color: '#e2e8f0', marginBottom: '2rem' }}>
              Continue with your {pendingUpgrade.tier} upgrade ({pendingUpgrade.billing})?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => handlePendingUpgrade(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handlePendingUpgrade(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Continue Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pricing-grid">
        {tiers.filter(tier => {
          // Show all tiers for monthly/yearly, only enterprise and education for enterprise tab
          if (selectedBilling === 'enterprise') {
            return tier.id === 'enterprise' || tier.id === 'education';
          }
          return tier.id !== 'enterprise' && tier.id !== 'education'; // Hide enterprise and education tiers for monthly/yearly tabs
        }).map(tier => (
          <div 
            key={tier.id}
            className={`pricing-card ${tier.popular ? 'popular' : ''} ${tier.current ? 'current' : ''}`}
          >
            {tier.popular && <div className="popular-badge">Most Popular</div>}
            {tier.current && <div className="current-badge">Current Plan</div>}

            <div className="pricing-card-header">
              <h3>{tier.name}</h3>
              <p className="pricing-subtitle">{tier.subtitle}</p>
              
              {/* Only show pricing for non-enterprise/education tiers */}
              {tier.id !== 'enterprise' && tier.id !== 'education' && (
                <div className="price-display">
                  {tier.monthlyPrice === 0 ? (
                    <div className="price-free">
                      <span className="price-amount">Free</span>
                    </div>
                  ) : (
                    <div className="price-paid">
                      <span className="price-amount">
                        {selectedBilling === 'monthly' 
                          ? formatPrice(tier.monthlyPrice)
                          : formatPrice(tier.yearlyPrice)
                        }
                      </span>
                      <span className="price-period">
                        {selectedBilling === 'monthly' ? '/month' : '/year'}
                      </span>
                      {selectedBilling === 'yearly' && (
                        <div className="yearly-savings">
                          {formatPrice(Math.round(tier.yearlyPrice / 12))}/month when paid yearly
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tier.savings && (
                <div className="savings-highlight">
                  <span>🚀 {tier.savings}</span>
                </div>
              )}
            </div>

            <div className="pricing-features">
              <ul>
                {tier.features.map((feature, index) => (
                  <li key={index}>
                    <span className="feature-icon">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {tier.limitations && (
                <div className="limitations">
                  <p className="limitations-title">Limitations:</p>
                  <ul>
                    {tier.limitations.map((limitation, index) => (
                      <li key={index}>
                        <span className="limitation-icon">×</span>
                        {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="pricing-card-footer">
              <button
                className={`upgrade-button ${tier.popular ? 'popular' : ''} ${tier.disabled ? 'disabled' : ''}`}
                onClick={() => handleUpgrade(tier)}
                disabled={tier.disabled || upgrading === tier.id}
              >
                {upgrading === tier.id ? (
                  <span className="button-loading">
                    <div className="button-spinner"></div>
                    Processing...
                  </span>
                ) : (
                  tier.buttonText
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pricing-footer">
        <div className="pricing-guarantees">
          <div className="guarantee-item">
            <span className="guarantee-icon">🔒</span>
            <div>
              <h4>Secure Payments</h4>
              <p>Powered by Paystack with bank-grade security</p>
            </div>
          </div>
          <div className="guarantee-item">
            <span className="guarantee-icon">↻</span>
            <div>
              <h4>Cancel Anytime</h4>
              <p>No long-term contracts or hidden fees</p>
            </div>
          </div>
          <div className="guarantee-item">
            <span className="guarantee-icon">🎯</span>
            <div>
              <h4>Usage-Based Fairness</h4>
              <p>Pay only for what you actually use</p>
            </div>
          </div>
        </div>

        <div className="pricing-faq">
          <h3>Frequently Asked Questions</h3>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>What happens when I hit my limits?</h4>
              <p>You'll receive notifications at 75% and 90% usage. After reaching 100%, you can upgrade anytime to continue using StudioSix.</p>
            </div>
            <div className="faq-item">
              <h4>Can I change plans anytime?</h4>
              <p>Yes! Upgrade instantly or downgrade at the end of your billing cycle. Unused credits roll over when upgrading.</p>
            </div>
            <div className="faq-item">
              <h4>What payment methods do you accept?</h4>
              <p>We accept all major credit cards, debit cards, and bank transfers through our secure Paystack integration.</p>
            </div>
            <div className="faq-item">
              <h4>Is there a free trial?</h4>
              <p>Yes! Our Free tier gives you 5,000 AI tokens and 20 renders to try StudioSix risk-free. No credit card required.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;