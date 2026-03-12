// frontend/src/App.tsx
// ArchStore - Giao diện chính với phong cách Cyberpunk Glassmorphism
// Sử dụng Wails runtime để gọi Go bindings

import { useState, useEffect, useCallback } from 'react'
import { EventsOn } from '../wailsjs/runtime/runtime'
import {
  SearchPackages,
  GetPackageDetail,
  InstallPackage,
  UninstallPackage,
  GetSystemInfo,
  SubmitReview,
  VoteReview,
  GetCurrentUser,
  LogoutUser,
} from '../wailsjs/go/app/App'

import { useI18n } from './hooks/useI18n'
import { AuthModal } from './components/AuthModal'
import { SearchView } from './components/SearchView'
import { HomeView } from './components/HomeView'
import { InstalledView } from './components/InstalledView'
import { UpdatesView } from './components/UpdatesView'
import { SettingsView } from './components/SettingsView'
import { PackageDetail } from './components/PackageDetail'
import { Sidebar } from './components/Sidebar'
import { ToastContainer } from './components/Toast'
import type { Package, SystemInfo, InstallProgress, AuthUser } from './types'

import './styles/globals.css'
import './styles/cyberpunk.css'

// ─────────────────────────────────────────────
// ROOT APP COMPONENT
// ─────────────────────────────────────────────

export default function App() {
  const { t, lang, setLang } = useI18n()

  // Navigation state
  const [view, setView] = useState<'search' | 'detail' | 'installed' | 'updates' | 'settings'>('search')
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null)

  // Search state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Package[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // System info
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)

  // Install progress (real-time từ Go events)
  const [installProgress, setInstallProgress] = useState<Record<string, InstallProgress>>({})

  // Toasts
  const [toasts, setToasts] = useState<{ id: string; type: string; message: string }[]>([])

  // Auth state
  const [user, setUser] = useState<AuthUser | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  // ─────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────

  useEffect(() => {
    // Load system info lúc khởi động
    GetSystemInfo().then(setSysInfo).catch(console.error)

    // Khôi phục session nếu đã đăng nhập
    GetCurrentUser().then(u => { if (u) setUser(u) }).catch(() => {})

    // Lắng nghe install:progress events từ Go backend
    const cleanupInstall = EventsOn('install:progress', (progress: InstallProgress) => {
      setInstallProgress(prev => ({
        ...prev,
        [progress.pkg_name]: progress
      }))

      if (progress.stage === 'done') {
        addToast('success', `✓ ${progress.pkg_name} ${t('installed_success')}`)
      } else if (progress.stage === 'error') {
        addToast('error', `✗ ${progress.message}`)
      }
    })

    // Lắng nghe auth events từ OAuth flow
    const cleanupAuthLogin = EventsOn('auth:login', (authUser: AuthUser) => {
      setUser(authUser)
      setShowAuth(false)
      addToast('success', `Đăng nhập thành công: ${authUser.username}`)
    })

    const cleanupAuthError = EventsOn('auth:error', (msg: string) => {
      addToast('error', msg)
    })

    return () => {
      cleanupInstall()
      cleanupAuthLogin()
      cleanupAuthError()
    }
  }, [])

  // ─────────────────────────────────────────────
  // SEARCH
  // ─────────────────────────────────────────────

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (!q.trim()) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const pkgs = await SearchPackages(q)
      setResults(pkgs || [])
    } catch (err: any) {
      addToast('error', err.message || t('search_error'))
    } finally {
      setIsSearching(false)
    }
  }, [t])

  // ─────────────────────────────────────────────
  // PACKAGE ACTIONS
  // ─────────────────────────────────────────────

  const handleOpenDetail = useCallback(async (pkg: Package) => {
    setSelectedPkg(pkg)
    setView('detail')

    // Load full detail với ratings
    try {
      const detail = await GetPackageDetail(pkg.name)
      if (detail) setSelectedPkg(detail)
    } catch (err) {
      console.error('Không load được detail:', err)
    }
  }, [])

  const handleInstall = useCallback(async (pkgName: string) => {
    try {
      await InstallPackage(pkgName)
    } catch (err: any) {
      addToast('error', err.message || t('install_error'))
    }
  }, [t])

  const handleUninstall = useCallback(async (pkgName: string) => {
    try {
      await UninstallPackage(pkgName)
      addToast('success', `${pkgName} ${t('uninstalled_success')}`)
    } catch (err: any) {
      addToast('error', err.message || t('uninstall_error'))
    }
  }, [t])

  const handleSubmitReview = useCallback(async (
    pkgName: string, rating: number, comment: string
  ) => {
    try {
      await SubmitReview(pkgName, rating, comment)
      addToast('success', t('review_submitted'))
    } catch (err: any) {
      addToast('error', err.message || t('review_error'))
    }
  }, [t])

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  const addToast = (type: string, message: string) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <div className="archstore-root">
      {/* Cyberpunk background grid */}
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow bg-glow--cyan" aria-hidden="true" />
      <div className="bg-glow bg-glow--purple" aria-hidden="true" />

      {/* Header / Titlebar */}
      <header className="titlebar" style={{ '--wails-draggable': 'drag' } as any}>
        <div className="titlebar__logo">
          <span className="titlebar__logo-icon">⬡</span>
          <span className="titlebar__logo-text">
            Arch<span className="accent">Store</span>
          </span>
        </div>

        {/* Search bar */}
        <div className="titlebar__search">
          <input
            type="text"
            className="search-input"
            placeholder={t('search_placeholder')}
            value={query}
            onChange={e => handleSearch(e.target.value)}
          />
          {isSearching && <span className="search-spinner" />}
        </div>

        {/* Language + System info + Auth */}
        <div className="titlebar__actions">
          <select
            className="lang-select"
            value={lang}
            onChange={e => setLang(e.target.value)}
          >
            <option value="en">🇬🇧 EN</option>
            <option value="vi">🇻🇳 VI</option>
            <option value="ja">🇯🇵 JA</option>
          </select>
          {sysInfo && (
            <div className="sys-badge" title={`Kernel: ${sysInfo.kernel_version}`}>
              <span className="sys-badge__icon">🐧</span>
              <span className="sys-badge__aur">{sysInfo.aur_helper || 'pacman'}</span>
            </div>
          )}
          {user ? (
            <div className="user-badge">
              {user.avatar_url && (
                <img className="user-badge__avatar" src={user.avatar_url} alt="" />
              )}
              <span className="user-badge__name">{user.username}</span>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => LogoutUser().then(() => setUser(null)).catch(console.error)}
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <button className="btn btn--primary btn--sm" onClick={() => setShowAuth(true)}>
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <div className="layout">
        <Sidebar activeView={view} onNavigate={setView} t={t} />

        <main className="main-content">
          {view === 'search' && !query && (
            <HomeView
              onSearch={q => { setQuery(q); handleSearch(q) }}
              onInstall={handleInstall}
              installProgress={installProgress}
              t={t}
            />
          )}

          {view === 'search' && query && (
            <SearchView
              results={results}
              query={query}
              isSearching={isSearching}
              installProgress={installProgress}
              onOpenDetail={handleOpenDetail}
              onInstall={handleInstall}
              t={t}
            />
          )}

          {view === 'installed' && (
            <InstalledView
              onOpenDetail={handleOpenDetail}
              onUninstall={handleUninstall}
              installProgress={installProgress}
              t={t}
            />
          )}

          {view === 'updates' && (
            <UpdatesView
              onInstall={handleInstall}
              installProgress={installProgress}
              t={t}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              sysInfo={sysInfo}
              lang={lang}
              setLang={setLang}
              t={t}
            />
          )}

          {view === 'detail' && selectedPkg && (
            <PackageDetail
              pkg={selectedPkg}
              user={user}
              onRequireLogin={() => setShowAuth(true)}
              installProgress={installProgress[selectedPkg.name]}
              sysInfo={sysInfo}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
              onSubmitReview={handleSubmitReview}
              onVote={VoteReview}
              onBack={() => setView('search')}
              t={t}
            />
          )}
        </main>
      </div>

      <ToastContainer toasts={toasts} />

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={authUser => {
            setUser(authUser)
            setShowAuth(false)
            addToast('success', `Đăng nhập thành công: ${authUser.username}`)
          }}
        />
      )}
    </div>
  )
}
