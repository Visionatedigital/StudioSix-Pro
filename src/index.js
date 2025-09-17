import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Global console filter: silence noisy auth/profile logs unless LOG_VERBOSE=1
try {
  const original = { log: console.log, info: console.info, debug: console.debug };
  const shouldLog = (args) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('LOG_VERBOSE') === '1') return true;
      const s = args.map(a => (typeof a === 'string' ? a : (function(){ try { return JSON.stringify(a); } catch { return String(a); } })())).join(' ');
      // Always allow key areas
      if (/\[(Wavespeed|RenderStudio)\]/.test(s) || /aiRenderService/i.test(s)) return true;
      // Silence common noisy app logs
      if (/🔐|📊|AuthenticatedApp render|RecentProjectsManager|UserDatabaseService|Fetching user profile|Subscription profile initialized|Persisted keys now|Returning cached user profile/i.test(s)) return false;
      return true;
    } catch {
      return true;
    }
  };
  console.log = (...args) => { if (shouldLog(args)) original.log.apply(console, args); };
  console.info = (...args) => { if (shouldLog(args)) original.info.apply(console, args); };
  console.debug = (...args) => { if (shouldLog(args)) original.debug.apply(console, args); };
} catch {}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);