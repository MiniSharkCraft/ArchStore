-- migrate-v2.sql — chỉ tạo các bảng auth mới (users, tokens, etc.)
-- ALTER TABLE đã được chạy session trước, không cần chạy lại

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  email           TEXT    UNIQUE COLLATE NOCASE,
  password_hash   TEXT,
  provider        TEXT    NOT NULL DEFAULT 'local',
  provider_id     TEXT,
  avatar_url      TEXT,
  is_verified     INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry ON refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL COLLATE NOCASE,
  code       TEXT    NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_resets_lookup ON password_resets(email, used, expires_at);

CREATE TABLE IF NOT EXISTS oauth_states (
  state         TEXT    PRIMARY KEY,
  jwt           TEXT,
  refresh_token TEXT,
  expires_at    TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT    PRIMARY KEY,
  count    INTEGER NOT NULL DEFAULT 1,
  reset_at INTEGER NOT NULL
);

-- idx_reviews_unique_user: tạo nếu chưa có (user_id đã có trong reviews)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_user ON reviews(pkg_name, user_id);
-- idx_votes_user: user_id vừa được thêm vào votes qua ALTER TABLE
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);

DROP TRIGGER IF EXISTS update_stats_after_review;

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
