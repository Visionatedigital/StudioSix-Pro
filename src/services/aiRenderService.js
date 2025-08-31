/**
 * AI Render Service
 * Handles communication with the backend for AI image rendering via ChatGPT
 */

// Compute API base URL, avoiding stale 8081
function computeApiBaseUrl() {
  try {
    // Prefer centralized config
    const { getApiBase } = require('../config/apiBase');
    const base = getApiBase();
    return base;
  } catch (e) {
    return '';
  }
}

const API_BASE_URL = computeApiBaseUrl();

class AIRenderService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Google AI Studio image generation (Gemini)
   * @param {Object} params
   * @param {string} params.prompt
   * @param {string} params.imageDataUrl - data URL (image/png or image/jpeg)
   * @param {string} [params.quality]
   * @param {string} [params.imageSize]
   * @param {string} [params.model]
   */
  async generateWithGoogle({ prompt, imageDataUrl, secondaryImageDataUrl, quality = 'standard', imageSize = '1024x1024', model = 'gemini-2.5-flash-image-preview' }) {
    // Recompute base each call in case of HMR/origin changes
    this.baseURL = computeApiBaseUrl();
    let url = `${this.baseURL}/api/ai/google-generate`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageDataUrl, secondaryImageDataUrl, quality, imageSize, model })
      });
    } catch (e) {
      // Fallback to same-origin base
      const base = computeApiBaseUrl();
      url = `${base}/api/ai/google-generate`;
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageDataUrl, secondaryImageDataUrl, quality, imageSize, model })
      });
    }
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.title || json?.error?.message || `HTTP ${res.status}`);
      }
      return json;
    } catch (e) {
      // Bubble up with payload snippet for debugging
      throw new Error((e && e.message) || `Bad response: ${text.substring(0, 120)}`);
    }
  }

  /**
   * Start AI rendering job
   * @param {string} prompt - The rendering prompt
   * @param {string} image - Base64 encoded image
   * @param {Object} options - Rendering options
   * @returns {Promise<Object>} Job information
   */
  async startRender(prompt, image, options = {}) {
    try {
      console.log('🚀 Starting AI render job...');
      
      const response = await fetch(`${this.baseURL}/api/ai-render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image,
          aspect_ratio: options.aspectRatio || '16:9',
          quality: options.quality || 'high',
          style: options.style || 'photorealistic'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ AI render job started:', result);
      return result;

    } catch (error) {
      console.error('❌ Error starting AI render:', error);
      throw error;
    }
  }

  /**
   * Poll render job status
   * @param {string} jobId - The job ID
   * @returns {Promise<Object>} Job status
   */
  async getRenderStatus(jobId) {
    try {
      const response = await fetch(`${this.baseURL}/api/ai-render/${jobId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('❌ Error getting render status:', error);
      throw error;
    }
  }

  /**
   * Poll for job completion with automatic retry
   * @param {string} jobId - The job ID
   * @param {Object} options - Polling options
   * @returns {Promise<Object>} Final job result
   */
  async pollForCompletion(jobId, options = {}) {
    const {
      maxAttempts = 60, // 5 minutes at 5-second intervals
      interval = 5000, // 5 seconds
      onProgress = () => {}
    } = options;

    console.log(`⏳ Polling for render completion: ${jobId}`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await this.getRenderStatus(jobId);
        
        // Call progress callback
        onProgress(status, attempt);

        // Check if job is complete
        if (status.status === 'completed') {
          console.log('✅ Render completed successfully');
          return status;
        }

        // Check if job failed
        if (status.status === 'failed') {
          console.log('❌ Render failed');
          throw new Error(status.message || 'Rendering failed');
        }

        // Check if login is required
        if (status.status === 'login_required') {
          console.log('🔐 Login required');
          return status;
        }

        // Wait before next poll
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }

      } catch (error) {
        console.error(`❌ Poll attempt ${attempt + 1} failed:`, error);
        
        // If it's the last attempt, throw the error
        if (attempt === maxAttempts - 1) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    // Timeout
    throw new Error(`Rendering timeout after ${maxAttempts} attempts`);
  }

  /**
   * Get ChatGPT session status
   * @returns {Promise<Object>} Session status
   */
  async getSessionStatus() {
    try {
      const response = await fetch(`${this.baseURL}/api/ai-render-session-status`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('❌ Error getting session status:', error);
      throw error;
    }
  }

  /**
   * Delete render job
   * @param {string} jobId - The job ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteRenderJob(jobId) {
    try {
      const response = await fetch(`${this.baseURL}/api/ai-render/${jobId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('❌ Error deleting render job:', error);
      throw error;
    }
  }

  /**
   * List all render jobs
   * @returns {Promise<Object>} Jobs list
   */
  async listRenderJobs() {
    try {
      const response = await fetch(`${this.baseURL}/api/ai-render-jobs`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('❌ Error listing render jobs:', error);
      throw error;
    }
  }

  /**
   * Render image with full workflow
   * @param {string} prompt - The rendering prompt
   * @param {string} image - Base64 encoded image
   * @param {Object} options - Rendering and polling options
   * @returns {Promise<Object>} Final result
   */
  async renderImage(prompt, image, options = {}) {
    try {
      // Start the render job
      const job = await this.startRender(prompt, image, options);

      // If login is required, return immediately
      if (job.status === 'login_required') {
        return job;
      }

      // Poll for completion
      const result = await this.pollForCompletion(job.session_id, {
        maxAttempts: options.maxAttempts,
        interval: options.pollInterval,
        onProgress: options.onProgress
      });

      return result;

    } catch (error) {
      console.error('❌ Error in renderImage workflow:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const aiRenderService = new AIRenderService();
export default aiRenderService;