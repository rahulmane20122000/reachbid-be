-- Migration: 0001_initial.sql
-- Cloudflare D1 / SQLite Schema for ReachBid.lol Backend

CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT NOT NULL,
    category TEXT NOT NULL,
    website_url TEXT NOT NULL,
    linkedin_url TEXT,
    instagram_url TEXT,
    logo_url TEXT,
    current_bid INTEGER NOT NULL DEFAULT 99,
    rank_change TEXT DEFAULT '',
    is_new INTEGER DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    payment_id TEXT,
    payment_status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clicks (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    user_agent TEXT,
    ip_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    event_type TEXT DEFAULT 'outbid',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Visitor Analytics Table: stores IP, User Agent, Device Type, Browser, OS, Country, and Timestamps
CREATE TABLE IF NOT EXISTS page_views (
    id TEXT PRIMARY KEY,
    ip_address TEXT,
    ip_hash TEXT NOT NULL,
    user_agent TEXT,
    device_type TEXT DEFAULT 'Desktop',
    browser TEXT DEFAULT 'Unknown',
    os TEXT DEFAULT 'Unknown',
    country TEXT DEFAULT 'US',
    city TEXT,
    referrer TEXT,
    page_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_ip_hash ON page_views(ip_hash);

-- Categories Table: Dedicated Cloudflare D1 master table for category management
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Categories into D1 Database
INSERT OR IGNORE INTO categories (id, name, slug, display_order) VALUES
('cat_1', 'SEO & AI Visibility', 'seo-ai-visibility', 1),
('cat_2', 'AI Agents & Infrastructure', 'ai-agents-infrastructure', 2),
('cat_3', 'AI Media Generation', 'ai-media-generation', 3),
('cat_4', 'AI', 'ai', 4),
('cat_5', 'SaaS', 'saas', 5),
('cat_6', 'Developer Tools', 'developer-tools', 6),
('cat_7', 'Marketing & Advertising', 'marketing-advertising', 7),
('cat_8', 'Productivity & Personal Tools', 'productivity-personal-tools', 8),
('cat_9', 'People & Profiles', 'people-profiles', 9),
('cat_10', 'Design & Creative', 'design-creative', 10),
('cat_11', 'Social Media & Creator Tools', 'social-media-creator-tools', 11),
('cat_12', 'Writing & Content', 'writing-content', 12),
('cat_13', 'Sales & Lead Generation', 'sales-lead-generation', 13),
('cat_14', 'Business, Finance & Legal', 'business-finance-legal', 14),
('cat_15', 'Games & Entertainment', 'games-entertainment', 15),
('cat_16', 'Education & Learning', 'education-learning', 16),
('cat_17', 'Health, Fitness & Wellness', 'health-fitness-wellness', 17),
('cat_18', 'Ecommerce & Retail', 'ecommerce-retail', 18),
('cat_19', 'Directories, Launch & Discovery', 'directories-launch-discovery', 19),
('cat_20', 'Hiring, Jobs & Careers', 'hiring-jobs-careers', 20),
('cat_21', 'Audio, Voice & Podcasting', 'audio-voice-podcasting', 21),
('cat_22', 'Crypto, Web3 & Investing', 'crypto-web3-investing', 22),
('cat_23', 'Agencies, Studios & Services', 'agencies-studios-services', 23),
('cat_24', 'Security, Privacy & Compliance', 'security-privacy-compliance', 24),
('cat_25', 'Travel, Local & Lifestyle', 'travel-local-lifestyle', 25),
('cat_26', 'Media & News', 'media-news', 26),
('cat_27', 'Domains & Web Assets', 'domains-web-assets', 27),
('cat_28', 'Leaderboards & Attention Markets', 'leaderboards-attention-markets', 28),
('cat_29', 'Real Estate & Property', 'real-estate-property', 29),
('cat_30', 'DevOps & Infra', 'devops-infra', 30),
('cat_31', 'Data & Analytics', 'data-analytics', 31),
('cat_32', 'Quick Commerce', 'quick-commerce', 32),
('cat_33', 'ClimateTech', 'climatetech', 33),
('cat_34', 'No-Code & Automation', 'no-code-automation', 34),
('cat_35', 'Hardware & IoT', 'hardware-iot', 35),
('cat_36', 'Mobile Apps', 'mobile-apps', 36),
('cat_37', 'Other', 'other', 37);
