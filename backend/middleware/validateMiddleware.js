const { AppError } = require('./errorMiddleware');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function assertNonEmptyString(value, fieldLabel, maxLength = 150) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(`${fieldLabel} is required.`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new AppError(`${fieldLabel} must not exceed ${maxLength} characters.`, 400);
  }
  return trimmed;
}

function assertValidEmail(value, fieldLabel = 'Email') {
  const email = assertNonEmptyString(value, fieldLabel, 120).toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new AppError(`Please provide a valid ${fieldLabel.toLowerCase()}.`, 400);
  }
  return email;
}

function assertValidPhone(value, fieldLabel = 'Phone number') {
  const phone = assertNonEmptyString(value, fieldLabel, 20);
  if (!PHONE_REGEX.test(phone)) {
    throw new AppError(`${fieldLabel} must contain 7 to 20 valid characters.`, 400);
  }
  return phone;
}

function assertPositiveInt(value, fieldLabel) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new AppError(`${fieldLabel} must be a valid positive integer.`, 400);
  }
  return num;
}

function assertIntInRange(value, fieldLabel, min, max) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new AppError(`${fieldLabel} must be an integer between ${min} and ${max}.`, 400);
  }
  return num;
}

function assertNumberInRange(value, fieldLabel, min, max) {
  const num = Number(value);
  if (Number.isNaN(num) || num < min || num > max) {
    throw new AppError(`${fieldLabel} must be a number between ${min} and ${max}.`, 400);
  }
  return Number(num.toFixed(2));
}

function assertValidDate(value, fieldLabel = 'Date') {
  const str = assertNonEmptyString(value, fieldLabel, 10);
  if (!DATE_REGEX.test(str)) {
    throw new AppError(`${fieldLabel} must be in YYYY-MM-DD format.`, 400);
  }
  const parsed = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== str) {
    throw new AppError(`${fieldLabel} is not a valid calendar date.`, 400);
  }
  return str;
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  assertNonEmptyString,
  assertValidEmail,
  assertValidPhone,
  assertPositiveInt,
  assertIntInRange,
  assertNumberInRange,
  assertValidDate,
  todayIsoDate
};

