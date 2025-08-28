#!/bin/bash

echo "🚀 Starting StudioSix Pro Development Environment..."

# Check if simple-server is already running
if pgrep -f "simple-server.js" > /dev/null; then
    echo "✅ Backend server already running on port 8080"
else
    echo "🟡 Starting backend server on port 8080..."
    node simple-server.js > server.log 2>&1 &
    sleep 2
    if pgrep -f "simple-server.js" > /dev/null; then
        echo "✅ Backend server started successfully"
    else
        echo "❌ Failed to start backend server"
        exit 1
    fi
fi

# Check if AI proxy server is already running
if pgrep -f "ai-proxy-server.js" > /dev/null; then
    echo "✅ AI proxy server already running on port 8002"
else
    echo "🟡 Starting AI proxy server on port 8002 (for image proxying)..."
    node ai-proxy-server.js > ai-proxy.log 2>&1 &
    sleep 2
    if pgrep -f "ai-proxy-server.js" > /dev/null; then
        echo "✅ AI proxy server started successfully"
    else
        echo "❌ Failed to start AI proxy server"
        exit 1
    fi
fi

# Check if React dev server is running
if pgrep -f "craco.*start" > /dev/null; then
    echo "✅ React dev server already running on port 3000"
else
    echo "🟡 Starting React development server on port 3000..."
    npm start
fi

echo "🎉 StudioSix Pro is ready!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:8080"
echo "🤖 AI Proxy: http://localhost:8002"
echo "🤖 Autonomous Agent: http://localhost:8080/api/agent/*"
echo "📡 Agent WebSocket: ws://localhost:8081/ws/agent"
echo "❤️ Health: http://localhost:8080/health"
echo ""
echo "💡 To see autonomous agent logs: tail -f server.log"