// frontend/src/components/HomeView.tsx
import { useState, useEffect } from 'react'
import { GetFeaturedRatings } from '../../wailsjs/go/app/App'
import type { InstallProgress } from '../types'

interface Props {
  onSearch: (q: string) => void
  onInstall: (name: string) => void
  installProgress: Record<string, InstallProgress>
  t: (key: string) => string
}

interface AppEntry {
  name: string; desc: string; icon: string
  source: 'pacman' | 'aur' | 'multilib'
  cat: string; stars: number; downloads: number
  editors_pick?: boolean
}

// ─── Danh sách ứng dụng ─────────────────────────────────────────────────────
const ALL_APPS: AppEntry[] = [
  // Browsers
  { name:'firefox',            desc:'Trình duyệt web mã nguồn mở nhanh và bảo mật',       icon:'🦊', source:'pacman',   cat:'browser',      stars:4.8, downloads:982000, editors_pick:true },
  { name:'chromium',           desc:'Chromium — nền tảng mã nguồn mở của Chrome',         icon:'🔵', source:'pacman',   cat:'browser',      stars:4.5, downloads:654000 },
  { name:'brave-bin',          desc:'Trình duyệt bảo mật, chặn ad & tracker mặc định',   icon:'🦁', source:'aur',      cat:'browser',      stars:4.7, downloads:445000, editors_pick:true },
  { name:'qutebrowser',        desc:'Keyboard-driven browser theo phong cách vim',        icon:'🕸️', source:'pacman',   cat:'browser',      stars:4.6, downloads:112000 },
  { name:'librewolf',          desc:'Firefox fork tập trung vào privacy',                 icon:'🐺', source:'aur',      cat:'browser',      stars:4.7, downloads:198000 },
  { name:'vivaldi',            desc:'Trình duyệt tùy biến cao cho power users',           icon:'🎭', source:'aur',      cat:'browser',      stars:4.4, downloads:156000 },
  { name:'tor-browser',        desc:'Trình duyệt ẩn danh qua mạng Tor',                  icon:'🧅', source:'aur',      cat:'browser',      stars:4.5, downloads:89000 },

  // Editors / IDE
  { name:'neovim',             desc:'Text editor thế hệ mới, extensible và nhanh',        icon:'📝', source:'pacman',   cat:'editor',       stars:4.9, downloads:876000, editors_pick:true },
  { name:'code',               desc:'Visual Studio Code — IDE phổ biến nhất thế giới',   icon:'💙', source:'aur',      cat:'editor',       stars:4.7, downloads:1200000, editors_pick:true },
  { name:'helix',              desc:'Modal text editor viết bằng Rust, built-in LSP',     icon:'🧬', source:'pacman',   cat:'editor',       stars:4.8, downloads:234000 },
  { name:'zed',                desc:'Code editor thế hệ mới cực nhanh, collaborative',   icon:'⚡', source:'aur',      cat:'editor',       stars:4.7, downloads:189000 },
  { name:'emacs',              desc:'Extensible text editor huyền thoại từ 1976',         icon:'🦌', source:'pacman',   cat:'editor',       stars:4.5, downloads:321000 },
  { name:'kate',               desc:'KDE Advanced Text Editor — feature-rich',            icon:'✏️', source:'pacman',   cat:'editor',       stars:4.4, downloads:145000 },
  { name:'geany',              desc:'Text editor nhẹ với IDE features cơ bản',           icon:'🐾', source:'pacman',   cat:'editor',       stars:4.3, downloads:98000 },
  { name:'lapce',              desc:'Lightning-fast code editor viết bằng Rust',          icon:'🔥', source:'aur',      cat:'editor',       stars:4.5, downloads:67000 },

  // Terminals
  { name:'kitty',              desc:'Terminal GPU-accelerated với ligatures và tabs',      icon:'🐱', source:'pacman',   cat:'terminal',     stars:4.8, downloads:543000, editors_pick:true },
  { name:'alacritty',          desc:'Terminal Rust-based, tối giản và cực nhanh',         icon:'🚀', source:'pacman',   cat:'terminal',     stars:4.7, downloads:487000 },
  { name:'wezterm',            desc:'Terminal với tab, split, multiplexer tích hợp',      icon:'🌊', source:'pacman',   cat:'terminal',     stars:4.8, downloads:312000 },
  { name:'ghostty',            desc:'Terminal mới nhất từ Mitchell Hashimoto (Terraform)', icon:'👻', source:'aur',      cat:'terminal',     stars:4.9, downloads:278000, editors_pick:true },
  { name:'foot',               desc:'Wayland-native terminal cực nhẹ và nhanh',           icon:'🦶', source:'pacman',   cat:'terminal',     stars:4.6, downloads:134000 },
  { name:'tilix',              desc:'Tiling terminal emulator cho GNOME',                 icon:'🟩', source:'pacman',   cat:'terminal',     stars:4.4, downloads:112000 },

  // Social & Communication
  { name:'discord',            desc:'Voice, video và chat cho cộng đồng gaming',          icon:'💬', source:'aur',      cat:'social',       stars:4.5, downloads:923000 },
  { name:'telegram-desktop',   desc:'Messenger nhanh, bảo mật với encryption',            icon:'✈️', source:'pacman',   cat:'social',       stars:4.7, downloads:765000, editors_pick:true },
  { name:'slack-desktop',      desc:'Nền tảng giao tiếp team cho doanh nghiệp',           icon:'💼', source:'aur',      cat:'social',       stars:4.2, downloads:432000 },
  { name:'element-desktop',    desc:'Matrix client mã nguồn mở, decentralized',           icon:'🔷', source:'aur',      cat:'social',       stars:4.3, downloads:187000 },
  { name:'signal-desktop',     desc:'Messenger bảo mật nhất — end-to-end encryption',    icon:'🔔', source:'aur',      cat:'social',       stars:4.8, downloads:345000, editors_pick:true },
  { name:'thunderbird',        desc:'Email client mạnh mẽ từ Mozilla Foundation',         icon:'🐦', source:'pacman',   cat:'social',       stars:4.5, downloads:543000 },
  { name:'teams',              desc:'Microsoft Teams — họp video và collaboration',       icon:'🫂', source:'aur',      cat:'social',       stars:3.8, downloads:234000 },

  // Media
  { name:'vlc',                desc:'Media player hỗ trợ mọi định dạng âm thanh/video',  icon:'🎬', source:'pacman',   cat:'media',        stars:4.7, downloads:1100000, editors_pick:true },
  { name:'mpv',                desc:'Media player nhẹ, scriptable, không UI thừa',       icon:'▶️', source:'pacman',   cat:'media',        stars:4.8, downloads:654000, editors_pick:true },
  { name:'spotify',            desc:'Streaming nhạc phổ biến nhất thế giới',              icon:'🎵', source:'aur',      cat:'media',        stars:4.4, downloads:876000 },
  { name:'obs-studio',         desc:'Stream và record màn hình chuyên nghiệp',            icon:'🎙️', source:'pacman',   cat:'media',        stars:4.9, downloads:765000, editors_pick:true },
  { name:'kdenlive',           desc:'Video editor mã nguồn mở chuyên nghiệp',            icon:'🎞️', source:'pacman',   cat:'media',        stars:4.5, downloads:321000 },
  { name:'handbrake',          desc:'Video transcoder mạnh mẽ và miễn phí',              icon:'🎛️', source:'pacman',   cat:'media',        stars:4.6, downloads:234000 },
  { name:'audacity',           desc:'Audio editor và recorder đa nền tảng',              icon:'🎚️', source:'pacman',   cat:'media',        stars:4.4, downloads:445000 },
  { name:'strawberry',         desc:'Music player hiện đại hỗ trợ streaming',            icon:'🍓', source:'pacman',   cat:'media',        stars:4.6, downloads:134000 },
  { name:'celluloid',          desc:'GTK frontend đẹp cho mpv media player',             icon:'📺', source:'pacman',   cat:'media',        stars:4.5, downloads:98000 },

  // Gaming
  { name:'steam',              desc:'Nền tảng gaming PC lớn nhất, hỗ trợ Proton',        icon:'🎮', source:'multilib', cat:'gaming',       stars:4.6, downloads:1540000, editors_pick:true },
  { name:'lutris',             desc:'Game manager — Wine/Proton/emulators tập trung',    icon:'🏆', source:'pacman',   cat:'gaming',       stars:4.5, downloads:543000 },
  { name:'heroic-games-launcher',desc:'Epic Games và GOG launcher chính thức cho Linux', icon:'⚔️', source:'aur',      cat:'gaming',       stars:4.7, downloads:312000 },
  { name:'gamemode',           desc:'Tự động tối ưu CPU/GPU/RAM khi chơi game',          icon:'🚀', source:'pacman',   cat:'gaming',       stars:4.8, downloads:234000, editors_pick:true },
  { name:'mangohud',           desc:'Overlay hiển thị FPS, GPU, CPU trong game',         icon:'📊', source:'pacman',   cat:'gaming',       stars:4.8, downloads:198000 },
  { name:'bottles',            desc:'Quản lý Wine environments đẹp và dễ dùng',          icon:'🍾', source:'pacman',   cat:'gaming',       stars:4.6, downloads:167000 },
  { name:'retroarch',          desc:'Frontend emulator đa nền tảng (NES, PS1, GBA...)',  icon:'🕹️', source:'pacman',   cat:'gaming',       stars:4.7, downloads:289000 },
  { name:'protonup-qt',        desc:'Cài và cập nhật Proton-GE dễ dàng',                 icon:'🔧', source:'aur',      cat:'gaming',       stars:4.8, downloads:145000 },

  // Dev Tools
  { name:'docker',             desc:'Container platform — "build once, run anywhere"',   icon:'🐳', source:'pacman',   cat:'dev',          stars:4.7, downloads:987000, editors_pick:true },
  { name:'git',                desc:'Version control phân tán — tiêu chuẩn ngành',       icon:'🌿', source:'pacman',   cat:'dev',          stars:4.9, downloads:2100000, editors_pick:true },
  { name:'kubectl',            desc:'CLI quản lý Kubernetes cluster production',          icon:'☸️', source:'pacman',   cat:'dev',          stars:4.7, downloads:543000 },
  { name:'postman-bin',        desc:'API development, testing và documentation',          icon:'📮', source:'aur',      cat:'dev',          stars:4.6, downloads:432000 },
  { name:'insomnia',           desc:'REST và GraphQL client đẹp và mạnh mẽ',             icon:'😴', source:'aur',      cat:'dev',          stars:4.5, downloads:198000 },
  { name:'podman',             desc:'Daemonless container engine tương thích Docker',    icon:'🐋', source:'pacman',   cat:'dev',          stars:4.6, downloads:234000 },
  { name:'dbeaver',            desc:'Universal database tool — MySQL, Postgres, SQLite', icon:'🗄️', source:'aur',      cat:'dev',          stars:4.6, downloads:345000 },
  { name:'github-cli',         desc:'GitHub từ terminal — PR, issues, actions',          icon:'🐙', source:'pacman',   cat:'dev',          stars:4.7, downloads:312000 },

  // Security
  { name:'bitwarden',          desc:'Password manager mã nguồn mở, self-hostable',       icon:'🔐', source:'pacman',   cat:'security',     stars:4.9, downloads:654000, editors_pick:true },
  { name:'ufw',                desc:'Uncomplicated Firewall — dễ cấu hình cho Linux',    icon:'🔥', source:'pacman',   cat:'security',     stars:4.6, downloads:432000 },
  { name:'wireguard-tools',    desc:'VPN hiện đại, hiệu suất cao, mã nguồn mở',          icon:'🛡️', source:'pacman',   cat:'security',     stars:4.8, downloads:321000, editors_pick:true },
  { name:'keepassxc',          desc:'Password manager offline, không cloud',              icon:'🔑', source:'pacman',   cat:'security',     stars:4.7, downloads:234000 },
  { name:'veracrypt',          desc:'Mã hóa disk/partition/file container mạnh mẽ',      icon:'🔒', source:'aur',      cat:'security',     stars:4.6, downloads:187000 },
  { name:'fail2ban',           desc:'Chặn brute-force SSH và các dịch vụ khác',          icon:'🚫', source:'pacman',   cat:'security',     stars:4.5, downloads:145000 },
  { name:'clamav',             desc:'Antivirus mã nguồn mở cho Linux server',            icon:'🦠', source:'pacman',   cat:'security',     stars:4.2, downloads:98000 },

  // Productivity
  { name:'obsidian',           desc:'Knowledge base và ghi chú với Markdown + graph',   icon:'💎', source:'aur',      cat:'productivity', stars:4.9, downloads:876000, editors_pick:true },
  { name:'libreoffice-fresh',  desc:'Bộ office đầy đủ: Writer, Calc, Impress...',        icon:'📄', source:'pacman',   cat:'productivity', stars:4.4, downloads:765000 },
  { name:'notion-app-enhanced', desc:'Notion client không chính thức cho Linux',          icon:'📋', source:'aur',      cat:'productivity', stars:4.3, downloads:234000 },
  { name:'zotero',             desc:'Reference manager cho nghiên cứu khoa học',         icon:'📚', source:'aur',      cat:'productivity', stars:4.7, downloads:167000 },
  { name:'timeshift',          desc:'Tạo và restore snapshot hệ thống như Time Machine', icon:'⏰', source:'aur',      cat:'productivity', stars:4.8, downloads:445000, editors_pick:true },
  { name:'syncthing',          desc:'Sync file P2P không cần server, mã nguồn mở',       icon:'🔄', source:'pacman',   cat:'productivity', stars:4.8, downloads:312000 },
  { name:'nextcloud-client',   desc:'Đồng bộ file với server Nextcloud của riêng bạn',  icon:'☁️', source:'pacman',   cat:'productivity', stars:4.4, downloads:198000 },

  // Graphics & Design
  { name:'gimp',               desc:'Phần mềm chỉnh sửa ảnh chuyên nghiệp mã nguồn mở', icon:'🎨', source:'pacman',   cat:'graphics',     stars:4.5, downloads:876000, editors_pick:true },
  { name:'inkscape',           desc:'Vector graphics editor — SVG, PDF, EPS',            icon:'✒️', source:'pacman',   cat:'graphics',     stars:4.6, downloads:543000, editors_pick:true },
  { name:'krita',              desc:'Digital painting chuyên nghiệp cho artist',         icon:'🖌️', source:'pacman',   cat:'graphics',     stars:4.8, downloads:432000, editors_pick:true },
  { name:'blender',            desc:'3D modeling, animation và rendering mã nguồn mở',   icon:'🌀', source:'pacman',   cat:'graphics',     stars:4.9, downloads:654000, editors_pick:true },
  { name:'darktable',          desc:'RAW photo workflow và lightroom alternative',        icon:'📷', source:'pacman',   cat:'graphics',     stars:4.6, downloads:234000 },
  { name:'rawtherapee',        desc:'RAW image processor chuyên nghiệp',                 icon:'🔬', source:'pacman',   cat:'graphics',     stars:4.4, downloads:145000 },
  { name:'figma-linux',        desc:'Figma client không chính thức cho Linux',           icon:'🎭', source:'aur',      cat:'graphics',     stars:4.4, downloads:167000 },

  // System Tools
  { name:'htop',               desc:'Interactive process viewer nổi tiếng',              icon:'📈', source:'pacman',   cat:'system',       stars:4.8, downloads:1200000, editors_pick:true },
  { name:'btop',               desc:'Resource monitor đẹp — CPU, RAM, disk, network',   icon:'📊', source:'pacman',   cat:'system',       stars:4.9, downloads:654000, editors_pick:true },
  { name:'fastfetch',          desc:'Neofetch thay thế cực nhanh viết bằng C',           icon:'⚡', source:'pacman',   cat:'system',       stars:4.8, downloads:345000 },
  { name:'yay',                desc:'AUR helper viết bằng Go — nhanh và đầy đủ tính năng',icon:'🌟', source:'aur',     cat:'system',       stars:4.9, downloads:987000, editors_pick:true },
  { name:'paru',               desc:'AUR helper Rust-based — feature-rich, bảo mật',    icon:'🦀', source:'aur',      cat:'system',       stars:4.9, downloads:654000, editors_pick:true },
  { name:'snapper',            desc:'Quản lý Btrfs/LVM snapshots dễ dàng',               icon:'📸', source:'pacman',   cat:'system',       stars:4.6, downloads:178000 },
  { name:'gparted',            desc:'Partition editor GUI mạnh mẽ và dễ dùng',           icon:'💾', source:'pacman',   cat:'system',       stars:4.6, downloads:432000 },
  { name:'ventoy',             desc:'Tạo USB boot đa ISO không cần format lại',          icon:'💿', source:'aur',      cat:'system',       stars:4.9, downloads:345000, editors_pick:true },
  { name:'rsync',              desc:'Backup và sync file hiệu quả nhất',                 icon:'📦', source:'pacman',   cat:'system',       stars:4.7, downloads:876000 },
  { name:'rclone',             desc:'Sync với 70+ cloud storage (S3, GDrive, ...)',       icon:'☁️', source:'pacman',   cat:'system',       stars:4.7, downloads:432000 },

  // Network
  { name:'networkmanager',     desc:'Quản lý kết nối mạng — WiFi, VPN, Ethernet',       icon:'📡', source:'pacman',   cat:'network',      stars:4.6, downloads:987000 },
  { name:'nm-applet',          desc:'NetworkManager system tray applet cho desktop',     icon:'📶', source:'pacman',   cat:'network',      stars:4.4, downloads:654000 },
  { name:'nmap',               desc:'Network scanner và security auditing tool',          icon:'🗺️', source:'pacman',   cat:'network',      stars:4.7, downloads:543000 },
  { name:'mtr',                desc:'Network diagnostic — kết hợp traceroute và ping',  icon:'🔍', source:'pacman',   cat:'network',      stars:4.6, downloads:234000 },
  { name:'filezilla',          desc:'FTP/SFTP/FTPS client đa năng và đáng tin cậy',     icon:'📁', source:'pacman',   cat:'network',      stars:4.4, downloads:432000 },
]

const CATEGORIES = [
  { id:'all',          label:'Tất cả',       icon:'⬡' },
  { id:'browser',      label:'Trình duyệt',  icon:'🌐' },
  { id:'editor',       label:'Editor/IDE',   icon:'⌨️'  },
  { id:'terminal',     label:'Terminal',     icon:'🖥️'  },
  { id:'social',       label:'Liên lạc',     icon:'💬' },
  { id:'media',        label:'Media',        icon:'🎵' },
  { id:'gaming',       label:'Gaming',       icon:'🎮' },
  { id:'graphics',     label:'Đồ họa',       icon:'🎨' },
  { id:'dev',          label:'Dev Tools',    icon:'🛠️'  },
  { id:'security',     label:'Bảo mật',      icon:'🔒' },
  { id:'productivity', label:'Công việc',    icon:'📋' },
  { id:'system',       label:'Hệ thống',     icon:'⚙️'  },
  { id:'network',      label:'Mạng',         icon:'📡' },
]

// Chỉ đề xuất app có stars >= 3.5 — tránh quảng bá app kém chất lượng
const RECOMMENDED_MIN_STARS = 3.5

const EDITORS_PICK  = ALL_APPS.filter(a => a.editors_pick && a.stars >= RECOMMENDED_MIN_STARS).slice(0, 6)
const TOP_RATED     = ALL_APPS.filter(a => a.stars >= RECOMMENDED_MIN_STARS)
  .sort((a,b) => b.stars - a.stars).slice(0, 10)
const TRENDING      = ALL_APPS.filter(a => a.stars >= RECOMMENDED_MIN_STARS)
  .sort((a,b) => b.downloads - a.downloads).slice(0, 8)

const PAGE_SIZE = 15

// Source badge config
const SOURCE_BADGE: Record<string, { label: string; color: string; icon: string }> = {
  pacman:   { label: '✓ Verified', color: 'rgba(0,230,120,0.85)',  icon: '✓' },
  aur:      { label: 'AUR',        color: 'rgba(255,160,0,0.85)',   icon: '★' },
  multilib: { label: '✓ Verified', color: 'rgba(0,200,255,0.85)',  icon: '✓' },
}

export function HomeView({ onSearch, onInstall, installProgress, t }: Props) {
  const [activeCat, setActiveCat] = useState('all')
  const [page, setPage]           = useState(1)
  const [sortBy, setSortBy]       = useState<'popular'|'rating'|'name'>('popular')
  const [liveRatings, setLiveRatings] = useState<Record<string, number>>({})

  // Fetch live ratings từ Worker để overlay lên static data
  useEffect(() => {
    const pkgNames = EDITORS_PICK.map(a => a.name).concat(TOP_RATED.slice(0,5).map(a => a.name))
    GetFeaturedRatings(pkgNames)
      .then((r: Record<string, number>) => { if (r) setLiveRatings(r) })
      .catch(() => {})
  }, [])

  const getStars = (app: AppEntry) => liveRatings[app.name] ?? app.stars

  const filtered = ALL_APPS
    .filter(a => activeCat === 'all' || a.cat === activeCat)
    .sort((a,b) =>
      sortBy === 'rating'  ? getStars(b) - getStars(a) :
      sortBy === 'name'    ? a.name.localeCompare(b.name) :
      b.downloads - a.downloads
    )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const handleCat = (id: string) => { setActiveCat(id); setPage(1) }

  return (
    <div className="home-view">

      {/* ── HERO ── */}
      <div className="home-hero">
        <div className="home-hero__content">
          <div className="home-hero__badge">⬡ ArchStore</div>
          <h1 className="home-hero__title">
            Kho ứng dụng<br/>
            <span className="home-hero__accent">tốt nhất cho Arch Linux</span>
          </h1>
          <p className="home-hero__sub">
            {ALL_APPS.length}+ packages từ pacman repo chính thức và AUR —
            tìm kiếm, cài đặt, đánh giá và backup an toàn
          </p>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button className="btn btn--primary home-hero__cta"
              onClick={() => (document.querySelector('.search-input') as HTMLInputElement)?.focus()}>
              🔍 Tìm kiếm ngay
            </button>
            <button className="btn home-hero__cta" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)' }}
              onClick={() => handleCat('editors_pick')}>
              ⭐ Editor's Pick
            </button>
          </div>
        </div>
        <div className="home-hero__art" aria-hidden="true">
          <div className="hero-ring hero-ring--1" />
          <div className="hero-ring hero-ring--2" />
          <div className="hero-ring hero-ring--3" />
          <span className="hero-logo">⬡</span>
        </div>
      </div>

      {/* ── EDITOR'S PICK ── */}
      <div style={{ marginBottom:24 }}>
        <div className="section-header" style={{ marginBottom:12 }}>
          ⭐ Editor's Pick
          <span style={{ fontSize:10, marginLeft:8, color:'rgba(220,235,255,0.3)', fontWeight:400 }}>
            Được kiểm duyệt thủ công · Chỉ app chất lượng cao (≥{RECOMMENDED_MIN_STARS}★)
          </span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {EDITORS_PICK.map(pkg => (
            <FeaturedCard key={pkg.name} pkg={pkg} stars={getStars(pkg)}
              progress={installProgress[pkg.name]}
              onSearch={onSearch} onInstall={onInstall} t={t} />
          ))}
        </div>
      </div>

      {/* ── TRENDING STRIP ── */}
      <div className="trending-strip" style={{ marginBottom:20 }}>
        <span className="trending-strip__label">🔥 Trending</span>
        {TRENDING.map(pkg => (
          <button key={pkg.name} className="trending-pill" onClick={() => onSearch(pkg.name)}>
            {pkg.icon} {pkg.name}
            <SourceBadge source={pkg.source} mini />
            <span className="trending-pill__dl">{fmtNum(pkg.downloads)}</span>
          </button>
        ))}
      </div>

      {/* ── MAIN GRID ── */}
      <div className="home-main">

        {/* LEFT: App catalog */}
        <div className="home-catalog">

          {/* Category tabs — có scroll ngang */}
          <div className="cat-tabs" style={{ overflowX:'auto', paddingBottom:4, flexWrap:'nowrap' }}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                className={`cat-tab ${activeCat===c.id ? 'cat-tab--active' : ''}`}
                onClick={() => handleCat(c.id)}
                style={{ flexShrink:0 }}
              >
                <span>{c.icon}</span> {c.label}
                {activeCat===c.id && (
                  <span className="cat-tab__count">
                    {ALL_APPS.filter(a => c.id==='all' || a.cat===c.id).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Sort + count bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:12, color:'rgba(220,235,255,0.35)' }}>
              {filtered.length} packages
              {activeCat !== 'all' && <span style={{ color:'rgba(0,245,255,0.4)', marginLeft:6 }}>trong {CATEGORIES.find(c=>c.id===activeCat)?.label}</span>}
            </span>
            <div style={{ display:'flex', background:'var(--bg-card)', border:'1px solid var(--glass-border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
              {([['popular','🔥 Phổ biến'],['rating','⭐ Đánh giá'],['name','A-Z']] as const).map(([v,l]) => (
                <button key={v} onClick={() => setSortBy(v)}
                  style={{ padding:'5px 12px', fontSize:11, border:'none', cursor:'pointer',
                    background: sortBy===v ? 'rgba(0,245,255,0.12)' : 'transparent',
                    color: sortBy===v ? 'var(--cyan)' : 'rgba(220,235,255,0.4)',
                  }}>{l}</button>
              ))}
            </div>
          </div>

          {/* App grid */}
          <div className="app-grid">
            {paginated.map(pkg => {
              const progress = installProgress[pkg.name]
              const isInstalling = progress && progress.stage !== 'done' && progress.stage !== 'error'
              const stars = getStars(pkg)
              const isLowRated = stars < RECOMMENDED_MIN_STARS
              return (
                <div key={pkg.name} className="app-card" onClick={() => onSearch(pkg.name)}
                  style={isLowRated ? { opacity:0.6 } : {}}>
                  <div className="app-card__icon">{pkg.icon}</div>
                  <div className="app-card__info">
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div className="app-card__name">{pkg.name}</div>
                      {pkg.editors_pick && !isLowRated && (
                        <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3,
                          background:'rgba(255,200,0,0.12)', color:'rgba(255,200,0,0.7)',
                          border:'1px solid rgba(255,200,0,0.2)' }}>Pick</span>
                      )}
                    </div>
                    <div className="app-card__desc">{pkg.desc}</div>
                    <div className="app-card__meta">
                      <SourceBadge source={pkg.source} mini />
                      <StarDisplay stars={stars} isLow={isLowRated} />
                      <span style={{ fontSize:10, color:'rgba(220,235,255,0.25)' }}>
                        {fmtNum(pkg.downloads)}
                      </span>
                    </div>
                    {isLowRated && (
                      <div style={{ fontSize:10, color:'rgba(255,100,100,0.5)', marginTop:2 }}>
                        ⚠ Đánh giá thấp — không được đề xuất
                      </div>
                    )}
                    {isInstalling && progress && (
                      <div className="install-progress__bar-track" style={{ marginTop:6 }}>
                        <div className="install-progress__bar-fill" style={{ width:`${progress.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn--primary app-card__btn"
                    disabled={!!isInstalling}
                    onClick={e => { e.stopPropagation(); onInstall(pkg.name) }}
                  >
                    {isInstalling && progress ? `${progress.progress.toFixed(0)}%` : t('pkg.install')}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop:16 }}>
              <button className="page-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>‹</button>
              {Array.from({length:totalPages},(_,i)=>i+1)
                .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=1)
                .reduce<(number|'...')[]>((acc,p,i,arr) => {
                  if (i > 0 && typeof arr[i-1] === 'number' && (p as number) - (arr[i-1] as number) > 1)
                    acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p,i) => p === '...'
                  ? <span key={`e${i}`} style={{padding:'0 6px',color:'rgba(220,235,255,0.2)'}}>…</span>
                  : <button key={p} className={`page-btn ${page===p?'page-btn--active':''}`} onClick={() => setPage(p as number)}>{p}</button>
                )}
              <button className="page-btn" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>›</button>
            </div>
          )}
        </div>

        {/* RIGHT: Sidebar rankings */}
        <div className="home-sidebar">
          <div className="section-header" style={{ fontSize:12 }}>🏆 Top Đánh Giá</div>
          <div style={{ fontSize:10, color:'rgba(220,235,255,0.25)', marginBottom:10 }}>
            Chỉ hiển thị app ≥{RECOMMENDED_MIN_STARS}★
          </div>
          {TOP_RATED.map((pkg, i) => (
            <div key={pkg.name} className="rank-row" onClick={() => onSearch(pkg.name)}>
              <span className="rank-row__num">{i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}</span>
              <span className="rank-row__icon">{pkg.icon}</span>
              <div className="rank-row__info">
                <div className="rank-row__name">{pkg.name}</div>
                <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                  <SourceBadge source={pkg.source} mini />
                </div>
              </div>
              <span style={{ color:'var(--amber)', fontSize:13, fontWeight:700 }}>
                {getStars(pkg).toFixed(1)}★
              </span>
            </div>
          ))}

          {/* Legend */}
          <div style={{ marginTop:20, padding:'12px', background:'rgba(0,245,255,0.03)', borderRadius:8, border:'1px solid rgba(0,245,255,0.08)' }}>
            <div style={{ fontSize:11, color:'rgba(220,235,255,0.5)', fontWeight:600, marginBottom:8 }}>Nguồn gốc</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <SourceBadge source="pacman" />
                <span style={{ fontSize:11, color:'rgba(220,235,255,0.4)' }}>Repo chính thức Arch</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <SourceBadge source="aur" />
                <span style={{ fontSize:11, color:'rgba(220,235,255,0.4)' }}>Arch User Repository</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SourceBadge({ source, mini }: { source: string; mini?: boolean }) {
  const cfg = SOURCE_BADGE[source] || { label: source, color: 'rgba(150,150,150,0.7)', icon: '' }
  return (
    <span style={{
      fontSize: mini ? 9 : 10,
      padding: mini ? '1px 5px' : '2px 7px',
      borderRadius: 3,
      background: cfg.color.replace('0.85', '0.12'),
      color: cfg.color,
      border: `1px solid ${cfg.color.replace('0.85', '0.3')}`,
      fontWeight: 600,
      letterSpacing: '0.3px',
    }}>
      {cfg.label}
    </span>
  )
}

function StarDisplay({ stars, isLow }: { stars: number; isLow?: boolean }) {
  const color = isLow ? 'rgba(255,100,100,0.6)' : 'var(--amber)'
  return (
    <span style={{ fontSize:10, color, display:'flex', alignItems:'center', gap:2 }}>
      <span>{'★'.repeat(Math.round(stars))}{'☆'.repeat(5-Math.round(stars))}</span>
      <span style={{ opacity:0.7 }}>{stars.toFixed(1)}</span>
    </span>
  )
}

function FeaturedCard({ pkg, stars, progress, onSearch, onInstall, t }:
  { pkg: AppEntry; stars: number; progress?: InstallProgress; onSearch: (n:string)=>void; onInstall: (n:string)=>void; t: (k:string)=>string }) {
  const isInstalling = progress && progress.stage !== 'done' && progress.stage !== 'error'
  return (
    <div className="app-card" style={{ flexDirection:'row', alignItems:'center', gap:12, padding:'14px 16px' }}
      onClick={() => onSearch(pkg.name)}>
      <div style={{ fontSize:28, lineHeight:1, flexShrink:0 }}>{pkg.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
          <div className="app-card__name" style={{ fontSize:13 }}>{pkg.name}</div>
          <SourceBadge source={pkg.source} mini />
        </div>
        <div className="app-card__desc" style={{ fontSize:11, WebkitLineClamp:1 }}>{pkg.desc}</div>
        <StarDisplay stars={stars} />
      </div>
      <button className="btn btn--primary" style={{ fontSize:11, padding:'5px 12px', flexShrink:0 }}
        disabled={!!isInstalling}
        onClick={e => { e.stopPropagation(); onInstall(pkg.name) }}>
        {isInstalling && progress ? `${progress.progress.toFixed(0)}%` : t('pkg.install')}
      </button>
    </div>
  )
}

function fmtNum(n: number) {
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n/1000).toFixed(0)}K`
  return String(n)
}
