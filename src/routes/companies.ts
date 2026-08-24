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

  // Dynamic min initial bid check based on highest current bid
  const maxBidRes = await c.env.DB.prepare('SELECT MAX(current_bid) as maxBid FROM companies').first<{ maxBid: number | null }>();
  const maxBid = maxBidRes?.maxBid || 0;

  if (maxBid === 0) {
    if (initialBid < 99) {
      return c.json({ success: false, error: 'Initial bid must be at least ₹99 for the first company listing.' }, 400);
    }
  } else {
    const requiredMin = maxBid + 5;
    if (initialBid < requiredMin) {
      return c.json({ success: false, error: `Initial bid must be at least ₹${requiredMin.toLocaleString()} (highest bid ₹${maxBid.toLocaleString()} + ₹5).` }, 400);
    }
  }

  await c.env.DB.prepare(`
    INSERT INTO companies (id, name, tagline, category, website_url, linkedin_url, instagram_url, current_bid, is_new, clicks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
  `).bind(
    id,
    name,
    tagline,
    category,
    website_url,
    body.linkedin_url ? sanitizeString(body.linkedin_url, 500) : null,
    body.instagram_url ? sanitizeString(body.instagram_url, 500) : null,
    initialBid
  ).run();

  // Log activity in Cloudflare D1
  const actId = 'act_' + Date.now().toString(36);
  await c.env.DB.prepare('INSERT INTO activity_logs (id, message, event_type) VALUES (?, ?, ?)').bind(
    actId,
    `New company '${name}' joined the leaderboard with a ₹${initialBid.toLocaleString()} bid!`,
    'outbid'
  ).run();

  return c.json({ success: true, companyId: id });
});

export default companiesRoute;
