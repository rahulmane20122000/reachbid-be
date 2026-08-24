-- Migration: 0001_initial.sql
-- Cloudflare D1 / SQLite Schema for ReachBid.lol Backend (Clean Database)

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
