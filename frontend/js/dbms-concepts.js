document.addEventListener('DOMContentLoaded', async () => {
  const user = await initErpLayout({
    pageTitle: 'DBMS Concepts Demonstration',
    allowedRoles: ['admin', 'faculty', 'student']
  });
  if (!user) return;

  const listContainer = document.getElementById('conceptListContainer');
  const categoryBadge = document.getElementById('conceptCategoryBadge');
  const titleEl = document.getElementById('conceptTitle');
  const explanationEl = document.getElementById('conceptExplanation');
  const sqlBlock = document.getElementById('conceptSqlBlock');
  const metricsEl = document.getElementById('conceptMetrics');
  const resultHead = document.getElementById('conceptResultHead');
  const resultBody = document.getElementById('conceptResultBody');
  const errorBox = document.getElementById('conceptErrorBox');
  const copySqlBtn = document.getElementById('copySqlBtn');
  const rerunBtn = document.getElementById('rerunConceptBtn');

  let activeConceptId = null;

  async function loadConceptList() {
    const res = await apiRequest('/api/dbms-concepts');
    const concepts = res.data || [];

    listContainer.innerHTML = concepts
      .map(
        (c) => `
      <button type="button" class="concept-list-item" data-id="${escapeHtml(c.id)}">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="fw-semibold text-dark small">${escapeHtml(c.number)}. ${escapeHtml(c.title)}</span>
        </div>
        <div class="text-muted" style="font-size: 0.76rem;">${escapeHtml(c.summary)}</div>
      </button>
    `
      )
      .join('');

    if (concepts.length > 0) {
      await runConcept(concepts[0].id);
    }
  }

  async function runConcept(conceptId) {
    activeConceptId = conceptId;
    document.querySelectorAll('.concept-list-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.id === conceptId);
    });

    errorBox.classList.add('d-none');
    rerunBtn.disabled = true;
    copySqlBtn.disabled = false;
    resultHead.innerHTML = '';
    resultBody.innerHTML = '<tr><td class="text-center text-muted py-4">Executing query in MySQL...</td></tr>';
    metricsEl.textContent = '';

    try {
      const res = await apiRequest(`/api/dbms-concepts/${encodeURIComponent(conceptId)}`);
      const data = res.data;

      categoryBadge.textContent = data.category;
      titleEl.textContent = `${data.number}. ${data.title}`;
      explanationEl.textContent = data.explanation;
      sqlBlock.textContent = data.sqlQuery;
      metricsEl.textContent = `${data.rowCount} row(s) • ${data.executionTimeMs} ms`;

      if (!data.columns || data.columns.length === 0) {
        resultHead.innerHTML = '';
        resultBody.innerHTML = '<tr><td class="text-center text-muted py-4">Query returned 0 rows.</td></tr>';
      } else {
        resultHead.innerHTML = `
          <tr>
            ${data.columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('')}
          </tr>
        `;
        resultBody.innerHTML = data.rows
          .map(
            (row) => `
          <tr>
            ${data.columns
              .map((col) => {
                const val = row[col];
                return `<td class="tabular-nums">${val === null || val === undefined ? '<span class="text-muted fst-italic">NULL</span>' : escapeHtml(val)}</td>`;
              })
              .join('')}
          </tr>
        `
          )
          .join('');
      }
    } catch (err) {
      errorBox.textContent = err.message || 'Failed to execute query against MySQL.';
      errorBox.classList.remove('d-none');
      resultBody.innerHTML = '<tr><td class="text-center text-muted py-4">Unable to display query output.</td></tr>';
    } finally {
      rerunBtn.disabled = false;
    }
  }

  listContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.concept-list-item');
    if (btn) runConcept(btn.dataset.id);
  });

  rerunBtn.addEventListener('click', () => {
    if (activeConceptId) runConcept(activeConceptId);
  });

  copySqlBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(sqlBlock.textContent);
      showToast('SQL query copied to clipboard.', 'success');
    } catch (_) {
      showToast('Unable to copy automatically; select the SQL block manually.', 'info');
    }
  });

  try {
    await loadConceptList();
  } catch (err) {
    showToast(err.message, 'danger');
  }
});

