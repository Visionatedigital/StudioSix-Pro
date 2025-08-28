import React from 'react';

/**
 * Custom Slab Icon component for the BIM toolbar
 * Simple 2D rectangle representing a slab
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
      {/* Simple 2D rectangle - larger and taller */}
      <rect
        x="4"
        y="6"
        width="24"
        height="20"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
};

export default SlabIcon;