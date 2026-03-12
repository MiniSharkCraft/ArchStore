/**
 * API Key middleware — bảo vệ tất cả endpoints khỏi bị dùng trái phép.
 *
 * Cách hoạt động:
 *   - Worker đọc secret ARCHSTORE_API_KEY từ wrangler secrets (không có trong source)
 *   - Desktop app gửi header X-Api-Key với giá trị tương ứng
 *   - So sánh bằng timing-safe để chống timing attack
 *
 * Nếu ARCHSTORE_API_KEY chưa được set (môi trường dev local),
 * middleware cho request đi qua để không block development.
 */

import type { Context, Next } from 'hono'

// Routes không cần API key
const PUBLIC_PATHS = ['/health']

export async function apiKeyAuth(c: Context, next: Next) {
  // Bypass cho public routes
  if (PUBLIC_PATHS.some(p => c.req.path === p)) return next()

  const expected = (c.env as any).ARCHSTORE_API_KEY as string | undefined

  // Nếu chưa cấu hình secret (dev local), bỏ qua kiểm tra
  if (!expected) {
    return next()
  }

  const provided = c.req.header('X-Api-Key') ?? ''

  // Timing-safe comparison bằng Web Crypto API
  if (!(await timingSafeEqual(provided, expected))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return next()
}

/**
 * So sánh hai chuỗi theo thời gian hằng định để chống timing attack.
 * Dùng HMAC-SHA256 với key ngẫu nhiên mỗi request.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(a)),
    crypto.subtle.sign('HMAC', key, enc.encode(b)),
  ])
  const va = new Uint8Array(sigA)
  const vb = new Uint8Array(sigB)
  if (va.length !== vb.length) return false
  let diff = 0
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i]
  return diff === 0
}
