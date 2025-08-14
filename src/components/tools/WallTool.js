import React, { useState, useEffect, useCallback } from 'react';
import { WallIcon } from '../icons';
import {
  SwatchIcon,
  RectangleStackIcon,
  AdjustmentsVerticalIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

/**
 * Wall Tool Component - Provides interface for wall creation and editing
 * Features: Parametric wall creation, material selection, alignment options
 */
const WallTool = ({
  isActive = false,
  selectedObject = null,
  wallParams: externalWallParams,
  onWallParamsChange,
  onCreateWall,
  onUpdateWall,
  onCancel,
  theme = 'dark'
}) => {
  console.log('🧱 WALL TOOL COMPONENT DEBUG: Props received:', {
    isActive,
    selectedObject,
    externalWallParams,
    onWallParamsChange: typeof onWallParamsChange,
    onCreateWall: typeof onCreateWall,
    onUpdateWall: typeof onUpdateWall,
    onCancel: typeof onCancel,
    theme
  });
  // Use external shared state or fallback to internal state
  const [internalWallParams, setInternalWallParams] = useState({
    length: 3.0,
    height: 2.7,
    width: 0.2,
    alignment: 'center', // 'left', 'center', 'right'
    material: 'concrete',
    thickness: 0.2 // alias for width
  });

  // Wall creation with parametric controls
  
  // Use external params if provided, otherwise use internal state
  const wallParams = externalWallParams || internalWallParams;
  const setWallParams = onWallParamsChange || setInternalWallParams;

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [previewMode, setPreviewMode] = useState(false);

  // Material options
  const materialOptions = [
    { value: 'concrete', label: 'Concrete', color: '#6b7280', density: 2400 }, // Professional grey
    { value: 'brick', label: 'Brick', color: '#a0522d', density: 1800 },
    { value: 'wood', label: 'Wood Frame', color: '#deb887', density: 600 },
    { value: 'steel', label: 'Steel Frame', color: '#708090', density: 7850 },
    { value: 'stone', label: 'Stone', color: '#696969', density: 2700 },
    { value: 'drywall', label: 'Drywall', color: '#f5f5dc', density: 800 }
  ];

  // Alignment options
  const alignmentOptions = [
    { value: 'left', label: 'Left', icon: '⬅️' },
    { value: 'center', label: 'Center', icon: '↔️' },
    { value: 'right', label: 'Right', icon: '➡️' }
  ];

  // Initialize with existing wall data if editing
  useEffect(() => {
    if (selectedObject && (selectedObject.type === 'wall' || selectedObject.type === 'Wall')) {
      console.log('🔄 WALL TOOL: Loading wall properties into tool panel');
      console.log('🔄 WALL TOOL: Selected object data:', selectedObject);
      
      // Extract properties from object params or direct properties with better fallback logic
      const params = selectedObject.params || selectedObject;
      
      // Create comprehensive parameter mapping
      const loadedParams = {
        length: params.length || selectedObject.length || 3.0,
        height: params.height || selectedObject.height || 2.7,
        width: params.thickness || params.width || selectedObject.thickness || selectedObject.width || 0.2,
        alignment: params.alignment || selectedObject.alignment || 'center',
        material: params.material || selectedObject.material || 'concrete',
        thickness: params.thickness || params.width || selectedObject.thickness || selectedObject.width || 0.2,
      };
      
      console.log('🔄 WALL TOOL: Extracted parameters:', loadedParams);
      console.log('🔄 WALL TOOL: Raw source data breakdown:', {
        'params.length': params.length,
        'selectedObject.length': selectedObject.length,
        'params.height': params.height,
        'selectedObject.height': selectedObject.height,
        'params.thickness': params.thickness,
        'selectedObject.thickness': selectedObject.thickness,
        'params.material': params.material,
        'selectedObject.material': selectedObject.material
      });
      
      setWallParams(loadedParams);
      
      console.log('✅ WALL TOOL: Wall parameters loaded successfully:', loadedParams);
    }
  }, [selectedObject, setWallParams]);

  // Sync width and thickness
  useEffect(() => {
    setWallParams(prev => ({
      ...prev,
      thickness: prev.width
    }));
  }, [wallParams.width]);


  // Parameter validation
  const validateParameters = useCallback(() => {
    const errors = {};
    
    // Length validation
    if (wallParams.length <= 0 || wallParams.length > 50) {
      errors.length = 'Length must be between 0.1m and 50m';
    }
    
    // Height validation
    if (wallParams.height <= 0 || wallParams.height > 20) {
      errors.height = 'Height must be between 0.1m and 20m';
    }
    
    // Width/Thickness validation
    if (wallParams.width <= 0 || wallParams.width > 2) {
      errors.width = 'Width must be between 0.01m and 2m';
    }
    

    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    setIsValid(isValid);
    
    return isValid;
  }, [wallParams]);

  // Run validation when parameters change
  useEffect(() => {
    validateParameters();
  }, [validateParameters]);

  // Handle parameter changes
  const handleParameterChange = useCallback((param, value) => {
    setWallParams(prev => ({
      ...prev,
      [param]: value
    }));
  }, []);


  // Handle wall update (for editing existing walls)
  const handleUpdate = useCallback(async () => {
    if (!isValid || !selectedObject) {
      console.warn('🚫 WALL TOOL: Cannot update - validation failed or no selected object');
      return;
    }
    
    console.log('🔧 WALL TOOL: Starting wall update process');
    console.log('🔧 WALL TOOL: Current wall params:', wallParams);
    console.log('🔧 WALL TOOL: Selected object:', selectedObject);
    
    setIsCreating(true);
    
    try {
      const material = materialOptions.find(m => m.value === wallParams.material);
      
      // Enhanced update parameters with comprehensive material data
      const updateParams = {
        id: selectedObject.id,
        length: Number(wallParams.length),
        height: Number(wallParams.height),
        thickness: Number(wallParams.thickness), // Use thickness consistently
        alignment: wallParams.alignment,
        material: wallParams.material,
        materialColor: material?.color || '#6b7280', // Professional grey fallback
        density: material?.density || 2400,
        type: 'wall'
      };
      
      console.log('🔧 WALL TOOL: Prepared update parameters:', updateParams);
      
      if (!onUpdateWall) {
        throw new Error('onUpdateWall callback is not provided');
      }
      
      await onUpdateWall(updateParams);
      
      console.log('✅ WALL TOOL: Wall update completed successfully');
      
    } catch (error) {
      console.error('❌ WALL TOOL: Wall update error:', error);
      // TODO: Show user-friendly error message
    } finally {
      setIsCreating(false);
      console.log('🔧 WALL TOOL: Update process finished, resetting creating state');
    }
  }, [isValid, wallParams, selectedObject, materialOptions, onUpdateWall]);

  // Only render panel when a wall is selected for editing
  if (!isActive) return null;
  
  const isEditing = selectedObject && (selectedObject.type === 'wall' || selectedObject.type === 'Wall');
  
  // For wall tool, only show panel when editing a selected wall
  if (!isEditing) return null;
  const selectedMaterial = materialOptions.find(m => m.value === wallParams.material);

  return (
    <div className={`wall-tool-panel w-full h-full ${
      theme === 'dark' 
        ? 'text-white' 
        : 'text-gray-900'
    }`}>
      
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-studiosix-600' : 'bg-studiosix-500'
          }`}>
            <WallIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Edit Wall
            </h3>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Modify selected wall properties
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
          title="Close wall tool"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>


      {/* Parameters */}
      <div className="p-4 space-y-4">
        
        {/* Dimensions Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <RectangleStackIcon className="w-4 h-4 mr-2" />
            Dimensions
          </h4>
          
          <div className="grid grid-cols-3 gap-3">
            {/* Length */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Length (m)
              </label>
              <input
                type="number"
                value={wallParams.length}
                onChange={(e) => handleParameterChange('length', parseFloat(e.target.value) || 0)}
                min="0.1"
                max="50"
                step="0.1"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.length
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.length
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.length && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.length}</p>
              )}
            </div>
            
            {/* Height */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Height (m)
              </label>
              <input
                type="number"
                value={wallParams.height}
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
            
            {/* Width */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Width (m)
              </label>
              <input
                type="number"
                value={wallParams.width}
                onChange={(e) => handleParameterChange('width', parseFloat(e.target.value) || 0)}
                min="0.01"
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
          </div>
        </div>


        {/* Alignment Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <AdjustmentsVerticalIcon className="w-4 h-4 mr-2" />
            Alignment & Position
          </h4>
          
          <div className="space-y-3">
            {/* Alignment */}
            <div>
              <label className={`block text-xs mb-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Wall Alignment
              </label>
              <div className="flex space-x-1">
                {alignmentOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleParameterChange('alignment', option.value)}
                    className={`flex-1 p-2 text-xs rounded transition-colors ${
                      wallParams.alignment === option.value
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
              value={wallParams.material}
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
          onClick={handleUpdate}
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
              <span className="text-sm">Updating...</span>
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4" />
              <span className="text-sm">Edit Wall</span>
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

export default WallTool;