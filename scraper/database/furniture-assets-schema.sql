-- ====================================================================
-- TASK 5: Supabase Database Schema for Furniture Assets
-- ====================================================================
-- This file implements the complete database schema for storing
-- 3D model metadata from the Free3D scraper system.
-- ====================================================================

-- ====================================================================
-- SUBTASK 5.1: Enable uuid-ossp Extension
-- ====================================================================
-- Enable the uuid-ossp extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify extension is working
SELECT uuid_generate_v4() as sample_uuid;

-- ====================================================================
-- SUBTASK 5.2: Define furniture_assets Table Schema
-- ====================================================================
-- Create the main furniture_assets table with comprehensive metadata
CREATE TABLE IF NOT EXISTS furniture_assets (
    -- Primary key with automatic UUID generation
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic model information
    name TEXT NOT NULL,
    description TEXT,
    
    -- Categorization and tagging
    category TEXT NOT NULL,
    subcategory TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Model URLs and file information
    model_url TEXT NOT NULL,
    thumbnail_url TEXT,
    download_url TEXT,
    
    -- Source and attribution
    source TEXT NOT NULL DEFAULT 'Free3D',
    original_page_url TEXT,
    author_name TEXT,
    author_profile_url TEXT,
    
    -- File format and technical details
    format TEXT[] DEFAULT ARRAY[]::TEXT[],
    file_size_mb DECIMAL(10,2),
    polygon_count INTEGER,
    has_textures BOOLEAN DEFAULT FALSE,
    has_materials BOOLEAN DEFAULT FALSE,
    is_rigged BOOLEAN DEFAULT FALSE,
    has_animations BOOLEAN DEFAULT FALSE,
    
    -- Licensing and availability
    license_type TEXT,
    is_free BOOLEAN DEFAULT TRUE,
    price DECIMAL(10,2),
    
    -- Quality and statistics
    download_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2),
    views INTEGER DEFAULT 0,
    
    -- Scraper metadata
    extraction_confidence INTEGER DEFAULT 0,
    categorization_confidence INTEGER DEFAULT 0,
    scraper_version TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- SUBTASK 5.3: Set Default Values and Constraints
-- ====================================================================

-- Add NOT NULL constraints for essential fields
ALTER TABLE furniture_assets 
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN category SET NOT NULL,
    ALTER COLUMN model_url SET NOT NULL,
    ALTER COLUMN source SET NOT NULL;

-- Add CHECK constraints for data validation
ALTER TABLE furniture_assets 
    ADD CONSTRAINT check_rating_range 
    CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));

ALTER TABLE furniture_assets 
    ADD CONSTRAINT check_confidence_range 
    CHECK (extraction_confidence >= 0 AND extraction_confidence <= 100);

ALTER TABLE furniture_assets 
    ADD CONSTRAINT check_categorization_confidence_range 
    CHECK (categorization_confidence >= 0 AND categorization_confidence <= 100);

ALTER TABLE furniture_assets 
    ADD CONSTRAINT check_polygon_count_positive 
    CHECK (polygon_count IS NULL OR polygon_count >= 0);

ALTER TABLE furniture_assets 
    ADD CONSTRAINT check_file_size_positive 
    CHECK (file_size_mb IS NULL OR file_size_mb >= 0);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to furniture_assets table
CREATE TRIGGER update_furniture_assets_updated_at 
    BEFORE UPDATE ON furniture_assets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- SUBTASK 5.4: Implement Indexes for Performance Optimization
-- ====================================================================

-- Primary category index for fast filtering
CREATE INDEX IF NOT EXISTS idx_furniture_assets_category 
    ON furniture_assets(category);

-- Subcategory index for detailed filtering
CREATE INDEX IF NOT EXISTS idx_furniture_assets_subcategory 
    ON furniture_assets(subcategory);

-- Combined category index for hierarchical filtering
CREATE INDEX IF NOT EXISTS idx_furniture_assets_category_subcategory 
    ON furniture_assets(category, subcategory);

-- Source index for filtering by scraper source
CREATE INDEX IF NOT EXISTS idx_furniture_assets_source 
    ON furniture_assets(source);

-- Free models index for license filtering
CREATE INDEX IF NOT EXISTS idx_furniture_assets_is_free 
    ON furniture_assets(is_free);

-- GIN index for JSONB tags for fast tag searching
CREATE INDEX IF NOT EXISTS idx_furniture_assets_tags 
    ON furniture_assets USING GIN(tags);

-- Composite index for tags and category
CREATE INDEX IF NOT EXISTS idx_furniture_assets_tags_category 
    ON furniture_assets USING GIN(tags, category);

-- Format array index for file type searches
CREATE INDEX IF NOT EXISTS idx_furniture_assets_format 
    ON furniture_assets USING GIN(format);

-- Timestamp indexes for chronological queries
CREATE INDEX IF NOT EXISTS idx_furniture_assets_created_at 
    ON furniture_assets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_furniture_assets_last_scraped_at 
    ON furniture_assets(last_scraped_at DESC);

-- Author index for creator-based searches
CREATE INDEX IF NOT EXISTS idx_furniture_assets_author 
    ON furniture_assets(author_name);

-- Rating index for quality-based filtering
CREATE INDEX IF NOT EXISTS idx_furniture_assets_rating 
    ON furniture_assets(rating DESC) WHERE rating IS NOT NULL;

-- Download count index for popularity sorting
CREATE INDEX IF NOT EXISTS idx_furniture_assets_download_count 
    ON furniture_assets(download_count DESC);

-- Technical feature indexes
CREATE INDEX IF NOT EXISTS idx_furniture_assets_has_textures 
    ON furniture_assets(has_textures) WHERE has_textures = TRUE;

CREATE INDEX IF NOT EXISTS idx_furniture_assets_is_rigged 
    ON furniture_assets(is_rigged) WHERE is_rigged = TRUE;

CREATE INDEX IF NOT EXISTS idx_furniture_assets_has_animations 
    ON furniture_assets(has_animations) WHERE has_animations = TRUE;

-- ====================================================================
-- HELPER VIEWS FOR COMMON QUERIES
-- ====================================================================

-- View for free furniture models only
CREATE OR REPLACE VIEW free_furniture_assets AS
SELECT * FROM furniture_assets 
WHERE is_free = TRUE 
ORDER BY download_count DESC, rating DESC NULLS LAST;

-- View for latest scraped models
CREATE OR REPLACE VIEW latest_furniture_assets AS
SELECT * FROM furniture_assets 
ORDER BY last_scraped_at DESC, created_at DESC;

-- View for high-quality models (with ratings)
CREATE OR REPLACE VIEW quality_furniture_assets AS
SELECT * FROM furniture_assets 
WHERE rating >= 4.0 AND rating IS NOT NULL
ORDER BY rating DESC, download_count DESC;

-- View for furniture category summary
CREATE OR REPLACE VIEW furniture_category_stats AS
SELECT 
    category,
    subcategory,
    COUNT(*) as model_count,
    AVG(rating) as avg_rating,
    SUM(download_count) as total_downloads,
    COUNT(*) FILTER (WHERE is_free = TRUE) as free_models,
    COUNT(*) FILTER (WHERE has_textures = TRUE) as textured_models,
    COUNT(*) FILTER (WHERE is_rigged = TRUE) as rigged_models
FROM furniture_assets
GROUP BY category, subcategory
ORDER BY category, subcategory;

-- ====================================================================
-- HELPFUL FUNCTIONS
-- ====================================================================

-- Function to search models by tags
CREATE OR REPLACE FUNCTION search_by_tags(search_tags TEXT[])
RETURNS TABLE(
    id UUID,
    name TEXT,
    category TEXT,
    subcategory TEXT,
    tags JSONB,
    model_url TEXT,
    thumbnail_url TEXT,
    rating DECIMAL,
    download_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fa.id,
        fa.name,
        fa.category,
        fa.subcategory,
        fa.tags,
        fa.model_url,
        fa.thumbnail_url,
        fa.rating,
        fa.download_count
    FROM furniture_assets fa
    WHERE fa.tags ?| search_tags  -- Check if any of the search tags exist
    ORDER BY fa.download_count DESC, fa.rating DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Function to get models by category hierarchy
CREATE OR REPLACE FUNCTION get_models_by_category(
    cat TEXT DEFAULT NULL,
    subcat TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    category TEXT,
    subcategory TEXT,
    thumbnail_url TEXT,
    model_url TEXT,
    rating DECIMAL,
    download_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fa.id,
        fa.name,
        fa.category,
        fa.subcategory,
        fa.thumbnail_url,
        fa.model_url,
        fa.rating,
        fa.download_count,
        fa.created_at
    FROM furniture_assets fa
    WHERE 
        (cat IS NULL OR fa.category = cat) AND
        (subcat IS NULL OR fa.subcategory = subcat) AND
        fa.is_free = TRUE
    ORDER BY fa.download_count DESC, fa.rating DESC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- SAMPLE DATA VERIFICATION
-- ====================================================================

-- Create sample record to verify schema works
INSERT INTO furniture_assets (
    name,
    description,
    category,
    subcategory,
    tags,
    model_url,
    thumbnail_url,
    source,
    format,
    author_name,
    license_type,
    extraction_confidence,
    categorization_confidence
) VALUES (
    'Sample Modern Office Chair',
    'A sleek, ergonomic office chair perfect for modern workspaces.',
    'furniture',
    'interior/office-chairs',
    '["chair", "office", "ergonomic", "modern", "furniture"]'::jsonb,
    'https://example.com/models/office-chair.obj',
    'https://example.com/thumbnails/office-chair.jpg',
    'Free3D',
    ARRAY['obj', 'mtl', 'fbx'],
    'Sample Author',
    'Creative Commons',
    85,
    90
) ON CONFLICT DO NOTHING;

-- ====================================================================
-- SCHEMA VERIFICATION QUERIES
-- ====================================================================

-- Count total models
SELECT COUNT(*) as total_models FROM furniture_assets;

-- Show category distribution
SELECT category, subcategory, COUNT(*) as count 
FROM furniture_assets 
GROUP BY category, subcategory 
ORDER BY category, subcategory;

-- Test tag search
SELECT name, category, tags 
FROM furniture_assets 
WHERE tags ? 'chair';

-- Test function
SELECT * FROM get_models_by_category('furniture', 'interior/office-chairs', 10);

-- ====================================================================
-- COMMENTS AND DOCUMENTATION
-- ====================================================================

COMMENT ON TABLE furniture_assets IS 'Stores metadata for 3D furniture and architectural models scraped from various sources';
COMMENT ON COLUMN furniture_assets.id IS 'Unique identifier generated automatically';
COMMENT ON COLUMN furniture_assets.tags IS 'JSON array of tags for flexible categorization and search';
COMMENT ON COLUMN furniture_assets.format IS 'Array of available file formats (obj, fbx, blend, etc.)';
COMMENT ON COLUMN furniture_assets.extraction_confidence IS 'Confidence score (0-100) for metadata extraction accuracy';
COMMENT ON COLUMN furniture_assets.categorization_confidence IS 'Confidence score (0-100) for automatic categorization';

-- ====================================================================
-- TASK 5 IMPLEMENTATION COMPLETE
-- ====================================================================
-- Schema ready for production use with:
-- ✅ UUID primary keys with automatic generation
-- ✅ Comprehensive metadata fields 
-- ✅ Performance-optimized indexes
-- ✅ Data validation constraints
-- ✅ Helper views and functions
-- ✅ Sample data for testing
-- ==================================================================== 