/**
 * Auth routes cho ArchStore Cloudflare Worker
 *
 * Routes:
 *   POST /auth/register           — Đăng ký tài khoản local
 *   POST /auth/login              — Đăng nhập
 *   POST /auth/logout             — Đăng xuất (revoke refresh token)
 *   POST /auth/refresh            — Làm mới JWT
 *   GET  /auth/me                 — Lấy thông tin user hiện tại
 *   POST /auth/forgot-password    — Gửi mã reset qua email
 *   POST /auth/reset-password     — Đặt lại mật khẩu bằng mã
 *   GET  /auth/discord            — Redirect sang Discord OAuth
 *   GET  /auth/discord/callback   — Discord OAuth callback
 *   GET  /auth/github             — Redirect sang GitHub OAuth
 *   GET  /auth/github/callback    — GitHub OAuth callback
 *   GET  /auth/poll/:state        — Desktop app poll kết quả OAuth
 */

import { Hono } from 'hono'
import { hashPassword, verifyPassword, generateSecureToken } from './utils/hash'
import { signJWT, verifyJWT, getAuthUser, type JWTPayload } from './utils/jwt'
import { sendEmail, buildResetPasswordEmail, buildWelcomeEmail } from './utils/email'

export interface AuthEnv {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY: string
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  OAUTH_CALLBACK_BASE_URL: string // URL public của worker, vd: https://archstore-api.workers.dev
}

const auth = new Hono<{ Bindings: AuthEnv }>()

const JWT_EXPIRY_SECS     = 3600        // 1 giờ
const REFRESH_EXPIRY_SECS = 30 * 86400  // 30 ngày
const RESET_CODE_TTL_MINS = 15
const MAX_LOGIN_ATTEMPTS  = 5
const LOCKOUT_MINS        = 15

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function generateOTP(): string {
  // 6-digit OTP an toàn với crypto
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(100000 + (arr[0] % 900000))
}

async function createTokenPair(
  user: Record<string, any>,
  env: AuthEnv
): Promise<{ jwt: string; refreshToken: string }> {
  const now = Math.floor(Date.now() / 1000)

  const jwt = await signJWT(
    {
      sub:        user.id,
      username:   user.username,
      email:      user.email || '',
      avatar_url: user.avatar_url || '',
      provider:   user.provider,
      iat:        now,
      exp:        now + JWT_EXPIRY_SECS,
    },
    env.JWT_SECRET
  )

  // Refresh token = random bytes, lưu hash vào DB
  const refreshToken = generateSecureToken(32)
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(refreshToken))
  const tokenHash = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_SECS * 1000).toISOString()
  await env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(user.id, tokenHash, expiresAt).run()

  return { jwt, refreshToken }
}

function sanitizeUser(user: Record<string, any>) {
  return {
    id:         user.id,
    username:   user.username,
    email:      user.email ?? null,
    avatar_url: user.avatar_url ?? null,
    provider:   user.provider,
    is_verified: user.is_verified,
    created_at:  user.created_at,
  }
}

async function upsertOAuthUser(
  db: D1Database,
  data: { provider: string; provider_id: string; username: string; email: string | null; avatar_url: string }
) {
  // Tìm bằng provider + provider_id
  let user = await db.prepare(
    'SELECT * FROM users WHERE provider = ? AND provider_id = ?'
  ).bind(data.provider, data.provider_id).first<Record<string, any>>()

  if (user) {
    await db.prepare(
      "UPDATE users SET avatar_url = ?, last_login_at = datetime('now') WHERE id = ?"
    ).bind(data.avatar_url, user.id).run()
    return { ...user, avatar_url: data.avatar_url }
  }

  // Nếu email đã tồn tại → link account
  if (data.email) {
    const emailUser = await db.prepare('SELECT * FROM users WHERE email = ?')
      .bind(data.email).first<Record<string, any>>()
    if (emailUser) {
      await db.prepare(
        "UPDATE users SET provider_id = ?, avatar_url = ?, last_login_at = datetime('now') WHERE id = ?"
      ).bind(data.provider_id, data.avatar_url, emailUser.id).run()
      return { ...emailUser, provider_id: data.provider_id, avatar_url: data.avatar_url }
    }
  }

  // Tạo username unique
  let username = data.username.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 28)
  const collision = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (collision) username = `${username}_${Math.floor(Math.random() * 9999)}`

  const result = await db.prepare(`
    INSERT INTO users (username, email, avatar_url, provider, provider_id, is_verified)
    VALUES (?, ?, ?, ?, ?, 1)
  `).bind(username, data.email, data.avatar_url, data.provider, data.provider_id).run()

  return db.prepare('SELECT * FROM users WHERE id = ?')
    .bind(result.meta.last_row_id).first<Record<string, any>>()
}

function oauthPage(success: boolean, message: string): string {
  const color  = success ? '#00f5ff' : '#ff4466'
  const icon   = success ? '✓' : '✗'
  const script = success ? '<script>setTimeout(()=>window.close(),2000)</script>' : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ArchStore Auth</title>
    <style>body{background:#0a0a14;color:${color};font-family:monospace;display:flex;
    align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
    p{color:rgba(220,235,255,0.5);font-size:13px}</style></head>
    <body><div><div style="font-size:48px">${icon}</div>
    <h2>${success ? 'Đăng nhập thành công!' : 'Đăng nhập thất bại'}</h2>
    <p>${message}</p>${script}</div></body></html>`
}

// ─────────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────────

auth.post('/register', async (c) => {
  let body: { username: string; email: string; password: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Body không hợp lệ' }, 400) }

  const { username, email, password } = body

  if (!username || username.trim().length < 3 || username.trim().length > 30)
    return c.json({ error: 'Username phải có 3–30 ký tự' }, 400)
  if (!/^[a-zA-Z0-9_-]+$/.test(username.trim()))
    return c.json({ error: 'Username chỉ được dùng chữ, số, _ và -' }, 400)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return c.json({ error: 'Email không hợp lệ' }, 400)
  if (!password || password.length < 8)
    return c.json({ error: 'Mật khẩu phải có ít nhất 8 ký tự' }, 400)
  if (password.length > 128)
    return c.json({ error: 'Mật khẩu quá dài' }, 400)

  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?'
  ).bind(username.trim(), email.toLowerCase()).first()
  if (existing) return c.json({ error: 'Username hoặc email đã được sử dụng' }, 409)

  const passwordHash = hashPassword(password)

  const result = await c.env.DB.prepare(`
    INSERT INTO users (username, email, password_hash, provider)
    VALUES (?, ?, ?, 'local')
  `).bind(username.trim(), email.toLowerCase(), passwordHash).run()

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(result.meta.last_row_id).first<Record<string, any>>()
  if (!user) return c.json({ error: 'Lỗi tạo tài khoản' }, 500)

  // Gửi welcome email (fire & forget — không fail request nếu email lỗi)
  if (c.env.RESEND_API_KEY) {
    c.executionCtx?.waitUntil(
      sendEmail(
        { to: email, subject: 'Chào mừng đến ArchStore!', html: buildWelcomeEmail(username.trim()) },
        c.env.RESEND_API_KEY
      ).catch(err => console.error('[register] welcome email:', err))
    )
  }

  const { jwt, refreshToken } = await createTokenPair(user, c.env)
  return c.json({ jwt, refresh_token: refreshToken, user: sanitizeUser(user) }, 201)
})

// ─────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────

auth.post('/login', async (c) => {
  let body: { login: string; password: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Body không hợp lệ' }, 400) }

  const { login, password } = body
  if (!login || !password) return c.json({ error: 'Thiếu thông tin đăng nhập' }, 400)

  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE (username = ? OR email = ?) AND provider = 'local' AND is_active = 1"
  ).bind(login.trim(), login.trim().toLowerCase()).first<Record<string, any>>()

  if (!user) return c.json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }, 401)

  // Kiểm tra tài khoản bị khóa
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const unlockTime = new Date(user.locked_until).toLocaleTimeString('vi-VN')
    return c.json({ error: `Tài khoản tạm thời bị khóa đến ${unlockTime}. Thử lại sau.` }, 423)
  }

  if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
    const attempts = (user.failed_attempts || 0) + 1
    const locked = attempts >= MAX_LOGIN_ATTEMPTS
    const lockedUntil = locked
      ? new Date(Date.now() + LOCKOUT_MINS * 60 * 1000).toISOString()
      : null

    await c.env.DB.prepare(
      'UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?'
    ).bind(attempts, lockedUntil, user.id).run()

    if (locked)
      return c.json({ error: `Sai mật khẩu quá nhiều. Tài khoản bị khóa ${LOCKOUT_MINS} phút.` }, 423)

    return c.json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' }, 401)
  }

  // Reset failed attempts
  await c.env.DB.prepare(
    "UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?"
  ).bind(user.id).run()

  const { jwt, refreshToken } = await createTokenPair(user, c.env)
  return c.json({ jwt, refresh_token: refreshToken, user: sanitizeUser(user) })
})

// ─────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────

auth.post('/logout', async (c) => {
  let body: { refresh_token?: string }
  try { body = await c.req.json() } catch { body = {} }

  if (body.refresh_token) {
    const hashBuf = await crypto.subtle.digest(
      'SHA-256', new TextEncoder().encode(body.refresh_token)
    )
    const hash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(hash).run()
  }

  return c.json({ success: true })
})

// ─────────────────────────────────────────────
// POST /auth/refresh
// ─────────────────────────────────────────────

auth.post('/refresh', async (c) => {
  let body: { refresh_token: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Body không hợp lệ' }, 400) }
  if (!body.refresh_token) return c.json({ error: 'Thiếu refresh token' }, 400)

  const hashBuf = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(body.refresh_token)
  )
  const hash = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const tokenRow = await c.env.DB.prepare(
    "SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > datetime('now')"
  ).bind(hash).first<Record<string, any>>()
  if (!tokenRow) return c.json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' }, 401)

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ? AND is_active = 1'
  ).bind(tokenRow.user_id).first<Record<string, any>>()
  if (!user) return c.json({ error: 'Tài khoản không tồn tại' }, 401)

  // Rotate — xóa token cũ
  await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(hash).run()

  const { jwt, refreshToken } = await createTokenPair(user, c.env)
  return c.json({ jwt, refresh_token: refreshToken, user: sanitizeUser(user) })
})

// ─────────────────────────────────────────────
// GET /auth/me
// ─────────────────────────────────────────────

auth.get('/me', async (c) => {
  const payload = await getAuthUser(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Chưa đăng nhập' }, 401)

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(payload.sub).first<Record<string, any>>()
  if (!user) return c.json({ error: 'Tài khoản không tồn tại' }, 404)

  return c.json(sanitizeUser(user))
})

// ─────────────────────────────────────────────
// POST /auth/forgot-password
// ─────────────────────────────────────────────

auth.post('/forgot-password', async (c) => {
  let body: { email: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Body không hợp lệ' }, 400) }

  const { email } = body
  if (!email) return c.json({ error: 'Email là bắt buộc' }, 400)

  // Luôn trả success để tránh email enumeration
  const user = await c.env.DB.prepare(
    "SELECT id, username FROM users WHERE email = ? AND provider = 'local'"
  ).bind(email.toLowerCase()).first<{ id: number; username: string }>()

  if (!user) {
    return c.json({ success: true, message: 'Nếu email tồn tại, chúng tôi đã gửi mã xác nhận.' })
  }

  // Invalidate mã cũ
  await c.env.DB.prepare(
    'UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0'
  ).bind(email.toLowerCase()).run()

  const code      = generateOTP()
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINS * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)'
  ).bind(email.toLowerCase(), code, expiresAt).run()

  try {
    await sendEmail(
      {
        to:      email,
        subject: 'Đặt lại mật khẩu ArchStore',
        html:    buildResetPasswordEmail(code, user.username),
      },
      c.env.RESEND_API_KEY
    )
  } catch (err) {
    console.error('[forgot-password] Email error:', err)
    return c.json({ error: 'Không thể gửi email. Kiểm tra cấu hình RESEND_API_KEY.' }, 500)
  }

  return c.json({ success: true, message: 'Mã xác nhận đã được gửi đến email của bạn.' })
})

// ─────────────────────────────────────────────
// POST /auth/reset-password
// ─────────────────────────────────────────────

auth.post('/reset-password', async (c) => {
  let body: { email: string; code: string; new_password: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Body không hợp lệ' }, 400) }

  const { email, code, new_password } = body
  if (!email || !code || !new_password) return c.json({ error: 'Thiếu thông tin' }, 400)
  if (new_password.length < 8) return c.json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự' }, 400)

  const reset = await c.env.DB.prepare(`
    SELECT id FROM password_resets
    WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
  `).bind(email.toLowerCase(), code.trim()).first<{ id: number }>()

  if (!reset) return c.json({ error: 'Mã xác nhận không hợp lệ hoặc đã hết hạn' }, 400)

  const passwordHash = hashPassword(new_password)

  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE email = ?"
  ).bind(passwordHash, email.toLowerCase()).run()

  await c.env.DB.prepare(
    'UPDATE password_resets SET used = 1 WHERE id = ?'
  ).bind(reset.id).run()

  // Revoke tất cả refresh tokens → buộc đăng nhập lại
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase()).first<{ id: number }>()
  if (user) {
    await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(user.id).run()
  }

  return c.json({ success: true, message: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.' })
})

// ─────────────────────────────────────────────
// GET /auth/discord  (step 1: redirect)
// ─────────────────────────────────────────────

auth.get('/discord', async (c) => {
  const state = c.req.query('state') || generateSecureToken(16)

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO oauth_states (state, expires_at) VALUES (?, datetime('now', '+10 minutes'))"
  ).bind(state).run()

  const params = new URLSearchParams({
    client_id:     c.env.DISCORD_CLIENT_ID,
    redirect_uri:  `${c.env.OAUTH_CALLBACK_BASE_URL}/auth/discord/callback`,
    response_type: 'code',
    scope:         'identify email',
    state,
  })

  return Response.redirect(`https://discord.com/api/oauth2/authorize?${params}`, 302)
})

// ─────────────────────────────────────────────
// GET /auth/discord/callback
// ─────────────────────────────────────────────

auth.get('/discord/callback', async (c) => {
  const code  = c.req.query('code')
  const state = c.req.query('state')

  if (!code || !state) return c.html(oauthPage(false, 'Thiếu code hoặc state.'), 400)

  try {
    const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     c.env.DISCORD_CLIENT_ID,
        client_secret: c.env.DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  `${c.env.OAUTH_CALLBACK_BASE_URL}/auth/discord/callback`,
      }),
    })
    const tokenData: any = await tokenResp.json()
    if (tokenData.error)
      return c.html(oauthPage(false, tokenData.error_description || tokenData.error), 400)

    const discordUser: any = await (
      await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
    ).json()

    const user = await upsertOAuthUser(c.env.DB, {
      provider:    'discord',
      provider_id: discordUser.id,
      username:    discordUser.username,
      email:       discordUser.email ?? null,
      avatar_url:  discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : '',
    })

    const { jwt, refreshToken } = await createTokenPair(user!, c.env)

    await c.env.DB.prepare(
      'UPDATE oauth_states SET jwt = ?, refresh_token = ? WHERE state = ?'
    ).bind(jwt, refreshToken, state).run()

    return c.html(oauthPage(true, 'Bạn có thể đóng tab này và quay lại ArchStore.'))
  } catch (err) {
    console.error('[discord/callback]', err)
    return c.html(oauthPage(false, 'Lỗi xác thực. Vui lòng thử lại.'), 500)
  }
})

// ─────────────────────────────────────────────
// GET /auth/github  (step 1: redirect)
// ─────────────────────────────────────────────

auth.get('/github', async (c) => {
  const state = c.req.query('state') || generateSecureToken(16)

  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO oauth_states (state, expires_at) VALUES (?, datetime('now', '+10 minutes'))"
  ).bind(state).run()

  const params = new URLSearchParams({
    client_id:    c.env.GITHUB_CLIENT_ID,
    redirect_uri: `${c.env.OAUTH_CALLBACK_BASE_URL}/auth/github/callback`,
    scope:        'user:email',
    state,
  })

  return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302)
})

// ─────────────────────────────────────────────
// GET /auth/github/callback
// ─────────────────────────────────────────────

auth.get('/github/callback', async (c) => {
  const code  = c.req.query('code')
  const state = c.req.query('state')

  if (!code || !state) return c.html(oauthPage(false, 'Thiếu code hoặc state.'), 400)

  try {
    const tokenData: any = await (
      await fetch('https://github.com/login/oauth/access_token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id:     c.env.GITHUB_CLIENT_ID,
          client_secret: c.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri:  `${c.env.OAUTH_CALLBACK_BASE_URL}/auth/github/callback`,
        }),
      })
    ).json()

    if (tokenData.error)
      return c.html(oauthPage(false, tokenData.error_description || tokenData.error), 400)

    const ghUser: any = await (
      await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'ArchStore/1.0' },
      })
    ).json()

    // Lấy email nếu profile không có
    let email: string | null = ghUser.email
    if (!email) {
      const emails: any[] = await (
        await fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'ArchStore/1.0' },
        })
      ).json()
      email = emails.find(e => e.primary && e.verified)?.email ?? emails[0]?.email ?? null
    }

    const user = await upsertOAuthUser(c.env.DB, {
      provider:    'github',
      provider_id: String(ghUser.id),
      username:    ghUser.login,
      email,
      avatar_url:  ghUser.avatar_url || '',
    })

    const { jwt, refreshToken } = await createTokenPair(user!, c.env)

    await c.env.DB.prepare(
      'UPDATE oauth_states SET jwt = ?, refresh_token = ? WHERE state = ?'
    ).bind(jwt, refreshToken, state).run()

    return c.html(oauthPage(true, 'Bạn có thể đóng tab này và quay lại ArchStore.'))
  } catch (err) {
    console.error('[github/callback]', err)
    return c.html(oauthPage(false, 'Lỗi xác thực. Vui lòng thử lại.'), 500)
  }
})

// ─────────────────────────────────────────────
// GET /auth/poll/:state  (desktop app polling)
// ─────────────────────────────────────────────

auth.get('/poll/:state', async (c) => {
  const state = c.req.param('state')

  const row = await c.env.DB.prepare(
    "SELECT jwt, refresh_token FROM oauth_states WHERE state = ? AND expires_at > datetime('now')"
  ).bind(state).first<{ jwt: string | null; refresh_token: string | null }>()

  if (!row) return c.json({ error: 'State không hợp lệ hoặc đã hết hạn' }, 404)
  if (!row.jwt) return c.json({ pending: true }, 202)   // OAuth chưa hoàn tất

  // Lấy user info để trả cùng JWT
  const payload = await verifyJWT(row.jwt, c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'Token không hợp lệ' }, 500)

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(payload.sub).first<Record<string, any>>()

  // Xóa state sau khi đọc (one-time use)
  await c.env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run()

  return c.json({ jwt: row.jwt, refresh_token: row.refresh_token, user: sanitizeUser(user!) })
})

export { auth }
