import React from 'react';

/**
 * Roof Icon Component
 * Represents a gable roof with tiles, chimney, and architectural details
 * Designed to integrate with HeroIcons styling patterns
 */
const RoofIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <svg 
      className={className} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 32 32"
      {...props}
    >
      {/* Main Roof Structure (Gable Roof) */}
      {/* Left Roof Surface */}
      <path 
        d="M4 20 L16 6 L28 20 L24 20 L16 10 L8 20 Z" 
        fill="currentColor" 
        fillOpacity="0.2"
        stroke="currentColor" 
        strokeWidth="1.5"
      />
      
      {/* Right Roof Surface (3D effect) */}
      <path 
        d="M16 6 L28 20 L28 24 L16 10 Z" 
        fill="currentColor" 
        fillOpacity="0.1"
        stroke="currentColor" 
        strokeWidth="1.5"
      />
      
      {/* Roof Edge/Fascia */}
      <path 
        d="M4 20 L8 20 L8 22 L4 22 Z" 
        fill="currentColor" 
        fillOpacity="0.3"
        stroke="currentColor" 
        strokeWidth="1"
      />
      
      <path 
        d="M24 20 L28 20 L28 22 L24 22 Z" 
        fill="currentColor" 
        fillOpacity="0.3"
        stroke="currentColor" 
        strokeWidth="1"
      />
      
      {/* Ridge Line */}
      <line 
        x1="16" y1="6" 
        x2="16" y2="10" 
        stroke="currentColor" 
        strokeWidth="1.5"
      />
      
      {/* Roof Tiles/Shingles Pattern */}
      {/* Left Side Tiles */}
      <g opacity="0.4">
        <line x1="6" y1="18" x2="14" y2="10" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="8" y1="19" x2="15" y2="12" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="10" y1="20" x2="16" y2="14" stroke="currentColor" strokeWidth="0.5"/>
      </g>
      
      {/* Right Side Tiles */}
      <g opacity="0.3">
        <line x1="18" y1="10" x2="26" y2="18" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="17" y1="12" x2="24" y2="19" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="16" y1="14" x2="22" y2="20" stroke="currentColor" strokeWidth="0.5"/>
      </g>
      
      {/* Gutter/Eave Details */}
      <rect 
        x="7" y="20" 
        width="2" height="1" 
        fill="currentColor" 
        fillOpacity="0.4"
        stroke="currentColor" 
        strokeWidth="0.5"
      />
      
      <rect 
        x="23" y="20" 
        width="2" height="1" 
        fill="currentColor" 
        fillOpacity="0.4"
        stroke="currentColor" 
        strokeWidth="0.5"
      />
      
      {/* Chimney (Optional Detail) */}
      <rect 
        x="20" y="12" 
        width="3" height="6" 
        fill="currentColor" 
        fillOpacity="0.3"
        stroke="currentColor" 
        strokeWidth="1"
      />
      
      <rect 
        x="19.5" y="11.5" 
        width="4" height="1" 
        fill="currentColor" 
        fillOpacity="0.4"
        stroke="currentColor" 
        strokeWidth="0.5"
      />
      
      {/* Building Base (partial) */}
      <rect 
        x="6" y="20" 
        width="20" height="6" 
        fill="currentColor" 
        fillOpacity="0.1"
        stroke="currentColor" 
        strokeWidth="1" 
        opacity="0.7"
      />
    </svg>
  );
};

export default RoofIcon;