/**
 * Property Mapper Utility
 * 
 * Maps FreeCAD objects to the property panel format with:
 * - Proper property types (number, string, boolean, vector, etc.)
 * - Categories for organization
 * - Constraints (min, max, step)
 * - Units and descriptions
 */

// FreeCAD object type definitions with their properties
const OBJECT_PROPERTY_DEFINITIONS = {
  Wall: {
    Geometry: {
      length: {
        type: 'number',
        label: 'Length',
        unit: 'm',
        min: 0.1,
        max: 100,
        step: 0.1,
        description: 'Wall length in meters'
      },
      height: {
        type: 'number',
        label: 'Height', 
        unit: 'm',
        min: 0.1,
        max: 20,
        step: 0.1,
        description: 'Wall height in meters'
      },
      thickness: {
        type: 'number',
        label: 'Thickness',
        unit: 'm',
        min: 0.05,
        max: 2,
        step: 0.01,
        description: 'Wall thickness in meters'
      }
    },
    Position: {
      position: {
        type: 'position',
        label: 'Position',
        unit: 'm',
        step: 0.1,
        description: 'Wall position in 3D space (X, Y, Z)'
      },
      rotation: {
        type: 'rotation',
        label: 'Rotation',
        unit: '°',
        step: 1,
        description: 'Wall rotation angles (X, Y, Z degrees)'
      }
    },
    Material: {
      color: {
        type: 'color',
        label: 'Color',
        description: 'Wall display color'
      }
    },
    Properties: {
      type: {
        type: 'string',
        label: 'Type',
        readonly: true,
        description: 'Object type identifier'
      },
      id: {
        type: 'string',
        label: 'ID',
        readonly: true,
        description: 'Unique object identifier'
      }
    }
  },

  Slab: {
    Geometry: {
      width: {
        type: 'number',
        label: 'Width',
        unit: 'm',
        min: 0.1,
        max: 100,
        step: 0.1,
        description: 'Slab width in meters'
      },
      depth: {
        type: 'number',
        label: 'Depth',
        unit: 'm',
        min: 0.1,
        max: 100,
        step: 0.1,
        description: 'Slab depth in meters'
      },
      thickness: {
        type: 'number',
        label: 'Thickness',
        unit: 'm',
        min: 0.05,
        max: 2,
        step: 0.01,
        description: 'Slab thickness in meters'
      }
    },
    Position: {
      position: {
        type: 'position',
        label: 'Position',
        unit: 'm',
        step: 0.1,
        description: 'Slab position in 3D space (X, Y, Z)'
      },
      rotation: {
        type: 'rotation',
        label: 'Rotation',
        unit: '°',
        step: 1,
        description: 'Slab rotation angles (X, Y, Z degrees)'
      }
    },
    Material: {
      color: {
        type: 'color',
        label: 'Color',
        description: 'Slab display color'
      }
    },
    Properties: {
      type: {
        type: 'string',
        label: 'Type',
        readonly: true,
        description: 'Object type identifier'
      },
      id: {
        type: 'string',
        label: 'ID',
        readonly: true,
        description: 'Unique object identifier'
      }
    }
  },

  Column: {
    Geometry: {
      radius: {
        type: 'number',
        label: 'Radius',
        unit: 'm',
        min: 0.05,
        max: 5,
        step: 0.01,
        description: 'Column radius in meters'
      },
      height: {
        type: 'number',
        label: 'Height',
        unit: 'm',
        min: 0.1,
        max: 50,
        step: 0.1,
        description: 'Column height in meters'
      }
    },
    Position: {
      position: {
        type: 'position',
        label: 'Position',
        unit: 'm',
        step: 0.1,
        description: 'Column position in 3D space (X, Y, Z)'
      },
      rotation: {
        type: 'rotation',
        label: 'Rotation',
        unit: '°',
        step: 1,
        description: 'Column rotation angles (X, Y, Z degrees)'
      }
    },
    Material: {
      color: {
        type: 'color',
        label: 'Color',
        description: 'Column display color'
      }
    },
    Properties: {
      type: {
        type: 'string',
        label: 'Type',
        readonly: true,
        description: 'Object type identifier'
      },
      id: {
        type: 'string',
        label: 'ID',
        readonly: true,
        description: 'Unique object identifier'
      }
    }
  },

  Beam: {
    Geometry: {
      length: {
        type: 'number',
        label: 'Length',
        unit: 'm',
        min: 0.1,
        max: 100,
        step: 0.1,
        description: 'Beam length in meters'
      },
      width: {
        type: 'number',
        label: 'Width',
        unit: 'm',
        min: 0.05,
        max: 5,
        step: 0.01,
        description: 'Beam width in meters'
      },
      height: {
        type: 'number',
        label: 'Height',
        unit: 'm',
        min: 0.05,
        max: 5,
        step: 0.01,
        description: 'Beam height in meters'
      }
    },
    Position: {
      position: {
        type: 'position',
        label: 'Position',
        unit: 'm',
        step: 0.1,
        description: 'Beam position in 3D space (X, Y, Z)'
      },
      rotation: {
        type: 'rotation',
        label: 'Rotation',
        unit: '°',
        step: 1,
        description: 'Beam rotation angles (X, Y, Z degrees)'
      }
    },
    Material: {
      color: {
        type: 'color',
        label: 'Color',
        description: 'Beam display color'
      }
    },
    Properties: {
      type: {
        type: 'string',
        label: 'Type',
        readonly: true,
        description: 'Object type identifier'
      },
      id: {
        type: 'string',
        label: 'ID',
        readonly: true,
        description: 'Unique object identifier'
      }
    }
  },

  Window: {
    Geometry: {
      width: {
        type: 'number',
        label: 'Width',
        unit: 'm',
        min: 0.1,
        max: 10,
        step: 0.01,
        description: 'Window width in meters'
      },
      height: {
        type: 'number',
        label: 'Height',
        unit: 'm',
        min: 0.1,
        max: 10,
        step: 0.01,
        description: 'Window height in meters'
      },
      thickness: {
        type: 'number',
        label: 'Thickness',
        unit: 'm',
        min: 0.01,
        max: 0.5,
        step: 0.01,
        description: 'Window frame thickness'
      }
    },
    Position: {
      position: {
        type: 'position',
        label: 'Position',
        unit: 'm',
        step: 0.01,
        description: 'Window position in 3D space (X, Y, Z)'
      },
      rotation: {
        type: 'rotation',
        label: 'Rotation',
        unit: '°',
        step: 1,
        description: 'Window rotation angles (X, Y, Z degrees)'
      }
    },
    Material: {
      color: {
        type: 'color',
        label: 'Color',
        description: 'Window frame color'
      }
    },
    Properties: {
      type: {
        type: 'string',
        label: 'Type',
        readonly: true,
        description: 'Object type identifier'
      },
      id: {
        type: 'string',
        label: 'ID',
        readonly: true,
        description: 'Unique object identifier'
      }
    }
  },

  Door: {
    Geometry: {
      width: {
        type: 'number',
        label: 'Width',
        unit: 'm',
        min: 0.1,
        max: 5,
        step: 0.01,
        description: 'Door width in meters'
      },
      height: {
        type: 'number',
        label: 'Height',
        unit: 'm',
        min: 0.1,
        max: 5,
        step: 0.01,
        description: 'Door height in meters'
      },
      thickness: {
        type: 'number',
        label: 'Thickness',
        unit: 'm',
        min: 0.01,
        max: 0.2,
        step: 0.01,
        description: 'Door thickness'
      }
    },
    Position: {
      position: {
        type: 'position',
        label: 'Position',
        unit: 'm',
        step: 0.01,
        description: 'Door position in 3D space (X, Y, Z)'
      },
      rotation: {
        type: 'rotation',
        label: 'Rotation',
        unit: '°',
        step: 1,
        description: 'Door rotation angles (X, Y, Z degrees)'
      }
    },
    Material: {
      color: {
        type: 'color',
        label: 'Color',
        description: 'Door color'
      }
    },
    Properties: {
      type: {
        type: 'string',
        label: 'Type',
        readonly: true,
        description: 'Object type identifier'
      },
      id: {
        type: 'string',
        label: 'ID',
        readonly: true,
        description: 'Unique object identifier'
      }
    }
  },

  // Furniture property definitions  
  furniture: {
    Geometry: {
      width: {
        type: 'number',
        label: 'Width',
        unit: 'm',
        min: 0.1,
        max: 10,
        step: 0.1,
        description: 'Furniture width'
      },
      height: {
        type: 'number',
        label: 'Height',
        unit: 'm',
        min: 0.1,
        max: 5,
        step: 0.1,
        description: 'Furniture height'
      },
      depth: {
        type: 'number',
        label: 'Depth',
        unit: 'm',
        min: 0.1,
        max: 5,
        step: 0.1,
        description: 'Furniture depth'
      }
    },
    Position: {
      position: {
        type: 'position',
        label: 'Position',
        unit: 'm',
        step: 0.1,
        description: 'Furniture position in 3D space (X, Y, Z)'
      },
      rotation: {
        type: 'rotation',
        label: 'Rotation',
        unit: '°',
        step: 1,
        description: 'Furniture rotation angles (X, Y, Z degrees)'
      }
    },
    Model: {
      modelUrl: {
        type: 'string',
        label: 'Model URL',
        readonly: true,
        description: '3D model file URL'
      },
      format: {
        type: 'string',
        label: 'Format',
        readonly: true,
        description: '3D model format (FBX, glTF, OBJ)'
      }
    },
    Properties: {
      type: {
        type: 'string',
        label: 'Type',
        readonly: true,
        description: 'Object type identifier'
      },
      id: {
        type: 'string',
        label: 'ID',
        readonly: true,
        description: 'Unique object identifier'
      },
      name: {
        type: 'string',
        label: 'Name',
        description: 'Furniture name'
      },
      category: {
        type: 'string',
        label: 'Category',
        readonly: true,
        description: 'Furniture category'
      }
    }
  },

  // Fixture property definitions (similar to furniture)
  fixture: {
    Geometry: {
      width: {
        type: 'number',
        label: 'Width',
        unit: 'm',
        min: 0.1,
        max: 10,
        step: 0.1,
        description: 'Fixture width'
      },
      height: {
        type: 'number',
        label: 'Height',
        unit: 'm',
        min: 0.1,
        max: 5,
        step: 0.1,
        description: 'Fixture height'
      },
      depth: {
        type: 'number',
        label: 'Depth',
        unit: 'm',
        min: 0.1,
        max: 5,
        step: 0.1,
        description: 'Fixture depth'
      }
    },
    Position: {
      position: {
        type: 'position',
        label: 'Position',
        unit: 'm',
        step: 0.1,
        description: 'Fixture position in 3D space (X, Y, Z)'
      },
      rotation: {
        type: 'rotation',
        label: 'Rotation',
        unit: '°',
        step: 1,
        description: 'Fixture rotation angles (X, Y, Z degrees)'
      }
    },
    Model: {
      modelUrl: {
        type: 'string',
        label: 'Model URL',
        readonly: true,
        description: '3D model file URL'
      },
      format: {
        type: 'string',
        label: 'Format',
        readonly: true,
        description: '3D model format (FBX, glTF, OBJ)'
      }
    },
    Properties: {
      type: {
        type: 'string',
        label: 'Type',
        readonly: true,
        description: 'Object type identifier'
      },
      id: {
        type: 'string',
        label: 'ID',
        readonly: true,
        description: 'Unique object identifier'
      },
      name: {
        type: 'string',
        label: 'Name',
        description: 'Fixture name'
      },
      category: {
        type: 'string',
        label: 'Category',
        readonly: true,
        description: 'Fixture category'
      }
    }
  }
};

// Default properties for unknown object types
const DEFAULT_OBJECT_PROPERTIES = {
  Position: {
    position: {
      type: 'position',
      label: 'Position',
      unit: 'm',
      step: 0.1,
      description: 'Object position in 3D space (X, Y, Z)'
    },
    rotation: {
      type: 'rotation',
      label: 'Rotation',
      unit: '°',
      step: 1,
      description: 'Object rotation angles (X, Y, Z degrees)'
    }
  },
  Material: {
    color: {
      type: 'color',
      label: 'Color',
      description: 'Object display color'
    }
  },
  Properties: {
    type: {
      type: 'string',
      label: 'Type',
      readonly: true,
      description: 'Object type identifier'
    },
    id: {
      type: 'string',
      label: 'ID',
      readonly: true,
      description: 'Unique object identifier'
    }
  }
};

/**
 * Maps a FreeCAD object to PropertyPanel format
 * @param {Object} freecadObject - FreeCAD object from backend
 * @returns {Object} Properties formatted for PropertyPanel
 */
export function mapFreeCADObjectToProperties(freecadObject) {
  if (!freecadObject) return {};

  try {
    const objectType = freecadObject.type || 'Object';
    const propertyDefinitions = OBJECT_PROPERTY_DEFINITIONS[objectType] || DEFAULT_OBJECT_PROPERTIES;
    const mappedProperties = {};

  // Process each category of properties
  Object.entries(propertyDefinitions).forEach(([categoryName, categoryProps]) => {
    Object.entries(categoryProps).forEach(([propName, propDef]) => {
      // Get the actual value from the FreeCAD object
      let value = freecadObject[propName];
      
      // DEFENSIVE: Check if propDef exists and has required properties
      if (!propDef || typeof propDef !== 'object') {
        console.warn(`Property definition missing or invalid for ${propName}`);
        return; // Skip this property
      }
      
      // Handle special cases for value extraction
      if (propName === 'position') {
        value = freecadObject.position || { x: 0, y: 0, z: 0 };
      } else if (propName === 'rotation') {
        value = freecadObject.rotation || { x: 0, y: 0, z: 0 };
      } else if (propName === 'color') {
        value = freecadObject.color || '#64748b';
      } else if (propName === 'type') {
        value = freecadObject.type || 'Object';
      } else if (propName === 'id') {
        value = freecadObject.id || freecadObject.freecadId || 'unknown';
      }

      // Apply default value if not found or invalid
      if (value === undefined || value === null) {
        switch (propDef.type) {
          case 'number':
          case 'integer':
            value = propDef.min || 0;
            break;
          case 'boolean':
            value = false;
            break;
          case 'string':
            value = '';
            break;
          case 'color':
            value = '#64748b';
            break;
          case 'position':
          case 'rotation':
          case 'vector':
            value = { x: 0, y: 0, z: 0 };
            break;
          default:
            value = '';
        }
      }

      // Ensure number types are properly converted and valid
      if (propDef.type === 'number' || propDef.type === 'integer') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          value = propDef.min || 0;
        } else {
          value = numValue;
        }
      }

      // Create property entry
      mappedProperties[propName] = {
        value: value,
        category: categoryName,
        ...propDef
      };
    });
  });

  return mappedProperties;
  
  } catch (error) {
    console.error('Error mapping FreeCAD object to properties:', error);
    console.error('Object causing error:', freecadObject);
    // Return safe fallback properties
    return {
      id: {
        value: freecadObject?.id || 'unknown',
        category: 'Properties',
        type: 'string',
        label: 'ID',
        readonly: true
      },
      type: {
        value: freecadObject?.type || 'Object',
        category: 'Properties', 
        type: 'string',
        label: 'Type',
        readonly: true
      }
    };
  }
}

/**
 * Converts property panel changes back to FreeCAD format
 * @param {Object} propertyChanges - Changes from property panel
 * @param {Object} originalObject - Original FreeCAD object
 * @returns {Object} Updated FreeCAD object format
 */
export function mapPropertiesToFreeCADObject(propertyChanges, originalObject) {
  const updatedObject = { ...originalObject };

  Object.entries(propertyChanges).forEach(([propName, newValue]) => {
    // Handle special property mappings
    if (propName === 'position' && typeof newValue === 'object') {
      updatedObject.position = {
        x: parseFloat(newValue.x) || 0,
        y: parseFloat(newValue.y) || 0,
        z: parseFloat(newValue.z) || 0
      };
    } else if (propName === 'rotation' && typeof newValue === 'object') {
      updatedObject.rotation = {
        x: parseFloat(newValue.x) || 0,
        y: parseFloat(newValue.y) || 0,
        z: parseFloat(newValue.z) || 0
      };
    } else if (propName === 'color') {
      updatedObject.color = newValue;
    } else {
      // Direct property mapping for numeric and string values
      updatedObject[propName] = newValue;
    }
  });

  return updatedObject;
}

/**
 * Gets property definitions for a specific object type
 * @param {string} objectType - FreeCAD object type
 * @returns {Object} Property definitions
 */
export function getPropertyDefinitionsForType(objectType) {
  return OBJECT_PROPERTY_DEFINITIONS[objectType] || DEFAULT_OBJECT_PROPERTIES;
}

/**
 * Gets all available object types with their property counts
 * @returns {Object} Object types with metadata
 */
export function getAvailableObjectTypes() {
  const types = {};
  Object.keys(OBJECT_PROPERTY_DEFINITIONS).forEach(type => {
    const definitions = OBJECT_PROPERTY_DEFINITIONS[type];
    let propertyCount = 0;
    Object.values(definitions).forEach(category => {
      propertyCount += Object.keys(category).length;
    });
    
    types[type] = {
      name: type,
      propertyCount,
      categories: Object.keys(definitions)
    };
  });
  
  return types;
}

export default {
  mapFreeCADObjectToProperties,
  mapPropertiesToFreeCADObject,
  getPropertyDefinitionsForType,
  getAvailableObjectTypes
}; 