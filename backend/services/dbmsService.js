const { pool, query } = require('../config/database');
const { AppError } = require('../middleware/errorMiddleware');

const CONCEPTS = [
  {
    id: 'pk-fk',
    number: 1,
    title: 'Primary Key and Foreign Key',
    category: 'Constraints & Integrity',
    summary: 'Enforces entity uniqueness and referential integrity across all 7 tables.',
    explanation:
      'A Primary Key uniquely identifies every row in a table (e.g. student_id in students, department_id in departments), while Foreign Keys link child tables back to parent primary keys (e.g. students.department_id -> departments.department_id). Querying INFORMATION_SCHEMA displays the live constraint graph enforced by InnoDB.',
    sqlQuery: `SELECT
  tc.TABLE_NAME,
  tc.CONSTRAINT_NAME,
  tc.CONSTRAINT_TYPE,
  kcu.COLUMN_NAME,
  kcu.REFERENCED_TABLE_NAME,
  kcu.REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  ON tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
  AND tc.TABLE_NAME = kcu.TABLE_NAME
  AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
WHERE tc.TABLE_SCHEMA = DATABASE()
  AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'FOREIGN KEY')
ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_TYPE DESC, kcu.ORDINAL_POSITION;`
  },
  {
    id: 'inner-join',
    number: 2,
    title: 'INNER JOIN',
    category: 'Relational Joins',
    summary: 'Combines matching rows across students, departments, and users.',
    explanation:
      'INNER JOIN returns only rows that have matching key values in all joined tables. Here we combine students with departments (via department_id) and users (via user_id) to display complete student profile records without storing redundant department names inside students.',
    sqlQuery: `SELECT
  s.student_id,
  s.registration_number,
  s.full_name,
  d.department_code,
  d.department_name,
  s.semester,
  u.username,
  u.role
FROM students s
INNER JOIN departments d ON s.department_id = d.department_id
INNER JOIN users u ON s.user_id = u.user_id
ORDER BY s.student_id ASC;`
  },
  {
    id: 'left-join',
    number: 3,
    title: 'LEFT JOIN',
    category: 'Relational Joins',
    summary: 'Preserves all departments even when no students are enrolled yet.',
    explanation:
      'LEFT JOIN returns every row from the left table (departments) along with matching rows from the right tables (students, faculty), returning 0/NULL when no match exists. Notice how departments with zero enrolled students (like Civil Engineering initially) still appear in the output.',
    sqlQuery: `SELECT
  d.department_id,
  d.department_code,
  d.department_name,
  d.head_of_department,
  COUNT(DISTINCT s.student_id) AS student_count,
  COUNT(DISTINCT f.faculty_id) AS faculty_count
FROM departments d
LEFT JOIN students s ON d.department_id = s.department_id
LEFT JOIN faculty f ON d.department_id = f.department_id
GROUP BY d.department_id, d.department_code, d.department_name, d.head_of_department
ORDER BY student_count DESC, d.department_name ASC;`
  },
  {
    id: 'group-by-having',
    number: 4,
    title: 'GROUP BY and HAVING',
    category: 'Grouping & Filtering',
    summary: 'Groups rows by department and filters aggregated groups with HAVING.',
    explanation:
      'WHERE filters individual rows before grouping, whereas GROUP BY aggregates rows into summary groups and HAVING filters those groups based on aggregate conditions (such as departments having at least 2 students).',
    sqlQuery: `SELECT
  d.department_code,
  d.department_name,
  COUNT(s.student_id) AS total_students,
  ROUND(AVG(s.semester), 2) AS avg_semester
FROM departments d
INNER JOIN students s ON d.department_id = s.department_id
GROUP BY d.department_id, d.department_code, d.department_name
HAVING COUNT(s.student_id) >= 2
ORDER BY total_students DESC;`
  },
  {
    id: 'aggregates',
    number: 5,
    title: 'Aggregate Functions (COUNT, SUM, AVG, MIN, MAX)',
    category: 'Aggregation',
    summary: 'Computes live examination statistics across student results.',
    explanation:
      'SQL aggregate functions summarize sets of rows into single statistics per group: COUNT counts graded entries, SUM totals scored marks, AVG computes the mean, and MIN/MAX identify the lowest and highest marks per subject examination.',
    sqlQuery: `SELECT
  e.exam_id,
  e.subject_code,
  e.subject_name,
  COUNT(r.result_id) AS students_evaluated,
  SUM(r.marks_obtained) AS total_marks_scored,
  ROUND(AVG(r.marks_obtained), 2) AS average_marks,
  MIN(r.marks_obtained) AS lowest_marks,
  MAX(r.marks_obtained) AS highest_marks
FROM examinations e
INNER JOIN results r ON e.exam_id = r.exam_id
GROUP BY e.exam_id, e.subject_code, e.subject_name
ORDER BY e.exam_id ASC;`
  },
  {
    id: 'views',
    number: 6,
    title: 'Database Views',
    category: 'Programmability',
    summary: 'Virtual tables encapsulating joins and derived attendance percentage calculations.',
    explanation:
      'A Database View (vw_student_attendance_summary) stores a reusable SELECT query inside the schema catalog. Querying the view dynamically computes Total Present Classes, Total Conducted Classes, and Attendance Percentage from live underlying tables.',
    sqlQuery: `SELECT
  registration_number,
  full_name,
  department_code,
  semester,
  total_classes,
  present_classes,
  absent_classes,
  attendance_percentage
FROM vw_student_attendance_summary
ORDER BY attendance_percentage DESC, registration_number ASC;`
  },
  {
    id: 'stored-procedures',
    number: 7,
    title: 'Stored Procedures',
    category: 'Programmability',
    summary: 'Server-side parameterized routine sp_get_department_report executed via CALL.',
    explanation:
      'Stored Procedures encapsulate parameterized SQL logic directly inside MySQL for consistent reporting and reduced network overhead. Below we invoke CALL sp_get_department_report(NULL) to compute faculty, student, exam, and average score metrics per department.',
    sqlQuery: `CALL sp_get_department_report(NULL);`
  },
  {
    id: 'triggers',
    number: 8,
    title: 'Triggers',
    category: 'Programmability',
    summary: 'Automatic BEFORE INSERT / BEFORE UPDATE integrity rules on tables.',
    explanation:
      'Database triggers automatically execute before or after DML statements. In university_management_db, triggers normalize emails/registration numbers, block future attendance dates, and validate that result marks never exceed the referenced examination max_marks (cross-table validation that CHECK constraints cannot enforce).',
    sqlQuery: `SELECT
  TRIGGER_NAME,
  EVENT_OBJECT_TABLE,
  ACTION_TIMING,
  EVENT_MANIPULATION,
  ACTION_STATEMENT
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
ORDER BY EVENT_OBJECT_TABLE, ACTION_TIMING;`
  },
  {
    id: 'transactions',
    number: 9,
    title: 'Transactions (ACID & ROLLBACK)',
    category: 'Transaction Control',
    summary: 'Executes a real START TRANSACTION, UPDATE, and ROLLBACK verifying atomicity.',
    explanation:
      'Transactions guarantee ACID properties (Atomicity, Consistency, Isolation, Durability). Clicking this concept executes a live MySQL transaction on the server: it reads a student row, modifies semester inside START TRANSACTION, verifies the uncommitted value inside the same connection, executes ROLLBACK, and re-reads to prove changes are cleanly reverted.',
    sqlQuery: `START TRANSACTION;
  SELECT student_id, registration_number, full_name, semester FROM students ORDER BY student_id ASC LIMIT 1;
  UPDATE students SET semester = CASE WHEN semester < 8 THEN semester + 1 ELSE 1 END WHERE student_id = @target_id;
  SELECT student_id, registration_number, full_name, semester FROM students WHERE student_id = @target_id;
ROLLBACK;
SELECT student_id, registration_number, full_name, semester FROM students WHERE student_id = @target_id;`
  },
  {
    id: 'indexing',
    number: 10,
    title: 'Indexing',
    category: 'Performance Optimization',
    summary: 'B-Tree primary, unique, foreign-key, and secondary indexes in InnoDB.',
    explanation:
      'Indexes speed up WHERE filtering, JOIN lookups, and ORDER BY sorting using B-Tree structures instead of full table scans. Querying INFORMATION_SCHEMA.STATISTICS reveals all active indexes across the 7 tables, including explicit composite indexes from indexes.sql.',
    sqlQuery: `SELECT
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME,
  NON_UNIQUE,
  INDEX_TYPE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;`
  },
  {
    id: 'normalization',
    number: 11,
    title: 'Normalization (1NF, 2NF and 3NF)',
    category: 'Database Design',
    summary: 'Eliminates repeating groups, partial dependencies, and transitive/derived redundancy.',
    explanation:
      '1NF: Every column holds atomic values with an explicit primary key. 2NF: Non-key attributes depend fully on the whole primary key (no partial dependencies). 3NF: No transitive or derived dependencies—students store department_id instead of department_name, attendance stores student_id instead of duplicating department_id, and results store marks_obtained while percentage and PASS/FAIL status are derived at query time.',
    sqlQuery: `SELECT
  r.result_id,
  s.registration_number,
  s.full_name AS student_name,
  d.department_code,
  e.exam_name,
  e.subject_code,
  e.subject_name,
  r.marks_obtained,
  e.max_marks,
  ROUND((r.marks_obtained / e.max_marks) * 100, 2) AS derived_percentage
FROM results r
INNER JOIN students s ON r.student_id = s.student_id
INNER JOIN departments d ON s.department_id = d.department_id
INNER JOIN examinations e ON r.exam_id = e.exam_id
ORDER BY r.result_id ASC
LIMIT 15;`
  }
];

function listConcepts() {
  return CONCEPTS.map(({ id, number, title, category, summary }) => ({
    id,
    number,
    title,
    category,
    summary
  }));
}

async function runTransactionDemo() {
  const connection = await pool.getConnection();
  try {
    const [initialRows] = await connection.query(
      'SELECT student_id, registration_number, full_name, semester FROM students ORDER BY student_id ASC LIMIT 1'
    );
    if (initialRows.length === 0) {
      return [
        {
          phase: 'Notice',
          student_id: null,
          registration_number: '-',
          full_name: 'No student rows available to demonstrate transaction.',
          semester: null
        }
      ];
    }

    const target = initialRows[0];
    await connection.beginTransaction();

    await connection.execute(
      'UPDATE students SET semester = CASE WHEN semester < 8 THEN semester + 1 ELSE 1 END WHERE student_id = ?',
      [target.student_id]
    );
    const [insideRows] = await connection.execute(
      'SELECT student_id, registration_number, full_name, semester FROM students WHERE student_id = ?',
      [target.student_id]
    );

    await connection.rollback();

    const [afterRows] = await connection.execute(
      'SELECT student_id, registration_number, full_name, semester FROM students WHERE student_id = ?',
      [target.student_id]
    );

    return [
      { phase: '1. Initial Committed State', ...target },
      { phase: '2. Inside Transaction (After UPDATE, Uncommitted)', ...insideRows[0] },
      { phase: '3. After ROLLBACK (Original State Restored)', ...afterRows[0] }
    ];
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // ignore rollback failure
    }
    throw err;
  } finally {
    connection.release();
  }
}

async function executeConcept(conceptId) {
  const concept = CONCEPTS.find((c) => c.id === conceptId);
  if (!concept) {
    throw new AppError('Requested DBMS concept not found.', 404);
  }

  const startMs = Date.now();
  let rows = [];

  if (concept.id === 'stored-procedures') {
    const [spResult] = await pool.query('CALL sp_get_department_report(NULL)');
    rows = Array.isArray(spResult) && Array.isArray(spResult[0]) ? spResult[0] : spResult;
  } else if (concept.id === 'transactions') {
    rows = await runTransactionDemo();
  } else {
    rows = await query(concept.sqlQuery);
  }

  const executionTimeMs = Date.now() - startMs;
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    ...concept,
    columns,
    rows,
    rowCount: rows.length,
    executionTimeMs
  };
}

module.exports = {
  listConcepts,
  executeConcept
};

