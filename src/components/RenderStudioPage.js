import React, { useState, useRef } from 'react';
import {
  XMarkIcon,
  CameraIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  PencilSquareIcon,
  ShareIcon,
  PaperClipIcon,
  PhoneIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import aiRenderService from '../services/aiRenderService';
import aiSettingsService from '../services/AISettingsService';
import subscriptionService from '../services/SubscriptionService';
import paystackService from '../services/PaystackService';
import PayPalService from '../services/PayPalService';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

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
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(10);
  const [topUpTab, setTopUpTab] = useState('packages'); // 'custom' | 'packages'
  const [fx, setFx] = useState({ code: 'USD', rate: 1, symbol: '$', locale: (typeof navigator !== 'undefined' ? navigator.language : 'en-US') });
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'mtn'
  const [isPaying, setIsPaying] = useState(false); // guard against double clicks & show overlay
  const [mtnNumber, setMtnNumber] = useState('');
  const [mmPolling, setMmPolling] = useState(false);
  const [mmStatus, setMmStatus] = useState('');
  const [mmPaymentId, setMmPaymentId] = useState(null);
  const [mmUiState, setMmUiState] = useState('idle'); // 'idle' | 'awaiting' | 'success' | 'failed'
  const fileInputRef = useRef(null);
  React.useEffect(() => {
    const open = () => setShowTopUp(true);
    window.addEventListener('open-token-topup', open);
    return () => window.removeEventListener('open-token-topup', open);
  }, []);

  const snaps = [5, 10, 20, 50, 100];
  const amountToRenders = (amt) => {
    if (amt >= 100) return 160; // extrapolate with best tier rate (~$0.625)
    if (amt >= 50) return 80;   // ~$0.625 each
    if (amt >= 20) return 30;   // ~$0.67 each
    if (amt >= 10) return 12;   // ~$0.83 each
    return 5;                   // $5 → 5 renders
  };

  // Detect local currency and fetch exchange rates (USD base)
  React.useEffect(() => {
    const detectCurrency = () => {
      try {
        const loc = (typeof navigator !== 'undefined' ? (navigator.language || (navigator.languages && navigator.languages[0])) : 'en-US') || 'en-US';
        const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })();
        const upper = String(loc).toUpperCase();
        let code = 'USD';
        // Prefer country from time zone if available
        if (/KAMPALA/i.test(tz)) code = 'UGX';
        else if (/NAIROBI/i.test(tz)) code = 'KES';
        else if (/LAGOS|WEST\s+CENTRAL\s+AFRICA|AFRICA\/LAGOS/i.test(tz)) code = 'NGN';
        else if (/JOHANNESBURG|AFRICA\/JOHANNESBURG/i.test(tz)) code = 'ZAR';
        // Fallback to language region
        else if (/-UG/.test(upper)) code = 'UGX';
        else if (/-KE/.test(upper)) code = 'KES';
        else if (/-NG/.test(upper)) code = 'NGN';
        else if (/-ZA/.test(upper)) code = 'ZAR';
        else if (/-GB/.test(upper)) code = 'GBP';
        else if (/-EU/.test(upper)) code = 'EUR';
        else if (/-FR|\-DE|\-ES|\-IT|\-NL|\-PT|\-IE/.test(upper)) code = 'EUR';
        else if (/-CA/.test(upper)) code = 'CAD';
        else if (/-AU/.test(upper)) code = 'AUD';
        else if (/-IN/.test(upper)) code = 'INR';
        const symbol = new Intl.NumberFormat(loc, { style: 'currency', currency: code }).formatToParts(1).find(p => p.type === 'currency')?.value || '';
        return { code, symbol, locale: loc };
      } catch {
        return { code: 'USD', symbol: '$', locale: 'en-US' };
      }
    };

    const { code, symbol, locale } = detectCurrency();
    const fallbackRates = { USD: 1, EUR: 0.92, GBP: 0.78, ZAR: 18.2, NGN: 1500, KES: 129, UGX: 3780, CAD: 1.36, AUD: 1.5, INR: 83.2 };
    const applyRate = (rates) => setFx({ 
      code, symbol, locale,
      rate: (rates && rates[code]) || fallbackRates[code] || 1,
      usdToZar: (rates && rates.ZAR) || fallbackRates.ZAR || 18
    });
    // Fetch live rates (best effort)
    fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()).then(j => {
      applyRate(j?.rates || null);
    }).catch(() => applyRate(null));
  }, []);

  const formatLocal = (amountUSD) => {
    try {
      const v = amountUSD * (fx.rate || 1);
      return new Intl.NumberFormat(fx.locale, { style: 'currency', currency: fx.code, maximumFractionDigits: 0 }).format(v);
    } catch {
      return `${fx.symbol}${Math.round(amountUSD * (fx.rate || 1))}`;
    }
  };

  const handleStartTopUp = async () => {
    if (isPaying) return; // prevent duplicate windows
    try {
      setIsPaying(true);
      // Determine method
      if (paymentMethod === 'mtn') {
        // Accept local 0XXXXXXXXX (10 digits) and normalize to local format for test API
        const localOk = /^0\d{9}$/.test(String(mtnNumber));
        if (!localOk) {
          alert('Enter a valid MTN number in local format (e.g., 0772123456)');
          return;
        }
        const ugxMap = { 5: 18500, 10: 37000, 20: 74000, 50: 185000, 100: 370000 };
        const amountUGX = ugxMap[topUpAmount] || 37000;
        const r = await fetch(`${API_BASE}/api/mobilemoney/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact: mtnNumber, amount: amountUGX, message: `StudioSix ${amountToRenders(topUpAmount)} renders` })
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || 'Mobile money init failed');
        const pid = j.data?.payment_id;
        setMmPaymentId(pid);
        setMmStatus(j.data?.status || 'pending');
        setMmPolling(true);
        setMmUiState('awaiting');
        // Poll for up to 2 minutes
        const started = Date.now();
        const poll = async () => {
          if (!pid) return;
          try {
            const pr = await fetch(`${API_BASE}/api/mobilemoney/status/${encodeURIComponent(pid)}`);
            const pj = await pr.json();
            if (pj?.ok) {
              const st = pj.data?.status || 'pending';
              setMmStatus(st);
              if (st === 'success' || st === 'successful' || st === 'failed') {
                setMmPolling(false);
                if (st === 'success' || st === 'successful') {
                  try {
                    await fetch(`${API_BASE}/api/mobilemoney/credit-after-poll`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': subscriptionService.currentUserId || ''
                      },
                      body: JSON.stringify({ paymentId: pid })
                    });
                  } catch {}
                  setMmUiState('success');
                }
                else setMmUiState('failed');
                return;
              }
            }
            // Also check if our server has seen the callback already
            try {
              const cr = await fetch(`${API_BASE}/api/mobilemoney/callback-status/${encodeURIComponent(pid)}`);
              const cj = await cr.json();
              if (cj?.ok && (cj.status === 'successful' || cj.status === 'failed')) {
                setMmPolling(false);
                if (cj.status === 'successful') {
                  try {
                    await fetch(`${API_BASE}/api/mobilemoney/credit-after-poll`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': subscriptionService.currentUserId || ''
                      },
                      body: JSON.stringify({ paymentId: pid })
                    });
                  } catch {}
                  setMmUiState('success');
                } else {
                  setMmUiState('failed');
                }
                return;
              }
            } catch {}
          } catch {}
          if (Date.now() - started < 120000) setTimeout(poll, 5000); else setMmPolling(false);
        };
        setTimeout(poll, 5000);
      } else {
        // PayPal card checkout (USD)
        let email = 'user@example.com';
        try {
          const profile = await (subscriptionService.getDatabaseProfile ? subscriptionService.getDatabaseProfile() : Promise.resolve(null));
          email = profile?.email || email;
        } catch {}
        const clientId = process.env.REACT_APP_PAYPAL_CLIENT_ID || '';
        try {
          await PayPalService.loadSdk(clientId);
        } catch (e) {
          console.error('[PayPal] SDK load error', e);
          alert('PayPal is temporarily unavailable. Please try again shortly.');
          return;
        }
        const orderId = await PayPalService.createOrder(topUpAmount, amountToRenders(topUpAmount), subscriptionService.currentUserId || '', email);
        // Use PayPal popup flow if available
        if (window.paypal && window.paypal.Buttons) {
          await new Promise((resolve, reject) => {
            // Clean any previous overlay/container
            try { const prev = document.getElementById('studiosix-payment-overlay'); if (prev) prev.remove(); } catch {}
            try { const prevBtn = document.getElementById('paypal-buttons-container'); if (prevBtn) prevBtn.remove(); } catch {}
            // Create full-screen overlay
            const overlay = document.createElement('div');
            overlay.id = 'studiosix-payment-overlay';
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.zIndex = '9999';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.background = 'rgba(2,6,23,0.75)'; // slate-950/75
            overlay.style.backdropFilter = 'blur(6px)';
            // Inner panel
            const panel = document.createElement('div');
            panel.style.background = 'linear-gradient(180deg, rgba(30,41,59,.95), rgba(15,23,42,.95))';
            panel.style.border = '1px solid rgba(148,163,184,.25)';
            panel.style.borderRadius = '16px';
            panel.style.boxShadow = '0 20px 60px rgba(0,0,0,.5)';
            panel.style.padding = '20px';
            panel.style.width = 'min(520px, 92vw)';
            // Title
            const title = document.createElement('div');
            title.style.color = '#fff';
            title.style.fontWeight = '600';
            title.style.marginBottom = '10px';
            title.innerText = 'Debit or Credit Card — Secure Checkout';
            panel.appendChild(title);
            // Container for PayPal Buttons/Hosted Fields
            const container = document.createElement('div');
            container.id = 'paypal-buttons-container';
            panel.appendChild(container);
            // Helper text
            const note = document.createElement('div');
            note.style.marginTop = '12px';
            note.style.fontSize = '12px';
            note.style.color = 'rgba(226,232,240,.8)';
            note.innerText = 'Powered by PayPal. No PayPal account required.';
            panel.appendChild(note);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            const cleanup = () => { try { const el = document.getElementById('studiosix-payment-overlay'); if (el) el.remove(); } catch {} };

            const buttons = window.paypal.Buttons({
              createOrder: () => orderId,
              onApprove: async () => {
                try { await PayPalService.captureOrder(orderId); cleanup(); resolve(); } catch (e) { cleanup(); reject(e); }
              },
              onCancel: () => { cleanup(); reject(new Error('cancelled')); },
              onError: (err) => { cleanup(); reject(err); }
            });
            try { buttons.render('#paypal-buttons-container'); } catch (e) { cleanup(); reject(e); }
          });
        } else {
          // Fallback: try immediate capture (server-created order with redirect links)
          await PayPalService.captureOrder(orderId);
        }
        // Success
        await subscriptionService.recordUsage('image_render', { amount: 0, description: `Top-up ${amountToRenders(topUpAmount)} renders purchased` });
        subscriptionService.addRenderCredits(amountToRenders(topUpAmount));
        alert(`Payment successful. You purchased ${amountToRenders(topUpAmount)} renders.`);
        setShowTopUp(false);
      }
    } catch (e) {
      console.error('Top-up failed:', e);
      alert('Payment failed. Please try again.');
    } finally {
      setIsPaying(false);
    }
  };
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
      const check = await subscriptionService.canPerformAction('image_render', { amount: 1 });
      allowed = (check === undefined) ? true : !!check;
      console.log('[RenderStudio] canPerformAction(image_render) =>', allowed, '(raw:', check, ')');
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
      {showTopUp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[560px] max-w-[92vw] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-gradient-to-r from-studiosix-700/40 to-studiosix-800/40">
              <div>
                <div className="text-white font-semibold">Buy Render Tokens</div>
                <div className="text-xs text-slate-300">Commitment‑free. Only pay for what you use.</div>
              </div>
              <button onClick={() => setShowTopUp(false)} className="text-slate-300 hover:text-white p-2 rounded-lg hover:bg-slate-700/50">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <RenderSaleBanner />
            <div className="p-6 space-y-5 pt-4">
              {/* Tabs */}
              <div className="inline-flex bg-slate-800/60 border border-slate-700 rounded-lg overflow-hidden">
                <button onClick={() => setTopUpTab('custom')} className={`px-4 py-2 text-sm ${topUpTab==='custom' ? 'bg-studiosix-600 text-white' : 'text-slate-300 hover:text-white'}`}>Custom</button>
                <button onClick={() => setTopUpTab('packages')} className={`px-4 py-2 text-sm ${topUpTab==='packages' ? 'bg-studiosix-600 text-white' : 'text-slate-300 hover:text-white'}`}>Packages</button>
              </div>

              {/* Custom Tab Content */}
              {topUpTab === 'custom' && (
                <>
                  <div>
                    <label className="text-sm text-slate-300">Select amount</label>
                    <div className="mt-3 px-2">
                      <input
                        type="range"
                        min={5}
                        max={100}
                        step={1}
                        value={topUpAmount}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const snap = snaps.find(s => Math.abs(s - v) <= 2);
                          setTopUpAmount(snap ?? v);
                        }}
                        className="w-full accent-studiosix-500"
                      />
                      {/* Token counts under slider */}
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        {snaps.map(s => (
                          <span key={s}>{amountToRenders(s)}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-800/60 rounded-xl p-4 border border-slate-700">
                    <div>
                      <div className="text-slate-200 text-sm">Amount</div>
                      <div className="text-white text-2xl font-bold">${topUpAmount}</div>
                      <div className="text-xs text-slate-400 mt-1">≈ {formatLocal(topUpAmount)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-200 text-sm">Renders</div>
                      <div className="text-2xl font-bold text-studiosix-400">{amountToRenders(topUpAmount)}</div>
                    </div>
                  </div>
                </>
              )}

              {/* Packages Tab Content */}
              {topUpTab === 'packages' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[5,10,20,50].map(v => {
                    const crossed = Math.round(v * 2); // show original price (50% off)
                    return (
                    <button key={v} onClick={() => setTopUpAmount(v)} className={`relative text-left p-4 rounded-xl border ${topUpAmount===v ? 'border-studiosix-500 bg-studiosix-600/10' : 'border-slate-700 bg-slate-800/60 hover:border-studiosix-500'}`}>
                      {v===20 && (
                        <span className="absolute -top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-black font-semibold">Most popular</span>
                      )}
                      <div className="text-slate-300 text-xs">Package</div>
                      <div className="flex items-end gap-2 mt-1">
                        <div className="text-white text-2xl font-bold">${v}</div>
                        <div className="text-slate-400 text-lg line-through opacity-80 mb-1">${crossed}</div>
                      </div>
                      <div className="text-studiosix-300 text-sm">{amountToRenders(v)} renders</div>
                    </button>
                  )})}
                </div>
              )}
              <div className="space-y-3">
                <div className="text-sm text-slate-300">Payment method</div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPaymentMethod('card')} className={`relative flex items-center justify-center gap-2 bg-white text-slate-900 border ${paymentMethod==='card' ? 'border-studiosix-500 ring-2 ring-studiosix-500/40' : 'border-slate-300 hover:border-studiosix-500'} rounded-lg py-3`}>
                    {paymentMethod === 'card' && (
                      <span className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-studiosix-500"></span>
                    )}
                    <img src="/Payment-Icons/visa.png" alt="Visa" className="h-5"/>
                    <img src="/Payment-Icons/pngimg.com - mastercard_PNG16.png" alt="Mastercard" className="h-5"/>
                    <img src="/Payment-Icons/amex.png" alt="Amex" className="h-5"/>
                    <span className="text-sm">Credit / Debit Card</span>
                  </button>
                  <button onClick={() => setPaymentMethod('mtn')} className={`relative flex items-center justify-center gap-2 bg-white text-slate-900 border ${paymentMethod==='mtn' ? 'border-studiosix-500 ring-2 ring-studiosix-500/40' : 'border-slate-300 hover:border-studiosix-500'} rounded-lg py-3`}>
                    {paymentMethod === 'mtn' && (
                      <span className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-studiosix-500"></span>
                    )}
                    <img src="/Payment-Icons/69-691715_mtn-mm-logo-generic-mtn-mobile-money-logo.png" alt="MTN Mobile Money" className="h-6"/>
                    <span className="text-sm">MTN Mobile Money</span>
                  </button>
                </div>
                {paymentMethod==='mtn' && (
                  <div className="mt-3">
                    <label className="block text-sm text-slate-300 mb-1">MTN Mobile Money Number (local format e.g. 0772123456)</label>
                    <input value={mtnNumber} onChange={e=>setMtnNumber(e.target.value)} placeholder="0772123456" className="w-full px-3 py-2 bg-white text-slate-900 rounded border border-slate-300" />
                    {(mmPolling || mmUiState !== 'idle') && (
                      <div className="mt-3 p-3 rounded-lg border border-slate-700 bg-slate-800/60">
                        {mmUiState === 'awaiting' && (
                          <div className="flex items-start gap-3">
                            <PhoneIcon className="w-6 h-6 text-studiosix-400" />
                            <div className="flex-1 text-sm text-slate-200">
                              <div className="font-semibold">Waiting for confirmation…</div>
                              <div className="text-slate-300">Approve the prompt on your phone to complete payment.</div>
                              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Current status: <span className="text-white font-semibold">{mmStatus || 'pending'}</span></span>
                              </div>
                            </div>
                          </div>
                        )}
                        {mmUiState === 'success' && (
                          <div className="flex items-start gap-3">
                            <CheckCircleIcon className="w-6 h-6 text-green-400" />
                            <div className="flex-1 text-sm text-green-300">
                              <div className="font-semibold">Payment confirmed</div>
                              <div>Credits have been added to your account.</div>
                            </div>
                          </div>
                        )}
                        {mmUiState === 'failed' && (
                          <div className="flex items-start gap-3">
                            <XCircleIcon className="w-6 h-6 text-red-400" />
                            <div className="flex-1 text-sm text-red-300">
                              <div className="font-semibold">Payment failed</div>
                              <div>Please try again or use a different method.</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/80 flex items-center justify-end">
              <button onClick={handleStartTopUp} className="px-5 py-2 bg-gradient-to-r from-studiosix-500 to-studiosix-600 hover:from-studiosix-600 hover:to-studiosix-700 text-white rounded-lg font-semibold shadow">
                Pay ${topUpAmount}
              </button>
            </div>
          </div>
        </div>
      )}
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
      <button onClick={() => window.dispatchEvent(new CustomEvent('open-token-topup'))} className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs rounded-md shadow flex items-center space-x-1">
        <span>Buy renders</span>
        <span role="img" aria-label="celebrate">🎉</span>
      </button>
    </div>
  );
};

export default RenderStudioPage;

// Sale banner with countdown to 7 Sep 2025
const RenderSaleBanner = () => {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const deadline = new Date('2025-09-07T23:59:59Z').getTime();
  const remaining = Math.max(0, deadline - now);
  const days = Math.floor(remaining / (1000*60*60*24));
  const hours = Math.floor((remaining % (1000*60*60*24)) / (1000*60*60));
  const minutes = Math.floor((remaining % (1000*60*60)) / (1000*60));
  const seconds = Math.floor((remaining % (1000*60)) / 1000);
  return (
    <div className="relative h-28 w-full overflow-hidden">
      {/* Show the banner image clearly, lightly scaled to show 'Launch Day' */}
      <img
        src="/Launchday%20Banner/Generated%20Image%20August%2031,%202025%20-%2011_29PM.jpeg"
        alt="Launch Day"
        className="absolute inset-0 w-[120%] h-full object-cover left-1/2 -translate-x-1/2"
        style={{ imageRendering: 'auto', objectPosition: 'center 35%' }}
      />
      {/* Independent sticker above countdown (fixed width to avoid jitter) */}
      <div className="absolute right-4 bottom-6 w-[360px] flex justify-center pointer-events-none">
        <img
          src="/Launchday%20Banner/—Pngtree—up%20to%2050%20off%20png_6660909.png"
          alt="50% OFF"
          className="h-24 w-auto drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
          style={{ imageRendering: 'auto' }}
        />
      </div>
      {/* Countdown placed on lower right (over white area) */}
      <div className="absolute right-4 bottom-2 w-[360px]">
        <div className="flex items-baseline gap-2 select-none justify-center">
          <span className="text-blue-900 font-extrabold text-base" style={{fontFamily:'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Poppins, sans-serif'}}>Ends in</span>
          <span className="text-blue-900 font-black text-2xl tracking-tight" style={{fontFamily:'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Poppins, sans-serif'}}>
            {String(days).padStart(2,'0')}d {String(hours).padStart(2,'0')}h {String(minutes).padStart(2,'0')}m {String(seconds).padStart(2,'0')}s
          </span>
        </div>
      </div>
    </div>
  );
};


