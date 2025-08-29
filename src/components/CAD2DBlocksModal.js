/**
 * 2D CAD Blocks Modal Component
 * Browse and import 2D SVG CAD symbols from the local library
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  CloudArrowDownIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  TagIcon,
  ChevronDownIcon,
  HomeIcon
} from '@heroicons/react/24/outline';
import cad2DLibraryService from '../services/CAD2DLibraryService';

/**
 * SVG Preview Component
 */
const SVGPreview = ({ svgData, isSelected }) => {
  const [svgContent, setSvgContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (svgData) {
      loadSVG();
    }
  }, [svgData]);

  const normalizeSVG = (raw) => {
    try {
      // Ensure the root <svg> scales to its container and preserves aspect ratio
      let content = raw;
      // Add preserveAspectRatio if missing
      if (!/preserveAspectRatio=/i.test(content)) {
        content = content.replace(/<svg(\s|>)/i, '<svg preserveAspectRatio="xMidYMid meet" ');
      }
      // Remove hardcoded width/height to allow responsive fit
      content = content.replace(/\swidth="[^"]*"/gi, '').replace(/\sheight="[^"]*"/gi, '');
      // Force style width/height to 100%
      if (!/style="[^"]*"/i.test(content)) {
        content = content.replace(/<svg/i, '<svg style="width:100%;height:100%"');
      } else {
        content = content.replace(/style="([^"]*)"/i, (m, s) => `style="${s};width:100%;height:100%"`);
      }
      return content;
    } catch {
      return raw;
    }
  };

  const loadSVG = async () => {
    try {
      setLoading(true);
      setError(false);
      const content = await cad2DLibraryService.loadSVGContent(svgData.fullPath);
      setSvgContent(normalizeSVG(content));
    } catch (err) {
      console.error('Failed to load SVG:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <ArrowPathIcon className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
      </div>
    );
  }

  return (
    <div 
      className={`w-full h-full bg-white flex items-center justify-center p-2 border-2 transition-all ${
        isSelected ? 'border-studiosix-500 bg-studiosix-50' : 'border-transparent'
      }`}
    >
      <div className="w-full h-full overflow-hidden">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
          <g dangerouslySetInnerHTML={{ __html: svgContent.replace(/<\/?svg[^>]*>/g, '') }} />
        </svg>
      </div>
    </div>
  );
};

/**
 * Main 2D CAD Blocks Modal Component
 */
const CAD2DBlocksModal = ({ 
  isOpen, 
  onClose, 
  onImportBlock,
  position = { x: 100, y: 100 }
}) => {
  // State management
  const [categories, setCategories] = useState([]);
  const [svgBlocks, setSvgBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Navigation state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedSVG, setSelectedSVG] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI state
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const modalRef = useRef(null);
  const categoryDropdownRef = useRef(null);

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadAllSVGs();
    } else {
      // Reset state when closing
      setSelectedCategory('');
      setSelectedSubcategory('');
      setSelectedSVG(null);
      setSearchTerm('');
      setError(null);
    }
  }, [isOpen]);

  // Load categories
  const loadCategories = async () => {
    try {
      const cats = await cad2DLibraryService.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError('Failed to load categories');
    }
  };

  // Load all SVGs initially
  const loadAllSVGs = async () => {
    try {
      setLoading(true);
      setError(null);
      const svgs = await cad2DLibraryService.getAllSVGs();
      setSvgBlocks(svgs);
      
      // Auto-select first SVG if available
      if (svgs.length > 0 && !selectedSVG) {
        setSelectedSVG(svgs[0]);
      }
    } catch (err) {
      console.error('Failed to load SVGs:', err);
      setError('Failed to load 2D CAD blocks');
    } finally {
      setLoading(false);
    }
  };

  // Handle category selection
  const handleCategoryChange = async (category, subcategory = '') => {
    try {
      setLoading(true);
      setSelectedCategory(category);
      setSelectedSubcategory(subcategory);
      setSelectedSVG(null);
      setCategoryDropdownOpen(false);
      
      let svgs = [];
      if (category && subcategory) {
        svgs = await cad2DLibraryService.getCategorySVGs(category, subcategory);
      } else if (category) {
        // Load all subcategories for this category
        const cat = categories.find(c => c.name === category);
        if (cat) {
          for (const sub of cat.subcategories) {
            const subSvgs = await cad2DLibraryService.getCategorySVGs(category, sub);
            svgs.push(...subSvgs);
          }
        }
      } else {
        svgs = await cad2DLibraryService.getAllSVGs();
      }
      
      setSvgBlocks(svgs);
      
      // Auto-select first SVG
      if (svgs.length > 0) {
        setSelectedSVG(svgs[0]);
      }
    } catch (err) {
      console.error('Failed to load category SVGs:', err);
      setError('Failed to load category');
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = async (term) => {
    try {
      setSearchTerm(term);
      setLoading(true);
      
      if (!term.trim()) {
        await loadAllSVGs();
        return;
      }
      
      const results = await cad2DLibraryService.searchSVGs(term);
      setSvgBlocks(results);
      
      // Auto-select first result
      if (results.length > 0) {
        setSelectedSVG(results[0]);
      } else {
        setSelectedSVG(null);
      }
    } catch (err) {
      console.error('Failed to search SVGs:', err);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle SVG import
  const importBlock = (svgBlock) => {
    const block = svgBlock || selectedSVG;
    if (!block || !onImportBlock) return;

    console.log('🎨 Importing 2D CAD block:', block);
    const blockData = {
      id: block.id,
      name: block.name,
      category: block.category,
      subcategory: block.subcategory,
      path: block.fullPath,
      type: '2d-cad-block',
      svgPath: block.fullPath
    };
    onImportBlock(blockData);
    onClose();
  };

  const handleImport = () => importBlock(selectedSVG);

  // Support drag-and-drop into the 2D viewport
  const handleDragStart = (event, svgBlock) => {
    try {
      const blockData = {
        id: svgBlock.id,
        name: svgBlock.name,
        category: svgBlock.category,
        subcategory: svgBlock.subcategory,
        path: svgBlock.fullPath,
        type: '2d-cad-block',
        svgPath: svgBlock.fullPath
      };
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-studiosix-2d-block', JSON.stringify(blockData));
      // Fallback for simpler drop targets
      event.dataTransfer.setData('text/plain', svgBlock.fullPath);
    } catch (err) {
      console.error('Failed to start drag for svg block:', err);
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const currentCategoryData = categories.find(c => c.name === selectedCategory);
  const displayName = selectedSubcategory 
    ? `${selectedCategory} • ${selectedSubcategory}`
    : selectedCategory || 'All Categories';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        ref={modalRef}
        className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden glass"
        style={{ 
          width: '1200px', 
          height: '800px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-gradient-to-r from-studiosix-500 to-studiosix-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <TagIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">2D CAD Blocks Library</h2>
              <div className="text-sm text-white/80">
                {svgBlocks.length > 0 && `${svgBlocks.length} blocks available`}
                {displayName !== 'All Categories' && ` • ${displayName}`}
              </div>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-full">
          {/* Left Panel - Navigation and List */}
          <div className="w-1/2 border-r border-slate-700 flex flex-col">
            
            {/* Search and Category Filter */}
            <div className="p-4 border-b border-slate-700 space-y-3">
              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search CAD blocks..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-studiosix-500 focus:border-studiosix-500"
                />
              </div>

              {/* Category Dropdown */}
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">
                      {currentCategoryData?.icon || '📂'} {displayName}
                    </span>
                  </div>
                  <ChevronDownIcon className={`w-4 h-4 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {categoryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                    {/* All Categories */}
                    <button
                      onClick={() => handleCategoryChange('')}
                      className={`w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-slate-700 transition-colors ${
                        !selectedCategory ? 'bg-studiosix-500/20 text-studiosix-300' : 'text-white'
                      }`}
                    >
                      <span>📂</span>
                      <span className="text-sm">All Categories</span>
                    </button>

                    {/* Categories and Subcategories */}
                    {categories.map((category) => (
                      <div key={category.name}>
                        {/* Main Category */}
                        <button
                          onClick={() => handleCategoryChange(category.name)}
                          className={`w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-slate-700 transition-colors border-l-2 ${
                            selectedCategory === category.name && !selectedSubcategory
                              ? 'border-studiosix-500 bg-studiosix-500/20 text-studiosix-300'
                              : 'border-transparent text-white'
                          }`}
                        >
                          <span>{category.icon}</span>
                          <span className="text-sm font-medium">{category.displayName}</span>
                        </button>

                        {/* Subcategories */}
                        {category.subcategories.map((subcategory) => (
                          <button
                            key={`${category.name}-${subcategory}`}
                            onClick={() => handleCategoryChange(category.name, subcategory)}
                            className={`w-full flex items-center space-x-2 px-6 py-2 text-left hover:bg-slate-700 transition-colors border-l-2 ${
                              selectedCategory === category.name && selectedSubcategory === subcategory
                                ? 'border-studiosix-500 bg-studiosix-500/20 text-studiosix-300'
                                : 'border-transparent text-slate-300'
                            }`}
                          >
                            <span className="text-xs">└</span>
                            <span className="text-sm">{subcategory}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SVG Blocks Grid */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-800/50">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="w-6 h-6 text-studiosix-500 animate-spin mr-2" />
                  <span className="text-slate-400">Loading CAD blocks...</span>
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center py-8 text-red-400">
                  <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                  <span>{error}</span>
                </div>
              )}

              {!loading && !error && svgBlocks.length === 0 && (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <TagIcon className="w-8 h-8 mr-2" />
                  <span>No CAD blocks found</span>
                </div>
              )}

              {!loading && !error && svgBlocks.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {svgBlocks.map((svgBlock) => (
                    <button
                      key={svgBlock.id}
                      onClick={() => setSelectedSVG(svgBlock)}
                      onDoubleClick={() => importBlock(svgBlock)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, svgBlock)}
                      className={`aspect-square rounded-lg transition-all border-2 p-2 ${
                        selectedSVG?.id === svgBlock.id
                          ? 'border-studiosix-500 bg-studiosix-500/10'
                          : 'border-slate-600/50 hover:border-slate-500 bg-white/5'
                      }`}
                    >
                      <SVGPreview 
                        svgData={svgBlock} 
                        isSelected={selectedSVG?.id === svgBlock.id}
                      />
                      <div className="mt-2 text-xs text-slate-400 truncate">
                        {svgBlock.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Preview and Import */}
          <div className="w-1/2 flex flex-col bg-slate-800/30">
            {selectedSVG ? (
              <>
                {/* SVG Details Header */}
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{selectedSVG.name}</h3>
                      <div className="flex items-center space-x-4 text-xs text-slate-400">
                        <span>{selectedSVG.category}</span>
                        {selectedSVG.subcategory && <span>• {selectedSVG.subcategory}</span>}
                      </div>
                    </div>
                    
                    {/* Import Button */}
                    <button
                      onClick={handleImport}
                      className="flex items-center space-x-2 px-4 py-2 bg-studiosix-600 hover:bg-studiosix-700 text-white rounded-lg transition-colors shadow-lg text-sm font-medium"
                      title="Import CAD block to 2D viewport"
                    >
                      <CloudArrowDownIcon className="w-4 h-4" />
                      <span>Import</span>
                    </button>
                  </div>
                </div>

                {/* Large Preview */}
                <div className="flex-1 p-6">
                  <div className="w-full h-full bg-white rounded-lg border border-gray-200 overflow-hidden shadow-inner">
                    <SVGPreview svgData={selectedSVG} isSelected={false} />
                  </div>
                </div>

                {/* Import Instructions */}
                <div className="p-4 border-t border-slate-700">
                  <div className="text-sm text-slate-400">
                    <div className="flex items-center space-x-2 mb-2">
                      <HomeIcon className="w-4 h-4" />
                      <span className="font-medium text-slate-300">How to use:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-xs ml-6">
                      <li>Click "Import" to add this block to your 2D viewport</li>
                      <li>The block will follow your cursor in ghost mode</li>
                      <li>Click to place it exactly where you want</li>
                      <li>The tool will automatically return to select mode</li>
                    </ol>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <TagIcon className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p className="text-lg mb-1">Select a CAD block to preview</p>
                  <p className="text-sm text-slate-400">Choose from our curated library of 2D architectural symbols</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CAD2DBlocksModal;