import React, { useState, useEffect, useCallback } from 'react';
import standaloneCADEngine from '../../services/StandaloneCADEngine';
import {
  SwatchIcon,
  RectangleStackIcon,
  AdjustmentsVerticalIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  SparklesIcon,
  ArrowPathIcon,
  PencilIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';

// Ramp Icon component
const RampIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 20 L21 12 L21 20 Z" />
    <path d="M3 20 L21 20" strokeDasharray="2,2" />
  </svg>
);

/**
 * Ramp Tool Component - Provides interface for ramp creation and editing
 * A ramp is essentially a slab with one side elevated to create a slope
 */
const RampTool = ({
  isActive = false,
  selectedObject = null,
  onCancel,
  theme = 'dark',
  cadObjects = [], // Objects from standalone CAD engine
  onObjectCreated, // Callback when object is created
  onObjectUpdated, // Callback when object is updated
  viewportDimensions = { width: 800, height: 600 } // For polygon drawing
}) => {
  // Ramp parameters state
  const [rampParams, setRampParams] = useState({
    width: 5.0,
    depth: 5.0,
    thickness: 0.2,
    height: 1.0, // Height difference between low and high ends
    shape: 'rectangular', // 'rectangular', 'circular', 'polygon'
    material: 'concrete',
    offset: 0.0,
    slopeDirection: 'north', // 'north', 'south', 'east', 'west'
    grade: 8.33, // Percentage grade (calculated from height and depth)
    polygonPoints: [] // For polygon shapes
  });
  
  // Polygon drawing state
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [previewPoint, setPreviewPoint] = useState(null);

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [previewMode, setPreviewMode] = useState(false);

  // Edit mode detection
  const isEditing = selectedObject && selectedObject.type === 'ramp';

  // AUTO-CALCULATE GRADE: Update grade when height or depth changes
  useEffect(() => {
    if (rampParams.height > 0 && rampParams.depth > 0) {
      const newGrade = (rampParams.height / rampParams.depth) * 100;
      if (Math.abs(newGrade - rampParams.grade) > 0.01) { // Only update if significantly different
        setRampParams(prev => ({
          ...prev,
          grade: parseFloat(newGrade.toFixed(2))
        }));
      }
    }
  }, [rampParams.height, rampParams.depth]);

  // Initialize parameters from selected object
  useEffect(() => {
    if (isEditing && selectedObject) {
      const params = selectedObject.params || selectedObject;
      setRampParams({
        width: params.width || 5.0,
        depth: params.depth || 5.0,
        thickness: params.thickness || 0.2,
        height: params.height || 1.0,
        shape: params.shape || 'rectangular',
        material: params.material || 'concrete',
        offset: params.offset || 0.0,
        slopeDirection: params.slopeDirection || 'north',
        grade: params.grade || 8.33,
        polygonPoints: params.polygonPoints || []
      });
    }
  }, [selectedObject, isEditing]);

  // Calculate grade percentage when height or depth changes
  useEffect(() => {
    if (rampParams.depth > 0) {
      const calculatedGrade = (rampParams.height / rampParams.depth) * 100;
      if (Math.abs(calculatedGrade - rampParams.grade) > 0.01) {
        setRampParams(prev => ({ ...prev, grade: calculatedGrade }));
      }
    }
  }, [rampParams.height, rampParams.depth]);

  // Update height when grade changes
  const handleGradeChange = useCallback((newGrade) => {
    const newHeight = (newGrade / 100) * rampParams.depth;
    setRampParams(prev => ({ 
      ...prev, 
      grade: newGrade,
      height: newHeight
    }));
  }, [rampParams.depth]);

  // Parameter change handler
  const handleParameterChange = useCallback((paramName, value) => {
    setRampParams(prevParams => {
      const newParams = { ...prevParams, [paramName]: value };
      
      // Special handling for grade changes
      if (paramName === 'grade') {
        newParams.height = (value / 100) * prevParams.depth;
      }
      
      return newParams;
    });
  }, []);

  // Validation
  const validateParameters = useCallback(() => {
    const errors = {};
    
    // Width validation
    if (rampParams.width <= 0 || rampParams.width > 50) {
      errors.width = 'Width must be between 0.1m and 50m';
    }
    
    // Depth validation
    if (rampParams.depth <= 0 || rampParams.depth > 50) {
      errors.depth = 'Depth must be between 0.1m and 50m';
    }
    
    // Thickness validation
    if (rampParams.thickness <= 0 || rampParams.thickness > 2) {
      errors.thickness = 'Thickness must be between 0.01m and 2m';
    }
    
    // Height validation
    if (rampParams.height <= 0 || rampParams.height > 10) {
      errors.height = 'Height must be between 0.01m and 10m';
    }
    
    // Grade validation (ADA compliance suggests max 8.33% for ramps)
    if (rampParams.grade > 20) {
      errors.grade = 'Grade over 20% may be too steep for accessibility';
    }
    
    setValidationErrors(errors);
    const isCurrentlyValid = Object.keys(errors).length === 0;
    setIsValid(isCurrentlyValid);
    return isCurrentlyValid;
  }, [rampParams]);

  // Validate on parameter changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateParameters();
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [validateParameters]);

  // Handle ramp creation
  const handleCreate = useCallback(async () => {
    // Double-check validation before creating
    const isCurrentlyValid = validateParameters();
    if (!isCurrentlyValid) return;
    
    setIsCreating(true);
    
    try {
      // Prepare ramp creation parameters for standalone CAD engine
      const createParams = {
        width: rampParams.width,
        depth: rampParams.depth,
        thickness: rampParams.thickness,
        height: rampParams.height,
        shape: rampParams.shape,
        material: rampParams.material,
        offset: rampParams.offset,
        slopeDirection: rampParams.slopeDirection,
        grade: rampParams.grade,
        polygonPoints: rampParams.polygonPoints,
        // Mark as ramp type for 3D rendering
        isRamp: true
      };
      
      let objectId;
      
      // Create ramp with history support
      console.log('🛤️ Creating ramp');
      const command = await standaloneCADEngine.createSlabWithHistory({
        ...createParams,
        type: 'ramp' // Override type to ramp
      });
      objectId = command.entityId;
      
      if (objectId) {
        console.log('🛤️ Ramp created successfully:', objectId);
        
        // Notify parent component
        onObjectCreated?.({
          id: objectId,
          type: 'ramp',
          ...createParams
        });
        
        // Reset to default values after successful creation
        setRampParams({
          width: 5.0,
          depth: 5.0,
          thickness: 0.2,
          height: 1.0,
          shape: 'rectangular',
          material: 'concrete',
          offset: 0.0,
          slopeDirection: 'north',
          grade: 8.33,
          polygonPoints: []
        });
      }
      
    } catch (error) {
      console.error('Ramp creation error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [rampParams, validateParameters, onObjectCreated]);

  // Handle ramp update
  const handleUpdate = useCallback(async () => {
    if (!isEditing || !selectedObject) return;
    
    const isCurrentlyValid = validateParameters();
    if (!isCurrentlyValid) return;
    
    setIsCreating(true);
    
    try {
      const updateParams = {
        width: rampParams.width,
        depth: rampParams.depth,
        thickness: rampParams.thickness,
        height: rampParams.height,
        shape: rampParams.shape,
        material: rampParams.material,
        offset: rampParams.offset,
        slopeDirection: rampParams.slopeDirection,
        grade: rampParams.grade,
        polygonPoints: rampParams.polygonPoints,
        isRamp: true
      };
      
      console.log('🛤️ Updating ramp:', selectedObject.id);
      const success = standaloneCADEngine.updateObject(selectedObject.id, updateParams);
      
      if (success) {
        console.log('🛤️ Ramp updated successfully');
        
        onObjectUpdated?.({
          id: selectedObject.id,
          type: 'ramp',
          ...updateParams
        });
      }
      
    } catch (error) {
      console.error('Ramp update error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isEditing, selectedObject, rampParams, validateParameters, onObjectUpdated]);

  // LIVE UPDATE: Automatically update ramp when parameters change during editing
  useEffect(() => {
    if (isEditing && selectedObject && !isCreating) {
      console.log('🛤️ LIVE UPDATE: Ramp parameters changed, triggering update');
      const timeoutId = setTimeout(() => {
        handleUpdate();
      }, 300); // Debounce updates to avoid excessive calls
      
      return () => clearTimeout(timeoutId);
    }
  }, [isEditing, rampParams, selectedObject, isCreating, handleUpdate]);

  // Material options for ramps
  const materialOptions = [
    { value: 'concrete', label: 'Concrete', color: '#6b7280', density: 2400 },
    { value: 'asphalt', label: 'Asphalt', color: '#374151', density: 2300 },
    { value: 'steel', label: 'Steel Grating', color: '#708090', density: 7850 },
    { value: 'wood', label: 'Wood Planks', color: '#92400e', density: 600 },
    { value: 'composite', label: 'Composite', color: '#8b7d6b', density: 1200 },
    { value: 'rubber', label: 'Rubber', color: '#1f2937', density: 1500 }
  ];

  // Slope direction options
  const slopeDirections = [
    { value: 'north', label: 'North ↑', description: 'Slopes up towards north' },
    { value: 'south', label: 'South ↓', description: 'Slopes up towards south' },
    { value: 'east', label: 'East →', description: 'Slopes up towards east' },
    { value: 'west', label: 'West ←', description: 'Slopes up towards west' }
  ];

  // Shape options
  const shapeOptions = [
    { value: 'rectangular', label: 'Rectangular', icon: '▭' },
    { value: 'circular', label: 'Circular', icon: '○' },
    { value: 'polygon', label: 'Custom Polygon', icon: '⬟' }
  ];

  const selectedMaterial = materialOptions.find(m => m.value === rampParams.material);
  const selectedDirection = slopeDirections.find(d => d.value === rampParams.slopeDirection);
  const selectedShape = shapeOptions.find(s => s.value === rampParams.shape);

  // Accessibility compliance check
  const isADACompliant = rampParams.grade <= 8.33;
  const maxRecommendedRise = rampParams.depth * 0.0833; // 8.33% max grade

  return (
    <div className="ramp-tool-panel w-full h-full">
      
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-indigo-600' : 'bg-indigo-500'
          }`}>
            <RampIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {isEditing ? 'Edit Ramp' : 'Create Ramp'}
            </h3>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {isEditing ? 'Modify selected ramp properties' : 'Configure ramp parameters and create'}
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
          title="Close ramp tool"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Parameters */}
      <div className="p-3 space-y-3">
        
        {/* Essential Dimensions - Compact Grid */}
        <div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* Width & Length */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Width (m)
              </label>
              <input
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={rampParams.width}
                onChange={(e) => handleParameterChange('width', parseFloat(e.target.value) || 0)}
                className={`w-full px-2 py-1.5 text-sm rounded border transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-gray-600 text-white focus:border-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                } focus:outline-none focus:ring-1 focus:ring-indigo-500`}
              />
            </div>
            
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Length (m)
              </label>
              <input
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={rampParams.depth}
                onChange={(e) => handleParameterChange('depth', parseFloat(e.target.value) || 0)}
                className={`w-full px-2 py-1.5 text-sm rounded border transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-gray-600 text-white focus:border-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                } focus:outline-none focus:ring-1 focus:ring-indigo-500`}
              />
            </div>
          </div>
          
          {/* Rise & Grade - Same Row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Rise (m)
              </label>
              <input
                type="number"
                min="0.01"
                max="10"
                step="0.01"
                value={rampParams.height}
                onChange={(e) => handleParameterChange('height', parseFloat(e.target.value) || 0)}
                className={`w-full px-2 py-1.5 text-sm rounded border transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-gray-600 text-white focus:border-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                } focus:outline-none focus:ring-1 focus:ring-indigo-500`}
              />
            </div>
            
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Grade: {rampParams.grade.toFixed(1)}%
                {isADACompliant ? (
                  <span className="text-green-400 ml-1 text-xs">✓</span>
                ) : (
                  <span className="text-amber-400 ml-1 text-xs">⚠</span>
                )}
              </label>
              <input
                type="range"
                min="1"
                max="25"
                step="0.1"
                value={rampParams.grade}
                onChange={(e) => handleGradeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>
        </div>

        {/* Slope Direction - Compact */}
        <div>
          <label className={`block text-xs mb-1 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Slope Direction
          </label>
          <div className="grid grid-cols-4 gap-1">
            {slopeDirections.map((direction) => (
              <button
                key={direction.value}
                onClick={() => handleParameterChange('slopeDirection', direction.value)}
                className={`p-1.5 text-xs rounded transition-colors ${
                  rampParams.slopeDirection === direction.value
                    ? theme === 'dark'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-500 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={direction.description}
              >
                {direction.label.split(' ')[1] || direction.label} {/* Just show the arrow */}
              </button>
            ))}
          </div>
        </div>

        {/* Shape & Material - Inline */}
        <div className="grid grid-cols-2 gap-3">
          {/* Shape Selection - Compact */}
          <div>
            <label className={`block text-xs mb-1 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Shape
            </label>
            <div className="flex gap-1">
              {shapeOptions.map((shape) => (
                <button
                  key={shape.value}
                  onClick={() => handleParameterChange('shape', shape.value)}
                  className={`flex-1 p-1.5 text-xs rounded transition-colors flex flex-col items-center ${
                    rampParams.shape === shape.value
                      ? theme === 'dark'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-500 text-white'
                      : theme === 'dark'
                        ? 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={shape.label}
                >
                  <div className="text-sm mb-0.5">{shape.icon}</div>
                  <span className="text-xs">{shape.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Material Selection - Dropdown */}
          <div>
            <label className={`block text-xs mb-1 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Material
            </label>
            <select
              value={rampParams.material}
              onChange={(e) => handleParameterChange('material', e.target.value)}
              className={`w-full px-2 py-1.5 text-sm rounded border transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-800/50 border-gray-600 text-white focus:border-indigo-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
              } focus:outline-none focus:ring-1 focus:ring-indigo-500`}
            >
              {materialOptions.map((material) => (
                <option key={material.value} value={material.value}>
                  {material.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ADA Compliance - Compact Info */}
        {!isADACompliant && (
          <div className={`p-2 rounded text-xs ${
            theme === 'dark'
              ? 'bg-amber-900/20 border border-amber-700/50 text-amber-400'
              : 'bg-amber-50 border border-amber-300 text-amber-700'
          }`}>
            <div className="flex items-center">
              <span className="mr-1">⚠️</span>
              <span className="font-medium">Grade exceeds ADA maximum (8.33%)</span>
            </div>
          </div>
        )}

      </div>

      {/* Actions */}
      <div className={`p-3 border-t ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <div className="flex space-x-2">
          <button
            onClick={isEditing ? handleUpdate : handleCreate}
            disabled={!isValid || isCreating}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors flex items-center justify-center space-x-1.5 ${
              !isValid || isCreating
                ? theme === 'dark'
                  ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200/50 text-gray-400 cursor-not-allowed'
                : theme === 'dark'
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-indigo-500 text-white hover:bg-indigo-600'
            }`}
          >
            {isCreating ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : isEditing ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
            <span>{isCreating ? 'Creating...' : isEditing ? 'Update' : 'Create'}</span>
          </button>
          
          <button
            onClick={onCancel}
            className={`px-3 py-2 text-sm font-medium rounded transition-colors flex items-center justify-center ${
              theme === 'dark'
                ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                : 'bg-gray-200/50 text-gray-700 hover:bg-gray-300/50'
            }`}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RampTool;
