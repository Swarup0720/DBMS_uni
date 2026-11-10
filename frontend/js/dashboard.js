document.addEventListener('DOMContentLoaded', async () => {
  const expectedRole = document.body.dataset.dashboardRole;
  const titleMap = {
    admin: 'Admin Dashboard',
    faculty: 'Faculty Dashboard',
    student: 'Student Dashboard'
  };

  const user = await initErpLayout({
    pageTitle: titleMap[expectedRole] || 'Dashboard',
    allowedRoles: [expectedRole]
  });
  if (!user) return;

  try {
    const response = await apiRequest('/api/dashboard');
    const data = response.data;

    if (expectedRole === 'admin') {
      renderAdminDashboard(data);
    } else if (expectedRole === 'faculty') {
      renderFacultyDashboard(data);
    } else if (expectedRole === 'student') {
      renderStudentDashboard(data);
    }
  } catch (err) {
    showToast(err.message || 'Failed to load dashboard data.', 'danger');
  }
});

function renderAdminDashboard(data) {
  const { summary, recentRegistrations, studentsByDepartment } = data;
  document.getElementById('kpiTotalStudents').textContent = summary.totalStudents;
  document.getElementById('kpiTotalFaculty').textContent = summary.totalFaculty;
  document.getElementById('kpiTotalDepartments').textContent = summary.totalDepartments;
  document.getElementById('kpiAttendancePct').textContent = `${summary.attendanceOverview.attendancePercentage}%`;
  document.getElementById('kpiAttendanceSub').textContent =
    `${summary.attendanceOverview.presentCount} Present / ${summary.attendanceOverview.totalRecords} Records`;

  const tbody = document.getElementById('recentRegistrationsBody');
  if (!recentRegistrations || recentRegistrations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No student records found.</td></tr>';
  } else {
    tbody.innerHTML = recentRegistrations
      .map(
        (st) => `
      <tr>
        <td class="fw-semibold tabular-nums">${escapeHtml(st.registration_number)}</td>
        <td>${escapeHtml(st.full_name)}</td>
        <td class="text-muted">${escapeHtml(st.email)}</td>
        <td><span class="status-badge status-info">${escapeHtml(st.department_code)}</span> ${escapeHtml(st.department_name)}</td>
        <td class="tabular-nums">Sem ${escapeHtml(st.semester)}</td>
        <td class="tabular-nums">${escapeHtml(st.admission_year)}</td>
      </tr>
    `
      )
      .join('');
  }

  if (typeof Chart !== 'undefined') {
    const deptCtx = document.getElementById('deptDistributionChart');
    if (deptCtx) {
      new Chart(deptCtx, {
        type: 'bar',
        data: {
          labels: studentsByDepartment.map((d) => `${d.department_code} (${d.department_name})`),
          datasets: [
            {
              label: 'Enrolled Students',
              data: studentsByDepartment.map((d) => Number(d.student_count)),
              backgroundColor: '#2563eb',
              borderRadius: 6,
              maxBarThickness: 48
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }

    const attCtx = document.getElementById('attendanceOverviewChart');
    if (attCtx) {
      new Chart(attCtx, {
        type: 'doughnut',
        data: {
          labels: ['Present', 'Absent'],
          datasets: [
            {
              data: [summary.attendanceOverview.presentCount, summary.attendanceOverview.absentCount],
              backgroundColor: ['#047857', '#dc2626'],
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '64%',
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }
  }
}

function renderFacultyDashboard(data) {
  const { faculty, summary, studentsBySemester, recentExaminations } = data;
  document.getElementById('facultyDeptName').textContent = `${faculty.department_name} (${faculty.department_code})`;
  document.getElementById('facultyProfileMeta').textContent =
    `${faculty.full_name} • ${faculty.designation} • HOD: ${faculty.head_of_department}`;

  document.getElementById('facTotalStudents').textContent = summary.totalDepartmentStudents;
  document.getElementById('facAttendancePct').textContent = `${summary.departmentAttendance.attendancePercentage}%`;
  document.getElementById('facAttendanceSub').textContent =
    `${summary.departmentAttendance.presentCount} Present / ${summary.departmentAttendance.totalRecords} Records`;
  document.getElementById('facTotalExams').textContent = summary.totalDepartmentExams;

  const tbody = document.getElementById('facultyRecentExamsBody');
  if (!recentExaminations || recentExaminations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No examinations created yet.</td></tr>';
  } else {
    tbody.innerHTML = recentExaminations
      .map(
        (ex) => `
      <tr>
        <td><span class="fw-semibold">${escapeHtml(ex.subject_code)}</span><div class="small text-muted">${escapeHtml(ex.subject_name)}</div></td>
        <td>${escapeHtml(ex.exam_name)}</td>
        <td class="tabular-nums">Sem ${escapeHtml(ex.semester)}</td>
        <td class="tabular-nums">${escapeHtml(formatDate(ex.exam_date))}</td>
        <td class="tabular-nums">${escapeHtml(ex.max_marks)}</td>
      </tr>
    `
      )
      .join('');
  }

  if (typeof Chart !== 'undefined') {
    const semCtx = document.getElementById('facultySemesterChart');
    if (semCtx) {
      new Chart(semCtx, {
        type: 'bar',
        data: {
          labels: studentsBySemester.map((s) => `Semester ${s.semester}`),
          datasets: [
            {
              label: 'Students',
              data: studentsBySemester.map((s) => Number(s.student_count)),
              backgroundColor: '#0f294a',
              borderRadius: 6,
              maxBarThickness: 44
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }
  }
}

function renderStudentDashboard(data) {
  const { student, attendanceSummary, recentResults, academicSummary } = data;
  document.getElementById('stuRegBadge').textContent = student.registration_number;
  document.getElementById('stuFullName').textContent = student.full_name;
  document.getElementById('stuDept').textContent = `${student.department_name} (${student.department_code})`;
  document.getElementById('stuSemester').textContent = `Semester ${student.semester}`;
  document.getElementById('stuYear').textContent = student.admission_year;
  document.getElementById('stuEmail').textContent = student.email;
  document.getElementById('stuPhone').textContent = student.phone;

  const attPct = Number(attendanceSummary.attendance_percentage || 0);
  document.getElementById('stuAttendancePct').textContent = `${attPct}%`;
  const attBar = document.getElementById('stuAttendanceBar');
  attBar.style.width = `${Math.min(100, attPct)}%`;
  attBar.className = `progress-bar ${attPct >= 75 ? 'bg-success' : 'bg-warning'}`;
  document.getElementById('stuAttendanceSub').textContent =
    `${attendanceSummary.present_classes} Present out of ${attendanceSummary.total_classes} Classes`;

  document.getElementById('stuOverallPct').textContent = `${academicSummary.overallPercentage}%`;
  document.getElementById('stuTotalMarksSub').textContent =
    `Total: ${academicSummary.totalObtained} / ${academicSummary.totalMax} (${academicSummary.subjectsEvaluated} subjects)`;

  const statusBadge = document.getElementById('stuOverallStatusBadge');
  if (academicSummary.overallStatus === 'PASS') {
    statusBadge.innerHTML = '<span class="status-badge status-pass">PASS</span>';
  } else if (academicSummary.overallStatus === 'FAIL') {
    statusBadge.innerHTML = '<span class="status-badge status-fail">FAIL</span>';
  } else {
    statusBadge.innerHTML = '<span class="status-badge status-info">PENDING</span>';
  }

  const tbody = document.getElementById('studentRecentResultsBody');
  if (!recentResults || recentResults.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No examination results available yet.</td></tr>';
  } else {
    tbody.innerHTML = recentResults
      .map(
        (res) => `
      <tr>
        <td><span class="fw-semibold">${escapeHtml(res.subject_code)}</span><div class="small text-muted">${escapeHtml(res.subject_name)}</div></td>
        <td>${escapeHtml(res.exam_name)}</td>
        <td class="tabular-nums">${escapeHtml(res.marks_obtained)} / ${escapeHtml(res.max_marks)}</td>
        <td class="tabular-nums">${escapeHtml(res.percentage)}%</td>
        <td><span class="status-badge ${res.result_status === 'PASS' ? 'status-pass' : 'status-fail'}">${escapeHtml(res.result_status)}</span></td>
      </tr>
    `
      )
      .join('');
  }

  if (typeof Chart !== 'undefined') {
    const marksCtx = document.getElementById('studentMarksChart');
    if (marksCtx) {
      new Chart(marksCtx, {
        type: 'bar',
        data: {
          labels: recentResults.map((r) => r.subject_code),
          datasets: [
            {
              label: 'Marks (%)',
              data: recentResults.map((r) => Number(r.percentage)),
              backgroundColor: recentResults.map((r) => (r.result_status === 'PASS' ? '#2563eb' : '#dc2626')),
              borderRadius: 6,
              maxBarThickness: 44
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, max: 100 }
          }
        }
      });
    }
  }
}

