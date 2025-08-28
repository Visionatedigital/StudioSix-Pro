/**
 * 2D CAD Library Service
 * Manages 2D SVG CAD blocks from the public/2D CAD library directory
 */

class CAD2DLibraryService {
  constructor() {
    this.basePath = '/2D CAD library';
    this.cache = null;
    this.categories = null;
  }

  /**
   * Get all available categories in the 2D CAD library
   */
  async getCategories() {
    if (this.categories) {
      return this.categories;
    }

    try {
      // Manually defined categories based on the directory structure
      this.categories = [
        {
          name: 'Bathroom',
          displayName: 'Bathroom',
          icon: '🚿',
          subcategories: ['Bathtub', 'Handwash Basin', 'Toilets']
        },
        {
          name: 'Furniture',
          displayName: 'Furniture',
          icon: '🛏️',
          subcategories: ['Bed', 'Carpets', 'Chair', 'Closet', 'Dining', 'Sofa']
        },
        {
          name: 'Kitchen',
          displayName: 'Kitchen',
          icon: '🍳',
          subcategories: ['Cooktops', 'Kitchen Counter', 'Refridgerator', 'Sinks']
        },
        {
          name: 'Lighting',
          displayName: 'Lighting',
          icon: '💡',
          subcategories: ['Floor Lamps', 'Outdoor lighting']
        },
        {
          name: 'Plants',
          displayName: 'Plants',
          icon: '🌿',
          subcategories: ['Flowers', 'Trees']
        }
      ];

      return this.categories;
    } catch (error) {
      console.error('Failed to get categories:', error);
      return [];
    }
  }

  /**
   * Get all SVG files in a specific category/subcategory
   */
  async getCategorySVGs(category, subcategory = null) {
    try {
      const svgFiles = [];
      let basePath = `${this.basePath}/${category}`;
      
      if (subcategory) {
        basePath += `/${subcategory}`;
      }

      // Based on the directory structure, generate file paths
      const fileMap = {
        'Bathroom/Bathtub': [
          'Bathtub 2-01.svg', 'Bathtub 2-02.svg', 'Bathtub 2-03.svg', 'Bathtub 2-04.svg',
          'Bathtub 2-05.svg', 'Bathtub 2-06.svg', 'Bathtub 2-07.svg', 'Bathtub-01.svg',
          'Bathtub-02.svg', 'Bathtub-03.svg', 'Bathtub-04.svg'
        ],
        'Bathroom/Handwash Basin': [
          'handwash basin-01.svg', 'handwash basin-02.svg', 'handwash basin-03.svg', 'handwash basin-04.svg'
        ],
        'Bathroom/Toilets': [
          'Toilets-01.svg', 'Toilets-02.svg', 'Toilets-03.svg'
        ],
        'Furniture/Bed': [
          'Bed Option 2-01.svg', 'Bed Option 2-02.svg', 'Bed Option 2-03.svg', 'Bed Option 2-04.svg',
          'Bed-01.svg', 'Bed-02.svg', 'Bed-03.svg', 'Bed-04.svg', 'Bed-05.svg', 'Bed-06.svg'
        ],
        'Furniture/Carpets': [
          'Carpets-01.svg', 'Carpets-02.svg', 'Carpets-03.svg', 'Carpets-04.svg', 'Carpets-05.svg'
        ],
        'Furniture/Chair': [
          'Chair -01.svg', 'Chair -02.svg', 'Chair -03.svg', 'Chair -04.svg', 'Chair -05.svg',
          'Chair -06.svg', 'Chair .svg', 'Office Chair 2.svg', 'Office Chair.svg',
          'chair2-01.svg', 'chair2-02.svg', 'chair2-03.svg', 'chair2-04.svg', 'chair2-05.svg',
          'chair2-06.svg', 'chair2-07.svg', 'chair2-08.svg', 'chair2-09.svg', 'chair2-10.svg',
          'chair2-11.svg', 'chair2-12.svg', 'chair2-13.svg'
        ],
        'Furniture/Closet': [
          'Closet-01.svg', 'Closet-02.svg', 'Closet-03.svg', 'Closet-04.svg'
        ],
        'Furniture/Dining': [
          'Dining 2-01.svg', 'Dining 2-02.svg', 'Dining 2-03.svg', 'Dining 2-04.svg',
          'Dining 2-05.svg', 'Dining 2-06.svg', 'Dining-01.svg', 'Dining-02.svg',
          'Dining-03.svg', 'Dining-04.svg', 'Dining-05.svg'
        ],
        'Furniture/Sofa': [
          'Sofa-01.svg', 'Sofa-02.svg', 'Sofa-03.svg', 'Sofa-04.svg', 'Sofa-05.svg',
          'Sofa-06.svg', 'Sofa-07.svg', 'Sofa-08.svg', 'Sofa-09.svg', 'Sofa-10.svg',
          'Sofa-11.svg', 'sofas 2-01.svg', 'sofas 2-02.svg', 'sofas 2-03.svg',
          'sofas 2-04.svg', 'sofas 2-05.svg', 'sofas 2-06.svg', 'sofas 2-07.svg',
          'sofas 2-08.svg', 'sofas 2-09.svg', 'sofas 2-10.svg', 'sofas 2-11.svg',
          'sofas 2-12.svg', 'sofas 2-13.svg'
        ],
        'Kitchen/Cooktops': [
          'Cooktops-01.svg', 'Cooktops-02.svg', 'Cooktops-03.svg'
        ],
        'Kitchen/Kitchen Counter': [
          'Kitchen counters-01.svg', 'Kitchen counters-02.svg', 'Kitchen counters-03.svg'
        ],
        'Kitchen/Refridgerator': [
          'Refridgerator-01.svg', 'Refridgerator-02.svg', 'Refridgerator-03.svg',
          'Refridgerator-04.svg', 'Refridgerator-05.svg'
        ],
        'Kitchen/Sinks': [
          'sink-01.svg', 'sink-02.svg'
        ],
        'Lighting/Floor Lamps': [
          'Lights.svg'
        ],
        'Plants/Flowers': [
          'flower plants-01.svg', 'flower plants-02.svg', 'flower plants-03.svg',
          'flower plants-04.svg', 'flower plants-05.svg', 'flower plants-06.svg',
          'flower plants-07.svg'
        ]
      };

      const key = subcategory ? `${category}/${subcategory}` : category;
      const files = fileMap[key] || [];

      return files.map(fileName => ({
        id: `${key}/${fileName}`.replace(/[^a-zA-Z0-9]/g, '_'),
        name: fileName.replace('.svg', ''),
        fileName: fileName,
        category: category,
        subcategory: subcategory,
        path: `${basePath}/${fileName}`,
        fullPath: `${basePath}/${fileName}`,
        type: '2d-cad-block'
      }));

    } catch (error) {
      console.error(`Failed to get SVGs for ${category}/${subcategory}:`, error);
      return [];
    }
  }

  /**
   * Get all SVG files from all categories
   */
  async getAllSVGs() {
    const categories = await this.getCategories();
    const allSvgs = [];

    for (const category of categories) {
      for (const subcategory of category.subcategories) {
        const svgs = await this.getCategorySVGs(category.name, subcategory);
        allSvgs.push(...svgs);
      }
    }

    return allSvgs;
  }

  /**
   * Search SVG files by name
   */
  async searchSVGs(searchTerm) {
    const allSvgs = await this.getAllSVGs();
    const searchLower = searchTerm.toLowerCase();
    
    return allSvgs.filter(svg => 
      svg.name.toLowerCase().includes(searchLower) ||
      svg.category.toLowerCase().includes(searchLower) ||
      (svg.subcategory && svg.subcategory.toLowerCase().includes(searchLower))
    );
  }

  /**
   * Load SVG content
   */
  async loadSVGContent(svgPath) {
    try {
      const response = await fetch(encodeURI(svgPath));
      if (!response.ok) {
        throw new Error(`Failed to load SVG: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      console.error('Failed to load SVG content:', error);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = null;
    this.categories = null;
  }
}

const cad2DLibraryService = new CAD2DLibraryService();
export default cad2DLibraryService;