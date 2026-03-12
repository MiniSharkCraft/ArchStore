-- ╔══════════════════════════════════════════════════════╗
-- ║         ArchStore — Cloudflare D1 Schema v2          ║
-- ║                                                      ║
-- ║  Deploy (lần đầu):                                   ║
-- ║    wrangler d1 execute archstore-db \                ║
-- ║      --file=cloudflare/schema/schema.sql             ║
-- ║                                                      ║
-- ║  Bảo mật:                                            ║
-- ║    - Password: Argon2id (t=2, m=512, p=1)            ║
-- ║    - Refresh token: SHA-256 hash, không lưu raw      ║
-- ║    - Reset code: 6-digit OTP, expire 15 phút         ║
-- ║    - Vote: user_id-based (không dùng IP)             ║
-- ║    - Review: unique per (pkg_name, user_id)          ║
-- ╚══════════════════════════════════════════════════════╝

-- ─────────────────────────────────────────────
-- Bảng USERS
-- password_hash dạng "argon2id:saltHex:hashHex"
-- Không bao giờ lưu raw password
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  email           TEXT    UNIQUE COLLATE NOCASE,       -- NULL cho OAuth không có email
  password_hash   TEXT,                                -- NULL cho OAuth users
  provider        TEXT    NOT NULL DEFAULT 'local',    -- 'local'|'discord'|'github'
  provider_id     TEXT,                                -- OAuth provider user ID
  avatar_url      TEXT,
  is_verified     INTEGER NOT NULL DEFAULT 0,          -- 1 = email đã xác minh
  is_active       INTEGER NOT NULL DEFAULT 1,          -- 0 = bị ban/xóa
  failed_attempts INTEGER NOT NULL DEFAULT 0,          -- đếm đăng nhập sai
  locked_until    TEXT,                                -- ISO 8601, NULL = không khóa
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);

-- ─────────────────────────────────────────────
-- Bảng REFRESH_TOKENS
-- Lưu SHA-256 hash của raw token, KHÔNG lưu token thật
-- Token rotation: xóa cũ, tạo mới mỗi lần dùng
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,  -- SHA-256 hex của raw token
  expires_at TEXT    NOT NULL,         -- ISO 8601, 30 ngày từ lúc tạo
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry ON refresh_tokens(expires_at);

-- ─────────────────────────────────────────────
-- Bảng PASSWORD_RESETS
-- OTP 6 số, hết hạn sau 15 phút
-- Mỗi request mới invalidate tất cả code cũ của email đó
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL COLLATE NOCASE,
  code       TEXT    NOT NULL,             -- 6-digit OTP
  used       INTEGER NOT NULL DEFAULT 0,   -- 1 = đã dùng
  expires_at TEXT    NOT NULL,             -- ISO 8601
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_resets_lookup ON password_resets(email, used, expires_at);

-- ─────────────────────────────────────────────
-- Bảng OAUTH_STATES
-- State token cho PKCE-lite OAuth flow
-- Desktop app poll /auth/poll/:state mỗi 2 giây
-- Xóa state ngay sau khi đọc (one-time use)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_states (
  state         TEXT    PRIMARY KEY,        -- random 32-byte hex
  jwt           TEXT,                       -- NULL khi đang pending
  refresh_token TEXT,
  expires_at    TEXT    NOT NULL,           -- ISO 8601, +10 phút
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);

-- ─────────────────────────────────────────────
-- Bảng RATE_LIMITS (dùng bởi rateLimiter middleware)
-- key: "rl:/path:IP"
-- Tự xóa khi reset_at < now (bằng cách overwrite)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT    PRIMARY KEY,
  count    INTEGER NOT NULL DEFAULT 1,
  reset_at INTEGER NOT NULL  -- Unix timestamp
);

-- ─────────────────────────────────────────────
-- Bảng REVIEWS
-- Mỗi user chỉ được review một package một lần
-- user_id NULL = review cũ trước khi có auth (legacy)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pkg_name    TEXT    NOT NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    TEXT    NOT NULL,
  rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  likes       INTEGER NOT NULL DEFAULT 0 CHECK(likes >= 0),
  dislikes    INTEGER NOT NULL DEFAULT 0 CHECK(dislikes >= 0),
  sys_kernel  TEXT,
  sys_arch    TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0  -- 1 = đã xác nhận cài đặt thực sự
);

-- Index tìm kiếm theo package
CREATE INDEX IF NOT EXISTS idx_reviews_pkg     ON reviews(pkg_name);
CREATE INDEX IF NOT EXISTS idx_reviews_rating  ON reviews(pkg_name, rating);
CREATE INDEX IF NOT EXISTS idx_reviews_likes   ON reviews(pkg_name, likes DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user    ON reviews(user_id);

-- Mỗi user chỉ review một lần (áp dụng cho authenticated users)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_user
  ON reviews(pkg_name, user_id)
  WHERE user_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- Bảng REPLIES
-- Maintainer phản hồi review
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS replies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id     INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author        TEXT    NOT NULL,
  content       TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  is_maintainer INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_replies_review ON replies(review_id);

-- ─────────────────────────────────────────────
-- Bảng VOTES
-- vote_key: "user_<user_id>:<review_id>" (không dùng IP)
-- Chống self-vote bằng cách check user_id trong Worker
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vote_key    TEXT    NOT NULL UNIQUE,  -- "user_<id>:<review_id>"
  review_id   INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vote_type   TEXT    NOT NULL CHECK(vote_type IN ('like', 'dislike')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_votes_review ON votes(review_id);
CREATE INDEX IF NOT EXISTS idx_votes_user   ON votes(user_id);

-- ─────────────────────────────────────────────
-- Bảng PACKAGE_STATS
-- Cache thống kê aggregate, cập nhật qua trigger
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS package_stats (
  pkg_name      TEXT PRIMARY KEY,
  avg_rating    REAL    NOT NULL DEFAULT 0.0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  total_likes   INTEGER NOT NULL DEFAULT 0,
  last_updated  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────

-- Cập nhật package_stats sau khi thêm review mới
CREATE TRIGGER IF NOT EXISTS trg_stats_insert_review
AFTER INSERT ON reviews
BEGIN
  INSERT INTO package_stats (pkg_name, avg_rating, total_reviews, last_updated)
  VALUES (NEW.pkg_name, NEW.rating, 1, datetime('now'))
  ON CONFLICT(pkg_name) DO UPDATE SET
    avg_rating    = ROUND((avg_rating * total_reviews + NEW.rating) / (total_reviews + 1), 2),
    total_reviews = total_reviews + 1,
    last_updated  = datetime('now');
END;

-- Cập nhật package_stats sau khi xóa review
CREATE TRIGGER IF NOT EXISTS trg_stats_delete_review
AFTER DELETE ON reviews
BEGIN
  UPDATE package_stats SET
    avg_rating    = CASE
      WHEN total_reviews <= 1 THEN 0
      ELSE ROUND((avg_rating * total_reviews - OLD.rating) / (total_reviews - 1), 2)
    END,
    total_reviews = MAX(0, total_reviews - 1),
    last_updated  = datetime('now')
  WHERE pkg_name = OLD.pkg_name;
END;

-- Xóa refresh tokens hết hạn tự động (gọi khi cleanup)
-- D1 không có cron job nên cleanup trong mỗi request /auth/refresh
-- ─────────────────────────────────────────────
-- SAMPLE DATA (chỉ cho development — KHÔNG dùng trên production)
-- Uncomment nếu cần seed data:
-- ─────────────────────────────────────────────

-- INSERT OR IGNORE INTO reviews (pkg_name, username, rating, comment, sys_kernel, sys_arch, is_verified)
-- VALUES
--   ('firefox',  'archuser_vn', 5, 'Trình duyệt ổn định trên Arch.', '6.6.0-arch1', '2024.01.01', 1),
--   ('firefox',  'linuxfan99',  4, 'Works great on Arch!',            '6.5.9-arch1', '2024.01.01', 1),
--   ('neovim',   'vimcoder',    5, 'LSP support hoàn hảo.',           '6.6.0-arch1', '2024.01.01', 1);
