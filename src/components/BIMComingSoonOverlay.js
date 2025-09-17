import React from 'react';

const BIMComingSoonOverlay = ({ onTryRenderStudio }) => {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm pointer-events-none"></div>

      {/* Card */}
      <div className="relative mx-4 sm:mx-6 md:mx-10 max-w-2xl w-full bg-slate-900/90 border border-slate-700/70 rounded-2xl shadow-2xl p-6 sm:p-8 text-center">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white ring-1 ring-studiosix-600/40">
            <img src="/studiosix-icon.svg" alt="StudioSix Icon" className="w-6 h-6" />
          </div>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">BIM Modeler is coming soon</h2>
        <p className="text-sm sm:text-base text-gray-300 mb-4">
          Were putting the final touches on our interactive BIM modeling experience.
        </p>
        <p className="text-sm sm:text-base text-gray-400 mb-6">
          Public beta will be available on <span className="text-white font-semibold">15 October 2025</span>.
        </p>

        <button
          onClick={onTryRenderStudio}
          className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-0"
        >
          Try the Render Studio instead
        </button>

        <div className="mt-4 text-xs text-gray-500">
          You can still browse the interface in the background.
        </div>
      </div>
    </div>
  );
};

export default BIMComingSoonOverlay;


