import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DoorIcon } from '../icons';
import standaloneCADEngine from '../../services/StandaloneCADEngine';
import {
  SwatchIcon,
  RectangleStackIcon,
  AdjustmentsVerticalIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  ArrowUturnRightIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';

/**
 * Door Tool Component - Provides interface for door creation and editing
 * Allows users to specify door parameters before placement
 */
const DoorTool = ({
  isActive = false,
  selectedObject = null,
  onCancel,
  theme = 'dark',
  cadObjects = [], // Objects from standalone CAD engine
  onObjectCreated, // Callback when object is created
  onObjectUpdated, // Callback when object is updated
  walls = [], // Available walls for door placement
  doorParams: externalDoorParams, // External door parameters for preview
  onDoorParamsChange // Callback to update external parameters
}) => {
  // Use external parameters if provided, otherwise use internal state
  const [internalDoorParams, setInternalDoorParams] = useState({
    width: 0.9,
    height: 2.1,
    thickness: 0.05,
    openingDirection: 'right', // 'left', 'right', 'inward', 'outward'
    material: 'wood',
    frameWidth: 0.05,
    offset: 0.0,
    insertionMode: 'create_standalone', // 'create_standalone' or 'insert_in_wall'
    hostWallId: null,
    insertionPosition: 0.5 // Position along wall (0-1)
  });

  // Use external params if provided, otherwise use internal state
  const doorParams = externalDoorParams || internalDoorParams;
  const setDoorParams = onDoorParamsChange || setInternalDoorParams;

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});


  // Material options for doors
  const materialOptions = [
    { value: 'wood', label: 'Wood', color: '#92400e', density: 600 },
    { value: 'steel', label: 'Steel', color: '#708090', density: 7850 },
    { value: 'glass', label: 'Glass', color: '#60a5fa', density: 2500 },
    { value: 'composite', label: 'Composite', color: '#8b7d6b', density: 1200 },
    { value: 'aluminum', label: 'Aluminum', color: '#9ca3af', density: 2700 },
    { value: 'pvc', label: 'PVC', color: '#f3f4f6', density: 1400 }
  ];

  // Opening direction options
  const openingDirections = [
    { value: 'right', label: 'Right', icon: <ArrowUturnRightIcon className="w-4 h-4" />, description: 'Opens to the right' },
    { value: 'left', label: 'Left', icon: <ArrowUturnLeftIcon className="w-4 h-4" />, description: 'Opens to the left' },
    { value: 'inward', label: 'Inward', icon: '⬇', description: 'Opens inward' },
    { value: 'outward', label: 'Outward', icon: '⬆', description: 'Opens outward' }
  ];

  // Initialize with existing door data if editing
  useEffect(() => {
    if (selectedObject && (selectedObject.type === 'Door' || selectedObject.type === 'door')) {
      setDoorParams({
        width: selectedObject.width || 0.9,
        height: selectedObject.height || 2.1,
        thickness: selectedObject.thickness || 0.05,
        openingDirection: selectedObject.openingDirection || 'right',
        material: selectedObject.material || 'wood',
        frameWidth: selectedObject.frameWidth || 0.05,
        offset: selectedObject.offset || 0.0
      });
    }
  }, [selectedObject]);

  // Update available walls for door placement - memoized to prevent infinite loops
  const availableWalls = useMemo(() => {
    if (!isActive) return [];
    return walls.length > 0 ? walls : cadObjects.filter(obj => obj.type === 'wall' || obj.type === 'Wall');
  }, [cadObjects, walls, isActive]);

  // Parameter validation
  const validateParameters = useCallback(() => {
    const errors = {};
    
    // Width validation
    if (doorParams.width <= 0 || doorParams.width > 5) {
      errors.width = 'Width must be between 0.1m and 5m';
    }
    
    // Height validation
    if (doorParams.height <= 0 || doorParams.height > 5) {
      errors.height = 'Height must be between 0.1m and 5m';
    }
    
    // Thickness validation
    if (doorParams.thickness <= 0 || doorParams.thickness > 0.2) {
      errors.thickness = 'Thickness must be between 0.01m and 0.2m';
    }
    
    // Frame width validation
    if (doorParams.frameWidth < 0 || doorParams.frameWidth > 0.2) {
      errors.frameWidth = 'Frame width must be between 0m and 0.2m';
    }

    // Wall insertion validation
    if (doorParams.insertionMode === 'insert_in_wall') {
      if (!doorParams.hostWallId) {
        errors.hostWallId = 'Please select a wall for door insertion';
      } else {
        // Check if door fits in the selected wall
        const selectedWall = availableWalls.find(w => w.id === doorParams.hostWallId);
        if (selectedWall && selectedWall.length && doorParams.width > selectedWall.length * 0.8) {
          errors.width = `Door too wide for selected wall (max: ${(selectedWall.length * 0.8).toFixed(1)}m)`;
        }
      }
    }

    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    setIsValid(isValid);
    
    return isValid;
  }, [doorParams, availableWalls]);

  // Validate when tool becomes active (controlled to prevent loops)
  useEffect(() => {
    if (isActive) {
      validateParameters();
    }
  }, [isActive]); // Only depend on isActive to prevent loops

  // Handle parameter changes
  const handleParameterChange = useCallback((param, value) => {
    setDoorParams(prev => ({
      ...prev,
      [param]: value
    }));
    // Validate after parameter change (use setTimeout to avoid immediate re-render issues)
    setTimeout(() => {
      const errors = {};
      const newParams = { ...doorParams, [param]: value };
      
      // Width validation
      if (newParams.width <= 0 || newParams.width > 5) {
        errors.width = 'Width must be between 0.1m and 5m';
      }
      
      // Height validation
      if (newParams.height <= 0 || newParams.height > 5) {
        errors.height = 'Height must be between 0.1m and 5m';
      }
      
      setValidationErrors(errors);
      setIsValid(Object.keys(errors).length === 0);
    }, 0);
  }, [doorParams]);

  // Handle door creation
  const handleCreate = useCallback(async () => {
    // Double-check validation before creating
    const isCurrentlyValid = validateParameters();
    if (!isCurrentlyValid) return;
    
    setIsCreating(true);
    
    try {
      // Prepare door creation parameters for standalone CAD engine
      const createParams = {
        width: doorParams.width,
        height: doorParams.height,
        thickness: doorParams.thickness,
        openingDirection: doorParams.openingDirection,
        frameWidth: doorParams.frameWidth,
        material: doorParams.material,
        offset: doorParams.offset,
        insertionMode: doorParams.insertionMode,
        hostWallId: doorParams.hostWallId,
        insertionPosition: doorParams.insertionPosition
      };
      
      let objectId;
      
      if (doorParams.insertionMode === 'insert_in_wall' && doorParams.hostWallId) {
        // Create door inserted in wall with undo/redo support
        console.log('🚪 Creating door inserted in wall:', doorParams.hostWallId);
        const command = await standaloneCADEngine.createDoorWithHistory({
          ...createParams,
          hostWallId: doorParams.hostWallId,
          insertionPosition: doorParams.insertionPosition
        });
        objectId = command.entityId;
      } else {
        // Create standalone door with undo/redo support
        console.log('🚪 Creating standalone door');
        const command = await standaloneCADEngine.createDoorWithHistory(createParams);
        objectId = command.entityId;
      }
      
      if (objectId) {
        console.log('🚪 Door created successfully:', objectId);
        
        // Notify parent component
        onObjectCreated?.({
          id: objectId,
          type: 'door',
          ...createParams
        });
        
        // Reset to default values after successful creation
        setDoorParams({
          width: 0.9,
          height: 2.1,
          thickness: 0.05,
          openingDirection: 'right',
          material: 'wood',
          frameWidth: 0.05,
          offset: 0.0,
          insertionMode: 'create_standalone',
          hostWallId: null,
          insertionPosition: 0.5
        });
      }
      
    } catch (error) {
      console.error('Door creation error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [validateParameters, doorParams, onObjectCreated]);

  // Handle door update (for editing existing doors)
  const handleUpdate = useCallback(async () => {
    if (!isValid || !selectedObject) return;
    
    setIsCreating(true);
    
    try {
      const updateParams = {
        width: doorParams.width,
        height: doorParams.height,
        thickness: doorParams.thickness,
        openingDirection: doorParams.openingDirection,
        frameWidth: doorParams.frameWidth,
        material: doorParams.material,
        offset: doorParams.offset
      };
      
      // Update object using standalone CAD engine
      const success = standaloneCADEngine.updateObject(selectedObject.id, updateParams);
      
      if (success) {
        console.log('🚪 Door updated successfully:', selectedObject.id);
        
        // Notify parent component
        onObjectUpdated?.({
          id: selectedObject.id,
          type: 'door',
          ...updateParams
        });
      }
      
    } catch (error) {
      console.error('Door update error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, doorParams, selectedObject, onObjectUpdated]);

  // Don't render if not active
  if (!isActive) return null;

  const isEditing = selectedObject && (selectedObject.type === 'Door' || selectedObject.type === 'door');
  const selectedMaterial = materialOptions.find(m => m.value === doorParams.material);
  const selectedDirection = openingDirections.find(d => d.value === doorParams.openingDirection);

  return (
    <div className="door-tool-panel w-full h-full">
      
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-studiosix-600' : 'bg-studiosix-500'
          }`}>
            <DoorIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {isEditing ? 'Edit Door' : 'Create Door'}
            </h3>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {isEditing ? 'Modify selected door properties' : 'Configure door parameters and create'}
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
          title="Close door tool"
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
                  doorParams.insertionMode === 'create_standalone'
                    ? theme === 'dark'
                      ? 'bg-studiosix-600 text-white'
                      : 'bg-studiosix-500 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Standalone Door
              </button>
              <button
                onClick={() => handleParameterChange('insertionMode', 'insert_in_wall')}
                disabled={availableWalls.length === 0}
                className={`flex-1 p-2 text-xs rounded transition-colors ${
                  doorParams.insertionMode === 'insert_in_wall'
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
            
            {doorParams.insertionMode === 'insert_in_wall' && availableWalls.length === 0 && (
              <p className={`text-xs ${
                theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
              }`}>
                No walls available. Create walls first to use this mode.
              </p>
            )}
          </div>
        </div>

        {/* Wall Selection (only when insert_in_wall mode) */}
        {doorParams.insertionMode === 'insert_in_wall' && availableWalls.length > 0 && (
          <div>
            <h4 className={`text-sm font-medium mb-3 flex items-center ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Wall Selection
            </h4>
            
            <div className="space-y-3">
              <select
                value={doorParams.hostWallId || ''}
                onChange={(e) => handleParameterChange('hostWallId', e.target.value || null)}
                className={`w-full px-2 py-2 text-sm rounded border transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
              >
                <option value="">Select wall for door insertion</option>
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
              {doorParams.hostWallId && (
                <div>
                  <label className={`block text-xs mb-2 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Position along wall: {(doorParams.insertionPosition * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={doorParams.insertionPosition}
                    onChange={(e) => handleParameterChange('insertionPosition', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs mt-1">
                    <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>Start</span>
                    <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>End</span>
                  </div>
                </div>
              )}
              
              {/* Wall info display */}
              {doorParams.hostWallId && (
                <div className={`p-2 rounded border ${
                  theme === 'dark' ? 'border-green-700/50 bg-green-800/20' : 'border-green-500/50 bg-green-50'
                }`}>
                  {(() => {
                    const selectedWall = availableWalls.find(w => w.id === doorParams.hostWallId);
                    if (!selectedWall) return null;
                    
                    return (
                      <div className={`text-xs space-y-1 ${
                        theme === 'dark' ? 'text-green-400' : 'text-green-700'
                      }`}>
                        <p>Selected wall: {selectedWall.length?.toFixed(1) || 'Unknown'}m long</p>
                        {selectedWall.length && (
                          <p>Door position: {(doorParams.insertionPosition * selectedWall.length).toFixed(1)}m from start</p>
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
        {doorParams.insertionMode === 'create_standalone' && availableWalls.length > 0 && (
          <div className={`p-2 rounded border ${
            theme === 'dark' ? 'border-blue-700/50 bg-blue-800/20' : 'border-blue-500/50 bg-blue-50'
          }`}>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
            }`}>
              Standalone mode: Door will be created independently (not inserted in wall)
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
                value={doorParams.width}
                onChange={(e) => handleParameterChange('width', parseFloat(e.target.value) || 0)}
                min="0.1"
                max="5"
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
                value={doorParams.height}
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
            
            {/* Thickness */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Thickness (m)
              </label>
              <input
                type="number"
                value={doorParams.thickness}
                onChange={(e) => handleParameterChange('thickness', parseFloat(e.target.value) || 0)}
                min="0.01"
                max="0.2"
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
            
            {/* Frame Width */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Frame (m)
              </label>
              <input
                type="number"
                value={doorParams.frameWidth}
                onChange={(e) => handleParameterChange('frameWidth', parseFloat(e.target.value) || 0)}
                min="0"
                max="0.2"
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
          </div>
        </div>

        {/* Opening Direction Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <AdjustmentsVerticalIcon className="w-4 h-4 mr-2" />
            Opening Direction
          </h4>
          
          <div className="grid grid-cols-2 gap-2">
            {openingDirections.map((direction) => (
              <button
                key={direction.value}
                onClick={() => handleParameterChange('openingDirection', direction.value)}
                className={`p-3 text-xs rounded transition-colors ${
                  doorParams.openingDirection === direction.value
                    ? theme === 'dark'
                      ? 'bg-studiosix-600 text-white'
                      : 'bg-studiosix-500 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={direction.description}
              >
                <div className="flex items-center justify-center mb-1">
                  {typeof direction.icon === 'string' ? direction.icon : direction.icon}
                </div>
                {direction.label}
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
            Material
          </h4>
          
          <div className="space-y-2">
            <select
              value={doorParams.material}
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
                  <span className="text-sm">Update Door</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span className="text-sm">Create Door</span>
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

export default DoorTool;