# 🚀 StudioSix Pro Development Setup

## ✅ Consolidated Architecture (All Services in One!)

Everything now runs through **simple-server.js** on port 8080:
- 📧 **Email API** (`/api/send-email`, `/api/add-to-audience`)
- 🤖 **AI Chat API** (`/api/ai-chat`, `/api/ai-chat/test-connections`) 
- 📁 **Static File Serving** (production builds)
- ❤️ **Health Check** (`/health`)

## 🎯 Quick Start Commands

### **Start Everything (Recommended)**
```bash
npm run dev
# or
./start-dev.sh
```

### **Stop Everything**
```bash
npm run stop
# or  
./stop-dev.sh
```

### **Manual Start (If Needed)**
```bash
# Terminal 1: Backend (port 8080)
npm run start:backend

# Terminal 2: Frontend (port 3000)  
npm start
```

## 🌐 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | React development server |
| **Backend API** | http://localhost:8080 | All backend services |
| **Health Check** | http://localhost:8080/health | Server status |
| **AI Chat** | http://localhost:8080/api/ai-chat | AI assistant |
| **Email API** | http://localhost:8080/api/send-email | Contact form |

## 🔧 Environment Variables

Make sure these are in your `.env` file:
```env
OPENAI_API_KEY=your_openai_key_here
RESEND_API_KEY=your_resend_key_here
```

## ✨ No More Port Issues!

**Before:** Multiple servers on different ports (8001, 8002, etc.) ❌  
**Now:** Everything consolidated into simple-server.js (port 8080) ✅

**Result:** No more "connection refused" errors! 🎉