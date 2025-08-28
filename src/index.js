import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Global log silencer with runtime toggle. Keeps errors/warnings by default.
(() => {
  try {
    const stored = localStorage.getItem('LOG_SILENCE');
    let silence = stored === null ? '1' : stored; // default: silence
    const original = {
      log: console.log,
      info: console.info,
      debug: console.debug,
      warn: console.warn,
      error: console.error
    };
    const apply = () => {
      const on = silence === '1' || silence === 'true';
      console.log = on ? () => {} : original.log;
      console.info = on ? () => {} : original.info;
      console.debug = on ? () => {} : original.debug;
      // keep warn/error always active
      console.warn = original.warn;
      console.error = original.error;
    };
    window.setLogSilence = (flag) => {
      silence = flag ? '1' : '0';
      localStorage.setItem('LOG_SILENCE', silence);
      apply();
      original.log('[LogSilencer] silence =', silence);
    };
    apply();
  } catch (e) {
    // ignore storage errors
  }
})();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 