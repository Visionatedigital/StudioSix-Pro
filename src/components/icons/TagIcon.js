import React from 'react';

/**
 * Tag Icon Component
 * Represents annotation tags with text and leader lines
 * Designed to integrate with HeroIcons styling patterns
 */
const TagIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <svg 
      className={className} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 32 32"
      {...props}
    >
      {/* Tag Shape (Price Tag Style) */}
      <path 
        d="M4 4 L16 4 L28 16 L16 28 L4 16 Z" 
        fill="currentColor" 
        fillOpacity="0.15"
        stroke="currentColor" 
        strokeWidth="1.5"
      />
      
      {/* Tag Hole */}
      <circle 
        cx="10" cy="10" 
        r="2" 
        fill="currentColor" 
        fillOpacity="0.1"
        stroke="currentColor" 
        strokeWidth="1"
      />
      
      {/* Text Lines on Tag */}
      <line 
        x1="8" y1="16" 
        x2="16" y2="16" 
        stroke="currentColor" 
        strokeWidth="1.2" 
        strokeLinecap="round"
        opacity="0.8"
      />
      
      <line 
        x1="8" y1="19" 
        x2="14" y2="19" 
        stroke="currentColor" 
        strokeWidth="1.2" 
        strokeLinecap="round"
        opacity="0.8"
      />
      
      <line 
        x1="8" y1="22" 
        x2="12" y2="22" 
        stroke="currentColor" 
        strokeWidth="1" 
        strokeLinecap="round"
        opacity="0.6"
      />
      
      {/* Leader Line (Connection) */}
      <path 
        d="M20 20 Q24 18 26 16 Q28 14 30 12" 
        stroke="currentColor" 
        strokeWidth="1.2" 
        fill="none" 
        strokeDasharray="2,2"
        strokeLinecap="round"
        opacity="0.7"
      />
      
      {/* Connection Point */}
      <circle 
        cx="30" cy="12" 
        r="1.5" 
        fill="currentColor" 
        fillOpacity="0.8"
        stroke="currentColor" 
        strokeWidth="0.5"
        opacity="0.9"
      />
      
      {/* Corner Fold Effect (for depth) */}
      <path 
        d="M14 4 L16 6 L14 8 L12 6 Z" 
        fill="currentColor" 
        fillOpacity="0.2"
        stroke="currentColor" 
        strokeWidth="0.5"
        opacity="0.8"
      />
      
      {/* Highlight Effect */}
      <path 
        d="M6 6 L14 6 L8 12 L6 10 Z" 
        fill="currentColor"
        fillOpacity="0.1"
      />
    </svg>
  );
};

export default TagIcon;