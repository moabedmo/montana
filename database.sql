-- =============================================
-- Montana Database Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop old tables if exist
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS wishlist CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS site_settings CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;

-- ===== CATEGORIES =====
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(20),
    image_url TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== PRODUCTS =====
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    description_en TEXT,
    ingredients TEXT,
    size VARCHAR(50),
    price DECIMAL(10,2) NOT NULL,
    old_price DECIMAL(10,2),
    category_id INT REFERENCES categories(id),
    image_url TEXT,
    images TEXT[], -- array of image URLs
    badge VARCHAR(50), -- 'new', 'best-seller', 'sale'
    skin_type VARCHAR(100),
    rating DECIMAL(2,1) DEFAULT 0,
    review_count INT DEFAULT 0,
    stock INT DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== CUSTOMERS =====
CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash TEXT,
    avatar_url TEXT,
    address_1 TEXT,
    address_2 TEXT,
    city VARCHAR(100),
    points INT DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'bronze', -- bronze, silver, gold, platinum
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ORDERS =====
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    subtotal DECIMAL(10,2),
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    coupon_code VARCHAR(50),
    payment_method VARCHAR(50) DEFAULT 'cod',
    delivery_method VARCHAR(50) DEFAULT 'standard',
    status VARCHAR(30) DEFAULT 'pending', -- pending, confirmed, preparing, shipped, delivered, cancelled
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ORDER ITEMS =====
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    product_name VARCHAR(255),
    product_image TEXT,
    price DECIMAL(10,2),
    quantity INT DEFAULT 1,
    total DECIMAL(10,2)
);

-- ===== REVIEWS =====
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    customer_name VARCHAR(100),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified BOOLEAN DEFAULT false,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== WISHLIST =====
CREATE TABLE wishlist (
    id SERIAL PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, product_id)
);

-- ===== COUPONS =====
CREATE TABLE coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) DEFAULT 'percentage', -- percentage, fixed
    discount_value DECIMAL(10,2) NOT NULL,
    min_order DECIMAL(10,2) DEFAULT 0,
    max_uses INT DEFAULT 100,
    used_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== SITE SETTINGS =====
CREATE TABLE site_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INSERT DEFAULT DATA
-- =============================================

-- Categories
INSERT INTO categories (name, name_en, slug, icon, color, sort_order) VALUES
('العناية بالبشرة', 'Skincare', 'skincare', 'fa-spa', '#E8A0BF', 1),
('العناية بالشعر', 'Haircare', 'haircare', 'fa-pump-soap', '#9B6CB8', 2),
('الصحة والتغذية', 'Health & Nutrition', 'health', 'fa-heartbeat', '#72B376', 3),
('الأطفال', 'Kids', 'kids', 'fa-baby', '#FFB74D', 4),
('الثيرم', 'Therm', 'therm', 'fa-temperature-low', '#64B5F6', 5);

-- Montana Products
INSERT INTO products (name, name_en, slug, description, ingredients, size, price, old_price, category_id, image_url, badge, skin_type, rating, review_count) VALUES
(
    'غسول الوجه لعلاج حب الشباب',
    'Acne Facial Cleanser',
    'acne-facial-cleanser',
    'أول تركيبة غسول كريمي في مصر تمنع الجفاف والالتهاب. مصمم خصيصاً للبشرة المختلطة والدهنية. نتيجة ملحوظة في 14 يوم.',
    'حمض الساليسيليك، زنك PCA، نياسيناميد (فيتامين B3)، زيت الأرجان، زيت الزيتون، زيت الجوجوبا',
    '200مل',
    285.00, 350.00,
    1, 'images/p1.png', 'best-seller',
    'البشرة المختلطة والدهنية',
    4.5, 247
),
(
    'غسول التفتيح والتوحيد',
    'Whitening Cleanser',
    'whitening-cleanser',
    'لما البهتان بيخبي إشراقتك الطبيعية وبشرتك مستنية تتكشف. بيعالج البقع الداكنة والتصبغات وآثار حب الشباب.',
    'خلاصة العرقسوس، نياسيناميد، حمض الساليسيليك، زيت شجرة الشاي، زنك PCA، فيتامين C، زيت جنين القمح، زيت اللوز',
    '200مل',
    310.00, NULL,
    1, 'images/p2.png', 'new',
    'البقع الداكنة، تصبغات، بشرة باهتة',
    5.0, 189
),
(
    'كريم التفتيح بالألفا أربوتين',
    'Whitening Cream',
    'whitening-cream',
    'الألفا أربوتين بيوقف إنزيم التيروسيناز. فيتامين C و E بيحاربوا الأكسدة. النياسيناميد بيعيد بناء حاجز البشرة.',
    'ألفا أربوتين، خلاصة العرقسوس، نياسيناميد، حمض اللاكتيك، أكسيد الزنك، فيتامين C، فيتامين E، زيت الورد',
    '50مل',
    240.00, 300.00,
    1, 'images/p3.png', 'sale',
    'الوجه، الرقبة، تحت الإبط، الكوع والركبة',
    4.5, 312
),
(
    'لوشن اليدين والجسم - ترطيب 72 ساعة',
    'Hand & Body Lotion',
    'hand-body-lotion',
    'ترطيب 72 ساعة لجميع أنواع البشرة. تركيبة غير دهنية تمتصها البشرة بسرعة وتحافظ على نعومتها طوال اليوم.',
    'جلسرين، زيت زيتون، زيت لوز، زيت جوجوبا، زيت جوز الهند، زبدة الكاكاو، زبدة الشيا، شمع النحل، فيتامين E',
    '50مل',
    195.00, NULL,
    1, 'images/p4.png', 'best-seller',
    'جميع أنواع البشرة',
    5.0, 415
),
(
    'كريم ما بعد الليزر بزيت السمسم',
    'Post Laser Cream',
    'post-laser-cream',
    'كريم تعافي ما بعد الإجراءات الجلدية. بيهدئ ويعالج ويصلح البشرة. الاحمرار بيروح في يومين بدل أسبوع.',
    'زيت السمسم، بانثينول (فيتامين B5)، ألانتوين، شمع النحل، جلسرين، صبار، فيتامين E، نياسيناميد، خلاصة الشاي الأخضر، لانولين',
    '50مل',
    265.00, 320.00,
    1, 'images/p5.png', 'new',
    'بعد جلسات الليزر والإجراءات الجلدية',
    4.5, 156
),
(
    'جل السيليكون لعلاج الندبات',
    'Anti-Scar Silicone Gel',
    'anti-scar-gel',
    'الندبات بتبدأ تلين وآثار حب الشباب بتقل بشكل ملحوظ. للندبات القديمة والجديدة والكيلويد.',
    'سيليكون طبي، فيتامين E',
    '50مل',
    340.00, 400.00,
    1, 'images/p6.png', 'sale',
    'الندبات القديمة والجديدة والكيلويد',
    4.0, 98
);

-- Site Settings
INSERT INTO site_settings (key, value) VALUES
('site_name', 'Montana'),
('site_tagline', 'Premium Care'),
('phone', '01234567890'),
('email', 'info@montana.com'),
('whatsapp', '201234567890'),
('address', 'القاهرة، مصر'),
('working_hours', '9 ص - 11 م يومياً'),
('free_shipping_min', '500'),
('shipping_cost', '40'),
('express_shipping_cost', '50'),
('return_days', '14'),
('facebook_url', ''),
('instagram_url', ''),
('tiktok_url', ''),
('primary_color', '#9B6CB8'),
('dark_color', '#2D1B3D');

-- Sample Coupon
INSERT INTO coupons (code, discount_type, discount_value, min_order, expires_at) VALUES
('WELCOME10', 'percentage', 10, 200, '2026-12-31'),
('MONTANA50', 'fixed', 50, 500, '2026-12-31');

-- ===== ENABLE ROW LEVEL SECURITY =====
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- ===== RLS POLICIES (Allow public read, authenticated write) =====
-- Products & Categories: public read
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (is_visible = true);
CREATE POLICY "Public read settings" ON site_settings FOR SELECT USING (true);
CREATE POLICY "Public read coupons" ON coupons FOR SELECT USING (is_active = true);

-- Allow all operations for authenticated (admin)
CREATE POLICY "Admin all categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin all products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin all customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin all orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin all order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin all reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin all wishlist" ON wishlist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin all coupons" ON coupons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin all settings" ON site_settings FOR ALL USING (true) WITH CHECK (true);
