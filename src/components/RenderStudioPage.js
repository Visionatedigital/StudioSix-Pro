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
import FloatingWhatsAppButton from './FloatingWhatsAppButton';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const RenderStudioPage = ({ onBack }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatedVideo, setGeneratedVideo] = useState(null);
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
  const videoInputRef = useRef(null);
  React.useEffect(() => {
    const open = () => setShowTopUp(true);
    window.addEventListener('open-token-topup', open);
    return () => window.removeEventListener('open-token-topup', open);
  }, []);
  // Force periodic credits refresh while overlay is open
  React.useEffect(() => {
    let id = null;
    const refresh = async () => {
      try {
        await subscriptionService.refreshCreditsFromDatabase?.();
      } catch {}
    };
    id = setInterval(refresh, 15000);
    return () => { try { clearInterval(id); } catch {} };
  }, []);
  // Mode: image | video
  const [activeMode, setActiveMode] = useState('image');
  const [videoRatio, setVideoRatio] = useState('1280:720');
  const [videoDuration, setVideoDuration] = useState(5); // Runway: 5 or 10 seconds
  const [videoFps, setVideoFps] = useState(24);
  const [videoResolution, setVideoResolution] = useState('1080p');
  const [tierInfo, setTierInfo] = useState({ id: 'free' });
  const [isDemoBypass, setIsDemoBypass] = useState(false);
  React.useEffect(() => {
    (async () => {
      try {
        const tier = await subscriptionService.getCurrentTier?.();
        setTierInfo({ id: tier?.id || 'free' });
      } catch { setTierInfo({ id: 'free' }); }
      try {
        const bypass = await subscriptionService.isUnlimitedDemoUser?.();
        setIsDemoBypass(!!bypass);
      } catch { setIsDemoBypass(false); }
    })();
  }, []);
  const wavespeedPollRef = useRef({ abort: false, timer: null });
  const [videoDurations, setVideoDurations] = useState([]); // ms history for avg
  const [videoInputMode, setVideoInputMode] = useState('prompt');
  const [etaMs, setEtaMs] = useState(null); // current estimated duration in ms
  const [elapsedMs, setElapsedMs] = useState(0);
  const etaTimerRef = useRef(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  // Debug: react to generatedVideo changes to ensure mode switches and repaint happens
  React.useEffect(() => {
    if (generatedVideo) {
      try { setActiveMode('video'); } catch {}
      try { console.log('[RenderStudio] generatedVideo changed', generatedVideo); } catch {}
    }
  }, [generatedVideo]);

  React.useEffect(() => {
    return () => {
      try {
        wavespeedPollRef.current.abort = true;
        if (wavespeedPollRef.current.timer) {
          clearTimeout(wavespeedPollRef.current.timer);
          wavespeedPollRef.current.timer = null;
        }
      } catch {}
    };
  }, []);

  // Dev helper: allow triggering overlay with a video URL from the console
  React.useEffect(() => {
    try {
      window.studioSixTestVideo = (url) => {
        try {
          if (!url || typeof url !== 'string') return false;
          setGeneratedVideo(url);
          setIsPreviewExpanded(true);
          try { setActiveMode('video'); } catch {}
          return true;
        } catch {
          return false;
        }
      };
    } catch {}
    return () => {
      try { delete window.studioSixTestVideo; } catch {}
    };
  }, []);

  // Only expand when clicking central region of preview (avoid toolbar clicks)
  const handlePreviewClick = React.useCallback((e) => {
    if (!(generatedVideo || generatedImage)) return;
    const container = e.currentTarget;
    // Ignore clicks from interactive children
    const interactive = container.querySelector('[data-action-button="1"]');
    if (interactive && interactive.contains(e.target)) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const left = rect.width * 0.2;
    const right = rect.width * 0.8;
    const top = rect.height * 0.2;
    const bottom = rect.height * 0.8;
    if (x >= left && x <= right && y >= top && y <= bottom) {
      setIsPreviewExpanded(true);
    }
  }, [generatedVideo, generatedImage]);

  const snaps = [5, 10, 20, 50, 100];
  // Map USD to credits at a fixed rate: $1 = 100 credits
  const amountToCredits = (amt) => Math.round(Number(amt || 0) * 100);

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
      // Best-effort fetch of user email for server-side credit mapping
      let emailForHeaders = '';
      try {
        const profile = await (subscriptionService.getDatabaseProfile ? subscriptionService.getDatabaseProfile() : Promise.resolve(null));
        emailForHeaders = (profile && profile.email) ? profile.email : '';
      } catch {}
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
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': subscriptionService.currentUserId || '',
            'X-User-Email': emailForHeaders || ''
          },
          body: JSON.stringify({ contact: mtnNumber, amount: amountUGX, message: `StudioSix ${amountToCredits(topUpAmount)} credits` })
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
                        'X-User-Id': subscriptionService.currentUserId || '',
                        'X-User-Email': emailForHeaders || ''
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
                        'X-User-Id': subscriptionService.currentUserId || '',
                        'X-User-Email': emailForHeaders || ''
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
        let sdkLoaded = true;
        try {
          await PayPalService.loadSdk(clientId);
        } catch (e) {
          console.warn('[PayPal] SDK load error (will fallback to redirect)', e);
          sdkLoaded = false;
        }
        const order = await PayPalService.createOrder(topUpAmount, amountToCredits(topUpAmount), subscriptionService.currentUserId || '', email);
        // Use PayPal popup flow if available
        if (sdkLoaded && window.paypal && window.paypal.Buttons) {
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
            // Use white panel for better contrast with PayPal's dark form text
            panel.style.background = '#ffffff';
            panel.style.border = '1px solid rgba(15,23,42,.12)';
            panel.style.borderRadius = '16px';
            panel.style.boxShadow = '0 20px 60px rgba(0,0,0,.5)';
            panel.style.padding = '20px';
            panel.style.width = 'min(520px, 92vw)';
            // Title
            const title = document.createElement('div');
            title.style.color = '#0f172a';
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
            note.style.color = '#334155';
            note.innerText = 'Powered by PayPal. No PayPal account required.';
            panel.appendChild(note);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            const cleanup = () => { try { const el = document.getElementById('studiosix-payment-overlay'); if (el) el.remove(); } catch {} };

            const buttons = window.paypal.Buttons({
              createOrder: () => order.id,
              onApprove: async () => {
                try { await PayPalService.captureOrder(order.id); cleanup(); resolve(); } catch (e) { cleanup(); reject(e); }
              },
              onCancel: () => { cleanup(); reject(new Error('cancelled')); },
              onError: (err) => { cleanup(); reject(err); }
            });
            try { buttons.render('#paypal-buttons-container'); } catch (e) { cleanup(); reject(e); }
          });
        } else {
          // Fallback: redirect to PayPal approval URL if Buttons SDK blocked
          if (order && order.approveUrl) {
            window.location.assign(order.approveUrl);
            return; // wait for return/cancel redirect
          }
          // If no approve link, try immediate capture (rare)
          await PayPalService.captureOrder(order.id);
        }
        // Success
        await subscriptionService.recordUsage('image_render', { amount: 0, description: `Top-up ${amountToCredits(topUpAmount)} credits purchased` });
        subscriptionService.addRenderCredits(amountToCredits(topUpAmount));
        alert(`Payment successful. You purchased ${amountToCredits(topUpAmount)} credits.`);
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

  const handleUploadClick = () => {
    if (activeMode === 'video' && videoInputMode === 'upscale') {
      videoInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result);
      // Reset outputs on new upload
      setGeneratedImage(null);
      setGeneratedVideo(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Reuse uploadedImage state to carry preview thumbnail (browser won't preview video as img)
      // Keep a data URL of the video for sending to backend
      setUploadedImage(null);
      setGeneratedImage(null);
      setGeneratedVideo(null);
      // Store video data URL temporarily on window to avoid adding new state shape; simplest integration
      try { window.__studioSixVideoDataUrl = reader.result; } catch {}
      setActiveMode('video');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerate = async () => {
    if (activeMode === 'video') {
      return handleGenerateVideo();
    }
    if (!prompt.trim()) return;
    if (!uploadedImage) return;
    // Require 100 credits for image generation
    let allowed = true;
    try {
      const check = await subscriptionService.canPerformAction('image_render', { amount: 100 });
      allowed = (check === undefined) ? true : !!check;
    } catch {}
    if (!allowed) {
      const isDemo = await (subscriptionService.isUnlimitedDemoUser?.() || Promise.resolve(false));
      if (!isDemo) {
        alert('You do not have enough credits to generate image. Buy render credits to continue.');
        return;
      }
    }
    // Credits checked above; proceed
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
        await subscriptionService.recordUsage('image_render', { amount: 100, description: 'Render Studio image generation (100 credits)' });
      } else {
        console.warn('[RenderStudio] Generation failed, payload:', result);
        throw new Error(result?.error?.title || 'Generation failed');
      }
    } catch (e) {
      console.error('Render failed:', e);
      setRenderError('Render generation error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (videoInputMode === 'prompt' && !prompt.trim()) return;
    if (videoInputMode === 'upscale') {
      if (!window.__studioSixVideoDataUrl) return;
    } else if (!uploadedImage) return;
    // Require credits for video generation: 5s=200, 10s=400
    let allowed = true;
    try {
      const amount = (Number(videoDuration) >= 10) ? 400 : 200;
      const check = await subscriptionService.canPerformAction('video_render', { amount });
      allowed = (check === undefined) ? true : !!check;
    } catch {}
    if (!allowed) {
      const isDemo = await (subscriptionService.isUnlimitedDemoUser?.() || Promise.resolve(false));
      if (!isDemo) {
        alert('You do not have enough credits to generate video. Buy render credits to continue.');
        return;
      }
    }
    // Reset polling state before starting a new job
    try {
      wavespeedPollRef.current.abort = false;
      if (wavespeedPollRef.current.timer) {
        clearTimeout(wavespeedPollRef.current.timer);
        wavespeedPollRef.current.timer = null;
      }
    } catch {}
    setIsGenerating(true);
    try { setIsPreviewExpanded(true); } catch {}
    setProgress(0);
    setRenderError(null);
    setGeneratedVideo(null);
    // Initialize ETA from history or defaults (5s→~120s, 10s→~180s)
    try { if (etaTimerRef.current) clearInterval(etaTimerRef.current); } catch {}
    const avgMs = (videoDurations.length > 0) ? Math.round(videoDurations.reduce((a,b)=>a+b,0)/videoDurations.length) : null;
    const defaultEta = (videoDuration >= 10) ? 180000 : 120000;
    const initialEta = Math.max(30000, Math.min(180000, avgMs || Math.min(defaultEta, 90000)));
    setEtaMs(initialEta);
    setElapsedMs(0);
    const t0 = Date.now();
    etaTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - t0;
      setElapsedMs(elapsed);
      const est = initialEta;
      const next = Math.min(95, Math.floor((Math.min(elapsed, est) / est) * 95));
      setProgress(next);
    }, 250);
    try {
      aiSettingsService.trackUsage('video_render');
      const startedAt = Date.now();

      // Use Wavespeed Seedance
      let result;
      try {
        // Guard: lock 1080p for Pro/Studio/Enterprise unless demo bypass
        let selectedRes = videoResolution;
        const can1080 = (isDemoBypass || tierInfo.id === 'pro' || tierInfo.id === 'studio' || tierInfo.id === 'enterprise');
        if (selectedRes === '1080p' && !can1080) selectedRes = '720p';
        const model = selectedRes === '480p' ? 'bytedance/seedance-v1-pro-i2v-480p' : (selectedRes === '720p' ? 'bytedance/seedance-v1-pro-i2v-720p' : 'bytedance/seedance-v1-pro-i2v-1080p');
        result = await aiRenderService.generateVideoWithWavespeed({
          prompt,
          imageDataUrl: uploadedImage,
          durationSec: videoDuration,
          model
        });
      } catch (e) {
        console.warn('[Wavespeed create error]', e);
        result = { ok: false, error: e?.message || String(e) };
      }

      const finishAndRecord = async (asset) => {
        const elapsed = Date.now() - startedAt;
        console.log('[RenderStudio] finishAndRecord set video src', asset);
        setGeneratedVideo(asset);
        try { setIsPreviewExpanded(true); } catch {}
        try { setActiveMode('video'); } catch {}
        setProgress(100);
        setVideoDurations(prev => [...prev.slice(-9), elapsed]);
        try { if (etaTimerRef.current) { clearInterval(etaTimerRef.current); etaTimerRef.current = null; } } catch {}
        try { wavespeedPollRef.current.abort = true; if (wavespeedPollRef.current.timer) { clearTimeout(wavespeedPollRef.current.timer); wavespeedPollRef.current.timer = null; } } catch {}
        console.log(`[RenderStudio] Video generated in ${Math.round(elapsed/1000)}s`);
        const debit = (Number(videoDuration) >= 10) ? 400 : 200;
        await subscriptionService.recordUsage('video_render', { amount: debit, description: `Render Studio video generation (${debit} credits)` });
        // Mark generation complete only when we have a playable asset
        setIsGenerating(false);
      };

      console.log('[RenderStudio][frontend] create result', result);
      if (result && result.ok && (result.videoUrl || result.assetUrl)) {
        await finishAndRecord(result.videoUrl || result.assetUrl);
      } else if (result && result.ok && (result.requestId || result.jobId || result.taskId)) {
        const id = result.requestId || result.jobId || result.taskId;
        console.log('[Wavespeed][frontend] created, starting immediate poll every 3s', id);
        const doPoll = async (attempt = 0) => {
          if (wavespeedPollRef.current.abort) return;
          try {
            const j = await aiRenderService.getWavespeedVideoJob(id);
            console.log('[Wavespeed][frontend] poll tick', { id, status: j?.status, hasAsset: !!(j?.videoUrl || j?.assetUrl) });
            if (j?.ok && (j.videoUrl || j.assetUrl)) {
              await finishAndRecord(j.videoUrl || j.assetUrl);
              return;
            }
            if (j && j.status === 'failed') throw new Error(j?.error || 'Video generation failed');
            setProgress(p => Math.min(95, Math.max(p, 5 + attempt)));
          } catch (e) {
            console.warn('[Wavespeed][frontend] poll error', e);
          }
          // schedule next poll in 3s
          try { console.log('[Wavespeed][frontend] scheduling next poll in 3s', { attempt: attempt + 1 }); } catch {}
          wavespeedPollRef.current.timer = setTimeout(() => doPoll(attempt + 1), 3000);
        };
        doPoll(0);
      } else {
        // If creation failed immediately, surface its error
        throw new Error(result?.error || 'Video generation failed');
      }
    } catch (e) {
      console.error('Video render failed:', e);
      setRenderError(e?.message || String(e));
      // Stop any scheduled polls on error
      try {
        wavespeedPollRef.current.abort = true;
        if (wavespeedPollRef.current.timer) {
          clearTimeout(wavespeedPollRef.current.timer);
          wavespeedPollRef.current.timer = null;
        }
      } catch {}
      // Ensure progress/ETA timers stop and UI exits generating state on error
      try { if (etaTimerRef.current) { clearInterval(etaTimerRef.current); etaTimerRef.current = null; } } catch {}
      setIsGenerating(false);
    } finally {
      // Keep isGenerating state controlled by success/error paths to avoid early UI fallback
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
        await subscriptionService.recordUsage('image_render', { amount: 100, description: 'Render Studio edit (100 credits)' });
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
    const src = generatedVideo || generatedImage || uploadedImage;
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = `studio-six-render-${Date.now()}.${generatedVideo ? 'mp4' : 'png'}`;
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
      <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-gray-800/60 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 lg:w-10 lg:h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
              <img src="/studiosix-icon.svg" alt="StudioSix Icon" className="w-5 h-5 lg:w-6 lg:h-6" />
          </div>
            <div className="leading-tight">
              <h2 className="text-lg lg:text-xl font-bold text-white">AI Render Studio</h2>
              <p className="text-xs lg:text-sm text-gray-400">Generate images with AI from a reference</p>
          </div>
        </div>
          <div className="flex items-center gap-2 lg:gap-3">
          <RenderUsageBadge />
          <button onClick={onBack} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all duration-200">
              <XMarkIcon className="w-5 h-5 lg:w-6 lg:h-6" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="h-[calc(100%-64px)] flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden px-4 lg:px-6">
        {/* Left controls */}
        <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-gray-800/60 p-4 lg:p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Mode Tabs */}
            <div>
              <div className="inline-flex bg-slate-800/60 border border-slate-700 rounded-lg overflow-hidden mb-3">
                <button onClick={() => setActiveMode('image')} className={`px-4 py-2 text-sm ${activeMode==='image' ? 'bg-studiosix-600 text-white' : 'text-slate-300 hover:text-white'}`}>Image</button>
                <button onClick={() => setActiveMode('video')} className={`px-4 py-2 text-sm ${activeMode==='video' ? 'bg-studiosix-600 text-white' : 'text-slate-300 hover:text-white'}`}>Video</button>
              </div>
            </div>

            {/* Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">Reference Image</label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
              <button onClick={handleUploadClick} className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-studiosix-600 hover:bg-studiosix-700 text-white rounded-lg transition-colors">
                <ArrowUpTrayIcon className="w-5 h-5" />
                <span>Upload Image</span>
              </button>
              <p className="text-xs text-gray-500 mt-2">PNG or JPG up to 10MB</p>
            </div>

            {/* Prompt */}
            <div>
              <div className="flex items-center space-x-2 mb-3"></div>
              {videoInputMode === 'prompt' ? (
                <>
              <label className="block text-sm font-semibold text-gray-300 mb-3">AI Prompt</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} placeholder="Describe the scene, style, lighting..."
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/60 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-studiosix-500 focus:border-transparent" />
                </>
              ) : null}
            </div>

            {/* Settings */}
            {activeMode === 'image' ? (
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
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {videoInputMode === 'prompt' ? (
                  <>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Video Aspect Ratio</label>
                  <select
                    value={videoRatio}
                    onChange={(e) => setVideoRatio(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/60 rounded-lg text-white focus:ring-2 focus:ring-studiosix-500 focus:border-transparent"
                  >
                        <option value="1280:720">1280×720 (16:9)</option>
                        <option value="720:1280">720×1280 (9:16)</option>
                        <option value="960:960">960×960 (1:1)</option>
                        <option value="1104:832">1104×832 (4:3)</option>
                        <option value="832:1104">832×1104 (3:4)</option>
                        <option value="1584:672">1584×672 (2.35:1)</option>
                  </select>
                </div>
                <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Duration</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setVideoDuration(5)} className={`px-3 py-2 rounded-md border ${videoDuration===5?'border-studiosix-500 bg-studiosix-600/20 text-white':'border-gray-700 bg-gray-800/50 text-gray-200 hover:border-studiosix-500'}`}>5 seconds</button>
                        <button onClick={() => setVideoDuration(10)} className={`px-3 py-2 rounded-md border ${videoDuration===10?'border-studiosix-500 bg-studiosix-600/20 text-white':'border-gray-700 bg-gray-800/50 text-gray-200 hover:border-studiosix-500'}`}>10 seconds</button>
                      </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Video Resolution</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['480p','720p','1080p'].map(r => {
                      const locked = (r === '1080p') && !(isDemoBypass || tierInfo.id === 'pro' || tierInfo.id === 'studio' || tierInfo.id === 'enterprise');
                      return (
                        <button
                          key={r}
                          onClick={() => { if (!locked) setVideoResolution(r); }}
                          disabled={locked}
                          title={locked ? '1080p is available on Pro or Studio' : undefined}
                          className={`px-3 py-2 rounded-md border ${videoResolution===r?'border-studiosix-500 bg-studiosix-600/20 text-white':'border-gray-700 bg-gray-800/50 text-gray-200 hover:border-studiosix-500'} ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {r.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
                  </>
                ) : null}
              </div>
            )}

            {/* Generate */}
            <button onClick={handleGenerate} disabled={(activeMode==='video' ? !uploadedImage : !uploadedImage) || (activeMode==='video' ? !prompt.trim() : !prompt.trim()) || isGenerating}
              className={`w-full px-6 py-4 rounded-lg font-semibold transition-all duration-200 ${(!uploadedImage || !prompt.trim() || isGenerating) ? 'bg-gray-700/60 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-studiosix-500 to-studiosix-600 hover:from-studiosix-600 hover:to-studiosix-700 text-white shadow-lg hover:shadow-xl'}`}>
              {isGenerating ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{activeMode === 'video' ? 'Generating video...' : 'Generating...'}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <SparklesIcon className="w-5 h-5" />
                  <span>Generate {activeMode === 'video' ? 'Video' : 'Image'}</span>
                </div>
              )}
            </button>

            {/* Progress */}
            {isGenerating && (
              <div className="mt-2">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-studiosix-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round(progress)}% Complete
                  {activeMode === 'video' && videoDurations.length > 0 && (
                    <>
                      {' · Avg '} 
                      {(() => {
                        const avg = Math.round(videoDurations.reduce((a, b) => a + b, 0) / videoDurations.length / 1000);
                        return `${avg}s`;
                      })()}
                    </>
                  )}
                </p>
              </div>
            )}
            {renderError && (
              <div className="text-xs text-red-400">{renderError}</div>
            )}
          </div>
        </div>

        {/* Right preview */}
        <div className="flex-1 p-4 lg:p-6 overflow-hidden">
          <div className="h-full bg-gray-900/40 border border-gray-800/60 rounded-xl flex items-center justify-center relative cursor-zoom-in" onClick={handlePreviewClick}>
            {!uploadedImage && !generatedImage && (
              <div className="text-center text-gray-400">
                <CameraIcon className="w-16 h-16 mx-auto mb-4 opacity-60" />
                <p className="text-lg">Upload a reference to begin</p>
              </div>
            )}
            {(generatedVideo || generatedImage || uploadedImage) && (
              <div className="w-full h-full p-4 flex items-center justify-center">
                <div className="relative w-full h-full max-w-full max-h-full">
                  {/* Generating overlay */}
                  {isGenerating && (
                    <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center">
                      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3"></div>
                      <div className="text-white text-sm">
                        {activeMode === 'video' ? (
                          etaMs ? `Generating video… Est. remaining ${Math.max(0, Math.ceil(((etaMs - Math.min(etaMs, elapsedMs)))/1000))}s` : 'Generating video…'
                        ) : 'Generating image…'}
                      </div>
                      <div className="w-1/2 bg-white/20 rounded-full h-1 mt-3">
                        <div className="bg-white/80 h-1 rounded-full transition-all" style={{ width: `${Math.max(5, Math.min(95, progress))}%` }}></div>
                      </div>
                    </div>
                  )}
                  {/* Action buttons (show only when a generated image exists) */}
                  {(generatedImage || generatedVideo) && (
                    <div className="absolute top-3 right-3 z-20 flex items-center space-x-2" data-action-button="1">
                      <button onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="px-3 py-2 bg-gray-800/70 hover:bg-gray-700/80 text-white rounded-lg text-sm flex items-center space-x-1">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        <span>Download</span>
                      </button>
                      {generatedImage && activeMode === 'image' && (
                        <button onClick={(e) => { e.stopPropagation(); setIsEditing((v) => !v); }} className="px-3 py-2 bg-gray-800/70 hover:bg-gray-700/80 text-white rounded-lg text-sm flex items-center space-x-1">
                          <PencilSquareIcon className="w-4 h-4" />
                          <span>{isEditing ? 'Cancel Edit' : 'Edit Image'}</span>
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleShare(); }} className="px-3 py-2 bg-gray-800/70 hover:bg-gray-700/80 text-white rounded-lg text-sm flex items-center space-x-1">
                        <ShareIcon className="w-4 h-4" />
                        <span>Share</span>
                      </button>
                    </div>
                  )}

                  {activeMode === 'image' && generatedImage && (baselineImageForCompare || uploadedImage) ? (
                    <>
                      <img src={baselineImageForCompare || uploadedImage} alt="Before" className="absolute inset-0 w-full h-full object-contain rounded-lg" />
                      <div className="absolute inset-0 overflow-hidden rounded-lg" style={{ clipPath: `inset(0 ${100 - compareSlider}% 0 0)` }}>
                        <img src={generatedImage} alt="After" className="w-full h-full object-contain" />
                      </div>
                    </>
                  ) : activeMode === 'video' && (generatedVideo || uploadedImage) ? (
                    <>
                      {generatedVideo ? (
                        <video key={generatedVideo} src={generatedVideo} className="absolute inset-0 w-full h-full object-contain rounded-lg" autoPlay muted loop controls />
                      ) : (
                        <img src={uploadedImage} alt="Preview" className="absolute inset-0 w-full h-full object-contain rounded-lg" />
                      )}
                    </>
                  ) : (
                    <img src={uploadedImage} alt="Preview" className="absolute inset-0 w-full h-full object-contain rounded-lg" />
                  )}
                  {activeMode === 'image' && (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={compareSlider}
                      onChange={(e) => setCompareSlider(Number(e.target.value))}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 w-2/3"
                    />
                  )}

                  {/* Edit panel */}
                  {activeMode === 'image' && isEditing && (
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

      {/* Expanded preview modal */}
      {isPreviewExpanded && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsPreviewExpanded(false)}>
          <div className="relative w-full max-w-6xl h-[85vh] bg-slate-900 border border-slate-700 rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              {activeMode === 'video' && (
                <button onClick={(e) => { e.stopPropagation(); setRenderError(null); setGeneratedVideo(null); handleGenerateVideo(); }} className="p-2 bg-studiosix-600/80 hover:bg-studiosix-700 text-white rounded-lg">
                  <SparklesIcon className="w-5 h-5" />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="p-2 bg-slate-800/70 hover:bg-slate-700/80 text-white rounded-lg">
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
              <button onClick={() => setIsPreviewExpanded(false)} className="p-2 bg-slate-800/70 hover:bg-slate-700/80 text-white rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              {isGenerating && activeMode === 'video' && !generatedVideo ? (
                <div className="flex flex-col items-center justify-center text-center p-6">
                  <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
                  <div className="text-white text-sm">Generating video… This may take up to 5 minutes.</div>
                  <div className="w-48 bg-white/20 rounded-full h-1 mt-3">
                    <div className="bg-white/80 h-1 rounded-full transition-all" style={{ width: `${Math.max(5, Math.min(95, progress))}%` }}></div>
                  </div>
                </div>
              ) : renderError && activeMode === 'video' && !generatedVideo ? (
                <div className="text-center text-red-300 p-6">
                  <div className="text-lg font-semibold mb-2">Video generation failed</div>
                  <div className="text-sm opacity-90 mb-4">{renderError}</div>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => { setRenderError(null); setGeneratedVideo(null); handleGenerateVideo(); }} className="px-4 py-2 rounded-lg bg-studiosix-600 hover:bg-studiosix-700 text-white">Try again</button>
                    <button onClick={() => setIsPreviewExpanded(false)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white">Close</button>
                  </div>
                </div>
              ) : generatedVideo ? (
                <video src={generatedVideo} className="w-full h-full object-contain" autoPlay muted loop controls />
              ) : activeMode === 'image' && generatedImage ? (
                <div className="relative w-full h-full">
                  <img src={baselineImageForCompare || uploadedImage} alt="Before" className="absolute inset-0 w-full h-full object-contain" />
                  <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - compareSlider}% 0 0)` }}>
                    <img src={generatedImage} alt="After" className="w-full h-full object-contain" />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={compareSlider}
                    onChange={(e) => setCompareSlider(Number(e.target.value))}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 w-2/3"
                  />
                </div>
              ) : (
                <div className="text-gray-400">No preview available</div>
              )}
            </div>
          </div>
        </div>
      )}
      {showTopUp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[560px] max-w-[92vw] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-gradient-to-r from-studiosix-700/40 to-studiosix-800/40">
              <div>
                <div className="text-white font-semibold">Buy Render Credits</div>
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
                      {/* Credit counts under slider */}
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        {snaps.map(s => (
                          <span key={s}>{amountToCredits(s)}</span>
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
                      <div className="text-slate-200 text-sm">Credits</div>
                      <div className="text-2xl font-bold text-studiosix-400">{amountToCredits(topUpAmount)}</div>
                    </div>
                  </div>
                </>
              )}

              {/* Packages Tab Content */}
              {topUpTab === 'packages' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[5,10,20,50].map(v => {
                    return (
                    <button key={v} onClick={() => setTopUpAmount(v)} className={`relative text-left p-4 rounded-xl border ${topUpAmount===v ? 'border-studiosix-500 bg-studiosix-600/10' : 'border-slate-700 bg-slate-800/60 hover:border-studiosix-500'}`}>
                      {v===20 && (
                        <span className="absolute -top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-black font-semibold">Most popular</span>
                      )}
                      <div className="text-slate-300 text-xs">Package</div>
                      <div className="flex items-end gap-2 mt-1">
                        <div className="text-white text-2xl font-bold">${v}</div>
                      </div>
                      <div className="text-studiosix-300 text-sm">{amountToCredits(v)} credits</div>
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
      <FloatingWhatsAppButton className="z-[70]" href={"https://chat.whatsapp.com/IjpspD39l1I7rZ9sOhtOrV?mode=ems_share_t"} />
    </div>
  );
};

const RenderUsageBadge = () => {
  const [credits, setCredits] = React.useState(0);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Force-sync from database on first mount
        await subscriptionService.refreshCreditsFromDatabase?.();
        const sub = await subscriptionService.getSubscription();
        if (!mounted) return;
        setCredits(typeof sub?.credits === 'number' ? sub.credits : (typeof sub?.renderCredits === 'number' ? sub.renderCredits : 0));
      } catch {}
    })();
    const unsub = subscriptionService.onSubscriptionChange?.(() => {
      try {
        const sub = subscriptionService.subscription;
        setCredits(typeof sub?.credits === 'number' ? sub.credits : (typeof sub?.renderCredits === 'number' ? sub.renderCredits : 0));
      } catch {}
    });
    // Also refresh on window focus and visibility changes
    const onFocus = async () => {
      try {
        await subscriptionService.refreshCreditsFromDatabase?.();
        const sub = await subscriptionService.getSubscription();
        if (!mounted) return;
        setCredits(typeof sub?.credits === 'number' ? sub.credits : (typeof sub?.renderCredits === 'number' ? sub.renderCredits : 0));
      } catch {}
    };
    try { window.addEventListener('focus', onFocus); } catch {}
    try { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onFocus(); }); } catch {}
    return () => { mounted = false; try { unsub && unsub(); } catch {} };
  }, []);
  return (
    <div className="flex items-center space-x-3">
      <div className={`text-sm ${credits <= 0 ? 'text-red-400' : 'text-gray-300'}`}>
        Credits: <span className={`${credits <= 0 ? 'text-red-400' : 'text-white'} font-semibold`}>{credits}</span>
      </div>
      <button onClick={() => window.dispatchEvent(new CustomEvent('open-token-topup'))} className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs rounded-md shadow flex items-center space-x-1">
        <span>Buy credits</span>
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


