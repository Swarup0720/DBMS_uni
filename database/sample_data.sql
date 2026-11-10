-- ============================================================================
-- University Management System - Realistic Sample Data
-- Demo Login Passwords (hashed with bcrypt cost 10):
--   Admin   (admin@university.edu)    : Admin@123
--   Faculty (faculty1@university.edu) : Faculty@123
--   Student (student1@university.edu) : Student@123
-- ============================================================================

USE university_management_db;

-- 1. Users
INSERT INTO users (user_id, username, email, password_hash, role, full_name, is_active) VALUES
  (1,  'admin',       'admin@university.edu',    '$2b$10$hMDvchf5JnOqYr6dj3R4heAdbItu7e1Psrru1s12EfKF/PtV/cd6i', 'admin',   'System Administrator', 1),
  (2,  'faculty.cse', 'faculty1@university.edu', '$2b$10$XO6F0Ebvq1CTsZy13CJ54e5Q6.qqsSM9nGOU8s3rzYmL.7oE7GtGW', 'faculty', 'Dr. Rajesh Verma',     1),
  (3,  'faculty.ece', 'faculty2@university.edu', '$2b$10$XO6F0Ebvq1CTsZy13CJ54e5Q6.qqsSM9nGOU8s3rzYmL.7oE7GtGW', 'faculty', 'Dr. Meera Nair',       1),
  (4,  'faculty.cse2','faculty3@university.edu', '$2b$10$XO6F0Ebvq1CTsZy13CJ54e5Q6.qqsSM9nGOU8s3rzYmL.7oE7GtGW', 'faculty', 'Prof. Ananya Iyer',    1),
  (5,  'faculty.me',  'faculty4@university.edu', '$2b$10$XO6F0Ebvq1CTsZy13CJ54e5Q6.qqsSM9nGOU8s3rzYmL.7oE7GtGW', 'faculty', 'Dr. Arvind Kulkarni',  1),
  (6,  'faculty.ce',  'faculty5@university.edu', '$2b$10$XO6F0Ebvq1CTsZy13CJ54e5Q6.qqsSM9nGOU8s3rzYmL.7oE7GtGW', 'faculty', 'Dr. Sunita Deshmukh',  1),
  (7,  'reg2024001',  'student1@university.edu', '$2b$10$uMcXWmG0ynbb/hCttI6kOefroFOXq9MismfQtiebDpYUVPh0iUCNK', 'student', 'Aarav Sharma',         1),
  (8,  'reg2024002',  'student2@university.edu', '$2b$10$uMcXWmG0ynbb/hCttI6kOefroFOXq9MismfQtiebDpYUVPh0iUCNK', 'student', 'Priya Patel',          1),
  (9,  'reg2024003',  'student3@university.edu', '$2b$10$uMcXWmG0ynbb/hCttI6kOefroFOXq9MismfQtiebDpYUVPh0iUCNK', 'student', 'Rohan Gupta',          1),
  (10, 'reg2023004',  'student4@university.edu', '$2b$10$uMcXWmG0ynbb/hCttI6kOefroFOXq9MismfQtiebDpYUVPh0iUCNK', 'student', 'Sneha Reddy',          1),
  (11, 'reg2023005',  'student5@university.edu', '$2b$10$uMcXWmG0ynbb/hCttI6kOefroFOXq9MismfQtiebDpYUVPh0iUCNK', 'student', 'Kabir Malhotra',       1),
  (12, 'reg2024006',  'student6@university.edu', '$2b$10$uMcXWmG0ynbb/hCttI6kOefroFOXq9MismfQtiebDpYUVPh0iUCNK', 'student', 'Ishita Joshi',         1),
  (13, 'reg2024007',  'student7@university.edu', '$2b$10$uMcXWmG0ynbb/hCttI6kOefroFOXq9MismfQtiebDpYUVPh0iUCNK', 'student', 'Vikram Singh',         1),
  (14, 'reg2025008',  'student8@university.edu', '$2b$10$uMcXWmG0ynbb/hCttI6kOefroFOXq9MismfQtiebDpYUVPh0iUCNK', 'student', 'Nisha Menon',          1),
  (15, 'reg2024009',  'student9@university.edu', '$2b$10$uMcXWmG0ynbb/hCttI6kOefroFOXq9MismfQtiebDpYUVPh0iUCNK', 'student', 'Aditya Rao',           1),
  (16, 'reg2025010',  'student10@university.edu','$2b$10$uMcXWmG0ynbb/hCttI6kOefroFOXq9MismfQtiebDpYUVPh0iUCNK', 'student', 'Kavya Nair',           1);

-- 2. Departments
INSERT INTO departments (department_id, department_name, department_code, head_of_department) VALUES
  (1, 'Computer Science & Engineering', 'CSE', 'Dr. Rajesh Verma'),
  (2, 'Electronics & Communication',    'ECE', 'Dr. Meera Nair'),
  (3, 'Mechanical Engineering',         'ME',  'Dr. Arvind Kulkarni'),
  (4, 'Civil Engineering',              'CE',  'Dr. Sunita Deshmukh');

-- 3. Faculty
INSERT INTO faculty (faculty_id, user_id, full_name, email, phone, department_id, designation) VALUES
  (1, 2, 'Dr. Rajesh Verma',    'faculty1@university.edu', '9810011201', 1, 'Professor & HOD'),
  (2, 3, 'Dr. Meera Nair',      'faculty2@university.edu', '9810011202', 2, 'Professor & HOD'),
  (3, 4, 'Prof. Ananya Iyer',   'faculty3@university.edu', '9810011203', 1, 'Associate Professor'),
  (4, 5, 'Dr. Arvind Kulkarni', 'faculty4@university.edu', '9810011204', 3, 'Professor & HOD'),
  (5, 6, 'Dr. Sunita Deshmukh', 'faculty5@university.edu', '9810011205', 4, 'Professor & HOD');

-- 4. Students
INSERT INTO students (student_id, user_id, registration_number, full_name, email, phone, department_id, semester, admission_year) VALUES
  (1,  7,  'REG2024001', 'Aarav Sharma',   'student1@university.edu',  '9876501001', 1, 4, 2024),
  (2,  8,  'REG2024002', 'Priya Patel',    'student2@university.edu',  '9876501002', 1, 4, 2024),
  (3,  9,  'REG2024003', 'Rohan Gupta',    'student3@university.edu',  '9876501003', 1, 4, 2024),
  (4,  10, 'REG2023004', 'Sneha Reddy',    'student4@university.edu',  '9876501004', 1, 6, 2023),
  (5,  11, 'REG2023005', 'Kabir Malhotra', 'student5@university.edu',  '9876501005', 1, 6, 2023),
  (6,  12, 'REG2024006', 'Ishita Joshi',   'student6@university.edu',  '9876501006', 2, 4, 2024),
  (7,  13, 'REG2024007', 'Vikram Singh',   'student7@university.edu',  '9876501007', 2, 4, 2024),
  (8,  14, 'REG2025008', 'Nisha Menon',    'student8@university.edu',  '9876501008', 2, 2, 2025),
  (9,  15, 'REG2024009', 'Aditya Rao',     'student9@university.edu',  '9876501009', 3, 4, 2024),
  (10, 16, 'REG2025010', 'Kavya Nair',     'student10@university.edu', '9876501010', 3, 2, 2025);

-- 5. Attendance Records
INSERT INTO attendance (student_id, marked_by_faculty_id, attendance_date, semester, session_name, status, remarks) VALUES
  -- CSE Sem 4 (Students 1, 2, 3) across 5 sessions
  (1, 1, '2026-10-12', 4, 'DBMS Lecture', 'Present', NULL),
  (2, 1, '2026-10-12', 4, 'DBMS Lecture', 'Present', NULL),
  (3, 1, '2026-10-12', 4, 'DBMS Lecture', 'Absent',  'Medical leave'),
  (1, 1, '2026-10-13', 4, 'DBMS Lecture', 'Present', NULL),
  (2, 1, '2026-10-13', 4, 'DBMS Lecture', 'Present', NULL),
  (3, 1, '2026-10-13', 4, 'DBMS Lecture', 'Present', NULL),
  (1, 1, '2026-10-14', 4, 'DBMS Lab',     'Present', NULL),
  (2, 1, '2026-10-14', 4, 'DBMS Lab',     'Absent',  NULL),
  (3, 1, '2026-10-14', 4, 'DBMS Lab',     'Absent',  NULL),
  (1, 3, '2026-10-15', 4, 'OS Lecture',   'Present', NULL),
  (2, 3, '2026-10-15', 4, 'OS Lecture',   'Present', NULL),
  (3, 3, '2026-10-15', 4, 'OS Lecture',   'Present', NULL),
  (1, 3, '2026-10-16', 4, 'CN Lecture',   'Absent',  'Symposium duty'),
  (2, 3, '2026-10-16', 4, 'CN Lecture',   'Present', NULL),
  (3, 3, '2026-10-16', 4, 'CN Lecture',   'Absent',  NULL),

  -- CSE Sem 6 (Students 4, 5)
  (4, 3, '2026-10-12', 6, 'SE Lecture',   'Present', NULL),
  (5, 3, '2026-10-12', 6, 'SE Lecture',   'Present', NULL),
  (4, 3, '2026-10-14', 6, 'SE Lecture',   'Present', NULL),
  (5, 3, '2026-10-14', 6, 'SE Lecture',   'Absent',  NULL),

  -- ECE Sem 4 (Students 6, 7)
  (6, 2, '2026-10-12', 4, 'DSP Lecture',  'Present', NULL),
  (7, 2, '2026-10-12', 4, 'DSP Lecture',  'Present', NULL),
  (6, 2, '2026-10-14', 4, 'DSP Lecture',  'Absent',  NULL),
  (7, 2, '2026-10-14', 4, 'DSP Lecture',  'Present', NULL),

  -- ME Sem 4 (Student 9)
  (9, 4, '2026-10-12', 4, 'Thermo Lecture', 'Present', NULL),
  (9, 4, '2026-10-14', 4, 'Thermo Lecture', 'Present', NULL);

-- 6. Examinations
INSERT INTO examinations (exam_id, exam_name, subject_code, subject_name, department_id, semester, exam_date, max_marks, passing_marks, created_by_faculty_id) VALUES
  (1, 'Mid-Semester Exam Fall 2026', 'CS401', 'Database Management Systems', 1, 4, '2026-10-20', 100.00, 40.00, 1),
  (2, 'Mid-Semester Exam Fall 2026', 'CS402', 'Operating Systems',           1, 4, '2026-10-22', 100.00, 40.00, 1),
  (3, 'Mid-Semester Exam Fall 2026', 'CS403', 'Computer Networks',           1, 4, '2026-10-24', 100.00, 40.00, 3),
  (4, 'Mid-Semester Exam Fall 2026', 'CS601', 'Software Engineering',        1, 6, '2026-10-21', 100.00, 40.00, 3),
  (5, 'Mid-Semester Exam Fall 2026', 'EC401', 'Digital Signal Processing',   2, 4, '2026-10-20', 100.00, 40.00, 2),
  (6, 'Mid-Semester Exam Fall 2026', 'ME401', 'Engineering Thermodynamics',  3, 4, '2026-10-21', 100.00, 40.00, 4);

-- 7. Results
INSERT INTO results (exam_id, student_id, marks_obtained, entered_by_faculty_id, remarks) VALUES
  -- CSE Sem 4 Results
  (1, 1, 88.00, 1, 'Strong SQL and normalization performance'),
  (2, 1, 79.00, 1, 'Good conceptual clarity'),
  (3, 1, 84.00, 3, 'Well structured answers'),

  (1, 2, 92.00, 1, 'Top scorer in DBMS'),
  (2, 2, 85.00, 1, 'Consistent performance'),
  (3, 2, 90.00, 3, 'Excellent'),

  (1, 3, 54.00, 1, 'Satisfactory'),
  (2, 3, 34.00, 1, 'Needs improvement in scheduling algorithms'),
  (3, 3, 61.00, 3, 'Passed'),

  -- CSE Sem 6 Results
  (4, 4, 81.00, 3, 'Good UML & testing diagrams'),
  (4, 5, 74.00, 3, 'Good'),

  -- ECE Sem 4 Results
  (5, 6, 86.00, 2, 'Strong Fourier analysis'),
  (5, 7, 37.00, 2, 'Below passing threshold'),

  -- ME Sem 4 Results
  (6, 9, 77.00, 4, 'Good');

