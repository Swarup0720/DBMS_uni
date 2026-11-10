const { query, withTransaction } = require('../config/database');
const { AppError } = require('../middleware/errorMiddleware');
const { createLinkedUser, updateLinkedUser, deleteLinkedUser } = require('./authService');

async function getAllStudents({ search = '', departmentId = null, semester = null } = {}) {
  let sql = `
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
    INNER JOIN departments d ON s.department_id = d.department_id
    WHERE 1=1
  `;
  const params = [];

  if (departmentId) {
    sql += ' AND s.department_id = ?';
    params.push(Number(departmentId));
  }

  if (semester) {
    sql += ' AND s.semester = ?';
    params.push(Number(semester));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    sql += ' AND (s.full_name LIKE ? OR s.registration_number LIKE ? OR s.email LIKE ?)';
    params.push(term, term, term);
  }

  sql += ' ORDER BY s.registration_number ASC';
  return query(sql, params);
}

async function getStudentById(studentId, scopedDepartmentId = null) {
  const rows = await query(
    `SELECT
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
     INNER JOIN departments d ON s.department_id = d.department_id
     WHERE s.student_id = ?`,
    [studentId]
  );

  if (rows.length === 0) {
    throw new AppError('Student not found.', 404);
  }

  const student = rows[0];
  if (scopedDepartmentId && Number(student.department_id) !== Number(scopedDepartmentId)) {
    throw new AppError('Access denied: student belongs to another department.', 403);
  }

  const [attendanceSummary] = await query(
    `SELECT total_classes, present_classes, absent_classes, attendance_percentage
     FROM vw_student_attendance_summary
     WHERE student_id = ?`,
    [studentId]
  );

  const results = await query(
    `SELECT exam_name, subject_code, subject_name, marks_obtained, max_marks, percentage, result_status
     FROM vw_student_results_detail
     WHERE student_id = ?
     ORDER BY exam_date DESC`,
    [studentId]
  );

  return {
    ...student,
    attendanceSummary: attendanceSummary || {
      total_classes: 0,
      present_classes: 0,
      absent_classes: 0,
      attendance_percentage: 0
    },
    results
  };
}

async function createStudent({
  registration_number,
  full_name,
  email,
  phone,
  department_id,
  semester,
  admission_year,
  password
}) {
  const regNo = registration_number.trim().toUpperCase();
  const deptCheck = await query('SELECT department_id FROM departments WHERE department_id = ?', [department_id]);
  if (deptCheck.length === 0) {
    throw new AppError('Selected department does not exist.', 400);
  }

  const studentId = await withTransaction(async (connection) => {
    const [dupReg] = await connection.execute(
      'SELECT student_id FROM students WHERE registration_number = ? LIMIT 1',
      [regNo]
    );
    if (dupReg.length > 0) {
      throw new AppError('A student with this registration number already exists.', 409);
    }

    const [dupEmail] = await connection.execute(
      'SELECT student_id FROM students WHERE LOWER(email) = ? LIMIT 1',
      [email.toLowerCase()]
    );
    if (dupEmail.length > 0) {
      throw new AppError('A student with this email address already exists.', 409);
    }

    const userId = await createLinkedUser(connection, {
      usernameBase: regNo.toLowerCase(),
      email,
      password: password || 'Student@123',
      role: 'student',
      full_name
    });

    const [insertRes] = await connection.execute(
      `INSERT INTO students (
         user_id, registration_number, full_name, email, phone, department_id, semester, admission_year
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, regNo, full_name, email.toLowerCase(), phone, department_id, semester, admission_year]
    );

    return insertRes.insertId;
  });

  return getStudentById(studentId);
}

async function updateStudent(
  studentId,
  { registration_number, full_name, email, phone, department_id, semester, admission_year }
) {
  const existing = await getStudentById(studentId);
  const regNo = registration_number.trim().toUpperCase();

  const deptCheck = await query('SELECT department_id FROM departments WHERE department_id = ?', [department_id]);
  if (deptCheck.length === 0) {
    throw new AppError('Selected department does not exist.', 400);
  }

  await withTransaction(async (connection) => {
    const [dupReg] = await connection.execute(
      'SELECT student_id FROM students WHERE registration_number = ? AND student_id <> ? LIMIT 1',
      [regNo, studentId]
    );
    if (dupReg.length > 0) {
      throw new AppError('Another student already has this registration number.', 409);
    }

    const [dupEmail] = await connection.execute(
      'SELECT student_id FROM students WHERE LOWER(email) = ? AND student_id <> ? LIMIT 1',
      [email.toLowerCase(), studentId]
    );
    if (dupEmail.length > 0) {
      throw new AppError('Another student already uses this email address.', 409);
    }

    await updateLinkedUser(connection, existing.user_id, { email, full_name });

    await connection.execute(
      `UPDATE students
       SET registration_number = ?, full_name = ?, email = ?, phone = ?,
           department_id = ?, semester = ?, admission_year = ?
       WHERE student_id = ?`,
      [regNo, full_name, email.toLowerCase(), phone, department_id, semester, admission_year, studentId]
    );
  });

  return getStudentById(studentId);
}

async function deleteStudent(studentId) {
  const existing = await getStudentById(studentId);
  await withTransaction(async (connection) => {
    await connection.execute('DELETE FROM students WHERE student_id = ?', [studentId]);
    await deleteLinkedUser(connection, existing.user_id);
  });
}

module.exports = {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent
};

