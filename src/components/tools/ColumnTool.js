import React, { useState, useEffect, useCallback } from 'react';
import standaloneCADEngine from '../../services/StandaloneCADEngine';
import {
  SwatchIcon,
  RectangleStackIcon,
  AdjustmentsVerticalIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

/**
 * Column Tool Component - Provides interface for column creation and editing
 * Allows users to specify column parameters before placement
 */
const ColumnTool = ({
  isActive = false,
  selectedObject = null,
  onCancel,
  theme = 'dark',
  cadObjects = [], // Objects from standalone CAD engine
  onObjectCreated, // Callback when object is created
  onObjectUpdated, // Callback when object is updated
  gridPoints = [] // Grid intersection points for column placement
}) => {
  // Column parameters state
  const [columnParams, setColumnParams] = useState({
    width: 0.4,
    depth: 0.4,
    height: 3.0,
    shape: 'rectangular', // 'rectangular', 'circular'
    material: 'concrete',
    offset: 0.0
  });

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [availableGridPoints, setAvailableGridPoints] = useState([]);

  // Material options for columns
  const materialOptions = [
    { value: 'concrete', label: 'Concrete', color: '#6b7280', density: 2400 },
    { value: 'steel', label: 'Steel', color: '#708090', density: 7850 },
    { value: 'wood', label: 'Wood', color: '#deb887', density: 600 },
    { value: 'composite', label: 'Composite', color: '#8b7d6b', density: 1800 },
    { value: 'stone', label: 'Stone', color: '#696969', density: 2700 },
    { value: 'precast', label: 'Precast Concrete', color: '#9ca3af', density: 2500 }
  ];

  // Shape options
  const shapeOptions = [
    { value: 'rectangular', label: 'Rectangular', icon: '▭' },
    { value: 'circular', label: 'Circular', icon: '○' }
  ];

  // Initialize with existing column data if editing
  useEffect(() => {
    if (selectedObject && (selectedObject.type === 'Column' || selectedObject.type === 'column')) {
      setColumnParams({
        width: selectedObject.width || 0.4,
        depth: selectedObject.depth || 0.4,
        height: selectedObject.height || 3.0,
        shape: selectedObject.shape || 'rectangular',
        material: selectedObject.material || 'concrete',
        offset: selectedObject.offset || 0.0
      });
    }
  }, [selectedObject]);

  // Update available grid points for column placement
  useEffect(() => {
    if (!isActive) return;
    
    // Use provided grid points or detect grids from CAD objects
    const gridPointsToUse = gridPoints.length > 0 ? gridPoints : [];
    setAvailableGridPoints(gridPointsToUse);
  }, [cadObjects, gridPoints, isActive]);

  // Parameter validation
  const validateParameters = useCallback(() => {
    const errors = {};
    
    // Width validation
    if (columnParams.width <= 0 || columnParams.width > 2) {
      errors.width = 'Width must be between 0.05m and 2m';
    }
    
    // Depth validation (for rectangular columns)
    if (columnParams.shape === 'rectangular' && (columnParams.depth <= 0 || columnParams.depth > 2)) {
      errors.depth = 'Depth must be between 0.05m and 2m';
    }
    
    // Height validation
    if (columnParams.height <= 0 || columnParams.height > 20) {
      errors.height = 'Height must be between 0.1m and 20m';
    }

    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    setIsValid(isValid);
    
    return isValid;
  }, [columnParams]);

  // Run validation when parameters change
  useEffect(() => {
    validateParameters();
  }, [validateParameters]);

  // Handle parameter changes
  const handleParameterChange = useCallback((param, value) => {
    setColumnParams(prev => ({
      ...prev,
      [param]: value
    }));
  }, []);

  // Handle column creation
  const handleCreate = useCallback(async () => {
    if (!isValid) return;
    
    setIsCreating(true);
    
    try {
      // Prepare column creation parameters for standalone CAD engine
      const createParams = {
        width: columnParams.width,
        depth: columnParams.depth,
        height: columnParams.height,
        shape: columnParams.shape,
        material: columnParams.material,
        offset: columnParams.offset
      };
      
      // Create object using standalone CAD engine
      const objectId = standaloneCADEngine.createObject('column', createParams);
      
      if (objectId) {
        console.log('🏢 Column created successfully:', objectId);
        
        // Notify parent component
        onObjectCreated?.({
          id: objectId,
          type: 'column',
          ...createParams
        });
        
        // Reset to default values after successful creation
        setColumnParams({
          width: 0.4,
          depth: 0.4,
          height: 3.0,
          shape: 'rectangular',
          material: 'concrete',
          offset: 0.0
        });
      }
      
    } catch (error) {
      console.error('Column creation error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, columnParams, onObjectCreated]);

  // Handle column update (for editing existing columns)
  const handleUpdate = useCallback(async () => {
    if (!isValid || !selectedObject) return;
    
    setIsCreating(true);
    
    try {
      const updateParams = {
        width: columnParams.width,
        depth: columnParams.depth,
        height: columnParams.height,
        shape: columnParams.shape,
        material: columnParams.material,
        offset: columnParams.offset
      };
      
      // Update object using standalone CAD engine
      const success = standaloneCADEngine.updateObject(selectedObject.id, updateParams);
      
      if (success) {
        console.log('🏢 Column updated successfully:', selectedObject.id);
        
        // Notify parent component
        onObjectUpdated?.({
          id: selectedObject.id,
          type: 'column',
          ...updateParams
        });
      }
      
    } catch (error) {
      console.error('Column update error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, columnParams, selectedObject, onObjectUpdated]);

  // Don't render if not active
  if (!isActive) return null;

  const isEditing = selectedObject && (selectedObject.type === 'Column' || selectedObject.type === 'column');
  const selectedMaterial = materialOptions.find(m => m.value === columnParams.material);

  return (
    <div className="column-tool-panel w-full h-full">
      
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-studiosix-600' : 'bg-studiosix-500'
          }`}>
            <BuildingOfficeIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {isEditing ? 'Edit Column' : 'Create Column'}
            </h3>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {isEditing ? 'Modify selected column properties' : 'Configure column parameters and create'}
            </p>
          </div>
        </div>
        
        <button
          onClick={onCancel}
          className={`p-1 rounded-md transition-colors ${
            theme === 'dark' 
              ? 'hover:bg-gray-700/50 text-gray-400 hover:text-white' 
              : 'hover:bg-gray-200/50 text-gray-600 hover:text-gray-900'
          }`}
          title="Close column tool"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Parameters */}
      <div className="p-4 space-y-4">
        
        {/* Grid Points Info */}
        {availableGridPoints.length > 0 && (
          <div className={`p-2 rounded border ${
            theme === 'dark' ? 'border-green-700/50 bg-green-800/20' : 'border-green-500/50 bg-green-50'
          }`}>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-green-400' : 'text-green-700'
            }`}>
              {availableGridPoints.length} grid point{availableGridPoints.length !== 1 ? 's' : ''} available for column placement
            </p>
          </div>
        )}

        {/* Shape Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <RectangleStackIcon className="w-4 h-4 mr-2" />
            Shape
          </h4>
          
          <div className="flex space-x-1 mb-3">
            {shapeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleParameterChange('shape', option.value)}
                className={`flex-1 p-2 text-xs rounded transition-colors ${
                  columnParams.shape === option.value
                    ? theme === 'dark'
                      ? 'bg-studiosix-600 text-white'
                      : 'bg-studiosix-500 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="block text-sm mb-1">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dimensions Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <AdjustmentsVerticalIcon className="w-4 h-4 mr-2" />
            Dimensions
          </h4>
          
          <div className="grid grid-cols-3 gap-3">
            {/* Width */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {columnParams.shape === 'circular' ? 'Diameter (m)' : 'Width (m)'}
              </label>
              <input
                type="number"
                value={columnParams.width}
                onChange={(e) => handleParameterChange('width', parseFloat(e.target.value) || 0)}
                min="0.05"
                max="2"
                step="0.01"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.width
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.width
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.width && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.width}</p>
              )}
            </div>
            
            {/* Depth - only show for rectangular columns */}
            {columnParams.shape === 'rectangular' && (
              <div>
                <label className={`block text-xs mb-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Depth (m)
                </label>
                <input
                  type="number"
                  value={columnParams.depth}
                  onChange={(e) => handleParameterChange('depth', parseFloat(e.target.value) || 0)}
                  min="0.05"
                  max="2"
                  step="0.01"
                  className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                    validationErrors.depth
                      ? 'border-red-500 focus:border-red-400'
                      : theme === 'dark'
                        ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                  } focus:outline-none focus:ring-1 ${
                    validationErrors.depth
                      ? 'focus:ring-red-400'
                      : 'focus:ring-studiosix-500'
                  }`}
                />
                {validationErrors.depth && (
                  <p className="text-xs text-red-400 mt-1">{validationErrors.depth}</p>
                )}
              </div>
            )}
            
            {/* Height */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Height (m)
              </label>
              <input
                type="number"
                value={columnParams.height}
                onChange={(e) => handleParameterChange('height', parseFloat(e.target.value) || 0)}
                min="0.1"
                max="20"
                step="0.1"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.height
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.height
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.height && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.height}</p>
              )}
            </div>
          </div>
        </div>

        {/* Material Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <SwatchIcon className="w-4 h-4 mr-2" />
            Material
          </h4>
          
          <div className="space-y-2">
            <select
              value={columnParams.material}
              onChange={(e) => handleParameterChange('material', e.target.value)}
              className={`w-full px-2 py-2 text-sm rounded border transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
              } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
            >
              {materialOptions.map((material) => (
                <option key={material.value} value={material.value}>
                  {material.label}
                </option>
              ))}
            </select>
            
            {/* Material Preview */}
            {selectedMaterial && (
              <div className={`p-2 rounded border ${
                theme === 'dark' ? 'border-gray-700/50 bg-slate-800/30' : 'border-gray-300/50 bg-gray-50'
              }`}>
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: selectedMaterial.color }}
                  />
                  <span className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Density: {selectedMaterial.density} kg/m³
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={`p-4 border-t flex space-x-2 ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <button
          onClick={isEditing ? handleUpdate : handleCreate}
          disabled={!isValid || isCreating}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded transition-all ${
            isValid && !isCreating
              ? 'bg-studiosix-600 hover:bg-studiosix-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isCreating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Creating...</span>
            </>
          ) : (
            <>
              {isEditing ? (
                <>
                  <CheckIcon className="w-4 h-4" />
                  <span className="text-sm">Update Column</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span className="text-sm">Create Column</span>
                </>
              )}
            </>
          )}
        </button>
        
        <button
          onClick={onCancel}
          className={`px-4 py-2 rounded transition-colors ${
            theme === 'dark'
              ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
        >
          <span className="text-sm">Cancel</span>
        </button>
      </div>
    </div>
  );
};

export default ColumnTool;