/**
 * Resend Email Service
 * Handles sending emails via Resend API
 */

class ResendEmailService {
  constructor() {
    this.apiKey = process.env.REACT_APP_RESEND_API_KEY;
    this.apiUrl = 'https://api.resend.com/emails';
    this.fromEmail = 'StudioSix Pro <onboarding@studiosix.ai>'; // Using verified domain
    console.log('ResendEmailService initialized:', {
      hasApiKey: !!this.apiKey,
      apiKeyPrefix: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'none',
      fromEmail: this.fromEmail
    });
  }

  /**
   * Check if Resend is properly configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Generate a 6-digit confirmation code
   */
  generateConfirmationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send email confirmation code via backend proxy
   */
  async sendConfirmationEmail(email, confirmationCode, userName = '') {
    try {
      console.log('📧 Sending confirmation email via backend to:', email);
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const response = await fetch(`${backendUrl}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          confirmation_code: confirmationCode,
          user_name: userName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      console.log('✅ Email sent via backend:', result.message);
      return { 
        success: true, 
        messageId: result.messageId,
        message: result.message
      };
    } catch (error) {
      console.error('❌ Failed to send email via backend:', error);
      
      // For production, return actual error
      return { 
        success: false, 
        error: error.message || 'Failed to send confirmation email'
      };
    }
  }

  /**
   * Send welcome email after successful confirmation
   */
  async sendWelcomeEmail(email, userName = '') {
    try {
      console.log('📧 Sending welcome email via backend to:', email);
      
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const response = await fetch(`${backendUrl}/api/send-welcome-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          user_name: userName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      console.log('✅ Welcome email sent via backend:', result.message);
      return { 
        success: true, 
        messageId: result.messageId,
        message: result.message
      };
    } catch (error) {
      console.error('❌ Failed to send welcome email via backend:', error);
      
      // For production, return actual error
      return { 
        success: false, 
        error: error.message || 'Failed to send welcome email'
      };
    }
  }

  /**
   * Get confirmation email template
   */
  getConfirmationEmailTemplate(confirmationCode, userName, email) {
    const greeting = userName ? `Hi ${userName}` : 'Hello';
    
    return `
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
                  ${confirmationCode}
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
  }

  /**
   * Get welcome email template
   */
  getWelcomeEmailTemplate(userName, email) {
    const greeting = userName ? `Welcome, ${userName}!` : 'Welcome to StudioSix Pro!';
    
    return `
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
  }

}

// Export singleton instance
export const resendEmailService = new ResendEmailService();
export default resendEmailService; 