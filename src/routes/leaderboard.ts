import { Hono } from 'hono';
import { Env, CompanyRow, ActivityLogRow } from '../types/env';

const leaderboardRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/leaderboard
 * Fetches company rankings sorted by current_bid DESC from Cloudflare D1
 */
leaderboardRoute.get('/leaderboard', async (c) => {
  const category = c.req.query('category');
  let query = 'SELECT * FROM companies ORDER BY current_bid DESC, clicks DESC';
  let stmt;

  if (category && category !== 'All') {
    query = 'SELECT * FROM companies WHERE LOWER(category) = LOWER(?) ORDER BY current_bid DESC, clicks DESC';
    stmt = c.env.DB.prepare(query).bind(category);
  } else {
    stmt = c.env.DB.prepare(query);
  }

  const { results } = await stmt.all<CompanyRow>();

  const countRes = await c.env.DB.prepare('SELECT COUNT(*) as count FROM companies').first<{ count: number }>();
  const sumRes = await c.env.DB.prepare('SELECT SUM(current_bid) as total FROM companies').first<{ total: number }>();
  const latestActivity = await c.env.DB.prepare('SELECT message FROM activity_logs ORDER BY created_at DESC LIMIT 1').first<ActivityLogRow>();

  return c.json({
    success: true,
    companies: results || [],
    stats: {
      totalCompanies: countRes?.count || 0,
      totalBids: sumRes?.total || 0,
    },
    latestActivity: latestActivity?.message || "Someone just outbid 'SaaSify' for #5 rank",
  });
});

export default leaderboardRoute;
