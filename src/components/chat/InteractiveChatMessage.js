import React, { useState, useCallback } from 'react';
import {
  PlayIcon,
  PauseIcon,
  PencilIcon,
  ForwardIcon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
  CogIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

/**
 * Interactive Chat Message Component
 * 
 * Enhances regular chat messages with interactive controls for step execution:
 * - Run, Skip, Edit buttons for step actions
 * - Parameter controls (sliders, inputs) for dynamic values
 * - Real-time parameter adjustments
 * - WebSocket integration for backend actions
 */

const InteractiveChatMessage = ({ 
  message, 
  isUser, 
  timestamp, 
  stepData = null,
  onExecuteStep = null,
  onSkipStep = null,
  onEditStep = null,
  onParameterChange = null,
  isExecuting = false,
  executionStatus = null // 'pending', 'running', 'completed', 'failed', 'skipped'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localParameters, setLocalParameters] = useState(stepData?.parameters || {});
  const [showParameters, setShowParameters] = useState(false);

  // Handle parameter value changes
  const handleParameterChange = useCallback((paramName, value, type = 'string') => {
    const newParams = { ...localParameters };
    
    // Type conversion based on parameter type
    switch (type) {
      case 'number':
        newParams[paramName] = parseFloat(value) || 0;
        break;
      case 'integer':
        newParams[paramName] = parseInt(value) || 0;
        break;
      case 'boolean':
        newParams[paramName] = Boolean(value);
        break;
      default:
        newParams[paramName] = String(value);
    }
    
    setLocalParameters(newParams);
    
    // Notify parent component of parameter change
    if (onParameterChange) {
      onParameterChange(stepData?.id, paramName, newParams[paramName]);
    }
  }, [localParameters, stepData?.id, onParameterChange]);

  // Execute step with current parameters
  const handleExecute = useCallback(() => {
    if (onExecuteStep && stepData) {
      onExecuteStep(stepData.id, localParameters);
    }
  }, [onExecuteStep, stepData, localParameters]);

  // Skip step
  const handleSkip = useCallback(() => {
    if (onSkipStep && stepData) {
      onSkipStep(stepData.id);
    }
  }, [onSkipStep, stepData]);

  // Edit step
  const handleEdit = useCallback(() => {
    if (onEditStep && stepData) {
      onEditStep(stepData.id, stepData);
    }
  }, [onEditStep, stepData]);

  // Render parameter control based on type
  const renderParameterControl = (paramName, paramConfig) => {
    const value = localParameters[paramName] ?? paramConfig.default ?? '';
    const { type = 'string', min, max, step, options, label, description } = paramConfig;

    switch (type) {
      case 'number':
      case 'integer':
        return (
          <div key={paramName} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-300">
                {label || paramName}
              </label>
              <span className="text-xs text-gray-400">{value}</span>
            </div>
            
            {/* Slider for numeric values with range */}
            {min !== undefined && max !== undefined ? (
              <div className="space-y-1">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step || (type === 'integer' ? 1 : 0.1)}
                  value={value}
                  onChange={(e) => handleParameterChange(paramName, e.target.value, type)}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{min}</span>
                  <span>{max}</span>
                </div>
              </div>
            ) : (
              // Number input for values without range
              <input
                type="number"
                value={value}
                onChange={(e) => handleParameterChange(paramName, e.target.value, type)}
                className="w-full px-3 py-1 bg-slate-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-studiosix-500"
                placeholder={`Enter ${label || paramName}`}
              />
            )}
            
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={paramName} className="space-y-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleParameterChange(paramName, e.target.checked, type)}
                className="rounded bg-slate-800 border-gray-600 text-studiosix-600 focus:ring-studiosix-500"
              />
              <span className="text-xs font-medium text-gray-300">
                {label || paramName}
              </span>
            </label>
            {description && (
              <p className="text-xs text-gray-500 ml-6">{description}</p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={paramName} className="space-y-1">
            <label className="text-xs font-medium text-gray-300">
              {label || paramName}
            </label>
            <select
              value={value}
              onChange={(e) => handleParameterChange(paramName, e.target.value, type)}
              className="w-full px-3 py-1 bg-slate-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-studiosix-500"
            >
              {options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label || option.value}
                </option>
              ))}
            </select>
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={paramName} className="space-y-1">
            <label className="text-xs font-medium text-gray-300">
              {label || paramName}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleParameterChange(paramName, e.target.value, type)}
              className="w-full px-3 py-1 bg-slate-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-studiosix-500"
              placeholder={`Enter ${label || paramName}`}
            />
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
          </div>
        );
    }
  };

  // Get status color and icon
  const getStatusDisplay = () => {
    switch (executionStatus) {
      case 'running':
        return {
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-400/10',
          icon: <ArrowPathIcon className="w-4 h-4 animate-spin" />,
          text: 'Running...'
        };
      case 'completed':
        return {
          color: 'text-green-400',
          bgColor: 'bg-green-400/10',
          icon: <CheckIcon className="w-4 h-4" />,
          text: 'Completed'
        };
      case 'failed':
        return {
          color: 'text-red-400',
          bgColor: 'bg-red-400/10',
          icon: <XMarkIcon className="w-4 h-4" />,
          text: 'Failed'
        };
      case 'skipped':
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-400/10',
          icon: <ForwardIcon className="w-4 h-4" />,
          text: 'Skipped'
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();
  const hasParameters = stepData?.parameters && Object.keys(stepData.parameters).length > 0;
  const isInteractive = stepData && !isUser;

  return (
    <div className={`message-bubble p-3 mb-3 rounded-lg max-w-[85%] break-words overflow-hidden ${
      isUser 
        ? 'bg-studiosix-600 text-white ml-auto' 
        : 'glass-light text-gray-100'
    }`} style={{ maxWidth: '85%', overflow: 'hidden', wordWrap: 'break-word' }}>
      
      {/* Main Message Content */}
      <div 
        className="text-sm mb-2 ai-response-content break-words"
        style={{ 
          maxWidth: '100%', 
          overflow: 'hidden', 
          wordWrap: 'break-word', 
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap'
        }}
        dangerouslySetInnerHTML={{ __html: message }}
      />

      {/* Interactive Controls for AI Steps */}
      {isInteractive && (
        <div className="mt-3 space-y-3">
          
          {/* Execution Status */}
          {statusDisplay && (
            <div className={`flex items-center space-x-2 p-2 rounded ${statusDisplay.bgColor}`}>
              <span className={statusDisplay.color}>
                {statusDisplay.icon}
              </span>
              <span className={`text-xs font-medium ${statusDisplay.color}`}>
                {statusDisplay.text}
              </span>
            </div>
          )}

          {/* Step Information */}
          {stepData && (
            <div className="bg-slate-800/30 rounded p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-300">
                  Step: {stepData.command || stepData.action || 'Unknown'}
                </span>
                {stepData.workbench && (
                  <span className="text-xs text-gray-400 bg-slate-700 px-2 py-0.5 rounded">
                    {stepData.workbench}
                  </span>
                )}
              </div>
              
              {stepData.description && (
                <p className="text-xs text-gray-400">{stepData.description}</p>
              )}
            </div>
          )}

          {/* Parameters Section */}
          {hasParameters && (
            <div className="space-y-2">
              <button
                onClick={() => setShowParameters(!showParameters)}
                className="flex items-center justify-between w-full p-2 bg-slate-800/50 rounded hover:bg-slate-800/70 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <AdjustmentsHorizontalIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-300">
                    Parameters ({Object.keys(stepData.parameters).length})
                  </span>
                </div>
                {showParameters ? 
                  <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : 
                  <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                }
              </button>

              {showParameters && (
                <div className="space-y-3 p-3 bg-slate-800/30 rounded">
                  {Object.entries(stepData.parameters).map(([paramName, paramConfig]) =>
                    renderParameterControl(paramName, paramConfig)
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {executionStatus !== 'completed' && executionStatus !== 'skipped' && (
            <div className="flex items-center space-x-2">
              
              {/* Run Button */}
              <button
                onClick={handleExecute}
                disabled={isExecuting || executionStatus === 'running'}
                className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
                title="Execute this step"
              >
                {executionStatus === 'running' ? (
                  <ArrowPathIcon className="w-3 h-3 animate-spin" />
                ) : (
                  <PlayIcon className="w-3 h-3" />
                )}
                <span>{executionStatus === 'running' ? 'Running' : 'Run'}</span>
              </button>

              {/* Skip Button */}
              <button
                onClick={handleSkip}
                disabled={isExecuting || executionStatus === 'running'}
                className="flex items-center space-x-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
                title="Skip this step"
              >
                <ForwardIcon className="w-3 h-3" />
                <span>Skip</span>
              </button>

              {/* Edit Button */}
              <button
                onClick={handleEdit}
                disabled={isExecuting || executionStatus === 'running'}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
                title="Edit this step"
              >
                <PencilIcon className="w-3 h-3" />
                <span>Edit</span>
              </button>

              {/* Advanced Settings */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded text-xs font-medium transition-colors"
                title="Advanced settings"
              >
                <CogIcon className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Expanded Advanced Settings */}
          {isExpanded && (
            <div className="p-3 bg-slate-800/50 rounded space-y-2">
              <h4 className="text-xs font-medium text-gray-300 mb-2">Advanced Options</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <button className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors">
                  Duplicate
                </button>
                <button className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors">
                  Export
                </button>
                <button className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors">
                  Debug
                </button>
                <button className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors">
                  Help
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timestamp */}
      <div className="text-xs opacity-60 mt-2">
        {timestamp}
      </div>
    </div>
  );
};

export default InteractiveChatMessage; 