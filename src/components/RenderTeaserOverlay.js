import React from 'react';

const RenderTeaserOverlay = ({ isOpen, onClose, beforeSrc, afterSrc, onTryRenderStudio }) => {
  const [slider, setSlider] = React.useState(50);
  const [dragging, setDragging] = React.useState(false);
  const mediaRef = React.useRef(null);

  const updateFromClientX = (clientX) => {
    const el = mediaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(rect.left, Math.min(clientX, rect.right));
    const pct = ((x - rect.left) / rect.width) * 100;
    setSlider(Math.max(0, Math.min(100, Math.round(pct))));
  };

  const onPointerDown = (e) => {
    setDragging(true);
    updateFromClientX(e.clientX);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  };

  const endDrag = () => setDragging(false);

  React.useEffect(() => {
    if (!dragging) return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
    };
  }, [dragging]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 z-20 px-2 py-1 bg-slate-800/70 hover:bg-slate-700/80 text-white rounded-md">✕</button>
        {/* Media area */}
        <div ref={mediaRef} className="relative h-64 sm:h-80 md:h-96 bg-black select-none cursor-col-resize" onPointerDown={onPointerDown}>
          {beforeSrc && (
            <img src={beforeSrc} alt="Before" className="absolute inset-0 w-full h-full object-cover opacity-100" draggable={false} />
          )}
          {afterSrc && (
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}>
              <img src={afterSrc} alt="After" className="w-full h-full object-cover" draggable={false} />
            </div>
          )}
          {/* Divider line aligned with mask */}
          <div className="absolute inset-y-0" style={{ left: `calc(${slider}% - 1px)` }}>
            <div className="w-0.5 h-full bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,.2)]" />
          </div>
          {/* Draggable handle */}
          <button
            onPointerDown={onPointerDown}
            style={{ left: `calc(${slider}% - 24px)` }}
            className="absolute top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/95 text-slate-800 shadow-xl border border-white/70 flex items-center justify-center"
            aria-label="Compare slider"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={slider}
          >
            {/* chevrons */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 7L5 12L10 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 7L19 12L14 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        {/* Text + CTA */}
        <div className="p-5 sm:p-6 md:p-7">
          <h3 className="text-xl md:text-2xl font-bold text-white">Generate Renders with AI</h3>
          <p className="text-gray-300 mt-2 text-sm md:text-base">Transform your reference images into high‑quality renders in minutes. Try the AI Render Studio and compare results instantly.</p>
          <div className="mt-5 flex gap-3">
            <button onClick={onTryRenderStudio} className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg font-semibold shadow-lg">Try in Render Studio</button>
            <button onClick={onClose} className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RenderTeaserOverlay;
