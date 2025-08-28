import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DoorIcon } from '../icons';
import standaloneCADEngine from '../../services/StandaloneCADEngine';
import localModelsService from '../../services/LocalModelsService';
import {
  SwatchIcon,
  RectangleStackIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  PhotoIcon,
  InformationCircleIcon
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
    frameWidth: 0.05,
    selectedModel: null // Selected 3D model
  });

  // Local models state
  const [availableModels, setAvailableModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  // Use external params if provided, otherwise use internal state
  const doorParams = externalDoorParams || internalDoorParams;
  const setDoorParams = onDoorParamsChange || setInternalDoorParams;

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Load available door models on component mount
  useEffect(() => {
    const loadDoorModels = async () => {
      setModelsLoading(true);
      try {
        const models = await localModelsService.getAvailableModels('doors');
        setAvailableModels(models);
        
        // Set Door1.fbx as default model if available, otherwise use first model
        if (models.length > 0 && !doorParams.selectedModel) {
          let defaultModel = models.find(model => 
            model.name === 'Door1' || model.id === 'Door1' || 
            model.name.toLowerCase().includes('door1') ||
            model.localUrl?.includes('Door1.fbx')
          );
          
          // Fallback to first model if Door1 not found
          if (!defaultModel) {
            defaultModel = models[0];
          }
          
          setDoorParams(prev => ({
            ...prev,
            selectedModel: defaultModel,
            width: defaultModel.dimensions.width,
            height: defaultModel.dimensions.height,
            thickness: defaultModel.dimensions.depth
          }));
          
          console.log('🚪 Set default door model:', defaultModel.name);
        }
        
        console.log('🚪 Loaded', models.length, 'local door models');
      } catch (error) {
        console.error('❌ Failed to load door models:', error);
      } finally {
        setModelsLoading(false);
      }
    };

    loadDoorModels();
  }, []);



  // Initialize with existing door data if editing
  useEffect(() => {
    if (selectedObject && (selectedObject.type === 'Door' || selectedObject.type === 'door')) {
      setDoorParams({
        width: selectedObject.width || 0.9,
        height: selectedObject.height || 2.1,
        thickness: selectedObject.thickness || 0.05,
        frameWidth: selectedObject.frameWidth || 0.05,
        selectedModel: selectedObject.selectedModel || null
      });
    }
  }, [selectedObject]);


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


    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    setIsValid(isValid);
    
    return isValid;
  }, [doorParams]);

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
        frameWidth: doorParams.frameWidth,
        // Add local model information
        modelUrl: doorParams.selectedModel?.localUrl,
        modelId: doorParams.selectedModel?.id,
        modelName: doorParams.selectedModel?.name,
        format: ['fbx'],
        isLocal: true,
        localModel: true
      };
      
      // Create standalone door with undo/redo support
      console.log('🚪 Creating standalone door');
      const command = await standaloneCADEngine.createDoorWithHistory(createParams);
      const objectId = command.entityId;
      
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
          frameWidth: 0.05,
          selectedModel: null
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
        frameWidth: doorParams.frameWidth,
        selectedModel: doorParams.selectedModel
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
        

        {/* Model Selection Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <SwatchIcon className="w-4 h-4 mr-2" />
            3D Model ({availableModels.length} available)
          </h4>
          
          {modelsLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-studiosix-600 border-t-transparent"></div>
              <span className={`ml-3 text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>Loading door models...</span>
            </div>
          ) : availableModels.length > 0 ? (
            <div className="space-y-3">
              {/* Model Selection Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {availableModels.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => {
                      handleParameterChange('selectedModel', model);
                      // Update dimensions to match model
                      handleParameterChange('width', model.dimensions.width);
                      handleParameterChange('height', model.dimensions.height);
                      handleParameterChange('thickness', model.dimensions.depth);
                    }}
                    className={`
                      relative cursor-pointer rounded-lg border-2 transition-all duration-200
                      ${doorParams.selectedModel?.id === model.id
                        ? 'border-studiosix-500 bg-studiosix-500/10'
                        : theme === 'dark'
                          ? 'border-gray-600 hover:border-gray-500 bg-slate-800/50'
                          : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                      }
                    `}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square rounded-t-lg bg-gray-200 overflow-hidden relative">
                      <img
                        src={model.thumbnailUrl}
                        alt={model.name}
                        className="w-full h-full object-cover"
                        onLoad={(e) => {
                          // Hide fallback when image loads successfully
                          const fallback = e.target.nextElementSibling;
                          if (fallback) fallback.style.display = 'none';
                        }}
                        onError={(e) => {
                          // Hide image and show fallback when image fails to load
                          e.target.style.display = 'none';
                          const fallback = e.target.nextElementSibling;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-300">
                        <DoorIcon className="w-6 h-6 text-gray-500" />
                      </div>
                    </div>

                    {/* Model Info */}
                    <div className="p-2">
                      <h4 className={`font-medium text-xs truncate ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {model.name}
                      </h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {model.material || 'Wood'}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100'
                        }`}>
                          {model.category}
                        </span>
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {doorParams.selectedModel?.id === model.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-studiosix-500 rounded-full flex items-center justify-center">
                        <CheckIcon className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Selected Model Details */}
              {doorParams.selectedModel && (
                <div className={`p-2 rounded-lg ${
                  theme === 'dark' 
                    ? 'bg-slate-800/50 border border-gray-600' 
                    : 'bg-gray-50 border border-gray-300'
                }`}>
                  <div className="flex items-center space-x-2 mb-1">
                    <InformationCircleIcon className="w-3 h-3 text-studiosix-500" />
                    <h4 className={`font-medium text-sm ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Selected Model</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div>
                      <span className={`${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>Name:</span>
                      <p className={`${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{doorParams.selectedModel.name}</p>
                    </div>
                    <div>
                      <span className={`${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>Category:</span>
                      <p className={`${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{doorParams.selectedModel.category}</p>
                    </div>
                    {doorParams.selectedModel.dimensions && (
                      <>
                        <div>
                          <span className={`${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}>Width:</span>
                          <p className={`${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>{doorParams.selectedModel.dimensions.width}m</p>
                        </div>
                        <div>
                          <span className={`${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}>Height:</span>
                          <p className={`${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>{doorParams.selectedModel.dimensions.height}m</p>
                        </div>
                      </>
                    )}
                    {doorParams.selectedModel.description && (
                      <div className="col-span-2 mt-1">
                        <span className={`${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>Description:</span>
                        <p className={`text-xs ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>{doorParams.selectedModel.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`p-3 rounded border text-center text-sm ${
              theme === 'dark' 
                ? 'bg-red-900/20 border-red-700/50 text-red-400' 
                : 'bg-red-50 border-red-300 text-red-600'
            }`}>
              <PhotoIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No door models found</p>
              <p className="text-xs mt-1">Add .fbx files to public/models/doors/</p>
            </div>
          )}
        </div>

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