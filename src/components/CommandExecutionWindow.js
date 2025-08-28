/**
 * CommandExecutionWindow - Sequential Command Execution UI
 * 
 * Displays step-by-step execution progress similar to Cursor's interface
 */

import React, { useState, useEffect } from 'react';
import './CommandExecutionWindow.css';

const CommandExecutionWindow = ({ 
  plan, 
  isVisible, 
  onClose,
  onStepUpdate 
}) => {
  const [expandedSteps, setExpandedSteps] = useState(new Set());
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (plan && onStepUpdate) {
      onStepUpdate((step, updatedPlan) => {
        // Auto-expand currently executing step
        if (step.status === 'executing') {
          setExpandedSteps(prev => new Set([...prev, step.id]));
          setCurrentStep(step.number - 1);
        }
      });
    }
  }, [plan, onStepUpdate]);

  if (!isVisible || !plan) return null;

  const toggleStepExpanded = (stepId) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

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

  const completedSteps = plan.steps.filter(step => step.status === 'completed').length;
  const progressPercentage = (completedSteps / plan.totalSteps) * 100;

  return (
    <div className="command-execution-window">
      <div className="execution-header">
        <div className="execution-title">
          <h3>{plan.title}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="execution-description">
          {plan.description}
        </div>
        
        <div className="execution-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="progress-text">
            {completedSteps} of {plan.totalSteps} steps completed
          </div>
        </div>
      </div>

      <div className="execution-steps">
        {plan.steps.map((step, index) => (
          <div 
            key={step.id} 
            className={`execution-step ${step.status} ${expandedSteps.has(step.id) ? 'expanded' : ''}`}
          >
            <div 
              className="step-header"
              onClick={() => toggleStepExpanded(step.id)}
            >
              <div className="step-info">
                <span className="step-icon">{getStepIcon(step.status)}</span>
                <span className="step-number">Step {step.number}</span>
                <span className="step-title">{step.title}</span>
              </div>
              
              <div className="step-status">
                <span className="status-text">{getStepStatusText(step.status)}</span>
                {step.estimatedTime && step.status === 'pending' && (
                  <span className="estimated-time">~{step.estimatedTime}</span>
                )}
                <span className="expand-icon">
                  {expandedSteps.has(step.id) ? '⌄' : '›'}
                </span>
              </div>
            </div>

            {expandedSteps.has(step.id) && (
              <div className="step-content">
                <div className="step-description">
                  {step.description}
                </div>
                
                <div className="command-box">
                  <div className="command-header">
                    <span className="command-type">CAD</span>
                    <span className="command-action">{step.action}</span>
                    {step.status === 'executing' && (
                      <div className="execution-spinner">⟳</div>
                    )}
                  </div>
                  
                  <div className="command-params">
                    <pre>{JSON.stringify(step.params, null, 2)}</pre>
                  </div>
                  
                  {step.status === 'completed' && (
                    <div className="command-result">
                      <span className="result-success">✓ Command executed successfully</span>
                    </div>
                  )}
                  
                  {step.status === 'failed' && step.error && (
                    <div className="command-result">
                      <span className="result-error">✗ Error: {step.error}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="execution-footer">
        {plan.steps.every(step => step.status === 'completed') && (
          <div className="completion-message">
            🎉 All steps completed successfully! Your {plan.title.toLowerCase()} is ready.
          </div>
        )}
        
        {plan.steps.some(step => step.status === 'failed') && (
          <div className="error-message">
            ⚠️ Some steps failed. Please check the details above.
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandExecutionWindow;