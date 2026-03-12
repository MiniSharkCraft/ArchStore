-- ArchStore Auth Migration v2
-- Chạy: wrangler d1 execute archstore-db --file=schema/migration_auth.sql

-- ─────────────────────────────────────────────
-- Bảng USERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT    NOT NULL UNIQUE,
  email           TEXT    UNIQUE,
  avatar_url      TEXT,
  provider        TEXT    NOT NULL DEFAULT 'local', -- 'local'|'discord'|'github'
  provider_id     TEXT,                             -- OAuth provider's user ID
  password_hash   TEXT,                             -- Argon2id (chỉ local accounts)
  is_verified     INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,       -- brute force lockout counter
  locked_until    TEXT,                             -- ISO timestamp, NULL = không bị khóa
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider
  ON users(provider, provider_id) WHERE provider_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- Bảng REFRESH_TOKENS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE, -- SHA-256 of plaintext token
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ─────────────────────────────────────────────
-- Bảng OAUTH_STATES (dùng cho desktop app polling)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_states (
  state         TEXT PRIMARY KEY,
  jwt           TEXT,          -- được set sau khi OAuth hoàn tất
  refresh_token TEXT,          -- refresh token để client lưu
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- Bảng PASSWORD_RESETS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL,
  code       TEXT    NOT NULL, -- 6-digit code
  expires_at TEXT    NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);

-- ─────────────────────────────────────────────
-- Thêm user_id vào bảng REVIEWS
-- (nullable để backward compatible với reviews cũ)
-- ─────────────────────────────────────────────
ALTER TABLE reviews ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- Cleanup job: xóa oauth_states và password_resets hết hạn
-- (chạy thủ công hoặc từ cron trigger)
-- ─────────────────────────────────────────────
-- DELETE FROM oauth_states WHERE expires_at < datetime('now');
-- DELETE FROM password_resets WHERE expires_at < datetime('now') AND used = 1;
