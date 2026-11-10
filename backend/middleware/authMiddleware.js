const ROLE_DASHBOARD_MAP = {
  admin: '/admin-dashboard.html',
  faculty: '/faculty-dashboard.html',
  student: '/student-dashboard.html'
};

/**
 * Protect API endpoints: requires an authenticated session.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in.'
    });
  }
  return next();
}

/**
 * Protect API endpoints by user role.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.'
      });
    }
    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission for this resource.'
      });
    }
    return next();
  };
}

/**
 * Protect static HTML pages before express.static serves them.
 */
function requirePageRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login.html');
    }
    const { role } = req.session.user;
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return res.redirect(ROLE_DASHBOARD_MAP[role] || '/login.html');
    }
    return next();
  };
}

module.exports = {
  ROLE_DASHBOARD_MAP,
  requireAuth,
  requireRole,
  requirePageRole
};

