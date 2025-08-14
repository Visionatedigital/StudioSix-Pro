import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CameraIcon, XMarkIcon } from '@heroicons/react/24/outline';

const ViewportCaptureFrame = ({ isVisible, onCapture, onCancel, viewportRef }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [framePosition, setFramePosition] = useState({ x: 0, y: 0 });
  const [frameSize, setFrameSize] = useState({ width: 384, height: 256 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastCaptured, setLastCaptured] = useState(null);
  const [captureSuccess, setCaptureSuccess] = useState(false);
  const frameRef = useRef(null);

  // Initialize frame position to center when component becomes visible
  useEffect(() => {
    if (isVisible && viewportRef?.current) {
      const viewportRect = viewportRef.current.getBoundingClientRect();
      setFramePosition({
        x: (viewportRect.width - frameSize.width) / 2,
        y: (viewportRect.height - frameSize.height) / 2
      });
    }
  }, [isVisible, frameSize.width, frameSize.height, viewportRef]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e, action, handle = null) => {
    // Only prevent default for resize handles, not for the main drag area
    if (action === 'resize') {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (action === 'drag') {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - framePosition.x,
        y: e.clientY - framePosition.y
      });
    } else if (action === 'resize') {
      setIsResizing(true);
      setResizeHandle(handle);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [framePosition]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Keep frame within viewport bounds
      const maxX = window.innerWidth - frameSize.width;
      const maxY = window.innerHeight - frameSize.height;
      
      setFramePosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY))
      });
    } else if (isResizing && resizeHandle) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      let newWidth = frameSize.width;
      let newHeight = frameSize.height;
      let newX = framePosition.x;
      let newY = framePosition.y;
      
      // Handle different resize directions
      if (resizeHandle.includes('right')) {
        newWidth = Math.max(200, frameSize.width + deltaX);
      }
      if (resizeHandle.includes('left')) {
        newWidth = Math.max(200, frameSize.width - deltaX);
        newX = framePosition.x + deltaX;
      }
      if (resizeHandle.includes('bottom')) {
        newHeight = Math.max(150, frameSize.height + deltaY);
      }
      if (resizeHandle.includes('top')) {
        newHeight = Math.max(150, frameSize.height - deltaY);
        newY = framePosition.y + deltaY;
      }
      
      // Keep frame within viewport bounds
      const maxX = window.innerWidth - newWidth;
      const maxY = window.innerHeight - newHeight;
      
      setFrameSize({ width: newWidth, height: newHeight });
      setFramePosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY))
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, isResizing, resizeHandle, dragStart, frameSize, framePosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  // Add global mouse event listeners and body classes
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // Add body classes for visual feedback
      if (isDragging) {
        document.body.classList.add('capture-frame-dragging');
      }
      if (isResizing) {
        document.body.classList.add('capture-frame-resizing');
      }
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.classList.remove('capture-frame-dragging', 'capture-frame-resizing');
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleCapture = useCallback(async () => {
    if (!viewportRef?.current || isCapturing) return;

    setIsCapturing(true);
    console.log('🎯 Starting viewport capture...');
    
    try {
      // Get the viewport container
      const viewportContainer = viewportRef.current;
      console.log('Viewport container:', viewportContainer);
      
      // Try multiple ways to find the canvas
      let canvas = viewportContainer.querySelector('canvas');
      
      if (!canvas) {
        // Try to find canvas in Three.js renderer
        const threeCanvas = viewportContainer.querySelector('.three-canvas canvas') || 
                           viewportContainer.querySelector('div canvas') ||
                           viewportContainer.querySelector('[data-engine="three.js"] canvas');
        if (threeCanvas) {
          console.log('Found Three.js canvas');
          canvas = threeCanvas;
        }
      }
      
      if (!canvas) {
        console.error('❌ No canvas found in viewport');
        console.log('Viewport container structure:', viewportContainer.innerHTML);
        
        // Try to find canvas in different ways
        const allCanvases = document.querySelectorAll('canvas');
        console.log('Available canvases:', allCanvases);
        if (allCanvases.length > 0) {
          console.log('Using first available canvas');
          const fallbackCanvas = allCanvases[0];
          return await captureFromCanvas(fallbackCanvas);
        }
        createFallbackImage();
        return;
      }

      // Small delay to ensure Three.js has finished rendering
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return await captureFromCanvas(canvas);
      
    } catch (error) {
      console.error('❌ Failed to capture viewport:', error);
      // Create a fallback placeholder image
      createFallbackImage();
    } finally {
      setIsCapturing(false);
    }
  }, [viewportRef, onCapture, isCapturing, framePosition, frameSize]);

  const captureFromCanvas = useCallback(async (canvas) => {
    console.log('📸 Capturing from canvas:', canvas);
    console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
    console.log('Canvas style dimensions:', canvas.style.width, 'x', canvas.style.height);
    console.log('Frame position:', framePosition);
    console.log('Frame size:', frameSize);

    const canvasRect = canvas.getBoundingClientRect();
    const viewportRect = viewportRef.current.getBoundingClientRect();

    console.log('Canvas rect:', canvasRect);
    console.log('Viewport rect:', viewportRect);

    // Force a render frame before capturing
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    // Calculate the capture area relative to the canvas using current frame position and size
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;
    
    console.log('Scale factors:', { scaleX, scaleY });
    
    // Convert frame position relative to viewport to screen coordinates
    const frameLeft = viewportRect.left + framePosition.x;
    const frameTop = viewportRect.top + framePosition.y;
    
    // Then convert to canvas coordinates
    const captureX = Math.max(0, (frameLeft - canvasRect.left) * scaleX);
    const captureY = Math.max(0, (frameTop - canvasRect.top) * scaleY);
    const captureWidth = Math.min(canvas.width - captureX, frameSize.width * scaleX);
    const captureHeight = Math.min(canvas.height - captureY, frameSize.height * scaleY);

    console.log('Capture area:', { captureX, captureY, captureWidth, captureHeight });

    // Ensure we have valid dimensions
    if (captureWidth <= 0 || captureHeight <= 0) {
      console.error('❌ Invalid capture dimensions');
      createFallbackImage();
      return;
    }

    // Create a new canvas for the cropped image
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    
    cropCanvas.width = captureWidth;
    cropCanvas.height = captureHeight;

    // Draw the cropped section
    cropCtx.drawImage(
      canvas,
      captureX, captureY, captureWidth, captureHeight,
      0, 0, captureWidth, captureHeight
    );

    // Convert to data URL
    const dataUrl = cropCanvas.toDataURL('image/png', 0.9);
    console.log('✅ Capture successful, data URL length:', dataUrl.length);
    console.log('🖼️ Captured image preview (first 200 chars):', dataUrl.substring(0, 200));
    
    // Debug: Also capture full canvas for comparison
    const fullCanvasDataUrl = canvas.toDataURL('image/png', 0.9);
    console.log('🖼️ Full canvas capture length:', fullCanvasDataUrl.length);
    console.log('🖼️ Full canvas preview (first 200 chars):', fullCanvasDataUrl.substring(0, 200));
    
    // Store for preview
    setLastCaptured(dataUrl);
    
    // Show success indicator
    setCaptureSuccess(true);
    setTimeout(() => setCaptureSuccess(false), 2000);
    
    // Call the capture callback with the cropped image
    onCapture(dataUrl);
  }, [framePosition, frameSize, viewportRef, onCapture]);

  const createFallbackImage = useCallback(() => {
    console.log('🔄 Creating fallback image...');
    
    // Create a fallback canvas with gradient and text
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = frameSize.width;
    fallbackCanvas.height = frameSize.height;
    const ctx = fallbackCanvas.getContext('2d');

    // Draw a gradient background
    const gradient = ctx.createLinearGradient(0, 0, frameSize.width, frameSize.height);
    gradient.addColorStop(0, '#1f2937');
    gradient.addColorStop(0.5, '#374151');
    gradient.addColorStop(1, '#4b5563');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, frameSize.width, frameSize.height);

    // Add border
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, frameSize.width - 4, frameSize.height - 4);

    // Add text
    ctx.fillStyle = '#f3f4f6';
    ctx.font = '24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Viewport Capture', frameSize.width / 2, frameSize.height / 2 - 20);
    
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#d1d5db';
    ctx.fillText(`${Math.round(frameSize.width)} × ${Math.round(frameSize.height)}`, frameSize.width / 2, frameSize.height / 2 + 10);
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillText('Preview not available', frameSize.width / 2, frameSize.height / 2 + 35);

    const dataUrl = fallbackCanvas.toDataURL('image/png');
    setLastCaptured(dataUrl);
    onCapture(dataUrl);
  }, [frameSize, onCapture]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {/* Dimmed overlay */}
      <div className="absolute inset-0 bg-black/20"></div>
      
      {/* Capture frame */}
      <div 
        ref={frameRef}
        className={`capture-frame-overlay absolute pointer-events-auto ${
          isDragging ? 'dragging' : ''
        } ${isResizing ? 'resizing' : ''}`}
        style={{
          left: framePosition.x,
          top: framePosition.y,
          width: frameSize.width,
          height: frameSize.height,
          cursor: isDragging ? 'grabbing' : (isResizing ? 'nw-resize' : 'grab')
        }}
      >
        {/* Main capture rectangle */}
        <div 
          className={`w-full h-full border-4 rounded-lg shadow-2xl bg-transparent backdrop-blur-sm relative select-none transition-colors duration-150 ${
            isDragging || isResizing 
              ? 'border-purple-400/90 shadow-purple-500/20' 
              : 'border-white/80 hover:border-purple-400/70'
          }`}
          onMouseDown={(e) => handleMouseDown(e, 'drag')}
        >
          {/* Resize handles */}
          {/* Top-left */}
          <div 
            className="absolute -top-2 -left-2 w-6 h-6 border-l-4 border-t-4 border-white rounded-tl-lg cursor-nw-resize hover:border-purple-400 transition-colors"
            onMouseDown={(e) => handleMouseDown(e, 'resize', 'top-left')}
          ></div>
          
          {/* Top-right */}
          <div 
            className="absolute -top-2 -right-2 w-6 h-6 border-r-4 border-t-4 border-white rounded-tr-lg cursor-ne-resize hover:border-purple-400 transition-colors"
            onMouseDown={(e) => handleMouseDown(e, 'resize', 'top-right')}
          ></div>
          
          {/* Bottom-left */}
          <div 
            className="absolute -bottom-2 -left-2 w-6 h-6 border-l-4 border-b-4 border-white rounded-bl-lg cursor-sw-resize hover:border-purple-400 transition-colors"
            onMouseDown={(e) => handleMouseDown(e, 'resize', 'bottom-left')}
          ></div>
          
          {/* Bottom-right */}
          <div 
            className="absolute -bottom-2 -right-2 w-6 h-6 border-r-4 border-b-4 border-white rounded-br-lg cursor-se-resize hover:border-purple-400 transition-colors"
            onMouseDown={(e) => handleMouseDown(e, 'resize', 'bottom-right')}
          ></div>
          
          {/* Edge resize handles */}
          {/* Top edge */}
          <div 
            className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-2 cursor-n-resize hover:bg-white/20 rounded transition-colors"
            onMouseDown={(e) => handleMouseDown(e, 'resize', 'top')}
          ></div>
          
          {/* Right edge */}
          <div 
            className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-2 h-8 cursor-e-resize hover:bg-white/20 rounded transition-colors"
            onMouseDown={(e) => handleMouseDown(e, 'resize', 'right')}
          ></div>
          
          {/* Bottom edge */}
          <div 
            className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-2 cursor-s-resize hover:bg-white/20 rounded transition-colors"
            onMouseDown={(e) => handleMouseDown(e, 'resize', 'bottom')}
          ></div>
          
          {/* Left edge */}
          <div 
            className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-2 h-8 cursor-w-resize hover:bg-white/20 rounded transition-colors"
            onMouseDown={(e) => handleMouseDown(e, 'resize', 'left')}
          ></div>
          
          {/* Center crosshair */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-8 h-0.5 bg-white/60"></div>
            <div className="w-0.5 h-8 bg-white/60 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
          </div>
          
          {/* Size indicator */}
          <div className="absolute top-2 left-2 pointer-events-none">
            <div className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
              {Math.round(frameSize.width)} × {Math.round(frameSize.height)}
            </div>
          </div>

          {/* Last captured preview */}
          {lastCaptured && (
            <div className="absolute bottom-2 right-2 pointer-events-none">
              <div className="bg-black/70 p-1 rounded backdrop-blur-sm">
                <img 
                  src={lastCaptured} 
                  alt="Last capture" 
                  className="w-16 h-12 object-cover rounded border border-white/30"
                />
                <div className="text-white text-xs text-center mt-1">Last Capture</div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Instructions */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-center pointer-events-none">
        <div className="bg-gray-900/90 text-white px-4 py-2 rounded-lg backdrop-blur-md border border-gray-700/50">
          <p className="text-sm font-medium">Drag to move • Drag corners/edges to resize</p>
          <p className="text-xs text-gray-300 mt-1">You can still navigate the viewport while this frame is active</p>
        </div>
      </div>
      
      {/* Control buttons */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-3 pointer-events-auto">
        {/* Capture button */}
        <button
          onClick={handleCapture}
          disabled={isCapturing}
          className={`group relative px-6 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl text-white ${
            captureSuccess 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-purple-600 hover:bg-purple-700'
          } ${
            isCapturing ? 'cursor-not-allowed opacity-50 bg-gray-600' : 'hover:scale-105'
          }`}
          title="Capture this view"
        >
          <div className="flex items-center space-x-2">
            {isCapturing ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="font-medium">Capturing...</span>
              </>
            ) : captureSuccess ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Captured!</span>
              </>
            ) : (
              <>
                <CameraIcon className="w-5 h-5" />
                <span className="font-medium">Capture</span>
              </>
            )}
          </div>
          
          {/* Glow effect */}
          <div className={`absolute inset-0 rounded-lg blur transition-all duration-200 ${
            captureSuccess 
              ? 'bg-green-400/20 group-hover:bg-green-400/30' 
              : 'bg-purple-400/20 group-hover:bg-purple-400/30'
          }`}></div>
        </button>
        
        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="px-4 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
          title="Cancel capture"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ViewportCaptureFrame; 