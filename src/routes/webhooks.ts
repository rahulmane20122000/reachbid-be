import { Hono } from 'hono';
import { Env } from '../types/env';
import { verifyRazorpaySignature } from '../middleware/security';

const webhooksRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/webhooks/razorpay
 * Razorpay Webhook -> Cryptographic HMAC Verification -> Cloudflare D1 Rank Update
 */
webhooksRoute.post('/webhooks/razorpay', async (c) => {
  const signature = c.req.header('x-razorpay-signature');
  const rawBody = await c.req.text();
  const webhookSecret = c.env.RAZORPAY_WEBHOOK_SECRET;

  // Cryptographic HMAC-SHA256 Signature Verification
  if (webhookSecret && signature) {
    const isValid = await verifyRazorpaySignature('webhook', rawBody, signature, webhookSecret);
    if (!isValid) {
      return c.json({ success: false, error: 'Invalid Razorpay HMAC signature. Webhook rejected.' }, 401);
    }
  }

  const event: any = JSON.parse(rawBody);

  // When payment is captured, update company bid & rank in Cloudflare D1
  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    const companyId = payment.notes?.companyId;
    const amount = Math.round(payment.amount / 100);

    if (companyId && amount > 0) {
      // 1. Update company total sponsored bid in Cloudflare D1
      await c.env.DB.prepare('UPDATE companies SET current_bid = current_bid + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(
        amount,
        companyId
      ).run();

      // 2. Log bid entry in Cloudflare D1
      const bidId = 'b_' + Date.now().toString(36);
      await c.env.DB.prepare('INSERT INTO bids (id, company_id, amount, payment_id) VALUES (?, ?, ?, ?)').bind(
        bidId,
        companyId,
        amount,
        payment.id || 'pay_wh_' + Date.now()
      ).run();

      // 3. Log outbid activity in Cloudflare D1
      const company = await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(companyId).first<{ name: string }>();
      if (company) {
        const actId = 'act_' + Date.now().toString(36);
        await c.env.DB.prepare('INSERT INTO activity_logs (id, message, event_type) VALUES (?, ?, ?)').bind(
          actId,
          `Someone placed a ₹${amount.toLocaleString()} bid for '${company.name}'!`,
          'outbid'
        ).run();
      }
    }
  }

  return c.json({ success: true, status: 'ok' });
});

export default webhooksRoute;
