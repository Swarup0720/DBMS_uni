/**
 * Shared ERP Layout Controller: verifies active session, renders role-based sidebar & topbar,
 * wires mobile drawer toggle and logout action.
 */

const ROLE_NAV_CONFIG = {
  admin: [
    { section: 'Overview' },
    { label: 'Admin Dashboard', href: '/admin-dashboard.html', icon: 'bi-speedometer2' },
    { section: 'Administration' },
    { label: 'Students', href: '/students.html', icon: 'bi-mortarboard' },
    { label: 'Faculty', href: '/faculty.html', icon: 'bi-person-badge' },
    { label: 'Departments', href: '/departments.html', icon: 'bi-building' },
    { section: 'Academics' },
    { label: 'Attendance & Reports', href: '/attendance.html', icon: 'bi-calendar-check' },
    { label: 'Examinations', href: '/examinations.html', icon: 'bi-journal-text' },
    { label: 'Results & Reports', href: '/results.html', icon: 'bi-award' },
    { section: 'DBMS Project' },
    { label: 'DBMS Concepts', href: '/dbms-concepts.html', icon: 'bi-database' }
  ],
  faculty: [
    { section: 'Overview' },
    { label: 'Faculty Dashboard', href: '/faculty-dashboard.html', icon: 'bi-speedometer2' },
    { section: 'Academic Operations' },
    { label: 'Attendance', href: '/attendance.html', icon: 'bi-calendar-check' },
    { label: 'Examinations & Marks', href: '/examinations.html', icon: 'bi-journal-text' },
    { label: 'Examination Results', href: '/results.html', icon: 'bi-award' },
    { section: 'DBMS Project' },
    { label: 'DBMS Concepts', href: '/dbms-concepts.html', icon: 'bi-database' }
  ],
  student: [
    { section: 'Overview' },
    { label: 'Student Dashboard', href: '/student-dashboard.html', icon: 'bi-speedometer2' },
    { section: 'Academics' },
    { label: 'My Exam Results', href: '/results.html', icon: 'bi-award' },
    { section: 'DBMS Project' },
    { label: 'DBMS Concepts', href: '/dbms-concepts.html', icon: 'bi-database' }
  ]
};

const ROLE_DASHBOARD_HOME = {
  admin: '/admin-dashboard.html',
  faculty: '/faculty-dashboard.html',
  student: '/student-dashboard.html'
};

function getInitials(name) {
  if (!name) return 'U';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function initErpLayout({ pageTitle, allowedRoles = [] } = {}) {
  let sessionData;
  try {
    sessionData = await apiRequest('/api/auth/me', { skipAuthRedirect: true });
  } catch (_) {
    window.location.href = '/login.html';
    return null;
  }

  const user = sessionData.user;
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    window.location.href = ROLE_DASHBOARD_HOME[user.role] || '/login.html';
    return null;
  }

  const currentPath = window.location.pathname;
  const navItems = ROLE_NAV_CONFIG[user.role] || [];

  const sidebarEl = document.getElementById('erpSidebar');
  if (sidebarEl) {
    const navHtml = navItems
      .map((item) => {
        if (item.section) {
          return `<div class="erp-nav-section">${escapeHtml(item.section)}</div>`;
        }
        const activeClass = currentPath === item.href ? 'active' : '';
        return `
          <a href="${item.href}" class="erp-nav-link ${activeClass}">
            <i class="bi ${item.icon}"></i>
            <span>${escapeHtml(item.label)}</span>
          </a>
        `;
      })
      .join('');

    sidebarEl.innerHTML = `
      <a href="${ROLE_DASHBOARD_HOME[user.role]}" class="erp-brand">
        <img src="/assets/university-logo.svg" alt="University Crest" />
        <div>
          <div class="erp-brand-title">UniPortal ERP</div>
          <div class="erp-brand-sub">Management System</div>
        </div>
      </a>
      <nav class="erp-nav">${navHtml}</nav>
      <div class="erp-sidebar-footer">
        <div class="small text-light fw-semibold text-truncate">${escapeHtml(user.full_name)}</div>
        <div class="small" style="color: #93c5fd; font-size: 0.75rem;">
          ${escapeHtml(user.department_code ? `${user.role.toUpperCase()} • ${user.department_code}` : user.role.toUpperCase())}
        </div>
      </div>
    `;
  }

  const topbarEl = document.getElementById('erpTopbar');
  if (topbarEl) {
    topbarEl.innerHTML = `
      <div class="erp-topbar-left">
        <button type="button" class="btn btn-outline-secondary btn-sm d-lg-none" id="sidebarToggleBtn" aria-label="Toggle Menu">
          <i class="bi bi-list fs-5"></i>
        </button>
        <h1 class="erp-page-title">${escapeHtml(pageTitle || 'Dashboard')}</h1>
      </div>
      <div class="erp-topbar-right">
        <div class="erp-user-pill d-none d-sm-flex">
          <span class="erp-user-avatar">${escapeHtml(getInitials(user.full_name))}</span>
          <div class="erp-user-meta">
            <div class="erp-user-name">${escapeHtml(user.full_name)}</div>
            <div class="erp-user-role">${escapeHtml(user.role)}</div>
          </div>
        </div>
        <button type="button" class="btn btn-outline-danger btn-sm d-flex align-items-center gap-1" id="logoutBtn">
          <i class="bi bi-box-arrow-right"></i>
          <span>Logout</span>
        </button>
      </div>
    `;
  }

  // Mobile sidebar drawer behavior
  const backdrop = document.getElementById('erpBackdrop');
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  if (toggleBtn && sidebarEl && backdrop) {
    toggleBtn.addEventListener('click', () => {
      sidebarEl.classList.toggle('open');
      backdrop.classList.toggle('show');
    });
    backdrop.addEventListener('click', () => {
      sidebarEl.classList.remove('open');
      backdrop.classList.remove('show');
    });
  }

  // Logout action
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiRequest('/api/auth/logout', { method: 'POST', skipAuthRedirect: true });
      } finally {
        window.location.href = '/login.html';
      }
    });
  }

  return user;
}

