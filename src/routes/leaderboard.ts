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
 * Helper to dynamically derive official 128px high-res favicon/logo URL from website domain
 */
function deriveLogoUrl(websiteUrl: string, existingLogo?: string | null): string | null {
  if (existingLogo && existingLogo.trim().length > 0) {
    return existingLogo;
  }
  if (!websiteUrl || websiteUrl.trim().length === 0) {
    return null;
  }
  try {
    const formattedUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    const hostname = new URL(formattedUrl).hostname.replace(/^www\./, '');
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  } catch (err) {
    return null;
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
 * Fetches company rankings with full pagination, multi-parameter filtering, and 30-minute dynamic 'New' tag expiration
 */
leaderboardRoute.get('/leaderboard', async (c) => {
  // Query Parameters
  const category = c.req.query('category');
  const search = c.req.query('search') || c.req.query('q');
  const sort = c.req.query('sort') || 'bid';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || c.req.query('pageSize') || '20', 10)));
  const offset = (page - 1) * limit;

  // Build dynamic SQL conditions
  const conditions: string[] = [];
  const params: any[] = [];

  if (category && category.trim() !== '' && category.toLowerCase() !== 'all') {
    conditions.push('LOWER(category) = LOWER(?)');
    params.push(category.trim());
  }

  if (search && search.trim() !== '') {
    conditions.push('(LOWER(name) LIKE LOWER(?) OR LOWER(tagline) LIKE LOWER(?))');
    const searchPattern = `%${search.trim().toLowerCase()}%`;
    params.push(searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Determine sorting order
  let orderByClause = 'ORDER BY current_bid DESC, clicks DESC';
  if (sort === 'clicks' || sort === 'most_clicked') {
    orderByClause = 'ORDER BY clicks DESC, current_bid DESC';
  } else if (sort === 'newest') {
    orderByClause = 'ORDER BY created_at DESC';
  }

  // 1. Query Total Matching Companies Count for Pagination
  const countSql = `SELECT COUNT(*) as filteredCount FROM companies ${whereClause}`;
  const countStmt = c.env.DB.prepare(countSql).bind(...params);
  const filteredCountRes = await countStmt.first<{ filteredCount: number }>();
  const totalFilteredCompanies = filteredCountRes?.filteredCount || 0;

  // 2. Fetch Paginated Company Results
  const dataSql = `SELECT * FROM companies ${whereClause} ${orderByClause} LIMIT ? OFFSET ?`;
  const dataStmt = c.env.DB.prepare(dataSql).bind(...params, limit, offset);
  const { results } = await dataStmt.all<CompanyRow>();

  const nowMs = Date.now();

  // Dynamically resolve high-res company logo URLs and 30-minute 'New' tag expiration logic
  const companies = (results || []).map((company, index) => {
    const overallRank = offset + index + 1;
    const createdAtMs = company.created_at ? new Date(company.created_at).getTime() : 0;
    const ageInMinutes = createdAtMs > 0 ? (nowMs - createdAtMs) / (1000 * 60) : 999;
    const isWithin30Min = ageInMinutes >= 0 && ageInMinutes <= 30;

    // Rank #1 (overallRank === 1) keeps 'New' tag if created recently or marked is_new.
    // Rank #2+ ONLY shows 'New' tag if created within the last 30 minutes (ageInMinutes <= 30).
    const showNewTag = (overallRank === 1 && (company.is_new === 1 || isWithin30Min)) || isWithin30Min;

    return {
      ...company,
      is_new: showNewTag ? 1 : 0,
      logo_url: deriveLogoUrl(company.website_url, company.logo_url),
    };
  });

  const totalPages = Math.ceil(totalFilteredCompanies / limit) || 1;

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
    companies,
    categories,
    pagination: {
      page,
      limit,
      totalCompanies: totalFilteredCompanies,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    stats: {
      totalCompanies: countRes?.count || 0,
      totalBids: sumRes?.total || 0,
      liveVisitors,
      totalVisitors: totalVisitorsFormatted,
      totalUniqueVisitors: uniqueCount,
    },
    latestActivity: latestActivity?.message || (companies && companies.length > 0 ? `Live rank #1 is held by ${companies[0].name}` : 'Leaderboard updated live'),
  });
});

export default leaderboardRoute;
