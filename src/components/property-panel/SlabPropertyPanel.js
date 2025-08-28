import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, SwatchIcon } from '@heroicons/react/24/outline';
import PropertyField from './PropertyField';

/**
 * Slab Property Panel Component
 * Allows users to edit slab properties including material, dimensions, and shape
 */
const SlabPropertyPanel = ({
  slabData = {},
  onClose,
  onUpdate,
  theme = 'dark'
}) => {
  const [properties, setProperties] = useState({
    width: 5.0,
    depth: 5.0,
    thickness: 0.2,
    material: 'concrete',
    shape: 'rectangular',
    offset: 0.0,
    ...slabData
  });

  // Material options with enhanced properties
  const materialOptions = [
    { 
      value: 'concrete', 
      label: 'Concrete', 
      color: '#6b7280', 
      density: 2400,
      description: 'Standard concrete slab'
    },
    { 
      value: 'tiles', 
      label: 'Ceramic Tiles', 
      color: '#f3f4f6', 
      density: 2200,
      description: 'Ceramic floor tiles'
    },
    { 
      value: 'wood', 
      label: 'Wood Deck', 
      color: '#d97706', 
      density: 600,
      description: 'Natural wood decking'
    },
    { 
      value: 'marble', 
      label: 'Marble', 
      color: '#f9fafb', 
      density: 2700,
      description: 'Polished marble surface'
    },
    { 
      value: 'granite', 
      label: 'Granite', 
      color: '#374151', 
      density: 2650,
      description: 'Natural granite stone'
    },
    { 
      value: 'steel', 
      label: 'Steel Deck', 
      color: '#64748b', 
      density: 7850,
      description: 'Steel deck flooring'
    },
    { 
      value: 'carpet', 
      label: 'Carpet', 
      color: '#8b5cf6', 
      density: 200,
      description: 'Soft carpet flooring'
    },
    { 
      value: 'vinyl', 
      label: 'Vinyl', 
      color: '#10b981', 
      density: 1200,
      description: 'Vinyl flooring'
    },
    { 
      value: 'stone', 
      label: 'Natural Stone', 
      color: '#6b7280', 
      density: 2700,
      description: 'Natural stone slabs'
    },
    { 
      value: 'precast', 
      label: 'Precast Concrete', 
      color: '#9ca3af', 
      density: 2500,
      description: 'Precast concrete panels'
    }
  ];

  // Shape options
  const shapeOptions = [
    { value: 'rectangular', label: 'Rectangular' },
    { value: 'circular', label: 'Circular' },
    { value: 'polygon', label: 'Polygon' }
  ];

  // Get current material info
  const currentMaterial = materialOptions.find(m => m.value === properties.material) || materialOptions[0];

  // Handle property changes
  const handlePropertyChange = useCallback((propertyName, value) => {
    const newProperties = { ...properties, [propertyName]: value };
    setProperties(newProperties);
    
    // Notify parent component
    if (onUpdate) {
      onUpdate(propertyName, value, newProperties);
    }
  }, [properties, onUpdate]);

  // Apply changes
  const handleApply = useCallback(() => {
    if (onUpdate) {
      onUpdate('apply', properties, properties);
    }
  }, [properties, onUpdate]);

  // Reset to original values
  const handleReset = useCallback(() => {
    setProperties({
      width: 5.0,
      depth: 5.0,
      thickness: 0.2,
      material: 'concrete',
      shape: 'rectangular',
      offset: 0.0,
      ...slabData
    });
  }, [slabData]);

  return (
    <div className={`fixed top-4 right-4 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <SwatchIcon className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Slab Properties</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Material Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Material</h4>
          
          {/* Material Preview */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div 
              className="w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600"
              style={{ backgroundColor: currentMaterial.color }}
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {currentMaterial.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {currentMaterial.description}
              </div>
            </div>
          </div>

          {/* Material Selector */}
          <PropertyField
            type="select"
            label="Material Type"
            value={properties.material}
            options={materialOptions.map(m => ({ value: m.value, label: m.label }))}
            onChange={(value) => handlePropertyChange('material', value)}
            theme={theme}
          />

          {/* Material Properties */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="text-gray-500 dark:text-gray-400">Density</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {currentMaterial.density} kg/m³
              </div>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="text-gray-500 dark:text-gray-400">Color</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {currentMaterial.color}
              </div>
            </div>
          </div>
        </div>

        {/* Dimensions Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Dimensions</h4>
          
          <div className="grid grid-cols-3 gap-3">
            <PropertyField
              type="number"
              label="Width (m)"
              value={properties.width}
              min={0.1}
              max={100}
              step={0.1}
              onChange={(value) => handlePropertyChange('width', value)}
              theme={theme}
            />
            <PropertyField
              type="number"
              label="Depth (m)"
              value={properties.depth}
              min={0.1}
              max={100}
              step={0.1}
              onChange={(value) => handlePropertyChange('depth', value)}
              theme={theme}
            />
            <PropertyField
              type="number"
              label="Thickness (m)"
              value={properties.thickness}
              min={0.01}
              max={10}
              step={0.01}
              onChange={(value) => handlePropertyChange('thickness', value)}
              theme={theme}
            />
          </div>
        </div>

        {/* Shape Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Shape</h4>
          
          <PropertyField
            type="select"
            label="Shape Type"
            value={properties.shape}
            options={shapeOptions}
            onChange={(value) => handlePropertyChange('shape', value)}
            theme={theme}
          />

          {properties.shape === 'rectangular' && (
            <PropertyField
              type="number"
              label="Offset (m)"
              value={properties.offset}
              min={-10}
              max={10}
              step={0.1}
              onChange={(value) => handlePropertyChange('offset', value)}
              theme={theme}
            />
          )}
        </div>

        {/* Calculations */}
        <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">Calculations</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-blue-600 dark:text-blue-400">Area:</span>
              <span className="ml-1 text-blue-800 dark:text-blue-200">
                {(typeof properties.width === 'number' && typeof properties.depth === 'number') 
                  ? (properties.width * properties.depth).toFixed(2) : '0.00'} m²
              </span>
            </div>
            <div>
              <span className="text-blue-600 dark:text-blue-400">Volume:</span>
              <span className="ml-1 text-blue-800 dark:text-blue-200">
                {(typeof properties.width === 'number' && typeof properties.depth === 'number' && typeof properties.thickness === 'number') 
                  ? (properties.width * properties.depth * properties.thickness).toFixed(3) : '0.000'} m³
              </span>
            </div>
            <div>
              <span className="text-blue-600 dark:text-blue-400">Weight:</span>
              <span className="ml-1 text-blue-800 dark:text-blue-200">
                {(typeof properties.width === 'number' && typeof properties.depth === 'number' && typeof properties.thickness === 'number' && typeof currentMaterial.density === 'number') 
                  ? ((properties.width * properties.depth * properties.thickness) * currentMaterial.density).toFixed(1) : '0.0'} kg
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleReset}
          className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          Reset
        </button>
        <div className="flex space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlabPropertyPanel; 