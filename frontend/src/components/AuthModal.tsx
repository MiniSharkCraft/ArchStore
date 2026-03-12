// frontend/src/components/AuthModal.tsx
// Modal đăng nhập / đăng ký / quên mật khẩu — đầy đủ tính năng

import { useState } from 'react'
import {
  LoginUser, RegisterUser, ForgotPassword, ResetPassword, InitOAuth,
} from '../../wailsjs/go/app/App'
import type { AuthUser } from '../types'

type Tab = 'login' | 'register' | 'forgot' | 'forgot-verify'

interface Props {
  onClose: () => void
  onSuccess: (user: AuthUser) => void
}

export function AuthModal({ onClose, onSuccess }: Props) {
  const [tab, setTab]         = useState<Tab>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  // Login
  const [loginInput, setLoginInput]   = useState('')
  const [loginPass, setLoginPass]     = useState('')
  const [showPass, setShowPass]       = useState(false)

  // Register
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail]       = useState('')
  const [regPass, setRegPass]         = useState('')
  const [regPassConf, setRegPassConf] = useState('')

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetCode, setResetCode]     = useState('')
  const [newPass, setNewPass]         = useState('')

  const clearMessages = () => { setError(''); setSuccess('') }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    if (!loginInput.trim() || !loginPass) { setError('Vui lòng điền đầy đủ thông tin'); return }

    setLoading(true)
    try {
      const user = await LoginUser(loginInput.trim(), loginPass)
      if (user) onSuccess(user)
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    if (!regUsername || !regEmail || !regPass || !regPassConf) {
      setError('Vui lòng điền đầy đủ thông tin'); return
    }
    if (regPass !== regPassConf) { setError('Mật khẩu xác nhận không khớp'); return }
    if (regPass.length < 8)     { setError('Mật khẩu phải có ít nhất 8 ký tự'); return }

    setLoading(true)
    try {
      const user = await RegisterUser(regUsername.trim(), regEmail.trim(), regPass)
      if (user) onSuccess(user)
    } catch (err: any) {
      setError(err.message || 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotSend(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    if (!forgotEmail.trim()) { setError('Vui lòng nhập email'); return }

    setLoading(true)
    try {
      await ForgotPassword(forgotEmail.trim())
      setSuccess('Mã xác nhận đã được gửi — kiểm tra email của bạn.')
      setTab('forgot-verify')
    } catch (err: any) {
      setError(err.message || 'Không thể gửi email')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotVerify(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    if (!resetCode.trim() || !newPass) { setError('Vui lòng điền đầy đủ'); return }
    if (newPass.length < 8) { setError('Mật khẩu mới phải có ít nhất 8 ký tự'); return }

    setLoading(true)
    try {
      await ResetPassword(forgotEmail.trim(), resetCode.trim(), newPass)
      setSuccess('Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.')
      setTimeout(() => { setTab('login'); clearMessages() }, 2000)
    } catch (err: any) {
      setError(err.message || 'Mã xác nhận không hợp lệ')
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuth(provider: 'discord' | 'github') {
    clearMessages()
    setLoading(true)
    try {
      await InitOAuth(provider)
      setSuccess(`Đang mở trình duyệt để đăng nhập qua ${provider === 'discord' ? 'Discord' : 'GitHub'}...`)
      // Kết quả sẽ được nhận qua Wails event "auth:login" trong App.tsx
      onClose()
    } catch (err: any) {
      setError(err.message || 'Không thể khởi động OAuth')
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 420 }}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <span style={{ color: 'var(--cyan)' }}>⬡</span> ArchStore
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: 20 }}>
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); clearMessages() }}
              style={{
                flex: 1, padding: '8px 0', fontSize: 12, border: 'none', cursor: 'pointer',
                background: 'transparent',
                color: tab === t ? 'var(--cyan)' : 'rgba(220,235,255,0.4)',
                borderBottom: tab === t ? '2px solid var(--cyan)' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s',
              }}>
              {t === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          ))}
        </div>

        {/* Error / Success */}
        {error && (
          <div style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid rgba(255,68,102,0.3)', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#ff4466' }}>
            ⚠ {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(0,245,255,0.07)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--cyan)' }}>
            ✓ {success}
          </div>
        )}

        {/* ── LOGIN ── */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Username hoặc Email</label>
              <input className="search-input" style={{ width: '100%' }}
                placeholder="archuser hoặc user@example.com"
                value={loginInput} onChange={e => setLoginInput(e.target.value)}
                autoComplete="username" />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Mật khẩu</label>
              <div style={{ position: 'relative' }}>
                <input className="search-input" style={{ width: '100%', paddingRight: 40 }}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={loginPass} onChange={e => setLoginPass(e.target.value)}
                  autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(220,235,255,0.4)', fontSize: 14 }}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <button type="button" onClick={() => { setTab('forgot'); clearMessages() }}
                style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--cyan)', cursor: 'pointer' }}>
                Quên mật khẩu?
              </button>
            </div>
            <button className="btn btn--primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
              {loading ? '...' : 'Đăng nhập'}
            </button>

            <OAuthSection loading={loading} onOAuth={handleOAuth} />
          </form>
        )}

        {/* ── REGISTER ── */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Username</label>
              <input className="search-input" style={{ width: '100%' }}
                placeholder="archuser (3-30 ký tự, a-z 0-9 _ -)"
                value={regUsername} onChange={e => setRegUsername(e.target.value)}
                maxLength={30} autoComplete="username" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Email</label>
              <input className="search-input" style={{ width: '100%' }}
                type="email" placeholder="user@example.com"
                value={regEmail} onChange={e => setRegEmail(e.target.value)}
                autoComplete="email" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Mật khẩu</label>
              <input className="search-input" style={{ width: '100%' }}
                type="password" placeholder="Ít nhất 8 ký tự"
                value={regPass} onChange={e => setRegPass(e.target.value)}
                autoComplete="new-password" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Xác nhận mật khẩu</label>
              <input className="search-input" style={{ width: '100%' }}
                type="password" placeholder="Nhập lại mật khẩu"
                value={regPassConf} onChange={e => setRegPassConf(e.target.value)}
                autoComplete="new-password" />
            </div>
            {/* Password strength hint */}
            {regPass && (
              <PasswordStrength password={regPass} />
            )}
            <button className="btn btn--primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
              {loading ? '...' : 'Tạo tài khoản'}
            </button>

            <OAuthSection loading={loading} onOAuth={handleOAuth} />
          </form>
        )}

        {/* ── FORGOT PASSWORD step 1: nhập email ── */}
        {tab === 'forgot' && (
          <form onSubmit={handleForgotSend}>
            <p style={{ fontSize: 12, color: 'rgba(220,235,255,0.5)', marginBottom: 16 }}>
              Nhập email đã đăng ký. Chúng tôi sẽ gửi mã xác nhận 6 số.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <input className="search-input" style={{ width: '100%' }}
                type="email" placeholder="user@example.com"
                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" onClick={() => { setTab('login'); clearMessages() }}
                style={{ flex: 1 }}>← Quay lại</button>
              <button className="btn btn--primary" type="submit" disabled={loading}
                style={{ flex: 2, justifyContent: 'center' }}>
                {loading ? '...' : 'Gửi mã xác nhận'}
              </button>
            </div>
          </form>
        )}

        {/* ── FORGOT PASSWORD step 2: nhập mã + mật khẩu mới ── */}
        {tab === 'forgot-verify' && (
          <form onSubmit={handleForgotVerify}>
            <p style={{ fontSize: 12, color: 'rgba(220,235,255,0.5)', marginBottom: 16 }}>
              Nhập mã 6 số từ email <strong style={{ color: 'var(--cyan)' }}>{forgotEmail}</strong>
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Mã xác nhận</label>
              <input className="search-input" style={{ width: '100%', letterSpacing: 8, textAlign: 'center', fontSize: 20 }}
                placeholder="000000" maxLength={6}
                value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Mật khẩu mới</label>
              <input className="search-input" style={{ width: '100%' }}
                type="password" placeholder="Ít nhất 8 ký tự"
                value={newPass} onChange={e => setNewPass(e.target.value)}
                autoComplete="new-password" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" onClick={() => { setTab('forgot'); clearMessages() }}
                style={{ flex: 1 }}>← Gửi lại</button>
              <button className="btn btn--primary" type="submit" disabled={loading}
                style={{ flex: 2, justifyContent: 'center' }}>
                {loading ? '...' : 'Đặt lại mật khẩu'}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(220,235,255,0.2)', textAlign: 'center' }}>
          Bằng cách đăng nhập, bạn đồng ý với điều khoản sử dụng của ArchStore.
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function OAuthSection({ loading, onOAuth }: {
  loading: boolean
  onOAuth: (p: 'discord' | 'github') => void
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
        <span style={{ fontSize: 11, color: 'rgba(220,235,255,0.3)' }}>hoặc tiếp tục với</span>
        <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="oauth-btn oauth-btn--discord" disabled={loading}
          onClick={() => onOAuth('discord')} style={{ flex: 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.032.055a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Discord
        </button>
        <button className="oauth-btn oauth-btn--github" disabled={loading}
          onClick={() => onOAuth('github')} style={{ flex: 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          GitHub
        </button>
      </div>
    </>
  )
}

function PasswordStrength({ password }: { password: string }) {
  let strength = 0
  if (password.length >= 8)   strength++
  if (password.length >= 12)  strength++
  if (/[A-Z]/.test(password)) strength++
  if (/[0-9]/.test(password)) strength++
  if (/[^a-zA-Z0-9]/.test(password)) strength++

  const labels = ['', 'Rất yếu', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh']
  const colors = ['', '#ff4466', '#ff8c00', '#ffb800', '#00c875', '#00f5ff']

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= strength ? colors[strength] : 'rgba(255,255,255,0.08)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 10, color: colors[strength] }}>{labels[strength]}</span>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'rgba(220,235,255,0.45)',
  marginBottom: 5,
  letterSpacing: 0.5,
}
