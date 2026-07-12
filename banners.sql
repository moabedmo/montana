-- Banners table for hero sections
DROP TABLE IF EXISTS banners CASCADE;

CREATE TABLE banners (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    subtitle VARCHAR(255),
    image_url TEXT NOT NULL,
    link_url VARCHAR(255) DEFAULT 'category.html',
    platform VARCHAR(20) NOT NULL DEFAULT 'desktop', -- 'desktop' or 'mobile'
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read banners" ON banners FOR SELECT USING (true);
CREATE POLICY "Admin all banners" ON banners FOR ALL USING (true) WITH CHECK (true);

-- Default desktop banners
INSERT INTO banners (title, image_url, platform, sort_order) VALUES
('بانر 1', 'images/hero-1.png', 'desktop', 1),
('بانر 2', 'images/hero-2.png', 'desktop', 2),
('بانر 3', 'images/hero-3.png', 'desktop', 3),
('بانر 4', 'images/hero-4.png', 'desktop', 4);

-- Default mobile banners
INSERT INTO banners (title, image_url, platform, sort_order) VALUES
('بانر موبايل 1', 'images/hero-1.png', 'mobile', 1),
('بانر موبايل 2', 'images/hero-2.png', 'mobile', 2),
('بانر موبايل 3', 'images/hero-3.png', 'mobile', 3);
