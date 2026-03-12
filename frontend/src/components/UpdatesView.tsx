// frontend/src/components/UpdatesView.tsx
import { useState, useEffect } from 'react'
import type { InstallProgress } from '../types'

interface UpdatePkg {
  name: string
  currentVersion: string
  newVersion: string
  source: string
}

interface Props {
  onInstall: (name: string) => void
  installProgress: Record<string, InstallProgress>
  t: (key: string) => string
}

export function UpdatesView({ onInstall, installProgress, t }: Props) {
  const [updates, setUpdates] = useState<UpdatePkg[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Chạy `checkupdates` để lấy danh sách updates
    setLoading(true)
    // Trong thực tế gọi Go binding CheckUpdates()
    // Hiện tại mock data để UI hoạt động
    setTimeout(() => {
      setUpdates([
        { name: 'linux',        currentVersion: '6.6.0',  newVersion: '6.6.1',  source: 'pacman' },
        { name: 'firefox',      currentVersion: '121.0',  newVersion: '122.0',  source: 'pacman' },
        { name: 'neovim',       currentVersion: '0.9.4',  newVersion: '0.9.5',  source: 'pacman' },
        { name: 'yay',          currentVersion: '12.1.3', newVersion: '12.2.0', source: 'aur'    },
        { name: 'obsidian',     currentVersion: '1.4.16', newVersion: '1.5.0',  source: 'aur'    },
      ])
      setLoading(false)
    }, 800)
  }, [])

  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(updates.map(u => u.name)))
  const selectNone = () => setSelected(new Set())

  const updateSelected = () => {
    selected.forEach(name => onInstall(name))
  }

  if (loading) return (
    <div className="empty-state">
      <div className="search-spinner" style={{ position: 'static', transform: 'none', width: 24, height: 24 }} />
      <div style={{ marginTop: 12 }}>Đang kiểm tra cập nhật...</div>
    </div>
  )

  if (updates.length === 0) return (
    <div className="empty-state">
      <div className="empty-state__icon">✅</div>
      <div style={{ fontSize: 15, color: 'var(--green)' }}>Hệ thống đã cập nhật!</div>
      <div style={{ fontSize: 12, color: 'rgba(220,235,255,0.3)', marginTop: 6 }}>
        Tất cả packages đang ở phiên bản mới nhất
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="section-header" style={{ margin: 0 }}>🔄 Cập nhật có sẵn</div>
          <div style={{ fontSize: 12, color: 'rgba(220,235,255,0.4)', marginTop: 4 }}>
            {updates.length} packages cần cập nhật
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ fontSize: 11, color: 'rgba(220,235,255,0.5)' }} onClick={selectAll}>
            Chọn tất cả
          </button>
          <button className="btn" style={{ fontSize: 11, color: 'rgba(220,235,255,0.5)' }} onClick={selectNone}>
            Bỏ chọn
          </button>
          <button
            className="btn btn--primary"
            disabled={selected.size === 0}
            onClick={updateSelected}
          >
            ⬆️ Cập nhật {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>

      {/* Update list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {updates.map(pkg => {
          const progress = installProgress[pkg.name]
          const isUpdating = progress && progress.stage !== 'done' && progress.stage !== 'error'
          const isDone = progress?.stage === 'done'
          return (
            <div
              key={pkg.name}
              className={`update-item ${selected.has(pkg.name) ? 'update-item--selected' : ''}`}
              onClick={() => toggleSelect(pkg.name)}
            >
              <div className="update-item__check">
                {isDone ? '✅' : selected.has(pkg.name) ? '☑️' : '☐'}
              </div>
              <div className="update-item__info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="update-item__name">{pkg.name}</span>
                  <span className={`pkg-card__source source--${pkg.source}`} style={{ fontSize: 9, padding: '1px 6px' }}>
                    {pkg.source}
                  </span>
                </div>
                <div className="update-item__versions">
                  <span style={{ color: 'rgba(220,235,255,0.4)' }}>{pkg.currentVersion}</span>
                  <span style={{ color: 'rgba(220,235,255,0.2)', margin: '0 6px' }}>→</span>
                  <span style={{ color: 'var(--green)' }}>{pkg.newVersion}</span>
                </div>
              </div>
              {isUpdating ? (
                <div style={{ flex: 1, maxWidth: 200 }}>
                  <div className="install-progress__bar-track">
                    <div className="install-progress__bar-fill" style={{ width: `${progress.progress}%` }} />
                  </div>
                  <div className="install-progress__text">{progress.message}</div>
                </div>
              ) : (
                <button
                  className="btn btn--primary"
                  style={{ padding: '4px 14px', fontSize: 11 }}
                  disabled={isDone}
                  onClick={e => { e.stopPropagation(); onInstall(pkg.name) }}
                >
                  {isDone ? '✓ Xong' : '⬆️'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
