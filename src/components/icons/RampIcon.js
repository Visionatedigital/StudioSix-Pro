import React from 'react';

const RampIcon = ({ className = "w-6 h-6" }) => {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
    >
      {/* Ramp slope */}
      <path d="M3 20 L21 12 L21 20 Z" fill="currentColor" fillOpacity="0.1" />
      {/* Base line */}
      <path d="M3 20 L21 20" strokeDasharray="2,2" />
      {/* Slope direction arrow */}
      <path d="M15 15 L18 12 L15 9" strokeWidth="1.5" />
    </svg>
  );
};

export default RampIcon;








