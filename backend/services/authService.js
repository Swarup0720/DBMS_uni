const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { AppError } = require('../middleware/errorMiddleware');

const SALT_ROUNDS = 10;

/**
 * Authenticate a user by email or username, verify bcrypt password, and hydrate role context.
 */
async function authenticateUser({ identifier, password, role }) {
  const normalized = identifier.trim().toLowerCase();
  const rows = await query(
    `SELECT user_id, username, email, password_hash, role, full_name, is_active
     FROM users
     WHERE LOWER(email) = ? OR LOWER(username) = ?
     LIMIT 1`,
    [normalized, normalized]
  );

  if (rows.length === 0) {
    throw new AppError('Invalid email/username or password.', 401);
  }

  const user = rows[0];
  if (!user.is_active) {
    throw new AppError('This account is inactive. Contact administration.', 403);
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordMatch) {
    throw new AppError('Invalid email/username or password.', 401);
  }

  if (role && user.role !== role) {
    throw new AppError(
      `This account is registered under the "${user.role}" role. Please switch to the ${user.role} tab to sign in.`,
      403
    );
  }

  const sessionUser = {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    role: user.role,
    full_name: user.full_name
  };

  if (user.role === 'faculty') {
    const facultyRows = await query(
      `SELECT f.faculty_id, f.department_id, f.designation, d.department_name, d.department_code
       FROM faculty f
       INNER JOIN departments d ON f.department_id = d.department_id
       WHERE f.user_id = ?
       LIMIT 1`,
      [user.user_id]
    );
    if (facultyRows.length > 0) {
      Object.assign(sessionUser, facultyRows[0]);
    }
  } else if (user.role === 'student') {
    const studentRows = await query(
      `SELECT s.student_id, s.registration_number, s.department_id, s.semester, s.admission_year,
              d.department_name, d.department_code
       FROM students s
       INNER JOIN departments d ON s.department_id = d.department_id
       WHERE s.user_id = ?
       LIMIT 1`,
      [user.user_id]
    );
    if (studentRows.length > 0) {
      Object.assign(sessionUser, studentRows[0]);
    }
  }

  return sessionUser;
}

async function resolveUniqueUsername(connection, baseCandidate) {
  const sanitized = baseCandidate
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 40) || 'user';

  let candidate = sanitized;
  let counter = 1;
  while (true) {
    const [existing] = await connection.execute(
      'SELECT user_id FROM users WHERE username = ? LIMIT 1',
      [candidate]
    );
    if (existing.length === 0) {
      return candidate;
    }
    counter += 1;
    candidate = `${sanitized.slice(0, 35)}_${counter}`;
  }
}

async function createLinkedUser(connection, { usernameBase, email, password, role, full_name }) {
  const [existingEmail] = await connection.execute(
    'SELECT user_id FROM users WHERE LOWER(email) = ? LIMIT 1',
    [email.toLowerCase()]
  );
  if (existingEmail.length > 0) {
    throw new AppError('This email address is already registered to an existing user account.', 409);
  }

  const username = await resolveUniqueUsername(connection, usernameBase || email.split('@')[0]);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const [result] = await connection.execute(
    `INSERT INTO users (username, email, password_hash, role, full_name, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [username, email.toLowerCase(), passwordHash, role, full_name]
  );

  return result.insertId;
}

async function updateLinkedUser(connection, userId, { email, full_name }) {
  if (!userId) return;
  const [conflict] = await connection.execute(
    'SELECT user_id FROM users WHERE LOWER(email) = ? AND user_id <> ? LIMIT 1',
    [email.toLowerCase(), userId]
  );
  if (conflict.length > 0) {
    throw new AppError('This email address is already registered to another user.', 409);
  }

  await connection.execute(
    'UPDATE users SET email = ?, full_name = ? WHERE user_id = ?',
    [email.toLowerCase(), full_name, userId]
  );
}

async function deleteLinkedUser(connection, userId) {
  if (!userId) return;
  await connection.execute('DELETE FROM users WHERE user_id = ?', [userId]);
}

module.exports = {
  authenticateUser,
  createLinkedUser,
  updateLinkedUser,
  deleteLinkedUser
};

