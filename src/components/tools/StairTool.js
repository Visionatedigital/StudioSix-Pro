import React, { useState, useEffect, useCallback } from 'react';
import { StairIcon } from '../icons';
import localModelsService from '../../services/LocalModelsService';
import {
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  PhotoIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

/**
 * Stair Tool Component - Provides interface for stair model selection and placement
 * Allows users to select from available staircase models before placement
 */
const StairTool = ({
  isActive = false,
  selectedObject = null,
  onCreateStair,
  onUpdateStair,
  onCancel,
  theme = 'dark'
}) => {
  // Model selection state
  const [selectedModel, setSelectedModel] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Load available staircase models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelsLoading(true);
        console.log('🏗️ STAIR TOOL: Loading staircase models...');
        
        const models = await localModelsService.getAvailableModels('staircases');
        console.log('🏗️ STAIR TOOL: Loaded models:', models);
        
        setAvailableModels(models);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(models.map(model => model.category))];
        setCategories(['all', ...uniqueCategories]);
        
        // Set default selection to first model
        if (models.length > 0) {
          setSelectedModel(models[0]);
          setIsValid(true);
        }
        
      } catch (error) {
        console.error('❌ STAIR TOOL: Failed to load models:', error);
        setIsValid(false);
      } finally {
        setModelsLoading(false);
      }
    };

    if (isActive) {
      loadModels();
    }
  }, [isActive]);

  // Initialize with existing stair data if editing
  useEffect(() => {
    if (selectedObject && selectedObject.type === 'stair' && selectedObject.selectedModel) {
      const model = availableModels.find(m => m.id === selectedObject.selectedModel);
      if (model) {
        setSelectedModel(model);
      }
    }
  }, [selectedObject, availableModels]);

  // Get filtered models based on selected category
  const filteredModels = selectedCategory === 'all' 
    ? availableModels 
    : availableModels.filter(model => model.category === selectedCategory);

  // Handle model selection
  const handleModelSelect = useCallback((model) => {
    console.log('🏗️ STAIR TOOL: Model selected:', model);
    setSelectedModel(model);
    setIsValid(true);
  }, []);

  // Handle create stair
  const handleCreate = useCallback(async () => {
    if (!selectedModel) {
      console.warn('⚠️ STAIR TOOL: No model selected');
      return;
    }

    try {
      setIsCreating(true);
      console.log('🏗️ STAIR TOOL: Creating stair with model:', selectedModel);
      
      // Create stair parameters using the selected model
      const stairParams = localModelsService.createObjectParams(selectedModel);
      console.log('🏗️ STAIR TOOL: Generated stair params:', stairParams);
      console.log('🏗️ STAIR TOOL: Model URL:', stairParams.modelUrl);
      console.log('🏗️ STAIR TOOL: Dimensions:', stairParams.dimensions);
      
      await onCreateStair(stairParams);
      console.log('✅ STAIR TOOL: Stair created successfully');
      
    } catch (error) {
      console.error('❌ STAIR TOOL: Failed to create stair:', error);
    } finally {
      setIsCreating(false);
    }
  }, [selectedModel, onCreateStair]);

  // Handle update stair
  const handleUpdate = useCallback(async () => {
    if (!selectedModel || !selectedObject) {
      return;
    }

    try {
      setIsCreating(true);
      console.log('🏗️ STAIR TOOL: Updating stair with model:', selectedModel);
      
      const updatedParams = {
        ...selectedObject,
        selectedModel: selectedModel.id,
        modelUrl: selectedModel.localUrl,
        dimensions: selectedModel.dimensions,
        properties: selectedModel.properties
      };
      
      await onUpdateStair(updatedParams);
      console.log('✅ STAIR TOOL: Stair updated successfully');
      
    } catch (error) {
      console.error('❌ STAIR TOOL: Failed to update stair:', error);
    } finally {
      setIsCreating(false);
    }
  }, [selectedModel, selectedObject, onUpdateStair]);

  // Determine if we're editing an existing stair
  const isEditing = selectedObject && selectedObject.type === 'stair';

  // Theme classes
  const themeClasses = theme === 'dark' ? {
    bg: 'bg-gray-900',
    bgSecondary: 'bg-gray-800',
    text: 'text-gray-100',
    textSecondary: 'text-gray-300',
    border: 'border-gray-700',
    hover: 'hover:bg-gray-700'
  } : {
    bg: 'bg-white',
    bgSecondary: 'bg-gray-50',
    text: 'text-gray-900',
    textSecondary: 'text-gray-600',
    border: 'border-gray-200',
    hover: 'hover:bg-gray-100'
  };

  if (!isActive) return null;

  return (
    <div className={`stair-tool p-4 ${themeClasses.bg} ${themeClasses.text} rounded-lg shadow-lg`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <StairIcon className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold">
            {isEditing ? 'Edit Staircase' : 'Place Staircase'}
            </h3>
        </div>
        <button
          onClick={onCancel}
          className={`p-1 rounded-md ${themeClasses.hover} transition-colors`}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {modelsLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3">Loading staircase models...</span>
          </div>
      ) : (
        <>
          {/* Category Filter */}
          {categories.length > 1 && (
            <div className="mb-4">
              <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`w-full px-3 py-2 ${themeClasses.bgSecondary} ${themeClasses.border} rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

                    {/* Model Selection Grid */}
          <div className="mb-3">
            <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-2`}>
              Select Staircase Model ({filteredModels.length} available)
              </label>
            
            {filteredModels.length === 0 ? (
              <div className={`text-center py-6 ${themeClasses.textSecondary}`}>
                <PhotoIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No staircase models found</p>
                <p className="text-sm mt-1">Add .fbx models to public/models/staircases/</p>
            </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {filteredModels.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => handleModelSelect(model)}
                    className={`
                      relative cursor-pointer rounded-lg border-2 transition-all duration-200
                      ${selectedModel?.id === model.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : `${themeClasses.border} ${themeClasses.hover}`
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
                        <StairIcon className="w-6 h-6 text-gray-500" />
          </div>
        </div>

                    {/* Model Info - Compact */}
                    <div className="p-2">
                      <h4 className={`font-medium text-xs ${themeClasses.text} truncate`}>
                        {model.name}
          </h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs ${themeClasses.textSecondary}`}>
                          {model.material}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${themeClasses.bgSecondary}`}>
                          {model.category}
                        </span>
          </div>
        </div>

                    {/* Selection indicator */}
                    {selectedModel?.id === model.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <CheckIcon className="w-4 h-4 text-white" />
                      </div>
                    )}
                </div>
            ))}
          </div>
            )}
          </div>
          
                    {/* Selected Model Details - Compact */}
          {selectedModel && (
            <div className={`mb-3 p-2 ${themeClasses.bgSecondary} rounded-lg`}>
              <div className="flex items-center space-x-2 mb-1">
                <InformationCircleIcon className="w-3 h-3 text-blue-500" />
                <h4 className="font-medium text-sm">Selected Model</h4>
            </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
        <div>
                  <span className={themeClasses.textSecondary}>Name:</span>
                  <p className={themeClasses.text}>{selectedModel.name}</p>
                </div>
                <div>
                  <span className={themeClasses.textSecondary}>Material:</span>
                  <p className={themeClasses.text}>{selectedModel.material}</p>
                </div>
                {selectedModel.dimensions && (
                  <>
                    <div>
                      <span className={themeClasses.textSecondary}>Width:</span>
                      <p className={themeClasses.text}>{selectedModel.dimensions.width}m</p>
                    </div>
                    <div>
                      <span className={themeClasses.textSecondary}>Height:</span>
                      <p className={themeClasses.text}>{selectedModel.dimensions.totalRise}m</p>
                    </div>
                  </>
                )}
                </div>
              </div>
            )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
        <button
          onClick={isEditing ? handleUpdate : handleCreate}
              disabled={!isValid || !selectedModel || isCreating}
              className={`
                flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200
                ${isValid && selectedModel && !isCreating
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }
              `}
        >
          {isCreating ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{isEditing ? 'Updating...' : 'Creating...'}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <PlayIcon className="w-4 h-4" />
                  <span>{isEditing ? 'Update Stair' : 'Place Stair'}</span>
                </div>
          )}
        </button>
        
        <button
          onClick={onCancel}
              className={`px-4 py-2 ${themeClasses.bgSecondary} ${themeClasses.border} rounded-md transition-colors ${themeClasses.hover}`}
            >
              Cancel
        </button>
      </div>

          {/* Instructions - Compact */}
          <div className={`mt-2 p-2 ${themeClasses.bgSecondary} rounded`}>
            <p className={`text-xs ${themeClasses.textSecondary}`}>
              {isEditing 
                ? 'Select a different model to change the staircase design.'
                : 'Select model above, click "Place Stair", then click in viewport to position.'
              }
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default StairTool;