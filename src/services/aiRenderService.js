/**
 * AI Render Service
 * Handles communication with the backend for AI image rendering via ChatGPT
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

class AIRenderService {
  constructor() {
    this.baseURL = API_BASE_URL;
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