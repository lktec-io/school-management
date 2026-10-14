-- =====================================================================
-- Phase 3: financial engine & SMS
--   * student_fee_allocations: opt-in optional fees (transport, meals…)
--   * student_fee_discounts: waivers/scholarships per student and term
--   * expenses: operational expenditure (voided, never deleted)
--   * sms_logs: batching, segments, error detail and retry lineage
-- =====================================================================

CREATE TABLE IF NOT EXISTS student_fee_allocations (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id        INT UNSIGNED NOT NULL,
  fee_structure_id  INT UNSIGNED NOT NULL,
  assigned_by       INT UNSIGNED NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fee_allocations_student_structure (student_id, fee_structure_id),
  KEY idx_fee_allocations_structure (fee_structure_id),
  CONSTRAINT fk_fee_allocations_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_allocations_structure FOREIGN KEY (fee_structure_id) REFERENCES fee_structures (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_allocations_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_fee_discounts (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id     INT UNSIGNED NOT NULL,
  term_id        INT UNSIGNED NOT NULL,
  fee_type_id    INT UNSIGNED NULL COMMENT 'NULL = applies to the whole term bill',
  discount_type  ENUM('fixed','percentage') NOT NULL,
  value          DECIMAL(12,2) NOT NULL,
  reason         VARCHAR(255) NOT NULL,
  status         ENUM('active','revoked') NOT NULL DEFAULT 'active',
  granted_by     INT UNSIGNED NOT NULL,
  revoked_by     INT UNSIGNED NULL,
  revoked_at     DATETIME     NULL,
  revoke_reason  VARCHAR(255) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_fee_discounts_student_term (student_id, term_id, status),
  KEY idx_fee_discounts_term_status (term_id, status),
  CONSTRAINT fk_fee_discounts_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_discounts_term FOREIGN KEY (term_id) REFERENCES terms (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_discounts_fee_type FOREIGN KEY (fee_type_id) REFERENCES fee_types (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_discounts_granted_by FOREIGN KEY (granted_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_discounts_revoked_by FOREIGN KEY (revoked_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_fee_discounts_value CHECK (value > 0 AND (discount_type <> 'percentage' OR value <= 100)),
  CONSTRAINT chk_fee_discounts_revocation CHECK (status <> 'revoked' OR (revoked_by IS NOT NULL AND revoked_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  expense_no    VARCHAR(30)  NOT NULL,
  category      ENUM('salaries','utilities','maintenance','supplies','transport','examinations','other') NOT NULL,
  description   VARCHAR(255) NOT NULL,
  payee         VARCHAR(150) NULL,
  amount        DECIMAL(12,2) NOT NULL,
  expense_date  DATE         NOT NULL,
  payment_mode  ENUM('cash','bank_deposit','bank_transfer','mobile_money','cheque') NOT NULL,
  reference_no  VARCHAR(100) NULL,
  status        ENUM('recorded','voided') NOT NULL DEFAULT 'recorded',
  recorded_by   INT UNSIGNED NOT NULL,
  voided_by     INT UNSIGNED NULL,
  voided_at     DATETIME     NULL,
  void_reason   VARCHAR(255) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_expenses_no (expense_no),
  KEY idx_expenses_date_status (expense_date, status),
  KEY idx_expenses_category_date (category, expense_date),
  CONSTRAINT fk_expenses_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_expenses_voided_by FOREIGN KEY (voided_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_expenses_amount CHECK (amount > 0),
  CONSTRAINT chk_expenses_void CHECK (status <> 'voided' OR (voided_by IS NOT NULL AND voided_at IS NOT NULL AND void_reason IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE sms_logs
  ADD COLUMN batch_id      CHAR(36)         NULL AFTER id,
  ADD COLUMN segments      TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER message,
  ADD COLUMN error_message VARCHAR(255)     NULL AFTER response_data,
  ADD COLUMN retry_of      BIGINT UNSIGNED  NULL AFTER sent_by,
  ADD KEY idx_sms_logs_batch (batch_id),
  ADD KEY idx_sms_logs_category_created (category, created_at),
  ADD CONSTRAINT fk_sms_logs_retry_of FOREIGN KEY (retry_of) REFERENCES sms_logs (id) ON DELETE SET NULL;
