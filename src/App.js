import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import axios from 'axios';
  // STANDALONE CAD ENGINE - No WebSocket dependencies
import InteractiveChatMessage from './components/chat/InteractiveChatMessage';
import './components/chat/InteractiveChatMessage.css';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthLandingPage from './components/AuthLandingPage';
import AuthCallback from './components/AuthCallback';
import AuthConfigNotice from './components/AuthConfigNotice';
import EmailConfirmation from './components/EmailConfirmation';
import LandingPage from './components/LandingPage';
import ThankYouPage from './components/ThankYouPage';
import { isAuthConfigured } from './config/supabase';
import recentProjectsManager from './utils/RecentProjectsManager';
import TestRouting from './components/TestRouting';

// IFC.js Test Runner - Temporarily disabled for Task 2 due to WASM issues
// import './utils/IFCTestRunner';

import {
  Squares2X2Icon as Squares3x3Icon,
  RectangleStackIcon,
  HomeIcon,
  CubeIcon,
  BeakerIcon,
  ScaleIcon as RulerIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  PlayIcon,
  PaperAirplaneIcon,
  FolderIcon,
  BuildingOfficeIcon,
  // Additional BIM/Architecture icons
  Square3Stack3DIcon,
  TruckIcon,
  CursorArrowRippleIcon,
  HandRaisedIcon,
  ArrowsPointingOutIcon,
  DocumentIcon,
  CloudArrowDownIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  QuestionMarkCircleIcon,
  UserCircleIcon,
  TagIcon,
  CameraIcon,
  LightBulbIcon,
  SunIcon,
  MoonIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import SplashScreen from './components/SplashScreen';
import StartNewProjectMenu from './components/StartNewProjectMenu';
import { PropertyPanel } from './components/property-panel';
import OBJModelPanel from './components/property-panel/OBJModelPanel';
import SlabPropertyPanel from './components/property-panel/SlabPropertyPanel';
import ToolPanelManager from './components/tools/ToolPanelManager';
import { WallIcon, SlabIcon, DoorIcon, WindowIcon, RoofIcon, StairIcon } from './components/icons';
import ResizableAIChat from './components/ResizableAIChat';
import NativeAIChat from './components/NativeAIChat';
import AIRenderOverlay from './components/AIRenderOverlay';
import ViewportCaptureFrame from './components/ViewportCaptureFrame';
import LiveStreamStatus from './components/LiveStreamStatus';
import SaveDialog from './components/SaveDialog';
import CADBlocksPopup from './components/CADBlocksPopup';
import Model3DLoader from './components/Model3DLoader';
// Removed property mapper - using direct object properties
import standaloneCADEngine from './services/StandaloneCADEngine';
// Import viewport components for 2D drafting + 3D visualization
import XeokitViewport from './components/viewports/XeokitViewport';
import CAD2DViewport from './components/viewports/CAD2DViewport';
import { useStandaloneCAD } from './hooks/useStandaloneCAD';
import './index.css';

// API Configuration - Standalone mode

// BIM Tool Icons and Data - Organized by ribbon groups
const BIM_TOOLS_GROUPS = {
  navigate: {
    title: 'Navigate',
    icon: '🖱️',
    tools: [
      { id: 'pointer', name: 'Select', icon: CursorArrowRippleIcon, description: 'Select and navigate viewport', category: 'navigation', size: 'large' },
      { id: 'pan', name: 'Pan', icon: HandRaisedIcon, description: 'Pan view around the model', category: 'navigation', size: 'medium' },
      { id: 'orbit', name: 'Orbit', icon: ArrowsPointingOutIcon, description: 'Orbit around the model', category: 'navigation', size: 'medium' },
      { id: 'zoom-fit', name: 'Fit', icon: ArrowsPointingOutIcon, description: 'Fit model to view', category: 'navigation', size: 'medium' },
    ]
  },
  structure: {
    title: 'Structure',
    icon: '🏗️',
    tools: [
      { id: 'wall', name: 'Wall', icon: WallIcon, description: 'Create walls', category: 'building', size: 'large' },
      { id: 'slab', name: 'Slab', icon: SlabIcon, description: 'Create floor slabs', category: 'building', size: 'large' },
      { id: 'column', name: 'Column', icon: BeakerIcon, description: 'Create columns', category: 'structural', size: 'medium' },
      { id: 'beam', name: 'Beam', icon: RulerIcon, description: 'Add beams', category: 'structural', size: 'medium' },
    ]
  },
  openings: {
    title: 'Openings',
    icon: '🚪',
    tools: [
      { id: 'door', name: 'Door', icon: DoorIcon, description: 'Add doors', category: 'openings', size: 'large' },
      { id: 'window', name: 'Window', icon: WindowIcon, description: 'Add windows', category: 'openings', size: 'large' },
      { id: 'skylight', name: 'Skylight', icon: SunIcon, description: 'Add skylights', category: 'openings', size: 'medium' },
    ]
  },
  building: {
    title: 'Building',
    icon: '🏠',
    tools: [
      { id: 'roof', name: 'Roof', icon: RoofIcon, description: 'Add roofs', category: 'building', size: 'large' },
      { id: 'stair', name: 'Stair', icon: StairIcon, description: 'Create stairs', category: 'circulation', size: 'large' },
      { id: 'ramp', name: 'Ramp', icon: TruckIcon, description: 'Create ramps', category: 'circulation', size: 'medium' },
    ]
  },
  cadblocks: {
    title: 'CAD Blocks',
    icon: '📦',
    tools: [
      { id: 'furniture', name: 'Furniture', icon: HomeIcon, description: 'Insert furniture objects', category: 'blocks', size: 'large' },
      { id: 'fixtures', name: 'Fixtures', icon: LightBulbIcon, description: 'Insert fixtures and fittings', category: 'blocks', size: 'large' },
      { id: 'tag', name: 'Tag', icon: TagIcon, description: 'Add tags and labels', category: 'annotation', size: 'medium' },
    ]
  },
  assistant: {
    title: 'AI Assistant',
    icon: '🤖',
    tools: [
      { id: 'ai-chat', name: 'AI Chat', icon: ChatBubbleLeftRightIcon, description: 'Open AI Assistant', category: 'ai', size: 'large' },
      { id: 'ai-render', name: 'AI Render', icon: CameraIcon, description: 'AI rendering tool', category: 'ai', size: 'large' },
      { id: 'voice-command', name: 'Voice', icon: SparklesIcon, description: 'Voice commands', category: 'ai', size: 'medium' },
    ]
  }
};

// Legacy BIM_TOOLS array for compatibility (flattened from groups)
const BIM_TOOLS = Object.values(BIM_TOOLS_GROUPS).flatMap(group => group.tools);

// Project Tree Structure - Floor-based organization
const PROJECT_TREE = [
  {
    id: 'levels',
    name: 'Levels',
    icon: FolderIcon,
    children: [
      { 
        id: 'ground', 
        name: 'Ground Floor', 
        icon: BuildingOfficeIcon,
        type: 'floor',
        level: 0,
        children: [
          {
            id: 'ground-walls',
            name: 'Walls',
            icon: FolderIcon,
            floor: 'ground',
            children: [
              { id: 'ground-ext-walls', name: 'Exterior Walls', icon: RectangleStackIcon, floor: 'ground' },
              { id: 'ground-int-walls', name: 'Interior Walls', icon: RectangleStackIcon, floor: 'ground' },
            ]
          },
          {
            id: 'ground-openings',
            name: 'Openings',
            icon: FolderIcon,
            floor: 'ground',
            children: [
              { id: 'ground-doors', name: 'Doors', icon: DoorIcon, floor: 'ground' },
              { id: 'ground-windows', name: 'Windows', icon: Squares3x3Icon, floor: 'ground' },
            ]
          },
          {
            id: 'ground-furniture',
            name: 'Furniture',
            icon: FolderIcon,
            floor: 'ground',
            children: []
          }
        ]
      },
      { 
        id: 'first', 
        name: 'First Floor', 
        icon: BuildingOfficeIcon,
        type: 'floor',
        level: 1,
        children: [
          {
            id: 'first-walls',
            name: 'Walls',
            icon: FolderIcon,
            floor: 'first',
            children: [
              { id: 'first-ext-walls', name: 'Exterior Walls', icon: RectangleStackIcon, floor: 'first' },
              { id: 'first-int-walls', name: 'Interior Walls', icon: RectangleStackIcon, floor: 'first' },
            ]
          },
          {
            id: 'first-openings',
            name: 'Openings',
            icon: FolderIcon,
            floor: 'first',
            children: [
              { id: 'first-doors', name: 'Doors', icon: DoorIcon, floor: 'first' },
              { id: 'first-windows', name: 'Windows', icon: Squares3x3Icon, floor: 'first' },
            ]
          },
          {
            id: 'first-furniture',
            name: 'Furniture',
            icon: FolderIcon,
            floor: 'first',
            children: []
          }
        ]
      },
    ]
  },
];

// AI Chat Messages Component
const ChatMessage = ({ message, isUser, timestamp }) => (
  <div className={`message-bubble p-3 mb-3 rounded-lg max-w-[85%] break-words overflow-hidden ${
    isUser 
      ? 'bg-studiosix-600 text-white ml-auto' 
      : 'glass-light text-gray-100'
  }`} style={{ maxWidth: '85%', overflow: 'hidden', wordWrap: 'break-word' }}>
    <div 
      className="text-sm mb-1 ai-response-content break-words"
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
    <div className="text-xs opacity-60">
      {timestamp}
    </div>
  </div>
);

// Ribbon-style Toolbar Component
const RibbonToolbar = ({ selectedTool, onToolSelect, currentProject, onBackToProjects, onToggleChat, onFileAction, onEditAction, onHelpAction, onProfileAction, isRenderingInBackground, isRenderingActive, renderProgress, renderCompleted, isConnected, lastActivatedTool }) => {
  const [activeGroup, setActiveGroup] = useState('navigate');

  const renderToolButton = (tool, groupIsActive = false) => {
    const Icon = tool.icon;
    const isLarge = tool.size === 'large';
    const isMedium = tool.size === 'medium';
    const isSelected = selectedTool === tool.id;
    const isRenderingTool = tool.id === 'ai-render' && (isRenderingInBackground || isRenderingActive);
    const isCompletedRender = tool.id === 'ai-render' && renderCompleted;

    // Updated sizing to accommodate text labels with more space
    const buttonSize = isLarge ? 'min-w-[72px] w-18 h-14' : isMedium ? 'min-w-[64px] w-16 h-14' : 'min-w-[56px] w-14 h-12';

    return (
      <button
        key={tool.id}
        data-tool-id={tool.id}
        onClick={() => {
          if (tool.id === 'ai-chat') {
            onToggleChat();
          } else {
            onToolSelect(tool.id);
          }
        }}
        className={`ribbon-tool-btn flex flex-col items-center justify-center rounded-lg transition-all duration-300 relative p-2 ${
          isSelected
            ? 'bg-gradient-to-b from-studiosix-600 to-studiosix-700 text-white shadow-lg border border-studiosix-500/50'
            : isCompletedRender
              ? 'bg-gray-800/60 text-gray-200 hover:bg-gray-700/80 hover:text-white hover:scale-105 border border-green-400/70 shadow-lg shadow-green-400/20'
              : groupIsActive
                ? 'bg-gray-800/60 text-gray-200 hover:bg-gray-700/80 hover:text-white hover:scale-105 border border-gray-700/30'
                : 'bg-gray-900/40 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent'
        } ${buttonSize}`}
        title={`${tool.name} - ${tool.description}`}
      >
        <div className="relative">
          {tool.id === 'ai-render' ? (
            // Custom animated camera icon for AI render tool
            <div className={`relative transition-all duration-300 mb-1 ${
              isLarge ? 'w-5 h-5' : isMedium ? 'w-4 h-4' : 'w-3.5 h-3.5'
            }`}>
              {/* Camera icon with progressive fill */}
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                {/* Background camera outline */}
                <path
                  d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isSelected ? 'text-white' : 'text-current'}
                />
                <circle
                  cx="12"
                  cy="13"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={isSelected ? 'text-white' : 'text-current'}
                />
                
                {/* Progressive fill overlay */}
                {isRenderingTool && (
                  <defs>
                    <clipPath id={`camera-clip-${tool.id}`}>
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" />
                    </clipPath>
                  </defs>
                )}
                
                {isRenderingTool && (
                  <rect
                    x="0"
                    y={24 - (24 * renderProgress / 100)}
                    width="24"
                    height={24 * renderProgress / 100}
                    fill="url(#greenGradient)"
                    clipPath={`url(#camera-clip-${tool.id})`}
                    className="transition-all duration-500"
                  />
                )}
                
                {/* Gradient definition */}
                <defs>
                  <linearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.9" />
                  </linearGradient>
                </defs>
              </svg>
              
              {/* Completion glow effect */}
              {isCompletedRender && (
                <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-pulse"></div>
              )}
            </div>
          ) : (
            // Regular icon for other tools
            <Icon className={`transition-all duration-300 mb-1 ${
              isLarge ? 'w-5 h-5' : isMedium ? 'w-4 h-4' : 'w-3.5 h-3.5'
            } ${isSelected ? 'text-white' : ''}`} />
          )}
        </div>
        
        <span className={`text-xs font-medium transition-all duration-300 text-center leading-tight block px-1 whitespace-nowrap overflow-hidden text-ellipsis ${
          groupIsActive ? 'opacity-100' : 'opacity-70'
        }`} style={{ fontSize: isLarge ? '10px' : '9px', lineHeight: '1.2', maxWidth: '100%' }}>
          {tool.name}
        </span>

        {/* Active indicator */}
        {isSelected && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-gradient-to-r from-studiosix-400 to-studiosix-500 rounded-full shadow-lg"></div>
        )}
        
        {/* Enhanced glow when in active category */}
        {groupIsActive && isSelected && (
          <div className="absolute inset-0 rounded-lg bg-studiosix-500/20 blur-sm -z-10"></div>
        )}
      </button>
    );
  };

  const renderGroup = (groupKey, group) => {
    const isActive = activeGroup === groupKey;
    
    return (
      <div key={groupKey} className={`ribbon-group flex flex-col relative transition-all duration-300 ${
        isActive ? 'z-10' : 'z-0'
      }`}>
        {/* Group Header */}
        <button
          onClick={() => setActiveGroup(groupKey)}
          className={`group-header px-6 py-1 text-xs font-semibold transition-all duration-300 relative ${
            isActive 
              ? 'text-white bg-gradient-to-b from-gray-800 to-gray-900 shadow-lg border-b border-gray-600' 
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <span className="mr-2 text-sm">{group.icon}</span>
          <span className="uppercase tracking-wide">{group.title}</span>
          {isActive && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-studiosix-500 to-studiosix-400"></div>
          )}
        </button>
        
        {/* Group Tools */}
        <div className={`group-tools h-20 py-2 px-3 transition-all duration-300 ease-in-out ${
          isActive 
            ? 'bg-gradient-to-b from-gray-900/90 to-gray-800/80 border-b border-gray-700/50 shadow-inner' 
            : 'bg-gray-900/20'
        }`}>
          <div className="flex items-center justify-center gap-2 flex-wrap h-full">
            {group.tools.map((tool) => renderToolButton(tool, isActive))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ribbon-toolbar glass border-b border-gray-700/50">
      {/* Top Section: Logo, Project, Quick Actions */}
      <div className="ribbon-header h-12 px-6 flex items-center justify-between bg-gray-900/50">
        {/* Logo and Project Info */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg">
              <img 
                src="./studiosix-icon.svg" 
                alt="StudioSix Icon" 
                className="w-5 h-5"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">StudioSix Pro</h1>
              <p className="text-xs text-gray-400">BIM Modeler</p>
            </div>
          </div>
          
          {/* Project Info */}
          {currentProject && (
            <div className="flex items-center space-x-3">
              <div className="h-6 w-px bg-gray-600"></div>
              <div>
                <p className="text-sm font-medium text-white">
                  {currentProject.projectData?.name || currentProject.template?.title || currentProject.name || 'Untitled Project'}
                </p>
                <p className="text-xs text-gray-400">
                  {currentProject.template?.title || currentProject.type || 'Project'}
                </p>
              </div>
              <button
                onClick={onBackToProjects}
                className="p-1 rounded hover:bg-slate-700/50 transition-colors"
                title="Back to Projects"
              >
                <FolderIcon className="w-4 h-4 text-gray-400 hover:text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Top Toolbar Buttons and Status */}
        <div className="flex items-center space-x-4">
          {/* File operation buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onFileAction('file')}
              className="top-toolbar-btn flex items-center space-x-1 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-md transition-all duration-200"
              title="File operations"
            >
              <DocumentIcon className="w-4 h-4" />
              <span className="text-xs font-medium">File</span>
            </button>
            
            <button
              onClick={() => onFileAction('save')}
              className="top-toolbar-btn flex items-center space-x-1 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-md transition-all duration-200"
              title="Save project"
            >
              <CloudArrowDownIcon className="w-4 h-4" />
              <span className="text-xs font-medium">Save</span>
            </button>
            
            <button
              onClick={() => onFileAction('import_ifc')}
              className="top-toolbar-btn flex items-center space-x-1 px-3 py-1.5 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-md transition-all duration-200"
              title="Import 3D files (IFC, glTF, OBJ) - Works in both 2D and 3D modes"
            >
              <BuildingOfficeIcon className="w-4 h-4" />
              <span className="text-xs font-medium">Import 3D</span>
            </button>

            <button
              onClick={() => onEditAction('undo')}
              className="top-toolbar-btn flex items-center space-x-1 px-2 py-1.5 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-md transition-all duration-200"
              title="Undo last action"
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
              <span className="text-xs font-medium">Undo</span>
            </button>

            <button
              onClick={() => onEditAction('redo')}
              className="top-toolbar-btn flex items-center space-x-1 px-2 py-1.5 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-md transition-all duration-200"
              title="Redo action"
            >
              <ArrowUturnRightIcon className="w-4 h-4" />
              <span className="text-xs font-medium">Redo</span>
            </button>

            <button
              onClick={onHelpAction}
              className="top-toolbar-btn flex items-center space-x-1 px-2 py-1.5 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-md transition-all duration-200"
              title="Get help"
            >
              <QuestionMarkCircleIcon className="w-4 h-4" />
              <span className="text-xs font-medium">Help</span>
            </button>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-600"></div>

          {/* Status */}
          <div className="flex items-center space-x-2">
            <div className="status-dot online w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-400">Ready</span>
          </div>

          {/* Live Stream Status */}
          <LiveStreamStatus 
            isConnected={isConnected}
            selectedTool={selectedTool}
            lastActivatedTool={lastActivatedTool}
          />

          {/* User Profile */}
          <button
            onClick={onProfileAction}
            className="top-toolbar-btn p-1.5 text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all duration-200"
            title="User profile"
          >
            <UserCircleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Ribbon Groups */}
      <div className="ribbon-groups flex">
        {Object.entries(BIM_TOOLS_GROUPS).map(([groupKey, group]) => 
          renderGroup(groupKey, group)
        )}
      </div>
    </div>
  );
};



// Legacy Toolbar component (keeping for compatibility)
const Toolbar = ({ selectedTool, onToolSelect, currentProject, onBackToProjects }) => {
  // Split tools into two rows
  const toolsRow1 = BIM_TOOLS.slice(0, 10);
  const toolsRow2 = BIM_TOOLS.slice(10);

  return (
    <div className="glass h-24 px-6 flex items-center justify-between border-b border-gray-700/50">
      {/* Logo and Project Info */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-lg">
            <img 
              src="./studiosix-icon.svg" 
              alt="StudioSix Icon" 
              className="w-5 h-5"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">StudioSix Pro</h1>
            <p className="text-xs text-gray-400">BIM Modeler</p>
          </div>
        </div>
        
        {/* Project Info */}
        {currentProject && (
          <div className="flex items-center space-x-3">
            <div className="h-6 w-px bg-gray-600"></div>
            <div>
              <p className="text-sm font-medium text-white">
                {currentProject.projectData?.name || currentProject.template?.title || currentProject.name || 'Untitled Project'}
              </p>
              <p className="text-xs text-gray-400">
                {currentProject.template?.title || currentProject.type || 'Project'}
              </p>
            </div>
            <button
              onClick={onBackToProjects}
              className="p-1 rounded hover:bg-slate-700/50 transition-colors"
              title="Back to Projects"
            >
              <FolderIcon className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>
          </div>
        )}
      </div>

      {/* BIM Tools - 2 Row Layout */}
      <div className="flex flex-col space-y-1">
        {/* Row 1: Core Building Elements */}
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
          {toolsRow1.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onToolSelect(tool.id)}
                className={`toolbar-btn flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200 whitespace-nowrap min-w-fit ${
                  selectedTool === tool.id
                    ? 'bg-studiosix-600 text-white neon-purple'
                    : 'glass-light text-gray-300 hover:text-white hover:bg-studiosix-600/20'
                }`}
                title={`${tool.name} - ${tool.description}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-medium">{tool.name}</span>
              </button>
            );
          })}
        </div>
        
        {/* Row 2: Openings, Systems & Tools */}
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
          {toolsRow2.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onToolSelect(tool.id)}
                className={`toolbar-btn flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200 whitespace-nowrap min-w-fit ${
                  selectedTool === tool.id
                    ? 'bg-studiosix-600 text-white neon-purple'
                    : 'glass-light text-gray-300 hover:text-white hover:bg-studiosix-600/20'
                }`}
                title={`${tool.name} - ${tool.description}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-medium">{tool.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* View Controls */}
      <div className="flex items-center space-x-2">
        <div className="status-dot online w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-sm text-gray-400">Ready</span>
      </div>
    </div>
  );
};

// FreeCAD Integration Functions
const executeBIMCommand = async (toolId, params = {}) => {
  // TEMPORARILY DISABLED - Backend server not available
  console.log('🚫 BIM Command temporarily disabled (backend server not running):', toolId);
  return { success: false, error: 'Backend server not available', localFallback: true };
  
  /* ORIGINAL CODE - RE-ENABLE WHEN BACKEND IS RUNNING
  try {
    const response = await axios.post(`${API_BASE_URL}/freecad/bim-command`, {
      command: toolId,
      parameters: params
    });
    return response.data;
  } catch (error) {
    console.error('FreeCAD BIM Command Error:', error);
    
    // Check if backend server is not running
    if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || !error.response) {
      console.warn('⚠️ Backend server not available - command will be handled locally');
      return { success: false, error: 'Backend server not available', localFallback: true };
    }
    
    // Don't throw error to prevent app crashes
    return { success: false, error: error.message };
  }
  */
};

const BIM_COMMAND_MAP = {
  // Navigation tools
  'pointer': { command: null, type: null }, // Selection mode
  'pan': { command: null, type: null }, // Pan viewport
  'orbit': { command: null, type: null }, // Orbit viewport
  'zoom-fit': { command: null, type: null }, // Fit to view
  
  // Building Elements
  'wall': { command: 'wall', type: 'wall' },
  'slab': { command: 'slab', type: 'slab' },
  'roof': { command: 'roof', type: 'roof' },
  'column': { command: 'column', type: 'column' },
  'beam': { command: 'beam', type: 'beam' },
  
  // Circulation
  'stair': { command: 'stair', type: 'stair' },
  'ramp': { command: 'ramp', type: 'ramp' },
  
  // Advanced Elements
  'shell': { command: 'shell', type: 'shell' },
  
  // Openings
  'door': { command: 'door', type: 'door' },
  'window': { command: 'window', type: 'window' },
  'skylight': { command: 'skylight', type: 'skylight' },
  
  // Analysis & Tools
  'space': { command: 'space', type: 'space' },
  'equipment': { command: 'equipment', type: 'equipment' },
  'material': { command: 'material', type: 'material' },
  
  // Annotation
  'tag': { command: 'tag', type: 'annotation' },
  'dimension': { command: 'dimension', type: 'dimension' },
  
  // AI Tools
  'ai-chat': { command: null, type: null }, // AI Assistant Chat
  'ai-render': { command: null, type: null }, // AI Rendering Tool
  'voice-command': { command: null, type: null }, // Voice Commands
};

// Project Tree Component with Collapsible Sidebar
const ProjectTree = ({ selectedItem, onItemSelect, currentFloor, onFloorChange }) => {
  const [expandedItems, setExpandedItems] = useState(['levels', 'ground', 'first']);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleExpanded = (itemId) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleCollapsed = () => {
    setIsCollapsed(prev => !prev);
  };

  const addNewFloor = () => {
    const floorCount = PROJECT_TREE[0].children.length;
    const floorNumber = floorCount + 1;
    const floorName = floorNumber === 2 ? 'Second Floor' : `Floor ${floorNumber}`;
    const floorId = `floor${floorNumber}`;
    
    const newFloor = {
      id: floorId,
      name: floorName,
      icon: BuildingOfficeIcon,
      type: 'floor',
      level: floorNumber - 1,
      children: [
        {
          id: `${floorId}-walls`,
          name: 'Walls',
          icon: FolderIcon,
          floor: floorId,
          children: [
            { id: `${floorId}-ext-walls`, name: 'Exterior Walls', icon: RectangleStackIcon, floor: floorId },
            { id: `${floorId}-int-walls`, name: 'Interior Walls', icon: RectangleStackIcon, floor: floorId },
          ]
        },
        {
          id: `${floorId}-openings`,
          name: 'Openings',
          icon: FolderIcon,
          floor: floorId,
          children: [
            { id: `${floorId}-doors`, name: 'Doors', icon: DoorIcon, floor: floorId },
            { id: `${floorId}-windows`, name: 'Windows', icon: Squares3x3Icon, floor: floorId },
          ]
        },
        {
          id: `${floorId}-furniture`,
          name: 'Furniture',
          icon: FolderIcon,
          floor: floorId,
          children: []
        }
      ]
    };
    
    // Add to PROJECT_TREE (this would ideally be state-managed)
    PROJECT_TREE[0].children.push(newFloor);
    
    // Expand the new floor
    setExpandedItems(prev => [...prev, floorId]);
  };

  const TreeItem = ({ item, level = 0 }) => {
    const Icon = item.icon;
    const isExpanded = expandedItems.includes(item.id);
    const isSelected = selectedItem === item.id;

    return (
      <div>
        <div
          className={`tree-item flex items-center p-2 cursor-pointer transition-all duration-200 ${
            isSelected ? 'active bg-studiosix-600/20 border-l-2 border-studiosix-500' : 'hover:bg-slate-700/30'
          } ${isCollapsed ? 'justify-center' : 'space-x-2'}`}
          style={{ paddingLeft: isCollapsed ? '0px' : `${level * 16 + 8}px` }}
          onClick={() => {
            onItemSelect(item.id);
            
            // Handle floor selection for 2D viewport switching
            if (item.type === 'floor') {
              onFloorChange(item.id);
            }
            
            if (item.children && !isCollapsed) toggleExpanded(item.id);
          }}
          title={isCollapsed ? item.name : ''}
        >
          <Icon className={`w-4 h-4 ${isSelected ? 'text-studiosix-400' : 'text-gray-400'} ${isCollapsed ? 'mx-auto' : ''}`} />
          {!isCollapsed && (
            <>
              <span className="text-sm text-gray-200 flex-1">{item.name}</span>
              {item.id === 'levels' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addNewFloor();
                  }}
                  className="p-1 rounded hover:bg-studiosix-600/30 transition-colors"
                  title="Add New Floor"
                >
                  <PlusIcon className="w-3 h-3 text-gray-400 hover:text-studiosix-400" />
                </button>
              )}
              {item.children && (
                <div className={`transform transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                }`}>
                  <PlayIcon className="w-3 h-3 text-gray-500" />
                </div>
              )}
            </>
          )}
        </div>
        {item.children && isExpanded && !isCollapsed && (
          <div>
            {item.children.map(child => (
              <TreeItem key={child.id} item={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`glass h-full border-r border-gray-700/50 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-80'
    }`}>
      {/* Header with Collapse Toggle */}
      <div className={`p-4 border-b border-gray-700/50 flex items-center ${
        isCollapsed ? 'justify-center' : 'justify-between'
      }`}>
        {!isCollapsed && (
          <h2 className="text-lg font-semibold text-white flex items-center">
            <FolderIcon className="w-5 h-5 mr-2 text-studiosix-400" />
            Project
          </h2>
        )}
        <button
          onClick={toggleCollapsed}
          className="p-1 rounded-md hover:bg-slate-700/50 transition-colors"
          title={isCollapsed ? 'Expand Project Tree' : 'Collapse Project Tree'}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="w-4 h-4 text-gray-400 hover:text-white" />
          ) : (
            <ChevronLeftIcon className="w-4 h-4 text-gray-400 hover:text-white" />
          )}
        </button>
      </div>

      {/* Tree Content */}
      <div className={`${isCollapsed ? 'p-2' : 'p-4'} space-y-1`}>
        {PROJECT_TREE.map(item => (
          <TreeItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};

// Unified Viewport Controls Menu Component
const ViewportControlsMenu = ({ viewMode, onViewModeChange, viewportTheme, onThemeChange, viewportMode, onViewportModeChange }) => {
  return (
    <div className="absolute top-4 right-4 z-20">
      <div className={`glass-light rounded-lg p-2 backdrop-blur-md border transition-all duration-300 shadow-lg ${
        viewportTheme === 'light' 
          ? 'bg-white/30 border-white/40' 
          : 'bg-gray-900/30 border-gray-700/50'
      }`}>
        <div className="flex flex-col space-y-1">
          {/* 2D/3D Viewport Toggle */}
          <div className="flex bg-black/20 rounded-md p-0.5 space-x-0.5">
            <button
              onClick={() => onViewportModeChange('2d')}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-all duration-200 ${
                viewportMode === '2d'
                  ? 'bg-studiosix-600 text-white shadow-md'
                  : viewportTheme === 'dark'
                    ? 'text-gray-300 hover:bg-white/10'
                    : 'text-gray-600 hover:bg-black/10'
              }`}
              title="2D Drafting View"
            >
              2D
            </button>
            <button
              onClick={() => onViewportModeChange('3d')}
              className={`px-2 py-1.5 rounded text-xs font-medium transition-all duration-200 ${
                viewportMode === '3d'
                  ? 'bg-studiosix-600 text-white shadow-md'
                  : viewportTheme === 'dark'
                    ? 'text-gray-300 hover:bg-white/10'
                    : 'text-gray-600 hover:bg-black/10'
              }`}
              title="3D Visualization View"
            >
              3D
            </button>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-white/20"></div>

          {/* Theme Toggle - Light/Dark */}
        <button
          onClick={() => onThemeChange(viewportTheme === 'dark' ? 'light' : 'dark')}
            className={`p-1.5 rounded-md transition-all duration-200 ${
            viewportTheme === 'dark' 
              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 hover:scale-105' 
              : 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 hover:scale-105'
          }`}
          title={`Switch to ${viewportTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {viewportTheme === 'dark' ? (
              <SunIcon className="w-4 h-4" />
          ) : (
              <MoonIcon className="w-4 h-4" />
          )}
        </button>
        </div>
      </div>
    </div>
  );
  };



// 2D Viewport Component (Plan View)
const Viewport2D = ({ selectedTool, onObjectSelect, cadObjects = [], createObject, deleteObject, viewportTheme }) => {
  const svgRef = useRef(null);
  const [viewCenter, setViewCenter] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectedObjects, setSelectedObjects] = useState(new Set());
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  
  // Log only when objects are added/removed, not on every render
  useEffect(() => {
    if (cadObjects.length > 0) {
      console.log('📦 Viewport2D: Objects updated:', cadObjects.length);
    }
  }, [cadObjects.length]);
  
  // 2D Drafting state
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftStartPoint, setDraftStartPoint] = useState(null);
  const [draftPreview, setDraftPreview] = useState(null);
  const [draftCurrentPoint, setDraftCurrentPoint] = useState(null);

  // Tools that support click-and-drag drafting
  const isDraftingTool = useCallback((tool) => {
    return ['wall', 'beam', 'slab'].includes(tool);
  }, []);

  // Convert 3D position to 2D plan view (X-Z plane, Y is height)
  // Using standard CAD coordinate system: 1 unit = 1 meter
  const to2D = useCallback((pos3d) => {
    const scale = 40 * zoom; // Increased scale for better visibility (40px per meter)
    const result = {
      x: 400 + (pos3d.x * scale) - (viewCenter.x * scale),
      y: 300 - (pos3d.z * scale) + (viewCenter.y * scale) // Flip Z for proper orientation
    };
    
    // Debug coordinate transformation for axis snapping analysis (only when needed)
    if (isDrafting && window._debugAxisSnapping) {
      console.log('🔍 COORDINATE TRANSFORM to2D:', {
        input3D: { x: pos3d.x.toFixed(6), z: pos3d.z.toFixed(6) },
        scale: scale.toFixed(2),
        viewCenter: { x: viewCenter.x.toFixed(6), y: viewCenter.y.toFixed(6) },
        output2D: { x: result.x.toFixed(2), y: result.y.toFixed(2) }
      });
    }
    
    return result;
  }, [viewCenter, zoom, isDrafting]);

  // Convert 2D click back to 3D position
  const to3D = useCallback((pos2d) => {
    const scale = 40 * zoom; // Match the scale above
    const result = {
      x: (pos2d.x - 400 + (viewCenter.x * scale)) / scale,
      y: 0, // Default ground level
      z: -(pos2d.y - 300 - (viewCenter.y * scale)) / scale // Flip back
    };
    
    // Debug coordinate transformation for axis snapping analysis (only when needed)
    if (isDrafting && window._debugAxisSnapping) {
      console.log('🔍 COORDINATE TRANSFORM to3D:', {
        input2D: { x: pos2d.x.toFixed(2), y: pos2d.y.toFixed(2) },
        scale: scale.toFixed(2),
        viewCenter: { x: viewCenter.x.toFixed(6), y: viewCenter.y.toFixed(6) },
        output3D: { x: result.x.toFixed(6), z: result.z.toFixed(6) },
        calculation: {
          x: `(${pos2d.x.toFixed(2)} - 400 + ${(viewCenter.x * scale).toFixed(2)}) / ${scale.toFixed(2)}`,
          z: `-(${pos2d.y.toFixed(2)} - 300 - ${(viewCenter.y * scale).toFixed(2)}) / ${scale.toFixed(2)}`
        }
      });
    }
    
    return result;
  }, [viewCenter, zoom, isDrafting]);

  // Handle SVG mouse down for drafting or selection
  const handleSvgMouseDown = useCallback((event) => {
    // Handle panning first
    if (event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: event.clientX, y: event.clientY });
      return;
    }

    const rect = svgRef.current.getBoundingClientRect();
    const clickPos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // Check if clicking on an object
    let clickedObject = null;
            for (const object of cadObjects) {
      const pos2d = to2D(object.position);
      const scale = 40 * zoom;
      const objWidth = (object.length || object.width || 1) * scale;
      const objHeight = (object.thickness || object.depth || object.width || 1) * scale;
      
      if (clickPos.x >= pos2d.x - objWidth/2 && 
          clickPos.x <= pos2d.x + objWidth/2 && 
          clickPos.y >= pos2d.y - objHeight/2 && 
          clickPos.y <= pos2d.y + objHeight/2) {
        clickedObject = object;
        break;
      }
    }

    if (clickedObject) {
      // Select object
      setSelectedObjects(new Set([clickedObject.id]));
      onObjectSelect?.(clickedObject.id, clickedObject);
    } else if (selectedTool && selectedTool !== 'pointer') {
      if (isDraftingTool(selectedTool)) {
        const worldPos = to3D(clickPos);
        
        if (!isDrafting) {
          // First click: Start drafting mode
          console.log('🎯 FIRST CLICK DEBUG:', {
            'selectedTool': selectedTool,
            '2D Click Position': clickPos,
            '3D World Position': worldPos,
            'Scale Factor': 40 * zoom,
            'View Center': viewCenter
          });
                  setIsDrafting(true);
        setDraftStartPoint(worldPos);
        } else {
          // Second click: Complete the drafting and create object
          
          console.log('🔍 SECOND CLICK DEBUG: Initial coordinates', {
            raw2DClick: { x: clickPos.x.toFixed(2), y: clickPos.y.toFixed(2) },
            raw3DWorld: { x: worldPos.x.toFixed(6), z: worldPos.z.toFixed(6) },
            startPoint: { x: draftStartPoint.x.toFixed(6), z: draftStartPoint.z.toFixed(6) },
            currentDraftPoint: draftCurrentPoint ? { x: draftCurrentPoint.x.toFixed(6), z: draftCurrentPoint.z.toFixed(6) } : 'null'
          });
          
          // 🔧 COORDINATE COMPATIBILITY: Use the already-snapped coordinates from CAD2DViewport
          // The CAD2DViewport.js has already applied axis snapping during mouse movement
          // Use draftCurrentPoint if available (contains the snapped coordinates)
          const isShiftPressed = event.shiftKey;
          if (isShiftPressed && draftCurrentPoint) {
            console.log('🔧 COORDINATE SYNC: Using pre-snapped coordinates from CAD2DViewport', {
              rawClick: { x: worldPos.x.toFixed(6), z: worldPos.z.toFixed(6) },
              snappedFromPreview: { x: draftCurrentPoint.x.toFixed(6), z: draftCurrentPoint.z.toFixed(6) },
              coordinateSource: 'CAD2DViewport enhanced shift lock'
            });
            
            // Use the already-snapped coordinates from the preview
            worldPos = { ...draftCurrentPoint };
          } else if (isShiftPressed) {
            // Fallback: Apply simple axis snapping if no preview coordinates available
            console.log('🔧 FALLBACK SNAP: No preview coordinates, applying simple axis snapping');
            const originalWorldPos = { ...worldPos };
            worldPos = snapToAxis(worldPos, draftStartPoint, true);
            
            console.log('🔍 FALLBACK SNAP RESULT:', {
              original: { x: originalWorldPos.x.toFixed(6), z: originalWorldPos.z.toFixed(6) },
              snapped: { x: worldPos.x.toFixed(6), z: worldPos.z.toFixed(6) }
            });
          }
          
          if (isShiftPressed) {
            console.log('📊 FINAL AXIS ALIGNMENT CHECK:', {
              startPoint: { x: draftStartPoint.x.toFixed(6), z: draftStartPoint.z.toFixed(6) },
              finalPoint: { x: worldPos.x.toFixed(6), z: worldPos.z.toFixed(6) },
              axisAlignment: {
                horizontal: Math.abs(worldPos.z - draftStartPoint.z) < 0.000001,
                vertical: Math.abs(worldPos.x - draftStartPoint.x) < 0.000001,
                deviation: {
                  fromHorizontal: Math.abs(worldPos.z - draftStartPoint.z).toFixed(6),
                  fromVertical: Math.abs(worldPos.x - draftStartPoint.x).toFixed(6)
                }
              },
              usingCoordinateSource: draftCurrentPoint ? 'CAD2DViewport' : 'App.js fallback'
            });
          }
          
          console.log('🎯 SECOND CLICK DEBUG:', {
            'selectedTool': selectedTool,
            '2D Click Position': clickPos,
            '3D World Position': worldPos,
            'Draft Start Point': draftStartPoint,
            'Scale Factor': 40 * zoom,
            'View Center': viewCenter,
            'Axis Snapping': isShiftPressed ? 'ENABLED' : 'DISABLED',
            'Final Position': worldPos
          });
          
          if (selectedTool === 'wall') {
            const deltaX = worldPos.x - draftStartPoint.x;
            const deltaZ = worldPos.z - draftStartPoint.z;
            const length = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
            
            if (length > 0.1) { // Minimum wall length
              const centerX = (draftStartPoint.x + worldPos.x) / 2;
              const centerZ = (draftStartPoint.z + worldPos.z) / 2;
              
              // Calculate rotation angle to align wall with drawn direction
              // atan2 gives angle in radians, Y-axis rotation for wall orientation
              const rotationY = Math.atan2(deltaX, deltaZ);
              
              // Detailed axis alignment analysis
              const isHorizontalAlignment = Math.abs(deltaZ) < 0.001; // Perfectly horizontal
              const isVerticalAlignment = Math.abs(deltaX) < 0.001;   // Perfectly vertical
              const axisDeviation = {
                fromHorizontal: Math.abs(deltaZ),
                fromVertical: Math.abs(deltaX),
                minimumDeviation: Math.min(Math.abs(deltaZ), Math.abs(deltaX))
              };
              
              console.log('🔍 AXIS ALIGNMENT ANALYSIS:', {
                startPoint: { x: draftStartPoint.x.toFixed(6), z: draftStartPoint.z.toFixed(6) },
                endPoint: { x: worldPos.x.toFixed(6), z: worldPos.z.toFixed(6) },
                deltaX: deltaX.toFixed(6),
                deltaZ: deltaZ.toFixed(6),
                isPerfectHorizontal: isHorizontalAlignment,
                isPerfectVertical: isVerticalAlignment,
                deviation: {
                  fromHorizontal: axisDeviation.fromHorizontal.toFixed(6),
                  fromVertical: axisDeviation.fromVertical.toFixed(6),
                  minimum: axisDeviation.minimumDeviation.toFixed(6)
                },
                axisSnappingWasActive: isShiftPressed
              });
              
              console.log('🏗️ Creating wall - DETAILED DEBUG:', {
                'INPUT - Start Point (3D)': draftStartPoint,
                'INPUT - End Point (3D)': worldPos,
                'CALC - Delta X': deltaX,
                'CALC - Delta Z': deltaZ,
                'CALC - Length': length,
                'CALC - Center': { x: centerX, y: 0, z: centerZ },
                'CALC - Rotation Y (radians)': rotationY,
                'CALC - Rotation Y (degrees)': `${(rotationY * 180 / Math.PI).toFixed(1)}°`,
                'DRAWING DIRECTION': deltaX > 0 ? (deltaZ > 0 ? 'Northeast' : 'Southeast') : (deltaZ > 0 ? 'Northwest' : 'Southwest'),
                'EXPECTED WALL ORIENTATION': `${Math.abs(deltaX) > Math.abs(deltaZ) ? 'Mainly horizontal' : 'Mainly vertical'}`,
                'AXIS SNAP QUALITY': isShiftPressed ? (isHorizontalAlignment || isVerticalAlignment ? '✅ PERFECT' : '⚠️ IMPERFECT') : 'N/A'
              });
              
              if (createObject) {
                const wallData = {
                  length: length,
                  height: 2.5, // Standard wall height
                  thickness: 0.2, // Standard wall thickness
                  rotation: { x: 0, y: rotationY, z: 0 }, // Proper wall orientation
                  startPoint: draftStartPoint,
                  endPoint: worldPos
                };
                
                console.log('✅ SENDING TO BACKEND - createObject call:', {
                  'Type': 'wall',
                  'Position': { x: centerX, y: 0, z: centerZ },
                  'Wall Data': wallData,
                  'Rotation Details': {
                    'rotationY (radians)': rotationY,
                    'rotationY (degrees)': (rotationY * 180 / Math.PI).toFixed(1),
                    'Full rotation object': wallData.rotation
                  }
                });
                
                createObject('wall', { x: centerX, y: 0, z: centerZ }, wallData);
              } else {
                console.log('❌ createObject function is null/undefined');
              }
            } else if (selectedTool === 'slab') {
              const width = Math.abs(worldPos.x - draftStartPoint.x);
              const depth = Math.abs(worldPos.z - draftStartPoint.z);
              
              if (width > 0.1 && depth > 0.1) { // Minimum slab dimensions
                const centerX = (draftStartPoint.x + worldPos.x) / 2;
                const centerZ = (draftStartPoint.z + worldPos.z) / 2;
                
                createObject?.('slab',
                  { x: centerX, y: 0, z: centerZ },
                  {
                    width: width,
                    depth: depth,
                    thickness: 0.2 // Standard slab thickness
                  }
                );
              }
            } else if (selectedTool === 'beam') {
              const length = Math.sqrt(
                Math.pow(worldPos.x - draftStartPoint.x, 2) + 
                Math.pow(worldPos.z - draftStartPoint.z, 2)
              );
              
              if (length > 0.1) { // Minimum beam length
                const centerX = (draftStartPoint.x + worldPos.x) / 2;
                const centerZ = (draftStartPoint.z + worldPos.z) / 2;
                
                createObject?.('beam',
                  { x: centerX, y: 1.5, z: centerZ }, // Elevated for beam
                  {
                    length: length,
                    width: 0.3,
                    height: 0.5,
                    startPoint: draftStartPoint,
                    endPoint: worldPos
                  }
                );
              }
            }
            
            // Reset drafting state
            console.log('🔄 Resetting drafting state');
            setIsDrafting(false);
            setDraftStartPoint(null);
            setDraftPreview(null);
            setDraftCurrentPoint(null);
          } else if (selectedTool === 'slab') {
            const width = Math.abs(worldPos.x - draftStartPoint.x);
            const depth = Math.abs(worldPos.z - draftStartPoint.z);
            
            if (width > 0.1 && depth > 0.1) { // Minimum slab dimensions
              const centerX = (draftStartPoint.x + worldPos.x) / 2;
              const centerZ = (draftStartPoint.z + worldPos.z) / 2;
              
              createObject?.('slab',
                { x: centerX, y: 0, z: centerZ },
                {
                  width: width,
                  depth: depth,
                  thickness: 0.2 // Standard slab thickness
                }
              );
            }
          } else if (selectedTool === 'beam') {
            const length = Math.sqrt(
              Math.pow(worldPos.x - draftStartPoint.x, 2) + 
              Math.pow(worldPos.z - draftStartPoint.z, 2)
            );
            
            if (length > 0.1) { // Minimum beam length
              const centerX = (draftStartPoint.x + worldPos.x) / 2;
              const centerZ = (draftStartPoint.z + worldPos.z) / 2;
              
              createObject?.('beam',
                { x: centerX, y: 1.5, z: centerZ }, // Elevated for beam
                {
                  length: length,
                  width: 0.3,
                  height: 0.5,
                  startPoint: draftStartPoint,
                  endPoint: worldPos
                }
              );
            }
          }
          
          // Reset drafting state
          console.log('🔄 Resetting drafting state');
          setIsDrafting(false);
          setDraftStartPoint(null);
          setDraftPreview(null);
          setDraftCurrentPoint(null);
        }
      } else {
        // Single-click creation for doors, windows, columns, etc.
        const pos3d = to3D(clickPos);
        createObject?.(selectedTool, pos3d);
      }
    } else {
      // Deselect all
      setSelectedObjects(new Set());
      onObjectSelect?.(null, null);
    }
  }, [selectedTool, cadObjects, to2D, to3D, createObject, onObjectSelect, zoom, isDraftingTool, isDrafting, draftStartPoint, draftCurrentPoint, snapToAxis]);

  // Utility function for axis snapping
  const snapToAxis = useCallback((currentPos, startPos, enableSnapping) => {
    if (!enableSnapping || !startPos) {
      console.log('🔍 SNAP DEBUG: Snapping disabled or no start point', {
        enableSnapping,
        hasStartPos: !!startPos,
        currentPos
      });
      return currentPos;
    }
    
    const deltaX = Math.abs(currentPos.x - startPos.x);
    const deltaZ = Math.abs(currentPos.z - startPos.z);
    
    console.log('🔍 SNAP DEBUG: Analyzing axis preference', {
      startPos: { x: startPos.x.toFixed(6), z: startPos.z.toFixed(6) },
      currentPos: { x: currentPos.x.toFixed(6), z: currentPos.z.toFixed(6) },
      deltaX: deltaX.toFixed(6),
      deltaZ: deltaZ.toFixed(6),
      dominantAxis: deltaX > deltaZ ? 'HORIZONTAL' : 'VERTICAL'
    });
    
    // Determine if we should snap to horizontal or vertical axis
    // If the mouse is closer to horizontal, snap to horizontal axis (preserve start Z)
    // If the mouse is closer to vertical, snap to vertical axis (preserve start X)
    let snappedPos;
    if (deltaX > deltaZ) {
      // Horizontal movement dominant - constrain to horizontal axis
      snappedPos = {
        x: currentPos.x,
        y: currentPos.y,
        z: startPos.z  // Lock Z to start position
      };
      console.log('🔍 SNAP DEBUG: Applied HORIZONTAL constraint', {
        original: { x: currentPos.x.toFixed(6), z: currentPos.z.toFixed(6) },
        snapped: { x: snappedPos.x.toFixed(6), z: snappedPos.z.toFixed(6) },
        zDifference: Math.abs(currentPos.z - snappedPos.z).toFixed(6)
      });
    } else {
      // Vertical movement dominant - constrain to vertical axis
      snappedPos = {
        x: startPos.x,  // Lock X to start position
        y: currentPos.y,
        z: currentPos.z
      };
      console.log('🔍 SNAP DEBUG: Applied VERTICAL constraint', {
        original: { x: currentPos.x.toFixed(6), z: currentPos.z.toFixed(6) },
        snapped: { x: snappedPos.x.toFixed(6), z: snappedPos.z.toFixed(6) },
        xDifference: Math.abs(currentPos.x - snappedPos.x).toFixed(6)
      });
    }
    
    return snappedPos;
  }, []);

  // Debug utility functions for axis snapping analysis
  useEffect(() => {
    // Add global debug utilities to window for console access
    window.debugAxisSnapping = {
      enableDetailed: () => {
        window._debugAxisSnapping = true;
        console.log('🔍 Detailed axis snapping debugging ENABLED');
      },
      disableDetailed: () => {
        window._debugAxisSnapping = false;
        console.log('🔍 Detailed axis snapping debugging DISABLED');
      },
      testCoordinateRoundTrip: (x, z) => {
        const scale = 40 * zoom;
        console.log('🔍 COORDINATE ROUND-TRIP TEST:', {
          input3D: { x, z },
          to2D: {
            x: 400 + (x * scale) - (viewCenter.x * scale),
            y: 300 - (z * scale) + (viewCenter.y * scale)
          },
          backTo3D: {
            x: ((400 + (x * scale) - (viewCenter.x * scale)) - 400 + (viewCenter.x * scale)) / scale,
            z: -((300 - (z * scale) + (viewCenter.y * scale)) - 300 - (viewCenter.y * scale)) / scale
          },
          precision: {
            xLoss: Math.abs(x - (((400 + (x * scale) - (viewCenter.x * scale)) - 400 + (viewCenter.x * scale)) / scale)),
            zLoss: Math.abs(z - (-((300 - (z * scale) + (viewCenter.y * scale)) - 300 - (viewCenter.y * scale)) / scale))
          }
        });
      }
    };
    
    console.log('🔍 Axis snapping debug utilities available:');
    console.log('  window.debugAxisSnapping.enableDetailed() - Enable detailed coordinate debugging');
    console.log('  window.debugAxisSnapping.disableDetailed() - Disable detailed coordinate debugging');  
    console.log('  window.debugAxisSnapping.testCoordinateRoundTrip(x, z) - Test coordinate precision');
    console.log('  window.debugAxisSnapping.disableJoinery() - Disable wall joinery system to test pure axis snapping');
    console.log('  window.debugAxisSnapping.enableJoinery() - Re-enable wall joinery system');
    console.log('  window.debugAxisSnapping.showCoordinateFlow() - Show coordinate processing flow diagram');
    console.log('');
    console.log('📝 NOTE: Primary axis snapping is handled by CAD2DViewport.js "ENHANCED SHIFT LOCK"');
    console.log('   App.js provides fallback snapping and coordinate synchronization');
    
    // Add joinery control functions
    window.debugAxisSnapping.disableJoinery = () => {
      window._disableWallJoinery = true;
      console.log('🔧 Wall joinery system DISABLED - test axis snapping without interference');
      console.log('   Note: Walls will not connect at corners until joinery is re-enabled');
    };
    
    window.debugAxisSnapping.enableJoinery = () => {
      window._disableWallJoinery = false;
      console.log('🔧 Wall joinery system ENABLED - walls will connect at corners');
    };
    
    // Add coordinate source debugging
    window.debugAxisSnapping.showCoordinateFlow = () => {
      console.log('🔍 COORDINATE FLOW ANALYSIS:');
      console.log('  1. Mouse movement → CAD2DViewport.js (ENHANCED SHIFT LOCK)');
      console.log('  2. Final click → App.js (coordinate synchronization)');
      console.log('  3. Wall creation → StandaloneCADEngine.js');
      console.log('  4. Optional: Wall joinery adjustments');
      console.log('');
      console.log('🎯 Look for these debug messages:');
      console.log('  CAD2DViewport: "🔒 ENHANCED SHIFT LOCK"');
      console.log('  App.js: "🔧 COORDINATE SYNC: Using pre-snapped coordinates"');
      console.log('  Joinery: "🚨 AXIS DRIFT WARNING" or "✅ AXIS PRESERVED"');
    };
  }, [zoom, viewCenter]);

  // Handle mouse move for drafting preview
  const handleSvgMouseMove = useCallback((event) => {
    if (isDrafting && draftStartPoint) {
      const rect = svgRef.current.getBoundingClientRect();
      const movePos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      let worldPos = to3D(movePos);
      
      // Apply axis snapping when shift key is held
      const isShiftPressed = event.shiftKey;
      
      // Enable detailed coordinate transformation debugging when shift is pressed
      window._debugAxisSnapping = isShiftPressed;
      
      console.log('🔍 MOUSE MOVE DEBUG: Raw coordinates', {
        mousePos2D: { x: movePos.x.toFixed(2), y: movePos.y.toFixed(2) },
        worldPos3D: { x: worldPos.x.toFixed(6), z: worldPos.z.toFixed(6) },
        startPoint: { x: draftStartPoint.x.toFixed(6), z: draftStartPoint.z.toFixed(6) },
        shiftPressed: isShiftPressed,
        detailedDebugging: window._debugAxisSnapping
      });
      
      // 🔧 COORDINATE COMPATIBILITY: CAD2DViewport.js handles axis snapping during mouse movement
      // Only apply App.js snapping if CAD2DViewport.js is not active
      if (isShiftPressed) {
        console.log('🔍 MOUSE MOVE DEBUG: Shift pressed - CAD2DViewport should handle axis snapping', {
          originalWorld: { x: worldPos.x.toFixed(6), z: worldPos.z.toFixed(6) },
          note: 'CAD2DViewport.js ENHANCED SHIFT LOCK will process these coordinates'
        });
        
        // Don't apply additional snapping here - let CAD2DViewport.js handle it
        // The worldPos will be used as-is and CAD2DViewport will snap it appropriately
      }
      
      // 🌉 COORDINATE BRIDGE: Set current point for coordinate synchronization
      setDraftCurrentPoint(worldPos);
      
      // Update preview - Wall handling now done by CAD2DViewport.js
      if (selectedTool === 'wall') {
        // 📝 NOTE: Wall preview and coordinates are now handled by CAD2DViewport.js with ENHANCED SHIFT LOCK
        console.log('🔍 APP.JS: Wall tool - preview and coordinates handled by CAD2DViewport.js', {
          note: 'CAD2DViewport handles wall preview, axis snapping, and coordinate updates via callback'
        });
      } else if (selectedTool === 'slab') {
        const width = Math.abs(worldPos.x - draftStartPoint.x);
        const depth = Math.abs(worldPos.z - draftStartPoint.z);
        setDraftPreview({
          type: 'slab',
          start: draftStartPoint,
          end: worldPos,
          width: width.toFixed(2),
          depth: depth.toFixed(2)
        });
      } else if (selectedTool === 'beam') {
        const length = Math.sqrt(
          Math.pow(worldPos.x - draftStartPoint.x, 2) + 
          Math.pow(worldPos.z - draftStartPoint.z, 2)
        );
        setDraftPreview({
          type: 'beam',
          start: draftStartPoint,
          end: worldPos,
          length: length.toFixed(2)
        });
      }
    }
  }, [isDrafting, draftStartPoint, selectedTool, to3D, snapToAxis]);

  // Render drafting preview
  const renderDraftPreview = useCallback(() => {
    if (!draftPreview || !draftStartPoint || !draftCurrentPoint) return null;

    const start2D = to2D(draftPreview.start);
    const end2D = to2D(draftPreview.end);

    const previewColor = viewportTheme === 'light' ? '#3b82f6' : '#60a5fa';
    const textColor = viewportTheme === 'light' ? '#1e40af' : '#93c5fd';

    if (draftPreview.type === 'wall') {
      const midX = (start2D.x + end2D.x) / 2;
      const midY = (start2D.y + end2D.y) / 2;
      
      // Calculate wall dimensions and orientation
      const deltaX = end2D.x - start2D.x;
      const deltaY = end2D.y - start2D.y;
      const wallLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const wallThickness = Math.max(20, (draftPreview.thickness || 0.2) * 40 * zoom); // Make thickness very visible - minimum 20px
      
      // Calculate wall angle for rotation
      const wallAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
      
      // DEBUG: Preview wall rendering
      console.log('🎨 PREVIEW WALL RENDERING DEBUG:', {
        'Preview Type': draftPreview.type,
        'Start 2D': start2D,
        'End 2D': end2D,
        'Delta X (2D)': deltaX,
        'Delta Y (2D)': deltaY,
        'Wall Length (pixels)': wallLength,
        'Wall Thickness (pixels)': wallThickness,
        'Wall Angle (degrees)': wallAngle.toFixed(1),
        'Mid Point': { x: midX, y: midY }
      });
      
      // Create wall rectangle centered on the line
      const wallRect = {
        x: midX - wallLength / 2,
        y: midY - wallThickness / 2,
        width: wallLength,
        height: wallThickness
      };
      
      return (
        <g key="draft-preview">
          {/* Wall thickness rectangle */}
          <rect
            x={wallRect.x}
            y={wallRect.y}
            width={wallRect.width}
            height={wallRect.height}
            fill="#6b7280" // Professional grey color
            stroke="#4b5563" // Darker grey border
            strokeWidth="2"
            opacity="0.7"
            transform={`rotate(${wallAngle} ${midX} ${midY})`}
          />
          
          {/* Center line for reference */}
          <line
            x1={start2D.x}
            y1={start2D.y}
            x2={end2D.x}
            y2={end2D.y}
            stroke="#4b5563"
            strokeWidth="1"
            strokeDasharray="3,3"
            opacity="0.5"
          />
          
          {/* Start point */}
          <circle cx={start2D.x} cy={start2D.y} r="4" fill="#4b5563" opacity="0.8" />
          
          {/* End point */}
          <circle cx={end2D.x} cy={end2D.y} r="4" fill="#4b5563" opacity="0.8" />
          
          {/* Dimension text */}
          <text
            x={midX}
            y={midY - wallThickness/2 - 8}
            fill={textColor}
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {draftPreview.length}m × {(draftPreview.thickness || 0.2)}m
            {draftPreview.isAxisSnapped && <tspan fill="#ef4444" fontWeight="bold"> [SNAPPED]</tspan>}
          </text>
          
          {/* Axis constraint visualization when shift is held */}
          {draftPreview.isAxisSnapped && (() => {
            const start3D = draftPreview.start;
            const end3D = draftPreview.end;
            
            // Determine constraint type based on which coordinate was constrained
            const isHorizontalConstrained = Math.abs(end3D.z - start3D.z) < 0.001;
            const isVerticalConstrained = Math.abs(end3D.x - start3D.x) < 0.001;
            
            const constraintColor = "#ef4444"; // Red color for constraint lines
            const svgBounds = svgRef.current?.getBoundingClientRect();
            const constraintLength = 50; // Length of constraint indicator lines
            
            if (isHorizontalConstrained) {
              // Show horizontal constraint line
              return (
                <>
                  <line
                    x1={start2D.x - constraintLength}
                    y1={start2D.y}
                    x2={end2D.x + constraintLength}
                    y2={end2D.y}
                    stroke={constraintColor}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.8"
                  />
                  <text
                    x={start2D.x - 60}
                    y={start2D.y - 5}
                    fill={constraintColor}
                    fontSize="10"
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    H-LOCK
                  </text>
                </>
              );
            } else if (isVerticalConstrained) {
              // Show vertical constraint line
              return (
                <>
                  <line
                    x1={start2D.x}
                    y1={start2D.y - constraintLength}
                    x2={end2D.x}
                    y2={end2D.y + constraintLength}
                    stroke={constraintColor}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.8"
                  />
                  <text
                    x={start2D.x + 10}
                    y={start2D.y - 20}
                    fill={constraintColor}
                    fontSize="10"
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    V-LOCK
                  </text>
                </>
              );
            }
            return null;
          })()}
        </g>
      );
    } else if (draftPreview.type === 'slab') {
      const x = Math.min(start2D.x, end2D.x);
      const y = Math.min(start2D.y, end2D.y);
      const width = Math.abs(end2D.x - start2D.x);
      const height = Math.abs(end2D.y - start2D.y);
      
      return (
        <g key="draft-preview">
          {/* Preview rectangle */}
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={previewColor}
            fillOpacity="0.3"
            stroke={previewColor}
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* Corner points */}
          <circle cx={start2D.x} cy={start2D.y} r="4" fill={previewColor} />
          <circle cx={end2D.x} cy={end2D.y} r="4" fill={previewColor} />
          
          {/* Dimension text */}
          <text
            x={x + width/2}
            y={y + height/2 - 8}
            fill={textColor}
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            {draftPreview.width}m × {draftPreview.depth}m
          </text>
        </g>
      );
    } else if (draftPreview.type === 'beam') {
      const midX = (start2D.x + end2D.x) / 2;
      const midY = (start2D.y + end2D.y) / 2;
      
      return (
        <g key="draft-preview">
          {/* Preview line (thicker for beam) */}
          <line
            x1={start2D.x}
            y1={start2D.y}
            x2={end2D.x}
            y2={end2D.y}
            stroke={previewColor}
            strokeWidth="5"
            strokeDasharray="8,4"
            opacity="0.8"
          />
          
          {/* Start point */}
          <circle cx={start2D.x} cy={start2D.y} r="4" fill={previewColor} />
          
          {/* End point */}
          <circle cx={end2D.x} cy={end2D.y} r="4" fill={previewColor} />
          
          {/* Dimension text */}
          <text
            x={midX}
            y={midY - 10}
            fill={textColor}
            fontSize="12"
            fontWeight="bold"
            textAnchor="middle"
            className="pointer-events-none select-none"
          >
            Beam: {draftPreview.length}m
          </text>
        </g>
      );
    }

    return null;
  }, [draftPreview, draftStartPoint, draftCurrentPoint, to2D, viewportTheme]);

  // Render object as 2D shape
  const renderObject2D = useCallback((object) => {
    const pos2d = to2D(object.position);
    const isSelected = selectedObjects.has(object.id);
    const scale = 40 * zoom; // Match the coordinate conversion scale
    
    // Determine object dimensions and color
    const getObjectProps = () => {
      switch (object.type) {
        case 'Wall':
          return {
            width: (object.length || 2.0) * scale,
            height: (object.thickness || 0.2) * scale,
            color: object.color || '#6b7280', // Professional grey color
            shape: 'rect'
          };
        case 'Column':
          return {
            width: (object.radius || 0.2) * 2 * scale,
            height: (object.radius || 0.2) * 2 * scale,
            color: object.color || '#374151',
            shape: 'circle'
          };
        case 'Beam':
          return {
            width: (object.length || 3.0) * scale,
            height: (object.width || 0.3) * scale,
            color: object.color || '#4b5563',
            shape: 'rect'
          };
        case 'Structure':
          // Handle generic Structure type - check dimensions to determine if Column or Beam
          if (object.radius) {
            // It's a Column
            return {
              width: (object.radius || 0.2) * 2 * scale,
              height: (object.radius || 0.2) * 2 * scale,
              color: object.color || '#374151',
              shape: 'circle'
            };
          } else {
            // It's a Beam
            return {
              width: (object.length || 3.0) * scale,
              height: (object.width || 0.3) * scale,
              color: object.color || '#4b5563',
              shape: 'rect'
            };
          }
        case 'Door':
          return {
            width: (object.width || 0.8) * scale,
            height: 6 * zoom, // Fixed height for doors in plan, scaled with zoom
            color: object.color || '#92400e',
            shape: 'door'
          };
        case 'Window':
          return {
            width: (object.width || 1.2) * scale,
            height: 6 * zoom, // Fixed height for windows in plan, scaled with zoom
            color: object.color || '#1e40af',
            shape: 'window'
          };
        case 'Slab':
          // Backend sends different property names than expected
          // Use the larger dimension as width, smaller as depth for better visualization
          const dim1 = object.length || object.width || 5;
          const dim2 = object.width || object.depth || 5;
          
          // Take the reasonable dimensions (larger than 0.1m)
          const slabLength = Math.max(dim1, dim2);
          const slabWidth = Math.min(dim1, dim2);
          
          // Ensure minimum reasonable size for visibility
          const finalLength = slabLength > 0.5 ? slabLength : 5;
          const finalWidth = slabWidth > 0.1 ? slabWidth : 3;
          
          return {
            width: finalLength * scale,  // Length in plan view
            height: finalWidth * scale,  // Width in plan view  
            color: object.color || '#6b7280',
            shape: 'rect'
          };
        case 'ImportedFile':
          return {
            width: (object.length || 5) * scale,
            height: (object.width || 5) * scale,
            color: object.color || '#ff6b6b',
            shape: 'rect'
          };
        case 'SketchUpBuilding':
          return {
            width: (object.length || 8) * scale,
            height: (object.width || 6) * scale,
            color: object.color || '#8b7355',
            shape: 'rect'
          };
        case 'SketchUpRoof':
          return {
            width: (object.length || 6) * scale,
            height: (object.width || 6) * scale,
            color: object.color || '#92400e',
            shape: 'circle'
          };
        case 'SketchUpModel':
          return {
            width: (object.length || 5) * scale,
            height: (object.width || 5) * scale,
            color: object.color || '#059669',
            shape: 'rect'
          };
        case 'Roof':
          return {
            width: (object.length || 8.0) * scale,
            height: (object.width || 6.0) * scale,
            color: object.color || '#8b94a8',
            shape: 'roof'
          };
        case 'Stair':
          return {
            width: (object.width || 1.2) * scale,
            height: (object.length || 4.0) * scale,
            color: object.color || '#a78851',
            shape: 'stair'
          };
        case 'Ramp':
          return {
            width: (object.width || 1.5) * scale,
            height: (object.length || 6.0) * scale,
            color: object.color || '#b8c5d1',
            shape: 'ramp'
          };
        case 'Space':
          return {
            width: (object.length || 4.0) * scale,
            height: (object.width || 4.0) * scale,
            color: object.color || '#10b981',
            shape: 'space'
          };
        case 'STEPModel':
          return {
            width: (object.length || 2.0) * scale,
            height: (object.width || 2.0) * scale,
            color: object.color || '#7c3aed',
            shape: 'rect'
          };
        default:
          return {
            width: scale,
            height: scale,
            color: object.color || '#6b7280',
            shape: 'rect'
          };
      }
    };

    const props = getObjectProps();
    const strokeColor = isSelected ? '#8b5cf6' : 'rgba(0,0,0,0.3)';
    const strokeWidth = isSelected ? 3 : 1;

    if (props.shape === 'circle') {
      return (
        <circle
          key={object.id}
          cx={pos2d.x}
          cy={pos2d.y}
          r={props.width / 2}
          fill={props.color}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={0.8}
        />
      );
    } else if (props.shape === 'door') {
      return (
        <g key={object.id}>
          <rect
            x={pos2d.x - props.width/2}
            y={pos2d.y - props.height/2}
            width={props.width}
            height={props.height}
            fill="none"
            stroke={props.color}
            strokeWidth={3}
            strokeDasharray="5,5"
          />
          <circle
            cx={pos2d.x + props.width/2 - 5}
            cy={pos2d.y}
            r="3"
            fill={props.color}
          />
          {isSelected && (
            <rect
              x={pos2d.x - props.width/2 - 2}
              y={pos2d.y - props.height/2 - 2}
              width={props.width + 4}
              height={props.height + 4}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          )}
        </g>
      );
    } else if (props.shape === 'window') {
      return (
        <g key={object.id}>
          <rect
            x={pos2d.x - props.width/2}
            y={pos2d.y - props.height/2}
            width={props.width}
            height={props.height}
            fill="rgba(173, 216, 230, 0.3)"
            stroke={props.color}
            strokeWidth={2}
          />
          <line
            x1={pos2d.x - props.width/2}
            y1={pos2d.y}
            x2={pos2d.x + props.width/2}
            y2={pos2d.y}
            stroke={props.color}
            strokeWidth={1}
          />
          {isSelected && (
            <rect
              x={pos2d.x - props.width/2 - 2}
              y={pos2d.y - props.height/2 - 2}
              width={props.width + 4}
              height={props.height + 4}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          )}
        </g>
      );
    } else if (props.shape === 'roof') {
      return (
        <g key={object.id}>
          <rect
            x={pos2d.x - props.width/2}
            y={pos2d.y - props.height/2}
            width={props.width}
            height={props.height}
            fill={props.color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={0.7}
            strokeDasharray="3,3"
          />
          <polygon
            points={`${pos2d.x - props.width/4},${pos2d.y - props.height/4} ${pos2d.x + props.width/4},${pos2d.y - props.height/4} ${pos2d.x},${pos2d.y + props.height/4}`}
            fill="none"
            stroke={props.color}
            strokeWidth={1}
          />
          {isSelected && (
            <rect
              x={pos2d.x - props.width/2 - 2}
              y={pos2d.y - props.height/2 - 2}
              width={props.width + 4}
              height={props.height + 4}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          )}
        </g>
      );
    } else if (props.shape === 'stair') {
      return (
        <g key={object.id}>
          <rect
            x={pos2d.x - props.width/2}
            y={pos2d.y - props.height/2}
            width={props.width}
            height={props.height}
            fill={props.color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={0.8}
          />
          {/* Stair steps */}
          {[...Array(5)].map((_, i) => (
            <line
              key={i}
              x1={pos2d.x - props.width/2}
              y1={pos2d.y - props.height/2 + (i + 1) * (props.height / 6)}
              x2={pos2d.x + props.width/2}
              y2={pos2d.y - props.height/2 + (i + 1) * (props.height / 6)}
              stroke={strokeColor}
              strokeWidth={1}
              opacity={0.6}
            />
          ))}
          {isSelected && (
            <rect
              x={pos2d.x - props.width/2 - 2}
              y={pos2d.y - props.height/2 - 2}
              width={props.width + 4}
              height={props.height + 4}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          )}
        </g>
      );
    } else if (props.shape === 'ramp') {
      return (
        <g key={object.id}>
          <rect
            x={pos2d.x - props.width/2}
            y={pos2d.y - props.height/2}
            width={props.width}
            height={props.height}
            fill={props.color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={0.8}
          />
          {/* Ramp direction arrow */}
          <polygon
            points={`${pos2d.x - props.width/4},${pos2d.y + props.height/4} ${pos2d.x + props.width/4},${pos2d.y} ${pos2d.x - props.width/4},${pos2d.y - props.height/4}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
          />
          {isSelected && (
            <rect
              x={pos2d.x - props.width/2 - 2}
              y={pos2d.y - props.height/2 - 2}
              width={props.width + 4}
              height={props.height + 4}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          )}
        </g>
      );
    } else if (props.shape === 'space') {
      return (
        <g key={object.id}>
          <rect
            x={pos2d.x - props.width/2}
            y={pos2d.y - props.height/2}
            width={props.width}
            height={props.height}
            fill={props.color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={0.3}
            strokeDasharray="5,5"
          />
          <text
            x={pos2d.x}
            y={pos2d.y}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={Math.min(props.width, props.height) * 0.1}
            fill={strokeColor}
          >
            Space
          </text>
          {isSelected && (
            <rect
              x={pos2d.x - props.width/2 - 2}
              y={pos2d.y - props.height/2 - 2}
              width={props.width + 4}
              height={props.height + 4}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          )}
        </g>
      );
    } else {
      // Check if object has rotation (especially for walls)
      const hasRotation = object.rotation && object.rotation.y !== 0;
      const rotationAngle = hasRotation ? (object.rotation.y * 180 / Math.PI) : 0;
      
      // DEBUG: 2D object rendering for walls
      if (object.type === 'Wall') {
        console.log(`🎨 2D WALL RENDERING DEBUG - ${object.id}:`, {
          'Object Position 3D': object.position,
          'Object Rotation': object.rotation,
          '2D Position': pos2d,
          'Has Rotation': hasRotation,
          'Rotation Angle (degrees)': rotationAngle.toFixed(1),
          'Props': props
        });
      }
      
      return (
        <rect
          key={object.id}
          x={pos2d.x - props.width/2}
          y={pos2d.y - props.height/2}
          width={props.width}
          height={props.height}
          fill={props.color}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={0.8}
          transform={hasRotation ? `rotate(${rotationAngle} ${pos2d.x} ${pos2d.y})` : undefined}
        />
      );
    }
  }, [to2D, selectedObjects, zoom]);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((event) => {
    // Prevent default scrolling behavior
    if (event.cancelable) {
      event.preventDefault();
    }
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // More comfortable zoom sensitivity
    const zoomFactor = event.deltaY > 0 ? 0.95 : 1.05; // 5% zoom steps
    const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));
    
    // Skip if zoom didn't actually change
    if (newZoom === zoom) return;
    
    // Use exact same logic as to3D function
    const currentScale = 40 * zoom;
    const worldX = (mouseX - 400 + (viewCenter.x * currentScale)) / currentScale;
    const worldZ = -(mouseY - 300 - (viewCenter.y * currentScale)) / currentScale;
    
    // Calculate new view center by inverting the to2D transformation
    // to2D: x = 400 + (pos3d.x * scale) - (viewCenter.x * scale)
    // to2D: y = 300 - (pos3d.z * scale) + (viewCenter.y * scale)
    // 
    // Solving for viewCenter:
    // viewCenter.x = (400 + worldX * newScale - mouseX) / newScale
    // viewCenter.y = (300 - worldZ * newScale - mouseY) / (-newScale)
    const newScale = 40 * newZoom;
    const newViewCenterX = (400 + worldX * newScale - mouseX) / newScale;
    const newViewCenterY = (300 - worldZ * newScale - mouseY) / (-newScale);
    
    
    setViewCenter({ x: newViewCenterX, y: newViewCenterY });
    setZoom(newZoom);
  }, [zoom, viewCenter]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((event) => {
    if (isPanning) {
      event.preventDefault();
      const deltaX = (event.clientX - lastPanPoint.x) / (40 * zoom);
      const deltaY = (event.clientY - lastPanPoint.y) / (40 * zoom);
      
      setViewCenter(prev => ({
        x: prev.x - deltaX,
        y: prev.y + deltaY // Flip Y for proper direction
      }));
      
      setLastPanPoint({ x: event.clientX, y: event.clientY });
    }
  }, [isPanning, lastPanPoint, zoom]);

  // Handle mouse up for panning
  const handleMouseUp = useCallback((event) => {
    if (event.button === 1 || event.button === 0) {
      setIsPanning(false);
    }
  }, []);

  // Add event listeners for panning
  useEffect(() => {
    const handleGlobalMouseMove = (e) => handleMouseMove(e);
    const handleGlobalMouseUp = (e) => handleMouseUp(e);

    if (isPanning) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, handleMouseMove, handleMouseUp]);

  // Add non-passive wheel event listener
  useEffect(() => {
    const svgElement = svgRef.current;
    if (svgElement) {
      svgElement.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        svgElement.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  return (
    <div className="h-full w-full relative overflow-hidden">
      <svg
        ref={svgRef}
        className={`w-full h-full ${isPanning ? 'cursor-grab' : (isDraftingTool(selectedTool) ? 'cursor-crosshair' : 'cursor-default')}`}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleSvgMouseMove}
        style={{
          backgroundColor: viewportTheme === 'light' ? '#f8fafc' : '#1a1a1a',
          touchAction: 'none' // Helps with passive event listener
        }}
      >
        {/* Fixed Grid Background */}
        <defs>
          <pattern
            id="grid"
            width={40 * zoom}
            height={40 * zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${400 - (viewCenter.x * 40 * zoom)}, ${300 + (viewCenter.y * 40 * zoom)})`}
          >
            <path
              d={`M ${40 * zoom} 0 L 0 0 0 ${40 * zoom}`}
              fill="none"
              stroke={viewportTheme === 'light' ? '#e2e8f0' : '#374151'}
              strokeWidth="0.5"
            />
          </pattern>
          <pattern
            id="gridMajor"
            width={200 * zoom}
            height={200 * zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${400 - (viewCenter.x * 40 * zoom)}, ${300 + (viewCenter.y * 40 * zoom)})`}
          >
            <rect width={200 * zoom} height={200 * zoom} fill="url(#grid)" />
            <path
              d={`M ${200 * zoom} 0 L 0 0 0 ${200 * zoom}`}
              fill="none"
              stroke={viewportTheme === 'light' ? '#cbd5e1' : '#4b5563'}
              strokeWidth="1"
            />
          </pattern>
        </defs>
        
        {/* Background grid */}
        <rect width="100%" height="100%" fill="url(#gridMajor)" />
        
        
        {/* Render all objects */}
        {cadObjects.map(object => (
          <g key={object.id}>
            {renderObject2D(object)}
          </g>
        ))}
        
        {/* Render drafting preview */}
        {renderDraftPreview()}
        
        {/* Center point indicator - smaller and more subtle */}
        <circle
          cx="400"
          cy="300"
          r="1.5"
          fill={viewportTheme === 'light' ? '#6b7280' : '#9ca3af'}
          opacity="0.5"
        />
      </svg>
      
      {/* Drafting status indicator */}
      {isDrafting && (
        <div className="absolute top-4 left-4 text-sm font-medium">
          <div className={`px-3 py-1 rounded-md backdrop-blur-md ${
            viewportTheme === 'light' 
              ? 'bg-blue-100/90 text-blue-800 border border-blue-200' 
              : 'bg-blue-900/90 text-blue-200 border border-blue-700'
          }`}>
            Drawing {selectedTool} - Click to finish
          </div>
        </div>
      )}
      
      {/* Object count indicator */}
      <div className="absolute bottom-4 left-4 text-sm">
        <div className={`px-3 py-1 rounded-md backdrop-blur-md ${
          viewportTheme === 'light' 
            ? 'bg-white/80 text-gray-600 border border-gray-200' 
            : 'bg-gray-900/80 text-gray-300 border border-gray-700'
        }`}>
          {cadObjects.length} object{cadObjects.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
        <button
          onClick={() => {
            const newZoom = Math.min(5, zoom * 1.2);
            setZoom(newZoom);
          }}
          className={`w-8 h-8 rounded-md backdrop-blur-md transition-all duration-200 flex items-center justify-center text-lg font-bold ${
            viewportTheme === 'light' 
              ? 'bg-white/90 text-gray-700 hover:bg-white border border-gray-200 hover:shadow-md' 
              : 'bg-gray-900/90 text-gray-300 hover:bg-gray-800 border border-gray-700 hover:text-white'
          }`}
          title="Zoom in"
        >
          +
        </button>
        <div className={`px-2 py-1 rounded-md backdrop-blur-md text-xs text-center ${
          viewportTheme === 'light' 
            ? 'bg-white/80 text-gray-600 border border-gray-200' 
            : 'bg-gray-900/80 text-gray-400 border border-gray-700'
        }`}>
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={() => {
            const newZoom = Math.max(0.1, zoom / 1.2);
            setZoom(newZoom);
          }}
          className={`w-8 h-8 rounded-md backdrop-blur-md transition-all duration-200 flex items-center justify-center text-lg font-bold ${
            viewportTheme === 'light' 
              ? 'bg-white/90 text-gray-700 hover:bg-white border border-gray-200 hover:shadow-md' 
              : 'bg-gray-900/90 text-gray-300 hover:bg-gray-800 border border-gray-700 hover:text-white'
          }`}
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => { setZoom(1); setViewCenter({ x: 0, y: 0 }); }}
          className={`px-2 py-1 rounded-md backdrop-blur-md transition-all duration-200 text-xs ${
            viewportTheme === 'light' 
              ? 'bg-white/90 text-gray-700 hover:bg-white border border-gray-200 hover:shadow-md' 
              : 'bg-gray-900/90 text-gray-300 hover:bg-gray-800 border border-gray-700 hover:text-white'
          }`}
          title="Reset zoom and pan"
        >
          Reset
        </button>
      </div>

      {/* Floating Property Panel */}
      {selectedObjects.size > 0 && (() => {
        const selectedId = Array.from(selectedObjects)[0];
        const selectedObject = cadObjects.find(obj => obj.id === selectedId);
        
        if (!selectedObject) return null;
        
        return (
          <div className="absolute top-1/2 right-4 transform -translate-y-1/2 z-10">
            <div className={`p-4 rounded-lg backdrop-blur-md shadow-lg border min-w-64 ${
              viewportTheme === 'light' 
                ? 'bg-white/95 text-gray-800 border-gray-200' 
                : 'bg-gray-900/95 text-white border-gray-700'
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedObject.color || '#6b7280' }}></div>
                  <h3 className="font-semibold text-sm">{selectedObject.type}</h3>
                </div>
                <button 
                  onClick={() => {
                    setSelectedObjects(new Set());
                    onObjectSelect?.(null, null);
                  }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${
                    viewportTheme === 'light' 
                      ? 'hover:bg-gray-100 text-gray-500 hover:text-gray-700' 
                      : 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  ×
                </button>
              </div>

              {/* Properties */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">ID:</span>
                  <span className="font-mono">{selectedObject.id}</span>
                </div>
                
                {selectedObject.length && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Length:</span>
                    <span>{selectedObject.length.toFixed(2)}m</span>
                  </div>
                )}
                
                {selectedObject.width && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Width:</span>
                    <span>{selectedObject.width.toFixed(2)}m</span>
                  </div>
                )}
                
                {selectedObject.depth && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Depth:</span>
                    <span>{selectedObject.depth.toFixed(2)}m</span>
                  </div>
                )}
                
                {selectedObject.thickness && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Thickness:</span>
                    <span>{selectedObject.thickness.toFixed(2)}m</span>
                  </div>
                )}
                
                {selectedObject.height && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Height:</span>
                    <span>{selectedObject.height.toFixed(2)}m</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-500">Position:</span>
                  <span className="font-mono text-xs">
                    ({selectedObject.position.x.toFixed(1)}, {selectedObject.position.z.toFixed(1)})
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={async () => {
                    if (window.confirm(`Delete ${selectedObject.type}?`)) {
                      try {
                        // Send delete request to backend
                        deleteObject?.(selectedObject.id);
                        
                        // Clear selection
                        setSelectedObjects(new Set());
                        onObjectSelect?.(null, null);
                        
                        console.log('🗑️ Delete request sent for:', selectedObject.id);
                      } catch (error) {
                        console.error('Failed to delete object:', error);
                      }
                    }
                  }}
                  className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewportTheme === 'light'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-red-900/50 text-red-300 hover:bg-red-800/50'
                  }`}
                >
                  🗑️ Delete Object
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// Enhanced 3D Viewport Component with FreeCAD Integration
const Viewport3D = ({ selectedTool, onObjectSelect, cadObjects = [], createObject, viewportTheme, onToolSelect }) => {
  const [selectedObjects, setSelectedObjects] = useState(new Set());
  const [hoveredObject, setHoveredObject] = useState(null);
  const controlsRef = useRef();

  // Log viewport object changes
  useEffect(() => {
    console.log('🎯 Viewport3D: Objects updated -', cadObjects.length, 'total');
  }, [cadObjects]);

  // Navigation tool handlers
  const handleZoomFit = useCallback(() => {
    if (controlsRef.current && cadObjects.length > 0) {
      // Calculate bounding box of all objects
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      
              cadObjects.forEach(obj => {
        const pos = obj.position || { x: 0, y: 0, z: 0 };
        const size = obj.length || obj.width || obj.height || 2;
        
        minX = Math.min(minX, pos.x - size/2);
        maxX = Math.max(maxX, pos.x + size/2);
        minY = Math.min(minY, pos.y - size/2);
        maxY = Math.max(maxY, pos.y + size/2);
        minZ = Math.min(minZ, pos.z - size/2);
        maxZ = Math.max(maxZ, pos.z + size/2);
      });
      
      // Set camera to fit all objects
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      
      const sizeX = maxX - minX;
      const sizeY = maxY - minY;
      const sizeZ = maxZ - minZ;
      const maxSize = Math.max(sizeX, sizeY, sizeZ);
      
      controlsRef.current.target.set(centerX, centerY, centerZ);
      const distance = Math.max(maxSize * 1.5, 5);
      controlsRef.current.object.position.set(
        centerX + distance * 0.7, 
        centerY + distance * 0.5, 
        centerZ + distance * 0.7
      );
      controlsRef.current.update();
    } else {
      // Default view if no objects
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.object.position.set(8, 6, 8);
      controlsRef.current.update();
    }
  }, [cadObjects]);

  // Handle navigation tool selection
  useEffect(() => {
    if (selectedTool === 'zoom-fit') {
      handleZoomFit();
      setTimeout(() => onToolSelect?.('pointer'), 100);
    }
  }, [selectedTool, handleZoomFit, onToolSelect]);

  // Handle object selection
  const handleObjectClick = useCallback((event, objectId, objectData) => {
    // Three.js events have stopPropagation, but let's be safe
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    
    // Check for shift key (Three.js events have nativeEvent property)
    const shiftKey = event?.nativeEvent?.shiftKey || event?.shiftKey || false;
    
    if (shiftKey) {
      // Multi-select with Shift key
      setSelectedObjects(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(objectId)) {
          newSelection.delete(objectId);
        } else {
          newSelection.add(objectId);
        }
        return newSelection;
      });
    } else {
      // Single select
      setSelectedObjects(new Set([objectId]));
    }
    
    // Notify parent component
    onObjectSelect?.(objectId, objectData);
  }, [onObjectSelect]);

  // CAD Object Component
  const CADObject = ({ object }) => {
    const meshRef = useRef();
    const isSelected = selectedObjects.has(object.id);
    const isHovered = hoveredObject === object.id;

    // Log when object renders - DETAILED DEBUG for walls
    if (object.type === 'Wall') {
      console.log(`🧱 WALL RENDERING DEBUG - ${object.id}:`, {
        'OBJECT POSITION': object.position,
        'OBJECT ROTATION': object.rotation,
        'OBJECT DIMENSIONS': { length: object.length, height: object.height, thickness: object.thickness },
        'FULL OBJECT DATA': object
      });
    } else {
      console.log(`🧱 Rendering ${object.type}:`, object.id);
    }

    // DEBUG: Log furniture/fixture objects to see their properties
    if (object.type === 'furniture' || object.type === 'fixture') {
      console.log('🪑 App.js CADObject - FURNITURE/FIXTURE DEBUG:', object.type, object.id, {
        'HAS modelUrl': !!(object.modelUrl || object.model_url),
        'modelUrl': object.modelUrl,
        'model_url': object.model_url,
        'format': object.format,
        'hasTextures': object.hasTextures,
        'polygonCount': object.polygonCount,
        'FULL OBJECT': object
      });
    }

    // Create geometry based on FreeCAD object type
    const createGeometry = () => {
      const geometryArgs = (() => {
        // Apply minimum size and scale up small objects for visibility
        const scaleUp = (value, minSize = 0.5) => {
          if (!value || value === 0) return minSize;
          
          // Handle very small values (likely in mm instead of m)
          if (value < 0.01) return Math.max(value * 1000, minSize);
          
          // Handle very large values (likely in mm, convert to m)  
          if (value > 1000) return Math.max(value / 1000, minSize);
          
          // Ensure minimum visibility
          return Math.max(value, minSize);
        };
        
        switch (object.type) {
          case 'Wall':
            const length = scaleUp(object.length, 2.0);   // Min 2m long
            const height = scaleUp(object.height, 2.5);   // Min 2.5m high  
            const thickness = scaleUp(object.thickness, 0.2); // Min 20cm thick
            return [length, height, thickness];
          case 'Slab':
            const slabLength = scaleUp(object.length, 5.0);    // Min 5m long (X direction)
            const slabThickness = scaleUp(object.thickness, 0.3); // Min 30cm thick (Y direction - vertical)
            const slabWidth = scaleUp(object.width, 4.0);      // Min 4m wide (Z direction)
            return [slabLength, slabThickness, slabWidth]; // [X, Y, Z] for horizontal slab
          case 'Column':
            const radius = scaleUp(object.radius, 0.3);        // Min 30cm radius
            const colHeight = scaleUp(object.height, 2.5);     // Min 2.5m high
            return [radius, radius, colHeight];
          case 'BuildingElement':
            const elemLength = scaleUp(object.length, 2.0);    // Min 2m long
            const elemWidth = scaleUp(object.width, 1.0);      // Min 1m wide
            const elemHeight = scaleUp(object.height, 2.0);    // Min 2m high
            return [elemLength, elemWidth, elemHeight];
          case 'Beam':
            const beamLength = scaleUp(object.length, 3.0);    // Min 3m long
            const beamWidth = scaleUp(object.width, 0.3);      // Min 30cm wide
            const beamHeight = scaleUp(object.height, 0.5);    // Min 50cm high
            return [beamLength, beamWidth, beamHeight];
          case 'Roof':
            const roofLength = scaleUp(object.length, 8.0);    // Min 8m long
            const roofThickness = scaleUp(object.thickness, 0.3); // Min 30cm thick
            const roofWidth = scaleUp(object.width, 6.0);      // Min 6m wide
            return [roofLength, roofThickness, roofWidth];
          case 'Stair':
            const stairWidth = scaleUp(object.width, 1.2);     // Min 1.2m wide
            const stairHeight = scaleUp(object.height, 3.0);   // Min 3m high
            const stairLength = scaleUp(object.length, 4.0);   // Min 4m long
            return [stairWidth, stairHeight, stairLength];
          case 'Ramp':
            const rampWidth = scaleUp(object.width, 1.5);      // Min 1.5m wide
            const rampThickness = scaleUp(object.thickness, 0.2); // Min 20cm thick
            const rampLength = scaleUp(object.length, 6.0);    // Min 6m long
            return [rampWidth, rampThickness, rampLength];
          case 'Space':
            const spaceLength = scaleUp(object.length, 4.0);   // Min 4m long
            const spaceWidth = scaleUp(object.width, 4.0);     // Min 4m wide
            return [spaceLength, 0.1, spaceWidth]; // Very thin for visualization
          default:
            return [1, 1, 1];
        }
      })();
      
      console.log(`🔷 Creating geometry for ${object.type} (${object.id}):`, {
        args: geometryArgs,
        originalDimensions: {
          length: object.length,
          height: object.height,
          thickness: object.thickness,
          width: object.width,
          radius: object.radius
        },
        position: object.position,
        color: object.color
      });
      
      switch (object.type) {
        case 'Wall':
          return <boxGeometry args={geometryArgs} />;
        case 'Slab':
          return <boxGeometry args={geometryArgs} />;
        case 'Column':
          return <cylinderGeometry args={[geometryArgs[0], geometryArgs[1], geometryArgs[2], 16]} />;
        case 'BuildingElement':
          return <boxGeometry args={geometryArgs} />;
        case 'Beam':
          return <boxGeometry args={geometryArgs} />;
        case 'Door':
          return <boxGeometry args={[object.width || 0.8, object.height || 2.1, object.thickness || 0.05]} />;
        case 'Window':
          return <boxGeometry args={[object.width || 1.2, object.height || 1.2, object.thickness || 0.05]} />;
        case 'Roof':
          return <boxGeometry args={[object.length || 8, object.thickness || 0.3, object.width || 6]} />;
        case 'Stair':
          return <boxGeometry args={[object.width || 1.2, object.height || 3.0, object.length || 4]} />;
        case 'Ramp':
          return <boxGeometry args={[object.width || 1.5, object.thickness || 0.2, object.length || 6]} />;
        case 'Space':
          return <boxGeometry args={[object.length || 4, 0.1, object.width || 4]} />;
        case 'ImportedFile':
          return <boxGeometry args={[object.length || 5, object.height || 3, object.width || 5]} />;
        case 'SketchUpBuilding':
          return <boxGeometry args={[object.length || 8, object.height || 3, object.width || 6]} />;
        case 'SketchUpRoof':
          return <coneGeometry args={[object.length/2 || 4, object.height || 1.5, 8]} />;
        case 'SketchUpModel':
          return <boxGeometry args={[object.length || 5, object.height || 3, object.width || 5]} />;
        case 'STEPModel':
          return <boxGeometry args={[object.length || 2, object.height || 1, object.width || 2]} />;
        case 'furniture':
        case 'fixture':
          // For furniture and fixtures, we'll use the Model3DLoader component instead
          // This is handled separately in the mesh rendering section
          return <boxGeometry args={[object.width || 1, object.height || 1, object.depth || 1]} />;
        default:
          return <boxGeometry args={[1, 1, 1]} />;
      }
    };

    // Get material color based on object type, state, and theme
    const getMaterialProps = () => {
      let baseColor = object.color || (viewportTheme === 'light' ? '#475569' : '#64748b');
      let roughness = 0.4;
      let metalness = 0.1;
      
      // Object type colors and material properties (theme-aware)
      if (viewportTheme === 'light') {
        switch (object.type) {
          case 'Wall': 
            baseColor = '#8b7355'; 
            roughness = 0.7; 
            metalness = 0.0; 
            break;
          case 'Slab': 
            baseColor = '#6b7280'; 
            roughness = 0.8; 
            metalness = 0.0; 
            break;
          case 'Column': 
            baseColor = '#374151'; 
            roughness = 0.3; 
            metalness = 0.2; 
            break;
          case 'Beam': 
            baseColor = '#4b5563'; 
            roughness = 0.3; 
            metalness = 0.2; 
            break;
          case 'BuildingElement': 
            baseColor = '#059669'; 
            roughness = 0.6; 
            metalness = 0.1; 
            break;
          case 'Door': 
            baseColor = '#92400e'; 
            roughness = 0.5; 
            metalness = 0.0; 
            break;
          case 'Window': 
            baseColor = '#1e40af'; 
            roughness = 0.1; 
            metalness = 0.9; 
            break;
          case 'Roof': 
            baseColor = '#6b7280'; 
            roughness = 0.8; 
            metalness = 0.0; 
            break;
          case 'Stair': 
            baseColor = '#8b7355'; 
            roughness = 0.6; 
            metalness = 0.0; 
            break;
          case 'Ramp': 
            baseColor = '#9ca3af'; 
            roughness = 0.7; 
            metalness = 0.0; 
            break;
          case 'Space': 
            baseColor = '#10b981'; 
            roughness = 0.9; 
            metalness = 0.0; 
            break;
          case 'ImportedFile': 
            baseColor = '#dc2626'; 
            roughness = 0.6; 
            metalness = 0.0; 
            break;
          case 'SketchUpBuilding': 
            baseColor = '#8b7355'; 
            roughness = 0.7; 
            metalness = 0.0; 
            break;
          case 'SketchUpRoof': 
            baseColor = '#92400e'; 
            roughness = 0.6; 
            metalness = 0.0; 
            break;
          case 'SketchUpModel': 
            baseColor = '#059669'; 
            roughness = 0.5; 
            metalness = 0.1; 
            break;
          case 'STEPModel': 
            baseColor = '#7c3aed'; 
            roughness = 0.3; 
            metalness = 0.3; 
            break;
          case 'furniture': 
            baseColor = '#8b4513'; 
            roughness = 0.6; 
            metalness = 0.1; 
            break;
          case 'fixture': 
            baseColor = '#059669'; 
            roughness = 0.4; 
            metalness = 0.2; 
            break;
        }
      } else {
        switch (object.type) {
          case 'Wall': 
            baseColor = '#a78851'; 
            roughness = 0.7; 
            metalness = 0.0; 
            break;
          case 'Slab': 
            baseColor = '#8b94a8'; 
            roughness = 0.8; 
            metalness = 0.0; 
            break;
          case 'Column': 
            baseColor = '#4f5b6b'; 
            roughness = 0.3; 
            metalness = 0.2; 
            break;
          case 'Beam': 
            baseColor = '#637080'; 
            roughness = 0.3; 
            metalness = 0.2; 
            break;
          case 'BuildingElement': 
            baseColor = '#10b981'; 
            roughness = 0.6; 
            metalness = 0.1; 
            break;
          case 'Door': 
            baseColor = '#b45309'; 
            roughness = 0.5; 
            metalness = 0.0; 
            break;
          case 'Window': 
            baseColor = '#3b82f6'; 
            roughness = 0.1; 
            metalness = 0.9; 
            break;
          case 'Roof': 
            baseColor = '#8b94a8'; 
            roughness = 0.8; 
            metalness = 0.0; 
            break;
          case 'Stair': 
            baseColor = '#a78851'; 
            roughness = 0.6; 
            metalness = 0.0; 
            break;
          case 'Ramp': 
            baseColor = '#b8c5d1'; 
            roughness = 0.7; 
            metalness = 0.0; 
            break;
          case 'Space': 
            baseColor = '#10b981'; 
            roughness = 0.9; 
            metalness = 0.0; 
            break;
          case 'ImportedFile': 
            baseColor = '#ff6b6b'; 
            roughness = 0.6; 
            metalness = 0.0; 
            break;
          case 'SketchUpBuilding': 
            baseColor = '#a78851'; 
            roughness = 0.7; 
            metalness = 0.0; 
            break;
          case 'SketchUpRoof': 
            baseColor = '#b45309'; 
            roughness = 0.6; 
            metalness = 0.0; 
            break;
          case 'SketchUpModel': 
            baseColor = '#10b981'; 
            roughness = 0.5; 
            metalness = 0.1; 
            break;
          case 'STEPModel': 
            baseColor = '#8b5cf6'; 
            roughness = 0.3; 
            metalness = 0.3; 
            break;
          case 'furniture': 
            baseColor = '#a78851'; 
            roughness = 0.6; 
            metalness = 0.1; 
            break;
          case 'fixture': 
            baseColor = '#10b981'; 
            roughness = 0.4; 
            metalness = 0.2; 
            break;
        }
      }

      // State-based modifications
      if (isSelected) {
        return {
          color: viewportTheme === 'light' ? '#8b5cf6' : '#a855f7',
          emissive: viewportTheme === 'light' ? '#7c3aed' : '#3730a3',
          emissiveIntensity: 0.15,
          roughness: 0.2,
          metalness: 0.3
        };
      } else if (isHovered) {
        return {
          color: baseColor,
          emissive: viewportTheme === 'light' ? '#6366f1' : '#4c1d95',
          emissiveIntensity: 0.08,
          roughness: roughness * 0.8,
          metalness: metalness * 1.2
        };
      } else {
        return { 
          color: baseColor,
          roughness: roughness,
          metalness: metalness,
          clearcoat: object.type === 'Window' ? 0.8 : 0.0,
          clearcoatRoughness: 0.1
        };
      }
    };

    // Adjust position and rotation based on object type
    let meshPosition, meshRotation;
    
    if (object.type === 'Slab') {
      // Slabs should be horizontal at floor level
      meshPosition = [
        object.position?.x || 0, 
        (object.thickness || 0.3) / 2, // Position at half thickness above ground
        object.position?.z || 0
      ];
      meshRotation = [0, object.rotation?.y || 0, 0]; // Only Y rotation for slabs
    } else if (object.type === 'Wall') {
      // Walls should be vertical, centered at their height
      meshPosition = [
        object.position?.x || 0, 
        (object.height || 3.0) / 2, // Position at half height above ground
        object.position?.z || 0
      ];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
      
      // DEBUG: Log wall positioning calculations
      console.log(`📍 WALL POSITIONING DEBUG - ${object.id}:`, {
        'INPUT - Object Position': object.position,
        'INPUT - Object Rotation': object.rotation,
        'OUTPUT - Mesh Position': meshPosition,
        'OUTPUT - Mesh Rotation': meshRotation,
        'ROTATION Y DEGREES': object.rotation?.y ? `${(object.rotation.y * 180 / Math.PI).toFixed(1)}°` : '0°'
      });
    } else if (object.type === 'Column') {
      // Columns should be vertical, centered at their height
      meshPosition = [
        object.position?.x || 0, 
        (object.height || 3.0) / 2, // Position at half height above ground
        object.position?.z || 0
      ];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    } else if (object.type === 'Beam') {
      // Beams should be horizontal, elevated above ground
      meshPosition = [
        object.position?.x || 0, 
        object.position?.y || 3.0, // Default 3m elevation for beams
        object.position?.z || 0
      ];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    } else if (object.type === 'Door') {
      // Doors should be vertical, bottom aligned with ground
      meshPosition = [
        object.position?.x || 0, 
        (object.height || 2.1) / 2, // Position at half height above ground
        object.position?.z || 0
      ];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    } else if (object.type === 'Window') {
      // Windows should be vertical, elevated from ground
      meshPosition = [
        object.position?.x || 0, 
        1.0 + (object.height || 1.2) / 2, // 1m sill height + half window height
        object.position?.z || 0
      ];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    } else if (object.type === 'Roof') {
      // Roofs should be horizontal, elevated above building
      meshPosition = [
        object.position?.x || 0, 
        object.position?.y || 4.0, // Default 4m elevation for roofs
        object.position?.z || 0
      ];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    } else if (object.type === 'Stair') {
      // Stairs should be elevated, connecting floors
      meshPosition = [
        object.position?.x || 0, 
        (object.height || 3.0) / 2, // Position at half height
        object.position?.z || 0
      ];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    } else if (object.type === 'Ramp') {
      // Ramps should be slightly elevated
      meshPosition = [
        object.position?.x || 0, 
        (object.thickness || 0.2) / 2, // Position at half thickness above ground
        object.position?.z || 0
      ];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    } else if (object.type === 'Space') {
      // Spaces should be at floor level, very thin
      meshPosition = [
        object.position?.x || 0, 
        0.05, // Just above ground level
        object.position?.z || 0
      ];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    } else if (object.type === 'furniture' || object.type === 'fixture') {
      // Furniture and fixtures should be on ground level, bottom-aligned
      meshPosition = [
        object.position?.x || 0, 
        (object.height || 1.0) / 2, // Position at half height above ground
        object.position?.z || 0
      ];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    } else {
      // Default positioning for other elements
      meshPosition = [object.position?.x || 0, object.position?.y || 0, object.position?.z || 0];
      meshRotation = [object.rotation?.x || 0, object.rotation?.y || 0, object.rotation?.z || 0];
    }
    
    const materialProps = getMaterialProps();
    
    console.log(`📍 Positioning mesh for ${object.type} (${object.id}):`, {
      position: meshPosition,
      rotation: meshRotation,
      materialColor: materialProps.color
    });

    // For furniture and fixture objects with 3D models, use Model3DLoader
    if ((object.type === 'furniture' || object.type === 'fixture') && (object.modelUrl || object.model_url)) {
      console.log('🎨 Rendering 3D model for', object.type, object.id, {
        modelUrl: object.modelUrl || object.model_url,
        format: object.format,
        position: meshPosition,
        rotation: meshRotation
      });
      
      return (
        <Model3DLoader
          modelUrl={object.modelUrl || object.model_url}
          format={object.format}
          position={meshPosition}
          rotation={meshRotation}
          scale={[1, 1, 1]}
          materialColor={materialProps.color}
          isSelected={isSelected}
          isHovered={isHovered}
          viewportTheme={viewportTheme}
          onClick={(event) => handleObjectClick(event, object.id, object)}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredObject(object.id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHoveredObject(null);
            document.body.style.cursor = 'default';
          }}
          fallbackDimensions={[object.width || 1, object.height || 1, object.depth || 1]}
        />
      );
    }

    // Default mesh rendering for all other objects
    return (
      <mesh
        ref={meshRef}
        position={meshPosition}
        rotation={meshRotation}
        onClick={(event) => handleObjectClick(event, object.id, object)}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredObject(object.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredObject(null);
          document.body.style.cursor = 'default';
        }}
        castShadow
        receiveShadow
      >
        {createGeometry()}
        <meshStandardMaterial 
          {...materialProps}
          roughness={isSelected ? 0.2 : materialProps.roughness || 0.4}
          metalness={isSelected ? 0.3 : materialProps.metalness || 0.1}
          envMapIntensity={0.8}
          normalScale={[0.3, 0.3]}
          aoMapIntensity={0.5}
          transparent={isHovered}
          opacity={isHovered ? 0.9 : 1.0}
        />
        
        {/* Enhanced selection outline */}
        {isSelected && (
          <mesh>
            {createGeometry()}
            <meshBasicMaterial 
              color={viewportTheme === 'light' ? '#8b5cf6' : '#a855f7'}
              wireframe={true}
              transparent={true}
              opacity={0.6}
              linewidth={2}
            />
          </mesh>
        )}
        
        {/* Hover highlight effect */}
        {isHovered && !isSelected && (
          <mesh scale={[1.02, 1.02, 1.02]}>
            {createGeometry()}
            <meshBasicMaterial 
              color={viewportTheme === 'light' ? '#6366f1' : '#4c1d95'}
              transparent={true}
              opacity={0.15}
            />
          </mesh>
        )}
      </mesh>
    );
  };

  // Ground plane click handler (create object or deselect)
  const handleGroundClick = useCallback((event) => {
    // Get click position in 3D space
    const intersectionPoint = event.point;
    const position = {
      x: intersectionPoint.x,
      y: intersectionPoint.y, 
      z: intersectionPoint.z
    };

    // If a tool is selected, create object at click position
    if (selectedTool && selectedTool !== 'pointer') {
      const commandMapping = BIM_COMMAND_MAP[selectedTool];
      if (commandMapping) {
        console.log(`Creating ${selectedTool} at position:`, position);
        
        // Create object via WebSocket
        createObject?.(commandMapping.command, position, {
          workbench: commandMapping.workbench || 'Arch',
          ...commandMapping.params
        });
        
        return; // Don't deselect when creating
      }
    }
    
    // Default behavior: deselect all objects
    setSelectedObjects(new Set());
    onObjectSelect?.(null, null);
  }, [selectedTool, createObject, onObjectSelect]);

  // Theme-based lighting configuration
  const lightingConfig = viewportTheme === 'light' ? {
    ambient: 0.7,
    directional: 1.2,
    point: 0.5,
    background: '#f8fafc' // Light background
  } : {
    ambient: 0.4,
    directional: 0.8,
    point: 0.3,
    background: '#0f172a' // Dark background
  };

  return (
    <Canvas
      camera={{ 
        position: [8, 6, 8], 
        fov: 60
      }}
      shadows
      className="w-full h-full"
      gl={{ preserveDrawingBuffer: true }}
      style={{ 
        background: viewportTheme === 'light' 
          ? 'linear-gradient(to bottom, #e0f2fe 0%, #f8fafc 100%)' 
          : 'linear-gradient(to bottom, #1e293b 0%, #0f172a 100%)'
      }}
    >
      {/* Simple, natural lighting */}
      <ambientLight 
        intensity={viewportTheme === 'light' ? 0.6 : 0.4}
      />
      
      <directionalLight
        position={[10, 10, 5]}
        intensity={viewportTheme === 'light' ? 1.0 : 0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Simple ground plane */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshLambertMaterial 
          color={viewportTheme === 'light' ? '#f1f5f9' : '#1e293b'}
        />
      </mesh>

      {/* Clean grid */}
      <gridHelper 
        args={[
          50, 
          50, 
          viewportTheme === 'light' ? '#cbd5e1' : '#374151',
          viewportTheme === 'light' ? '#e2e8f0' : '#4b5563'
        ]} 
        position={[0, 0, 0]}
      />

      {/* Enhanced navigation controls */}
      <OrbitControls 
        ref={controlsRef}
        enablePan={selectedTool === 'pan' || selectedTool === 'pointer'} 
        enableZoom={true} 
        enableRotate={selectedTool === 'orbit' || selectedTool === 'pointer'}
        maxPolarAngle={Math.PI * 0.48}
        minDistance={3}
        maxDistance={50}
        mouseButtons={{
          LEFT: selectedTool === 'pan' ? 2 : selectedTool === 'orbit' ? 0 : 0, // Pan on left click when pan tool selected
          MIDDLE: 1, // Zoom
          RIGHT: selectedTool === 'pan' ? 0 : 2 // Rotate on right click when pan tool selected
        }}
      />

      {/* Invisible ground plane for click detection */}
      <mesh 
        position={[0, -0.02, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleGroundClick}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      
              {/* CAD Objects */}
        {cadObjects.map(object => (
          <CADObject key={object.id} object={object} />
        ))}

        {/* Demo Objects - Show when no CAD objects are loaded */}
        {cadObjects.length === 0 && (
        <>
          {/* Modern House - Main Building */}
          <group position={[0, 0, 0]}>
            {/* Foundation */}
            <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
              <boxGeometry args={[12, 0.3, 8]} />
              <meshStandardMaterial color="#5A5A5A" roughness={0.8} />
            </mesh>
            
            {/* Main Structure - Ground Floor */}
            <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
              <boxGeometry args={[12, 3.3, 8]} />
              <meshStandardMaterial color="#F5F5DC" roughness={0.7} />
            </mesh>
            
            {/* Second Floor */}
            <mesh position={[0, 4.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[10, 2.5, 7]} />
              <meshStandardMaterial color="#E8E8E8" roughness={0.7} />
            </mesh>
            
            {/* Roof - Modern flat sections */}
            <mesh position={[0, 6.2, 0]} castShadow>
              <boxGeometry args={[10.5, 0.4, 7.5]} />
              <meshStandardMaterial color="#2C2C2C" roughness={0.3} />
            </mesh>
            
            {/* Large Windows - Ground Floor */}
            <mesh position={[5.8, 1.8, 0]} castShadow>
              <boxGeometry args={[0.2, 2.5, 6]} />
              <meshStandardMaterial color="#4A9EFF" transparent opacity={0.7} roughness={0.1} />
            </mesh>
            
            {/* Front Windows */}
            <mesh position={[0, 1.8, 3.8]} castShadow>
              <boxGeometry args={[8, 2, 0.2]} />
              <meshStandardMaterial color="#4A9EFF" transparent opacity={0.7} roughness={0.1} />
            </mesh>
            
            {/* Second Floor Windows */}
            <mesh position={[0, 4.4, 3.3]} castShadow>
              <boxGeometry args={[6, 1.5, 0.2]} />
              <meshStandardMaterial color="#4A9EFF" transparent opacity={0.7} roughness={0.1} />
            </mesh>
            
            {/* Modern Front Door */}
            <mesh position={[2, 1.2, 3.9]} castShadow>
              <boxGeometry args={[1.2, 2.4, 0.15]} />
              <meshStandardMaterial color="#1A1A1A" roughness={0.4} />
            </mesh>
            
            {/* Door Handle */}
            <mesh position={[2.5, 1.2, 4.0]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.3]} />
              <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
            </mesh>
            
            {/* Balcony */}
            <mesh position={[-2, 4.4, 4.2]} castShadow receiveShadow>
              <boxGeometry args={[4, 0.2, 1]} />
              <meshStandardMaterial color="#CCCCCC" roughness={0.5} />
            </mesh>
            
            {/* Balcony Railing */}
            <mesh position={[-2, 5, 4.6]} castShadow>
              <boxGeometry args={[4, 1, 0.1]} />
              <meshStandardMaterial color="#333333" roughness={0.6} />
            </mesh>
          </group>

          {/* Realistic Trees */}
          {/* Large Oak Tree */}
          <group position={[-8, 0, 5]}>
            {/* Main Trunk */}
            <mesh position={[0, 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.4, 0.6, 4]} />
              <meshStandardMaterial color="#654321" roughness={0.9} />
            </mesh>
            
            {/* Branches */}
            <mesh position={[0.8, 3.2, 0.3]} rotation={[0, 0, 0.5]} castShadow>
              <cylinderGeometry args={[0.15, 0.25, 2]} />
              <meshStandardMaterial color="#5D4037" roughness={0.9} />
            </mesh>
            <mesh position={[-0.6, 3.5, -0.4]} rotation={[0, 0, -0.4]} castShadow>
              <cylinderGeometry args={[0.12, 0.2, 1.8]} />
              <meshStandardMaterial color="#5D4037" roughness={0.9} />
            </mesh>
            
            {/* Foliage - Multiple spheres for realistic canopy */}
            <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
              <sphereGeometry args={[2.2]} />
              <meshStandardMaterial color="#228B22" roughness={0.8} />
            </mesh>
            <mesh position={[1.2, 4.8, 0.8]} castShadow receiveShadow>
              <sphereGeometry args={[1.5]} />
              <meshStandardMaterial color="#32CD32" roughness={0.8} />
            </mesh>
            <mesh position={[-1, 4.2, -0.5]} castShadow receiveShadow>
              <sphereGeometry args={[1.8]} />
              <meshStandardMaterial color="#2E7D32" roughness={0.8} />
            </mesh>
          </group>

          {/* Pine Tree */}
          <group position={[9, 0, -6]}>
            {/* Trunk */}
            <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.2, 0.3, 5]} />
              <meshStandardMaterial color="#4A4A4A" roughness={0.9} />
            </mesh>
            
            {/* Pine Layers */}
            <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
              <coneGeometry args={[1.8, 2.5, 8]} />
              <meshStandardMaterial color="#0F4C3A" roughness={0.8} />
            </mesh>
            <mesh position={[0, 3.5, 0]} castShadow receiveShadow>
              <coneGeometry args={[2.2, 3, 8]} />
              <meshStandardMaterial color="#1B5E20" roughness={0.8} />
            </mesh>
            <mesh position={[0, 2.3, 0]} castShadow receiveShadow>
              <coneGeometry args={[2.6, 3.5, 8]} />
              <meshStandardMaterial color="#2E7D32" roughness={0.8} />
            </mesh>
          </group>

          {/* Small Ornamental Tree */}
          <group position={[-4, 0, -3]}>
            <mesh position={[0, 1, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.15, 0.2, 2]} />
              <meshStandardMaterial color="#8D6E63" roughness={0.9} />
            </mesh>
            <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
              <sphereGeometry args={[1]} />
              <meshStandardMaterial color="#4CAF50" roughness={0.8} />
            </mesh>
          </group>

          {/* Garden Elements */}
          {/* Pathway */}
          <mesh position={[3, 0.02, 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[2, 8]} />
            <meshStandardMaterial color="#8D6E63" roughness={0.9} />
          </mesh>

          {/* Lawn Areas */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[30, 30]} />
            <meshStandardMaterial color="#4CAF50" roughness={0.9} />
          </mesh>

          {/* Driveway */}
          <mesh position={[-4, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[4, 15]} />
            <meshStandardMaterial color="#616161" roughness={0.8} />
          </mesh>

          {/* Landscaping - Bushes */}
          <mesh position={[6, 0.3, 2]} castShadow receiveShadow>
            <sphereGeometry args={[0.6]} />
            <meshStandardMaterial color="#388E3C" roughness={0.8} />
          </mesh>
          <mesh position={[5.2, 0.4, 1.5]} castShadow receiveShadow>
            <sphereGeometry args={[0.5]} />
            <meshStandardMaterial color="#43A047" roughness={0.8} />
          </mesh>
          <mesh position={[6.5, 0.25, 2.8]} castShadow receiveShadow>
            <sphereGeometry args={[0.4]} />
            <meshStandardMaterial color="#2E7D32" roughness={0.8} />
          </mesh>

          {/* Street Light */}
          <group position={[8, 0, 8]}>
            <mesh position={[0, 2.5, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.1, 5]} />
              <meshStandardMaterial color="#2C2C2C" roughness={0.6} />
            </mesh>
            <mesh position={[0, 5.2, 0]} castShadow>
              <sphereGeometry args={[0.3]} />
              <meshStandardMaterial color="#FFF8DC" emissive="#FFFF88" emissiveIntensity={0.3} />
            </mesh>
          </group>
        </>
      )}



      {/* Selection Info */}
      {selectedObjects.size > 0 && (
        <Text
          position={[0, 4.5, 0]}
          fontSize={0.3}
          color="#10b981"
          anchorX="center"
          anchorY="middle"
        >
          {`${selectedObjects.size} object(s) selected`}
        </Text>
      )}
    </Canvas>
  );
};

// AI Assistant Component
const AIAssistant = ({ 
  onSendMessage, 
  messages, 
  isLoading,
  onExecuteStep,
  onSkipStep, 
  onEditStep,
  onParameterChange,
  stepExecutionStates
}) => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('agent'); // 'agent' or 'ask'
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map(file => {
      const fileExt = file.name.toLowerCase().split('.').pop();
      const isCADFile = ['skp', 'ifc', 'step', 'stp', 'obj', 'dae', 'ply', 'stl'].includes(fileExt);
      
      return {
        id: Date.now() + Math.random(),
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        extension: fileExt,
        isCADFile,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      };
    });
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    // Show notification for CAD files
    const cadFiles = newFiles.filter(f => f.isCADFile);
    if (cadFiles.length > 0) {
      console.log(`🏗️ Uploaded ${cadFiles.length} CAD file(s):`, cadFiles.map(f => f.name));
      // You could add a toast notification here if you have one
    }
  };

  const removeFile = (fileId) => {
    setUploadedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((input.trim() || uploadedFiles.length > 0) && !isLoading) {
      // Create message object with text, files, mode, and model
      const messageData = {
        text: input.trim(),
        files: uploadedFiles,
        mode,
        model: selectedModel
      };
      onSendMessage(messageData);
      setInput('');
      setUploadedFiles([]);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div 
      className="glass h-full max-h-full flex flex-col border-l border-gray-700/50 min-w-0 overflow-hidden"
      style={{ overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700/50">
        <h2 className="text-lg font-semibold text-white flex items-center">
          <ChatBubbleLeftRightIcon className="w-5 h-5 mr-2 text-studiosix-400" />
          AI Assistant
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Natural language BIM commands
        </p>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 min-h-0 p-4 overflow-y-auto space-y-2 max-w-full overflow-x-hidden"
        style={{ maxWidth: '100%', overflowX: 'hidden', overflowY: 'auto' }}
      >
        {messages.length === 0 && (
          <div className="text-center py-8">
            <SparklesIcon className="w-12 h-12 text-studiosix-400 mx-auto mb-3" />
            <p className="text-gray-400 mb-2">Welcome to StudioSix AI!</p>
            <p className="text-sm text-gray-500">
              Try commands like:
            </p>
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              <p>"Create a 3m x 4m room"</p>
              <p>"Add a door to the wall"</p>
              <p>"Generate a 2-story house"</p>
            </div>
          </div>
        )}
        
        {(messages || []).map((msg, index) => {
          // Check if message has step data for interactive controls
          const hasStepData = msg.stepData || (msg.type === 'ai' && msg.action);
          const stepData = msg.stepData || (hasStepData ? {
            id: msg.stepId || `step_${msg.id}`,
            command: msg.action || msg.command,
            workbench: msg.workbench || 'Arch',
            description: msg.stepDescription,
            parameters: msg.parameters || {}
          } : null);

          const executionStatus = stepData ? stepExecutionStates[stepData.id]?.status : null;
          const isExecuting = stepData ? stepExecutionStates[stepData.id]?.isExecuting : false;

          // Use InteractiveChatMessage for AI messages with step data
          if (hasStepData && msg.type === 'ai') {
            return (
              <InteractiveChatMessage
                key={msg.id || index}
                message={msg.message}
                isUser={false}
                timestamp={msg.timestamp}
                stepData={stepData}
                onExecuteStep={onExecuteStep}
                onSkipStep={onSkipStep}
                onEditStep={onEditStep}
                onParameterChange={onParameterChange}
                isExecuting={isExecuting}
                executionStatus={executionStatus}
              />
            );
          }

          // Use regular ChatMessage for user messages and non-interactive AI messages
          return (
            <ChatMessage
              key={msg.id || index}
              message={msg.message}
              isUser={msg.type === 'user'}
              timestamp={msg.timestamp}
            />
          );
        })}
        
        {isLoading && (
          <div className="glass-light p-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="animate-spin w-4 h-4 border-2 border-studiosix-500 border-t-transparent rounded-full"></div>
              <span className="text-sm text-gray-300">AI is thinking</span>
              <span className="loading-dots"></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Input */}
      <div className="p-4 border-t border-gray-700/50 space-y-3">
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
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-4-vision">GPT-4 Vision</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
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
                      {file.isCADFile && (
                        file.extension === 'skp' ? (
                          <CubeIcon className="w-3 h-3 text-blue-400" />
                        ) : file.extension === 'ifc' ? (
                          <BuildingOfficeIcon className="w-3 h-3 text-blue-400" />
                        ) : (
                          <Square3Stack3DIcon className="w-3 h-3 text-blue-400" />
                        )
                      )}
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
                      className="text-red-400 hover:text-red-300 ml-1"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you want to build..."
              className="w-full bg-slate-800/50 border border-gray-600 rounded-lg px-3 py-2 pr-20 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-studiosix-500 focus:ring-1 focus:ring-studiosix-500"
              disabled={isLoading}
            />
            
            {/* File Upload and Submit Buttons */}
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
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
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

    // Note: Using standalone CAD engine - no WebSocket required

// Authenticated App Component
const AuthenticatedApp = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const [showAuthFlow, setShowAuthFlow] = useState(false);
  const [skipAuth, setSkipAuth] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  
  // Debug authentication state changes
  console.log('🔄 AuthenticatedApp render:', {
    user: user?.email || 'none',
    isAuthenticated,
    loading,
    showAuthFlow,
    skipAuth,
    showEmailConfirmation,
    pendingEmail,
    isAuthConfigured,
    timestamp: new Date().toISOString()
  });

  // Check if authentication is properly configured
  if (!isAuthConfigured && !skipAuth) {
    return (
      <AuthConfigNotice 
        onSkip={() => {
          console.log('⚠️ Authentication skipped - running without user auth');
          setSkipAuth(true);
        }}
      />
    );
  }

  // Show loading while checking auth (only if auth is configured)
  if (isAuthConfigured && loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-studiosix-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-studiosix-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Show email confirmation if needed
  if (showEmailConfirmation && pendingEmail) {
    console.log('🔄 Showing EmailConfirmation component from parent');
    return (
      <EmailConfirmation
        email={pendingEmail}
        onConfirmed={(authResult) => {
          console.log('✅ Email confirmation completed from parent', authResult);
          setShowEmailConfirmation(false);
          setPendingEmail('');
          
          // Check if auto sign-in was successful
          if (authResult && authResult.success && authResult.autoSignIn) {
            console.log('✅ User auto-signed in after email verification, hiding auth flow');
            setShowAuthFlow(false);
          } else if (authResult && authResult.success) {
            console.log('✅ Email verified and account created, but need to wait for Supabase confirmation');
            // Account was created successfully, but Supabase needs to process email confirmation
            // Show success message and keep auth visible for automatic sign-in
            setShowEmailConfirmation(false);
            // Note: User will be automatically signed in when Supabase auth state changes
          } else {
            console.log('❌ Email verification failed');
          }
        }}
        onBack={() => {
          setShowEmailConfirmation(false);
          setPendingEmail('');
        }}
      />
    );
  }

  // Show auth flow if requested or (not authenticated and auth is configured)
  if (showAuthFlow || (isAuthConfigured && !isAuthenticated && !skipAuth)) {
    console.log('🔄 Showing AuthLandingPage because:', {
      showAuthFlow,
      isAuthConfigured,
      isAuthenticated,
      skipAuth,
      condition: showAuthFlow || (isAuthConfigured && !isAuthenticated && !skipAuth)
    });
    return (
      <AuthLandingPage 
        onAuthSuccess={(data) => {
          console.log('✅ AuthLandingPage onAuthSuccess called with:', {
            hasUser: !!data.user,
            userEmail: data.user?.email,
            hasSession: !!data.session,
            fullData: data
          });
          // Only hide auth flow if user is actually authenticated
          // Don't hide it during email confirmation process
          if (data.user && data.session) {
            console.log('🔄 Setting showAuthFlow to false - user fully authenticated');
            setShowAuthFlow(false);
          } else {
            console.log('🔄 Not hiding auth flow - no user/session yet (email confirmation needed)');
          }
        }}
        onEmailConfirmationNeeded={(email, mockCode) => {
          console.log('🔄 Email confirmation needed from parent:', email);
          setPendingEmail(email);
          setShowEmailConfirmation(true);
        }}
      />
    );
  }

  // Show main app (authenticated or skipped auth)
  const mockUser = skipAuth ? { 
    id: 'demo-user', 
    email: 'demo@example.com', 
    user_metadata: { full_name: 'Demo User' } 
  } : user;

  return <MainApp 
    user={mockUser} 
    onRequestAuth={() => {
      if (isAuthConfigured) {
        setShowAuthFlow(true);
      } else {
        console.log('⚠️ Authentication not configured');
      }
    }} 
  />;
};

// Main App Component
// Main App Component with Authentication
const AppWithAuth = () => {
  const currentPath = window.location.pathname;
  
  // Check for specific routes
  const isAuthCallback = currentPath === '/auth/callback';
  const isLandingPage = currentPath === '/' && !window.location.search; // Only show landing on clean root path
  const isThankYouPage = currentPath === '/thank-you';
  const isAppRoute = currentPath === '/app';
  
  // Check if we're in IFC test mode (add ?test=ifc to URL)
  const urlParams = new URLSearchParams(window.location.search);
  const isIFCTestMode = urlParams.get('test') === 'ifc';
  
  // Show landing page for root path without query params
  if (isLandingPage) {
    return <LandingPage />;
  }
  
  // Show thank you page
  if (isThankYouPage) {
    return <ThankYouPage />;
  }
  

  
  // Return IFC Test Interface if in test mode - clean, no debug noise
  if (isIFCTestMode) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          backgroundColor: '#1f2937',
          color: 'white',
          padding: '20px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ marginBottom: '10px' }}>🧪 IFC Loading Test Interface</h1>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '10px' }}>
              Testing enhanced IFC loading with dynamic vertex format detection.
            </p>
            <button
              onClick={() => {
                const url = new URL(window.location);
                url.searchParams.delete('test');
                window.location.href = url.toString();
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← Back to Main App
            </button>
          </div>
          <TestRouting />
        </div>
      );
    }
    
    if (isAuthCallback) {
      return (
        <AuthProvider>
          <AuthCallback 
            onAuthSuccess={(user) => {
              console.log('✅ Auth callback success:', user.email);
              // Redirect to main app
              window.location.href = '/';
            }}
            onAuthError={(error) => {
              console.error('❌ Auth callback error:', error);
              // Redirect to login
              window.location.href = '/';
            }}
          />
        </AuthProvider>
      );
    }
    
    // For /app route or any other route, show the main authenticated app
    return (
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    );
};

// Main App Component (existing app logic)
function MainApp({ user, onRequestAuth }) {
  const { signOut } = useAuth();
  
  // Set current user in RecentProjectsManager when user changes
  useEffect(() => {
    if (user?.id) {
      recentProjectsManager.setCurrentUser(user.id);
      console.log('👤 Set current user in RecentProjectsManager:', user.email);
    } else {
      recentProjectsManager.clearCurrentUser();
      console.log('👤 Cleared user from RecentProjectsManager');
    }
  }, [user]);



  // Application state management
  const [appState, setAppState] = useState('splash'); // 'splash', 'project-menu', 'main-app'
  const [currentProject, setCurrentProject] = useState(null);
  
  // Main app states - with debugging wrapper for selectedTool
  const [selectedTool, setSelectedToolState] = useState('pointer');
  const [selectedItem, setSelectedItem] = useState('ground');
  const [currentFloor, setCurrentFloor] = useState('ground'); // Track active floor for 2D view
  
  // Door tool parameters state (shared between tool and viewport for preview)
  const [doorToolParams, setDoorToolParams] = useState({
    width: 0.9,
    height: 2.1,
    thickness: 0.05,
    openingDirection: 'right',
    material: 'wood',
    frameWidth: 0.05,
    offset: 0.0,
    insertionMode: 'create_standalone',
    hostWallId: null,
    insertionPosition: 0.5
  });
  
  // Debugging wrapper for setSelectedTool
  const setSelectedTool = useCallback((newTool) => {
    console.log('🔧 TOOL CHANGE DEBUG: setSelectedTool called:', {
      oldTool: selectedTool,
      newTool: newTool,
      stack: new Error().stack.split('\n').slice(1, 6).join('\n') // Show more stack frames
    });
    
    // Special warning for wall tool resets
    if (selectedTool === 'wall' && newTool !== 'wall') {
      console.warn('⚠️ WALL TOOL RESET DETECTED! Wall tool being changed to:', newTool);
      console.warn('⚠️ Call stack for wall tool reset:', new Error().stack);
    }
    
    setSelectedToolState(newTool);
  }, []); // Remove dependency to avoid infinite updates
  const [viewMode, setViewMode] = useState('xeokit'); // 'xeokit' (primary), '3d' (legacy), or '2d' (legacy)
  
  // Viewport mode - toggle between '2d' for drafting and '3d' for visualization
  const [viewportMode, setViewportMode] = useState('2d');
  
  // Enhanced viewport mode setter with logging
  const handleViewportModeChange = useCallback((newMode) => {
    console.log(`🔄 VIEWPORT MODE CHANGE: ${viewportMode} → ${newMode}`);
    if (newMode === '2d') {
      console.log('📐 Switching to CAD 2D Drafting View');
    } else if (newMode === '3d') {
      console.log('🏗️ Switching to 3D BIM Visualization');
    }
    setViewportMode(newMode);
  }, [viewportMode]);
  const [viewportTheme, setViewportTheme] = useState('light'); // 'light' or 'dark'
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState([]);
  
  // 2D Drafting state for coordinate bridge
  const [draftCurrentPoint, setDraftCurrentPoint] = useState(null);
  
  // Expose floor management functions globally for AI access
  useEffect(() => {
    // Create a bridge function for AI to add floors
    window.addNewFloorForAI = (floorName, floorLevel) => {
      console.log('🏢 AI requesting new floor:', { floorName, floorLevel });
      
      try {
        const floorCount = PROJECT_TREE[0].children.length;
        const actualLevel = floorLevel !== null ? floorLevel : floorCount;
        const actualName = floorName || `Floor ${floorCount + 1}`;
        const floorId = `floor-${actualLevel}-${Date.now()}`;
        
        const newFloor = {
          id: floorId,
          name: actualName,
          icon: BuildingOfficeIcon,
          type: 'floor',
          level: actualLevel,
          children: [
            {
              id: `${floorId}-walls`,
              name: 'Walls',
              icon: FolderIcon,
              floor: floorId,
              children: [
                { id: `${floorId}-ext-walls`, name: 'Exterior Walls', icon: RectangleStackIcon, floor: floorId },
                { id: `${floorId}-int-walls`, name: 'Interior Walls', icon: RectangleStackIcon, floor: floorId },
              ]
            },
            {
              id: `${floorId}-openings`,
              name: 'Openings',
              icon: FolderIcon,
              floor: floorId,
              children: [
                { id: `${floorId}-doors`, name: 'Doors', icon: DoorIcon, floor: floorId },
                { id: `${floorId}-windows`, name: 'Windows', icon: Squares3x3Icon, floor: floorId },
              ]
            },
            {
              id: `${floorId}-furniture`,
              name: 'Furniture',
              icon: FolderIcon,
              floor: floorId,
              children: []
            }
          ]
        };
        
        // Add to PROJECT_TREE
        PROJECT_TREE[0].children.push(newFloor);
        
        console.log(`✅ AI successfully added floor: ${actualName} (${floorId})`);
        return floorId;
        
      } catch (error) {
        console.error('❌ Failed to add floor for AI:', error);
        throw error;
      }
    };

    // Expose project tree data reading for AI
    window.getProjectTreeForAI = () => {
      return {
        projectTree: PROJECT_TREE,
        currentFloor: currentFloor,
        floors: PROJECT_TREE[0].children.map(floor => ({
          id: floor.id,
          name: floor.name,
          level: floor.level,
          type: floor.type,
          categories: floor.children ? floor.children.map(cat => ({
            id: cat.id,
            name: cat.name,
            items: cat.children ? cat.children.length : 0
          })) : []
        }))
      };
    };

    // Cleanup function
    return () => {
      delete window.addNewFloorForAI;
      delete window.getProjectTreeForAI;
    };
  }, [currentFloor]); // Depend on currentFloor to keep data fresh

  // Wall tool parameters state - shared between tool panel and viewport
  const [wallToolParams, setWallToolParams] = useState({
    length: 3.0,
    height: 2.7,
    width: 0.2,
    alignment: 'center',
    material: 'concrete',
    thickness: 0.2,
    offset: 0.0
  });
  
  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  // CAD Blocks popup state
  const [showCADBlocksPopup, setShowCADBlocksPopup] = useState(false);
  const [cadBlocksToolType, setCadBlocksToolType] = useState('furniture');
  const [cadBlocksPopupPosition, setCadBlocksPopupPosition] = useState({ x: 450, y: 300 });
  
  // Slab property panel state
  const [showSlabPropertyPanel, setShowSlabPropertyPanel] = useState(false);
  const [selectedSlabData, setSelectedSlabData] = useState(null);
  
  // AI Render Overlay state
  const [showAIRenderOverlay, setShowAIRenderOverlay] = useState(false);
  const [showCaptureFrame, setShowCaptureFrame] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isRenderingInBackground, setIsRenderingInBackground] = useState(false);
  const [isRenderingActive, setIsRenderingActive] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderCompleted, setRenderCompleted] = useState(false);

  // Live Stream states for real-time tool synchronization
  const [lastActivatedTool, setLastActivatedTool] = useState(null);
  const [toolActivationHistory, setToolActivationHistory] = useState([]);
  const [liveStreamStatus, setLiveStreamStatus] = useState({
    isConnected: false,
    activeTool: null,
    lastSync: null,
    errors: []
  });
  
  // Viewport refs for AI rendering
  // viewport2DRef removed - using only xeokit viewport
  const viewport3DRef = useRef(null);
  const xeokitViewerRef = useRef(null);
  
  // IFC Import Handler for 2D to 3D workflow
  const handleIFCImport = useCallback(async (file, ifcData, viewport2DObjects) => {
    try {
      console.log('📂 IFC Import from 2D viewport:', {
        fileName: file.name,
        ifcDataStructure: ifcData ? Object.keys(ifcData) : null,
        viewport2DObjectsCount: viewport2DObjects ? viewport2DObjects.length : 0
      });

      // Check if Xeokit viewer is ready
      if (!xeokitViewerRef.current || !xeokitViewerRef.current.loadIFCFile) {
        console.warn('⚠️ Xeokit viewer not ready for IFC import, switching to 3D mode first');
        setViewportMode('3d');
        // Wait a moment for viewport to initialize, then retry
        setTimeout(() => handleIFCImport(file, ifcData, viewport2DObjects), 1000);
        return;
      }

      // Load IFC file into Xeokit viewer
      console.log('🚀 Loading IFC file into Xeokit viewer...');
      const importResult = await xeokitViewerRef.current.loadIFCFile(file);
      
      if (importResult && importResult.success) {
        console.log('✅ IFC file successfully imported to Xeokit:', importResult);
        
        // Switch to 3D viewport to show the imported model
        setViewportMode('3d');
        
        // Show success notification (console for now - could be expanded to UI notification later)
        console.log(`🎉 SUCCESS: IFC model "${file.name}" imported successfully!`);
        
      } else {
        throw new Error(importResult?.error || 'Failed to import IFC file');
      }
      
    } catch (error) {
      console.error('❌ IFC Import failed:', error);
      console.error(`💥 ERROR: Failed to import IFC file "${file.name}": ${error.message}`);
    }
  }, [xeokitViewerRef, setViewportMode]);
  
      // STANDALONE CAD ENGINE - No WebSocket or backend required
    // const {
      //   isConnected: standaloneReady,
  //   chatMessages,
  //   objects: cadObjects,
  //   selectedObjects: wsSelectedObjects,
  //   sendChatMessage,
  //   clearChatHistory,
  //   selectObject,
  //   clearSelection,
  //   createObject,
  //   deleteObject,
  //   activateTool,
  //   executeCommand,
  //   executeStep,
  //   skipStep,
  //   editStep,
  //   updateStepParameter,
  //   getStepExecutionStatus,
  //   resetStepExecution,
  //   resetAllStepExecutions,
  //   stepExecutionStates,
  //   updateObjectProperty
  // } = useWebSocket();

  // Standalone CAD Engine Integration
  const {
    isConnected: standaloneReady,
    connectionStatus,
    objects: cadObjects,
    selectedObjects: wsSelectedObjects,
    chatMessages,
    stepExecutionStates,
    createObject,
    updateObject,
    deleteObject,
    selectObject,
    clearSelection,
    createSlab,
    createWall,
    createPreview,
    clearPreview,
    sendChatMessage,
    clearChatHistory,
    executeStep,
    skipStep,
    getStepExecutionStatus,
    resetStepExecution,
    resetAllStepExecutions,
    updateObjectProperty
  } = useStandaloneCAD();

  // Stub functions for remaining websocket compatibility
  const activateTool = (toolId, workbench) => console.log('🔧 Activate tool (standalone mode):', toolId);
  const executeCommand = (command, workbench, params) => console.log('⚡ Execute command (standalone mode):', command);
  const editStep = async (stepId, stepData) => Promise.resolve({ success: false });
  const updateStepParameter = async (stepId, paramName, paramValue) => Promise.resolve({ success: false });
  
  // Local selected objects state (can be synced with WebSocket)
  const [selectedObjects, setSelectedObjects] = useState([]);
  
  // Property Panel state
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [selectedObjectProperties, setSelectedObjectProperties] = useState({});
  const [viewportDimensions, setViewportDimensions] = useState({ width: 800, height: 600 });

  // API Functions
  const createRoom = async (params) => {
    // TEMPORARILY DISABLED - Backend server not available
    console.log('🚫 Room creation temporarily disabled (backend server not running):', params);
    return { success: false, error: 'Backend server not available', localFallback: true };
    
    /* ORIGINAL CODE - RE-ENABLE WHEN BACKEND IS RUNNING
    try {
      const response = await axios.post(`${API_BASE_URL}/create-room`, params);
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      
      // Check if backend server is not running
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || !error.response) {
        console.warn('⚠️ Backend server not available - room creation will be handled locally');
        return { success: false, error: 'Backend server not available', localFallback: true };
      }
      
      // Don't throw error to prevent app crashes
      return { success: false, error: error.message };
    }
    */
  };

  // Object Selection Handler
  const handleObjectSelect = useCallback((objectId, objectData) => {
    if (objectId && objectData) {
      console.log(`🎯 Object selected:`, objectId, objectData);
      
      // Check if this is an imported OBJ model
      if (objectId === 'objEntity') {
        console.log('📦 Imported OBJ model selected');
        
        // Set special properties for OBJ model
        setSelectedObjectProperties({
          type: 'Imported OBJ Model',
          isImportedModel: true,
          fileName: 'Imported Model',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        });
        
        setSelectedObjects([{
          id: objectId,
          type: 'ImportedOBJ',
          ...objectData
        }]);
        
        // Don't show the regular property panel
        setShowPropertyPanel(false);
        return;
      }
      
      setSelectedObjects([objectData]);
      
      // Use object properties directly (no mapping needed)
      const mappedProperties = objectData?.params || {};
      setSelectedObjectProperties(mappedProperties);
      
      // Handle slab-specific property panel
      if (objectData.type === 'slab') {
        setSelectedSlabData({
          width: objectData.width || objectData.params?.width || 5.0,
          depth: objectData.depth || objectData.params?.depth || 5.0,
          thickness: objectData.thickness || objectData.params?.thickness || 0.2,
          material: objectData.material || objectData.params?.material || 'concrete',
          shape: objectData.shape || objectData.params?.shape || 'rectangular',
          offset: objectData.offset || objectData.params?.offset || 0.0,
          id: objectData.id
        });
        setShowSlabPropertyPanel(true);
        setShowPropertyPanel(false); // Hide regular property panel
      } else {
        setShowSlabPropertyPanel(false);
        setSelectedSlabData(null);
      }
      
      // Activate the corresponding tool when an object is selected
      const objectTypeToTool = {
        'wall': 'wall',        // Match the actual object type from StandaloneCADEngine
        'Wall': 'wall',        // Legacy compatibility
        'slab': 'slab',        // Add slab mapping
        'Slab': 'slab', 
        'Column': 'column',
        'Beam': 'beam',
        'Door': 'door',
        'Window': 'window',
        'Roof': 'roof',
        'Stair': 'stair',
        'Ramp': 'ramp',
        'Space': 'space',
        'Structure': objectData.radius ? 'column' : 'beam', // Determine if column or beam based on radius
        'BuildingElement': 'wall' // Default to wall for generic building elements
      };
      
      const toolForObject = objectTypeToTool[objectData.type];
      if (toolForObject) {
        console.log(`🔧 Activating ${toolForObject} tool panel for selected ${objectData.type}`);
        console.log('📋 Object data:', objectData);
        setSelectedTool(toolForObject);
        
        // Show tool panel instead of property panel for editing
        setShowPropertyPanel(false);
        
        // Trigger live stream integration directly
        const commandMapping = BIM_COMMAND_MAP[toolForObject];
        if (commandMapping && standaloneReady) {
          try {
            activateTool(commandMapping.command, commandMapping.workbench || 'Arch');
            executeCommand(commandMapping.command, commandMapping.workbench || 'Arch', {
              source: 'object_selection',
              ui_tool_id: toolForObject,
              live_stream: true,
              timestamp: new Date().toISOString(),
              ...commandMapping.params
            });
            console.log(`✅ LIVE STREAM (selection): React "${toolForObject}" ↔ CAD "${commandMapping.command}"`);
          } catch (error) {
            console.error('❌ Live stream activation error (selection):', error);
          }
        }
      } else {
        // If no tool mapping found, show property panel as fallback
        console.log(`📋 No tool mapping for ${objectData.type}, showing property panel`);
        setShowPropertyPanel(true);
      }
      
      // Send selection to standalone CAD engine
      selectObject(objectData.id || objectId);
    } else {
      setSelectedObjects([]);
      setSelectedObjectProperties({});
      setShowPropertyPanel(false);
      setShowSlabPropertyPanel(false);
      setSelectedSlabData(null);
      
      // WALL TOOL FIX: Don't reset active drawing tools
      const drawingTools = ['wall', 'slab', 'door', 'window', 'roof', 'stair', 'column', 'beam'];
      if (drawingTools.includes(selectedTool)) {
        console.log('🔧 WALL TOOL FIX: Preserving active drawing tool:', selectedTool);
      } else {
        // Deselect tool when no object is selected (only for non-drawing tools)
        console.log('🔧 Deselecting tool - no object selected');
        setSelectedTool('pointer');
      }
      
      clearSelection();
    }
  }, [selectObject, clearSelection, setSelectedTool, standaloneReady, activateTool, executeCommand]);

  // OBJ Model Management Handlers
  const handleDeleteOBJModel = useCallback(async (modelId) => {
    console.log(`🗑️ Deleting OBJ model: ${modelId}`);
    
    try {
      // Get directLoader from the viewer
      const directLoader = xeokitViewerRef.current?.viewer?.directLoader;
      
      if (directLoader && directLoader.deleteOBJModel) {
        const result = directLoader.deleteOBJModel(modelId);
        console.log('✅ OBJ model deleted:', result);
        
        // Clear selection
        setSelectedObjects([]);
        setSelectedObjectProperties({});
        setShowPropertyPanel(false);
        
        return result;
      }
      
      throw new Error('DirectGLTFLoader not available');
    } catch (error) {
      console.error('❌ Failed to delete OBJ model:', error);
      throw error;
    }
  }, []);

  const handleTransformOBJModel = useCallback(async (modelId, transforms) => {
    console.log(`📐 Transforming OBJ model: ${modelId}`, transforms);
    
    try {
      // Get directLoader from the viewer  
      const directLoader = xeokitViewerRef.current?.viewer?.directLoader;
      
      if (directLoader && directLoader.transformOBJModel) {
        const result = directLoader.transformOBJModel(modelId, transforms);
        console.log('✅ OBJ model transformed:', result);
        
        // Update selected object properties
        setSelectedObjectProperties(prev => ({
          ...prev,
          position: transforms.position || prev.position,
          rotation: transforms.rotation || prev.rotation,
          scale: transforms.scale || prev.scale
        }));
        
        return result;
      }
      
      throw new Error('DirectGLTFLoader not available');
    } catch (error) {
      console.error('❌ Failed to transform OBJ model:', error);
      throw error;
    }
  }, []);

  // Update property panel when the selected object is updated externally
  useEffect(() => {
    if (selectedObjects.length > 0 && showPropertyPanel) {
      // Find the updated object in the current objects list
      const updatedObject = cadObjects.find(obj => obj.id === selectedObjects[0].id);
      
      if (updatedObject && JSON.stringify(updatedObject) !== JSON.stringify(selectedObjects[0])) {
        console.log('🔄 Updating PropertyPanel with external changes:', updatedObject);
        
        // Update the selected object state
        setSelectedObjects([updatedObject]);
        
        // Re-map properties for the property panel
        const mappedProperties = updatedObject?.params || {};
        setSelectedObjectProperties(mappedProperties);
      }
    }
  }, [cadObjects, selectedObjects, showPropertyPanel]);

  // Track viewport dimensions for property panel bounds
  useEffect(() => {
    const viewport = viewport3DRef.current;
    if (!viewport) return;

    const updateDimensions = () => {
      setViewportDimensions({
        width: viewport.clientWidth,
        height: viewport.clientHeight
      });
    };

    // Initial measurement
    updateDimensions();

    // Create ResizeObserver to track size changes
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Keyboard event handling for object deletion
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle delete/backspace when not in input fields
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || 
          event.target.contentEditable === 'true') {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedObjects.length > 0) {
          event.preventDefault();
          
          // Get wall objects from selection
          const wallsToDelete = selectedObjects.filter(obj => obj.type === 'wall');
          const otherObjectsToDelete = selectedObjects.filter(obj => obj.type !== 'wall');
          
          if (wallsToDelete.length > 0 || otherObjectsToDelete.length > 0) {
            const totalCount = selectedObjects.length;
            const wallCount = wallsToDelete.length;
            const objectTypes = [...new Set(selectedObjects.map(obj => obj.type))];
            
            // Create confirmation message
            let confirmMessage = '';
            if (totalCount === 1) {
              confirmMessage = `Delete selected ${objectTypes[0]}?`;
            } else {
              const typesSummary = objectTypes.map(type => {
                const count = selectedObjects.filter(obj => obj.type === type).length;
                return `${count} ${type}${count > 1 ? 's' : ''}`;
              }).join(', ');
              confirmMessage = `Delete ${totalCount} selected objects (${typesSummary})?`;
            }
            
            if (window.confirm(confirmMessage)) {
              console.log(`🗑️ KEYBOARD DELETE: Deleting ${totalCount} selected object(s):`, selectedObjects.map(obj => `${obj.type} (${obj.id})`));
              
              let deletedCount = 0;
              let errors = [];
              
              // Delete all selected objects
              selectedObjects.forEach(obj => {
                try {
                  const success = deleteObject(obj.id);
                  if (success) {
                    deletedCount++;
                    console.log(`✅ Deleted ${obj.type} (${obj.id})`);
                  } else {
                    errors.push(`Failed to delete ${obj.type} (${obj.id})`);
                  }
                } catch (error) {
                  console.error(`❌ Error deleting ${obj.type} (${obj.id}):`, error);
                  errors.push(`Error deleting ${obj.type} (${obj.id}): ${error.message}`);
                }
              });
              
              // Clear selection after deletion
              setSelectedObjects([]);
              setSelectedObjectProperties({});
              setShowPropertyPanel(false);
              clearSelection();
              
              // Show results
              if (deletedCount > 0) {
                console.log(`✅ KEYBOARD DELETE: Successfully deleted ${deletedCount}/${totalCount} object(s)`);
              }
              
              if (errors.length > 0) {
                console.warn('⚠️ KEYBOARD DELETE: Some deletions failed:', errors);
                alert(`Deleted ${deletedCount}/${totalCount} objects.\n\nErrors:\n${errors.join('\n')}`);
              }
            }
          }
        }
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedObjects, deleteObject, clearSelection]);

  // Property Panel Change Handler
  const handlePropertyChange = useCallback(async (propertyName, newValue, selectedObject) => {
    if (!selectedObject) return;

    // Update local property state immediately for responsive UI
    setSelectedObjectProperties(prevProps => ({
      ...prevProps,
      [propertyName]: {
        ...prevProps[propertyName],
        value: newValue
      }
    }));

    // Create property change object
    const propertyChanges = { [propertyName]: newValue };
    
    // Use properties directly (no mapping needed)
    const updatedObject = { ...selectedObject, ...propertyChanges };
    
    // Send property update to standalone CAD engine
    try {
      await updateObjectProperty(selectedObject.id, propertyName, newValue);
      console.log('✅ Property update sent successfully:', {
        objectId: selectedObject.id,
        propertyName,
        newValue
      });
    } catch (error) {
      console.error('❌ Failed to update property:', error);
      
      // Revert local change on error
      setSelectedObjectProperties(prevProps => ({
        ...prevProps,
        [propertyName]: {
          ...prevProps[propertyName],
          value: prevProps[propertyName]?.value // Revert to previous value
        }
             }));
     }
   }, [updateObjectProperty]);

  // Slab Property Panel Change Handler
  const handleSlabPropertyChange = useCallback(async (propertyName, value, allProperties) => {
    console.log('🏗️ Slab property change:', propertyName, value);
    
    if (selectedSlabData && selectedSlabData.id) {
      const objectId = selectedSlabData.id;
      console.log('🔧 Updating slab:', objectId, propertyName, value);
      
      // Update the slab in the CAD engine
      try {
        await updateObjectProperty(objectId, propertyName, value);
        console.log('✅ Slab property update sent successfully:', {
          objectId,
          propertyName,
          newValue: value
        });
        
        // Update local state
        setSelectedSlabData(prev => ({
          ...prev,
          [propertyName]: value
        }));
        
        // If this is a material change, update the 3D rendering
        if (propertyName === 'material') {
          console.log('🎨 Material changed to:', value);
          // The 3D viewport will automatically re-render with new material
        }
      } catch (error) {
        console.error('❌ Failed to update slab property:', error);
      }
    }
  }, [selectedSlabData, updateObjectProperty]);

  // Standalone Tool Selection Handler
  const handleToolSelect = useCallback((toolId, isSelectionTriggered = false) => {
    console.log('🛠️ WALL TOOL DEBUG: Tool selected:', toolId, isSelectionTriggered ? '(via object selection)' : '(via toolbar)');
    console.log('🛠️ WALL TOOL DEBUG: Previous tool was:', selectedTool);
    
    // Update selected tool state
    setSelectedTool(toolId);
    
    // Enhanced debugging for wall tool specifically
    if (toolId === 'wall') {
      console.log('🧱 WALL TOOL DEBUG: Wall tool activated!');
      console.log('🧱 WALL TOOL DEBUG: Current wall parameters:', wallToolParams);
      console.log('🧱 WALL TOOL DEBUG: Standalone CAD Engine available:', !!window.standaloneCADEngine);
      console.log('🧱 WALL TOOL DEBUG: Xeokit viewer available:', !!window.xeokitViewer);
      
      // Auto-switch to 2D viewport for wall drafting
      if (viewportMode !== '2d') {
        console.log('🔧 AUTO-SWITCH: Switching to 2D viewport for wall drafting');
        setViewportMode('2d');
      }
      
      // Log the wall creation handler
      console.log('🧱 WALL TOOL DEBUG: handleCreateWall function available:', typeof handleCreateWall);
      
      // Check if tool panel should appear
      setTimeout(() => {
        const toolPanel = document.querySelector('.wall-tool-panel');
        console.log('🧱 WALL TOOL DEBUG: Wall tool panel found in DOM:', !!toolPanel);
        if (toolPanel) {
          console.log('🧱 WALL TOOL DEBUG: Tool panel visibility:', window.getComputedStyle(toolPanel).display);
        }
      }, 100);
    }
    
    // Handle special AI tools
    if (toolId === 'ai-render') {
      // If rendering is actively happening, reopen the overlay to show progress
      if (isRenderingActive) {
        console.log('AI Render tool activated - reopening overlay with active render');
        setShowAIRenderOverlay(true);
        return;
      }
      // If render is completed but not yet viewed, open overlay to show result
      if (renderCompleted) {
        console.log('AI Render tool activated - showing completed render result');
        setShowAIRenderOverlay(true);
        return;
      }
      // Otherwise show capture frame first
      console.log('AI Render tool activated - showing capture frame');
      setShowCaptureFrame(true);
      return;
    }
    
    if (toolId === 'ai-chat') {
      // Handle AI chat tool selection - toggle the chat panel
      const collapseButton = document.querySelector('.resizable-ai-chat button');
      if (collapseButton) {
        collapseButton.click();
      }
      return;
    }
    
    // Handle CAD Blocks tools
    if (toolId === 'furniture' || toolId === 'fixtures') {
      console.log(`📦 CAD Blocks tool activated: ${toolId}`);
      setCadBlocksToolType(toolId);
      setShowCADBlocksPopup(true);
      return;
    }
    
    // STANDALONE MODE: Use our own CAD engine
    standaloneCADEngine.clearPreview();
    
    if (['wall', 'slab', 'beam', 'column'].includes(toolId)) {
      console.log(`🏗️ STANDALONE: Ready to draw ${toolId} - use viewport to create objects`);
      console.log(`📍 Tool "${toolId}" is now active - click and drag in viewport to create`);
      
      // Auto-switch to 2D viewport for drafting tools (except wall which is handled above)
      if (toolId !== 'wall' && viewportMode !== '2d') {
        console.log(`🔧 AUTO-SWITCH: Switching to 2D viewport for ${toolId} drafting`);
        setViewportMode('2d');
      }
    } else {
      console.log(`🖱️ Navigation tool activated: ${toolId}`);
    }
  }, [isRenderingActive, renderCompleted, viewportMode, wallToolParams]);

  // ENHANCED: CAD Blocks import handler with Supabase model support
  const handleImportBlock = useCallback(async (blockItem, toolType) => {
    console.log('📦 Importing model:', blockItem.name, toolType);
    console.log('🔗 Model data:', {
      id: blockItem.id,
      category: blockItem.category,
      format: blockItem.format,
      model_url: blockItem.model_url,
      thumbnail_url: blockItem.thumbnail_url,
      has_textures: blockItem.has_textures,
      is_rigged: blockItem.is_rigged,
      polygon_count: blockItem.polygon_count
    });
    
    try {
      // Enhanced object parameters with Supabase model metadata
      const objectParams = {
        // Basic CAD properties
        subtype: blockItem.id || `${toolType}-${Date.now()}`,
        name: blockItem.name,
        position: { x: 0, y: 0, z: 0 }, // Default position - user can move it
        
        // Use preview dimensions if available, otherwise defaults
        width: blockItem.preview?.width || 1.0,
        height: blockItem.preview?.height || 1.0,
        depth: blockItem.preview?.depth || 1.0,
        materialColor: blockItem.preview?.color || '#8B4513',
        
        // Enhanced metadata from Supabase
        description: blockItem.description || 'Imported 3D model',
        category: blockItem.category,
        subcategory: blockItem.subcategory,
        
        // Model file information
        modelUrl: blockItem.model_url,
        thumbnailUrl: blockItem.thumbnail_url,
        format: blockItem.format || [],
        fileSize: blockItem.file_size_mb,
        
        // Model characteristics
        hasTextures: blockItem.has_textures || false,
        isRigged: blockItem.is_rigged || false,
        polygonCount: blockItem.polygon_count,
        
        // Source attribution
        source: blockItem.source || 'Imported',
        authorName: blockItem.author_name,
        
        // Import metadata
        importedAt: new Date().toISOString(),
        importMethod: 'supabase_scraper'
      };
      
      // Show import notification
      console.log('⬇️ Downloading model from:', blockItem.model_url);
      
      // Use the standalone CAD engine to create the object
      const objectType = toolType === 'furniture' ? 'furniture' : 'fixture';
      const createdObject = standaloneCADEngine.createObject(objectType, objectParams);
      
      // Success notification with enhanced details
      console.log('✅ Model imported successfully:', {
        name: blockItem.name,
        id: createdObject?.id || 'unknown',
        format: blockItem.format,
        hasTextures: blockItem.has_textures,
        polygonCount: blockItem.polygon_count
      });
      
      // Optional: If the model has a download URL, we could trigger a download
      // This would be useful for offline caching or local processing
      if (blockItem.model_url && window.confirm) {
        const shouldDownload = await new Promise(resolve => {
          const download = window.confirm(
            `Would you like to download the model file (${blockItem.format?.join(', ')}) for offline use?`
          );
          resolve(download);
        });
        
        if (shouldDownload) {
          console.log('📥 Initiating model download...');
          // Create download link
          const link = document.createElement('a');
          link.href = blockItem.model_url;
          link.download = `${blockItem.name.replace(/[^a-zA-Z0-9]/g, '_')}.${blockItem.format?.[0] || 'obj'}`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
      
      return createdObject;
      
    } catch (error) {
      console.error('❌ Failed to import model:', error);
      // Show user-friendly error message
      if (window.alert) {
        window.alert(`Failed to import model: ${error.message || 'Unknown error'}`);
      }
      throw error;
    }
  }, []);

  // Helper function to find nearby wall endpoints for snapping
  const findNearbyWallEndpoint = useCallback((clickPosition) => {
    const snapDistance = 0.5; // 50cm snap distance
    
    // Get all existing walls
    const walls = cadObjects.filter(obj => obj.type === 'wall');
    
    for (const wall of walls) {
      const params = wall.params || {};
      
      if (params.startPoint) {
        const distance = Math.sqrt(
          Math.pow(clickPosition.x - params.startPoint.x, 2) +
          Math.pow(clickPosition.z - params.startPoint.z, 2)
        );
        
        if (distance <= snapDistance) {
          console.log('🧲 Snapping to wall start point:', wall.id);
          return params.startPoint;
        }
      }
      
      if (params.endPoint) {
        const distance = Math.sqrt(
          Math.pow(clickPosition.x - params.endPoint.x, 2) +
          Math.pow(clickPosition.z - params.endPoint.z, 2)
        );
        
        if (distance <= snapDistance) {
          console.log('🧲 Snapping to wall end point:', wall.id);
          return params.endPoint;
        }
      }
    }
    
    return null; // No snap point found
  }, [cadObjects]);

  // Wall Tool Handlers
  const handleCreateWall = useCallback(async (wallParams) => {
    try {
      console.log('🧱 HANDLE CREATE WALL DEBUG: Function called with parameters:', wallParams);
      console.log('🧱 HANDLE CREATE WALL DEBUG: Current wallToolParams:', wallToolParams);
      console.log('🧱 HANDLE CREATE WALL DEBUG: createObject function available:', typeof createObject);
      
      // Determine creation mode: position-based (from viewport click) or tool panel
      const isPositionBased = wallParams.position && !wallParams.startPoint && !wallParams.endPoint;
      
      let createParams;
      if (isPositionBased) {
        // Position-based creation from viewport click - use current tool parameters
        // Check for nearby wall endpoints to snap to
        const snapPoint = findNearbyWallEndpoint(wallParams.position);
        
        createParams = {
          ...wallToolParams, // Use shared wall tool parameters
          type: 'wall',
          // Position the wall at the clicked location or snapped point
          startPoint: snapPoint || wallParams.position,
          // Create a wall in the X direction with the configured length
          endPoint: {
            x: (snapPoint || wallParams.position).x + wallToolParams.length,
            y: (snapPoint || wallParams.position).y,
            z: (snapPoint || wallParams.position).z
          }
        };
        
        console.log('📍 Position-based wall creation with tool params:', createParams);
      } else {
        // Tool panel creation or parametric creation
        createParams = {
          ...wallParams,
          type: 'wall'
        };
        
        console.log('🔧 Tool panel wall creation:', createParams);
      }
      
      // FIXED: Create the wall using the standalone CAD engine directly (not WebSocket)
      console.log('🧱 FIXED: Using standaloneCADEngine.createObject for consistent wall creation');
      console.log('🧱 HANDLE CREATE WALL DEBUG: About to call standaloneCADEngine.createObject with:', {
        type: 'wall',
        params: createParams,
        startPoint: createParams.startPoint,
        endPoint: createParams.endPoint
      });
      
      // Use the same method as CAD2DViewport for consistency
      const wallId = standaloneCADEngine.createObject('wall', createParams);
      
      console.log('🧱 HANDLE CREATE WALL DEBUG: standaloneCADEngine.createObject returned:', wallId);
      console.log('🧱 WALL POSITION DEBUG: Wall created with params:', {
        startPoint: createParams.startPoint,
        endPoint: createParams.endPoint,
        length: createParams.length
      });
      
      console.log('✅ Wall created successfully:', wallId);
      return wallId;
      
    } catch (error) {
      console.error('❌ Failed to create wall:', error);
      throw error;
    }
  }, [wallToolParams]); // FIXED: No longer depends on WebSocket createObject

  const handleUpdateWall = useCallback(async (wallParams) => {
    try {
      console.log('🔧 WALL UPDATE: Starting wall property update');
      console.log('🔧 Update parameters received:', wallParams);
      
      if (!wallParams.id) {
        throw new Error('Wall ID is required for update');
      }
      
      // Ensure we have the selected wall object data for preserving important properties
      const selectedWall = selectedObjects.find(obj => obj.id === wallParams.id);
      if (!selectedWall) {
        throw new Error(`Selected wall not found: ${wallParams.id}`);
      }
      
      // Prepare comprehensive update parameters, preserving existing geometry properties
      const updateParams = {
        // Core wall properties from the tool
        length: wallParams.length,
        height: wallParams.height,
        thickness: wallParams.thickness,
        alignment: wallParams.alignment,
        material: wallParams.material,
        materialColor: wallParams.materialColor,
        density: wallParams.density,
        
        // Preserve existing geometric properties for wall positioning
        startPoint: selectedWall.params?.startPoint || selectedWall.startPoint,
        endPoint: selectedWall.params?.endPoint || selectedWall.endPoint,
        position: selectedWall.position,
        rotation: selectedWall.rotation,
        
        // Add timestamp for tracking updates
        lastUpdated: Date.now(),
        updatedBy: 'wall_property_panel',
        
        // Ensure type is preserved
        type: 'wall'
      };
      
      console.log('🔧 Comprehensive update parameters:', updateParams);
      
      // Update using standalone CAD engine
      const result = standaloneCADEngine.updateObject(wallParams.id, updateParams);
      
      if (result) {
      console.log('✅ Wall updated successfully via standaloneCADEngine');
        
        // Update the selected objects array to reflect changes
        setSelectedObjects(prevSelected => 
          prevSelected.map(obj => 
            obj.id === wallParams.id 
              ? { ...obj, ...updateParams, params: { ...obj.params, ...updateParams } }
              : obj
          )
        );
        
        // Force viewport refresh by emitting a manual update event
        setTimeout(() => {
          console.log('🔄 MANUAL REFRESH: Triggering viewport refresh after wall update');
          
          // Force emit an objects_changed event to trigger viewport refresh
          standaloneCADEngine.emit('objects_changed', {
            source: 'manual_refresh',
            reason: 'wall_property_update',
            objectId: wallParams.id,
            timestamp: Date.now()
          });
          
          console.log('🔄 MANUAL REFRESH: objects_changed event emitted');
        }, 100);
        
      return result;
      } else {
        throw new Error('Update operation failed in CAD engine');
      }
      
    } catch (error) {
      console.error('❌ Failed to update wall:', error);
      throw error;
    }
  }, [selectedObjects]); // Depend on selectedObjects to access current wall data

  const handleCancelWallTool = useCallback(() => {
    // Deselect the wall tool
    setSelectedTool(null);
  }, []);

  // Slab Tool Handlers
  const handleCreateSlab = useCallback(async (slabParams) => {
    try {
      console.log('Creating slab with parameters:', slabParams);
      
      // Create the slab using the standalone CAD engine
      const objectId = await createSlab({
        width: slabParams.width,
        depth: slabParams.depth,
        thickness: slabParams.thickness,
        material: slabParams.material,
        shape: slabParams.shape || 'rectangular',
        position: { x: 0, y: 0, z: 0 } // Default position - user will place by clicking
      });
      
      // Optionally show success message
      console.log('✅ Slab created successfully:', objectId);
      
    } catch (error) {
      console.error('❌ Failed to create slab:', error);
      throw error;
    }
  }, [createSlab]);

  const handleUpdateSlab = useCallback(async (slabParams) => {
    try {
      console.log('Updating slab with parameters:', slabParams);
      
      // Update via property changes
      for (const [key, value] of Object.entries(slabParams)) {
        if (key !== 'id') {
          await updateObjectProperty(slabParams.id, key, value);
        }
      }
      
      console.log('✅ Slab updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to update slab:', error);
      throw error;
    }
  }, [updateObjectProperty]);

  const handleCancelSlabTool = useCallback(() => {
    // Deselect the slab tool
    setSelectedTool(null);
  }, []);

  // Door Tool Handlers
  const handleCreateDoor = useCallback(async (doorParams) => {
    try {
      console.log('Creating door with parameters:', doorParams);
      
      // Create the door using the WebSocket createObject method
      await createObject('Arch_Window', 
        // Default position - user will place by clicking on wall
        { x: 0, y: 0, z: 0 }, 
        {
          workbench: 'Arch',
          ...doorParams,
          // Map parameters to FreeCAD format
          Width: doorParams.width,
          Height: doorParams.height,
          Thickness: doorParams.thickness,
          OpeningDirection: doorParams.openingDirection,
          FrameWidth: doorParams.frameWidth,
          Offset: doorParams.offset,
          Material: doorParams.material,
          WindowType: 'Door'
        }
      );
      
      // Optionally show success message
      console.log('✅ Door created successfully');
      
    } catch (error) {
      console.error('❌ Failed to create door:', error);
      throw error;
    }
  }, [createObject]);

  const handleUpdateDoor = useCallback(async (doorParams) => {
    try {
      console.log('Updating door with parameters:', doorParams);
      
      // Update via property changes
      for (const [key, value] of Object.entries(doorParams)) {
        if (key !== 'id') {
          await updateObjectProperty(doorParams.id, key, value);
        }
      }
      
      console.log('✅ Door updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to update door:', error);
      throw error;
    }
  }, [updateObjectProperty]);

  const handleCancelDoorTool = useCallback(() => {
    // Deselect the door tool
    setSelectedTool(null);
  }, []);

  // Window Tool Handlers
  const handleCreateWindow = useCallback(async (windowParams) => {
    try {
      console.log('Creating window with parameters:', windowParams);
      
      // Create the window using the WebSocket createObject method
      await createObject('Arch_Window', 
        // Default position - user will place by clicking on wall
        { x: 0, y: 0, z: 0 }, 
        {
          workbench: 'Arch',
          ...windowParams,
          // Map parameters to FreeCAD format
          Width: windowParams.width,
          Height: windowParams.height,
          Thickness: windowParams.thickness,
          WindowType: windowParams.windowType,
          GlazingLayers: windowParams.glazingLayers,
          FrameWidth: windowParams.frameWidth,
          Offset: windowParams.offset,
          Openable: windowParams.openable,
          Material: windowParams.material,
          WindowType: 'Window'
        }
      );
      
      // Optionally show success message
      console.log('✅ Window created successfully');
      
    } catch (error) {
      console.error('❌ Failed to create window:', error);
      throw error;
    }
  }, [createObject]);

  const handleUpdateWindow = useCallback(async (windowParams) => {
    try {
      console.log('Updating window with parameters:', windowParams);
      
      // Update via property changes
      for (const [key, value] of Object.entries(windowParams)) {
        if (key !== 'id') {
          await updateObjectProperty(windowParams.id, key, value);
        }
      }
      
      console.log('✅ Window updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to update window:', error);
      throw error;
    }
  }, [updateObjectProperty]);

  const handleCancelWindowTool = useCallback(() => {
    // Deselect the window tool
    setSelectedTool(null);
  }, []);

  // Roof Tool Handlers
  const handleCreateRoof = useCallback(async (roofParams) => {
    try {
      console.log('Creating roof with parameters:', roofParams);
      
      // Create the roof using the WebSocket createObject method
      await createObject('Arch_Roof', 
        // Default position - user will place by clicking
        { x: 0, y: 0, z: 0 }, 
        {
          workbench: 'Arch',
          ...roofParams,
          // Map parameters to FreeCAD format
          Width: roofParams.width,
          Length: roofParams.length,
          Height: roofParams.height,
          RoofType: roofParams.roofType,
          Pitch: roofParams.pitch,
          Overhang: roofParams.overhang,
          Thickness: roofParams.thickness,
          Material: roofParams.material
        }
      );
      
      // Optionally show success message
      console.log('✅ Roof created successfully');
      
    } catch (error) {
      console.error('❌ Failed to create roof:', error);
      throw error;
    }
  }, [createObject]);

  const handleUpdateRoof = useCallback(async (roofParams) => {
    try {
      console.log('Updating roof with parameters:', roofParams);
      
      // Update via property changes
      for (const [key, value] of Object.entries(roofParams)) {
        if (key !== 'id') {
          await updateObjectProperty(roofParams.id, key, value);
        }
      }
      
      console.log('✅ Roof updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to update roof:', error);
      throw error;
    }
  }, [updateObjectProperty]);

  const handleCancelRoofTool = useCallback(() => {
    // Deselect the roof tool
    setSelectedTool(null);
  }, []);

  // Stair Tool Handlers
  const handleCreateStair = useCallback(async (stairParams) => {
    try {
      console.log('Creating stair with parameters:', stairParams);
      
      // Create the stair using the WebSocket createObject method
      await createObject('Arch_Stairs', 
        // Default position - user will place by clicking
        { x: 0, y: 0, z: 0 }, 
        {
          workbench: 'Arch',
          ...stairParams,
          // Map parameters to FreeCAD format
          TotalRise: stairParams.totalRise,
          TotalRun: stairParams.totalRun,
          NumberOfSteps: stairParams.numberOfSteps,
          StepWidth: stairParams.stepWidth,
          TreadDepth: stairParams.treadDepth,
          RiserHeight: stairParams.riserHeight,
          StairType: stairParams.stairType,
          HasHandrail: stairParams.hasHandrail,
          HandrailHeight: stairParams.handrailHeight,
          Material: stairParams.material
        }
      );
      
      // Optionally show success message
      console.log('✅ Stair created successfully');
      
    } catch (error) {
      console.error('❌ Failed to create stair:', error);
      throw error;
    }
  }, [createObject]);

  const handleUpdateStair = useCallback(async (stairParams) => {
    try {
      console.log('Updating stair with parameters:', stairParams);
      
      // Update via property changes
      for (const [key, value] of Object.entries(stairParams)) {
        if (key !== 'id') {
          await updateObjectProperty(stairParams.id, key, value);
        }
      }
      
      console.log('✅ Stair updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to update stair:', error);
      throw error;
    }
  }, [updateObjectProperty]);

  const handleCancelStairTool = useCallback(() => {
    // Deselect the stair tool
    setSelectedTool(null);
  }, []);

  // AI Message Handler via WebSocket
  const handleSendMessage = useCallback(async (messageData) => {
    setIsLoading(true);

    try {
      // Handle both old string format and new object format for backward compatibility
      const message = typeof messageData === 'string' ? messageData : messageData.text;
      const files = typeof messageData === 'object' ? messageData.files : [];
      const mode = typeof messageData === 'object' ? messageData.mode : 'agent';
      const model = typeof messageData === 'object' ? messageData.model : 'gpt-4';

      // Prepare enhanced context with files and model selection
      const enhancedContext = {
        currentProject: currentProject?.name,
        selectedObjects: selectedObjects.map(obj => obj.id),
        viewMode: viewMode,
        selectedTool: selectedTool,
        mode: mode,
        model: model,
        files: files // Include file data for backend processing
      };

      // Send message via WebSocket - this handles adding user message and getting AI response
      await sendChatMessage(message, enhancedContext);
      
      // Note: Response will be handled automatically by the WebSocket hook
      // and added to chatMessages state
      
    } catch (error) {
      console.error('❌ Error sending chat message:', error);
      // Error handling is built into the sendChatMessage function
    } finally {
      setIsLoading(false);
    }
  }, [sendChatMessage, currentProject, selectedObjects, viewMode, selectedTool]);

  // Top toolbar action handlers
  const handleFileAction = useCallback(async (action) => {
    console.log('File action:', action);
    
    if (action === 'save') {
      // Use native Electron save dialog if available, fallback to web modal
      if (window.electronAPI && window.electronAPI.showProjectSaveDialog) {
        try {
          const result = await window.electronAPI.showProjectSaveDialog({
            defaultPath: 'MyProject'
          });
          
          if (!result.canceled && result.filePath) {
            // Extract file info from the selected path
            const filePath = result.filePath;
            const fileName = filePath.split('/').pop().split('.')[0];
            const extension = filePath.split('.').pop();
            const directory = filePath.substring(0, filePath.lastIndexOf('/'));
            
            console.log('💾 Save dialog result:', {
              fullPath: filePath,
              fileName: fileName,
              extension: extension,
              directory: directory
            });
            
            // Map extensions to our format names
            const formatMap = {
              'FCStd': 'FCStd',
              'fcstd': 'FCStd',
              'stl': 'stl', 
              'step': 'step',
              'stp': 'step',
              'obj': 'obj',
              'iges': 'iges',
              'igs': 'iges'
            };
            
            const saveData = {
              fileName: fileName,
              format: formatMap[extension.toLowerCase()] || extension,
              path: directory
            };
            
            console.log('💾 Sending save data:', saveData);
            await handleSave(saveData);
          }
        } catch (error) {
          console.error('Error with native save dialog:', error);
          // Fallback to web modal
          setShowSaveDialog(true);
        }
      } else {
        // Fallback to web modal for non-Electron environments
        setShowSaveDialog(true);
      }
      return;
    }
    
    if (action === 'import_ifc') {
      // Create file input for IFC upload
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.ifc,.IFC,.glb,.gltf,.obj,.OBJ'; // Support IFC, glTF, and OBJ files
      input.style.display = 'none';
      
      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
          try {
            console.log(`📁 Uploading ${file.name} in ${viewportMode} mode`);
            
            // Handle import differently based on current viewport mode
            if (viewportMode === '2d') {
              // Import via 2D viewport using our new IFC import functionality
              console.log('📐 Importing via 2D viewport with IFC parsing...');
              
              // Use our handleIFCImport function to process the file
              await handleIFCImport(file, null, null);
              
            } else {
              // Import directly via 3D viewport (existing functionality)
              console.log('🏗️ Importing directly via 3D Xeokit viewer...');
              
              // Send a chat message to show the import started
              try {
                await sendChatMessage(`🔄 **Importing file**: ${file.name}...\n\nProcessing building data and creating 3D objects...`, {
                  action: 'ifc_import_started',
                  fileName: file.name
                });
              } catch (chatError) {
                console.warn('Failed to send import status message:', chatError);
              }
              
              if (!xeokitViewerRef.current) {
                throw new Error('Xeokit viewer not available. Please ensure the BIM viewer is loaded.');
              }
              
              const importResult = await xeokitViewerRef.current.loadIFCFile(file);
              
              if (importResult.success) {
                console.log('✅ Import successful:', importResult);
                
                // Send success message through chat
                const geometryType = importResult.isReal ? 'real geometry parsed' : 'placeholder representation';
                await sendChatMessage(
                  `✅ **Import Complete**: ${file.name}\n\n` +
                  `**Model ID**: ${importResult.modelID}\n` +
                  `**Geometry**: ${geometryType}\n` +
                  `**File**: ${importResult.fileName}\n\n` +
                  `The ${importResult.isReal ? 'actual building model' : 'placeholder building'} is now visible in your BIM viewer. You can navigate, zoom, and inspect ${importResult.isReal ? 'real building elements' : 'the basic structure'} in 3D.`, 
                  {
                    action: 'ifc_import_success',
                    fileName: file.name,
                    modelID: importResult.modelID,
                    isReal: importResult.isReal,
                    xeokitModel: importResult.xeokitModel
                  }
                );
                
              } else {
                console.error('❌ Import failed:', importResult.message);
                
                // Send error message through chat
                await sendChatMessage(
                  `❌ **Import Failed**: ${file.name}\n\n` +
                  `Error: ${importResult.message}\n\n` +
                  `Please check that your file is valid and try again.`, 
                  {
                    action: 'ifc_import_error',
                    error: importResult.message
                  }
                );
              }
            }
            
          } catch (error) {
            console.error(`❌ Error importing file in ${viewportMode} mode:`, error);
            
            // Send error message through chat
            try {
              await sendChatMessage(`❌ **Import Error**: ${error.message}\n\nPlease check that your file is valid and try again.`, {
                action: 'ifc_import_error',
                error: error.message
              });
            } catch (chatError) {
              console.warn('Failed to send error message:', chatError);
            }
          }
        }
        
        // Clean up
        document.body.removeChild(input);
      };
      
      document.body.appendChild(input);
      input.click();
      return;
    }
    
    // TODO: Implement other file operations (New, Open, Save, etc.)
  }, [sendChatMessage]);

  // Handle save functionality
  const handleSave = useCallback(async (saveData) => {
    try {
      console.log('💾 Saving project:', saveData);
      
      // Send save request via WebSocket
      const message = {
        type: 'save_project',
        fileName: saveData.fileName,
        format: saveData.format,
        path: saveData.path,
        timestamp: new Date().toISOString()
      };
      
      // WEBSOCKET INTEGRATION DISABLED - Building independent CAD engine
      // For now, we'll just log the message and simulate successful save
      console.log('📤 Save request prepared:', message);
      
      // Send a chat message to show the save started
      try {
        await sendChatMessage(`💾 **Saving project**: ${saveData.fileName}.${saveData.format.toLowerCase()}...\n\nSaving to: ${saveData.path}`, {
          action: 'save_started',
          fileName: saveData.fileName,
          format: saveData.format
        });
      } catch (chatError) {
        console.warn('Failed to send save status message:', chatError);
      }
      
      setShowSaveDialog(false);
      
      // ✅ ADD PROJECT TO RECENT PROJECTS WHEN SAVED
      try {
        // If we have a current project, update it and mark as saved
        if (currentProject && currentProject.id) {
          const updatedProject = await recentProjectsManager.updateProject(currentProject.id, {
            name: saveData.fileName,
            lastSaved: new Date().toISOString(),
            progress: Math.min((currentProject.progress || 0) + 10, 100), // Increment progress
            filePath: `${saveData.path}/${saveData.fileName}.${saveData.format.toLowerCase()}`,
            format: saveData.format,
            saved: true // Mark as saved
          });
          
          // Add to recent projects now that it's saved
          await recentProjectsManager.addToRecentProjects(updatedProject);
          
          console.log('✅ Project saved and added to recent projects:', updatedProject.name);
          
          // Update current project state
          setCurrentProject(updatedProject);
        } else {
          // Create a new project if we somehow don't have one
          const newProject = recentProjectsManager.createNewProject({
            name: saveData.fileName,
            type: 'Saved Project',
            description: `Saved to ${saveData.path}`,
            saved: true,
            filePath: `${saveData.path}/${saveData.fileName}.${saveData.format.toLowerCase()}`,
            format: saveData.format
          });
          
          // Add to recent projects
          await recentProjectsManager.addToRecentProjects(newProject);
          
          console.log('✅ New project created and saved:', newProject.name);
          setCurrentProject(newProject);
        }
      } catch (projectError) {
        console.error('Failed to update project manager:', projectError);
      }
      
      // TODO: Implement actual file system saving when ready
    } catch (error) {
      console.error('❌ Error saving project:', error);
      alert(`Failed to save project: ${error.message}`);
    }
  }, [sendChatMessage, currentProject]);

  const handleEditAction = useCallback((action) => {
    console.log('Edit action:', action);
    // TODO: Implement undo/redo functionality
  }, []);

  const handleHelpAction = useCallback(() => {
    console.log('Help action');
    // TODO: Implement help/documentation
  }, []);

  const handleProfileAction = useCallback(() => {
    console.log('Profile action for user:', user?.email);
    
    // Create user profile modal content
    const profileInfo = `
User Profile:
• Email: ${user?.email || 'Not authenticated'}
• Name: ${user?.user_metadata?.full_name || 'Not provided'}
• User ID: ${user?.id || 'N/A'}
• Last Sign In: ${user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'N/A'}

Would you like to sign out?
    `;
    
    const shouldSignOut = window.confirm(profileInfo);
    
    if (shouldSignOut) {
      handleSignOut();
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      console.log('🔓 Signing out user:', user?.email);
      
      // Sign out from Supabase
      const result = await signOut();
      if (!result.success) {
        throw new Error(result.error || 'Sign out failed');
      }
      
      // Clear current project and app state
      setCurrentProject(null);
      setAppState('project-menu');
      clearChatHistory();
      standaloneCADEngine.clearAllObjects();
      
      // Trigger authentication flow
      onRequestAuth?.();
      
      console.log('✅ User signed out successfully');
    } catch (error) {
      console.error('❌ Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  // Listen for Electron menu events
  useEffect(() => {
    if (window.electronAPI) {
      // Listen for menu save commands
      const handleMenuSave = () => {
        handleFileAction('save');
      };
      
      const handleMenuSaveAs = (event, filePath) => {
        // If filePath is provided, use it directly
        if (filePath) {
          const fileName = filePath.split('/').pop().split('.')[0];
          const extension = filePath.split('.').pop();
          const directory = filePath.substring(0, filePath.lastIndexOf('/'));
          
          const formatMap = {
            's6proj': 'FCStd', // Map s6proj to FCStd for now
            'FCStd': 'FCStd',
            'stl': 'stl', 
            'step': 'step',
            'obj': 'obj',
            'iges': 'iges'
          };
          
          const saveData = {
            fileName: fileName,
            format: formatMap[extension] || 'FCStd',
            path: directory
          };
          
          handleSave(saveData);
        } else {
          handleFileAction('save');
        }
      };
      
      // Set up listeners
      window.electronAPI.onSaveProject(handleMenuSave);
      window.electronAPI.onSaveProjectAs(handleMenuSaveAs);
      
      // Cleanup
      return () => {
        if (window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners('save-project');
          window.electronAPI.removeAllListeners('save-project-as');
        }
      };
    }
  }, [handleFileAction, handleSave]);

  // Viewport capture handlers
  const handleViewportCapture = useCallback((capturedImageData) => {
    console.log('✅ App: Viewport captured, image data length:', capturedImageData?.length || 0);
    setCapturedImage(capturedImageData);
    setShowCaptureFrame(false);
    setShowAIRenderOverlay(true);
    // Reset tool selection to pointer
    setSelectedTool('pointer');
  }, []);

  const handleCaptureCancel = useCallback(() => {
    console.log('Capture cancelled');
    setShowCaptureFrame(false);
    setCapturedImage(null);
    // Reset tool selection to pointer
    setSelectedTool('pointer');
  }, []);

  const handleRecapture = useCallback(() => {
    console.log('Recapturing viewport');
    setShowAIRenderOverlay(false);
    setCapturedImage(null);
    setShowCaptureFrame(true);
    setSelectedTool('ai-render');
  }, []);

  // Application navigation handlers
  const handleSplashComplete = () => {
    setAppState('project-menu');
  };

  const handleStartProject = async (projectConfig) => {
    try {
      // Check authentication before starting project (only if auth is configured)
      if (isAuthConfigured && !user) {
        console.log('🔐 Authentication required to start project');
        onRequestAuth?.();
        return;
      }

      // Create a new project with unique ID using RecentProjectsManager
      // Note: Project will NOT appear in recent projects until it's saved
      const projectData = {
        ...projectConfig,
        saved: false, // Mark as unsaved - will only appear in recent projects after saving
        userId: user?.id || 'demo-user', // Associate project with authenticated user or demo
        userEmail: user?.email || 'demo@example.com'
      };
      
      const newProject = recentProjectsManager.createNewProject(projectData);
      
      // Set the new project as current
      setCurrentProject(newProject);
      setAppState('main-app');
      
      // Clear chat history for new project
      clearChatHistory();
      
      // Clear any existing CAD objects for the new project
      standaloneCADEngine.clearAllObjects();
      
      console.log('🆕 Started new project (unsaved):', newProject.name, 'with ID:', newProject.id);
      console.log('👤 Project created by:', user?.email || 'demo user');
      console.log('💡 Project will appear in Recent Projects after first save');
      
      // Create corresponding FreeCAD project in backend
      try {
        const projectName = newProject.name;
        
        console.log('🏗️ Creating FreeCAD project:', projectName);
        
        // WEBSOCKET INTEGRATION DISABLED - Building independent CAD engine
        // webSocketService.sendMessage({
        //   type: 'create_project',
        //   projectName: projectName
        // });
        // 
        // // Listen for project creation response
        // webSocketService.on('project_created', (response) => {
        //   if (response.success) {
        //     console.log('✅ FreeCAD project created successfully:', response.project);
        //   } else {
        //     console.error('❌ Failed to create FreeCAD project:', response.message);
        //   }
        // });
        
      } catch (error) {
        console.error('❌ Error creating FreeCAD project:', error);
      }
      
      return newProject;
    } catch (error) {
      console.error('❌ Failed to start new project:', error);
      // Fallback to old behavior
      setCurrentProject(projectConfig);
      setAppState('main-app');
      clearChatHistory();
    }
  };

  const handleOpenExisting = async (project) => {
    try {
      if (project) {
        console.log('📂 Opening existing project:', project.name, 'ID:', project.id);
        
        // Set the existing project as current
        setCurrentProject(project);
        setAppState('main-app');
        
        // Clear chat history and CAD objects
        clearChatHistory();
        standaloneCADEngine.clearAllObjects();
        
        // Update project access timestamp
        if (project.id && await recentProjectsManager.getProject(project.id)) {
          await recentProjectsManager.markProjectOpened(project.id);
        }
        
        // Send welcome back message
        setTimeout(() => {
          sendChatMessage(`Welcome back to ${project.name || 'your project'}! Let's continue building where we left off.`, {
            projectName: project.name,
            projectId: project.id,
            isReturning: true,
            projectType: project.type
          }).catch(console.error);
        }, 1000);
      } else {
        // Handle file picker or project browser fallback
        console.log('📂 Opening project browser');
        setAppState('main-app');
      }
    } catch (error) {
      console.error('❌ Failed to open existing project:', error);
      // Fallback behavior
      setCurrentProject(project);
      setAppState('main-app');
      clearChatHistory();
    }
  };

  const handleBackToProjectMenu = () => {
    setAppState('project-menu');
    setCurrentProject(null);
    clearChatHistory();
  };

  // AI Command Processing via WebSocket
  const processAICommand = async (command) => {
    try {
      // Send the command to the WebSocket backend for AI processing
      const response = await sendChatMessage(command, {
        currentProject: currentProject?.name,
        selectedObjects: selectedObjects.map(obj => obj.id),
        viewMode: viewMode,
        selectedTool: selectedTool
      });
      
      return response.response;
    } catch (error) {
      console.error('❌ Error processing AI command:', error);
      return `❌ **Error**: ${error.message}`;
    }
  };

  // Conditional rendering based on app state
  if (appState === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (appState === 'project-menu') {
    return (
      <StartNewProjectMenu
        onStartProject={handleStartProject}
        onOpenExisting={handleOpenExisting}
        user={user}
        onSignOut={handleSignOut}
      />
    );
  }

  // Main BIM application
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-950 overflow-hidden">
      {/* Ribbon Toolbar */}
              <RibbonToolbar 
          selectedTool={selectedTool}
          onToolSelect={handleToolSelect}
          currentProject={currentProject}
          onBackToProjects={handleBackToProjectMenu}
          onToggleChat={() => {
            // Toggle AI Chat collapse state
            const collapseButton = document.querySelector('.resizable-ai-chat button');
            if (collapseButton) {
              collapseButton.click();
            }
          }}
          onFileAction={handleFileAction}
          onEditAction={handleEditAction}
          onHelpAction={handleHelpAction}
          onProfileAction={handleProfileAction}
          isRenderingInBackground={isRenderingInBackground}
          isRenderingActive={isRenderingActive}
          renderProgress={renderProgress}
          renderCompleted={renderCompleted}
          isConnected={standaloneReady}
          lastActivatedTool={lastActivatedTool}
        />
      
      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar - Project Tree */}
        <ProjectTree 
          selectedItem={selectedItem} 
          onItemSelect={setSelectedItem}
          currentFloor={currentFloor}
          onFloorChange={setCurrentFloor}
        />
        
        {/* Central Viewport */}
        <div className={`flex-1 relative transition-colors duration-300 ${
          viewportTheme === 'light' ? 'bg-gray-100' : 'viewport-bg'
        }`}>
          {/* Unified Viewport Controls Menu */}
          <ViewportControlsMenu
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            viewportTheme={viewportTheme}
            onThemeChange={setViewportTheme}
            viewportMode={viewportMode}
            onViewportModeChange={handleViewportModeChange}
          />
          

          {/* Toggle-Based Viewport: 2D Drafting OR 3D Visualization */}
          <div ref={viewport3DRef} className="w-full h-full relative">
            {viewportMode === '2d' ? (
              /* 2D CAD Drafting Viewport */
              <CAD2DViewport
                theme={viewportTheme}
                selectedTool={selectedTool}
                currentFloor={currentFloor}
                doorParams={doorToolParams}
                onObjectClick={(objectId, object) => {
                  console.log('🎯 2D VIEWPORT: Object clicked:', objectId, object);
                  handleObjectSelect(objectId, object);
                }}
                onGroundClick={(position) => {
                  console.log('🎯 2D VIEWPORT: Ground clicked at:', position);
                  if (selectedTool === 'wall') {
                    console.log('🧱 2D WALL CREATION: Starting wall creation...');
                    handleCreateWall({ position }).then(result => {
                      console.log('🧱 2D WALL CREATION: Wall created:', result);
                    }).catch(error => {
                      console.error('🧱 2D WALL CREATION: Error:', error);
                    });
                  }
                }}
                onDraftCurrentPointUpdate={(snappedWorldPos) => {
                  // 🔧 COORDINATE BRIDGE: Receive snapped coordinates from CAD2DViewport
                  if (snappedWorldPos) {
                    console.log('🌉 COORDINATE BRIDGE: Receiving snapped coordinates from CAD2DViewport', {
                      snappedCoordinates: { x: snappedWorldPos.x.toFixed(6), z: snappedWorldPos.z.toFixed(6) },
                      previousDraftPoint: draftCurrentPoint ? { x: draftCurrentPoint.x.toFixed(6), z: draftCurrentPoint.z.toFixed(6) } : 'null'
                    });
                    setDraftCurrentPoint(snappedWorldPos);
                  }
                }}
                onIFCImport={handleIFCImport}
              />
            ) : (
              /* 3D BIM Visualization Viewport */
              <XeokitViewport
                  theme={viewportTheme}
                  selectedTool={selectedTool}
                  enable2D={false}
                  enable3D={true}
                  cadObjects={cadObjects}
              sceneConfig={{
                mode: 'hybrid', // Show both sample scene and CAD objects
                sampleModel: null // Will create basic cube scene
              }}
              onViewerReady={(viewerConfig) => {
                console.log('✅ Xeokit viewer ready:', viewerConfig);
                // Store viewer reference for IFC imports
                xeokitViewerRef.current = viewerConfig;
              }}
              onObjectClick={(clickData) => {
                console.log('🎯 3D VIEWPORT: Click event received:', clickData);
                // 3D viewport is for visualization - handle object selection only
                if (clickData.entityId) {
                  console.log('🎯 3D VIEWPORT: Selecting existing object:', clickData.entityId);  
                  handleObjectSelect(clickData.entityId, clickData);
                } else {
                  // Clear selection when clicking empty space
                  console.log('🎯 3D VIEWPORT: Clearing selection');
                  handleObjectSelect(null);
                }
              }}
              onObjectHover={(hoverData) => {
                // Handle object hover feedback
              }}
              onModelLoaded={(modelData, modelId) => {
                console.log('✅ Model loaded in xeokit:', modelId, modelData);
                
                // Debug the modelData structure
                console.log('🔍 App.js Debug - Model callback data:', {
                  modelId,
                  modelDataType: typeof modelData,
                  modelDataConstructor: modelData?.constructor?.name,
                  modelDataKeys: modelData ? Object.keys(modelData) : [],
                  hasModel: modelData?.model !== undefined,
                  hasId: modelData?.id !== undefined,
                  hasEntities: modelData?.entities !== undefined,
                  modelDataStructure: {
                    id: modelData?.id,
                    type: modelData?.type,
                    model: modelData?.model ? {
                      id: modelData.model.id,
                      type: typeof modelData.model,
                      constructor: modelData.model.constructor?.name
                    } : null
                  }
                });
              }}
              onThemeChange={setViewportTheme}
            />
            )}
            
            {/* Viewport-Bounded Property Panel */}
            {showPropertyPanel && selectedObjects.length > 0 && (
              <PropertyPanel
                title={`${selectedObjects[0].type} Properties`}
                properties={selectedObjectProperties}
                selectedObject={selectedObjects[0]}
                onClose={() => setShowPropertyPanel(false)}
                onChange={handlePropertyChange}
                position={{ x: 20, y: 20 }}
                isDraggable={true}
                isMinimizable={true}
                containerBounds={viewportDimensions}
              />
            )}
            
            {/* Slab Property Panel */}
            {showSlabPropertyPanel && selectedSlabData && (
              <SlabPropertyPanel
                slabData={selectedSlabData}
                onClose={() => setShowSlabPropertyPanel(false)}
                onUpdate={handleSlabPropertyChange}
                theme={viewportTheme}
              />
            )}
            
            {/* Viewport-Bounded Tool Panels */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="pointer-events-auto">
                <ToolPanelManager
                  selectedTool={selectedTool}
                  selectedObject={selectedObjects.length > 0 ? selectedObjects[0] : null}
                  theme={viewportTheme}
                  freecadObjects={cadObjects}
                  containerBounds={viewportDimensions}
                  // Wall tool handlers
                  wallParams={wallToolParams}
                  onWallParamsChange={setWallToolParams}
                  onCreateWall={handleCreateWall}
                  onUpdateWall={handleUpdateWall}
                  onCancelWallTool={handleCancelWallTool}
                  // Slab tool handlers
                  onCreateSlab={handleCreateSlab}
                  onUpdateSlab={handleUpdateSlab}
                  onCancelSlabTool={handleCancelSlabTool}
                  // Door tool handlers
                  doorParams={doorToolParams}
                  onDoorParamsChange={setDoorToolParams}
                  onCreateDoor={handleCreateDoor}
                  onUpdateDoor={handleUpdateDoor}
                  onCancelDoorTool={handleCancelDoorTool}
                  // Window tool handlers
                  onCreateWindow={handleCreateWindow}
                  onUpdateWindow={handleUpdateWindow}
                  onCancelWindowTool={handleCancelWindowTool}
                  // Roof tool handlers
                  onCreateRoof={handleCreateRoof}
                  onUpdateRoof={handleUpdateRoof}
                  onCancelRoofTool={handleCancelRoofTool}
                  // Stair tool handlers
                  onCreateStair={handleCreateStair}
                  onUpdateStair={handleUpdateStair}
                  onCancelStairTool={handleCancelStairTool}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Sidebar - AI Assistant */}
        <ResizableAIChat defaultWidth={480} minWidth={320} maxWidth={800}>
          <NativeAIChat 
            selectedTool={selectedTool}
            selectedObjects={selectedObjects}
            viewMode={viewMode}
            currentFloor={currentFloor}
            projectTree={PROJECT_TREE}
            onToolChange={setSelectedTool}
            onObjectSelect={(objectId) => {
              if (objectId) {
                standaloneCADEngine.selectObject(objectId);
                setSelectedObjects([objectId]);
              } else {
                standaloneCADEngine.clearSelection();
                setSelectedObjects([]);
              }
            }}
            onViewModeChange={setViewMode}
            onThemeChange={setViewportTheme}
            onFloorChange={setCurrentFloor}
            theme={viewportTheme}
          />
        </ResizableAIChat>
      </div>


      {/* OBJ Model Control Panel */}
      {selectedObjects.length > 0 && selectedObjectProperties.isImportedModel && (
        <OBJModelPanel
          modelData={selectedObjectProperties}
          onDelete={handleDeleteOBJModel}
          onTransform={handleTransformOBJModel}
          onClose={() => {
            setSelectedObjects([]);
            setSelectedObjectProperties({});
          }}
          theme={viewportTheme}
        />
      )}

      {/* Viewport Capture Frame */}
      <ViewportCaptureFrame
        isVisible={showCaptureFrame}
        onCapture={handleViewportCapture}
        onCancel={handleCaptureCancel}
        viewportRef={viewport3DRef}
      />

      {/* AI Render Overlay */}
      <AIRenderOverlay
        isOpen={showAIRenderOverlay}
        onClose={() => {
          setShowAIRenderOverlay(false);
          // Reset completion state only if user has viewed a completed render
          if (renderCompleted && !isRenderingActive) {
            setRenderCompleted(false);
          }
        }}
        viewportRef={viewport3DRef}
        viewMode={viewMode}
        capturedImage={capturedImage}
        onRecapture={handleRecapture}
        onRenderingStateChange={setIsRenderingInBackground}
        onRenderingActiveChange={setIsRenderingActive}
      />

      {/* Save Dialog */}
      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSave}
      />

      {/* CAD Blocks Popup */}
      <CADBlocksPopup
        isOpen={showCADBlocksPopup}
        onClose={() => setShowCADBlocksPopup(false)}
        toolType={cadBlocksToolType}
        onImportBlock={handleImportBlock}
        position={cadBlocksPopupPosition}
      />
    </div>
  );
}

export default AppWithAuth; 