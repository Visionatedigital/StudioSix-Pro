#!/usr/bin/env node

console.log('Starting StudioSix Pro server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Check if build directory exists
const buildPath = path.join(__dirname, 'build');
console.log('Checking build directory:', buildPath);
if (!fs.existsSync(buildPath)) {
  console.error('ERROR: Build directory does not exist at:', buildPath);
  console.error('Available files in current directory:', fs.readdirSync(__dirname));
  process.exit(1);
}
console.log('Build directory found successfully');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"]
    }
  }
}));

// Enable compression
app.use(compression());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

// Special handling for WASM files
app.get('*.wasm', (req, res, next) => {
  res.set('Content-Type', 'application/wasm');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`StudioSix Pro server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
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
