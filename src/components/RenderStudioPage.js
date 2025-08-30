import React, { useState, useRef } from 'react';
import {
  XMarkIcon,
  CameraIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PencilSquareIcon,
  ShareIcon,
  PaperClipIcon
} from '@heroicons/react/24/outline';
import aiRenderService from '../services/aiRenderService';
import aiSettingsService from '../services/AISettingsService';
import subscriptionService from '../services/SubscriptionService';

const RenderStudioPage = ({ onBack }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [compareSlider, setCompareSlider] = useState(50);
  const [baselineImageForCompare, setBaselineImageForCompare] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editSecondaryImage, setEditSecondaryImage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [renderError, setRenderError] = useState(null);
  const fileInputRef = useRef(null);
  // Settings
  const settings = aiSettingsService.getRenderSettings();
  const [quality, setQuality] = useState(settings.quality || 'standard');
  const [imageSize, setImageSize] = useState(settings.resolution || '1024x1024');

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!uploadedImage) return;
    // Enforce monthly render limit via subscription, but allow demo bypass and never hang UI
    let allowed = true;
    try {
      allowed = await subscriptionService.canPerformAction('image_render', { amount: 1 });
      console.log('[RenderStudio] canPerformAction(image_render) =>', allowed);
    } catch (err) { console.warn('[RenderStudio] canPerformAction error', err); allowed = true; }
    if (!allowed) {
      const isDemo = await (subscriptionService.isUnlimitedDemoUser?.() || Promise.resolve(false));
      console.log('[RenderStudio] demo bypass?', isDemo);
      if (!isDemo) {
        alert('Monthly render limit reached. Please upgrade to continue.');
        return;
      }
    }
    setIsGenerating(true);
    setGeneratedImage(null);
    setProgress(0);
    try {
      aiSettingsService.trackUsage('render');
      const current = aiSettingsService.getRenderSettings();
      // Beef up prompt
      const enhanced = `${prompt}\n\nPhotorealistic, realistic materials, soft daylight, balanced exposure, high fidelity architectural rendering. Target: ${imageSize}, quality: ${quality}.`;
      const result = await aiRenderService.generateWithGoogle({
        prompt: enhanced,
        imageDataUrl: uploadedImage,
        quality,
        imageSize,
        model: 'gemini-2.5-flash-image-preview'
      });
      console.log('[RenderStudio] generateWithGoogle result.ok?', result?.ok);
      if (result && result.ok && result.output_image) {
        setGeneratedImage(result.output_image);
        setBaselineImageForCompare(uploadedImage);
        setProgress(100);
        // Record usage
        await subscriptionService.recordUsage('image_render', { amount: 1, description: 'Render Studio generation' });
      } else {
        console.warn('[RenderStudio] Generation failed, payload:', result);
        throw new Error(result?.error?.title || 'Generation failed');
      }
    } catch (e) {
      console.error('Render failed:', e);
      setRenderError(e?.message || String(e));
    } finally {
      setIsGenerating(false);
    }
  };

  // Edit flow: use the last generated image as the new reference
  const handleApplyEdit = async () => {
    if (!generatedImage || !editPrompt.trim()) return;
    let allowed = true;
    try {
      allowed = await subscriptionService.canPerformAction('image_render', { amount: 1 });
      console.log('[RenderStudio] canPerformAction(edit image_render) =>', allowed);
    } catch (err) { console.warn('[RenderStudio] canPerformAction error (edit)', err); allowed = true; }
    if (!allowed) {
      const isDemo = await (subscriptionService.isUnlimitedDemoUser?.() || Promise.resolve(false));
      console.log('[RenderStudio] demo bypass? (edit)', isDemo);
      if (!isDemo) {
        alert('Monthly render limit reached. Please upgrade to continue.');
        return;
      }
    }
    setIsGenerating(true);
    setProgress(0);
    setRenderError(null);
    try {
      const current = aiSettingsService.getRenderSettings();
      const enhanced = `Edit the image with the following targeted change: ${editPrompt}. Keep all other aspects unchanged. Preserve layout, composition, camera, lighting and materials except the requested change. Target: ${imageSize}, quality: ${quality}.`;
      const result = await aiRenderService.generateWithGoogle({
        prompt: enhanced,
        imageDataUrl: generatedImage, // use last output as new input
        secondaryImageDataUrl: editSecondaryImage || undefined,
        quality,
        imageSize,
        model: 'gemini-2.5-flash-image-preview'
      });
      console.log('[RenderStudio] edit result.ok?', result?.ok);
      if (result && result.ok && result.output_image) {
        // Baseline becomes previous output for comparison
        setBaselineImageForCompare(generatedImage);
        setGeneratedImage(result.output_image);
        setCompareSlider(50);
        setIsEditing(false);
        setProgress(100);
        await subscriptionService.recordUsage('image_render', { amount: 1, description: 'Render Studio edit' });
      } else {
        console.warn('[RenderStudio] Edit failed, payload:', result);
        throw new Error(result?.error?.title || 'Edit failed');
      }
    } catch (e) {
      console.error('❌ Edit failed:', e);
      setRenderError(e.message || 'Edit failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const src = generatedImage || uploadedImage;
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = `studio-six-render-${Date.now()}.png`;
    link.click();
  };

  const handleShare = async () => {
    try {
      if (!generatedImage) return;
      const res = await fetch(generatedImage);
      const blob = await res.blob();
      const file = new File([blob], 'render.png', { type: blob.type || 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'StudioSix Render', text: 'Generated by StudioSix Pro' });
      } else {
        // Fallback: open in new tab
        window.open(generatedImage, '_blank');
      }
    } catch (e) {
      console.warn('Share failed, opening in new tab', e);
      if (generatedImage) window.open(generatedImage, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-studiosix-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800/60 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
            <img src="/studiosix-icon.svg" alt="StudioSix Icon" className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">AI Render Studio</h2>
            <p className="text-sm text-gray-400">Generate images with AI from a reference</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <RenderUsageBadge />
          <button onClick={onBack} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all duration-200">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="h-[calc(100%-64px)] flex">
        {/* Left controls */}
        <div className="w-96 border-r border-gray-800/60 p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">Reference Image</label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <button onClick={handleUploadClick} className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-studiosix-600 hover:bg-studiosix-700 text-white rounded-lg transition-colors">
                <ArrowUpTrayIcon className="w-5 h-5" />
                <span>Upload Image</span>
              </button>
              <p className="text-xs text-gray-500 mt-2">PNG or JPG up to 10MB</p>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">AI Prompt</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} placeholder="Describe the scene, style, lighting..."
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/60 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-studiosix-500 focus:border-transparent" />
            </div>

            {/* Settings: Quality & Image Size */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Output Quality</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/60 rounded-lg text-white focus:ring-2 focus:ring-studiosix-500 focus:border-transparent"
                >
                  <option value="draft">Draft</option>
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="ultra">Ultra</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Image Size</label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/60 rounded-lg text-white focus:ring-2 focus:ring-studiosix-500 focus:border-transparent"
                >
                  <option value="1024x1024">1024 x 1024 (Square)</option>
                  <option value="1280x720">1280 x 720 (HD)</option>
                  <option value="1920x1080">1920 x 1080 (Full HD)</option>
                  <option value="2048x1152">2048 x 1152</option>
                </select>
              </div>
            </div>

            {/* Generate */}
            <button onClick={handleGenerate} disabled={!uploadedImage || !prompt.trim() || isGenerating}
              className={`w-full px-6 py-4 rounded-lg font-semibold transition-all duration-200 ${(!uploadedImage || !prompt.trim() || isGenerating) ? 'bg-gray-700/60 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-studiosix-500 to-studiosix-600 hover:from-studiosix-600 hover:to-studiosix-700 text-white shadow-lg hover:shadow-xl'}`}>
              {isGenerating ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Generating...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <SparklesIcon className="w-5 h-5" />
                  <span>Generate</span>
                </div>
              )}
            </button>

            {/* Progress */}
            {isGenerating && (
              <div className="mt-2">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-studiosix-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}% Complete</p>
              </div>
            )}
          </div>
        </div>

        {/* Right preview */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="h-full bg-gray-900/40 border border-gray-800/60 rounded-xl flex items-center justify-center relative">
            {!uploadedImage && !generatedImage && (
              <div className="text-center text-gray-400">
                <CameraIcon className="w-16 h-16 mx-auto mb-4 opacity-60" />
                <p className="text-lg">Upload a reference to begin</p>
              </div>
            )}
            {(generatedImage || uploadedImage) && (
              <div className="w-full h-full p-4 flex items-center justify-center">
                <div className="relative w-full h-full max-w-full max-h-full">
                  {/* Generating overlay */}
                  {isGenerating && (
                    <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center">
                      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3"></div>
                      <div className="text-white text-sm">Generating image...</div>
                      <div className="w-1/2 bg-white/20 rounded-full h-1 mt-3">
                        <div className="bg-white/80 h-1 rounded-full transition-all" style={{ width: `${Math.max(5, Math.min(95, progress))}%` }}></div>
                      </div>
                    </div>
                  )}
                  {/* Action buttons (show only when a generated image exists) */}
                  {generatedImage && (
                    <div className="absolute top-3 right-3 z-20 flex items-center space-x-2">
                      <button onClick={handleDownload} className="px-3 py-2 bg-gray-800/70 hover:bg-gray-700/80 text-white rounded-lg text-sm flex items-center space-x-1">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        <span>Download</span>
                      </button>
                      <button onClick={() => setIsEditing((v) => !v)} className="px-3 py-2 bg-gray-800/70 hover:bg-gray-700/80 text-white rounded-lg text-sm flex items-center space-x-1">
                        <PencilSquareIcon className="w-4 h-4" />
                        <span>{isEditing ? 'Cancel Edit' : 'Edit Image'}</span>
                      </button>
                      <button onClick={handleShare} className="px-3 py-2 bg-gray-800/70 hover:bg-gray-700/80 text-white rounded-lg text-sm flex items-center space-x-1">
                        <ShareIcon className="w-4 h-4" />
                        <span>Share</span>
                      </button>
                    </div>
                  )}

                  {generatedImage && (baselineImageForCompare || uploadedImage) ? (
                    <>
                      <img src={baselineImageForCompare || uploadedImage} alt="Before" className="absolute inset-0 w-full h-full object-contain rounded-lg" />
                      <div className="absolute inset-0 overflow-hidden rounded-lg" style={{ clipPath: `inset(0 ${100 - compareSlider}% 0 0)` }}>
                        <img src={generatedImage} alt="After" className="w-full h-full object-contain" />
                      </div>
                    </>
                  ) : (
                    <img src={uploadedImage} alt="Preview" className="absolute inset-0 w-full h-full object-contain rounded-lg" />
                  )}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={compareSlider}
                    onChange={(e) => setCompareSlider(Number(e.target.value))}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 w-2/3"
                  />

                  {/* Edit panel */}
                  {isEditing && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 border border-gray-700/70 rounded-xl p-4 w-[640px] max-w-[90vw] backdrop-blur">
                      <label className="block text-xs text-gray-300 mb-2">Describe the change (e.g., "change flooring to marble")</label>
                      <div className="flex space-x-3 items-center">
                        <div className="relative flex-1">
                          <input
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            placeholder="Make targeted edit..."
                            className="w-full pr-10 px-3 py-2 bg-gray-800/70 border border-gray-700/70 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-studiosix-500"
                          />
                          <input
                            id="edit-attach"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const reader = new FileReader();
                              reader.onload = () => setEditSecondaryImage(reader.result);
                              reader.readAsDataURL(f);
                              e.target.value = '';
                            }}
                          />
                          <label htmlFor="edit-attach" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white cursor-pointer">
                            <PaperClipIcon className="w-5 h-5" />
                          </label>
                        </div>
                        <button
                          onClick={handleApplyEdit}
                          disabled={!editPrompt.trim() || isGenerating}
                          className={`px-4 py-2 rounded-md text-sm font-medium ${(!editPrompt.trim() || isGenerating) ? 'bg-gray-700/60 text-gray-400 cursor-not-allowed' : 'bg-studiosix-600 hover:bg-studiosix-700 text-white'}`}
                        >
                          Apply
                        </button>
                      </div>
                      {editSecondaryImage && (
                        <div className="mt-2 text-xs text-green-300">Image attached</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const RenderUsageBadge = () => {
  const [usage, setUsage] = React.useState({ used: 0, limit: 0, remaining: 0 });
  React.useEffect(() => {
    (async () => {
      try {
        const tier = await subscriptionService.getCurrentTier();
        const sub = await subscriptionService.getSubscription();
        const limit = tier?.limits?.imageRendersPerMonth ?? 0;
        const used = sub?.usage?.imageRendersThisMonth ?? 0;
        setUsage({ used, limit, remaining: limit === -1 ? -1 : Math.max(0, limit - used) });
      } catch {}
    })();
  }, []);
  const pct = usage.limit === -1 ? 0 : Math.min(100, (usage.used / (usage.limit || 1)) * 100);
  return (
    <div className="flex items-center space-x-3">
      <div className="text-sm text-gray-300">
        Renders: <span className="text-white font-semibold">{usage.used}</span> / {usage.limit === -1 ? '∞' : usage.limit}
      </div>
      <div className="w-28 h-2 bg-gray-700/60 rounded-full overflow-hidden">
        <div className={`h-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-studiosix-500'}`} style={{ width: usage.limit === -1 ? '100%' : `${pct}%` }} />
      </div>
      <a href="/pricing" className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs rounded-md shadow flex items-center space-x-1">
        <span>Upgrade</span>
        <span role="img" aria-label="celebrate">🎉</span>
      </a>
    </div>
  );
};

export default RenderStudioPage;


