/**
 * filters.js — Navegación, selector de período, tema y menú de usuario.
 * Orquesta api.js → charts.js. No tiene lógica de datos propia.
 */

let _currentPeriod    = '30d';
let _currentSection   = 'performance';
let _loading          = false;
// Filtro global de campaña (Fase 4 — sprint 1.8). 'all' = vista agregada.
// Se persiste en localStorage para que la selección sobreviva entre reloads.
let _currentCampaignId   = localStorage.getItem('umoh:campaign_id')   || 'all';
let _currentCampaignName = localStorage.getItem('umoh:campaign_name') || '';

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
    // Filtro de campaña activa siempre se inyecta (los endpoints lo aceptan
    // y filtran si != 'all'). Permite que extraParams sobreescriba si hace falta.
    const params = { period, campaign_id: _currentCampaignId, ...extraParams };
    const data = await fetchData(endpointMap[section], params);
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
  const name      = window.DASHBOARD_USERNAME || 'Usuario';
  const firstName = name.split(' ')[0];

  const setTextEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTextEl('user-display-name', firstName);
  setTextEl('user-menu-fullname', name);
  /* Avatars already contain <img> tags in HTML — no text override needed */

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
const _fc = n => '$' + Math.round(n).toLocaleString('es-AR');
const _fn = n => Math.round(n).toLocaleString('es-AR');

const KPI_INFO = {
  revenue: {
    name: 'Ingreso por Ventas',
    formula: '',
    desc: 'Total de ingresos generados por las ventas cerradas durante el período seleccionado.',
    example: d => {
      const rev    = d.revenue      || 0;
      const sales  = d.closed_sales || 0;
      const ticket = sales > 0 ? rev / sales : 0;
      const prev   = d.prev?.revenue || 0;
      const diff   = prev > 0 ? ((rev - prev) / prev * 100).toFixed(1) : null;
      const diffTxt = diff !== null ? (diff >= 0 ? `+${diff}%` : `${diff}%`) + ' vs período anterior' : '';
      return `Se generaron ${_fc(rev)} en ingresos a partir de ${_fn(sales)} ventas cerradas, con un ticket promedio de ${_fc(ticket)}. ${diffTxt}`.trim();
    }
  },
  spend: {
    name: 'Costo Publicitario',
    formula: '',
    desc: 'Total invertido en Google Ads y Meta Ads durante el período. Incluye todos los formatos y campañas activas.',
    example: d => {
      const spend = d.ad_spend || 0;
      const rev   = d.revenue  || 0;
      const ratio = spend > 0 ? (rev / spend).toFixed(2) : '—';
      const prev  = d.prev?.ad_spend || 0;
      const diff  = prev > 0 ? ((spend - prev) / prev * 100).toFixed(1) : null;
      const diffTxt = diff !== null ? `(${diff >= 0 ? '+' : ''}${diff}% vs período anterior)` : '';
      return `Se invirtieron ${_fc(spend)} ${diffTxt}. Cada peso publicitario generó ${ratio} pesos en ingresos.`.trim();
    }
  },
  roi: {
    name: 'ROI — Retorno sobre Inversión',
    formula: '(Ingresos − Inversión) ÷ Inversión × 100',
    desc: 'Mide cuánto rendimiento generó cada peso invertido en publicidad. Un ROI positivo indica que los ingresos superan la inversión.',
    example: d => {
      const rev   = d.revenue  || 0;
      const spend = d.ad_spend || 0;
      const roi   = spend > 0 ? ((rev - spend) / spend * 100).toFixed(1) : '—';
      const net   = rev - spend;
      return `Con ${_fc(rev)} de ingresos y ${_fc(spend)} de inversión, el ROI fue de ${roi}%. La ganancia neta sobre la inversión fue de ${_fc(net)}.`;
    }
  },
  impressions: {
    name: 'Total Impresiones',
    formula: '',
    desc: 'Cantidad de veces que los anuncios fueron mostrados a usuarios en todas las plataformas.',
    example: d => {
      const impr   = d.impressions || 0;
      const clicks = d.clicks      || 0;
      const ctr    = impr > 0 ? (clicks / impr * 100).toFixed(2) : '—';
      const prev   = d.prev?.impressions || 0;
      const diff   = prev > 0 ? ((impr - prev) / prev * 100).toFixed(1) : null;
      const diffTxt = diff !== null ? `${diff >= 0 ? '+' : ''}${diff}% vs período anterior` : '';
      return `${_fn(impr)} impresiones ${diffTxt ? `(${diffTxt})` : ''}. Con ${_fn(clicks || 0)} clicks, el CTR fue de ${ctr}%. Un CTR sano en esta industria ronda el 3–6%.`.trim();
    }
  },
  leads: {
    name: 'Total Leads',
    formula: '',
    desc: 'Personas que completaron el formulario de contacto y se convirtieron en potenciales clientes.',
    example: d => {
      const leads = d.leads        || 0;
      const spend = d.ad_spend     || 0;
      const cpl   = leads > 0 ? spend / leads : 0;
      const sales = d.closed_sales || 0;
      const conv  = leads > 0 ? (sales / leads * 100).toFixed(1) : '—';
      return `Se generaron ${_fn(leads)} leads con un costo por lead de ${_fc(cpl)}. De esos leads, ${_fn(sales)} cerraron como ventas (conversión: ${conv}%).`;
    }
  },
  sales: {
    name: 'Ventas Cerradas',
    formula: '',
    desc: 'Leads que firmaron contrato y se convirtieron en clientes efectivos.',
    example: d => {
      const sales  = d.closed_sales || 0;
      const leads  = d.leads        || 0;
      const rev    = d.revenue      || 0;
      const conv   = leads > 0 ? (sales / leads * 100).toFixed(1) : '—';
      const ticket = sales > 0 ? rev / sales : 0;
      const prev   = d.prev?.closed_sales || 0;
      const diff   = prev > 0 ? ((sales - prev) / prev * 100).toFixed(1) : null;
      const diffTxt = diff !== null ? ` (${diff >= 0 ? '+' : ''}${diff}% vs período anterior)` : '';
      return `Se cerraron ${_fn(sales)}${diffTxt} ventas con una tasa de conversión del ${conv}% sobre ${_fn(leads)} leads. Ticket promedio: ${_fc(ticket)}.`;
    }
  },
  'tofu-impressions': {
    name: 'Impresiones',
    formula: '',
    desc: 'Veces que el anuncio apareció en Google. A mayor volumen con un buen CTR, mayor es el alcance eficiente de la campaña.',
    example: '15.000 impresiones con 750 clicks = CTR del 5%. Un CTR alto indica que el mensaje es relevante para el público objetivo y que la segmentación está funcionando.'
  },
  'tofu-clicks': {
    name: 'Clicks',
    formula: '',
    desc: 'Usuarios que hicieron click en el anuncio y llegaron al sitio web. Mide la efectividad del mensaje publicitario para generar interés concreto.',
    example: 'Un alto volumen de clicks con bajo CPC indica que el anuncio es relevante y eficiente. Si los clicks suben pero los leads no, el problema está en la landing page.'
  },
  'tofu-cpc': {
    name: 'CPC — Costo por Click',
    formula: 'Inversión total ÷ Cantidad de clicks',
    desc: 'Cuánto cuesta, en promedio, que un usuario haga click en el anuncio. Menor CPC significa mayor eficiencia del presupuesto publicitario.',
    example: '$80.000 invertidos ÷ 800 clicks = CPC de $100. Si la siguiente semana obtenés 1.000 clicks con el mismo presupuesto, el CPC bajó a $80: un 20% más eficiente.'
  },
  'mofu-leads': {
    name: 'Leads Totales',
    formula: '',
    desc: 'Cantidad total de personas que ingresaron al CRM como leads durante el período seleccionado.',
    example: d => {
      const leads = (window._mofuData || {}).total_leads || 0;
      const prev  = ((window._mofuData || {}).prev || {}).total_leads || 0;
      const diff  = prev > 0 ? ((leads - prev) / prev * 100).toFixed(1) : null;
      const diffTxt = diff !== null ? ` (${diff >= 0 ? '+' : ''}${diff}% vs período anterior)` : '';
      return `Se generaron ${_fn(leads)}${diffTxt} leads en el período.`;
    }
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
  },

  /* ── Resumen Comercial (Performance) — leen de data.sellers_summary ── */
  'cs-top-seller': {
    name: 'Mejor Vendedor del Período',
    formula: '',
    desc: 'El integrante del equipo comercial que cerró más ventas en el período seleccionado. Si dos vendedores empatan en cantidad, gana el que generó mayor revenue.',
    example: d => {
      const ss = d.sellers_summary || {};
      const top = ss.top_seller || '—';
      const prev = ss.prev?.top_seller || null;
      if (prev && prev !== top) return `${top} cerró más ventas este período. En el período anterior el top era ${prev} — el ranking del equipo se está moviendo.`;
      return `${top} cerró más ventas este período y mantiene el primer puesto del ranking comercial.`;
    }
  },
  'cs-avg-effectiveness': {
    name: 'Efectividad Promedio del Equipo',
    formula: 'Suma de ventas del equipo ÷ Suma de leads asignados × 100',
    desc: 'Porcentaje agregado de leads que el equipo logró convertir en ventas. Mide la eficiencia colectiva: cuántos leads de los que entran al CRM terminan cerrados.',
    example: d => {
      const ss = d.sellers_summary || {};
      const eff = ss.avg_effectiveness || 0;
      const sales = ss.total_sales || 0;
      return `El equipo convirtió ${eff.toFixed(1)}% de los leads en ventas. ${_fn(sales)} ventas cerradas en total.`;
    }
  },
  'cs-total-sales': {
    name: 'Ventas del Equipo',
    formula: 'Suma de ventas cerradas por todo el equipo',
    desc: 'Total de ventas cerradas por el equipo comercial en el período. Es el indicador agregado de productividad colectiva.',
    example: d => {
      const ss = d.sellers_summary || {};
      const sales = ss.total_sales || 0;
      const ticket = ss.avg_ticket || 0;
      return `${_fn(sales)} ventas cerradas, con un ticket promedio de ${_fc(ticket)}. Esto suma ${_fc(sales * ticket)} en ingresos del período.`;
    }
  },
  'cs-avg-cycle-days': {
    name: 'Ciclo Promedio de Venta',
    formula: 'Promedio (ponderado por ventas) de días entre creación del lead y cierre',
    desc: 'Días promedio que tarda un lead desde que entra al CRM hasta que se convierte en venta cerrada. Un ciclo más corto indica mayor velocidad comercial. Promedio ponderado por ventas para representar fielmente al equipo.',
    example: d => {
      const ss = d.sellers_summary || {};
      const cycle = ss.avg_cycle_days || 0;
      return `El equipo tarda en promedio ${cycle.toFixed(1)} días en cerrar una venta desde que el lead entra al CRM. Un ciclo más corto suele correlacionar con leads de mayor calidad o procesos comerciales más ágiles.`;
    }
  },
  'cs-avg-ticket': {
    name: 'Ticket Promedio del Equipo',
    formula: 'Revenue total del equipo ÷ Ventas totales del equipo',
    desc: 'Valor económico promedio de cada venta cerrada por el equipo. Un ticket en alza puede indicar que se están vendiendo planes de mayor valor o cápitas más grandes.',
    example: d => {
      const ss = d.sellers_summary || {};
      const ticket = ss.avg_ticket || 0;
      return `Cada venta del equipo genera en promedio ${_fc(ticket)} de ingreso. Es la cifra clave para proyectar el revenue total a partir del volumen de ventas esperado.`;
    }
  },
  'cs-avg-capitas-per-sale': {
    name: 'Cápitas por Venta',
    formula: 'Cápitas totales cerradas ÷ Ventas totales',
    desc: 'Cantidad promedio de cápitas (titulares + grupo familiar) que se cierran en cada venta. Indica el tamaño promedio del grupo familiar/empresa contratante.',
    example: d => {
      const ss = d.sellers_summary || {};
      const cps = ss.avg_capitas_per_sale || 0;
      return `Cada venta del equipo suma en promedio ${cps.toFixed(2)} cápitas. Si el número crece, el equipo está cerrando ventas con grupos familiares o empresas más grandes — más revenue por venta.`;
    }
  }
};

function _renderModalChart(kpiKey) {
  if (window._kpiModalChartInstance) {
    window._kpiModalChartInstance.destroy();
    window._kpiModalChartInstance = null;
  }
  const ctx = document.getElementById('kpi-modal-chart');
  if (!ctx) return false;

  const isTofuKey = ['tofu-impressions', 'tofu-clicks', 'tofu-cpc'].includes(kpiKey);
  const isMofuKey = ['mofu-leads', 'mofu-cpl', 'mofu-tipif', 'mofu-highintent'].includes(kpiKey);

  let data;
  if (isTofuKey) {
    data = window._tofuData;
  } else if (isMofuKey) {
    data = window._mofuData;
  } else {
    data = window._kpiModalData;
  }
  if (!data || !data.trend) return false;

  const src     = data.trend.sparkline || data.trend;
  const labels  = src.labels || [];
  const spend   = src.spend   || data.trend.spend;
  const revenue = src.revenue || data.trend.revenue;

  let values, color, label;
  const isUp = arr => arr[arr.length - 1] >= arr[0];

  if (kpiKey === 'revenue') {
    values = revenue; color = isUp(revenue) ? '#22C55E' : '#FF0040'; label = 'Ingreso';
  } else if (kpiKey === 'spend') {
    values = spend; color = !isUp(spend) ? '#22C55E' : '#EF4444'; label = 'Inversión';
  } else if (kpiKey === 'roi') {
    values = revenue.map((r, i) => spend[i] > 0 ? ((r - spend[i]) / spend[i]) * 100 : 0);
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'ROI %';
  } else if (kpiKey === 'impressions') {
    const tot = revenue.reduce((a, b) => a + b, 0);
    values = revenue.map(r => tot > 0 ? Math.round((r / tot) * data.impressions) : 0);
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Impresiones';
  } else if (kpiKey === 'leads') {
    const tot = revenue.reduce((a, b) => a + b, 0);
    values = revenue.map(r => tot > 0 ? Math.round((r / tot) * data.leads) : 0);
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Leads';
  } else if (kpiKey === 'sales') {
    const tot = revenue.reduce((a, b) => a + b, 0);
    values = revenue.map(r => tot > 0 ? Math.round((r / tot) * data.closed_sales) : 0);
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Ventas';
  } else if (kpiKey === 'tofu-impressions') {
    values = data.trend.impressions; color = isUp(data.trend.impressions) ? '#22C55E' : '#FF0040'; label = 'Impresiones';
  } else if (kpiKey === 'tofu-clicks') {
    values = data.trend.clicks; color = isUp(data.trend.clicks) ? '#22C55E' : '#FF0040'; label = 'Clicks';
  } else if (kpiKey === 'tofu-cpc') {
    values = data.trend.cpc || [];
    color = !isUp(values) ? '#22C55E' : '#FF0040'; label = 'CPC Promedio';
  } else if (kpiKey === 'mofu-leads') {
    values = src.leads || data.trend.leads || [];
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Leads';
  } else if (kpiKey === 'mofu-cpl') {
    values = src.cpl || data.trend.cpl || [];
    color = !isUp(values) ? '#22C55E' : '#FF0040'; label = 'CPL';
  } else if (kpiKey === 'mofu-tipif') {
    values = src.leads || data.trend.leads || [];
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Leads (proxy tipificación)';
  } else if (kpiKey === 'mofu-highintent') {
    values = src.leads || data.trend.leads || [];
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Leads (proxy alta intención)';
  } else {
    return false;
  }

  if (!values || values.length < 2) return false;

  const fill = color === '#22C55E' ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)';

  const chartLabels = (isTofuKey || isMofuKey)
    ? (data.trend.labels || values.map((_, i) => `${i + 1}`))
    : (labels.length === values.length ? labels : values.map((_, i) => `${i + 1}`));

  window._kpiModalChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [{
        label,
        data: values,
        borderColor: color,
        backgroundColor: fill,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => items[0]?.label || '',
            label: c => {
              const v = c.parsed.y;
              if (kpiKey === 'tofu-cpc' || kpiKey === 'mofu-cpl') return ` ${label}: $${Math.round(v).toLocaleString('es-AR')}`;
              return ` ${label}: ${Number.isInteger(v) ? v.toLocaleString('es-AR') : v.toFixed(1)}`;
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          ticks: { font: { size: 10, family: 'Outfit' }, color: 'rgba(90,112,128,0.7)', maxRotation: 0 },
          grid: { display: false }
        },
        y: {
          display: true,
          ticks: {
            font: { size: 10, family: 'Outfit' }, color: 'rgba(90,112,128,0.7)',
            callback: v => {
              if (kpiKey === 'roi') return v.toFixed(0) + '%';
              if (kpiKey === 'tofu-impressions' || kpiKey === 'tofu-clicks') {
                return v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v;
              }
              if (kpiKey === 'tofu-cpc' || kpiKey === 'mofu-cpl') return '$' + (v / 1000).toFixed(1) + 'k';
              return v >= 1000000 ? '$' + (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? '$' + (v / 1000).toFixed(0) + 'k' : v;
            }
          },
          grid: { color: 'rgba(90,112,128,0.08)' }
        }
      }
    }
  });
  return true;
}

function _openKpiModal(kpiKey) {
  const info = KPI_INFO[kpiKey];
  if (!info) return;
  const data = window._kpiModalData || {};

  const modal   = document.getElementById('kpi-modal');
  const title   = document.getElementById('kpi-modal-title');
  const formula = document.getElementById('kpi-modal-formula');
  const desc    = document.getElementById('kpi-modal-desc');
  const example = document.getElementById('kpi-modal-example');
  if (!modal || !title) return;

  title.textContent   = info.name;
  formula.textContent = info.formula || '';
  desc.textContent    = info.desc;
  example.textContent = typeof info.example === 'function' ? info.example(data) : info.example;

  modal.hidden = false;
  // Renderizar el chart si aplica; si no hay datos para chart, ocultar el área
  // entera para que el modal no muestre un espacio en blanco sin sentido.
  const chartArea = modal.querySelector('.kpi-modal-chart-area');
  requestAnimationFrame(() => {
    const rendered = _renderModalChart(kpiKey);
    if (chartArea) chartArea.hidden = !rendered;
  });
  document.getElementById('kpi-modal-close').focus();
  document.body.style.overflow = 'hidden';
}

function _closeKpiModal() {
  const modal = document.getElementById('kpi-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  if (window._kpiModalChartInstance) {
    window._kpiModalChartInstance.destroy();
    window._kpiModalChartInstance = null;
  }
}

function initKpiModals() {
  document.querySelectorAll('.kpi-card[data-kpi]').forEach(card => {
    card.addEventListener('click', () => _openKpiModal(card.dataset.kpi));
  });

  // Event delegation para .cs-item del Resumen Comercial — el bloque se
  // re-renderiza con innerHTML cada vez que cambia el período, así que no
  // alcanza con registrar listeners una sola vez en cada cs-item.
  const csContainer = document.getElementById('commercial-summary');
  if (csContainer) {
    csContainer.addEventListener('click', e => {
      const item = e.target.closest('.cs-item[data-cs-kpi]');
      if (item) _openKpiModal(item.dataset.csKpi);
    });
    // Soporte teclado: Enter o Space activan el modal
    csContainer.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const item = e.target.closest('.cs-item[data-cs-kpi]');
      if (item) {
        e.preventDefault();
        _openKpiModal(item.dataset.csKpi);
      }
    });
  }

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

  /* Histórico total — granularity buttons */
  document.querySelectorAll('.historic-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.historic-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const granularity = btn.dataset.granularity;
      _closeDatePicker();
      _currentPeriod = 'all';
      refreshDashboard(_currentSection, 'all', { granularity });
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
      if (_currentPeriod !== 'custom' && _currentPeriod !== 'all') {
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
      if (section === 'tofu') setTimeout(() => { if (typeof invalidateGeoMap === 'function') invalidateGeoMap(); }, 350);
    });
  });

  /* Theme toggle */
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', _toggleTheme);
}

/* ── Auto-hide nav + FAB scroll-to-top ───────────────────────
   Cuando el usuario hace scroll para abajo más allá de un umbral, el
   nav-bar se desvanece hacia arriba y aparece un FAB en la esquina
   inferior derecha. El FAB es un acceso directo para volver al top
   de la página (smooth scroll). Al volver al top, el nav reaparece. */
function initScrollNavBehavior() {
  const fab = document.getElementById('nav-fab');
  if (!fab) return;

  const SCROLL_THRESHOLD = 180;  // px desde el top antes de ocultar el nav
  let ticking = false;

  function onScroll() {
    const y = window.scrollY || document.documentElement.scrollTop;
    if (y > SCROLL_THRESHOLD) {
      document.body.classList.add('nav-hidden');
    } else {
      document.body.classList.remove('nav-hidden');
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });

  fab.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ── Selector de campaña activa (Fase 4 — sprint 1.8) ────────
   Trae la lista de campañas desde GET /api/campaigns y popula el dropdown.
   Click en una opción → actualiza el estado global, persiste en localStorage,
   y dispara refreshDashboard() para que todas las secciones se recalculen
   con el filtro nuevo. */
function initCampaignSelector() {
  const btn      = document.getElementById('campaign-selector-btn');
  const popover  = document.getElementById('campaign-selector-popover');
  const btnName  = document.getElementById('cs-btn-name');
  const btnId    = document.getElementById('cs-btn-id');
  if (!btn || !popover || !btnName) return;

  function _setSelectedUI(id, name) {
    btnName.textContent = (id === 'all') ? 'Todas las campañas' : name;
    btnId.textContent   = (id === 'all') ? '' : 'ID ' + id;
    popover.querySelectorAll('.campaign-option').forEach(opt => {
      const isActive = opt.dataset.campaignId === id;
      opt.classList.toggle('active', isActive);
      opt.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function _selectCampaign(id, name) {
    _currentCampaignId = id;
    _currentCampaignName = name || '';
    localStorage.setItem('umoh:campaign_id', id);
    localStorage.setItem('umoh:campaign_name', _currentCampaignName);
    _setSelectedUI(id, _currentCampaignName);
    _closePopover();
    // Refresca la sección actual con el filtro nuevo
    refreshDashboard(_currentSection, _currentPeriod);
  }

  function _openPopover() {
    popover.hidden = false;
    popover.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
  }
  function _closePopover() {
    popover.hidden = true;
    popover.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (popover.hidden) _openPopover();
    else _closePopover();
  });

  // Event delegation para los options (la lista se popula dinámicamente)
  popover.addEventListener('click', e => {
    const opt = e.target.closest('.campaign-option');
    if (!opt) return;
    _selectCampaign(opt.dataset.campaignId, opt.dataset.campaignName || opt.querySelector('.cs-opt-name')?.textContent || '');
  });

  document.addEventListener('click', e => {
    if (!popover.contains(e.target) && e.target !== btn) _closePopover();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !popover.hidden) _closePopover();
  });

  // Cargar la lista desde el backend y popular el dropdown
  fetchData('campaigns', {})
    .then(resp => {
      const list = (resp && resp.campaigns) || [];
      // El option "all" ya está en el HTML; agregamos los demás abajo
      list.forEach(c => {
        const opt = document.createElement('button');
        opt.className = 'campaign-option';
        opt.type = 'button';
        opt.dataset.campaignId = c.id;
        opt.dataset.campaignName = c.name;
        opt.setAttribute('role', 'option');
        opt.setAttribute('aria-selected', 'false');
        opt.innerHTML = `
          <span class="cs-opt-name">${_escape(c.name)}</span>
          <span class="cs-opt-id">ID ${_escape(c.id)}</span>
        `;
        popover.appendChild(opt);
      });
      // Si la persistencia tenía un id que coincide con una campaña real,
      // refrescamos la UI para reflejarlo. Si no existe (cliente cambió de
      // campaña, o mock), volvemos a "all".
      if (_currentCampaignId !== 'all') {
        const found = list.find(c => c.id === _currentCampaignId);
        if (!found) {
          _currentCampaignId = 'all';
          _currentCampaignName = '';
          localStorage.setItem('umoh:campaign_id', 'all');
          localStorage.setItem('umoh:campaign_name', '');
        } else {
          _currentCampaignName = found.name;
          localStorage.setItem('umoh:campaign_name', found.name);
        }
      }
      _setSelectedUI(_currentCampaignId, _currentCampaignName);
    })
    .catch(err => {
      console.warn('[Dashboard] No se pudo cargar la lista de campañas:', err);
      // Fallback: dejar "Todas las campañas" como única opción
      _setSelectedUI('all', '');
    });
}

function _escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/* ── Bootstrap ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initUserMenu();
  initFilters();
  initKpiModals();
  initScrollNavBehavior();
  initCampaignSelector();
  refreshDashboard(_currentSection, _currentPeriod);
});
