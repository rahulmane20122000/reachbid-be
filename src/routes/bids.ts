import { Hono } from 'hono';
import { Env } from '../types/env';
import { rateLimiterMiddleware } from '../middleware/rateLimiter';

const bidsRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/bids/create-order
 * Generates Razorpay payment order payload
 */
bidsRoute.post('/bids/create-order', rateLimiterMiddleware(15, 60), async (c) => {
  const body: any = await c.req.json();
  const amount = Number(body.amount) || 0;

  if (amount < 10) {
    return c.json({ success: false, error: 'Outbid amount must be at least ₹10.' }, 400);
  }

  const orderId = 'order_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

  return c.json({
    success: true,
    orderId,
    amount: Math.round(amount * 100),
    currency: 'INR',
    keyId: c.env.RAZORPAY_KEY_ID || 'rzp_test_reachbid_demo',
  });
});

export default bidsRoute;
