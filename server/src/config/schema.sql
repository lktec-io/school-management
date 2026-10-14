-- =====================================================================
-- Private School Management System — MySQL 8.0.16+ schema
-- Run through `npm run db:migrate` (creates the database from DB_NAME).
-- Every statement is idempotent so the script can be re-run safely.
-- Conventions:
--   * InnoDB + utf8mb4 everywhere (Swahili/Arabic names, emoji-safe SMS text)
--   * Money: DECIMAL(12,2) in TZS. Scores: DECIMAL(5,2).
--   * Academic and financial rows are never cascaded away: FKs RESTRICT,
--     records are deactivated / reversed instead of deleted.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- Users & authentication
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name              VARCHAR(150) NOT NULL,
  email                  VARCHAR(190) NULL,
  phone                  VARCHAR(15)  NULL COMMENT 'Normalised international format, e.g. 255777123456',
  password_hash          VARCHAR(255) NOT NULL,
  role                   ENUM('admin','accountant','teacher','parent') NOT NULL,
  status                 ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  must_change_password   TINYINT(1)   NOT NULL DEFAULT 0,
  token_version          INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Incremented to revoke all issued JWTs',
  failed_login_attempts  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until           DATETIME     NULL,
  last_login_at          DATETIME     NULL,
  password_changed_at    DATETIME     NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  KEY idx_users_role_status (role, status),
  CONSTRAINT chk_users_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Academic calendar
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_years (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  year_label      VARCHAR(20)  NOT NULL COMMENT 'e.g. 2026 or 2026/2027',
  start_date      DATE         NOT NULL,
  end_date        DATE         NOT NULL,
  is_current      TINYINT(1)   NOT NULL DEFAULT 0,
  -- NULL for non-current rows, 1 for the current one: the unique key allows only one current year.
  current_marker  TINYINT GENERATED ALWAYS AS (IF(is_current = 1, 1, NULL)) STORED,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_academic_years_label (year_label),
  UNIQUE KEY uq_academic_years_current (current_marker),
  CONSTRAINT chk_academic_years_dates CHECK (end_date > start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS terms (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  academic_year_id  INT UNSIGNED NOT NULL,
  term_name         VARCHAR(50)  NOT NULL COMMENT 'e.g. Term I',
  term_number       TINYINT UNSIGNED NOT NULL,
  start_date        DATE         NOT NULL,
  end_date          DATE         NOT NULL,
  is_current        TINYINT(1)   NOT NULL DEFAULT 0,
  current_marker    TINYINT GENERATED ALWAYS AS (IF(is_current = 1, 1, NULL)) STORED,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_terms_year_number (academic_year_id, term_number),
  UNIQUE KEY uq_terms_id_year (id, academic_year_id),
  UNIQUE KEY uq_terms_current (current_marker),
  CONSTRAINT fk_terms_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years (id) ON DELETE RESTRICT,
  CONSTRAINT chk_terms_dates CHECK (end_date > start_date),
  CONSTRAINT chk_terms_number CHECK (term_number BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Classes & streams
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  class_name        VARCHAR(50)  NOT NULL COMMENT 'e.g. Standard Five, Form Two',
  code              VARCHAR(20)  NOT NULL COMMENT 'e.g. STD5, F2',
  level             ENUM('nursery','primary','o_level','a_level') NOT NULL,
  sort_order        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  class_teacher_id  INT UNSIGNED NULL,
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_classes_code (code),
  UNIQUE KEY uq_classes_name (class_name),
  KEY idx_classes_level_order (level, sort_order),
  CONSTRAINT fk_classes_class_teacher FOREIGN KEY (class_teacher_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS streams (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  class_id     INT UNSIGNED NOT NULL,
  stream_name  VARCHAR(30)  NOT NULL COMMENT 'e.g. A, B, Blue',
  code         VARCHAR(20)  NOT NULL COMMENT 'e.g. F2A',
  capacity     SMALLINT UNSIGNED NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_streams_code (code),
  UNIQUE KEY uq_streams_class_name (class_id, stream_name),
  UNIQUE KEY uq_streams_id_class (id, class_id),
  CONSTRAINT fk_streams_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  registration_number  VARCHAR(30)  NOT NULL,
  first_name           VARCHAR(60)  NOT NULL,
  middle_name          VARCHAR(60)  NULL,
  last_name            VARCHAR(60)  NOT NULL,
  gender               ENUM('male','female') NOT NULL,
  dob                  DATE         NOT NULL,
  class_id             INT UNSIGNED NOT NULL,
  stream_id            INT UNSIGNED NULL,
  parent_name          VARCHAR(150) NOT NULL,
  parent_phone         VARCHAR(15)  NOT NULL COMMENT 'Normalised international format, used for SMS',
  parent_user_id       INT UNSIGNED NULL COMMENT 'Parent portal account, if issued',
  address              VARCHAR(255) NULL,
  admission_date       DATE         NULL,
  status               ENUM('active','graduated','transferred','suspended','withdrawn') NOT NULL DEFAULT 'active',
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_registration (registration_number),
  KEY idx_students_class_stream (class_id, stream_id),
  KEY idx_students_status (status),
  KEY idx_students_name (last_name, first_name),
  KEY idx_students_parent_phone (parent_phone),
  KEY idx_students_parent_user (parent_user_id),
  CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE RESTRICT,
  -- Composite FK guarantees the stream actually belongs to the student's class.
  CONSTRAINT fk_students_stream FOREIGN KEY (stream_id, class_id) REFERENCES streams (id, class_id) ON DELETE RESTRICT,
  CONSTRAINT fk_students_parent_user FOREIGN KEY (parent_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fee_types (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(80)  NOT NULL COMMENT 'e.g. Tuition, Transport, Examination',
  code         VARCHAR(20)  NOT NULL,
  description  VARCHAR(255) NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fee_types_code (code),
  UNIQUE KEY uq_fee_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_structures (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fee_type_id   INT UNSIGNED NOT NULL,
  class_id      INT UNSIGNED NOT NULL,
  term_id       INT UNSIGNED NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  currency      CHAR(3)      NOT NULL DEFAULT 'TZS',
  is_mandatory  TINYINT(1)   NOT NULL DEFAULT 1,
  created_by    INT UNSIGNED NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fee_structures_type_class_term (fee_type_id, class_id, term_id),
  KEY idx_fee_structures_class_term (class_id, term_id),
  CONSTRAINT fk_fee_structures_type FOREIGN KEY (fee_type_id) REFERENCES fee_types (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_structures_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_structures_term FOREIGN KEY (term_id) REFERENCES terms (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_structures_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_fee_structures_amount CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_payments (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  receipt_no       VARCHAR(30)  NOT NULL,
  student_id       INT UNSIGNED NOT NULL,
  term_id          INT UNSIGNED NOT NULL,
  fee_type_id      INT UNSIGNED NULL COMMENT 'NULL = general payment against the term balance',
  amount_paid      DECIMAL(12,2) NOT NULL,
  payment_mode     ENUM('cash','bank_deposit','bank_transfer','mobile_money','cheque') NOT NULL,
  reference_no     VARCHAR(100) NULL COMMENT 'Bank slip / mobile money transaction ID',
  payment_date     DATE         NOT NULL,
  notes            VARCHAR(255) NULL,
  status           ENUM('confirmed','reversed') NOT NULL DEFAULT 'confirmed',
  reversed_by      INT UNSIGNED NULL,
  reversed_at      DATETIME     NULL,
  reversal_reason  VARCHAR(255) NULL,
  recorded_by      INT UNSIGNED NOT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fee_payments_receipt (receipt_no),
  -- Prevents the same bank/mobile transaction being recorded twice (NULL references are exempt).
  UNIQUE KEY uq_fee_payments_mode_reference (payment_mode, reference_no),
  KEY idx_fee_payments_student_term (student_id, term_id),
  KEY idx_fee_payments_term_status (term_id, status),
  KEY idx_fee_payments_date (payment_date),
  KEY idx_fee_payments_recorded_by (recorded_by),
  CONSTRAINT fk_fee_payments_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_payments_term FOREIGN KEY (term_id) REFERENCES terms (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_payments_type FOREIGN KEY (fee_type_id) REFERENCES fee_types (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_payments_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_payments_reversed_by FOREIGN KEY (reversed_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_fee_payments_amount CHECK (amount_paid > 0),
  CONSTRAINT chk_fee_payments_reversal CHECK (
    status <> 'reversed' OR (reversed_by IS NOT NULL AND reversed_at IS NOT NULL AND reversal_reason IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gap-free document numbering (receipts, registration numbers). Rows are locked with
-- SELECT ... FOR UPDATE inside the same transaction that writes the document.
CREATE TABLE IF NOT EXISTS document_sequences (
  seq_key     VARCHAR(40)  NOT NULL COMMENT 'e.g. RECEIPT-2026',
  seq_value   INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (seq_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Subjects & teaching load
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(80)  NOT NULL,
  code        VARCHAR(20)  NOT NULL,
  level       ENUM('nursery','primary','o_level','a_level') NOT NULL,
  is_core     TINYINT(1)   NOT NULL DEFAULT 1,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_code (code),
  UNIQUE KEY uq_subjects_name_level (name, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  teacher_id        INT UNSIGNED NOT NULL,
  subject_id        INT UNSIGNED NOT NULL,
  class_id          INT UNSIGNED NOT NULL,
  stream_id         INT UNSIGNED NULL COMMENT 'NULL = all streams of the class',
  academic_year_id  INT UNSIGNED NOT NULL,
  -- Lets the unique key treat "whole class" (NULL stream) as a real value.
  stream_key        INT UNSIGNED GENERATED ALWAYS AS (IFNULL(stream_id, 0)) STORED,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teacher_assignments_slot (subject_id, class_id, stream_key, academic_year_id),
  KEY idx_teacher_assignments_teacher_year (teacher_id, academic_year_id),
  CONSTRAINT fk_teacher_assignments_teacher FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_teacher_assignments_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE RESTRICT,
  CONSTRAINT fk_teacher_assignments_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE RESTRICT,
  CONSTRAINT fk_teacher_assignments_stream FOREIGN KEY (stream_id, class_id) REFERENCES streams (id, class_id) ON DELETE RESTRICT,
  CONSTRAINT fk_teacher_assignments_year FOREIGN KEY (academic_year_id) REFERENCES academic_years (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Examinations, marks & grading
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grades (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  level       ENUM('nursery','primary','o_level','a_level') NOT NULL,
  grade       VARCHAR(2)   NOT NULL,
  min_score   DECIMAL(5,2) NOT NULL,
  max_score   DECIMAL(5,2) NOT NULL,
  points      DECIMAL(3,1) NOT NULL DEFAULT 0,
  remark      VARCHAR(50)  NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_grades_level_grade (level, grade),
  KEY idx_grades_level_min (level, min_score),
  CONSTRAINT chk_grades_range CHECK (min_score >= 0 AND max_score <= 100 AND min_score <= max_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exams (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name              VARCHAR(100) NOT NULL COMMENT 'e.g. Midterm Examination Term I',
  exam_type         ENUM('quiz','monthly_test','midterm','terminal','annual','mock') NOT NULL,
  term_id           INT UNSIGNED NOT NULL,
  academic_year_id  INT UNSIGNED NOT NULL,
  start_date        DATE         NULL,
  end_date          DATE         NULL,
  max_score         DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  status            ENUM('draft','open','closed','published') NOT NULL DEFAULT 'draft'
                    COMMENT 'open = marks entry allowed, published = visible to parents',
  created_by        INT UNSIGNED NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exams_term_type_name (term_id, exam_type, name),
  KEY idx_exams_year_term (academic_year_id, term_id),
  KEY idx_exams_status (status),
  -- Composite FK keeps term and academic year consistent.
  CONSTRAINT fk_exams_term_year FOREIGN KEY (term_id, academic_year_id) REFERENCES terms (id, academic_year_id) ON DELETE RESTRICT,
  CONSTRAINT fk_exams_year FOREIGN KEY (academic_year_id) REFERENCES academic_years (id) ON DELETE RESTRICT,
  CONSTRAINT fk_exams_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_exams_max_score CHECK (max_score > 0 AND max_score <= 100),
  CONSTRAINT chk_exams_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- exam_type, term and academic year are carried by the exam row (no duplicated columns to drift).
CREATE TABLE IF NOT EXISTS marks (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  exam_id     INT UNSIGNED NOT NULL,
  student_id  INT UNSIGNED NOT NULL,
  subject_id  INT UNSIGNED NOT NULL,
  score       DECIMAL(5,2) NULL COMMENT 'NULL when the student was absent',
  is_absent   TINYINT(1)   NOT NULL DEFAULT 0,
  remarks     VARCHAR(255) NULL,
  entered_by  INT UNSIGNED NOT NULL,
  updated_by  INT UNSIGNED NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marks_exam_student_subject (exam_id, student_id, subject_id),
  KEY idx_marks_student_exam (student_id, exam_id),
  KEY idx_marks_subject_exam (subject_id, exam_id),
  CONSTRAINT fk_marks_exam FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE RESTRICT,
  CONSTRAINT fk_marks_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
  CONSTRAINT fk_marks_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE RESTRICT,
  CONSTRAINT fk_marks_entered_by FOREIGN KEY (entered_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_marks_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_marks_score CHECK (
    (is_absent = 1 AND score IS NULL) OR (is_absent = 0 AND score IS NOT NULL AND score >= 0 AND score <= 100)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Messaging & auditing
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_logs (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient            VARCHAR(15)  NOT NULL,
  message              TEXT         NOT NULL,
  category             ENUM('fee_reminder','payment_receipt','results','announcement','other') NOT NULL DEFAULT 'other',
  status               ENUM('queued','sent','failed','delivered') NOT NULL DEFAULT 'queued',
  provider             VARCHAR(30)  NOT NULL DEFAULT 'beem',
  provider_request_id  VARCHAR(100) NULL,
  response_data        JSON         NULL,
  student_id           INT UNSIGNED NULL,
  sent_by              INT UNSIGNED NULL,
  sent_at              DATETIME     NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sms_logs_status_created (status, created_at),
  KEY idx_sms_logs_recipient (recipient),
  KEY idx_sms_logs_student (student_id),
  KEY idx_sms_logs_provider_request (provider_request_id),
  CONSTRAINT fk_sms_logs_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE SET NULL,
  CONSTRAINT fk_sms_logs_sent_by FOREIGN KEY (sent_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NULL,
  action        VARCHAR(60)  NOT NULL COMMENT 'e.g. auth.login, payment.create, mark.update',
  target_table  VARCHAR(64)  NULL,
  target_id     BIGINT UNSIGNED NULL,
  details       JSON         NULL COMMENT 'Before/after values for finance and mark edits',
  ip_address    VARCHAR(45)  NULL,
  user_agent    VARCHAR(255) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_target (target_table, target_id),
  KEY idx_audit_logs_user_created (user_id, created_at),
  KEY idx_audit_logs_action_created (action, created_at),
  KEY idx_audit_logs_created (created_at),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Reference data: NECTA grading scales (editable by the Headmaster).
-- INSERT IGNORE leaves any school-customised rows untouched on re-run.
-- ---------------------------------------------------------------------
INSERT IGNORE INTO grades (level, grade, min_score, max_score, points, remark) VALUES
  ('primary', 'A', 81.00, 100.00, 0, 'Excellent'),
  ('primary', 'B', 61.00,  80.99, 0, 'Very Good'),
  ('primary', 'C', 41.00,  60.99, 0, 'Good'),
  ('primary', 'D', 21.00,  40.99, 0, 'Satisfactory'),
  ('primary', 'E',  0.00,  20.99, 0, 'Fail'),

  ('o_level', 'A', 75.00, 100.00, 1, 'Excellent'),
  ('o_level', 'B', 65.00,  74.99, 2, 'Very Good'),
  ('o_level', 'C', 45.00,  64.99, 3, 'Good'),
  ('o_level', 'D', 30.00,  44.99, 4, 'Satisfactory'),
  ('o_level', 'F',  0.00,  29.99, 5, 'Fail'),

  ('a_level', 'A', 80.00, 100.00, 1, 'Excellent'),
  ('a_level', 'B', 70.00,  79.99, 2, 'Very Good'),
  ('a_level', 'C', 60.00,  69.99, 3, 'Good'),
  ('a_level', 'D', 50.00,  59.99, 4, 'Average'),
  ('a_level', 'E', 40.00,  49.99, 5, 'Satisfactory'),
  ('a_level', 'S', 35.00,  39.99, 6, 'Subsidiary'),
  ('a_level', 'F',  0.00,  34.99, 7, 'Fail');
