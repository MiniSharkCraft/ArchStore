/**
 * ArchStore Cloudflare Worker API
 * 
 * Đây là "cầu nối" giữa ArchStore Desktop App và Cloudflare D1 (SQLite).
 * Deploy: wrangler deploy
 * 
 * Routes:
 *   GET  /ratings/:pkgName       → Lấy rating + reviews của một package
 *   POST /reviews                → Đăng review mới
 *   POST /votes                  → Like/dislike một review
 *   POST /replies                → Maintainer phản hồi review
 *   GET  /health                 → Health check
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { rateLimiter } from './middleware/rateLimiter'
import { apiKeyAuth } from './middleware/apiKey'
import { sanitize } from './utils/sanitize'
import { auth } from './auth'
import { getAuthUser } from './utils/jwt'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface Env {
  DB: D1Database
  ALLOWED_ORIGINS: string
  JWT_SECRET: string
  ARCHSTORE_API_KEY: string
  RESEND_API_KEY: string
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  OAUTH_CALLBACK_BASE_URL: string
}

interface Review {
  id: number
  pkg_name: string
  username: string
  rating: number
  comment: string
  created_at: string
  likes: number
  dislikes: number
  replies: Reply[]
}

interface Reply {
  id: number
  review_id: number
  author: string
  content: string
  created_at: string
}

interface PackageRating {
  pkg_name: string
  average: number
  total_votes: number
  distribution: { stars: number; count: number }[]
  reviews: Review[]
}

// ─────────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>()

// CORS - chỉ cho phép request từ Wails app (electron-like origin)
app.use('*', cors({
  origin: (origin) => {
    // Wails app sẽ gửi request với origin 'wails://localhost' hoặc empty
    const allowed = ['wails://localhost', 'http://localhost:5173']
    if (!origin || allowed.includes(origin)) return origin || '*'
    return null
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-App-Version', 'Authorization', 'X-Api-Key'],
}))

// API Key auth — bảo vệ tất cả routes (trừ /health)
// Secret được set qua: wrangler secret put ARCHSTORE_API_KEY
app.use('*', apiKeyAuth)

// ─────────────────────────────────────────────
// GET /health — public, không cần API key
// ─────────────────────────────────────────────

// Mount auth routes
app.route('/auth', auth)

app.get('/health', (c) => {
  return c.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() })
})


// ─────────────────────────────────────────────
// GET /ratings/:pkgName
// ─────────────────────────────────────────────

app.get('/ratings/:pkgName', async (c) => {
  const pkgName = sanitizePackageName(c.req.param('pkgName'))
  if (!pkgName) return c.json({ error: 'Tên package không hợp lệ' }, 400)

  // Optional auth — không bắt buộc, chỉ để trả về trạng thái user
  const payload = await getAuthUser(c.req.header('Authorization'), c.env.JWT_SECRET).catch(() => null)

  try {
    const ratingResult = await c.env.DB.prepare(`
      SELECT pkg_name, ROUND(AVG(rating), 2) as average, COUNT(*) as total_votes
      FROM reviews WHERE pkg_name = ? GROUP BY pkg_name
    `).bind(pkgName).first<{ pkg_name: string; average: number; total_votes: number }>()

    if (!ratingResult) {
      return c.json({ pkg_name: pkgName, average: 0, total_votes: 0, distribution: [], reviews: [], user_review_id: null })
    }

    const distResult = await c.env.DB.prepare(`
      SELECT rating as stars, COUNT(*) as count
      FROM reviews WHERE pkg_name = ? GROUP BY rating ORDER BY rating DESC
    `).bind(pkgName).all<{ stars: number; count: number }>()

    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50)
    const offset = (page - 1) * limit

    const reviewsResult = await c.env.DB.prepare(`
      SELECT id, pkg_name, username, user_id, rating, comment, created_at, likes, dislikes
      FROM reviews WHERE pkg_name = ? ORDER BY likes DESC, created_at DESC LIMIT ? OFFSET ?
    `).bind(pkgName, limit, offset).all<Omit<Review, 'replies'> & { user_id: number | null }>()

    // Xác định review của user hiện tại + những review đã vote
    let userReviewId: number | null = null
    let userVotedSet = new Set<number>()

    if (payload) {
      const myReview = await c.env.DB.prepare(
        'SELECT id FROM reviews WHERE pkg_name = ? AND user_id = ?'
      ).bind(pkgName, payload.sub).first<{ id: number }>()
      userReviewId = myReview?.id ?? null

      if (reviewsResult.results.length > 0) {
        const voteRows = await c.env.DB.prepare(
          `SELECT review_id FROM votes WHERE vote_key LIKE ?`
        ).bind(`user_${payload.sub}:%`).all<{ review_id: number }>()
        userVotedSet = new Set(voteRows.results.map(v => v.review_id))
      }
    }

    const reviews: Review[] = await Promise.all(
      reviewsResult.results.map(async (review) => {
        const repliesResult = await c.env.DB.prepare(
          'SELECT id, review_id, author, content, created_at FROM replies WHERE review_id = ? ORDER BY created_at ASC'
        ).bind(review.id).all<Reply>()
        return {
          ...review,
          is_mine: payload ? review.user_id === payload.sub : false,
          user_voted: userVotedSet.has(review.id),
          replies: repliesResult.results,
        }
      })
    )

    return c.json({
      pkg_name: pkgName,
      average: ratingResult.average,
      total_votes: ratingResult.total_votes,
      distribution: distResult.results,
      reviews,
      user_review_id: userReviewId,
    })
  } catch (err) {
    console.error('[GET /ratings] Error:', err)
    return c.json({ error: 'Lỗi server nội bộ' }, 500)
  }
})

// ─────────────────────────────────────────────
// POST /reviews
// ─────────────────────────────────────────────

app.post('/reviews', async (c) => {
  // Bắt buộc đăng nhập
  const payload = await getAuthUser(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Cần đăng nhập để gửi đánh giá' }, 401)

  let body: { pkg_name: string; rating: number; comment: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Body không hợp lệ' }, 400) }

  const pkgName = sanitizePackageName(body.pkg_name)
  if (!pkgName) return c.json({ error: 'Tên package không hợp lệ' }, 400)
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)
    return c.json({ error: 'Rating phải là số nguyên từ 1-5' }, 400)
  if (!body.comment || body.comment.trim().length < 10)
    return c.json({ error: 'Bình luận phải có ít nhất 10 ký tự' }, 400)
  if (body.comment.length > 2000) return c.json({ error: 'Bình luận quá dài (tối đa 2000 ký tự)' }, 400)

  const comment = sanitize(body.comment, { maxLength: 2000, allowNewlines: true })

  try {
    // 1 review/package/user — check theo user_id (không thể giả mạo)
    const existing = await c.env.DB.prepare(
      'SELECT id FROM reviews WHERE pkg_name = ? AND user_id = ?'
    ).bind(pkgName, payload.sub).first()
    if (existing) return c.json({ error: 'Bạn đã đánh giá package này rồi' }, 409)

    // Rate limit: tối đa 5 reviews trong 24h per user
    const recentCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM reviews WHERE user_id = ? AND created_at > datetime('now', '-1 day')"
    ).bind(payload.sub).first<{ cnt: number }>()
    if ((recentCount?.cnt ?? 0) >= 5)
      return c.json({ error: 'Bạn đã gửi quá nhiều đánh giá hôm nay. Thử lại sau 24 giờ.' }, 429)

    const result = await c.env.DB.prepare(`
      INSERT INTO reviews (pkg_name, username, user_id, rating, comment, created_at, likes, dislikes)
      VALUES (?, ?, ?, ?, ?, datetime('now'), 0, 0)
    `).bind(pkgName, payload.username, payload.sub, body.rating, comment).run()

    return c.json({ success: true, id: result.meta.last_row_id, message: 'Đánh giá đã được ghi nhận!' }, 201)
  } catch (err) {
    console.error('[POST /reviews] Error:', err)
    return c.json({ error: 'Lỗi server nội bộ' }, 500)
  }
})

// ─────────────────────────────────────────────
// POST /votes
// ─────────────────────────────────────────────

app.post('/votes', async (c) => {
  // Bắt buộc đăng nhập — vote theo user_id, không thể bypass bằng VPN/proxy
  const payload = await getAuthUser(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Cần đăng nhập để vote' }, 401)

  let body: { review_id: number; vote_type: 'like' | 'dislike' }
  try { body = await c.req.json() } catch { return c.json({ error: 'Body không hợp lệ' }, 400) }

  if (!Number.isInteger(body.review_id) || body.review_id <= 0)
    return c.json({ error: 'review_id không hợp lệ' }, 400)
  if (body.vote_type !== 'like' && body.vote_type !== 'dislike')
    return c.json({ error: 'vote_type phải là "like" hoặc "dislike"' }, 400)

  try {
    // Không vote bài của chính mình
    const review = await c.env.DB.prepare('SELECT user_id FROM reviews WHERE id = ?')
      .bind(body.review_id).first<{ user_id: number | null }>()
    if (!review) return c.json({ error: 'Review không tồn tại' }, 404)
    if (review.user_id === payload.sub) return c.json({ error: 'Không thể vote đánh giá của chính mình' }, 403)

    // Vote key dùng user_id — mỗi account chỉ vote 1 lần/review
    const voteKey = `user_${payload.sub}:${body.review_id}`
    const existing = await c.env.DB.prepare('SELECT id FROM votes WHERE vote_key = ?').bind(voteKey).first()
    if (existing) return c.json({ error: 'Bạn đã vote rồi' }, 409)

    await c.env.DB.prepare(
      'INSERT INTO votes (vote_key, review_id, vote_type, created_at) VALUES (?, ?, ?, datetime("now"))'
    ).bind(voteKey, body.review_id, body.vote_type).run()

    const column = body.vote_type === 'like' ? 'likes' : 'dislikes'
    await c.env.DB.prepare(`UPDATE reviews SET ${column} = ${column} + 1 WHERE id = ?`).bind(body.review_id).run()

    return c.json({ success: true })
  } catch (err) {
    console.error('[POST /votes] Error:', err)
    return c.json({ error: 'Lỗi server nội bộ' }, 500)
  }
})

// ─────────────────────────────────────────────
// POST /replies
// ─────────────────────────────────────────────

app.post('/replies', async (c) => {
  // TODO: Thêm maintainer authentication (JWT hoặc API key)
  let body: { review_id: number; author: string; content: string }
  
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Body không hợp lệ' }, 400)
  }

  if (!Number.isInteger(body.review_id) || !body.author || !body.content) {
    return c.json({ error: 'Thiếu dữ liệu bắt buộc' }, 400)
  }

  const author = sanitize(body.author, { maxLength: 50 })
  const content = sanitize(body.content, { maxLength: 1000, allowNewlines: true })

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO replies (review_id, author, content, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).bind(body.review_id, author, content).run()

    return c.json({ success: true, id: result.meta.last_row_id }, 201)
  } catch (err) {
    console.error('[POST /replies] Error:', err)
    return c.json({ error: 'Lỗi server nội bộ' }, 500)
  }
})

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function sanitizePackageName(name: string | undefined): string | null {
  if (!name) return null
  // Arch package name: chỉ cho phép a-z, A-Z, 0-9, -, _, ., +, @
  const clean = name.replace(/[^a-zA-Z0-9\-_.+@]/g, '')
  if (clean.length === 0 || clean.length > 255) return null
  return clean
}


export default app
