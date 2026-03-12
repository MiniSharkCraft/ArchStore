/**
 * Email service via Resend API (resend.com)
 * Cài: đăng ký tại resend.com → lấy API key → wrangler secret put RESEND_API_KEY
 *
 * Thay đổi SENDER_EMAIL bên dưới nếu bạn dùng domain riêng.
 */

const SENDER_EMAIL = 'ArchStore <noreply@archstore.dev>'
const RESEND_API = 'https://api.resend.com/emails'

interface EmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(opts: EmailOptions, apiKey: string): Promise<void> {
  if (!apiKey) throw new Error('RESEND_API_KEY chưa được cấu hình')

  const resp = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: SENDER_EMAIL,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Resend API lỗi: ${err}`)
  }
}

export function buildResetPasswordEmail(code: string, username: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:monospace">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:rgba(255,255,255,0.03);border:1px solid rgba(0,245,255,0.15);border-radius:12px">
    <div style="color:#00f5ff;font-size:20px;font-weight:bold;margin-bottom:8px">⬡ ArchStore</div>
    <h2 style="color:#dce8ff;margin:0 0 16px">Đặt lại mật khẩu</h2>
    <p style="color:rgba(220,235,255,0.7);margin:0 0 24px">
      Xin chào <strong style="color:#dce8ff">${username}</strong>, bạn đã yêu cầu đặt lại mật khẩu.
    </p>
    <p style="color:rgba(220,235,255,0.7);margin:0 0 12px">Mã xác nhận của bạn:</p>
    <div style="background:rgba(0,245,255,0.08);border:1px solid rgba(0,245,255,0.3);border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
      <span style="font-size:36px;letter-spacing:12px;color:#00f5ff;font-weight:bold">${code}</span>
    </div>
    <p style="color:rgba(220,235,255,0.4);font-size:12px;margin:0">
      ⏱ Mã có hiệu lực trong <strong>15 phút</strong>.<br>
      🔒 Không chia sẻ mã này cho bất kỳ ai.<br>
      Nếu bạn không yêu cầu, hãy bỏ qua email này.
    </p>
  </div>
</body>
</html>`
}

export function buildWelcomeEmail(username: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:monospace">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:rgba(255,255,255,0.03);border:1px solid rgba(0,245,255,0.15);border-radius:12px">
    <div style="color:#00f5ff;font-size:20px;font-weight:bold;margin-bottom:8px">⬡ ArchStore</div>
    <h2 style="color:#dce8ff;margin:0 0 16px">Chào mừng đến với ArchStore!</h2>
    <p style="color:rgba(220,235,255,0.7);margin:0 0 16px">
      Xin chào <strong style="color:#dce8ff">${username}</strong>!<br>
      Tài khoản của bạn đã được tạo thành công.
    </p>
    <p style="color:rgba(220,235,255,0.4);font-size:12px">
      Giờ bạn có thể đánh giá packages, vote và tham gia cộng đồng Arch Linux.
    </p>
  </div>
</body>
</html>`
}
