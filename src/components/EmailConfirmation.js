import React, { useState, useEffect } from 'react';
import { 
  EnvelopeIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';

const EmailConfirmation = ({ email, onConfirmed, onBack }) => {
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); // Countdown for resend button

  const { verifyEmail, resendConfirmation } = useAuth();

  // Countdown timer for resend button
  useEffect(() => {
    let timer;
    if (timeLeft > 0) {
      timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [timeLeft]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      setTimeLeft(0); // Stop any running timers
    };
  }, []);

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!confirmationCode.trim()) {
      setVerificationError('Please enter the confirmation code');
      return;
    }

    setIsVerifying(true);
    setVerificationError('');

    try {
      const result = await verifyEmail(email, confirmationCode);
      if (result.success) {
        console.log('✅ Email confirmed successfully');
        onConfirmed(result);
      } else {
        setVerificationError(result.error || 'Invalid confirmation code');
      }
    } catch (error) {
      setVerificationError('Failed to verify email. Please try again.');
      console.error('Email verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (isResending || timeLeft > 0) {
      return; // Prevent multiple clicks
    }

    setIsResending(true);
    setResendSuccess(false);
    setVerificationError('');

    try {
      console.log(`🔄 Resending confirmation code to: ${email}`);
      const result = await resendConfirmation(email);
      
      if (result.success) {
        console.log('✅ Confirmation code resent successfully');
        setResendSuccess(true);
        setTimeLeft(60); // Reset countdown to 60 seconds
        setConfirmationCode(''); // Clear old code since it's now invalid
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setResendSuccess(false);
        }, 5000);
      } else {
        console.error('❌ Failed to resend confirmation:', result.error);
        setVerificationError(result.error || 'Failed to resend confirmation code. Please try again.');
      }
    } catch (error) {
      console.error('❌ Resend confirmation error:', error);
      setVerificationError('Network error. Please check your connection and try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-studiosix-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-studiosix-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                <img 
                  src="./studiosix-icon.svg" 
                  alt="StudioSix Icon" 
                  className="w-12 h-12"
                />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-studiosix-400 rounded-full flex items-center justify-center">
                <CubeIcon className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-2">
            Studio<span className="text-studiosix-400">Six</span> <span className="text-gray-300">Pro</span>
          </h1>
          
          <p className="text-gray-400 text-lg">
            Check Your Email
          </p>
          <p className="text-gray-500 text-sm mt-2">
            We've sent a confirmation code to verify your account
          </p>
        </div>

        {/* Confirmation form */}
        <div className="bg-slate-800 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
          {/* Email display */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-studiosix-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <EnvelopeIcon className="w-8 h-8 text-studiosix-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Confirm Your Email
            </h2>
            <p className="text-gray-400 text-sm">
              We sent a 6-digit code to:
            </p>
            <p className="text-white font-medium mt-1">{email}</p>
          </div>

          {/* Error message */}
          {verificationError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mr-2" />
              <p className="text-red-400 text-sm">{verificationError}</p>
            </div>
          )}

          {/* Success message */}
          {resendSuccess && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center">
              <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2" />
              <p className="text-green-400 text-sm">
                New confirmation code sent! Check your email inbox (and spam folder).
              </p>
            </div>
          )}

          {/* Confirmation form */}
          <form onSubmit={handleVerifyCode} className="space-y-4">
            {/* Confirmation code input */}
            <div className="relative">
              <input
                type="text"
                name="confirmationCode"
                placeholder="Enter 6-digit code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-gray-400 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-studiosix-500 focus:border-transparent transition-all"
                maxLength="6"
                autoComplete="one-time-code"
                required
              />
            </div>

            {/* Verify button */}
            <button
              type="submit"
              disabled={isVerifying || confirmationCode.length !== 6}
              className="w-full bg-studiosix-600 hover:bg-studiosix-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center"
            >
              {isVerifying ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>
          </form>

          {/* Resend section */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm mb-3">
              Didn't receive the code?
            </p>
            
            <button
              onClick={handleResendCode}
              disabled={isResending || timeLeft > 0}
              className="text-studiosix-400 hover:text-studiosix-300 font-medium text-sm disabled:text-gray-500 disabled:cursor-not-allowed transition-colors inline-flex items-center"
              title={timeLeft > 0 ? `Wait ${timeLeft} seconds before resending` : 'Send a new confirmation code'}
            >
              {isResending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
                  Sending new code...
                </>
              ) : timeLeft > 0 ? (
                <>
                  <span>Resend in {timeLeft}s</span>
                </>
              ) : (
                <>
                  <span>Resend Code</span>
                </>
              )}
            </button>
          </div>

          {/* Back to login */}
          <div className="mt-6 text-center">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmation; 