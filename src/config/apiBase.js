// Centralized helpers for API and WebSocket base URLs
// Prefers REACT_APP_BACKEND_URL; falls back to current origin

export function getApiBase() {
  const envBase = process.env.REACT_APP_BACKEND_URL;
  if (envBase && typeof envBase === 'string' && envBase.trim().length > 0) {
    return envBase.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    try {
      const url = new URL(window.location.href);
      // In dev, prefer backend on 8080 if app is served from 3000
      if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.port === '3000') {
        return 'http://localhost:8080';
      }
      return window.location.origin;
    } catch {
      return window.location.origin;
    }
  }
  // Last-resort fallback to relative origin
  return '';
}

export function getUploadBase() {
  const envUpload = process.env.REACT_APP_UPLOAD_URL;
  if (envUpload && typeof envUpload === 'string' && envUpload.trim().length > 0) {
    return envUpload.replace(/\/$/, '');
  }
  return getApiBase();
}

export function getWebSocketBase() {
  const envWs = process.env.REACT_APP_WS_URL;
  if (envWs && typeof envWs === 'string' && envWs.trim().length > 0) {
    return envWs.replace(/\/$/, '');
  }
  const api = getApiBase();
  if (!api) return '';
  try {
    const url = new URL(api);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString().replace(/\/$/, '');
  } catch (_e) {
    // If api is relative or invalid, fallback to current location
    if (typeof window !== 'undefined' && window.location) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${window.location.host}`;
    }
    return '';
  }
}


