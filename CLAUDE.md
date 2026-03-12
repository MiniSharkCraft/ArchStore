# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ArchStore is a Wails v2 desktop application — an Arch Linux app store that combines pacman/AUR package management with a Trustpilot-style community review system. The backend is a Cloudflare Worker (TypeScript/Hono) connected to a Cloudflare D1 (SQLite) database.

## Commands

### Desktop App (Wails)

```bash
# Development (hot-reload for both Go and React)
wails dev

# Production build — outputs to build/bin/archstore
wails build
```

### Frontend only (from frontend/)

```bash
npm install
npm run dev      # Vite dev server
npm run build    # tsc + vite build
```

### Cloudflare Worker (from cloudflare/worker/)

```bash
wrangler login
wrangler d1 create archstore-db           # one-time setup
wrangler d1 execute archstore-db --file=../schema/schema.sql   # apply schema
wrangler dev                               # local worker dev
wrangler deploy                            # deploy to Cloudflare
```

### Go

```bash
go build ./...
go test ./...
```

## Architecture

```
main.go  →  internal/app/app.go  (all Wails bindings)
              ├── pacman / yay CLI calls
              ├── AUR RPC API (HTTP)
              └── Cloudflare Worker API (HTTP)
```

- **`main.go`** — Wails entry point; embeds `frontend/dist` into the binary.
- **`internal/app/app.go`** — All Go functions exposed to the frontend via Wails IPC bindings (SearchPackages, InstallPackage, SubmitReview, etc.).
- **`internal/i18n/i18n.go`** — Thread-safe i18n manager; loads JSON files from `locales/` at runtime with hot-swap support. Uses `{{key}}` interpolation syntax.
- **`frontend/src/`** — React 18 + TypeScript SPA. Wails auto-generates `frontend/wailsjs/` bindings — do not edit those files manually.
- **`cloudflare/worker/src/index.ts`** — Hono-based REST API deployed to Cloudflare Workers, connected to D1 for reviews/votes/replies.
- **`cloudflare/schema/schema.sql`** — D1 schema with triggers that auto-update `package_stats` on new reviews.

## Key Patterns

### Wails Bindings
All Go methods on the `App` struct in `internal/app/app.go` are callable from the frontend as async JS functions (auto-generated into `frontend/wailsjs/`). Frontend calls them like: `await SearchPackages("firefox")`.

### Package Name Validation
Package names are validated against `[a-zA-Z0-9\-_.+@]` on both the Go side (before shell commands) and the Worker side (`sanitizePackageName()`). This is the security boundary for shell injection.

### i18n
- Go backend: `i18n.Manager.T("key", map[string]string{"var": "val"})`
- Frontend: `useI18n` hook in `frontend/src/hooks/useI18n.ts`; language preference stored in `localStorage`, no restart needed.
- Locale files: `locales/en.json`, `locales/vi.json`, `locales/ja.json` (and `zh`).

### Worker Config
Before deploying the Cloudflare Worker, replace `YOUR_DATABASE_ID_HERE` in `cloudflare/worker/wrangler.toml` with the ID from `wrangler d1 create`.

Set the backend URL in the desktop app via environment variable:
```bash
export ARCHSTORE_CF_WORKER_URL="https://archstore-api.your-subdomain.workers.dev"
```
