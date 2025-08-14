import React from 'react';

/**
 * Window Icon Component
 * Represents a traditional double-hung window with glass panes and cross bars
 * Designed to integrate with HeroIcons styling patterns
 */
const WindowIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <svg 
      className={className} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 32 32"
      {...props}
    >
      {/* Window Frame */}
      <rect 
        x="4" y="6" 
        width="24" height="20" 
        fill="rgba(59, 130, 246, 0.1)" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        rx="1"
      />
      
      {/* Window Sash (Outer Frame) */}
      <rect 
        x="5.5" y="7.5" 
        width="21" height="17" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1" 
        rx="0.5"
      />
      
      {/* Center Cross Bars */}
      {/* Vertical */}
      <line 
        x1="16" y1="7.5" 
        x2="16" y2="24.5" 
        stroke="currentColor" 
        strokeWidth="1.2"
      />
      
      {/* Horizontal */}
      <line 
        x1="5.5" y1="16" 
        x2="26.5" y2="16" 
        stroke="currentColor" 
        strokeWidth="1.2"
      />
      
      {/* Glass Panes - subtle fill */}
      {/* Top Left */}
      <rect 
        x="6" y="8" 
        width="9" height="7" 
        fill="currentColor" 
        fillOpacity="0.1"
      />
      
      {/* Top Right */}
      <rect 
        x="17" y="8" 
        width="9" height="7" 
        fill="currentColor" 
        fillOpacity="0.1"
      />
      
      {/* Bottom Left */}
      <rect 
        x="6" y="17" 
        width="9" height="7" 
        fill="currentColor" 
        fillOpacity="0.1"
      />
      
      {/* Bottom Right */}
      <rect 
        x="17" y="17" 
        width="9" height="7" 
        fill="currentColor" 
        fillOpacity="0.1"
      />
      
      {/* Window Handle */}
      <circle 
        cx="24" cy="14" 
        r="1" 
        fill="currentColor" 
        fillOpacity="0.8"
      />
      
      {/* Light Reflection Effects */}
      <path 
        d="M7 9 L13 9 L11 11 L9 11 Z" 
        fill="currentColor" 
        fillOpacity="0.3"
      />
      
      <path 
        d="M18 18 L24 18 L22 20 L20 20 Z" 
        fill="currentColor" 
        fillOpacity="0.2"
      />
    </svg>
  );
};

export default WindowIcon;