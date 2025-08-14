import React from 'react';
import { 
  ExclamationTriangleIcon, 
  CogIcon, 
  SparklesIcon,
  DocumentTextIcon,
  LinkIcon
} from '@heroicons/react/24/outline';

const AuthConfigNotice = ({ onSkip }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-studiosix-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-studiosix-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <SparklesIcon className="w-12 h-12 text-studiosix-400 mr-3" />
            <h1 className="text-3xl font-bold text-white">StudioSix Pro</h1>
          </div>
          <p className="text-gray-400 text-lg">
            AI-Powered CAD Architecture Platform
          </p>
        </div>

        {/* Configuration notice */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
          {/* Warning icon */}
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-yellow-500/10 rounded-full">
              <ExclamationTriangleIcon className="w-12 h-12 text-yellow-400" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            Authentication Setup Required
          </h2>

          {/* Description */}
          <p className="text-gray-400 text-center mb-6">
            To enable user authentication and secure project management, you need to configure Supabase credentials.
          </p>

          {/* Status */}
          <div className="bg-slate-700/30 rounded-lg p-4 mb-6">
            <div className="flex items-center text-yellow-400 mb-2">
              <CogIcon className="w-5 h-5 mr-2" />
              <span className="font-medium">Configuration Status</span>
            </div>
            <ul className="text-gray-400 text-sm space-y-1 ml-7">
              <li>• Supabase URL: {process.env.REACT_APP_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</li>
              <li>• Supabase Anon Key: {process.env.REACT_APP_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</li>
              <li>• Authentication: ❌ Not configured</li>
            </ul>
          </div>

          {/* Setup instructions */}
          <div className="bg-studiosix-500/10 border border-studiosix-500/20 rounded-lg p-4 mb-6">
            <h3 className="text-studiosix-400 font-medium mb-3 flex items-center">
              <DocumentTextIcon className="w-5 h-5 mr-2" />
              Quick Setup Instructions
            </h3>
            <ol className="text-gray-300 text-sm space-y-2">
              <li className="flex">
                <span className="bg-studiosix-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">1</span>
                <span>Create a <strong>Supabase account</strong> at <code className="bg-slate-700 px-1 rounded">supabase.com</code></span>
              </li>
              <li className="flex">
                <span className="bg-studiosix-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">2</span>
                <span>Create a <strong>new project</strong> and get your credentials</span>
              </li>
              <li className="flex">
                <span className="bg-studiosix-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">3</span>
                <span>Create <code className="bg-slate-700 px-1 rounded">.env</code> file with your Supabase URL and key</span>
              </li>
              <li className="flex">
                <span className="bg-studiosix-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">4</span>
                <span>Restart the development server</span>
              </li>
            </ol>
          </div>

          {/* Environment file example */}
          <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
            <h4 className="text-white font-medium mb-2 text-sm">Example .env file:</h4>
            <code className="text-green-400 text-sm block whitespace-pre">
{`REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`}
            </code>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center py-3 px-4 bg-gradient-to-r from-studiosix-500 to-studiosix-600 hover:from-studiosix-600 hover:to-studiosix-700 text-white font-semibold rounded-lg transition-all"
            >
              <LinkIcon className="w-5 h-5 mr-2" />
              Set Up Supabase
            </a>
            
            <button
              onClick={onSkip}
              className="flex-1 py-3 px-4 border border-slate-600/50 text-gray-400 hover:text-white hover:bg-slate-700/50 font-semibold rounded-lg transition-all"
            >
              Skip for Now
            </button>
          </div>

          {/* Note */}
          <p className="text-gray-500 text-xs text-center mt-4">
            <strong>Note:</strong> You can skip authentication setup for now, but user sign-in will be disabled.
            See <code>web-app/AUTH_SETUP.md</code> for detailed instructions.
          </p>
        </div>

        {/* Development mode notice */}
        <div className="text-center mt-6 text-gray-500 text-sm">
          <p>Running in development mode</p>
          <p className="mt-1">Environment: {process.env.NODE_ENV || 'development'}</p>
        </div>
      </div>
    </div>
  );
};

export default AuthConfigNotice; 