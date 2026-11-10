document.addEventListener('DOMContentLoaded', async () => {
  const user = await initErpLayout({ pageTitle: 'Attendance Management', allowedRoles: ['admin', 'faculty'] });
  if (!user) return;

  const markDeptSelect = document.getElementById('markDeptSelect');
  const markSemSelect = document.getElementById('markSemSelect');
  const markDateInput = document.getElementById('markDateInput');
  const markSessionInput = document.getElementById('markSessionInput');
  const loadRosterBtn = document.getElementById('loadRosterBtn');
  const markAllPresentBtn = document.getElementById('markAllPresentBtn');
  const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');
  const updateAttendanceBtn = document.getElementById('updateAttendanceBtn');
  const rosterTableBody = document.getElementById('rosterTableBody');
  const rosterHint = document.getElementById('rosterHint');

  const recDeptSelect = document.getElementById('recDeptSelect');
  const recSemSelect = document.getElementById('recSemSelect');
  const recDateInput = document.getElementById('recDateInput');
  const recSearchInput = document.getElementById('recSearchInput');
  const recordsTableBody = document.getElementById('recordsTableBody');

  const repDeptSelect = document.getElementById('repDeptSelect');
  const repSemSelect = document.getElementById('repSemSelect');
  const repSearchInput = document.getElementById('repSearchInput');
  const reportTableBody = document.getElementById('reportTableBody');

  const editModal = new bootstrap.Modal(document.getElementById('editAttendanceModal'));
  const editForm = document.getElementById('editAttendanceForm');

  markDateInput.value = todayDateInput();
  markDateInput.max = todayDateInput();

  let currentRoster = [];
  let currentReportRecords = [];

  async function initDepartments() {
    const res = await apiRequest('/api/departments');
    const depts = res.data || [];

    if (user.role === 'faculty') {
      const optHtml = `<option value="${user.department_id}">${escapeHtml(user.department_code)} - ${escapeHtml(user.department_name)}</option>`;
      markDeptSelect.innerHTML = optHtml;
      recDeptSelect.innerHTML = optHtml;
      repDeptSelect.innerHTML = optHtml;
      markDeptSelect.disabled = true;
      recDeptSelect.disabled = true;
      repDeptSelect.disabled = true;
    } else {
      const allOpt = '<option value="">All Departments</option>';
      recDeptSelect.innerHTML = allOpt;
      repDeptSelect.innerHTML = allOpt;
      markDeptSelect.innerHTML = '';

      for (const d of depts) {
        const label = `${d.department_code} - ${d.department_name}`;
        const opt = `<option value="${d.department_id}">${escapeHtml(label)}</option>`;
        markDeptSelect.insertAdjacentHTML('beforeend', opt);
        recDeptSelect.insertAdjacentHTML('beforeend', opt);
        repDeptSelect.insertAdjacentHTML('beforeend', opt);
      }
    }
  }

  async function loadRoster() {
    const deptId = markDeptSelect.value;
    const sem = markSemSelect.value;
    const date = markDateInput.value;
    const session = markSessionInput.value.trim() || 'Regular Class';

    if (!deptId || !date) {
      showToast('Please select a department and date.', 'danger');
      return;
    }

    const params = new URLSearchParams({
      department_id: deptId,
      semester: sem,
      attendance_date: date,
      session_name: session
    });

    const res = await apiRequest(`/api/attendance/session?${params.toString()}`);
    currentRoster = res.data || [];

    if (currentRoster.length === 0) {
      rosterTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No students enrolled in this department and semester.</td></tr>';
      markAllPresentBtn.disabled = true;
      saveAttendanceBtn.disabled = true;
      updateAttendanceBtn.classList.add('d-none');
      rosterHint.textContent = '0 students found.';
      return;
    }

    const anyAlreadyMarked = currentRoster.some((r) => Number(r.already_marked) === 1);
    rosterHint.textContent = anyAlreadyMarked
      ? `Attendance already exists for ${formatDate(date)} (${session}). Review and click "Update Existing" to modify.`
      : `Marking new attendance for ${currentRoster.length} student(s) on ${formatDate(date)} (${session}).`;

    markAllPresentBtn.disabled = false;
    saveAttendanceBtn.disabled = anyAlreadyMarked;
    updateAttendanceBtn.classList.toggle('d-none', !anyAlreadyMarked);

    rosterTableBody.innerHTML = currentRoster
      .map((st, idx) => {
        const statusVal = st.status || 'Present';
        const stateBadge = Number(st.already_marked)
          ? `<span class="status-badge ${st.status === 'Present' ? 'status-present' : 'status-absent'}">Marked: ${escapeHtml(st.status)}</span>`
          : '<span class="status-badge status-info">Not Marked</span>';

        return `
        <tr data-student-id="${st.student_id}">
          <td class="fw-semibold tabular-nums">${escapeHtml(st.registration_number)}</td>
          <td>${escapeHtml(st.full_name)}</td>
          <td>${stateBadge}</td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              <input type="radio" class="btn-check" name="status_${st.student_id}" id="pres_${idx}" value="Present" ${statusVal === 'Present' ? 'checked' : ''} />
              <label class="btn btn-outline-success" for="pres_${idx}">Present</label>
              <input type="radio" class="btn-check" name="status_${st.student_id}" id="abs_${idx}" value="Absent" ${statusVal === 'Absent' ? 'checked' : ''} />
              <label class="btn btn-outline-danger" for="abs_${idx}">Absent</label>
            </div>
          </td>
          <td>
            <input type="text" class="form-control form-control-sm roster-remark" value="${escapeHtml(st.remarks || '')}" placeholder="Optional note" maxlength="200" />
          </td>
        </tr>
      `;
      })
      .join('');
  }

  async function submitRoster(overwriteExisting) {
    if (currentRoster.length === 0) return;

    const rows = Array.from(rosterTableBody.querySelectorAll('tr[data-student-id]'));
    const records = rows.map((tr) => {
      const studentId = Number(tr.dataset.studentId);
      const checked = tr.querySelector(`input[name="status_${studentId}"]:checked`);
      const remarks = tr.querySelector('.roster-remark').value.trim();
      return {
        student_id: studentId,
        status: checked ? checked.value : 'Present',
        remarks
      };
    });

    try {
      const res = await apiRequest('/api/attendance/mark', {
        method: 'POST',
        body: {
          attendance_date: markDateInput.value,
          semester: Number(markSemSelect.value),
          session_name: markSessionInput.value.trim() || 'Regular Class',
          overwriteExisting,
          records
        }
      });
      showToast(res.message, 'success');
      await loadRoster();
      await loadRecords();
      await loadReport();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  async function loadRecords() {
    const params = new URLSearchParams();
    if (recDeptSelect.value) params.set('department_id', recDeptSelect.value);
    if (recSemSelect.value) params.set('semester', recSemSelect.value);
    if (recDateInput.value) params.set('attendance_date', recDateInput.value);
    if (recSearchInput.value.trim()) params.set('search', recSearchInput.value.trim());

    const res = await apiRequest(`/api/attendance?${params.toString()}`);
    const records = res.data || [];

    if (records.length === 0) {
      recordsTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No attendance records found.</td></tr>';
      return;
    }

    recordsTableBody.innerHTML = records
      .map(
        (r) => `
      <tr>
        <td class="tabular-nums">${escapeHtml(formatDate(r.attendance_date))}</td>
        <td>${escapeHtml(r.session_name)}</td>
        <td class="fw-semibold tabular-nums">${escapeHtml(r.registration_number)}</td>
        <td>${escapeHtml(r.student_name)}</td>
        <td>${escapeHtml(r.department_code)} &bull; Sem ${escapeHtml(r.semester)}</td>
        <td><span class="status-badge ${r.status === 'Present' ? 'status-present' : 'status-absent'}">${escapeHtml(r.status)}</span></td>
        <td class="small text-muted">${escapeHtml(r.marked_by_name || 'Admin')}</td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-primary edit-att-btn"
            data-id="${r.attendance_id}"
            data-student="${escapeHtml(r.student_name)} (${escapeHtml(formatDate(r.attendance_date))})"
            data-status="${escapeHtml(r.status)}"
            data-remarks="${escapeHtml(r.remarks || '')}">
            <i class="bi bi-pencil"></i> Edit
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  async function loadReport() {
    const params = new URLSearchParams();
    if (repDeptSelect.value) params.set('department_id', repDeptSelect.value);
    if (repSemSelect.value) params.set('semester', repSemSelect.value);
    if (repSearchInput.value.trim()) params.set('search', repSearchInput.value.trim());

    const res = await apiRequest(`/api/attendance/report?${params.toString()}`);
    const { records, summary } = res.data;
    currentReportRecords = records || [];

    document.getElementById('repTotalStudents').textContent = summary.totalStudents;
    document.getElementById('repAvgAttendance').textContent = `${summary.averageAttendancePercentage}%`;
    document.getElementById('repBelow75').textContent = summary.below75Count;

    if (currentReportRecords.length === 0) {
      reportTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No student attendance data found.</td></tr>';
      return;
    }

    reportTableBody.innerHTML = currentReportRecords
      .map((r) => {
        const pct = Number(r.attendance_percentage || 0);
        const badgeClass = Number(r.total_classes) === 0 ? 'status-info' : pct >= 75 ? 'status-present' : 'status-absent';
        return `
        <tr>
          <td class="fw-semibold tabular-nums">${escapeHtml(r.registration_number)}</td>
          <td>${escapeHtml(r.full_name)}</td>
          <td>${escapeHtml(r.department_code)}</td>
          <td class="tabular-nums">Sem ${escapeHtml(r.semester)}</td>
          <td class="tabular-nums">${escapeHtml(r.total_classes)}</td>
          <td class="tabular-nums text-success fw-semibold">${escapeHtml(r.present_classes)}</td>
          <td class="tabular-nums text-danger">${escapeHtml(r.absent_classes)}</td>
          <td><span class="status-badge ${badgeClass} tabular-nums">${pct}%</span></td>
        </tr>
      `;
      })
      .join('');
  }

  loadRosterBtn.addEventListener('click', loadRoster);
  markAllPresentBtn.addEventListener('click', () => {
    rosterTableBody.querySelectorAll('input[type="radio"][value="Present"]').forEach((radio) => {
      radio.checked = true;
    });
  });
  saveAttendanceBtn.addEventListener('click', () => submitRoster(false));
  updateAttendanceBtn.addEventListener('click', () => submitRoster(true));

  document.getElementById('filterRecordsBtn').addEventListener('click', loadRecords);
  document.getElementById('clearRecordsFilterBtn').addEventListener('click', () => {
    if (user.role !== 'faculty') recDeptSelect.value = '';
    recSemSelect.value = '';
    recDateInput.value = '';
    recSearchInput.value = '';
    loadRecords();
  });

  recordsTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-att-btn');
    if (!btn) return;
    document.getElementById('editAttId').value = btn.dataset.id;
    document.getElementById('editAttStudentLabel').textContent = btn.dataset.student;
    document.getElementById('editAttStatus').value = btn.dataset.status;
    document.getElementById('editAttRemarks').value = btn.dataset.remarks;
    editModal.show();
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editAttId').value;
    try {
      await apiRequest(`/api/attendance/${id}`, {
        method: 'PUT',
        body: {
          status: document.getElementById('editAttStatus').value,
          remarks: document.getElementById('editAttRemarks').value
        }
      });
      showToast('Attendance record updated.', 'success');
      editModal.hide();
      await loadRecords();
      await loadReport();
      if (currentRoster.length > 0 && markDeptSelect.value) {
        await loadRoster();
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  document.getElementById('generateReportBtn').addEventListener('click', loadReport);
  document.getElementById('exportAttendanceCsvBtn').addEventListener('click', () => {
    if (currentReportRecords.length === 0) {
      showToast('No report rows to export.', 'danger');
      return;
    }
    exportRowsToCSV(
      'attendance-report.csv',
      ['Registration Number', 'Full Name', 'Department', 'Semester', 'Conducted Classes', 'Present', 'Absent', 'Attendance %'],
      currentReportRecords.map((r) => [
        r.registration_number,
        r.full_name,
        r.department_code,
        r.semester,
        r.total_classes,
        r.present_classes,
        r.absent_classes,
        r.attendance_percentage
      ])
    );
  });

  try {
    await initDepartments();
    const tasks = [loadRecords(), loadReport()];
    if (markDeptSelect.value) {
      tasks.unshift(loadRoster());
    }
    await Promise.all(tasks);
  } catch (err) {
    showToast(err.message, 'danger');
  }
});
