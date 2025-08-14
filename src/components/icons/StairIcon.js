import React from 'react';

/**
 * Stair Icon Component
 * Represents stairs with steps, handrail, and directional flow
 * Designed to integrate with HeroIcons styling patterns
 */
const StairIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <svg 
      className={className} 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 32 32"
      {...props}
    >
      {/* Stair Structure (Side View) */}
      
      {/* Step 1 (Bottom) */}
      <rect 
        x="4" y="24" 
        width="6" height="4" 
        fill="currentColor" 
        fillOpacity="0.2"
        stroke="currentColor" 
        strokeWidth="1"
      />
      
      {/* Step 2 */}
      <rect 
        x="8" y="21" 
        width="6" height="7" 
        fill="currentColor" 
        fillOpacity="0.15"
        stroke="currentColor" 
        strokeWidth="1"
      />
      
      {/* Step 3 */}
      <rect 
        x="12" y="18" 
        width="6" height="10" 
        fill="currentColor" 
        fillOpacity="0.2"
        stroke="currentColor" 
        strokeWidth="1"
      />
      
      {/* Step 4 */}
      <rect 
        x="16" y="15" 
        width="6" height="13" 
        fill="currentColor" 
        fillOpacity="0.15"
        stroke="currentColor" 
        strokeWidth="1"
      />
      
      {/* Step 5 (Top) */}
      <rect 
        x="20" y="12" 
        width="6" height="16" 
        fill="currentColor" 
        fillOpacity="0.2"
        stroke="currentColor" 
        strokeWidth="1"
      />
      
      {/* Handrail */}
      <path 
        d="M4 20 Q8 18 12 16 Q16 14 20 12 L24 10" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        fill="none" 
        strokeLinecap="round"
        opacity="0.8"
      />
      
      {/* Handrail Posts */}
      <line x1="6" y1="20" x2="6" y2="18" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <line x1="10" y1="18" x2="10" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <line x1="14" y1="16" x2="14" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <line x1="18" y1="14" x2="18" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <line x1="22" y1="12" x2="22" y2="10" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      
      {/* Tread Lines (Step Edges) */}
      <line x1="4" y1="24" x2="10" y2="24" stroke="currentColor" strokeWidth="1.2" opacity="0.8"/>
      <line x1="8" y1="21" x2="14" y2="21" stroke="currentColor" strokeWidth="1.2" opacity="0.8"/>
      <line x1="12" y1="18" x2="18" y2="18" stroke="currentColor" strokeWidth="1.2" opacity="0.8"/>
      <line x1="16" y1="15" x2="22" y2="15" stroke="currentColor" strokeWidth="1.2" opacity="0.8"/>
      <line x1="20" y1="12" x2="26" y2="12" stroke="currentColor" strokeWidth="1.2" opacity="0.8"/>
      
      {/* Rise Lines (Vertical Edges) */}
      <line x1="10" y1="24" x2="10" y2="21" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <line x1="14" y1="21" x2="14" y2="18" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <line x1="18" y1="18" x2="18" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <line x1="22" y1="15" x2="22" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      
      {/* Step Surface Texture */}
      <g opacity="0.4">
        <line x1="5" y1="25" x2="9" y2="25" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="9" y1="22" x2="13" y2="22" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="13" y1="19" x2="17" y2="19" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="17" y1="16" x2="21" y2="16" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="21" y1="13" x2="25" y2="13" stroke="currentColor" strokeWidth="0.5"/>
      </g>
      
      {/* Directional Arrow (Movement indicator) */}
      <defs>
        <marker 
          id="stair-arrowhead" 
          markerWidth="8" 
          markerHeight="6" 
          refX="7" 
          refY="3" 
          orient="auto"
        >
          <path d="M0,0 L0,6 L7,3 z" fill="currentColor" opacity="0.7" />
        </marker>
      </defs>
      
      <path 
        d="M2 26 Q6 24 10 22 Q14 20 18 18 Q20 17 22 16" 
        stroke="currentColor" 
        strokeWidth="1.2" 
        fill="none" 
        markerEnd="url(#stair-arrowhead)"
        opacity="0.6"
      />
      
      {/* Landing/Platform (Top) */}
      <rect 
        x="24" y="10" 
        width="4" height="2" 
        fill="currentColor" 
        fillOpacity="0.15"
        stroke="currentColor" 
        strokeWidth="1"
        opacity="0.8"
      />
    </svg>
  );
};

export default StairIcon;