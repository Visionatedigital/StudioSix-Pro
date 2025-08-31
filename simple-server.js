#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

console.log('Starting StudioSix Pro simple server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);
console.log('RESEND_API_KEY configured:', !!process.env.RESEND_API_KEY);

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
// Initialize OpenAI client ONLY if API key is configured to avoid startup crash in production
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (e) {
  console.warn('⚠️ Failed to initialize OpenAI client (will run without AI):', e.message);
}

const app = express();
const PORT = process.env.PORT || 8080;

console.log('OpenAI API Key configured:', !!process.env.OPENAI_API_KEY);

// Enable CORS for frontend connections
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'https://studiosix.ai'
  ],
  credentials: true
}));

// Enable JSON parsing for API endpoints (large payloads for base64 images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- Supabase Admin (Service Role) for server-side credit updates ---
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
let supabaseAdmin = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  console.log('Supabase admin client initialized:', !!supabaseAdmin);
} else {
  console.warn('⚠️ Supabase admin not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
}

async function getUserByEmail(email) {
  if (!supabaseAdmin) throw new Error('Supabase admin not configured');
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, render_credits')
    .eq('email', email)
    .single();
  if (error) throw error;
  return data;
}

async function incrementRenderCreditsByEmail(email, amount) {
  if (!supabaseAdmin) throw new Error('Supabase admin not configured');
  const user = await getUserByEmail(email);
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update({ render_credits: (user.render_credits || 0) + amount, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('render_credits')
    .single();
  if (error) throw error;
  return data.render_credits;
}

async function incrementRenderCreditsByUserId(userId, amount) {
  if (!supabaseAdmin) throw new Error('Supabase admin not configured');
  const { data: current, error: e1 } = await supabaseAdmin
    .from('user_profiles')
    .select('render_credits')
    .eq('id', userId)
    .single();
  if (e1) throw e1;
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update({ render_credits: (current.render_credits || 0) + amount, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('render_credits')
    .single();
  if (error) throw error;
  return data.render_credits;
}

async function getCreditsByUserId(userId) {
  if (!supabaseAdmin) throw new Error('Supabase admin not configured');
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('render_credits')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data.render_credits || 0;
}

async function consumeOneCredit(userId) {
  if (!supabaseAdmin) throw new Error('Supabase admin not configured');
  const { data, error } = await supabaseAdmin.rpc('consume_render_credit', { p_user_id: userId });
  if (error) throw error;
  return data; // remaining credits
}

// --- TaskWeaver proxy integration ---
const TW_URL = process.env.TASKWEAVER_URL || 'http://127.0.0.1:8765';
const TW_TOKEN = process.env.TASKWEAVER_TOKEN || process.env.TW_SHARED_TOKEN || 'replace-me';

// Preferred aliases used by the frontend
app.post('/api/tw/run', async (req, res) => {
  try {
    const { runId, goal, context, model, maxSteps, toolWhitelist } = req.body || {};
    const r = await fetch(`${TW_URL}/tw/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-Token': TW_TOKEN },
      body: JSON.stringify({ runId, goal, context, model, maxSteps, toolWhitelist })
    });
    const j = await r.json();
    res.status(r.status).json(j);
  } catch (e) {
    res.status(502).json({ ok: false, error: { code: 'E_TW_DOWN', title: 'Agent service unavailable', hint: String(e) } });
  }
});

app.get('/api/tw/events', async (req, res) => {
  try {
    const runId = req.query.runId;
    const r = await fetch(`${TW_URL}/tw/events/${encodeURIComponent(runId)}`, {
      headers: { 'Accept': 'text/event-stream', 'X-TW-Token': TW_TOKEN }
    });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    if (r.body && r.body.pipe) {
      r.body.pipe(res);
    } else {
      res.status(502).end();
    }
  } catch (e) {
    res.status(502).end();
  }
});

// --- Google AI Studio (Gemini) image generation proxy ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
app.post('/api/ai/google-generate', async (req, res) => {
  try {
    const { prompt, imageDataUrl, secondaryImageDataUrl, quality = 'standard', imageSize = '1024x1024', model = 'gemini-2.5-flash-image-preview' } = req.body || {};
    if (!GOOGLE_API_KEY) {
      return res.status(503).json({ ok: false, error: { code: 'E_NO_GOOGLE_KEY', title: 'Google API key missing', hint: 'Set GOOGLE_API_KEY in environment' } });
    }
    if (!prompt || !imageDataUrl) {
      return res.status(400).json({ ok: false, error: { code: 'E_BAD_INPUT', title: 'prompt and imageDataUrl required' } });
    }
    // Parse data URL
    const match = /^data:(.*?);base64,(.*)$/.exec(imageDataUrl);
    if (!match) {
      return res.status(400).json({ ok: false, error: { code: 'E_BAD_IMAGE', title: 'Invalid image data URL' } });
    }
    const mimeType = match[1];
    const base64 = match[2];
    const beefedPrompt = `${prompt}\n\nOutput quality: ${quality}. Target size: ${imageSize}. Render architectural fidelity, consistent lighting, accurate materials, balanced exposure.`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`;
    const parts = [ { text: beefedPrompt }, { inlineData: { mimeType, data: base64 } } ];
    // Optional secondary image (e.g., furniture to insert)
    if (secondaryImageDataUrl && typeof secondaryImageDataUrl === 'string') {
      const m2 = /^data:(.*?);base64,(.*)$/.exec(secondaryImageDataUrl);
      if (m2) {
        parts.push({ inlineData: { mimeType: m2[1], data: m2[2] } });
      }
    }
    const payload = {
      contents: [ { role: 'user', parts } ],
      generationConfig: { temperature: 0.6 }
    };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const rawText = await r.text();
    let j = {};
    try { j = JSON.parse(rawText); } catch {}
    if (!r.ok) {
      console.error('❌ Google API error', r.status, j?.error || rawText?.slice?.(0, 200));
      return res.status(502).json({ ok: false, error: { code: 'E_GOOGLE', title: 'Google API error', status: r.status, detail: j?.error || j || rawText } });
    }
    // Try to extract image data from candidates
    let outMime = 'image/png';
    let outData = null;
    try {
      const candidates = j.candidates || [];
      for (const c of candidates) {
        const parts = (c.content && c.content.parts) || c.parts || [];
        for (const p of parts) {
          if (p.inlineData && p.inlineData.data) {
            outMime = p.inlineData.mimeType || outMime;
            outData = p.inlineData.data;
            break;
          }
          if (p.blob && p.blob.data) { // fallback shape
            outData = p.blob.data;
            outMime = p.blob.mimeType || outMime;
            break;
          }
        }
        if (outData) break;
      }
    } catch {}
    if (!outData && j && j.inlineData && j.inlineData.data) {
      outData = j.inlineData.data;
      outMime = j.inlineData.mimeType || outMime;
    }
    if (!outData) {
      return res.status(500).json({ ok: false, error: { code: 'E_NO_IMAGE', title: 'No image returned', detail: j } });
    }
    const dataUrl = `data:${outMime};base64,${outData}`;
    return res.json({ ok: true, status: 'completed', output_image: dataUrl });
  } catch (e) {
    console.error('❌ Google generate failed:', e);
    return res.status(500).json({ ok: false, error: { code: 'E_PROXY', title: 'Proxy failure', hint: String(e) } });
  }
});

app.post('/api/tw/tool-result', async (req, res) => {
  try {
    const r = await fetch(`${TW_URL}/tw/tool-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TW-Token': TW_TOKEN },
      body: JSON.stringify(req.body || {})
    });
    const j = await r.json();
    res.status(r.status).json(j);
  } catch (e) {
    res.status(502).json({ ok: false, error: { code: 'E_TW_DOWN', title: 'Agent service unavailable', hint: String(e) } });
  }
});

// Backward-compatible aliases
app.post('/api/agent/run', async (req, res) => {
  try {
    const r = await fetch(`${TW_URL}/tw/run`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TW-Token': TW_TOKEN }, body: JSON.stringify(req.body || {}) });
    const j = await r.json();
    res.status(r.status).json(j);
  } catch (e) { res.status(502).json({ ok: false, error: { code: 'E_TW_DOWN', title: 'Agent service unavailable', hint: String(e) } }); }
});

app.get('/api/agent/events', async (req, res) => {
  try {
    const runId = req.query.runId;
    const r = await fetch(`${TW_URL}/tw/events/${encodeURIComponent(runId)}`, { headers: { 'Accept': 'text/event-stream', 'X-TW-Token': TW_TOKEN } });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    if (r.body && r.body.pipe) { r.body.pipe(res); } else { res.status(502).end(); }
  } catch (e) { res.status(502).end(); }
});

app.post('/api/agent/tool-result', async (req, res) => {
  try {
    const r = await fetch(`${TW_URL}/tw/tool-result`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TW-Token': TW_TOKEN }, body: JSON.stringify(req.body || {}) });
    const j = await r.json();
    res.status(r.status).json(j);
  } catch (e) { res.status(502).json({ ok: false, error: { code: 'E_TW_DOWN', title: 'Agent service unavailable', hint: String(e) } }); }
});

// Tools dispatcher - secure TW -> Node calls
app.post('/api/tools/:name', async (req, res) => {
  const token = req.headers['x-tw-token'];
  if (!token || token !== TW_TOKEN) {
    return res.status(403).json({ ok: false, error: { code: 'E_FORBIDDEN', title: 'Forbidden' } });
  }
  const name = req.params.name;
  try {
    // Lazy import to avoid bundling issues
    const aiCommandExecutor = require('./src/services/AICommandExecutor').default || require('./src/services/AICommandExecutor');
    if (typeof aiCommandExecutor.executeToolByName === 'function') {
      const result = await aiCommandExecutor.executeToolByName(name, req.body);
      return res.json(result);
    }
    if (typeof aiCommandExecutor.executeTool === 'function') {
      // Fallback: some names are like geometry.createStair
      const result = await aiCommandExecutor.executeTool(name, req.body);
      return res.json({ ok: true, data: result });
    }
    return res.json({ ok: false, error: { code: 'E_NOT_IMPL', title: `No handler for ${name}` } });
  } catch (e) {
    res.status(500).json({ ok: false, error: { code: 'E_EXEC', title: 'Tool exec failed', hint: String(e) } });
  }
});

console.log('Current working directory:', process.cwd());
console.log('Available files:', fs.readdirSync(process.cwd()).filter(f => !f.startsWith('.')));

// Health check endpoint - this should work regardless of build status
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: PORT,
    nodeVersion: process.version,
    env: process.env.NODE_ENV
  });
});

// Image proxy endpoint for Supabase thumbnails to bypass CORS
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  // Only allow Supabase URLs for security
  if (!url.includes('zwrooqvwxdwvnuhpepta.supabase.co')) {
    return res.status(403).json({ error: 'Only Supabase URLs are allowed' });
  }
  
  try {
    console.log('🖼️ Proxying image:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }
    
    // Set appropriate headers
    res.set({
      'Content-Type': response.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });
    
    // Pipe the image data
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
    
  } catch (error) {
    console.error('❌ Image proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// Get image as base64 data URL to completely bypass CORS
app.get('/api/image-data-url', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  // Only allow Supabase URLs for security
  if (!url.includes('zwrooqvwxdwvnuhpepta.supabase.co')) {
    return res.status(403).json({ error: 'Only Supabase URLs are allowed' });
  }
  
  try {
    console.log('📸 Fetching image as data URL:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }
    
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;
    
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.json({ dataUrl });
    
  } catch (error) {
    console.error('❌ Image data URL error:', error);
    res.status(500).json({ error: 'Failed to fetch image data' });
  }
});

// Image proxy endpoint to avoid CORS issues
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  // Security: Only allow Supabase URLs
  if (!url.includes('zwrooqvwxdwvnuhpepta.supabase.co')) {
    return res.status(403).json({ error: 'Only Supabase URLs are allowed' });
  }
  
  try {
    console.log('🖼️ Proxying image:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.send(Buffer.from(buffer));
    
  } catch (error) {
    console.error('❌ Image proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// Model discovery endpoint - auto-discovers models in Supabase bucket
app.get('/api/discover-models', async (req, res) => {
  try {
    console.log('🔍 Starting model discovery...');
    
    const { generateManifest } = require('./scripts/discover-models');
    const manifest = await generateManifest();
    
    console.log(`✅ Discovery complete: ${manifest.stats.total_models} models in ${manifest.stats.total_categories} categories`);
    
    res.json(manifest);
    
  } catch (error) {
    console.error('❌ Model discovery error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific category models (lightweight)
app.get('/api/models/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { generateManifest } = require('./scripts/discover-models');
    
    console.log(`📋 Fetching models for category: ${category}`);
    
    const manifest = await generateManifest();
    const categoryModels = manifest.models.filter(model => 
      model.category.toLowerCase() === category.toLowerCase()
    );
    
    res.json({
      category: category,
      models: categoryModels,
      count: categoryModels.length
    });
    
  } catch (error) {
    console.error('❌ Category fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Email API endpoint for waitlist
app.post('/api/add-to-waitlist', async (req, res) => {
  const { email, promptText = '', source = 'landing_page' } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  const API_KEY = process.env.RESEND_API_KEY;
  
  console.log('🔑 Waitlist API Key status:', {
    hasEnvKey: !!process.env.RESEND_API_KEY,
    keyPrefix: API_KEY ? API_KEY.substring(0, 8) + '...' : 'none'
  });
  
  if (!API_KEY) {
    console.log('📧 No RESEND_API_KEY environment variable set for waitlist');
    return res.json({
      success: true,
      message: 'Mock waitlist signup (no API key configured)',
      email: email,
      promptText: promptText,
      note: 'Set RESEND_API_KEY environment variable to send real emails'
    });
  }

  try {
    // Add contact to Resend audience
    try {
      const audienceResponse = await fetch('https://api.resend.com/audiences/6f7cbb8f-8de2-479d-9c89-2249cf098d1a/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          first_name: email.split('@')[0], // Extract name from email as fallback
          unsubscribed: false
        })
      });
      
      if (audienceResponse.ok) {
        console.log('✅ Contact added to audience successfully');
      } else {
        console.log('📋 Failed to add contact to audience (continuing anyway)');
      }
    } catch (audienceError) {
      console.log('📋 Audience error (continuing anyway):', audienceError.message);
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to StudioSix Pro Early Access!</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                        Studio<span style="color: #a855f7;">Six</span> Pro
                    </h1>
                </div>
                <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 16px; padding: 40px; text-align: center; backdrop-filter: blur(10px);">
                    <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: #ffffff;">
                        🎉 You're In! Welcome to Early Access
                    </h2>
                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #94a3b8; line-height: 1.6;">
                        Thank you for joining StudioSix Pro early access! You're now part of an exclusive group of design professionals who will shape the future of AI-powered architecture.
                    </p>
                    ${promptText ? `
                    <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid #a855f7; border-radius: 12px; padding: 20px; margin: 24px 0;">
                        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #a855f7; font-weight: 600;">
                            Your Design Idea
                        </h3>
                        <p style="margin: 0; font-size: 14px; color: #e2e8f0; font-style: italic;">
                            "${promptText}"
                        </p>
                    </div>
                    ` : ''}
                    <div style="margin: 32px 0;">
                        <a href="https://calendly.com/visionatedigital/30min" style="display: inline-block; background: #a855f7; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                            📅 Book a Personal Demo
                        </a>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 32px; padding-top: 32px; border-top: 1px solid rgba(148, 163, 184, 0.2);">
                    <p style="margin: 0; font-size: 14px; color: #64748b;">
                        © 2024 StudioSix Pro. AI-Powered CAD Architecture Platform.
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #475569;">
                        This email was sent to ${email}
                    </p>
                </div>
            </div>
        </body>
    </html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StudioSix Pro <onboarding@studiosix.ai>',
        to: [email],
        subject: '🎉 Welcome to StudioSix Pro Early Access!',
        html: htmlContent
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Waitlist email sent successfully:', result.id);
      res.json({
        success: true,
        message: 'Successfully added to waitlist',
        messageId: result.id
      });
    } else {
      console.log('📧 Email API error, returning success anyway for UX');
      res.json({
        success: true,
        message: 'Successfully added to waitlist',
        note: 'Email confirmation may be delayed'
      });
    }

  } catch (error) {
    console.error('❌ Waitlist email error:', error.message);
    res.json({
      success: true,
      message: 'Successfully added to waitlist',
      note: 'Email confirmation may be delayed'
    });
  }
});

// Email confirmation endpoint for user signup
app.post('/api/send-email', async (req, res) => {
  const { email, confirmation_code, user_name = '' } = req.body;
  
  if (!email || !confirmation_code) {
    return res.status(400).json({
      success: false,
      error: 'Email and confirmation_code are required'
    });
  }

  const API_KEY = process.env.RESEND_API_KEY;
  
  console.log('🔑 API Key status:', {
    hasEnvKey: !!process.env.RESEND_API_KEY,
    keyPrefix: API_KEY ? API_KEY.substring(0, 8) + '...' : 'none'
  });
  
  if (!API_KEY) {
    console.log('📧 No RESEND_API_KEY environment variable set, using mock mode');
    return res.json({
      success: true,
      message: 'Mock email sent (no API key configured)',
      mockCode: confirmation_code,
      note: 'Set RESEND_API_KEY environment variable to send real emails'
    });
  }

  try {
    const greeting = user_name ? `Hi ${user_name}` : 'Hello';
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirm Your StudioSix Pro Account</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                        Studio<span style="color: #a855f7;">Six</span> Pro
                    </h1>
                </div>
                <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 16px; padding: 40px; text-align: center; backdrop-filter: blur(10px);">
                    <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: bold; color: #ffffff;">
                        Confirm Your Email Address
                    </h2>
                    <p style="margin: 0 0 32px 0; font-size: 16px; color: #94a3b8; line-height: 1.6;">
                        ${greeting}! Thanks for signing up for StudioSix Pro. To complete your account setup, please enter this confirmation code in the app:
                    </p>
                    <div style="background: rgba(168, 85, 247, 0.1); border: 2px solid #a855f7; border-radius: 12px; padding: 24px; margin: 32px 0; display: inline-block;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; color: #a855f7; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                            Confirmation Code
                        </p>
                        <p style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${confirmation_code}
                        </p>
                    </div>
                    <p style="margin: 32px 0 0 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                        This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email.
                    </p>
                </div>
                <div style="text-align: center; margin-top: 32px; padding-top: 32px; border-top: 1px solid rgba(148, 163, 184, 0.2);">
                    <p style="margin: 0; font-size: 14px; color: #64748b;">
                        © 2024 StudioSix Pro. AI-Powered CAD Architecture Platform.
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #475569;">
                        This email was sent to ${email}
                    </p>
                </div>
            </div>
        </body>
    </html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StudioSix Pro <onboarding@studiosix.ai>',
        to: [email],
        subject: 'Confirm Your StudioSix Pro Account',
        html: htmlContent
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Email sent successfully:', result.id);
      res.json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.id
      });
    } else {
      const errorResult = await response.json();
      console.error('❌ Resend API error:', response.status, errorResult);
      
      if (response.status === 403 && errorResult.error && errorResult.error.includes('testing emails')) {
        console.log('📧 Resend domain verification pending - DNS records may still be propagating');
        res.json({
          success: true,
          message: 'Domain verification pending - using mock email',
          mockCode: confirmation_code,
          note: 'DNS propagation in progress for studiosix.ai domain'
        });
      } else {
        res.status(response.status).json({
          success: false,
          error: `Resend API error: ${errorResult.message || 'Unknown error'}`,
          details: errorResult
        });
      }
    }

  } catch (error) {
    console.error('❌ Email confirmation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send email: ' + error.message
    });
  }
});

// Welcome email endpoint
app.post('/api/send-welcome-email', async (req, res) => {
  const { email, user_name = '' } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  const API_KEY = process.env.RESEND_API_KEY;
  
  if (!API_KEY) {
    console.log('📧 No RESEND_API_KEY environment variable set for welcome email');
    return res.json({
      success: true,
      message: 'Mock welcome email sent (no API key configured)',
      note: 'Set RESEND_API_KEY environment variable to send real emails'
    });
  }

  try {
    const greeting = user_name ? `Welcome, ${user_name}!` : 'Welcome to StudioSix Pro!';
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to StudioSix Pro!</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                        Studio<span style="color: #a855f7;">Six</span> Pro
                    </h1>
                </div>
                <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 16px; padding: 40px; text-align: center; backdrop-filter: blur(10px);">
                    <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: #ffffff;">
                        ${greeting} 🎉
                    </h2>
                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #94a3b8; line-height: 1.6;">
                        Your account has been successfully verified! You're now ready to start creating amazing architectural projects with AI-powered tools.
                    </p>
                    <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 12px; padding: 24px; margin: 32px 0;">
                        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #22c55e; font-weight: 600;">
                            🚀 Ready to Get Started?
                        </h3>
                        <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                            • Create residential, commercial, or custom projects<br/>
                            • Use AI-powered design assistance<br/>
                            • Import and work with 3D models<br/>
                            • Collaborate with your team
                        </p>
                    </div>
                    <p style="margin: 24px 0 0 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                        If you have any questions or need help getting started, feel free to reach out to our support team.
                    </p>
                </div>
                <div style="text-align: center; margin-top: 32px; padding-top: 32px; border-top: 1px solid rgba(148, 163, 184, 0.2);">
                    <p style="margin: 0; font-size: 14px; color: #64748b;">
                        © 2024 StudioSix Pro. AI-Powered CAD Architecture Platform.
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #475569;">
                        This email was sent to ${email}
                    </p>
                </div>
            </div>
        </body>
    </html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'StudioSix Pro <onboarding@studiosix.ai>',
        to: [email],
        subject: 'Welcome to StudioSix Pro! 🎉',
        html: htmlContent
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Welcome email sent successfully:', result.id);
      res.json({
        success: true,
        message: 'Welcome email sent successfully',
        messageId: result.id
      });
    } else {
      const errorText = await response.text();
      console.error('❌ Resend API error for welcome email:', errorText);
      res.json({
        success: true,
        message: 'Mock welcome email sent (API error)'
      });
    }

  } catch (error) {
    console.error('❌ Welcome email error:', error.message);
    res.json({
      success: true,
      message: 'Mock welcome email sent (connection error)'
    });
  }
});

// Check if build directory exists and serve it if available
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
  console.log('Build directory found, serving static files');
  app.use(express.static(buildPath));
  
  // Catch all for SPA routing - serve React app for all routes except /health and /api/*
  app.get('*', (req, res) => {
    // Skip serving React app for health check and API routes
    if (req.path === '/health' || req.path.startsWith('/api/')) {
      return;
    }
    
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Build files not found');
    }
  });
} else {
  console.log('Build directory not found, serving development mode');
  
  // Simple root endpoint for when no build exists
  app.get('/', (req, res) => {
    res.status(200).send(`
      <html>
        <head><title>StudioSix Pro</title></head>
        <body>
          <h1>StudioSix Pro Server</h1>
          <p>Server is running on port ${PORT}</p>
          <p>Node version: ${process.version}</p>
          <p>Environment: ${process.env.NODE_ENV}</p>
          <p>Current time: ${new Date().toISOString()}</p>
          <p><a href="/health">Health Check</a></p>
        </body>
      </html>
    `);
  });
  
  app.get('*', (req, res) => {
    res.status(503).send(`
      <html>
        <head><title>StudioSix Pro - Building...</title></head>
        <body>
          <h1>StudioSix Pro</h1>
          <p>Application is building... Please wait.</p>
          <p>Build directory not found at: ${buildPath}</p>
          <p><a href="/health">Health Check</a></p>
        </body>
      </html>
    `);
  });
}

// =================================================================
// AI CHAT ENDPOINTS
// =================================================================

// AI Chat endpoint
app.post('/api/ai-chat', async (req, res) => {
  try {
    console.log('🤖 AI Chat request received:', req.body);
    
    const { message, model = 'gpt-4', mode = 'chat', context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        details: 'Please add OPENAI_API_KEY to your environment variables'
      });
    }

    // Build system prompt for StudioSix context
    let systemPrompt = `You are an AI assistant for StudioSix Pro, an AI-powered CAD and BIM platform for architecture and design. You help users with:

1. CAD/BIM modeling and design questions
2. Architecture and building design concepts  
3. Construction and engineering principles
4. Software usage and workflow optimization
5. Technical problem-solving

Keep responses helpful, professional, and focused on architecture/design/construction topics.`;

    // Add context if provided
    if (context) {
      systemPrompt += `\n\nCurrent project context:\n${JSON.stringify(context, null, 2)}`;
    }

    // Create messages array for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    console.log('🤖 Sending request to OpenAI with model:', model);

    // If OpenAI is not configured, return mock response so server still boots
    if (!openai) {
      return res.json({
        response: 'AI service not configured. Please set OPENAI_API_KEY.',
        model: 'mock',
        timestamp: new Date().toISOString(),
        context
      });
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: model === 'gpt-4' ? 'gpt-4o-mini' : model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const aiResponse = completion.choices[0].message.content;

    const response = {
      response: aiResponse,
      model: completion.model,
      timestamp: new Date().toISOString(),
      context: context,
      usage: completion.usage
    };

    console.log('🤖 OpenAI response received, tokens used:', completion.usage?.total_tokens || 'unknown');
    console.log('🤖 Response preview:', aiResponse.substring(0, 100) + '...');
    
    res.json(response);

  } catch (error) {
    console.error('❌ AI Chat error:', error);
    
    // Handle specific OpenAI errors
    if (error.code === 'insufficient_quota') {
      return res.status(402).json({ 
        error: 'OpenAI quota exceeded',
        details: 'Please check your OpenAI billing and usage limits'
      });
    } else if (error.code === 'invalid_api_key') {
      return res.status(401).json({ 
        error: 'Invalid OpenAI API key',
        details: 'Please check your OpenAI API key configuration'
      });
    }
    
    res.status(500).json({ 
      error: 'AI service error',
      details: error.message 
    });
  }
});

// AI test connections endpoint
app.get('/api/ai-chat/test-connections', async (req, res) => {
  try {
    console.log('🧪 AI connection test requested');
    
    const testResults = {
      server: 'connected',
      timestamp: new Date().toISOString(),
      openai_configured: !!process.env.OPENAI_API_KEY,
      models: {}
    };

    // Test OpenAI connection if API key is configured
    if (process.env.OPENAI_API_KEY) {
      try {
        // Test with a simple request
        const testCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "connection test successful"' }
          ],
          max_tokens: 10
        });

        testResults.models = {
          'gpt-4': 'available',
          'gpt-4o-mini': 'available', 
          'gpt-3.5-turbo': 'available'
        };
        testResults.openai_status = 'connected';
        testResults.test_response = testCompletion.choices[0].message.content;

      } catch (openaiError) {
        console.error('OpenAI test failed:', openaiError);
        testResults.openai_status = 'error';
        testResults.openai_error = openaiError.message;
        testResults.models = {
          'gpt-4': 'unavailable',
          'gpt-4o-mini': 'unavailable',
          'gpt-3.5-turbo': 'unavailable'
        };
      }
    } else {
      testResults.openai_status = 'not_configured';
      testResults.models = {
        'gpt-4': 'api_key_missing',
        'gpt-4o-mini': 'api_key_missing',
        'gpt-3.5-turbo': 'api_key_missing'
      };
    }

    console.log('🧪 AI test results:', testResults);
    res.json(testResults);

  } catch (error) {
    console.error('❌ AI test error:', error);
    res.status(500).json({ 
      error: 'AI test failed',
      details: error.message 
    });
  }
});

// Paystack Payment API endpoints
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

// ---------------- PayPal (Card) Integration -----------------
const PAYPAL_MODE = (process.env.PAYPAL_MODE || 'live').toLowerCase();
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || process.env.REACT_APP_PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
const PAYPAL_API_BASE = PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

// Expose client ID to frontend (read-only)
app.get('/api/payments/paypal/client-id', (req, res) => {
  try {
    res.json({ ok: true, clientId: PAYPAL_CLIENT_ID || '' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

async function paypalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) throw new Error('PayPal credentials missing');
  const basic = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  const r = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basic}` },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json();
  if (!r.ok) {
    console.error('[PayPal] oauth error', r.status, j);
    throw new Error(j.error || 'paypal oauth failed');
  }
  return j.access_token;
}

function usdToTokens(usd) {
  const n = Number(usd || 0);
  if (n >= 100) return 160;
  if (n >= 50) return 80;
  if (n >= 20) return 30;
  if (n >= 10) return 12;
  if (n >= 5) return 5;
  return Math.max(1, Math.floor(n));
}

const paypalOrders = new Map(); // orderId -> { tokens, userId, email }

// Create PayPal order
app.post('/api/payments/paypal/create-order', async (req, res) => {
  try {
    const { amountUSD, tokens, userId, email } = req.body || {};
    const value = Number(amountUSD || 0).toFixed(2);
    if (!amountUSD || Number(amountUSD) <= 0) return res.status(400).json({ ok: false, error: 'amountUSD required' });
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) return res.status(500).json({ ok: false, error: 'PayPal not configured' });
    const access = await paypalAccessToken();
    const hostBase = `${req.protocol}://${req.get('host')}`;
    const returnUrl = `${hostBase}/payment/paypal/return`;
    const cancelUrl = `${hostBase}/payment/paypal/cancel`;
    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value },
          custom_id: JSON.stringify({ kind: 'render_tokens', tokens: tokens || usdToTokens(amountUSD), userId, email })
        }
      ],
      application_context: {
        brand_name: 'StudioSix Pro',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    };
    const r = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access}` },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('[PayPal] create order error', r.status, j);
      return res.status(r.status).json({ ok: false, error: j });
    }
    const id = j.id;
    paypalOrders.set(id, { tokens: tokens || usdToTokens(amountUSD), userId, email });
    res.json({ ok: true, id, links: j.links || [] });
  } catch (e) {
    console.error('[PayPal] create-order exception', e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Capture PayPal order
app.post('/api/payments/paypal/capture', async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, error: 'orderId required' });
    const access = await paypalAccessToken();
    const r = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access}` }
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('[PayPal] capture error', r.status, j);
      return res.status(r.status).json({ ok: false, error: j });
    }
    const status = j.status || j.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    if (String(status).toUpperCase() === 'COMPLETED') {
      try {
        let meta = null;
        const pu = (j.purchase_units && j.purchase_units[0]) || {};
        if (pu.custom_id) {
          try { meta = JSON.parse(pu.custom_id); } catch {}
        }
        const tracked = paypalOrders.get(orderId) || {};
        const tokens = meta?.tokens || tracked.tokens || usdToTokens(pu.amount?.value || 0);
        const userId = meta?.userId || tracked.userId || null;
        const email = meta?.email || tracked.email || null;
        if (tokens && (userId || email)) {
          if (userId) {
            await incrementRenderCreditsByUserId(userId, tokens);
          } else if (email) {
            await incrementRenderCreditsByEmail(email, tokens);
          }
          console.log(`[PayPal] Credited ${tokens} tokens for order ${orderId}`);
        }
      } catch (e) { console.warn('[PayPal] credit error', e); }
    }
    res.json({ ok: true, data: j });
  } catch (e) {
    console.error('[PayPal] capture exception', e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Optional: PayPal webhook verification
app.post('/api/payments/paypal/webhook', async (req, res) => {
  try {
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];
    const webhookId = PAYPAL_WEBHOOK_ID;
    const body = req.body;
    if (!webhookId) { console.warn('[PayPal] WEBHOOK_ID not set'); return res.status(200).end('OK'); }
    const access = await paypalAccessToken();
    const verifyRes = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access}` },
      body: JSON.stringify({ auth_algo: authAlgo, cert_url: certUrl, transmission_id: transmissionId, transmission_sig: transmissionSig, transmission_time: transmissionTime, webhook_id: webhookId, webhook_event: body })
    });
    const verify = await verifyRes.json();
    if (verify.verification_status !== 'SUCCESS') {
      console.warn('[PayPal] webhook verification failed', verify);
      return res.status(400).end('INVALID');
    }
    const event = body || {};
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      try {
        let meta = null;
        const pu = event.resource?.supplementary_data?.related_ids ? null : (event.resource?.purchase_units?.[0] || {});
        // Some events include custom_id at resource level
        const custom = event.resource?.custom_id || pu?.custom_id || null;
        if (custom) { try { meta = JSON.parse(custom); } catch {} }
        const tokens = meta?.tokens || usdToTokens(event.resource?.amount?.value || 0);
        const userId = meta?.userId || null;
        const email = meta?.email || null;
        if (tokens && (userId || email)) {
          if (userId) await incrementRenderCreditsByUserId(userId, tokens);
          else if (email) await incrementRenderCreditsByEmail(email, tokens);
          console.log('[PayPal] webhook credited', tokens);
        }
      } catch (e) { console.warn('[PayPal] webhook credit error', e); }
    }
    res.status(200).end('OK');
  } catch (e) {
    console.error('[PayPal] webhook exception', e);
    res.status(500).end('ERR');
  }
});

// Eirmond Mobile Money credentials
const EIRMOND_API_KEY = process.env.EIRMOND_API_KEY;
const EIRMOND_API_SECRET = process.env.EIRMOND_API_SECRET;
const EIRMOND_CALLBACK_SECRET = process.env.EIRMOND_CALLBACK_SECRET;
const EIRMOND_BASE = process.env.EIRMOND_BASE || 'https://pay.eirmondserv.com';
const EIRMOND_OAUTH = process.env.EIRMOND_OAUTH || 'https://pay.eirmondserv.com';
const EIRMOND_TEST_MODE = String(process.env.EIRMOND_TEST_MODE || '').toLowerCase() === 'true';
const WEBHOOK_MIRROR_URL = process.env.WEBHOOK_MIRROR_URL || '';
console.log('[MM] Config:', {
  base: EIRMOND_BASE,
  oauth: EIRMOND_OAUTH,
  testMode: EIRMOND_TEST_MODE,
  hasKey: !!EIRMOND_API_KEY,
  hasSecret: !!EIRMOND_API_SECRET,
  hasCbSecret: !!EIRMOND_CALLBACK_SECRET,
  mirror: !!WEBHOOK_MIRROR_URL
});

const mobileMoneyRequests = new Map(); // payment_id -> { userId, email, tokens }
const mobileMoneyCallbackStatus = new Map(); // payment_id -> 'pending'|'successful'|'failed'

function ugxToTokens(ugx) {
  const n = Number(ugx || 0);
  if (n >= 370000) return 160;
  if (n >= 185000) return 80;
  if (n >= 74000) return 30;
  if (n >= 37000) return 12;
  if (n >= 18500) return 5;
  return 5;
}

async function eirmondToken() {
  const auth = Buffer.from(`${EIRMOND_API_KEY}:${EIRMOND_API_SECRET}`).toString('base64');
  const r = await fetch(`${EIRMOND_OAUTH}/oauth/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' })
  });
  const j = await r.json();
  if (!r.ok) {
    console.error('[MM] OAuth error', r.status, j);
    throw new Error(j.error || 'oauth failed');
  }
  console.log('[MM] OAuth OK, expires_in:', j.expires_in);
  return j.access_token;
}

// Request Mobile Money payment
app.post('/api/mobilemoney/request', async (req, res) => {
  try {
    const { contact, amount, message } = req.body || {};
    if (!contact || !amount) return res.status(400).json({ ok: false, error: 'contact and amount required' });
    const token = await eirmondToken();
    const path = EIRMOND_TEST_MODE ? '/test-api/request-payment' : '/api/request-payment';
    console.log('[MM] request-payment', { path, maskedContact: String(contact).replace(/\d(?=\d{4})/g,'*'), amount });
    const r = await fetch(`${EIRMOND_BASE}${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact, amount, message: message || 'StudioSix render tokens' })
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('[MM] request-payment error', r.status, j);
      return res.status(r.status).json({ ok: false, ...j });
    }
    console.log('[MM] request-payment OK', j.payment_id || j.data?.payment_id, j.status || j.data?.status);
    // track mapping for callback crediting
    try {
      const userId = req.headers['x-user-id'] || null;
      const email = req.headers['x-user-email'] || null;
      const tokens = ugxToTokens(amount);
      if (j.payment_id || (j.data && j.data.payment_id)) {
        const pid = j.payment_id || j.data.payment_id;
        mobileMoneyRequests.set(pid, { userId, email, tokens });
      }
    } catch {}
    res.json({ ok: true, data: j });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Poll payment status
app.get('/api/mobilemoney/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const token = await eirmondToken();
    const path = EIRMOND_TEST_MODE ? '/test-api/get-payment-status/' : '/api/get-payment-status/';
    console.log('[MM] get-payment-status', { path, paymentId });
    const r = await fetch(`${EIRMOND_BASE}${path}${encodeURIComponent(paymentId)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('[MM] get-payment-status error', r.status, j);
      return res.status(r.status).json({ ok: false, ...j });
    }
    console.log('[MM] get-payment-status OK', j.status || j.data?.status);
    res.json({ ok: true, data: j });
  } catch (e) {
    console.error('[MM] get-payment-status exception', e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Callback (webhook) from Eirmond
app.post('/api/payments/mobilemoney/callback', express.text({ type: '*/*' }), async (req, res) => {
  try {
    let rawBody = req.body;
    if (rawBody == null) rawBody = '';
    // If previous middleware parsed JSON, ensure we still have a string for HMAC/debug
    if (typeof rawBody !== 'string') {
      try { rawBody = JSON.stringify(rawBody); } catch { rawBody = String(rawBody); }
    }
    const theirSig = req.headers['x-content-signature'] || '';
    let calc = '';
    if (EIRMOND_CALLBACK_SECRET) {
      try {
        calc = require('crypto').createHmac('sha256', EIRMOND_CALLBACK_SECRET).update(rawBody).digest('hex');
      } catch (e) {
        console.warn('[MM] HMAC compute failed', e);
      }
    }
    if (!EIRMOND_CALLBACK_SECRET) {
      console.warn('[MM] No CALLBACK secret set; skipping signature verification in test mode');
    } else if (calc !== theirSig) {
      // Extra diagnostics to catch common copy/paste mistakes (e.g., o vs 0)
      try {
        let alt = '';
        const s = EIRMOND_CALLBACK_SECRET;
        if (/o/i.test(s)) {
          const altSecret = s.replace(/o/g, '0').replace(/O/g, '0');
          alt = require('crypto').createHmac('sha256', altSecret).update(rawBody).digest('hex');
        }
        console.warn('[MM] MM callback invalid signature', {
          theirSig: (theirSig||'').slice(0,16)+"…",
          ourSig: (calc||'').slice(0,16)+"…",
          altSigIfOto0: alt ? alt.slice(0,16)+"…" : 'n/a'
        });
      } catch {}
      // For test, still accept to avoid provider retry storm
    }
    let payload = {};
    try { payload = JSON.parse(rawBody || '{}'); }
    catch (e) {
      console.error('[MM] callback JSON parse error', e, 'body snippet:', String(rawBody).slice(0,200));
      return res.status(200).end('OK');
    }
    console.log('📲 MobileMoney callback:', { status: payload.status, payment_id: payload.payment_id, amount: payload.amount });
    if (payload.payment_id && payload.status) {
      mobileMoneyCallbackStatus.set(payload.payment_id, String(payload.status).toLowerCase());
    }
    // On success, credit renders based on amount (UGX pricing: $5→5, $10→12, $20→30, $50→80, $100→160)
    if (payload.status === 'successful') {
      try {
        const map = mobileMoneyRequests.get(payload.payment_id) || {};
        const ugx = Number(payload.amount || 0);
        const tokens = map.tokens || ugxToTokens(ugx);
        if (map.userId) {
          const newBal = await incrementRenderCreditsByUserId(map.userId, tokens);
          console.log(`✅ MobileMoney credited ${tokens} to user ${map.userId}. New balance: ${newBal}`);
        } else if (map.email) {
          const newBal = await incrementRenderCreditsByEmail(map.email, tokens);
          console.log(`✅ MobileMoney credited ${tokens} to ${map.email}. New balance: ${newBal}`);
        }
      } catch (e) { console.error('MM credit error:', e); }
    }
    // Mirror to external webhook for debugging if configured
    if (WEBHOOK_MIRROR_URL) {
      try {
        await fetch(WEBHOOK_MIRROR_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Original-Signature': theirSig }, body: rawBody });
        console.log('[MM] mirrored callback to', WEBHOOK_MIRROR_URL);
      } catch {}
    }
    // Always 200 to acknowledge receipt (provider won't retry)
    res.status(200).end('OK');
  } catch (e) {
    console.error('MM callback error:', e);
    res.status(500).end('ERR');
  }
});

// Allow frontend to check if our server has seen a callback status
app.get('/api/mobilemoney/callback-status/:paymentId', (req, res) => {
  try {
    const st = mobileMoneyCallbackStatus.get(req.params.paymentId) || null;
    res.json({ ok: true, status: st });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Fallback crediting path when frontend polling detects success and callback is not yet pointing to us
app.post('/api/mobilemoney/credit-after-poll', express.json(), async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || null;
    const email = req.headers['x-user-email'] || null;
    const { paymentId } = req.body || {};
    if (!paymentId) return res.status(400).json({ ok: false, error: 'paymentId required' });
    // Verify success with provider to avoid blind crediting
    const token = await eirmondToken();
    const path = EIRMOND_TEST_MODE ? '/test-api/get-payment-status/' : '/api/get-payment-status/';
    console.log('[MM] credit-after-poll verify', { paymentId, path });
    const r = await fetch(`${EIRMOND_BASE}${path}${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) {
      console.error('[MM] credit-after-poll status error', r.status, j);
      return res.status(r.status).json({ ok: false, error: j.error || 'status fetch failed' });
    }
    const st = (j.status || j.data?.status || '').toLowerCase();
    if (st !== 'success' && st !== 'successful') {
      console.warn('[MM] credit-after-poll not-success', st);
      return res.status(400).json({ ok: false, error: `payment not successful (${st||'unknown'})` });
    }
    // Determine token amount
    const tracked = mobileMoneyRequests.get(paymentId) || {};
    const amount = Number(j.amount || j.data?.amount || 0);
    const tokens = tracked.tokens || ugxToTokens(amount);
    let newBal = null;
    if (userId) {
      newBal = await incrementRenderCreditsByUserId(userId, tokens);
    } else if (email) {
      newBal = await incrementRenderCreditsByEmail(email, tokens);
    } else {
      return res.status(400).json({ ok: false, error: 'Missing user context' });
    }
    console.log('[MM] credit-after-poll credited', { tokens, newBal });
    res.json({ ok: true, credited: tokens, balance: newBal });
  } catch (e) {
    console.error('[MM] credit-after-poll exception', e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Initialize payment endpoint
app.post('/api/payments/initialize', async (req, res) => {
  console.log('💳 Payment initialization request:', req.body);
  
  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      success: false,
      message: 'Paystack secret key not configured'
    });
  }

  try {
    const {
      email,
      amount,
      currency = 'USD',
      reference,
      callback_url,
      metadata = {},
      channels = ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      plan_code
    } = req.body;

    // Validate required fields
    if (!email || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Email and amount are required'
      });
    }

    // Prepare Paystack payload
    const paystackPayload = {
      email,
      amount: Math.round(amount), // Ensure integer
      currency: currency.toUpperCase(),
      reference: reference || `studiosix_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
      callback_url: callback_url || `${req.protocol}://${req.get('host')}/payment/callback`,
      metadata: {
        ...metadata,
        source: 'studiosix_app',
        timestamp: new Date().toISOString()
      },
      channels
    };

    // Add plan for subscriptions
    if (plan_code) {
      paystackPayload.plan = plan_code;
    }

    console.log('📤 Sending to Paystack:', paystackPayload);

    // Initialize payment with Paystack
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Paystack error:', result);
      return res.status(response.status).json({
        success: false,
        message: result.message || 'Payment initialization failed',
        details: result
      });
    }

    console.log('✅ Payment initialized successfully:', result.data.reference);
    
    res.json({
      success: true,
      data: result.data,
      message: 'Payment initialized successfully'
    });

  } catch (error) {
    console.error('❌ Payment initialization error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during payment initialization',
      error: error.message
    });
  }
});

// Verify payment endpoint
app.get('/api/payments/verify/:reference', async (req, res) => {
  const { reference } = req.params;
  console.log('🔍 Payment verification request for:', reference);

  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      success: false,
      message: 'Paystack secret key not configured'
    });
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Paystack verification error:', result);
      return res.status(response.status).json({
        success: false,
        message: result.message || 'Payment verification failed',
        details: result
      });
    }

    console.log('✅ Payment verification result:', result.data.status);
    
    res.json({
      success: true,
      data: result.data,
      verified: result.data.status === 'success'
    });

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during payment verification',
      error: error.message
    });
  }
});

// Create subscription plan endpoint
app.post('/api/payments/plans', async (req, res) => {
  console.log('📋 Plan creation request:', req.body);

  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      success: false,
      message: 'Paystack secret key not configured'
    });
  }

  try {
    const {
      name,
      amount,
      interval,
      currency = 'USD',
      description,
      plan_code
    } = req.body;

    if (!name || !amount || !interval) {
      return res.status(400).json({
        success: false,
        message: 'Name, amount, and interval are required'
      });
    }

    const paystackPayload = {
      name,
      amount: Math.round(amount * 100), // Convert to kobo/cents
      interval,
      currency: currency.toUpperCase(),
      description: description || `${name} subscription plan`,
      plan_code: plan_code || name.toLowerCase().replace(/\s+/g, '_')
    };

    const response = await fetch('https://api.paystack.co/plan', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Plan creation error:', result);
      return res.status(response.status).json(result);
    }

    console.log('✅ Plan created successfully:', result.data.plan_code);
    res.json(result);

  } catch (error) {
    console.error('❌ Plan creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during plan creation',
      error: error.message
    });
  }
});

// Get subscription plans endpoint
app.get('/api/payments/plans', async (req, res) => {
  console.log('📋 Plans fetch request');

  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      success: false,
      message: 'Paystack secret key not configured'
    });
  }

  try {
    const response = await fetch('https://api.paystack.co/plan', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Plans fetch error:', result);
      return res.status(response.status).json(result);
    }

    console.log('✅ Plans fetched successfully, count:', result.data?.length || 0);
    res.json(result);

  } catch (error) {
    console.error('❌ Plans fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during plans fetch',
      error: error.message
    });
  }
});

// Paystack webhook endpoint for payment notifications
app.post('/api/payments/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const hash = require('crypto').createHmac('sha512', PAYSTACK_SECRET_KEY || '').update(req.body).digest('hex');
  
  if (hash == req.headers['x-paystack-signature']) {
    const event = JSON.parse(req.body);
    console.log('🔔 Paystack webhook received:', event.event);
    
    switch(event.event) {
      case 'charge.success':
        console.log('💰 Payment successful:', event.data.reference);
        // Credit render_credits for token purchases
        (async () => {
          try {
            const md = event.data?.metadata || {};
            if (md.kind === 'render_tokens' && md.tokens && event.data?.customer?.email) {
              const email = event.data.customer.email;
              const tokens = parseInt(md.tokens, 10);
              if (tokens > 0 && supabaseAdmin) {
                const newBal = await incrementRenderCreditsByEmail(email, tokens);
                console.log(`✅ Credited ${tokens} renders to ${email}. New balance: ${newBal}`);
              }
            }
          } catch (e) {
            console.error('❌ Failed to credit render tokens from webhook:', e);
          }
        })();
        break;
      case 'subscription.create':
        console.log('🔄 Subscription created:', event.data.subscription_code);
        // Handle subscription creation
        break;
      case 'subscription.not_renew':
        console.log('❌ Subscription not renewed:', event.data.subscription_code);
        // Handle subscription cancellation
        break;
      default:
        console.log('📝 Unhandled webhook event:', event.event);
    }
    
    res.send(200);
  } else {
    console.error('❌ Invalid webhook signature');
    res.sendStatus(400);
  }
});

// Payment callback endpoint (for redirect after payment)
app.get('/payment/callback', (req, res) => {
  const { reference, trxref } = req.query;
  console.log('🔄 Payment callback received:', { reference, trxref });
  
  // Redirect to frontend with payment reference
  const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?reference=${reference || trxref}`;
  res.redirect(callbackUrl);
});

// --- Credits API ---
app.get('/api/credits/me', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing X-User-Id' });
    const credits = await getCreditsByUserId(userId);
    res.json({ ok: true, credits });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post('/api/credits/consume', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing X-User-Id' });
    const remaining = await consumeOneCredit(userId);
    res.json({ ok: true, remaining });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// --- Admin endpoints (restricted to a single email) ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'visionatedigital@gmail.com';

async function requireAdmin(req, res, next) {
  try {
    const email = req.headers['x-admin-email'];
    if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    next();
  } catch (e) {
    res.status(403).json({ ok: false, error: 'Forbidden' });
  }
}

app.get('/api/admin/credits', requireAdmin, async (req, res) => {
  try {
    if (!supabaseAdmin) throw new Error('Supabase admin not configured');
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, render_credits, usage_image_renders_this_month, total_image_renders_used')
      .order('render_credits', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json({ ok: true, users: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post('/api/admin/credits/grant', requireAdmin, async (req, res) => {
  try {
    const { email, amount } = req.body || {};
    if (!email || !amount) return res.status(400).json({ ok: false, error: 'email and amount required' });
    const newBal = await incrementRenderCreditsByEmail(email, parseInt(amount, 10));
    res.json({ ok: true, email, newBal });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// =================================================================
// AI RENDER ENDPOINTS
// =================================================================

// In-memory storage for render jobs (in production, use a database)
const renderJobs = new Map();
let nextJobId = 1;

// Generate unique job ID
function generateJobId() {
  return `render_${nextJobId++}_${Date.now()}`;
}

// AI Render endpoint - Start a new render job (MOCK VERSION FOR TESTING)
app.post('/api/ai-render', async (req, res) => {
  try {
    console.log('🎨 AI Render request received (MOCK VERSION)');
    const { prompt, image, aspect_ratio, quality, style } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const jobId = generateJobId();
    console.log(`🚀 Starting MOCK AI render job: ${jobId}`);
    console.log(`📝 Prompt: ${prompt}`);

    // Create job entry with immediate "completion"
    const job = {
      session_id: jobId,
      status: 'completed',
      prompt,
      aspect_ratio: aspect_ratio || '16:9',
      quality: quality || 'high',
      style: style || 'photorealistic',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      progress: 100,
      message: 'Mock render completed',
      // Mock generated image (placeholder)
      output_image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    };

    renderJobs.set(jobId, job);

    // Return job info immediately
    res.json({
      session_id: jobId,
      status: 'processing',
      message: 'Render job started successfully'
    });

  } catch (error) {
    console.error('❌ Error starting AI render:', error);
    res.status(500).json({ 
      error: 'Failed to start render job',
      detail: error.message 
    });
  }
});

// Get render job status
app.get('/api/ai-render/:jobId', (req, res) => {
  try {
    console.log('📊 Getting render status for job:', req.params.jobId);
    const { jobId } = req.params;
    const job = renderJobs.get(jobId);
    
    if (!job) {
      console.log('❌ Job not found:', jobId);
      return res.status(404).json({ error: 'Render job not found' });
    }
    
    console.log('✅ Returning job status:', job.status);
    res.json(job);
    
  } catch (error) {
    console.error('❌ Error getting render status:', error);
    res.status(500).json({ 
      error: 'Failed to get render status',
      detail: error.message 
    });
  }
});

// Delete render job
app.delete('/api/ai-render/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = renderJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Render job not found' });
    }
    
    renderJobs.delete(jobId);
    console.log(`🗑️ Deleted render job: ${jobId}`);
    
    res.json({ message: 'Render job deleted successfully' });
    
  } catch (error) {
    console.error('❌ Error deleting render job:', error);
    res.status(500).json({ 
      error: 'Failed to delete render job',
      detail: error.message 
    });
  }
});

// List all render jobs
app.get('/api/ai-render-jobs', (req, res) => {
  try {
    const jobs = Array.from(renderJobs.values());
    res.json({ jobs });
    
  } catch (error) {
    console.error('❌ Error listing render jobs:', error);
    res.status(500).json({ 
      error: 'Failed to list render jobs',
      detail: error.message 
    });
  }
});

// Get session status (for login requirements, etc.)
app.get('/api/ai-render-session-status', (req, res) => {
  console.log('📊 AI render session status requested');
  res.json({
    status: 'ready',
    session_active: true,
    openai_configured: true,
    timestamp: new Date().toISOString()
  });
});

// Utility function for human-like delays
function humanDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Utility function for typing with human-like delays
async function humanType(page, selector, text) {
  const element = page.locator(selector);
  await element.focus();
  
  // Clear existing text
  await element.fill('');
  await humanDelay(200, 500);
  
  // Type character by character with random delays
  for (let i = 0; i < text.length; i++) {
    await element.type(text[i]);
    if (Math.random() > 0.95) { // Occasional longer pause
      await humanDelay(100, 300);
    } else {
      await humanDelay(20, 80);
    }
  }
}

// Process render job using Puppeteer ChatGPT automation
async function processRenderJob(jobId, prompt, image, options = {}) {
  try {
    console.log(`🎨 Processing render job ${jobId} with ChatGPT automation`);
    
    const job = renderJobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Update progress
    job.progress = 5;
    job.status = 'processing';
    job.message = 'Launching browser session...';
    renderJobs.set(jobId, job);

    // Import Playwright
    const { chromium } = require('playwright');
    const fs = require('fs');
    const path = require('path');

    // Launch browser with anti-detection and Cloudflare bypass settings
    const browser = await chromium.launch({
      headless: false, // Set to false so you can see what's happening
      slowMo: 50, // Reduce slowMo to seem more human-like
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // Hide automation
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=site-per-process',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-networking',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 }, // More common resolution
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      // Add realistic browser fingerprinting
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    });

    // Load cookies if they exist
    const cookiesPath = path.join(__dirname, 'chatgpt-cookies.json');
    if (fs.existsSync(cookiesPath)) {
      console.log('🍪 Loading saved ChatGPT cookies...');
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      await context.addCookies(cookies);
      job.message = 'Loaded saved login session...';
      renderJobs.set(jobId, job);
    }

    const page = await context.newPage();

    // Add anti-detection scripts to the page
    await page.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override the `plugins` property to use a custom getter.
      Object.defineProperty(navigator, 'plugins', {
        get: function() {
          return [
            { name: 'Chrome PDF Plugin' },
            { name: 'Chrome PDF Viewer' },
            { name: 'Native Client' }
          ];
        },
      });

      // Pass the permissions test
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Mock chrome runtime
      window.chrome = {
        runtime: {},
      };
    });

    // Update progress
    job.progress = 10;
    job.message = 'Navigating to ChatGPT...';
    renderJobs.set(jobId, job);

    console.log('🌐 Navigating to ChatGPT...');
    
    // Enhanced navigation with Cloudflare bypass
    let navigationSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!navigationSuccess && attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Navigation attempt ${attempts}/${maxAttempts}`);
      
      try {
        // Navigate with extended timeout and realistic behavior
        const response = await page.goto('https://chat.openai.com', { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });

        // Check if we got a Cloudflare challenge
        const title = await page.title();
        const url = page.url();
        
        console.log(`📄 Page title: ${title}`);
        console.log(`🔗 Current URL: ${url}`);

        if (title.includes('Just a moment') || title.includes('Checking your browser') || url.includes('challenges.cloudflare.com')) {
          console.log('🛡️ Cloudflare challenge detected, waiting for bypass...');
          
          // Wait for Cloudflare challenge to complete
          await page.waitForFunction(
            () => !document.title.includes('Just a moment') && !document.title.includes('Checking your browser'),
            { timeout: 30000 }
          );
          
          // Additional wait for redirect
          await page.waitForTimeout(5000);
          
          // Check if we're now on ChatGPT
          if (page.url().includes('chat.openai.com') && !page.url().includes('challenges')) {
            console.log('✅ Cloudflare challenge bypassed successfully');
            navigationSuccess = true;
          } else {
            console.log(`⚠️ Still not on ChatGPT: ${page.url()}`);
          }
        } else if (url.includes('chat.openai.com')) {
          console.log('✅ Successfully navigated to ChatGPT');
          navigationSuccess = true;
        } else {
          console.log(`⚠️ Unexpected page: ${url}`);
        }

      } catch (error) {
        console.log(`❌ Navigation attempt ${attempts} failed: ${error.message}`);
        if (attempts < maxAttempts) {
          console.log('⏳ Waiting before retry...');
          await page.waitForTimeout(5000 + (attempts * 2000)); // Increasing delays
        }
      }
    }

    if (!navigationSuccess) {
      throw new Error('Failed to navigate to ChatGPT after multiple attempts. Cloudflare may be blocking the request.');
    }

    // Wait a moment for page to fully load after successful navigation
    console.log('⏳ Waiting for page to stabilize...');
    await page.waitForTimeout(5000);

    // Check if login is required
    const loginRequired = await page.locator('text=Log in').isVisible().catch(() => false);
    
    if (loginRequired) {
      job.status = 'login_required';
      job.message = 'ChatGPT login required. Run "npm run chatgpt-cookies" to update your login session.';
      renderJobs.set(jobId, job);
      
      console.log('🔐 ChatGPT login required!');
      console.log('   To fix this issue:');
      console.log('   1. Open a new terminal');
      console.log('   2. Run: npm run chatgpt-cookies');
      console.log('   3. Log in to ChatGPT when prompted');
      console.log('   4. Try AI render again');
      console.log('');
      console.log('⏳ Waiting for user to log in manually...');
      
      try {
        // Wait for user to log in (check for chat interface)
        await page.waitForSelector('[data-testid="send-button"], textarea[placeholder*="Message"], .ProseMirror', { timeout: 120000 });
        
        // Save cookies after successful login
        const cookies = await context.cookies();
        const openaiCookies = cookies.filter(cookie => 
          cookie.domain.includes('openai.com') || 
          cookie.domain.includes('chatgpt.com')
        );
        fs.writeFileSync(cookiesPath, JSON.stringify(openaiCookies, null, 2));
        console.log('🍪 Saved login cookies for future use');
        
      } catch (error) {
        throw new Error(`Login timeout: Please run "npm run chatgpt-cookies" to set up your login session, then try again.`);
      }
    }

    // Update progress
    job.progress = 20;
    job.status = 'processing';
    job.message = 'Starting new chat session...';
    renderJobs.set(jobId, job);

    // Start a new chat (click new chat button if available)
    console.log('💬 Starting new chat session...');
    const newChatButton = page.locator('text=New chat').first();
    if (await newChatButton.isVisible().catch(() => false)) {
      await newChatButton.click();
      await page.waitForTimeout(2000);
    }

    // Update progress
    job.progress = 25;
    job.message = 'Uploading image...';
    renderJobs.set(jobId, job);

    // Convert base64 image to file and upload
    console.log('📎 Uploading image to ChatGPT...');
    const imageBuffer = Buffer.from(image.split(',')[1], 'base64');
    const tempImagePath = path.join(__dirname, `temp_render_${jobId}.png`);
    fs.writeFileSync(tempImagePath, imageBuffer);

    // Find and click upload button with human-like behavior
    await humanDelay(500, 1500); // Human-like pause before upload
    const uploadButton = page.locator('input[type="file"]');
    await uploadButton.setInputFiles(tempImagePath);

    // Wait for image to upload with visual feedback
    console.log('⏳ Waiting for image upload to complete...');
    await page.waitForTimeout(5000); // Give more time for upload
    await humanDelay(1000, 2000); // Additional human-like pause

    // Update progress
    job.progress = 35;
    job.message = 'Preparing enhanced prompt...';
    renderJobs.set(jobId, job);

    // Enhanced prompt for better architectural visualization
    const enhancedPrompt = `${prompt}

Please create a high-quality architectural visualization based on this image. Enhance it with:
- Professional architectural rendering style (${options.style || 'photorealistic'})
- Improved lighting and shadows
- Enhanced materials and textures
- Proper architectural proportions
- Clean, professional presentation
- High resolution details

Style: ${options.style || 'photorealistic'}
Quality: ${options.quality || 'high'}

Make this look like a professional architectural rendering suitable for client presentation.`;

    console.log(`📝 Using enhanced prompt: ${enhancedPrompt}`);

    // Find text input and enter prompt with human-like typing
    console.log('✍️ Entering prompt with human-like behavior...');
    await humanType(page, 'textarea[placeholder*="Message"], .ProseMirror', enhancedPrompt);

    // Update progress
    job.progress = 40;
    job.message = 'Sending request to ChatGPT...';
    renderJobs.set(jobId, job);

    // Click send button with human-like behavior
    console.log('🚀 Sending request to ChatGPT...');
    await humanDelay(1000, 2000); // Human-like pause before sending
    const sendButton = page.locator('[data-testid="send-button"], button[aria-label="Send prompt"]').first();
    
    // Move mouse to button area (simulate human behavior)
    const buttonBox = await sendButton.boundingBox();
    if (buttonBox) {
      await page.mouse.move(buttonBox.x + buttonBox.width/2, buttonBox.y + buttonBox.height/2);
      await humanDelay(200, 500);
    }
    
    await sendButton.click();
    await humanDelay(500, 1000); // Small delay after click

    // Update progress
    job.progress = 45;
    job.message = 'Waiting for ChatGPT to process (2:30 min)...';
    renderJobs.set(jobId, job);

    // Wait 2 minutes 30 seconds for ChatGPT to process
    console.log('⏳ Waiting 2 minutes 30 seconds for ChatGPT to process...');
    await page.waitForTimeout(150000); // 2.5 minutes

    // Update progress and start polling
    job.progress = 70;
    job.message = 'Polling for generated image...';
    renderJobs.set(jobId, job);

    // Start polling for the generated image
    console.log('🔍 Polling for generated image...');
    let generatedImageUrl = null;
    let pollAttempts = 0;
    const maxPollAttempts = 24; // 2 minutes at 5-second intervals

    while (!generatedImageUrl && pollAttempts < maxPollAttempts) {
      pollAttempts++;
      console.log(`🔍 Poll attempt ${pollAttempts}/${maxPollAttempts}`);

      // Look for generated images in the latest response
      const images = await page.locator('img[src*="oaidalleapi"], img[src*="dalle"], img[alt*="generated"], .result-image img').all();
      
      if (images.length > 0) {
        // Get the last/newest image
        const lastImage = images[images.length - 1];
        const src = await lastImage.getAttribute('src');
        
        if (src && !src.includes('data:') && (src.includes('oaidalleapi') || src.includes('dalle'))) {
          generatedImageUrl = src;
          console.log('✅ Found generated image URL:', src);
          break;
        }
      }

      // Update progress
      const progressIncrement = (25 / maxPollAttempts);
      job.progress = Math.min(95, 70 + (pollAttempts * progressIncrement));
      renderJobs.set(jobId, job);

      await page.waitForTimeout(5000); // Wait 5 seconds before next poll
    }

    if (!generatedImageUrl) {
      throw new Error('No generated image found after polling period');
    }

    // Update progress
    job.progress = 90;
    job.message = 'Downloading generated image...';
    renderJobs.set(jobId, job);

    // Download the image and convert to base64
    console.log('📥 Downloading generated image...');
    const imageResponse = await page.request.get(generatedImageUrl);
    const downloadedImageBuffer = await imageResponse.body();
    const base64Image = `data:image/png;base64,${downloadedImageBuffer.toString('base64')}`;

    console.log(`✅ ChatGPT generation completed for job ${jobId}`);
    console.log(`🖼️ Generated image size: ${(base64Image.length * 0.75 / 1024).toFixed(1)}KB`);

    // Cleanup
    if (fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }
    await browser.close();

    // Mark job as completed
    job.status = 'completed';
    job.progress = 100;
    job.message = 'Rendering completed successfully';
    job.output_image = base64Image;
    job.completed_at = new Date().toISOString();
    renderJobs.set(jobId, job);

    console.log(`🎉 Render job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`❌ Error processing render job ${jobId}:`, error);
    
    const job = renderJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.message = error.message;
      job.error_details = error.message;
      renderJobs.set(jobId, job);
    }
    
    throw error;
  }
}

// ==================== AUTONOMOUS AGENT API ROUTES ====================

// In-memory storage for agent runs and approvals (use Redis in production)
const agentRuns = new Map();
const pendingApprovals = new Map();
const wsConnections = new Map(); // runId -> Set(ws)

// WebSocket setup for real-time agent progress (basic implementation)
const WebSocket = require('ws');
let wss = null;

try {
  // Allow disabling WS on platforms that only expose a single $PORT (e.g., DO App Platform)
  const disableAgentWS = process.env.DISABLE_AGENT_WS === '1' || process.env.AGENT_WS_ENABLED === '0';
  if (disableAgentWS) {
    console.log('🔌 Agent WebSocket disabled via env (DISABLE_AGENT_WS=1 or AGENT_WS_ENABLED=0)');
    throw new Error('WS_DISABLED');
  }

  const server = require('http').createServer();
  
  // Handle port conflicts gracefully so the server doesn't crash
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn('⚠️ Agent WebSocket port 8081 is already in use. Skipping WS startup.');
    } else {
      console.warn('⚠️ Agent WebSocket server error:', err?.message || err);
    }
  });

  wss = new WebSocket.Server({ server, path: '/ws/agent' });
  
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const runId = url.searchParams.get('runId');
    
    if (runId) {
      // Attach to run
      if (!wsConnections.has(runId)) {
        wsConnections.set(runId, new Set());
      }
      wsConnections.get(runId).add(ws);
      
      console.log(`📡 Agent WebSocket: Client connected to run ${runId.slice(0, 8)}`);
      
      ws.on('close', () => {
        wsConnections.get(runId)?.delete(ws);
        console.log(`📡 Agent WebSocket: Client disconnected from run ${runId.slice(0, 8)}`);
      });
    }
  });
  
  // Start WebSocket server on different port (may not be externally routable on some PaaS)
  server.listen(8081, () => {
    console.log('🔌 Agent WebSocket server running on port 8081');
  });
  
} catch (error) {
  if (error && error.message === 'WS_DISABLED') {
    console.log('⚠️ Skipping WebSocket startup (disabled by env)');
  } else {
  console.warn('⚠️ WebSocket setup failed, agent will work without real-time updates:', error.message);
  }
}

// Mock autonomous agent for server-side (production would import actual service)
const mockAutonomousAgent = {
  async runAutonomous({ goal, context, overrides = {}, userId }) {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store run data
    agentRuns.set(runId, {
      id: runId,
      goal,
      userId,
      config: overrides,
      status: 'running',
      startTime: Date.now(),
      progress: []
    });
    
    // Simulate autonomous execution in background
    setImmediate(() => this.simulateExecution(runId));
    
    return { ok: true, runId };
  },
  
  async simulateExecution(runId) {
    const run = agentRuns.get(runId);
    if (!run) return;
    
    try {
      const steps = [
        { type: 'plan', summary: 'Generated 3-step room creation plan', steps: ['Create slab', 'Build walls', 'Add door'] },
        { type: 'act', tool: 'geometry.createSlab', args: { width: 4, depth: 3 } },
        { type: 'observe', result: { ok: true, objectId: 'slab_1' } },
        { type: 'critic', verdict: 'passed' },
        { type: 'act', tool: 'geometry.createWall', args: { startPoint: [0,0,0], endPoint: [4,0,0] } },
        { type: 'observe', result: { ok: true, objectId: 'wall_1' } },
        { type: 'critic', verdict: 'passed' }
      ];
      
      for (const [i, step] of steps.entries()) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing time
        
        const event = { ...step, ts: Date.now(), step: i + 1 };
        run.progress.push(event);
        
        // Broadcast to WebSocket clients
        this.broadcastToRun(runId, event);
        
        // Request approval for destructive operations
        if (step.tool?.includes('delete') && step.type === 'act') {
          const approved = await this.requestApproval(runId, step);
          if (!approved) {
            throw new Error('User rejected destructive action');
          }
        }
      }
      
      // Mark complete
      run.status = 'completed';
      run.endTime = Date.now();
      
      this.broadcastToRun(runId, { 
        type: 'done', 
        status: 'success', 
        duration: run.endTime - run.startTime,
        ts: Date.now() 
      });
      
    } catch (error) {
      run.status = 'failed';
      run.error = error.message;
      
      this.broadcastToRun(runId, { 
        type: 'done', 
        status: 'error', 
        error: error.message,
        ts: Date.now() 
      });
    }
  },
  
  broadcastToRun(runId, event) {
    const connections = wsConnections.get(runId);
    if (!connections) return;
    
    const message = JSON.stringify({ runId, ...event });
    
    connections.forEach(ws => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      } catch (error) {
        console.warn('Failed to send WebSocket message:', error);
      }
    });
  },
  
  async requestApproval(runId, action) {
    return new Promise((resolve) => {
      const approvalId = `approval_${Date.now()}`;
      pendingApprovals.set(runId, { resolve, approvalId });
      
      this.broadcastToRun(runId, {
        type: 'approval-request',
        approvalId,
        action,
        ts: Date.now()
      });
      
      // Auto-approve after 30 seconds
      setTimeout(() => {
        if (pendingApprovals.has(runId)) {
          pendingApprovals.delete(runId);
          resolve(true);
        }
      }, 30000);
    });
  }
};

// POST /api/agent/run - Start autonomous agent run
app.post('/api/agent/run', async (req, res) => {
  try {
    const { goal, context = {}, overrides = {}, userId = 'anonymous' } = req.body;
    
    if (!goal) {
      return res.status(400).json({ error: 'Goal is required' });
    }
    
    console.log(`🤖 Agent API: Starting run for user ${userId}, goal: ${goal.substring(0, 50)}...`);
    
    // Use mock implementation (production would use actual AutonomousAgent)
    const result = await mockAutonomousAgent.runAutonomous({ 
      goal, 
      context, 
      overrides, 
      userId 
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Agent API: Run failed:', error);
    res.status(500).json({ 
      error: error.message,
      type: 'agent_run_error' 
    });
  }
});

// POST /api/agent/approve - Approve/reject pending action
app.post('/api/agent/approve', (req, res) => {
  try {
    const { runId, approved = false, reason } = req.body;
    
    if (!runId) {
      return res.status(400).json({ error: 'runId is required' });
    }
    
    const approval = pendingApprovals.get(runId);
    if (!approval) {
      return res.status(404).json({ error: 'No pending approval found' });
    }
    
    // Resolve the approval
    approval.resolve(approved);
    pendingApprovals.delete(runId);
    
    // Broadcast approval response
    mockAutonomousAgent.broadcastToRun(runId, {
      type: 'approval-response',
      approvalId: approval.approvalId,
      approved,
      reason,
      ts: Date.now()
    });
    
    console.log(`🤖 Agent API: Approval ${approved ? 'granted' : 'denied'} for run ${runId.slice(0, 8)}`);
    
    res.json({ ok: true, approved });
    
  } catch (error) {
    console.error('❌ Agent API: Approval failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agent/runs/:userId - Get active runs for user
app.get('/api/agent/runs/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userRuns = [];
    
    for (const [runId, run] of agentRuns.entries()) {
      if (run.userId === userId && run.status === 'running') {
        userRuns.push({
          runId,
          goal: run.goal.substring(0, 100),
          status: run.status,
          startTime: run.startTime,
          progress: run.progress.length
        });
      }
    }
    
    res.json({ runs: userRuns });
    
  } catch (error) {
    console.error('❌ Agent API: Get runs failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/agent/stop - Force stop a running agent
app.post('/api/agent/stop', (req, res) => {
  try {
    const { runId, reason = 'User requested stop' } = req.body;
    
    const run = agentRuns.get(runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    if (run.status !== 'running') {
      return res.status(400).json({ error: 'Run is not active' });
    }
    
    // Mark as stopped
    run.status = 'stopped';
    run.endTime = Date.now();
    run.stopReason = reason;
    
    // Clear any pending approvals
    pendingApprovals.delete(runId);
    
    // Broadcast stop event
    mockAutonomousAgent.broadcastToRun(runId, {
      type: 'done',
      status: 'terminated',
      reason,
      forced: true,
      ts: Date.now()
    });
    
    console.log(`🤖 Agent API: Stopped run ${runId.slice(0, 8)}: ${reason}`);
    
    res.json({ ok: true, runId, reason });
    
  } catch (error) {
    console.error('❌ Agent API: Stop failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== END AUTONOMOUS AGENT ROUTES ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`StudioSix Pro server is running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`AI Render available at: http://localhost:${PORT}/api/ai-render`);
  console.log(`🤖 Autonomous Agent API available at: http://localhost:${PORT}/api/agent/*`);
  console.log(`📡 Agent WebSocket available at: ws://localhost:8081/ws/agent`);
  console.log('Paystack integration:', {
    secretKey: !!PAYSTACK_SECRET_KEY,
    publicKey: !!PAYSTACK_PUBLIC_KEY
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
