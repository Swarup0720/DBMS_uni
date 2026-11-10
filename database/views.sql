-- ============================================================================
-- University Management System - Database Views
-- ============================================================================

USE university_management_db;

-- 1. Student profiles with department information
CREATE OR REPLACE VIEW vw_student_profiles AS
SELECT
  s.student_id,
  s.user_id,
  s.registration_number,
  s.full_name,
  s.email,
  s.phone,
  s.department_id,
  d.department_name,
  d.department_code,
  s.semester,
  s.admission_year,
  s.created_at
FROM students s
INNER JOIN departments d ON s.department_id = d.department_id;

-- 2. Faculty directory with department information
CREATE OR REPLACE VIEW vw_faculty_directory AS
SELECT
  f.faculty_id,
  f.user_id,
  f.full_name,
  f.email,
  f.phone,
  f.department_id,
  d.department_name,
  d.department_code,
  f.designation,
  f.created_at
FROM faculty f
INNER JOIN departments d ON f.department_id = d.department_id;

-- 3. Student attendance percentage summary
CREATE OR REPLACE VIEW vw_student_attendance_summary AS
SELECT
  s.student_id,
  s.registration_number,
  s.full_name,
  s.department_id,
  d.department_name,
  d.department_code,
  s.semester,
  COUNT(a.attendance_id) AS total_classes,
  COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0) AS present_classes,
  COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0) AS absent_classes,
  CASE
    WHEN COUNT(a.attendance_id) = 0 THEN 0.00
    ELSE ROUND(
      (SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) / COUNT(a.attendance_id)) * 100,
      2
    )
  END AS attendance_percentage
FROM students s
INNER JOIN departments d ON s.department_id = d.department_id
LEFT JOIN attendance a ON s.student_id = a.student_id
GROUP BY
  s.student_id,
  s.registration_number,
  s.full_name,
  s.department_id,
  d.department_name,
  d.department_code,
  s.semester;

-- 4. Student examination results with automatic percentage and PASS/FAIL status
CREATE OR REPLACE VIEW vw_student_results_detail AS
SELECT
  r.result_id,
  r.exam_id,
  e.exam_name,
  e.subject_code,
  e.subject_name,
  e.exam_date,
  e.semester AS exam_semester,
  e.department_id,
  d.department_name,
  d.department_code,
  s.student_id,
  s.registration_number,
  s.full_name AS student_name,
  r.marks_obtained,
  e.max_marks,
  e.passing_marks,
  ROUND((r.marks_obtained / e.max_marks) * 100, 2) AS percentage,
  CASE
    WHEN r.marks_obtained >= e.passing_marks THEN 'PASS'
    ELSE 'FAIL'
  END AS result_status,
  r.remarks,
  r.updated_at
FROM results r
INNER JOIN examinations e ON r.exam_id = e.exam_id
INNER JOIN students s ON r.student_id = s.student_id
INNER JOIN departments d ON e.department_id = d.department_id;

-- 5. Department summary across faculty, students, and examinations
CREATE OR REPLACE VIEW vw_department_summary AS
SELECT
  d.department_id,
  d.department_name,
  d.department_code,
  d.head_of_department,
  COUNT(DISTINCT f.faculty_id) AS total_faculty,
  COUNT(DISTINCT s.student_id) AS total_students,
  COUNT(DISTINCT e.exam_id) AS total_examinations
FROM departments d
LEFT JOIN faculty f ON d.department_id = f.department_id
LEFT JOIN students s ON d.department_id = s.department_id
LEFT JOIN examinations e ON d.department_id = e.department_id
GROUP BY
  d.department_id,
  d.department_name,
  d.department_code,
  d.head_of_department;

