/**
 * Custom application error carrying HTTP status code.
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

/**
 * Wrap async Express route handlers to forward rejections to errorMiddleware.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/**
 * Centralized Express error handler translating MySQL errors cleanly without exposing internals.
 */
function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.isOperational ? err.message : 'An unexpected server error occurred.';

  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    if (err.message.includes('uq_students_reg_no')) {
      message = 'A student with this registration number already exists.';
    } else if (err.message.includes('email')) {
      message = 'This email address is already registered.';
    } else if (err.message.includes('uq_departments_code')) {
      message = 'A department with this department code already exists.';
    } else if (err.message.includes('uq_departments_name')) {
      message = 'A department with this department name already exists.';
    } else if (err.message.includes('uq_attendance_student_date_session')) {
      message = 'Attendance has already been recorded for this student, date, and session.';
    } else if (err.message.includes('uq_exam_subject_dept_sem')) {
      message = 'An examination with this name and subject code already exists for this department and semester.';
    } else {
      message = 'Duplicate record violates a unique database constraint.';
    }
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    statusCode = 409;
    message = 'Cannot delete this record because other records depend on it.';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Referenced department, faculty, student, or examination does not exist.';
  } else if (err.sqlState === '45000') {
    // Custom validation error raised by a MySQL trigger (SIGNAL SQLSTATE '45000')
    statusCode = 400;
    message = err.sqlMessage || err.message;
  } else if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    statusCode = 400;
    message = 'Input value violates a database CHECK constraint.';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_BAD_DB_ERROR') {
    statusCode = 503;
    message = 'Database connection unavailable. Please verify MySQL server and .env configuration.';
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error('[Server Error]', err.code || '', err.message);
  }

  res.status(statusCode).json({
    success: false,
    message
  });
}

module.exports = {
  AppError,
  asyncHandler,
  errorHandler
};

