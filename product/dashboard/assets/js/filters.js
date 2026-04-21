/**
 * filters.js — Navegación, selector de período, tema y menú de usuario.
 * Orquesta api.js → charts.js. No tiene lógica de datos propia.
 */

let _currentPeriod  = '30d';
let _currentSection = 'performance';
let _loading        = false;

/* ── Loader visual ──────────────────────────────────────── */
function _setLoading(on) {
  _loading = on;
  document.body.style.cursor = on ? 'wait' : '';
}

function _setSkeletons(on) {
  document.querySelectorAll('.kpi-card').forEach(card => {
    card.classList.toggle('kpi-skeleton', on);
  });
}

/* ── Refresh: fetch + render ────────────────────────────── */
async function refreshDashboard(section, period, extraParams = {}) {
  if (_loading) return;
  _setLoading(true);
  _setSkeletons(true);

  const endpointMap = { performance: 'summary', tofu: 'tofu', mofu: 'mofu', bofu: 'bofu' };

  try {
    const data = await fetchData(endpointMap[section], { period, ...extraParams });
    renderSection(section, data);
  } catch (err) {
    console.error('[Dashboard] Error al cargar datos:', err);
  } finally {
    _setLoading(false);
    _setSkeletons(false);
  }
}

/* ── Activar sección / tab / período ────────────────────── */
function _activateSection(section) {
  document.querySelectorAll('.dashboard-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`section-${section}`);
  if (target) target.classList.add('active');
}

function _activateTab(btn) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

function _activatePeriod(btn) {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ── Date picker ────────────────────────────────────────── */
function _openDatePicker() {
  const popover    = document.getElementById('date-picker-popover');
  const startInput = document.getElementById('date-start');
  const endInput   = document.getElementById('date-end');
  if (!popover || !startInput || !endInput) return;

  const today    = new Date();
  const maxDate  = new Date(today); maxDate.setDate(today.getDate() - 1);
  const minDate  = new Date(today); minDate.setDate(today.getDate() - 90);
  const fmt      = d => d.toISOString().split('T')[0];

  startInput.min = endInput.min = fmt(minDate);
  startInput.max = endInput.max = fmt(maxDate);

  if (!startInput.value) {
    const def = new Date(today); def.setDate(today.getDate() - 30);
    startInput.value = fmt(def);
  }
  if (!endInput.value) endInput.value = fmt(maxDate);

  popover.hidden = false;
  popover.setAttribute('aria-hidden', 'false');
}

function _closeDatePicker() {
  const popover = document.getElementById('date-picker-popover');
  if (!popover) return;
  popover.hidden = true;
  popover.setAttribute('aria-hidden', 'true');
}

function _applyCustomRange() {
  const startInput = document.getElementById('date-start');
  const endInput   = document.getElementById('date-end');
  if (!startInput || !endInput || !startInput.value || !endInput.value) return;
  if (startInput.value > endInput.value) { endInput.value = startInput.value; return; }

  _closeDatePicker();
  _currentPeriod = 'custom';
  refreshDashboard(_currentSection, 'custom', { start: startInput.value, end: endInput.value });
}

/* ── Theme toggle ────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('umoh-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function _toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('umoh-theme', next);
  // Redraw charts to pick up new CSS variable colors
  refreshDashboard(_currentSection, _currentPeriod);
}

/* ── User menu ───────────────────────────────────────────── */
function initUserMenu() {
  const name    = window.DASHBOARD_USERNAME || 'Usuario';
  const initial = name.charAt(0).toUpperCase();

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('user-display-name', name);
  setEl('user-menu-fullname', name);
  setEl('user-avatar',    initial);
  setEl('user-avatar-lg', initial);

  // Click toggle (hover is handled by CSS + bridge pseudo-element)
  const trigger  = document.querySelector('.user-menu-trigger');
  const dropdown = document.querySelector('.user-menu-dropdown');
  if (!trigger || !dropdown) return;

  trigger.addEventListener('click', () => {
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    dropdown.classList.toggle('is-open', !expanded);
    trigger.setAttribute('aria-expanded', String(!expanded));
  });

  document.addEventListener('click', e => {
    const menu = document.getElementById('user-menu');
    if (menu && !menu.contains(e.target)) {
      dropdown.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ── KPI Modal ───────────────────────────────────────────── */
const KPI_INFO = {
  revenue: {
    name: 'Ingreso por Ventas',
    formula: '',
    desc: 'Total de ingresos generados por las ventas cerradas durante el período seleccionado.',
    example: 'Si en febrero se cerraron 8 ventas con un ticket promedio de $31.250, el ingreso total sería $250.000. Este número conecta directamente el trabajo de ventas con el resultado económico del cliente.'
  },
  spend: {
    name: 'Costo Publicitario',
    formula: '',
    desc: 'Total invertido en Google Ads y Meta Ads durante el período. Incluye todos los formatos y campañas activas.',
    example: 'Con $80.000 invertidos y $250.000 en ingresos, cada peso publicitario generó $3,12 en ventas. Cruzar este número con el ROI revela si el presupuesto está trabajando bien.'
  },
  roi: {
    name: 'ROI — Retorno sobre Inversión',
    formula: '(Ingresos − Inversión) ÷ Inversión × 100',
    desc: 'Mide cuánto rendimiento generó cada peso invertido en publicidad. Un ROI del 212% significa que por cada $100 invertidos se recuperaron $212 de ganancia neta.',
    example: 'Ingresos $250.000, inversión $80.000 → ROI = (250.000 − 80.000) ÷ 80.000 × 100 = 212%. Si el ROI cae debajo del 100%, la campaña está perdiendo dinero.'
  },
  impressions: {
    name: 'Total Impresiones',
    formula: '',
    desc: 'Cantidad de veces que los anuncios fueron mostrados a usuarios en todas las plataformas. No implica que el usuario haya leído ni clickeado el anuncio.',
    example: '15.000 impresiones en 30 días = 500 apariciones diarias. Con un CTR del 5%, eso genera 750 visitas al sitio. Un bajo CTR sobre muchas impresiones puede indicar que el mensaje no conecta con el público.'
  },
  leads: {
    name: 'Total Leads',
    formula: '',
    desc: 'Personas que completaron el formulario de contacto y se convirtieron en potenciales clientes para el equipo de ventas.',
    example: '80 leads con $80.000 invertidos = CPL de $1.000 por contacto. Si ese mes se cerraron 8 ventas de esos 80 leads, la tasa de conversión fue del 10%.'
  },
  sales: {
    name: 'Ventas Cerradas',
    formula: '',
    desc: 'Leads que firmaron contrato y se convirtieron en clientes efectivos. Es el indicador final que conecta todo el trabajo de marketing con el resultado concreto del negocio.',
    example: '8 ventas de 80 leads = 10% de conversión. Si el mes anterior fueron 6 ventas sobre 80 leads, la eficiencia del equipo de ventas mejoró un 33%.'
  },
  'tofu-impressions': {
    name: 'Impresiones',
    formula: '',
    desc: 'Veces que el anuncio apareció en Google. A mayor volumen con un buen CTR, mayor es el alcance eficiente de la campaña.',
    example: '15.000 impresiones con 750 clicks = CTR del 5%. Un CTR alto indica que el mensaje es relevante para el público objetivo y que la segmentación está funcionando.'
  },
  'tofu-cpc': {
    name: 'CPC — Costo por Click',
    formula: 'Inversión total ÷ Cantidad de clicks',
    desc: 'Cuánto cuesta, en promedio, que un usuario haga click en el anuncio. Menor CPC significa mayor eficiencia del presupuesto publicitario.',
    example: '$80.000 invertidos ÷ 800 clicks = CPC de $100. Si la siguiente semana obtenés 1.000 clicks con el mismo presupuesto, el CPC bajó a $80: un 20% más eficiente.'
  },
  'mofu-cpl': {
    name: 'CPL — Costo por Lead',
    formula: 'Inversión publicitaria ÷ Total de leads generados',
    desc: 'Cuánto cuesta generar un contacto calificado. Es el indicador clave de eficiencia en la etapa de captación de interesados.',
    example: '$80.000 de inversión con 80 leads = CPL de $1.000. Si el siguiente mes obtenés 100 leads con el mismo presupuesto, el CPL baja a $800: captás más contactos al mismo costo.'
  },
  'mofu-tipif': {
    name: 'Tasa de Tipificación',
    formula: 'Leads clasificados ÷ Total de leads × 100',
    desc: 'Porcentaje de leads que el equipo de ventas logró contactar y clasificar en algún estado. Un valor bajo puede indicar un problema en el proceso de seguimiento.',
    example: '72 leads clasificados de 80 totales = 90% de tipificación. Los 8 restantes están "en blanco": son oportunidades sin gestionar que representan potencial perdido.'
  },
  'mofu-highintent': {
    name: 'Leads Alta Intención',
    formula: '',
    desc: 'Leads en estado "En Emisión": están activamente en el proceso de firma de contrato. Son las ventas más cercanas a cerrarse y el indicador más predictivo de ingresos futuros.',
    example: '15 leads de alta intención con un ticket promedio de $31.250 representan $468.750 en ingresos potenciales próximos a materializarse en el corto plazo.'
  },
  'bofu-ticket': {
    name: 'Ticket Promedio por Venta',
    formula: 'Ingresos totales ÷ Ventas cerradas',
    desc: 'Ingreso promedio generado por cada venta cerrada. Refleja el valor económico de cada cliente adquirido y la calidad de los cierres del equipo.',
    example: '$250.000 de ingresos ÷ 8 ventas = $31.250 por cliente. Si el ticket cae, puede indicar que se están priorizando planes de menor valor o que el mix de productos cambió.'
  },
  'bofu-conversion': {
    name: 'Tasa de Conversión',
    formula: 'Ventas cerradas ÷ Total leads × 100',
    desc: 'Porcentaje de leads que terminaron en venta. Combina la calidad del lead generado por marketing con la eficiencia del equipo de ventas al cerrarlo.',
    example: '8 ventas de 80 leads = 10% de conversión. Si el promedio de la industria aseguradora es 5–7%, esta campaña está operando por encima del benchmark.'
  }
};

function _openKpiModal(kpiKey) {
  const info = KPI_INFO[kpiKey];
  if (!info) return;

  const modal   = document.getElementById('kpi-modal');
  const title   = document.getElementById('kpi-modal-title');
  const formula = document.getElementById('kpi-modal-formula');
  const desc    = document.getElementById('kpi-modal-desc');
  const example = document.getElementById('kpi-modal-example');
  if (!modal || !title) return;

  title.textContent   = info.name;
  formula.textContent = info.formula || '';
  desc.textContent    = info.desc;
  example.textContent = info.example;

  modal.hidden = false;
  document.getElementById('kpi-modal-close').focus();
  document.body.style.overflow = 'hidden';
}

function _closeKpiModal() {
  const modal = document.getElementById('kpi-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

function initKpiModals() {
  document.querySelectorAll('.kpi-card[data-kpi]').forEach(card => {
    card.addEventListener('click', () => _openKpiModal(card.dataset.kpi));
  });

  const closeBtn = document.getElementById('kpi-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', _closeKpiModal);

  const overlay = document.getElementById('kpi-modal');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) _closeKpiModal();
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') _closeKpiModal();
  });
}

/* ── Init all listeners ─────────────────────────────────── */
function initFilters() {

  /* Period selector */
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = btn.dataset.period;
      if (period === 'custom') {
        _activatePeriod(btn);
        _openDatePicker();
        return;
      }
      _closeDatePicker();
      _activatePeriod(btn);
      _currentPeriod = period;
      refreshDashboard(_currentSection, _currentPeriod);
    });
  });

  /* Apply custom date range */
  const applyBtn = document.getElementById('date-apply-btn');
  if (applyBtn) applyBtn.addEventListener('click', _applyCustomRange);

  /* Close date picker on outside click */
  document.addEventListener('click', e => {
    const popover = document.getElementById('date-picker-popover');
    const wrap    = document.querySelector('.period-selector-wrap');
    if (popover && !popover.hidden && wrap && !wrap.contains(e.target)) {
      _closeDatePicker();
      if (_currentPeriod !== 'custom') {
        const activeBtn = document.querySelector(`.period-btn[data-period="${_currentPeriod}"]`);
        if (activeBtn) _activatePeriod(activeBtn);
      }
    }
  });

  /* Section navigation */
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

  /* Theme toggle */
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', _toggleTheme);
}

/* ── Bootstrap ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initUserMenu();
  initFilters();
  initKpiModals();
  refreshDashboard(_currentSection, _currentPeriod);
});
