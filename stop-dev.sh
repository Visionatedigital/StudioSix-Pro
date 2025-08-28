#!/bin/bash

echo "🛑 Stopping StudioSix Pro Development Environment..."

# Stop backend server
if pgrep -f "simple-server.js" > /dev/null; then
    echo "🟡 Stopping backend server..."
    pkill -f "simple-server.js"
    echo "✅ Backend server stopped"
else
    echo "ℹ️ Backend server not running"
fi

# Stop React dev server  
if pgrep -f "craco.*start" > /dev/null; then
    echo "🟡 Stopping React development server..."
    pkill -f "craco.*start"
    echo "✅ React dev server stopped"
else
    echo "ℹ️ React dev server not running"
fi

echo "✅ All services stopped"