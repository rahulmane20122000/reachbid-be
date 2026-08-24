import { Context, Next } from 'hono';

const rateLimitStore = new Map<string, { count: number; expiresAt: number }>();

/**
 * IP Sliding Window Rate Limiter Middleware
 */
export function rateLimiterMiddleware(limit = 20, windowSeconds = 60) {
  return async (c: Context, next: Next) => {
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();
    const record = rateLimitStore.get(clientIp);

    if (!record || record.expiresAt < now) {
      rateLimitStore.set(clientIp, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return next();
    }

    if (record.count >= limit) {
      return c.json(
        {
          success: false,
          error: 'Too many requests. Rate limit exceeded. Please try again later.',
        },
        429
      );
    }

    record.count += 1;
    return next();
  };
}
