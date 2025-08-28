/**
 * Models Inventory - Your Actual Supabase Models
 * 
 * This is a simple configuration file listing your actual models.
 * When you upload new models to Supabase, just add them here!
 * 
 * No guessing, no discovery delays - just your real models.
 * 
 * @author StudioSix
 */

/**
 * Your actual models inventory
 * Add models here as you upload them to Supabase
 */
export const MODELS_INVENTORY = {
  'Side Tables': [
    'Side-Table_01-330pl',
    'Side-Table_02-1050pl', 
    'Side-Table_03-1600pl',
    'Side-Table_04-1600pl',
    'Side-Table_05-400pl',
    'Side-Table_06-2000pl',
    'Side-Table_07-1400pl',
    'Side-Table_08-800pl',
    'Side-Table_09-4700pl',
    'Side-Table_10-900pl',
    'Side-Table_11-1400pl',
    'Side-Table_12-1300pl',
    'Side-Table_13-800pl',
    'Side-Table_14-4000pl',
    'Side-Table_15-2200pl',
    'Side-Table_16-2100pl',
    'Side-Table_17-2500pl',
    'Side-Table_18-1000pl',
    'Side-Table_19-1550pl',
    'Side-Table_20-5400pl'
  ],
  
  // Add your other categories as you upload models:
  // 'chairs': [
  //   'Chair_Model_001',
  //   'Chair_Model_002'
  // ],
  // 
  // 'sofas': [
  //   'Sofa_Model_001', 
  //   'Sofa_Model_002'
  // ]
};

/**
 * Category display configuration
 */
export const CATEGORY_CONFIG = {
  'Side Tables': {
    displayName: 'Side Tables',
    icon: 'table',
    description: 'Modern and classic side tables'
  },
  'chairs': {
    displayName: 'Chairs', 
    icon: 'chair',
    description: 'Office and dining chairs'
  },
  'armchairs': {
    displayName: 'Armchairs',
    icon: 'armchair', 
    description: 'Comfortable armchairs'
  },
  'sofas': {
    displayName: 'Sofas',
    icon: 'sofa',
    description: 'Living room sofas'
  },
  'tables': {
    displayName: 'Tables',
    icon: 'table',
    description: 'Dining and coffee tables'
  },
  'stools': {
    displayName: 'Stools', 
    icon: 'stool',
    description: 'Bar and accent stools'
  }
};

/**
 * Generate display name for a model
 */
export function generateModelDisplayName(modelName, categoryName, index) {
  if (categoryName === 'Side Tables') {
    const styles = [
      'Modern', 'Classic', 'Minimalist', 'Contemporary', 'Elegant',
      'Wooden', 'Glass', 'Industrial', 'Vintage', 'Scandinavian',
      'Rustic', 'Marble', 'Metal', 'Round', 'Square',
      'Oval', 'Hexagon', 'Luxury', 'Designer', 'Premium'
    ];
    const style = styles[(index - 1) % styles.length];
    return `${style} Side Table ${index.toString().padStart(2, '0')}`;
  }
  
  // Default: clean up the model name
  return modelName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/(\d+)pl$/, ''); // Remove polygon count suffix
}

/**
 * Extract polygon count from model name
 */
export function extractPolygonCount(modelName) {
  const match = modelName.match(/(\d+)pl$/);
  return match ? `${match[1]} polygons` : 'Unknown';
}

/**
 * Easy way to add a new model
 */
export function addModelToInventory(categoryName, modelName) {
  if (!MODELS_INVENTORY[categoryName]) {
    MODELS_INVENTORY[categoryName] = [];
  }
  
  if (!MODELS_INVENTORY[categoryName].includes(modelName)) {
    MODELS_INVENTORY[categoryName].push(modelName);
    console.log(`✅ Added "${modelName}" to "${categoryName}"`);
    return true;
  }
  
  console.log(`⚠️ Model "${modelName}" already exists in "${categoryName}"`);
  return false;
}

export default {
  MODELS_INVENTORY,
  CATEGORY_CONFIG,
  generateModelDisplayName,
  extractPolygonCount,
  addModelToInventory
};

