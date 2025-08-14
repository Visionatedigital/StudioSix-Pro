/**
 * CAD Blocks Popup Component - Enhanced with Supabase Integration
 * 
 * Floating popup menu for inserting furniture and fixtures from scraped models
 * Features real model browser, thumbnails from Supabase, and import functionality
 */

import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Environment } from '@react-three/drei';
import ModelCacheService from '../services/ModelCacheService';
import {
  XMarkIcon,
  HomeIcon,
  LightBulbIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  EyeIcon,
  CubeIcon,
  MapIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

// Model Cache Service instance
const modelCacheService = new ModelCacheService();

// API base URL for our Supabase endpoints
const API_BASE_URL = 'http://localhost:3001/api';

// Demo mode fallback when API is not available
const DEMO_MODE = false; // Use real model cache service

// Enhanced demo data with real scraped model thumbnails
const DEMO_CATEGORIES = [
  { category: 'vehicles', model_count: 4 },
  { category: 'characters', model_count: 1 },
  { category: 'nature', model_count: 1 },
  { category: 'furniture', model_count: 2 },
  { category: 'electronics', model_count: 1 }
];

const DEMO_MODELS = [
  {
    id: 'scraped-1',
    name: 'Bugatti Chiron 2017 Sports Car',
    description: 'Luxury sports car 3D model with detailed exterior and interior',
    category: 'vehicles',
    subcategory: 'cars',
    tags: ['bugatti', 'sports car', 'luxury', 'automotive', 'vehicle'],
    model_url: 'https://free3d.com/3d-model/bugatti-chiron-2017-model-31847.html',
    thumbnail_url: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=300&h=300&fit=crop',
    format: ['obj', 'blend', 'fbx'],
    file_size_mb: 3.2,
    has_textures: true,
    is_rigged: false,
    polygon_count: 12847,
    source: 'Free3D (Scraped)',
    author_name: 'Free3D Community',
    rating: 4.7,
    download_count: 850
  },
  {
    id: 'scraped-2',
    name: 'Male Base Mesh',
    description: 'Low poly human male base mesh for character development',
    category: 'characters',
    subcategory: 'humans',
    tags: ['human', 'male', 'character', 'base mesh', 'low poly'],
    model_url: 'https://free3d.com/3d-model/male-base-mesh-6682.html',
    thumbnail_url: 'https://images.unsplash.com/photo-1594736797933-d0e501ba2fe6?w=300&h=300&fit=crop',
    format: ['obj', 'blend'],
    file_size_mb: 1.8,
    has_textures: false,
    is_rigged: false,
    polygon_count: 6542,
    source: 'Free3D (Scraped)',
    author_name: 'Free3D Community',
    rating: 4.3,
    download_count: 1200
  },
  {
    id: 'scraped-3',
    name: 'Realistic Trees Scene',
    description: 'Pack of 3 realistic tree models for outdoor scenes',
    category: 'nature',
    subcategory: 'trees',
    tags: ['tree', 'nature', 'realistic', 'outdoor', 'landscape', 'plant'],
    model_url: 'https://free3d.com/3d-model/realistic-tree-pack-3-trees-95419.html',
    thumbnail_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop',
    format: ['3ds', 'obj', 'blend'],
    file_size_mb: 5.6,
    has_textures: true,
    is_rigged: false,
    polygon_count: 18394,
    source: 'Free3D (Scraped)',
    author_name: 'Free3D Community',
    rating: 4.8,
    download_count: 945
  },
  {
    id: 'demo-1',
    name: 'Modern Office Chair',
    description: 'Ergonomic office chair with adjustable height and lumbar support',
    category: 'furniture',
    subcategory: 'chairs',
    tags: ['office', 'chair', 'ergonomic', 'modern'],
    model_url: null, // No direct model file - use placeholder geometry
    thumbnail_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&h=300&fit=crop',
    format: ['obj'],
    file_size_mb: 2.1,
    has_textures: true,
    is_rigged: false,
    polygon_count: 8420,
    source: 'Stock Demo',
    author_name: 'DesignStudio',
    rating: 4.5,
    download_count: 1250
  },
  {
    id: 'demo-2', 
    name: 'Damaged Helmet (GLTF)',
    description: 'Battle-worn sci-fi helmet with PBR materials - GLTF format test',
    category: 'fixture',
    subcategory: 'decorative',
    tags: ['helmet', 'sci-fi', 'pbr', 'gltf', 'test'],
    model_url: null, // No direct model file - use placeholder geometry
    thumbnail_url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=300&fit=crop',
    format: ['gltf'],
    file_size_mb: 1.2,
    has_textures: true,
    is_rigged: false,
    polygon_count: 14046,
    source: 'Three.js Examples',
    author_name: 'Three.js Team',
    rating: 4.9,
    download_count: 2100
  },
  {
    id: 'demo-3',
    name: 'Minimalist Sofa',
    description: 'Clean lines modern sofa in neutral fabric',
    category: 'furniture', 
    subcategory: 'sofas',
    tags: ['sofa', 'modern', 'minimalist', 'living room'],
    model_url: 'https://example.com/models/sofa.obj',
    thumbnail_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=300&h=300&fit=crop',
    format: ['obj', 'mtl', 'fbx'],
    file_size_mb: 4.2,
    has_textures: true,
    is_rigged: false,
    polygon_count: 15800,
    source: 'Free3D',
    author_name: 'ModernInteriors',
    rating: 4.3,
    download_count: 670
  },
  {
    id: 'demo-4',
    name: 'Industrial Pendant Light',
    description: 'Vintage industrial style pendant light with metal finish',
    category: 'electronics',
    subcategory: 'lighting',
    tags: ['lighting', 'pendant', 'industrial', 'metal'],
    model_url: 'https://example.com/models/pendant-light.obj',
    thumbnail_url: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=300&h=300&fit=crop',
    format: ['obj', 'mtl'],
    file_size_mb: 1.5,
    has_textures: true,
    is_rigged: false,
    polygon_count: 4200,
    source: 'Free3D',
    author_name: 'LightDesigns',
    rating: 4.7,
    download_count: 420
  },
  {
    id: 'demo-5',
    name: 'Oak Tree',
    description: 'Realistic oak tree with detailed bark and foliage',
    category: 'nature',
    subcategory: 'trees',
    tags: ['tree', 'oak', 'nature', 'landscape'],
    model_url: 'https://example.com/models/oak-tree.obj',
    thumbnail_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop',
    format: ['obj', 'fbx', 'blend'],
    file_size_mb: 8.9,
    has_textures: true,
    is_rigged: false,
    polygon_count: 45000,
    source: 'Free3D',
    author_name: 'NatureModels',
    rating: 4.9,
    download_count: 1840
  },
  {
    id: 'demo-6',
    name: 'Executive Desk',
    description: 'Large executive desk with drawers and cable management',
    category: 'furniture',
    subcategory: 'desks',
    tags: ['desk', 'office', 'executive', 'drawers'],
    model_url: 'https://example.com/models/executive-desk.obj',
    thumbnail_url: 'https://images.unsplash.com/photo-1541558869434-2840d308329a?w=300&h=300&fit=crop',
    format: ['obj', 'mtl', 'fbx'],
    file_size_mb: 5.3,
    has_textures: true,
    is_rigged: false,
    polygon_count: 18900,
    source: 'Free3D',
    author_name: 'OfficeDesigns',
    rating: 4.4,
    download_count: 760
  }
];

// Category icon mapping enhanced for scraped categories
const CATEGORY_ICONS = {
  // Main categories from our scraper
  furniture: '🪑',
  vehicles: '🚗',
  architecture: '🏢',
  characters: '👤',
  nature: '🌳',
  electronics: '💻',
  weapons: '⚔️',
  sports: '⚽',
  abstract: '🎨',
  other: '📦',

  // Furniture subcategories
  interior: '🏠',
  exterior: '🌳',
  
  // Specific furniture types
  sofas: '🛋️',
  chairs: '🪑',
  tables: '🍽️',
  desks: '🖥️',
  beds: '🛏️',
  storage: '📦',
  lighting: '💡',
  
  // Other categories
  cars: '🚗',
  trucks: '🚛',
  buildings: '🏢',
  houses: '🏠',
  trees: '🌲',
  plants: '🌿'
};

/**
 * ENHANCED: Model Preview Component with real thumbnails
 */
const ModelPreview = ({ model, viewMode }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!model) return null;

  if (viewMode === '2d' || model.thumbnail_url) {
    // Show thumbnail if available
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center relative overflow-hidden">
        {model.thumbnail_url && !imageError ? (
          <img
            src={model.thumbnail_url}
            alt={model.name}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="text-center text-gray-500">
            <CubeIcon className="w-16 h-16 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No preview available</p>
            <p className="text-xs text-gray-400">{model.format?.join(', ') || 'Unknown format'}</p>
          </div>
        )}
        
        {/* Loading overlay */}
        {model.thumbnail_url && !imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <ArrowPathIcon className="w-8 h-8 text-gray-400 animate-spin" />
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
   * ENHANCED: Fetch categories from model cache service
   */
  const fetchCategories = async () => {
    try {
      if (DEMO_MODE) {
        // Use demo data
        const filteredCategories = DEMO_CATEGORIES.filter(cat => {
          if (toolType === 'furniture') {
            return cat.category === 'furniture' || cat.category === 'nature';
          } else if (toolType === 'fixtures') {
            return cat.category === 'electronics' || cat.category === 'architecture';
          }
          return false;
        });
        
        setCategories(filteredCategories);
        return;
      }

      // Use model cache service
      const result = await modelCacheService.getCategories();
      
      if (result.success) {
        // Filter categories based on tool type
        const filteredCategories = result.data.filter(cat => {
          if (toolType === 'furniture') {
            return cat.category === 'furniture' || cat.category === 'nature';
          } else if (toolType === 'fixtures') {
            return cat.category === 'electronics' || cat.category === 'architecture';
          }
          return false;
        });
        
        setCategories(filteredCategories);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      
      // Fallback to demo data on error
      console.log('🔄 Falling back to demo data...');
      const filteredCategories = DEMO_CATEGORIES.filter(cat => {
        if (toolType === 'furniture') {
          return cat.category === 'furniture' || cat.category === 'nature';
        } else if (toolType === 'fixtures') {
          return cat.category === 'electronics' || cat.category === 'architecture';
        }
        return false;
      });
      
      setCategories(filteredCategories);
    }
  };

  /**
   * ENHANCED: Fetch models from model cache service
   */
  const fetchModels = async (category = '', search = '', page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      if (DEMO_MODE) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Filter demo models
        let filteredModels = DEMO_MODELS;
        
        // Apply category filter
        if (category) {
          filteredModels = filteredModels.filter(model => model.category === category);
        }
        
        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase();
          filteredModels = filteredModels.filter(model =>
            model.name.toLowerCase().includes(searchLower) ||
            model.description.toLowerCase().includes(searchLower) ||
            model.tags.some(tag => tag.toLowerCase().includes(searchLower))
          );
        }
        
        // Apply pagination
        const startIndex = (page - 1) * modelsPerPage;
        const endIndex = startIndex + modelsPerPage;
        const paginatedModels = filteredModels.slice(startIndex, endIndex);
        
        setModels(paginatedModels);
        setTotalPages(Math.ceil(filteredModels.length / modelsPerPage));
        
        // Auto-select first model if available
        if (paginatedModels.length > 0 && !selectedModel) {
          setSelectedModel(paginatedModels[0]);
        }
        
        setLoading(false);
        return;
      }

      // Use model cache service
      const result = await modelCacheService.getAvailableModels({
        category,
        search,
        page,
        limit: modelsPerPage
      });
      
      if (result.success) {
        setModels(result.data);
        setTotalPages(result.pagination.totalPages);
        
        // Auto-select first model if available
        if (result.data.length > 0 && !selectedModel) {
          setSelectedModel(result.data[0]);
        }
      } else {
        setError('Failed to load models');
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
      
      // Fallback to demo data on error
      console.log('🔄 Falling back to demo data...');
      let filteredModels = DEMO_MODELS;
      
      if (category) {
        filteredModels = filteredModels.filter(model => model.category === category);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        filteredModels = filteredModels.filter(model =>
          model.name.toLowerCase().includes(searchLower) ||
          model.description.toLowerCase().includes(searchLower) ||
          model.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
      
      const startIndex = (page - 1) * modelsPerPage;
      const endIndex = startIndex + modelsPerPage;
      const paginatedModels = filteredModels.slice(startIndex, endIndex);
      
      setModels(paginatedModels);
      setTotalPages(Math.ceil(filteredModels.length / modelsPerPage));
      
      if (paginatedModels.length > 0 && !selectedModel) {
        setSelectedModel(paginatedModels[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * ENHANCED: Download and import model to 3D viewport using cache service
   */
  const handleImport = async () => {
    if (!selectedModel || !onImportBlock) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('📦 Importing model:', selectedModel.name, selectedModel.category);
      
      // Import model using cache service
      const importResult = await modelCacheService.importModel(selectedModel);
      
      if (!importResult.success) {
        throw new Error(importResult.error);
      }
      
      // Enhanced model data for 3D viewport import
      const enhancedModel = {
        // Core identification
        id: selectedModel.id,
        name: selectedModel.name,
        description: selectedModel.description,
        category: selectedModel.category,
        subcategory: selectedModel.subcategory,
        
        // Actual 3D model URLs from cache service
        modelUrl: importResult.modelPath,
        model_url: importResult.modelPath,
        thumbnail_url: importResult.thumbnailPath,
        
        // Cache status
        cached: importResult.cached,
        
        // 3D Model Properties
        format: selectedModel.format,
        has_textures: selectedModel.has_textures,
        is_rigged: selectedModel.is_rigged,
        polygon_count: selectedModel.polygon_count,
        
        // Metadata for display
        source: selectedModel.source,
        author_name: selectedModel.author_name,
        tags: selectedModel.tags,
        
        // Convert to CAD block format for compatibility
        preview: {
          width: 1.0, // Default size - user can scale
          height: 1.0,
          depth: 1.0,
          color: selectedModel.category === 'furniture' ? '#8B4513' : '#4A90E2'
        }
      };
      
      console.log('🎨 Model imported:', {
        name: enhancedModel.name,
        format: enhancedModel.format,
        modelPath: enhancedModel.modelUrl,
        cached: enhancedModel.cached,
        polygons: enhancedModel.polygon_count,
        hasTextures: enhancedModel.has_textures
      });
      
      // Import to viewport with enhanced model data
      await onImportBlock(enhancedModel, toolType);
      
      // Success feedback
      const cacheStatus = importResult.cached ? 'from cache' : 'downloaded and cached';
      console.log(`✅ Model imported successfully ${cacheStatus}: ${selectedModel.name}`);
      
      // Show success message
      if (window.alert) {
        const fileSize = selectedModel.file_size_mb ? ` (${selectedModel.file_size_mb} MB)` : '';
        window.alert(
          `✅ "${selectedModel.name}" imported successfully!\n\n` +
          `Status: ${cacheStatus}${fileSize}\n` +
          `The model is now available in your 3D viewport.`
        );
      }
      
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
    if (isOpen) {
      fetchCategories();
      fetchModels('', '', 1);
    } else {
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
              <div className={`w-2 h-2 rounded-full ${DEMO_MODE ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`}></div>
              <span>{DEMO_MODE ? 'Demo Mode' : 'Scraped Models'}</span>
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
                  placeholder="Search scraped models..."
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
                    key={cat.category}
                    onClick={() => handleCategorySelect(cat.category)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      currentCategory === cat.category 
                        ? 'bg-studiosix-500 text-white' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {CATEGORY_ICONS[cat.category]} {cat.category} ({cat.model_count})
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
                      key={model.id}
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
                        {model.thumbnail_url ? (
                          <img
                            src={model.thumbnail_url}
                            alt={model.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="w-full h-full bg-slate-700 flex items-center justify-center" style={{display: model.thumbnail_url ? 'none' : 'flex'}}>
                          <CubeIcon className="w-6 h-6 text-slate-400" />
                        </div>
                      </div>
                      
                      {/* Model info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{model.name}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {model.category && <span className="capitalize">{model.category}</span>}
                          {model.subcategory && <span> • {model.subcategory}</span>}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          {model.has_textures && <span className="text-xs bg-blue-500/20 text-blue-300 px-1 rounded">Textured</span>}
                          {model.is_rigged && <span className="text-xs bg-green-500/20 text-green-300 px-1 rounded">Rigged</span>}
                          {model.format && <span className="text-xs text-slate-500">{model.format.slice(0, 2).join(', ')}</span>}
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
                      <div>Format: {selectedModel.format?.join(', ') || 'Unknown'}</div>
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
                  <p className="text-sm text-slate-400">Browse scraped models from Free3D and other sources</p>
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