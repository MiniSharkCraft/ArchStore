/**
 * Argon2id password hashing cho Cloudflare Workers
 * Dùng @noble/hashes — pure TypeScript, không cần native bindings
 *
 * Parameters: m=8192 (8MB), t=3 passes, p=1 — ~20ms CPU, trong giới hạn CF Workers Paid
 * Nếu dùng free plan, giảm m=4096 hoặc t=2
 */

import { argon2id } from '@noble/hashes/argon2'
import { randomBytes } from '@noble/hashes/utils'

// t:2, m:512 (~512KB) — an toàn và đủ nhanh trong 10ms CPU limit của CF Workers free plan
const ARGON2_OPTS = { t: 2, m: 512, p: 1, dkLen: 32 }

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Hash một password → string dạng "argon2id:saltHex:hashHex"
 * Synchronous (Argon2 từ @noble/hashes là sync)
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = argon2id(new TextEncoder().encode(password), salt, ARGON2_OPTS)
  return `argon2id:${bytesToHex(salt)}:${bytesToHex(hash)}`
}

/**
 * Xác minh password với constant-time comparison để chống timing attacks
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'argon2id') return false

  const salt = hexToBytes(parts[1])
  const expected = hexToBytes(parts[2])
  const actual = argon2id(new TextEncoder().encode(password), salt, ARGON2_OPTS)

  if (actual.length !== expected.length) return false

  // Constant-time comparison — ngăn timing attacks
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= actual[i] ^ expected[i]
  }
  return diff === 0
}

/** Tạo random hex string an toàn */
export function generateSecureToken(bytes = 32): string {
  return bytesToHex(randomBytes(bytes))
}
