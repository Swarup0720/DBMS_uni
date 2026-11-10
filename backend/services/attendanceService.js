const { query, withTransaction } = require('../config/database');
const { AppError } = require('../middleware/errorMiddleware');
const { todayIsoDate } = require('../middleware/validateMiddleware');

async function getSessionRoster({ departmentId, semester, attendanceDate, sessionName }) {
  const rows = await query(
    `SELECT
       s.student_id,
       s.registration_number,
       s.full_name,
       s.semester,
       d.department_id,
       d.department_code,
       d.department_name,
       a.attendance_id,
       a.status,
       a.remarks,
       CASE WHEN a.attendance_id IS NOT NULL THEN 1 ELSE 0 END AS already_marked
     FROM students s
     INNER JOIN departments d ON s.department_id = d.department_id
     LEFT JOIN attendance a
       ON s.student_id = a.student_id
       AND a.attendance_date = ?
       AND a.session_name = ?
     WHERE s.department_id = ?
       AND s.semester = ?
     ORDER BY s.registration_number ASC`,
    [attendanceDate, sessionName, Number(departmentId), Number(semester)]
  );
  return rows;
}

async function markBulkAttendance({
  attendanceDate,
  semester,
  sessionName,
  records,
  overwriteExisting = false,
  actorFacultyId = null,
  scopedDepartmentId = null
}) {
  if (attendanceDate > todayIsoDate()) {
    throw new AppError('Attendance date cannot be in the future.', 400);
  }
  if (!Array.isArray(records) || records.length === 0) {
    throw new AppError('At least one student attendance entry is required.', 400);
  }

  return withTransaction(async (connection) => {
    const studentIds = records.map((r) => Number(r.student_id));
    const placeholders = studentIds.map(() => '?').join(', ');

    const [studentsFound] = await connection.execute(
      `SELECT student_id, department_id FROM students WHERE student_id IN (${placeholders})`,
      studentIds
    );

    if (studentsFound.length !== new Set(studentIds).size) {
      throw new AppError('One or more selected students do not exist.', 400);
    }

    if (scopedDepartmentId) {
      const foreignStudent = studentsFound.find(
        (st) => Number(st.department_id) !== Number(scopedDepartmentId)
      );
      if (foreignStudent) {
        throw new AppError('Faculty can only mark attendance for students in their assigned department.', 403);
      }
    }

    if (!overwriteExisting) {
      const [existing] = await connection.execute(
        `SELECT a.student_id, s.registration_number
         FROM attendance a
         INNER JOIN students s ON a.student_id = s.student_id
         WHERE a.attendance_date = ?
           AND a.session_name = ?
           AND a.student_id IN (${placeholders})`,
        [attendanceDate, sessionName, ...studentIds]
      );
      if (existing.length > 0) {
        const regList = existing.map((e) => e.registration_number).slice(0, 5).join(', ');
        throw new AppError(
          `Duplicate attendance detected for date ${attendanceDate} and session "${sessionName}" (${regList}). Use "Update Existing" mode to modify existing entries.`,
          409
        );
      }
    }

    let savedCount = 0;
    for (const rec of records) {
      await connection.execute(
        `INSERT INTO attendance (
           student_id, marked_by_faculty_id, attendance_date, semester, session_name, status, remarks
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           marked_by_faculty_id = VALUES(marked_by_faculty_id),
           semester = VALUES(semester),
           status = VALUES(status),
           remarks = VALUES(remarks),
           updated_at = CURRENT_TIMESTAMP`,
        [
          Number(rec.student_id),
          actorFacultyId,
          attendanceDate,
          Number(semester),
          sessionName,
          rec.status,
          rec.remarks ? String(rec.remarks).trim().slice(0, 200) : null
        ]
      );
      savedCount += 1;
    }

    return { savedCount };
  });
}

async function getAttendanceRecords({
  departmentId = null,
  semester = null,
  attendanceDate = null,
  sessionName = null,
  search = ''
} = {}) {
  let sql = `
    SELECT
      a.attendance_id,
      a.student_id,
      s.registration_number,
      s.full_name AS student_name,
      s.department_id,
      d.department_code,
      d.department_name,
      a.semester,
      a.attendance_date,
      a.session_name,
      a.status,
      a.remarks,
      f.full_name AS marked_by_name,
      a.updated_at
    FROM attendance a
    INNER JOIN students s ON a.student_id = s.student_id
    INNER JOIN departments d ON s.department_id = d.department_id
    LEFT JOIN faculty f ON a.marked_by_faculty_id = f.faculty_id
    WHERE 1=1
  `;
  const params = [];

  if (departmentId) {
    sql += ' AND s.department_id = ?';
    params.push(Number(departmentId));
  }
  if (semester) {
    sql += ' AND a.semester = ?';
    params.push(Number(semester));
  }
  if (attendanceDate) {
    sql += ' AND a.attendance_date = ?';
    params.push(attendanceDate);
  }
  if (sessionName && sessionName.trim()) {
    sql += ' AND a.session_name LIKE ?';
    params.push(`%${sessionName.trim()}%`);
  }
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    sql += ' AND (s.full_name LIKE ? OR s.registration_number LIKE ?)';
    params.push(term, term);
  }

  sql += ' ORDER BY a.attendance_date DESC, a.session_name ASC, s.registration_number ASC LIMIT 300';
  return query(sql, params);
}

async function updateAttendanceRecord(attendanceId, { status, remarks, actorFacultyId = null, scopedDepartmentId = null }) {
  const rows = await query(
    `SELECT a.attendance_id, s.department_id
     FROM attendance a
     INNER JOIN students s ON a.student_id = s.student_id
     WHERE a.attendance_id = ?`,
    [attendanceId]
  );

  if (rows.length === 0) {
    throw new AppError('Attendance record not found.', 404);
  }
  if (scopedDepartmentId && Number(rows[0].department_id) !== Number(scopedDepartmentId)) {
    throw new AppError('Access denied: cannot modify attendance for another department.', 403);
  }

  await query(
    `UPDATE attendance
     SET status = ?, remarks = ?, marked_by_faculty_id = COALESCE(?, marked_by_faculty_id)
     WHERE attendance_id = ?`,
    [status, remarks ? String(remarks).trim().slice(0, 200) : null, actorFacultyId, attendanceId]
  );

  const [updated] = await query(
    `SELECT
       a.attendance_id, a.student_id, s.registration_number, s.full_name AS student_name,
       d.department_code, a.semester, a.attendance_date, a.session_name, a.status, a.remarks
     FROM attendance a
     INNER JOIN students s ON a.student_id = s.student_id
     INNER JOIN departments d ON s.department_id = d.department_id
     WHERE a.attendance_id = ?`,
    [attendanceId]
  );
  return updated;
}

async function getAttendanceReport({ departmentId = null, semester = null, search = '' } = {}) {
  let sql = `
    SELECT
      student_id,
      registration_number,
      full_name,
      department_id,
      department_name,
      department_code,
      semester,
      total_classes,
      present_classes,
      absent_classes,
      attendance_percentage
    FROM vw_student_attendance_summary
    WHERE 1=1
  `;
  const params = [];

  if (departmentId) {
    sql += ' AND department_id = ?';
    params.push(Number(departmentId));
  }
  if (semester) {
    sql += ' AND semester = ?';
    params.push(Number(semester));
  }
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    sql += ' AND (full_name LIKE ? OR registration_number LIKE ?)';
    params.push(term, term);
  }

  sql += ' ORDER BY department_code ASC, semester ASC, registration_number ASC';
  const records = await query(sql, params);

  const withClasses = records.filter((r) => Number(r.total_classes) > 0);
  const avgPct =
    withClasses.length > 0
      ? Number(
          (
            withClasses.reduce((sum, r) => sum + Number(r.attendance_percentage), 0) / withClasses.length
          ).toFixed(2)
        )
      : 0;
  const below75Count = withClasses.filter((r) => Number(r.attendance_percentage) < 75).length;

  return {
    records,
    summary: {
      totalStudents: records.length,
      studentsWithAttendance: withClasses.length,
      averageAttendancePercentage: avgPct,
      below75Count
    }
  };
}

module.exports = {
  getSessionRoster,
  markBulkAttendance,
  getAttendanceRecords,
  updateAttendanceRecord,
  getAttendanceReport
};

