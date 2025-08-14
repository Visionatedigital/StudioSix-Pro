import React, { useState, useEffect } from 'react';
import { SparklesIcon, CubeIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';

const SplashScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing StudioSix AI...');

  useEffect(() => {
    const loadingSteps = [
      { text: 'Initializing StudioSix AI...', duration: 800 },
      { text: 'Loading CAD Engine...', duration: 600 },
      { text: 'Setting up 3D Workspace...', duration: 500 },
      { text: 'Preparing AI Assistant...', duration: 400 },
      { text: 'Ready to create!', duration: 300 }
    ];

    let currentStep = 0;
    let currentProgress = 0;

    const runStep = () => {
      if (currentStep < loadingSteps.length) {
        const step = loadingSteps[currentStep];
        setLoadingText(step.text);
        
        const targetProgress = ((currentStep + 1) / loadingSteps.length) * 100;
        const progressIncrement = (targetProgress - currentProgress) / 50;
        
        const progressInterval = setInterval(() => {
          currentProgress += progressIncrement;
          setProgress(Math.min(currentProgress, targetProgress));
          
          if (currentProgress >= targetProgress) {
            clearInterval(progressInterval);
            currentStep++;
            
            setTimeout(() => {
              if (currentStep < loadingSteps.length) {
                runStep();
              } else {
                setTimeout(onComplete, 500);
              }
            }, step.duration);
          }
        }, 20);
      }
    };

    const timer = setTimeout(runStep, 500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-studiosix-950 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-studiosix-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-studiosix-600/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-studiosix-400/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center">
        {/* Logo and branding */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center neon-purple shadow-xl">
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
          
          <h1 className="text-5xl font-bold text-white mb-3 animate-fade-in">
            Studio<span className="text-studiosix-400">Six</span>
          </h1>
          
          {/* 
          CUSTOMIZATION EXAMPLE - Replace the above with your branding:
          
          <h1 className="text-5xl font-bold text-white mb-3 animate-fade-in">
            My<span className="text-studiosix-400">CAD</span>
          </h1>
          */}
          
          <p className="text-xl text-gray-300 mb-2 animate-fade-in delay-200">
            AI-Powered BIM Architecture
          </p>
          
          {/*
          CUSTOMIZATION EXAMPLE - Change tagline:
          
          <p className="text-xl text-gray-300 mb-2 animate-fade-in delay-200">
            Professional Architecture Suite
          </p>
          */}
          
          <p className="text-sm text-gray-500 animate-fade-in delay-300">
            Next generation building design with AI Assisted CAD
          </p>
        </div>

        {/* Loading progress */}
        <div className="w-80 mx-auto">
          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2">{loadingText}</p>
            
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-studiosix-500 to-studiosix-400 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              >
                <div className="h-full bg-white/20 animate-pulse"></div>
              </div>
            </div>
            
            <div className="text-right mt-1">
              <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-12 grid grid-cols-3 gap-8 max-w-md mx-auto">
          <div className="text-center animate-fade-in delay-500">
            <BuildingOffice2Icon className="w-8 h-8 text-studiosix-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Smart BIM</p>
          </div>
          <div className="text-center animate-fade-in delay-700">
            <SparklesIcon className="w-8 h-8 text-studiosix-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">AI Assistant</p>
          </div>
          <div className="text-center animate-fade-in delay-900">
            <CubeIcon className="w-8 h-8 text-studiosix-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">3D Modeling</p>
          </div>
        </div>
      </div>

      {/* Version info */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <p className="text-xs text-gray-600">
          Version 1.0.0 • Built with React & FreeCAD
        </p>
      </div>
    </div>
  );
};

export default SplashScreen; 