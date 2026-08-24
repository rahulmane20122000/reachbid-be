import { Hono } from 'hono';
import { Env } from '../types/env';

const clickRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/click/:id
 * Increments company click counter in Cloudflare D1 asynchronously for ALL link clicks (website, linkedin, instagram)
 * and 302 redirects to destination URL.
 */
clickRoute.get('/click/:id', async (c) => {
  const companyId = c.req.param('id');
  const target = c.req.query('target') || 'website';

  const company = await c.env.DB.prepare('SELECT website_url, linkedin_url, instagram_url FROM companies WHERE id = ?')
    .bind(companyId)
    .first<{ website_url: string; linkedin_url?: string | null; instagram_url?: string | null }>();

  if (company) {
    // Asynchronously log click count in Cloudflare D1 without blocking HTTP redirect
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE companies SET clicks = clicks + 1 WHERE id = ?').bind(companyId).run()
    );

    let destinationUrl = company.website_url;
    if (target === 'linkedin' && company.linkedin_url) {
      destinationUrl = company.linkedin_url;
    } else if (target === 'instagram' && company.instagram_url) {
      destinationUrl = company.instagram_url;
    }

    if (destinationUrl) {
      const redirectTarget = destinationUrl.startsWith('http') ? destinationUrl : `https://${destinationUrl}`;
      return c.redirect(redirectTarget, 302);
    }
  }

  return c.redirect('/', 302);
});

export default clickRoute;
