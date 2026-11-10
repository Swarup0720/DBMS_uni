document.addEventListener('DOMContentLoaded', async () => {
  const user = await initErpLayout({ pageTitle: 'Department Management', allowedRoles: ['admin'] });
  if (!user) return;

  const tableBody = document.getElementById('departmentsTableBody');
  const deptModal = new bootstrap.Modal(document.getElementById('deptModal'));
  const deptForm = document.getElementById('deptForm');
  let deptsCache = [];

  async function loadDepartments() {
    const res = await apiRequest('/api/departments');
    deptsCache = res.data || [];

    if (deptsCache.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No departments found.</td></tr>';
      return;
    }

    tableBody.innerHTML = deptsCache
      .map(
        (d) => `
      <tr>
        <td class="tabular-nums text-muted">#${escapeHtml(d.department_id)}</td>
        <td><span class="status-badge status-info">${escapeHtml(d.department_code)}</span></td>
        <td class="fw-semibold">${escapeHtml(d.department_name)}</td>
        <td>${escapeHtml(d.head_of_department)}</td>
        <td class="tabular-nums">${escapeHtml(d.total_faculty)}</td>
        <td class="tabular-nums">${escapeHtml(d.total_students)}</td>
        <td class="tabular-nums">${escapeHtml(d.total_examinations)}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-primary edit-btn" data-id="${d.department_id}" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-btn" data-id="${d.department_id}" data-name="${escapeHtml(d.department_name)}" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  document.getElementById('addDeptBtn').addEventListener('click', () => {
    deptForm.reset();
    document.getElementById('deptIdField').value = '';
    document.getElementById('deptModalTitle').textContent = 'Create Department';
    deptModal.show();
  });

  deptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('deptIdField').value;
    const payload = {
      department_code: document.getElementById('deptCodeField').value.trim(),
      department_name: document.getElementById('deptNameField').value.trim(),
      head_of_department: document.getElementById('deptHodField').value.trim()
    };

    try {
      if (id) {
        await apiRequest(`/api/departments/${id}`, { method: 'PUT', body: payload });
        showToast('Department updated successfully.', 'success');
      } else {
        await apiRequest('/api/departments', { method: 'POST', body: payload });
        showToast('Department created successfully.', 'success');
      }
      deptModal.hide();
      await loadDepartments();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  tableBody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
      const d = deptsCache.find((item) => Number(item.department_id) === Number(editBtn.dataset.id));
      if (!d) return;
      document.getElementById('deptIdField').value = d.department_id;
      document.getElementById('deptCodeField').value = d.department_code;
      document.getElementById('deptNameField').value = d.department_name;
      document.getElementById('deptHodField').value = d.head_of_department;
      document.getElementById('deptModalTitle').textContent = 'Edit Department';
      deptModal.show();
      return;
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const name = deleteBtn.dataset.name;
      if (!confirm(`Delete department "${name}"?`)) return;
      try {
        await apiRequest(`/api/departments/${id}`, { method: 'DELETE' });
        showToast('Department deleted successfully.', 'success');
        await loadDepartments();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  });

  try {
    await loadDepartments();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

