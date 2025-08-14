import React from 'react';

const PropertyPanelFooter = ({ theme = 'dark', propertyCount = 0 }) => {
  return (
    <div className={`property-panel-footer px-4 py-2 border-t ${
      theme === 'dark' 
        ? 'bg-gray-800/30 border-gray-700/50' 
        : 'bg-gray-100/30 border-gray-300/50'
    }`}>
      <div className="flex items-center justify-between">
        <div className={`text-xs ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {propertyCount > 0 ? `${propertyCount} properties` : 'No properties'}
        </div>
        <div className={`text-xs flex items-center space-x-2 ${
          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
        }`}>
          <span className="text-xs">⌘+Enter to apply</span>
          <span className="text-studiosix-400 font-medium">StudioSix</span>
        </div>
      </div>
    </div>
  );
};

export default PropertyPanelFooter; 