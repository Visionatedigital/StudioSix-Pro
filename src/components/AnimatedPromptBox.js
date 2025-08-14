import React, { useState, useEffect } from 'react';
import { ArrowUpIcon, SparklesIcon } from '@heroicons/react/24/outline';

const PROMPT_SUGGESTIONS = [
  "a 2 bedroom house",
  "an open plan kitchen", 
  "a modern office building",
  "a retail store layout",
  "a cozy apartment",
  "a restaurant floor plan",
  "a warehouse facility",
  "a library with reading areas"
];

const AnimatedPromptBox = ({ onSubmit, className = "" }) => {
  const [inputValue, setInputValue] = useState('');
  const [currentSuggestionIndex, setSuggestionIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const basePlaceholder = "Ask StudioSix to create ";
  
  useEffect(() => {
    const currentSuggestion = PROMPT_SUGGESTIONS[currentSuggestionIndex];
    
    let timeout;
    
    if (isTyping && !isDeleting) {
      // Typing the suggestion
      if (displayText.length < currentSuggestion.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentSuggestion.slice(0, displayText.length + 1));
        }, 60 + Math.random() * 60); // Variable typing speed for natural feel
      } else {
        // Finished typing, wait then start deleting
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      }
    } else if (isDeleting) {
      // Deleting the suggestion
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 30);
      } else {
        // Finished deleting, move to next suggestion
        setIsDeleting(false);
        setSuggestionIndex((prev) => (prev + 1) % PROMPT_SUGGESTIONS.length);
      }
    }
    
    return () => clearTimeout(timeout);
  }, [displayText, currentSuggestionIndex, isTyping, isDeleting]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSubmit(inputValue.trim());
      setInputValue('');
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const fullPlaceholder = basePlaceholder + displayText + (isTyping && displayText.length < PROMPT_SUGGESTIONS[currentSuggestionIndex].length ? '|' : '');

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative group">
          {/* Main input container */}
          <div className="relative bg-slate-800/80 backdrop-blur-sm border border-gray-600/50 rounded-2xl p-4 transition-all duration-300 group-focus-within:border-studiosix-500/50 group-focus-within:bg-slate-800/90 group-focus-within:shadow-xl group-focus-within:shadow-studiosix-500/10">
            
            {/* Sparkles icon */}
            <div className="absolute left-5 top-1/2 transform -translate-y-1/2 z-10">
              <SparklesIcon className="w-5 h-5 text-studiosix-400" />
            </div>
            
            {/* Input field */}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={inputValue ? '' : fullPlaceholder}
              className="w-full bg-transparent text-white text-lg pl-10 pr-16 py-3 outline-none placeholder-gray-400 resize-none"
              style={{ minHeight: '50px' }}
            />
            
            {/* Submit button */}
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                inputValue.trim()
                  ? 'bg-studiosix-500 hover:bg-studiosix-600 text-white cursor-pointer'
                  : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
              }`}
            >
              <ArrowUpIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Subtle glow effect when focused */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-studiosix-500/20 to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10 blur-xl"></div>
        </div>
        
        {/* Quick suggestions */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <span className="text-sm text-gray-400 mr-2">Try:</span>
          {PROMPT_SUGGESTIONS.slice(0, 3).map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setInputValue(`Create ${suggestion}`)}
              className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 text-gray-300 hover:text-white text-sm rounded-lg transition-all duration-200 border border-gray-600/30 hover:border-studiosix-500/30"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
};

export default AnimatedPromptBox;