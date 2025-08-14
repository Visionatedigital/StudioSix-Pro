import React, { useState, useEffect, useCallback } from 'react';
import { 
  LinkIcon, 
  ArrowsRightLeftIcon,
  ArrowsUpDownIcon,
  MagnifyingGlassIcon,
  AdjustmentsVerticalIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

/**
 * Constraint Tool Component - Provides interface for geometric constraint definition and editing
 * Allows users to create, modify, and manage geometric constraints between entities
 */
const ConstraintTool = ({
  isActive = false,
  selectedEntities = [],
  activeConstraints = [],
  onCreateConstraint,
  onUpdateConstraint,
  onDeleteConstraint,
  onCancel,
  theme = 'dark'
}) => {
  // Constraint parameters state
  const [constraintParams, setConstraintParams] = useState({
    type: 'distance',
    value: 0.0,
    priority: 'normal',
    tolerance: 0.001,
    enabled: true,
    entities: [], // IDs of selected entities
    label: ''
  });

  // UI state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [selectedConstraintId, setSelectedConstraintId] = useState(null);
  const [showConstraints, setShowConstraints] = useState(true);
  const [selectionMode, setSelectionMode] = useState('entities'); // 'entities' or 'constraints'

  // Constraint type definitions
  const constraintTypes = [
    { 
      value: 'distance', 
      label: 'Distance', 
      icon: ArrowsRightLeftIcon,
      description: 'Fixed distance between two entities',
      requiresValue: true,
      minEntities: 2,
      maxEntities: 2
    },
    { 
      value: 'parallel', 
      label: 'Parallel', 
      icon: ArrowsUpDownIcon,
      description: 'Force two lines to be parallel',
      requiresValue: false,
      minEntities: 2,
      maxEntities: 2
    },
    { 
      value: 'perpendicular', 
      label: 'Perpendicular', 
      icon: LinkIcon,
      description: 'Force two lines to be perpendicular',
      requiresValue: false,
      minEntities: 2,
      maxEntities: 2
    },
    { 
      value: 'coincident', 
      label: 'Coincident', 
      icon: MagnifyingGlassIcon,
      description: 'Force two points to occupy same position',
      requiresValue: false,
      minEntities: 2,
      maxEntities: 2
    },
    { 
      value: 'fixed', 
      label: 'Fixed Point', 
      icon: CheckIcon,
      description: 'Anchor a point to specific coordinates',
      requiresValue: false,
      minEntities: 1,
      maxEntities: 1
    },
    { 
      value: 'angle', 
      label: 'Angle', 
      icon: AdjustmentsVerticalIcon,
      description: 'Fixed angle between two lines',
      requiresValue: true,
      minEntities: 2,
      maxEntities: 2
    }
  ];

  // Priority options
  const priorityOptions = [
    { value: 'critical', label: 'Critical', color: '#ef4444' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'normal', label: 'Normal', color: '#10b981' },
    { value: 'low', label: 'Low', color: '#6b7280' },
    { value: 'suggestion', label: 'Suggestion', color: '#8b5cf6' }
  ];

  // Update constraint params when entities change
  useEffect(() => {
    setConstraintParams(prev => ({
      ...prev,
      entities: selectedEntities.map(entity => entity.id)
    }));
  }, [selectedEntities]);

  // Validate constraint parameters
  useEffect(() => {
    const errors = {};
    const selectedType = constraintTypes.find(t => t.value === constraintParams.type);
    
    if (!selectedType) {
      errors.type = 'Invalid constraint type';
    } else {
      // Check entity count requirements
      if (constraintParams.entities.length < selectedType.minEntities) {
        errors.entities = `Requires at least ${selectedType.minEntities} entities`;
      } else if (constraintParams.entities.length > selectedType.maxEntities) {
        errors.entities = `Requires at most ${selectedType.maxEntities} entities`;
      }
      
      // Check if value is required
      if (selectedType.requiresValue && (constraintParams.value === null || constraintParams.value === '')) {
        errors.value = 'Value is required for this constraint type';
      }
    }

    setValidationErrors(errors);
    setIsValid(Object.keys(errors).length === 0);
  }, [constraintParams, constraintTypes]);

  // Handle constraint creation
  const handleCreateConstraint = useCallback(async () => {
    if (!isValid) return;

    setIsCreating(true);
    try {
      const constraintData = {
        ...constraintParams,
        id: `constraint_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      
      await onCreateConstraint(constraintData);
      
      // Reset form
      setConstraintParams({
        type: 'distance',
        value: 0.0,
        priority: 'normal',
        tolerance: 0.001,
        enabled: true,
        entities: [],
        label: ''
      });
    } catch (error) {
      console.error('Failed to create constraint:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, constraintParams, onCreateConstraint]);

  // Handle constraint parameter changes
  const handleParamChange = useCallback((key, value) => {
    setConstraintParams(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Handle constraint selection for editing
  const handleConstraintSelect = useCallback((constraintId) => {
    const constraint = activeConstraints.find(c => c.id === constraintId);
    if (constraint) {
      setConstraintParams({...constraint});
      setSelectedConstraintId(constraintId);
    }
  }, [activeConstraints]);

  // Handle constraint deletion
  const handleDeleteConstraint = useCallback(async (constraintId) => {
    try {
      await onDeleteConstraint(constraintId);
      if (selectedConstraintId === constraintId) {
        setSelectedConstraintId(null);
      }
    } catch (error) {
      console.error('Failed to delete constraint:', error);
    }
  }, [onDeleteConstraint, selectedConstraintId]);

  // Get current constraint type info
  const currentConstraintType = constraintTypes.find(t => t.value === constraintParams.type);

  if (!isActive) return null;

  return (
    <div className={`fixed right-4 top-20 w-80 rounded-lg shadow-lg z-40 ${
      theme === 'dark' 
        ? 'bg-gray-800 border border-gray-700 text-white' 
        : 'bg-white border border-gray-300 text-gray-900'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-3 border-b ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="flex items-center space-x-2">
          <LinkIcon className="w-5 h-5" />
          <span className="font-semibold">Geometric Constraints</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowConstraints(!showConstraints)}
            className={`p-1.5 rounded-md hover:bg-opacity-80 ${
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            title={showConstraints ? 'Hide constraints' : 'Show constraints'}
          >
            {showConstraints ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={onCancel}
            className={`p-1.5 rounded-md hover:bg-opacity-80 ${
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex rounded-lg bg-gray-700 p-1">
          <button
            onClick={() => setSelectionMode('entities')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              selectionMode === 'entities'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Constraint
          </button>
          <button
            onClick={() => setSelectionMode('constraints')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              selectionMode === 'constraints'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Manage ({activeConstraints.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-4 max-h-96 overflow-y-auto">
        {selectionMode === 'entities' ? (
          <>
            {/* Constraint Type Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">Constraint Type</label>
              <div className="grid grid-cols-2 gap-2">
                {constraintTypes.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <button
                      key={type.value}
                      onClick={() => handleParamChange('type', type.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        constraintParams.type === type.value
                          ? 'border-blue-500 bg-blue-500 bg-opacity-20'
                          : theme === 'dark'
                            ? 'border-gray-600 hover:border-gray-500'
                            : 'border-gray-300 hover:border-gray-400'
                      }`}
                      title={type.description}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <IconComponent className="w-4 h-4" />
                        <span className="text-sm font-medium">{type.label}</span>
                      </div>
                      <p className="text-xs opacity-70">{type.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Entities */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Selected Entities ({constraintParams.entities.length})
              </label>
              <div className={`p-3 rounded-lg border ${
                validationErrors.entities
                  ? 'border-red-500 bg-red-500 bg-opacity-10'
                  : theme === 'dark'
                    ? 'border-gray-600 bg-gray-700'
                    : 'border-gray-300 bg-gray-50'
              }`}>
                {constraintParams.entities.length > 0 ? (
                  <div className="space-y-1">
                    {selectedEntities.map((entity, index) => (
                      <div key={entity.id} className="flex items-center justify-between">
                        <span className="text-sm">{entity.type} #{entity.id}</span>
                        <button
                          onClick={() => {
                            const newEntities = constraintParams.entities.filter(id => id !== entity.id);
                            handleParamChange('entities', newEntities);
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm opacity-70">
                    {currentConstraintType ? 
                      `Select ${currentConstraintType.minEntities} or more entities in the viewport`
                      : 'Select entities in the viewport'
                    }
                  </p>
                )}
                {validationErrors.entities && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.entities}</p>
                )}
              </div>
            </div>

            {/* Constraint Value (if required) */}
            {currentConstraintType?.requiresValue && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  {constraintParams.type === 'distance' ? 'Distance' : 
                   constraintParams.type === 'angle' ? 'Angle (degrees)' : 'Value'}
                </label>
                <input
                  type="number"
                  value={constraintParams.value}
                  onChange={(e) => handleParamChange('value', parseFloat(e.target.value) || 0)}
                  step={constraintParams.type === 'angle' ? 1 : 0.1}
                  className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.value
                      ? 'border-red-500 bg-red-500 bg-opacity-10'
                      : theme === 'dark'
                        ? 'border-gray-600 bg-gray-700 text-white'
                        : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  placeholder={`Enter ${constraintParams.type === 'distance' ? 'distance in meters' : 
                                      constraintParams.type === 'angle' ? 'angle in degrees' : 'value'}`}
                />
                {validationErrors.value && (
                  <p className="text-red-400 text-xs mt-1">{validationErrors.value}</p>
                )}
              </div>
            )}

            {/* Priority Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">Priority</label>
              <select
                value={constraintParams.priority}
                onChange={(e) => handleParamChange('priority', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === 'dark'
                    ? 'border-gray-600 bg-gray-700 text-white'
                    : 'border-gray-300 bg-white text-gray-900'
                }`}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Constraint Label */}
            <div>
              <label className="block text-sm font-medium mb-2">Label (Optional)</label>
              <input
                type="text"
                value={constraintParams.label}
                onChange={(e) => handleParamChange('label', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === 'dark'
                    ? 'border-gray-600 bg-gray-700 text-white'
                    : 'border-gray-300 bg-white text-gray-900'
                }`}
                placeholder="Optional constraint label"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleCreateConstraint}
                disabled={!isValid || isCreating}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isValid && !isCreating
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isCreating ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <CheckIcon className="w-4 h-4" />
                    <span>Create Constraint</span>
                  </div>
                )}
              </button>
            </div>
          </>
        ) : (
          /* Constraint Management View */
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Active Constraints</h3>
              <span className="text-xs opacity-70">{activeConstraints.length} total</span>
            </div>
            
            {activeConstraints.length > 0 ? (
              <div className="space-y-2">
                {activeConstraints.map((constraint) => {
                  const type = constraintTypes.find(t => t.value === constraint.type);
                  const priority = priorityOptions.find(p => p.value === constraint.priority);
                  const IconComponent = type?.icon || LinkIcon;
                  
                  return (
                    <div
                      key={constraint.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedConstraintId === constraint.id
                          ? 'border-blue-500 bg-blue-500 bg-opacity-20'
                          : theme === 'dark'
                            ? 'border-gray-600 hover:border-gray-500 bg-gray-700'
                            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                      }`}
                      onClick={() => handleConstraintSelect(constraint.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <IconComponent className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {constraint.label || type?.label || constraint.type}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: priority?.color }}
                            title={priority?.label}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConstraint(constraint.id);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-xs opacity-70 space-y-1">
                        <div>Entities: {constraint.entities.join(', ')}</div>
                        {type?.requiresValue && (
                          <div>
                            Value: {constraint.value} {constraint.type === 'angle' ? '°' : 'm'}
                          </div>
                        )}
                        <div>Status: {constraint.satisfied ? 'Satisfied' : 'Violated'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`p-4 rounded-lg border border-dashed text-center ${
                theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
              }`}>
                <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm opacity-70">No constraints defined</p>
                <p className="text-xs opacity-50">Switch to "Create Constraint" to add constraints</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstraintTool; 