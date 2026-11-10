const { query, withTransaction } = require('../config/database');
const { AppError } = require('../middleware/errorMiddleware');
const { createLinkedUser, updateLinkedUser, deleteLinkedUser } = require('./authService');

async function getAllFaculty({ search = '', departmentId = null } = {}) {
  let sql = `
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
    INNER JOIN departments d ON f.department_id = d.department_id
    WHERE 1=1
  `;
  const params = [];

  if (departmentId) {
    sql += ' AND f.department_id = ?';
    params.push(Number(departmentId));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    sql += ' AND (f.full_name LIKE ? OR f.email LIKE ? OR f.designation LIKE ?)';
    params.push(term, term, term);
  }

  sql += ' ORDER BY d.department_code ASC, f.full_name ASC';
  return query(sql, params);
}

async function getFacultyById(facultyId) {
  const rows = await query(
    `SELECT
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
     INNER JOIN departments d ON f.department_id = d.department_id
     WHERE f.faculty_id = ?`,
    [facultyId]
  );
  if (rows.length === 0) {
    throw new AppError('Faculty member not found.', 404);
  }
  return rows[0];
}

async function createFaculty({ full_name, email, phone, department_id, designation, password }) {
  const deptCheck = await query('SELECT department_id FROM departments WHERE department_id = ?', [department_id]);
  if (deptCheck.length === 0) {
    throw new AppError('Selected department does not exist.', 400);
  }

  const facultyId = await withTransaction(async (connection) => {
    const [dupEmail] = await connection.execute(
      'SELECT faculty_id FROM faculty WHERE LOWER(email) = ? LIMIT 1',
      [email.toLowerCase()]
    );
    if (dupEmail.length > 0) {
      throw new AppError('A faculty member with this email already exists.', 409);
    }

    const userId = await createLinkedUser(connection, {
      usernameBase: email.split('@')[0],
      email,
      password: password || 'Faculty@123',
      role: 'faculty',
      full_name
    });

    const [insertRes] = await connection.execute(
      `INSERT INTO faculty (user_id, full_name, email, phone, department_id, designation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, full_name, email.toLowerCase(), phone, department_id, designation]
    );

    return insertRes.insertId;
  });

  return getFacultyById(facultyId);
}

async function updateFaculty(facultyId, { full_name, email, phone, department_id, designation }) {
  const existing = await getFacultyById(facultyId);
  const deptCheck = await query('SELECT department_id FROM departments WHERE department_id = ?', [department_id]);
  if (deptCheck.length === 0) {
    throw new AppError('Selected department does not exist.', 400);
  }

  await withTransaction(async (connection) => {
    const [dupEmail] = await connection.execute(
      'SELECT faculty_id FROM faculty WHERE LOWER(email) = ? AND faculty_id <> ? LIMIT 1',
      [email.toLowerCase(), facultyId]
    );
    if (dupEmail.length > 0) {
      throw new AppError('Another faculty member already uses this email address.', 409);
    }

    await updateLinkedUser(connection, existing.user_id, { email, full_name });

    await connection.execute(
      `UPDATE faculty
       SET full_name = ?, email = ?, phone = ?, department_id = ?, designation = ?
       WHERE faculty_id = ?`,
      [full_name, email.toLowerCase(), phone, department_id, designation, facultyId]
    );
  });

  return getFacultyById(facultyId);
}

async function assignDepartment(facultyId, department_id) {
  await getFacultyById(facultyId);
  const deptCheck = await query('SELECT department_id FROM departments WHERE department_id = ?', [department_id]);
  if (deptCheck.length === 0) {
    throw new AppError('Target department does not exist.', 400);
  }
  await query('UPDATE faculty SET department_id = ? WHERE faculty_id = ?', [department_id, facultyId]);
  return getFacultyById(facultyId);
}

async function deleteFaculty(facultyId) {
  const existing = await getFacultyById(facultyId);
  await withTransaction(async (connection) => {
    await connection.execute('DELETE FROM faculty WHERE faculty_id = ?', [facultyId]);
    await deleteLinkedUser(connection, existing.user_id);
  });
}

module.exports = {
  getAllFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  assignDepartment,
  deleteFaculty
};

