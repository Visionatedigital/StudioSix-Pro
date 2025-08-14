import React, { useState, useEffect, useCallback } from 'react';
import { WindowIcon } from '../icons';
import standaloneCADEngine from '../../services/StandaloneCADEngine';
import {
  SwatchIcon,
  RectangleStackIcon,
  AdjustmentsVerticalIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  Squares2X2Icon,
  SunIcon
} from '@heroicons/react/24/outline';

/**
 * Window Tool Component - Provides interface for window creation and editing
 * Allows users to specify window parameters before placement on walls
 */
const WindowTool = ({
  isActive = false,
  selectedObject = null,
  onCancel,
  theme = 'dark',
  cadObjects = [], // Objects from standalone CAD engine
  onObjectCreated, // Callback when object is created
  onObjectUpdated, // Callback when object is updated
  walls = [] // Available walls for window placement
}) => {
  // Window parameters state
  const [windowParams, setWindowParams] = useState({
    width: 1.2,
    height: 1.4,
    thickness: 0.05,
    windowType: 'casement', // 'casement', 'sliding', 'fixed', 'awning'
    material: 'aluminum',
    glazingLayers: 2, // Number of glass layers (1-3)
    frameWidth: 0.05,
    offset: 0.0,
    openable: true,
    insertionMode: 'create_standalone', // 'create_standalone' or 'insert_in_wall'
    hostWallId: null,
    insertionPosition: 0.5, // Position along wall (0-1)
    sillHeight: 0.9 // Height from floor to window sill
  });

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [availableWalls, setAvailableWalls] = useState([]);

  // Material options for windows
  const materialOptions = [
    { value: 'aluminum', label: 'Aluminum', color: '#9ca3af', thermalTransmittance: 5.7 },
    { value: 'wood', label: 'Wood', color: '#92400e', thermalTransmittance: 2.0 },
    { value: 'upvc', label: 'uPVC', color: '#f3f4f6', thermalTransmittance: 2.2 },
    { value: 'fiberglass', label: 'Fiberglass', color: '#6b7280', thermalTransmittance: 2.3 },
    { value: 'steel', label: 'Steel', color: '#374151', thermalTransmittance: 6.0 },
    { value: 'composite', label: 'Composite', color: '#8b7d6b', thermalTransmittance: 2.5 }
  ];

  // Window type options
  const windowTypes = [
    { 
      value: 'casement', 
      label: 'Casement', 
      icon: <Squares2X2Icon className="w-4 h-4" />, 
      description: 'Hinged at side, opens outward' 
    },
    { 
      value: 'sliding', 
      label: 'Sliding', 
      icon: '⇄', 
      description: 'Slides horizontally' 
    },
    { 
      value: 'fixed', 
      label: 'Fixed', 
      icon: '⬛', 
      description: 'Non-opening window' 
    },
    { 
      value: 'awning', 
      label: 'Awning', 
      icon: <SunIcon className="w-4 h-4" />, 
      description: 'Hinged at top, opens outward' 
    }
  ];

  // Initialize with existing window data if editing
  useEffect(() => {
    if (selectedObject && (selectedObject.type === 'Window' || selectedObject.type === 'window')) {
      setWindowParams({
        width: selectedObject.width || 1.2,
        height: selectedObject.height || 1.4,
        thickness: selectedObject.thickness || 0.05,
        windowType: selectedObject.windowType || 'casement',
        material: selectedObject.material || 'aluminum',
        glazingLayers: selectedObject.glazingLayers || 2,
        frameWidth: selectedObject.frameWidth || 0.05,
        offset: selectedObject.offset || 0.0,
        openable: selectedObject.openable !== undefined ? selectedObject.openable : true
      });
    }
  }, [selectedObject]);

  // Update available walls for window placement
  useEffect(() => {
    if (!isActive) return;
    
    // Filter walls from CAD objects or use provided walls
    const wallObjects = walls.length > 0 ? walls : cadObjects.filter(obj => obj.type === 'wall' || obj.type === 'Wall');
    setAvailableWalls(wallObjects);
  }, [cadObjects, walls, isActive]);

  // Parameter validation
  const validateParameters = useCallback(() => {
    const errors = {};
    
    // Width validation
    if (windowParams.width <= 0 || windowParams.width > 8) {
      errors.width = 'Width must be between 0.1m and 8m';
    }
    
    // Height validation
    if (windowParams.height <= 0 || windowParams.height > 5) {
      errors.height = 'Height must be between 0.1m and 5m';
    }
    
    // Thickness validation
    if (windowParams.thickness <= 0 || windowParams.thickness > 0.3) {
      errors.thickness = 'Thickness must be between 0.01m and 0.3m';
    }
    
    // Frame width validation
    if (windowParams.frameWidth < 0 || windowParams.frameWidth > 0.3) {
      errors.frameWidth = 'Frame width must be between 0m and 0.3m';
    }

    // Glazing layers validation
    if (windowParams.glazingLayers < 1 || windowParams.glazingLayers > 3) {
      errors.glazingLayers = 'Glazing layers must be between 1 and 3';
    }

    // Wall insertion validation
    if (windowParams.insertionMode === 'insert_in_wall') {
      if (!windowParams.hostWallId) {
        errors.hostWallId = 'Please select a wall for window insertion';
      } else {
        // Check if window fits in the selected wall
        const selectedWall = availableWalls.find(w => w.id === windowParams.hostWallId);
        if (selectedWall && selectedWall.length && windowParams.width > selectedWall.length * 0.8) {
          errors.width = `Window too wide for selected wall (max: ${(selectedWall.length * 0.8).toFixed(1)}m)`;
        }
      }
    }

    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    setIsValid(isValid);
    
    return isValid;
  }, [windowParams, availableWalls]);

  // Run validation when parameters change
  useEffect(() => {
    validateParameters();
  }, [validateParameters]);

  // Handle parameter changes
  const handleParameterChange = useCallback((param, value) => {
    setWindowParams(prev => ({
      ...prev,
      [param]: value
    }));
  }, []);

  // Calculate thermal performance
  const calculateThermalPerformance = useCallback(() => {
    const material = materialOptions.find(m => m.value === windowParams.material);
    const baseTransmittance = material?.thermalTransmittance || 2.5;
    
    // Adjust for glazing layers (more layers = better insulation)
    const glazingFactor = windowParams.glazingLayers === 1 ? 1.0 : 
                         windowParams.glazingLayers === 2 ? 0.6 : 0.4;
    
    const thermalTransmittance = baseTransmittance * glazingFactor;
    
    return {
      thermalTransmittance: thermalTransmittance.toFixed(1),
      glazingLayers: windowParams.glazingLayers,
      material: material?.label || windowParams.material
    };
  }, [windowParams.material, windowParams.glazingLayers, materialOptions]);

  // Handle window creation
  const handleCreate = useCallback(async () => {
    if (!isValid) return;
    
    setIsCreating(true);
    
    try {
      const thermalData = calculateThermalPerformance();
      
      // Prepare window creation parameters for standalone CAD engine
      const createParams = {
        width: windowParams.width,
        height: windowParams.height,
        thickness: windowParams.thickness,
        windowType: windowParams.windowType,
        glazingLayers: windowParams.glazingLayers,
        frameWidth: windowParams.frameWidth,
        material: windowParams.material,
        offset: windowParams.offset,
        openable: windowParams.openable,
        thermalTransmittance: parseFloat(thermalData.thermalTransmittance),
        insertionMode: windowParams.insertionMode,
        hostWallId: windowParams.hostWallId,
        insertionPosition: windowParams.insertionPosition,
        sillHeight: windowParams.sillHeight
      };
      
      let objectId;
      
      if (windowParams.insertionMode === 'insert_in_wall' && windowParams.hostWallId) {
        // Create window inserted in wall with undo/redo support
        console.log('🪟 Creating window inserted in wall:', windowParams.hostWallId);
        const command = await standaloneCADEngine.createWindowWithHistory({
          ...createParams,
          hostWallId: windowParams.hostWallId,
          insertionPosition: windowParams.insertionPosition,
          sillHeight: windowParams.sillHeight
        });
        objectId = command.entityId;
      } else {
        // Create standalone window with undo/redo support
        console.log('🪟 Creating standalone window');
        const command = await standaloneCADEngine.createWindowWithHistory(createParams);
        objectId = command.entityId;
      }
      
      if (objectId) {
        console.log('🪟 Window created successfully:', objectId);
        
        // Notify parent component
        onObjectCreated?.({
          id: objectId,
          type: 'window',
          ...createParams
        });
        
        // Reset to default values after successful creation
        setWindowParams({
          width: 1.2,
          height: 1.4,
          thickness: 0.05,
          windowType: 'casement',
          material: 'aluminum',
          glazingLayers: 2,
          frameWidth: 0.05,
          offset: 0.0,
          openable: true,
          insertionMode: 'create_standalone',
          hostWallId: null,
          insertionPosition: 0.5,
          sillHeight: 0.9
        });
      }
      
    } catch (error) {
      console.error('Window creation error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, windowParams, calculateThermalPerformance, onObjectCreated]);

  // Handle window update (for editing existing windows)
  const handleUpdate = useCallback(async () => {
    if (!isValid || !selectedObject) return;
    
    setIsCreating(true);
    
    try {
      const thermalData = calculateThermalPerformance();
      
      const updateParams = {
        width: windowParams.width,
        height: windowParams.height,
        thickness: windowParams.thickness,
        windowType: windowParams.windowType,
        glazingLayers: windowParams.glazingLayers,
        frameWidth: windowParams.frameWidth,
        material: windowParams.material,
        offset: windowParams.offset,
        openable: windowParams.openable,
        thermalTransmittance: parseFloat(thermalData.thermalTransmittance)
      };
      
      // Update object using standalone CAD engine
      const success = standaloneCADEngine.updateObject(selectedObject.id, updateParams);
      
      if (success) {
        console.log('🪟 Window updated successfully:', selectedObject.id);
        
        // Notify parent component
        onObjectUpdated?.({
          id: selectedObject.id,
          type: 'window',
          ...updateParams
        });
      }
      
    } catch (error) {
      console.error('Window update error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, windowParams, selectedObject, calculateThermalPerformance, onObjectUpdated]);

  // Don't render if not active
  if (!isActive) return null;

  const isEditing = selectedObject && (selectedObject.type === 'Window' || selectedObject.type === 'window');
  const selectedMaterial = materialOptions.find(m => m.value === windowParams.material);
  const selectedWindowType = windowTypes.find(t => t.value === windowParams.windowType);
  const thermalData = calculateThermalPerformance();

  return (
    <div className="window-tool-panel w-full h-full">
      
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-studiosix-600' : 'bg-studiosix-500'
          }`}>
            <WindowIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {isEditing ? 'Edit Window' : 'Create Window'}
            </h3>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {isEditing ? 'Modify selected window properties' : 'Configure window parameters and create'}
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
          title="Close window tool"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Parameters */}
      <div className="p-4 space-y-4">
        
        {/* Insertion Mode Selection */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Insertion Mode
          </h4>
          
          <div className="space-y-2">
            <div className="flex space-x-2">
              <button
                onClick={() => handleParameterChange('insertionMode', 'create_standalone')}
                className={`flex-1 p-2 text-xs rounded transition-colors ${
                  windowParams.insertionMode === 'create_standalone'
                    ? theme === 'dark'
                      ? 'bg-studiosix-600 text-white'
                      : 'bg-studiosix-500 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Standalone Window
              </button>
              <button
                onClick={() => handleParameterChange('insertionMode', 'insert_in_wall')}
                disabled={availableWalls.length === 0}
                className={`flex-1 p-2 text-xs rounded transition-colors ${
                  windowParams.insertionMode === 'insert_in_wall'
                    ? theme === 'dark'
                      ? 'bg-studiosix-600 text-white'
                      : 'bg-studiosix-500 text-white'
                    : availableWalls.length === 0
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : theme === 'dark'
                        ? 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Insert in Wall
              </button>
            </div>
            
            {windowParams.insertionMode === 'insert_in_wall' && availableWalls.length === 0 && (
              <p className={`text-xs ${
                theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
              }`}>
                No walls available. Create walls first to use this mode.
              </p>
            )}
          </div>
        </div>

        {/* Wall Selection (only when insert_in_wall mode) */}
        {windowParams.insertionMode === 'insert_in_wall' && availableWalls.length > 0 && (
          <div>
            <h4 className={`text-sm font-medium mb-3 flex items-center ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Wall Selection
            </h4>
            
            <div className="space-y-3">
              <select
                value={windowParams.hostWallId || ''}
                onChange={(e) => handleParameterChange('hostWallId', e.target.value || null)}
                className={`w-full px-2 py-2 text-sm rounded border transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
              >
                <option value="">Select wall for window insertion</option>
                {availableWalls.map((wall) => (
                  <option key={wall.id} value={wall.id}>
                    Wall {wall.id.split('_')[1] || wall.id} 
                    {wall.length ? ` (${wall.length.toFixed(1)}m long)` : ''}
                  </option>
                ))}
              </select>
              {validationErrors.hostWallId && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.hostWallId}</p>
              )}
              
              {/* Insertion Position Slider */}
              {windowParams.hostWallId && (
                <div>
                  <label className={`block text-xs mb-2 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Position along wall: {(windowParams.insertionPosition * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={windowParams.insertionPosition}
                    onChange={(e) => handleParameterChange('insertionPosition', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs mt-1">
                    <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>Start</span>
                    <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>End</span>
                  </div>
                </div>
              )}
              
              {/* Sill Height */}
              {windowParams.hostWallId && (
                <div>
                  <label className={`block text-xs mb-1 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Sill Height (m)
                  </label>
                  <input
                    type="number"
                    value={windowParams.sillHeight}
                    onChange={(e) => handleParameterChange('sillHeight', parseFloat(e.target.value) || 0)}
                    min="0"
                    max="2"
                    step="0.1"
                    className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                      theme === 'dark'
                        ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                    } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
                  />
                </div>
              )}
              
              {/* Wall info display */}
              {windowParams.hostWallId && (
                <div className={`p-2 rounded border ${
                  theme === 'dark' ? 'border-green-700/50 bg-green-800/20' : 'border-green-500/50 bg-green-50'
                }`}>
                  {(() => {
                    const selectedWall = availableWalls.find(w => w.id === windowParams.hostWallId);
                    if (!selectedWall) return null;
                    
                    return (
                      <div className={`text-xs space-y-1 ${
                        theme === 'dark' ? 'text-green-400' : 'text-green-700'
                      }`}>
                        <p>Selected wall: {selectedWall.length?.toFixed(1) || 'Unknown'}m long</p>
                        {selectedWall.length && (
                          <>
                            <p>Window position: {(windowParams.insertionPosition * selectedWall.length).toFixed(1)}m from start</p>
                            <p>Sill height: {windowParams.sillHeight}m from floor</p>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wall Selection Info for standalone mode */}
        {windowParams.insertionMode === 'create_standalone' && availableWalls.length > 0 && (
          <div className={`p-2 rounded border ${
            theme === 'dark' ? 'border-blue-700/50 bg-blue-800/20' : 'border-blue-500/50 bg-blue-50'
          }`}>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
            }`}>
              Standalone mode: Window will be created independently (not inserted in wall)
            </p>
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
                value={windowParams.width}
                onChange={(e) => handleParameterChange('width', parseFloat(e.target.value) || 0)}
                min="0.1"
                max="8"
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
            
            {/* Height */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Height (m)
              </label>
              <input
                type="number"
                value={windowParams.height}
                onChange={(e) => handleParameterChange('height', parseFloat(e.target.value) || 0)}
                min="0.1"
                max="5"
                step="0.01"
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
            
            {/* Frame Width */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Frame (m)
              </label>
              <input
                type="number"
                value={windowParams.frameWidth}
                onChange={(e) => handleParameterChange('frameWidth', parseFloat(e.target.value) || 0)}
                min="0"
                max="0.3"
                step="0.01"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.frameWidth
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.frameWidth
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.frameWidth && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.frameWidth}</p>
              )}
            </div>

            {/* Glazing Layers */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Glass Layers
              </label>
              <select
                value={windowParams.glazingLayers}
                onChange={(e) => handleParameterChange('glazingLayers', parseInt(e.target.value))}
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
              >
                <option value={1}>Single (1)</option>
                <option value={2}>Double (2)</option>
                <option value={3}>Triple (3)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Window Type Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <AdjustmentsVerticalIcon className="w-4 h-4 mr-2" />
            Window Type
          </h4>
          
          <div className="grid grid-cols-2 gap-2">
            {windowTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => handleParameterChange('windowType', type.value)}
                className={`p-3 text-xs rounded transition-colors ${
                  windowParams.windowType === type.value
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

        {/* Openable Toggle */}
        <div className="flex items-center justify-between">
          <label className={`text-sm font-medium ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Openable Window
          </label>
          <button
            onClick={() => handleParameterChange('openable', !windowParams.openable)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              windowParams.openable 
                ? 'bg-studiosix-600' 
                : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              windowParams.openable ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Material Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <SwatchIcon className="w-4 h-4 mr-2" />
            Frame Material
          </h4>
          
          <div className="space-y-2">
            <select
              value={windowParams.material}
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
            
            {/* Material and Thermal Performance Preview */}
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
                <div className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <div>Thermal: {thermalData.thermalTransmittance} W/m²K</div>
                  <div>Glazing: {thermalData.glazingLayers} layer{thermalData.glazingLayers > 1 ? 's' : ''}</div>
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
                  <span className="text-sm">Update Window</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span className="text-sm">Create Window</span>
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

export default WindowTool;