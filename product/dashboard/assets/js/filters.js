/**
 * filters.js — Navegación, sidebar, selector de período, tema y menú de usuario.
 * Orquesta api.js → charts.js. No tiene lógica de datos propia.
 *
 * Sprint UX 2.0: sidebar lateral colapsable reemplaza al header/nav viejos.
 * La sección "inicio" se convierte en la pantalla de entrada (default).
 */

// Período activo. Se restaura desde localStorage si existe.
let _currentPeriod      = localStorage.getItem('umoh:period') || '30d';
// Default a "inicio" — el cliente entra al dashboard y ve el saludo + resumen
// IA primero, después navega a las secciones específicas (Performance/TOFU/etc.)
let _currentSection     = 'inicio';
let _currentGranularity = 'dias';   // última granularidad activa del historic-section
let _loading            = false;

// Fechas del rango personalizado. Se persisten en localStorage.
let _currentCustomStart = localStorage.getItem('umoh:custom-start') || '';
let _currentCustomEnd   = localStorage.getItem('umoh:custom-end')   || '';

// Filtro global de campaña (Fase 4 — sprint 1.8). 'all' = vista agregada.
// Se persiste en localStorage para que la selección sobreviva entre reloads.
let _currentCampaignId   = localStorage.getItem('umoh:campaign_id')   || 'all';
let _currentCampaignName = localStorage.getItem('umoh:campaign_name') || '';

/**
 * Devuelve los extraParams de período correctos para la llamada actual.
 * Si el período es 'custom' y hay fechas guardadas, pasa start + end.
 * En cualquier otro caso retorna un objeto vacío.
 */
function _periodParams() {
  if (_currentPeriod === 'custom' && _currentCustomStart && _currentCustomEnd) {
    return { start: _currentCustomStart, end: _currentCustomEnd, granularity: _currentGranularity };
  }
  return {};
}

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

  // Inicio tiene su propio flujo de datos — no usa los KPI skeletons
  if (section !== 'inicio') _setSkeletons(true);

  const endpointMap = { performance: 'summary', tofu: 'tofu', mofu: 'mofu', bofu: 'bofu', inicio: 'inicio' };

  try {
    const params = { period, campaign_id: _currentCampaignId, ...extraParams };
    // BOFU + MOFU: si el caller no envió `canal` explícito, leemos el valor del
    // dropdown. BOFU usa #bofu-canal-filter, MOFU usa #mofu-canal-filter como
    // fuente primaria y cae a #bofu-canal-filter como fallback. Ambos selects
    // permanecen sincronizados mediante _applyCanalFilter(), así que el valor
    // es idéntico en los dos. El default difiere: BOFU = 'campaign' (vista
    // ejecutiva clásica), MOFU = 'all' (journey histórico completo).
    if ((section === 'bofu' || section === 'mofu') && params.canal === undefined) {
      const defaultCanal = section === 'mofu' ? 'all' : 'campaign';
      const primaryId    = section === 'mofu' ? 'mofu-canal-filter' : 'bofu-canal-filter';
      const primaryEl    = document.getElementById(primaryId);
      const fallbackEl   = section === 'mofu' ? document.getElementById('bofu-canal-filter') : null;
      const canalEl      = primaryEl || fallbackEl;
      if (canalEl) {
        params.canal = canalEl.value || defaultCanal;
      }
    }
    const data = await fetchData(endpointMap[section] || section, params);
    renderSection(section, data);
  } catch (err) {
    // Error silencioso en producción (no se loga en consola)
  } finally {
    _setLoading(false);
    if (section !== 'inicio') _setSkeletons(false);
  }
}

/* ── Activar sección / nav-item / período ───────────────── */
function _activateSection(section) {
  document.querySelectorAll('.dashboard-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`section-${section}`);
  if (target) target.classList.add('active');
}

function _activateSidebarNavItem(section) {
  document.querySelectorAll('.sb-nav-item').forEach(item => {
    const active = item.dataset.section === section;
    item.classList.toggle('active', active);
    item.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function _activatePeriod(btn) {
  document.querySelectorAll('.period-btn, .sb-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Sincronizar el label compacto del sidebar colapsado
  const compact = document.getElementById('sb-period-compact-label');
  if (compact) compact.textContent = btn.dataset.period || '30d';
}

/* ── Date picker (inline panel en sidebar) ───────────────── */

/**
 * Abre el panel inline de fechas personalizadas dentro del sidebar.
 * Pre-rellena los inputs con valores por defecto si están vacíos.
 */
function _openDatePicker() {
  const panel      = document.getElementById('sb-custom-date-panel');
  const customBtn  = document.getElementById('sb-period-custom-btn');
  const startInput = document.getElementById('date-start');
  const endInput   = document.getElementById('date-end');
  if (!panel || !startInput || !endInput) return;

  const today   = new Date();
  const maxDate = new Date(today); maxDate.setDate(today.getDate() - 1);
  const fmt     = d => d.toISOString().split('T')[0];

  // Sin restricción de min — el usuario puede ir tan atrás como quiera (auditoría histórica).
  // Solo limitamos el max a "ayer" para no permitir fechas futuras (no tienen datos).
  startInput.removeAttribute('min');
  endInput.removeAttribute('min');
  startInput.max = endInput.max = fmt(maxDate);

  if (!startInput.value) {
    const def = new Date(today); def.setDate(today.getDate() - 30);
    startInput.value = fmt(def);
  }
  if (!endInput.value) endInput.value = fmt(maxDate);

  panel.classList.add('is-open');
  if (customBtn) {
    customBtn.classList.add('is-open');
    customBtn.setAttribute('aria-expanded', 'true');
  }
}

/**
 * Cierra el panel inline de fechas personalizadas.
 */
function _closeDatePicker() {
  const panel     = document.getElementById('sb-custom-date-panel');
  const customBtn = document.getElementById('sb-period-custom-btn');
  if (panel) panel.classList.remove('is-open');
  if (customBtn) {
    customBtn.classList.remove('is-open');
    customBtn.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Alterna el panel inline de fecha personalizada.
 */
function _toggleDatePicker() {
  const panel = document.getElementById('sb-custom-date-panel');
  if (panel && panel.classList.contains('is-open')) {
    _closeDatePicker();
  } else {
    _openDatePicker();
  }
}

function _applyCustomRange() {
  const startInput = document.getElementById('date-start');
  const endInput   = document.getElementById('date-end');
  if (!startInput || !endInput || !startInput.value || !endInput.value) return;
  if (startInput.value > endInput.value) { endInput.value = startInput.value; return; }

  // Guardar fechas en variables globales y localStorage para que persistan
  // entre cambios de sección y reloads del browser.
  _currentCustomStart = startInput.value;
  _currentCustomEnd   = endInput.value;
  localStorage.setItem('umoh:custom-start', _currentCustomStart);
  localStorage.setItem('umoh:custom-end',   _currentCustomEnd);

  _closeDatePicker();
  _currentPeriod = 'custom';
  localStorage.setItem('umoh:period', 'custom');
  _updatePeriodRange('custom');
  // _periodParams() ya construye { start, end, granularity } para el período custom.
  refreshDashboard(_currentSection, 'custom', _periodParams());
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
  _syncThemeLabel();
  // Redraw charts to pick up new CSS variable colors
  refreshDashboard(_currentSection, _currentPeriod, _periodParams());
}

/* ── User menu (sidebar) ─────────────────────────────────── */

/**
 * Actualiza el label del botón de tema en el sidebar
 * según el tema activo actual.
 */
function _syncThemeLabel() {
  const label = document.getElementById('sb-theme-label');
  if (!label) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  label.textContent = isDark ? 'Modo claro' : 'Modo oscuro';
}

function initUserMenu() {
  const name      = window.DASHBOARD_USERNAME || 'Usuario';
  const firstName = name.split(' ')[0];

  const setTextEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Sidebar user elements
  setTextEl('sb-user-name',     firstName);
  setTextEl('sb-user-fullname', name);

  // Sección Inicio: saludo personalizado
  setTextEl('inicio-user-name', firstName);

  // Sidebar user dropdown
  const trigger  = document.getElementById('sb-user-trigger');
  const dropdown = document.getElementById('sb-user-dropdown');
  if (!trigger || !dropdown) return;

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    dropdown.classList.toggle('is-open', !expanded);
    trigger.setAttribute('aria-expanded', String(!expanded));
  });

  document.addEventListener('click', e => {
    const userSection = document.getElementById('sb-user');
    if (userSection && !userSection.contains(e.target)) {
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
  'mofu-closedwon': {
    name: 'Ventas Ganadas',
    formula: '',
    desc: 'Leads que llegaron a la etapa "Ventas Ganadas" del CRM en el período. Es la cantidad de cierres efectivos atribuidos a la campaña.',
    example: d => {
      // Tomar de status si está disponible, fallback a closed_won_leads
      let won = d.closed_won_leads || 0;
      if (d.status) {
        const idx = d.status.labels.indexOf('Ventas Ganadas');
        if (idx !== -1) won = d.status.data[idx] || 0;
      }
      const total = d.total_leads || 0;
      const conv = total > 0 ? (won / total * 100).toFixed(1) : '0.0';
      return `${_fn(won)} ventas ganadas sobre ${_fn(total)} leads del período = ${conv}% de conversión bruta.`;
    }
  },
  'bofu-revenue': {
    name: 'Ingresos Totales',
    formula: 'Suma de precio_final de las ventas cerradas en el período',
    desc: 'Total de ingresos generados por las ventas cerradas del cliente en el período. Solo incluye ventas de leads de campaña — las del vendedor (referidos, propios) van a un bloque separado.',
    example: d => {
      const rev = d.total_revenue || 0;
      const sales = d.closed_sales || 0;
      const ticket = sales > 0 ? rev / sales : 0;
      return `Se generaron ${_fc(rev)} con ${_fn(sales)} ventas. Ticket promedio: ${_fc(ticket)}.`;
    }
  },
  'bofu-sales': {
    name: 'Ventas Cerradas',
    formula: 'Cantidad de leads con is_closed=true en lead_monetary',
    desc: 'Cantidad total de ventas efectivamente cerradas en el período. Una venta se cuenta cuando el vendedor marcó la operación como concluida en MeisterTask.',
    example: d => {
      const sales = d.closed_sales || 0;
      const prevSales = d.prev?.closed_sales || 0;
      const diff = prevSales > 0 ? ((sales - prevSales) / prevSales * 100).toFixed(1) : null;
      const diffTxt = diff !== null ? ` (${diff >= 0 ? '+' : ''}${diff}% vs período anterior)` : '';
      return `${_fn(sales)} ventas cerradas en el período${diffTxt}.`;
    }
  },
  'bofu-capitas': {
    name: 'Cápitas Cerradas',
    formula: 'Suma de cápitas (titulares + grupo familiar) de cada venta',
    desc: 'Cantidad total de afiliados firmados — incluye al titular más todos los miembros del grupo familiar/empresa. Una venta puede sumar múltiples cápitas.',
    example: d => {
      const cap = d.capitas_closed || 0;
      const sales = d.closed_sales || 0;
      const ratio = sales > 0 ? (cap / sales).toFixed(2) : '0';
      return `${_fn(cap)} cápitas cerradas en ${_fn(sales)} ventas — ${ratio} cápitas promedio por venta.`;
    }
  },
  'bofu-ticket-capita': {
    name: 'Cápitas por Venta',
    formula: 'Cápitas cerradas ÷ Ventas cerradas',
    desc: 'Promedio de afiliados que se suman por cada venta cerrada. Una venta individual aporta como mínimo 1 cápita (el titular); si la venta incluye grupo familiar o empresa, el ratio sube. Útil para entender el tamaño promedio de cada operación.',
    example: d => {
      const cap   = d.capitas_closed || 0;
      const sales = d.closed_sales   || 0;
      const ratio = d.capitas_per_sale || (sales > 0 ? cap / sales : 0);
      return `${_fn(cap)} cápitas en ${_fn(sales)} ventas — ${ratio.toFixed(2)} cápitas promedio por venta.`;
    }
  },
  'roas': {
    name: 'ROAS — Retorno sobre Inversión Publicitaria',
    formula: 'Ingresos del período ÷ Inversión en ads del período',
    desc: 'Por cada $1 invertido en publicidad, cuánto dinero se generó en ventas. Un ROAS de 4.5x significa que cada peso invertido devolvió $4,50 en ingresos. 1x es el punto de equilibrio: por debajo se pierde plata, por encima se gana. Métrica unificada en todo el dashboard (Performance + BOFU).',
    example: d => {
      // Soporta ambos shapes: BOFU usa total_revenue/total_spend, Performance usa revenue/ad_spend.
      const rev   = d.total_revenue ?? d.revenue  ?? 0;
      const spend = d.total_spend   ?? d.ad_spend ?? 0;
      if (spend <= 0) return 'Sin inversión publicitaria registrada en el período — el ROAS no se puede calcular.';
      const roas = d.roas || (rev / spend);
      const net  = rev - spend;
      return `${_fc(rev)} en ventas con ${_fc(spend)} invertidos = ${roas.toFixed(2)}x de retorno. Ganancia neta: ${_fc(net)}.`;
    }
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

/** Clasifica un kpiKey por sección. Única fuente de verdad para ambos modales. */
function _kpiSection(kpiKey) {
  if (kpiKey.startsWith('tofu-')) return 'tofu';
  if (kpiKey.startsWith('mofu-')) return 'mofu';
  if (kpiKey.startsWith('bofu-') || (['revenue', 'sales', 'roas'].includes(kpiKey) && _currentSection === 'bofu')) return 'bofu';
  return 'performance';
}

function _renderModalChart(kpiKey) {
  if (window._kpiModalChartInstance) {
    window._kpiModalChartInstance.destroy();
    window._kpiModalChartInstance = null;
  }
  const ctx = document.getElementById('kpi-modal-chart');
  if (!ctx) return false;

  const section   = _kpiSection(kpiKey);
  const isTofuKey = section === 'tofu';
  const isMofuKey = section === 'mofu';
  const isBofuKey = section === 'bofu';

  let data;
  if (isTofuKey) {
    data = window._tofuData;
  } else if (isMofuKey) {
    data = window._mofuData;
  } else if (isBofuKey && window._bofuData) {
    data = window._bofuData;
  } else {
    data = window._kpiModalData;
  }
  if (!data || !data.trend) return false;

  const src     = data.trend.sparkline || data.trend;
  const labels  = src.labels || data.trend.labels || [];
  const spend   = src.spend   || data.trend.spend   || [];
  const revenue = src.revenue || data.trend.revenue || [];

  let values, color, label;
  const isUp = arr => arr[arr.length - 1] >= arr[0];

  if (kpiKey === 'revenue' && !isBofuKey) {
    // Performance section revenue (uses spend+revenue from summary)
    values = revenue; color = isUp(revenue) ? '#22C55E' : '#FF0040'; label = 'Ingreso';
  } else if (kpiKey === 'spend') {
    values = spend; color = !isUp(spend) ? '#22C55E' : '#EF4444'; label = 'Inversión';
  } else if (kpiKey === 'impressions') {
    const tot = revenue.reduce((a, b) => a + b, 0);
    values = revenue.map(r => tot > 0 ? Math.round((r / tot) * data.impressions) : 0);
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Impresiones';
  } else if (kpiKey === 'leads') {
    const tot = revenue.reduce((a, b) => a + b, 0);
    values = revenue.map(r => tot > 0 ? Math.round((r / tot) * data.leads) : 0);
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Leads';
  } else if (kpiKey === 'sales' && !isBofuKey) {
    // Performance section sales — usa revenue como proxy de distribución temporal.
    // Si revenue está todo en 0 (caso sin datos reales), usa distribución uniforme.
    const tot = revenue.reduce((a, b) => a + b, 0);
    if (tot > 0 && data.closed_sales > 0) {
      values = revenue.map(r => Math.round((r / tot) * data.closed_sales));
    } else {
      const pts = labels.length || 2;
      const perPt = data.closed_sales > 0 ? Math.round(data.closed_sales / pts) : 0;
      values = Array(pts).fill(perPt);
    }
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
  } else if (kpiKey === 'mofu-closedwon') {
    values = src.leads || data.trend.leads || [];
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Leads (proxy ventas ganadas)';
  } else if (kpiKey === 'bofu-revenue' || (kpiKey === 'revenue' && isBofuKey)) {
    values = data.trend.revenue || [];
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Ingresos';
  } else if (kpiKey === 'bofu-sales' || (kpiKey === 'sales' && isBofuKey)) {
    values = data.trend.sales || [];
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Ventas';
  } else if (kpiKey === 'bofu-ticket') {
    // Ticket = revenue / sales por punto — si no existen ambos, usar revenue como proxy
    const rev   = data.trend.revenue || [];
    const sales = data.trend.sales   || [];
    values = rev.map((r, i) => sales[i] > 0 ? Math.round(r / sales[i]) : 0);
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Ticket promedio';
  } else if (kpiKey === 'bofu-conversion') {
    // Conversión por punto: proporción relativa de ventas
    values = data.trend.sales || [];
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Ventas (proxy conversión)';
  } else if (kpiKey === 'bofu-capitas') {
    // Cápitas: proporción de sales escalada por ratio total
    const salesArr = data.trend.sales || [];
    const ratio    = data.closed_sales > 0 ? (data.capitas_closed / data.closed_sales) : 1;
    values = salesArr.map(s => Math.round(s * ratio));
    color = isUp(values) ? '#22C55E' : '#FF0040'; label = 'Cápitas';
  } else if (kpiKey === 'bofu-ticket-capita') {
    // Cápitas/Venta: proxy con ratio total aplicado a la serie de ventas.
    const salesArr = data.trend.sales || [];
    const ratio    = data.closed_sales > 0 ? (data.capitas_closed / data.closed_sales) : 1;
    values = salesArr.map(_ => ratio);
    color = '#22C55E'; label = 'Cápitas/Venta';
  } else if (kpiKey === 'roas') {
    // ROAS = revenue / spend por punto. Si el trend tiene ambas series (caso
    // Performance), calculamos la serie real. Si solo tiene revenue (caso
    // BOFU, cuyo endpoint no devuelve spend en el trend), usamos revenue
    // como proxy visual y lo marcamos en el label.
    if (spend && spend.length && spend.length === revenue.length) {
      values = revenue.map((r, i) => spend[i] > 0 ? r / spend[i] : 0);
      label = 'ROAS';
    } else {
      values = revenue || [];
      label = 'Ingresos (proxy ROAS)';
    }
    color = isUp(values) ? '#22C55E' : '#FF0040';
  } else {
    return false;
  }

  if (!values || values.length < 2) return false;

  const fill = color === '#22C55E' ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)';

  const chartLabels = (isTofuKey || isMofuKey || isBofuKey)
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
              // bofu-ticket-capita ahora es ratio (cápitas/venta), NO moneda.
              const currencyKeys = ['tofu-cpc', 'mofu-cpl', 'bofu-revenue', 'bofu-ticket'];
              if (currencyKeys.includes(kpiKey)) return ` ${label}: $${Math.round(v).toLocaleString('es-AR')}`;
              if (kpiKey === 'roas') return ` ${label}: ${v.toFixed(2)}x`;
              if (kpiKey === 'bofu-ticket-capita') return ` ${label}: ${v.toFixed(2)} cap.`;
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
              if (kpiKey === 'roas') return v.toFixed(1) + 'x';
              if (kpiKey === 'bofu-ticket-capita') return v.toFixed(1);
              if (kpiKey === 'tofu-impressions' || kpiKey === 'tofu-clicks') {
                return v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v;
              }
              if (['tofu-cpc', 'mofu-cpl', 'bofu-ticket'].includes(kpiKey)) {
                return '$' + (v / 1000).toFixed(1) + 'k';
              }
              if (kpiKey === 'bofu-revenue') {
                return v >= 1000000 ? '$' + (v / 1000000).toFixed(1) + 'M' : '$' + (v / 1000).toFixed(0) + 'k';
              }
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

  const _sec = _kpiSection(kpiKey);
  let data;
  if (_sec === 'tofu')        data = window._tofuData   || window._kpiModalData || {};
  else if (_sec === 'mofu')   data = window._mofuData   || window._kpiModalData || {};
  else if (_sec === 'bofu')   data = window._bofuData   || window._kpiModalData || {};
  else                        data = window._kpiModalData || {};

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

  /* Period selector — sidebar buttons (.sb-period-btn) */
  document.querySelectorAll('.sb-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = btn.dataset.period;
      if (period === 'custom') {
        // Personalizado: toggle del panel inline (no activa período hasta que se aplica)
        _activatePeriod(btn);
        _toggleDatePicker();
        return;
      }
      // Al seleccionar otro período, cerrar el panel de fechas si estaba abierto
      _closeDatePicker();
      _activatePeriod(btn);
      _currentPeriod = period;
      localStorage.setItem('umoh:period', period);
      // Limpiar las fechas custom guardadas — ya no aplican a este período.
      _currentCustomStart = '';
      _currentCustomEnd   = '';
      localStorage.removeItem('umoh:custom-start');
      localStorage.removeItem('umoh:custom-end');
      _updateInicioSubtitle(period);
      _updatePeriodRange(period);
      refreshDashboard(_currentSection, _currentPeriod);
    });
  });

  /* Histórico total — granularity buttons (eliminados del HTML; listener vacío por seguridad) */

  /* Apply custom date range */
  const applyBtn = document.getElementById('date-apply-btn');
  if (applyBtn) applyBtn.addEventListener('click', _applyCustomRange);

  /* Section navigation — sidebar items (.sb-nav-item) */
  document.querySelectorAll('.sb-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;

      if (section === _currentSection) {
        _closeMobileDrawer();
        return;
      }
      _activateSidebarNavItem(section);
      _activateSection(section);
      _currentSection = section;
      refreshDashboard(_currentSection, _currentPeriod, _periodParams());
      if (section === 'tofu') {
        setTimeout(() => { if (typeof invalidateGeoMap === 'function') invalidateGeoMap(); }, 350);
      }
      _closeMobileDrawer();
    });
  });

  /* Theme toggle — botón flotante (mantenido por compatibilidad, ahora oculto en sidebar layout) */
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', _toggleTheme);

  /* Theme toggle — botón en sidebar */
  const sbThemeBtn = document.getElementById('sb-theme-toggle');
  if (sbThemeBtn) sbThemeBtn.addEventListener('click', _toggleTheme);

  /* Dropdown de campañas */
  _initCampaignsDropdown();

  /* Dropdowns de canal del lead (BOFU + MOFU journey).
     Ambos selects comparten el mismo estado, persistido en localStorage.
     Al cambiar uno, el otro se sincroniza sin disparar un segundo evento,
     y se refresca tanto BOFU como MOFU para mantener coherencia. */
  const _CANAL_VALID = ['campaign', 'non_campaign', 'all'];

  async function _applyCanalFilter(v) {
    if (!_CANAL_VALID.includes(v)) return;
    localStorage.setItem('umoh:bofu_canal', v);

    const bofuEl = document.getElementById('bofu-canal-filter');
    const mofuEl = document.getElementById('mofu-canal-filter');
    if (bofuEl && bofuEl.value !== v) bofuEl.value = v;
    if (mofuEl && mofuEl.value !== v) mofuEl.value = v;

    // Refrescos secuenciales: refreshDashboard tiene un guard `if (_loading) return`,
    // así que dos llamadas back-to-back descartan la segunda. Awaiting garantiza
    // que ambas secciones (BOFU + MOFU) se actualicen siempre.
    // Priorizamos la sección activa para que el render visible llegue primero.
    const order = _currentSection === 'mofu' ? ['mofu', 'bofu'] : ['bofu', 'mofu'];
    for (const sec of order) {
      await refreshDashboard(sec, _currentPeriod, { ..._periodParams(), canal: v });
    }
  }

  const savedCanal = localStorage.getItem('umoh:bofu_canal');
  const initialCanal = (savedCanal && _CANAL_VALID.includes(savedCanal)) ? savedCanal : null;

  const bofuCanalEl = document.getElementById('bofu-canal-filter');
  if (bofuCanalEl) {
    if (initialCanal) bofuCanalEl.value = initialCanal;
    bofuCanalEl.addEventListener('change', () => _applyCanalFilter(bofuCanalEl.value));
  }

  const mofuCanalEl = document.getElementById('mofu-canal-filter');
  if (mofuCanalEl) {
    // El journey MOFU arranca en "Todos los canales" por defecto (vista histórica completa).
    // Si hay un valor guardado en localStorage, lo aplicamos también aquí.
    if (initialCanal) mofuCanalEl.value = initialCanal;
    mofuCanalEl.addEventListener('change', () => _applyCanalFilter(mofuCanalEl.value));
  }
}

/* ── Dropdown de campañas — trigger expandir/colapsar ────── */
function _initCampaignsDropdown() {
  const trigger = document.getElementById('sb-campaigns-trigger');
  const panel   = document.getElementById('sb-campaigns-panel');
  if (!trigger || !panel) return;

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = trigger.classList.contains('is-open');
    trigger.classList.toggle('is-open', !isOpen);
    panel.classList.toggle('is-open', !isOpen);
    trigger.setAttribute('aria-expanded', String(!isOpen));
  });

  // Click fuera cierra el dropdown
  document.addEventListener('click', e => {
    const section = document.getElementById('sb-campaigns-section');
    if (section && !section.contains(e.target)) {
      trigger.classList.remove('is-open');
      panel.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

/**
 * Actualiza el trigger del dropdown de campañas para reflejar la campaña activa.
 * Muestra nombre + meta (ID · Plataforma).
 */
function _updateCampaignsTrigger(id, name, platform) {
  const nameEl   = document.getElementById('sb-campaigns-active-name');
  const metaEl   = document.getElementById('sb-campaigns-active-meta');
  const trigger  = document.getElementById('sb-campaigns-trigger');

  if (id === 'all') {
    if (nameEl) nameEl.textContent = 'Todas las campañas';
    if (metaEl) metaEl.textContent = 'vista agregada';
    if (trigger) trigger.classList.remove('has-campaign');
  } else {
    if (nameEl) nameEl.textContent = name || id;
    const platformLabel = _platformLabel(platform || 'google_ads');
    if (metaEl) metaEl.textContent = `${id} · ${platformLabel}`;
    if (trigger) trigger.classList.add('has-campaign');
  }
}

/**
 * Convierte el valor raw de plataforma a un label legible.
 * Fallback: 'google_ads' → 'Google Ads'.
 * NOTA: El endpoint /api/campaigns.php no incluye `platform` en el SELECT
 * actualmente — se necesita extender la query para incluir el campo desde
 * tofu_facts. Mientras tanto, se usa 'google_ads' como fallback.
 */
function _platformLabel(raw) {
  const map = {
    google_ads:  'Google Ads',
    google:      'Google Ads',
    meta:        'Meta Ads',
    meta_ads:    'Meta Ads',
    facebook:    'Meta Ads',
  };
  return map[String(raw).toLowerCase()] || 'Google Ads';
}

/* Actualiza el subtitle de la sección Inicio según el período activo */
function _updateInicioSubtitle(period) {
  const el = document.getElementById('inicio-subtitle');
  if (!el) return;
  const labels = {
    '7d':  'Esto es lo que pasó con tus campañas en los últimos 7 días',
    '30d': 'Esto es lo que pasó con tus campañas en los últimos 30 días',
    '90d': 'Esto es lo que pasó con tus campañas en los últimos 90 días',
    'custom': 'Esto es lo que pasó con tus campañas en el período seleccionado',
  };
  el.textContent = labels[period] || labels['30d'];
}

/* Calcula el rango de fechas (inclusive) cubierto por el período activo
   y lo muestra al lado del label "Período" en el sidebar. */
const _MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function _fmtFechaCorta(d) {
  return d.getDate() + ' ' + _MESES_ES[d.getMonth()];
}
function _fmtFechaCortaConYear(d) {
  return d.getDate() + ' ' + _MESES_ES[d.getMonth()] + ' ' + d.getFullYear();
}
function _updatePeriodRange(period) {
  const el   = document.getElementById('sb-period-range');
  const chip = document.getElementById('sb-period-range-chip');
  if (!el) return;
  const hoy = new Date();
  let desde, hasta;
  if (period === 'custom') {
    const s = document.getElementById('date-start');
    const e = document.getElementById('date-end');
    if (s && e && s.value && e.value) {
      desde = new Date(s.value + 'T00:00:00');
      hasta = new Date(e.value + 'T00:00:00');
    } else {
      el.textContent = '';
      if (chip) chip.style.display = 'none';
      return;
    }
  } else {
    const dias = parseInt(String(period).replace('d',''), 10) || 30;
    hasta = hoy;
    desde = new Date(hoy);
    desde.setDate(hoy.getDate() - (dias - 1));
  }
  if (chip) chip.style.display = '';
  const sameYear = desde.getFullYear() === hasta.getFullYear();
  el.textContent = sameYear
    ? _fmtFechaCorta(desde) + ' – ' + _fmtFechaCortaConYear(hasta)
    : _fmtFechaCortaConYear(desde) + ' – ' + _fmtFechaCortaConYear(hasta);
}

/* ── FAB scroll-to-top ──────────────────────────────────────
   En layout de sidebar, el nav-bar ya no existe — el FAB solo
   actúa como scroll-to-top. Aparece al superar el umbral. */
function initScrollNavBehavior() {
  const fab = document.getElementById('nav-fab');
  if (!fab) return;

  const SCROLL_THRESHOLD = 300;
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

/* ── Sidebar: toggle expandido / colapsado ───────────────────
   Estado persiste en localStorage('umoh:sidebar').
   Default: expandido ('expanded'). */
function initSidebar() {
  const collapseBtn = document.getElementById('sb-collapse-btn');
  const hamburger   = document.getElementById('sb-hamburger');

  // Restaurar estado (el .sidebar-collapsed ya fue aplicado en <head>
  // antes de que el DOM cargara, para evitar flash — solo sincronizamos
  // el aria-label del botón).
  _syncCollapseBtn();

  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem('umoh:sidebar', isCollapsed ? 'collapsed' : 'expanded');
      _syncCollapseBtn();

      // Al colapsar: limpiar los inline styles del resize para que las reglas
      // CSS de .sidebar-collapsed tomen el control sin interferencia.
      // Al expandir: restaurar el ancho guardado por el resize (si existe).
      const sidebar = document.getElementById('dashboard-sidebar');
      const content = document.getElementById('dashboard-content');
      if (isCollapsed) {
        if (sidebar) sidebar.style.width = '';
        if (content) {
          content.style.marginLeft = '';
          content.style.width      = '';
        }
        document.documentElement.style.removeProperty('--sb-width');
      } else {
        // Expandido: restaurar el ancho de resize si hay uno guardado
        const savedW = parseInt(localStorage.getItem('umoh:sidebar-width'), 10);
        if (sidebar && content && savedW && savedW >= 220 && savedW <= 360) {
          _applySidebarWidth(savedW, sidebar, content);
        }
      }
      // Sincronizar visibilidad del handle de resize
      _syncResizeHandle();
    });
  }

  // Mobile hamburger: abre/cierra el drawer
  if (hamburger) {
    hamburger.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = document.body.classList.toggle('sidebar-mobile-open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Click en el overlay (::before del body) cierra el drawer en mobile
  document.addEventListener('click', e => {
    if (!document.body.classList.contains('sidebar-mobile-open')) return;
    const sidebar = document.getElementById('dashboard-sidebar');
    const hamburgerEl = document.getElementById('sb-hamburger');
    if (sidebar && !sidebar.contains(e.target) && e.target !== hamburgerEl) {
      _closeMobileDrawer();
    }
  });

  // Escape cierra el drawer en mobile
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') _closeMobileDrawer();
  });
}

function _syncCollapseBtn() {
  const btn = document.getElementById('sb-collapse-btn');
  if (!btn) return;
  const isCollapsed = document.body.classList.contains('sidebar-collapsed');
  btn.setAttribute('aria-label', isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar');
  btn.setAttribute('title',      isCollapsed ? 'Expandir'         : 'Colapsar');
}

/**
 * Oculta/muestra el resize handle según el estado colapsado del sidebar.
 * El handle no debe ser interactuable cuando el sidebar está colapsado.
 */
function _syncResizeHandle() {
  const handle = document.getElementById('sb-resize-handle');
  if (!handle) return;
  const isCollapsed = document.body.classList.contains('sidebar-collapsed');
  handle.style.display = isCollapsed ? 'none' : '';
}

function _closeMobileDrawer() {
  document.body.classList.remove('sidebar-mobile-open');
  const hamburger = document.getElementById('sb-hamburger');
  if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
}

/* ── Selector de campaña en sidebar (Sprint UX 2.0) ─────────
   Reemplaza el dropdown del header por una lista vertical en el sidebar.
   Reutiliza _currentCampaignId / _currentCampaignName y localStorage.
   Búsqueda integrada aparece automáticamente si hay >10 campañas. */
function initCampaignSelector() {
  const list       = document.getElementById('sb-campaign-list');
  const searchWrap = document.getElementById('sb-campaign-search');
  const searchInput= document.getElementById('sb-campaign-search-input');
  if (!list) return;

  function _setSelectedUI(id) {
    list.querySelectorAll('.sb-campaign-item').forEach(item => {
      const active = item.dataset.campaignId === id;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function _selectCampaign(id, name, platform) {
    _currentCampaignId   = id;
    _currentCampaignName = name || '';
    localStorage.setItem('umoh:campaign_id',   id);
    localStorage.setItem('umoh:campaign_name', _currentCampaignName);
    _setSelectedUI(id);
    // Actualizar el trigger del dropdown con la selección
    _updateCampaignsTrigger(id, _currentCampaignName, platform);
    // Cerrar el panel del dropdown
    const trigger = document.getElementById('sb-campaigns-trigger');
    const panel   = document.getElementById('sb-campaigns-panel');
    if (trigger) { trigger.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); }
    if (panel)   panel.classList.remove('is-open');

    refreshDashboard(_currentSection, _currentPeriod, _periodParams());
    _closeMobileDrawer();
  }

  // Event delegation sobre la lista de campañas
  list.addEventListener('click', e => {
    const item = e.target.closest('.sb-campaign-item');
    if (!item) return;
    const id       = item.dataset.campaignId;
    const name     = item.dataset.campaignName || item.querySelector('.sb-campaign-name')?.textContent || '';
    const platform = item.dataset.platform || '';
    _selectCampaign(id, name, platform);
  });

  // Búsqueda: filtra las opciones en tiempo real
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      list.querySelectorAll('.sb-campaign-item').forEach(item => {
        const n = (item.querySelector('.sb-campaign-name')?.textContent || '').toLowerCase();
        item.style.display = (!q || n.includes(q)) ? '' : 'none';
      });
    });
  }

  // Cargar la lista desde el backend y popular la lista del sidebar
  fetchData('campaigns', {})
    .then(resp => {
      const campaigns = (resp && resp.campaigns) || [];
      // Mostrar búsqueda si hay muchas campañas
      if (searchWrap && campaigns.length > 10) searchWrap.style.display = '';

      campaigns.forEach(c => {
        const item = document.createElement('button');
        item.className = 'sb-campaign-item';
        item.type = 'button';
        item.dataset.campaignId   = c.id;
        item.dataset.campaignName = c.name;
        // Incluir plataforma si el backend la provee — fallback a 'google_ads'
        item.dataset.platform = c.platform || 'google_ads';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        const platformLabel = _platformLabel(c.platform || 'google_ads');
        item.innerHTML = `
          <svg class="sb-campaign-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          <div class="sb-campaign-info sb-label">
            <span class="sb-campaign-name">${_escape(c.name)}</span>
            <span class="sb-campaign-id">${_escape(c.id)} · ${_escape(platformLabel)}</span>
          </div>
        `;
        list.appendChild(item);
      });

      // Reconciliar persistencia con la lista recibida
      if (_currentCampaignId !== 'all') {
        const found = campaigns.find(c => c.id === _currentCampaignId);
        if (!found) {
          _currentCampaignId   = 'all';
          _currentCampaignName = '';
          localStorage.setItem('umoh:campaign_id',   'all');
          localStorage.setItem('umoh:campaign_name', '');
        } else {
          _currentCampaignName = found.name;
          localStorage.setItem('umoh:campaign_name', found.name);
          // Actualizar el trigger con los datos completos
          _updateCampaignsTrigger(_currentCampaignId, found.name, found.platform || 'google_ads');
        }
      }
      _setSelectedUI(_currentCampaignId);
    })
    .catch(() => {
      // Fallback silencioso: solo "Todas las campañas" queda activa
      _setSelectedUI('all');
    });
}

function _escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/* ── Sidebar resize arrastrable ─────────────────────────────
   Permite ajustar el ancho del sidebar entre 220 y 360 px.
   El ancho se persiste en localStorage('umoh:sidebar-width').
   En mobile (<768px) el resize no aplica.
   El resize NO se aplica cuando el sidebar está colapsado. */
function initSidebarResize() {
  const sidebar = document.getElementById('dashboard-sidebar');
  const handle  = document.getElementById('sb-resize-handle');
  const content = document.getElementById('dashboard-content');
  if (!sidebar || !handle || !content) return;

  const SB_MIN   = 220;
  const SB_MAX   = 360;
  const SB_KEY   = 'umoh:sidebar-width';

  /* Sincronizar handle: ocultarlo si sidebar empieza colapsado */
  _syncResizeHandle();

  /* Restaurar ancho guardado — solo si el sidebar NO está colapsado */
  const saved = parseInt(localStorage.getItem(SB_KEY), 10);
  if (saved && saved >= SB_MIN && saved <= SB_MAX) {
    if (!document.body.classList.contains('sidebar-collapsed')) {
      _applySidebarWidth(saved, sidebar, content);
    }
  }

  let dragging = false;
  let startX   = 0;
  let startW   = 0;

  handle.addEventListener('mousedown', e => {
    if (window.innerWidth <= 768) return;
    /* No iniciar resize si el sidebar está colapsado */
    if (document.body.classList.contains('sidebar-collapsed')) return;
    dragging = true;
    startX   = e.clientX;
    startW   = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const newW  = Math.min(SB_MAX, Math.max(SB_MIN, startW + delta));
    _applySidebarWidth(newW, sidebar, content);
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    localStorage.setItem(SB_KEY, sidebar.offsetWidth);
  });
}

function _applySidebarWidth(w, sidebar, content) {
  const px = w + 'px';
  sidebar.style.width = px;
  content.style.marginLeft = px;
  content.style.width = 'calc(100% - ' + px + ')';
  /* Actualizar la variable CSS para que elementos como el date-picker
     que dependen de --sb-width se posicionen correctamente */
  document.documentElement.style.setProperty('--sb-width', px);
}

/* ── Bootstrap ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  _syncThemeLabel();
  initSidebar();
  initUserMenu();
  initFilters();
  initKpiModals();
  initScrollNavBehavior();
  initCampaignSelector();
  initSidebarResize();

  // Si se restauró un período custom desde localStorage, pre-rellenar los inputs
  // y activar visualmente el botón "Personalizado" para que el chip "MOSTRANDO"
  // se calcule correctamente con las fechas guardadas.
  if (_currentPeriod === 'custom' && _currentCustomStart && _currentCustomEnd) {
    const startInput = document.getElementById('date-start');
    const endInput   = document.getElementById('date-end');
    if (startInput) startInput.value = _currentCustomStart;
    if (endInput)   endInput.value   = _currentCustomEnd;
    const customBtn = document.getElementById('sb-period-custom-btn');
    if (customBtn) _activatePeriod(customBtn);
  } else if (_currentPeriod !== 'custom') {
    // Activar visualmente el botón del período restaurado
    const activeBtn = document.querySelector(`.sb-period-btn[data-period="${_currentPeriod}"]`);
    if (activeBtn) _activatePeriod(activeBtn);
  }

  _updatePeriodRange(_currentPeriod);

  refreshDashboard(_currentSection, _currentPeriod, _periodParams());
});
