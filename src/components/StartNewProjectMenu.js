import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  BuildingOffice2Icon,
  HomeIcon,
  BuildingStorefrontIcon,
  CommandLineIcon,
  CameraIcon,
  FolderOpenIcon,
  PlusIcon,
  SparklesIcon,
  DocumentTextIcon,
  RocketLaunchIcon,
  LightBulbIcon,
  ArrowRightIcon,
  ClockIcon,
  UserIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  StarIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import recentProjectsManager from '../utils/RecentProjectsManager';
import AnimatedPromptBox from './AnimatedPromptBox';
import autoSaveService from '../services/AutoSaveService';

const PROJECT_TEMPLATES = [
  {
    id: 'residential-home',
    title: 'Residential Home',
    description: 'Single or multi-family residential building design',
    icon: HomeIcon,
    color: 'bg-emerald-500',
    features: ['Floor plans', 'Room layouts', 'Standard fixtures'],
    complexity: 'Beginner',
    estimatedTime: '2-4 hours'
  },
  {
    id: 'commercial-office',
    title: 'Commercial Office',
    description: 'Modern office building with open spaces and meeting rooms',
    icon: BuildingOffice2Icon,
    color: 'bg-blue-500',
    features: ['Open offices', 'Meeting rooms', 'HVAC systems'],
    complexity: 'Intermediate',
    estimatedTime: '4-8 hours'
  },
  {
    id: 'retail-space',
    title: 'Retail Space',
    description: 'Store or shopping center with customer areas',
    icon: BuildingStorefrontIcon,
    color: 'bg-purple-500',
    features: ['Display areas', 'Storage', 'Checkout zones'],
    complexity: 'Intermediate',
    estimatedTime: '3-6 hours'
  },
  {
    id: 'custom-project',
    title: 'Custom Project',
    description: 'Start from scratch with AI assistance',
    icon: SparklesIcon,
    color: 'bg-studiosix-500',
    features: ['AI-guided design', 'Custom requirements', 'Flexible structure'],
    complexity: 'Any Level',
    estimatedTime: 'Variable'
  }
];

// Recent projects are now loaded dynamically from RecentProjectsManager

const StartNewProjectMenu = ({ onStartProject, onOpenExisting, user, onSignOut, onOpenRenderStudio }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    location: '',
    client: ''
  });
  
  // Recent projects state
  const [recentProjects, setRecentProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [recoveredProjects, setRecoveredProjects] = useState([]);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  const [openingProjectId, setOpeningProjectId] = useState(null);
  
  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', null
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef(null);

  // Project initialization loading state
  const [isInitializingProject, setIsInitializingProject] = useState(false);
  const [initializationProgress, setInitializationProgress] = useState(0);

  // Profile dropdown state
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get user display name
  const getUserDisplayName = () => {
    if (user?.user_metadata?.firstName && user?.user_metadata?.lastName) {
      return `${user.user_metadata.firstName} ${user.user_metadata.lastName}`;
    }
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    const name = getUserDisplayName();
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Load recent projects and check for recovery on component mount
  useEffect(() => {
    const loadProjectsAndCheckRecovery = async () => {
      try {
        setLoadingProjects(true);
        
        // Load recent projects
        const projects = await recentProjectsManager.getRecentProjectsForUI();
        setRecentProjects(projects);
        console.log('📋 Loaded recent projects:', projects.length);
        
        // Check for projects that need recovery (if user is available)
        if (user?.id) {
          const recovered = await autoSaveService.recoverUnsavedProjects(user.id);
          if (recovered.length > 0) {
            console.log('🔄 Found projects for recovery:', recovered.length);
            setRecoveredProjects(recovered);
            setShowRecoveryBanner(true);
          }
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
        setRecentProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjectsAndCheckRecovery();
  }, [user]);

  const handleTemplateSelect = (template) => {
    if (selectedTemplate?.id === template.id) {
      // Second click on already selected template - start the project
      if (template.id === 'custom-project') {
        setShowProjectForm(true);
      } else {
        handleStartProject();
      }
    } else {
      // First click - just select the template
      setSelectedTemplate(template);
    }
  };

  const handleStartProject = async () => {
    if (selectedTemplate && !isInitializingProject) {
      console.log('🚀 Starting project initialization...');
      setIsInitializingProject(true);
      setInitializationProgress(0);

      try {
        // Simulate app initialization steps with progress
        const initSteps = [
          { message: 'Setting up project structure...', duration: 500 },
          { message: 'Loading CAD engine...', duration: 800 },
          { message: 'Initializing 3D viewport...', duration: 600 },
          { message: 'Loading material library...', duration: 400 },
          { message: 'Preparing design tools...', duration: 300 },
          { message: 'Finalizing workspace...', duration: 200 }
        ];

        for (let i = 0; i < initSteps.length; i++) {
          const step = initSteps[i];
          console.log(`🔧 ${step.message}`);
          
          // Update progress
          setInitializationProgress(((i + 1) / initSteps.length) * 100);
          
          // Wait for the step duration
          await new Promise(resolve => setTimeout(resolve, step.duration));
        }

        // Small final delay to ensure everything is ready
        await new Promise(resolve => setTimeout(resolve, 300));

        console.log('✅ Project initialization complete - launching app');
        
        // Now start the project
        onStartProject({
          template: selectedTemplate,
          projectData: projectData
        });
      } catch (error) {
        console.error('❌ Project initialization failed:', error);
        // Still try to start the project even if initialization monitoring fails
        onStartProject({
          template: selectedTemplate,
          projectData: projectData
        });
      } finally {
        // Reset loading state after a short delay (will be unmounted anyway)
        setTimeout(() => {
          setIsInitializingProject(false);
          setInitializationProgress(0);
        }, 500);
      }
    }
  };

  const handlePromptSubmit = async (prompt) => {
    if (isInitializingProject) return; // Prevent double-clicks
    
    console.log('🎯 AI Prompt submitted:', prompt);
    setIsInitializingProject(true);
    setInitializationProgress(0);

    try {
      // AI project initialization steps
      const initSteps = [
        { message: 'Processing AI prompt...', duration: 600 },
        { message: 'Setting up AI workspace...', duration: 700 },
        { message: 'Loading intelligent tools...', duration: 500 },
        { message: 'Initializing design engine...', duration: 800 },
        { message: 'Preparing AI assistant...', duration: 400 },
        { message: 'Launching AI-powered CAD...', duration: 300 }
      ];

      for (let i = 0; i < initSteps.length; i++) {
        const step = initSteps[i];
        console.log(`🤖 ${step.message}`);
        
        setInitializationProgress(((i + 1) / initSteps.length) * 100);
        await new Promise(resolve => setTimeout(resolve, step.duration));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Create a custom project with the AI prompt
      const aiProjectData = {
        name: prompt.replace(/^(create|build|design|make)\s*/i, '').trim() || 'AI Generated Project',
        description: `Generated from prompt: "${prompt}"`,
        location: '',
        client: '',
        aiPrompt: prompt
      };
      
      console.log('🚀 Starting AI-powered project...');
      
      // Start project with AI Custom template
      onStartProject({
        template: {
          id: 'ai-custom-project',
          title: 'AI Custom Project',
          description: 'Project generated from natural language prompt',
          icon: SparklesIcon,
          color: 'bg-studiosix-500',
          features: ['AI-guided design', 'Natural language processing', 'Custom requirements'],
          complexity: 'AI Assisted',
          estimatedTime: 'Variable'
        },
        projectData: aiProjectData
      });
    } catch (error) {
      console.error('❌ AI project initialization failed:', error);
      // Fallback to immediate start
      onStartProject({
        template: {
          id: 'ai-custom-project',
          title: 'AI Custom Project',
          description: 'Project generated from natural language prompt',
          icon: SparklesIcon,
          color: 'bg-studiosix-500',
          features: ['AI-guided design', 'Natural language processing', 'Custom requirements'],
          complexity: 'AI Assisted',
          estimatedTime: 'Variable'
        },
        projectData: {
          name: prompt.replace(/^(create|build|design|make)\s*/i, '').trim() || 'AI Generated Project',
          description: `Generated from prompt: "${prompt}"`,
          location: '',
          client: '',
          aiPrompt: prompt
        }
      });
    } finally {
      setTimeout(() => {
        setIsInitializingProject(false);
        setInitializationProgress(0);
      }, 500);
    }
  };

  // Supported file types for BIM import
  const supportedTypes = {
    // SketchUp
    '.skp': 'SketchUp',
    // ArchiCAD/IFC
    '.ifc': 'IFC (Industry Foundation Classes)',
    '.pln': 'ArchiCAD Plan',
    '.plt': 'ArchiCAD Plot',
    // AutoCAD
    '.dwg': 'AutoCAD Drawing',
    '.dxf': 'AutoCAD Exchange',
    // Other 3D formats
    '.3ds': '3D Studio',
    '.obj': 'Wavefront OBJ',
    '.fbx': 'Autodesk FBX',
    '.gltf': 'glTF',
    '.glb': 'glTF Binary',
    '.dae': 'Collada',
    '.step': 'STEP',
    '.stp': 'STEP',
    '.iges': 'IGES',
    '.igs': 'IGES'
  };

  const acceptedExtensions = Object.keys(supportedTypes).join(',');

  const handleFileImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!supportedTypes[extension]) {
      setUploadStatus('error');
      setUploadMessage(`Unsupported file type: ${extension}\nSupported types: ${Object.keys(supportedTypes).join(', ')}`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', extension);

      // Upload to backend for CAD processing
      const { getUploadBase } = require('../config/apiBase');
      const response = await fetch(`${getUploadBase()}/upload-bim-file`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      setUploadProgress(100);
      setUploadStatus('success');
      setUploadMessage(`Successfully imported ${result.imported_count} objects from ${file.name}`);
      
      // Auto-transition to main app after successful import
      setTimeout(() => {
        onStartProject({
          template: { id: 'imported-file', title: 'Imported CAD File' },
          projectData: {
            name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
            description: `Imported from ${supportedTypes[extension]} file`,
            location: '',
            client: ''
          },
          importedObjects: result.objects
        });
      }, 2000);
      
    } catch (error) {
      console.error('File upload error:', error);
      setUploadStatus('error');
      setUploadMessage(`Upload failed: ${error.message}`);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [supportedTypes, onStartProject]);

  const handleOpenRecent = async (project) => {
    if (isInitializingProject || openingProjectId) return; // Prevent multiple opens
    
    try {
      console.log('📂 Opening recent project:', project.name);
      setOpeningProjectId(project.id);
      setIsInitializingProject(true);
      setInitializationProgress(0);
      
      // Project loading steps with progress
      const loadingSteps = [
        { message: 'Loading project data...', duration: 400 },
        { message: 'Restoring workspace...', duration: 600 },
        { message: 'Loading saved objects...', duration: 500 },
        { message: 'Initializing viewports...', duration: 700 },
        { message: 'Restoring tool settings...', duration: 300 },
        { message: 'Finalizing project...', duration: 200 }
      ];

      for (let i = 0; i < loadingSteps.length; i++) {
        const step = loadingSteps[i];
        console.log(`📁 ${step.message}`);
        
        setInitializationProgress(((i + 1) / loadingSteps.length) * 100);
        await new Promise(resolve => setTimeout(resolve, step.duration));
      }

      // Get full project data from RecentProjectsManager
      const fullProject = await recentProjectsManager.getProject(project.id);
      
      // Small final delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (fullProject) {
        // Mark project as opened (updates lastOpened timestamp)
        await recentProjectsManager.markProjectOpened(project.id);
        
        console.log('✅ Project loaded successfully - launching app');
        // Pass full project data to parent
        onOpenExisting(fullProject);
        
        console.log('📂 Opening existing project:', fullProject.name, 'ID:', fullProject.id);
      } else {
        console.error('Project not found:', project.id);
        // Fallback to the project data we have
        onOpenExisting(project);
      }
    } catch (error) {
      console.error('Failed to open recent project:', error);
      // Still try to open with whatever data we have
      onOpenExisting(project);
    } finally {
      // Reset loading states after a brief delay
      setTimeout(() => {
        setOpeningProjectId(null);
        setIsInitializingProject(false);
        setInitializationProgress(0);
      }, 300);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-studiosix-950 relative overflow-hidden">
      {/* Project Initialization Loading Overlay */}
      {isInitializingProject && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="text-center">
            {/* Loading animation */}
            <div className="relative mb-8">
              <div className="w-20 h-20 border-4 border-studiosix-500/20 border-t-studiosix-500 rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <RocketLaunchIcon className="w-8 h-8 text-studiosix-400 animate-pulse" />
              </div>
            </div>
            
            {/* Progress text */}
            <h2 className="text-2xl font-bold text-white mb-2">Initializing Project</h2>
            <p className="text-gray-400 mb-6">Setting up your workspace...</p>
            
            {/* Progress bar */}
            <div className="w-80 mx-auto">
              <div className="bg-gray-700/50 rounded-full h-2 mb-2">
                <div 
                  className="bg-studiosix-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${initializationProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500">{Math.round(initializationProgress)}% Complete</p>
            </div>
            
            {/* Tip text */}
            <div className="mt-8 p-4 bg-studiosix-600/10 rounded-lg border border-studiosix-500/20 max-w-md mx-auto">
              <LightBulbIcon className="w-5 h-5 text-studiosix-400 inline mr-2" />
              <span className="text-sm text-gray-300">
                We're preparing all the tools and features you'll need for your project
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 right-20 w-96 h-96 bg-studiosix-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-studiosix-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 min-h-full flex flex-col lg:flex-row">
        {/* Header */}
        <div className="sticky top-0 z-20">
          <div className="glass-light px-4 lg:px-6 py-3 lg:py-4 border-b border-gray-700/50">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
                  <img 
                    src="/studiosix-icon.svg" 
                    alt="StudioSix Icon" 
                    className="w-6 h-6"
                  />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">StudioSix Pro</h1>
                  <p className="text-sm text-gray-400">Create your next project</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-2 px-4 py-2 bg-studiosix-600 hover:bg-studiosix-700 rounded-lg transition-all duration-200 text-white font-medium"
                >
                  <div className="w-6 h-6 bg-studiosix-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {getUserInitials()}
                  </div>
                  <span>{getUserDisplayName()}</span>
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
                
                {showProfileDropdown && (
                  <div 
                    ref={dropdownRef}
                    className="absolute top-14 right-0 w-64 bg-slate-800 p-4 rounded-lg border border-gray-700/50 shadow-lg z-40"
                  >
                    <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-gray-700/30">
                      <div className="w-10 h-10 bg-studiosix-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {getUserInitials()}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{getUserDisplayName()}</p>
                        <p className="text-gray-400 text-xs">{user?.email}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <button 
                        onClick={() => {/* TODO: Handle settings */}}
                        className="flex items-center space-x-2 w-full text-left text-gray-300 hover:text-white hover:bg-slate-700/30 text-sm py-2 px-3 rounded-md transition-all"
                      >
                        <Cog6ToothIcon className="w-4 h-4" />
                        <span>Settings</span>
                      </button>
                      
                      <button 
                        onClick={onSignOut}
                        className="flex items-center space-x-2 w-full text-left text-gray-300 hover:text-white hover:bg-slate-700/30 text-sm py-2 px-3 rounded-md transition-all"
                      >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recovery Banner */}
        {showRecoveryBanner && recoveredProjects.length > 0 && (
          <div className="absolute top-16 left-0 right-0 z-20">
            <div className="mx-6 my-2">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-yellow-200">Unsaved Work Found</h3>
                      <p className="text-xs text-yellow-200/80 mt-1">
                        We found {recoveredProjects.length} project{recoveredProjects.length > 1 ? 's' : ''} with unsaved changes from your last session.
                      </p>
                      <div className="flex items-center space-x-3 mt-3">
                        <button
                          onClick={() => {
                            // Recover the first project or show selection
                            if (recoveredProjects.length === 1) {
                              onOpenExisting(recoveredProjects[0]);
                            } else {
                              // Show recovery dialog for multiple projects
                              console.log('🔄 Show recovery dialog for multiple projects');
                            }
                            setShowRecoveryBanner(false);
                          }}
                          className="text-xs px-3 py-1.5 bg-yellow-500 text-black rounded-md hover:bg-yellow-400 transition-colors font-medium"
                        >
                          {recoveredProjects.length === 1 ? 'Recover Project' : 'View Recoverable Projects'}
                        </button>
                        <button
                          onClick={() => setShowRecoveryBanner(false)}
                          className="text-xs px-3 py-1.5 border border-yellow-500/30 text-yellow-200 rounded-md hover:bg-yellow-500/10 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRecoveryBanner(false)}
                    className="text-yellow-500/60 hover:text-yellow-500 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 pt-20 lg:pt-24 px-4 lg:px-6 pb-6">
          <div className="max-w-7xl mx-auto h-full flex flex-col lg:flex-row gap-6 lg:gap-8">
            
            {/* Left side - Project templates */}
            <div className="flex-1">
              <div className="mb-6 lg:mb-8">
                <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3">Start a New Project</h2>
                <p className="text-gray-400 text-base lg:text-lg mb-6">Choose a template to get started quickly, or create a custom project with AI assistance.</p>
                
                {/* AI Prompt Box */}
                <AnimatedPromptBox 
                  onSubmit={handlePromptSubmit}
                  className="mb-8"
                />
              </div>

              {/* Separator */}
              <div className="flex items-center mb-6">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
                <span className="px-4 text-sm text-gray-400">or choose a template</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
              </div>


              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                {PROJECT_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  const isSelected = selectedTemplate?.id === template.id;
                  
                  return (
                    <div
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`cursor-pointer group transition-all duration-300 ${
                        isSelected 
                          ? 'scale-105' 
                          : 'hover:scale-102'
                      }`}
                    >
                      <div className={`glass p-4 rounded-xl border transition-all duration-300 ${
                        isSelected 
                          ? 'border-studiosix-500 neon-purple' 
                          : 'border-gray-700/50 hover:border-studiosix-400/50'
                      }`}>
                        
                        {/* Template header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-10 h-10 ${template.color} rounded-lg flex items-center justify-center shadow-lg`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          
                          {isSelected && (
                            <div className="w-5 h-5 bg-studiosix-500 rounded-full flex items-center justify-center animate-pulse">
                              <ArrowRightIcon className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Template info */}
                        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-studiosix-300 transition-colors">
                          {template.title}
                        </h3>
                        
                        <p className="text-gray-400 mb-3 text-sm leading-relaxed line-clamp-2">
                          {template.description}
                        </p>

                        {/* Features - show only first 2 */}
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-1">
                            {template.features.slice(0, 2).map((feature, index) => (
                              <span
                                key={index}
                                className="px-2 py-0.5 bg-slate-700/50 text-gray-300 text-xs rounded-md"
                              >
                                {feature}
                              </span>
                            ))}
                            {template.features.length > 2 && (
                              <span className="px-2 py-0.5 bg-slate-700/30 text-gray-400 text-xs rounded-md">
                                +{template.features.length - 2} more
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Right side - Recent projects & options */}
            <div className="w-full lg:w-96">
              {/* Add top margin to align with project templates grid */}
              <div className="mt-6 lg:mt-16"></div>
              
              {/* Quick actions (moved above Recent Projects) */}
              <div className="glass p-6 rounded-xl border border-gray-700/50 mb-4 hidden lg:block">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <CommandLineIcon className="w-5 h-5 mr-2 text-studiosix-400" />
                  Quick Actions
                </h3>
                
                <div className="space-y-3">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={acceptedExtensions}
                    onChange={handleFileSelect}
                  />
                  
                  {/* Switch to Render Studio first */}
                  <button
                    onClick={onOpenRenderStudio}
                    className="w-full p-3 rounded-lg text-left transition-all duration-200 group border border-amber-500/40 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    <div className="flex items-center space-x-3">
                      <CameraIcon className="w-5 h-5 text-white" />
                      <div>
                        <p className="text-white text-sm font-semibold">Switch to Render Studio</p>
                        <p className="text-amber-100/90 text-xs">Jump straight into AI image generation</p>
                      </div>
                    </div>
                  </button>

                  {/* Import CAD File below */}
                  <button 
                    onClick={handleFileImport}
                    disabled={isUploading}
                    className={`w-full p-3 rounded-lg text-left transition-all duration-200 group ${
                      isUploading 
                        ? 'bg-slate-800/50 cursor-not-allowed' 
                        : 'bg-slate-800/30 hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {isUploading ? (
                        <ArrowUpTrayIcon className="w-5 h-5 text-studiosix-400 animate-pulse" />
                      ) : uploadStatus === 'success' ? (
                        <CheckCircleIcon className="w-5 h-5 text-green-400" />
                      ) : uploadStatus === 'error' ? (
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                      ) : (
                        <DocumentTextIcon className="w-5 h-5 text-gray-400 group-hover:text-studiosix-400" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          isUploading ? 'text-gray-300' : 'text-white'
                        }`}>
                          {isUploading ? 'Importing CAD File...' : 'Import CAD File'}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {isUploading 
                            ? `${uploadProgress}% complete` 
                            : uploadStatus === 'success' 
                              ? 'Import successful - starting project...'
                              : uploadStatus === 'error'
                                ? 'Import failed - click to retry'
                                : 'SketchUp, IFC, DWG, DXF, STEP, etc.'
                          }
                        </p>
                        {isUploading && (
                          <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                            <div 
                              className="bg-studiosix-500 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Recent projects */}
              <div className="glass p-6 rounded-xl border border-gray-700/50 mb-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2 text-studiosix-400" />
                  Recent Projects
                  {recentProjects.length > 2 && (
                    <span className="ml-auto text-xs text-gray-400 bg-slate-700/50 px-2 py-1 rounded-full">
                      Showing 2 of {recentProjects.length}
                    </span>
                  )}
                </h3>
                
                {/* Fixed height container to maintain layout balance */}
                <div className="h-auto lg:h-80 flex flex-col">
                  <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
                    {loadingProjects ? (
                      // Loading state - centered
                      <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-studiosix-500 border-t-transparent rounded-full"></div>
                        <span className="ml-3 text-gray-400">Loading projects...</span>
                      </div>
                    ) : recentProjects.length === 0 ? (
                      // Empty state - centered
                      <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <DocumentTextIcon className="w-12 h-12 text-gray-600 mb-3" />
                        <p className="text-gray-400 text-sm">No recent projects</p>
                        <p className="text-gray-500 text-xs mt-1">Start a new project to get started!</p>
                      </div>
                    ) : (
                      // Recent projects list (show only first 2)
                      <>
                        <div className="space-y-3 flex-1 overflow-y-auto">
                          {recentProjects.slice(0, 2).map((project) => {
                            const isOpening = openingProjectId === project.id;
                            return (
                            <div
                              key={project.id}
                              onClick={() => !isOpening && handleOpenRecent(project)}
                              className={`p-4 bg-slate-800/30 rounded-lg transition-all duration-200 group relative ${
                                isOpening 
                                  ? 'cursor-wait opacity-75' 
                                  : 'cursor-pointer hover:bg-slate-700/40'
                              }`}
                            >
                              {/* Loading indicator */}
                              {isOpening && (
                                <div className="absolute top-2 right-2">
                                  <div className="animate-spin w-4 h-4 border-2 border-studiosix-500 border-t-transparent rounded-full"></div>
                                </div>
                              )}
                              
                              {!isOpening && project.isNew && (
                                <div className="absolute top-2 right-2">
                                  <StarIcon className="w-4 h-4 text-studiosix-400" />
                                </div>
                              )}
                              
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 pr-6">
                                  <h4 className={`font-medium transition-colors ${
                                    isOpening 
                                      ? 'text-gray-300' 
                                      : 'text-white group-hover:text-studiosix-300'
                                  }`}>
                                    {project.name}
                                    {isOpening && <span className="ml-2 text-xs text-studiosix-400">Opening...</span>}
                                  </h4>
                                  <p className="text-sm text-gray-400">{project.type}</p>
                                  {project.description && (
                                    <p className="text-xs text-gray-500 mt-1 overflow-hidden" style={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical'
                                    }}>
                                      {project.description}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {project.lastModified}
                                </span>
                              </div>
                              
                              {/* Progress bar */}
                              <div className="w-full bg-slate-700 rounded-full h-1.5">
                                <div 
                                  className="h-full bg-studiosix-500 rounded-full transition-all duration-300"
                                  style={{ width: `${project.progress}%` }}
                                ></div>
                              </div>
                              <div className="text-right mt-1">
                                <span className="text-xs text-gray-500">{project.progress}% complete</span>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                        
                        {recentProjects.length > 2 && (
                          <div className="pt-2 border-t border-gray-700/30">
                            <button className="w-full py-2 text-sm text-gray-400 hover:text-studiosix-400 transition-colors">
                              View all {recentProjects.length} projects →
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick actions moved above */}
            </div>
          </div>
        </div>

        {/* Custom project form modal */}
        {showProjectForm && selectedTemplate?.id === 'custom-project' && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="glass p-8 rounded-xl border border-gray-700/50 w-96 max-w-full mx-4">
              <h3 className="text-xl font-semibold text-white mb-6">Custom Project Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
                  <input
                    type="text"
                    value={projectData.name}
                    onChange={(e) => setProjectData({...projectData, name: e.target.value})}
                    className="w-full bg-slate-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-studiosix-500 focus:ring-1 focus:ring-studiosix-500"
                    placeholder="My Awesome Building"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={projectData.description}
                    onChange={(e) => setProjectData({...projectData, description: e.target.value})}
                    className="w-full bg-slate-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-studiosix-500 focus:ring-1 focus:ring-studiosix-500 h-20 resize-none"
                    placeholder="Describe your project requirements..."
                  />
                </div>
                
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                    <input
                      type="text"
                      value={projectData.location}
                      onChange={(e) => setProjectData({...projectData, location: e.target.value})}
                      className="w-full bg-slate-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-studiosix-500 focus:ring-1 focus:ring-studiosix-500"
                      placeholder="City, Country"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Client</label>
                    <input
                      type="text"
                      value={projectData.client}
                      onChange={(e) => setProjectData({...projectData, client: e.target.value})}
                      className="w-full bg-slate-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-studiosix-500 focus:ring-1 focus:ring-studiosix-500"
                      placeholder="Client Name"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowProjectForm(false);
                    setSelectedTemplate(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartProject}
                  className="flex-1 px-4 py-2 bg-studiosix-600 hover:bg-studiosix-700 text-white rounded-lg transition-all duration-200"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StartNewProjectMenu; 