// Configuration system for architect3d
export const configWallThickness = 'wallThickness';
export const configWallHeight = 'wallHeight';
export const cornerTolerance = 20; // pixels
export const snapTolerance = 25; // cm
export const gridSpacing = 20; // pixels

// Default configuration values
const defaultConfig = {
  [configWallThickness]: 20, // cm
  [configWallHeight]: 270, // cm
};

export const Configuration = {
  getNumericValue: (key) => {
    return defaultConfig[key] || 0;
  },
  
  setValue: (key, value) => {
    defaultConfig[key] = value;
  },
  
  getValue: (key) => {
    return defaultConfig[key];
  }
};