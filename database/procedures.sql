-- ============================================================================
-- University Management System - Stored Procedures
-- ============================================================================

USE university_management_db;

DROP PROCEDURE IF EXISTS sp_get_department_report;
DROP PROCEDURE IF EXISTS sp_get_student_transcript;
DROP PROCEDURE IF EXISTS sp_get_attendance_report;
DROP PROCEDURE IF EXISTS sp_upsert_attendance;

DELIMITER //

-- 1. Department-wise academic & enrollment report (optional filter by department_id)
CREATE PROCEDURE sp_get_department_report(IN p_dept_id INT)
BEGIN
  SELECT
    d.department_id,
    d.department_code,
    d.department_name,
    d.head_of_department,
    COUNT(DISTINCT f.faculty_id) AS total_faculty,
    COUNT(DISTINCT s.student_id) AS total_students,
    COUNT(DISTINCT e.exam_id) AS total_exams,
    COALESCE(ROUND(AVG((r.marks_obtained / e.max_marks) * 100), 2), 0.00) AS avg_exam_percentage
  FROM departments d
  LEFT JOIN faculty f ON d.department_id = f.department_id
  LEFT JOIN students s ON d.department_id = s.department_id
  LEFT JOIN examinations e ON d.department_id = e.department_id
  LEFT JOIN results r ON e.exam_id = r.exam_id
  WHERE (p_dept_id IS NULL OR d.department_id = p_dept_id)
  GROUP BY
    d.department_id,
    d.department_code,
    d.department_name,
    d.head_of_department
  ORDER BY d.department_name ASC;
END //

-- 2. Student examination transcript (subject-wise marks + computed status)
CREATE PROCEDURE sp_get_student_transcript(IN p_student_id INT)
BEGIN
  SELECT
    exam_id,
    exam_name,
    subject_code,
    subject_name,
    exam_date,
    exam_semester,
    marks_obtained,
    max_marks,
    passing_marks,
    percentage,
    result_status,
    remarks
  FROM vw_student_results_detail
  WHERE student_id = p_student_id
  ORDER BY exam_semester ASC, exam_date DESC, subject_code ASC;
END //

-- 3. Attendance summary report filtered by optional department and semester
CREATE PROCEDURE sp_get_attendance_report(IN p_dept_id INT, IN p_semester INT)
BEGIN
  SELECT
    student_id,
    registration_number,
    full_name,
    department_code,
    department_name,
    semester,
    total_classes,
    present_classes,
    absent_classes,
    attendance_percentage
  FROM vw_student_attendance_summary
  WHERE (p_dept_id IS NULL OR department_id = p_dept_id)
    AND (p_semester IS NULL OR semester = p_semester)
  ORDER BY department_code ASC, semester ASC, registration_number ASC;
END //

-- 4. Upsert attendance record safely without duplicating (student, date, session)
CREATE PROCEDURE sp_upsert_attendance(
  IN p_student_id INT,
  IN p_faculty_id INT,
  IN p_attendance_date DATE,
  IN p_semester TINYINT UNSIGNED,
  IN p_session_name VARCHAR(80),
  IN p_status VARCHAR(10),
  IN p_remarks VARCHAR(200)
)
BEGIN
  INSERT INTO attendance (
    student_id,
    marked_by_faculty_id,
    attendance_date,
    semester,
    session_name,
    status,
    remarks
  )
  VALUES (
    p_student_id,
    p_faculty_id,
    p_attendance_date,
    p_semester,
    p_session_name,
    p_status,
    p_remarks
  )
  ON DUPLICATE KEY UPDATE
    marked_by_faculty_id = VALUES(marked_by_faculty_id),
    semester = VALUES(semester),
    status = VALUES(status),
    remarks = VALUES(remarks),
    updated_at = CURRENT_TIMESTAMP;
END //

DELIMITER ;

