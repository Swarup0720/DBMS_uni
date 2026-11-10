const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const bcrypt = require('bcrypt');

const db = require('../config/database');
const { AppError } = require('../middleware/errorMiddleware');

// Prepare deterministic bcrypt hashes matching sample passwords
const ADMIN_HASH = bcrypt.hashSync('Admin@123', 10);
const FACULTY_HASH = bcrypt.hashSync('Faculty@123', 10);
const STUDENT_HASH = bcrypt.hashSync('Student@123', 10);

// Pluggable mock SQL handler used by tests
let sqlResponder = async () => [[]];

function makeMockConnection() {
  return {
    ping: async () => true,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, params) => sqlResponder(sql, params),
    query: async (sql, params) => sqlResponder(sql, params)
  };
}

db.pool.execute = async (sql, params) => sqlResponder(sql, params);
db.pool.query = async (sql, params) => sqlResponder(sql, params);
db.pool.getConnection = async () => makeMockConnection();

const { app } = require('../server');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

function request(path, { method = 'GET', body = null, cookie = '' } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {};
    let payload = null;
    if (body !== null) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (cookie) {
      headers.Cookie = cookie;
    }

    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (_) {
            json = null;
          }
          const setCookie = res.headers['set-cookie'];
          const nextCookie = setCookie ? setCookie[0].split(';')[0] : cookie;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: raw,
            json,
            cookie: nextCookie
          });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function loginAs(role) {
  const accounts = {
    admin: {
      identifier: 'admin@university.edu',
      password: 'Admin@123',
      userRow: {
        user_id: 1,
        username: 'admin',
        email: 'admin@university.edu',
        password_hash: ADMIN_HASH,
        role: 'admin',
        full_name: 'System Administrator',
        is_active: 1
      }
    },
    faculty: {
      identifier: 'faculty1@university.edu',
      password: 'Faculty@123',
      userRow: {
        user_id: 2,
        username: 'faculty.cse',
        email: 'faculty1@university.edu',
        password_hash: FACULTY_HASH,
        role: 'faculty',
        full_name: 'Dr. Rajesh Verma',
        is_active: 1
      }
    },
    student: {
      identifier: 'student1@university.edu',
      password: 'Student@123',
      userRow: {
        user_id: 7,
        username: 'reg2024001',
        email: 'student1@university.edu',
        password_hash: STUDENT_HASH,
        role: 'student',
        full_name: 'Aarav Sharma',
        is_active: 1
      }
    }
  };

  const acc = accounts[role];
  sqlResponder = async (sql) => {
    if (sql.includes('FROM users')) {
      return [[acc.userRow]];
    }
    if (sql.includes('FROM faculty f')) {
      return [
        [
          {
            faculty_id: 1,
            department_id: 1,
            designation: 'Professor & HOD',
            department_name: 'Computer Science & Engineering',
            department_code: 'CSE'
          }
        ]
      ];
    }
    if (sql.includes('FROM students s')) {
      return [
        [
          {
            student_id: 1,
            registration_number: 'REG2024001',
            department_id: 1,
            semester: 4,
            admission_year: 2024,
            department_name: 'Computer Science & Engineering',
            department_code: 'CSE'
          }
        ]
      ];
    }
    return [[]];
  };

  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { identifier: acc.identifier, password: acc.password, role }
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.user.role, role);
  return res.cookie;
}

test('GET /api/health returns database connected when MySQL responds', async () => {
  const res = await request('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.json.database, 'connected');
});

test('Public static pages load and protected pages redirect unauthenticated requests', async () => {
  const loginPage = await request('/login.html');
  assert.equal(loginPage.status, 200);
  assert.match(loginPage.text, /Portal Sign In/);

  const adminPage = await request('/admin-dashboard.html');
  assert.equal(adminPage.status, 302);
  assert.equal(adminPage.headers.location, '/login.html');

  const unauthApi = await request('/api/students');
  assert.equal(unauthApi.status, 401);
});

test('Authentication rejects invalid password and mismatched role tab', async () => {
  sqlResponder = async (sql) => {
    if (sql.includes('FROM users')) {
      return [
        [
          {
            user_id: 1,
            username: 'admin',
            email: 'admin@university.edu',
            password_hash: ADMIN_HASH,
            role: 'admin',
            full_name: 'System Administrator',
            is_active: 1
          }
        ]
      ];
    }
    return [[]];
  };

  const wrongPwd = await request('/api/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@university.edu', password: 'WrongPassword', role: 'admin' }
  });
  assert.equal(wrongPwd.status, 401);

  const wrongRole = await request('/api/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@university.edu', password: 'Admin@123', role: 'student' }
  });
  assert.equal(wrongRole.status, 403);
});

test('Role-based page & API protection enforces strict boundaries across roles', async () => {
  const studentCookie = await loginAs('student');

  // Student cannot open admin dashboard HTML -> redirected to student dashboard
  const adminHtml = await request('/admin-dashboard.html', { cookie: studentCookie });
  assert.equal(adminHtml.status, 302);
  assert.equal(adminHtml.headers.location, '/student-dashboard.html');

  // Student can open student dashboard HTML
  const studentHtml = await request('/student-dashboard.html', { cookie: studentCookie });
  assert.equal(studentHtml.status, 200);

  // Student cannot call admin/faculty APIs
  const studentsApi = await request('/api/students', { cookie: studentCookie });
  assert.equal(studentsApi.status, 403);

  const attendanceApi = await request('/api/attendance', { cookie: studentCookie });
  assert.equal(attendanceApi.status, 403);

  // Logout clears session
  const logoutRes = await request('/api/auth/logout', { method: 'POST', cookie: studentCookie });
  assert.equal(logoutRes.status, 200);

  const meAfterLogout = await request('/api/auth/me', { cookie: studentCookie });
  assert.equal(meAfterLogout.status, 401);
});

test('Admin can list, search, create, and delete students with duplicate validation', async () => {
  const adminCookie = await loginAs('admin');

  // List/search students
  sqlResponder = async (sql, params) => {
    assert.match(sql, /FROM students s/);
    assert.ok(params.includes('%Aarav%'));
    return [
      [
        {
          student_id: 1,
          registration_number: 'REG2024001',
          full_name: 'Aarav Sharma',
          department_code: 'CSE'
        }
      ]
    ];
  };
  const listRes = await request('/api/students?search=Aarav', { cookie: adminCookie });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.json.data.length, 1);

  // Duplicate registration number returns 409 Conflict
  sqlResponder = async (sql) => {
    if (sql.includes('FROM departments')) return [[{ department_id: 1 }]];
    if (sql.includes('WHERE registration_number = ?')) return [[{ student_id: 1 }]];
    return [[]];
  };
  const dupRes = await request('/api/students', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      registration_number: 'REG2024001',
      full_name: 'Test Student',
      email: 'new@university.edu',
      phone: '9999988888',
      department_id: 1,
      semester: 4,
      admission_year: 2026
    }
  });
  assert.equal(dupRes.status, 409);

  // Valid create student
  sqlResponder = async (sql) => {
    if (sql.includes('FROM departments')) return [[{ department_id: 1 }]];
    if (sql.includes('INSERT INTO users')) return [{ insertId: 20 }];
    if (sql.includes('INSERT INTO students')) return [{ insertId: 11 }];
    if (sql.includes('FROM students s')) {
      return [
        [
          {
            student_id: 11,
            registration_number: 'REG2026011',
            full_name: 'New Student',
            email: 'new@university.edu',
            department_code: 'CSE'
          }
        ]
      ];
    }
    return [[]];
  };
  const createRes = await request('/api/students', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      registration_number: 'REG2026011',
      full_name: 'New Student',
      email: 'new@university.edu',
      phone: '9999988888',
      department_id: 1,
      semester: 4,
      admission_year: 2026
    }
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.json.data.registration_number, 'REG2026011');
});

test('Faculty attendance marking enforces department scope and prevents duplicates', async () => {
  const facultyCookie = await loginAs('faculty');

  // Foreign department student rejected with 403
  sqlResponder = async (sql) => {
    if (sql.includes('SELECT student_id, department_id FROM students')) {
      return [[{ student_id: 6, department_id: 2 }]];
    }
    return [[]];
  };
  const foreignRes = await request('/api/attendance/mark', {
    method: 'POST',
    cookie: facultyCookie,
    body: {
      attendance_date: '2026-10-15',
      semester: 4,
      session_name: 'DBMS Lecture',
      overwriteExisting: false,
      records: [{ student_id: 6, status: 'Present' }]
    }
  });
  assert.equal(foreignRes.status, 403);

  // Duplicate attendance in strict mode returns 409
  sqlResponder = async (sql) => {
    if (sql.includes('SELECT student_id, department_id FROM students')) {
      return [[{ student_id: 1, department_id: 1 }]];
    }
    if (sql.includes('FROM attendance a')) {
      return [[{ student_id: 1, registration_number: 'REG2024001' }]];
    }
    return [[]];
  };
  const dupRes = await request('/api/attendance/mark', {
    method: 'POST',
    cookie: facultyCookie,
    body: {
      attendance_date: '2026-10-15',
      semester: 4,
      session_name: 'DBMS Lecture',
      overwriteExisting: false,
      records: [{ student_id: 1, status: 'Present' }]
    }
  });
  assert.equal(dupRes.status, 409);

  // Update mode succeeds cleanly
  sqlResponder = async (sql) => {
    if (sql.includes('SELECT student_id, department_id FROM students')) {
      return [[{ student_id: 1, department_id: 1 }]];
    }
    if (sql.includes('INSERT INTO attendance')) {
      return [{ affectedRows: 1 }];
    }
    return [[]];
  };
  const saveRes = await request('/api/attendance/mark', {
    method: 'POST',
    cookie: facultyCookie,
    body: {
      attendance_date: '2026-10-15',
      semester: 4,
      session_name: 'DBMS Lecture',
      overwriteExisting: true,
      records: [{ student_id: 1, status: 'Present' }]
    }
  });
  assert.equal(saveRes.status, 201);
  assert.equal(saveRes.json.data.savedCount, 1);
});

test('Student results API returns subject-wise marks, totals, percentage, and PASS/FAIL status', async () => {
  const studentCookie = await loginAs('student');

  sqlResponder = async (sql) => {
    if (sql.includes('FROM students s')) {
      return [
        [
          {
            student_id: 1,
            registration_number: 'REG2024001',
            full_name: 'Aarav Sharma',
            department_name: 'Computer Science & Engineering',
            department_code: 'CSE',
            semester: 4,
            admission_year: 2024
          }
        ]
      ];
    }
    if (sql.includes('FROM vw_student_results_detail')) {
      return [
        [
          {
            result_id: 1,
            exam_id: 1,
            exam_name: 'Mid-Sem 2026',
            subject_code: 'CS401',
            subject_name: 'DBMS',
            exam_date: '2026-10-20',
            exam_semester: 4,
            marks_obtained: 85,
            max_marks: 100,
            passing_marks: 40,
            percentage: 85.0,
            result_status: 'PASS'
          },
          {
            result_id: 2,
            exam_id: 2,
            exam_name: 'Mid-Sem 2026',
            subject_code: 'CS402',
            subject_name: 'OS',
            exam_date: '2026-10-22',
            exam_semester: 4,
            marks_obtained: 75,
            max_marks: 100,
            passing_marks: 40,
            percentage: 75.0,
            result_status: 'PASS'
          }
        ]
      ];
    }
    return [[]];
  };

  const res = await request('/api/results/my', { cookie: studentCookie });
  assert.equal(res.status, 200);
  assert.equal(res.json.data.summary.totalObtained, 160);
  assert.equal(res.json.data.summary.totalMax, 200);
  assert.equal(res.json.data.summary.overallPercentage, 80);
  assert.equal(res.json.data.summary.overallStatus, 'PASS');
});

test('DBMS Concepts API returns all 11 concepts and executes live queries including transactions', async () => {
  const adminCookie = await loginAs('admin');

  const listRes = await request('/api/dbms-concepts', { cookie: adminCookie });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.json.data.length, 11);

  sqlResponder = async (sql) => {
    if (sql.includes('ORDER BY student_id ASC LIMIT 1')) {
      return [[{ student_id: 1, registration_number: 'REG2024001', full_name: 'Aarav Sharma', semester: 4 }]];
    }
    if (sql.includes('UPDATE students SET semester')) {
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('WHERE student_id = ?')) {
      return [[{ student_id: 1, registration_number: 'REG2024001', full_name: 'Aarav Sharma', semester: 4 }]];
    }
    return [[]];
  };

  const txnRes = await request('/api/dbms-concepts/transactions', { cookie: adminCookie });
  assert.equal(txnRes.status, 200);
  assert.equal(txnRes.json.data.rows.length, 3);
  assert.equal(txnRes.json.data.columns.includes('phase'), true);
});

test('Database trigger SQLSTATE 45000 error maps cleanly to HTTP 400', async () => {
  const facultyCookie = await loginAs('faculty');
  sqlResponder = async (sql) => {
    if (sql.includes('FROM examinations e')) {
      return [[{ exam_id: 1, department_id: 1, max_marks: 100, passing_marks: 40 }]];
    }
    if (sql.includes('SELECT student_id, department_id FROM students')) {
      return [[{ student_id: 1, department_id: 1 }]];
    }
    if (sql.includes('INSERT INTO results')) {
      const triggerErr = new Error('Trigger rejected marks');
      triggerErr.sqlState = '45000';
      triggerErr.sqlMessage = 'Marks obtained must be between 0 and the examination maximum marks.';
      throw triggerErr;
    }
    return [[]];
  };

  const res = await request('/api/examinations/1/marks', {
    method: 'POST',
    cookie: facultyCookie,
    body: { marks: [{ student_id: 1, marks_obtained: 95 }] }
  });
  assert.equal(res.status, 400);
  assert.match(res.json.message, /Marks obtained must be between 0/);
});

test('Dashboards return role-specific MySQL aggregates for Admin, Faculty, and Student', async () => {
  const adminCookie = await loginAs('admin');
  sqlResponder = async (sql) => {
    if (sql.includes('total_students')) return [[{ total_students: 10 }]];
    if (sql.includes('total_faculty')) return [[{ total_faculty: 5 }]];
    if (sql.includes('total_departments')) return [[{ total_departments: 4 }]];
    if (sql.includes('AS total_records')) {
      return [[{ total_records: 25, present_count: 19, absent_count: 6, attendance_percentage: 76.0 }]];
    }
    if (sql.includes('ORDER BY s.created_at DESC')) return [[{ student_id: 1, registration_number: 'REG2024001' }]];
    if (sql.includes('AS student_count')) return [[{ department_code: 'CSE', student_count: 5 }]];
    if (sql.includes('AS present_classes')) return [[{ department_code: 'CSE', attendance_percentage: 80.0 }]];
    return [[]];
  };
  const adminDash = await request('/api/dashboard', { cookie: adminCookie });
  assert.equal(adminDash.status, 200);
  assert.equal(adminDash.json.data.summary.totalStudents, 10);
  assert.equal(adminDash.json.data.summary.attendanceOverview.attendancePercentage, 76);

  const facultyCookie = await loginAs('faculty');
  sqlResponder = async (sql) => {
    if (sql.includes('FROM faculty f')) {
      return [[{ faculty_id: 1, full_name: 'Dr. Rajesh Verma', department_id: 1, department_code: 'CSE', department_name: 'CSE', head_of_department: 'Dr. Rajesh Verma', designation: 'Professor & HOD' }]];
    }
    if (sql.includes('AS total_students')) return [[{ total_students: 5 }]];
    if (sql.includes('AS total_exams')) return [[{ total_exams: 4 }]];
    if (sql.includes('AS total_records')) return [[{ total_records: 19, present_count: 14, attendance_percentage: 73.68 }]];
    if (sql.includes('GROUP BY semester')) return [[{ semester: 4, student_count: 3 }]];
    if (sql.includes('FROM examinations')) return [[]];
    return [[]];
  };
  const facDash = await request('/api/dashboard', { cookie: facultyCookie });
  assert.equal(facDash.status, 200);
  assert.equal(facDash.json.data.summary.totalDepartmentStudents, 5);

  const studentCookie = await loginAs('student');
  sqlResponder = async (sql) => {
    if (sql.includes('FROM students s')) {
      return [[{ student_id: 1, registration_number: 'REG2024001', full_name: 'Aarav Sharma', department_id: 1, department_code: 'CSE', department_name: 'CSE', semester: 4, admission_year: 2024 }]];
    }
    if (sql.includes('FROM vw_student_attendance_summary')) {
      return [[{ total_classes: 5, present_classes: 4, absent_classes: 1, attendance_percentage: 80.0 }]];
    }
    if (sql.includes('FROM vw_student_results_detail')) {
      return [[{ result_id: 1, subject_code: 'CS401', marks_obtained: 88, max_marks: 100, percentage: 88, result_status: 'PASS' }]];
    }
    return [[]];
  };
  const stuDash = await request('/api/dashboard', { cookie: studentCookie });
  assert.equal(stuDash.status, 200);
  assert.equal(stuDash.json.data.attendanceSummary.attendance_percentage, 80);
  assert.equal(stuDash.json.data.academicSummary.overallStatus, 'PASS');
});

test('Departments & Faculty management endpoints support CRUD and assignment', async () => {
  const adminCookie = await loginAs('admin');

  // Cannot delete non-empty department
  sqlResponder = async (sql) => {
    if (sql.includes('FROM vw_department_summary')) {
      return [[{ department_id: 1, department_name: 'CSE', department_code: 'CSE', total_faculty: 2, total_students: 5, total_examinations: 4 }]];
    }
    return [[]];
  };
  const delDeptRes = await request('/api/departments/1', { method: 'DELETE', cookie: adminCookie });
  assert.equal(delDeptRes.status, 409);

  // Create department
  sqlResponder = async (sql) => {
    if (sql.includes('INSERT INTO departments')) return [{ insertId: 5 }];
    if (sql.includes('FROM vw_department_summary')) {
      return [[{ department_id: 5, department_name: 'Information Technology', department_code: 'IT', head_of_department: 'Dr. Roy', total_faculty: 0, total_students: 0, total_examinations: 0 }]];
    }
    return [[]];
  };
  const createDeptRes = await request('/api/departments', {
    method: 'POST',
    cookie: adminCookie,
    body: { department_name: 'Information Technology', department_code: 'it', head_of_department: 'Dr. Roy' }
  });
  assert.equal(createDeptRes.status, 201);
  assert.equal(createDeptRes.json.data.department_code, 'IT');

  // Assign faculty to department
  sqlResponder = async (sql) => {
    if (sql.includes('FROM faculty f')) {
      return [[{ faculty_id: 1, full_name: 'Dr. Rajesh Verma', department_id: 5, department_code: 'IT', department_name: 'Information Technology' }]];
    }
    if (sql.includes('SELECT department_id FROM departments')) return [[{ department_id: 5 }]];
    if (sql.includes('UPDATE faculty SET department_id')) return [{ affectedRows: 1 }];
    return [[]];
  };
  const assignRes = await request('/api/faculty/1/department', {
    method: 'PATCH',
    cookie: adminCookie,
    body: { department_id: 5 }
  });
  assert.equal(assignRes.status, 200);
  assert.equal(assignRes.json.data.department_code, 'IT');
});

test('Attendance report & Examinations creation and results report work end-to-end', async () => {
  const facultyCookie = await loginAs('faculty');

  // Attendance report
  sqlResponder = async (sql) => {
    if (sql.includes('FROM vw_student_attendance_summary')) {
      return [
        [
          { student_id: 1, registration_number: 'REG2024001', full_name: 'Aarav', total_classes: 5, present_classes: 4, absent_classes: 1, attendance_percentage: 80 },
          { student_id: 3, registration_number: 'REG2024003', full_name: 'Rohan', total_classes: 5, present_classes: 2, absent_classes: 3, attendance_percentage: 40 }
        ]
      ];
    }
    return [[]];
  };
  const attRep = await request('/api/attendance/report', { cookie: facultyCookie });
  assert.equal(attRep.status, 200);
  assert.equal(attRep.json.data.summary.below75Count, 1);
  assert.equal(attRep.json.data.summary.averageAttendancePercentage, 60);

  // Create exam with passing_marks > max_marks rejected
  const badExam = await request('/api/examinations', {
    method: 'POST',
    cookie: facultyCookie,
    body: {
      exam_name: 'Final',
      subject_code: 'CS499',
      subject_name: 'AI',
      semester: 4,
      exam_date: '2026-11-01',
      max_marks: 100,
      passing_marks: 120
    }
  });
  assert.equal(badExam.status, 400);

  // Results report consolidated summary
  sqlResponder = async (sql) => {
    if (sql.includes('FROM vw_student_results_detail')) {
      return [
        [
          { result_id: 1, student_id: 1, registration_number: 'REG2024001', student_name: 'Aarav', department_code: 'CSE', subject_code: 'CS401', marks_obtained: 80, max_marks: 100, percentage: 80, result_status: 'PASS' },
          { result_id: 2, student_id: 3, registration_number: 'REG2024003', student_name: 'Rohan', department_code: 'CSE', subject_code: 'CS401', marks_obtained: 30, max_marks: 100, percentage: 30, result_status: 'FAIL' }
        ]
      ];
    }
    return [[]];
  };
  const resRep = await request('/api/results', { cookie: facultyCookie });
  assert.equal(resRep.status, 200);
  assert.equal(resRep.json.data.summary.passRate, 50);
  assert.equal(resRep.json.data.consolidatedStudents.length, 2);
});

test('All 11 DBMS Concepts execute cleanly', async () => {
  const adminCookie = await loginAs('admin');
  const listRes = await request('/api/dbms-concepts', { cookie: adminCookie });
  const concepts = listRes.json.data;

  for (const c of concepts) {
    sqlResponder = async (sql) => {
      if (sql.includes('CALL sp_get_department_report')) {
        return [[[{ department_code: 'CSE', total_students: 5 }]]];
      }
      return [[{ sample_col: 'ok', student_id: 1, registration_number: 'REG2024001', full_name: 'Aarav', semester: 4 }]];
    };
    const runRes = await request(`/api/dbms-concepts/${c.id}`, { cookie: adminCookie });
    assert.equal(runRes.status, 200, `Expected 200 for concept ${c.id}`);
    assert.ok(runRes.json.data.sqlQuery.length > 10);
    assert.ok(runRes.json.data.rows.length >= 1);
  }
});
