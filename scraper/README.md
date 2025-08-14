# Free3D Model Scraper with Supabase Integration

A comprehensive scraping system that downloads 3D models from Free3D.com and automatically uploads them to Supabase Storage with proper organization and metadata.

## 🚀 Quick Start

### 1. Setup Supabase Credentials

Create a `.env` file in this directory with your Supabase credentials:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NODE_ENV=development
DEBUG=supabase:*
```

Get these values from your Supabase dashboard under **Settings > API**.

### 2. Install Dependencies

```bash
cd web-app
npm install
```

### 3. Setup Supabase Storage

```bash
npm run scraper:setup
```

This will:
- Create the "models" bucket
- Set up folder structure (models/, thumbnails/, metadata/)
- Configure access policies
- Verify the setup

### 4. Run the Scraper

```bash
# Test run (5 models)
npm run scraper:test

# Full run (default 10 models)
npm run scraper:run

# Category-specific scraping
npm run scraper:category  # 20 furniture models

# Custom configuration
cd scraper
node scrape-free3d.js --max=50 --category=vehicles
```

## 📋 Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--max=N` | Maximum number of models to scrape | 10 |
| `--category=NAME` | Category to focus on (vehicles, furniture, etc.) | all |
| `--no-skip` | Don't skip existing models | false |
| `--no-license-check` | Disable license compliance checking | false |

## 🗂️ Storage Organization

Your Supabase bucket will be organized as:

```
models/
├── vehicles/
│   ├── car-model-123.obj
│   └── truck-model-456.obj
├── furniture/
│   ├── chair-modern-789.obj
│   └── table-wooden-012.obj
└── ...

thumbnails/
├── vehicles/
│   ├── car-model-123.jpg
│   └── truck-model-456.jpg
└── ...

metadata/
├── vehicles/
│   ├── car-model-123.json
│   └── truck-model-456.json
└── ...
```

## 🎯 Features

### ✅ What It Does
- **Automated Discovery**: Finds available 3D models on Free3D
- **License Compliance**: Automatically filters out paid/restricted models
- **Smart Downloads**: Downloads OBJ files, textures, and thumbnails
- **Metadata Extraction**: Captures title, description, tags, license info
- **Duplicate Prevention**: Skips models already in your Supabase storage
- **Category Organization**: Organizes models by type (vehicles, furniture, etc.)
- **Progress Tracking**: Detailed logging and progress reports

### 🔒 License Compliance
The scraper includes built-in license checking to ensure you only download models that are:
- Marked as "Free"
- Creative Commons (CC0)
- Public Domain
- Royalty Free

Models marked as "Commercial", "Paid", or "Premium" are automatically skipped.

## 📊 Components

| Component | Purpose |
|-----------|---------|
| `scrape-free3d.js` | Main orchestrator script |
| `free3d-navigator.js` | Website navigation and discovery |
| `model-downloader.js` | Download model files and assets |
| `metadata-extractor.js` | Extract model information and metadata |
| `model-identifier.js` | Identify and categorize models |
| `supabase-uploader.js` | Upload to Supabase with organization |
| `supabase-client.js` | Supabase connection and bucket management |

## 📈 Performance & Ethics

- **Respectful Scraping**: 2-second delays between requests
- **Anti-Detection**: Realistic browser headers and behavior
- **Error Handling**: Robust error recovery and logging
- **Resource Management**: Automatic cleanup and memory management
- **Compliance First**: Only downloads properly licensed content

## 🔧 Configuration

Edit `config/scraper-config.js` to customize:
- Browser settings (headless mode, delays)
- Download paths and file handling
- Category mappings
- Request timeouts and retries

Edit `config/supabase-config.js` to customize:
- Bucket name and structure
- File size limits
- Allowed file types
- Folder organization

## 📝 Logs

All activity is logged to `logs/` directory:
- `scraper.log` - General scraping activity
- `downloads.log` - Download progress and results
- `uploads.log` - Supabase upload activity
- `errors.log` - Error details and debugging info

## 🚨 Troubleshooting

### Setup Issues
- **"SUPABASE_URL not set"**: Check your `.env` file exists and has correct values
- **"Bucket creation failed"**: Verify your service role key has admin permissions
- **"Network error"**: Check your internet connection and Supabase project status

### Scraping Issues
- **"No models found"**: Try a different category or check Free3D website availability
- **"Download failed"**: Some models may have broken links or access restrictions
- **"Upload failed"**: Check Supabase storage quotas and bucket permissions

### Performance Issues
- **Slow downloads**: Normal for large model files, increase timeouts if needed
- **Browser crashes**: Try enabling headless mode in config
- **Memory issues**: Reduce batch size or restart between large sessions

## 🤝 Contributing

To extend the scraper:

1. **Add New Sites**: Create new navigator classes following the `Free3DNavigator` pattern
2. **Add Formats**: Extend `ModelDownloader` to handle new file types
3. **Add Metadata**: Enhance `MetadataExtractor` for richer information capture
4. **Add Storage**: Create new uploader classes for different cloud providers

## ⚖️ Legal Notice

This scraper is designed to respect Free3D's terms of service and only download models that are explicitly marked as free for use. Always verify licensing terms before using downloaded models in your projects.

## 📞 Support

For issues and questions:
1. Check the logs in `logs/` directory
2. Verify your Supabase configuration
3. Test with a small batch first (`--max=1`)
4. Review Free3D's current website structure (it may have changed)

---

🎉 **Happy Scraping!** Your models will be automatically organized and ready to use in your StudioSix projects. 