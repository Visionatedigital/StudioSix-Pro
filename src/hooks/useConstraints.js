import { useState, useEffect, useCallback, useRef } from 'react';
import constraintService from '../services/constraintService';

/**
 * useConstraints Hook - Manages constraint state and operations with direct local integration
 * Provides a comprehensive interface for constraint management in React components
 */
const useConstraints = (options = {}) => {
  const {
    autoConnect = true,
    autoSolve = false,
    realTimeUpdates = true,
    debounceMs = 300 // Reduced for better local performance
  } = options;

  // State management
  const [constraints, setConstraints] = useState([]);
  const [entities, setEntities] = useState([]);
  const [selectedConstraints, setSelectedConstraints] = useState([]);
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [solverStatus, setSolverStatus] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [errors, setErrors] = useState([]);

  // Refs for cleanup and debouncing
  const unsubscribeRefs = useRef([]);
  const debounceTimeoutRef = useRef(null);

  // Initialize service and subscribe to events
  useEffect(() => {
    if (autoConnect) {
      initializeService();
    }

    return () => {
      cleanup();
    };
  }, [autoConnect]);

  // Initialize constraint service with direct local integration
  const initializeService = useCallback(async () => {
    try {
      setIsLoading(true);
      
      console.log('Initializing local constraint service...');
      
      // Initialize the local constraint service
      await constraintService.initialize();
      
      // Subscribe to real-time events
      if (realTimeUpdates) {
        subscribeToEvents();
      }
      
      // Load initial data
      await Promise.all([
        loadConstraints(),
        loadEntities(),
        loadSystemStatus()
      ]);
      
      setIsConnected(true);
      console.log('Local constraint service initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize constraint service:', error);
      addError('Failed to initialize constraint system');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [realTimeUpdates]);

  // Subscribe to real-time events from local constraint system
  const subscribeToEvents = useCallback(() => {
    // Connection status
    const unsubConnection = constraintService.subscribe('connection', (data) => {
      setIsConnected(data.status === 'connected');
    });

    // Constraint updates
    const unsubConstraintUpdated = constraintService.subscribe('constraintUpdated', (constraint) => {
      setConstraints(prev => prev.map(c => 
        c.id === constraint.id ? { ...c, ...constraint } : c
      ));
    });

    // Constraint creation
    const unsubConstraintCreated = constraintService.subscribe('constraintCreated', (constraint) => {
      setConstraints(prev => {
        // Avoid duplicates
        const exists = prev.find(c => c.id === constraint.id);
        if (exists) return prev;
        return [...prev, constraint];
      });
    });

    // Constraint deletion
    const unsubConstraintDeleted = constraintService.subscribe('constraintDeleted', (data) => {
      setConstraints(prev => prev.filter(c => c.id !== data.constraintId));
      setSelectedConstraints(prev => prev.filter(id => id !== data.constraintId));
    });

    // Constraint violations
    const unsubConstraintViolated = constraintService.subscribe('constraintViolated', (data) => {
      setConstraints(prev => prev.map(c => 
        c.id === data.constraintId ? { ...c, satisfied: false, violated: true } : c
      ));
    });

    // Constraint satisfaction
    const unsubConstraintSatisfied = constraintService.subscribe('constraintSatisfied', (data) => {
      setConstraints(prev => prev.map(c => 
        c.id === data.constraintId ? { ...c, satisfied: true, violated: false } : c
      ));
    });

    // Entity updates
    const unsubEntityUpdated = constraintService.subscribe('entityUpdated', (entity) => {
      setEntities(prev => prev.map(e => 
        e.id === entity.id ? { ...e, ...entity } : e
      ));
      
      // Auto-solve if enabled
      if (autoSolve) {
        debouncedSolve();
      }
    });

    // Entity creation
    const unsubEntityCreated = constraintService.subscribe('entityCreated', (entity) => {
      setEntities(prev => {
        // Avoid duplicates
        const exists = prev.find(e => e.id === entity.id);
        if (exists) return prev;
        return [...prev, entity];
      });
    });

    // Entity deletion
    const unsubEntityDeleted = constraintService.subscribe('entityDeleted', (data) => {
      setEntities(prev => prev.filter(e => e.id !== data.entityId));
      setSelectedEntities(prev => prev.filter(id => id !== data.entityId));
    });

    // Solver status updates
    const unsubSolverStatus = constraintService.subscribe('solverStatus', (status) => {
      setSolverStatus(status);
      setIsSolving(status.isRunning || false);
      
      // Update constraints and entities with solve results
      if (status.constraints) {
        setConstraints(prev => prev.map(constraint => {
          const solved = status.constraints.find(c => c.id === constraint.id);
          return solved ? { ...constraint, ...solved } : constraint;
        }));
      }
      
      if (status.entities) {
        setEntities(prev => prev.map(entity => {
          const solved = status.entities.find(e => e.id === entity.id);
          return solved ? { ...entity, ...solved } : entity;
        }));
      }
    });

    // System reset
    const unsubSystemReset = constraintService.subscribe('systemReset', () => {
      setConstraints([]);
      setEntities([]);
      setSelectedConstraints([]);
      setSelectedEntities([]);
      setSolverStatus(null);
      clearErrors();
    });

    // Error handling
    const unsubError = constraintService.subscribe('error', (data) => {
      addError(data.error?.message || 'Unknown error occurred');
    });

    // Store unsubscribe functions
    unsubscribeRefs.current = [
      unsubConnection,
      unsubConstraintUpdated,
      unsubConstraintCreated,
      unsubConstraintDeleted,
      unsubConstraintViolated,
      unsubConstraintSatisfied,
      unsubEntityUpdated,
      unsubEntityCreated,
      unsubEntityDeleted,
      unsubSolverStatus,
      unsubSystemReset,
      unsubError
    ];
  }, [autoSolve]);

  // Debounced solve function for auto-solving
  const debouncedSolve = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      solveConstraints();
    }, debounceMs);
  }, [debounceMs]);

  // Load constraints from local system
  const loadConstraints = useCallback(async (filters = {}) => {
    try {
      const constraintData = await constraintService.getConstraints(filters);
      setConstraints(constraintData.constraints || constraintData);
      return constraintData;
    } catch (error) {
      console.error('Failed to load constraints:', error);
      addError('Failed to load constraints');
      throw error;
    }
  }, []);

  // Load entities from local system
  const loadEntities = useCallback(async (filters = {}) => {
    try {
      const entityData = await constraintService.getEntities(filters);
      setEntities(entityData.entities || entityData);
      return entityData;
    } catch (error) {
      console.error('Failed to load entities:', error);
      addError('Failed to load entities');
      throw error;
    }
  }, []);

  // Load system status from local system
  const loadSystemStatus = useCallback(async () => {
    try {
      const status = await constraintService.getSystemStatus();
      setSystemStatus(status);
      return status;
    } catch (error) {
      console.error('Failed to load system status:', error);
      addError('Failed to load system status');
      throw error;
    }
  }, []);

  // Create a new constraint
  const createConstraint = useCallback(async (constraintData) => {
    try {
      setIsLoading(true);
      const newConstraint = await constraintService.createConstraint(constraintData);
      
      // Constraint will be added via event subscription
      // setConstraints(prev => [...prev, newConstraint]);
      
      // Auto-solve if enabled
      if (autoSolve) {
        debouncedSolve();
      }
      
      return newConstraint;
    } catch (error) {
      console.error('Failed to create constraint:', error);
      addError(`Failed to create constraint: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [autoSolve, debouncedSolve]);

  // Update an existing constraint
  const updateConstraint = useCallback(async (constraintId, updates) => {
    try {
      setIsLoading(true);
      const updatedConstraint = await constraintService.updateConstraint(constraintId, updates);
      
      // Constraint will be updated via event subscription
      // setConstraints(prev => prev.map(c => 
      //   c.id === constraintId ? { ...c, ...updatedConstraint } : c
      // ));
      
      // Auto-solve if enabled
      if (autoSolve) {
        debouncedSolve();
      }
      
      return updatedConstraint;
    } catch (error) {
      console.error('Failed to update constraint:', error);
      addError(`Failed to update constraint: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [autoSolve, debouncedSolve]);

  // Delete a constraint
  const deleteConstraint = useCallback(async (constraintId) => {
    try {
      setIsLoading(true);
      await constraintService.deleteConstraint(constraintId);
      
      // Constraint will be removed via event subscription
      // setConstraints(prev => prev.filter(c => c.id !== constraintId));
      // setSelectedConstraints(prev => prev.filter(id => id !== constraintId));
      
      // Auto-solve if enabled
      if (autoSolve) {
        debouncedSolve();
      }
      
    } catch (error) {
      console.error('Failed to delete constraint:', error);
      addError(`Failed to delete constraint: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [autoSolve, debouncedSolve]);

  // Create a new entity
  const createEntity = useCallback(async (type, properties) => {
    try {
      const newEntity = await constraintService.createEntity(type, properties);
      
      // Entity will be added via event subscription
      // setEntities(prev => [...prev, newEntity]);
      
      // Auto-solve if enabled
      if (autoSolve) {
        debouncedSolve();
      }
      
      return newEntity;
    } catch (error) {
      console.error('Failed to create entity:', error);
      addError(`Failed to create entity: ${error.message}`);
      throw error;
    }
  }, [autoSolve, debouncedSolve]);

  // Update entity properties
  const updateEntity = useCallback(async (entityId, updates) => {
    try {
      const updatedEntity = await constraintService.updateEntity(entityId, updates);
      
      // Entity will be updated via event subscription
      // setEntities(prev => prev.map(e => 
      //   e.id === entityId ? { ...e, ...updatedEntity } : e
      // ));
      
      // Auto-solve if enabled
      if (autoSolve) {
        debouncedSolve();
      }
      
      return updatedEntity;
    } catch (error) {
      console.error('Failed to update entity:', error);
      addError(`Failed to update entity: ${error.message}`);
      throw error;
    }
  }, [autoSolve, debouncedSolve]);

  // Delete an entity
  const deleteEntity = useCallback(async (entityId) => {
    try {
      await constraintService.deleteEntity(entityId);
      
      // Entity will be removed via event subscription
      // setEntities(prev => prev.filter(e => e.id !== entityId));
      // setSelectedEntities(prev => prev.filter(id => id !== entityId));
      
      // Auto-solve if enabled
      if (autoSolve) {
        debouncedSolve();
      }
      
    } catch (error) {
      console.error('Failed to delete entity:', error);
      addError(`Failed to delete entity: ${error.message}`);
      throw error;
    }
  }, [autoSolve, debouncedSolve]);

  // Solve constraints using local solver
  const solveConstraints = useCallback(async (options = {}) => {
    try {
      setIsSolving(true);
      clearErrors();
      
      const result = await constraintService.solveConstraints(options);
      
      // Results will be applied via event subscription
      setSolverStatus(result || {});
      
      return result;
    } catch (error) {
      console.error('Failed to solve constraints:', error);
      addError(`Failed to solve constraints: ${error.message}`);
      throw error;
    } finally {
      setIsSolving(false);
    }
  }, []);

  // Validate constraints
  const validateConstraints = useCallback(async (constraintIds = []) => {
    try {
      const validationResult = await constraintService.validateConstraints(constraintIds);
      
      // Update constraint validation status if needed
      if (validationResult.results) {
        setConstraints(prev => prev.map(constraint => {
          const validation = validationResult.results.find(v => v.constraintId === constraint.id);
          return validation ? { ...constraint, ...validation } : constraint;
        }));
      }
      
      return validationResult;
    } catch (error) {
      console.error('Failed to validate constraints:', error);
      addError(`Failed to validate constraints: ${error.message}`);
      throw error;
    }
  }, []);

  // Reset the entire system
  const resetSystem = useCallback(async () => {
    try {
      setIsLoading(true);
      await constraintService.resetSystem();
      
      // State will be cleared via event subscription
      // setConstraints([]);
      // setEntities([]);
      // setSelectedConstraints([]);
      // setSelectedEntities([]);
      // setSolverStatus(null);
      // clearErrors();
      
    } catch (error) {
      console.error('Failed to reset system:', error);
      addError(`Failed to reset system: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Export system data
  const exportSystem = useCallback(async (format = 'json') => {
    try {
      const blob = await constraintService.exportSystem(format);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `constraint-system-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Failed to export system:', error);
      addError(`Failed to export system: ${error.message}`);
      throw error;
    }
  }, []);

  // Import system data
  const importSystem = useCallback(async (file) => {
    try {
      setIsLoading(true);
      const result = await constraintService.importSystem(file);
      
      // Data will be loaded via event subscription after import
      // Re-load data to ensure UI is synchronized
      await Promise.all([
        loadConstraints(),
        loadEntities(),
        loadSystemStatus()
      ]);
      
      return result;
    } catch (error) {
      console.error('Failed to import system:', error);
      addError(`Failed to import system: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadConstraints, loadEntities, loadSystemStatus]);

  // Selection management
  const selectConstraint = useCallback((constraintId, multi = false) => {
    setSelectedConstraints(prev => {
      if (multi) {
        return prev.includes(constraintId) 
          ? prev.filter(id => id !== constraintId)
          : [...prev, constraintId];
      } else {
        return [constraintId];
      }
    });
  }, []);

  const selectEntity = useCallback((entityId, multi = false) => {
    setSelectedEntities(prev => {
      if (multi) {
        return prev.includes(entityId) 
          ? prev.filter(id => id !== entityId)
          : [...prev, entityId];
      } else {
        return [entityId];
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedConstraints([]);
    setSelectedEntities([]);
  }, []);

  // Error management
  const addError = useCallback((message) => {
    setErrors(prev => [...prev, {
      id: Date.now(),
      message,
      timestamp: new Date().toISOString()
    }]);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const removeError = useCallback((errorId) => {
    setErrors(prev => prev.filter(error => error.id !== errorId));
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Clear debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Unsubscribe from events
    unsubscribeRefs.current.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    unsubscribeRefs.current = [];
    
    // Cleanup service
    constraintService.cleanup();
  }, []);

  // Computed values
  const statistics = {
    totalConstraints: constraints.length,
    satisfiedConstraints: constraints.filter(c => c.satisfied).length,
    violatedConstraints: constraints.filter(c => !c.satisfied).length,
    totalEntities: entities.length,
    selectedConstraintCount: selectedConstraints.length,
    selectedEntityCount: selectedEntities.length
  };

  const constraintsByType = constraints.reduce((acc, constraint) => {
    acc[constraint.type] = (acc[constraint.type] || 0) + 1;
    return acc;
  }, {});

  // Performance metrics
  const performanceMetrics = constraintService.getPerformanceMetrics();
  const memoryUsage = constraintService.getMemoryUsage();

  // Return hook interface
  return {
    // State
    constraints,
    entities,
    selectedConstraints,
    selectedEntities,
    isLoading,
    isSolving,
    isConnected,
    solverStatus,
    systemStatus,
    errors,
    statistics,
    constraintsByType,
    performanceMetrics,
    memoryUsage,

    // Actions
    createConstraint,
    updateConstraint,
    deleteConstraint,
    createEntity,
    updateEntity,
    deleteEntity,
    solveConstraints,
    validateConstraints,
    resetSystem,
    exportSystem,
    importSystem,
    
    // Data loading
    loadConstraints,
    loadEntities,
    loadSystemStatus,
    
    // Selection
    selectConstraint,
    selectEntity,
    clearSelection,
    
    // Error management
    addError,
    clearErrors,
    removeError,
    
    // Service management
    initializeService,
    cleanup
  };
};

export default useConstraints; 