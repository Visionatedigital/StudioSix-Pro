import React from 'react';

/**
 * Custom Door Icon component for the BIM toolbar
 * Designed to match the visual style and sizing of HeroIcons
 */
const DoorIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Shadow underneath door */}
      <ellipse
        cx="16"
        cy="29"
        rx="12"
        ry="2"
        fill="currentColor"
        fillOpacity="0.15"
      />
      
      {/* Door frame */}
      <rect
        x="6"
        y="8"
        width="20"
        height="20"
        rx="0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.6"
      />
      
      {/* Main door panel */}
      <rect
        x="7"
        y="8"
        width="16"
        height="20"
        rx="0.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      
      {/* Door panels (traditional design) */}
      {/* Top panel */}
      <rect
        x="9"
        y="10"
        width="12"
        height="7"
        rx="0.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeOpacity="0.8"
      />
      
      {/* Bottom panel */}
      <rect
        x="9"
        y="19"
        width="12"
        height="7"
        rx="0.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeOpacity="0.8"
      />
      
      {/* Door handle */}
      <circle
        cx="19"
        cy="18"
        r="1.2"
        fill="currentColor"
        fillOpacity="0.8"
      />
      <circle
        cx="19"
        cy="18"
        r="0.6"
        fill="currentColor"
        fillOpacity="0.4"
      />
      
      {/* Door hinge details */}
      <rect x="7" y="10" width="1" height="3" rx="0.5" fill="currentColor" fillOpacity="0.6"/>
      <rect x="7" y="16" width="1" height="3" rx="0.5" fill="currentColor" fillOpacity="0.6"/>
      <rect x="7" y="22" width="1" height="3" rx="0.5" fill="currentColor" fillOpacity="0.6"/>
      
      {/* Door swing indication (arc) */}
      <path 
        d="M23,28 A16,16 0 0,0 7,28" 
        stroke="currentColor" 
        strokeWidth="0.8" 
        fill="none" 
        strokeOpacity="0.4" 
        strokeDasharray="2,2"
      />
      
      {/* Top highlight */}
      <rect
        x="7"
        y="8"
        width="16"
        height="1"
        rx="0.3"
        fill="currentColor"
        fillOpacity="0.3"
      />
    </svg>
  );
};

export default DoorIcon;