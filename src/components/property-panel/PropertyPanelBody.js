import React from 'react';
import PropertyField from './PropertyField';

const PropertyPanelBody = ({ properties, onChange, theme = 'dark', isLoading = false }) => {
  // Group properties by category if they have one
  const groupedProperties = Object.entries(properties).reduce((acc, [key, value]) => {
    const category = value.category || 'General';
    if (!acc[category]) {
      acc[category] = {};
    }
    acc[category][key] = value;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className={`property-panel-body p-8 text-center ${
        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
      }`}>
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-studiosix-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading properties...</p>
        </div>
      </div>
    );
  }

  if (Object.keys(properties).length === 0) {
    return (
      <div className={`property-panel-body p-8 text-center ${
        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
      }`}>
        <p className="text-sm">No properties available</p>
      </div>
    );
  }

  return (
    <div className="property-panel-body max-h-[70vh] overflow-y-auto custom-scrollbar">
      {Object.entries(groupedProperties).map(([category, props]) => (
        <div key={category} className="property-group">
          <div className={`px-4 py-2 border-b sticky top-0 z-10 backdrop-blur-sm ${
            theme === 'dark' 
              ? 'bg-gray-800/70 border-gray-700/50' 
              : 'bg-gray-100/70 border-gray-300/50'
          }`}>
            <h4 className={`text-xs font-medium uppercase tracking-wider flex items-center justify-between ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <span>{category}</span>
              <span className={`text-xs font-normal ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                {Object.keys(props).length} {Object.keys(props).length === 1 ? 'property' : 'properties'}
              </span>
            </h4>
          </div>
          
          <div className="p-2 space-y-2">
            {Object.entries(props).map(([propertyName, propertyData]) => (
              <PropertyField
                key={propertyName}
                name={propertyName}
                value={propertyData.value}
                type={propertyData.type}
                options={propertyData.options}
                min={propertyData.min}
                max={propertyData.max}
                step={propertyData.step}
                unit={propertyData.unit}
                readonly={propertyData.readonly}
                theme={theme}
                onChange={(value) => onChange(propertyName, value)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PropertyPanelBody; 