# 🏠 Roof Models Setup Guide

This guide will help you set up local roof models in StudioSix Pro.

## 📁 Directory Structure

The roof models should be organized as follows:

```
public/
├── models/
│   └── roofs/
│       ├── roofs-manifest.json          # ✅ Already created
│       ├── gable-roof-1.fbx             # Your FBX files go here
│       ├── hip-roof-1.fbx
│       ├── flat-roof-1.fbx
│       ├── shed-roof-1.fbx
│       ├── mansard-roof-1.fbx
│       └── gambrel-roof-1.fbx
└── thumbnails/
    └── roofs/
        ├── gable-roof-1.jpg             # ✅ Placeholder created
        ├── hip-roof-1.jpg               # ✅ Placeholder created
        ├── flat-roof-1.jpg              # ✅ Placeholder created
        ├── shed-roof-1.jpg              # ✅ Placeholder created
        ├── mansard-roof-1.jpg           # ✅ Placeholder created
        └── gambrel-roof-1.jpg           # ✅ Placeholder created
```

## 🎯 Quick Setup Steps

### 1. Add Your .FBX Roof Models
Place your roof .fbx files in:
```bash
public/models/roofs/
```

### 2. Add Thumbnail Images
Create or add thumbnail images (jpg/png) in:
```bash
public/thumbnails/roofs/
```

**Recommended thumbnail size:** 256x256 pixels

### 3. Update the Manifest
The manifest file `public/models/roofs/roofs-manifest.json` is already configured with 6 sample roof types:

- **Gable Roof** (Classic residential)
- **Hip Roof** (Four-sided)
- **Flat Roof** (Modern commercial)
- **Shed Roof** (Single slope)
- **Mansard Roof** (Historic with dormers)
- **Gambrel Roof** (Barn-style)

Edit the manifest to match your actual model files.

## 📋 Current Manifest Configuration

The manifest includes these categories:
- **Residential** - Homes and residential buildings
- **Commercial** - Office and commercial buildings  
- **Industrial** - Factories and warehouses
- **Historic** - Traditional and heritage styles
- **Agricultural** - Barns and farm buildings

And these materials:
- **Asphalt Shingles** - Standard residential
- **Clay Tiles** - Mediterranean style
- **Metal Roofing** - Industrial/modern
- **Slate** - Premium/historic
- **Wood Shingles** - Rustic/traditional
- **Membrane** - Flat roof systems

## 🔧 Testing Your Setup

1. **Start the application**
2. **Click the Roof tool** in the toolbar
3. **Verify models appear** in the selection grid
4. **Select a roof model** and click "Place Roof"
5. **Click in the viewport** to position

## 🏗️ Expected Behavior

- ✅ **Model Selection UI:** Grid showing roof thumbnails by category
- ✅ **Visual Preview:** Thumbnail images with fallback icons
- ✅ **Model Loading:** Actual .fbx files loaded in 3D viewport
- ✅ **Material Colors:** Automatic coloring based on roof material
- ✅ **Proper Scaling:** Roofs scaled appropriately for architectural use
- ✅ **Ground Positioning:** Roofs positioned at proper elevation

## 🎨 Recommended Roof Models

For best results, use roof models that:
- **Face upward** (positive Y-axis up)
- **Reasonable scale** (10-30 units typical)
- **Include basic geometry** for common roof types
- **Have clean topology** for good performance

## 📝 Manifest File Format

Each roof model entry should include:

```json
{
  "id": "roof-id",
  "name": "Display Name",
  "description": "Roof description",
  "type": "gable|hip|flat|shed|mansard|gambrel",
  "material": "asphalt_shingles|clay_tiles|metal|slate|wood_shingles|membrane",
  "category": "residential|commercial|industrial|historic|agricultural",
  "dimensions": {
    "width": 12.0,
    "length": 16.0,
    "height": 4.0,
    "pitch": 30,
    "overhang": 0.6
  },
  "files": {
    "model": "filename.fbx",
    "thumbnail": "filename.jpg"
  },
  "properties": {
    "hasGutters": true,
    "material": "material_name",
    "style": "style_name",
    "waterproof": true
  },
  "tags": ["tag1", "tag2", "tag3"]
}
```

## 🚀 Ready to Go!

Your roof models system is now set up! The UI will automatically:

- Load models from the manifest
- Display thumbnails in a grid
- Allow category filtering
- Handle model placement in 3D
- Apply appropriate materials and scaling

---

**Need help?** Check the console for debug messages starting with `🏠 ROOF:` to troubleshoot any issues.
















