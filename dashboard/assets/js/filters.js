/**
 * filters.js — Navegación entre secciones y selector de período.
 * Orquesta api.js → charts.js. No tiene lógica de datos propia.
 */

let _currentPeriod  = '30d';
let _currentSection = 'performance';
let _loading        = false;

/* ── Loader visual ligero ───────────────────────────────── */
function _setLoading(on) {
  _loading = on;
  document.body.style.cursor = on ? 'wait' : '';
}

/* ── Refresh: fetch + render ────────────────────────────── */
async function refreshDashboard(section, period) {
  if (_loading) return;
  _setLoading(true);

  const endpointMap = {
    performance: 'summary',
    tofu:        'tofu',
    mofu:        'mofu',
    bofu:        'bofu'
  };

  try {
    const data = await fetchData(endpointMap[section], { period });
    renderSection(section, data);
  } catch (err) {
    console.error('[Dashboard] Error al cargar datos:', err);
  } finally {
    _setLoading(false);
  }
}

/* ── Activar sección en DOM ─────────────────────────────── */
function _activateSection(section) {
  document.querySelectorAll('.dashboard-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`section-${section}`);
  if (target) target.classList.add('active');
}

/* ── Activar botón de tab ───────────────────────────────── */
function _activateTab(btn) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

/* ── Activar botón de período ───────────────────────────── */
function _activatePeriod(btn) {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ── Init listeners ─────────────────────────────────────── */
function initFilters() {

  /* Período */
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = btn.dataset.period;
      if (period === 'custom') {
        // TODO Fase 2: abrir date picker
        _activatePeriod(btn);
        return;
      }
      _activatePeriod(btn);
      _currentPeriod = period;
      refreshDashboard(_currentSection, _currentPeriod);
    });
  });

  /* Navegación de secciones */
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const section = tab.dataset.section;
      if (section === _currentSection) return;

      _activateTab(tab);
      _activateSection(section);
      _currentSection = section;
      refreshDashboard(_currentSection, _currentPeriod);
    });
  });
}

/* ── Bootstrap ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  refreshDashboard(_currentSection, _currentPeriod);
});
