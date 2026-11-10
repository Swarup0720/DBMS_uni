-- ============================================================================
-- University Management System - Database Triggers
-- ============================================================================

USE university_management_db;

DROP TRIGGER IF EXISTS trg_users_before_insert;
DROP TRIGGER IF EXISTS trg_students_before_insert;
DROP TRIGGER IF EXISTS trg_attendance_before_insert;
DROP TRIGGER IF EXISTS trg_results_before_insert;
DROP TRIGGER IF EXISTS trg_results_before_update;

DELIMITER //

-- 1. Normalize username and email before inserting a user
CREATE TRIGGER trg_users_before_insert
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
  SET NEW.username = TRIM(NEW.username);
  SET NEW.email = LOWER(TRIM(NEW.email));
  SET NEW.full_name = TRIM(NEW.full_name);
END //

-- 2. Normalize registration number and email before inserting a student
CREATE TRIGGER trg_students_before_insert
BEFORE INSERT ON students
FOR EACH ROW
BEGIN
  SET NEW.registration_number = UPPER(TRIM(NEW.registration_number));
  SET NEW.email = LOWER(TRIM(NEW.email));
  SET NEW.full_name = TRIM(NEW.full_name);
END //

-- 3. Prevent marking attendance for future dates
CREATE TRIGGER trg_attendance_before_insert
BEFORE INSERT ON attendance
FOR EACH ROW
BEGIN
  IF NEW.attendance_date > CURDATE() THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Attendance date cannot be in the future.';
  END IF;
END //

-- 4. Enforce cross-table integrity: marks_obtained cannot exceed exam max_marks (INSERT)
CREATE TRIGGER trg_results_before_insert
BEFORE INSERT ON results
FOR EACH ROW
BEGIN
  DECLARE v_max_marks DECIMAL(6,2) DEFAULT NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_max_marks = NULL;

  SELECT max_marks INTO v_max_marks
  FROM examinations
  WHERE exam_id = NEW.exam_id;

  IF v_max_marks IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Referenced examination does not exist.';
  END IF;

  IF NEW.marks_obtained < 0 OR NEW.marks_obtained > v_max_marks THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Marks obtained must be between 0 and the examination maximum marks.';
  END IF;
END //

-- 5. Enforce cross-table integrity: marks_obtained cannot exceed exam max_marks (UPDATE)
CREATE TRIGGER trg_results_before_update
BEFORE UPDATE ON results
FOR EACH ROW
BEGIN
  DECLARE v_max_marks DECIMAL(6,2) DEFAULT NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_max_marks = NULL;

  SELECT max_marks INTO v_max_marks
  FROM examinations
  WHERE exam_id = NEW.exam_id;

  IF v_max_marks IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Referenced examination does not exist.';
  END IF;

  IF NEW.marks_obtained < 0 OR NEW.marks_obtained > v_max_marks THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Marks obtained must be between 0 and the examination maximum marks.';
  END IF;
END //

DELIMITER ;

