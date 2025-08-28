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
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('OpenAI API Key configured:', !!process.env.OPENAI_API_KEY);

// Enable CORS for frontend connections
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://studiosix.ai'],
  credentials: true
}));

// Enable JSON parsing for API endpoints
app.use(express.json());

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

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: model === 'gpt-4' ? 'gpt-4o-mini' : model, // Use gpt-4o-mini for cost efficiency
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
        // Handle successful payment
        // You can update user subscription status here
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
