-- =====================================================================
-- Public website: announcements shown on the landing page ("Matangazo").
-- Managed by the Headmaster under School Settings; only published,
-- unexpired notices are exposed publicly.
-- =====================================================================

CREATE TABLE IF NOT EXISTS announcements (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title         VARCHAR(160) NOT NULL,
  body          TEXT         NOT NULL,
  category      ENUM('general','admissions','examinations','events','fees') NOT NULL DEFAULT 'general',
  is_published  TINYINT(1)   NOT NULL DEFAULT 1,
  published_at  DATE         NOT NULL,
  expires_at    DATE         NULL,
  created_by    INT UNSIGNED NOT NULL,
  updated_by    INT UNSIGNED NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_public (is_published, published_at, expires_at),
  CONSTRAINT fk_announcements_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_announcements_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_announcements_dates CHECK (expires_at IS NULL OR expires_at >= published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
