/**
 * HS256 JWT implementation dùng Web Crypto API (built-in trong CF Workers)
 * Không cần external dependencies
 */

const enc = new TextEncoder()
const dec = new TextDecoder()

function base64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64url(str: string): Uint8Array {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export interface JWTPayload {
  sub: number       // user ID
  username: string
  email: string
  avatar_url: string
  provider: string
  iat: number       // issued at (Unix)
  exp: number       // expiry (Unix)
}

export async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
  const header = base64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64url(enc.encode(JSON.stringify(payload)))
  const data = `${header}.${body}`

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return `${data}.${base64url(sig)}`
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['verify']
  )

  const valid = await crypto.subtle.verify(
    'HMAC', key,
    fromBase64url(parts[2]),
    enc.encode(`${parts[0]}.${parts[1]}`)
  )
  if (!valid) return null

  let payload: JWTPayload
  try {
    payload = JSON.parse(dec.decode(fromBase64url(parts[1])))
  } catch {
    return null
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

/** Lấy JWT từ Authorization header, trả null nếu không có hoặc invalid */
export async function getAuthUser(
  authHeader: string | undefined,
  secret: string
): Promise<JWTPayload | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  return verifyJWT(authHeader.slice(7), secret)
}
