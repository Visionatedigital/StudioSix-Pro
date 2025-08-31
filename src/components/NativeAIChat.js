/**
 * Native AI Chat Component
 * 
 * Direct integration with StudioSix native CAD engine
 * Replaces WebSocket-based chat with direct API integration
 * Uses the original polished UI design with new native functionality
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PaperAirplaneIcon, SparklesIcon, CogIcon, EyeIcon, Bars3BottomLeftIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';
import InteractiveChatMessage from './chat/InteractiveChatMessage';
import aiCommandExecutor from '../services/AICommandExecutor';
import standaloneCADEngine from '../services/StandaloneCADEngine';
import aiService from '../services/AIService';
import AgentManager from '../services/AgentManager';
import aiSettingsService from '../services/AISettingsService';
import subscriptionService from '../services/SubscriptionService';
import tokenUsageService from '../services/TokenUsageService';
import CommandExecutionWindow from './CommandExecutionWindow';
import InlineExecutionWindow from './InlineExecutionWindow';
import AnimatedMessage from './AnimatedMessage';
import CompletionSummary from './CompletionSummary';
import eventManager from '../services/EventManager';

const NativeAIChat = ({ 
  // App state integration
  selectedTool,
  selectedObjects = new Set(),
  viewMode,
  currentFloor,
  projectTree,
  onToolChange,
  onObjectSelect,
  onViewModeChange,
  onThemeChange,
  onFloorChange,
  theme = 'dark',
  // Initial prompt from project creation
  initialPrompt = null,
  onInitialPromptProcessed = null
}) => {
  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showContext, setShowContext] = useState(false);
  
  // AI settings state
  const [chatSettings, setChatSettings] = useState(aiSettingsService.getChatSettings());
  const [mode, setMode] = useState(chatSettings.systemPrompt);
  const [selectedModel, setSelectedModel] = useState(chatSettings.model);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState({ openai: false, claude: false });
  
  // Subscription state
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [usageWarnings, setUsageWarnings] = useState([]);
  const [isNearLimit, setIsNearLimit] = useState(false);
  
  // Voice transcription state
  const [isListening, setIsListening] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState(null);
  const [speechRecognitionAvailable, setSpeechRecognitionAvailable] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  // Sequential execution state
  const [agentManager, setAgentManager] = useState(null);
  const [currentExecutionPlan, setCurrentExecutionPlan] = useState(null);
  const [showExecutionWindow, setShowExecutionWindow] = useState(false);
  const [executionMode, setExecutionMode] = useState('sequential'); // default to agentic sequential mode
  
  // Autonomous agent state
  const [isAutonomousEnabled, setIsAutonomousEnabled] = useState(false);
  const [activeAutonomousRun, setActiveAutonomousRun] = useState(null);
  const [autonomousSocket, setAutonomousSocket] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);
  
  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastUserMessageRef = useRef('');
  const autonomousFallbackTimerRef = useRef(null);
  const autonomousFallbackTriggeredRef = useRef(false);
  const autonomousLastEventRef = useRef(0);
  const runListenersRef = useRef(new Map());

  // Initialize AgentManager and speech recognition
  useEffect(() => {
    // Initialize AgentManager with CAD engine
    const manager = new AgentManager(standaloneCADEngine);
    
    // Set up callbacks for execution progress
    manager.onStepUpdate = (step, plan) => {
      console.log('🔧 AgentManager: Step update:', step.title, step.status);
      setCurrentExecutionPlan(plan);
    };
    
    manager.onPlanComplete = (plan) => {
      console.log('🎉 AgentManager: Plan completed:', plan.title);
      setTimeout(() => {
        setShowExecutionWindow(false);
        setCurrentExecutionPlan(null);
      }, 3000); // Show completion for 3 seconds
    };
    
    setAgentManager(manager);
    
    // Listen for AI settings changes
    const unsubscribeSettings = aiSettingsService.onSettingsChange((settings) => {
      const newChatSettings = settings.aiChat;
      setChatSettings(newChatSettings);
      setMode(newChatSettings.systemPrompt);
      setSelectedModel(newChatSettings.model);
    });
    
    // Listen for subscription changes and update usage status
    const unsubscribeSubscription = subscriptionService.onSubscriptionChange(() => {
      updateSubscriptionStatus();
    });
    
    // Listen for token usage changes
    const unsubscribeUsage = tokenUsageService.onUsageChange(() => {
      updateSubscriptionStatus();
    });
    
    // Initial subscription status load
    updateSubscriptionStatus();
    
    // Check speech recognition availability
    const speechAvailable = ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
    setSpeechRecognitionAvailable(speechAvailable);
    
    // Cleanup listeners on unmount
    return () => {
      unsubscribeSettings();
      unsubscribeSubscription();
      unsubscribeUsage();
      // Detach any pending TaskWeaver listeners
      for (const [rid, listener] of runListenersRef.current.entries()) {
        try { eventManager.detach(rid, listener); } catch {}
      }
      runListenersRef.current.clear();
    };
  }, []);

  // Get current context for display (moved above to avoid TDZ issues)
  const currentContext = useMemo(() => {
    const objects = standaloneCADEngine.getAllObjects();
    return {
      selectedTool,
      selectedObjects: Array.from(selectedObjects),
      objectCount: objects.length,
      viewMode,
      currentFloor,
      hasSelection: selectedObjects.size > 0
    };
  }, [selectedTool, selectedObjects, viewMode, currentFloor]);

  // Handle sending messages (moved above effects that reference it)
  const handleSendMessage = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || isProcessing) return;

    // Add user message
    const userMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      message: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);
    lastUserMessageRef.current = message;

    // NEW: Route Agent vs Ask modes using local UI state
    const isAgentMode = true; // Force TaskWeaver backend regardless of UI toggle; UI retained for consistency

    if (isAgentMode) {
      try {
        const { runId } = await aiService.runTaskWeaver(message, {
          ...currentContext,
          recentMessages: messages.slice(-5),
          objects: standaloneCADEngine.getAllObjects(),
          uploadedFiles: uploadedFiles
        }, selectedModel);

        // Attach to TaskWeaver event stream via EventManager and reflect in chat
        const listener = (ev) => {
          try {
            if (!ev || !ev.type) return;
            if (ev.type === 'plan') {
              setMessages(prev => [...prev, {
                id: `plan_${Date.now()}`,
                type: 'ai',
                message: `📋 Plan: ${ev.summary || 'Plan created.'}`,
                timestamp: new Date().toISOString(),
                success: true
              }]);
            } else if (ev.type === 'act' && ev.status === 'start') {
              setMessages(prev => [...prev, {
                id: `act_${Date.now()}`,
                type: 'ai',
                message: `⚡ Executing ${ev.tool}`,
                timestamp: new Date().toISOString(),
                success: true
              }]);
            } else if (ev.type === 'act' && ev.status === 'result') {
              const ok = ev.result?.ok !== false;
              setMessages(prev => [...prev, {
                id: `act_res_${Date.now()}`,
                type: 'ai',
                message: ok ? `✅ ${ev.tool} completed` : `❌ ${ev.tool} failed` ,
                timestamp: new Date().toISOString(),
                success: ok
              }]);
            } else if (ev.type === 'done') {
              setMessages(prev => [...prev, {
                id: `done_${Date.now()}`,
                type: 'ai',
                message: ev.status === 'success' ? '✅ Done' : `❌ ${ev.status}`,
                timestamp: new Date().toISOString(),
                success: ev.status === 'success'
              }]);
              // Detach listener when done
              const l = runListenersRef.current.get(runId);
              if (l) {
                try { eventManager.detach(runId, l); } catch {}
                runListenersRef.current.delete(runId);
              }
            }
          } catch {}
        };
        eventManager.attach(runId, listener);
        runListenersRef.current.set(runId, listener);

        setIsProcessing(false);
        return;
      } catch (e) {
        // Fallback to sequential execution if agent backend unavailable
        console.warn('Agent backend unavailable, falling back to sequential:', e.message);
        setIsProcessing(false);
        return handleSequentialExecution(message);
      }
    }

    // Ask mode (existing chat path)
    try {
      // Check usage limits before making request
      try {
        aiSettingsService.trackUsage('chat');
      } catch (usageError) {
        throw new Error(`Usage limit exceeded: ${usageError.message}`);
      }

      // Get enhanced context for AI processing
      const enhancedContext = {
        ...currentContext,
        viewport: aiCommandExecutor.getViewportContext(),
        recentMessages: messages.slice(-5), // Last 5 messages for context
        objects: standaloneCADEngine.getAllObjects(),
        uploadedFiles: uploadedFiles
      };

      // Process files for AI context if any are uploaded
      let processedFiles = [];
      if (uploadedFiles.length > 0) {
        processedFiles = await aiService.processUploadedFiles(uploadedFiles);
      }

      // Use current settings for the AI request
      const currentSettings = aiSettingsService.getChatSettings();
      const systemPrompt = currentSettings.systemPrompt === 'custom' ? currentSettings.customSystemPrompt : currentSettings.systemPrompt;

      // First, get AI response using the selected model and mode from settings
      const aiResponse = await aiService.sendMessage(
        message,
        currentSettings.model,
        currentSettings.systemPrompt,
        {
          ...enhancedContext,
          processedFiles
        }
      );

      // Add AI response to messages
      const aiMessage = {
        id: `ai_${Date.now()}`,
        type: 'ai',
        message: aiResponse.message,
        timestamp: new Date().toISOString(),
        model: aiResponse.model,
        provider: aiResponse.provider,
        usage: aiResponse.usage
      };

      setMessages(prev => [...prev, aiMessage]);

      // Then, try to parse and execute commands from the response content
      await handleSequentialExecution(message);
      
    } catch (error) {
      console.error('❌ Error in AI processing:', error);
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        type: 'system',
        message: `❌ ${error.message}`,
        timestamp: new Date().toISOString(),
        success: false
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [inputValue, isProcessing, messages, currentContext, uploadedFiles, selectedModel, mode]);

  // Handle initial prompt from project creation
  useEffect(() => {
    if (initialPrompt && !isProcessing) {
      console.log('🚀 NativeAIChat: Processing initial prompt from project creation:', initialPrompt);
      
      // Set the prompt in the input field
      setInputValue(initialPrompt);
      
      // Add a brief delay to ensure the component is fully initialized
      const timer = setTimeout(() => {
        handleSendMessage();
        // Notify parent that we've processed the initial prompt
        if (onInitialPromptProcessed) {
          onInitialPromptProcessed();
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, isProcessing, onInitialPromptProcessed, handleSendMessage]);

  // Update subscription status and usage warnings
  const updateSubscriptionStatus = useCallback(() => {
    try {
      const status = aiService.getSubscriptionStatus();
      const warnings = tokenUsageService.getUsageWarnings();
      
      setSubscriptionStatus(status);
      setUsageWarnings(warnings);
      
      // Check if user is near limits (75%+)
      const nearLimit = status.usage.aiTokens.percentage > 75 || 
                       status.usage.imageRenders.percentage > 75;
      setIsNearLimit(nearLimit);
      
    } catch (error) {
      console.error('Failed to update subscription status:', error);
    }
  }, []);

  // Removed automatic system notifications for cleaner conversational experience
  // Users can chat with AI without constant status updates

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Update AI command executor with current context
  useEffect(() => {
    aiCommandExecutor.updateContext({
      selectedTool,
      selectedObjects,
      viewMode,
      currentFloor,
      projectTree
    });
  }, [selectedTool, selectedObjects, viewMode, currentFloor, projectTree]);

  // Handle AI command executor events
  useEffect(() => {
    const handleMessageProcessed = (response) => {
      // Process any actions returned by the AI
      if (response.actions) {
        response.actions.forEach(action => {
          switch (action.type) {
            case 'tool_selected':
              onToolChange?.(action.toolName);
              break;
            case 'object_created':
              // Object is already created by the CAD engine
              // Just update UI if needed
              break;
            case 'viewport_change':
              onViewModeChange?.(action.viewMode);
              break;
            case 'viewport_action':
              // Handle viewport actions like zoom
              console.log('Viewport action:', action.action);
              break;
            case 'theme_change':
              onThemeChange?.(action.theme);
              break;
            case 'project_action':
              if (action.action === 'switch_floor' && action.floorName) {
                onFloorChange?.(action.floorName);
              }
              console.log('Project action:', action.action, action);
              break;
            case 'selection_action':
              // Handle selection actions
              if (action.action === 'clear_selection') {
                onObjectSelect?.(null);
              }
              break;
            case 'viewport_update':
              // Handle viewport updates if needed
              break;
            default:
              // No action needed for unknown action types
              break;
          }
        });
      }
    };

    aiCommandExecutor.addEventListener('message_processed', handleMessageProcessed);
    
    return () => {
      aiCommandExecutor.removeEventListener('message_processed', handleMessageProcessed);
    };
  }, [onToolChange, onViewModeChange, onObjectSelect, onThemeChange, onFloorChange]);

  // CAD engine integration for AI commands (without automatic notifications)
  // AI can still execute commands and get feedback, but won't spam the chat with status updates

  // (currentContext defined above)

  // Check if message should use sequential execution
  const shouldUseSequentialExecution = useCallback((message) => {
    if (executionMode === 'traditional') return false;
    if (executionMode === 'sequential') return true;
    
    // Auto-detect based on message content
    const sequentialKeywords = [
      'create a room', 'build a room', 'make a room',
      'create a building', 'build a house', 'make a house',
      'create a', 'build a', 'make a',
      'by', 'x', '×', 'meter', 'metre', 'm '
    ];
    
    const normalizedMessage = message.toLowerCase();
    return sequentialKeywords.some(keyword => normalizedMessage.includes(keyword));
  }, [executionMode]);

  // Handle sequential execution
  const handleSequentialExecution = useCallback(async (message) => {
    console.log('🚀 Using intelligent sequential execution for:', message);
    
    try {
      // Parse request into execution plan using intelligent NLP
      const plan = await agentManager.parseRequest(message, {
        selectedTool,
        selectedObjects: Array.from(selectedObjects),
        viewMode,
        currentFloor
      });
      // Guard: ensure plan has actionable steps
      if (!plan?.steps || plan.steps.length === 0) {
        setMessages(prev => [...prev, {
          id: `warn_${Date.now()}`,
          type: 'ai',
          message: '⚠️ I could not generate a valid plan from that request. Please try specifying dimensions, e.g., "Create a 8m by 6m two-bedroom house".',
          timestamp: new Date().toISOString(),
          success: false
        }]);
        return;
      }
      
      setCurrentExecutionPlan(plan);
      
      // Add initial AI response explaining the plan
      const planResponse = {
        id: `ai_${Date.now()}`,
        type: 'ai',
        message: `${plan.description}\n\nI'll execute this in ${plan.totalSteps} steps:`,
        timestamp: new Date().toISOString(),
        success: true,
        isSequentialExecution: true,
        confidence: plan.confidence
      };
      
      setMessages(prev => [...prev, planResponse]);
      
      // Start the plan
      agentManager.executePlan(plan);
      
      // Execute first step after a short delay
      setTimeout(() => {
        executeNextStepSequentially(plan, 0);
      }, 1000);
      
    } catch (error) {
      console.error('❌ Sequential execution failed:', error);
      
      // Fallback to basic response
      const errorResponse = {
        id: `ai_${Date.now()}`,
        type: 'ai',
        message: `I encountered an issue understanding your request. Let me create a basic structure instead.`,
        timestamp: new Date().toISOString(),
        success: false
      };
      
      setMessages(prev => [...prev, errorResponse]);
    }
  }, [agentManager, selectedTool, selectedObjects, viewMode, currentFloor]);

  // Execute steps one by one with intermediate messages
  const executeNextStepSequentially = useCallback(async (plan, stepIndex) => {
    if (stepIndex >= plan.steps.length) {
      // All steps completed - show detailed summary
      const completionSummary = agentManager.generateCompletionSummary(plan);
      
      const completionMessage = {
        id: `ai_${Date.now()}`,
        type: 'ai_completion',
        sentences: completionSummary,
        timestamp: new Date().toISOString(),
        success: true
      };
      setMessages(prev => [...prev, completionMessage]);
      return;
    }

    const step = plan.steps[stepIndex];
    const roomType = agentManager.extractRoomType(currentExecutionPlan?.title || 'room');
    
    // Get detailed step description
    const stepDescriptions = agentManager.getStepDescription(step, stepIndex, roomType);
    
    // Add AI message with animated detailed explanation
    const stepMessage = {
      id: `ai_${Date.now()}`,
      type: 'ai_animated',
      sentences: stepDescriptions,
      timestamp: new Date().toISOString(),
      success: true
    };
    
    setMessages(prev => [...prev, stepMessage]);
    
    // Wait for animation to complete before showing execution window
    setTimeout(() => {
      // Add inline execution window for this step
      const executionMessage = {
        id: `execution_${Date.now()}`,
        type: 'execution',
        step: { ...step, status: 'executing' },
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, executionMessage]);
      
      // Start executing the actual step
      executeStepWithTiming(executionMessage, plan, stepIndex);
    }, stepDescriptions.length * 800 + 200); // Reduced buffer from 500ms to 200ms
  }, [agentManager, currentExecutionPlan]);

  // Separate function to handle step execution with timing
  const executeStepWithTiming = useCallback(async (executionMessage, plan, stepIndex) => {
    // Execute the step
    try {
      const executedStep = await agentManager.executeNextStep();
      
      if (executedStep) {
        // Update the execution window in messages
        setMessages(prev => prev.map(msg => 
          msg.id === executionMessage.id 
            ? { ...msg, step: { ...executedStep, status: executedStep.status } }
            : msg
        ));
        
        // Continue to next step after a brief pause
        setTimeout(() => {
          executeNextStepSequentially(plan, stepIndex + 1);
        }, 800);
      }
    } catch (error) {
      console.error('Step execution failed:', error);
      const step = plan.steps[stepIndex];
      // Update execution window to show error
      setMessages(prev => prev.map(msg => 
        msg.id === executionMessage.id 
          ? { ...msg, step: { ...step, status: 'failed', error: error.message } }
          : msg
      ));
    }
  }, [agentManager]);

  // (previous handleSendMessage moved above)

  // Handle autonomous agent execution
  const handleAutonomousExecution = useCallback(async (message) => {
    console.log('🤖 Using autonomous agent execution for:', message);
    
    try {
      // Enhanced context for autonomous agent
      const enhancedContext = {
        ...currentContext,
        viewport: aiCommandExecutor.getViewportContext(),
        recentMessages: messages.slice(-5),
        objects: standaloneCADEngine.getAllObjects(),
        selectedObjects: Array.from(selectedObjects),
        viewMode,
        currentFloor
      };

      // Call autonomous agent API (backend server)
      const { getApiBase, getWebSocketBase } = require('../config/apiBase');
      const backendUrl = getApiBase();
      const response = await fetch(`${backendUrl}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: message,
          context: enhancedContext,
          overrides: {
            maxSteps: 8,
            approvalMode: 'destructive',
            enableCritic: true,
            enableLearning: true
          },
          userId: 'current-user' // Would be actual user ID in production
        })
      });

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.ok) {
        setActiveAutonomousRun(result.runId);
        
        // Connect to WebSocket for real-time updates
        setupAutonomousWebSocket(result.runId);
        
        // Add initial response
        const autonomousMessage = {
          id: `autonomous_${Date.now()}`,
          type: 'ai',
          message: `🤖 **Autonomous Agent Started**\n\nI'll work on "${message}" autonomously with plan→act→observe→reflect capability. You'll see real-time progress and can approve destructive actions.`,
          timestamp: new Date().toISOString(),
          success: true,
          isAutonomous: true,
          runId: result.runId
        };
        
        setMessages(prev => [...prev, autonomousMessage]);
        // Fallback: if no WS opens within 2500ms, switch to sequential plan
        autonomousFallbackTriggeredRef.current = false;
        if (autonomousFallbackTimerRef.current) clearTimeout(autonomousFallbackTimerRef.current);
        autonomousFallbackTimerRef.current = setTimeout(() => {
          if (!autonomousSocket && !autonomousFallbackTriggeredRef.current) {
            autonomousFallbackTriggeredRef.current = true;
            console.info('ℹ️ Autonomous WS not available, falling back to sequential execution');
            handleSequentialExecution(lastUserMessageRef.current);
          }
        }, 2500);
      }
      
    } catch (error) {
      console.error('❌ Autonomous execution failed:', error);
      
      const errorMessage = {
        id: `error_${Date.now()}`,
        type: 'ai',
        message: `❌ Autonomous agent failed to start: ${error.message}`,
        timestamp: new Date().toISOString(),
        success: false
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [currentContext, messages, selectedObjects, viewMode, currentFloor]);

  // Setup WebSocket for autonomous agent progress
  const setupAutonomousWebSocket = useCallback((runId) => {
    try {
      const { getWebSocketBase } = require('../config/apiBase');
      const wsUrl = `${getWebSocketBase()}/ws/agent?runId=${runId}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('📡 Connected to autonomous agent WebSocket');
        setAutonomousSocket(ws);
        if (autonomousFallbackTimerRef.current) {
          clearTimeout(autonomousFallbackTimerRef.current);
          autonomousFallbackTimerRef.current = null;
        }
        // Start inactivity fallback: if no events within 3.5s, switch to sequential
        autonomousLastEventRef.current = Date.now();
        setTimeout(() => {
          const idleMs = Date.now() - autonomousLastEventRef.current;
          if (!autonomousFallbackTriggeredRef.current && idleMs > 3000) {
            autonomousFallbackTriggeredRef.current = true;
            console.info('ℹ️ Autonomous WS idle, falling back to sequential');
            handleSequentialExecution(lastUserMessageRef.current);
          }
        }, 3500);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          autonomousLastEventRef.current = Date.now();
          handleAutonomousEvent(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('📡 Disconnected from autonomous agent WebSocket');
        setAutonomousSocket(null);
        if (!autonomousFallbackTriggeredRef.current && activeAutonomousRun) {
          autonomousFallbackTriggeredRef.current = true;
          handleSequentialExecution(lastUserMessageRef.current);
        }
      };
      
      ws.onerror = (error) => {
        console.error('📡 WebSocket error:', error);
        if (!autonomousFallbackTriggeredRef.current && activeAutonomousRun) {
          autonomousFallbackTriggeredRef.current = true;
          handleSequentialExecution(lastUserMessageRef.current);
        }
      };
      
    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
    }
  }, []);

  // Handle autonomous agent events from WebSocket
  const handleAutonomousEvent = useCallback((event) => {
    const { type, runId } = event;
    
    if (runId !== activeAutonomousRun) return;
    
    switch (type) {
      case 'plan':
        const planMessage = {
          id: `plan_${Date.now()}`,
          type: 'ai',
          message: `📋 **Plan Generated**\n\n${event.summary}\n\nSteps: ${event.steps?.map(s => `• ${s.title || s.action}`).join('\n') || 'See progress below'}`,
          timestamp: new Date().toISOString(),
          success: true,
          isAutonomous: true
        };
        setMessages(prev => [...prev, planMessage]);
        break;
        
      case 'act':
        const actMessage = {
          id: `act_${Date.now()}`,
          type: 'ai',
          message: `⚡ **Step ${event.step}**: Using ${event.tool}`,
          timestamp: new Date().toISOString(),
          success: true,
          isAutonomous: true
        };
        setMessages(prev => [...prev, actMessage]);
        break;
        
      case 'critic':
        if (event.verdict === 'failed') {
          const criticMessage = {
            id: `critic_${Date.now()}`,
            type: 'ai',
            message: `🔍 **Critic**: ${event.reason} - Replanning...`,
            timestamp: new Date().toISOString(),
            success: false,
            isAutonomous: true
          };
          setMessages(prev => [...prev, criticMessage]);
        }
        break;
        
      case 'approval-request':
        setPendingApproval({
          runId: event.runId,
          approvalId: event.approvalId,
          action: event.action
        });
        break;
        
      case 'done':
        const doneMessage = {
          id: `done_${Date.now()}`,
          type: 'ai',
          message: event.status === 'success' ? 
            `✅ **Autonomous execution completed successfully!**\n\nDuration: ${Math.round(event.duration / 1000)}s` :
            `❌ **Autonomous execution ${event.status}**: ${event.error || event.reason}`,
          timestamp: new Date().toISOString(),
          success: event.status === 'success',
          isAutonomous: true
        };
        setMessages(prev => [...prev, doneMessage]);
        
        // Cleanup
        setActiveAutonomousRun(null);
        setPendingApproval(null);
        if (autonomousSocket) {
          autonomousSocket.close();
        }
        break;
        
      default:
        console.log('Unhandled autonomous event:', event);
    }
  }, [activeAutonomousRun, autonomousSocket]);

  // Handle approval response
  const handleApprovalResponse = useCallback(async (approved, reason = null) => {
    if (!pendingApproval) return;
    
    try {
      const { getApiBase } = require('../config/apiBase');
      const backendUrl = getApiBase();
      await fetch(`${backendUrl}/api/agent/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: pendingApproval.runId,
          approved,
          reason
        })
      });
      
      setPendingApproval(null);
      
    } catch (error) {
      console.error('Failed to send approval:', error);
    }
  }, [pendingApproval]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Clear chat history
  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((e) => {
    const files = Array.from(e.target.files);
    
    files.forEach((file) => {
      const reader = new FileReader();
      const fileId = `file_${Date.now()}_${Math.random()}`;
      const isImage = file.type.startsWith('image/');
      const isCADFile = ['.skp', '.ifc', '.step', '.stp', '.obj', '.dae', '.ply', '.stl'].some(
        ext => file.name.toLowerCase().endsWith(ext)
      );
      
      const fileData = {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        isImage,
        isCADFile,
        extension: file.name.split('.').pop()?.toLowerCase()
      };
      
      if (isImage) {
        reader.onload = (e) => {
          fileData.preview = e.target.result;
          setUploadedFiles(prev => [...prev, fileData]);
        };
        reader.readAsDataURL(file);
      } else {
        setUploadedFiles(prev => [...prev, fileData]);
      }
    });
    
    // Clear the input
    e.target.value = '';
  }, []);

  // Remove uploaded file
  const removeFile = useCallback((fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // Configure speech recognition for real-time transcription
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsListening(true);
        setInterimTranscript('');
      };
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Update the input field with final transcript
        if (finalTranscript) {
          console.log('🎤 Final transcript:', finalTranscript);
          setInputValue(prev => prev + finalTranscript);
          setInterimTranscript('');
        } else {
          // Show interim results
          setInterimTranscript(interimTranscript);
        }
      };
      
      recognition.onerror = (event) => {
        console.error('🎤 Speech recognition error:', event.error);
        setIsListening(false);
        setInterimTranscript('');
        
        let errorMsg = 'Voice recognition failed. Please try again.';
        
        switch (event.error) {
          case 'network':
            errorMsg = 'Network error. Speech recognition requires internet connection.';
            break;
          case 'not-allowed':
            errorMsg = 'Microphone access denied. Please allow microphone permissions.';
            break;
          case 'no-speech':
            errorMsg = 'No speech detected. Please speak clearly.';
            break;
          case 'audio-capture':
            errorMsg = 'Audio capture failed. Please check your microphone.';
            break;
          case 'service-not-allowed':
            errorMsg = 'Speech recognition service not allowed. Try again.';
            break;
        }
        
        const errorMessage = {
          id: `voice_error_${Date.now()}`,
          type: 'system',
          message: `🎤 ${errorMsg}`,
          timestamp: new Date().toISOString(),
          success: false
        };
        setMessages(prev => [...prev, errorMessage]);
      };
      
      recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setIsListening(false);
        setInterimTranscript('');
      };
      
      setSpeechRecognition(recognition);
      setSpeechRecognitionAvailable(true);
    } else {
      console.warn('🎤 Speech recognition not supported in this browser');
      setSpeechRecognitionAvailable(false);
    }
  }, []);

  // Voice transcription functions
  const startListening = useCallback(() => {
    if (speechRecognition && !isListening) {
      console.log('🎤 Starting speech recognition...');
      try {
        speechRecognition.start();
      } catch (error) {
        console.error('🎤 Failed to start speech recognition:', error);
        // Removed automatic error message to keep chat clean
      }
    }
  }, [speechRecognition, isListening]);

  const stopListening = useCallback(() => {
    if (speechRecognition && isListening) {
      console.log('🎤 Stopping speech recognition...');
      speechRecognition.stop();
    }
  }, [speechRecognition, isListening]);

  // Render individual message using the original InteractiveChatMessage component
  const renderMessage = useCallback((message) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const isExecution = message.type === 'execution';
    const isAnimated = message.type === 'ai_animated';
    const isCompletion = message.type === 'ai_completion';
    
    // For completion summary messages, render with CompletionSummary component
    if (isCompletion) {
      return (
        <div key={message.id} className="flex justify-start mb-3">
          <div className="p-4 rounded-lg w-full max-w-[95%] text-gray-100 bg-gradient-to-br from-green-900/20 to-blue-900/20 border border-green-800/30">
            <CompletionSummary 
              summaryLines={message.sentences}
              className="text-sm"
            />
            <div className="text-xs opacity-60 mt-3 pt-3 border-t border-gray-700/50">
              {message.timestamp}
            </div>
          </div>
        </div>
      );
    }

    // For animated AI messages, render with AnimatedMessage component
    if (isAnimated) {
      return (
        <div key={message.id} className="flex justify-start mb-1">
          <div className="p-4 rounded-lg w-full max-w-[95%] text-gray-100">
            <AnimatedMessage 
              sentences={message.sentences}
              className="text-sm"
            />
            <div className="text-xs opacity-60 mt-2">
              {message.timestamp}
            </div>
          </div>
        </div>
      );
    }
    
    // For execution messages, render inline execution window
    if (isExecution) {
      return (
        <div key={message.id} className="flex justify-start mb-2 w-full">
          <div className="w-full max-w-[95%]">
            <InlineExecutionWindow
              step={message.step}
              isExecuting={message.step?.status === 'executing'}
              onStepComplete={() => {
                // Step completion is handled in executeNextStepSequentially
              }}
            />
          </div>
        </div>
      );
    }
    
    // For system messages, render them simply
    if (isSystem) {
      return (
        <div key={message.id} className="flex justify-center mb-2">
          <div className="bg-green-600/20 text-green-300 text-sm px-3 py-1 rounded-full text-center">
            {message.message}
          </div>
        </div>
      );
    }
    
    // Use the original InteractiveChatMessage component for AI and user messages
    return (
      <div key={message.id}>
        <InteractiveChatMessage
          message={message.message}
          isUser={isUser}
          timestamp={message.timestamp}
          stepData={null} // No step data for regular chat messages
          onExecuteStep={null}
          onSkipStep={null}
          onEditStep={null}
          onParameterChange={null}
          isExecuting={false}
          executionStatus={null}
        />
        {/* Show model info for AI messages */}
        {!isUser && message.model && message.provider && message.model !== 'system' && (
          <div className="flex justify-start ml-12 mt-1 mb-2">
            <div className="text-xs text-gray-500 bg-gray-800/30 px-2 py-1 rounded-full">
              {aiService.getModelDisplayName(message.model)} • {message.provider}
            </div>
          </div>
        )}
      </div>
    );
  }, []);

  return (
    <div className="h-full flex flex-col glass text-white overflow-hidden">
      {/* Enhanced Chat Header */}
      <div className="p-4 border-b border-gray-700/50 glass-light flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-studiosix-500 to-studiosix-700 rounded-lg flex items-center justify-center">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">
              <span>AI Assistant</span>
            </h3>
            <p className="text-xs text-gray-400">
              {aiService.getModelDisplayName(selectedModel)} • {mode} mode
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Context viewer toggle */}
          <button
            onClick={() => setShowContext(!showContext)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              showContext 
                ? 'bg-studiosix-500/20 text-studiosix-400' 
                : 'hover:bg-gray-700/50 text-gray-400 hover:text-white'
            }`}
            title="Show current context"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          
          {/* Clear chat button */}
          <button
            onClick={clearChat}
            className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-all duration-200"
            title="Clear chat history"
          >
            <Bars3BottomLeftIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Context Panel */}
      {showContext && (
        <div className="p-4 border-b border-gray-700/50 bg-gray-800/30 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">Tool:</span>
              <span className="text-studiosix-400 font-medium">
                {currentContext.selectedTool || 'none'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">View:</span>
              <span className="text-white font-medium">{currentContext.viewMode}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">Objects:</span>
              <span className="text-white font-medium">{currentContext.objectCount}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">Selected:</span>
              <span className="text-white font-medium">{currentContext.selectedObjects.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-studiosix-500 to-studiosix-700 rounded-full flex items-center justify-center">
              <SparklesIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">AI Assistant</h3>
              <p className="text-gray-400 text-sm max-w-sm">
                Ask me anything about your architectural project. I can help you create objects, modify designs, or answer questions.
              </p>
            </div>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        
        {/* AI Thinking Indicator */}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="glass-light p-4 rounded-lg max-w-[85%]">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-studiosix-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-studiosix-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-studiosix-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-sm text-gray-300">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Usage Status Indicator */}
      {subscriptionStatus && (isNearLimit || usageWarnings.length > 0) && (
        <div className="px-4 py-2 border-t border-gray-700/30">
          {usageWarnings.length > 0 ? (
            <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-2">
              <div className="text-xs text-yellow-300">
                ⚠️ {usageWarnings[0].message}
              </div>
            </div>
          ) : isNearLimit && (
            <div className="bg-orange-900/20 border border-orange-600/50 rounded-lg p-2">
              <div className="text-xs text-orange-300 flex items-center justify-between">
                <span>
                  📊 {subscriptionStatus.usage.aiTokens.percentage.toFixed(0)}% of monthly tokens used
                </span>
                <span className="text-studiosix-400">
                  {subscriptionStatus.tier}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Input Section - Restored Original Design */}
      <div className="p-4 border-t border-gray-700/50 glass-light space-y-3">
        {/* Mode and Model Selectors */}
        <div className="flex items-center space-x-2 text-xs">
          {/* Mode Selector */}
          <div className="flex items-center space-x-1">
            <span className="text-gray-400">∞</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="bg-slate-800/50 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-studiosix-500"
            >
              <option value="agent">Agent</option>
              <option value="ask">Ask</option>
            </select>
          </div>
          
          {/* Autonomous Agent Toggle */}
          <div className="flex items-center space-x-1">
            <span className="text-gray-400">🤖</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAutonomousEnabled}
                onChange={(e) => setIsAutonomousEnabled(e.target.checked)}
                className="sr-only"
                disabled={activeAutonomousRun}
              />
              <div className={`w-8 h-4 rounded-full transition-colors ${
                isAutonomousEnabled ? 'bg-studiosix-500' : 'bg-gray-600'
              } ${activeAutonomousRun ? 'opacity-50' : ''}`}>
                <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-200 transform ${
                  isAutonomousEnabled ? 'translate-x-4' : 'translate-x-0.5'
                } mt-0.5`}></div>
              </div>
              <span className={`ml-1 text-xs ${isAutonomousEnabled ? 'text-studiosix-400' : 'text-gray-400'}`}>
                Auto {activeAutonomousRun && <span className="animate-pulse">●</span>}
              </span>
            </label>
          </div>
          
          {/* Model Selector */}
          <div className="flex items-center space-x-1">
            <span className="text-gray-400">⚙️</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-800/50 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-studiosix-500"
            >
              <optgroup label="OpenAI">
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-4-vision">GPT-4 Vision</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </optgroup>
              <optgroup label="Anthropic">
                <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                <option value="claude-3-haiku">Claude 3 Haiku</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* File Previews */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 bg-slate-800/30 rounded-lg">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="relative group">
                {file.preview ? (
                  <div className="relative">
                    <img 
                      src={file.preview} 
                      alt={file.name}
                      className="w-12 h-12 object-cover rounded border border-gray-600"
                    />
                    <button
                      onClick={() => removeFile(file.id)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className={`relative flex items-center space-x-1 rounded px-2 py-1 ${
                    file.isCADFile 
                      ? 'bg-blue-700/30 border border-blue-500' 
                      : 'bg-slate-700'
                  }`}>
                    <div className="flex items-center space-x-1">
                      <span className={`text-xs truncate max-w-20 ${
                        file.isCADFile ? 'text-blue-200' : 'text-gray-300'
                      }`}>
                        {file.name}
                      </span>
                      {file.isCADFile && (
                        <span className="text-[10px] text-green-400 font-medium">3D</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-red-400 hover:text-red-300 ml-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Quick Action Buttons - Horizontal Scrollable */}
        <div className="overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700/20 hover:scrollbar-thumb-gray-600/30">
          <div className="flex gap-2 pb-1 min-w-max">
            {[
              'Create a room 3m by 5m', 
              'Add a 4x4m office', 
              'What do you see in my viewport?',
              'Analyze my design', 
              'Add a modern chair',
              'Add a wooden table',
              'Add a new floor',
              'List all floors',
              'Create a wall', 
              'Add a door', 
              'Show 2D view', 
              'List objects'
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInputValue(suggestion)}
                className="px-3 py-1 text-xs rounded-full bg-gray-700/50 text-gray-300 hover:bg-studiosix-600/50 hover:text-white transition-all duration-200 backdrop-blur-sm whitespace-nowrap flex-shrink-0"
                disabled={isProcessing || isListening}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Autonomous Agent Approval Dialog */}
        {pendingApproval && (
          <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-yellow-900 text-sm font-bold">!</span>
              </div>
              <div className="flex-1">
                <div className="text-sm text-yellow-200 font-medium mb-1">
                  🤖 Agent requesting approval for destructive action:
                </div>
                <div className="text-sm text-gray-300 mb-3">
                  <strong>{pendingApproval.action?.tool || 'Unknown action'}</strong>
                  {pendingApproval.action?.args && (
                    <div className="text-xs text-gray-400 mt-1">
                      {JSON.stringify(pendingApproval.action.args, null, 2).slice(0, 100)}...
                    </div>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleApprovalResponse(true)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleApprovalResponse(false, 'User rejected')}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Input Form - Original Clean Design */}
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex space-x-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe what you want to build..."
              className={`w-full bg-slate-800/50 border border-gray-600 rounded-lg py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-studiosix-500 focus:ring-1 focus:ring-studiosix-500 ${
                isListening || interimTranscript ? 'pl-24 pr-24' : 'px-3 pr-24'
              }`}
              disabled={isProcessing}
            />
            
            {/* Voice Listening Indicator */}
            {isListening && (
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400 font-medium">Listening...</span>
              </div>
            )}
            
            {/* Interim Transcript Overlay */}
            {interimTranscript && (
              <div className="absolute left-3 right-24 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <div className="bg-studiosix-500/20 text-studiosix-300 text-sm px-2 py-1 rounded backdrop-blur-sm">
                  <span className="opacity-60">{interimTranscript}</span>
                </div>
              </div>
            )}

            {/* File Upload, Voice, and Submit Buttons */}
            <div className="absolute right-1 top-1 flex space-x-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt,.skp,.ifc,.step,.stp,.obj,.dae,.ply,.stl"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Upload files"
                disabled={isProcessing || isListening}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              
              {/* Voice Transcription Button */}
              {speechRecognitionAvailable && (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`p-1.5 rounded transition-colors ${
                    isListening 
                      ? 'bg-green-600 hover:bg-green-700 text-white animate-pulse' 
                      : 'text-gray-400 hover:text-white hover:bg-slate-700'
                  }`}
                  title={isListening ? "Stop voice transcription" : "Start voice transcription"}
                  disabled={isProcessing}
                >
                  {isListening ? (
                    <StopIcon className="w-4 h-4" />
                  ) : (
                    <MicrophoneIcon className="w-4 h-4" />
                  )}
                </button>
              )}
              
              <button
                type="submit"
                disabled={(!inputValue.trim() && uploadedFiles.length === 0) || isProcessing || isListening}
                className="p-1.5 bg-studiosix-600 hover:bg-studiosix-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded transition-colors"
                title="Send message"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NativeAIChat;