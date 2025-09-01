# Door Models Directory

This directory contains local 3D models for doors that can be used in the application without requiring external downloads.

## Setup Instructions

### 1. Add Your Door FBX Files

Copy your 25 door `.fbx` files into this directory (`public/models/doors/`).

**Recommended naming convention:**
- `residential_single_001.fbx`
- `residential_double_001.fbx`
- `commercial_glass_001.fbx`
- `office_steel_001.fbx`
- etc.

### 2. Generate Manifest

After copying your FBX files, run the setup script to automatically generate the manifest:

```bash
node scripts/setup-door-models.js
```

This script will:
- Scan for `.fbx` files in this directory
- Generate a `doors-manifest.json` file
- Automatically categorize doors based on filenames
- Set up appropriate dimensions and metadata

### 3. Manual Manifest Editing (Optional)

You can manually edit `doors-manifest.json` to:
- Adjust door dimensions
- Update categories and descriptions
- Add custom tags
- Modify door names

### 4. File Structure

```
public/models/doors/
├── README.md (this file)
├── doors-manifest.json (generated)
├── your_door_001.fbx
├── your_door_002.fbx
├── ...
└── your_door_025.fbx
```

## Model Requirements

- **Format**: FBX (.fbx files)
- **Orientation**: Models should be oriented with the door facing forward (Z-axis)
- **Scale**: Real-world scale (meters)
- **Pivot**: Bottom center of the door frame

## Usage

Once set up, doors will:
1. Appear in the Door Tool model selection dropdown
2. Load instantly (no internet required)
3. Maintain proper dimensions and materials
4. Support all transform operations (move, rotate, scale)

## Categories

The system supports these door categories:
- **residential**: Home doors (single, double, glass)
- **commercial**: Office/business doors (glass, steel, security)
- **specialty**: Custom or unique door types

## Troubleshooting

**No models appear in Door Tool:**
- Check that `.fbx` files are in this directory
- Run `node scripts/setup-door-models.js` to regenerate manifest
- Check browser console for loading errors

**Models appear as cubes:**
- Verify FBX files are valid 3D models
- Check file permissions (files must be readable)
- Ensure models have proper geometry

**Wrong dimensions:**
- Edit `doors-manifest.json` dimensions
- Restart development server
- Models will auto-scale to specified dimensions
















