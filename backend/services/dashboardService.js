const { query } = require('../config/database');
const { AppError } = require('../middleware/errorMiddleware');

/**
 * Live MySQL statistics for the Admin dashboard.
 */
async function getAdminDashboard() {
  const [[studentStats]] = await Promise.all([
    query('SELECT COUNT(*) AS total_students FROM students')
  ]);
  const [facultyStats] = await query('SELECT COUNT(*) AS total_faculty FROM faculty');
  const [deptStats] = await query('SELECT COUNT(*) AS total_departments FROM departments');
  const [attendanceStats] = await query(
    `SELECT
       COUNT(*) AS total_records,
       COALESCE(SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END), 0) AS present_count,
       COALESCE(SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END), 0) AS absent_count,
       CASE
         WHEN COUNT(*) = 0 THEN 0.00
         ELSE ROUND((SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2)
       END AS attendance_percentage
     FROM attendance`
  );

  const recentRegistrations = await query(
    `SELECT
       s.student_id,
       s.registration_number,
       s.full_name,
       s.email,
       d.department_code,
       d.department_name,
       s.semester,
       s.admission_year,
       s.created_at
     FROM students s
     INNER JOIN departments d ON s.department_id = d.department_id
     ORDER BY s.created_at DESC, s.student_id DESC
     LIMIT 6`
  );

  const studentsByDepartment = await query(
    `SELECT
       d.department_id,
       d.department_code,
       d.department_name,
       COUNT(s.student_id) AS student_count
     FROM departments d
     LEFT JOIN students s ON d.department_id = s.department_id
     GROUP BY d.department_id, d.department_code, d.department_name
     ORDER BY student_count DESC, d.department_name ASC`
  );

  const attendanceByDepartment = await query(
    `SELECT
       d.department_code,
       d.department_name,
       COUNT(a.attendance_id) AS total_classes,
       COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0) AS present_classes,
       CASE
         WHEN COUNT(a.attendance_id) = 0 THEN 0.00
         ELSE ROUND((SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) / COUNT(a.attendance_id)) * 100, 2)
       END AS attendance_percentage
     FROM departments d
     LEFT JOIN students s ON d.department_id = s.department_id
     LEFT JOIN attendance a ON s.student_id = a.student_id
     GROUP BY d.department_id, d.department_code, d.department_name
     ORDER BY d.department_code ASC`
  );

  return {
    summary: {
      totalStudents: Number(studentStats.total_students),
      totalFaculty: Number(facultyStats.total_faculty),
      totalDepartments: Number(deptStats.total_departments),
      attendanceOverview: {
        totalRecords: Number(attendanceStats.total_records),
        presentCount: Number(attendanceStats.present_count),
        absentCount: Number(attendanceStats.absent_count),
        attendancePercentage: Number(attendanceStats.attendance_percentage)
      }
    },
    recentRegistrations,
    studentsByDepartment,
    attendanceByDepartment
  };
}

/**
 * Live MySQL statistics for the Faculty dashboard.
 */
async function getFacultyDashboard(sessionUser) {
  const facultyRows = await query(
    `SELECT
       f.faculty_id,
       f.full_name,
       f.email,
       f.phone,
       f.designation,
       d.department_id,
       d.department_name,
       d.department_code,
       d.head_of_department
     FROM faculty f
     INNER JOIN departments d ON f.department_id = d.department_id
     WHERE f.user_id = ?
     LIMIT 1`,
    [sessionUser.user_id]
  );

  if (facultyRows.length === 0) {
    throw new AppError('Faculty profile not found for this account.', 404);
  }

  const faculty = facultyRows[0];

  const [studentCountRow] = await query(
    'SELECT COUNT(*) AS total_students FROM students WHERE department_id = ?',
    [faculty.department_id]
  );

  const [examCountRow] = await query(
    'SELECT COUNT(*) AS total_exams FROM examinations WHERE department_id = ?',
    [faculty.department_id]
  );

  const [attendanceRow] = await query(
    `SELECT
       COUNT(a.attendance_id) AS total_records,
       COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0) AS present_count,
       CASE
         WHEN COUNT(a.attendance_id) = 0 THEN 0.00
         ELSE ROUND((SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) / COUNT(a.attendance_id)) * 100, 2)
       END AS attendance_percentage
     FROM attendance a
     INNER JOIN students s ON a.student_id = s.student_id
     WHERE s.department_id = ?`,
    [faculty.department_id]
  );

  const studentsBySemester = await query(
    `SELECT semester, COUNT(*) AS student_count
     FROM students
     WHERE department_id = ?
     GROUP BY semester
     ORDER BY semester ASC`,
    [faculty.department_id]
  );

  const recentExaminations = await query(
    `SELECT exam_id, exam_name, subject_code, subject_name, semester, exam_date, max_marks, passing_marks
     FROM examinations
     WHERE department_id = ?
     ORDER BY exam_date DESC, exam_id DESC
     LIMIT 5`,
    [faculty.department_id]
  );

  return {
    faculty,
    summary: {
      totalDepartmentStudents: Number(studentCountRow.total_students),
      totalDepartmentExams: Number(examCountRow.total_exams),
      departmentAttendance: {
        totalRecords: Number(attendanceRow.total_records),
        presentCount: Number(attendanceRow.present_count),
        attendancePercentage: Number(attendanceRow.attendance_percentage)
      }
    },
    studentsBySemester,
    recentExaminations
  };
}

/**
 * Live MySQL statistics for the Student dashboard.
 */
async function getStudentDashboard(sessionUser) {
  const studentRows = await query(
    `SELECT
       s.student_id,
       s.registration_number,
       s.full_name,
       s.email,
       s.phone,
       s.semester,
       s.admission_year,
       d.department_id,
       d.department_name,
       d.department_code,
       d.head_of_department
     FROM students s
     INNER JOIN departments d ON s.department_id = d.department_id
     WHERE s.user_id = ?
     LIMIT 1`,
    [sessionUser.user_id]
  );

  if (studentRows.length === 0) {
    throw new AppError('Student profile not found for this account.', 404);
  }

  const student = studentRows[0];

  const [attendanceSummary] = await query(
    `SELECT total_classes, present_classes, absent_classes, attendance_percentage
     FROM vw_student_attendance_summary
     WHERE student_id = ?`,
    [student.student_id]
  );

  const recentResults = await query(
    `SELECT
       result_id,
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
       result_status
     FROM vw_student_results_detail
     WHERE student_id = ?
     ORDER BY exam_date DESC, subject_code ASC`,
    [student.student_id]
  );

  let totalObtained = 0;
  let totalMax = 0;
  let hasFailedSubject = false;

  for (const row of recentResults) {
    totalObtained += Number(row.marks_obtained);
    totalMax += Number(row.max_marks);
    if (row.result_status === 'FAIL') {
      hasFailedSubject = true;
    }
  }

  const overallPercentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
  const overallStatus =
    recentResults.length === 0
      ? 'PENDING'
      : !hasFailedSubject && overallPercentage >= 40
        ? 'PASS'
        : 'FAIL';

  return {
    student,
    attendanceSummary: attendanceSummary || {
      total_classes: 0,
      present_classes: 0,
      absent_classes: 0,
      attendance_percentage: 0
    },
    recentResults,
    academicSummary: {
      subjectsEvaluated: recentResults.length,
      totalObtained: Number(totalObtained.toFixed(2)),
      totalMax: Number(totalMax.toFixed(2)),
      overallPercentage,
      overallStatus
    }
  };
}

module.exports = {
  getAdminDashboard,
  getFacultyDashboard,
  getStudentDashboard
};

