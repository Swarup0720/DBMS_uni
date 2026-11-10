const studentService = require('../services/studentService');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
const {
  assertNonEmptyString,
  assertValidEmail,
  assertValidPhone,
  assertPositiveInt,
  assertIntInRange
} = require('../middleware/validateMiddleware');

const list = asyncHandler(async (req, res) => {
  const user = req.session.user;
  const search = req.query.search ? String(req.query.search) : '';
  const semester = req.query.semester ? assertIntInRange(req.query.semester, 'Semester', 1, 8) : null;

  let departmentId = req.query.department_id
    ? assertPositiveInt(req.query.department_id, 'Department ID')
    : null;

  // Faculty can only view students from their assigned department
  if (user.role === 'faculty') {
    departmentId = user.department_id;
  }

  const students = await studentService.getAllStudents({ search, departmentId, semester });
  res.json({ success: true, data: students });
});

const getById = asyncHandler(async (req, res) => {
  const id = assertPositiveInt(req.params.id, 'Student ID');
  const scopedDepartmentId = req.session.user.role === 'faculty' ? req.session.user.department_id : null;
  const student = await studentService.getStudentById(id, scopedDepartmentId);
  res.json({ success: true, data: student });
});

const create = asyncHandler(async (req, res) => {
  const registration_number = assertNonEmptyString(req.body.registration_number, 'Registration number', 30);
  const full_name = assertNonEmptyString(req.body.full_name, 'Full name', 120);
  const email = assertValidEmail(req.body.email, 'Email');
  const phone = assertValidPhone(req.body.phone, 'Phone number');
  const department_id = assertPositiveInt(req.body.department_id, 'Department');
  const semester = assertIntInRange(req.body.semester, 'Semester', 1, 8);
  const admission_year = assertIntInRange(req.body.admission_year, 'Admission year', 2000, 2100);

  let password = null;
  if (req.body.password !== undefined && String(req.body.password).trim() !== '') {
    password = String(req.body.password);
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400);
    }
  }

  const created = await studentService.createStudent({
    registration_number,
    full_name,
    email,
    phone,
    department_id,
    semester,
    admission_year,
    password
  });

  res.status(201).json({
    success: true,
    message: 'Student added successfully.',
    data: created
  });
});

const update = asyncHandler(async (req, res) => {
  const id = assertPositiveInt(req.params.id, 'Student ID');
  const registration_number = assertNonEmptyString(req.body.registration_number, 'Registration number', 30);
  const full_name = assertNonEmptyString(req.body.full_name, 'Full name', 120);
  const email = assertValidEmail(req.body.email, 'Email');
  const phone = assertValidPhone(req.body.phone, 'Phone number');
  const department_id = assertPositiveInt(req.body.department_id, 'Department');
  const semester = assertIntInRange(req.body.semester, 'Semester', 1, 8);
  const admission_year = assertIntInRange(req.body.admission_year, 'Admission year', 2000, 2100);

  const updated = await studentService.updateStudent(id, {
    registration_number,
    full_name,
    email,
    phone,
    department_id,
    semester,
    admission_year
  });

  res.json({
    success: true,
    message: 'Student details updated successfully.',
    data: updated
  });
});

const remove = asyncHandler(async (req, res) => {
  const id = assertPositiveInt(req.params.id, 'Student ID');
  await studentService.deleteStudent(id);
  res.json({
    success: true,
    message: 'Student deleted successfully.'
  });
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};

