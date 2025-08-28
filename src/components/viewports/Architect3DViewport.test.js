/**
 * Architect3DViewport Test Component
 * 
 * Simple test to verify the new viewport integration
 */

import React from 'react';
import Architect3DViewport from './Architect3DViewport';

const Architect3DViewportTest = () => {
  const handleObjectClick = (objectId, objectData) => {
    console.log('🎯 Test: Object clicked:', objectId, objectData);
  };

  const handleGroundClick = (position) => {
    console.log('🏠 Test: Ground clicked at:', position);
  };

  return (
    <div className="w-full h-screen bg-gray-900">
      <div className="w-full h-full">
        <Architect3DViewport
          theme="dark"
          selectedTool="pointer"
          onObjectClick={handleObjectClick}
          onGroundClick={handleGroundClick}
          className="border border-gray-700 rounded-lg"
        />
      </div>
      
      {/* Test Info */}
      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg text-sm">
        <h3 className="font-bold mb-2">Architect3D Viewport Test</h3>
        <ul className="space-y-1 text-xs">
          <li>• Smooth architect3d controls</li>
          <li>• Enhanced lighting system</li>
          <li>• Advanced object interaction</li>
          <li>• StudioSix integration</li>
        </ul>
      </div>
    </div>
  );
};

export default Architect3DViewportTest;