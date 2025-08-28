/**
 * Enhanced fetch wrapper with error handling for browser extension interference
 */

const originalFetch = window.fetch;

export const safeFetch = async (url, options = {}) => {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await originalFetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
    
  } catch (error) {
    console.warn('⚠️ Fetch error (possibly browser extension interference):', {
      url,
      error: error.message,
      type: error.name
    });
    
    // Return a mock response for non-critical requests
    if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
      return {
        ok: false,
        status: 0,
        statusText: 'Network Error (Extension Interference)',
        json: async () => ({ error: 'Network request blocked by browser extension' }),
        text: async () => 'Network request blocked'
      };
    }
    
    throw error;
  }
};

// Export for services that need graceful degradation
export const createFetchWithFallback = (fallbackData = null) => {
  return async (url, options = {}) => {
    try {
      return await safeFetch(url, options);
    } catch (error) {
      console.warn('🔄 Using fallback data due to fetch error:', url);
      return {
        ok: true,
        status: 200,
        json: async () => fallbackData,
        text: async () => JSON.stringify(fallbackData)
      };
    }
  };
};

export default safeFetch;