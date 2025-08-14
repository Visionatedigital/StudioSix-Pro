const config = require('../config/supabase-config');
const logger = require('./logger');

class ModelCategorizer {
  constructor() {
    this.categories = config.folders.categories;
    this.initializeKeywords();
  }

  /**
   * Initialize keyword mappings for smart categorization
   */
  initializeKeywords() {
    this.keywordMappings = {
      // Furniture - Interior
      'furniture/interior/sofas': ['sofa', 'couch', 'sectional', 'loveseat', 'chesterfield'],
      'furniture/interior/chairs': ['chair', 'seat', 'stool', 'folding chair', 'accent chair'],
      'furniture/interior/armchairs': ['armchair', 'recliner', 'wingback', 'lounge chair'],
      'furniture/interior/ottomans': ['ottoman', 'footstool', 'pouf'],
      'furniture/interior/coffee-tables': ['coffee table', 'center table', 'cocktail table'],
      'furniture/interior/side-tables': ['side table', 'end table', 'accent table', 'lamp table'],
      'furniture/interior/tv-stands': ['tv stand', 'television stand', 'media console', 'tv unit'],
      'furniture/interior/entertainment-centers': ['entertainment center', 'media center', 'tv wall'],
      'furniture/interior/bookcases': ['bookcase', 'bookshelf', 'library', 'book rack'],
      'furniture/interior/shelving': ['shelf', 'shelving', 'shelving unit', 'wall shelf'],
      
      // Bedroom
      'furniture/interior/beds': ['bed', 'mattress', 'bunk bed', 'platform bed', 'canopy bed'],
      'furniture/interior/nightstands': ['nightstand', 'bedside table', 'night table'],
      'furniture/interior/dressers': ['dresser', 'chest of drawers', 'bureau'],
      'furniture/interior/wardrobes': ['wardrobe', 'closet', 'armoire'],
      
      // Kitchen & Dining
      'furniture/interior/dining-tables': ['dining table', 'kitchen table', 'breakfast table'],
      'furniture/interior/dining-chairs': ['dining chair', 'kitchen chair'],
      'furniture/interior/bar-stools': ['bar stool', 'counter stool', 'pub stool'],
      'furniture/interior/kitchen-islands': ['kitchen island', 'kitchen counter'],
      'furniture/interior/cabinets': ['cabinet', 'cupboard', 'kitchen cabinet'],
      
      // Office
      'furniture/interior/desks': ['desk', 'writing desk', 'computer desk', 'office desk'],
      'furniture/interior/office-chairs': ['office chair', 'desk chair', 'swivel chair', 'executive chair'],
      'furniture/interior/filing-cabinets': ['filing cabinet', 'file cabinet'],
      
      // Furniture - Exterior
      'furniture/exterior/patio-sets': ['patio set', 'outdoor set', 'garden set'],
      'furniture/exterior/outdoor-dining': ['outdoor dining', 'patio dining', 'garden dining'],
      'furniture/exterior/outdoor-sofas': ['outdoor sofa', 'patio sofa', 'garden sofa'],
      'furniture/exterior/benches': ['bench', 'garden bench', 'park bench', 'outdoor bench'],
      'furniture/exterior/umbrellas': ['umbrella', 'parasol', 'patio umbrella'],
      
      // Vehicles
      'vehicles/cars': ['car', 'automobile', 'sedan', 'hatchback', 'suv', 'coupe', 'convertible'],
      'vehicles/trucks': ['truck', 'pickup', 'semi', 'lorry', 'delivery truck'],
      'vehicles/motorcycles': ['motorcycle', 'bike', 'motorbike', 'scooter'],
      'vehicles/aircraft': ['plane', 'airplane', 'jet', 'helicopter', 'aircraft'],
      'vehicles/boats': ['boat', 'ship', 'yacht', 'sailboat', 'speedboat'],
      
      // Architecture
      'architecture/buildings': ['building', 'skyscraper', 'office building'],
      'architecture/houses': ['house', 'home', 'villa', 'cottage', 'mansion'],
      'architecture/commercial': ['store', 'shop', 'mall', 'restaurant', 'hotel'],
      
      // Characters
      'characters/humans': ['human', 'person', 'man', 'woman', 'character', 'figure'],
      'characters/animals': ['animal', 'dog', 'cat', 'horse', 'bird', 'fish'],
      
      // Nature
      'nature/trees': ['tree', 'oak', 'pine', 'palm', 'cedar', 'birch'],
      'nature/plants': ['plant', 'bush', 'shrub', 'fern', 'grass'],
      'nature/flowers': ['flower', 'rose', 'tulip', 'daisy', 'lily'],
      
      // Electronics
      'electronics/computers': ['computer', 'laptop', 'monitor', 'keyboard', 'mouse'],
      'electronics/phones': ['phone', 'smartphone', 'iphone', 'android'],
      'electronics/appliances': ['refrigerator', 'microwave', 'washing machine', 'dishwasher']
    };
  }

  /**
   * Categorize a model based on its metadata
   */
  categorizeModel(metadata) {
    try {
      logger.debug(`🏷️ Categorizing model: ${metadata.title}`);
      
      const text = this.combineTextFields(metadata);
      const normalizedText = text.toLowerCase();
      
      // Find the best matching category
      const category = this.findBestCategory(normalizedText);
      
      // Get the folder path
      const folderPath = this.getCategoryPath(category);
      
      logger.info(`📂 Model "${metadata.title}" categorized as: ${category} → ${folderPath}`);
      
      return {
        category: category,
        folderPath: folderPath,
        confidence: this.calculateConfidence(normalizedText, category)
      };
      
    } catch (error) {
      logger.error(`❌ Error categorizing model: ${metadata.title}`, error);
      return {
        category: 'other',
        folderPath: 'other',
        confidence: 0
      };
    }
  }

  /**
   * Combine all text fields for analysis
   */
  combineTextFields(metadata) {
    const fields = [
      metadata.title || '',
      metadata.description || '',
      metadata.pageTitle || '',
      ...(metadata.tags || []),
      ...(metadata.categories || [])
    ];
    
    return fields.join(' ').trim();
  }

  /**
   * Find the best matching category for the text
   */
  findBestCategory(normalizedText) {
    let bestCategory = 'other';
    let bestScore = 0;
    
    // Check each category's keywords
    for (const [categoryPath, keywords] of Object.entries(this.keywordMappings)) {
      const score = this.calculateCategoryScore(normalizedText, keywords);
      
      if (score > bestScore) {
        bestScore = score;
        bestCategory = categoryPath;
      }
    }
    
    // If no specific match found, try broader categories
    if (bestScore === 0) {
      bestCategory = this.findBroadCategory(normalizedText);
    }
    
    return bestCategory;
  }

  /**
   * Calculate how well text matches a category's keywords
   */
  calculateCategoryScore(text, keywords) {
    let score = 0;
    
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        // Exact matches get higher score
        score += keyword.length > 3 ? 10 : 5;
        
        // Multiple word matches get bonus
        if (keyword.includes(' ')) {
          score += 5;
        }
      }
    }
    
    return score;
  }

  /**
   * Find broad category if no specific match
   */
  findBroadCategory(text) {
    const broadKeywords = {
      'furniture/interior/other': ['furniture', 'table', 'cabinet'],
      'vehicles/other': ['vehicle', 'transport'],
      'architecture/other': ['building', 'structure'],
      'characters/other': ['character', 'person'],
      'nature/other': ['nature', 'natural'],
      'electronics/other': ['electronic', 'device']
    };
    
    for (const [category, keywords] of Object.entries(broadKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return category;
        }
      }
    }
    
    return 'other';
  }

  /**
   * Get the actual folder path for a category
   */
  getCategoryPath(category) {
    // If it's already a path (contains '/'), return as-is
    if (category.includes('/')) {
      return category;
    }
    
    // Otherwise it's a simple category
    return category;
  }

  /**
   * Calculate confidence score for the categorization
   */
  calculateConfidence(text, category) {
    if (category === 'other') return 0;
    
    const keywords = this.keywordMappings[category] || [];
    const score = this.calculateCategoryScore(text, keywords);
    
    // Convert to percentage (rough estimate)
    return Math.min(100, score * 2);
  }

  /**
   * Get all available categories as a flat list
   */
  getAllCategories() {
    return Object.keys(this.keywordMappings);
  }

  /**
   * Get category statistics
   */
  getCategoryStats() {
    const stats = {};
    
    for (const category of this.getAllCategories()) {
      const parts = category.split('/');
      const mainCategory = parts[0];
      
      if (!stats[mainCategory]) {
        stats[mainCategory] = 0;
      }
      stats[mainCategory]++;
    }
    
    return stats;
  }
}

module.exports = ModelCategorizer; 