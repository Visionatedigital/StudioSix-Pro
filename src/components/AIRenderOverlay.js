import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  XMarkIcon,
  CameraIcon,
  SparklesIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import aiRenderService from '../services/aiRenderService';
import aiSettingsService from '../services/AISettingsService';

const AIRenderOverlay = ({ isOpen, onClose, viewportRef, viewMode, capturedImage, onRecapture, onRenderingStateChange, onRenderingActiveChange, onProgressUpdate, onRenderComplete }) => {
  const renderSettings = aiSettingsService.getRenderSettings();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState(renderSettings.resolution === '1024x1024' ? '1:1' : '16:9');
  const [quality, setQuality] = useState(renderSettings.quality);
  const [style, setStyle] = useState(renderSettings.preset);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewportImage, setViewportImage] = useState(null);
  
  // AI Rendering states
  const [renderJobId, setRenderJobId] = useState(null);
  const [renderStatus, setRenderStatus] = useState(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderError, setRenderError] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [showComparison, setShowComparison] = useState(false);


  // Aspect ratio options
  const aspectRatios = [
    { label: '16:9', value: '16:9' },
    { label: '4:3', value: '4:3' },
    { label: '1:1', value: '1:1' },
    { label: '3:4', value: '3:4' },
    { label: '9:16', value: '9:16' }
  ];

  // Quality options
  const qualityOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Standard', value: 'standard' },
    { label: 'High', value: 'high' },
    { label: 'Ultra', value: 'ultra' }
  ];

  // Style options
  const styleOptions = [
    { label: 'Photorealistic', value: 'photorealistic' },
    { label: 'Architectural', value: 'architectural' },
    { label: 'Concept Art', value: 'concept' },
    { label: 'Technical', value: 'technical' }
  ];



  // Set captured image when overlay opens or when capturedImage changes
  useEffect(() => {
    if (capturedImage) {
      console.log('🖼️ AIRenderOverlay: Setting captured image, length:', capturedImage.length);
      setViewportImage(capturedImage);
    }
  }, [isOpen, capturedImage]);

  // Handle generate button
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt for the AI rendering');
      return;
    }

    const imageToRender = viewportImage || capturedImage;
    if (!imageToRender) {
      alert('No viewport image available. Please recapture the view.');
      return;
    }

    setIsGenerating(true);
    if (onRenderingStateChange) onRenderingStateChange(true);
    if (onRenderingActiveChange) onRenderingActiveChange(true);
    setRenderError(null);
    setRenderProgress(0);
    setGeneratedImage(null);
    setShowComparison(false);
    
    try {
      // Check usage limits before making request
      try {
        aiSettingsService.trackUsage('render');
      } catch (usageError) {
        alert(`Usage limit exceeded: ${usageError.message}`);
        setIsGenerating(false);
        if (onRenderingStateChange) onRenderingStateChange(false);
        if (onRenderingActiveChange) onRenderingActiveChange(false);
        return;
      }

      // Get current render settings
      const currentSettings = aiSettingsService.getRenderSettings();
      
      console.log('🎨 Starting AI rendering...', {
        prompt,
        provider: currentSettings.provider,
        model: currentSettings.model,
        quality: currentSettings.quality,
        resolution: currentSettings.resolution,
        imageLength: imageToRender.length
      });

      // Start the rendering process with current settings
      const result = await aiRenderService.renderImage(prompt, imageToRender, {
        aspectRatio: currentSettings.resolution.includes('x') ? 
          currentSettings.resolution.replace('x', ':') : aspectRatio,
        quality: currentSettings.quality,
        style: currentSettings.preset,
        steps: currentSettings.steps,
        guidance: currentSettings.guidance,
        maxAttempts: 120, // 10 minutes at 5-second intervals
        pollInterval: 5000,
        onProgress: (status, attempt) => {
          console.log(`📊 Render progress: ${status.status} (attempt ${attempt + 1})`);
          const progress = Math.min(95, (attempt / 120) * 100);
          setRenderStatus(status.status);
          setRenderProgress(progress);
          
          // Update parent component
          if (onProgressUpdate) {
            onProgressUpdate(progress);
          }
          
          if (status.message) {
            console.log(`💬 Status: ${status.message}`);
          }
        }
      });

      if (result.status === 'completed' && result.output_image) {
        console.log('✅ AI rendering completed successfully!');
        console.log('🖼️ Generated image data length:', result.output_image?.length || 0);
        console.log('🖼️ Image starts with:', result.output_image?.substring(0, 50) || 'N/A');
        setGeneratedImage(result.output_image);
        setShowComparison(true);
        setRenderProgress(100);
        setRenderStatus('completed');
        
        // Notify parent of completion
        if (onProgressUpdate) {
          onProgressUpdate(100);
        }
        if (onRenderComplete) {
          onRenderComplete(result.output_image);
        }
        
      } else if (result.status === 'login_required') {
        setRenderError('ChatGPT login required. Please check the backend logs and complete the login process.');
        
      } else {
        throw new Error(result.message || 'Rendering failed');
      }

    } catch (error) {
      console.error('❌ AI rendering failed:', error);
      setRenderError(error.message || 'Rendering failed. Please try again.');
      setRenderStatus('failed');
      
    } finally {
      setIsGenerating(false);
      if (onRenderingStateChange) onRenderingStateChange(false);
      if (onRenderingActiveChange) onRenderingActiveChange(false);
    }
  }, [prompt, aspectRatio, quality, style, viewportImage, capturedImage]);

  // Handle escape key to close overlay
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Close if clicking on the backdrop (not the modal content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-[90vw] h-[90vh] max-w-7xl bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
              <img
                src="./studiosix-icon.svg"
                alt="StudioSix Icon"
                className="w-6 h-6"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI Render Studio</h2>
              <p className="text-sm text-gray-400">Transform your {viewMode.toUpperCase()} viewport with AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all duration-200"
            title="Close AI Render Studio"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex h-[calc(100%-5rem)]">
          {/* Left Panel - Controls */}
          <div className="w-80 flex-shrink-0 p-6 border-r border-gray-700/50 bg-gray-800/30 overflow-y-auto max-h-full">
            <div className="space-y-6">
              {/* Viewport Capture */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  <CameraIcon className="w-4 h-4 inline mr-2" />
                  Viewport Source
                </label>
                                 <div className="flex items-center space-x-2">
                   <button
                     onClick={() => {
                       onClose();
                       if (onRecapture) {
                         onRecapture();
                       }
                     }}
                     className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
                   >
                     Recapture View
                   </button>
                  <span className="text-xs text-gray-400 px-2 py-1 bg-gray-700/50 rounded">
                    {viewMode.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  AI Prompt
                </label>
                                 <textarea
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   placeholder="Describe how you want to transform this architectural view..."
                   rows={4}
                   className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                 />
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {aspectRatios.map((ratio) => (
                                         <button
                       key={ratio.value}
                       onClick={() => setAspectRatio(ratio.value)}
                       className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                         aspectRatio === ratio.value
                           ? 'bg-purple-600 text-white shadow-lg'
                           : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                       }`}
                     >
                       {ratio.label}
                     </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Quality
                </label>
                                 <select
                   value={quality}
                   onChange={(e) => setQuality(e.target.value)}
                   className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                 >
                  {qualityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Style */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Rendering Style
                </label>
                                 <select
                   value={style}
                   onChange={(e) => setStyle(e.target.value)}
                   className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                 >
                  {styleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                                 className={`w-full px-6 py-4 rounded-lg font-semibold transition-all duration-200 ${
                   !prompt.trim() || isGenerating
                     ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                     : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                 }`}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Generating...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <SparklesIcon className="w-5 h-5" />
                    <span>Generate AI Render</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel - Viewport Preview */}
          <div className="flex-1 p-6 bg-gray-900/20 max-h-full">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold text-white">Viewport Preview</h3>
                {(viewportImage || capturedImage || generatedImage) && (
                  <div className="flex items-center space-x-2">
                    {/* Download Original */}
                    {(viewportImage || capturedImage) && (
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.download = `viewport-original-${viewMode}-${Date.now()}.png`;
                          link.href = viewportImage || capturedImage;
                          link.click();
                        }}
                        className="flex items-center space-x-2 px-3 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-lg transition-colors duration-200"
                        title="Download original image"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        <span className="text-sm">{showComparison ? 'Original' : 'Download'}</span>
                      </button>
                    )}
                    
                    {/* Download Generated */}
                    {generatedImage && showComparison && (
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.download = `ai-render-${Date.now()}.png`;
                          link.href = generatedImage;
                          link.click();
                        }}
                        className="flex items-center space-x-2 px-3 py-2 bg-green-700/50 hover:bg-green-600/50 text-green-300 rounded-lg transition-colors duration-200"
                        title="Download AI generated image"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        <span className="text-sm">AI Render</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden relative">
                {/* Rendering Progress Overlay */}
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                    {/* Close button on overlay */}
                    <button
                      onClick={onClose}
                      className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all duration-200 z-20"
                      title="Close and continue rendering in background"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                    
                    <div className="text-center text-white max-w-sm">
                      <div className="w-16 h-16 mx-auto mb-4 relative">
                        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                        <SparklesIcon className="w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">StudioSix is rendering your image</h3>
                      <p className="text-sm text-gray-300 mb-4">
                        You can close this window in the meantime
                      </p>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${renderProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-400">{Math.round(renderProgress)}% Complete</p>
                    </div>
                  </div>
                )}
                
                {/* Error Display */}
                {renderError && (
                  <div className="absolute inset-0 bg-red-900/20 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                    <div className="text-center text-white max-w-sm p-6">
                      <ExclamationCircleIcon className="w-16 h-16 mx-auto mb-4 text-red-400" />
                      <h3 className="text-lg font-semibold mb-2">Rendering Failed</h3>
                      <p className="text-sm text-gray-300 mb-4">{renderError}</p>
                      <button
                        onClick={() => {
                          setRenderError(null);
                          setRenderStatus(null);
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                <div className="w-full h-full flex items-center justify-center relative">
                  {generatedImage ? (
                    /* Show Generated Image Only */
                    <div className="w-full h-full flex items-center justify-center p-4">
                      <div className="relative">
                        <div className="text-center mb-2">
                          <span className="text-sm font-medium text-green-300 bg-green-700/50 px-2 py-1 rounded flex items-center justify-center">
                            <CheckCircleIcon className="w-4 h-4 mr-1" />
                            AI Generated Render
                          </span>
                        </div>
                        <img
                          src={generatedImage}
                          alt="AI generated rendering"
                          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                          onLoad={() => {
                            console.log('🖼️ Generated image loaded successfully');
                          }}
                          onError={(e) => {
                            console.error('❌ Generated image failed to load:', e);
                            console.error('❌ Image src length:', generatedImage?.length || 0);
                          }}
                        />
                      </div>
                    </div>
                  ) : (viewportImage || capturedImage) ? (
                    /* Single Image View */
                    <div className="w-full h-full flex items-center justify-center p-4">
                      <img
                        src={viewportImage || capturedImage}
                        alt="Viewport capture"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        onLoad={(e) => {
                          console.log('🖼️ AIRenderOverlay: Image loaded successfully');
                          console.log('🖼️ AIRenderOverlay: Image dimensions:', e.target.naturalWidth, 'x', e.target.naturalHeight);
                        }}
                        onError={(e) => {
                          console.error('❌ AIRenderOverlay: Image failed to load:', e);
                        }}
                      />
                    </div>
                  ) : (
                    /* No Image State */
                    <div className="text-center text-gray-400">
                      <CameraIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No viewport capture</p>
                      <p className="text-sm">Click "Recapture View" to capture the current viewport</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIRenderOverlay; 