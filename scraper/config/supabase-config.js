const config = {
  // Supabase connection settings
  connection: {
    url: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'your-anon-key',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
  },

  // Storage bucket configuration
  storage: {
    bucketName: 'models',
    maxFileSize: 52428800, // 50MB in bytes
    allowedMimeTypes: [
      'application/octet-stream', // .obj files
      'text/plain',               // .mtl files
      'application/zip',          // .zip files
      'image/jpeg',              // .jpg thumbnails
      'image/png',               // .png thumbnails
      'image/webp',              // .webp thumbnails
      'application/json'         // metadata files
    ]
  },

  // File organization structure
  folders: {
    models: 'models',
    thumbnails: 'thumbnails', 
    metadata: 'metadata',
    categories: {
      // Furniture - Detailed categorization
      furniture: {
        interior: {
          // Living Room
          sofas: 'furniture/interior/sofas',
          chairs: 'furniture/interior/chairs',
          armchairs: 'furniture/interior/armchairs',
          recliners: 'furniture/interior/recliners',
          ottomans: 'furniture/interior/ottomans',
          coffee_tables: 'furniture/interior/coffee-tables',
          side_tables: 'furniture/interior/side-tables',
          tv_stands: 'furniture/interior/tv-stands',
          entertainment_centers: 'furniture/interior/entertainment-centers',
          bookcases: 'furniture/interior/bookcases',
          shelving: 'furniture/interior/shelving',
          
          // Bedroom
          beds: 'furniture/interior/beds',
          mattresses: 'furniture/interior/mattresses',
          nightstands: 'furniture/interior/nightstands',
          dressers: 'furniture/interior/dressers',
          wardrobes: 'furniture/interior/wardrobes',
          vanities: 'furniture/interior/vanities',
          
          // Kitchen & Dining
          dining_tables: 'furniture/interior/dining-tables',
          dining_chairs: 'furniture/interior/dining-chairs',
          bar_stools: 'furniture/interior/bar-stools',
          kitchen_islands: 'furniture/interior/kitchen-islands',
          cabinets: 'furniture/interior/cabinets',
          pantries: 'furniture/interior/pantries',
          
          // Office & Study
          desks: 'furniture/interior/desks',
          office_chairs: 'furniture/interior/office-chairs',
          filing_cabinets: 'furniture/interior/filing-cabinets',
          computer_desks: 'furniture/interior/computer-desks',
          study_tables: 'furniture/interior/study-tables',
          
          // Storage & Organization
          storage_units: 'furniture/interior/storage-units',
          closets: 'furniture/interior/closets',
          chests: 'furniture/interior/chests',
          trunks: 'furniture/interior/trunks',
          lockers: 'furniture/interior/lockers',
          
          // Miscellaneous Interior
          mirrors: 'furniture/interior/mirrors',
          room_dividers: 'furniture/interior/room-dividers',
          decorative: 'furniture/interior/decorative',
          lighting_furniture: 'furniture/interior/lighting-furniture'
        },
        
        exterior: {
          // Outdoor Living
          patio_sets: 'furniture/exterior/patio-sets',
          outdoor_dining: 'furniture/exterior/outdoor-dining',
          lounge_chairs: 'furniture/exterior/lounge-chairs',
          outdoor_sofas: 'furniture/exterior/outdoor-sofas',
          umbrellas: 'furniture/exterior/umbrellas',
          gazebos: 'furniture/exterior/gazebos',
          pergolas: 'furniture/exterior/pergolas',
          
          // Garden & Landscape
          benches: 'furniture/exterior/benches',
          planters: 'furniture/exterior/planters',
          garden_furniture: 'furniture/exterior/garden-furniture',
          outdoor_storage: 'furniture/exterior/outdoor-storage',
          
          // Recreation
          playground_equipment: 'furniture/exterior/playground-equipment',
          sports_furniture: 'furniture/exterior/sports-furniture',
          pool_furniture: 'furniture/exterior/pool-furniture'
        }
      },
      
      // Other main categories
      vehicles: {
        cars: 'vehicles/cars',
        trucks: 'vehicles/trucks',
        motorcycles: 'vehicles/motorcycles',
        aircraft: 'vehicles/aircraft',
        boats: 'vehicles/boats',
        trains: 'vehicles/trains',
        bicycles: 'vehicles/bicycles',
        construction: 'vehicles/construction',
        emergency: 'vehicles/emergency',
        military: 'vehicles/military'
      },
      
      architecture: {
        buildings: 'architecture/buildings',
        houses: 'architecture/houses',
        commercial: 'architecture/commercial',
        industrial: 'architecture/industrial',
        bridges: 'architecture/bridges',
        monuments: 'architecture/monuments',
        interiors: 'architecture/interiors',
        structural_elements: 'architecture/structural-elements'
      },
      
      characters: {
        humans: 'characters/humans',
        animals: 'characters/animals',
        fantasy: 'characters/fantasy',
        robots: 'characters/robots',
        cartoon: 'characters/cartoon'
      },
      
      nature: {
        trees: 'nature/trees',
        plants: 'nature/plants',
        flowers: 'nature/flowers',
        landscapes: 'nature/landscapes',
        rocks: 'nature/rocks',
        water: 'nature/water'
      },
      
      electronics: {
        computers: 'electronics/computers',
        phones: 'electronics/phones',
        appliances: 'electronics/appliances',
        audio: 'electronics/audio',
        gaming: 'electronics/gaming',
        industrial: 'electronics/industrial'
      },
      
      weapons: 'weapons',
      sports: 'sports',
      abstract: 'abstract',
      other: 'other'
    }
  },

  // Access policies configuration
  policies: {
    // Public read access for thumbnails and model previews
    publicRead: {
      bucketName: 'models',
      policies: [
        {
          name: 'Public read access for thumbnails',
          definition: 'thumbnails/*',
          action: 'SELECT'
        },
        {
          name: 'Public read access for metadata',
          definition: 'metadata/*',
          action: 'SELECT'
        }
      ]
    },
    
    // Authenticated access for full model downloads
    authenticatedRead: {
      bucketName: 'models',
      policies: [
        {
          name: 'Authenticated read access for models',
          definition: 'models/*',
          action: 'SELECT',
          roles: ['authenticated']
        }
      ]
    },

    // Service role for uploads (backend only)
    serviceWrite: {
      bucketName: 'models',
      policies: [
        {
          name: 'Service role upload access',
          definition: '*',
          action: 'INSERT',
          roles: ['service_role']
        },
        {
          name: 'Service role update access', 
          definition: '*',
          action: 'UPDATE',
          roles: ['service_role']
        },
        {
          name: 'Service role delete access',
          definition: '*', 
          action: 'DELETE',
          roles: ['service_role']
        }
      ]
    }
  },

  // URL generation settings
  urls: {
    // Signed URL expiration times
    signedUrlExpiry: {
      thumbnail: 3600,        // 1 hour for thumbnails
      model: 3600 * 24,       // 24 hours for model files
      metadata: 3600 * 12     // 12 hours for metadata
    },
    
    // Public URL settings
    publicUrls: {
      enabled: true,
      cacheTtl: 3600 * 24 * 7 // 1 week cache for public URLs
    }
  },

  // Upload settings
  upload: {
    retryAttempts: 3,
    retryDelay: 1000,        // 1 second
    chunkSize: 1024 * 1024,  // 1MB chunks for large files
    concurrentUploads: 3,
    
    // File naming
    naming: {
      includeTimestamp: true,
      includeHash: true,
      maxLength: 255
    }
  },

  // Development/testing settings
  development: {
    enableLogging: true,
    testBucket: 'models-test',
    mockUploads: false
  }
};

module.exports = config; 