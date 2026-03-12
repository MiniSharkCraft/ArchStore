/**
 * HTML sanitize để chống XSS khi hiển thị content do user nhập.
 * D1 prepared statements đã chặn SQL injection — chỉ cần escape HTML.
 */

interface SanitizeOptions {
  maxLength?: number
  allowNewlines?: boolean
}

export function sanitize(input: string, opts: SanitizeOptions = {}): string {
  const { maxLength = 1000, allowNewlines = false } = opts

  // Escape HTML entities
  let out = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\x00/g, '') // strip null bytes

  if (!allowNewlines) {
    out = out.replace(/[\r\n]+/g, ' ')
  }

  if (out.length > maxLength) {
    out = out.slice(0, maxLength)
  }

  return out.trim()
}
