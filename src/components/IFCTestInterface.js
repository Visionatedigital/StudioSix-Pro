/**
 * IFC Test Interface - Test enhanced IFC loading functionality
 * 
 * Optimized interface to test our fixed SimpleIFCHandler with minimal log noise
 */

import React, { useState, useRef, useEffect } from 'react';
import SimpleIFCHandler from '../services/SimpleIFCHandler';

const IFCTestInterface = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [xeokitReady, setXeokitReady] = useState(false);
  const [testMode, setTestMode] = useState('auto'); // 'auto', 'fallback'
  const fileInputRef = useRef(null);
  const ifcHandlerRef = useRef(null);
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);

  // Capture console logs for display (minimal logging)
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const captureLog = (level, args) => {
      const message = args.join(' ');
      // Only capture IFC-related logs, skip noise
      if (message.includes('IFC') || message.includes('WASM') || message.includes('Error') || message.includes('✅') || message.includes('❌')) {
        setLogs(prev => [...prev.slice(-9), { // Keep only last 10 logs
          level,
          message,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
    };

    console.log = (...args) => {
      originalLog(...args);
      captureLog('log', args);
    };

    console.error = (...args) => {
      originalError(...args);
      captureLog('error', args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      captureLog('warn', args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  // Optimized xeokit loading with timeout
  useEffect(() => {
    if (testMode === 'fallback') {
      setXeokitReady(false);
      return;
    }

    const loadXeokit = async () => {
      try {
        // Check if already loaded
        if (window.xeokit) {
          setXeokitReady(true);
          return;
        }

        // Fast timeout for CDN loading (5 seconds max)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Xeokit CDN timeout')), 5000);
        });

        const loadPromise = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.type = 'module';
          script.src = 'https://cdn.jsdelivr.net/npm/@xeokit/xeokit-sdk@2.6.4/dist/xeokit-sdk.min.es.js';
          script.onload = () => {
            // Short delay to ensure xeokit is available
            setTimeout(() => {
              if (window.xeokit) {
                resolve();
              } else {
                reject(new Error('Xeokit not available after load'));
              }
            }, 500);
          };
          script.onerror = () => reject(new Error('Failed to load xeokit'));
          document.head.appendChild(script);
        });

        await Promise.race([loadPromise, timeoutPromise]);
        setXeokitReady(true);

      } catch (error) {
        console.warn('⚠️ Xeokit loading failed, using fallback mode:', error.message);
        setTestMode('fallback');
        setXeokitReady(false);
      }
    };

    loadXeokit();
  }, [testMode]);

  // Initialize IFC handler with optimized settings
  const initializeHandler = async () => {
    try {
      let viewer = null;
      
      if (xeokitReady && canvasRef.current) {
        // Create minimal xeokit viewer
        const { Viewer } = window.xeokit;
        viewer = new Viewer({
          canvasElement: canvasRef.current,
          transparent: true,
          dtxEnabled: false, // Disable to prevent errors
          pbrEnabled: false
        });
        viewerRef.current = viewer;
      }

      // Create IFC handler
      const handler = new SimpleIFCHandler();
      await handler.initialize();
      ifcHandlerRef.current = handler;
      
      return { handler, viewer };
    } catch (error) {
      console.error('❌ Handler initialization failed:', error.message);
      throw error;
    }
  };

  const handleFileLoad = async (file) => {
    if (!file) {
      setError('Please select an IFC file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setLogs([]);

    try {
      console.log('🚀 Starting IFC file processing...');
      
      const { handler } = await initializeHandler();
      
      // Load and process IFC file
      const fileBuffer = await file.arrayBuffer();
      const result = await handler.parseRealIFCFile(fileBuffer, viewerRef.current);
      
      console.log('✅ IFC processing complete:', result);
      setResult(result);

    } catch (error) {
      console.error('❌ IFC processing failed:', error.message);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSampleTest = async () => {
    setLogs([]);
    console.log('🧪 Running sample IFC test...');
    
    try {
      const { handler } = await initializeHandler();
      
      // Test with sample data
      const sampleResult = await handler.createIFCPlaceholderModel(viewerRef.current);
      console.log('✅ Sample test complete:', sampleResult);
      setResult(sampleResult);
      
    } catch (error) {
      console.error('❌ Sample test failed:', error.message);
      setError(error.message);
    }
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1000px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Status Section */}
      <div style={{
        backgroundColor: '#374151',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#f3f4f6' }}>🔧 System Status</h3>
        <div style={{ fontSize: '14px', color: '#d1d5db' }}>
          <div>📦 Xeokit: {xeokitReady ? '✅ Ready' : '⏳ Loading...'}</div>
          <div>🎯 Mode: {testMode === 'fallback' ? '⚡ Fallback (No 3D)' : '🎮 Full 3D'}</div>
        </div>
        
        {!xeokitReady && testMode === 'auto' && (
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={() => setTestMode('fallback')}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                marginRight: '10px'
              }}
            >
              🚀 Skip & Test Now
            </button>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              Loading xeokit from CDN...
            </span>
          </div>
        )}
      </div>

      {/* Test Controls */}
      <div style={{
        backgroundColor: '#1f2937',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#f3f4f6' }}>🧪 3D File Testing</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ifc,.IFC,.glb,.gltf,.obj,.OBJ"
            onChange={(e) => handleFileLoad(e.target.files[0])}
            style={{
              padding: '8px',
              backgroundColor: '#374151',
              color: 'white',
              border: '1px solid #4b5563',
              borderRadius: '4px',
              marginRight: '10px'
            }}
          />
          <button
            onClick={handleSampleTest}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔬 Test Sample
          </button>
        </div>

        {isLoading && (
          <div style={{ color: '#fbbf24', fontSize: '14px' }}>
            ⏳ Processing IFC file...
          </div>
        )}
      </div>

      {/* 3D Canvas (hidden in fallback mode) */}
      {testMode !== 'fallback' && (
        <div style={{
          backgroundColor: '#111827',
          border: '1px solid #374151',
          borderRadius: '8px',
          marginBottom: '20px',
          height: '300px',
          position: 'relative'
        }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block'
            }}
          />
          {!xeokitReady && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#9ca3af',
              fontSize: '14px'
            }}>
              ⏳ Loading 3D viewer...
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{
          backgroundColor: '#064e3b',
          border: '1px solid #059669',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#10b981' }}>✅ Success</h4>
          <pre style={{
            fontSize: '12px',
            color: '#d1fae5',
            margin: 0,
            whiteSpace: 'pre-wrap'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {/* Errors */}
      {error && (
        <div style={{
          backgroundColor: '#7f1d1d',
          border: '1px solid #dc2626',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#f87171' }}>❌ Error</h4>
          <div style={{ fontSize: '14px', color: '#fecaca' }}>{error}</div>
        </div>
      )}

      {/* Minimal Logs */}
      {logs.length > 0 && (
        <div style={{
          backgroundColor: '#1c1917',
          border: '1px solid #44403c',
          borderRadius: '8px',
          padding: '15px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <h4 style={{ margin: 0, color: '#f5f5f4' }}>📝 Key Logs</h4>
            <button
              onClick={() => setLogs([])}
              style={{
                padding: '4px 8px',
                backgroundColor: '#44403c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Clear
            </button>
          </div>
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {logs.map((log, index) => (
              <div
                key={index}
                style={{
                  color: log.level === 'error' ? '#f87171' : 
                        log.level === 'warn' ? '#fbbf24' : '#d1d5db',
                  marginBottom: '2px'
                }}
              >
                <span style={{ color: '#6b7280' }}>[{log.timestamp}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IFCTestInterface; 