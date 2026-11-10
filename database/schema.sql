-- ============================================================================
-- University Management System - Database Schema (MySQL 8+)
-- Normalized to 1NF, 2NF, and 3NF with strict referential integrity
-- ============================================================================

CREATE DATABASE IF NOT EXISTS university_management_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE university_management_db;

-- Drop child tables first to guarantee clean re-initialization
DROP TABLE IF EXISTS results;
DROP TABLE IF EXISTS examinations;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS faculty;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;

-- 1. Users table (Authentication & Role-Based Access Control)
CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'faculty', 'student') NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT chk_users_is_active CHECK (is_active IN (0, 1))
) ENGINE=InnoDB;

-- 2. Departments table
CREATE TABLE departments (
  department_id INT AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(100) NOT NULL,
  department_code VARCHAR(20) NOT NULL,
  head_of_department VARCHAR(120) NOT NULL DEFAULT 'TBD',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_departments_name UNIQUE (department_name),
  CONSTRAINT uq_departments_code UNIQUE (department_code)
) ENGINE=InnoDB;

-- 3. Faculty table (Many faculty members belong to one department; 1:1 with user)
CREATE TABLE faculty (
  faculty_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  department_id INT NOT NULL,
  designation VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_faculty_user UNIQUE (user_id),
  CONSTRAINT uq_faculty_email UNIQUE (email),
  CONSTRAINT fk_faculty_user FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_faculty_department FOREIGN KEY (department_id)
    REFERENCES departments(department_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 4. Students table (Many students belong to one department; 1:1 with user)
CREATE TABLE students (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  registration_number VARCHAR(30) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  department_id INT NOT NULL,
  semester TINYINT UNSIGNED NOT NULL,
  admission_year SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_students_user UNIQUE (user_id),
  CONSTRAINT uq_students_reg_no UNIQUE (registration_number),
  CONSTRAINT uq_students_email UNIQUE (email),
  CONSTRAINT chk_students_semester CHECK (semester BETWEEN 1 AND 8),
  CONSTRAINT chk_students_admission_year CHECK (admission_year BETWEEN 2000 AND 2100),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_students_department FOREIGN KEY (department_id)
    REFERENCES departments(department_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 5. Attendance table (Tracks per-student attendance per date & class session)
CREATE TABLE attendance (
  attendance_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  marked_by_faculty_id INT NULL,
  attendance_date DATE NOT NULL,
  semester TINYINT UNSIGNED NOT NULL,
  session_name VARCHAR(80) NOT NULL DEFAULT 'Regular Class',
  status ENUM('Present', 'Absent') NOT NULL,
  remarks VARCHAR(200) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_attendance_student_date_session UNIQUE (student_id, attendance_date, session_name),
  CONSTRAINT chk_attendance_semester CHECK (semester BETWEEN 1 AND 8),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id)
    REFERENCES students(student_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_attendance_faculty FOREIGN KEY (marked_by_faculty_id)
    REFERENCES faculty(faculty_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 6. Examinations table (Subject-wise examinations per department & semester)
CREATE TABLE examinations (
  exam_id INT AUTO_INCREMENT PRIMARY KEY,
  exam_name VARCHAR(120) NOT NULL,
  subject_code VARCHAR(30) NOT NULL,
  subject_name VARCHAR(120) NOT NULL,
  department_id INT NOT NULL,
  semester TINYINT UNSIGNED NOT NULL,
  exam_date DATE NOT NULL,
  max_marks DECIMAL(6,2) NOT NULL DEFAULT 100.00,
  passing_marks DECIMAL(6,2) NOT NULL DEFAULT 40.00,
  created_by_faculty_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_exam_subject_dept_sem UNIQUE (exam_name, subject_code, department_id, semester),
  CONSTRAINT chk_exam_semester CHECK (semester BETWEEN 1 AND 8),
  CONSTRAINT chk_exam_max_marks CHECK (max_marks > 0),
  CONSTRAINT chk_exam_passing_marks CHECK (passing_marks >= 0),
  CONSTRAINT chk_exam_passing_lte_max CHECK (passing_marks <= max_marks),
  CONSTRAINT fk_exams_department FOREIGN KEY (department_id)
    REFERENCES departments(department_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_exams_faculty FOREIGN KEY (created_by_faculty_id)
    REFERENCES faculty(faculty_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 7. Results table (Student marks per examination; derived % and status computed via SQL/Views for 3NF)
CREATE TABLE results (
  result_id INT AUTO_INCREMENT PRIMARY KEY,
  exam_id INT NOT NULL,
  student_id INT NOT NULL,
  marks_obtained DECIMAL(6,2) NOT NULL,
  entered_by_faculty_id INT NULL,
  remarks VARCHAR(200) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_result_exam_student UNIQUE (exam_id, student_id),
  CONSTRAINT chk_results_marks_non_negative CHECK (marks_obtained >= 0),
  CONSTRAINT fk_results_exam FOREIGN KEY (exam_id)
    REFERENCES examinations(exam_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_results_student FOREIGN KEY (student_id)
    REFERENCES students(student_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_results_faculty FOREIGN KEY (entered_by_faculty_id)
    REFERENCES faculty(faculty_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

