-- ============================================================================
-- University Management System - Secondary Indexes
-- Note: Primary keys, UNIQUE constraints, and Foreign Keys automatically
-- create indexes in InnoDB. These composite/secondary indexes optimize
-- search, filtering, and reporting queries.
-- ============================================================================

USE university_management_db;

CREATE INDEX idx_students_full_name ON students (full_name);
CREATE INDEX idx_students_dept_sem ON students (department_id, semester);
CREATE INDEX idx_faculty_dept ON faculty (department_id);
CREATE INDEX idx_attendance_date_sem ON attendance (attendance_date, semester);
CREATE INDEX idx_attendance_faculty ON attendance (marked_by_faculty_id);
CREATE INDEX idx_exams_dept_sem ON examinations (department_id, semester);
CREATE INDEX idx_results_student ON results (student_id);

