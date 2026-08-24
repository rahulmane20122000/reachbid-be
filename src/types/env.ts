/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  LOGO_BUCKET?: R2Bucket;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  ENVIRONMENT?: string;
  CORS_ALLOWED_ORIGINS?: string;
}

export interface CompanyRow {
  id: string;
  name: string;
  tagline: string;
  category: string;
  website_url: string;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  logo_url?: string | null;
  current_bid: number;
  rank_change?: string | null;
  is_new?: number;
  clicks: number;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityLogRow {
  id: string;
  message: string;
  event_type: string;
  created_at: string;
}
