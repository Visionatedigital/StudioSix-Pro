# 🔐 Authentication Setup Guide

This guide will help you set up Supabase authentication for StudioSix Pro.

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Google Cloud Console** (for Google OAuth): [console.cloud.google.com](https://console.cloud.google.com)

## Step 1: Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project name: `studiosix-pro-auth`
5. Enter a strong database password
6. Select your region
7. Click "Create new project"

## Step 2: Get Supabase Configuration

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://your-project-ref.supabase.co`)
   - **Anon/Public Key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

## Step 3: Configure Environment Variables

1. Create a `.env` file in the `web-app` directory:
   ```bash
   cd web-app
   cp .env.example .env
   ```

2. Edit `.env` with your actual values:
   ```env
   REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Step 4: Set Up Google OAuth (Optional)

### 4.1 Create Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable **Google+ API** and **OAuth 2.0 API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Choose **Web application**
6. Add authorized redirect URIs:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
7. Copy **Client ID** and **Client Secret**

### 4.2 Configure in Supabase

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** and click **Enable**
3. Enter your **Client ID** and **Client Secret**
4. Click **Save**

## Step 5: Configure Authentication Settings

1. In Supabase dashboard, go to **Authentication** → **Settings**
2. Set **Site URL** to: `http://localhost:3000` (for development)
3. Add **Redirect URLs**:
   ```
   http://localhost:3000/auth/callback
   ```
4. **Email Settings**:
   - Enable email confirmations if desired
   - Configure email templates (optional)

## Step 6: Test Authentication

1. Start your development server:
   ```bash
   npm start
   ```

2. Open `http://localhost:3000`
3. Try the authentication flow:
   - **Sign Up**: Create a new account
   - **Sign In**: Login with existing account  
   - **Google OAuth**: Sign in with Google (if configured)

## Step 7: Database Schema (Optional)

If you want to store additional user data, you can create custom tables:

```sql
-- User profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
```

## Troubleshooting

### Common Issues

1. **Invalid API Key**: Double-check your `.env` file values
2. **CORS Errors**: Ensure redirect URLs are properly configured
3. **Google OAuth Fails**: Verify client ID/secret and redirect URIs
4. **Email Not Confirmed**: Check your email for confirmation link

### Debug Mode

Add this to your `.env` for more detailed logging:
```env
REACT_APP_DEBUG_AUTH=true
```

### Support

- [Supabase Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup](https://supabase.com/docs/guides/auth/auth-google)

## Security Notes

- **Never commit `.env` files** to version control
- **Use environment-specific URLs** for production
- **Enable Row Level Security** on database tables
- **Use HTTPS in production** for redirect URLs

## Production Deployment

When deploying to production:

1. Update **Site URL** in Supabase to your production domain
2. Add production **Redirect URLs**
3. Update **Google OAuth** authorized domains
4. Use production environment variables

---

✅ **Authentication is now set up!** Users will be required to sign in before starting new projects. 