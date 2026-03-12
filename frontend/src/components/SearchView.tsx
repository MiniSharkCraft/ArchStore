// frontend/src/components/SearchView.tsx
import type { Package, InstallProgress } from '../types'

interface Props {
  results: Package[]
  query: string
  isSearching: boolean
  installProgress: Record<string, InstallProgress>
  onOpenDetail: (pkg: Package) => void
  onInstall: (name: string) => void
  t: (key: string, vars?: Record<string, string>) => string
}

export function SearchView({ results, query, isSearching, installProgress, onOpenDetail, onInstall, t }: Props) {
  if (!query) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">⬡</div>
        <div>{t('search_empty')}</div>
      </div>
    )
  }

  if (!isSearching && results.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🔍</div>
        <div>{t('search_no_results', { query })}</div>
      </div>
    )
  }

  return (
    <div className="results-grid">
      {results.map(pkg => {
        const progress = installProgress[pkg.name]
        const isInstalling = progress && progress.stage !== 'done' && progress.stage !== 'error'

        return (
          <div key={pkg.name} className="pkg-card" onClick={() => onOpenDetail(pkg)}>
            <div className="pkg-card__header">
              <div>
                <div className="pkg-card__name">{pkg.name}</div>
                <div className="pkg-card__version">{pkg.version}</div>
              </div>
              <span className={`pkg-card__source source--${pkg.source}`}>{pkg.source}</span>
            </div>

            <p className="pkg-card__desc">{pkg.description}</p>

            <div className="pkg-card__footer">
              {pkg.installed ? (
                <span className="btn btn--installed">{t('pkg.installed')}</span>
              ) : (
                <button
                  className="btn btn--primary"
                  disabled={!!isInstalling}
                  onClick={e => { e.stopPropagation(); onInstall(pkg.name) }}
                >
                  {isInstalling ? `⟳ ${progress.progress.toFixed(0)}%` : t('pkg.install')}
                </button>
              )}

              {pkg.votes > 0 && (
                <span style={{ fontSize: 11, color: 'rgba(220,235,255,0.3)' }}>
                  ▲ {pkg.votes.toLocaleString()}
                </span>
              )}
            </div>

            {isInstalling && (
              <div className="install-progress">
                <div className="install-progress__bar-track">
                  <div className="install-progress__bar-fill" style={{ width: `${progress.progress}%` }} />
                </div>
                <div className="install-progress__text">{progress.message}</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
