document.addEventListener('DOMContentLoaded', async () => {
  const roleButtons = document.querySelectorAll('.role-tab-btn');
  const selectedRoleInput = document.getElementById('selectedRole');
  const identifierInput = document.getElementById('identifier');
  const passwordInput = document.getElementById('password');
  const loginForm = document.getElementById('loginForm');
  const loginBtnText = document.getElementById('loginBtnText');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const errorAlert = document.getElementById('loginErrorAlert');
  const dbOfflineAlert = document.getElementById('dbOfflineAlert');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');

  // Check database health quietly to inform user if MySQL is not yet configured/running
  try {
    await apiRequest('/api/health', { skipAuthRedirect: true });
  } catch (err) {
    if (err.status === 503 && dbOfflineAlert) {
      dbOfflineAlert.classList.remove('d-none');
    }
  }

  // If user already has an active session, forward to their dashboard
  try {
    const me = await apiRequest('/api/auth/me', { skipAuthRedirect: true });
    if (me && me.redirectUrl) {
      window.location.href = me.redirectUrl;
      return;
    }
  } catch (_) {
    // Expected when not logged in
  }

  function setRole(role) {
    if (!['admin', 'faculty', 'student'].includes(role)) return;
    selectedRoleInput.value = role;
    roleButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.role === role);
    });
    const label = role.charAt(0).toUpperCase() + role.slice(1);
    loginBtnText.textContent = `Sign In as ${label}`;
    errorAlert.classList.add('d-none');
  }

  // Preselect role from query param if provided (?role=faculty)
  const urlParams = new URLSearchParams(window.location.search);
  const queryRole = urlParams.get('role');
  if (queryRole) {
    setRole(queryRole.toLowerCase());
  }

  roleButtons.forEach((btn) => {
    btn.addEventListener('click', () => setRole(btn.dataset.role));
  });

  document.querySelectorAll('.demo-fill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setRole(btn.dataset.role);
      identifierInput.value = btn.dataset.email;
      passwordInput.value = btn.dataset.pass;
      errorAlert.classList.add('d-none');
    });
  });

  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePasswordBtn.innerHTML = isPassword ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.classList.add('d-none');

    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;
    const role = selectedRoleInput.value;

    if (!identifier || !password) {
      errorAlert.textContent = 'Please enter both email/username and password.';
      errorAlert.classList.remove('d-none');
      return;
    }

    loginSubmitBtn.disabled = true;
    loginBtnText.textContent = 'Signing in...';

    try {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        skipAuthRedirect: true,
        body: { identifier, password, role }
      });
      window.location.href = response.redirectUrl;
    } catch (err) {
      errorAlert.textContent = err.message || 'Sign in failed. Please check your credentials.';
      errorAlert.classList.remove('d-none');
      loginSubmitBtn.disabled = false;
      const label = role.charAt(0).toUpperCase() + role.slice(1);
      loginBtnText.textContent = `Sign In as ${label}`;
    }
  });
});

