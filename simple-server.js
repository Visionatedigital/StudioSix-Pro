#!/usr/bin/env node

console.log('Starting StudioSix Pro simple server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

console.log('Current working directory:', process.cwd());
console.log('Available files:', fs.readdirSync(process.cwd()).filter(f => !f.startsWith('.')));

// Health check endpoint - this should work regardless of build status
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: PORT,
    nodeVersion: process.version,
    env: process.env.NODE_ENV
  });
});

// Check if build directory exists and serve it if available
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
  console.log('Build directory found, serving static files');
  app.use(express.static(buildPath));
  
  // Catch all for SPA routing - serve React app for all routes except /health
  app.get('*', (req, res) => {
    // Skip serving React app for health check
    if (req.path === '/health') {
      return;
    }
    
    const indexPath = path.join(buildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Build files not found');
    }
  });
} else {
  console.log('Build directory not found, serving development mode');
  
  // Simple root endpoint for when no build exists
  app.get('/', (req, res) => {
    res.status(200).send(`
      <html>
        <head><title>StudioSix Pro</title></head>
        <body>
          <h1>StudioSix Pro Server</h1>
          <p>Server is running on port ${PORT}</p>
          <p>Node version: ${process.version}</p>
          <p>Environment: ${process.env.NODE_ENV}</p>
          <p>Current time: ${new Date().toISOString()}</p>
          <p><a href="/health">Health Check</a></p>
        </body>
      </html>
    `);
  });
  
  app.get('*', (req, res) => {
    res.status(503).send(`
      <html>
        <head><title>StudioSix Pro - Building...</title></head>
        <body>
          <h1>StudioSix Pro</h1>
          <p>Application is building... Please wait.</p>
          <p>Build directory not found at: ${buildPath}</p>
          <p><a href="/health">Health Check</a></p>
        </body>
      </html>
    `);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`StudioSix Pro server is running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
