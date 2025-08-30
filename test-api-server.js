#!/usr/bin/env node

/**
 * Minimal AI Render API Server for Testing
 * This is a simplified version to test if the frontend can connect
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 8081; // Different port to avoid conflicts

// In-memory storage for render jobs
const renderJobs = new Map();
let nextJobId = 1;

// Generate unique job ID
function generateJobId() {
  return `render_${nextJobId++}_${Date.now()}`;
}

// Enable CORS for frontend connections
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Enable JSON parsing
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// AI Render session status
app.get('/api/ai-render-session-status', (req, res) => {
  console.log('📊 AI render session status requested');
  res.json({
    status: 'ready',
    session_active: true,
    openai_configured: true,
    timestamp: new Date().toISOString()
  });
});

// Start render job
app.post('/api/ai-render', (req, res) => {
  console.log('🎨 AI Render request received');
  const { prompt, image } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  const jobId = generateJobId();
  console.log(`🚀 Starting test render job: ${jobId}`);
  
  // Create completed job immediately
  const job = {
    session_id: jobId,
    status: 'completed',
    prompt,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    progress: 100,
    message: 'Test render completed',
    output_image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  };
  
  renderJobs.set(jobId, job);
  
  res.json({
    session_id: jobId,
    status: 'processing',
    message: 'Render job started successfully'
  });
});

// Get render job status
app.get('/api/ai-render/:jobId', (req, res) => {
  console.log('📊 Getting render status for job:', req.params.jobId);
  const { jobId } = req.params;
  const job = renderJobs.get(jobId);
  
  if (!job) {
    console.log('❌ Job not found:', jobId);
    return res.status(404).json({ error: 'Render job not found' });
  }
  
  console.log('✅ Returning job status:', job.status);
  res.json(job);
});

// Delete render job
app.delete('/api/ai-render/:jobId', (req, res) => {
  const { jobId } = req.params;
  renderJobs.delete(jobId);
  console.log(`🗑️ Deleted render job: ${jobId}`);
  res.json({ message: 'Render job deleted successfully' });
});

// List render jobs
app.get('/api/ai-render-jobs', (req, res) => {
  const jobs = Array.from(renderJobs.values());
  res.json({ jobs });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test AI Render API server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Session status: http://localhost:${PORT}/api/ai-render-session-status`);
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











