const attendanceService = require('../services/attendanceService');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
const {
  assertNonEmptyString,
  assertPositiveInt,
  assertIntInRange,
  assertValidDate
} = require('../middleware/validateMiddleware');

function resolveScopedDepartment(user, requestedDeptId) {
  if (user.role === 'faculty') {
    return user.department_id;
  }
  return requestedDeptId ? assertPositiveInt(requestedDeptId, 'Department ID') : null;
}

const getSessionRoster = asyncHandler(async (req, res) => {
  const departmentId = resolveScopedDepartment(req.session.user, req.query.department_id);
  if (!departmentId) {
    throw new AppError('Department ID is required.', 400);
  }
  const semester = assertIntInRange(req.query.semester, 'Semester', 1, 8);
  const attendanceDate = assertValidDate(req.query.attendance_date, 'Attendance date');
  const sessionName = req.query.session_name
    ? assertNonEmptyString(req.query.session_name, 'Session name', 80)
    : 'Regular Class';

  const roster = await attendanceService.getSessionRoster({
    departmentId,
    semester,
    attendanceDate,
    sessionName
  });

  res.json({ success: true, data: roster });
});

const markAttendance = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const attendanceDate = assertValidDate(req.body.attendance_date, 'Attendance date');
  const semester = assertIntInRange(req.body.semester, 'Semester', 1, 8);
  const sessionName = req.body.session_name
    ? assertNonEmptyString(req.body.session_name, 'Session name', 80)
    : 'Regular Class';
  const overwriteExisting = Boolean(req.body.overwriteExisting);

  if (!Array.isArray(req.body.records) || req.body.records.length === 0) {
    throw new AppError('Attendance records array is required.', 400);
  }

  const sanitizedRecords = req.body.records.map((r) => {
    const student_id = assertPositiveInt(r.student_id, 'Student ID');
    const status = r.status === 'Present' || r.status === 'Absent' ? r.status : null;
    if (!status) {
      throw new AppError('Attendance status must be either "Present" or "Absent".', 400);
    }
    return {
      student_id,
      status,
      remarks: r.remarks ? String(r.remarks) : null
    };
  });

  const result = await attendanceService.markBulkAttendance({
    attendanceDate,
    semester,
    sessionName,
    records: sanitizedRecords,
    overwriteExisting,
    actorFacultyId: user.faculty_id || null,
    scopedDepartmentId: user.role === 'faculty' ? user.department_id : null
  });

  res.status(201).json({
    success: true,
    message: `Attendance saved for ${result.savedCount} student(s).`,
    data: result
  });
});

const listRecords = asyncHandler(async (req, res) => {
  const departmentId = resolveScopedDepartment(req.session.user, req.query.department_id);
  const semester = req.query.semester ? assertIntInRange(req.query.semester, 'Semester', 1, 8) : null;
  const attendanceDate = req.query.attendance_date
    ? assertValidDate(req.query.attendance_date, 'Attendance date')
    : null;
  const sessionName = req.query.session_name ? String(req.query.session_name) : null;
  const search = req.query.search ? String(req.query.search) : '';

  const records = await attendanceService.getAttendanceRecords({
    departmentId,
    semester,
    attendanceDate,
    sessionName,
    search
  });

  res.json({ success: true, data: records });
});

const updateRecord = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const attendanceId = assertPositiveInt(req.params.id, 'Attendance ID');
  const status = req.body.status === 'Present' || req.body.status === 'Absent' ? req.body.status : null;
  if (!status) {
    throw new AppError('Attendance status must be either "Present" or "Absent".', 400);
  }

  const updated = await attendanceService.updateAttendanceRecord(attendanceId, {
    status,
    remarks: req.body.remarks ? String(req.body.remarks) : null,
    actorFacultyId: user.faculty_id || null,
    scopedDepartmentId: user.role === 'faculty' ? user.department_id : null
  });

  res.json({
    success: true,
    message: 'Attendance record updated successfully.',
    data: updated
  });
});

const getReport = asyncHandler(async (req, res) => {
  const departmentId = resolveScopedDepartment(req.session.user, req.query.department_id);
  const semester = req.query.semester ? assertIntInRange(req.query.semester, 'Semester', 1, 8) : null;
  const search = req.query.search ? String(req.query.search) : '';

  const report = await attendanceService.getAttendanceReport({
    departmentId,
    semester,
    search
  });

  res.json({ success: true, data: report });
});

module.exports = {
  getSessionRoster,
  markAttendance,
  listRecords,
  updateRecord,
  getReport
};

