/**
 * CAD Blocks Popup Component - Enhanced with Supabase Integration
 * 
 * Floating popup menu for inserting furniture and fixtures from scraped models
 * Features real model browser, thumbnails from Supabase, and import functionality
 */

import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';
import realSupabaseService from '../services/RealSupabaseService';
import {
  XMarkIcon,
  HomeIcon,
  LightBulbIcon,
  EyeIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

// Simple Supabase service for direct bucket access

/**
 * ENHANCED: Model Preview Component with real thumbnails
 */
const ModelPreview = ({ model, viewMode }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState('');

  // Get the best thumbnail URL with fallback logic
  const thumbnailUrl = model?.thumbnail_url || model?.thumbnailUrl || model?.directThumbnailUrl;
  
  // Update current URL when model changes
  useEffect(() => {
    console.log(`🔄 ModelPreview: URL change detected:`, {
      model: model?.displayName || model?.name || 'Unknown',
      newThumbnailUrl: thumbnailUrl,
      currentThumbnailUrl: currentThumbnailUrl,
      willUpdate: thumbnailUrl && thumbnailUrl !== currentThumbnailUrl
    });
    
    if (thumbnailUrl && thumbnailUrl !== currentThumbnailUrl) {
      console.log(`🔄 ModelPreview: Updating thumbnail URL for ${model?.displayName || 'model'}:`, {
        from: currentThumbnailUrl,
        to: thumbnailUrl
      });
      setCurrentThumbnailUrl(thumbnailUrl);
      setImageLoaded(false);
      setImageError(false);
    }
  }, [thumbnailUrl, currentThumbnailUrl, model]);

  if (!model) return null;

  if (viewMode === '2d' || thumbnailUrl) {
    // Show thumbnail if available
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center relative overflow-hidden">
        {currentThumbnailUrl && !imageError ? (
          <img
            src={currentThumbnailUrl}
            alt={model.name}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => {
              console.log(`✅ ModelPreview: Thumbnail loaded successfully!`, {
                model: model.displayName || model.name,
                url: currentThumbnailUrl,
                urlLength: currentThumbnailUrl?.length
              });
              setImageLoaded(true);
            }}
            onError={(e) => {
              console.error(`❌ ModelPreview: Thumbnail failed to load!`, {
                model: model.displayName || model.name,
                url: currentThumbnailUrl,
                urlLength: currentThumbnailUrl?.length,
                error: e.target.error,
                networkState: e.target.networkState,
                readyState: e.target.readyState
              });
              
              // Try fallback URL if available
              if (model.directThumbnailUrl && currentThumbnailUrl !== model.directThumbnailUrl) {
                console.log(`🔄 ModelPreview: Trying fallback URL:`, {
                  originalUrl: currentThumbnailUrl,
                  fallbackUrl: model.directThumbnailUrl
                });
                setCurrentThumbnailUrl(model.directThumbnailUrl);
              } else {
                console.log(`❌ ModelPreview: No fallback available, showing placeholder`);
                setImageError(true);
              }
            }}
          />
        ) : (
          <div className="text-center text-gray-500">
            <CubeIcon className="w-16 h-16 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No preview available</p>
            <p className="text-xs text-gray-400">{Array.isArray(model.format) ? model.format.join(', ') : (model.format || 'Unknown format')}</p>
          </div>
        )}
        
        {/* Loading overlay */}
        {currentThumbnailUrl && !imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
            <div className="ml-2 text-sm text-gray-600">Loading preview...</div>
          </div>
        )}
        
        {/* Model info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
          <div className="text-xs">
            {model.polygon_count && <span>Polygons: {model.polygon_count.toLocaleString()}</span>}
            {model.has_textures && <span className="ml-2">📖 Textured</span>}
            {model.is_rigged && <span className="ml-2">🦴 Rigged</span>}
          </div>
        </div>
      </div>
    );
  }

  // 3D preview fallback (simplified box representation)
  return (
    <Canvas
      camera={{ position: [2, 2, 2], fov: 50 }}
      className="w-full h-full bg-gradient-to-b from-gray-50 to-gray-200"
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      
      <Box
        args={[1, 1, 1]}
        position={[0, 0.5, 0]}
      >
        <meshStandardMaterial color="#8B4513" />
      </Box>
      
      <gridHelper args={[4, 10, '#cccccc', '#eeeeee']} />
      <OrbitControls enablePan={false} enableZoom={true} />
    </Canvas>
  );
};

/**
 * ENHANCED: Main CAD Blocks Popup Component with Supabase Integration
 */
const CADBlocksPopup = ({ 
  isOpen, 
  onClose, 
  toolType = 'furniture', // 'furniture' or 'fixtures'
  onImportBlock,
  position = { x: 100, y: 100 }
}) => {
  // State for dynamic content from API
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Navigation and selection state
  const [currentCategory, setCurrentCategory] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [previewMode, setPreviewMode] = useState('2d'); // Start with 2D to show thumbnails
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const modelsPerPage = 20;
  
  const popupRef = useRef(null);

  /**
   * Simple: Fetch categories from Supabase bucket
   */
  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📂 CADBlocksPopup: Loading categories from Supabase...');
      
      const categories = await realSupabaseService.getCategories();
      setCategories(categories);
      
      console.log('✅ CADBlocksPopup: Loaded categories:', {
        count: categories.length,
        categories: categories.map(c => ({
          name: c.name,
          displayName: c.displayName,
          model_count: c.model_count
        }))
      });
    } catch (err) {
      console.error('❌ CADBlocksPopup: Failed to fetch categories:', err);
      setError('Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Simple: Fetch models from Supabase bucket
   */
  const fetchModels = async (category = '', search = '', page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`📋 CADBlocksPopup: Loading models for category: "${category}" (page ${page}, search: "${search}")`);
      
      let allModels;
      
      if (category) {
        // Get models for specific category
        console.log(`🔍 CADBlocksPopup: Fetching models for specific category: "${category}"`);
        allModels = await realSupabaseService.getCategoryModels(category);
        console.log(`📦 CADBlocksPopup: Received ${allModels.length} models for category "${category}"`);
      } else {
        // Get all models
        console.log(`🔍 CADBlocksPopup: Fetching ALL models`);
        allModels = await realSupabaseService.getAllModels();
        console.log(`📦 CADBlocksPopup: Received ${allModels.length} total models`);
      }
      
      // Apply search filter
      let filteredModels = allModels;
      if (search) {
        console.log(`🔍 CADBlocksPopup: Applying search filter: "${search}"`);
        const searchLower = search.toLowerCase();
        filteredModels = allModels.filter(model =>
          model.name?.toLowerCase().includes(searchLower) ||
          model.displayName?.toLowerCase().includes(searchLower) ||
          model.category?.toLowerCase().includes(searchLower)
        );
        console.log(`🔍 CADBlocksPopup: Search filtered ${allModels.length} → ${filteredModels.length} models`);
      }
      
      // Apply pagination
      const startIndex = (page - 1) * modelsPerPage;
      const endIndex = startIndex + modelsPerPage;
      const paginatedModels = filteredModels.slice(startIndex, endIndex);
      
      console.log(`📄 CADBlocksPopup: Pagination: ${startIndex}-${endIndex} of ${filteredModels.length} = ${paginatedModels.length} models`);
      
      setModels(paginatedModels);
      setTotalPages(Math.ceil(filteredModels.length / modelsPerPage));
      
      // Auto-select first model if available
      if (paginatedModels.length > 0 && !selectedModel) {
        setSelectedModel(paginatedModels[0]);
        console.log(`🎯 CADBlocksPopup: Auto-selected first model: ${paginatedModels[0].displayName}`);
      }
      
      console.log(`✅ CADBlocksPopup: Final result - ${paginatedModels.length} models displayed (${filteredModels.length} total)`);
      
      // Debug first few models
      paginatedModels.slice(0, 3).forEach((model, index) => {
        console.log(`🖼️ CADBlocksPopup: Model ${index + 1}:`, {
          name: model.name,
          displayName: model.displayName,
          thumbnail_url: model.thumbnail_url,
          thumbnailUrl: model.thumbnailUrl,
          directThumbnailUrl: model.directThumbnailUrl
        });
      });
      
    } catch (err) {
      console.error('❌ CADBlocksPopup: Failed to fetch models:', err);
      setError('Failed to load models');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Simple: Import model to 3D viewport
   */
  const handleImport = async () => {
    if (!selectedModel || !onImportBlock) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('📦 Importing model:', selectedModel.displayName);
      
      // Prepare model data for 3D viewport
      const modelData = {
        id: selectedModel.id,
        name: selectedModel.name,
        displayName: selectedModel.displayName,
        category: selectedModel.category,
        format: selectedModel.format,
        modelUrl: selectedModel.modelUrl,
        model_url: selectedModel.modelUrl, // Compatibility
        thumbnailUrl: selectedModel.thumbnailUrl,
        thumbnail_url: selectedModel.thumbnailUrl, // Compatibility
        has_textures: selectedModel.has_textures,
        polygon_count: selectedModel.polygon_count,
        cached: false,
        type: 'model',
        preview: {
          width: 1.0,
          height: 1.0,
          depth: 1.0,
          color: '#8B4513'
        }
      };
      
      console.log('🎨 Model data:', {
        name: modelData.displayName,
        modelUrl: modelData.modelUrl,
        thumbnailUrl: modelData.thumbnailUrl
      });
      
      // Import to viewport
      await onImportBlock(modelData, toolType);
      
      console.log(`✅ Model imported successfully: ${selectedModel.displayName}`);
      
      // Close popup automatically - model is now placed in viewport
      onClose();
    } catch (err) {
      console.error('❌ Failed to import model:', err);
      setError(`Failed to import model: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle search
   */
  const handleSearch = (term) => {
    setSearchTerm(term);
    setCurrentPage(1);
    fetchModels(currentCategory, term, 1);
  };

  /**
   * Handle category selection
   */
  const handleCategorySelect = (category) => {
    // Handle special refresh action
    if (category === 'refresh') {
      console.log('🔄 Refreshing cache...');
      realSupabaseService.clearCache();
      fetchCategories();
      fetchModels(currentCategory, searchTerm, currentPage);
      return;
    }
    
    setCurrentCategory(category);
    setCurrentPage(1);
    setSelectedModel(null);
    fetchModels(category, searchTerm, 1);
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchModels(currentCategory, searchTerm, page);
  };

  // Load initial data when popup opens
  useEffect(() => {
    console.log(`🔄 CADBlocksPopup: useEffect triggered - isOpen: ${isOpen}, toolType: ${toolType}`);
    
    if (isOpen) {
      console.log(`🚀 CADBlocksPopup: Opening popup, loading initial data...`);
      fetchCategories();
      fetchModels('', '', 1);
    } else {
      console.log(`🚀 CADBlocksPopup: Closing popup, resetting state...`);
      // Reset state when closing
      setModels([]);
      setCategories([]);
      setSelectedModel(null);
      setSearchTerm('');
      setCurrentCategory('');
      setCurrentPage(1);
      setError(null);
    }
  }, [isOpen, toolType]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        ref={popupRef}
        className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden glass"
        style={{ 
          width: '1000px', 
          height: '700px',
          transform: `translate(${position.x - 500}px, ${position.y - 350}px)`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENHANCED Header with model count */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-gradient-to-r from-studiosix-500 to-studiosix-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              {toolType === 'furniture' ? <HomeIcon className="w-5 h-5" /> : <LightBulbIcon className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {toolType === 'furniture' ? 'Furniture Library' : 'Fixtures Library'}
              </h2>
              <div className="text-sm text-white/80">
                {models.length > 0 && `${models.length} models available`}
                {currentCategory && ` • ${currentCategory}`}
              </div>
            </div>
          </div>
          
          {/* API Status Indicator */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 text-xs">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span>Supabase Models</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
          </div>
        </div>

        <div className="flex h-full">
          {/* ENHANCED Left Panel - Categories and Models List */}
          <div className="w-1/2 border-r border-slate-700 flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-slate-700">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search StudioSix Library..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-studiosix-500 focus:border-studiosix-500"
                />
              </div>
            </div>

            {/* Categories Filter */}
            <div className="p-4 border-b border-slate-700">
              <div className="flex flex-wrap gap-2">
                    <button
                  onClick={() => handleCategorySelect('')}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    currentCategory === '' 
                      ? 'bg-studiosix-500 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  All
                    </button>
                {categories.map((cat) => (
                        <button
                    key={cat.name}
                    onClick={() => handleCategorySelect(cat.name)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      currentCategory === cat.name
                        ? 'bg-studiosix-500 text-white' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {cat.icon} {cat.displayName} ({cat.model_count})
                        </button>
                      ))}
              </div>
            </div>

            {/* Models List */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-800/50">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="w-6 h-6 text-studiosix-500 animate-spin mr-2" />
                  <span className="text-slate-400">Loading models...</span>
                    </div>
                  )}

              {error && (
                <div className="flex items-center justify-center py-8 text-red-400">
                  <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                  <span>{error}</span>
                            </div>
              )}

              {!loading && !error && models.length === 0 && (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <CubeIcon className="w-8 h-8 mr-2" />
                  <span>No models found</span>
                    </div>
                  )}

              {!loading && !error && models.length > 0 && (
                    <div className="space-y-2">
                  {models.map((model) => (
                        <button
                          key={model.id || model.name}
                      onClick={() => setSelectedModel(model)}
                      className={`flex items-start space-x-3 w-full p-3 text-left rounded-lg transition-colors border ${
                        selectedModel?.id === model.id
                              ? 'bg-studiosix-500/20 border-studiosix-400'
                              : 'hover:bg-slate-700/50 border-slate-600/50'
                          }`}
                        >
                      {/* Model thumbnail */}
                      <div className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ${
                        selectedModel?.id === model.id ? 'ring-2 ring-studiosix-400' : ''
                      }`}>
                        {(model.thumbnail_url || model.thumbnailUrl || model.directThumbnailUrl) ? (
                          <img
                            src={model.thumbnail_url || model.thumbnailUrl || model.directThumbnailUrl}
                            alt={model.displayName || model.name}
                            className="w-full h-full object-cover"
                            onLoad={() => {
                              console.log(`✅ ModelsList: Thumbnail loaded successfully!`, {
                                model: model.displayName || model.name,
                                src: model.thumbnail_url || model.thumbnailUrl || model.directThumbnailUrl
                              });
                            }}
                            onError={(e) => {
                              console.error(`❌ ModelsList: Thumbnail failed to load!`, {
                                model: model.displayName || model.name,
                                src: e.target.src,
                                error: e.target.error,
                                directThumbnailUrl: model.directThumbnailUrl
                              });
                              
                              // Try fallback URL
                              if (model.directThumbnailUrl && e.target.src !== model.directThumbnailUrl) {
                                console.log(`🔄 ModelsList: Trying fallback URL:`, {
                                  originalSrc: e.target.src,
                                  fallbackUrl: model.directThumbnailUrl
                                });
                                e.target.src = model.directThumbnailUrl;
                              } else {
                                console.log(`❌ ModelsList: No fallback available, hiding image`);
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div className="w-full h-full bg-slate-700 flex items-center justify-center" style={{display: (model.thumbnail_url || model.thumbnailUrl || model.directThumbnailUrl) ? 'none' : 'flex'}}>
                          <CubeIcon className="w-6 h-6 text-slate-400" />
                        </div>
                      </div>
                      
                      {/* Model info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{model.displayName || model.name}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {model.category && <span className="capitalize">{model.category}</span>}
                          {model.subcategory && <span> • {model.subcategory}</span>}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          {model.has_textures && <span className="text-xs bg-blue-500/20 text-blue-300 px-1 rounded">Textured</span>}
                          {model.is_rigged && <span className="text-xs bg-green-500/20 text-green-300 px-1 rounded">Rigged</span>}
                          {model.format && <span className="text-xs text-slate-500">{Array.isArray(model.format) ? model.format[0].toUpperCase() : model.format.toUpperCase()}</span>}
                          </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-4 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs bg-slate-700 text-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-xs bg-slate-700 text-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ENHANCED Right Panel - Model Preview and Details */}
          <div className="w-1/2 flex flex-col bg-slate-800/30">
            {selectedModel ? (
              <>
                {/* Model Details Header */}
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{selectedModel.name}</h3>
                      <p className="text-sm text-slate-300 mb-2">{selectedModel.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-slate-400">
                        <span>Source: {selectedModel.source}</span>
                        {selectedModel.author_name && <span>By: {selectedModel.author_name}</span>}
                        {selectedModel.polygon_count && <span>Polygons: {selectedModel.polygon_count.toLocaleString()}</span>}
                      </div>
                    </div>
                    
                    {/* View Mode Toggle & Import Button */}
                    <div className="flex items-center space-x-2">
                      {/* View Mode Toggle */}
                    <div className="flex items-center space-x-1 bg-slate-700 rounded-lg p-1">
                        <button
                          onClick={() => setPreviewMode('2d')}
                          className={`p-2 rounded-md transition-colors ${
                            previewMode === '2d'
                              ? 'bg-studiosix-500 shadow-sm text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                          title="Show thumbnail"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      <button
                        onClick={() => setPreviewMode('3d')}
                        className={`p-2 rounded-md transition-colors ${
                          previewMode === '3d'
                            ? 'bg-studiosix-500 shadow-sm text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                          title="3D preview"
                      >
                        <CubeIcon className="w-4 h-4" />
                      </button>
                      </div>
                      
                      {/* Import Button */}
                      <button
                        onClick={handleImport}
                        disabled={loading}
                        className="flex items-center space-x-1 px-3 py-2 bg-studiosix-600 hover:bg-studiosix-700 disabled:bg-slate-600 text-white rounded-lg transition-colors shadow-lg disabled:cursor-not-allowed text-sm font-medium"
                        title="Import model to viewport"
                      >
                        {loading ? (
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        ) : (
                          <CloudArrowDownIcon className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{loading ? 'Importing...' : 'Import'}</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Model Tags */}
                  {selectedModel.tags && selectedModel.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedModel.tags.slice(0, 6).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-slate-600/50 text-slate-300 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {selectedModel.tags.length > 6 && (
                        <span className="px-2 py-1 text-xs text-slate-400">
                          +{selectedModel.tags.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Preview Window */}
                <div className="flex-1 p-4">
                  <div className="w-full h-full bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                    <ModelPreview model={selectedModel} viewMode={previewMode} />
                  </div>
                </div>

                {/* Import Actions */}
                <div className="p-4 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-400">
                      <div>Format: {Array.isArray(selectedModel.format) ? selectedModel.format.join(', ') : (selectedModel.format || 'Unknown')}</div>
                      {selectedModel.file_size_mb && (
                        <div>Size: {typeof selectedModel.file_size_mb === 'number' ? selectedModel.file_size_mb.toFixed(1) : selectedModel.file_size_mb} MB</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <CubeIcon className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p className="text-lg mb-1">Select a model to preview</p>
                  <p className="text-sm text-slate-400">Browse from over 1000 models in our StudioSix Library</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CADBlocksPopup;