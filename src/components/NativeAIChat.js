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
  theme = 'dark'
}) => {
  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showContext, setShowContext] = useState(false);
  
  // Original UI state
  const [mode, setMode] = useState('agent');
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState({ openai: false, claude: false });
  
  // Voice transcription state
  const [isListening, setIsListening] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState(null);
  const [speechRecognitionAvailable, setSpeechRecognitionAvailable] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize speech recognition availability only
  useEffect(() => {
    // Check speech recognition availability
    const speechAvailable = ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
    setSpeechRecognitionAvailable(speechAvailable);
    
    // Test AI connections on mount - non-blocking
    const testAIConnections = async () => {
      try {
        const results = await aiService.testConnections();
        setConnectionStatus(results);
        if (results.available !== false) {
          console.log('🔗 AI Connection Status:', results);
        } else {
          console.info('ℹ️ AI services unavailable - running in standalone mode');
        }
      } catch (error) {
        // Silently handle connection errors to prevent uncaught exceptions
        console.warn('⚠️ AI connection test failed:', error.message);
        setConnectionStatus({
          openai: false,
          claude: false,
          available: false,
          errors: { connection: error.message }
        });
      }
    };
    
    // Run async without blocking component mount
    testAIConnections();
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

  // Get current context for display
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

  // Handle sending messages
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

    try {
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

      // First, get AI response using the selected model and mode
      const aiResponse = await aiService.sendMessage(
        message, 
        selectedModel, 
        mode, 
        {
          ...enhancedContext,
          processedFiles
        }
      );

      // Then process the message through the command executor for actions
      let commandResponse = null;
      try {
        commandResponse = await aiCommandExecutor.processMessage(message, enhancedContext);
      } catch (cmdError) {
        console.warn('⚠️ Command executor warning:', cmdError.message);
        // Continue with AI response even if command processing fails
      }

      // Combine AI response with any command actions
      const combinedResponse = {
        id: `ai_${Date.now()}`,
        type: 'ai',
        message: aiResponse.message,
        timestamp: new Date().toISOString(),
        success: true,
        actions: commandResponse?.actions || [],
        model: aiResponse.model,
        provider: aiResponse.provider
      };

      setMessages(prev => [...prev, combinedResponse]);

      // Clear uploaded files after successful message
      if (uploadedFiles.length > 0) {
        setUploadedFiles([]);
      }

    } catch (error) {
      console.error('❌ Chat error:', error);
      
      const errorMessage = {
        id: `error_${Date.now()}`,
        type: 'ai',
        message: `❌ I encountered an error: ${error.message}. Please try again or switch to a different AI model.`,
        timestamp: new Date().toISOString(),
        success: false
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [inputValue, isProcessing, currentContext, messages, selectedModel, mode, uploadedFiles]);

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