/**
 * Opening Icon - Shows a gap/opening in a wall
 * Custom SVG icon for the Opening tool
 */
import React from 'react';

const OpeningIcon = ({ className = "w-6 h-6", ...props }) => {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Wall segments on left and right with gap in middle */}
      <rect x="2" y="8" width="6" height="8" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="16" y="8" width="6" height="8" stroke="currentColor" strokeWidth="2" fill="none" />
      
      {/* Dashed lines indicating the opening/gap */}
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
      
      {/* Optional small markers at gap edges */}
      <line x1="8" y1="8" x2="8" y2="16" stroke="currentColor" strokeWidth="1" />
      <line x1="16" y1="8" x2="16" y2="16" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
};

export default OpeningIcon;