// frontend/src/components/SettingsView.tsx
import type { SystemInfo } from '../types'

interface Props {
  sysInfo: SystemInfo | null
  lang: string
  setLang: (l: string) => void
  t: (key: string) => string
}

export function SettingsView({ sysInfo, lang, setLang, t }: Props) {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="section-header">⚙️ Cài đặt</div>

      {sysInfo && (
        <div className="settings-card">
          <div className="settings-card__title">🐧 Thông tin hệ thống</div>
          <div className="spec-grid" style={{ marginTop: 12 }}>
            <div className="spec-item">
              <div className="spec-item__key">Kernel</div>
              <div className="spec-item__value">{sysInfo.kernel_version || '—'}</div>
            </div>
            <div className="spec-item">
              <div className="spec-item__key">Arch Version</div>
              <div className="spec-item__value">{sysInfo.arch_version || '—'}</div>
            </div>
            <div className="spec-item">
              <div className="spec-item__key">CPU</div>
              <div className="spec-item__value" style={{ fontSize: 11 }}>{sysInfo.cpu || '—'}</div>
            </div>
            <div className="spec-item">
              <div className="spec-item__key">RAM</div>
              <div className="spec-item__value">{sysInfo.ram || '—'}</div>
            </div>
            <div className="spec-item">
              <div className="spec-item__key">AUR Helper</div>
              <div className="spec-item__value" style={{ color: sysInfo.aur_helper ? 'var(--green)' : 'var(--red)' }}>
                {sysInfo.aur_helper || '⚠️ Chưa cài'}
              </div>
            </div>
            <div className="spec-item">
              <div className="spec-item__key">yay / paru</div>
              <div className="spec-item__value">
                {sysInfo.has_yay ? '✅ yay' : '❌ yay'}&nbsp;&nbsp;
                {sysInfo.has_paru ? '✅ paru' : '❌ paru'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="settings-card">
        <div className="settings-card__title">🌐 Ngôn ngữ</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[
            { code: 'vi', label: '🇻🇳 Tiếng Việt' },
            { code: 'en', label: '🇬🇧 English' },
            { code: 'ja', label: '🇯🇵 日本語' },
          ].map(l => (
            <button
              key={l.code}
              className={`btn ${lang === l.code ? 'btn--primary' : ''}`}
              style={{ fontSize: 12 }}
              onClick={() => setLang(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__title">ℹ️ Về ArchStore</div>
        <div style={{ fontSize: 12, color: 'rgba(220,235,255,0.4)', lineHeight: 2, marginTop: 8 }}>
          <div>⬡ <strong style={{ color: 'var(--cyan)' }}>ArchStore</strong> — Linux App Store cho Arch Linux</div>
          <div>🔧 Backend: Go + Wails v2</div>
          <div>🎨 Frontend: React + TypeScript</div>
          <div>☁️ Ratings: Cloudflare D1 + Workers</div>
          <div style={{ marginTop: 8, color: 'rgba(220,235,255,0.2)' }}>v0.1.0-alpha</div>
        </div>
      </div>
    </div>
  )
}
