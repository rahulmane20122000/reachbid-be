import { Hono } from 'hono';
import { Env, CompanyRow } from '../types/env';
import { sanitizeString } from '../middleware/security';
import { rateLimiterMiddleware } from '../middleware/rateLimiter';

const bidsRoute = new Hono<{ Bindings: Env }>();

/**
 * POST /api/bids/outbid
 * Outbid functionality: Increases total bid amount for an existing company in Cloudflare D1
 * Updates current_bid, rank_change, records bid entry, and posts live activity log entry.
 */
bidsRoute.post('/bids/outbid', rateLimiterMiddleware(20, 60), async (c) => {
  const body: any = await c.req.json();
  const companyId = sanitizeString(body.company_id || body.companyId, 100);
  const newBidAmount = Number(body.bid_amount || body.bidAmount) || 0;

  if (!companyId) {
    return c.json({ success: false, error: 'Target company ID is required.' }, 400);
  }

  // 1. Fetch existing company from D1
  const company = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(companyId).first<CompanyRow>();

  if (!company) {
    return c.json({ success: false, error: 'Target company not found.' }, 404);
  }

  // 2. Validate new total bid amount is higher than current bid
  if (newBidAmount <= company.current_bid) {
    return c.json({
      success: false,
      error: `New bid must be greater than current bid (₹${company.current_bid.toLocaleString('en-IN')}).`,
    }, 400);
  }

  // 3. Record bid entry in D1 bids table
  const bidId = 'b_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  await c.env.DB.prepare('INSERT INTO bids (id, company_id, amount, payment_status) VALUES (?, ?, ?, ?)').bind(
    bidId,
    companyId,
    newBidAmount,
    'completed'
  ).run();

  // 4. Update company current_bid and rank_change in D1 companies table
  await c.env.DB.prepare('UPDATE companies SET current_bid = ?, rank_change = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(
    newBidAmount,
    '🚀 Outbid',
    companyId
  ).run();

  // 5. Insert activity log entry in D1 activity_logs table
  const actId = 'act_' + Date.now().toString(36);
  await c.env.DB.prepare('INSERT INTO activity_logs (id, message, event_type) VALUES (?, ?, ?)').bind(
    actId,
    `Outbid alert! '${company.name}' boosted bid to ₹${newBidAmount.toLocaleString('en-IN')}!`,
    'outbid'
  ).run();

  return c.json({
    success: true,
    message: `Successfully outbid! '${company.name}' is now bid at ₹${newBidAmount.toLocaleString('en-IN')}.`,
    company: {
      ...company,
      current_bid: newBidAmount,
      rank_change: '🚀 Outbid',
    },
  });
});

/**
 * POST /api/bids/create-order
 * Calls official Razorpay Orders API (https://api.razorpay.com/v1/orders) with hard-verified test credentials
 */
bidsRoute.post('/bids/create-order', rateLimiterMiddleware(15, 60), async (c) => {
  const body: any = await c.req.json();
  const amount = Number(body.amount) || 0;

  if (amount < 10) {
    return c.json({ success: false, error: 'Outbid amount must be at least ₹10.' }, 400);
  }

  const keyId = c.env.RAZORPAY_KEY_ID || 'rzp_test_TTckTI7PPdV4Ga';
  const keySecret = c.env.RAZORPAY_KEY_SECRET || 'xSjcSt0K8W2XSXwrocBBmVfl';
  const amountInPaise = Math.round(amount * 100);
  const receiptId = 'rec_' + Date.now().toString(36);

  try {
    const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`);
    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: receiptId,
      }),
    });

    const resText = await razorpayRes.text();
    let orderData: any = {};
    try {
      orderData = JSON.parse(resText);
    } catch {
      // Ignore parse error
    }

    if (!razorpayRes.ok || !orderData.id) {
      console.error('Razorpay order creation error:', razorpayRes.status, resText);
      return c.json({
        success: false,
        error: orderData?.error?.description || `Razorpay order creation failed (${razorpayRes.status})`,
      }, 400);
    }

    return c.json({
      success: true,
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId,
    });
  } catch (err: any) {
    console.error('Razorpay API exception:', err);
    return c.json({
      success: false,
      error: err.message || 'Failed to connect to Razorpay payment server',
    }, 500);
  }
});

export default bidsRoute;
