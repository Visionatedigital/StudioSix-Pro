import React, { useState, useEffect, useCallback } from 'react';
import { SlabIcon } from '../icons';
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
  PencilIcon
} from '@heroicons/react/24/outline';

/**
 * Slab Tool Component - Provides interface for slab creation and editing
 * Allows users to specify slab parameters before placement
 */
const SlabTool = ({
  isActive = false,
  selectedObject = null,
  onCancel,
  theme = 'dark',
  cadObjects = [], // Objects from standalone CAD engine
  onObjectCreated, // Callback when object is created
  onObjectUpdated, // Callback when object is updated
  viewportDimensions = { width: 800, height: 600 } // For polygon drawing
}) => {
  // Slab parameters state
  const [slabParams, setSlabParams] = useState({
    width: 5.0,
    depth: 5.0,
    thickness: 0.2,
    shape: 'rectangular', // 'rectangular', 'circular', 'polygon'
    material: 'concrete',
    offset: 0.0,
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

  // Enhanced material options with realistic properties
  const materialOptions = [
    { 
      value: 'concrete', 
      label: 'Concrete', 
      color: '#6b7280', 
      density: 2400,
      pattern: 'concrete',
      description: 'Standard concrete slab'
    },
    { 
      value: 'tiles', 
      label: 'Ceramic Tiles', 
      color: '#f3f4f6', 
      density: 2200,
      pattern: 'tiles',
      description: 'Ceramic floor tiles'
    },
    { 
      value: 'wood', 
      label: 'Wood Deck', 
      color: '#d97706', 
      density: 600,
      pattern: 'wood',
      description: 'Natural wood decking'
    },
    { 
      value: 'marble', 
      label: 'Marble', 
      color: '#f9fafb', 
      density: 2700,
      pattern: 'marble',
      description: 'Polished marble surface'
    },
    { 
      value: 'granite', 
      label: 'Granite', 
      color: '#374151', 
      density: 2650,
      pattern: 'granite',
      description: 'Natural granite stone'
    },
    { 
      value: 'steel', 
      label: 'Steel Deck', 
      color: '#64748b', 
      density: 7850,
      pattern: 'steel',
      description: 'Steel deck flooring'
    },
    { 
      value: 'carpet', 
      label: 'Carpet', 
      color: '#8b5cf6', 
      density: 200,
      pattern: 'carpet',
      description: 'Soft carpet flooring'
    },
    { 
      value: 'vinyl', 
      label: 'Vinyl', 
      color: '#10b981', 
      density: 1200,
      pattern: 'vinyl',
      description: 'Vinyl flooring'
    },
    { 
      value: 'stone', 
      label: 'Natural Stone', 
      color: '#6b7280', 
      density: 2700,
      pattern: 'stone',
      description: 'Natural stone slabs'
    },
    { 
      value: 'precast', 
      label: 'Precast Concrete', 
      color: '#9ca3af', 
      density: 2500,
      pattern: 'concrete',
      description: 'Precast concrete panels'
    }
  ];

  // Shape options
  const shapeOptions = [
    { value: 'rectangular', label: 'Rectangular', icon: '▭' },
    { value: 'circular', label: 'Circular', icon: '○' },
    { value: 'polygon', label: 'Polygon', icon: <PencilIcon className="w-4 h-4" /> }
  ];

  // Initialize with existing slab data if editing
  useEffect(() => {
    if (selectedObject && (selectedObject.type === 'Slab' || selectedObject.type === 'slab')) {
      setSlabParams({
        width: selectedObject.width || 5.0,
        depth: selectedObject.depth || 5.0,
        thickness: selectedObject.thickness || 0.2,
        shape: selectedObject.shape || 'rectangular',
        material: selectedObject.material || 'concrete',
        offset: selectedObject.offset || 0.0,
        polygonPoints: selectedObject.polygonPoints || []
      });
      
      // Set polygon points if editing a polygon slab
      if (selectedObject.shape === 'polygon' && selectedObject.polygonPoints) {
        setPolygonPoints(selectedObject.polygonPoints);
      }
    }
  }, [selectedObject]);

  // Auto-fill functionality - detect existing objects to auto-fill from
  const detectAndAutoFill = useCallback(() => {
    if (!cadObjects || cadObjects.length === 0) return;

    // Look for similar objects to auto-fill from
    const potentialSources = cadObjects.filter(obj => {
      return obj.width && obj.depth; // Any object with dimensions
    });

    if (potentialSources.length > 0) {
      // Use the most recent or largest object as the source
      const source = potentialSources.reduce((prev, current) => {
        const prevArea = (prev.width || 0) * (prev.depth || 0);
        const currentArea = (current.width || 0) * (current.depth || 0);
        return currentArea > prevArea ? current : prev;
      });

      // Auto-fill parameters based on detected source
      const autoFillParams = {
        width: Math.max(source.width || 5.0, 1.0),
        depth: Math.max(source.depth || 5.0, 1.0),
        thickness: source.thickness || 0.2,
        shape: source.shape || 'rectangular',
        material: source.material || 'concrete',
        offset: source.offset || 0.0
      };

      setSlabParams(prev => ({
        ...prev,
        ...autoFillParams
      }));

      return true; // Indicates auto-fill was successful
    }

    return false;
  }, [cadObjects]);

  // Auto-fill state and controls
  const [autoFillAvailable, setAutoFillAvailable] = useState(false);
  const [lastAutoFillTime, setLastAutoFillTime] = useState(null);

  // Check for auto-fill opportunities when objects change
  useEffect(() => {
    if (!isActive) return;

    const hasAutoFillSources = cadObjects.some(obj => {
      return obj.width && obj.depth; // Any object with dimensions
    });

    setAutoFillAvailable(hasAutoFillSources);
  }, [cadObjects, isActive]);

  // Manual auto-fill trigger
  const handleAutoFill = useCallback(() => {
    const success = detectAndAutoFill();
    if (success) {
      setLastAutoFillTime(new Date().toISOString());
    }
  }, [detectAndAutoFill]);

  // Parameter validation
  const validateParameters = useCallback(() => {
    const errors = {};
    
    // Width validation
    if (slabParams.width <= 0 || slabParams.width > 100) {
      errors.width = 'Width must be between 0.1m and 100m';
    }
    
    // Depth validation
    if (slabParams.depth <= 0 || slabParams.depth > 100) {
      errors.depth = 'Depth must be between 0.1m and 100m';
    }
    
    // Thickness validation
    if (slabParams.thickness <= 0 || slabParams.thickness > 2) {
      errors.thickness = 'Thickness must be between 0.01m and 2m';
    }
    
    // Offset validation
    if (Math.abs(slabParams.offset) > Math.max(slabParams.width, slabParams.depth) / 2) {
      errors.offset = 'Offset cannot exceed half the slab dimension';
    }

    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    setIsValid(isValid);
    
    return isValid;
  }, [slabParams]);

  // Run validation when parameters change
  useEffect(() => {
    validateParameters();
  }, [validateParameters]);

  // Handle parameter changes
  const handleParameterChange = useCallback((param, value) => {
    setSlabParams(prev => ({
      ...prev,
      [param]: value
    }));
    
    // Reset polygon state when changing shape
    if (param === 'shape' && value !== 'polygon') {
      setPolygonPoints([]);
      setIsDrawingPolygon(false);
      setPreviewPoint(null);
    }
  }, []);
  
  // Handle polygon drawing
  const handlePolygonPointClick = useCallback((point) => {
    if (!isDrawingPolygon) return;
    
    const newPoints = [...polygonPoints, point];
    setPolygonPoints(newPoints);
    
    // Update slab params with new polygon points
    setSlabParams(prev => ({
      ...prev,
      polygonPoints: newPoints
    }));
    
    console.log('✏️ Added polygon point:', point, 'Total points:', newPoints.length);
  }, [isDrawingPolygon, polygonPoints]);
  
  // Start polygon drawing
  const startPolygonDrawing = useCallback(() => {
    setIsDrawingPolygon(true);
    setPolygonPoints([]);
    setPreviewPoint(null);
    console.log('✏️ Started polygon drawing mode');
  }, []);
  
  // Finish polygon drawing
  const finishPolygonDrawing = useCallback(() => {
    if (polygonPoints.length >= 3) {
      setIsDrawingPolygon(false);
      console.log('✅ Finished polygon with', polygonPoints.length, 'points');
    } else {
      console.warn('⚠️ Need at least 3 points to create a polygon');
    }
  }, [polygonPoints]);
  
  // Clear polygon drawing
  const clearPolygonDrawing = useCallback(() => {
    setPolygonPoints([]);
    setIsDrawingPolygon(false);
    setPreviewPoint(null);
    setSlabParams(prev => ({
      ...prev,
      polygonPoints: []
    }));
    console.log('✏️ Cleared polygon drawing');
  }, []);

  // Handle slab creation
  const handleCreate = useCallback(async () => {
    if (!isValid) return;
    
    setIsCreating(true);
    
    try {
      // Prepare slab creation parameters for standalone CAD engine
      const createParams = {
        width: slabParams.width,
        depth: slabParams.depth,
        thickness: slabParams.thickness,
        shape: slabParams.shape,
        material: slabParams.material,
        offset: slabParams.offset
      };
      
      // Add polygon points if using polygon shape
      if (slabParams.shape === 'polygon' && polygonPoints.length >= 3) {
        createParams.polygonPoints = polygonPoints;
      }
      
      // Create object using standalone CAD engine
      const objectId = standaloneCADEngine.createObject('slab', createParams);
      
      if (objectId) {
        console.log('✅ Slab created successfully:', objectId);
        
        // Notify parent component
        onObjectCreated?.({
          id: objectId,
          type: 'slab',
          ...createParams
        });
        
        // Reset to default values after successful creation
        setSlabParams({
          width: 5.0,
          depth: 5.0,
          thickness: 0.2,
          shape: 'rectangular',
          material: 'concrete',
          offset: 0.0,
          polygonPoints: []
        });
        
        // Reset polygon drawing state
        setPolygonPoints([]);
        setIsDrawingPolygon(false);
        setPreviewPoint(null);
      }
      
    } catch (error) {
      console.error('Slab creation error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, slabParams, polygonPoints, onObjectCreated]);

  // Handle slab update (for editing existing slabs)
  const handleUpdate = useCallback(async () => {
    if (!isValid || !selectedObject) return;
    
    setIsCreating(true);
    
    try {
      const updateParams = {
        width: slabParams.width,
        depth: slabParams.depth,
        thickness: slabParams.thickness,
        shape: slabParams.shape,
        material: slabParams.material,
        offset: slabParams.offset
      };
      
      // Add polygon points if using polygon shape
      if (slabParams.shape === 'polygon' && polygonPoints.length >= 3) {
        updateParams.polygonPoints = polygonPoints;
      }
      
      // Update object using standalone CAD engine
      const success = standaloneCADEngine.updateObject(selectedObject.id, updateParams);
      
      if (success) {
        console.log('✅ Slab updated successfully:', selectedObject.id);
        
        // Notify parent component
        onObjectUpdated?.({
          id: selectedObject.id,
          type: 'slab',
          ...updateParams
        });
      }
      
    } catch (error) {
      console.error('Slab update error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, slabParams, selectedObject, polygonPoints, onObjectUpdated]);

  // Don't render if not active
  if (!isActive) return null;

  const isEditing = selectedObject && (selectedObject.type === 'Slab' || selectedObject.type === 'slab');
  const selectedMaterial = materialOptions.find(m => m.value === slabParams.material);
  const isPolygonMode = slabParams.shape === 'polygon';

  return (
    <div className={`slab-tool-panel w-full h-full`}>
      
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-studiosix-600' : 'bg-studiosix-500'
          }`}>
            <SlabIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {isEditing ? 'Edit Slab' : 'Create Slab'}
            </h3>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {isEditing 
                ? 'Modify selected slab properties' 
                : isPolygonMode && isDrawingPolygon
                  ? 'Click in viewport to add polygon points'
                  : 'Configure slab parameters and create'
              }
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
          title="Close slab tool"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Parameters */}
      <div className="p-4 space-y-4">
        
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
                  slabParams.shape === option.value
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
          
          {/* Auto-fill Button */}
          {autoFillAvailable && (
            <div className="mt-3">
              <button
                onClick={handleAutoFill}
                className={`w-full flex items-center justify-center space-x-2 py-2 px-3 text-xs rounded border transition-all ${
                  theme === 'dark'
                    ? 'border-studiosix-500/50 bg-studiosix-600/20 text-studiosix-400 hover:bg-studiosix-600/30'
                    : 'border-studiosix-500/50 bg-studiosix-500/20 text-studiosix-600 hover:bg-studiosix-500/30'
                }`}
                title="Auto-fill dimensions from existing objects"
              >
                <SparklesIcon className="w-4 h-4" />
                <span>Auto-Fill from Scene</span>
                {lastAutoFillTime && (
                  <ArrowPathIcon className="w-3 h-3 opacity-60" />
                )}
              </button>
            </div>
          )}
          
          {/* Polygon Drawing Controls */}
          {isPolygonMode && (
            <div className="mt-3 space-y-2">
              <div className={`p-2 rounded border ${
                theme === 'dark' ? 'border-blue-700/50 bg-blue-800/20' : 'border-blue-500/50 bg-blue-50'
              }`}>
                <p className={`text-xs mb-2 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
                }`}>
                  {isDrawingPolygon 
                    ? `Drawing polygon: ${polygonPoints.length} point${polygonPoints.length !== 1 ? 's' : ''} (min 3 needed)`
                    : polygonPoints.length > 0 
                      ? `Polygon: ${polygonPoints.length} points`
                      : 'Click "Start Drawing" to define polygon shape'
                  }
                </p>
                
                <div className="flex space-x-1">
                  {!isDrawingPolygon ? (
                    <button
                      onClick={startPolygonDrawing}
                      className={`flex-1 py-1 px-2 text-xs rounded transition-colors ${
                        theme === 'dark'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      Start Drawing
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={finishPolygonDrawing}
                        disabled={polygonPoints.length < 3}
                        className={`flex-1 py-1 px-2 text-xs rounded transition-colors ${
                          polygonPoints.length >= 3
                            ? theme === 'dark'
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Finish
                      </button>
                      <button
                        onClick={clearPolygonDrawing}
                        className={`py-1 px-2 text-xs rounded transition-colors ${
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dimensions Section - Hide for polygon mode during drawing */}
        {!(isPolygonMode && isDrawingPolygon) && (
          <div>
            <h4 className={`text-sm font-medium mb-3 flex items-center ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <AdjustmentsVerticalIcon className="w-4 h-4 mr-2" />
              Dimensions {isPolygonMode && '(for reference)'}
            </h4>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Width */}
              <div>
                <label className={`block text-xs mb-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Width (m)
                </label>
                <input
                  type="number"
                  value={slabParams.width}
                  onChange={(e) => handleParameterChange('width', parseFloat(e.target.value) || 0)}
                  min="0.1"
                  max="100"
                  step="0.1"
                  disabled={isPolygonMode}
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
                  } ${isPolygonMode ? 'opacity-50' : ''}`}
                />
                {validationErrors.width && (
                  <p className="text-xs text-red-400 mt-1">{validationErrors.width}</p>
                )}
              </div>
              
              {/* Depth */}
              <div>
                <label className={`block text-xs mb-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Depth (m)
                </label>
                <input
                  type="number"
                  value={slabParams.depth}
                  onChange={(e) => handleParameterChange('depth', parseFloat(e.target.value) || 0)}
                  min="0.1"
                  max="100"
                  step="0.1"
                  disabled={isPolygonMode}
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
                  } ${isPolygonMode ? 'opacity-50' : ''}`}
                />
                {validationErrors.depth && (
                  <p className="text-xs text-red-400 mt-1">{validationErrors.depth}</p>
                )}
              </div>
              
              {/* Thickness */}
              <div>
                <label className={`block text-xs mb-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Thickness (m)
                </label>
                <input
                  type="number"
                  value={slabParams.thickness}
                  onChange={(e) => handleParameterChange('thickness', parseFloat(e.target.value) || 0)}
                  min="0.01"
                  max="2"
                  step="0.01"
                  className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                    validationErrors.thickness
                      ? 'border-red-500 focus:border-red-400'
                      : theme === 'dark'
                        ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                  } focus:outline-none focus:ring-1 ${
                    validationErrors.thickness
                      ? 'focus:ring-red-400'
                      : 'focus:ring-studiosix-500'
                  }`}
                />
                {validationErrors.thickness && (
                  <p className="text-xs text-red-400 mt-1">{validationErrors.thickness}</p>
                )}
              </div>
            </div>
          </div>
        )}

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
              value={slabParams.material}
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
          disabled={!isValid || isCreating || (isPolygonMode && (isDrawingPolygon || polygonPoints.length < 3))}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded transition-all ${
            isValid && !isCreating && !(isPolygonMode && (isDrawingPolygon || polygonPoints.length < 3))
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
                  <span className="text-sm">Update Slab</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span className="text-sm">Create Slab</span>
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

export default SlabTool;