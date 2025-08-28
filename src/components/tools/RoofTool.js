import React, { useState, useEffect, useCallback } from 'react';
import { RoofIcon } from '../icons';
import localModelsService from '../../services/LocalModelsService';
import {
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  PhotoIcon,
  InformationCircleIcon,
  HomeIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

/**
 * Roof Tool Component - Provides interface for roof model selection and placement
 * Allows users to select from available roof models before placement
 */
const RoofTool = ({
  isActive = false,
  selectedObject = null,
  onCreateRoof,
  onUpdateRoof,
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

  // Load available roof models
  useEffect(() => {
    if (!isActive) return;
    
    const loadModels = async () => {
      try {
        setModelsLoading(true);
        console.log('🏠 ROOF TOOL: Loading roof models...');
        
        const models = await localModelsService.getAvailableModels('roofs');
        console.log('🏠 ROOF TOOL: Loaded models:', models);
        
        setAvailableModels(models);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(models.map(m => m.category))];
        setCategories(['all', ...uniqueCategories]);
        
        // Auto-select first model if available
        if (models.length > 0 && !selectedModel) {
          setSelectedModel(models[0]);
        }
        
      } catch (error) {
        console.error('❌ ROOF TOOL: Failed to load models:', error);
        setAvailableModels([]);
      } finally {
        setModelsLoading(false);
      }
    };

    loadModels();
  }, [isActive]);

  // Initialize selected model from existing object when editing
  useEffect(() => {
    if (selectedObject && selectedObject.type === 'roof' && availableModels.length > 0) {
      const modelId = selectedObject.selectedModel;
      if (modelId) {
        const model = availableModels.find(m => m.id === modelId);
        if (model) {
          setSelectedModel(model);
        }
      }
    }
  }, [selectedObject, availableModels]);

  // Handle model selection
  const handleModelSelect = useCallback((model) => {
    console.log('🏠 ROOF TOOL: Model selected:', model);
    setSelectedModel(model);
    setIsValid(true);
  }, []);

  // Handle create roof
  const handleCreate = useCallback(async () => {
    if (!selectedModel) {
      console.warn('⚠️ ROOF TOOL: No model selected');
      return;
    }

    try {
      setIsCreating(true);
      console.log('🏠 ROOF TOOL: Creating roof with model:', selectedModel);
      
      // Create roof parameters using the selected model
      const roofParams = localModelsService.createObjectParams(selectedModel);
      console.log('🏠 ROOF TOOL: Generated roof params:', roofParams);
      console.log('🏠 ROOF TOOL: Model URL:', roofParams.modelUrl);
      console.log('🏠 ROOF TOOL: Dimensions:', roofParams.dimensions);
      
      await onCreateRoof(roofParams);
      console.log('✅ ROOF TOOL: Roof created successfully');
      
    } catch (error) {
      console.error('❌ ROOF TOOL: Failed to create roof:', error);
    } finally {
      setIsCreating(false);
    }
  }, [selectedModel, onCreateRoof]);

  // Handle update roof
  const handleUpdate = useCallback(async () => {
    if (!selectedModel || !selectedObject) {
      return;
    }

    try {
      setIsCreating(true);
      console.log('🏠 ROOF TOOL: Updating roof with model:', selectedModel);
      
      const updatedParams = {
        ...selectedObject,
        selectedModel: selectedModel.id,
        modelUrl: selectedModel.localUrl,
        dimensions: selectedModel.dimensions,
        properties: selectedModel.properties
      };
      
      await onUpdateRoof(updatedParams);
      console.log('✅ ROOF TOOL: Roof updated successfully');
      
    } catch (error) {
      console.error('❌ ROOF TOOL: Failed to update roof:', error);
    } finally {
      setIsCreating(false);
    }
  }, [selectedModel, selectedObject, onUpdateRoof]);

  // Filter models by category
  const filteredModels = selectedCategory === 'all' 
    ? availableModels 
    : availableModels.filter(model => model.category === selectedCategory);

  // Determine if we're editing an existing roof
  const isEditing = selectedObject && selectedObject.type === 'roof';

  // Theme classes
  const themeClasses = theme === 'dark' ?
    'bg-gray-800 text-white border-gray-700' :
    'bg-white text-gray-900 border-gray-300';

  if (!isActive) return null;

  return (
    <div className={`roof-tool-panel w-full h-full ${themeClasses}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-600">
        <div className="flex items-center space-x-3">
          <RoofIcon className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold">
            {isEditing ? 'Edit Roof' : 'Place Roof'}
          </h3>
        </div>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-gray-700 rounded"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col h-full">
        {/* Category Filter */}
        <div className="p-4 border-b border-gray-600">
          <label className="block text-sm font-medium mb-2">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={`w-full px-3 py-2 rounded-md border ${themeClasses} focus:ring-2 focus:ring-blue-500`}
            disabled={modelsLoading}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Model Selection Grid */}
        <div className="flex-1 overflow-hidden">
          <div className="p-4">
            <h4 className="text-sm font-medium mb-3">
              Select Roof Model ({filteredModels.length} available)
            </h4>
          </div>
          
          <div className="h-80 overflow-y-auto px-4">
            {modelsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-400">Loading roof models...</div>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <HomeIcon className="w-8 h-8 mb-2" />
                <div>No roof models available</div>
                <div className="text-xs">Add .fbx files to public/models/roofs/</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredModels.map((model) => (
                  <div
                    key={model.id}
                    className={`relative border-2 rounded-lg cursor-pointer transition-all ${
                      selectedModel?.id === model.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => handleModelSelect(model)}
                  >
                    {/* Selection indicator */}
                    {selectedModel?.id === model.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <CheckIcon className="w-3 h-3 text-white" />
                      </div>
                    )}
                    
                    {/* Thumbnail */}
                    <div className="aspect-square bg-gray-700 rounded-t-lg flex items-center justify-center relative overflow-hidden">
                      {model.thumbnailUrl ? (
                        <img
                          src={model.thumbnailUrl}
                          alt={model.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="w-full h-full flex items-center justify-center" style={{display: model.thumbnailUrl ? 'none' : 'flex'}}>
                        <HomeIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    </div>
                    
                    {/* Model info */}
                    <div className="p-2">
                      <div className="text-xs font-medium truncate" title={model.name}>
                        {model.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {model.type} • {model.material}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Model Details */}
        {selectedModel && (
          <div className="border-t border-gray-600 p-4 bg-gray-800/50">
            <div className="flex items-start space-x-3">
              <InformationCircleIcon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h5 className="font-medium text-sm mb-2">Selected Model</h5>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">Name:</span>
                    <div className="font-medium">{selectedModel.name}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Material:</span>
                    <div className="font-medium">{selectedModel.material}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Type:</span>
                    <div className="font-medium">{selectedModel.type}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Pitch:</span>
                    <div className="font-medium">{selectedModel.dimensions?.pitch || 'N/A'}°</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t border-gray-600 p-4">
          <div className="flex space-x-3">
            <button
              onClick={isEditing ? handleUpdate : handleCreate}
              disabled={!selectedModel || isCreating}
              className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                !selectedModel || isCreating
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4 mr-2" />
                  {isEditing ? 'Update Roof' : 'Place Roof'}
                </>
              )}
            </button>
            
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-md font-medium text-sm bg-gray-600 hover:bg-gray-700 text-white transition-colors"
            >
              Cancel
            </button>
          </div>
          
          <div className="mt-3 text-xs text-gray-400 text-center">
            Select model above, click "Place Roof", then click in viewport to position.
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoofTool;