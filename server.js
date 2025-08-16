#!/usr/bin/env node

console.log('Starting StudioSix Pro server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Check if build directory exists
const buildPath = path.join(__dirname, 'build');
console.log('Checking build directory:', buildPath);
if (!fs.existsSync(buildPath)) {
  console.error('ERROR: Build directory does not exist at:', buildPath);
  console.error('Available files in current directory:', fs.readdirSync(__dirname));
  process.exit(1);
}
console.log('Build directory found successfully');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"]
    }
  }
}));

// Enable compression
app.use(compression());

// Enable JSON parsing for API endpoints
app.use(express.json());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

// Special handling for WASM files
app.get('*.wasm', (req, res, next) => {
  res.set('Content-Type', 'application/wasm');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Email API endpoints (integrated from email-proxy-server.js)
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
    // Import fetch dynamically
    const fetch = (await import('node-fetch')).default;
    
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
        from: 'StudioSix Pro <onboarding@resend.dev>',
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

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`StudioSix Pro server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`Email API endpoint available at: /api/add-to-waitlist`);
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
