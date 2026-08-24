import { Hono } from 'hono';
import { Env, CompanyRow, ActivityLogRow } from '../types/env';

const leaderboardRoute = new Hono<{ Bindings: Env }>();

/**
 * Helper to fetch categories directly from the D1 categories master table
 */
async function getD1Categories(db: D1Database): Promise<string[]> {
  try {
    const { results } = await db.prepare('SELECT name FROM categories ORDER BY display_order ASC, name ASC').all<{ name: string }>();
    const names = (results || []).map((r) => r.name);
    return ['All', ...names];
  } catch (err) {
    console.error('Failed to query categories table in D1:', err);
    return ['All', 'AI', 'SaaS', 'Developer Tools', 'Hiring', 'Quick Commerce', 'FinTech', 'EdTech', 'Web3', 'HealthTech'];
  }
}

/**
 * GET /api/categories
 * Returns dynamic list of category filter tags from D1 database categories master table
 */
leaderboardRoute.get('/categories', async (c) => {
  const categories = await getD1Categories(c.env.DB);
  return c.json({
    success: true,
    categories,
  });
});

/**
 * GET /api/leaderboard
 * Fetches company rankings, D1 live visitor metrics, dynamic categories, and stats
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

  // Aggregations & Dynamic Categories from D1 Database
  const countRes = await c.env.DB.prepare('SELECT COUNT(*) as count FROM companies').first<{ count: number }>();
  const sumRes = await c.env.DB.prepare('SELECT SUM(current_bid) as total FROM companies').first<{ total: number }>();
  const latestActivity = await c.env.DB.prepare('SELECT message FROM activity_logs ORDER BY created_at DESC LIMIT 1').first<ActivityLogRow>();
  const categories = await getD1Categories(c.env.DB);

  // Real Live Visitors from D1 page_views table (unique active IP hashes in last 3 minutes)
  const liveRes = await c.env.DB.prepare(`
    SELECT COUNT(DISTINCT ip_hash) as activeLiveCount 
    FROM page_views 
    WHERE created_at >= DATETIME('now', '-3 minutes')
  `).first<{ activeLiveCount: number }>();

  const liveVisitors = Math.max(1, liveRes?.activeLiveCount || 1);

  // Real Total Visitors from D1 page_views table (unique IP hashes across all time)
  const totalUniqueRes = await c.env.DB.prepare('SELECT COUNT(DISTINCT ip_hash) as uniqueCount FROM page_views').first<{ uniqueCount: number }>();
  const uniqueCount = totalUniqueRes?.uniqueCount || 0;

  const totalVisitorsFormatted = uniqueCount >= 1000
    ? `${(uniqueCount / 1000).toFixed(1)}k`
    : `${uniqueCount}`;

  return c.json({
    success: true,
    companies: results || [],
    categories,
    stats: {
      totalCompanies: countRes?.count || 0,
      totalBids: sumRes?.total || 0,
      liveVisitors,
      totalVisitors: totalVisitorsFormatted,
      totalUniqueVisitors: uniqueCount,
    },
    latestActivity: latestActivity?.message || (results && results.length > 0 ? `Live rank #1 is held by ${results[0].name}` : 'Leaderboard updated live'),
  });
});

export default leaderboardRoute;
