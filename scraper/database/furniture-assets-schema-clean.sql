-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the main furniture_assets table
CREATE TABLE IF NOT EXISTS furniture_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    model_url TEXT NOT NULL,
    thumbnail_url TEXT,
    download_url TEXT,
    source TEXT NOT NULL DEFAULT 'Free3D',
    original_page_url TEXT,
    author_name TEXT,
    author_profile_url TEXT,
    format TEXT[] DEFAULT ARRAY[]::TEXT[],
    file_size_mb DECIMAL(10,2),
    polygon_count INTEGER,
    has_textures BOOLEAN DEFAULT FALSE,
    has_materials BOOLEAN DEFAULT FALSE,
    is_rigged BOOLEAN DEFAULT FALSE,
    has_animations BOOLEAN DEFAULT FALSE,
    license_type TEXT,
    is_free BOOLEAN DEFAULT TRUE,
    price DECIMAL(10,2),
    download_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2),
    views INTEGER DEFAULT 0,
    extraction_confidence INTEGER DEFAULT 0,
    categorization_confidence INTEGER DEFAULT 0,
    scraper_version TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add data validation constraints
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

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_furniture_assets_category 
    ON furniture_assets(category);

CREATE INDEX IF NOT EXISTS idx_furniture_assets_subcategory 
    ON furniture_assets(subcategory);

CREATE INDEX IF NOT EXISTS idx_furniture_assets_category_subcategory 
    ON furniture_assets(category, subcategory);

CREATE INDEX IF NOT EXISTS idx_furniture_assets_source 
    ON furniture_assets(source);

CREATE INDEX IF NOT EXISTS idx_furniture_assets_is_free 
    ON furniture_assets(is_free);

-- GIN index for JSONB tags only (this works fine)
CREATE INDEX IF NOT EXISTS idx_furniture_assets_tags 
    ON furniture_assets USING GIN(tags);

-- Separate B-tree index for category + tags filtering
CREATE INDEX IF NOT EXISTS idx_furniture_assets_category_btree 
    ON furniture_assets(category, is_free);

-- GIN index for format arrays
CREATE INDEX IF NOT EXISTS idx_furniture_assets_format 
    ON furniture_assets USING GIN(format);

CREATE INDEX IF NOT EXISTS idx_furniture_assets_created_at 
    ON furniture_assets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_furniture_assets_last_scraped_at 
    ON furniture_assets(last_scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_furniture_assets_author 
    ON furniture_assets(author_name);

CREATE INDEX IF NOT EXISTS idx_furniture_assets_rating 
    ON furniture_assets(rating DESC) WHERE rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_furniture_assets_download_count 
    ON furniture_assets(download_count DESC);

CREATE INDEX IF NOT EXISTS idx_furniture_assets_has_textures 
    ON furniture_assets(has_textures) WHERE has_textures = TRUE;

CREATE INDEX IF NOT EXISTS idx_furniture_assets_is_rigged 
    ON furniture_assets(is_rigged) WHERE is_rigged = TRUE;

CREATE INDEX IF NOT EXISTS idx_furniture_assets_has_animations 
    ON furniture_assets(has_animations) WHERE has_animations = TRUE;

-- Create helper views
CREATE OR REPLACE VIEW free_furniture_assets AS
SELECT * FROM furniture_assets 
WHERE is_free = TRUE 
ORDER BY download_count DESC, rating DESC NULLS LAST;

CREATE OR REPLACE VIEW latest_furniture_assets AS
SELECT * FROM furniture_assets 
ORDER BY last_scraped_at DESC, created_at DESC;

CREATE OR REPLACE VIEW quality_furniture_assets AS
SELECT * FROM furniture_assets 
WHERE rating >= 4.0 AND rating IS NOT NULL
ORDER BY rating DESC, download_count DESC;

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

-- Create utility functions
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
    WHERE fa.tags ?| search_tags
    ORDER BY fa.download_count DESC, fa.rating DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

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

-- Insert sample data
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

-- Add table comments
COMMENT ON TABLE furniture_assets IS 'Stores metadata for 3D furniture and architectural models scraped from various sources';
COMMENT ON COLUMN furniture_assets.id IS 'Unique identifier generated automatically';
COMMENT ON COLUMN furniture_assets.tags IS 'JSON array of tags for flexible categorization and search';
COMMENT ON COLUMN furniture_assets.format IS 'Array of available file formats (obj, fbx, blend, etc.)';
COMMENT ON COLUMN furniture_assets.extraction_confidence IS 'Confidence score (0-100) for metadata extraction accuracy';
COMMENT ON COLUMN furniture_assets.categorization_confidence IS 'Confidence score (0-100) for automatic categorization'; 