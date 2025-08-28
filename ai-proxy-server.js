#!/usr/bin/env node
/**
 * Simple AI Proxy Server for StudioSix
 * 
 * Handles CORS issues when calling OpenAI and Claude APIs from the browser
 * Runs alongside the React development server
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8002; // Changed from 8001 to avoid conflict with email-proxy-server

// API Keys - Set these as environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'your-claude-api-key-here';

// Model configurations
const AI_MODELS = {
  'gpt-4': { provider: 'openai', model: 'gpt-4-0125-preview', maxTokens: 4096 },
  'gpt-4-turbo': { provider: 'openai', model: 'gpt-4-turbo-preview', maxTokens: 4096 },
  'gpt-4-vision': { provider: 'openai', model: 'gpt-4-vision-preview', maxTokens: 4096 },
  'gpt-3.5-turbo': { provider: 'openai', model: 'gpt-3.5-turbo-0125', maxTokens: 4096 },
  'claude-3.5-sonnet': { provider: 'claude', model: 'claude-3-5-sonnet-20241022', maxTokens: 8192 },
  'claude-3-haiku': { provider: 'claude', model: 'claude-3-haiku-20240307', maxTokens: 4096 }
};

// System prompts
const SYSTEM_PROMPTS = {
  agent: `You are an expert architectural AI assistant integrated into StudioSix, a professional CAD application. You can:

🏗️ CREATE OBJECTS: Generate walls, slabs, doors, windows, columns, roofs, and stairs with specific dimensions
🔧 USE TOOLS: Select and activate different architectural tools in the toolbar
👁️ CONTROL VIEWS: Switch between 2D/3D views, zoom, and change themes
📁 MANAGE PROJECTS: Handle floors, save projects, and organize building hierarchy

IMPORTANT CONTEXT AWARENESS:
- You can see the current tool selection, selected objects, view mode, and project state
- Always provide specific, actionable architectural guidance
- Use metric units (meters) by default
- Be concise but comprehensive in your responses
- Include relevant emojis for visual clarity

RESPONSE FORMAT:
- Start with a brief confirmation of what you'll do
- Provide specific dimensions when creating objects
- Explain any architectural decisions or standards you're applying
- End with next suggested steps if relevant

You are NOT just a chatbot - you are an active copilot that can directly control the CAD environment.`,

  ask: `You are an expert architectural consultant providing guidance for StudioSix CAD users. Your role is to:

📚 PROVIDE EXPERTISE: Answer questions about architecture, building codes, design principles
🔍 ANALYZE PROJECTS: Review current designs and provide professional feedback  
💡 SUGGEST IMPROVEMENTS: Recommend better approaches, materials, or techniques
📐 EXPLAIN STANDARDS: Clarify architectural standards, dimensions, and best practices

RESPONSE STYLE:
- Professional and educational tone
- Reference relevant building codes and standards when applicable
- Provide practical, implementable advice
- Use clear explanations with examples
- Include relevant architectural terminology

You focus on consultation and guidance rather than direct tool manipulation.`
};

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());
app.use(express.json({ limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.skp', '.ifc', '.step', '.stp', '.obj', '.fbx', '.gltf', '.glb', '.dae', '.ply', '.stl', '.3ds', '.dwg', '.dxf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Supported types: ${allowedTypes.join(', ')}`));
    }
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// BIM/CAD File Upload Endpoint
app.post('/upload-bim-file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, filename, mimetype, size } = req.file;
    const fileType = req.body.fileType || path.extname(originalname).toLowerCase();
    
    console.log(`📁 File uploaded: ${originalname} (${fileType})`);
    
    // For now, we'll create a simple response that simulates processing
    // In a real implementation, you would parse the CAD file and extract objects
    const mockObjects = [];
    let importedCount = 0;
    
    if (fileType === '.fbx' || fileType === '.gltf' || fileType === '.glb') {
      // Mock 3D model processing for furniture/fixture files
      mockObjects.push({
        id: `model_${Date.now()}`,
        type: 'furniture',
        name: originalname.replace(/\.[^/.]+$/, ''),
        modelUrl: `http://localhost:8002/uploads/${filename}`, // Full URL for frontend access
        format: fileType.substring(1), // Remove the dot (e.g., '.fbx' -> 'fbx')
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        width: 1,
        height: 1,
        depth: 1
      });
      importedCount = 1;
    } else {
      // Handle other CAD file types (existing logic)
      importedCount = Math.floor(Math.random() * 5) + 1; // Mock count
      for (let i = 0; i < importedCount; i++) {
        mockObjects.push({
          id: `obj_${Date.now()}_${i}`,
          type: 'imported',
          name: `${originalname.replace(/\.[^/.]+$/, '')}_${i}`,
          position: { x: i * 2, y: 0, z: 0 }
        });
      }
    }
    
    // Clean up the uploaded file after processing (optional)
    // setTimeout(() => {
    //   fs.unlink(req.file.path, (err) => {
    //     if (err) console.error('Error deleting uploaded file:', err);
    //   });
    // }, 5000);
    
    res.json({
      success: true,
      fileName: originalname,
      fileType,
      imported_count: importedCount,
      objects: mockObjects,
      message: `Successfully processed ${originalname}`
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'File upload failed', 
      message: error.message 
    });
  }
});

// Build contextual message
function buildContextualMessage(userMessage, context, mode) {
  if (!context) {
    return userMessage;
  }
  
  let contextInfo = `
CURRENT CAD CONTEXT:
- Active Tool: ${context.selectedTool || 'none'}
- View Mode: ${context.viewMode || '3d'}
- Current Floor: ${context.currentFloor || 'ground'}
- Objects in Scene: ${context.objectCount || 0}
- Selected Objects: ${context.selectedObjects ? context.selectedObjects.length : 0}`;

  if (context.objects && context.objects.length > 0) {
    const objectSummary = {};
    context.objects.forEach(obj => {
      const type = obj.type || 'unknown';
      objectSummary[type] = (objectSummary[type] || 0) + 1;
    });
    
    const summaryText = Object.entries(objectSummary)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');
    contextInfo += `\n- Scene Contents: ${summaryText}`;
  }

  if (context.recentMessages && context.recentMessages.length > 0) {
    contextInfo += `\n\nRECENT CONVERSATION:`;
    context.recentMessages.slice(-3).forEach(msg => {
      const speaker = msg.type === 'user' ? 'User' : 'Assistant';
      const message = (msg.message || '').substring(0, 100);
      const truncated = (msg.message || '').length > 100 ? '...' : '';
      contextInfo += `\n${speaker}: ${message}${truncated}`;
    });
  }

  return `${contextInfo}\n\nUSER REQUEST: ${userMessage}\n\nPlease respond as an architectural AI assistant in ${mode} mode.`;
}

// OpenAI API call
async function callOpenAI(message, modelConfig, systemPrompt) {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: modelConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: 0.7,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    });

    return {
      message: response.data.choices[0].message.content,
      model: modelConfig.model,
      provider: 'openai',
      usage: response.data.usage
    };
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    throw new Error(`OpenAI API error: ${errorMessage}`);
  }
}

// Claude API call
async function callClaude(message, modelConfig, systemPrompt) {
  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: modelConfig.model,
      max_tokens: modelConfig.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
      temperature: 0.7,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLAUDE_API_KEY}`,
        'anthropic-version': '2023-06-01'
      }
    });

    return {
      message: response.data.content[0].text,
      model: modelConfig.model,
      provider: 'claude',
      usage: response.data.usage
    };
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    throw new Error(`Claude API error: ${errorMessage}`);
  }
}

// AI Chat endpoint
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { message, model, mode = 'agent', context } = req.body;
    
    if (!AI_MODELS[model]) {
      return res.status(400).json({ detail: `Unsupported model: ${model}` });
    }
    
    const modelConfig = AI_MODELS[model];
    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.agent;
    const contextualMessage = buildContextualMessage(message, context, mode);
    
    let result;
    if (modelConfig.provider === 'openai') {
      result = await callOpenAI(contextualMessage, modelConfig, systemPrompt);
    } else if (modelConfig.provider === 'claude') {
      result = await callClaude(contextualMessage, modelConfig, systemPrompt);
    } else {
      return res.status(400).json({ detail: `Unknown provider: ${modelConfig.provider}` });
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ AI Chat error:', error);
    res.status(500).json({ detail: error.message });
  }
});

// Test connections endpoint
app.get('/api/ai-chat/test-connections', async (req, res) => {
  const results = {
    openai: false,
    claude: false,
    errors: {}
  };
  
  // Test OpenAI
  try {
    await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Test connection' }],
      max_tokens: 10
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    });
    
    results.openai = true;
  } catch (error) {
    results.errors.openai = error.response?.data?.error?.message || error.message;
  }
  
  // Test Claude
  try {
    await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Test connection' }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLAUDE_API_KEY}`,
        'anthropic-version': '2023-06-01'
      }
    });
    
    results.claude = true;
  } catch (error) {
    results.errors.claude = error.response?.data?.error?.message || error.message;
  }
  
  res.json(results);
});

// Image proxy endpoint to handle COEP/CORS issues with Supabase
app.get('/api/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Validate URL to ensure it's from Supabase
    const supabasePattern = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//;
    if (!supabasePattern.test(url)) {
      return res.status(400).json({ error: 'Invalid URL - only Supabase storage URLs are allowed' });
    }
    
    console.log(`🖼️ Proxying image request: ${url}`);
    
    // Fetch the image from Supabase
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'StudioSix-Proxy/1.0'
      }
    });
    
    // Set proper headers for COEP compliance
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Content-Length': response.headers['content-length'],
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.send(Buffer.from(response.data));
    
  } catch (error) {
    console.error('❌ Image proxy error:', error.message);
    
    if (error.code === 'ENOTFOUND' || error.response?.status === 404) {
      res.status(404).json({ error: 'Image not found' });
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({ error: 'Request timeout' });
    } else {
      res.status(500).json({ error: 'Failed to fetch image' });
    }
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'AI Proxy Server' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🤖 AI Proxy Server running on http://localhost:${PORT}`);
  console.log(`🔗 Frontend should connect to: http://localhost:${PORT}/api/ai-chat`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});