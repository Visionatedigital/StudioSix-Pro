import React, { useState, useEffect } from 'react';
import { ArrowUpIcon, SparklesIcon, PlayIcon, UserPlusIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { ArrowRightIcon, CheckIcon, StarIcon } from '@heroicons/react/24/solid';

// Countdown Timer Component
const CountdownTimer = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const targetDate = new Date('2025-09-01T00:00:00').getTime();
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center">
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-studiosix-500/20 border border-studiosix-500/30 rounded-lg p-2">
          <div className="text-lg font-bold text-white">{timeLeft.days}</div>
          <div className="text-xs text-studiosix-300">DAYS</div>
        </div>
        <div className="bg-studiosix-500/20 border border-studiosix-500/30 rounded-lg p-2">
          <div className="text-lg font-bold text-white">{timeLeft.hours}</div>
          <div className="text-xs text-studiosix-300">HOURS</div>
        </div>
        <div className="bg-studiosix-500/20 border border-studiosix-500/30 rounded-lg p-2">
          <div className="text-lg font-bold text-white">{timeLeft.minutes}</div>
          <div className="text-xs text-studiosix-300">MIN</div>
        </div>
        <div className="bg-studiosix-500/20 border border-studiosix-500/30 rounded-lg p-2">
          <div className="text-lg font-bold text-white">{timeLeft.seconds}</div>
          <div className="text-xs text-studiosix-300">SEC</div>
        </div>
      </div>
      <p className="text-xs text-gray-400">Until StudioSix Pro Launch</p>
    </div>
  );
};

// Typewriter Effect for Hero Section with GIF sync
const TypewriterPrompt = ({ suggestions, className = "", onSuggestionChange }) => {
  const [currentSuggestionIndex, setSuggestionIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const basePlaceholder = "Ask StudioSix to create ";
  
  useEffect(() => {
    const currentSuggestion = suggestions[currentSuggestionIndex];
    
    let timeout;
    
    if (isTyping && !isDeleting) {
      if (displayText.length < currentSuggestion.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentSuggestion.slice(0, displayText.length + 1));
        }, 80 + Math.random() * 40);
      } else {
        // Stay on the current text longer (4 seconds) to match GIF timing
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 4000);
      }
    } else if (isDeleting) {
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 40);
      } else {
        setIsDeleting(false);
        const nextIndex = (currentSuggestionIndex + 1) % suggestions.length;
        setSuggestionIndex(nextIndex);
        // Notify parent about suggestion change for GIF sync
        if (onSuggestionChange) {
          onSuggestionChange(nextIndex);
        }
      }
    }
    
    return () => clearTimeout(timeout);
  }, [displayText, currentSuggestionIndex, isTyping, isDeleting, suggestions, onSuggestionChange]);

  // Notify parent of initial suggestion
  useEffect(() => {
    if (onSuggestionChange) {
      onSuggestionChange(currentSuggestionIndex);
    }
  }, []);

  const fullText = basePlaceholder + displayText + (isTyping && displayText.length < suggestions[currentSuggestionIndex].length ? '|' : '');

  return (
    <div className={`text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-8 ${className}`}>
      <div className="h-[6rem] md:h-[7rem] lg:h-[8rem] flex items-start justify-start">
        <span className="bg-gradient-to-r from-white to-studiosix-300 bg-clip-text text-transparent leading-tight">
          {fullText}
        </span>
      </div>
    </div>
  );
};

// GIF Cycling Component
const CyclingGIF = ({ currentIndex }) => {
  const [fadeClass, setFadeClass] = useState('opacity-100');
  const [currentGif, setCurrentGif] = useState(0);
  
  const gifs = [
    {
      src: "/bedroom-timelapse.gif",
      alt: "AI-Generated Modern Bedroom Design Timelapse"
    },
    {
      src: "/livingroom-timelapse.gif", 
      alt: "AI-Generated Cozy Living Room Design Timelapse"
    },
    {
      src: "/kitchen-timelapse.gif",
      alt: "AI-Generated Open Plan Kitchen Design Timelapse"
    }
  ];
  
  useEffect(() => {
    if (currentIndex !== currentGif) {
      // Fade out
      setFadeClass('opacity-0');
      
      // Change GIF after fade completes
      const timeout = setTimeout(() => {
        setCurrentGif(currentIndex);
        setFadeClass('opacity-100');
      }, 300);
      
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, currentGif]);
  
  return (
    <div className="relative flex items-center justify-center lg:w-3/5 lg:flex-grow">
      <img 
        src={gifs[currentGif].src}
        alt={gifs[currentGif].alt}
        className={`w-full h-auto min-w-0 transition-opacity duration-300 ${fadeClass}`}
        loading="eager"
      />
      
      {/* Floating Elements */}
      <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-studiosix-400/20 to-purple-500/20 rounded-full blur-2xl animate-pulse"></div>
      <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-studiosix-400/20 to-indigo-500/20 rounded-full blur-2xl animate-pulse delay-1000"></div>
    </div>
  );
};

// Header Component
const LandingHeader = ({ onEmailCapture }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-slate-900/95 backdrop-blur-md border-b border-gray-800/50' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <img 
              src="/studiosix-icon.svg" 
              alt="StudioSix Icon" 
              className="w-8 h-8"
            />
            <span className="text-xl font-bold text-white">
              Studio<span className="text-studiosix-400">Six</span> Pro
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">
              Features
            </a>
            <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors">
              Testimonials
            </a>
            <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">
              Pricing
            </a>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => window.location.href = '/app'}
              className="text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={() => onEmailCapture('I want to try StudioSix Pro for free')}
              className="bg-studiosix-500 hover:bg-studiosix-600 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Try for Free
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

// Hero Section Component
const HeroSection = ({ onEmailCapture }) => {
  const [email, setEmail] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [currentGifIndex, setCurrentGifIndex] = useState(0);

  // Updated to match our 3 GIFs in the specific order: bedroom -> living room -> kitchen
  const heroSuggestions = [
    "a modern bedroom design",
    "a cozy living room", 
    "an open plan kitchen"
  ];
  
  const handleSuggestionChange = (index) => {
    setCurrentGifIndex(index);
  };

  const handlePromptSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      // Trigger email capture modal or redirect to sign up
      onEmailCapture(inputValue.trim());
    }
  };

  return (
    <section className="relative pt-20 pb-12 min-h-[650px] md:min-h-[750px] lg:min-h-[800px]">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-studiosix-950"></div>
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-studiosix-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          
          {/* Left Side - Content */}
          <div className="text-center lg:text-left lg:w-1/2">
            <TypewriterPrompt 
              suggestions={heroSuggestions}
              className="leading-tight"
              onSuggestionChange={handleSuggestionChange}
            />
            
            <p className="text-xl text-gray-300 mb-12 max-w-xl mx-auto lg:mx-0 mt-16">
              Transform your architectural ideas into reality with AI-powered design tools. 
              Create stunning interiors, floor plans, and 3D models in minutes.
            </p>

            {/* Interactive Prompt Box */}
            <div className="mb-8">
              <form onSubmit={handlePromptSubmit} className="relative max-w-2xl mx-auto lg:mx-0">
                <div className="relative group">
                  <div className="relative bg-white/95 backdrop-blur-sm border-2 border-transparent rounded-2xl p-4 transition-all duration-300 group-focus-within:border-blue-400/60 group-focus-within:bg-white group-focus-within:shadow-2xl group-focus-within:shadow-blue-500/20" style={{
                    background: 'linear-gradient(white, white) padding-box, linear-gradient(45deg, #3b82f6, #f97316, #06b6d4) border-box'
                  }}>
                    
                    <div className="absolute left-5 top-1/2 transform -translate-y-1/2 z-10">
                      <SparklesIcon className="w-5 h-5 text-blue-500" />
                    </div>
                    
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Try typing your design idea..."
                      className="w-full bg-transparent text-gray-800 text-lg pl-10 pr-24 py-3 outline-none placeholder-gray-500"
                    />
                    
                    <button
                      type="submit"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600 text-white flex items-center justify-center transition-all duration-200 text-sm font-medium"
                    >
                      Generate
                    </button>
                  </div>
                  
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/30 to-orange-500/30 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10 blur-xl"></div>
                </div>
              </form>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button 
                onClick={() => onEmailCapture('I want early access to StudioSix Pro')}
                className="bg-studiosix-500 hover:bg-studiosix-600 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 hover:shadow-xl hover:shadow-studiosix-500/25 flex items-center justify-center space-x-2 group"
              >
                <UserPlusIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Get Early Access</span>
              </button>
              <button 
                onClick={() => window.open('https://calendly.com/visionatedigital/30min', '_blank')}
                className="bg-slate-800/50 hover:bg-slate-700/50 text-white px-8 py-4 rounded-xl font-semibold border border-gray-600/50 transition-all duration-200 flex items-center justify-center space-x-2 group"
              >
                <CalendarIcon className="w-5 h-5 group-hover:text-studiosix-400 transition-colors" />
                <span>Book Personal Demo</span>
              </button>
            </div>
          </div>

          {/* Right Side - Cycling GIFs */}
          <CyclingGIF currentIndex={currentGifIndex} />
        </div>
      </div>
    </section>
  );
};

// Features Section
const FeaturesSection = () => {
  const features = [
    {
      icon: <SparklesIcon className="w-8 h-8" />,
      title: "AI-Powered Design",
      description: "Generate stunning architectural designs with natural language prompts"
    },
    {
      icon: <ArrowUpIcon className="w-8 h-8" />,
      title: "Real-time Collaboration",
      description: "Work together with your team in real-time on the same project"
    },
    {
      icon: <CheckIcon className="w-8 h-8" />,
      title: "Professional Results",
      description: "Export high-quality renders, floor plans, and 3D models"
    },
    {
      icon: <StarIcon className="w-8 h-8" />,
      title: "Easy Integration",
      description: "Import existing CAD files and enhance them with AI assistance"
    }
  ];

  return (
    <section id="features" className="pt-16 pb-20 bg-gradient-to-br from-slate-800/50 to-slate-900/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-6">
            Powerful Features for Modern Architecture
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Everything you need to create professional architectural designs with the power of AI
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-studiosix-500/50 transition-all duration-300 group hover:transform hover:scale-105">
              <div className="w-12 h-12 bg-studiosix-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-studiosix-500/30 transition-colors">
                <div className="text-studiosix-400">
                  {feature.icon}
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Testimonials Section
const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Senior Architect",
      company: "Design Studio Pro",
      content: "StudioSix has revolutionized our design process. What used to take weeks now takes hours.",
      avatar: "SC"
    },
    {
      name: "Marcus Rodriguez",
      role: "Interior Designer",
      company: "Modern Spaces",
      content: "The AI understands design intent perfectly. It's like having a creative partner that never sleeps.",
      avatar: "MR"
    },
    {
      name: "Emma Thompson",
      role: "Project Manager",
      company: "Urban Planning Co",
      content: "Client presentations have never been more impressive. The quality is unmatched.",
      avatar: "ET"
    }
  ];

  return (
    <section id="testimonials" className="py-20 bg-gradient-to-br from-slate-900/80 to-studiosix-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-6">
            Trusted by Design Professionals
          </h2>
          <p className="text-xl text-gray-400">
            See what industry leaders are saying about StudioSix
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <div className="flex items-start space-x-4 mb-4">
                <div className="w-12 h-12 bg-studiosix-500 rounded-full flex items-center justify-center text-white font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <h4 className="text-white font-semibold">{testimonial.name}</h4>
                  <p className="text-gray-400 text-sm">{testimonial.role}</p>
                  <p className="text-studiosix-400 text-sm">{testimonial.company}</p>
                </div>
              </div>
              <p className="text-gray-300 italic">"{testimonial.content}"</p>
              <div className="flex text-yellow-400 mt-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="w-4 h-4" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Footer Section
const FooterSection = () => {
  return (
    <footer className="bg-slate-900 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <img 
                src="/studiosix-icon.svg" 
                alt="StudioSix Icon" 
                className="w-8 h-8"
              />
              <span className="text-xl font-bold text-white">
                Studio<span className="text-studiosix-400">Six</span> Pro
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              AI-powered CAD architecture platform for modern design professionals.
            </p>
          </div>

          <div>
            <h5 className="text-white font-semibold mb-4">Product</h5>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-white font-semibold mb-4">Company</h5>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-white font-semibold mb-4">Support</h5>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8">
          <p className="text-center text-gray-400 text-sm">
            © 2024 StudioSix Pro. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

// Email Capture Modal
const EmailCaptureModal = ({ isOpen, onClose, promptText }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Add email to early access list using existing Resend API
      const response = await fetch('/api/add-to-waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          promptText,
          source: 'landing_page'
        })
      });

      if (response.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          window.location.href = '/thank-you';
        }, 2000);
      } else {
        throw new Error('Failed to join waitlist');
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full border border-gray-700">
        {isSuccess ? (
          <div className="text-center">
            {/* StudioSix Logo for Success State */}
            <div className="flex items-center justify-center mb-4">
              <img 
                src="/studiosix-icon.svg" 
                alt="StudioSix Icon" 
                className="w-12 h-12 mr-3"
              />
              <span className="text-2xl font-bold text-white">
                Studio<span className="text-studiosix-400">Six</span> Pro
              </span>
            </div>
            
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Welcome to the Future!</h3>
            <p className="text-gray-400 mb-4">You're on the early access list. Redirecting...</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              {/* StudioSix Logo */}
              <div className="flex items-center justify-center mb-4">
                <img 
                  src="/studiosix-icon.svg" 
                  alt="StudioSix Icon" 
                  className="w-12 h-12 mr-3"
                />
                <span className="text-2xl font-bold text-white">
                  Studio<span className="text-studiosix-400">Six</span> Pro
                </span>
              </div>
              
              {/* Countdown Timer */}
              <CountdownTimer />
              
              <div className="mt-4 mb-4">
                <h3 className="text-xl font-bold text-white mb-2">Get Access 3 Days Earlier!</h3>
                <p className="text-gray-400 text-sm">Early access members get StudioSix Pro on August 29th, 2025</p>
              </div>
              
              {/* Early Access Benefits */}
              <div className="mt-4 mb-2 space-y-2">
                <div className="flex items-center space-x-3">
                  <CheckIcon className="w-4 h-4 text-studiosix-400 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">First access to new features and tools</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckIcon className="w-4 h-4 text-studiosix-400 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">Exclusive early access pricing</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckIcon className="w-4 h-4 text-studiosix-400 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">Launch notification for September 1st</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckIcon className="w-4 h-4 text-studiosix-400 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">Priority support and feedback channel</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg border border-gray-300 focus:border-studiosix-500 focus:ring-2 focus:ring-studiosix-500/20 outline-none transition-all placeholder:text-gray-500"
              />
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-slate-700 text-white px-4 py-3 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-studiosix-500 text-white px-4 py-3 rounded-lg hover:bg-studiosix-600 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Joining...' : 'Notify Me'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

// Main Landing Page Component
const LandingPage = () => {
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [capturedPrompt, setCapturedPrompt] = useState('');

  const handleEmailCapture = (promptText = '') => {
    setCapturedPrompt(promptText);
    setEmailModalOpen(true);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-studiosix-950 overflow-y-auto">
      <LandingHeader onEmailCapture={handleEmailCapture} />
      <HeroSection onEmailCapture={handleEmailCapture} />
      <FeaturesSection />
      <TestimonialsSection />
      <FooterSection />
      
      <EmailCaptureModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        promptText={capturedPrompt}
      />
    </div>
  );
};

export default LandingPage;