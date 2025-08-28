/**
 * Payment Success Page
 * 
 * Handles payment callback from Paystack and displays success/failure status
 */

import React, { useState, useEffect } from 'react';
import paystackService from '../services/PaystackService';
import subscriptionService from '../services/SubscriptionService';
import './PaymentSuccess.css';

const PaymentSuccess = () => {
  const [paymentStatus, setPaymentStatus] = useState('verifying');
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      // Extract reference from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const reference = urlParams.get('reference') || urlParams.get('trxref');

      if (!reference) {
        setError('No payment reference found in URL');
        setPaymentStatus('error');
        return;
      }

      console.log('🔍 Verifying payment with reference:', reference);

      // Verify payment with Paystack
      const verificationResult = await paystackService.verifyPayment(reference);

      if (verificationResult.success && verificationResult.data.status === 'success') {
        setPaymentData(verificationResult.data);
        setPaymentStatus('success');

        // Update user subscription status if this was a subscription payment
        if (verificationResult.data.metadata?.plan) {
          try {
            await subscriptionService.activateSubscription({
              userId: verificationResult.data.metadata.user_id,
              plan: verificationResult.data.metadata.plan,
              billingCycle: verificationResult.data.metadata.billing_cycle,
              paymentReference: reference,
              amount: verificationResult.data.amount / 100,
              currency: verificationResult.data.currency,
              customerCode: verificationResult.data.customer?.customer_code
            });
            console.log('✅ Subscription activated successfully');
          } catch (subscriptionError) {
            console.error('❌ Failed to activate subscription:', subscriptionError);
            // Payment succeeded but subscription activation failed
            setError('Payment successful but subscription activation failed. Please contact support.');
          }
        }
      } else {
        setError(verificationResult.message || 'Payment verification failed');
        setPaymentStatus('failed');
      }

    } catch (error) {
      console.error('❌ Payment verification error:', error);
      setError('Unable to verify payment. Please contact support if payment was deducted.');
      setPaymentStatus('error');
    }
  };

  const formatAmount = (amount, currency) => {
    try {
      return paystackService.formatAmount(amount / 100, currency);
    } catch (error) {
      return `${currency} ${(amount / 100).toFixed(2)}`;
    }
  };

  const handleContinue = () => {
    // Navigate back to the main app or dashboard
    window.location.href = '/app';
  };

  const handleRetry = () => {
    // Navigate back to pricing page
    window.location.href = '/pricing';
  };

  const renderVerifyingState = () => (
    <div className="payment-status-container verifying">
      <div className="payment-icon">
        <div className="payment-spinner"></div>
      </div>
      <h2>Verifying Your Payment</h2>
      <p>Please wait while we confirm your payment with Paystack...</p>
      <div className="verification-steps">
        <div className="step active">
          <span className="step-icon">⏳</span>
          Checking payment status
        </div>
        <div className="step">
          <span className="step-icon">🔒</span>
          Activating subscription
        </div>
        <div className="step">
          <span className="step-icon">✅</span>
          Ready to use
        </div>
      </div>
    </div>
  );

  const renderSuccessState = () => (
    <div className="payment-status-container success">
      <div className="payment-icon">
        <span className="success-checkmark">✅</span>
      </div>
      <h2>Payment Successful!</h2>
      <p>Thank you for subscribing to StudioSix Pro</p>
      
      {paymentData && (
        <div className="payment-details">
          <div className="payment-summary">
            <h3>Payment Summary</h3>
            <div className="detail-row">
              <span>Amount Paid:</span>
              <span className="amount">{formatAmount(paymentData.amount, paymentData.currency)}</span>
            </div>
            <div className="detail-row">
              <span>Plan:</span>
              <span className="plan">{paymentData.metadata?.plan?.toUpperCase()} Plan</span>
            </div>
            <div className="detail-row">
              <span>Billing Cycle:</span>
              <span>{paymentData.metadata?.billing_cycle}</span>
            </div>
            <div className="detail-row">
              <span>Transaction ID:</span>
              <span className="reference">{paymentData.reference}</span>
            </div>
          </div>
          
          <div className="next-steps">
            <h3>What's Next?</h3>
            <ul>
              <li>Your subscription is now active</li>
              <li>You have access to all {paymentData.metadata?.plan} features</li>
              <li>Check your email for a receipt</li>
              <li>Start creating amazing architectural designs!</li>
            </ul>
          </div>
        </div>
      )}
      
      <div className="payment-actions">
        <button className="continue-button" onClick={handleContinue}>
          Continue to StudioSix Pro
        </button>
      </div>
    </div>
  );

  const renderFailedState = () => (
    <div className="payment-status-container failed">
      <div className="payment-icon">
        <span className="failed-icon">❌</span>
      </div>
      <h2>Payment Failed</h2>
      <p>We couldn't process your payment at this time</p>
      
      {error && (
        <div className="error-details">
          <p>{error}</p>
        </div>
      )}
      
      <div className="failure-help">
        <h3>What you can do:</h3>
        <ul>
          <li>Check that your card has sufficient funds</li>
          <li>Verify your card details are correct</li>
          <li>Try a different payment method</li>
          <li>Contact your bank if the problem persists</li>
        </ul>
      </div>
      
      <div className="payment-actions">
        <button className="retry-button" onClick={handleRetry}>
          Try Again
        </button>
        <button className="support-button" onClick={() => window.open('mailto:support@studiosix.ai')}>
          Contact Support
        </button>
      </div>
    </div>
  );

  const renderErrorState = () => (
    <div className="payment-status-container error">
      <div className="payment-icon">
        <span className="error-icon">⚠️</span>
      </div>
      <h2>Verification Error</h2>
      <p>We encountered an issue while verifying your payment</p>
      
      {error && (
        <div className="error-details">
          <p>{error}</p>
        </div>
      )}
      
      <div className="error-help">
        <p>
          If you believe this is an error and your payment was successful, 
          please contact our support team with your transaction details.
        </p>
      </div>
      
      <div className="payment-actions">
        <button className="support-button primary" onClick={() => window.open('mailto:support@studiosix.ai')}>
          Contact Support
        </button>
        <button className="retry-button" onClick={handleRetry}>
          Back to Pricing
        </button>
      </div>
    </div>
  );

  return (
    <div className="payment-success-page">
      <div className="payment-container">
        {paymentStatus === 'verifying' && renderVerifyingState()}
        {paymentStatus === 'success' && renderSuccessState()}
        {paymentStatus === 'failed' && renderFailedState()}
        {paymentStatus === 'error' && renderErrorState()}
      </div>
      
      <div className="payment-footer">
        <div className="security-badges">
          <div className="badge">
            <span className="badge-icon">🔒</span>
            <span>Secured by Paystack</span>
          </div>
          <div className="badge">
            <span className="badge-icon">✅</span>
            <span>256-bit SSL Encryption</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;