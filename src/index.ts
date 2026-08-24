import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types/env';
import { securityHelmetMiddleware } from './middleware/security';
import leaderboardRoute from './routes/leaderboard';
import companiesRoute from './routes/companies';
import bidsRoute from './routes/bids';
import webhooksRoute from './routes/webhooks';
import clickRoute from './routes/click';

const app = new Hono<{ Bindings: Env }>();

// 1. Strict CORS Middleware
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.CORS_ALLOWED_ORIGINS
    ? c.env.CORS_ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'https://reachbid.lol'];

  const corsMiddleware = cors({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Razorpay-Signature'],
  });

  return corsMiddleware(c, next);
});

// 2. Helmet Security Headers Middleware (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
app.use('*', securityHelmetMiddleware);

// 3. Health & Status Check Endpoint
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'ReachBid Cloudflare Worker Backend',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  })
);

// 4. Mount Modular API Routes
app.route('/api', leaderboardRoute);
app.route('/api', companiesRoute);
app.route('/api', bidsRoute);
app.route('/api', webhooksRoute);
app.route('/api', clickRoute);

export default app;
