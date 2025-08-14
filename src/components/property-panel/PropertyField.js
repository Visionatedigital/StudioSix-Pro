import React, { useState, useCallback } from 'react';

/**
 * PropertyField Component
 * 
 * Handles different types of property inputs for FreeCAD objects:
 * - Numbers (with units, sliders)
 * - Strings (text inputs)
 * - Booleans (toggle switches)
 * - Enums/Select (dropdown)
 * - Colors (color picker)
 * - Vectors (x, y, z inputs)
 */

const PropertyField = ({ 
  name, 
  value, 
  type = 'string',
  options = null,
  min = null,
  max = null,
  step = null,
  unit = '',
  readonly = false,
  required = false,
  label = null,
  description = '',
  theme = 'dark',
  onChange
}) => {
  const [tempValue, setTempValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');

  const displayLabel = label || name;
  
  // Validation function
  const validateValue = useCallback((val) => {
    let valid = true;
    let message = '';
    
    if (type === 'number' || type === 'integer') {
      const numVal = parseFloat(val);
      if (isNaN(numVal)) {
        valid = false;
        message = 'Must be a valid number';
      } else if (min !== null && numVal < min) {
        valid = false;
        message = `Must be at least ${min}`;
      } else if (max !== null && numVal > max) {
        valid = false;
        message = `Must be no more than ${max}`;
      }
    } else if (type === 'string' && val === '' && required) {
      valid = false;
      message = 'This field is required';
    }
    
    setIsValid(valid);
    setValidationMessage(message);
    return valid;
  }, [type, min, max]);

  // Handle value changes with validation
  const handleChange = useCallback((newValue) => {
    setTempValue(newValue);
    setHasChanged(true);
    
    // Validate the new value
    const valid = validateValue(newValue);
    
    // Apply change immediately for some types if valid
    if (valid && (type === 'boolean' || type === 'select' || type === 'color')) {
      onChange(newValue);
      
      // Show brief success feedback
      setTimeout(() => setHasChanged(false), 1000);
    }
  }, [type, onChange, validateValue]);

  // Handle blur event (apply changes for text/number inputs)
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    
    if (type === 'number' || type === 'integer' || type === 'string') {
      let finalValue = tempValue;
      let isValidValue = true;
      
      // Type validation and correction
      if (type === 'number' || type === 'integer') {
        const numValue = parseFloat(tempValue);
        if (isNaN(numValue)) {
          finalValue = value; // Reset to original value
          setTempValue(value);
          isValidValue = false;
          setValidationMessage('Reverted to previous value');
        } else {
          finalValue = type === 'integer' ? parseInt(numValue) : numValue;
          
          // Apply min/max constraints with feedback
          if (min !== null && finalValue < min) {
            finalValue = min;
            setTempValue(min);
            setValidationMessage(`Adjusted to minimum value (${min})`);
          } else if (max !== null && finalValue > max) {
            finalValue = max;
            setTempValue(max);
            setValidationMessage(`Adjusted to maximum value (${max})`);
          }
        }
      }
      
      // Apply change if valid
      if (isValidValue || finalValue !== value) {
        onChange(finalValue);
        setHasChanged(true);
        
        // Show success feedback
        setTimeout(() => {
          setHasChanged(false);
          setValidationMessage('');
        }, 1500);
      }
    }
  }, [type, tempValue, value, min, max, onChange]);

  // Handle Enter key press
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleBlur();
      e.target.blur();
    } else if (e.key === 'Escape') {
      setTempValue(value);
      e.target.blur();
    }
  }, [handleBlur, value]);

  // Render different input types
  const renderInput = () => {
    // Enhanced input styling with validation and change feedback
    const getInputClass = () => {
      let classes = `
        w-full px-2 py-1 text-xs rounded
        bg-slate-800/50 border text-white
        focus:outline-none transition-all duration-200
        ${readonly ? 'opacity-50 cursor-not-allowed' : ''}
      `;
      
      // Validation state styling
      if (!isValid) {
        classes += ' border-red-500 focus:border-red-400 focus:ring-1 focus:ring-red-400';
      } else if (hasChanged && isValid) {
        classes += ' border-green-500 focus:border-green-400 focus:ring-1 focus:ring-green-400';
      } else {
        classes += ' border-gray-600 focus:border-studiosix-500 focus:ring-1 focus:ring-studiosix-500';
      }
      
      return classes.trim();
    };
    
    const baseInputClass = getInputClass();

    switch (type) {
      case 'number':
      case 'integer':
        return (
          <div className="space-y-1">
            {/* Number input */}
            <div className="relative">
              <input
                type="number"
                value={isFocused ? tempValue : value}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => {setIsFocused(true); setTempValue(value);}}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                min={min}
                max={max}
                step={step || (type === 'integer' ? 1 : 0.1)}
                className={baseInputClass}
                disabled={readonly}
              />
              {unit && (
                <span className="absolute right-2 top-1 text-xs text-gray-400">
                  {unit}
                </span>
              )}
            </div>
            
            {/* Optional slider for ranged values */}
            {min !== null && max !== null && !readonly && (
              <div className="space-y-1">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step || (type === 'integer' ? 1 : 0.1)}
                  value={value}
                  onChange={(e) => onChange(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{min}{unit}</span>
                  <span>{max}{unit}</span>
                </div>
              </div>
            )}
          </div>
        );

      case 'boolean':
        return (
          <label className="flex items-center space-x-2 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only"
                disabled={readonly}
              />
              <div className={`
                w-8 h-4 rounded-full transition-colors duration-200 
                ${value ? 'bg-studiosix-500' : 'bg-gray-600'}
                ${readonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}>
                <div className={`
                  w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 transform
                  ${value ? 'translate-x-4' : 'translate-x-0.5'} translate-y-0.5
                `}></div>
              </div>
            </div>
            <span className="text-xs text-gray-300 select-none">
              {value ? 'On' : 'Off'}
            </span>
          </label>
        );

      case 'select':
      case 'enum':
        return (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            disabled={readonly}
          >
            {options?.map(option => {
              const optionValue = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label || option.value;
              return (
                <option key={optionValue} value={optionValue}>
                  {optionLabel}
                </option>
              );
            })}
          </select>
        );

      case 'color':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-6 border border-gray-600 rounded cursor-pointer"
              disabled={readonly}
            />
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className={`flex-1 ${baseInputClass}`}
              placeholder="#000000"
              disabled={readonly}
            />
          </div>
        );

      case 'vector':
      case 'position':
      case 'rotation':
        const vectorValue = value || { x: 0, y: 0, z: 0 };
        return (
          <div className="grid grid-cols-3 gap-1">
            {['x', 'y', 'z'].map(axis => (
              <div key={axis} className="relative">
                <input
                  type="number"
                  value={vectorValue[axis] || 0}
                  onChange={(e) => onChange({
                    ...vectorValue,
                    [axis]: parseFloat(e.target.value) || 0
                  })}
                  step={step || 0.1}
                  className={`${baseInputClass} text-center`}
                  disabled={readonly}
                />
                <span className="absolute -top-4 left-1 text-xs text-gray-500 uppercase">
                  {axis}
                </span>
              </div>
            ))}
          </div>
        );

      case 'string':
      default:
        return (
          <input
            type="text"
            value={isFocused ? tempValue : value}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => {setIsFocused(true); setTempValue(value);}}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={baseInputClass}
            disabled={readonly}
          />
        );
    }
  };

  return (
    <div className="property-field space-y-1">
      {/* Property Label */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-300">
          {displayLabel}
        </label>
        {type === 'number' || type === 'integer' ? (
          <span className="text-xs text-gray-400">
            {typeof value === 'number' ? value.toFixed(type === 'integer' ? 0 : 2) : value}{unit}
          </span>
        ) : null}
      </div>
      
      {/* Property Input */}
      {renderInput()}
      
      {/* Validation/Feedback Messages */}
      {validationMessage && (
        <p className={`text-xs leading-tight ${
          isValid 
            ? 'text-green-400' 
            : 'text-red-400'
        }`}>
          {validationMessage}
        </p>
      )}
      
      {/* Description/Help Text */}
      {description && !validationMessage && (
        <p className="text-xs text-gray-500 leading-tight">
          {description}
        </p>
      )}
    </div>
  );
};

export default PropertyField; 