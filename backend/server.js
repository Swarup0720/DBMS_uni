const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const session = require('express-session');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const { testConnection } = require('./config/database');
const { requirePageRole } = require('./middleware/authMiddleware');
const { errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const studentRoutes = require('./routes/studentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const examinationRoutes = require('./routes/examinationRoutes');
const dbmsRoutes = require('./routes/dbmsRoutes');

const app = express();
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: 'ums.sid',
    secret: process.env.SESSION_SECRET || 'ums-dev-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
  })
);

// API Routes
app.get('/api/health', async (_req, res) => {
  try {
    await testConnection();
    res.json({ success: true, status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'error',
      database: 'disconnected',
      message: 'MySQL connection failed. Check .env and MySQL server.'
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api', examinationRoutes);
app.use('/api/dbms-concepts', dbmsRoutes);

// 404 handler for unknown API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

// Role-based protection for HTML pages before serving static frontend assets
app.get('/admin-dashboard.html', requirePageRole('admin'));
app.get('/faculty-dashboard.html', requirePageRole('faculty'));
app.get('/student-dashboard.html', requirePageRole('student'));
app.get('/students.html', requirePageRole('admin'));
app.get('/faculty.html', requirePageRole('admin'));
app.get('/departments.html', requirePageRole('admin'));
app.get('/attendance.html', requirePageRole('admin', 'faculty'));
app.get('/examinations.html', requirePageRole('admin', 'faculty'));
app.get('/results.html', requirePageRole('admin', 'faculty', 'student'));
app.get('/dbms-concepts.html', requirePageRole('admin', 'faculty', 'student'));

// Serve static frontend files
app.use(express.static(FRONTEND_DIR));

// Fallback root route
app.get('/', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Centralized error handler
app.use(errorHandler);

function startServer(port = Number(process.env.PORT) || 3000) {
  return app.listen(port, async () => {
    console.log(`University Management System running at http://localhost:${port}`);
    try {
      await testConnection();
      console.log('MySQL database connection verified.');
    } catch (err) {
      console.warn(
        `Warning: Unable to connect to MySQL on startup (${err.code || err.message}). Ensure MySQL is running and .env is configured.`
      );
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
