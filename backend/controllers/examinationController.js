const examinationService = require('../services/examinationService');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
const {
  assertNonEmptyString,
  assertPositiveInt,
  assertIntInRange,
  assertNumberInRange,
  assertValidDate
} = require('../middleware/validateMiddleware');

function scopedDept(user, requestedDeptId) {
  if (user.role === 'faculty') {
    return user.department_id;
  }
  return requestedDeptId ? assertPositiveInt(requestedDeptId, 'Department ID') : null;
}

const listExams = asyncHandler(async (req, res) => {
  const departmentId = scopedDept(req.session.user, req.query.department_id);
  const semester = req.query.semester ? assertIntInRange(req.query.semester, 'Semester', 1, 8) : null;
  const search = req.query.search ? String(req.query.search) : '';

  const exams = await examinationService.getAllExaminations({ departmentId, semester, search });
  res.json({ success: true, data: exams });
});

const createExam = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const exam_name = assertNonEmptyString(req.body.exam_name, 'Examination name', 120);
  const subject_code = assertNonEmptyString(req.body.subject_code, 'Subject code', 30);
  const subject_name = assertNonEmptyString(req.body.subject_name, 'Subject name', 120);
  const department_id =
    user.role === 'faculty'
      ? user.department_id
      : assertPositiveInt(req.body.department_id, 'Department');
  const semester = assertIntInRange(req.body.semester, 'Semester', 1, 8);
  const exam_date = assertValidDate(req.body.exam_date, 'Exam date');
  const max_marks = assertNumberInRange(req.body.max_marks ?? 100, 'Maximum marks', 1, 1000);
  const passing_marks = assertNumberInRange(
    req.body.passing_marks ?? Number((max_marks * 0.4).toFixed(2)),
    'Passing marks',
    0,
    max_marks
  );

  const created = await examinationService.createExamination({
    exam_name,
    subject_code,
    subject_name,
    department_id,
    semester,
    exam_date,
    max_marks,
    passing_marks,
    created_by_faculty_id: user.faculty_id || null
  });

  res.status(201).json({
    success: true,
    message: 'Examination created successfully.',
    data: created
  });
});

const updateExam = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const examId = assertPositiveInt(req.params.id, 'Exam ID');
  const exam_name = assertNonEmptyString(req.body.exam_name, 'Examination name', 120);
  const subject_code = assertNonEmptyString(req.body.subject_code, 'Subject code', 30);
  const subject_name = assertNonEmptyString(req.body.subject_name, 'Subject name', 120);
  const department_id =
    user.role === 'faculty'
      ? user.department_id
      : assertPositiveInt(req.body.department_id, 'Department');
  const semester = assertIntInRange(req.body.semester, 'Semester', 1, 8);
  const exam_date = assertValidDate(req.body.exam_date, 'Exam date');
  const max_marks = assertNumberInRange(req.body.max_marks, 'Maximum marks', 1, 1000);
  const passing_marks = assertNumberInRange(req.body.passing_marks, 'Passing marks', 0, max_marks);

  const updated = await examinationService.updateExamination(
    examId,
    {
      exam_name,
      subject_code,
      subject_name,
      department_id,
      semester,
      exam_date,
      max_marks,
      passing_marks
    },
    user.role === 'faculty' ? user.department_id : null
  );

  res.json({
    success: true,
    message: 'Examination updated successfully.',
    data: updated
  });
});

const deleteExam = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const examId = assertPositiveInt(req.params.id, 'Exam ID');
  await examinationService.deleteExamination(
    examId,
    user.role === 'faculty' ? user.department_id : null
  );
  res.json({
    success: true,
    message: 'Examination deleted successfully.'
  });
});

const getExamMarks = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const examId = assertPositiveInt(req.params.id, 'Exam ID');
  const sheet = await examinationService.getExamMarksSheet(
    examId,
    user.role === 'faculty' ? user.department_id : null
  );
  res.json({ success: true, data: sheet });
});

const saveExamMarks = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const examId = assertPositiveInt(req.params.id, 'Exam ID');
  const marksList = req.body.marks;

  const result = await examinationService.saveExamMarks(
    examId,
    marksList,
    user.faculty_id || null,
    user.role === 'faculty' ? user.department_id : null
  );

  res.json({
    success: true,
    message: `Saved marks for ${result.savedCount} student(s).`,
    data: result
  });
});

const updateResult = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const resultId = assertPositiveInt(req.params.id, 'Result ID');
  if (req.body.marks_obtained === undefined || req.body.marks_obtained === '') {
    throw new AppError('Marks obtained is required.', 400);
  }
  const updated = await examinationService.updateSingleResult(
    resultId,
    {
      marks_obtained: req.body.marks_obtained,
      remarks: req.body.remarks
    },
    user.faculty_id || null,
    user.role === 'faculty' ? user.department_id : null
  );

  res.json({
    success: true,
    message: 'Marks updated successfully.',
    data: updated
  });
});

const getResultsReport = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const examId = req.query.exam_id ? assertPositiveInt(req.query.exam_id, 'Exam ID') : null;
  const departmentId = scopedDept(user, req.query.department_id);
  const semester = req.query.semester ? assertIntInRange(req.query.semester, 'Semester', 1, 8) : null;
  const status = req.query.status ? String(req.query.status) : null;
  const search = req.query.search ? String(req.query.search) : '';

  const report = await examinationService.getResultsReport({
    examId,
    departmentId,
    semester,
    status,
    search
  });

  res.json({ success: true, data: report });
});

const getMyResults = asyncHandler(async (req, res) => {
  const user = req.session.user;
  if (!user.student_id) {
    throw new AppError('No student profile linked to this account.', 404);
  }
  const results = await examinationService.getStudentOwnResults(user.student_id);
  res.json({ success: true, data: results });
});

module.exports = {
  listExams,
  createExam,
  updateExam,
  deleteExam,
  getExamMarks,
  saveExamMarks,
  updateResult,
  getResultsReport,
  getMyResults
};

