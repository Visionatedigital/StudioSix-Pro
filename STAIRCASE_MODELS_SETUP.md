# Staircase Models Setup

## 📁 Directory Structure

```
public/
├── models/
│   └── staircases/
│       ├── staircases-manifest.json    # Model catalog
│       ├── *.fbx                       # 3D model files
│       └── [existing concrete stairs]   # 4 concrete models already present
└── thumbnails/
    └── staircases/
        └── *.jpg                       # Thumbnail images
```

## 🏗️ Available Models

### **Ready to Use (with .fbx files):**
1. **Concrete Stair Type 1** - `Concrete Stair1_fbx.fbx`
2. **Concrete Stair Type 2** - `Concrete Stair2_fbx.fbx` 
3. **Concrete Stair Type 3** - `Concrete Stair_3_fbx.fbx`
4. **Concrete Stair Type 4** - `Concrete Stair_4_fbx.fbx`

### **Template Models (placeholders ready for your .fbx files):**
1. **Basic Straight Staircase** - `straight-stair-basic.fbx`
2. **Modern L-Shaped Staircase** - `l-shaped-stair-modern.fbx`
3. **Metal Spiral Staircase** - `spiral-stair-metal.fbx`
4. **Floating Glass Staircase** - `floating-stair-glass.fbx`
5. **Traditional U-Shaped Staircase** - `u-shaped-stair-traditional.fbx`

## 🎨 How to Add Models

### **1. Add 3D Model Files**
- Place your `.fbx` files in `public/models/staircases/`
- Use descriptive filenames like `modern-steel-stair.fbx`

### **2. Add Thumbnail Images**
- Place corresponding `.jpg` files in `public/thumbnails/staircases/`
- Use same name as model: `modern-steel-stair.jpg`
- Recommended size: 400x400px or higher
- Show clear view of the staircase design

### **3. Update Manifest**
- Edit `public/models/staircases/staircases-manifest.json`
- Add new model entry with:
  - Unique `id`
  - Descriptive `name` and `description`
  - Correct `type` (straight, L-shaped, U-shaped, spiral, curved)
  - Material info (`wood`, `concrete`, `steel`, `glass`)
  - Category (`basic`, `modern`, `luxury`, `compact`, `traditional`)
  - Dimensions object
  - File references

## 🛠️ StairTool Features

### **Model Selection Interface:**
- ✅ Grid view with thumbnails
- ✅ Category filtering (All, Basic, Modern, Luxury, etc.)
- ✅ Model details panel
- ✅ Click to select, click to place workflow

### **Supported Categories:**
- **Basic** - Simple, functional designs
- **Modern** - Contemporary styles
- **Luxury** - High-end, premium designs  
- **Compact** - Space-saving solutions
- **Traditional** - Classic, timeless styles

### **Model Properties:**
- Dimensions (width, height, run, rise)
- Material type and properties
- Style information
- Handrail presence
- Special features (floating, glass railings, etc.)

## 🎯 Usage Workflow

1. **Select Staircase Tool** from Building ribbon
2. **Choose Category** (optional filtering)
3. **Select Model** from grid view
4. **Review Details** in info panel
5. **Click "Place Stair"** button
6. **Click in Viewport** to position staircase

## 🔧 Technical Integration

### **LocalModelsService Updates:**
- ✅ Added `staircases` support
- ✅ Thumbnail URL generation
- ✅ Model parameter creation
- ✅ Category filtering

### **StairTool Redesign:**
- ✅ Removed complex parameter UI
- ✅ Added model selection grid
- ✅ Integrated with LocalModelsService
- ✅ Fixed infinite re-render loops
- ✅ Modern, responsive design

### **CAD Engine Integration:**
- ✅ StandaloneCADEngine supports stair creation
- ✅ StudioSixObjectBridge renders stair geometry
- ✅ Viewport click handlers for placement
- ✅ Local model loading support

## 📝 Example Manifest Entry

```json
{
  "id": "your-stair-model",
  "name": "Your Staircase Name",
  "description": "Brief description of the staircase",
  "type": "straight",
  "material": "wood",
  "category": "modern",
  "dimensions": {
    "width": 1.2,
    "totalRun": 4.0,
    "totalRise": 3.0,
    "numberOfSteps": 16,
    "treadDepth": 0.25,
    "riserHeight": 0.1875
  },
  "files": {
    "model": "your-stair-model.fbx",
    "thumbnail": "your-stair-model.jpg"
  },
  "properties": {
    "hasHandrail": true,
    "handrailHeight": 1.0,
    "material": "wood",
    "style": "modern"
  },
  "tags": ["wood", "modern", "residential"]
}
```

## 🚀 Ready to Use!

The staircase model system is now fully integrated and ready for use. Simply:
1. Add your `.fbx` models and `.jpg` thumbnails
2. Update the manifest file
3. Select the stair tool and choose your models!

The system will handle loading, displaying, and placing your custom staircase models in the 3D viewport.











