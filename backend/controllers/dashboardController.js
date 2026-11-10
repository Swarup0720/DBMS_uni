const dashboardService = require('../services/dashboardService');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');

const getDashboard = asyncHandler(async (req, res) => {
  const user = req.session.user;

  if (user.role === 'admin') {
    const data = await dashboardService.getAdminDashboard();
    return res.json({ success: true, role: 'admin', data });
  }
  if (user.role === 'faculty') {
    const data = await dashboardService.getFacultyDashboard(user);
    return res.json({ success: true, role: 'faculty', data });
  }
  if (user.role === 'student') {
    const data = await dashboardService.getStudentDashboard(user);
    return res.json({ success: true, role: 'student', data });
  }

  throw new AppError('Unsupported user role.', 403);
});

module.exports = {
  getDashboard
};

