/**
 * Supabase Models Manifest - Robust Model Discovery
 * 
 * This file contains the definitive list of all models in your Supabase bucket.
 * Instead of guessing patterns, we maintain a clean manifest that's easy to update.
 * 
 * To add new models:
 * 1. Upload FBX + thumbnail to Supabase
 * 2. Add entry to the appropriate category below
 * 3. Models appear immediately - no discovery delays!
 * 
 * @author StudioSix
 */

const SUPABASE_URL = 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const BUCKET_NAME = 'models_fbx';
const BASE_URL = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`;

/**
 * Model Categories and their complete model lists
 * 
 * Structure:
 * - Each category has a name, display name, icon, and models array
 * - Each model has id, name, files (thumbnail, fbx, textures)
 * - URLs are auto-generated from the file structure
 */
export const MODEL_MANIFEST = {
  categories: [
    {
      name: 'Side Tables',
      displayName: 'Side Tables',
      icon: 'table',
      type: 'supabase',
      models: [
        { name: 'Side-Table_01-330pl', displayName: 'Modern Side Table 01' },
        { name: 'Side-Table_02-1050pl', displayName: 'Classic Side Table 02' },
        { name: 'Side-Table_03-1600pl', displayName: 'Minimalist Side Table 03' },
        { name: 'Side-Table_04-1600pl', displayName: 'Contemporary Side Table 04' },
        { name: 'Side-Table_05-400pl', displayName: 'Elegant Side Table 05' },
        { name: 'Side-Table_06-2000pl', displayName: 'Wooden Side Table 06' },
        { name: 'Side-Table_07-1400pl', displayName: 'Glass Side Table 07' },
        { name: 'Side-Table_08-800pl', displayName: 'Industrial Side Table 08' },
        { name: 'Side-Table_09-4700pl', displayName: 'Vintage Side Table 09' },
        { name: 'Side-Table_10-900pl', displayName: 'Scandinavian Side Table 10' },
        { name: 'Side-Table_11-1400pl', displayName: 'Rustic Side Table 11' },
        { name: 'Side-Table_12-1300pl', displayName: 'Marble Side Table 12' },
        { name: 'Side-Table_13-800pl', displayName: 'Metal Side Table 13' },
        { name: 'Side-Table_14-4000pl', displayName: 'Round Side Table 14' },
        { name: 'Side-Table_15-2200pl', displayName: 'Square Side Table 15' },
        { name: 'Side-Table_16-2100pl', displayName: 'Oval Side Table 16' },
        { name: 'Side-Table_17-2500pl', displayName: 'Hexagon Side Table 17' },
        { name: 'Side-Table_18-1000pl', displayName: 'Luxury Side Table 18' },
        { name: 'Side-Table_19-1550pl', displayName: 'Designer Side Table 19' },
        { name: 'Side-Table_20-5400pl', displayName: 'Premium Side Table 20' }
      ]
    },
    {
      name: 'chairs',
      displayName: 'Chairs',
      icon: 'chair',
      type: 'supabase',
      models: [
        // Add actual chair models when you provide the naming pattern
      ]
    },
    {
      name: 'armchairs',
      displayName: 'Armchairs',
      icon: 'armchair',
      type: 'supabase',
      models: [
        // Add actual armchair models when you provide the naming pattern
      ]
    },
    {
      name: 'Lounge Chairs',
      displayName: 'Lounge Chairs',
      icon: 'armchair',
      type: 'supabase',
      models: [
        // Add actual lounge chair models when you provide the naming pattern
      ]
    },
    {
      name: 'sofas',
      displayName: 'Sofas',
      icon: 'sofa',
      type: 'supabase',
      models: [
        // Add actual sofa models when you provide the naming pattern
      ]
    },
    {
      name: 'tables',
      displayName: 'Tables',
      icon: 'table',
      type: 'supabase',
      models: [
        // Add actual table models when you provide the naming pattern
      ]
    },
    {
      name: 'stools',
      displayName: 'Stools',
      icon: 'stool',
      type: 'supabase',
      models: [
        // Add actual stool models when you provide the naming pattern
      ]
    },
    {
      name: 'bar stools',
      displayName: 'Bar Stools',
      icon: 'stool',
      type: 'supabase',
      models: [
        // Add actual bar stool models when you provide the naming pattern
      ]
    },
    {
      name: 'benches',
      displayName: 'Benches',
      icon: 'bench',
      type: 'supabase',
      models: [
        // Add actual bench models when you provide the naming pattern
      ]
    },
    {
      name: 'ceiling lamps',
      displayName: 'Ceiling Lamps',
      icon: 'light',
      type: 'supabase',
      models: [
        // Add actual ceiling lamp models when you provide the naming pattern
      ]
    },
    {
      name: 'floor lamps',
      displayName: 'Floor Lamps',
      icon: 'light',
      type: 'supabase',
      models: [
        // Add actual floor lamp models when you provide the naming pattern
      ]
    },
    {
      name: 'table lights',
      displayName: 'Table Lights',
      icon: 'light',
      type: 'supabase',
      models: [
        // Add actual table light models when you provide the naming pattern
      ]
    },
    {
      name: 'wall lights',
      displayName: 'Wall Lights',
      icon: 'light',
      type: 'supabase',
      models: [
        // Add actual wall light models when you provide the naming pattern
      ]
    },
    {
      name: 'artwork',
      displayName: 'Artwork',
      icon: 'art',
      type: 'supabase',
      models: [
        // Add actual artwork models when you provide the naming pattern
      ]
    },
    {
      name: 'Accessories',
      displayName: 'Accessories',
      icon: 'accessory',
      type: 'supabase',
      models: [
        // Add actual accessory models when you provide the naming pattern
      ]
    },
    {
      name: 'gym equipment',
      displayName: 'Gym Equipment',
      icon: 'gym',
      type: 'supabase',
      models: [
        // Add actual gym equipment models when you provide the naming pattern
      ]
    }
  ]
};

/**
 * Generate complete model manifest with URLs
 */
export function generateCompleteManifest() {
  const completeCategories = [];
  const completeModels = [];
  let totalModels = 0;

  for (const category of MODEL_MANIFEST.categories) {
    const categoryModels = [];

    for (const modelDef of category.models) {
      const modelId = `${category.name.toLowerCase().replace(/\s+/g, '_')}_${modelDef.name.toLowerCase()}`;
      
      const completeModel = {
        id: modelId,
        name: modelDef.name,
        displayName: modelDef.displayName,
        category: category.name,
        type: 'model',
        format: 'fbx',
        
        // File references
        thumbnail: `${modelDef.name}.jpg`,
        fbxFile: `${modelDef.name}.fbx`,
        
        // Auto-generated URLs
        thumbnailUrl: `${BASE_URL}/${encodeURIComponent(category.name)}/thumbnails/${modelDef.name}.jpg`,
        modelUrl: `${BASE_URL}/${encodeURIComponent(category.name)}/models/${modelDef.name}.fbx`,
        model_url: `${BASE_URL}/${encodeURIComponent(category.name)}/models/${modelDef.name}.fbx`,
        texturesUrl: `${BASE_URL}/${encodeURIComponent(category.name)}/textures/`,
        
        // Metadata
        file_size_mb: 'Unknown',
        polygon_count: 'Unknown', 
        has_textures: true,
        cached: false
      };
      
      categoryModels.push(completeModel);
      completeModels.push(completeModel);
      totalModels++;
    }

    completeCategories.push({
      name: category.name,
      displayName: category.displayName,
      icon: category.icon,
      type: category.type,
      model_count: categoryModels.length
    });
  }

  return {
    generated_at: new Date().toISOString(),
    bucket_name: BUCKET_NAME,
    supabase_url: SUPABASE_URL,
    base_url: BASE_URL,
    version: '1.0.0',
    categories: completeCategories,
    models: completeModels,
    stats: {
      total_categories: completeCategories.length,
      total_models: totalModels
    }
  };
}

/**
 * Validate that a model exists by checking its thumbnail
 * This is much faster than checking every potential pattern
 */
export async function validateModel(category, modelName) {
  const thumbnailUrl = `${BASE_URL}/${encodeURIComponent(category)}/thumbnails/${modelName}.jpg`;
  
  try {
    const response = await fetch(thumbnailUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Validate all models in the manifest (optional health check)
 */
export async function validateAllModels(progressCallback = null) {
  const manifest = generateCompleteManifest();
  const results = {
    total: manifest.models.length,
    valid: 0,
    invalid: 0,
    missing: []
  };

  for (let i = 0; i < manifest.models.length; i++) {
    const model = manifest.models[i];
    
    if (progressCallback) {
      progressCallback(i + 1, manifest.models.length, model.displayName);
    }
    
    const isValid = await validateModel(model.category, model.name);
    
    if (isValid) {
      results.valid++;
    } else {
      results.invalid++;
      results.missing.push({
        category: model.category,
        name: model.name,
        displayName: model.displayName
      });
    }
  }

  return results;
}

export default {
  MODEL_MANIFEST,
  generateCompleteManifest,
  validateModel,
  validateAllModels
};
