-- =====================================================================
-- Phase 2: academic core
--   * marks snapshot the student's class/stream at entry time, so results,
--     rankings and report cards stay correct after promotions/transfers
--   * report_remarks: class teacher & headmaster comments per report card
--   * A-level points switched to NECTA division points (A=1 ... F=7)
-- =====================================================================

ALTER TABLE marks
  ADD COLUMN class_id  INT UNSIGNED NULL AFTER subject_id,
  ADD COLUMN stream_id INT UNSIGNED NULL AFTER class_id;

UPDATE marks m
  JOIN students s ON s.id = m.student_id
   SET m.class_id = s.class_id,
       m.stream_id = s.stream_id;

ALTER TABLE marks
  MODIFY class_id INT UNSIGNED NOT NULL,
  ADD KEY idx_marks_exam_class_stream (exam_id, class_id, stream_id),
  ADD CONSTRAINT fk_marks_class FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_marks_stream FOREIGN KEY (stream_id, class_id) REFERENCES streams (id, class_id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS report_remarks (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  exam_id               INT UNSIGNED NOT NULL,
  student_id            INT UNSIGNED NOT NULL,
  class_teacher_remark  VARCHAR(500) NULL,
  headmaster_remark     VARCHAR(500) NULL,
  updated_by            INT UNSIGNED NOT NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_report_remarks_exam_student (exam_id, student_id),
  KEY idx_report_remarks_student (student_id),
  CONSTRAINT fk_report_remarks_exam FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE RESTRICT,
  CONSTRAINT fk_report_remarks_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE RESTRICT,
  CONSTRAINT fk_report_remarks_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Only rows still holding the original Phase 1 seed values are converted.
UPDATE grades
   SET points = CASE grade
                  WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4
                  WHEN 'E' THEN 5 WHEN 'S' THEN 6 WHEN 'F' THEN 7
                END
 WHERE level = 'a_level'
   AND ((grade = 'A' AND points = 5) OR (grade = 'B' AND points = 4) OR (grade = 'D' AND points = 2)
     OR (grade = 'E' AND points = 1) OR (grade = 'S' AND points = 0.5) OR (grade = 'F' AND points = 0));
