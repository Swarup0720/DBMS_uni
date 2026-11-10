document.addEventListener('DOMContentLoaded', async () => {
  const user = await initErpLayout({ pageTitle: 'Student Management', allowedRoles: ['admin'] });
  if (!user) return;

  const searchInput = document.getElementById('searchInput');
  const filterDept = document.getElementById('filterDepartment');
  const filterSem = document.getElementById('filterSemester');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const tableBody = document.getElementById('studentsTableBody');
  const countBadge = document.getElementById('studentCountBadge');

  const studentModalEl = document.getElementById('studentModal');
  const studentModal = new bootstrap.Modal(studentModalEl);
  const detailModal = new bootstrap.Modal(document.getElementById('studentDetailModal'));

  const studentForm = document.getElementById('studentForm');
  const deptSelect = document.getElementById('departmentField');
  const passwordGroup = document.getElementById('passwordGroup');

  let departments = [];
  let studentsCache = [];

  async function loadDepartments() {
    const res = await apiRequest('/api/departments');
    departments = res.data || [];

    filterDept.innerHTML = '<option value="">All Departments</option>';
    deptSelect.innerHTML = '<option value="">Select department...</option>';

    for (const dept of departments) {
      const label = `${dept.department_code} - ${dept.department_name}`;
      filterDept.insertAdjacentHTML('beforeend', `<option value="${dept.department_id}">${escapeHtml(label)}</option>`);
      deptSelect.insertAdjacentHTML('beforeend', `<option value="${dept.department_id}">${escapeHtml(label)}</option>`);
    }
  }

  async function loadStudents() {
    const params = new URLSearchParams();
    if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
    if (filterDept.value) params.set('department_id', filterDept.value);
    if (filterSem.value) params.set('semester', filterSem.value);

    const res = await apiRequest(`/api/students?${params.toString()}`);
    studentsCache = res.data || [];
    countBadge.textContent = `${studentsCache.length} student${studentsCache.length === 1 ? '' : 's'}`;

    if (studentsCache.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No students match your criteria.</td></tr>';
      return;
    }

    tableBody.innerHTML = studentsCache
      .map(
        (st) => `
      <tr>
        <td class="tabular-nums text-muted">#${escapeHtml(st.student_id)}</td>
        <td class="fw-semibold tabular-nums">${escapeHtml(st.registration_number)}</td>
        <td>${escapeHtml(st.full_name)}</td>
        <td>
          <div>${escapeHtml(st.email)}</div>
          <div class="small text-muted tabular-nums">${escapeHtml(st.phone)}</div>
        </td>
        <td><span class="status-badge status-info">${escapeHtml(st.department_code)}</span></td>
        <td class="tabular-nums">Sem ${escapeHtml(st.semester)}</td>
        <td class="tabular-nums">${escapeHtml(st.admission_year)}</td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-secondary view-btn" data-id="${st.student_id}" title="View Details">
            <i class="bi bi-eye"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary edit-btn" data-id="${st.student_id}" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-btn" data-id="${st.student_id}" data-name="${escapeHtml(st.full_name)}" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  document.getElementById('addStudentBtn').addEventListener('click', () => {
    studentForm.reset();
    document.getElementById('studentIdField').value = '';
    document.getElementById('admissionYearField').value = new Date().getFullYear();
    document.getElementById('studentModalTitle').textContent = 'Add New Student';
    passwordGroup.classList.remove('d-none');
    studentModal.show();
  });

  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('studentIdField').value;
    const payload = {
      registration_number: document.getElementById('regNoField').value.trim(),
      full_name: document.getElementById('fullNameField').value.trim(),
      email: document.getElementById('emailField').value.trim(),
      phone: document.getElementById('phoneField').value.trim(),
      department_id: Number(deptSelect.value),
      semester: Number(document.getElementById('semesterField').value),
      admission_year: Number(document.getElementById('admissionYearField').value)
    };

    const pwd = document.getElementById('studentPasswordField').value;
    if (!id && pwd) {
      payload.password = pwd;
    }

    const saveBtn = document.getElementById('saveStudentBtn');
    saveBtn.disabled = true;

    try {
      if (id) {
        await apiRequest(`/api/students/${id}`, { method: 'PUT', body: payload });
        showToast('Student updated successfully.', 'success');
      } else {
        await apiRequest('/api/students', { method: 'POST', body: payload });
        showToast('Student added successfully.', 'success');
      }
      studentModal.hide();
      await loadStudents();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      saveBtn.disabled = false;
    }
  });

  tableBody.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.view-btn');
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (viewBtn) {
      const id = viewBtn.dataset.id;
      const bodyEl = document.getElementById('studentDetailBody');
      bodyEl.innerHTML = '<div class="text-center py-4 text-muted">Loading student profile...</div>';
      detailModal.show();

      try {
        const res = await apiRequest(`/api/students/${id}`);
        const st = res.data;
        const att = st.attendanceSummary;
        const resultsHtml =
          st.results && st.results.length > 0
            ? st.results
                .map(
                  (r) => `
              <tr>
                <td>${escapeHtml(r.subject_code)} - ${escapeHtml(r.subject_name)}</td>
                <td>${escapeHtml(r.exam_name)}</td>
                <td class="tabular-nums">${escapeHtml(r.marks_obtained)} / ${escapeHtml(r.max_marks)}</td>
                <td><span class="status-badge ${r.result_status === 'PASS' ? 'status-pass' : 'status-fail'}">${escapeHtml(r.result_status)}</span></td>
              </tr>
            `
                )
                .join('')
            : '<tr><td colspan="4" class="text-center text-muted py-3">No exam results recorded.</td></tr>';

        bodyEl.innerHTML = `
          <div class="row g-3 mb-3">
            <div class="col-md-6">
              <div class="p-3 bg-light rounded border">
                <div class="small text-muted">Registration Number</div>
                <div class="fw-bold tabular-nums">${escapeHtml(st.registration_number)}</div>
                <div class="small text-muted mt-2">Full Name</div>
                <div class="fw-semibold">${escapeHtml(st.full_name)}</div>
                <div class="small text-muted mt-2">Department &amp; Semester</div>
                <div>${escapeHtml(st.department_name)} (${escapeHtml(st.department_code)}) &bull; Sem ${escapeHtml(st.semester)}</div>
              </div>
            </div>
            <div class="col-md-6">
              <div class="p-3 bg-light rounded border">
                <div class="small text-muted">Email &amp; Phone</div>
                <div>${escapeHtml(st.email)}</div>
                <div class="tabular-nums">${escapeHtml(st.phone)}</div>
                <div class="small text-muted mt-2">Attendance Summary</div>
                <div class="fw-bold tabular-nums text-primary">${escapeHtml(att.attendance_percentage)}% (${escapeHtml(att.present_classes)} / ${escapeHtml(att.total_classes)} classes)</div>
                <div class="small text-muted mt-2">Admission Year</div>
                <div class="tabular-nums">${escapeHtml(st.admission_year)}</div>
              </div>
            </div>
          </div>
          <h6 class="fw-bold mb-2">Examination Results</h6>
          <div class="table-responsive">
            <table class="table table-sm erp-table border">
              <thead>
                <tr><th>Subject</th><th>Examination</th><th>Marks</th><th>Status</th></tr>
              </thead>
              <tbody>${resultsHtml}</tbody>
            </table>
          </div>
        `;
      } catch (err) {
        bodyEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
      }
      return;
    }

    if (editBtn) {
      const id = Number(editBtn.dataset.id);
      const st = studentsCache.find((item) => Number(item.student_id) === id);
      if (!st) return;

      document.getElementById('studentIdField').value = st.student_id;
      document.getElementById('regNoField').value = st.registration_number;
      document.getElementById('fullNameField').value = st.full_name;
      document.getElementById('emailField').value = st.email;
      document.getElementById('phoneField').value = st.phone;
      deptSelect.value = st.department_id;
      document.getElementById('semesterField').value = st.semester;
      document.getElementById('admissionYearField').value = st.admission_year;
      document.getElementById('studentModalTitle').textContent = 'Edit Student';
      passwordGroup.classList.add('d-none');
      studentModal.show();
      return;
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const name = deleteBtn.dataset.name;
      if (!confirm(`Delete student "${name}"? This will also remove their attendance and result records.`)) {
        return;
      }
      try {
        await apiRequest(`/api/students/${id}`, { method: 'DELETE' });
        showToast('Student deleted successfully.', 'success');
        await loadStudents();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  });

  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadStudents, 250);
  });
  filterDept.addEventListener('change', loadStudents);
  filterSem.addEventListener('change', loadStudents);
  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterDept.value = '';
    filterSem.value = '';
    loadStudents();
  });

  try {
    await loadDepartments();
    await loadStudents();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

