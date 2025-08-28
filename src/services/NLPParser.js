/**
 * NLPParser - Advanced Natural Language Processing for CAD Commands
 * 
 * Intelligently parses user requests and extracts:
 * - Intent (what they want to do)
 * - Entities (objects, dimensions, materials, etc.)
 * - Context (spatial relationships, requirements)
 * - Constraints (limitations, preferences)
 */

class NLPParser {
  constructor() {
    this.intents = {
      CREATE: ['create', 'build', 'make', 'add', 'construct', 'design', 'generate'],
      MODIFY: ['edit', 'change', 'update', 'modify', 'adjust', 'alter', 'move'],
      DELETE: ['remove', 'delete', 'destroy', 'clear', 'eliminate'],
      ANALYZE: ['analyze', 'check', 'inspect', 'review', 'examine', 'evaluate'],
      CONNECT: ['connect', 'join', 'attach', 'link', 'merge', 'combine'],
      
      // Furniture-specific transformation intents
      RESIZE: ['resize', 'scale', 'size', 'bigger', 'smaller', 'larger', 'expand', 'shrink'],
      REPOSITION: ['move', 'position', 'place', 'relocate', 'shift', 'drag', 'transport'],
      ROTATE: ['rotate', 'turn', 'spin', 'orient', 'face', 'angle', 'twist'],
      TRANSFORM: ['transform', 'manipulate', 'adjust']
    };

    this.entities = {
      STRUCTURES: {
        room: ['room', 'space', 'area', 'chamber'],
        building: ['building', 'house', 'structure', 'facility'],
        floor: ['floor', 'level', 'story', 'storey'],
        wall: ['wall', 'partition', 'barrier'],
        door: ['door', 'entrance', 'doorway', 'portal'],
        window: ['window', 'opening', 'fenestration'],
        slab: ['slab', 'floor slab', 'foundation', 'base'],
        column: ['column', 'pillar', 'post', 'support'],
        beam: ['beam', 'joist', 'lintel', 'girder'],
        roof: ['roof', 'ceiling', 'canopy', 'cover'],
        stair: ['stair', 'staircase', 'steps', 'stairway']
      },
      FURNITURE: {
        chair: ['chair', 'seat', 'armchair', 'recliner', 'stool'],
        table: ['table', 'desk', 'surface', 'workstation', 'counter'],
        sofa: ['sofa', 'couch', 'loveseat', 'sectional', 'settee'],
        bed: ['bed', 'mattress', 'cot', 'bunk'],
        cabinet: ['cabinet', 'cupboard', 'wardrobe', 'closet', 'dresser'],
        shelf: ['shelf', 'bookshelf', 'shelving', 'rack'],
        lamp: ['lamp', 'light', 'fixture', 'sconce'],
        furniture: ['furniture', 'furnishing', 'fixture', 'object', 'item', 'piece']
      },
      ROOM_TYPES: {
        bedroom: ['bedroom', 'bed room', 'sleeping room'],
        kitchen: ['kitchen', 'cooking area', 'galley'],
        bathroom: ['bathroom', 'restroom', 'washroom', 'toilet'],
        living: ['living room', 'lounge', 'sitting room', 'family room'],
        office: ['office', 'study', 'workspace', 'den'],
        dining: ['dining room', 'eating area'],
        garage: ['garage', 'carport', 'parking'],
        basement: ['basement', 'cellar', 'underground'],
        attic: ['attic', 'loft', 'upper level']
      },
      MATERIALS: {
        concrete: ['concrete', 'cement'],
        wood: ['wood', 'timber', 'lumber'],
        steel: ['steel', 'metal', 'iron'],
        brick: ['brick', 'masonry'],
        glass: ['glass', 'glazing'],
        stone: ['stone', 'rock', 'granite', 'marble']
      },
      DIMENSIONS: {
        patterns: [
          /(\d+(?:\.\d+)?)\s*(?:m|meter|metre|meters|metres)?\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(?:m|meter|metre|meters|metres)?/i,
          /(\d+(?:\.\d+)?)\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)/i,
          /(\d+(?:\.\d+)?)\s*(?:m|meter|metre|meters|metres)\s*(?:wide|long|deep|high|tall)/i
        ]
      },
      QUANTITIES: {
        patterns: [
          /(\d+)\s*(?:piece|pieces|unit|units|item|items)?/i,
          /(one|two|three|four|five|six|seven|eight|nine|ten|a|an)/i
        ],
        numbers: {
          'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
          'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
          'a': 1, 'an': 1
        }
      },
      SPATIAL: {
        positions: ['center', 'middle', 'left', 'right', 'front', 'back', 'top', 'bottom', 'corner'],
        directions: ['north', 'south', 'east', 'west', 'up', 'down'],
        relationships: ['next to', 'beside', 'opposite', 'parallel', 'perpendicular', 'adjacent', 'connecting']
      },
      TRANSFORMATIONS: {
        scale_factors: {
          patterns: [
            /(\d+(?:\.\d+)?)\s*(?:times|x|×|percent|%)/i,
            /(double|triple|quadruple|half|quarter)/i,
            /(twice|three times|four times)/i
          ],
          multipliers: {
            'double': 2, 'triple': 3, 'quadruple': 4,
            'twice': 2, 'three times': 3, 'four times': 4,
            'half': 0.5, 'quarter': 0.25
          }
        },
        directions: ['up', 'down', 'left', 'right', 'forward', 'backward', 'closer', 'further'],
        axes: ['x', 'y', 'z', 'width', 'height', 'depth', 'length'],
        rotations: {
          patterns: [
            /(\d+)\s*(?:degrees?|deg|°)/i,
            /(clockwise|counterclockwise|anticlockwise)/i,
            /(quarter turn|half turn|full turn)/i
          ],
          angles: {
            'quarter turn': 90, 'half turn': 180, 'full turn': 360,
            'clockwise': 90, 'counterclockwise': -90, 'anticlockwise': -90
          }
        }
      }
    };

    this.modifiers = {
      size: ['large', 'big', 'huge', 'small', 'tiny', 'medium', 'standard'],
      style: ['modern', 'traditional', 'contemporary', 'classic', 'minimalist'],
      quality: ['high', 'premium', 'standard', 'basic', 'professional']
    };
  }

  /**
   * Main parsing method - analyzes full user input
   */
  parse(userInput) {
    const normalizedInput = userInput.toLowerCase().trim();
    
    console.log('🧠 NLP: Parsing user input:', userInput);
    
    const analysis = {
      originalInput: userInput,
      normalizedInput: normalizedInput,
      intent: this.extractIntent(normalizedInput),
      entities: this.extractEntities(normalizedInput),
      dimensions: this.extractDimensions(normalizedInput),
      quantities: this.extractQuantities(normalizedInput),
      materials: this.extractMaterials(normalizedInput),
      spatial: this.extractSpatialInfo(normalizedInput),
      modifiers: this.extractModifiers(normalizedInput),
      transformations: this.extractTransformations(normalizedInput),
      complexity: this.assessComplexity(normalizedInput),
      confidence: 0
    };

    // Calculate confidence score
    analysis.confidence = this.calculateConfidence(analysis);
    
    console.log('🧠 NLP: Analysis result:', analysis);
    
    return analysis;
  }

  /**
   * Extract primary intent from user input
   */
  extractIntent(input) {
    for (const [intent, keywords] of Object.entries(this.intents)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          return {
            primary: intent,
            keyword: keyword,
            confidence: this.calculateKeywordConfidence(input, keyword)
          };
        }
      }
    }
    
    return { primary: 'CREATE', keyword: 'implied', confidence: 0.5 }; // Default intent
  }

  /**
   * Extract entities (objects to be created/modified)
   */
  extractEntities(input) {
    const found = [];
    
    // Check structures
    for (const [type, variations] of Object.entries(this.entities.STRUCTURES)) {
      for (const variation of variations) {
        if (input.includes(variation)) {
          found.push({
            category: 'STRUCTURE',
            type: type,
            matched: variation,
            confidence: this.calculateKeywordConfidence(input, variation)
          });
        }
      }
    }

    // Check room types
    for (const [type, variations] of Object.entries(this.entities.ROOM_TYPES)) {
      for (const variation of variations) {
        if (input.includes(variation)) {
          found.push({
            category: 'ROOM_TYPE',
            type: type,
            matched: variation,
            confidence: this.calculateKeywordConfidence(input, variation)
          });
        }
      }
    }

    return found.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Extract dimensional information
   */
  extractDimensions(input) {
    const dimensions = [];
    
    for (const pattern of this.entities.DIMENSIONS.patterns) {
      const matches = input.match(pattern);
      if (matches) {
        if (matches[3]) {
          // 3D dimensions (length x width x height)
          dimensions.push({
            type: '3D',
            length: parseFloat(matches[1]),
            width: parseFloat(matches[2]),
            height: parseFloat(matches[3]),
            unit: 'm'
          });
        } else if (matches[2]) {
          // 2D dimensions (length x width)
          dimensions.push({
            type: '2D',
            length: parseFloat(matches[1]),
            width: parseFloat(matches[2]),
            unit: 'm'
          });
        } else {
          // Single dimension
          dimensions.push({
            type: '1D',
            value: parseFloat(matches[1]),
            unit: 'm'
          });
        }
      }
    }

    return dimensions;
  }

  /**
   * Extract quantity information
   */
  extractQuantities(input) {
    const quantities = [];
    
    // First, remove dimensional information to avoid conflicts
    // Remove patterns like "6m", "3.5 meters", "6m by 8m", etc.
    let cleanInput = input.replace(/\d+(?:\.\d+)?\s*(?:m|meter|metre|meters|metres)\s*(?:by|x|×)\s*\d+(?:\.\d+)?\s*(?:m|meter|metre|meters|metres)?/gi, '');
    cleanInput = cleanInput.replace(/\d+(?:\.\d+)?\s*(?:m|meter|metre|meters|metres)/gi, '');
    
    // Check for numeric quantities in the cleaned input
    for (const pattern of this.entities.QUANTITIES.patterns) {
      const matches = cleanInput.match(pattern);
      if (matches) {
        let value = parseInt(matches[1]);
        if (isNaN(value)) {
          // Check word numbers
          value = this.entities.QUANTITIES.numbers[matches[1].toLowerCase()] || 1;
        }
        quantities.push({
          value: value,
          matched: matches[1]
        });
      }
    }

    return quantities.length > 0 ? quantities[0] : { value: 1, matched: 'implied' };
  }

  /**
   * Extract material information
   */
  extractMaterials(input) {
    const materials = [];
    
    for (const [material, variations] of Object.entries(this.entities.MATERIALS)) {
      for (const variation of variations) {
        if (input.includes(variation)) {
          materials.push({
            type: material,
            matched: variation,
            confidence: this.calculateKeywordConfidence(input, variation)
          });
        }
      }
    }

    return materials.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Extract spatial relationship information
   */
  extractSpatialInfo(input) {
    const spatial = {
      positions: [],
      directions: [],
      relationships: []
    };

    // Check positions
    for (const position of this.entities.SPATIAL.positions) {
      if (input.includes(position)) {
        spatial.positions.push(position);
      }
    }

    // Check directions
    for (const direction of this.entities.SPATIAL.directions) {
      if (input.includes(direction)) {
        spatial.directions.push(direction);
      }
    }

    // Check relationships
    for (const relationship of this.entities.SPATIAL.relationships) {
      if (input.includes(relationship)) {
        spatial.relationships.push(relationship);
      }
    }

    return spatial;
  }

  /**
   * Extract modifier information (adjectives, styles, etc.)
   */
  extractModifiers(input) {
    const modifiers = {};

    for (const [category, words] of Object.entries(this.modifiers)) {
      modifiers[category] = [];
      for (const word of words) {
        if (input.includes(word)) {
          modifiers[category].push(word);
        }
      }
    }

    return modifiers;
  }

  /**
   * Extract transformation parameters (scale, rotation, position)
   */
  extractTransformations(input) {
    const transformations = {
      scale: this.extractScaleFactors(input),
      rotation: this.extractRotation(input),
      position: this.extractPositionChanges(input),
      axes: this.extractTargetAxes(input)
    };

    return transformations;
  }

  /**
   * Extract scale factors from input
   */
  extractScaleFactors(input) {
    const scales = [];
    
    // Check for numeric scale factors
    for (const pattern of this.entities.TRANSFORMATIONS.scale_factors.patterns) {
      const match = input.match(pattern);
      if (match) {
        if (match[1] && !isNaN(match[1])) {
          scales.push({
            type: 'numeric',
            factor: parseFloat(match[1]),
            unit: match[2] || 'times'
          });
        } else if (match[1]) {
          const multiplier = this.entities.TRANSFORMATIONS.scale_factors.multipliers[match[1].toLowerCase()];
          if (multiplier) {
            scales.push({
              type: 'named',
              factor: multiplier,
              name: match[1].toLowerCase()
            });
          }
        }
      }
    }

    // Check for relative size descriptions
    const sizeModifiers = ['bigger', 'smaller', 'larger', 'huge', 'tiny'];
    for (const modifier of sizeModifiers) {
      if (input.includes(modifier)) {
        const factor = this.getSizeModifierFactor(modifier);
        scales.push({
          type: 'relative',
          factor: factor,
          description: modifier
        });
      }
    }

    return scales;
  }

  /**
   * Extract rotation information
   */
  extractRotation(input) {
    const rotations = [];
    
    // Check for degree values
    for (const pattern of this.entities.TRANSFORMATIONS.rotations.patterns) {
      const match = input.match(pattern);
      if (match) {
        if (match[1] && !isNaN(match[1])) {
          rotations.push({
            type: 'degrees',
            angle: parseFloat(match[1]),
            unit: 'degrees'
          });
        } else if (match[1]) {
          const angle = this.entities.TRANSFORMATIONS.rotations.angles[match[1].toLowerCase()];
          if (angle !== undefined) {
            rotations.push({
              type: 'named',
              angle: angle,
              description: match[1].toLowerCase()
            });
          }
        }
      }
    }

    return rotations;
  }

  /**
   * Extract position change information
   */
  extractPositionChanges(input) {
    const positions = [];
    
    // Check for directional movements
    const directions = this.entities.TRANSFORMATIONS.directions;
    for (const direction of directions) {
      if (input.includes(direction)) {
        positions.push({
          direction: direction,
          type: 'relative'
        });
      }
    }

    // Check for specific coordinates
    const coordinatePattern = /(?:x|y|z)?\s*[:=]?\s*(\d+(?:\.\d+)?)/gi;
    const coordinateMatches = input.matchAll(coordinatePattern);
    for (const match of coordinateMatches) {
      positions.push({
        type: 'coordinate',
        value: parseFloat(match[1]),
        axis: match[0].charAt(0).toLowerCase()
      });
    }

    return positions;
  }

  /**
   * Extract target axes for transformations
   */
  extractTargetAxes(input) {
    const axes = [];
    const targetAxes = this.entities.TRANSFORMATIONS.axes;
    
    for (const axis of targetAxes) {
      if (input.includes(axis)) {
        axes.push(axis);
      }
    }

    return axes;
  }

  /**
   * Get scale factor for relative size modifiers
   */
  getSizeModifierFactor(modifier) {
    const factors = {
      'bigger': 1.5,
      'larger': 1.5,
      'huge': 2.0,
      'small': 0.7,
      'smaller': 0.7,
      'tiny': 0.5
    };
    
    return factors[modifier] || 1.0;
  }

  /**
   * Assess complexity of the request
   */
  assessComplexity(input) {
    let score = 0;
    
    // Base complexity from length
    score += Math.min(input.length / 50, 2);
    
    // Multiple entities increase complexity
    const entityCount = (input.match(/\b(room|wall|door|window|building|floor)\b/g) || []).length;
    score += entityCount * 0.5;
    
    // Spatial relationships increase complexity
    if (input.includes('next to') || input.includes('opposite') || input.includes('connecting')) {
      score += 1;
    }
    
    // Multiple dimensions increase complexity
    const dimensionMatches = (input.match(/\d+/g) || []).length;
    score += Math.min(dimensionMatches * 0.3, 2);
    
    if (score <= 2) return 'SIMPLE';
    if (score <= 4) return 'MODERATE';
    if (score <= 6) return 'COMPLEX';
    return 'VERY_COMPLEX';
  }

  /**
   * Calculate confidence score for keyword matching
   */
  calculateKeywordConfidence(input, keyword) {
    const position = input.indexOf(keyword);
    const inputLength = input.length;
    const keywordLength = keyword.length;
    
    // Higher confidence for longer keywords and earlier positions
    let confidence = (keywordLength / inputLength) + (1 - position / inputLength);
    return Math.min(confidence, 1);
  }

  /**
   * Calculate overall confidence in the analysis
   */
  calculateConfidence(analysis) {
    let confidence = 0;
    let factors = 0;

    // Intent confidence
    if (analysis.intent.confidence > 0) {
      confidence += analysis.intent.confidence;
      factors++;
    }

    // Entity confidence
    if (analysis.entities.length > 0) {
      const avgEntityConfidence = analysis.entities.reduce((sum, e) => sum + e.confidence, 0) / analysis.entities.length;
      confidence += avgEntityConfidence;
      factors++;
    }

    // Dimension confidence
    if (analysis.dimensions.length > 0) {
      confidence += 0.8; // High confidence if dimensions found
      factors++;
    }

    // Material confidence
    if (analysis.materials.length > 0) {
      const avgMaterialConfidence = analysis.materials.reduce((sum, m) => sum + m.confidence, 0) / analysis.materials.length;
      confidence += avgMaterialConfidence;
      factors++;
    }

    return factors > 0 ? confidence / factors : 0.3;
  }

  /**
   * Get suggested clarifications if confidence is low
   */
  getSuggestions(analysis) {
    const suggestions = [];

    if (analysis.confidence < 0.6) {
      if (analysis.entities.length === 0) {
        suggestions.push("Could you specify what you'd like to create? (e.g., room, wall, building)");
      }
      
      if (analysis.dimensions.length === 0) {
        suggestions.push("What dimensions would you like? (e.g., 3m by 5m)");
      }
      
      if (analysis.intent.confidence < 0.5) {
        suggestions.push("Would you like to create, modify, or analyze something?");
      }
    }

    return suggestions;
  }
}

export default NLPParser;