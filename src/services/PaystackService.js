/**
 * Paystack Payment Service
 * 
 * Handles payment initialization, verification, and subscription management
 * with Paystack API integration
 */

class PaystackService {
  constructor() {
    this.publicKey = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;
    this.baseUrl = 'https://api.paystack.co';
    
    if (!this.publicKey) {
      console.warn('Paystack public key not found in environment variables');
    }
  }

  /**
   * Initialize a payment with Paystack
   * @param {Object} paymentData - Payment configuration
   * @returns {Promise<Object>} Payment initialization response
   */
  async initializePayment(paymentData) {
    try {
      const {
        email,
        amount,
        currency = 'USD',
        plan,
        billing_cycle,
        metadata = {}
      } = paymentData;

      // Validate required fields
      if (!email || !amount || !plan) {
        throw new Error('Email, amount, and plan are required');
      }

      // Create payment payload
      const payload = {
        email,
        amount: Math.round(amount), // Ensure integer (kobo/cents)
        currency: currency.toUpperCase(),
        reference: this.generateReference(plan, billing_cycle),
        callback_url: `${window.location.origin}/payment/callback`,
        metadata: {
          ...metadata,
          plan,
          billing_cycle,
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
      };

      // For recurring payments, add subscription plan
      if (billing_cycle && plan !== 'enterprise') {
        payload.plan_code = this.getPlanCode(plan, billing_cycle);
      }

      // Make API call to your backend (Paystack requires server-side initialization for security)
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment initialization failed');
      }

      const result = await response.json();
      
      return {
        success: true,
        authorization_url: result.data.authorization_url,
        access_code: result.data.access_code,
        reference: result.data.reference
      };

    } catch (error) {
      console.error('Payment initialization error:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  /**
   * Verify a payment transaction
   * @param {string} reference - Payment reference
   * @returns {Promise<Object>} Verification result
   */
  async verifyPayment(reference) {
    try {
      const response = await fetch(`/api/payments/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Payment verification failed');
      }

      const result = await response.json();
      
      return {
        success: result.data.status === 'success',
        data: result.data,
        amount: result.data.amount / 100, // Convert from kobo/cents
        currency: result.data.currency,
        customer: result.data.customer,
        metadata: result.data.metadata
      };

    } catch (error) {
      console.error('Payment verification error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Create a subscription plan in Paystack
   * @param {Object} planData - Plan configuration
   * @returns {Promise<Object>} Plan creation result
   */
  async createPlan(planData) {
    try {
      const {
        name,
        amount,
        interval,
        currency = 'USD',
        description,
        plan_code
      } = planData;

      const payload = {
        name,
        amount: Math.round(amount * 100), // Convert to kobo/cents
        interval,
        currency: currency.toUpperCase(),
        description,
        plan_code: plan_code || this.generatePlanCode(name, interval)
      };

      const response = await fetch('/api/payments/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Plan creation failed');
      }

      return await response.json();

    } catch (error) {
      console.error('Plan creation error:', error);
      throw error;
    }
  }

  /**
   * Get subscription plans from Paystack
   * @returns {Promise<Array>} List of plans
   */
  async getPlans() {
    try {
      const response = await fetch('/api/payments/plans', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch plans');
      }

      const result = await response.json();
      return result.data || [];

    } catch (error) {
      console.error('Get plans error:', error);
      return [];
    }
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionCode - Subscription code
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelSubscription(subscriptionCode) {
    try {
      const response = await fetch(`/api/payments/subscriptions/${subscriptionCode}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Subscription cancellation failed');
      }

      return await response.json();

    } catch (error) {
      console.error('Subscription cancellation error:', error);
      throw error;
    }
  }

  /**
   * Get customer subscriptions
   * @param {string} customerCode - Customer code
   * @returns {Promise<Array>} Customer subscriptions
   */
  async getCustomerSubscriptions(customerCode) {
    try {
      const response = await fetch(`/api/payments/customers/${customerCode}/subscriptions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }

      const result = await response.json();
      return result.data || [];

    } catch (error) {
      console.error('Get subscriptions error:', error);
      return [];
    }
  }

  /**
   * Generate unique payment reference
   * @param {string} plan - Plan name
   * @param {string} billingCycle - Billing cycle
   * @returns {string} Payment reference
   */
  generateReference(plan, billingCycle) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `studiosix_${plan}_${billingCycle}_${timestamp}_${random}`;
  }

  /**
   * Get plan code for Paystack subscription
   * @param {string} plan - Plan name
   * @param {string} billingCycle - Billing cycle
   * @returns {string} Plan code
   */
  getPlanCode(plan, billingCycle) {
    return `studiosix_${plan}_${billingCycle}`;
  }

  /**
   * Generate plan code
   * @param {string} name - Plan name
   * @param {string} interval - Billing interval
   * @returns {string} Generated plan code
   */
  generatePlanCode(name, interval) {
    return `${name.toLowerCase().replace(/\s+/g, '_')}_${interval}`;
  }

  /**
   * Get authentication token for API requests
   * @returns {string} Auth token
   */
  getAuthToken() {
    // In a real app, this would be retrieved from your auth service
    // For now, returning a placeholder that your backend should handle
    return localStorage.getItem('auth_token') || 'anonymous';
  }

  /**
   * Handle payment popup (for direct frontend integration)
   * @param {Object} config - Payment configuration
   * @returns {Promise<Object>} Payment result
   */
  async payWithPopup(config) {
    return new Promise((resolve, reject) => {
      if (!window.PaystackPop) {
        reject(new Error('Paystack popup not loaded. Include Paystack inline script.'));
        return;
      }

      const handler = window.PaystackPop.setup({
        key: this.publicKey,
        email: config.email,
        amount: config.amount * 100, // Convert to kobo
        currency: config.currency || 'USD',
        ref: config.reference || this.generateReference(config.plan, config.billing_cycle),
        metadata: config.metadata || {},
        callback: function(response) {
          resolve({
            success: true,
            reference: response.reference,
            message: 'Payment completed successfully'
          });
        },
        onClose: function() {
          resolve({
            success: false,
            message: 'Payment cancelled by user'
          });
        }
      });

      handler.openIframe();
    });
  }

  /**
   * Load Paystack inline script
   * @returns {Promise<void>} Script loading promise
   */
  async loadPaystackScript() {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Format amount for display
   * @param {number} amount - Amount in base currency
   * @param {string} currency - Currency code
   * @returns {string} Formatted amount
   */
  formatAmount(amount, currency = 'ZAR') {
    const formatter = new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

    return formatter.format(amount);
  }

  /**
   * Validate Paystack configuration
   * @returns {Object} Validation result
   */
  validateConfiguration() {
    const errors = [];
    
    if (!this.publicKey) {
      errors.push('Paystack public key is missing');
    }

    if (!this.publicKey?.startsWith('pk_')) {
      errors.push('Paystack public key format is invalid');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Create and export singleton instance
const paystackService = new PaystackService();
export default paystackService;