import React, { useState, useEffect, useCallback } from 'react';
import standaloneCADEngine from '../../services/StandaloneCADEngine';
import { ColumnIcon } from '../icons';
import {
  SwatchIcon,
  RectangleStackIcon,
  AdjustmentsVerticalIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon
} from '@heroicons/react/24/outline';

/**
 * Column Tool Component - Provides interface for column creation and editing
 * Updated to match white properties panel styling and follow task requirements
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
  // Column parameters state following task specifications
  const [columnParams, setColumnParams] = useState({
    width: 0.4,        // For rectangular columns
    depth: 0.4,        // For rectangular columns
    height: 3.0,       // Column height
    radius: 0.2,       // For circular columns
    shape: 'rect',     // 'rect' or 'circle'
    material: 'concrete',
    inclinationAngle: 0,    // 0-45 degrees
    inclinationAxis: 'x',   // 'x' or 'y'
    rotation: 0,            // Rotation around vertical axis
    position: { x: 0, y: 0, z: 0 } // Column base position
  });

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

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
    { value: 'rect', label: 'Rectangular', icon: '▭' },
    { value: 'circle', label: 'Circular', icon: '○' }
  ];

  // Inclination axis options
  const inclinationAxisOptions = [
    { value: 'x', label: 'X-Axis', description: 'Tilt along X-axis' },
    { value: 'y', label: 'Y-Axis', description: 'Tilt along Y-axis' }
  ];

  // Initialize with existing column data if editing
  useEffect(() => {
    if (selectedObject && (selectedObject.type === 'Column' || selectedObject.type === 'column')) {
      setColumnParams({
        width: selectedObject.width || 0.4,
        depth: selectedObject.depth || 0.4,
        height: selectedObject.height || 3.0,
        radius: selectedObject.radius || 0.2,
        shape: selectedObject.shape || 'rect',
        material: selectedObject.material || 'concrete',
        inclinationAngle: selectedObject.inclinationAngle || 0,
        inclinationAxis: selectedObject.inclinationAxis || 'x',
        rotation: selectedObject.rotation || 0,
        position: selectedObject.position || { x: 0, y: 0, z: 0 }
      });
    }
  }, [selectedObject]);

  // Handle parameter changes with validation
  const handleParameterChange = useCallback((param, value) => {
    setColumnParams(prev => {
      const newParams = { ...prev, [param]: value };
      
      // Auto-derive radius from width/depth when switching to circle
      if (param === 'shape' && value === 'circle') {
        newParams.radius = Math.min(prev.width, prev.depth) / 2;
      }
      
      // Auto-derive width/depth from radius when switching to rect
      if (param === 'shape' && value === 'rect') {
        newParams.width = prev.radius * 2;
        newParams.depth = prev.radius * 2;
      }
      
      return newParams;
    });
    
    // Clear specific validation error
    if (validationErrors[param]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[param];
        return newErrors;
      });
    }
  }, [validationErrors]);

  // Validate parameters
  const validateParameters = useCallback(() => {
    const errors = {};
    
    if (columnParams.height < 0.5 || columnParams.height > 20) {
      errors.height = 'Height must be between 0.5m and 20m';
    }
    
    if (columnParams.shape === 'rect') {
      if (columnParams.width < 0.1 || columnParams.width > 2) {
        errors.width = 'Width must be between 0.1m and 2m';
      }
      if (columnParams.depth < 0.1 || columnParams.depth > 2) {
        errors.depth = 'Depth must be between 0.1m and 2m';
      }
    } else {
      if (columnParams.radius < 0.05 || columnParams.radius > 1) {
        errors.radius = 'Radius must be between 0.05m and 1m';
      }
    }
    
    if (columnParams.inclinationAngle < 0 || columnParams.inclinationAngle > 45) {
      errors.inclinationAngle = 'Inclination angle must be between 0° and 45°';
    }
    
    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    setIsValid(isValid);
    
    return isValid;
  }, [columnParams]);

  // Validate on parameter changes
  useEffect(() => {
    validateParameters();
  }, [columnParams, validateParameters]);

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
        radius: columnParams.radius,
        shape: columnParams.shape,
        material: columnParams.material,
        inclinationAngle: columnParams.inclinationAngle,
        inclinationAxis: columnParams.inclinationAxis,
        rotation: columnParams.rotation,
        position: columnParams.position,
        // Add IFC metadata
        ifc: {
          type: 'IfcColumn',
          name: `Column_${Date.now()}`,
          objectType: 'COLUMN',
          predefinedType: 'COLUMN'
        }
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
          radius: 0.2,
          shape: 'rect',
          material: 'concrete',
          inclinationAngle: 0,
          inclinationAxis: 'x',
          rotation: 0,
          position: { x: 0, y: 0, z: 0 }
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
        radius: columnParams.radius,
        shape: columnParams.shape,
        material: columnParams.material,
        inclinationAngle: columnParams.inclinationAngle,
        inclinationAxis: columnParams.inclinationAxis,
        rotation: columnParams.rotation,
        position: columnParams.position
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

  return (
    <div className="column-tool-panel w-full h-full bg-white border border-gray-200 rounded-lg shadow-lg">
      
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white rounded-t-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-studiosix-500">
            <ColumnIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {isEditing ? 'Edit Column' : 'Create Column'}
            </h3>
            <p className="text-xs text-gray-600">
              {isEditing ? 'Modify selected column properties' : 'Configure column parameters and create'}
            </p>
          </div>
        </div>
        
        <button
          onClick={onCancel}
          className="p-1 rounded-md transition-colors hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          title="Close column tool"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Parameters */}
      <div className="p-3 space-y-4 bg-white max-h-[70vh] overflow-y-auto">
        
        {/* Shape & Dimensions Section */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center text-gray-700">
            <RectangleStackIcon className="w-4 h-4 mr-2" />
            Shape & Dimensions
          </h4>
          
          {/* Shape Selection */}
          <div className="flex space-x-2 mb-3">
            {shapeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleParameterChange('shape', option.value)}
                className={`flex-1 p-2 text-xs rounded border transition-all ${
                  columnParams.shape === option.value
                    ? 'bg-studiosix-500 text-white border-studiosix-500'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="block text-sm mb-0.5">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
          
          {/* Dimensions Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Height */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Height (m)</label>
              <input
                type="number"
                value={columnParams.height}
                onChange={(e) => handleParameterChange('height', parseFloat(e.target.value) || 0)}
                min="0.5"
                max="20"
                step="0.1"
                className={`w-full px-2 py-1.5 text-xs rounded border ${
                  validationErrors.height ? 'border-red-300' : 'border-gray-300'
                } focus:outline-none focus:border-studiosix-500`}
              />
            </div>

            {columnParams.shape === 'rect' ? (
              <>
                {/* Width */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Width (m)</label>
                  <input
                    type="number"
                    value={columnParams.width}
                    onChange={(e) => handleParameterChange('width', parseFloat(e.target.value) || 0)}
                    min="0.1"
                    max="2"
                    step="0.01"
                    className={`w-full px-2 py-1.5 text-xs rounded border ${
                      validationErrors.width ? 'border-red-300' : 'border-gray-300'
                    } focus:outline-none focus:border-studiosix-500`}
                  />
                </div>
                {/* Depth */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Depth (m)</label>
                  <input
                    type="number"
                    value={columnParams.depth}
                    onChange={(e) => handleParameterChange('depth', parseFloat(e.target.value) || 0)}
                    min="0.1"
                    max="2"
                    step="0.01"
                    className={`w-full px-2 py-1.5 text-xs rounded border ${
                      validationErrors.depth ? 'border-red-300' : 'border-gray-300'
                    } focus:outline-none focus:border-studiosix-500`}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Radius */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Radius (m)</label>
                  <input
                    type="number"
                    value={columnParams.radius}
                    onChange={(e) => handleParameterChange('radius', parseFloat(e.target.value) || 0)}
                    min="0.05"
                    max="1"
                    step="0.01"
                    className={`w-full px-2 py-1.5 text-xs rounded border ${
                      validationErrors.radius ? 'border-red-300' : 'border-gray-300'
                    } focus:outline-none focus:border-studiosix-500`}
                  />
                </div>
                {/* Empty placeholder for grid alignment */}
                <div></div>
              </>
            )}
          </div>
        </div>

        {/* Inclination Section - Compact */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center text-gray-700">
            <AdjustmentsVerticalIcon className="w-4 h-4 mr-2" />
            Inclination
          </h4>
          
          {/* Angle and Axis in one row */}
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Angle: {columnParams.inclinationAngle}°</label>
              <input
                type="range"
                value={columnParams.inclinationAngle}
                onChange={(e) => handleParameterChange('inclinationAngle', parseFloat(e.target.value))}
                min="0"
                max="45"
                step="1"
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Axis</label>
              <select
                value={columnParams.inclinationAxis}
                onChange={(e) => handleParameterChange('inclinationAxis', e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 focus:outline-none focus:border-studiosix-500"
              >
                {inclinationAxisOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Material Section - Compact */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center text-gray-700">
            <SwatchIcon className="w-4 h-4 mr-2" />
            Material
          </h4>
          
          <div className="grid grid-cols-3 gap-1.5">
            {materialOptions.map((material) => (
              <button
                key={material.value}
                onClick={() => handleParameterChange('material', material.value)}
                className={`p-2 text-xs rounded border transition-all ${
                  columnParams.material === material.value
                    ? 'bg-studiosix-500 text-white border-studiosix-500'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center space-x-1">
                  <div
                    className="w-2 h-2 rounded-full border border-gray-300"
                    style={{ backgroundColor: material.color }}
                  />
                  <span>{material.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-gray-200 flex space-x-2 bg-white rounded-b-lg">
        <button
          onClick={isEditing ? handleUpdate : handleCreate}
          disabled={!isValid || isCreating}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded transition-all text-sm font-medium ${
            isValid && !isCreating
              ? 'bg-studiosix-500 hover:bg-studiosix-600 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isCreating ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Creating...</span>
            </>
          ) : (
            <>
              {isEditing ? (
                <>
                  <CheckIcon className="w-4 h-4" />
                  <span>Update</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span>Create</span>
                </>
              )}
            </>
          )}
        </button>
        
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ColumnTool;
