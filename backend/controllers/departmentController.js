const departmentService = require('../services/departmentService');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { assertNonEmptyString, assertPositiveInt } = require('../middleware/validateMiddleware');

const list = asyncHandler(async (_req, res) => {
  const departments = await departmentService.getAllDepartments();
  res.json({ success: true, data: departments });
});

const getById = asyncHandler(async (req, res) => {
  const id = assertPositiveInt(req.params.id, 'Department ID');
  const department = await departmentService.getDepartmentById(id);
  res.json({ success: true, data: department });
});

const create = asyncHandler(async (req, res) => {
  const department_name = assertNonEmptyString(req.body.department_name, 'Department name', 100);
  const department_code = assertNonEmptyString(req.body.department_code, 'Department code', 20);
  const head_of_department = req.body.head_of_department
    ? assertNonEmptyString(req.body.head_of_department, 'Head of department', 120)
    : 'TBD';

  const created = await departmentService.createDepartment({
    department_name,
    department_code,
    head_of_department
  });

  res.status(201).json({
    success: true,
    message: 'Department created successfully.',
    data: created
  });
});

const update = asyncHandler(async (req, res) => {
  const id = assertPositiveInt(req.params.id, 'Department ID');
  const department_name = assertNonEmptyString(req.body.department_name, 'Department name', 100);
  const department_code = assertNonEmptyString(req.body.department_code, 'Department code', 20);
  const head_of_department = req.body.head_of_department
    ? assertNonEmptyString(req.body.head_of_department, 'Head of department', 120)
    : 'TBD';

  const updated = await departmentService.updateDepartment(id, {
    department_name,
    department_code,
    head_of_department
  });

  res.json({
    success: true,
    message: 'Department updated successfully.',
    data: updated
  });
});

const remove = asyncHandler(async (req, res) => {
  const id = assertPositiveInt(req.params.id, 'Department ID');
  await departmentService.deleteDepartment(id);
  res.json({
    success: true,
    message: 'Department deleted successfully.'
  });
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove
};

