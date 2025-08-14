import React from 'react';

/**
 * Custom Slab Icon component for the BIM toolbar
 * Designed to match the visual style and sizing of HeroIcons
 */
const SlabIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Shadow underneath slab */}
      <ellipse
        cx="16"
        cy="28"
        rx="14"
        ry="3"
        fill="currentColor"
        fillOpacity="0.15"
      />
      
      {/* Main slab surface (top view) */}
      <rect
        x="4"
        y="10"
        width="24"
        height="16"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      
      {/* Slab edge/depth (3D effect) */}
      <path
        d="M28,10 L30,8 L30,24 L28,26 Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <path
        d="M4,26 L6,28 L30,28 L28,26 Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      
      {/* Surface texture/pattern - concrete aggregate */}
      <circle cx="8" cy="14" r="1" fill="currentColor" fillOpacity="0.4" />
      <circle cx="12" cy="16" r="0.8" fill="currentColor" fillOpacity="0.4" />
      <circle cx="16" cy="14" r="1" fill="currentColor" fillOpacity="0.4" />
      <circle cx="20" cy="17" r="0.8" fill="currentColor" fillOpacity="0.4" />
      <circle cx="24" cy="13" r="1" fill="currentColor" fillOpacity="0.4" />
      <circle cx="10" cy="20" r="0.8" fill="currentColor" fillOpacity="0.4" />
      <circle cx="14" cy="22" r="1" fill="currentColor" fillOpacity="0.4" />
      <circle cx="18" cy="21" r="0.8" fill="currentColor" fillOpacity="0.4" />
      <circle cx="22" cy="23" r="1" fill="currentColor" fillOpacity="0.4" />
      <circle cx="26" cy="20" r="0.8" fill="currentColor" fillOpacity="0.4" />
      
      {/* Reinforcement bars (rebar) indication - simplified */}
      <line 
        x1="6" 
        y1="16" 
        x2="26" 
        y2="16" 
        stroke="currentColor" 
        strokeWidth="0.5" 
        strokeOpacity="0.3" 
        strokeDasharray="1,1"
      />
      <line 
        x1="6" 
        y1="20" 
        x2="26" 
        y2="20" 
        stroke="currentColor" 
        strokeWidth="0.5" 
        strokeOpacity="0.3" 
        strokeDasharray="1,1"
      />
      <line 
        x1="12" 
        y1="12" 
        x2="12" 
        y2="24" 
        stroke="currentColor" 
        strokeWidth="0.5" 
        strokeOpacity="0.3" 
        strokeDasharray="1,1"
      />
      <line 
        x1="20" 
        y1="12" 
        x2="20" 
        y2="24" 
        stroke="currentColor" 
        strokeWidth="0.5" 
        strokeOpacity="0.3" 
        strokeDasharray="1,1"
      />
      
      {/* Top surface highlight */}
      <rect
        x="4"
        y="10"
        width="24"
        height="1"
        rx="0.5"
        fill="currentColor"
        fillOpacity="0.6"
      />
      
      {/* Edge highlight */}
      <path
        d="M28,10 L30,8 L30,9 L28,11 Z"
        fill="currentColor"
        fillOpacity="0.5"
      />
    </svg>
  );
};

export default SlabIcon;