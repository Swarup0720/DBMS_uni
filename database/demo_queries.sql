-- ============================================================================
-- University Management System - DBMS Concepts Demonstration Queries
-- ============================================================================

USE university_management_db;

-- 1. Primary Key and Foreign Key metadata across all 7 tables
SELECT
  tc.TABLE_NAME,
  tc.CONSTRAINT_NAME,
  tc.CONSTRAINT_TYPE,
  kcu.COLUMN_NAME,
  kcu.REFERENCED_TABLE_NAME,
  kcu.REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
  AND tc.TABLE_NAME = kcu.TABLE_NAME
  AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
WHERE tc.TABLE_SCHEMA = DATABASE()
  AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'FOREIGN KEY')
ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_TYPE DESC, kcu.ORDINAL_POSITION;

-- 2. INNER JOIN: Students with their Department and User account
SELECT
  s.student_id,
  s.registration_number,
  s.full_name,
  d.department_code,
  d.department_name,
  s.semester,
  u.username,
  u.role
FROM students s
INNER JOIN departments d ON s.department_id = d.department_id
INNER JOIN users u ON s.user_id = u.user_id
ORDER BY s.student_id ASC;

-- 3. LEFT JOIN: All Departments including those with 0 students or 0 exams
SELECT
  d.department_id,
  d.department_code,
  d.department_name,
  d.head_of_department,
  COUNT(DISTINCT s.student_id) AS student_count,
  COUNT(DISTINCT f.faculty_id) AS faculty_count
FROM departments d
LEFT JOIN students s ON d.department_id = s.department_id
LEFT JOIN faculty f ON d.department_id = f.department_id
GROUP BY d.department_id, d.department_code, d.department_name, d.head_of_department
ORDER BY student_count DESC, d.department_name ASC;

-- 4. GROUP BY and HAVING: Departments with at least 2 students and their avg semester
SELECT
  d.department_code,
  d.department_name,
  COUNT(s.student_id) AS total_students,
  ROUND(AVG(s.semester), 2) AS avg_semester
FROM departments d
INNER JOIN students s ON d.department_id = s.department_id
GROUP BY d.department_id, d.department_code, d.department_name
HAVING COUNT(s.student_id) >= 2
ORDER BY total_students DESC;

-- 5. Aggregate Functions (COUNT, SUM, AVG, MIN, MAX) on Examination Results
SELECT
  e.exam_id,
  e.subject_code,
  e.subject_name,
  COUNT(r.result_id) AS students_evaluated,
  SUM(r.marks_obtained) AS total_marks_scored,
  ROUND(AVG(r.marks_obtained), 2) AS average_marks,
  MIN(r.marks_obtained) AS lowest_marks,
  MAX(r.marks_obtained) AS highest_marks
FROM examinations e
INNER JOIN results r ON e.exam_id = r.exam_id
GROUP BY e.exam_id, e.subject_code, e.subject_name
ORDER BY e.exam_id ASC;

-- 6. Database Views: Querying pre-defined attendance summary view
SELECT
  registration_number,
  full_name,
  department_code,
  semester,
  total_classes,
  present_classes,
  absent_classes,
  attendance_percentage
FROM vw_student_attendance_summary
ORDER BY attendance_percentage DESC, registration_number ASC;

-- 7. Stored Procedures: Calling sp_get_department_report
CALL sp_get_department_report(NULL);

-- 8. Triggers: Inspecting active database triggers
SELECT
  TRIGGER_NAME,
  EVENT_OBJECT_TABLE,
  ACTION_TIMING,
  EVENT_MANIPULATION,
  ACTION_STATEMENT
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
ORDER BY EVENT_OBJECT_TABLE, ACTION_TIMING;

-- 9. Transactions: Atomic update with SAVEPOINT / ROLLBACK demonstration
START TRANSACTION;
  SELECT student_id, registration_number, semester FROM students WHERE student_id = 1;
  UPDATE students SET semester = 5 WHERE student_id = 1;
  SELECT student_id, registration_number, semester FROM students WHERE student_id = 1;
ROLLBACK;
SELECT student_id, registration_number, semester FROM students WHERE student_id = 1;

-- 10. Indexing: Inspecting indexes created across tables
SELECT
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME,
  NON_UNIQUE,
  INDEX_TYPE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 11. Normalization (1NF, 2NF, 3NF): Reconstructing normalized entities via joins
SELECT
  r.result_id,
  s.registration_number,
  s.full_name AS student_name,
  d.department_code,
  e.exam_name,
  e.subject_code,
  e.subject_name,
  r.marks_obtained,
  e.max_marks,
  ROUND((r.marks_obtained / e.max_marks) * 100, 2) AS derived_percentage
FROM results r
INNER JOIN students s ON r.student_id = s.student_id
INNER JOIN departments d ON s.department_id = d.department_id
INNER JOIN examinations e ON r.exam_id = e.exam_id
ORDER BY r.result_id ASC
LIMIT 15;

