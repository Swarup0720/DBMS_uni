/**
 * Shared API client, DOM helpers, toast notifications, and CSV export utility.
 */

async function apiRequest(url, options = {}) {
  const config = {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  };

  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (response.status === 401 && !options.skipAuthRedirect) {
    window.location.href = '/login.html';
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    const message = payload && payload.message ? payload.message : `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const str = String(dateStr).slice(0, 10);
  const parts = str.split('-');
  if (parts.length !== 3) return str;
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
}

function todayDateInput() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function showToast(message, type = 'info') {
  let container = document.getElementById('umsToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'umsToastContainer';
    container.className = 'ums-toast-container no-print';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const iconClass =
    type === 'success'
      ? 'bi-check-circle-fill text-success'
      : type === 'danger'
        ? 'bi-exclamation-triangle-fill text-danger'
        : 'bi-info-circle-fill text-primary';

  toast.className = `ums-toast toast-${type}`;
  toast.innerHTML = `
    <i class="bi ${iconClass} mt-1"></i>
    <div class="flex-grow-1">${escapeHtml(message)}</div>
    <button type="button" class="btn-close btn-sm" aria-label="Close"></button>
  `;

  toast.querySelector('.btn-close').addEventListener('click', () => toast.remove());
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 4500);
}

function exportRowsToCSV(filename, headers, rows) {
  const escapeCell = (val) => {
    const str = val === null || val === undefined ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

