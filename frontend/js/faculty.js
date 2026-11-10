document.addEventListener('DOMContentLoaded', async () => {
  const user = await initErpLayout({ pageTitle: 'Faculty Management', allowedRoles: ['admin'] });
  if (!user) return;

  const searchInput = document.getElementById('facultySearchInput');
  const deptFilter = document.getElementById('facultyDeptFilter');
  const tableBody = document.getElementById('facultyTableBody');
  const countBadge = document.getElementById('facultyCountBadge');

  const facultyModal = new bootstrap.Modal(document.getElementById('facultyModal'));
  const assignDeptModal = new bootstrap.Modal(document.getElementById('assignDeptModal'));
  const facultyForm = document.getElementById('facultyForm');
  const assignDeptForm = document.getElementById('assignDeptForm');
  const facDeptSelect = document.getElementById('facDeptField');
  const assignDeptSelect = document.getElementById('assignDeptSelect');
  const facPasswordGroup = document.getElementById('facPasswordGroup');

  let facultyCache = [];

  async function loadDepartments() {
    const res = await apiRequest('/api/departments');
    const departments = res.data || [];

    deptFilter.innerHTML = '<option value="">All Departments</option>';
    facDeptSelect.innerHTML = '<option value="">Select department...</option>';
    assignDeptSelect.innerHTML = '';

    for (const dept of departments) {
      const label = `${dept.department_code} - ${dept.department_name}`;
      deptFilter.insertAdjacentHTML('beforeend', `<option value="${dept.department_id}">${escapeHtml(label)}</option>`);
      facDeptSelect.insertAdjacentHTML('beforeend', `<option value="${dept.department_id}">${escapeHtml(label)}</option>`);
      assignDeptSelect.insertAdjacentHTML('beforeend', `<option value="${dept.department_id}">${escapeHtml(label)}</option>`);
    }
  }

  async function loadFaculty() {
    const params = new URLSearchParams();
    if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
    if (deptFilter.value) params.set('department_id', deptFilter.value);

    const res = await apiRequest(`/api/faculty?${params.toString()}`);
    facultyCache = res.data || [];
    countBadge.textContent = `${facultyCache.length} member${facultyCache.length === 1 ? '' : 's'}`;

    if (facultyCache.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No faculty members found.</td></tr>';
      return;
    }

    tableBody.innerHTML = facultyCache
      .map(
        (f) => `
      <tr>
        <td class="tabular-nums text-muted">#${escapeHtml(f.faculty_id)}</td>
        <td class="fw-semibold">${escapeHtml(f.full_name)}</td>
        <td>
          <div>${escapeHtml(f.email)}</div>
          <div class="small text-muted tabular-nums">${escapeHtml(f.phone)}</div>
        </td>
        <td><span class="status-badge status-info">${escapeHtml(f.department_code)}</span> ${escapeHtml(f.department_name)}</td>
        <td>${escapeHtml(f.designation)}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-secondary assign-btn" data-id="${f.faculty_id}" title="Assign Department">
            <i class="bi bi-building"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary edit-btn" data-id="${f.faculty_id}" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-btn" data-id="${f.faculty_id}" data-name="${escapeHtml(f.full_name)}" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  document.getElementById('addFacultyBtn').addEventListener('click', () => {
    facultyForm.reset();
    document.getElementById('facultyIdField').value = '';
    document.getElementById('facultyModalTitle').textContent = 'Add Faculty Member';
    facPasswordGroup.classList.remove('d-none');
    facultyModal.show();
  });

  facultyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('facultyIdField').value;
    const payload = {
      full_name: document.getElementById('facNameField').value.trim(),
      email: document.getElementById('facEmailField').value.trim(),
      phone: document.getElementById('facPhoneField').value.trim(),
      department_id: Number(facDeptSelect.value),
      designation: document.getElementById('facDesignationField').value.trim()
    };

    const pwd = document.getElementById('facPasswordField').value;
    if (!id && pwd) payload.password = pwd;

    try {
      if (id) {
        await apiRequest(`/api/faculty/${id}`, { method: 'PUT', body: payload });
        showToast('Faculty updated successfully.', 'success');
      } else {
        await apiRequest('/api/faculty', { method: 'POST', body: payload });
        showToast('Faculty member added successfully.', 'success');
      }
      facultyModal.hide();
      await loadFaculty();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  assignDeptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('assignFacultyId').value;
    const department_id = Number(assignDeptSelect.value);
    try {
      await apiRequest(`/api/faculty/${id}/department`, {
        method: 'PATCH',
        body: { department_id }
      });
      showToast('Department assignment updated.', 'success');
      assignDeptModal.hide();
      await loadFaculty();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  tableBody.addEventListener('click', async (e) => {
    const assignBtn = e.target.closest('.assign-btn');
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (assignBtn) {
      const f = facultyCache.find((x) => Number(x.faculty_id) === Number(assignBtn.dataset.id));
      if (!f) return;
      document.getElementById('assignFacultyId').value = f.faculty_id;
      document.getElementById('assignFacultyName').textContent = `Faculty: ${f.full_name}`;
      assignDeptSelect.value = f.department_id;
      assignDeptModal.show();
      return;
    }

    if (editBtn) {
      const f = facultyCache.find((x) => Number(x.faculty_id) === Number(editBtn.dataset.id));
      if (!f) return;
      document.getElementById('facultyIdField').value = f.faculty_id;
      document.getElementById('facNameField').value = f.full_name;
      document.getElementById('facEmailField').value = f.email;
      document.getElementById('facPhoneField').value = f.phone;
      facDeptSelect.value = f.department_id;
      document.getElementById('facDesignationField').value = f.designation;
      document.getElementById('facultyModalTitle').textContent = 'Edit Faculty Member';
      facPasswordGroup.classList.add('d-none');
      facultyModal.show();
      return;
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const name = deleteBtn.dataset.name;
      if (!confirm(`Delete faculty member "${name}"?`)) return;
      try {
        await apiRequest(`/api/faculty/${id}`, { method: 'DELETE' });
        showToast('Faculty member deleted.', 'success');
        await loadFaculty();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  });

  let timer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(loadFaculty, 250);
  });
  deptFilter.addEventListener('change', loadFaculty);

  try {
    await loadDepartments();
    await loadFaculty();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

