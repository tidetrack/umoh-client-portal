/**
 * charts.js — Toda la lógica de render: Chart.js + Leaflet.
 * Consumir siempre a través de renderSection(section, data).
 *
 * Paleta compartida CHART_PALETTE — funciona en modo claro y oscuro.
 */

/* ── Paleta de colores compartida ──────────────────────── */
const CHART_PALETTE = {
  blue:   { solid: 'rgba(99,179,237,0.85)',  fill: 'rgba(99,179,237,0.15)'  },
  green:  { solid: 'rgba(72,199,142,0.85)',  fill: 'rgba(72,199,142,0.15)'  },
  amber:  { solid: 'rgba(251,191,36,0.85)',  fill: 'rgba(251,191,36,0.15)'  },
  purple: { solid: 'rgba(167,139,250,0.85)', fill: 'rgba(167,139,250,0.15)' },
  coral:  { solid: 'rgba(252,129,74,0.85)',  fill: 'rgba(252,129,74,0.15)'  },
  teal:   { solid: 'rgba(45,212,191,0.85)',  fill: 'rgba(45,212,191,0.15)'  },
};

/* ── Gran Mendoza inline GeoJSON (no fetch — works offline) ── */
const GRAN_MENDOZA_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { nombre: 'Capital' },
      geometry: { type: 'Polygon', coordinates: [[
        [-68.880, -32.870], [-68.820, -32.870], [-68.820, -32.840], [-68.860, -32.830], [-68.880, -32.850], [-68.880, -32.870]
      ]]}
    },
    {
      type: 'Feature',
      properties: { nombre: 'Godoy Cruz' },
      geometry: { type: 'Polygon', coordinates: [[
        [-68.880, -32.940], [-68.820, -32.940], [-68.820, -32.870], [-68.880, -32.870], [-68.880, -32.940]
      ]]}
    },
    {
      type: 'Feature',
      properties: { nombre: 'Guaymallén' },
      geometry: { type: 'Polygon', coordinates: [[
        [-68.820, -32.900], [-68.730, -32.900], [-68.730, -32.820], [-68.820, -32.820], [-68.820, -32.900]
      ]]}
    },
    {
      type: 'Feature',
      properties: { nombre: 'Las Heras' },
      geometry: { type: 'Polygon', coordinates: [[
        [-68.900, -32.830], [-68.820, -32.830], [-68.820, -32.750], [-68.900, -32.750], [-68.900, -32.830]
      ]]}
    },
    {
      type: 'Feature',
      properties: { nombre: 'Luján de Cuyo' },
      geometry: { type: 'Polygon', coordinates: [[
        [-68.980, -33.050], [-68.820, -33.050], [-68.820, -32.940], [-68.980, -32.940], [-68.980, -33.050]
      ]]}
    },
    {
      type: 'Feature',
      properties: { nombre: 'Maipú' },
      geometry: { type: 'Polygon', coordinates: [[
        [-68.820, -33.000], [-68.680, -33.000], [-68.680, -32.900], [-68.820, -32.900], [-68.820, -33.000]
      ]]}
    }
  ]
};

/* ── Chart registry ─────────────────────────────────────── */
const _charts = {};

function _destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

/* ── Línea de tendencia (regresión lineal simple) ─────────
   Calcula y = a + bx para la serie y devuelve un array con
   los valores de la recta de tendencia, mismo largo que el input.
   Usar como segundo dataset (type: 'line') en bar charts. */
function _trendLineData(values) {
  const n = values.length;
  if (n < 2) return values.slice();
  const xs = values.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + Number(b || 0), 0);
  const sumXY = xs.reduce((s, x, i) => s + x * Number(values[i] || 0), 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  const denom = sumX2 - n * meanX * meanX;
  const slope = denom === 0 ? 0 : (sumXY - n * meanX * meanY) / denom;
  const intercept = meanY - slope * meanX;
  return xs.map(x => intercept + slope * x);
}

/* Devuelve el dataset Chart.js de la línea de tendencia.
   color: opcional, usa accent UMOH por default. */
function _trendLineDataset(values, label = 'Tendencia', color = 'rgba(255, 0, 64, 0.85)') {
  return {
    type:             'line',
    label:            label,
    data:             _trendLineData(values),
    borderColor:      color,
    backgroundColor:  'transparent',
    borderWidth:      2,
    borderDash:       [6, 4],
    pointRadius:      0,
    pointHoverRadius: 0,
    fill:             false,
    tension:          0,
    order:            0,
    yAxisID:          'y',
  };
}

/* ── Formato numérico ──────────────────────────────────── */
function fmtCurrency(n) { return '$' + Math.round(n).toLocaleString('es-AR'); }
function fmtNumber(n)   { return Math.round(n).toLocaleString('es-AR'); }
function fmtPercent(n)  { return parseFloat(n).toFixed(1) + '%'; }

/* ── Setear KPI en DOM ─────────────────────────────────── */
function setKPI(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * Delta comparativo vs período anterior.
 * lowerIsBetter = true para métricas de costo (CPC, CPL, gasto).
 */
function _setDelta(id, current, prev, lowerIsBetter = false) {
  const el = document.getElementById(id);
  if (!el || !prev) return;
  const pct      = ((current - prev) / Math.abs(prev)) * 100;
  const isPositive = pct >= 0;
  const isGood     = lowerIsBetter ? !isPositive : isPositive;
  const arrow      = isPositive ? '↑' : '↓';
  el.textContent   = `${arrow} ${Math.abs(pct).toFixed(1)}% vs período anterior`;
  el.className     = 'kpi-delta ' + (isGood ? 'delta--good' : 'delta--bad');
}

/* ── Leer color CSS para modo oscuro/claro ─────────────── */
function _cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ── Opciones base para donuts ─────────────────────────── */
function _donutOpts() {
  return {
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { family: 'Outfit', size: 12 },
          color: _cssVar('--text-secondary'),
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 10
        }
      },
      tooltip: {
        callbacks: {
          label: ctx => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            return ` ${ctx.label}: ${fmtNumber(ctx.parsed)} (${fmtPercent(ctx.parsed / total * 100)})`;
          }
        }
      }
    },
    cutout: '62%',
    responsive: true,
    maintainAspectRatio: true
  };
}

/* ── Opciones base para ejes compartidos ───────────────── */
function _axisDefaults() {
  const muted = _cssVar('--text-muted');
  return {
    ticks:  { font: { family: 'Outfit', size: 11 }, color: muted },
    grid:   { color: _cssVar('--border-subtle') },
    border: { dash: [4, 4] }
  };
}

/* ── Chart.js global defaults ───────────────────────────── */
Chart.defaults.font.family = 'Outfit';

/* ══════════════════════════════════════════════════════════
   COMMERCIAL SUMMARY — helper para Performance
══════════════════════════════════════════════════════════ */

/**
 * Renders the commercial summary strip in the Performance section.
 * @param {object} s - sellers_summary object from performance data
 */
function _renderCommercialSummary(s) {
  const el = document.getElementById('commercial-summary');
  if (!el || !s) return;
  const p = s.prev || {};

  function mini(curr, prev, lowerBetter, fmt) {
    if (prev == null || prev === 0) return '';
    const pct  = ((curr - prev) / Math.abs(prev)) * 100;
    const good = lowerBetter ? pct <= 0 : pct >= 0;
    const cls  = Math.abs(pct) < 0.5 ? 'cs-flat' : (good ? 'cs-up' : 'cs-down');
    return '<span class="cs-delta ' + cls + '">' + (pct >= 0 ? '↑' : '↓') + ' ' + Math.abs(pct).toFixed(1) + '%</span>';
  }

  el.innerHTML =
    '<div class="cs-grid">' +
      '<div class="cs-item">' +
        '<span class="cs-label">Mejor Vendedor</span>' +
        '<span class="cs-value cs-value--name">' + s.top_seller + '</span>' +
        (p.top_seller && p.top_seller !== s.top_seller
          ? '<span class="cs-delta cs-flat">ant. ' + p.top_seller + '</span>'
          : '<span class="cs-delta cs-flat">—</span>') +
      '</div>' +
      '<div class="cs-item">' +
        '<span class="cs-label">Efectividad Promedio</span>' +
        '<span class="cs-value">' + fmtPercent(s.avg_effectiveness) + '</span>' +
        mini(s.avg_effectiveness, p.avg_effectiveness, false) +
      '</div>' +
      '<div class="cs-item">' +
        '<span class="cs-label">Ventas del Equipo</span>' +
        '<span class="cs-value">' + fmtNumber(s.total_sales) + '</span>' +
        mini(s.total_sales, p.total_sales, false) +
      '</div>' +
      '<div class="cs-item">' +
        '<span class="cs-label">Ciclo Promedio</span>' +
        '<span class="cs-value">' + s.avg_cycle_days.toFixed(1) + ' días</span>' +
        mini(s.avg_cycle_days, p.avg_cycle_days, true) +
      '</div>' +
      '<div class="cs-item">' +
        '<span class="cs-label">Ticket Promedio</span>' +
        '<span class="cs-value">' + fmtCurrency(s.avg_ticket) + '</span>' +
        mini(s.avg_ticket, p.avg_ticket, false) +
      '</div>' +
      '<div class="cs-item">' +
        '<span class="cs-label">Cápitas / Venta</span>' +
        '<span class="cs-value">' + (s.avg_capitas_per_sale ? s.avg_capitas_per_sale.toFixed(2) : '—') + '</span>' +
        (s.avg_capitas_per_sale ? mini(s.avg_capitas_per_sale, p.avg_capitas_per_sale, false) : '') +
      '</div>' +
    '</div>';
}

/* ══════════════════════════════════════════════════════════
   PERFORMANCE
══════════════════════════════════════════════════════════ */
function renderPerformance(data) {
  const prev = data.prev || {};

  const roi     = data.ad_spend  > 0 ? ((data.revenue - data.ad_spend) / data.ad_spend) * 100 : 0;
  const prevRoi = prev.ad_spend  > 0 ? ((prev.revenue - prev.ad_spend) / prev.ad_spend) * 100 : 0;

  setKPI('kpi-revenue',     fmtCurrency(data.revenue));
  setKPI('kpi-spend',       fmtCurrency(data.ad_spend));
  setKPI('kpi-roi',         fmtPercent(roi));
  setKPI('kpi-impressions', fmtNumber(data.impressions));
  setKPI('kpi-leads',       fmtNumber(data.leads));
  setKPI('kpi-sales',       fmtNumber(data.closed_sales));

  _setDelta('delta-revenue',     data.revenue,      prev.revenue);
  _setDelta('delta-spend',       data.ad_spend,     prev.ad_spend,    true);
  _setDelta('delta-roi',         roi,               prevRoi);
  _setDelta('delta-impressions', data.impressions,  prev.impressions);
  _setDelta('delta-leads',       data.leads,        prev.leads);
  _setDelta('delta-sales',       data.closed_sales, prev.closed_sales);

  renderSparklines(data);

  if (data.sellers_summary) _renderCommercialSummary(data.sellers_summary);

  /* ── Two independent bar charts: Ingresos / Inversión ── */
  _destroyChart('chart-trend');
  _destroyChart('chart-perf-revenue');
  _destroyChart('chart-perf-spend');

  const ctxPR = document.getElementById('chart-perf-revenue');
  if (ctxPR && data.trend) {
    const axis = _axisDefaults();
    _charts['chart-perf-revenue'] = new Chart(ctxPR, {
      type: 'bar',
      data: {
        labels: data.trend.labels,
        datasets: [{
          label: 'Ingresos', data: data.trend.revenue,
          backgroundColor: CHART_PALETTE.green.solid,
          borderRadius: 4, borderSkipped: false,
          barPercentage: 0.6, categoryPercentage: 0.7,
          order: 1,
        }, _trendLineDataset(data.trend.revenue)]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` Ingresos: ${fmtCurrency(ctx.parsed.y)}` } } },
        scales: {
          y: { ...axis, ticks: { ...axis.ticks, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } },
          x: { ...axis, grid: { display: false } }
        }
      }
    });
  }

  const ctxPS = document.getElementById('chart-perf-spend');
  if (ctxPS && data.trend) {
    const axis = _axisDefaults();
    _charts['chart-perf-spend'] = new Chart(ctxPS, {
      type: 'bar',
      data: {
        labels: data.trend.labels,
        datasets: [{
          label: 'Inversión', data: data.trend.spend,
          backgroundColor: CHART_PALETTE.coral.solid,
          borderRadius: 4, borderSkipped: false,
          barPercentage: 0.6, categoryPercentage: 0.7,
          order: 1,
        }, _trendLineDataset(data.trend.spend)]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` Inversión: ${fmtCurrency(ctx.parsed.y)}` } } },
        scales: {
          y: { ...axis, ticks: { ...axis.ticks, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } },
          x: { ...axis, grid: { display: false } }
        }
      }
    });
  }

  window._kpiModalData = data;
}

/* ══════════════════════════════════════════════════════════
   TOFU
══════════════════════════════════════════════════════════ */

/**
 * Renders the search terms table.
 * @param {object[]} terms - array of search term objects
 * @param {'clicks'|'impressions'} mode - which metric to display
 */
function _renderSearchTerms(terms, mode) {
  const tbody = document.getElementById('search-terms-body');
  const colHeader = document.getElementById('terms-col-header');
  if (!tbody || !terms) return;

  const colors = [
    CHART_PALETTE.blue.solid, CHART_PALETTE.teal.solid, CHART_PALETTE.purple.solid,
    CHART_PALETTE.amber.solid, CHART_PALETTE.coral.solid, CHART_PALETTE.green.solid,
    CHART_PALETTE.blue.solid, CHART_PALETTE.teal.solid
  ];

  if (colHeader) colHeader.textContent = mode === 'impressions' ? 'Impresiones' : 'Clicks';

  tbody.innerHTML = terms.map((row, i) => {
    const pct   = mode === 'impressions' ? (row.pct_imp || row.pct) : row.pct;
    const value = mode === 'impressions' ? (row.impressions || 0) : row.clicks;
    return `
      <tr>
        <td class="term-name">${row.term}</td>
        <td class="term-bar">
          <div class="bar-wrap">
            <div class="bar-fill" style="width:${pct}%; background:${colors[i % colors.length]}; opacity:0.85;"></div>
          </div>
        </td>
        <td class="term-clicks">${fmtNumber(value)}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Renders the channels doughnut chart.
 * @param {object} data - full TOFU data object
 * @param {'clicks'|'impressions'} mode - which dataset to display
 */
function _renderChannels(data, mode) {
  _destroyChart('chart-channels');
  const ctxCh = document.getElementById('chart-channels');
  if (!ctxCh) return;

  const chColors = ['blue', 'teal', 'amber', 'purple', 'coral'].map(k => CHART_PALETTE[k].solid);
  const dataset  = mode === 'impressions' && data.channels_imp
    ? data.channels_imp
    : data.channels;

  _charts['chart-channels'] = new Chart(ctxCh, {
    type: 'doughnut',
    data: {
      labels:   dataset.labels,
      datasets: [{ data: dataset.data, backgroundColor: chColors, borderWidth: 0, hoverOffset: 8 }]
    },
    options: _donutOpts()
  });
}

/**
 * Renders the devices doughnut chart.
 * @param {object} data - full TOFU data object
 * @param {'clicks'|'impressions'} mode - which dataset to display
 */
function _renderDevices(data, mode) {
  _destroyChart('chart-devices');
  const ctxDev = document.getElementById('chart-devices');
  if (!ctxDev) return;

  const devColors = ['purple', 'amber', 'coral'].map(k => CHART_PALETTE[k].solid);
  const dataset   = mode === 'impressions' && data.devices_imp
    ? data.devices_imp
    : data.devices;

  _charts['chart-devices'] = new Chart(ctxDev, {
    type: 'doughnut',
    data: {
      labels:   dataset.labels,
      datasets: [{ data: dataset.data, backgroundColor: devColors, borderWidth: 0, hoverOffset: 8 }]
    },
    options: _donutOpts()
  });
}

function renderTofu(data) {
  window._tofuData = data;

  const prev = data.prev || {};

  setKPI('tofu-impressions', fmtNumber(data.impressions));
  setKPI('tofu-clicks',      fmtNumber(data.clicks));
  setKPI('tofu-cpc',         fmtCurrency(data.cpc));

  _setDelta('delta-tofu-impressions', data.impressions, prev.impressions);
  _setDelta('delta-tofu-clicks',      data.clicks,      prev.clicks);
  _setDelta('delta-tofu-cpc',         data.cpc,         prev.cpc, true);

  /* ── Sparklines for TOFU KPI cards ── */
  if (data.trend) {
    const t   = data.trend;
    const isUp = arr => arr[arr.length - 1] >= arr[0];
    _renderSparkline('sparkline-tofu-impressions', t.impressions, isUp(t.impressions), t.labels || []);
    _renderSparkline('sparkline-tofu-clicks',      t.clicks,      isUp(t.clicks),      t.labels || []);
    /* CPC: more clicks = lower CPC = good — invert direction */
    _renderSparkline('sparkline-tofu-cpc',         t.clicks,      isUp(t.clicks),      t.labels || []);
  }

  /* ── Trend: split into 2 separate bar charts ── */
  _destroyChart('chart-tofu-trend');
  _destroyChart('chart-tofu-impressions');
  _destroyChart('chart-tofu-clicks');

  const ctxImp = document.getElementById('chart-tofu-impressions');
  if (ctxImp && data.trend) {
    const axis = _axisDefaults();
    _charts['chart-tofu-impressions'] = new Chart(ctxImp, {
      type: 'bar',
      data: {
        labels: data.trend.labels,
        datasets: [{
          label:              'Impresiones',
          data:               data.trend.impressions,
          backgroundColor:    CHART_PALETTE.blue.solid,
          borderRadius:       4,
          borderSkipped:      false,
          barPercentage:      0.6,
          categoryPercentage: 0.7,
          order:              1,
        }, _trendLineDataset(data.trend.impressions)]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` Impresiones: ${fmtNumber(ctx.parsed.y)}` } }
        },
        scales: {
          y: { ...axis, ticks: { ...axis.ticks, callback: v => (v / 1000).toFixed(0) + 'k' } },
          x: { ...axis, grid: { display: false } }
        }
      }
    });
  }

  const ctxClk = document.getElementById('chart-tofu-clicks');
  if (ctxClk && data.trend) {
    const axis = _axisDefaults();
    _charts['chart-tofu-clicks'] = new Chart(ctxClk, {
      type: 'bar',
      data: {
        labels: data.trend.labels,
        datasets: [{
          label:              'Clicks',
          data:               data.trend.clicks,
          backgroundColor:    CHART_PALETTE.teal.solid,
          borderRadius:       4,
          borderSkipped:      false,
          barPercentage:      0.6,
          categoryPercentage: 0.7,
          order:              1,
        }, _trendLineDataset(data.trend.clicks)]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` Clicks: ${fmtNumber(ctx.parsed.y)}` } }
        },
        scales: {
          y: { ...axis, ticks: { ...axis.ticks, callback: v => fmtNumber(v) } },
          x: { ...axis, grid: { display: false } }
        }
      }
    });
  }

  /* ── Search terms table (default: clicks) ── */
  const termsFilter = document.getElementById('terms-filter');
  _renderSearchTerms(data.search_terms, termsFilter ? termsFilter.value : 'clicks');

  /* ── Channels donut ── */
  const chFilter = document.getElementById('channels-filter');
  _renderChannels(data, chFilter ? chFilter.value : 'clicks');

  /* ── Devices donut ── */
  const devFilter = document.getElementById('devices-filter');
  _renderDevices(data, devFilter ? devFilter.value : 'clicks');

  /* ── Geo: tabla rankeada de ciudades por clicks ── */
  if (data.geo) _renderGeoTable(data.geo);

  /* ── Wire up filter dropdowns (idempotent: replaces listener on each render) ── */
  const termsEl = document.getElementById('terms-filter');
  if (termsEl) {
    termsEl.onchange = () => _renderSearchTerms(window._tofuData.search_terms, termsEl.value);
  }

  const chEl = document.getElementById('channels-filter');
  if (chEl) {
    chEl.onchange = () => _renderChannels(window._tofuData, chEl.value);
  }

  const devEl = document.getElementById('devices-filter');
  if (devEl) {
    devEl.onchange = () => _renderDevices(window._tofuData, devEl.value);
  }
}

/* ── Geo: tabla ranking por clicks ──────────────────────── */
function _renderGeoTable(geoData) {
  const tbody = document.getElementById('geo-table-body');
  if (!tbody) return;

  const entries = Object.entries(geoData || {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="geo-empty">Sin datos geográficos en el período</td></tr>';
    return;
  }

  const max = entries[0][1];
  const colors = [
    CHART_PALETTE.blue.solid,  CHART_PALETTE.teal.solid,   CHART_PALETTE.purple.solid,
    CHART_PALETTE.amber.solid, CHART_PALETTE.coral.solid,  CHART_PALETTE.green.solid,
  ];

  tbody.innerHTML = entries.map(([city, clicks], i) => {
    const pct   = max > 0 ? Math.round((clicks / max) * 100) : 0;
    const color = colors[i % colors.length];
    return `
      <tr>
        <td class="geo-rank">${i + 1}</td>
        <td class="geo-city">${city}</td>
        <td class="geo-bar">
          <div class="bar-wrap"><div class="bar-fill" style="width:${pct}%; background:${color}; opacity:0.85;"></div></div>
        </td>
        <td class="geo-clicks">${fmtNumber(clicks)}</td>
      </tr>
    `;
  }).join('');
}

// Stub para compatibilidad con código que llama a invalidateGeoMap (filters.js de tabs)
function invalidateGeoMap() { /* no-op: geo es tabla, no mapa */ }

/* ══════════════════════════════════════════════════════════
   CUSTOMER JOURNEY — helper aislado
   Llamado desde renderMofu(). Función separada para que el
   return del re-render incremental no corte el render del donut.

   Iteración 5:
   - "Tareas Finalizadas" filtrado del display (irrelevante para el cliente)
   - Paleta semántica por label (robusta a reordenamientos del backend)
   - Barras de 240px de alto, 68px de ancho máximo
   - Stagger entrance: cada barra crece con delay incremental
   - Re-render incremental: cambio de período anima alturas in-place
   - Tooltip flotante: label + valor + porcentaje + sub-fase
   - Banda de sub-fases debajo del header (Entrada / Seguimiento / ...)
   - prefers-reduced-motion: sin animaciones si está activo
══════════════════════════════════════════════════════════ */

// Paleta semántica: color por nombre de etapa (no por posición).
// Familia azul = entrada/seguimiento, ámbar = alta intención,
// púrpura = incubando, verde/rojo/gris = resultados.
const _JOURNEY_COLORS = {
  'Inbox':           'rgba(99,179,237,0.55)',
  'Nuevo':           'rgba(99,179,237,0.82)',
  'Prioritarios':    'rgba(251,191,36,0.78)',
  'Para Hoy':        'rgba(66,153,225,0.78)',
  'Procesando':      'rgba(66,153,225,0.92)',
  'Contactados':     'rgba(49,130,206,1.00)',
  'Cotizados':       'rgba(251,191,36,0.92)',
  'En Auditoria':    'rgba(245,158,11,1.00)',
  'Mes que viene':   'rgba(167,139,250,0.72)',
  'A futuro':        'rgba(167,139,250,0.94)',
  'Ventas Ganadas':  'rgba(72,199,142,0.85)',
  'No prospera':     'rgba(245,101,101,0.88)',
  'Erroneos':        'rgba(160,174,192,0.68)',
};

// Sub-fase de cada etapa (para el tooltip y la banda visual)
const _JOURNEY_PHASE_MAP = {
  'Inbox':          { name: 'Entrada',        color: '#63b3ed' },
  'Nuevo':          { name: 'Entrada',        color: '#63b3ed' },
  'Para Hoy':       { name: 'Seguimiento',    color: '#4299e1' },
  'Procesando':     { name: 'Seguimiento',    color: '#4299e1' },
  'Contactados':    { name: 'Seguimiento',    color: '#4299e1' },
  'Prioritarios':   { name: 'Alta intención', color: '#f6ad55' },
  'Cotizados':      { name: 'Alta intención', color: '#f6ad55' },
  'En Auditoria':   { name: 'Alta intención', color: '#f6ad55' },
  'Mes que viene':  { name: 'Incubando',      color: '#b794f4' },
  'A futuro':       { name: 'Incubando',      color: '#b794f4' },
  'Ventas Ganadas': { name: 'Resultado',      color: '#68d391' },
  'No prospera':    { name: 'Resultado',      color: '#fc8181' },
  'Erroneos':       { name: 'Resultado',      color: '#a0aec0' },
};

// Configuración de las bandas de sub-fases (cols = número de columnas del journey en esa fase)
const _JOURNEY_PHASES_DEF = [
  { name: 'Entrada',        color: '#63b3ed', cols: 2 },
  { name: 'Seguimiento',    color: '#4299e1', cols: 3 },
  { name: 'Alta intención', color: '#f6ad55', cols: 3 },
  { name: 'Incubando',      color: '#b794f4', cols: 2 },
  { name: 'Resultado',      color: '#68d391', cols: 3 },
];

/**
 * Renderiza el Customer Journey horizontal en la sección MOFU.
 * Llamado siempre desde renderMofu().
 * @param {object} data - objeto de datos MOFU completo (necesita data.status)
 */
function _renderJourney(data) {
  _destroyChart('chart-status');
  const ctxSt = document.getElementById('chart-status');
  if (!ctxSt || !data.status) return;

  // Limpiar variantes históricas (SVG funnel, funnel tip)
  const prevSvg = ctxSt.parentElement.querySelector('.umoh-funnel');
  if (prevSvg) prevSvg.remove();
  const prevTip = document.getElementById('umoh-funnel-tip');
  if (prevTip) prevTip.remove();
  ctxSt.style.display = 'none';

  // Filtrar "Tareas Finalizadas" — columna excluida del display del cliente
  const filteredPairs = data.status.labels.reduce((acc, lbl, i) => {
    if (lbl !== 'Tareas Finalizadas') {
      acc.push({ label: lbl, val: data.status.data[i] || 0 });
    }
    return acc;
  }, []);

  const labels       = filteredPairs.map(p => p.label);
  const vals         = filteredPairs.map(p => p.val);
  const total        = vals.reduce((a, b) => a + b, 0);
  const maxVal       = Math.max(...vals, 1);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── RE-RENDER INCREMENTAL ──────────────────────────────────
     Si la wrap ya existe (el usuario cambió el período),
     actualizar alturas y valores sin reconstruir el DOM.
     Esto permite que las barras transicionen suavemente al nuevo valor. */
  const existingWrap = ctxSt.parentElement.querySelector('.journey-wrap');
  if (existingWrap) {
    const existingBars = existingWrap.querySelectorAll('.journey-bar');
    const existingCols = existingWrap.querySelectorAll('.journey-col');

    existingCols.forEach((col, i) => {
      if (i >= labels.length) return;
      const v     = vals[i];
      const pct   = total > 0 ? (v / total) * 100 : 0;
      const barH  = Math.max((v / maxVal) * 100, v > 0 ? 5 : 0);
      const bar   = existingBars[i];
      const color = _JOURNEY_COLORS[labels[i]] || 'rgba(143,165,168,0.65)';

      if (bar) {
        bar.style.background = color;
        if (reducedMotion) {
          bar.style.height = barH.toFixed(1) + '%';
        } else {
          bar.style.transition = 'height 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s ease, box-shadow 0.15s ease';
          bar.style.height     = barH.toFixed(1) + '%';
        }
      }

      const valEl = col.querySelector('.journey-col-value');
      const pctEl = col.querySelector('.journey-col-pct');
      if (valEl) valEl.textContent = fmtNumber(v);
      if (pctEl) pctEl.textContent = pct.toFixed(1) + '%';
    });

    const headerVal = existingWrap.querySelector('.journey-header-value');
    if (headerVal) headerVal.textContent = fmtNumber(total);
    return; // No reconstruir el DOM
  }

  /* ── PRIMER RENDER: construir el DOM completo ─────────────── */

  // Tooltip flotante global (único, compartido por todas las columnas)
  let tip = document.getElementById('journey-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id        = 'journey-tooltip';
    tip.className = 'journey-tooltip';
    tip.setAttribute('aria-hidden', 'true');
    tip.innerHTML =
      '<span class="journey-tooltip-label"></span>' +
      '<span class="journey-tooltip-value"></span>' +
      '<span class="journey-tooltip-pct"></span>' +
      '<span class="journey-tooltip-phase"></span>';
    document.body.appendChild(tip);
  }

  function showTip(col, label, val, pctFmt) {
    const phase  = _JOURNEY_PHASE_MAP[label] || { name: '', color: '#8FA5A8' };
    const rect   = col.getBoundingClientRect();
    const tipW   = 200;
    let   left   = rect.left + rect.width / 2 - tipW / 2;
    const top    = rect.top - 10;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));

    tip.querySelector('.journey-tooltip-label').textContent = label;
    tip.querySelector('.journey-tooltip-value').textContent = fmtNumber(val);
    tip.querySelector('.journey-tooltip-pct').textContent   = pctFmt + ' del total';
    const phaseEl = tip.querySelector('.journey-tooltip-phase');
    phaseEl.textContent = phase.name;
    phaseEl.style.color = phase.color;

    tip.style.position = 'absolute';
    tip.style.left     = left + 'px';
    tip.style.top      = (top + window.scrollY) + 'px';
    tip.classList.add('is-visible');
  }

  function hideTip() {
    tip.classList.remove('is-visible');
  }

  // Contenedor principal
  const wrap = document.createElement('div');
  wrap.className = 'journey-wrap';

  // Header: Total leads
  const header = document.createElement('div');
  header.className = 'journey-header';
  header.innerHTML =
    '<span class="journey-header-label">Total leads</span>' +
    '<span class="journey-header-value">' + fmtNumber(total) + '</span>' +
    '<span class="journey-header-pct">100%</span>';
  wrap.appendChild(header);

  // Banda de sub-fases
  const phasesEl = document.createElement('div');
  phasesEl.className = 'journey-phases';
  _JOURNEY_PHASES_DEF.forEach(function(phase) {
    const band = document.createElement('div');
    band.className = 'journey-phase-band';
    band.style.setProperty('--phase-cols', phase.cols);
    band.style.setProperty('--phase-color', phase.color);
    band.innerHTML =
      '<div class="journey-phase-bar"></div>' +
      '<span class="journey-phase-label">' + phase.name + '</span>';
    phasesEl.appendChild(band);
  });
  wrap.appendChild(phasesEl);

  // Fila de columnas (13 etapas, "Tareas Finalizadas" ya filtrada)
  const row = document.createElement('div');
  row.className = 'journey-row';

  labels.forEach(function(label, i) {
    const v      = vals[i];
    const pct    = total > 0 ? (v / total) * 100 : 0;
    const pctFmt = pct.toFixed(1) + '%';
    const barH   = Math.max((v / maxVal) * 100, v > 0 ? 5 : 0);
    const color  = _JOURNEY_COLORS[label] || 'rgba(143,165,168,0.65)';
    const isLast = i === labels.length - 1;

    const col = document.createElement('div');
    col.className = 'journey-col';
    col.setAttribute('aria-label', label + ': ' + fmtNumber(v) + ' leads (' + pctFmt + ')');

    const initialH = reducedMotion ? barH.toFixed(1) + '%' : '0%';

    col.innerHTML =
      '<div class="journey-col-inner">' +
        '<div class="journey-bar-wrap">' +
          '<div class="journey-bar"' +
            ' data-target-h="' + barH.toFixed(1) + '"' +
            ' style="height:' + initialH + ';background:' + color + ';transform-origin:bottom center;">' +
          '</div>' +
        '</div>' +
        '<div class="journey-col-footer">' +
          '<span class="journey-col-value">' + fmtNumber(v) + '</span>' +
          '<span class="journey-col-pct">' + pctFmt + '</span>' +
          '<span class="journey-col-label">' + label + '</span>' +
        '</div>' +
      '</div>';

    col.addEventListener('mouseenter', function() { showTip(col, label, v, pctFmt); });
    col.addEventListener('mouseleave', hideTip);

    row.appendChild(col);

    if (!isLast) {
      const arrow = document.createElement('div');
      arrow.className = 'journey-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      row.appendChild(arrow);
    }
  });

  wrap.appendChild(row);
  ctxSt.parentElement.appendChild(wrap);

  // Stagger entrance: barras crecen con delay incremental
  if (!reducedMotion) {
    const bars = wrap.querySelectorAll('.journey-bar');
    bars.forEach(function(bar, i) {
      const targetH = bar.getAttribute('data-target-h') + '%';
      const delay   = 40 + i * 55; // barra 1 a 40ms, última (~barra 13) a ~750ms
      setTimeout(function() {
        bar.style.transition = 'height 0.55s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease';
        bar.style.height     = targetH;
      }, delay);
    });
  }
}

/* ══════════════════════════════════════════════════════════
   MOFU
══════════════════════════════════════════════════════════ */
function renderMofu(data) {
  window._mofuData = data;

  const prev = data.prev || {};

  setKPI('mofu-leads',      fmtNumber(data.total_leads));
  setKPI('mofu-cpl',        fmtCurrency(data.cpl));
  setKPI('mofu-tipif',      fmtPercent(data.tipification_rate));
  setKPI('mofu-highintent', fmtNumber(data.high_intent_leads));

  _setDelta('delta-mofu-leads',      data.total_leads,       prev.total_leads);
  _setDelta('delta-mofu-cpl',        data.cpl,               prev.cpl,               true);
  _setDelta('delta-mofu-tipif',      data.tipification_rate, prev.tipification_rate);
  _setDelta('delta-mofu-highintent', data.high_intent_leads, prev.high_intent_leads);

  /* ── MOFU sparklines ── */
  if (data.trend) {
    const src = data.trend.sparkline || data.trend;
    const isUp = arr => arr[arr.length - 1] >= arr[0];
    _renderSparkline('sparkline-mofu-leads',     src.leads, isUp(src.leads),     src.labels || []);
    _renderSparkline('sparkline-mofu-cpl',       src.cpl,   !isUp(src.cpl),      src.labels || []);
    _renderSparkline('sparkline-mofu-tipif',     src.leads, isUp(src.leads),     src.labels || []);
    _renderSparkline('sparkline-mofu-highintent',src.leads, isUp(src.leads),     src.labels || []);
  }

  /* ── Trend: separate bar charts for Leads and CPL ── */
  _destroyChart('chart-mofu-trend');
  _destroyChart('chart-mofu-leads');
  _destroyChart('chart-mofu-cpl');

  const ctxML = document.getElementById('chart-mofu-leads');
  if (ctxML && data.trend) {
    _charts['chart-mofu-leads'] = new Chart(ctxML, {
      type: 'bar',
      data: {
        labels: data.trend.labels,
        datasets: [{
          label:              'Leads',
          data:               data.trend.leads,
          backgroundColor:    CHART_PALETTE.blue.solid,
          borderRadius:       4,
          borderSkipped:      false,
          barPercentage:      0.6,
          categoryPercentage: 0.7,
          order:              1,
        }, _trendLineDataset(data.trend.leads)]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` Leads: ${fmtNumber(ctx.parsed.y)}` } }
        },
        scales: {
          y: { ..._axisDefaults(), ticks: { ..._axisDefaults().ticks, callback: v => fmtNumber(v) } },
          x: { ..._axisDefaults(), grid: { display: false } }
        }
      }
    });
  }

  const ctxMC = document.getElementById('chart-mofu-cpl');
  if (ctxMC && data.trend) {
    _charts['chart-mofu-cpl'] = new Chart(ctxMC, {
      type: 'bar',
      data: {
        labels: data.trend.labels,
        datasets: [{
          label:              'CPL',
          data:               data.trend.cpl,
          backgroundColor:    'rgba(239,68,68,0.75)',
          borderRadius:       4,
          borderSkipped:      false,
          barPercentage:      0.6,
          categoryPercentage: 0.7,
          order:              1,
        }, _trendLineDataset(data.trend.cpl)]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` CPL: ${fmtCurrency(ctx.parsed.y)}` } }
        },
        scales: {
          y: { ..._axisDefaults(), ticks: { ..._axisDefaults().ticks, callback: v => '$' + (v / 1000).toFixed(1) + 'k' } },
          x: { ..._axisDefaults(), grid: { display: false } }
        }
      }
    });
  }

  /* ── Status: Customer Journey → delegado a _renderJourney() ── */
  _renderJourney(data);

  /* ── Segments donut ── */
  _destroyChart('chart-segments');
  const ctxSeg = document.getElementById('chart-segments');
  if (ctxSeg) {
    const segColors = ['blue', 'green', 'purple'].map(k => CHART_PALETTE[k].solid);
    _charts['chart-segments'] = new Chart(ctxSeg, {
      type: 'doughnut',
      data: {
        labels:   data.segments.labels,
        datasets: [{ data: data.segments.data, backgroundColor: segColors, borderWidth: 0, hoverOffset: 8 }]
      },
      options: _donutOpts()
    });
  }
}

/* ══════════════════════════════════════════════════════════
   BOFU — SELLERS TABLE
══════════════════════════════════════════════════════════ */

/**
 * Renders the sellers ranking table in BOFU.
 * Sorted by sales descending. Delta arrows for each metric.
 * cycle_days uses lowerBetter = true (fewer days = green).
 * @param {object[]} sellers - array of seller objects from data.sellers
 */
function _renderSellersTable(sellers) {
  const tbody = document.getElementById('sellers-body');
  if (!tbody || !sellers || !sellers.length) return;

  /* Sort by sales descending — rank is dynamic per period */
  const sorted = [...sellers].sort((a, b) => b.sales - a.sales);

  /**
   * Computes a percentage-delta arrow badge.
   * @param {number}  curr
   * @param {number}  prev
   * @param {boolean} lowerBetter - true for cycle_days
   */
  function delta(curr, prev, lowerBetter) {
    if (prev == null || prev === 0) return '';
    const pct  = ((curr - prev) / Math.abs(prev)) * 100;
    const good = lowerBetter ? pct <= 0 : pct >= 0;
    const cls  = Math.abs(pct) < 0.5 ? 'delta-flat' : (good ? 'delta-up' : 'delta-down');
    const arrow = pct >= 0 ? '↑' : '↓';
    return `<span class="seller-delta ${cls}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
  }

  tbody.innerHTML = sorted.map((s, i) => {
    const rank    = i + 1;
    const eff     = s.leads > 0 ? (s.sales / s.leads) * 100 : 0;
    const prevEff = (s.prev && s.prev.leads > 0) ? (s.prev.sales / s.prev.leads) * 100 : null;
    const rankClass = rank <= 3 ? `rank-${rank}` : '';

    return `
      <tr>
        <td class="td-rank ${rankClass}">${rank}</td>
        <td class="td-name">${s.name}</td>
        <td class="td-num">
          ${fmtNumber(s.sales)}
          ${s.prev ? delta(s.sales, s.prev.sales, false) : ''}
        </td>
        <td class="td-num">
          ${fmtPercent(eff)}
          ${prevEff !== null ? delta(eff, prevEff, false) : ''}
        </td>
        <td class="td-num">
          ${fmtCurrency(s.avg_ticket)}
          ${s.prev ? delta(s.avg_ticket, s.prev.avg_ticket, false) : ''}
        </td>
        <td class="td-num">
          ${fmtNumber(s.capitas)}
          ${s.prev ? delta(s.capitas, s.prev.capitas, false) : ''}
        </td>
        <td class="td-num">
          ${s.cycle_days.toFixed(1)} días
          ${s.prev ? delta(s.cycle_days, s.prev.cycle_days, true) : ''}
        </td>
      </tr>
    `;
  }).join('');

  /* ── Totals footer row ── */
  const tfoot = document.getElementById('sellers-foot');
  if (tfoot) {
    const totalSales   = sorted.reduce((a, s) => a + s.sales,   0);
    const totalLeads   = sorted.reduce((a, s) => a + s.leads,   0);
    const totalCapitas = sorted.reduce((a, s) => a + s.capitas, 0);
    const avgEff    = totalLeads   > 0 ? (totalSales / totalLeads) * 100 : 0;
    const avgTicket = totalSales   > 0
      ? sorted.reduce((a, s) => a + s.sales * s.avg_ticket, 0) / totalSales
      : 0;
    const avgCycle  = sorted.length > 0
      ? sorted.reduce((a, s) => a + s.cycle_days, 0) / sorted.length
      : 0;

    tfoot.innerHTML = `
      <tr>
        <td></td>
        <td class="td-total-label">Totales / Promedios</td>
        <td class="td-num">${fmtNumber(totalSales)}</td>
        <td class="td-num">${fmtPercent(avgEff)}</td>
        <td class="td-num">${fmtCurrency(avgTicket)}</td>
        <td class="td-num">${fmtNumber(totalCapitas)}</td>
        <td class="td-num">${avgCycle.toFixed(1)} días</td>
      </tr>
    `;
  }
}

/* ══════════════════════════════════════════════════════════
   BOFU
══════════════════════════════════════════════════════════ */
function renderBofu(data) {
  const prev = data.prev || {};

  setKPI('bofu-revenue',       fmtCurrency(data.total_revenue));
  setKPI('bofu-sales',         fmtNumber(data.closed_sales));
  setKPI('bofu-ticket',        fmtCurrency(data.avg_ticket));
  setKPI('bofu-conversion',    fmtPercent(data.conversion_rate));
  setKPI('bofu-capitas',       fmtNumber(data.capitas_closed));
  setKPI('bofu-ticket-capita', fmtCurrency(data.avg_ticket_per_capita));

  _setDelta('delta-bofu-revenue',       data.total_revenue,         prev.total_revenue);
  _setDelta('delta-bofu-sales',         data.closed_sales,          prev.closed_sales);
  _setDelta('delta-bofu-ticket',        data.avg_ticket,            prev.avg_ticket);
  _setDelta('delta-bofu-conversion',    data.conversion_rate,       prev.conversion_rate);
  _setDelta('delta-bofu-capitas',       data.capitas_closed,        prev.capitas_closed);
  _setDelta('delta-bofu-ticket-capita', data.avg_ticket_per_capita, prev.avg_ticket_per_capita);

  /* ── Sparklines for BOFU KPI cards ── */
  if (data.trend) {
    const src   = data.trend.sparkline || data.trend;
    const isUp  = arr => arr[arr.length - 1] >= arr[0];
    const rev   = src.revenue || [];
    const sales = src.sales   || [];

    const capitas = sales.map(s =>
      Math.round(s * (data.capitas_closed / Math.max(data.closed_sales, 1)))
    );

    _renderSparkline('sparkline-bofu-revenue',      rev,     isUp(rev),     src.labels || []);
    _renderSparkline('sparkline-bofu-sales',         sales,   isUp(sales),   src.labels || []);
    _renderSparkline('sparkline-bofu-ticket',        rev,     isUp(rev),     src.labels || []);
    _renderSparkline('sparkline-bofu-conversion',    sales,   isUp(sales),   src.labels || []);
    _renderSparkline('sparkline-bofu-capitas',       capitas, isUp(capitas), src.labels || []);
    _renderSparkline('sparkline-bofu-ticket-capita', rev,     isUp(rev),     src.labels || []);
  }

  /* ── Trend: 2 independent bar charts (Ingresos / Ventas) ── */
  _destroyChart('chart-bofu-trend');
  _destroyChart('chart-bofu-revenue');
  _destroyChart('chart-bofu-sales-trend');

  const ctxBR = document.getElementById('chart-bofu-revenue');
  if (ctxBR && data.trend) {
    const axis = _axisDefaults();
    _charts['chart-bofu-revenue'] = new Chart(ctxBR, {
      type: 'bar',
      data: {
        labels: data.trend.labels,
        datasets: [{
          label:              'Ingresos',
          data:               data.trend.revenue,
          backgroundColor:    CHART_PALETTE.green.solid,
          borderRadius:       4,
          borderSkipped:      false,
          barPercentage:      0.6,
          categoryPercentage: 0.7,
          order:              1,
        }, _trendLineDataset(data.trend.revenue)]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` Ingresos: ${fmtCurrency(ctx.parsed.y)}` } }
        },
        scales: {
          y: { ...axis, ticks: { ...axis.ticks, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } },
          x: { ...axis, grid: { display: false } }
        }
      }
    });
  }

  const ctxBS = document.getElementById('chart-bofu-sales-trend');
  if (ctxBS && data.trend) {
    const axis = _axisDefaults();
    _charts['chart-bofu-sales-trend'] = new Chart(ctxBS, {
      type: 'bar',
      data: {
        labels: data.trend.labels,
        datasets: [{
          label:              'Ventas',
          data:               data.trend.sales,
          backgroundColor:    CHART_PALETTE.teal.solid,
          borderRadius:       4,
          borderSkipped:      false,
          barPercentage:      0.6,
          categoryPercentage: 0.7,
          order:              1,
        }, _trendLineDataset(data.trend.sales)]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` Ventas: ${fmtNumber(ctx.parsed.y)}` } }
        },
        scales: {
          y: { ...axis, beginAtZero: true,
               ticks: { ...axis.ticks, callback: v => fmtNumber(v), precision: 0 } },
          x: { ...axis, grid: { display: false } }
        }
      }
    });
  }

  /* Typification donut */
  _destroyChart('chart-typification');
  const ctxTyp = document.getElementById('chart-typification');
  const bofuColors = ['green', 'blue', 'amber'].map(k => CHART_PALETTE[k].solid);
  if (ctxTyp) {
    _charts['chart-typification'] = new Chart(ctxTyp, {
      type: 'doughnut',
      data: {
        labels:   data.typification.labels,
        datasets: [{ data: data.typification.data, backgroundColor: bofuColors, borderWidth: 0, hoverOffset: 8 }]
      },
      options: _donutOpts()
    });
  }

  /* Segment sales table */
  const segBody = document.getElementById('bofu-segment-body');
  if (segBody && data.typification) {
    const total = data.typification.data.reduce((a, b) => a + b, 0);
    segBody.innerHTML = data.typification.labels.map((label, i) => {
      const val   = data.typification.data[i];
      const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
      const color = bofuColors[i] || bofuColors[0];
      return `
        <tr>
          <td class="segment-name">
            <span class="segment-swatch" style="background:${color}"></span>${label}
          </td>
          <td class="segment-value">${fmtNumber(val)}</td>
          <td class="segment-pct">${pct}%</td>
        </tr>
      `;
    }).join('');
  }

  /* Sellers ranking table */
  if (data.sellers) _renderSellersTable(data.sellers);

  /* Pending price table — ventas marcadas cerradas pero sin monto cargado */
  _renderPendingPriceTable(data.pending_price || []);
}

function _renderPendingPriceTable(rows) {
  const tbody = document.getElementById('pending-price-body');
  const badge = document.getElementById('pending-price-count');
  if (!tbody) return;

  if (badge) badge.textContent = `${rows.length} pendiente${rows.length === 1 ? '' : 's'}`;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="pending-empty">Todas las ventas tienen monto cargado.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const fecha = r.lead_created_at
      ? new Date(r.lead_created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';
    const tip = (r.tipification && r.tipification.trim()) || '<span class="muted">Sin clasificar</span>';
    const origin = r.is_campaign
      ? '<span class="origin-badge origin-campaign">Campaña</span>'
      : '<span class="origin-badge origin-vendor">Vendedor</span>';
    const nombre = r.nombre || `#${r.meistertask_id}`;
    const asesor = r.assignee || '—';
    return `
      <tr>
        <td class="pending-name">${nombre}</td>
        <td class="pending-asesor">${asesor}</td>
        <td class="pending-tip">${tip}</td>
        <td class="pending-origin">${origin}</td>
        <td class="pending-date">${fecha}</td>
      </tr>
    `;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   SPARKLINES — micro line charts inside Performance KPI cards
══════════════════════════════════════════════════════════ */

/**
 * Renders a single sparkline chart.
 * @param {string}   id       - canvas element ID (e.g. 'sparkline-revenue')
 * @param {number[]} values   - array of data points
 * @param {boolean}  positive - true = green (trending up), false = red (trending down)
 * @param {string[]} labels   - optional x-axis labels shown in tooltip
 */
function _renderSparkline(id, values, positive, labels) {
  _destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx || !values || values.length < 2) return;

  // Pin dimensions before Chart.js takes over — prevents infinite resize loop
  // when responsive:true + maintainAspectRatio:false inside a flex parent.
  const SPARK_H = 56;
  const parentW = ctx.parentElement ? ctx.parentElement.clientWidth : 200;
  ctx.width  = parentW > 0 ? parentW : 200;
  ctx.height = SPARK_H;
  ctx.style.height = SPARK_H + 'px';

  const borderColor     = positive ? '#22C55E' : '#FF0040';
  const backgroundColor = positive ? 'rgba(34,197,94,0.10)' : 'rgba(255,0,64,0.10)';

  /* Use provided labels if they match the data length, otherwise fall back */
  const resolvedLabels = (labels && labels.length === values.length)
    ? labels
    : values.map((_, i) => `P${i + 1}`);

  _charts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: resolvedLabels,
      datasets: [{
        data:            values,
        borderColor:     borderColor,
        backgroundColor: backgroundColor,
        borderWidth:     1.5,
        pointRadius:     0,
        pointHoverRadius: 4,
        tension:         0,
        fill:            true
      }]
    },
    options: {
      responsive:          false,
      maintainAspectRatio: false,
      animation:           { duration: 400 },
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend:  { display: false },
        tooltip: {
          enabled:   true,
          mode:      'index',
          intersect: false,
          callbacks: {
            title: items => items[0]?.label || '',
            label: c     => fmtNumber(c.parsed.y)
          }
        }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      },
      elements: { line: { borderCapStyle: 'round' } }
    }
  });
}

/**
 * Renders sparklines for all 6 Performance KPI cards.
 * Prefers doubled sparkline data (current + previous period) when available.
 * Revenue and spend come directly from trend data.
 * ROI, impressions, leads, sales are derived point-by-point.
 */
function renderSparklines(data) {
  if (!data.trend) return;

  /* Prefer sparkline sub-object (doubled data) over raw trend */
  const src = data.trend.sparkline || data.trend;
  const labels  = src.labels || [];
  const revenue = src.revenue;
  const spend   = src.spend;

  /* ROI per data point */
  const roi = revenue.map((r, i) =>
    spend[i] > 0 ? ((r - spend[i]) / spend[i]) * 100 : 0
  );

  /* Impressions: scale proportionally from revenue shape */
  const revTotal = revenue.reduce((a, b) => a + b, 0);
  const impressions = revenue.map(r =>
    revTotal > 0 ? Math.round((r / revTotal) * data.impressions) : 0
  );

  /* Leads and sales: same proportional shape from revenue */
  const leads = revenue.map(r =>
    revTotal > 0 ? Math.round((r / revTotal) * data.leads) : 0
  );
  const sales = revenue.map(r =>
    revTotal > 0 ? Math.round((r / revTotal) * data.closed_sales) : 0
  );

  /* Determine trend direction for each metric (last vs first point) */
  const isUp = arr => arr[arr.length - 1] >= arr[0];

  _renderSparkline('sparkline-revenue',     revenue,     isUp(revenue),     labels);
  _renderSparkline('sparkline-spend',       spend,       !isUp(spend),      labels); /* lower spend = better */
  _renderSparkline('sparkline-roi',         roi,         isUp(roi),         labels);
  _renderSparkline('sparkline-impressions', impressions, isUp(impressions), labels);
  _renderSparkline('sparkline-leads',       leads,       isUp(leads),       labels);
  _renderSparkline('sparkline-sales',       sales,       isUp(sales),       labels);
}

/* ── Entry point ────────────────────────────────────────── */
function renderSection(section, data) {
  switch (section) {
    case 'performance': renderPerformance(data); break;
    case 'tofu':        renderTofu(data);        break;
    case 'mofu':        renderMofu(data);        break;
    case 'bofu':        renderBofu(data);        break;
  }
}
