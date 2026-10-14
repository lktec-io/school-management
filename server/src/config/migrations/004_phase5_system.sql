-- =====================================================================
-- Phase 5: editable school settings & audit query performance
--   * system_settings: school identity and branding asset paths, editable by
--     the Headmaster (values fall back to SCHOOL_* in .env when unset)
--   * audit_logs: extra index for the audit trail screen's text/IP filters
-- =====================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key    VARCHAR(64)  NOT NULL,
  setting_value  TEXT         NULL,
  updated_by     INT UNSIGNED NULL,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_system_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE audit_logs
  ADD KEY idx_audit_logs_ip_created (ip_address, created_at);
