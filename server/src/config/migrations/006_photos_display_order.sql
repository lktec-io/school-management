-- =====================================================================
-- Student photos (self-hosted under STORAGE_DIR/students) and explicit
-- display order for lists the Headmaster arranges by hand.
-- Classes already have sort_order; streams, subjects and fee types gain
-- display_order (ties fall back to name).
-- =====================================================================

ALTER TABLE students
  ADD COLUMN photo_path VARCHAR(255) NULL AFTER address;

ALTER TABLE streams
  ADD COLUMN display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER code,
  ADD KEY idx_streams_class_order (class_id, display_order);

ALTER TABLE subjects
  ADD COLUMN display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER level,
  ADD KEY idx_subjects_level_order (level, display_order);

ALTER TABLE fee_types
  ADD COLUMN display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER description;
