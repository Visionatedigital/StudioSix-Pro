/**
 * Simple Email Proxy Server for Resend API
 * Runs alongside the React app to handle CORS issues
 */

const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 8001; // Different port from main app

// Enable CORS for the React app
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'email-proxy' });
});

// Email proxy endpoint
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
                
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                        Studio<span style="color: #a855f7;">Six</span> Pro
                    </h1>
                </div>

                <!-- Main Content -->
                <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 16px; padding: 40px; text-align: center; backdrop-filter: blur(10px);">
                    
                    <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: bold; color: #ffffff;">
                        Confirm Your Email Address
                    </h2>
                    
                    <p style="margin: 0 0 32px 0; font-size: 16px; color: #94a3b8; line-height: 1.6;">
                        ${greeting}! Thanks for signing up for StudioSix Pro. To complete your account setup, please enter this confirmation code in the app:
                    </p>

                    <!-- Confirmation Code -->
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

                <!-- Footer -->
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
      
      // Handle testing mode restriction (403 error)
      if (response.status === 403 && errorResult.error && errorResult.error.includes('testing emails')) {
        console.log('📧 Resend domain verification pending - DNS records may still be propagating');
        console.log('📧 studiosix.ai domain should be verified in Resend dashboard');
        console.log(`📧 Mock email would be sent to: ${email}`);
        console.log(`📧 Confirmation code: ${confirmation_code}`);
        
        res.json({
          success: true,
          message: 'Domain verification pending - using mock email',
          mockCode: confirmation_code,
          note: 'DNS propagation in progress for studiosix.ai domain'
        });
      } else {
        // For production, return actual API errors
        res.status(response.status).json({
          success: false,
          error: `Resend API error: ${errorResult.message || 'Unknown error'}`,
          details: errorResult
        });
      }
    }

  } catch (error) {
    console.error('❌ Email proxy error:', error.message);
    // For production, return actual error instead of mock fallback
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
  
  console.log('🔑 API Key status:', {
    hasEnvKey: !!process.env.RESEND_API_KEY,
    keyPrefix: API_KEY ? API_KEY.substring(0, 8) + '...' : 'none'
  });
  
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
                
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                        Studio<span style="color: #a855f7;">Six</span> Pro
                    </h1>
                </div>

                <!-- Main Content -->
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

                <!-- Footer -->
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
    console.error('❌ Welcome email proxy error:', error.message);
    res.json({
      success: true,
      message: 'Mock welcome email sent (connection error)'
    });
  }
});

// Waitlist endpoint for landing page
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

  // First, add to waitlist audience/list (you'll need to create this in Resend dashboard)
  if (API_KEY) {
    try {
      // Add contact to audience (replace 'your-audience-id' with actual audience ID from Resend)
      const audienceResponse = await fetch('https://api.resend.com/audiences/contacts', {
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

      console.log('📋 Audience response status:', audienceResponse.status);
    } catch (error) {
      console.log('📋 Audience add error (continuing anyway):', error.message);
    }
  }
  
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
                
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="margin: 0; font-size: 36px; font-weight: bold; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                        Studio<span style="color: #a855f7;">Six</span> Pro
                    </h1>
                </div>

                <!-- Main Content -->
                <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 16px; padding: 40px; text-align: center; backdrop-filter: blur(10px);">
                    
                    <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: bold; color: #ffffff;">
                        🎉 You're In! Welcome to Early Access
                    </h2>
                    
                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #94a3b8; line-height: 1.6;">
                        Thank you for joining StudioSix Pro early access! You're now part of an exclusive group of design professionals who will shape the future of AI-powered architecture.
                    </p>

                    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 24px 0;">
                        <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #3b82f6; font-weight: 600;">
                            🗓️ Mark Your Calendar - We Launch September 1st!
                        </h3>
                        <p style="margin: 0; font-size: 14px; color: #e2e8f0; line-height: 1.5;">
                            You'll be among the first to know when StudioSix Pro goes live. We're launching on <strong>September 1st, 2024</strong> with exclusive early access for our waitlist members like you!
                        </p>
                    </div>

                    ${promptText ? `
                    <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid #a855f7; border-radius: 12px; padding: 20px; margin: 24px 0;">
                        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #a855f7; font-weight: 600;">
                            Your Design Idea
                        </h3>
                        <p style="margin: 0; font-size: 14px; color: #e2e8f0; font-style: italic;">
                            "${promptText}"
                        </p>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">
                            We can't wait to help you bring this to life!
                        </p>
                    </div>
                    ` : ''}

                    <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 12px; padding: 24px; margin: 32px 0;">
                        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #22c55e; font-weight: 600;">
                            🚀 What's Next?
                        </h3>
                        <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; color: #94a3b8; line-height: 1.6; text-align: left;">
                            <li>You'll be among the first to access new features</li>
                            <li>Exclusive invites to design webinars and demos</li>
                            <li>Priority support from our team</li>
                            <li>Special early access pricing when we launch</li>
                        </ul>
                    </div>

                    <div style="margin: 32px 0;">
                        <a href="https://calendly.com/visionatedigital/30min" style="display: inline-block; background: #a855f7; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; transition: all 0.2s;">
                            📅 Book a Personal Demo
                        </a>
                    </div>

                    <p style="margin: 24px 0 0 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                        Keep an eye on your inbox - we'll be sharing exclusive updates, tips, and early access opportunities.
                    </p>

                </div>

                <!-- Footer -->
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
      const errorResult = await response.json();
      console.error('❌ Resend API error for waitlist:', response.status, errorResult);
      
      // Handle testing mode restriction (403 error)
      if (response.status === 403) {
        console.log('📧 Domain verification issue or API limit reached');
        console.log('📧 Error details:', errorResult);
        
        res.json({
          success: true,
          message: 'Successfully added to waitlist',
          note: 'Email confirmation pending (domain verification needed)',
          debugInfo: errorResult
        });
      } else {
        // Handle gracefully - still consider it a success for user experience
        res.json({
          success: true,
          message: 'Successfully added to waitlist',
          note: 'Email confirmation may be delayed',
          debugInfo: errorResult
        });
      }
    }

  } catch (error) {
    console.error('❌ Waitlist email error:', error.message);
    // Still return success to avoid breaking user flow
    res.json({
      success: true,
      message: 'Successfully added to waitlist',
      note: 'Email confirmation may be delayed'
    });
  }
});

app.listen(PORT, () => {
  console.log(`📧 Email proxy server running on http://localhost:${PORT}`);
  console.log(`✅ Ready to handle email requests from React app`);
});