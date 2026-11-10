const { pool, query } = require('../config/database');
const { AppError } = require('../middleware/errorMiddleware');

async function getAllDepartments() {
  return query(
    `SELECT
       department_id,
       department_name,
       department_code,
       head_of_department,
       total_faculty,
       total_students,
       total_examinations
     FROM vw_department_summary
     ORDER BY department_name ASC`
  );
}

async function getDepartmentById(departmentId) {
  const rows = await query(
    `SELECT
       department_id,
       department_name,
       department_code,
       head_of_department,
       total_faculty,
       total_students,
       total_examinations
     FROM vw_department_summary
     WHERE department_id = ?`,
    [departmentId]
  );
  if (rows.length === 0) {
    throw new AppError('Department not found.', 404);
  }
  return rows[0];
}

async function createDepartment({ department_name, department_code, head_of_department }) {
  const code = department_code.toUpperCase();
  const [result] = await pool.execute(
    `INSERT INTO departments (department_name, department_code, head_of_department)
     VALUES (?, ?, ?)`,
    [department_name, code, head_of_department || 'TBD']
  );
  return getDepartmentById(result.insertId);
}

async function updateDepartment(departmentId, { department_name, department_code, head_of_department }) {
  await getDepartmentById(departmentId);
  const code = department_code.toUpperCase();
  await query(
    `UPDATE departments
     SET department_name = ?, department_code = ?, head_of_department = ?
     WHERE department_id = ?`,
    [department_name, code, head_of_department || 'TBD', departmentId]
  );
  return getDepartmentById(departmentId);
}

async function deleteDepartment(departmentId) {
  const dept = await getDepartmentById(departmentId);
  if (Number(dept.total_students) > 0 || Number(dept.total_faculty) > 0 || Number(dept.total_examinations) > 0) {
    throw new AppError(
      'Cannot delete a department that still has assigned faculty, enrolled students, or examinations.',
      409
    );
  }
  await query('DELETE FROM departments WHERE department_id = ?', [departmentId]);
}

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
