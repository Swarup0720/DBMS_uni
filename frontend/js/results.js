document.addEventListener('DOMContentLoaded', async () => {
  const user = await initErpLayout({
    pageTitle: 'Examination Results & Reports',
    allowedRoles: ['admin', 'faculty', 'student']
  });
  if (!user) return;

  if (user.role === 'student') {
    document.getElementById('studentResultsSection').classList.remove('d-none');
    await loadStudentView();
  } else {
    document.getElementById('staffResultsSection').classList.remove('d-none');
    await initStaffView(user);
  }
});

async function loadStudentView() {
  try {
    const res = await apiRequest('/api/results/my');
    const { student, subjects, summary } = res.data;

    document.getElementById('stuResultName').textContent = `${student.full_name} (${student.registration_number})`;
    document.getElementById('stuResultMeta').textContent =
      `${student.department_name} (${student.department_code}) • Semester ${student.semester} • Admission ${student.admission_year}`;

    document.getElementById('stuTotalMarks').textContent = `${summary.totalObtained} / ${summary.totalMax}`;
    document.getElementById('stuSubjectsCount').textContent = `${summary.subjectsEvaluated} subject(s) evaluated`;
    document.getElementById('stuResPercentage').textContent = `${summary.overallPercentage}%`;
    document.getElementById('stuThresholdNote').textContent = summary.passingThresholdNote;

    const statusBadge = document.getElementById('stuFinalStatusBadge');
    if (summary.overallStatus === 'PASS') {
      statusBadge.innerHTML = '<span class="status-badge status-pass fs-6 px-3 py-2">PASS</span>';
    } else if (summary.overallStatus === 'FAIL') {
      statusBadge.innerHTML = '<span class="status-badge status-fail fs-6 px-3 py-2">FAIL</span>';
    } else {
      statusBadge.innerHTML = '<span class="status-badge status-info fs-6 px-3 py-2">PENDING</span>';
    }

    const tbody = document.getElementById('studentResultsBody');
    if (!subjects || subjects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No examination results published yet.</td></tr>';
      return;
    }

    tbody.innerHTML = subjects
      .map(
        (s) => `
      <tr>
        <td>${escapeHtml(s.exam_name)}</td>
        <td class="fw-semibold">${escapeHtml(s.subject_code)}</td>
        <td>${escapeHtml(s.subject_name)}</td>
        <td class="tabular-nums">${escapeHtml(formatDate(s.exam_date))}</td>
        <td class="tabular-nums fw-semibold">${escapeHtml(s.marks_obtained)} / ${escapeHtml(s.max_marks)}</td>
        <td class="tabular-nums">${escapeHtml(s.passing_marks)}</td>
        <td class="tabular-nums">${escapeHtml(s.percentage)}%</td>
        <td><span class="status-badge ${s.result_status === 'PASS' ? 'status-pass' : 'status-fail'}">${escapeHtml(s.result_status)}</span></td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function initStaffView(user) {
  const examFilter = document.getElementById('resExamFilter');
  const deptFilter = document.getElementById('resDeptFilter');
  const semFilter = document.getElementById('resSemFilter');
  const statusFilter = document.getElementById('resStatusFilter');
  const searchInput = document.getElementById('resSearchInput');
  const resultsBody = document.getElementById('staffResultsBody');
  const consolidatedBody = document.getElementById('consolidatedStudentsBody');
  const editModal = new bootstrap.Modal(document.getElementById('editResultModal'));
  const editForm = document.getElementById('editResultForm');

  let currentRecords = [];

  async function loadFilters() {
    const [deptsRes, examsRes] = await Promise.all([
      apiRequest('/api/departments'),
      apiRequest('/api/examinations')
    ]);

    const depts = deptsRes.data || [];
    const exams = examsRes.data || [];

    if (user.role === 'faculty') {
      deptFilter.innerHTML = `<option value="${user.department_id}">${escapeHtml(user.department_code)} - ${escapeHtml(user.department_name)}</option>`;
      deptFilter.disabled = true;
    } else {
      deptFilter.innerHTML = '<option value="">All Departments</option>';
      for (const d of depts) {
        deptFilter.insertAdjacentHTML(
          'beforeend',
          `<option value="${d.department_id}">${escapeHtml(d.department_code)} - ${escapeHtml(d.department_name)}</option>`
        );
      }
    }

    examFilter.innerHTML = '<option value="">All Examinations</option>';
    for (const ex of exams) {
      examFilter.insertAdjacentHTML(
        'beforeend',
        `<option value="${ex.exam_id}">${escapeHtml(ex.subject_code)} - ${escapeHtml(ex.exam_name)}</option>`
      );
    }
  }

  async function loadReport() {
    const params = new URLSearchParams();
    if (examFilter.value) params.set('exam_id', examFilter.value);
    if (deptFilter.value) params.set('department_id', deptFilter.value);
    if (semFilter.value) params.set('semester', semFilter.value);
    if (statusFilter.value) params.set('status', statusFilter.value);
    if (searchInput.value.trim()) params.set('search', searchInput.value.trim());

    const res = await apiRequest(`/api/results?${params.toString()}`);
    const { records, consolidatedStudents, summary } = res.data;
    currentRecords = records || [];

    document.getElementById('repResTotal').textContent = summary.totalRecords;
    document.getElementById('repResPassRate').textContent = `${summary.passRate}%`;
    document.getElementById('repResPassFailCounts').textContent = `${summary.passCount} Pass / ${summary.failCount} Fail`;
    document.getElementById('repResAvg').textContent = `${summary.averagePercentage}%`;
    document.getElementById('repResHighLow').textContent = `${summary.highestPercentage}% / ${summary.lowestPercentage}%`;

    if (currentRecords.length === 0) {
      resultsBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No examination results match your filters.</td></tr>';
    } else {
      resultsBody.innerHTML = currentRecords
        .map(
          (r) => `
        <tr>
          <td class="fw-semibold tabular-nums">${escapeHtml(r.registration_number)}</td>
          <td>${escapeHtml(r.student_name)}</td>
          <td>
            <span class="fw-semibold">${escapeHtml(r.subject_code)}</span>
            <div class="small text-muted">${escapeHtml(r.subject_name)}</div>
          </td>
          <td>${escapeHtml(r.exam_name)}</td>
          <td class="tabular-nums fw-semibold">${escapeHtml(r.marks_obtained)} / ${escapeHtml(r.max_marks)}</td>
          <td class="tabular-nums">${escapeHtml(r.percentage)}%</td>
          <td><span class="status-badge ${r.result_status === 'PASS' ? 'status-pass' : 'status-fail'}">${escapeHtml(r.result_status)}</span></td>
          <td class="text-end no-print">
            <button type="button" class="btn btn-sm btn-outline-primary edit-res-btn"
              data-id="${r.result_id}"
              data-label="${escapeHtml(r.student_name)} • ${escapeHtml(r.subject_code)} (Max ${escapeHtml(r.max_marks)})"
              data-marks="${escapeHtml(r.marks_obtained)}"
              data-max="${escapeHtml(r.max_marks)}"
              data-remarks="${escapeHtml(r.remarks || '')}">
              <i class="bi bi-pencil"></i> Edit
            </button>
          </td>
        </tr>
      `
        )
        .join('');
    }

    if (!consolidatedStudents || consolidatedStudents.length === 0) {
      consolidatedBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No consolidated student summaries available.</td></tr>';
    } else {
      consolidatedBody.innerHTML = consolidatedStudents
        .map(
          (st) => `
        <tr>
          <td class="fw-semibold tabular-nums">${escapeHtml(st.registration_number)}</td>
          <td>${escapeHtml(st.student_name)}</td>
          <td><span class="status-badge status-info">${escapeHtml(st.department_code)}</span></td>
          <td class="tabular-nums">${escapeHtml(st.subjects_count)}</td>
          <td class="tabular-nums fw-semibold">${escapeHtml(st.total_obtained)} / ${escapeHtml(st.total_max)}</td>
          <td class="tabular-nums">${escapeHtml(st.overall_percentage)}%</td>
          <td><span class="status-badge ${st.overall_status === 'PASS' ? 'status-pass' : 'status-fail'}">${escapeHtml(st.overall_status)}</span></td>
        </tr>
      `
        )
        .join('');
    }
  }

  resultsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-res-btn');
    if (!btn) return;
    document.getElementById('editResultId').value = btn.dataset.id;
    document.getElementById('editResultLabel').textContent = btn.dataset.label;
    const marksInput = document.getElementById('editMarksInput');
    marksInput.value = btn.dataset.marks;
    marksInput.max = btn.dataset.max;
    document.getElementById('editResultRemarks').value = btn.dataset.remarks;
    editModal.show();
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editResultId').value;
    try {
      await apiRequest(`/api/results/${id}`, {
        method: 'PUT',
        body: {
          marks_obtained: Number(document.getElementById('editMarksInput').value),
          remarks: document.getElementById('editResultRemarks').value
        }
      });
      showToast('Marks updated successfully.', 'success');
      editModal.hide();
      await loadReport();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  document.getElementById('filterResultsBtn').addEventListener('click', loadReport);
  examFilter.addEventListener('change', loadReport);
  deptFilter.addEventListener('change', loadReport);
  semFilter.addEventListener('change', loadReport);
  statusFilter.addEventListener('change', loadReport);

  document.getElementById('exportResultsCsvBtn').addEventListener('click', () => {
    if (currentRecords.length === 0) {
      showToast('No results to export.', 'danger');
      return;
    }
    exportRowsToCSV(
      'examination-results-report.csv',
      ['Reg No', 'Student Name', 'Department', 'Exam', 'Subject Code', 'Subject Name', 'Marks Obtained', 'Max Marks', 'Percentage', 'Status'],
      currentRecords.map((r) => [
        r.registration_number,
        r.student_name,
        r.department_code,
        r.exam_name,
        r.subject_code,
        r.subject_name,
        r.marks_obtained,
        r.max_marks,
        r.percentage,
        r.result_status
      ])
    );
  });

  try {
    await loadFilters();
    await loadReport();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

