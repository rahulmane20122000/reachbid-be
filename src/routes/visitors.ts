import { Hono } from 'hono';
import { Env } from '../types/env';
import { sanitizeString } from '../middleware/security';

const visitorsRoute = new Hono<{ Bindings: Env }>();

/**
 * Parses User-Agent string to detect Device Type, Browser, and OS
 */
function parseUserAgent(uaString: string): { device_type: string; browser: string; os: string } {
  if (!uaString) {
    return { device_type: 'Desktop', browser: 'Unknown', os: 'Unknown' };
  }

  const ua = uaString.toLowerCase();

  // Device Type
  let device_type = 'Desktop';
  if (/mobile|iphone|android|touch/i.test(ua) && !/ipad|tablet/i.test(ua)) {
    device_type = 'Mobile';
  } else if (/ipad|tablet|playbook|silk/i.test(ua)) {
    device_type = 'Tablet';
  }

  // OS Detection
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';

  // Browser Detection
  let browser = 'Unknown';
  if (ua.includes('edg/') || ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';

  return { device_type, browser, os };
}

/**
 * Generates an anonymized SHA-256 hash from IP address for privacy-compliant unique visitor tracking
 */
async function hashIpAddress(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`reachbid_salt_${ip}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16);
}

/**
 * POST /api/visitors/ping
 * Logs visitor metadata (IP, IP Hash, User Agent, Device, Browser, OS, Country, City, Referrer) into D1
 */
visitorsRoute.post('/visitors/ping', async (c) => {
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
  const rawUserAgent = c.req.header('user-agent') || '';
  const country = c.req.header('cf-ipcountry') || 'US';
  const city = c.req.header('cf-ipcity') ? sanitizeString(c.req.header('cf-ipcity')!, 100) : 'Local';

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const referrer = body.referrer ? sanitizeString(body.referrer, 500) : c.req.header('referer') || '';
  const pageUrl = body.pageUrl ? sanitizeString(body.pageUrl, 500) : '/';
  const userAgentOverride = body.userAgent ? sanitizeString(body.userAgent, 500) : rawUserAgent;

  const { device_type, browser, os } = parseUserAgent(userAgentOverride || rawUserAgent);
  const ipHash = await hashIpAddress(clientIp);
  const pageViewId = 'pv_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

  // Asynchronously record visitor metadata in Cloudflare D1 without delaying API response
  c.executionCtx.waitUntil(
    c.env.DB.prepare(`
      INSERT INTO page_views (id, ip_address, ip_hash, user_agent, device_type, browser, os, country, city, referrer, page_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      pageViewId,
      clientIp,
      ipHash,
      sanitizeString(rawUserAgent || userAgentOverride, 300),
      device_type,
      browser,
      os,
      country,
      city,
      referrer,
      pageUrl
    ).run().catch((err) => console.error('Failed to insert page_view into D1:', err))
  );

  return c.json({
    success: true,
    ping: 'acknowledged',
    device: device_type,
    browser,
    os,
    country,
  });
});

/**
 * GET /api/visitors/stats
 * Returns dynamic Live Visitors (active in last 3m) and Total Visitors (unique IP hashes) from Cloudflare D1
 */
visitorsRoute.get('/visitors/stats', async (c) => {
  // 1. Live Visitors: Unique active visitors in the last 3 minutes
  const liveRes = await c.env.DB.prepare(`
    SELECT COUNT(DISTINCT ip_hash) as activeLiveCount 
    FROM page_views 
    WHERE created_at >= DATETIME('now', '-3 minutes')
  `).first<{ activeLiveCount: number }>();

  const liveVisitors = Math.max(1, liveRes?.activeLiveCount || 1);

  // 2. Total Unique Visitors (unique IP hashes) & Total Page Views
  const uniqueRes = await c.env.DB.prepare('SELECT COUNT(DISTINCT ip_hash) as uniqueCount, COUNT(*) as totalViews FROM page_views').first<{ uniqueCount: number; totalViews: number }>();
  const totalUniqueCount = uniqueRes?.uniqueCount || 0;
  const totalViews = uniqueRes?.totalViews || 0;

  // Format Total Visitors (e.g. 12.4k or integer)
  const totalVisitorsFormatted = totalUniqueCount >= 1000
    ? `${(totalUniqueCount / 1000).toFixed(1)}k`
    : `${totalUniqueCount}`;

  // 3. Metadata Breakdowns (Device Types & Browsers)
  const devicesRes = await c.env.DB.prepare('SELECT device_type, COUNT(*) as count FROM page_views GROUP BY device_type').all<{ device_type: string; count: number }>();
  const browsersRes = await c.env.DB.prepare('SELECT browser, COUNT(*) as count FROM page_views GROUP BY browser ORDER BY count DESC LIMIT 5').all<{ browser: string; count: number }>();

  return c.json({
    success: true,
    stats: {
      liveVisitors,
      totalVisitors: totalVisitorsFormatted,
      totalUniqueVisitors: totalUniqueCount,
      totalPageViews: totalViews,
      deviceBreakdown: devicesRes?.results || [],
      topBrowsers: browsersRes?.results || [],
    },
  });
});

export default visitorsRoute;
