# StudioSix Pro - DigitalOcean Deployment Guide

This guide will help you deploy StudioSix Pro to DigitalOcean App Platform with automatic deployments from GitHub.

## Prerequisites

1. **GitHub Account** with your repository
2. **DigitalOcean Account** ([Sign up here](https://cloud.digitalocean.com/registrations/new))
3. **Domain** (optional, but recommended)

## Step 1: Prepare Your Repository

### 1.1 Commit Current Changes
```bash
cd /Users/mark/StudioSixAI-FreeCAD-AI-Architect
git add .
git commit -m "Prepare for DigitalOcean deployment"
git push origin main
```

### 1.2 Install Production Dependencies
```bash
cd web-app
npm install serve
```

## Step 2: DigitalOcean App Platform Setup

### 2.1 Create New App
1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click **"Create App"**
3. Choose **"GitHub"** as source
4. Authorize DigitalOcean to access your GitHub
5. Select your repository: `StudioSixAI-FreeCAD-AI-Architect`
6. Choose branch: `main`
7. Set source directory: `web-app`

### 2.2 Configure Services

**Service 1: Web (React Frontend)**
- **Name**: `studiosix-web`
- **Type**: Web Service
- **Build Command**: `npm run build`
- **Run Command**: `npm run start:production`
- **Port**: `3000`
- **Instance Size**: Basic ($12/month)
- **Auto Deploy**: ✅ Enabled

**Service 2: Email API (Node.js Backend)**
- **Name**: `studiosix-email`
- **Type**: Web Service  
- **Build Command**: `echo "No build needed"`
- **Run Command**: `npm run start:email-proxy`
- **Port**: `8001`
- **Instance Size**: Basic ($12/month)
- **Auto Deploy**: ✅ Enabled

## Step 3: Environment Variables

Add these environment variables in DigitalOcean:

### For Web Service:
```
NODE_ENV=production
REACT_APP_SUPABASE_URL=https://zwrooqvwxdwvnuhpepta.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### For Email Service:
```
NODE_ENV=production
RESEND_API_KEY=re_XxX7KPn9_6dvoNiHYGH9UUhzVZEVv11qD
```

## Step 4: Domain Configuration (Optional)

### 4.1 Custom Domain
1. In DigitalOcean App settings, go to **"Settings"** → **"Domains"**
2. Click **"Add Domain"**
3. Enter your domain: `studiosix.ai`
4. Add these DNS records to your domain provider:

```
Type: CNAME
Name: @
Value: studiosix-pro-<app-id>.ondigitalocean.app

Type: CNAME  
Name: www
Value: studiosix-pro-<app-id>.ondigitalocean.app
```

## Step 5: Update API Endpoints

Update the landing page to use production API endpoints:

In `src/components/LandingPage.js`, change:
```javascript
// From:
fetch('http://localhost:8001/api/add-to-waitlist', {

// To:
fetch('/api/add-to-waitlist', {
```

## Step 6: Test Deployment

1. **Push changes to trigger deployment**:
```bash
git add .
git commit -m "Configure production API endpoints"
git push origin main
```

2. **Monitor deployment** in DigitalOcean dashboard
3. **Test live site** at your assigned URL
4. **Test email signup** functionality
5. **Test Calendly integration**

## Expected Costs

- **Basic Plan**: ~$24/month (Web + Email services)
- **Storage**: ~$2/month (for GIFs and assets)
- **Bandwidth**: Included (1TB)
- **Total**: ~$26/month

## Automatic Deployments

✅ **Automatic deployments are now configured!**

Every time you push to the `main` branch:
1. DigitalOcean detects the change
2. Automatically builds the app
3. Deploys to production
4. Zero downtime deployment

## Monitoring & Logs

- **View logs**: DigitalOcean Dashboard → Your App → Runtime Logs
- **Monitor performance**: Built-in metrics dashboard
- **Alerts**: Set up email notifications for issues

## Troubleshooting

### Build Failures
- Check build logs in DigitalOcean dashboard
- Ensure all dependencies are in `package.json`
- Verify environment variables are set

### Email Issues
- Check email service logs
- Verify RESEND_API_KEY is correct
- Test `/health` endpoint

### 404 Errors
- Ensure React Router is configured for SPA
- Check build output includes all routes

## Next Steps

1. **SSL Certificate**: Automatically provided by DigitalOcean
2. **CDN**: Built-in global CDN
3. **Scaling**: Easily scale up/down based on traffic
4. **Database**: Supabase handles this (already configured)
5. **File Storage**: Use DigitalOcean Spaces for large files