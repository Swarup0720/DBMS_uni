const facultyService = require('../services/facultyService');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
const {
  assertNonEmptyString,
  assertValidEmail,
  assertValidPhone,
  assertPositiveInt
} = require('../middleware/validateMiddleware');

const list = asyncHandler(async (req, res) => {
  const search = req.query.search ? String(req.query.search) : '';
  const departmentId = req.query.department_id ? assertPositiveInt(req.query.department_id, 'Department ID') : null;
  const faculty = await facultyService.getAllFaculty({ search, departmentId });
  res.json({ success: true, data: faculty });
});

const getById = asyncHandler(async (req, res) => {
  const id = assertPositiveInt(req.params.id, 'Faculty ID');
  const faculty = await facultyService.getFacultyById(id);
  res.json({ success: true, data: faculty });
});

const create = asyncHandler(async (req, res) => {
  const full_name = assertNonEmptyString(req.body.full_name, 'Full name', 120);
  const email = assertValidEmail(req.body.email, 'Email');
  const phone = assertValidPhone(req.body.phone, 'Phone number');
  const department_id = assertPositiveInt(req.body.department_id, 'Department');
  const designation = assertNonEmptyString(req.body.designation, 'Designation', 80);
  let password = null;

  if (req.body.password !== undefined && String(req.body.password).trim() !== '') {
    password = String(req.body.password);
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400);
    }
  }

  const created = await facultyService.createFaculty({
    full_name,
    email,
    phone,
    department_id,
    designation,
    password
  });

  res.status(201).json({
    success: true,
    message: 'Faculty member added successfully.',
    data: created
  });
});

const update = asyncHandler(async (req, res) => {
  const id = assertPositiveInt(req.params.id, 'Faculty ID');
  const full_name = assertNonEmptyString(req.body.full_name, 'Full name', 120);
  const email = assertValidEmail(req.body.email, 'Email');
  const phone = assertValidPhone(req.body.phone, 'Phone number');
  const department_id = assertPositiveInt(req.body.department_id, 'Department');
  const designation = assertNonEmptyString(req.body.designation, 'Designation', 80);

  const updated = await facultyService.updateFaculty(id, {
    full_name,
    email,
    phone,
    department_id,
    designation
  });

  res.json({
    success: true,
    message: 'Faculty details updated successfully.',
    data: updated
  });
});

const assignDepartment = asyncHandler(async (req, res) => {
  const id = assertPositiveInt(req.params.id, 'Faculty ID');
  const department_id = assertPositiveInt(req.body.department_id, 'Department');
  const updated = await facultyService.assignDepartment(id, department_id);
  res.json({
    success: true,
    message: 'Faculty department assignment updated.',
    data: updated
  });
});

const remove = asyncHandler(async (req, res) => {
  const id = assertPositiveInt(req.params.id, 'Faculty ID');
  await facultyService.deleteFaculty(id);
  res.json({
    success: true,
    message: 'Faculty member deleted successfully.'
  });
});

module.exports = {
  list,
  getById,
  create,
  update,
  assignDepartment,
  remove
};

