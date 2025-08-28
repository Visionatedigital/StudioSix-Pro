/**
 * InlineExecutionWindow - Single Step Execution UI for Chat
 * 
 * Displays execution progress for individual steps inline in the chat flow
 */

import React, { useState, useEffect } from 'react';
import './CommandExecutionWindow.css';

const InlineExecutionWindow = ({ 
  step, 
  isExecuting = false,
  onStepComplete = null
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [executionStatus, setExecutionStatus] = useState(step?.status || 'pending');

  useEffect(() => {
    if (step?.status) {
      setExecutionStatus(step.status);
      
      // Notify parent when step completes
      if (step.status === 'completed' && onStepComplete) {
        onStepComplete(step);
      }
    }
  }, [step?.status, onStepComplete]);

  if (!step) return null;

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'executing':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '⏸️';
    }
  };

  const getStepStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'executing':
        return 'Executing...';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  return (
    <div className="inline-execution-window my-3">
      <div className={`execution-step ${executionStatus} ${isExpanded ? 'expanded' : ''}`}>
        <div 
          className="step-header"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="step-info">
            <span className="step-icon">{getStepIcon(executionStatus)}</span>
            <span className="step-number">Step {step.number}</span>
            <span className="step-title">{step.title}</span>
          </div>
          
          <div className="step-status">
            <span className="status-text">{getStepStatusText(executionStatus)}</span>
            {step.estimatedTime && executionStatus === 'pending' && (
              <span className="estimated-time">~{step.estimatedTime}</span>
            )}
            <span className="expand-icon">
              {isExpanded ? '⌄' : '›'}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="step-content">
            <div className="step-description">
              {step.description}
            </div>
            
            <div className="command-box">
              <div className="command-header">
                <span className="command-type">CAD</span>
                <span className="command-action">{step.action}</span>
                {executionStatus === 'executing' && (
                  <div className="execution-spinner">⟳</div>
                )}
              </div>
              
              <div className="command-params">
                <pre>{JSON.stringify(step.params, null, 2)}</pre>
              </div>
              
              {executionStatus === 'completed' && (
                <div className="command-result">
                  <span className="result-success">✓ Command executed successfully</span>
                </div>
              )}
              
              {executionStatus === 'failed' && step.error && (
                <div className="command-result">
                  <span className="result-error">✗ Error: {step.error}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InlineExecutionWindow;