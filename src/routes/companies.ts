import { Hono } from 'hono';
import { Env } from '../types/env';
import { sanitizeString, isValidUrl } from '../middleware/security';
import { rateLimiterMiddleware } from '../middleware/rateLimiter';

const companiesRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/companies
 * Registers a new company listing in Cloudflare D1 with strict sanitization & rate limiting
 */
companiesRoute.post('/companies', rateLimiterMiddleware(10, 60), async (c) => {
  const body: any = await c.req.json();
  const name = sanitizeString(body.name, 60);
  const tagline = sanitizeString(body.tagline, 140);
  const category = sanitizeString(body.category, 30);
  const website_url = sanitizeString(body.website_url, 500);

  if (!name || !tagline || !category || !website_url || !isValidUrl(website_url)) {
    return c.json({ success: false, error: 'Invalid inputs or website URL format. Must start with http:// or https://' }, 400);
  }

  const id = 'c_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const initialBid = Number(body.initial_bid) || 0;

  if (initialBid < 99) {
    return c.json({ success: false, error: 'Initial bid amount must be at least ₹99.' }, 400);
  }

  // Derive official 128px high-res favicon logo URL from website domain
  let logo_url = body.logo_url ? sanitizeString(body.logo_url, 500) : null;
  if (!logo_url) {
    try {
      const hostname = new URL(website_url).hostname.replace(/^www\./, '');
      logo_url = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
    } catch {
      logo_url = null;
    }
  }

  // Insert category into D1 categories master table if it does not already exist
  const catId = 'cat_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
  const catSlug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await c.env.DB.prepare('INSERT OR IGNORE INTO categories (id, name, slug, display_order) VALUES (?, ?, ?, 99)').bind(
    catId,
    category,
    catSlug
  ).run();

  // Insert company record with auto-populated logo_url
  await c.env.DB.prepare(`
    INSERT INTO companies (id, name, tagline, category, website_url, linkedin_url, instagram_url, logo_url, current_bid, is_new, clicks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
  `).bind(
    id,
    name,
    tagline,
    category,
    website_url,
    body.linkedin_url ? sanitizeString(body.linkedin_url, 500) : null,
    body.instagram_url ? sanitizeString(body.instagram_url, 500) : null,
    logo_url,
    initialBid
  ).run();

  // Log activity in Cloudflare D1
  const actId = 'act_' + Date.now().toString(36);
  await c.env.DB.prepare('INSERT INTO activity_logs (id, message, event_type) VALUES (?, ?, ?)').bind(
    actId,
    `New company '${name}' joined the leaderboard with a ₹${initialBid.toLocaleString()} bid!`,
    'outbid'
  ).run();

  return c.json({
    success: true,
    company: {
      id,
      name,
      tagline,
      category,
      website_url,
      logo_url,
      current_bid: initialBid,
      is_new: 1,
      clicks: 0,
    },
  });
});

export default companiesRoute;
