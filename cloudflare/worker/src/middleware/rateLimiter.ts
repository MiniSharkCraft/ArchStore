/**
 * Rate limiter middleware dùng Cloudflare KV hoặc D1.
 * Vì không có KV binding, ta dùng D1 với table `rate_limits`.
 * Simple in-memory fallback nếu DB không có table đó.
 */

import type { Context, Next } from 'hono'

interface RateLimiterOptions {
  limit: number   // số request tối đa
  window: number  // tính bằng giây
}

export function rateLimiter(opts: RateLimiterOptions) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown'
    const key = `rl:${c.req.path}:${ip}`

    try {
      const db = (c.env as any).DB as D1Database | undefined
      if (db) {
        // Đảm bảo table tồn tại (graceful — không throw nếu đã có)
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS rate_limits (
            key TEXT PRIMARY KEY,
            count INTEGER NOT NULL DEFAULT 1,
            reset_at INTEGER NOT NULL
          )
        `).run()

        const now = Math.floor(Date.now() / 1000)
        const resetAt = now + opts.window

        const row = await db.prepare(
          'SELECT count, reset_at FROM rate_limits WHERE key = ?'
        ).bind(key).first<{ count: number; reset_at: number }>()

        if (!row || row.reset_at < now) {
          // Tạo mới hoặc reset
          await db.prepare(
            'INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)'
          ).bind(key, resetAt).run()
        } else if (row.count >= opts.limit) {
          return c.json(
            { error: 'Quá nhiều request. Vui lòng thử lại sau.' },
            429,
            { 'Retry-After': String(row.reset_at - now) }
          )
        } else {
          await db.prepare(
            'UPDATE rate_limits SET count = count + 1 WHERE key = ?'
          ).bind(key).run()
        }
      }
    } catch {
      // Nếu rate limiting lỗi, vẫn cho request đi qua
    }

    return next()
  }
}
