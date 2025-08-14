#!/bin/bash

echo "🧹 Setting up clean StudioSix Pro repository..."

# Initialize new git repository
git init

# Create initial README
cat > README.md << 'EOF'
# StudioSix Pro

AI-Powered CAD Architecture Platform

## Features
- 🏗️ AI-powered architectural design
- 🎨 Real-time 3D visualization  
- 📧 Email automation with Resend
- 🚀 Automatic deployments
- 💬 Modern chat interface

## Live Demo
Visit our landing page: [StudioSix Pro](https://studiosix-pro.ondigitalocean.app)

## Tech Stack
- **Frontend**: React, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: Supabase
- **Email**: Resend API
- **Hosting**: DigitalOcean App Platform

## Quick Start

```bash
npm install
npm run start:with-email
```

## Deployment
This app is configured for automatic deployment on DigitalOcean App Platform.

Push to `main` branch triggers automatic deployment.

## Environment Variables
```
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-key
RESEND_API_KEY=your-resend-key
```

---
Built with ❤️ by StudioSix Team
EOF

# Add all files
git add .

# Initial commit
git commit -m "🚀 Initial StudioSix Pro release

✨ Features:
- Modern React landing page with typewriter effects
- Cycling GIF animations (bedroom, living room, kitchen)
- Email waitlist with Resend integration
- Calendly booking integration
- DigitalOcean deployment ready
- Supabase authentication
- Professional email templates

🎯 Ready for production deployment"

# Add remote (you'll need to update this with your actual repo)
echo "🔗 Adding remote repository..."
git remote add origin https://github.com/Visionatedigital/StudioSix-Pro.git

echo "✅ Clean repository setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run: git push origin main --force"
echo "2. Go to DigitalOcean and connect this clean repository"
echo "3. Deploy with automatic updates enabled"
echo ""
echo "📊 Repository size:"
du -sh .git
echo ""
echo "🎉 Ready for deployment!"