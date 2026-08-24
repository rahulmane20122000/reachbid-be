import { Hono } from 'hono';
import { Env } from '../types/env';

const clickRoute = new Hono<{ Bindings: Env }>();

/**
 * GET /api/click/:id
 * Increments click counter in Cloudflare D1 asynchronously & 302 redirects to company site
 */
clickRoute.get('/click/:id', async (c) => {
  const companyId = c.req.param('id');
  const company = await c.env.DB.prepare('SELECT website_url FROM companies WHERE id = ?').bind(companyId).first<{ website_url: string }>();

  if (company?.website_url) {
    // Asynchronously log click count in Cloudflare D1 without blocking redirect
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE companies SET clicks = clicks + 1 WHERE id = ?').bind(companyId).run()
    );

    return c.redirect(company.website_url, 302);
  }

  return c.redirect('/', 302);
});

export default clickRoute;
