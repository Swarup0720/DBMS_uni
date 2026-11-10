const { pool, query, withTransaction } = require('../config/database');
const { AppError } = require('../middleware/errorMiddleware');

async function getAllExaminations({ departmentId = null, semester = null, search = '' } = {}) {
  let sql = `
    SELECT
      e.exam_id,
      e.exam_name,
      e.subject_code,
      e.subject_name,
      e.department_id,
      d.department_name,
      d.department_code,
      e.semester,
      e.exam_date,
      e.max_marks,
      e.passing_marks,
      e.created_by_faculty_id,
      f.full_name AS created_by_name,
      COUNT(r.result_id) AS graded_count
    FROM examinations e
    INNER JOIN departments d ON e.department_id = d.department_id
    LEFT JOIN faculty f ON e.created_by_faculty_id = f.faculty_id
    LEFT JOIN results r ON e.exam_id = r.exam_id
    WHERE 1=1
  `;
  const params = [];

  if (departmentId) {
    sql += ' AND e.department_id = ?';
    params.push(Number(departmentId));
  }
  if (semester) {
    sql += ' AND e.semester = ?';
    params.push(Number(semester));
  }
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    sql += ' AND (e.exam_name LIKE ? OR e.subject_code LIKE ? OR e.subject_name LIKE ?)';
    params.push(term, term, term);
  }

  sql += `
    GROUP BY
      e.exam_id, e.exam_name, e.subject_code, e.subject_name, e.department_id,
      d.department_name, d.department_code, e.semester, e.exam_date,
      e.max_marks, e.passing_marks, e.created_by_faculty_id, f.full_name
    ORDER BY e.exam_date DESC, e.exam_id DESC
  `;
  return query(sql, params);
}

async function getExaminationById(examId) {
  const rows = await query(
    `SELECT
       e.exam_id, e.exam_name, e.subject_code, e.subject_name,
       e.department_id, d.department_name, d.department_code,
       e.semester, e.exam_date, e.max_marks, e.passing_marks, e.created_by_faculty_id
     FROM examinations e
     INNER JOIN departments d ON e.department_id = d.department_id
     WHERE e.exam_id = ?`,
    [examId]
  );
  if (rows.length === 0) {
    throw new AppError('Examination not found.', 404);
  }
  return rows[0];
}

async function createExamination({
  exam_name,
  subject_code,
  subject_name,
  department_id,
  semester,
  exam_date,
  max_marks,
  passing_marks,
  created_by_faculty_id = null
}) {
  if (Number(passing_marks) > Number(max_marks)) {
    throw new AppError('Passing marks cannot exceed maximum marks.', 400);
  }
  const deptCheck = await query('SELECT department_id FROM departments WHERE department_id = ?', [department_id]);
  if (deptCheck.length === 0) {
    throw new AppError('Selected department does not exist.', 400);
  }

  const [res] = await pool.execute(
    `INSERT INTO examinations (
       exam_name, subject_code, subject_name, department_id, semester,
       exam_date, max_marks, passing_marks, created_by_faculty_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exam_name,
      subject_code.toUpperCase(),
      subject_name,
      department_id,
      semester,
      exam_date,
      max_marks,
      passing_marks,
      created_by_faculty_id
    ]
  );

  return getExaminationById(res.insertId);
}

async function updateExamination(
  examId,
  { exam_name, subject_code, subject_name, department_id, semester, exam_date, max_marks, passing_marks },
  scopedDepartmentId = null
) {
  const existing = await getExaminationById(examId);
  if (scopedDepartmentId && Number(existing.department_id) !== Number(scopedDepartmentId)) {
    throw new AppError('Access denied: examination belongs to another department.', 403);
  }
  if (Number(passing_marks) > Number(max_marks)) {
    throw new AppError('Passing marks cannot exceed maximum marks.', 400);
  }

  await query(
    `UPDATE examinations
     SET exam_name = ?, subject_code = ?, subject_name = ?, department_id = ?,
         semester = ?, exam_date = ?, max_marks = ?, passing_marks = ?
     WHERE exam_id = ?`,
    [
      exam_name,
      subject_code.toUpperCase(),
      subject_name,
      department_id,
      semester,
      exam_date,
      max_marks,
      passing_marks,
      examId
    ]
  );
  return getExaminationById(examId);
}

async function deleteExamination(examId, scopedDepartmentId = null) {
  const existing = await getExaminationById(examId);
  if (scopedDepartmentId && Number(existing.department_id) !== Number(scopedDepartmentId)) {
    throw new AppError('Access denied: examination belongs to another department.', 403);
  }
  await query('DELETE FROM examinations WHERE exam_id = ?', [examId]);
}

async function getExamMarksSheet(examId, scopedDepartmentId = null) {
  const exam = await getExaminationById(examId);
  if (scopedDepartmentId && Number(exam.department_id) !== Number(scopedDepartmentId)) {
    throw new AppError('Access denied: cannot view marks for another department.', 403);
  }

  const students = await query(
    `SELECT
       s.student_id,
       s.registration_number,
       s.full_name,
       s.semester,
       r.result_id,
       r.marks_obtained,
       r.remarks,
       CASE
         WHEN r.result_id IS NULL THEN NULL
         ELSE ROUND((r.marks_obtained / ?) * 100, 2)
       END AS percentage,
       CASE
         WHEN r.result_id IS NULL THEN 'UNGRADED'
         WHEN r.marks_obtained >= ? THEN 'PASS'
         ELSE 'FAIL'
       END AS result_status
     FROM students s
     LEFT JOIN results r ON s.student_id = r.student_id AND r.exam_id = ?
     WHERE s.department_id = ?
       AND s.semester = ?
     ORDER BY s.registration_number ASC`,
    [Number(exam.max_marks), Number(exam.passing_marks), examId, exam.department_id, exam.semester]
  );

  return { exam, students };
}

async function saveExamMarks(examId, marksList, actorFacultyId = null, scopedDepartmentId = null) {
  const exam = await getExaminationById(examId);
  if (scopedDepartmentId && Number(exam.department_id) !== Number(scopedDepartmentId)) {
    throw new AppError('Access denied: cannot enter marks for another department.', 403);
  }
  if (!Array.isArray(marksList) || marksList.length === 0) {
    throw new AppError('At least one student mark entry is required.', 400);
  }

  const maxMarks = Number(exam.max_marks);

  return withTransaction(async (connection) => {
    let savedCount = 0;
    for (const entry of marksList) {
      const studentId = Number(entry.student_id);
      const marks = Number(entry.marks_obtained);

      if (!Number.isInteger(studentId) || studentId <= 0) {
        throw new AppError('Invalid student ID in marks payload.', 400);
      }
      if (Number.isNaN(marks) || marks < 0 || marks > maxMarks) {
        throw new AppError(
          `Marks for student ID ${studentId} must be between 0 and ${maxMarks}.`,
          400
        );
      }

      const [studentCheck] = await connection.execute(
        'SELECT student_id, department_id FROM students WHERE student_id = ?',
        [studentId]
      );
      if (studentCheck.length === 0) {
        throw new AppError(`Student ID ${studentId} does not exist.`, 400);
      }
      if (Number(studentCheck[0].department_id) !== Number(exam.department_id)) {
        throw new AppError('Student does not belong to the examination department.', 400);
      }

      await connection.execute(
        `INSERT INTO results (exam_id, student_id, marks_obtained, entered_by_faculty_id, remarks)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           marks_obtained = VALUES(marks_obtained),
           entered_by_faculty_id = VALUES(entered_by_faculty_id),
           remarks = VALUES(remarks),
           updated_at = CURRENT_TIMESTAMP`,
        [
          examId,
          studentId,
          Number(marks.toFixed(2)),
          actorFacultyId,
          entry.remarks ? String(entry.remarks).trim().slice(0, 200) : null
        ]
      );
      savedCount += 1;
    }

    return { savedCount };
  });
}

async function updateSingleResult(resultId, { marks_obtained, remarks }, actorFacultyId = null, scopedDepartmentId = null) {
  const rows = await query(
    `SELECT r.result_id, e.department_id, e.max_marks
     FROM results r
     INNER JOIN examinations e ON r.exam_id = e.exam_id
     WHERE r.result_id = ?`,
    [resultId]
  );
  if (rows.length === 0) {
    throw new AppError('Result record not found.', 404);
  }
  if (scopedDepartmentId && Number(rows[0].department_id) !== Number(scopedDepartmentId)) {
    throw new AppError('Access denied: cannot modify results of another department.', 403);
  }
  const maxMarks = Number(rows[0].max_marks);
  const marks = Number(marks_obtained);
  if (Number.isNaN(marks) || marks < 0 || marks > maxMarks) {
    throw new AppError(`Marks must be between 0 and ${maxMarks}.`, 400);
  }

  await query(
    `UPDATE results
     SET marks_obtained = ?, remarks = ?, entered_by_faculty_id = COALESCE(?, entered_by_faculty_id)
     WHERE result_id = ?`,
    [Number(marks.toFixed(2)), remarks ? String(remarks).trim().slice(0, 200) : null, actorFacultyId, resultId]
  );

  const [updated] = await query('SELECT * FROM vw_student_results_detail WHERE result_id = ?', [resultId]);
  return updated;
}

async function getResultsReport({
  examId = null,
  departmentId = null,
  semester = null,
  status = null,
  search = ''
} = {}) {
  let sql = 'SELECT * FROM vw_student_results_detail WHERE 1=1';
  const params = [];

  if (examId) {
    sql += ' AND exam_id = ?';
    params.push(Number(examId));
  }
  if (departmentId) {
    sql += ' AND department_id = ?';
    params.push(Number(departmentId));
  }
  if (semester) {
    sql += ' AND exam_semester = ?';
    params.push(Number(semester));
  }
  if (status && ['PASS', 'FAIL'].includes(status.toUpperCase())) {
    sql += ' AND result_status = ?';
    params.push(status.toUpperCase());
  }
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    sql += ' AND (student_name LIKE ? OR registration_number LIKE ? OR subject_name LIKE ? OR subject_code LIKE ?)';
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY exam_date DESC, subject_code ASC, registration_number ASC';
  const records = await query(sql, params);

  const passCount = records.filter((r) => r.result_status === 'PASS').length;
  const failCount = records.length - passCount;
  const avgPct =
    records.length > 0
      ? Number((records.reduce((s, r) => s + Number(r.percentage), 0) / records.length).toFixed(2))
      : 0;
  const highestPct =
    records.length > 0 ? Math.max(...records.map((r) => Number(r.percentage))) : 0;
  const lowestPct =
    records.length > 0 ? Math.min(...records.map((r) => Number(r.percentage))) : 0;

  // Consolidated per-student totals across filtered records
  const studentMap = new Map();
  for (const row of records) {
    if (!studentMap.has(row.student_id)) {
      studentMap.set(row.student_id, {
        student_id: row.student_id,
        registration_number: row.registration_number,
        student_name: row.student_name,
        department_code: row.department_code,
        subjects_count: 0,
        total_obtained: 0,
        total_max: 0,
        has_fail: false
      });
    }
    const agg = studentMap.get(row.student_id);
    agg.subjects_count += 1;
    agg.total_obtained += Number(row.marks_obtained);
    agg.total_max += Number(row.max_marks);
    if (row.result_status === 'FAIL') {
      agg.has_fail = true;
    }
  }

  const consolidatedStudents = Array.from(studentMap.values()).map((st) => {
    const overall_percentage =
      st.total_max > 0 ? Number(((st.total_obtained / st.total_max) * 100).toFixed(2)) : 0;
    const overall_status = !st.has_fail && overall_percentage >= 40 ? 'PASS' : 'FAIL';
    return {
      ...st,
      total_obtained: Number(st.total_obtained.toFixed(2)),
      total_max: Number(st.total_max.toFixed(2)),
      overall_percentage,
      overall_status
    };
  });

  return {
    records,
    consolidatedStudents,
    summary: {
      totalRecords: records.length,
      passCount,
      failCount,
      passRate: records.length > 0 ? Number(((passCount / records.length) * 100).toFixed(2)) : 0,
      averagePercentage: avgPct,
      highestPercentage: highestPct,
      lowestPercentage: lowestPct
    }
  };
}

async function getStudentOwnResults(studentId) {
  const [student] = await query(
    `SELECT
       s.student_id, s.registration_number, s.full_name, s.email,
       s.semester, s.admission_year, d.department_name, d.department_code
     FROM students s
     INNER JOIN departments d ON s.department_id = d.department_id
     WHERE s.student_id = ?`,
    [studentId]
  );

  if (!student) {
    throw new AppError('Student profile not found.', 404);
  }

  const subjects = await query(
    `SELECT
       result_id, exam_id, exam_name, subject_code, subject_name,
       exam_date, exam_semester, marks_obtained, max_marks,
       passing_marks, percentage, result_status, remarks
     FROM vw_student_results_detail
     WHERE student_id = ?
     ORDER BY exam_semester ASC, exam_date DESC, subject_code ASC`,
    [studentId]
  );

  let totalObtained = 0;
  let totalMax = 0;
  let hasFailedSubject = false;

  for (const sub of subjects) {
    totalObtained += Number(sub.marks_obtained);
    totalMax += Number(sub.max_marks);
    if (sub.result_status === 'FAIL') {
      hasFailedSubject = true;
    }
  }

  const overallPercentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
  const overallStatus =
    subjects.length === 0
      ? 'PENDING'
      : !hasFailedSubject && overallPercentage >= 40
        ? 'PASS'
        : 'FAIL';

  return {
    student,
    subjects,
    summary: {
      subjectsEvaluated: subjects.length,
      totalObtained: Number(totalObtained.toFixed(2)),
      totalMax: Number(totalMax.toFixed(2)),
      overallPercentage,
      overallStatus,
      passingThresholdNote: 'Minimum 40% aggregate and passing marks in every individual subject.'
    }
  };
}

module.exports = {
  getAllExaminations,
  getExaminationById,
  createExamination,
  updateExamination,
  deleteExamination,
  getExamMarksSheet,
  saveExamMarks,
  updateSingleResult,
  getResultsReport,
  getStudentOwnResults
};
