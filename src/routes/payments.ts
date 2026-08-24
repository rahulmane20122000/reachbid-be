import { Hono } from 'hono';
import { Env } from '../types/env';
import { rateLimiterMiddleware } from '../middleware/rateLimiter';

const paymentsRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/payments/log
 * Logs a payment event (pending, success, failed, cancelled) into payment_logs table in Cloudflare D1.
 * Called from Next.js frontend after Razorpay order creation and on payment success/failure.
 */
paymentsRoute.post('/payments/log', rateLimiterMiddleware(30, 60), async (c) => {
  try {
    const body: any = await c.req.json();

    const {
      company_id,
      company_name,
      razorpay_order_id,
      razorpay_payment_id,
      amount,
      currency = 'INR',
      status = 'pending',         // pending | success | failed | cancelled
      payment_type = 'outbid',    // outbid | new_listing
      error_description,
    } = body;

    if (!razorpay_order_id) {
      return c.json({ success: false, error: 'razorpay_order_id is required' }, 400);
    }
    if (!company_name) {
      return c.json({ success: false, error: 'company_name is required' }, 400);
    }
    if (!amount || Number(amount) < 1) {
      return c.json({ success: false, error: 'amount is required' }, 400);
    }

    // Amount arrives in paise from Razorpay (e.g. 14000 = ₹140) — store as rupees
    const amountInRupees = Math.round(Number(amount) / 100);

    const logId = 'pay_log_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    // If a log with same razorpay_order_id exists, update it instead of inserting duplicate
    const existing = await c.env.DB.prepare(
      'SELECT id FROM payment_logs WHERE razorpay_order_id = ?'
    ).bind(razorpay_order_id).first<{ id: string }>();

    if (existing) {
      await c.env.DB.prepare(`
        UPDATE payment_logs
        SET
          status = ?,
          razorpay_payment_id = ?,
          error_description = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE razorpay_order_id = ?
      `).bind(
        status,
        razorpay_payment_id || null,
        error_description || null,
        razorpay_order_id
      ).run();

      return c.json({ success: true, id: existing.id, action: 'updated' });
    }

    // Insert new payment log
    await c.env.DB.prepare(`
      INSERT INTO payment_logs (
        id,
        company_id,
        company_name,
        razorpay_order_id,
        razorpay_payment_id,
        amount,
        currency,
        status,
        payment_type,
        error_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      logId,
      company_id || null,
      company_name,
      razorpay_order_id,
      razorpay_payment_id || null,
      amountInRupees,
      currency,
      status,
      payment_type,
      error_description || null
    ).run();

    return c.json({ success: true, id: logId, action: 'created' });
  } catch (err: any) {
    console.error('Payment log error:', err);
    return c.json({ success: false, error: err.message || 'Failed to log payment' }, 500);
  }
});

/**
 * GET /api/payments/logs
 * Returns all payment logs (admin view), sorted by newest first.
 */
paymentsRoute.get('/payments/logs', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        id,
        company_id,
        company_name,
        razorpay_order_id,
        razorpay_payment_id,
        amount,
        currency,
        status,
        payment_type,
        error_description,
        created_at,
        updated_at
      FROM payment_logs
      ORDER BY created_at DESC
      LIMIT 100
    `).all();

    return c.json({ success: true, payments: results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default paymentsRoute;
