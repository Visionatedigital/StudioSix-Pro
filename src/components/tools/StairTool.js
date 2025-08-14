import React, { useState, useEffect, useCallback } from 'react';
import { StairIcon } from '../icons';
import {
  SwatchIcon,
  RectangleStackIcon,
  AdjustmentsVerticalIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  ArrowTrendingUpIcon,
  ArrowUturnRightIcon,
  ArrowUturnLeftIcon,
  CalculatorIcon
} from '@heroicons/react/24/outline';

/**
 * Stair Tool Component - Provides interface for stair creation and editing
 * Allows users to specify stair parameters, type, and materials before placement
 */
const StairTool = ({
  isActive = false,
  selectedObject = null,
  onCreateStair,
  onUpdateStair,
  onCancel,
  theme = 'dark',
  freecadObjects = [] // For level detection and connection
}) => {
  // Stair parameters state
  const [stairParams, setStairParams] = useState({
    stairType: 'straight', // 'straight', 'L-shaped', 'U-shaped', 'spiral', 'curved'
    totalRise: 3.0, // Total height to climb
    totalRun: 4.0, // Total horizontal distance
    numberOfSteps: 16, // Number of steps
    stepWidth: 1.2, // Width of stairs
    treadDepth: 0.25, // Depth of each tread (horizontal part)
    riserHeight: 0.18, // Height of each riser (vertical part)
    material: 'concrete',
    handrailHeight: 1.0,
    hasHandrail: true,
    landingDepth: 0.8, // Depth of landings
    thickness: 0.15 // Stair slab thickness
  });

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [availableLevels, setAvailableLevels] = useState([]);
  const [calculatedParams, setCalculatedParams] = useState({});

  // Material options for stairs
  const materialOptions = [
    { value: 'concrete', label: 'Concrete', color: '#9ca3af', weight: 2400, cost: 80 },
    { value: 'steel', label: 'Steel Frame', color: '#374151', weight: 7850, cost: 150 },
    { value: 'wood', label: 'Wood', color: '#92400e', weight: 600, cost: 120 },
    { value: 'stone', label: 'Natural Stone', color: '#1f2937', weight: 2700, cost: 200 },
    { value: 'tile', label: 'Tile on Concrete', color: '#6b7280', weight: 2500, cost: 100 },
    { value: 'metal', label: 'Metal Grating', color: '#4b5563', weight: 3000, cost: 180 }
  ];

  // Stair type options
  const stairTypes = [
    { 
      value: 'straight', 
      label: 'Straight', 
      icon: <ArrowTrendingUpIcon className="w-4 h-4" />, 
      description: 'Single straight flight' 
    },
    { 
      value: 'L-shaped', 
      label: 'L-Shaped', 
      icon: <ArrowUturnRightIcon className="w-4 h-4" />, 
      description: '90° turn with landing' 
    },
    { 
      value: 'U-shaped', 
      label: 'U-Shaped', 
      icon: <ArrowUturnLeftIcon className="w-4 h-4" />, 
      description: '180° turn with landing' 
    },
    { 
      value: 'spiral', 
      label: 'Spiral', 
      icon: '◯', 
      description: 'Circular spiral stairs' 
    },
    { 
      value: 'curved', 
      label: 'Curved', 
      icon: '〜', 
      description: 'Curved flight' 
    }
  ];

  // Initialize with existing stair data if editing
  useEffect(() => {
    if (selectedObject && selectedObject.type === 'Stair') {
      setStairParams({
        stairType: selectedObject.stairType || 'straight',
        totalRise: selectedObject.totalRise || 3.0,
        totalRun: selectedObject.totalRun || 4.0,
        numberOfSteps: selectedObject.numberOfSteps || 16,
        stepWidth: selectedObject.stepWidth || 1.2,
        treadDepth: selectedObject.treadDepth || 0.25,
        riserHeight: selectedObject.riserHeight || 0.18,
        material: selectedObject.material || 'concrete',
        handrailHeight: selectedObject.handrailHeight || 1.0,
        hasHandrail: selectedObject.hasHandrail !== undefined ? selectedObject.hasHandrail : true,
        landingDepth: selectedObject.landingDepth || 0.8,
        thickness: selectedObject.thickness || 0.15
      });
    }
  }, [selectedObject]);

  // Detect available levels for stair placement
  useEffect(() => {
    if (!isActive || !freecadObjects) return;

    const levels = freecadObjects.filter(obj => 
      obj.type === 'Level' || 
      obj.type === 'Floor' || 
      obj.type === 'Slab' ||
      obj.name?.toLowerCase().includes('level') ||
      obj.name?.toLowerCase().includes('floor')
    );
    setAvailableLevels(levels);
  }, [freecadObjects, isActive]);

  // Calculate stair parameters automatically
  const calculateStairParameters = useCallback(() => {
    // Building code compliance checks
    const idealRiserHeight = stairParams.totalRise / stairParams.numberOfSteps;
    const idealTreadDepth = stairParams.totalRun / stairParams.numberOfSteps;
    
    // Stair design rules (typical building codes)
    const minTreadDepth = 0.25; // 250mm minimum
    const maxRiserHeight = 0.19; // 190mm maximum
    const minRiserHeight = 0.15; // 150mm minimum
    const idealRatio = idealRiserHeight + idealTreadDepth; // Should be 0.60-0.65m
    
    // Calculate actual dimensions
    const actualRiserHeight = Math.max(minRiserHeight, Math.min(maxRiserHeight, idealRiserHeight));
    const actualNumberOfSteps = Math.ceil(stairParams.totalRise / actualRiserHeight);
    const actualTreadDepth = Math.max(minTreadDepth, idealTreadDepth);
    const actualTotalRun = actualTreadDepth * actualNumberOfSteps;
    
    // Calculate volume and weight
    const volume = stairParams.stepWidth * actualTotalRun * stairParams.totalRise * 0.5; // Triangular approximation
    const material = materialOptions.find(m => m.value === stairParams.material);
    const weight = volume * (material?.weight || 2400);
    
    // Compliance check
    const isCodeCompliant = (
      actualRiserHeight >= minRiserHeight &&
      actualRiserHeight <= maxRiserHeight &&
      actualTreadDepth >= minTreadDepth &&
      idealRatio >= 0.60 && idealRatio <= 0.65
    );
    
    return {
      actualRiserHeight: actualRiserHeight.toFixed(3),
      actualTreadDepth: actualTreadDepth.toFixed(3),
      actualNumberOfSteps: actualNumberOfSteps,
      actualTotalRun: actualTotalRun.toFixed(2),
      volume: volume.toFixed(2),
      weight: weight.toFixed(0),
      isCodeCompliant,
      ratio: idealRatio.toFixed(3)
    };
  }, [stairParams, materialOptions]);

  // Update calculated parameters when stair params change
  useEffect(() => {
    const calculated = calculateStairParameters();
    setCalculatedParams(calculated);
  }, [calculateStairParameters]);

  // Parameter validation
  const validateParameters = useCallback(() => {
    const errors = {};
    
    // Total rise validation
    if (stairParams.totalRise <= 0 || stairParams.totalRise > 10) {
      errors.totalRise = 'Total rise must be between 0.1m and 10m';
    }
    
    // Total run validation
    if (stairParams.totalRun <= 0 || stairParams.totalRun > 20) {
      errors.totalRun = 'Total run must be between 0.1m and 20m';
    }
    
    // Number of steps validation
    if (stairParams.numberOfSteps < 2 || stairParams.numberOfSteps > 50) {
      errors.numberOfSteps = 'Number of steps must be between 2 and 50';
    }
    
    // Step width validation
    if (stairParams.stepWidth <= 0 || stairParams.stepWidth > 5) {
      errors.stepWidth = 'Step width must be between 0.1m and 5m';
    }
    
    // Tread depth validation
    if (stairParams.treadDepth < 0.2 || stairParams.treadDepth > 0.4) {
      errors.treadDepth = 'Tread depth must be between 0.2m and 0.4m';
    }
    
    // Riser height validation
    if (stairParams.riserHeight < 0.1 || stairParams.riserHeight > 0.22) {
      errors.riserHeight = 'Riser height must be between 0.1m and 0.22m';
    }
    
    // Handrail height validation
    if (stairParams.handrailHeight < 0.8 || stairParams.handrailHeight > 1.2) {
      errors.handrailHeight = 'Handrail height must be between 0.8m and 1.2m';
    }

    // Building code compliance warning
    if (!calculatedParams.isCodeCompliant) {
      errors.compliance = 'Stair dimensions may not comply with building codes';
    }

    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0 || 
                   (Object.keys(errors).length === 1 && errors.compliance); // Allow non-compliance but warn
    setIsValid(isValid);
    
    return isValid;
  }, [stairParams, calculatedParams]);

  // Run validation when parameters change
  useEffect(() => {
    validateParameters();
  }, [validateParameters]);

  // Handle parameter changes
  const handleParameterChange = useCallback((param, value) => {
    setStairParams(prev => ({
      ...prev,
      [param]: value
    }));
  }, []);

  // Auto-calculate dimensions based on building codes
  const handleAutoCalculate = useCallback(() => {
    const idealRiserHeight = 0.175; // 175mm - comfortable rise
    const idealTreadDepth = 0.275;  // 275mm - comfortable tread
    
    const calculatedSteps = Math.round(stairParams.totalRise / idealRiserHeight);
    const calculatedRun = calculatedSteps * idealTreadDepth;
    
    setStairParams(prev => ({
      ...prev,
      numberOfSteps: calculatedSteps,
      riserHeight: stairParams.totalRise / calculatedSteps,
      treadDepth: idealTreadDepth,
      totalRun: calculatedRun
    }));
  }, [stairParams.totalRise]);

  // Handle stair creation
  const handleCreate = useCallback(async () => {
    if (!isValid) return;
    
    setIsCreating(true);
    
    try {
      // Get material properties
      const material = materialOptions.find(m => m.value === stairParams.material);
      const calculated = calculateStairParameters();
      
      // Prepare stair creation parameters for FreeCAD
      const createParams = {
        // Basic dimensions
        totalRise: stairParams.totalRise,
        totalRun: parseFloat(calculated.actualTotalRun),
        numberOfSteps: calculated.actualNumberOfSteps,
        stepWidth: stairParams.stepWidth,
        thickness: stairParams.thickness,
        
        // Step geometry
        treadDepth: parseFloat(calculated.actualTreadDepth),
        riserHeight: parseFloat(calculated.actualRiserHeight),
        
        // Stair-specific properties
        stairType: stairParams.stairType,
        landingDepth: stairParams.landingDepth,
        
        // Handrail properties
        hasHandrail: stairParams.hasHandrail,
        handrailHeight: stairParams.handrailHeight,
        
        // Material properties
        material: stairParams.material,
        materialColor: material?.color || '#9ca3af',
        materialWeight: material?.weight || 2400,
        cost: material?.cost || 100,
        
        // Calculated properties
        volume: parseFloat(calculated.volume),
        totalWeight: parseFloat(calculated.weight),
        isCodeCompliant: calculated.isCodeCompliant,
        
        // Additional properties
        workbench: 'Arch',
        command: 'Arch_Stairs',
        type: 'Stairs'
      };
      
      // Call the creation handler
      await onCreateStair?.(createParams);
      
      // Reset to default values after successful creation
      setStairParams({
        stairType: 'straight',
        totalRise: 3.0,
        totalRun: 4.0,
        numberOfSteps: 16,
        stepWidth: 1.2,
        treadDepth: 0.25,
        riserHeight: 0.18,
        material: 'concrete',
        handrailHeight: 1.0,
        hasHandrail: true,
        landingDepth: 0.8,
        thickness: 0.15
      });
      
    } catch (error) {
      console.error('Stair creation error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, stairParams, materialOptions, calculateStairParameters, onCreateStair]);

  // Handle stair update (for editing existing stairs)
  const handleUpdate = useCallback(async () => {
    if (!isValid || !selectedObject) return;
    
    setIsCreating(true);
    
    try {
      const material = materialOptions.find(m => m.value === stairParams.material);
      const calculated = calculateStairParameters();
      
      const updateParams = {
        id: selectedObject.id,
        totalRise: stairParams.totalRise,
        totalRun: parseFloat(calculated.actualTotalRun),
        numberOfSteps: calculated.actualNumberOfSteps,
        stepWidth: stairParams.stepWidth,
        thickness: stairParams.thickness,
        treadDepth: parseFloat(calculated.actualTreadDepth),
        riserHeight: parseFloat(calculated.actualRiserHeight),
        stairType: stairParams.stairType,
        landingDepth: stairParams.landingDepth,
        hasHandrail: stairParams.hasHandrail,
        handrailHeight: stairParams.handrailHeight,
        material: stairParams.material,
        materialColor: material?.color || '#9ca3af',
        volume: parseFloat(calculated.volume),
        totalWeight: parseFloat(calculated.weight)
      };
      
      await onUpdateStair?.(updateParams);
      
    } catch (error) {
      console.error('Stair update error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, stairParams, selectedObject, materialOptions, calculateStairParameters, onUpdateStair]);

  // Don't render if not active
  if (!isActive) return null;

  const isEditing = selectedObject && selectedObject.type === 'Stair';
  const selectedMaterial = materialOptions.find(m => m.value === stairParams.material);
  const selectedStairType = stairTypes.find(t => t.value === stairParams.stairType);

  return (
    <div className="stair-tool-panel w-full h-full">
      
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-studiosix-600' : 'bg-studiosix-500'
          }`}>
            <StairIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {isEditing ? 'Edit Stair' : 'Create Stair'}
            </h3>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {isEditing ? 'Modify selected stair properties' : 'Click to place stair between levels'}
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
          title="Close stair tool"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Parameters */}
      <div className="p-4 space-y-4">
        
        {/* Auto-Calculate Button */}
        <button
          onClick={handleAutoCalculate}
          className={`w-full p-2 text-sm rounded border transition-colors ${
            theme === 'dark'
              ? 'border-blue-600 bg-blue-800/20 text-blue-400 hover:bg-blue-700/30'
              : 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100'
          }`}
        >
          <CalculatorIcon className="w-4 h-4 inline mr-2" />
          Auto-Calculate Optimal Dimensions
        </button>

        {/* Compliance Status */}
        {calculatedParams.isCodeCompliant !== undefined && (
          <div className={`p-2 rounded border text-xs ${
            calculatedParams.isCodeCompliant
              ? theme === 'dark' 
                ? 'border-green-700/50 bg-green-800/20 text-green-400'
                : 'border-green-500/50 bg-green-50 text-green-700'
              : theme === 'dark'
                ? 'border-yellow-700/50 bg-yellow-800/20 text-yellow-400'
                : 'border-yellow-500/50 bg-yellow-50 text-yellow-700'
          }`}>
            {calculatedParams.isCodeCompliant ? '✓' : '⚠'} Building Code: {calculatedParams.isCodeCompliant ? 'Compliant' : 'Warning'}
            <div className="mt-1">Rise + Run: {calculatedParams.ratio}m (ideal: 0.60-0.65m)</div>
          </div>
        )}

        {/* Basic Dimensions Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <RectangleStackIcon className="w-4 h-4 mr-2" />
            Basic Dimensions
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Total Rise */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Total Rise (m)
              </label>
              <input
                type="number"
                value={stairParams.totalRise}
                onChange={(e) => handleParameterChange('totalRise', parseFloat(e.target.value) || 0)}
                min="0.1"
                max="10"
                step="0.1"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.totalRise
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.totalRise
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.totalRise && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.totalRise}</p>
              )}
            </div>
            
            {/* Step Width */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Step Width (m)
              </label>
              <input
                type="number"
                value={stairParams.stepWidth}
                onChange={(e) => handleParameterChange('stepWidth', parseFloat(e.target.value) || 0)}
                min="0.1"
                max="5"
                step="0.1"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.stepWidth
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.stepWidth
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.stepWidth && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.stepWidth}</p>
              )}
            </div>
            
            {/* Number of Steps */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Steps (#)
              </label>
              <input
                type="number"
                value={stairParams.numberOfSteps}
                onChange={(e) => handleParameterChange('numberOfSteps', parseInt(e.target.value) || 0)}
                min="2"
                max="50"
                step="1"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.numberOfSteps
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.numberOfSteps
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.numberOfSteps && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.numberOfSteps}</p>
              )}
            </div>

            {/* Calculated Total Run */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Total Run (m)
              </label>
              <input
                type="text"
                value={calculatedParams.actualTotalRun || stairParams.totalRun}
                readOnly
                className={`w-full px-2 py-1 text-xs rounded border ${
                  theme === 'dark'
                    ? 'bg-slate-700/50 border-gray-600 text-gray-300'
                    : 'bg-gray-100 border-gray-300 text-gray-700'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">Calculated</p>
            </div>
          </div>
        </div>

        {/* Step Geometry Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <AdjustmentsVerticalIcon className="w-4 h-4 mr-2" />
            Step Geometry
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Tread Depth */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Tread Depth (m)
              </label>
              <input
                type="number"
                value={stairParams.treadDepth}
                onChange={(e) => handleParameterChange('treadDepth', parseFloat(e.target.value) || 0)}
                min="0.2"
                max="0.4"
                step="0.01"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.treadDepth
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.treadDepth
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">Actual: {calculatedParams.actualTreadDepth}m</p>
              {validationErrors.treadDepth && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.treadDepth}</p>
              )}
            </div>
            
            {/* Riser Height */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Riser Height (m)
              </label>
              <input
                type="number"
                value={stairParams.riserHeight}
                onChange={(e) => handleParameterChange('riserHeight', parseFloat(e.target.value) || 0)}
                min="0.1"
                max="0.22"
                step="0.01"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.riserHeight
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.riserHeight
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">Actual: {calculatedParams.actualRiserHeight}m</p>
              {validationErrors.riserHeight && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.riserHeight}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stair Type Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <ArrowTrendingUpIcon className="w-4 h-4 mr-2" />
            Stair Type
          </h4>
          
          <div className="grid grid-cols-2 gap-2">
            {stairTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => handleParameterChange('stairType', type.value)}
                className={`p-2 text-xs rounded transition-colors ${
                  stairParams.stairType === type.value
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

        {/* Handrail Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Handrail
            </label>
            <button
              onClick={() => handleParameterChange('hasHandrail', !stairParams.hasHandrail)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                stairParams.hasHandrail 
                  ? 'bg-studiosix-600' 
                  : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                stairParams.hasHandrail ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          
          {stairParams.hasHandrail && (
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Handrail Height (m)
              </label>
              <input
                type="number"
                value={stairParams.handrailHeight}
                onChange={(e) => handleParameterChange('handrailHeight', parseFloat(e.target.value) || 0)}
                min="0.8"
                max="1.2"
                step="0.05"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.handrailHeight
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.handrailHeight
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.handrailHeight && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.handrailHeight}</p>
              )}
            </div>
          )}
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
              value={stairParams.material}
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
            
            {/* Material Properties and Statistics */}
            {selectedMaterial && calculatedParams.volume && (
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
                  <div>Volume: {calculatedParams.volume} m³</div>
                  <div>Weight: {calculatedParams.weight} kg</div>
                  <div>Steps: {calculatedParams.actualNumberOfSteps}</div>
                  <div>Est. Cost: ${(selectedMaterial.cost * parseFloat(calculatedParams.volume)).toFixed(0)}</div>
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
                  <span className="text-sm">Update Stair</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span className="text-sm">Create Stair</span>
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

export default StairTool;