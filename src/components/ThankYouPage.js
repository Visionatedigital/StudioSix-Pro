import React from 'react';
import { CheckIcon, ArrowRightIcon, CalendarIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

const ThankYouPage = () => {
  const benefits = [
    "Priority access to beta features",
    "Exclusive design webinars & tutorials", 
    "Direct feedback channel to our team",
    "Special early access pricing"
  ];

  const handleBookDemo = () => {
    // Open Calendly or redirect to booking link
    window.open('https://calendly.com/visionatedigital/30min', '_blank');
  };

  const handleBackToHome = () => {
    window.location.href = '/';
  };

  const handleDownloadApp = () => {
    // Redirect to main application
    window.location.href = '/app';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-studiosix-950 flex items-center justify-center p-4">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-studiosix-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="text-center">
          
          {/* Success Icon */}
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-green-400/30">
            <CheckIcon className="w-12 h-12 text-green-400" />
          </div>

          {/* Header */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            <span className="bg-gradient-to-r from-green-400 to-studiosix-400 bg-clip-text text-transparent">
              Welcome to the Future!
            </span>
          </h1>

          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            🎉 You're now on the StudioSix Pro early access list! Check your inbox for a confirmation email with exclusive updates and early access benefits.
          </p>

          {/* Benefits Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12 max-w-3xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 flex items-center space-x-4">
                <div className="w-10 h-10 bg-studiosix-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckIcon className="w-5 h-5 text-studiosix-400" />
                </div>
                <span className="text-white font-medium">{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Section */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-3xl p-8 border border-gray-700/50 mb-12">
            <div className="flex items-center justify-center mb-4">
              <SparklesIcon className="w-8 h-8 text-studiosix-400 mr-2" />
              <h2 className="text-2xl font-bold text-white">Ready to See StudioSix in Action?</h2>
            </div>
            
            <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
              Book a personalized demo and see how StudioSix Pro can transform your architectural workflow. Our team will show you exclusive features and answer all your questions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleBookDemo}
                className="bg-studiosix-500 hover:bg-studiosix-600 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 hover:shadow-xl hover:shadow-studiosix-500/25 flex items-center space-x-2"
              >
                <CalendarIcon className="w-5 h-5" />
                <span>Book Personal Demo</span>
              </button>
              
              <button
                onClick={handleDownloadApp}
                className="bg-slate-700/50 hover:bg-slate-600/50 text-white px-8 py-4 rounded-xl font-semibold border border-gray-600/50 transition-all duration-200 flex items-center space-x-2 group"
              >
                <span>Try StudioSix Now</span>
                <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Social Proof */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="w-5 h-5" />
                ))}
              </div>
              <span className="text-gray-400 ml-2">5.0 from early adopters</span>
            </div>
            <p className="text-gray-500 text-sm">
              "StudioSix has completely changed how we approach architectural design" - Sarah Chen, Senior Architect
            </p>
          </div>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-gray-400">
            <button
              onClick={handleBackToHome}
              className="hover:text-white transition-colors flex items-center space-x-1"
            >
              <span>← Back to Home</span>
            </button>
            
            <span className="hidden sm:block">•</span>
            
            <a href="mailto:hello@studiosix.ai" className="hover:text-white transition-colors">
              Questions? Contact us
            </a>
            
            <span className="hidden sm:block">•</span>
            
            <a href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
          </div>

        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 right-20 w-4 h-4 bg-studiosix-400 rounded-full animate-bounce delay-300"></div>
      <div className="absolute bottom-40 left-20 w-3 h-3 bg-purple-400 rounded-full animate-bounce delay-700"></div>
      <div className="absolute top-40 left-40 w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-1000"></div>
    </div>
  );
};

export default ThankYouPage;