import React, { useState, useEffect, useCallback } from 'react';
import { TagIcon } from '../icons';
import {
  SwatchIcon,
  RectangleStackIcon,
  AdjustmentsVerticalIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon,
  TagIcon as HeroTagIcon,
  DocumentTextIcon,
  CalculatorIcon,
  MapPinIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

/**
 * Annotation Tool Component - Provides interface for creating tags, dimensions, and labels
 * Allows users to annotate BIM models with text, measurements, and callouts
 */
const AnnotationTool = ({
  isActive = false,
  selectedObject = null,
  onCreateAnnotation,
  onUpdateAnnotation,
  onCancel,
  theme = 'dark',
  freecadObjects = [] // For object selection and dimensioning
}) => {
  // Annotation parameters state
  const [annotationParams, setAnnotationParams] = useState({
    annotationType: 'tag', // 'tag', 'dimension', 'label', 'callout', 'elevation', 'section'
    text: '',
    fontSize: 12,
    textColor: '#ffffff',
    backgroundColor: '#8b5cf6',
    borderColor: '#7c3aed',
    showLeader: true,
    leaderStyle: 'straight', // 'straight', 'curved', 'elbow'
    position: { x: 0, y: 0, z: 0 },
    targetObject: null,
    dimensionType: 'linear', // 'linear', 'angular', 'radial', 'diameter'
    precision: 2, // Decimal places for dimensions
    units: 'mm', // 'mm', 'm', 'ft', 'in'
    showUnits: true,
    arrowStyle: 'filled', // 'filled', 'open', 'tick', 'dot'
    textOffset: 5 // Distance from leader line
  });

  // Validation and interaction state
  const [isValid, setIsValid] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [selectedObjects, setSelectedObjects] = useState([]); // For dimensioning
  const [previewText, setPreviewText] = useState('');

  // Annotation type options
  const annotationTypes = [
    { 
      value: 'tag', 
      label: 'Tag', 
      icon: <HeroTagIcon className="w-4 h-4" />, 
      description: 'Simple text tag with leader' 
    },
    { 
      value: 'dimension', 
      label: 'Dimension', 
      icon: <CalculatorIcon className="w-4 h-4" />, 
      description: 'Measure distances and angles' 
    },
    { 
      value: 'label', 
      label: 'Label', 
      icon: <DocumentTextIcon className="w-4 h-4" />, 
      description: 'Text label without leader' 
    },
    { 
      value: 'callout', 
      label: 'Callout', 
      icon: <ChatBubbleLeftRightIcon className="w-4 h-4" />, 
      description: 'Detailed callout box' 
    },
    { 
      value: 'elevation', 
      label: 'Elevation', 
      icon: <MapPinIcon className="w-4 h-4" />, 
      description: 'Height elevation marker' 
    }
  ];

  // Leader styles
  const leaderStyles = [
    { value: 'straight', label: 'Straight', description: 'Direct line to target' },
    { value: 'curved', label: 'Curved', description: 'Smooth curved line' },
    { value: 'elbow', label: 'Elbow', description: '90-degree bend' },
    { value: 'none', label: 'None', description: 'No leader line' }
  ];

  // Arrow styles
  const arrowStyles = [
    { value: 'filled', label: 'Filled', symbol: '►' },
    { value: 'open', label: 'Open', symbol: '▷' },
    { value: 'tick', label: 'Tick', symbol: '|' },
    { value: 'dot', label: 'Dot', symbol: '●' }
  ];

  // Units
  const unitOptions = [
    { value: 'mm', label: 'Millimeters (mm)', factor: 1 },
    { value: 'm', label: 'Meters (m)', factor: 1000 },
    { value: 'ft', label: 'Feet (ft)', factor: 304.8 },
    { value: 'in', label: 'Inches (in)', factor: 25.4 }
  ];

  // Initialize with existing annotation data if editing
  useEffect(() => {
    if (selectedObject && (selectedObject.type === 'Annotation' || selectedObject.type === 'Dimension')) {
      setAnnotationParams({
        annotationType: selectedObject.annotationType || 'tag',
        text: selectedObject.text || '',
        fontSize: selectedObject.fontSize || 12,
        textColor: selectedObject.textColor || '#ffffff',
        backgroundColor: selectedObject.backgroundColor || '#8b5cf6',
        borderColor: selectedObject.borderColor || '#7c3aed',
        showLeader: selectedObject.showLeader !== undefined ? selectedObject.showLeader : true,
        leaderStyle: selectedObject.leaderStyle || 'straight',
        position: selectedObject.position || { x: 0, y: 0, z: 0 },
        targetObject: selectedObject.targetObject || null,
        dimensionType: selectedObject.dimensionType || 'linear',
        precision: selectedObject.precision || 2,
        units: selectedObject.units || 'mm',
        showUnits: selectedObject.showUnits !== undefined ? selectedObject.showUnits : true,
        arrowStyle: selectedObject.arrowStyle || 'filled',
        textOffset: selectedObject.textOffset || 5
      });
    }
  }, [selectedObject]);

  // Generate preview text for dimensions
  useEffect(() => {
    if (annotationParams.annotationType === 'dimension' && selectedObjects.length >= 2) {
      // Calculate distance between selected objects
      const obj1 = selectedObjects[0];
      const obj2 = selectedObjects[1];
      
      if (obj1.position && obj2.position) {
        const dx = obj2.position.x - obj1.position.x;
        const dy = obj2.position.y - obj1.position.y;
        const dz = obj2.position.z - obj1.position.z;
        
        let distance;
        if (annotationParams.dimensionType === 'linear') {
          distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        } else if (annotationParams.dimensionType === 'angular') {
          // Calculate angle (simplified)
          distance = Math.atan2(dy, dx) * (180 / Math.PI);
        }
        
        const unitOption = unitOptions.find(u => u.value === annotationParams.units);
        const convertedDistance = distance * (unitOption?.factor || 1);
        const formattedDistance = convertedDistance.toFixed(annotationParams.precision);
        
        setPreviewText(annotationParams.dimensionType === 'angular' 
          ? `${formattedDistance}°` 
          : `${formattedDistance}${annotationParams.showUnits ? annotationParams.units : ''}`);
      }
    } else if (annotationParams.annotationType === 'elevation' && annotationParams.position) {
      const elevation = annotationParams.position.z || 0;
      const unitOption = unitOptions.find(u => u.value === annotationParams.units);
      const convertedElevation = elevation * (unitOption?.factor || 1);
      setPreviewText(`EL. ${convertedElevation.toFixed(annotationParams.precision)}${annotationParams.showUnits ? annotationParams.units : ''}`);
    } else {
      setPreviewText(annotationParams.text || 'Sample Text');
    }
  }, [annotationParams, selectedObjects]);

  // Parameter validation
  const validateParameters = useCallback(() => {
    const errors = {};
    
    // Text validation (required for most types except dimensions)
    if (!annotationParams.text && annotationParams.annotationType !== 'dimension' && annotationParams.annotationType !== 'elevation') {
      errors.text = 'Text content is required';
    }
    
    // Font size validation
    if (annotationParams.fontSize < 6 || annotationParams.fontSize > 72) {
      errors.fontSize = 'Font size must be between 6 and 72';
    }
    
    // Precision validation
    if (annotationParams.precision < 0 || annotationParams.precision > 6) {
      errors.precision = 'Precision must be between 0 and 6 decimal places';
    }
    
    // Dimension-specific validation
    if (annotationParams.annotationType === 'dimension' && selectedObjects.length < 2) {
      errors.dimension = 'Select two objects to create dimension';
    }

    setValidationErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    setIsValid(isValid);
    
    return isValid;
  }, [annotationParams, selectedObjects]);

  // Run validation when parameters change
  useEffect(() => {
    validateParameters();
  }, [validateParameters]);

  // Handle parameter changes
  const handleParameterChange = useCallback((param, value) => {
    setAnnotationParams(prev => ({
      ...prev,
      [param]: value
    }));
  }, []);

  // Handle object selection for dimensioning
  const handleObjectSelect = useCallback((objectId) => {
    const object = freecadObjects.find(obj => obj.id === objectId);
    if (object) {
      setSelectedObjects(prev => {
        if (prev.some(obj => obj.id === objectId)) {
          // Remove if already selected
          return prev.filter(obj => obj.id !== objectId);
        } else {
          // Add to selection (limit to 2 for dimensions)
          return annotationParams.annotationType === 'dimension' 
            ? [...prev.slice(-1), object] // Keep only the last one and add new
            : [object]; // Single selection for other types
        }
      });
    }
  }, [freecadObjects, annotationParams.annotationType]);

  // Generate default text based on annotation type
  const generateDefaultText = useCallback(() => {
    switch (annotationParams.annotationType) {
      case 'tag':
        return annotationParams.targetObject ? annotationParams.targetObject.name || 'Tag' : 'Tag';
      case 'label':
        return 'Label';
      case 'callout':
        return 'Callout\nDetailed description here';
      case 'elevation':
        return `EL. ${annotationParams.position?.z?.toFixed(annotationParams.precision) || '0.00'}${annotationParams.showUnits ? annotationParams.units : ''}`;
      case 'dimension':
        return previewText;
      default:
        return 'Text';
    }
  }, [annotationParams, previewText]);

  // Auto-generate text when type changes
  useEffect(() => {
    if (!annotationParams.text) {
      const defaultText = generateDefaultText();
      if (defaultText !== annotationParams.text) {
        setAnnotationParams(prev => ({
          ...prev,
          text: defaultText
        }));
      }
    }
  }, [annotationParams.annotationType, generateDefaultText]);

  // Handle annotation creation
  const handleCreate = useCallback(async () => {
    if (!isValid) return;
    
    setIsCreating(true);
    
    try {
      // Prepare annotation creation parameters for FreeCAD
      const createParams = {
        // Basic properties
        annotationType: annotationParams.annotationType,
        text: annotationParams.annotationType === 'dimension' || annotationParams.annotationType === 'elevation' 
          ? previewText 
          : annotationParams.text,
        fontSize: annotationParams.fontSize,
        textColor: annotationParams.textColor,
        backgroundColor: annotationParams.backgroundColor,
        borderColor: annotationParams.borderColor,
        
        // Position and targeting
        position: annotationParams.position,
        targetObject: annotationParams.targetObject,
        selectedObjects: selectedObjects.map(obj => obj.id),
        
        // Leader properties
        showLeader: annotationParams.showLeader,
        leaderStyle: annotationParams.leaderStyle,
        textOffset: annotationParams.textOffset,
        arrowStyle: annotationParams.arrowStyle,
        
        // Dimension-specific properties
        dimensionType: annotationParams.dimensionType,
        precision: annotationParams.precision,
        units: annotationParams.units,
        showUnits: annotationParams.showUnits,
        
        // Additional properties
        workbench: 'TechDraw',
        command: annotationParams.annotationType === 'dimension' ? 'TechDraw_LengthDimension' : 'TechDraw_Annotation',
        type: 'Annotation'
      };
      
      // Call the creation handler
      await onCreateAnnotation?.(createParams);
      
      // Reset to default values after successful creation
      setAnnotationParams({
        annotationType: 'tag',
        text: '',
        fontSize: 12,
        textColor: '#ffffff',
        backgroundColor: '#8b5cf6',
        borderColor: '#7c3aed',
        showLeader: true,
        leaderStyle: 'straight',
        position: { x: 0, y: 0, z: 0 },
        targetObject: null,
        dimensionType: 'linear',
        precision: 2,
        units: 'mm',
        showUnits: true,
        arrowStyle: 'filled',
        textOffset: 5
      });
      
      // Clear selected objects
      setSelectedObjects([]);
      
    } catch (error) {
      console.error('Annotation creation error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, annotationParams, selectedObjects, previewText, onCreateAnnotation]);

  // Handle annotation update (for editing existing annotations)
  const handleUpdate = useCallback(async () => {
    if (!isValid || !selectedObject) return;
    
    setIsCreating(true);
    
    try {
      const updateParams = {
        id: selectedObject.id,
        annotationType: annotationParams.annotationType,
        text: annotationParams.annotationType === 'dimension' || annotationParams.annotationType === 'elevation' 
          ? previewText 
          : annotationParams.text,
        fontSize: annotationParams.fontSize,
        textColor: annotationParams.textColor,
        backgroundColor: annotationParams.backgroundColor,
        borderColor: annotationParams.borderColor,
        position: annotationParams.position,
        targetObject: annotationParams.targetObject,
        showLeader: annotationParams.showLeader,
        leaderStyle: annotationParams.leaderStyle,
        textOffset: annotationParams.textOffset,
        arrowStyle: annotationParams.arrowStyle,
        dimensionType: annotationParams.dimensionType,
        precision: annotationParams.precision,
        units: annotationParams.units,
        showUnits: annotationParams.showUnits
      };
      
      await onUpdateAnnotation?.(updateParams);
      
    } catch (error) {
      console.error('Annotation update error:', error);
    } finally {
      setIsCreating(false);
    }
  }, [isValid, annotationParams, selectedObject, previewText, onUpdateAnnotation]);

  // Don't render if not active
  if (!isActive) return null;

  const isEditing = selectedObject && (selectedObject.type === 'Annotation' || selectedObject.type === 'Dimension');
  const selectedType = annotationTypes.find(t => t.value === annotationParams.annotationType);

  return (
    <div className="annotation-tool-panel w-full h-full">
      
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-gray-700/50' : 'border-gray-300/50'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            theme === 'dark' ? 'bg-studiosix-600' : 'bg-studiosix-500'
          }`}>
            <TagIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              {isEditing ? 'Edit Annotation' : 'Create Annotation'}
            </h3>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {isEditing ? 'Modify selected annotation properties' : 'Click to place annotation in model'}
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
          title="Close annotation tool"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Parameters */}
      <div className="p-4 space-y-4">
        
        {/* Annotation Type Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <AdjustmentsVerticalIcon className="w-4 h-4 mr-2" />
            Annotation Type
          </h4>
          
          <div className="grid grid-cols-2 gap-2">
            {annotationTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => handleParameterChange('annotationType', type.value)}
                className={`p-2 text-xs rounded transition-colors ${
                  annotationParams.annotationType === type.value
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
                  {type.icon}
                </div>
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Object Selection for Dimensions */}
        {annotationParams.annotationType === 'dimension' && (
          <div className={`p-3 rounded border ${
            theme === 'dark' ? 'border-blue-700/50 bg-blue-800/20' : 'border-blue-500/50 bg-blue-50'
          }`}>
            <h5 className={`text-xs font-medium mb-2 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
            }`}>
              Select Objects to Dimension ({selectedObjects.length}/2):
            </h5>
            <div className="space-y-1">
              {freecadObjects.slice(0, 5).map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => handleObjectSelect(obj.id)}
                  className={`w-full text-left p-2 text-xs rounded transition-colors ${
                    selectedObjects.some(selected => selected.id === obj.id)
                      ? theme === 'dark' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-blue-500 text-white'
                      : theme === 'dark'
                        ? 'hover:bg-blue-700/30 text-blue-300' 
                        : 'hover:bg-blue-100 text-blue-700'
                  }`}
                >
                  {obj.name || `${obj.type} ${obj.id}`}
                </button>
              ))}
            </div>
            {validationErrors.dimension && (
              <p className="text-xs text-red-400 mt-2">{validationErrors.dimension}</p>
            )}
          </div>
        )}

        {/* Text Content */}
        {annotationParams.annotationType !== 'dimension' && annotationParams.annotationType !== 'elevation' && (
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Text Content
            </label>
            <textarea
              value={annotationParams.text}
              onChange={(e) => handleParameterChange('text', e.target.value)}
              placeholder="Enter annotation text..."
              rows="3"
              className={`w-full px-2 py-2 text-sm rounded border transition-colors resize-none ${
                validationErrors.text
                  ? 'border-red-500 focus:border-red-400'
                  : theme === 'dark'
                    ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
              } focus:outline-none focus:ring-1 ${
                validationErrors.text
                  ? 'focus:ring-red-400'
                  : 'focus:ring-studiosix-500'
              }`}
            />
            {validationErrors.text && (
              <p className="text-xs text-red-400 mt-1">{validationErrors.text}</p>
            )}
          </div>
        )}

        {/* Preview */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Preview
          </label>
          <div className={`p-3 rounded border ${
            theme === 'dark' ? 'border-gray-700/50 bg-slate-800/30' : 'border-gray-300/50 bg-gray-50'
          }`}>
            <div 
              className={`inline-block px-3 py-2 rounded`}
              style={{
                backgroundColor: annotationParams.backgroundColor,
                color: annotationParams.textColor,
                borderColor: annotationParams.borderColor,
                borderWidth: '1px',
                borderStyle: 'solid',
                fontSize: `${Math.max(10, Math.min(16, annotationParams.fontSize))}px`
              }}
            >
              {previewText}
            </div>
          </div>
        </div>

        {/* Text Formatting Section */}
        <div>
          <h4 className={`text-sm font-medium mb-3 flex items-center ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            <DocumentTextIcon className="w-4 h-4 mr-2" />
            Text Formatting
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Font Size */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Font Size
              </label>
              <input
                type="number"
                value={annotationParams.fontSize}
                onChange={(e) => handleParameterChange('fontSize', parseInt(e.target.value) || 12)}
                min="6"
                max="72"
                step="1"
                className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                  validationErrors.fontSize
                    ? 'border-red-500 focus:border-red-400'
                    : theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                } focus:outline-none focus:ring-1 ${
                  validationErrors.fontSize
                    ? 'focus:ring-red-400'
                    : 'focus:ring-studiosix-500'
                }`}
              />
              {validationErrors.fontSize && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.fontSize}</p>
              )}
            </div>

            {/* Text Color */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Text Color
              </label>
              <div className="flex space-x-2">
                <input
                  type="color"
                  value={annotationParams.textColor}
                  onChange={(e) => handleParameterChange('textColor', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={annotationParams.textColor}
                  onChange={(e) => handleParameterChange('textColor', e.target.value)}
                  placeholder="#ffffff"
                  className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                  } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
                />
              </div>
            </div>

            {/* Background Color */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Background
              </label>
              <div className="flex space-x-2">
                <input
                  type="color"
                  value={annotationParams.backgroundColor}
                  onChange={(e) => handleParameterChange('backgroundColor', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={annotationParams.backgroundColor}
                  onChange={(e) => handleParameterChange('backgroundColor', e.target.value)}
                  placeholder="#8b5cf6"
                  className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                  } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
                />
              </div>
            </div>

            {/* Border Color */}
            <div>
              <label className={`block text-xs mb-1 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Border
              </label>
              <div className="flex space-x-2">
                <input
                  type="color"
                  value={annotationParams.borderColor}
                  onChange={(e) => handleParameterChange('borderColor', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={annotationParams.borderColor}
                  onChange={(e) => handleParameterChange('borderColor', e.target.value)}
                  placeholder="#7c3aed"
                  className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                  } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Leader Line Settings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className={`text-sm font-medium flex items-center ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <SwatchIcon className="w-4 h-4 mr-2" />
              Leader Line
            </h4>
            <button
              onClick={() => handleParameterChange('showLeader', !annotationParams.showLeader)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                annotationParams.showLeader 
                  ? 'bg-studiosix-600' 
                  : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                annotationParams.showLeader ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </button>
          </div>
          
          {annotationParams.showLeader && (
            <div className="space-y-3">
              <div>
                <label className={`block text-xs mb-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Leader Style
                </label>
                <select
                  value={annotationParams.leaderStyle}
                  onChange={(e) => handleParameterChange('leaderStyle', e.target.value)}
                  className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                  } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
                >
                  {leaderStyles.map((style) => (
                    <option key={style.value} value={style.value}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs mb-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Arrow Style
                </label>
                <select
                  value={annotationParams.arrowStyle}
                  onChange={(e) => handleParameterChange('arrowStyle', e.target.value)}
                  className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                  } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
                >
                  {arrowStyles.map((style) => (
                    <option key={style.value} value={style.value}>
                      {style.symbol} {style.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Dimension Settings */}
        {(annotationParams.annotationType === 'dimension' || annotationParams.annotationType === 'elevation') && (
          <div>
            <h4 className={`text-sm font-medium mb-3 flex items-center ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <CalculatorIcon className="w-4 h-4 mr-2" />
              Dimension Settings
            </h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs mb-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Units
                </label>
                <select
                  value={annotationParams.units}
                  onChange={(e) => handleParameterChange('units', e.target.value)}
                  className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                  } focus:outline-none focus:ring-1 focus:ring-studiosix-500`}
                >
                  {unitOptions.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs mb-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Precision
                </label>
                <input
                  type="number"
                  value={annotationParams.precision}
                  onChange={(e) => handleParameterChange('precision', parseInt(e.target.value) || 0)}
                  min="0"
                  max="6"
                  step="1"
                  className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                    validationErrors.precision
                      ? 'border-red-500 focus:border-red-400'
                      : theme === 'dark'
                        ? 'bg-slate-800/50 border-gray-600 text-white focus:border-studiosix-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-studiosix-500'
                  } focus:outline-none focus:ring-1 ${
                    validationErrors.precision
                      ? 'focus:ring-red-400'
                      : 'focus:ring-studiosix-500'
                  }`}
                />
                {validationErrors.precision && (
                  <p className="text-xs text-red-400 mt-1">{validationErrors.precision}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <label className={`text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Show Units
              </label>
              <button
                onClick={() => handleParameterChange('showUnits', !annotationParams.showUnits)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  annotationParams.showUnits 
                    ? 'bg-studiosix-600' 
                    : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  annotationParams.showUnits ? 'translate-x-5' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        )}
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
                  <span className="text-sm">Update</span>
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span className="text-sm">Create</span>
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

export default AnnotationTool;