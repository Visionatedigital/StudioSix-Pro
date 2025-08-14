import React from 'react';

/**
 * Custom Wall Icon component for the BIM toolbar
 * Designed to match the visual style and sizing of HeroIcons
 */
const WallIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Wall foundation/shadow */}
      <rect
        x="1"
        y="25"
        width="30"
        height="6"
        rx="0.5"
        fill="currentColor"
        fillOpacity="0.2"
      />
      
      {/* Main wall structure */}
      <rect
        x="2"
        y="6"
        width="28"
        height="20"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      
      {/* Brick pattern lines - simplified for clarity */}
      {/* Horizontal lines */}
      <line x1="2" y1="10" x2="30" y2="10" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="2" y1="14" x2="30" y2="14" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="2" y1="18" x2="30" y2="18" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="2" y1="22" x2="30" y2="22" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      
      {/* Vertical lines - alternating pattern for brick effect */}
      {/* Row 1 vertical dividers */}
      <line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="16" y1="6" x2="16" y2="10" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="24" y1="6" x2="24" y2="10" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      
      {/* Row 2 vertical dividers (offset) */}
      <line x1="5" y1="10" x2="5" y2="14" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="13" y1="10" x2="13" y2="14" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="21" y1="10" x2="21" y2="14" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="29" y1="10" x2="29" y2="14" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      
      {/* Row 3 vertical dividers */}
      <line x1="8" y1="14" x2="8" y2="18" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="16" y1="14" x2="16" y2="18" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="24" y1="14" x2="24" y2="18" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      
      {/* Row 4 vertical dividers (offset) */}
      <line x1="5" y1="18" x2="5" y2="22" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="13" y1="18" x2="13" y2="22" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="21" y1="18" x2="21" y2="22" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="29" y1="18" x2="29" y2="22" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      
      {/* Top row dividers */}
      <line x1="8" y1="22" x2="8" y2="26" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="16" y1="22" x2="16" y2="26" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="24" y1="22" x2="24" y2="26" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.6" />
      
      {/* Top highlight */}
      <rect
        x="2"
        y="6"
        width="28"
        height="1"
        rx="0.5"
        fill="currentColor"
        fillOpacity="0.8"
      />
    </svg>
  );
};

export default WallIcon;