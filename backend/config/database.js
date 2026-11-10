const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

// Load .env from project root first, then fallback to backend/.env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'university_management_db',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  connectTimeout: 5000,
  dateStrings: true
});

/**
 * Execute a parameterized SQL query using prepared statements.
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Execute a callback inside an explicit MySQL transaction with automatic rollback on error.
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // Ignore rollback failures when original error already occurred
    }
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Verify MySQL connectivity on startup without crashing server code inspection.
 */
async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
  testConnection
};
