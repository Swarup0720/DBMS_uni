document.addEventListener('DOMContentLoaded', async () => {
  const user = await initErpLayout({ pageTitle: 'Examinations & Marks', allowedRoles: ['admin', 'faculty'] });
  if (!user) return;

  const searchInput = document.getElementById('examSearchInput');
  const deptFilter = document.getElementById('examDeptFilter');
  const semFilter = document.getElementById('examSemFilter');
  const examsTableBody = document.getElementById('examsTableBody');

  const examModal = new bootstrap.Modal(document.getElementById('examModal'));
  const marksModal = new bootstrap.Modal(document.getElementById('marksModal'));
  const examForm = document.getElementById('examForm');
  const marksForm = document.getElementById('marksForm');
  const examDeptField = document.getElementById('examDeptField');

  let examsCache = [];
  let activeExamMeta = null;

  async function initDepartments() {
    const res = await apiRequest('/api/departments');
    const depts = res.data || [];

    if (user.role === 'faculty') {
      const opt = `<option value="${user.department_id}">${escapeHtml(user.department_code)} - ${escapeHtml(user.department_name)}</option>`;
      deptFilter.innerHTML = opt;
      examDeptField.innerHTML = opt;
      deptFilter.disabled = true;
      examDeptField.disabled = true;
    } else {
      deptFilter.innerHTML = '<option value="">All Departments</option>';
      examDeptField.innerHTML = '<option value="">Select department...</option>';
      for (const d of depts) {
        const label = `${d.department_code} - ${d.department_name}`;
        deptFilter.insertAdjacentHTML('beforeend', `<option value="${d.department_id}">${escapeHtml(label)}</option>`);
        examDeptField.insertAdjacentHTML('beforeend', `<option value="${d.department_id}">${escapeHtml(label)}</option>`);
      }
    }
  }

  async function loadExams() {
    const params = new URLSearchParams();
    if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
    if (deptFilter.value) params.set('department_id', deptFilter.value);
    if (semFilter.value) params.set('semester', semFilter.value);

    const res = await apiRequest(`/api/examinations?${params.toString()}`);
    examsCache = res.data || [];

    if (examsCache.length === 0) {
      examsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No examinations found.</td></tr>';
      return;
    }

    examsTableBody.innerHTML = examsCache
      .map(
        (ex) => `
      <tr>
        <td>
          <span class="fw-semibold">${escapeHtml(ex.subject_code)}</span>
          <div class="small text-muted">${escapeHtml(ex.subject_name)}</div>
        </td>
        <td>${escapeHtml(ex.exam_name)}</td>
        <td><span class="status-badge status-info">${escapeHtml(ex.department_code)}</span> Sem ${escapeHtml(ex.semester)}</td>
        <td class="tabular-nums">${escapeHtml(formatDate(ex.exam_date))}</td>
        <td class="tabular-nums">${escapeHtml(ex.max_marks)} / <span class="text-muted">${escapeHtml(ex.passing_marks)} pass</span></td>
        <td class="tabular-nums"><span class="badge bg-light text-dark border">${escapeHtml(ex.graded_count)} graded</span></td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-primary-ums marks-btn" data-id="${ex.exam_id}">
            <i class="bi bi-pencil-square me-1"></i> Marks
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary edit-exam-btn" data-id="${ex.exam_id}" title="Edit Exam">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger delete-exam-btn" data-id="${ex.exam_id}" data-name="${escapeHtml(ex.subject_code)}" title="Delete Exam">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  document.getElementById('createExamBtn').addEventListener('click', () => {
    examForm.reset();
    document.getElementById('examIdField').value = '';
    document.getElementById('examDateField').value = todayDateInput();
    document.getElementById('maxMarksField').value = '100';
    document.getElementById('passingMarksField').value = '40';
    if (user.role === 'faculty') examDeptField.value = user.department_id;
    document.getElementById('examModalTitle').textContent = 'Create Examination';
    examModal.show();
  });

  document.getElementById('maxMarksField').addEventListener('input', (e) => {
    const maxVal = Number(e.target.value);
    if (!Number.isNaN(maxVal) && maxVal > 0 && !document.getElementById('examIdField').value) {
      document.getElementById('passingMarksField').value = Number((maxVal * 0.4).toFixed(2));
    }
  });

  examForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('examIdField').value;
    const payload = {
      exam_name: document.getElementById('examNameField').value.trim(),
      subject_code: document.getElementById('subjectCodeField').value.trim(),
      subject_name: document.getElementById('subjectNameField').value.trim(),
      department_id: Number(examDeptField.value),
      semester: Number(document.getElementById('examSemField').value),
      exam_date: document.getElementById('examDateField').value,
      max_marks: Number(document.getElementById('maxMarksField').value),
      passing_marks: Number(document.getElementById('passingMarksField').value)
    };

    try {
      if (id) {
        await apiRequest(`/api/examinations/${id}`, { method: 'PUT', body: payload });
        showToast('Examination updated successfully.', 'success');
      } else {
        await apiRequest('/api/examinations', { method: 'POST', body: payload });
        showToast('Examination created successfully.', 'success');
      }
      examModal.hide();
      await loadExams();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  function updateRowPreview(tr, maxMarks, passingMarks) {
    const input = tr.querySelector('.mark-input');
    const pctCell = tr.querySelector('.live-pct');
    const statusCell = tr.querySelector('.live-status');
    const raw = input.value.trim();

    if (raw === '') {
      pctCell.textContent = '-';
      statusCell.innerHTML = '<span class="status-badge status-info">UNGRADED</span>';
      return;
    }

    const val = Number(raw);
    if (Number.isNaN(val) || val < 0 || val > maxMarks) {
      pctCell.textContent = 'Invalid';
      statusCell.innerHTML = '<span class="status-badge status-fail">OUT OF RANGE</span>';
      return;
    }

    const pct = ((val / maxMarks) * 100).toFixed(2);
    const pass = val >= passingMarks;
    pctCell.textContent = `${pct}%`;
    statusCell.innerHTML = `<span class="status-badge ${pass ? 'status-pass' : 'status-fail'}">${pass ? 'PASS' : 'FAIL'}</span>`;
  }

  async function openMarksModal(examId) {
    const body = document.getElementById('marksSheetBody');
    body.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Loading student roster...</td></tr>';
    marksModal.show();

    try {
      const res = await apiRequest(`/api/examinations/${examId}/marks`);
      const { exam, students } = res.data;
      activeExamMeta = exam;

      document.getElementById('marksExamId').value = exam.exam_id;
      document.getElementById('marksModalTitle').textContent = `${exam.subject_code} - ${exam.subject_name}`;
      document.getElementById('marksModalSub').textContent =
        `${exam.exam_name} • ${exam.department_code} Sem ${exam.semester} • Max: ${exam.max_marks} | Passing: ${exam.passing_marks}`;

      if (!students || students.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No students found in this department and semester.</td></tr>';
        document.getElementById('saveMarksBtn').disabled = true;
        return;
      }

      document.getElementById('saveMarksBtn').disabled = false;
      body.innerHTML = students
        .map((st) => {
          const hasMarks = st.marks_obtained !== null && st.marks_obtained !== undefined;
          const badgeClass =
            st.result_status === 'PASS' ? 'status-pass' : st.result_status === 'FAIL' ? 'status-fail' : 'status-info';
          return `
          <tr data-student-id="${st.student_id}">
            <td class="fw-semibold tabular-nums">${escapeHtml(st.registration_number)}</td>
            <td>${escapeHtml(st.full_name)}</td>
            <td style="width: 150px;">
              <input type="number" step="0.01" min="0" max="${escapeHtml(exam.max_marks)}"
                class="form-control form-control-sm tabular-nums mark-input"
                value="${hasMarks ? escapeHtml(st.marks_obtained) : ''}"
                placeholder="0 - ${escapeHtml(exam.max_marks)}" />
            </td>
            <td class="tabular-nums live-pct">${hasMarks ? `${escapeHtml(st.percentage)}%` : '-'}</td>
            <td class="live-status"><span class="status-badge ${badgeClass}">${escapeHtml(st.result_status)}</span></td>
            <td>
              <input type="text" class="form-control form-control-sm mark-remark" value="${escapeHtml(st.remarks || '')}" placeholder="Optional remarks" maxlength="200" />
            </td>
          </tr>
        `;
        })
        .join('');
    } catch (err) {
      body.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  document.getElementById('marksSheetBody').addEventListener('input', (e) => {
    if (!e.target.classList.contains('mark-input') || !activeExamMeta) return;
    const tr = e.target.closest('tr');
    updateRowPreview(tr, Number(activeExamMeta.max_marks), Number(activeExamMeta.passing_marks));
  });

  marksForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeExamMeta) return;
    const examId = document.getElementById('marksExamId').value;
    const maxMarks = Number(activeExamMeta.max_marks);
    const rows = Array.from(document.querySelectorAll('#marksSheetBody tr[data-student-id]'));

    const marks = [];
    for (const tr of rows) {
      const valStr = tr.querySelector('.mark-input').value.trim();
      if (valStr === '') continue; // allow partial entry
      const val = Number(valStr);
      if (Number.isNaN(val) || val < 0 || val > maxMarks) {
        showToast(`Invalid marks detected. Values must be between 0 and ${maxMarks}.`, 'danger');
        return;
      }
      marks.push({
        student_id: Number(tr.dataset.studentId),
        marks_obtained: val,
        remarks: tr.querySelector('.mark-remark').value.trim()
      });
    }

    if (marks.length === 0) {
      showToast('Enter marks for at least one student before saving.', 'danger');
      return;
    }

    try {
      const res = await apiRequest(`/api/examinations/${examId}/marks`, {
        method: 'POST',
        body: { marks }
      });
      showToast(res.message, 'success');
      marksModal.hide();
      await loadExams();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  examsTableBody.addEventListener('click', async (e) => {
    const marksBtn = e.target.closest('.marks-btn');
    const editBtn = e.target.closest('.edit-exam-btn');
    const deleteBtn = e.target.closest('.delete-exam-btn');

    if (marksBtn) {
      await openMarksModal(marksBtn.dataset.id);
      return;
    }

    if (editBtn) {
      const ex = examsCache.find((x) => Number(x.exam_id) === Number(editBtn.dataset.id));
      if (!ex) return;
      document.getElementById('examIdField').value = ex.exam_id;
      document.getElementById('examNameField').value = ex.exam_name;
      document.getElementById('subjectCodeField').value = ex.subject_code;
      document.getElementById('subjectNameField').value = ex.subject_name;
      examDeptField.value = ex.department_id;
      document.getElementById('examSemField').value = ex.semester;
      document.getElementById('examDateField').value = String(ex.exam_date).slice(0, 10);
      document.getElementById('maxMarksField').value = ex.max_marks;
      document.getElementById('passingMarksField').value = ex.passing_marks;
      document.getElementById('examModalTitle').textContent = 'Edit Examination';
      examModal.show();
      return;
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const name = deleteBtn.dataset.name;
      if (!confirm(`Delete examination "${name}" and all its student results?`)) return;
      try {
        await apiRequest(`/api/examinations/${id}`, { method: 'DELETE' });
        showToast('Examination deleted.', 'success');
        await loadExams();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  });

  let timer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(loadExams, 250);
  });
  deptFilter.addEventListener('change', loadExams);
  semFilter.addEventListener('change', loadExams);

  try {
    await initDepartments();
    await loadExams();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

