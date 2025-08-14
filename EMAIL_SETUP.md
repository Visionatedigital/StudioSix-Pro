# Email Confirmation Setup Guide

This guide explains how to set up email confirmation for StudioSix Pro using Resend API.

## Overview

The email confirmation system works as follows:
1. User signs up with email and password
2. A 6-digit confirmation code is generated and sent via email
3. User enters the code to verify their email address
4. Account is created in Supabase after successful verification
5. Welcome email is sent automatically

## Setup Instructions

### 1. Get Resend API Key

1. Go to [Resend.com](https://resend.com) and create an account
2. Navigate to the API Keys section
3. Create a new API key for your project
4. Copy the API key (starts with `re_`)

### 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Existing Supabase Configuration
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key

# Resend Email Service Configuration  
REACT_APP_RESEND_API_KEY=re_your-resend-api-key-here
```

### 3. Configure Sending Domain (Optional but Recommended)

For production use, you should configure a custom sending domain:

1. In your Resend dashboard, go to "Domains"
2. Add your domain (e.g., `studiosix.ai`)
3. Configure the DNS records as shown
4. Update the `fromEmail` in `src/services/ResendEmailService.js`:

```javascript
this.fromEmail = 'StudioSix Pro <noreply@yourdomain.com>';
```

### 4. Development Mode

If you don't configure Resend (or use placeholder values), the system will work in development mode:

- Mock confirmation emails are logged to console
- A mock confirmation code is displayed in the UI
- No actual emails are sent
- All other functionality works normally

## Features

### Email Templates

The system includes professionally designed email templates:

- **Confirmation Email**: Styled confirmation code with branding
- **Welcome Email**: Welcome message sent after successful verification

### Security Features

- Confirmation codes expire after 10 minutes
- Maximum 5 verification attempts per email
- Rate limiting on resend requests (60-second cooldown)
- Secure code generation using cryptographically random numbers

### User Experience

- Real-time validation and error messages
- Countdown timer for resend button
- Clear visual feedback for all states
- Responsive design matching app theme

## Troubleshooting

### Mock Mode Issues

If emails aren't sending but the system works in mock mode:
1. Check your Resend API key is correct
2. Verify the API key has sending permissions
3. Check browser console for API errors

### Email Delivery Issues

If emails aren't being received:
1. Check spam/junk folders
2. Verify the recipient email address
3. Check Resend dashboard for delivery logs
4. Ensure sending domain is properly configured

### Code Verification Issues

If codes aren't working:
1. Check the code hasn't expired (10 minutes)
2. Ensure you're entering the exact 6-digit code
3. Try requesting a new code if attempts are exhausted

## API Response Examples

### Successful Signup
```javascript
{
  success: true,
  requiresConfirmation: true,
  email: "user@example.com",
  message: "Confirmation email sent successfully",
  mockCode: "123456" // Only in development mode
}
```

### Successful Verification
```javascript
{
  success: true,
  data: {
    user: { ... },
    session: { ... }
  }
}
```

## Email Service Architecture

The email system is built with these components:

- **ResendEmailService**: Handles API calls and template generation
- **EmailConfirmation**: React component for code input UI
- **ConfirmationStorage**: localStorage management for pending confirmations
- **useAuth**: Integration with authentication flow

This architecture allows for easy switching between email providers and provides a robust fallback system for development. 