<div align="center">

```
 █████╗ ██████╗  ██████╗██╗  ██╗███████╗████████╗ ██████╗ ██████╗ ███████╗
██╔══██╗██╔══██╗██╔════╝██║  ██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝
███████║██████╔╝██║     ███████║███████╗   ██║   ██║   ██║██████╔╝█████╗
██╔══██║██╔══██╗██║     ██╔══██║╚════██║   ██║   ██║   ██║██╔══██╗██╔══╝
██║  ██║██║  ██║╚██████╗██║  ██║███████║   ██║   ╚██████╔╝██║  ██║███████╗
╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝
```

**The Arch Linux App Store — Discover, install, and review packages with the community.**

[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?style=flat-square&logo=go&logoColor=white)](https://golang.org)
[![Wails](https://img.shields.io/badge/Wails-v2-FF3E00?style=flat-square&logo=go)](https://wails.io)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![License](https://img.shields.io/badge/License-LGPL_3.0-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Arch%20Linux-1793D1?style=flat-square&logo=arch-linux&logoColor=white)](https://archlinux.org)

<br/>

> ⬡ **pacman + AUR + Community Reviews** — all in one cyberpunk-themed desktop app.

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📦 Package Management
- Search **pacman repos** and **AUR** simultaneously
- One-click install & uninstall with real-time progress
- GUI authentication via `pkexec` (no terminal sudo)
- Automatic **snapshot backup** before every install/uninstall (Timeshift or Snapper)
- Detect installed packages and available updates

</td>
<td width="50%">

### ⭐ Community Reviews
- **Trustpilot-style** rating system (1–5 stars)
- Like / dislike reviews
- Maintainer reply threads
- Anti-fake protection: **JWT auth** + one review per user per package + **5/24h rate limit** + no self-vote
- Low-rated apps (< 3.5★) filtered from homepage recommendations

</td>
</tr>
<tr>
<td width="50%">

### 🔐 Full Auth System
- Local accounts with **Argon2id** password hashing
- **Discord** and **GitHub** OAuth
- JWT (1h) + rotating refresh tokens (30d, SHA-256 hashed in DB)
- Account lockout after 5 failed attempts
- Forgot password via email OTP (Resend)

</td>
<td width="50%">

### 🎨 Cyberpunk UI
- Glassmorphism design with animated neon grid
- **Verified** badge for official pacman packages
- **AUR** badge for community packages
- Live ratings overlaid on homepage cards
- Multilingual: 🇬🇧 English · 🇻🇳 Tiếng Việt · 🇯🇵 日本語

</td>
</tr>
</table>

---

## 🖥️ Screenshots

<div align="center">
<i>Homepage with featured apps, live ratings, and source badges</i>
<br/><br/>

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⬡ ArchStore          [  Search packages...  ]          🐧 paru  👤 │
├──────────┬──────────────────────────────────────────────────────────┤
│          │  Editor's Pick              Top Rated                     │
│  🏠 Home │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│          │  │ firefox     │  │ neovim      │  │ kitty       │      │
│  🔍 Search  │  │ ✓ Verified  │  │ ✓ Verified  │  │ ✓ Verified  │      │
│          │  │ ★★★★★ 4.8  │  │ ★★★★★ 4.9  │  │ ★★★★☆ 4.3  │      │
│  📦 Installed  │  │ [ Install ] │  │ [ Install ] │  │ [ Install ] │      │
│          │  └─────────────┘  └─────────────┘  └─────────────┘      │
│  🔄 Updates  │                                                         │
│          │  Trending AUR                                             │
│  ⚙️ Settings  │  ┌──────────────────────────────────────────────┐      │
│          │  │ yay  AUR  ★★★★★ 4.7  │  paru  AUR  ★★★★☆ 4.4  │      │
└──────────┴──────────────────────────────────────────────────────────┘
```

</div>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ArchStore Desktop                          │
│                                                                 │
│   ┌────────────────────┐        ┌────────────────────────────┐  │
│   │  React 18 + Vite   │◀──IPC──│     Go (Wails v2)          │  │
│   │  TypeScript        │──IPC──▶│                            │  │
│   │  Cyberpunk CSS     │        │  ┌──────────┬───────────┐  │  │
│   └────────────────────┘        │  │  pacman  │  AUR RPC  │  │  │
│                                 │  │  /pkexec │  v5 API   │  │  │
│                                 │  └──────────┴───────────┘  │  │
│                                 │  ┌────────────────────────┐ │  │
│                                 │  │  Timeshift / Snapper   │ │  │
│                                 │  │  (snapshot on install) │ │  │
│                                 │  └────────────────────────┘ │  │
│                                 └─────────────┬──────────────┘  │
└───────────────────────────────────────────────┼─────────────────┘
                                                │ HTTPS + X-Api-Key
                              ┌─────────────────▼──────────────────┐
                              │       Cloudflare Worker            │
                              │       TypeScript / Hono            │
                              │                                    │
                              │  POST /auth/*     JWT + Argon2id   │
                              │  GET  /ratings/:pkg  + Auth        │
                              │  POST /reviews    Rate limited      │
                              │  POST /votes      No self-vote      │
                              └─────────────────┬──────────────────┘
                                                │ D1 SQL
                              ┌─────────────────▼──────────────────┐
                              │         Cloudflare D1              │
                              │         (SQLite at Edge)           │
                              │                                    │
                              │  users · refresh_tokens            │
                              │  reviews · votes · replies         │
                              │  package_stats · oauth_states      │
                              └────────────────────────────────────┘
```

**Tech Stack:**

| Layer | Technology |
|---|---|
| Desktop runtime | [Wails v2](https://wails.io) (Go + WebView2) |
| Frontend | React 18, TypeScript, Vite |
| Backend (Go) | `os/exec` pacman/yay, AUR RPC v5 |
| API | Cloudflare Workers + [Hono](https://hono.dev) |
| Database | Cloudflare D1 (SQLite at edge) |
| Auth | JWT (HS256) + Argon2id + OAuth2 |
| Email | [Resend](https://resend.com) |

---

## 🚀 Quick Start

### Option A — Run the AppImage (Arch Linux)

```bash
# Download the latest AppImage
chmod +x ArchStore-*.AppImage

# Set your Worker URL and API key (see Self-Hosting below)
export ARCHSTORE_CF_WORKER_URL="https://your-worker.workers.dev"
export ARCHSTORE_API_KEY="your-api-key"

./ArchStore-*.AppImage
```

### Option B — Use the Installer

```bash
chmod +x ArchStore-Installer-*.AppImage
./ArchStore-Installer-*.AppImage
# Follow the 5-step GUI installer
```

---

## 🌐 Self-Hosting the Backend

ArchStore's community features (ratings, reviews, auth) require a Cloudflare Worker connected to a D1 database. Deploy your own in ~5 minutes.

### 1. Prerequisites

```bash
# Install Wrangler CLI
npm install -g wrangler@4
wrangler login
```

### 2. Create the Database

```bash
cd cloudflare/worker

# Copy the example config
cp wrangler.toml.example wrangler.toml

# Create D1 database → copy the ID into wrangler.toml
wrangler d1 create archstore-db

# Apply schema
wrangler d1 execute archstore-db --remote --file=../schema/schema.sql
```

### 3. Set Secrets

```bash
# Required
wrangler secret put JWT_SECRET          # random string >= 64 chars
wrangler secret put ARCHSTORE_API_KEY   # shared key with the desktop app

# Optional (for email & OAuth)
wrangler secret put RESEND_API_KEY
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

> **Generate a secure key:**
> ```bash
> openssl rand -base64 48
> ```

### 4. Deploy

```bash
wrangler deploy
# → https://archstore-api.YOUR_SUBDOMAIN.workers.dev
```

### 5. Configure the App

```bash
# Copy and fill in your values
cp .env.example .env

# Or set directly
export ARCHSTORE_CF_WORKER_URL="https://archstore-api.YOUR_SUBDOMAIN.workers.dev"
export ARCHSTORE_API_KEY="your-api-key-from-step-3"
```

---

## 🔨 Building from Source

### Prerequisites

```bash
# Go 1.23+
sudo pacman -S go

# Node.js 18+
sudo pacman -S nodejs npm

# Wails v2
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Verify
wails doctor
```

### Development (hot-reload)

```bash
export ARCHSTORE_CF_WORKER_URL="https://your-worker.workers.dev"
export ARCHSTORE_API_KEY="your-api-key"

wails dev
```

### Production Binary

```bash
# Inject your Worker URL at build time (keeps it out of source code)
wails build -ldflags="-X 'archstore/internal/app.defaultCFWorkerURL=https://your-worker.workers.dev'"

# Output: build/bin/archstore
```

### AppImage (distributable)

```bash
# Builds Wails binary + packages it as a self-contained AppImage
bash scripts/build-appimage.sh

# Or build everything at once (binary + AppImage + installer)
bash scripts/build-all.sh

# Output:
#   build/bin/ArchStore-1.0.0-x86_64.AppImage        (4 MB, app only)
#   build/bin/ArchStore-Installer-1.0.0-x86_64.AppImage  (104 MB, includes Electron installer UI)
```

---

## 🛡️ Security

### Layers of Protection

| Layer | What it does |
|---|---|
| **`X-Api-Key` header** | Every request from the desktop app carries a shared secret. Requests without it return `401`. |
| **Package name validation** | Whitelist `[a-zA-Z0-9\-_.+@]` on both Go and Worker side — blocks shell injection. |
| **Argon2id** | Passwords hashed with `t=2, m=512KB, p=1` — adapted for CF Workers free plan CPU limits. |
| **Refresh token rotation** | Only SHA-256 hash stored in DB. Raw token never persists server-side. |
| **JWT (HS256, 1h expiry)** | Short-lived access tokens. Refresh token revoked on password reset. |
| **Account lockout** | 5 failed logins → 15-minute lockout. |
| **One review per user** | Enforced by `UNIQUE INDEX ON reviews(pkg_name, user_id)` in D1. |
| **No self-vote** | Worker checks `review.user_id === jwt.sub` and returns `403`. |
| **Rate limiting** | 5 reviews per user per 24h. D1-backed, per-endpoint. |
| **Prepared statements** | All D1 queries use `?` binding — no SQL injection possible. |
| **pkexec** | GUI auth dialog for system changes — no terminal password exposure. |
| **Snapshot before install** | Timeshift or Snapper snapshot created before every install/uninstall. |

### Responsible Disclosure

Found a security issue? Please open a **private** GitHub Security Advisory instead of a public issue.

---

## 📁 Project Structure

```
archstore/
├── main.go                        # Wails entry point
├── internal/
│   ├── app/
│   │   ├── app.go                 # All Wails IPC bindings
│   │   └── auth.go                # Auth bindings (login, OAuth polling)
│   └── i18n/
│       └── i18n.go                # Thread-safe i18n manager
│
├── frontend/
│   └── src/
│       ├── App.tsx                # Root component + global state
│       ├── components/
│       │   ├── HomeView.tsx       # Homepage (85+ apps, ratings, badges)
│       │   ├── SearchView.tsx     # Search results grid
│       │   ├── PackageDetail.tsx  # Package page + review form
│       │   ├── InstalledView.tsx  # Installed packages
│       │   ├── UpdatesView.tsx    # Available updates
│       │   ├── AuthModal.tsx      # Login / register / OAuth modal
│       │   ├── SettingsView.tsx   # App settings
│       │   └── Sidebar.tsx        # Navigation
│       ├── hooks/useI18n.ts       # Language switcher hook
│       ├── styles/cyberpunk.css   # Cyberpunk glassmorphism theme
│       └── types/index.ts         # Shared TypeScript types
│
├── cloudflare/
│   ├── worker/src/
│   │   ├── index.ts               # Main Worker (ratings, reviews, votes)
│   │   ├── auth.ts                # Auth routes (register/login/OAuth)
│   │   ├── middleware/
│   │   │   ├── apiKey.ts          # X-Api-Key validation (timing-safe)
│   │   │   └── rateLimiter.ts     # D1-backed rate limiting
│   │   └── utils/
│   │       ├── hash.ts            # Argon2id + SHA-256 helpers
│   │       ├── jwt.ts             # HS256 sign/verify (Web Crypto API)
│   │       ├── email.ts           # Resend email sender
│   │       └── sanitize.ts        # HTML entity escaping
│   ├── schema/
│   │   ├── schema.sql             # Full D1 schema (fresh install)
│   │   └── migrate-v2.sql         # Migration from v1 schema
│   └── wrangler.toml.example      # Config template (copy → wrangler.toml)
│
├── installer/                     # Electron-based installer AppImage
│   └── src/
│       ├── main/index.js          # Main process (system check, file ops)
│       └── renderer/index.html    # 5-step installer UI
│
├── scripts/
│   ├── build-appimage.sh          # Package as AppImage
│   └── build-all.sh               # Build everything
│
├── .env.example                   # Environment variable template
└── .gitignore
```

---

## 🌏 Internationalization

ArchStore supports switching language **without restarting** the app. Preference is saved in `localStorage`.

| Language | Status |
|---|---|
| 🇬🇧 English | ✅ Complete |
| 🇻🇳 Tiếng Việt | ✅ Complete |
| 🇯🇵 日本語 | ✅ Complete |

To add a new language, create `locales/xx.json` and add the option to the language selector in `App.tsx`.

---

## 🔌 API Reference

All endpoints require the `X-Api-Key` header (except `/health`).
Write endpoints additionally require `Authorization: Bearer <jwt>`.

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | — | Health check |
| `/ratings/:pkg` | GET | optional | Package rating + reviews |
| `/reviews` | POST | JWT | Submit a review |
| `/votes` | POST | JWT | Like / dislike a review |
| `/replies` | POST | JWT | Reply to a review |
| `/auth/register` | POST | — | Create local account |
| `/auth/login` | POST | — | Login → JWT + refresh token |
| `/auth/logout` | POST | — | Revoke refresh token |
| `/auth/refresh` | POST | — | Rotate tokens |
| `/auth/me` | GET | JWT | Current user info |
| `/auth/forgot-password` | POST | — | Send OTP via email |
| `/auth/reset-password` | POST | — | Reset with OTP |
| `/auth/discord` | GET | — | Start Discord OAuth |
| `/auth/github` | GET | — | Start GitHub OAuth |
| `/auth/poll/:state` | GET | — | Poll OAuth result (desktop flow) |

---

## 🤝 Contributing

Contributions are welcome! Before submitting a PR:

1. **Fork** the repo and create a feature branch
2. For Cloudflare Worker changes, test locally with `wrangler dev`
3. For desktop app changes, test with `wails dev`
4. Make sure **no secrets or personal URLs** are committed (run `git diff --staged` before committing)
5. Update `wrangler.toml.example` if you add new environment variables

### Setting up your own backend

Every contributor should deploy their own Cloudflare Worker for testing — see [Self-Hosting](#-self-hosting-the-backend) above. The `ARCHSTORE_CF_WORKER_URL` env var points the desktop app to your own instance.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with 💜 for the Arch Linux community**

*If this project is useful to you, consider giving it a ⭐*

</div>
