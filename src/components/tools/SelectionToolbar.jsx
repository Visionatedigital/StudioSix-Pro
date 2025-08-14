/**
 * Selection Toolbar Component
 * Provides UI controls for enhanced selection functionality
 */

import React, { useState } from 'react';
import {
  CursorArrowRaysIcon,
  Square2StackIcon,
  PencilIcon,
  ShapeIcon,
  FunnelIcon,
  RectangleGroupIcon,
  EyeIcon,
  EyeSlashIcon,
  Squares2X2Icon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import useSelection from '../../hooks/useSelection.js';

const SelectionToolbar = ({
  scene,
  camera,
  renderer,
  raycaster,
  className = '',
  orientation = 'horizontal', // 'horizontal' | 'vertical'
  showLabels = false,
  theme = 'dark'
}) => {
  const {
    selectionMethod,
    activeFilters,
    selectionCount,
    hasSelection,
    setSelectionMethod,
    setSelectionFilters,
    clearSelection,
    selectAll,
    invertSelection,
    createGroup,
    SelectionMethods,
    SelectionFilters
  } = useSelection(scene, camera, renderer, raycaster);

  const [showFilters, setShowFilters] = useState(false);
  const [showGrouping, setShowGrouping] = useState(false);
  const [groupName, setGroupName] = useState('');

  // Theme classes
  const themeClasses = {
    dark: {
      toolbar: 'bg-gray-800 border-gray-600',
      button: 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600',
      activeButton: 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500',
      dropdown: 'bg-gray-800 border-gray-600',
      text: 'text-white',
      input: 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
    },
    light: {
      toolbar: 'bg-white border-gray-300',
      button: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300',
      activeButton: 'bg-blue-500 hover:bg-blue-400 text-white border-blue-400',
      dropdown: 'bg-white border-gray-300',
      text: 'text-gray-700',
      input: 'bg-white border-gray-300 text-gray-700 placeholder-gray-400'
    }
  };

  const t = themeClasses[theme];

  // Selection method options
  const selectionMethods = [
    {
      method: SelectionMethods.SINGLE,
      icon: CursorArrowRaysIcon,
      label: 'Single Select',
      tooltip: 'Select individual objects'
    },
    {
      method: SelectionMethods.WINDOW,
      icon: Square2StackIcon,
      label: 'Window Select',
      tooltip: 'Select objects completely within rectangle'
    },
    {
      method: SelectionMethods.CROSSING,
      icon: Squares2X2Icon,
      label: 'Crossing Select',
      tooltip: 'Select objects that intersect rectangle'
    },
    {
      method: SelectionMethods.LASSO,
      icon: PencilIcon,
      label: 'Lasso Select',
      tooltip: 'Draw freeform selection area'
    },
    {
      method: SelectionMethods.POLYGONAL,
      icon: ShapeIcon,
      label: 'Polygon Select',
      tooltip: 'Click to define polygon points'
    }
  ];

  // Filter options
  const filterOptions = [
    { filter: SelectionFilters.ALL, label: 'All Objects', icon: EyeIcon },
    { filter: SelectionFilters.WALLS, label: 'Walls', icon: RectangleGroupIcon },
    { filter: SelectionFilters.DOORS, label: 'Doors', icon: RectangleGroupIcon },
    { filter: SelectionFilters.WINDOWS, label: 'Windows', icon: RectangleGroupIcon },
    { filter: SelectionFilters.SLABS, label: 'Slabs', icon: RectangleGroupIcon },
    { filter: SelectionFilters.ROOFS, label: 'Roofs', icon: RectangleGroupIcon },
    { filter: SelectionFilters.STAIRS, label: 'Stairs', icon: RectangleGroupIcon },
    { filter: SelectionFilters.CONSTRAINTS, label: 'Constraints', icon: RectangleGroupIcon },
    { filter: SelectionFilters.GROUPS, label: 'Groups', icon: RectangleGroupIcon }
  ];

  // Handle selection method change
  const handleSelectionMethodChange = (method) => {
    setSelectionMethod(method);
  };

  // Handle filter toggle
  const handleFilterToggle = (filter) => {
    const newFilters = new Set(activeFilters);
    
    if (filter === SelectionFilters.ALL) {
      // If ALL is selected, clear other filters
      newFilters.clear();
      newFilters.add(SelectionFilters.ALL);
    } else {
      // Remove ALL if other filters are selected
      newFilters.delete(SelectionFilters.ALL);
      
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
      } else {
        newFilters.add(filter);
      }
      
      // If no filters selected, default to ALL
      if (newFilters.size === 0) {
        newFilters.add(SelectionFilters.ALL);
      }
    }
    
    setSelectionFilters(Array.from(newFilters));
  };

  // Handle group creation
  const handleCreateGroup = () => {
    if (!hasSelection) return;
    
    const name = groupName.trim() || `Group_${Date.now()}`;
    const success = createGroup(name);
    
    if (success) {
      setGroupName('');
      setShowGrouping(false);
    }
  };

  // Layout classes
  const layoutClasses = orientation === 'horizontal' 
    ? 'flex-row space-x-2' 
    : 'flex-col space-y-2';

  return (
    <div className={`
      ${className} 
      ${t.toolbar} 
      border rounded-lg p-2 shadow-lg
      ${orientation === 'horizontal' ? 'flex items-center' : 'flex flex-col'}
    `}>
      {/* Selection Method Buttons */}
      <div className={`flex ${layoutClasses}`}>
        {selectionMethods.map(({ method, icon: Icon, label, tooltip }) => (
          <button
            key={method}
            onClick={() => handleSelectionMethodChange(method)}
            className={`
              px-3 py-2 rounded border transition-colors duration-200
              ${selectionMethod === method ? t.activeButton : t.button}
              ${showLabels ? 'flex items-center space-x-2' : 'flex items-center justify-center'}
            `}
            title={tooltip}
          >
            <Icon className="w-5 h-5" />
            {showLabels && <span className="text-sm">{label}</span>}
          </button>
        ))}
      </div>

      {/* Separator */}
      {orientation === 'horizontal' ? (
        <div className="w-px h-8 bg-gray-600 mx-2" />
      ) : (
        <div className="h-px w-full bg-gray-600 my-2" />
      )}

      {/* Selection Actions */}
      <div className={`flex ${layoutClasses}`}>
        <button
          onClick={selectAll}
          className={`px-3 py-2 rounded border transition-colors duration-200 ${t.button}`}
          title="Select All (Ctrl+A)"
        >
          <CheckIcon className="w-5 h-5" />
          {showLabels && <span className="text-sm ml-2">All</span>}
        </button>

        <button
          onClick={invertSelection}
          className={`px-3 py-2 rounded border transition-colors duration-200 ${t.button}`}
          title="Invert Selection (Ctrl+I)"
        >
          <ArrowPathIcon className="w-5 h-5" />
          {showLabels && <span className="text-sm ml-2">Invert</span>}
        </button>

        <button
          onClick={clearSelection}
          disabled={!hasSelection}
          className={`
            px-3 py-2 rounded border transition-colors duration-200
            ${hasSelection ? t.button : 'opacity-50 cursor-not-allowed'}
          `}
          title="Clear Selection (Esc)"
        >
          <XMarkIcon className="w-5 h-5" />
          {showLabels && <span className="text-sm ml-2">Clear</span>}
        </button>
      </div>

      {/* Separator */}
      {orientation === 'horizontal' ? (
        <div className="w-px h-8 bg-gray-600 mx-2" />
      ) : (
        <div className="h-px w-full bg-gray-600 my-2" />
      )}

      {/* Filters */}
      <div className="relative">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`
            px-3 py-2 rounded border transition-colors duration-200
            ${showFilters ? t.activeButton : t.button}
          `}
          title="Selection Filters"
        >
          <FunnelIcon className="w-5 h-5" />
          {showLabels && <span className="text-sm ml-2">Filters</span>}
        </button>

        {showFilters && (
          <div className={`
            absolute ${orientation === 'horizontal' ? 'top-full left-0 mt-2' : 'left-full top-0 ml-2'}
            ${t.dropdown} border rounded-lg p-2 shadow-lg z-50 min-w-48
          `}>
            <div className="space-y-1">
              {filterOptions.map(({ filter, label, icon: Icon }) => (
                <label
                  key={filter}
                  className={`
                    flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-opacity-10 hover:bg-white
                    ${activeFilters.includes(filter) ? 'bg-blue-600 bg-opacity-20' : ''}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={activeFilters.includes(filter)}
                    onChange={() => handleFilterToggle(filter)}
                    className="rounded"
                  />
                  <Icon className="w-4 h-4" />
                  <span className={`text-sm ${t.text}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grouping */}
      <div className="relative">
        <button
          onClick={() => setShowGrouping(!showGrouping)}
          disabled={!hasSelection}
          className={`
            px-3 py-2 rounded border transition-colors duration-200
            ${showGrouping ? t.activeButton : t.button}
            ${!hasSelection ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title="Group Selection"
        >
          <RectangleGroupIcon className="w-5 h-5" />
          {showLabels && <span className="text-sm ml-2">Group</span>}
        </button>

        {showGrouping && hasSelection && (
          <div className={`
            absolute ${orientation === 'horizontal' ? 'top-full left-0 mt-2' : 'left-full top-0 ml-2'}
            ${t.dropdown} border rounded-lg p-3 shadow-lg z-50 min-w-64
          `}>
            <div className="space-y-3">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className={`
                    w-full px-3 py-2 rounded border text-sm
                    ${t.input}
                  `}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateGroup();
                    }
                  }}
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateGroup}
                  className={`
                    flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm
                    transition-colors duration-200
                  `}
                >
                  Create Group
                </button>
                <button
                  onClick={() => setShowGrouping(false)}
                  className={`px-3 py-2 ${t.button} rounded text-sm`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selection Count */}
      {selectionCount > 0 && (
        <div className={`
          ${orientation === 'horizontal' ? 'ml-auto' : 'mt-auto'}
          px-3 py-2 rounded ${t.dropdown} border
        `}>
          <span className={`text-sm ${t.text}`}>
            {selectionCount} selected
          </span>
        </div>
      )}
    </div>
  );
};

// Quick selection buttons component
export const QuickSelectionButtons = ({
  scene,
  camera,
  renderer,
  raycaster,
  className = '',
  theme = 'dark'
}) => {
  const {
    clearSelection,
    selectAll,
    invertSelection,
    hasSelection,
    selectionCount
  } = useSelection(scene, camera, renderer, raycaster);

  const themeClasses = {
    dark: {
      button: 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600',
      text: 'text-white'
    },
    light: {
      button: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300',
      text: 'text-gray-700'
    }
  };

  const t = themeClasses[theme];

  return (
    <div className={`${className} flex items-center space-x-2`}>
      <button
        onClick={selectAll}
        className={`px-2 py-1 rounded border text-xs transition-colors duration-200 ${t.button}`}
        title="Select All"
      >
        All
      </button>
      
      <button
        onClick={invertSelection}
        className={`px-2 py-1 rounded border text-xs transition-colors duration-200 ${t.button}`}
        title="Invert Selection"
      >
        Invert
      </button>
      
      <button
        onClick={clearSelection}
        disabled={!hasSelection}
        className={`
          px-2 py-1 rounded border text-xs transition-colors duration-200
          ${hasSelection ? t.button : 'opacity-50 cursor-not-allowed'}
        `}
        title="Clear Selection"
      >
        Clear
      </button>
      
      {selectionCount > 0 && (
        <span className={`text-xs ${t.text}`}>
          ({selectionCount})
        </span>
      )}
    </div>
  );
};

// Selection method indicator
export const SelectionMethodIndicator = ({
  scene,
  camera,
  renderer,
  raycaster,
  className = '',
  theme = 'dark'
}) => {
  const { selectionMethod, SelectionMethods } = useSelection(scene, camera, renderer, raycaster);

  const methodLabels = {
    [SelectionMethods.SINGLE]: 'Single',
    [SelectionMethods.WINDOW]: 'Window',
    [SelectionMethods.CROSSING]: 'Crossing',
    [SelectionMethods.LASSO]: 'Lasso',
    [SelectionMethods.POLYGONAL]: 'Polygon'
  };

  const themeClasses = {
    dark: {
      indicator: 'bg-gray-800 border-gray-600 text-white',
    },
    light: {
      indicator: 'bg-white border-gray-300 text-gray-700',
    }
  };

  const t = themeClasses[theme];

  return (
    <div className={`
      ${className} 
      px-3 py-1 rounded border text-sm font-medium
      ${t.indicator}
    `}>
      {methodLabels[selectionMethod] || 'Unknown'}
    </div>
  );
};

export default SelectionToolbar; 