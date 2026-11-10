const authService = require('../services/authService');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
const { assertNonEmptyString } = require('../middleware/validateMiddleware');
const { ROLE_DASHBOARD_MAP } = require('../middleware/authMiddleware');

const login = asyncHandler(async (req, res) => {
  const identifier = assertNonEmptyString(
    req.body.identifier || req.body.email || req.body.username,
    'Email or username',
    120
  );
  const password = assertNonEmptyString(req.body.password, 'Password', 100);
  const role = req.body.role ? String(req.body.role).trim().toLowerCase() : null;

  if (role && !['admin', 'faculty', 'student'].includes(role)) {
    throw new AppError('Invalid role selected.', 400);
  }

  const user = await authService.authenticateUser({ identifier, password, role });

  // Regenerate session ID to prevent session fixation
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

  req.session.user = user;

  res.json({
    success: true,
    message: 'Login successful.',
    user,
    redirectUrl: ROLE_DASHBOARD_MAP[user.role]
  });
});

const logout = asyncHandler(async (req, res) => {
  await new Promise((resolve) => {
    req.session.destroy(() => resolve());
  });
  res.clearCookie('ums.sid');
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

const me = asyncHandler(async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated.'
    });
  }
  return res.json({
    success: true,
    user: req.session.user,
    redirectUrl: ROLE_DASHBOARD_MAP[req.session.user.role]
  });
});

module.exports = {
  login,
  logout,
  me
};

