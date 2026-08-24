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

-- Seed All Comprehensive Industry Categories into D1 Database
INSERT OR IGNORE INTO categories (id, name, slug, display_order) VALUES
('cat_1', 'AI', 'ai', 1),
('cat_2', 'SaaS', 'saas', 2),
('cat_3', 'Developer Tools', 'developer-tools', 3),
('cat_4', 'Hiring', 'hiring', 4),
('cat_5', 'Quick Commerce', 'quick-commerce', 5),
('cat_6', 'FinTech', 'fintech', 6),
('cat_7', 'EdTech', 'edtech', 7),
('cat_8', 'Web3', 'web3', 8),
('cat_9', 'HealthTech', 'healthtech', 9),
('cat_10', 'E-Commerce', 'e-commerce', 10),
('cat_11', 'Cybersecurity', 'cybersecurity', 11),
('cat_12', 'DevOps & Infra', 'devops-infra', 12),
('cat_13', 'Data & Analytics', 'data-analytics', 13),
('cat_14', 'Design & Creative', 'design-creative', 14),
('cat_15', 'Marketing & SEO', 'marketing-seo', 15),
('cat_16', 'Productivity', 'productivity', 16),
('cat_17', 'ClimateTech', 'climatetech', 17),
('cat_18', 'Gaming', 'gaming', 18),
('cat_19', 'Logistics', 'logistics', 19),
('cat_20', 'Mobile Apps', 'mobile-apps', 20),
('cat_21', 'No-Code & Automation', 'no-code-automation', 21),
('cat_22', 'Hardware & IoT', 'hardware-iot', 22),
('cat_23', 'Community & Social', 'community-social', 23),
('cat_24', 'LegalTech', 'legaltech', 24),
('cat_25', 'PropTech', 'proptech', 25),
('cat_26', 'Other', 'other', 26);
