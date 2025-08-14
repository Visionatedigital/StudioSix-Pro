import React, { useEffect, useState } from 'react';
import { SparklesIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';

const AuthCallback = ({ onAuthSuccess, onAuthError }) => {
  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [message, setMessage] = useState('Processing authentication...');
  const { user } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check if we have a user after OAuth redirect
        if (user) {
          setStatus('success');
          setMessage('Authentication successful! Redirecting to app...');
          
          // Wait a moment to show success message
          setTimeout(() => {
            onAuthSuccess?.(user);
          }, 2000);
        } else {
          // No user found, check for error in URL
          const urlParams = new URLSearchParams(window.location.search);
          const error = urlParams.get('error');
          const errorDescription = urlParams.get('error_description');
          
          if (error) {
            setStatus('error');
            setMessage(errorDescription || 'Authentication failed');
            onAuthError?.(error);
          } else {
            // Still waiting for auth to complete
            setTimeout(() => {
              if (!user) {
                setStatus('error');
                setMessage('Authentication timeout. Please try again.');
                onAuthError?.('timeout');
              }
            }, 10000); // 10 second timeout
          }
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('Authentication failed. Please try again.');
        onAuthError?.(error.message);
      }
    };

    handleAuthCallback();
  }, [user, onAuthSuccess, onAuthError]);

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="animate-spin w-12 h-12 border-4 border-studiosix-500 border-t-transparent rounded-full"></div>
        );
      case 'success':
        return <CheckCircleIcon className="w-12 h-12 text-green-400" />;
      case 'error':
        return <ExclamationTriangleIcon className="w-12 h-12 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-studiosix-400';
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-studiosix-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-studiosix-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <SparklesIcon className="w-12 h-12 text-studiosix-400 mr-3" />
          <h1 className="text-3xl font-bold text-white">StudioSix Pro</h1>
        </div>

        {/* Status card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
          {/* Status icon */}
          <div className="flex justify-center mb-6">
            {getStatusIcon()}
          </div>

          {/* Status message */}
          <h2 className={`text-xl font-semibold mb-4 ${getStatusColor()}`}>
            {status === 'processing' && 'Authenticating...'}
            {status === 'success' && 'Welcome!'}
            {status === 'error' && 'Authentication Failed'}
          </h2>

          <p className="text-gray-400 mb-6">
            {message}
          </p>

          {/* User info (if success) */}
          {status === 'success' && user && (
            <div className="bg-slate-700/30 rounded-lg p-4 mb-6">
              <p className="text-white font-medium">{user.email}</p>
              {user.user_metadata?.full_name && (
                <p className="text-gray-400 text-sm">{user.user_metadata.full_name}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          {status === 'error' && (
            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/'}
                className="w-full py-3 px-4 bg-gradient-to-r from-studiosix-500 to-studiosix-600 hover:from-studiosix-600 hover:to-studiosix-700 text-white font-semibold rounded-lg transition-all"
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.close()}
                className="w-full py-3 px-4 border border-slate-600/50 text-gray-400 hover:text-white hover:bg-slate-700/50 font-semibold rounded-lg transition-all"
              >
                Close Window
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-3">
              <button
                onClick={() => onAuthSuccess?.(user)}
                className="w-full py-3 px-4 bg-gradient-to-r from-studiosix-500 to-studiosix-600 hover:from-studiosix-600 hover:to-studiosix-700 text-white font-semibold rounded-lg transition-all"
              >
                Continue to App
              </button>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        {status === 'processing' && (
          <div className="mt-6">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div className="bg-gradient-to-r from-studiosix-500 to-studiosix-600 h-2 rounded-full animate-pulse"></div>
            </div>
            <p className="text-gray-500 text-sm mt-2">
              This may take a few moments...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback; 