import React from 'react';

/**
 * Custom Column Icon component for the BIM toolbar
 * Designed to match the visual style and sizing of HeroIcons
 * Represents an architectural column with capital and base
 */
const ColumnIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Shadow underneath column */}
      <ellipse
        cx="16"
        cy="30"
        rx="8"
        ry="2"
        fill="currentColor"
        fillOpacity="0.15"
      />
      
      {/* Column base */}
      <rect
        x="8"
        y="26"
        width="16"
        height="4"
        rx="1"
        fill="currentColor"
        fillOpacity="0.4"
        stroke="currentColor"
        strokeWidth="1"
      />
      
      {/* Column shaft */}
      <rect
        x="12"
        y="6"
        width="8"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      
      {/* Column capital (top) */}
      <rect
        x="8"
        y="2"
        width="16"
        height="4"
        rx="1"
        fill="currentColor"
        fillOpacity="0.4"
        stroke="currentColor"
        strokeWidth="1"
      />
      
      {/* Fluting/texture lines on shaft */}
      <line 
        x1="14" 
        y1="8" 
        x2="14" 
        y2="24" 
        stroke="currentColor" 
        strokeWidth="0.5" 
        strokeOpacity="0.3"
      />
      <line 
        x1="16" 
        y1="8" 
        x2="16" 
        y2="24" 
        stroke="currentColor" 
        strokeWidth="0.5" 
        strokeOpacity="0.3"
      />
      <line 
        x1="18" 
        y1="8" 
        x2="18" 
        y2="24" 
        stroke="currentColor" 
        strokeWidth="0.5" 
        strokeOpacity="0.3"
      />
      
      {/* Capital details */}
      <rect
        x="9"
        y="3"
        width="14"
        height="1"
        fill="currentColor"
        fillOpacity="0.6"
      />
      
      {/* Base details */}
      <rect
        x="9"
        y="28"
        width="14"
        height="1"
        fill="currentColor"
        fillOpacity="0.6"
      />
      
      {/* 3D depth effect for capital */}
      <path
        d="M24,2 L26,1 L26,5 L24,6 Z"
        fill="currentColor"
        fillOpacity="0.3"
      />
      
      {/* 3D depth effect for base */}
      <path
        d="M24,26 L26,25 L26,29 L24,30 Z"
        fill="currentColor"
        fillOpacity="0.3"
      />
    </svg>
  );
};

export default ColumnIcon;