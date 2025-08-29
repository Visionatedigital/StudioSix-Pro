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

> Deployment note: Set DISABLE_AGENT_WS=1 in production to run on a single port.

## Environment Variables
```
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-key
RESEND_API_KEY=your-resend-key
```

---
Built with ❤️ by StudioSix Team
