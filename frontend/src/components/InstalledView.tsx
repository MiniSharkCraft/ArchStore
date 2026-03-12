// frontend/src/components/InstalledView.tsx
import { useState, useEffect } from 'react'
import { GetInstalledPackages } from '../../wailsjs/go/app/App'
import type { PkgInfo, InstallProgress } from '../types'

interface Props {
  onOpenDetail: (pkg: PkgInfo) => void
  onUninstall: (name: string) => void
  installProgress: Record<string, InstallProgress>
  t: (key: string) => string
}

const PAGE_SIZE = 25

export function InstalledView({ onOpenDetail, onUninstall, installProgress, t }: Props) {
  const [pkgs, setPkgs]       = useState<PkgInfo[]>([])
  const [filtered, setFiltered] = useState<PkgInfo[]>([])
  const [loading, setLoading]  = useState(true)
  const [search, setSearch]    = useState('')
  const [page, setPage]        = useState(1)
  const [sortBy, setSortBy]    = useState<'name' | 'size'>('name')

  useEffect(() => {
    GetInstalledPackages()
      .then(data => { setPkgs(data || []); setFiltered(data || []) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let result = pkgs.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
    if (sortBy === 'name') result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'size') result = [...result].sort((a, b) => (b.size_kb||0) - (a.size_kb||0))
    setFiltered(result)
    setPage(1)
  }, [search, pkgs, sortBy])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  if (loading) return (
    <div className="empty-state">
      <div style={{ width:24, height:24, border:'2px solid rgba(0,245,255,0.2)', borderTopColor:'var(--cyan)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <div style={{ marginTop:12, color:'rgba(220,235,255,0.4)' }}>Đang tải danh sách...</div>
    </div>
  )

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div className="section-header" style={{ margin:0 }}>📦 Đã cài đặt</div>
          <div style={{ fontSize:12, color:'rgba(220,235,255,0.35)', marginTop:4 }}>
            {filtered.length} / {pkgs.length} packages
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input
            className="search-input"
            style={{ width:220 }}
            placeholder="Lọc packages..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {/* Sort tabs thay vì select để tránh ô trắng */}
          <div style={{ display:'flex', background:'var(--bg-card)', border:'1px solid var(--glass-border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
            {[{v:'name',l:'A-Z'},{v:'size',l:'Size'}].map(s => (
              <button
                key={s.v}
                onClick={() => setSortBy(s.v as any)}
                style={{
                  padding:'6px 14px', fontSize:12, border:'none', cursor:'pointer',
                  background: sortBy===s.v ? 'rgba(0,245,255,0.12)' : 'transparent',
                  color: sortBy===s.v ? 'var(--cyan)' : 'rgba(220,235,255,0.4)',
                  transition:'all 0.15s',
                }}
              >{s.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 1fr 70px 44px', gap:12, padding:'6px 16px', fontSize:10, letterSpacing:1, textTransform:'uppercase', color:'rgba(0,245,255,0.35)', marginBottom:4 }}>
        <span>Tên</span><span>Phiên bản</span><span>Mô tả</span><span style={{textAlign:'right'}}>Kích thước</span><span/>
      </div>

      {/* List */}
      <div className="installed-list">
        {paginated.map(pkg => {
          const progress = installProgress[pkg.name]
          const isRemoving = progress && progress.stage !== 'done' && progress.stage !== 'error'
          return (
            <div key={pkg.name} className="installed-item" onClick={() => onOpenDetail(pkg)}>
              <div className="installed-item__name">{pkg.name}</div>
              <div className="installed-item__version">{pkg.version}</div>
              <div className="installed-item__desc">{pkg.description || '—'}</div>
              <div className="installed-item__size">{pkg.size_kb > 0 ? formatSize(pkg.size_kb) : '—'}</div>
              <button
                className="btn btn--danger"
                style={{ padding:'4px 10px', fontSize:13 }}
                disabled={!!isRemoving}
                onClick={e => { e.stopPropagation(); onUninstall(pkg.name) }}
              >🗑️</button>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && <Pagination page={page} total={totalPages} onChange={setPage} />}
    </div>
  )
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pages: (number|string)[] = []
  if (total <= 9) {
    for (let i=1;i<=total;i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 4) pages.push('...')
    for (let i=Math.max(2,page-2);i<=Math.min(total-1,page+2);i++) pages.push(i)
    if (page < total-3) pages.push('...')
    pages.push(total)
  }

  return (
    <div className="pagination">
      <button className="page-btn" disabled={page===1} onClick={() => onChange(page-1)}>‹</button>
      {pages.map((p,i) =>
        typeof p === 'string'
          ? <span key={i} style={{padding:'0 4px',color:'rgba(220,235,255,0.3)'}}>…</span>
          : <button key={p} className={`page-btn ${page===p?'page-btn--active':''}`} onClick={() => onChange(p as number)}>{p}</button>
      )}
      <button className="page-btn" disabled={page===total} onClick={() => onChange(page+1)}>›</button>
      <span style={{ fontSize:11, color:'rgba(220,235,255,0.3)', marginLeft:8 }}>
        Trang {page}/{total} · {(page-1)*25+1}–{Math.min(page*25, total*25)} packages
      </span>
    </div>
  )
}

function formatSize(kb: number) {
  if (kb >= 1024*1024) return `${(kb/1024/1024).toFixed(1)} GiB`
  if (kb >= 1024) return `${(kb/1024).toFixed(1)} MiB`
  return `${kb} KiB`
}
