import React, { useState, useEffect, useCallback } from 'react';
import { RoofIcon } from '../icons';
import {
  SwatchIcon,
  RectangleStackIcon,
  AdjustmentsVerticalIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  HomeIcon,
  ArrowTrendingUpIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline';

/**
 * Roof Tool Component - Provides interface for roof creation and editing
 * Allows users to specify roof parameters, type, and materials before placement
 */
const RoofTool = ({
  isActive = false,
  selectedObject = null,
  onCreateRoof,
  onUpdateRoof,
  onCancel,
  theme = 'dark',
  freecadObjects = [] // For building detection and auto-fitting
}) => {
  // Roof parameters state
  const [roofParams, setRoofParams] = useState({
    roofType: 'gable', // 'gable', 'hip', 'shed', 'flat', 'gambrel', 'mansard'
    width: 10.0,
    length: 12.0,
    height: 4.0,
    pitch: 30, // Roof pitch in degrees (0-60)
    overhang: 0.5, // Roof overhang/eave extension
    thickness: 0.2, // Roof slab thickness
    material: 'tiles',
    gutterWidth: 0.1,
    ridgeHeight: 0.1
  });

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [availableBuildings, setAvailableBuildings] = useState([]);
  const [autoFillSuggestions, setAutoFillSuggestions] = useState([]);

  // Material options for roofs
  const materialOptions = [
    { value: 'tiles', label: 'Clay Tiles', color: '#dc2626', weight: 45, lifespan: 50 },
    { value: 'shingles', label: 'Asphalt Shingles', color: '#374151', weight: 12, lifespan: 20 },
    { value: 'metal', label: 'Metal Roofing', color: '#6b7280', weight: 7, lifespan: 40 },
    { value: 'slate', label: 'Natural Slate', color: '#1f2937', weight: 80, lifespan: 100 },
    { value: 'concrete', label: 'Concrete Tiles', color: '#9ca3af', weight: 40, lifespan: 50 },
    { value: 'wood', label: 'Wood Shakes', color: '#92400e', weight: 15, lifespan: 30 },
    { value: 'membrane', label: 'Membrane (Flat)', color: '#111827', weight: 5, lifespan: 15 },
    { value: 'green', label: 'Green Roof', color: '#059669', weight: 120, lifespan: 40 }
  ];

  // Roof type options
  const roofTypes = [
    { 
      value: 'gable', 
      label: 'Gable', 
      icon: <HomeIcon className="w-4 h-4" />, 
      description: 'Traditional triangular roof' 
    },
    { 
      value: 'hip', 
      label: 'Hip', 
      icon: <Squares2X2Icon className="w-4 h-4" />, 
      description: 'Four-sided sloped roof' 
    },
    { 
      value: 'shed', 
      label: 'Shed', 
      icon: <ArrowTrendingUpIcon className="w-4 h-4" />, 
      description: 'Single slope roof' 
    },
    { 
      value: 'flat', 
      label: 'Flat', 
      icon: '⬜', 
      description: 'Low slope or flat roof' 
    },
    { 
      value: 'gambrel', 
      label: 'Gambrel', 
      icon: '⌂', 
      description: 'Barn-style with two slopes' 
    },
    { 
      value: 'mansard', 
      label: 'Mansard', 
      icon: '⌂', 
      description: 'French-style four-sided' 
    }
  ];

  // Initialize with existing roof data if editing
  useEffect(() => {
    if (selectedObject && selectedObject.type === 'Roof') {
      setRoofParams({
        roofType: selectedObject.roofType || 'gable',
        width: selectedObject.width || 10.0,
        length: selectedObject.length || 12.0,
        height: selectedObject.height || 4.0,
        pitch: selectedObject.pitch || 30,
        overhang: selectedObject.overhang || 0.5,
        thickness: selectedObject.thickness || 0.2,
        material: selectedObject.material || 'tiles',
        gutterWidth: selectedObject.gutterWidth || 0.1,
        ridgeHeight: selectedObject.ridgeHeight || 0.1
      });
    }
  }, [selectedObject]);

  // Detect buildings and walls for roof placement
  useEffect(() => {
    if (!isActive || !freecadObjects) return;

    const buildings = freecadObjects.filter(obj => 
      obj.type === 'Wall' || 
      obj.type === 'Structure' || 
      obj.type === 'SketchUpBuilding'
    );
    setAvailableBuildings(buildings);

    // Generate auto-fill suggestions based on building footprint
    if (buildings.length > 0) {
      generateAutoFillSuggestions(buildings);
    }
  }, [freecadObjects, isActive]);

  // Generate auto-fill suggestions from existing buildings
  const generateAutoFillSuggestions = useCallback((buildings) => {
    const suggestions = buildings.map(building => {
      // Calculate roof dimensions based on building footprint
      const buildingWidth = building.width || building.length || 8;
      const buildingLength = building.depth || building.length || 10;
      
      // Add overhang to building dimensions
      const roofWidth = buildingWidth + (roofParams.overhang * 2);
      const roofLength = buildingLength + (roofParams.overhang * 2);
      
      // Calculate appropriate roof height based on pitch and span
      const span = Math.max(roofWidth, roofLength);
      const calculatedHeight = (span / 2) * Math.tan((roofParams.pitch * Math.PI) / 180);
      
      return {
        id: building.id,
        name: building.name || `${building.type} ${building.id}`,
        width: roofWidth,
        length: roofLength,
        height: Math.max(calculatedHeight, 2.0),
        buildingType: building.type
      };
    });
    
    setAutoFillSuggestions(suggestions);
  }, [roofParams.overhang, roofParams.pitch]);

  // Parameter validation
  const validateParameters = useCallback(() => {
    const errors = {};
    
    // Width validation
    if (roofParams.width <= 0 || roofParams.width > 50) {
      errors.width = 'Width must be between 0.1m and 50m';
    }
    
    // Length validation
    if (roofParams.length <= 0 || roofParams.length > 50) {
      errors.length = 'Length must be between 0.1m and 50m';
    }
    
    // Height validation
    if (roofParams.height <= 0 || roofParams.height > 20) {
      errors.height = 'Height must be between 0.1m and 20m';
    }
    
    // Pitch validation
    if (roofParams.pitch < 0 || roofParams.pitch > 60) {
      errors.pitch = 'Pitch must be between 0° and 60°';
    }
    
    // Overhang validation
    if (roofParams.overhang < 0 || roofParams.overhang > 5) {
      errors.overhang = 'Overhang must be between 0m and 5m';
    }
    
    // Thickness validation
    if (roofParams.thickness <= 0 || roofParams.thickness > 1) {
      errors.thickness = 'Thickness must be between 0.01m and 1m';
    }

    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    setIsValid(isValid);
    
    return isValid;
  }, [roofParams]);

  // Run validation when parameters change
  useEffect(() => {
    validateParameters();
  }, [validateParameters]);

  // Handle parameter changes
  const handleParameterChange = useCallback((param, value) => {
    setRoofParams(prev => ({
      ...prev,
      [param]: value
    }));
  }, []);

  // Auto-fill from building suggestion
  const handleAutoFill = useCallback((suggestion) => {
    setRoofParams(prev => ({
      ...prev,
      width: suggestion.width,
      length: suggestion.length,
      height: suggestion.height
    }));
  }, []);

  // Calculate roof area and weight
  const calculateRoofStats = useCallback(() => {
    const selectedMaterial = materialOptions.find(m => m.value === roofParams.material);
    const area = roofParams.width * roofParams.length;
    
    // Adjust area for roof type (hip roofs have more surface area than gable)
    const areaMultiplier = roofParams.roofType === 'hip' ? 1.2 : 
                           roofParams.roofType === 'gambrel' ? 1.15 : 1.0;
    
    const actualArea = area * areaMultiplier;
    const weight = actualArea * (selectedMaterial?.weight || 20);
    
    return {
      area: actualArea.toFixed(1),
      weight: weight.toFixed(0),
      material: selectedMaterial?.label || roofParams.material,
      lifespan: selectedMaterial?.lifespan || 25
    };
  }, [roofParams, materialOptions]);

  // Handle roof creation
  const handleCreate = useCallback(async () => {
    if (!isValid) return;
    
    setIsCreating(true);
    
    try {
      // Get material properties
      const material = materialOptions.find(m => m.value === roofParams.material);
      const roofStats = calculateRoofStats();
      
      // Prepare roof creation parameters for FreeCAD
      const createParams = {
        // Basic dimensions
        width: roofParams.width,
        length: roofParams.length,
        height: roofParams.height,
        thickness: roofParams.thickness,
        
        // Roof-specific properties
        roofType: roofParams.roofType,
        pitch: roofParams.pitch,
        overhang: roofParams.overhang,
        gutterWidth: roofParams.gutterWidth,
        ridgeHeight: roofParams.ridgeHeight,
        
        // Material properties
        material: roofParams.material,
        materialColor: material?.color || '#dc2626',
        materialWeight: material?.weight || 20,
        lifespan: material?.lifespan || 25,
        
        // Calculated properties
        area: parseFloat(roofStats.area),
        totalWeight: parseFloat(roofStats.weight),
        
        // Additional properties
        workbench: 'Arch',
        command: 'Arch_Roof',
        type: 'Roof'
      };
      
      // Call the creation handler
      await onCreateRoof?.(createParams);
      
      // Reset to default values after successful creation
      setRoofParams({
        roofType: 'gable',
        width: 10.0,
        length: 12.0,
        height: 4.0,
        pitch: 30,
        overhang: 0.5,
        thickness: 0.2,
        material: 'tiles',
        gutterWidth: 0.1,
        ridgeHeight: 0.1
      });
      
    } catch (error) {
      console.error('Roof creation error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, roofParams, materialOptions, calculateRoofStats, onCreateRoof]);

  // Handle roof update (for editing existing roofs)
  const handleUpdate = useCallback(async () => {
    if (!isValid || !selectedObject) return;
    
    setIsCreating(true);
    
    try {
      const material = materialOptions.find(m => m.value === roofParams.material);
      const roofStats = calculateRoofStats();
      
      const updateParams = {
        id: selectedObject.id,
        width: roofParams.width,
        length: roofParams.length,
        height: roofParams.height,
        thickness: roofParams.thickness,
        roofType: roofParams.roofType,
        pitch: roofParams.pitch,
        overhang: roofParams.overhang,
        gutterWidth: roofParams.gutterWidth,
        ridgeHeight: roofParams.ridgeHeight,
        material: roofParams.material,
        materialColor: material?.color || '#dc2626',
        materialWeight: material?.weight || 20,
        area: parseFloat(roofStats.area),
        totalWeight: parseFloat(roofStats.weight)
      };
      
      await onUpdateRoof?.(updateParams);
      
    } catch (error) {
      console.error('Roof update error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, roofParams, selectedObject, materialOptions, calculateRoofStats, onUpdateRoof]);

  // Don't render if not active
  if (!isActive) return null;

  const isEditing = selectedObject && selectedObject.type === 'Roof';
  const selectedMaterial = materialOptions.find(m => m.value === roofParams.material);
  const selectedRoofType = roofTypes.find(t => t.value === roofParams.roofType);
  const roofStats = calculateRoofStats();

  return (
    <div className="roof-tool-panel w-full h-full">
      
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-studiosix-600' : 'bg-studiosix-500'
          }`}>
            <RoofIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {isEditing ? 'Edit Roof' : 'Create Roof'}
            </h3>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {isEditing ? 'Modify selected roof properties' : 'Click to place roof on building'}
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
          title="Close roof tool"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Parameters */}
      <div className="p-4 space-y-4">
        
        {/* Auto-Fill Suggestions */}
        {autoFillSuggestions.length > 0 && (
          <div className={`p-3 rounded border ${
            theme === 'dark' ? 'border-blue-700/50 bg-blue-800/20' : 'border-blue-500/50 bg-blue-50'
          }`}>
            <h5 className={`text-xs font-medium mb-2 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
            }`}>
              Auto-fill from buildings:
            </h5>
            <div className="space-y-1">
              {autoFillSuggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleAutoFill(suggestion)}
                  className={`w-full text-left p-2 text-xs rounded transition-colors ${
                    theme === 'dark' 
                      ? 'hover:bg-blue-700/30 text-blue-300' 
                      : 'hover:bg-blue-100 text-blue-700'
                  }`}
                >
                  {suggestion.name}: {suggestion.width.toFixed(1)}m × {suggestion.length.toFixed(1)}m
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dimensions Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <RectangleStackIcon className="w-4 h-4 mr-2" />
            Dimensions
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Width */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Width (m)
              </label>
              <input
                type="number"
                value={roofParams.width}
                onChange={(e) => handleParameterChange('width', parseFloat(e.target.value) || 0)}
                min="0.1"
                max="50"
                step="0.1"
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
            
            {/* Length */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Length (m)
              </label>
              <input
                type="number"
                value={roofParams.length}
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
                value={roofParams.height}
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

            {/* Pitch */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Pitch (°)
              </label>
              <input
                type="number"
                value={roofParams.pitch}
                onChange={(e) => handleParameterChange('pitch', parseFloat(e.target.value) || 0)}
                min="0"
                max="60"
                step="1"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.pitch
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.pitch
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.pitch && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.pitch}</p>
              )}
            </div>

            {/* Overhang */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Overhang (m)
              </label>
              <input
                type="number"
                value={roofParams.overhang}
                onChange={(e) => handleParameterChange('overhang', parseFloat(e.target.value) || 0)}
                min="0"
                max="5"
                step="0.1"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.overhang
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.overhang
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.overhang && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.overhang}</p>
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
                value={roofParams.thickness}
                onChange={(e) => handleParameterChange('thickness', parseFloat(e.target.value) || 0)}
                min="0.01"
                max="1"
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

        {/* Roof Type Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <AdjustmentsVerticalIcon className="w-4 h-4 mr-2" />
            Roof Type
          </h4>
          
          <div className="grid grid-cols-3 gap-2">
            {roofTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => handleParameterChange('roofType', type.value)}
                className={`p-2 text-xs rounded transition-colors ${
                  roofParams.roofType === type.value
                    ? theme === 'dark'
                      ? 'bg-studiosix-600 text-white'
                      : 'bg-studiosix-500 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={type.description}
              >
                <div className="flex items-center justify-center mb-1">
                  {typeof type.icon === 'string' ? type.icon : type.icon}
                </div>
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Material Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <SwatchIcon className="w-4 h-4 mr-2" />
            Roofing Material
          </h4>
          
          <div className="space-y-2">
            <select
              value={roofParams.material}
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
            
            {/* Material Properties and Roof Statistics */}
            {selectedMaterial && (
              <div className={`p-2 rounded border space-y-2 ${
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
                    {selectedMaterial.label}
                  </span>
                </div>
                <div className={`grid grid-cols-2 gap-2 text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <div>Area: {roofStats.area} m²</div>
                  <div>Weight: {roofStats.weight} kg</div>
                  <div>Lifespan: {selectedMaterial.lifespan} years</div>
                  <div>Density: {selectedMaterial.weight} kg/m²</div>
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
                  <span className="text-sm">Update Roof</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span className="text-sm">Create Roof</span>
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

export default RoofTool;