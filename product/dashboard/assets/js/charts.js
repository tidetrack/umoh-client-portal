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

/* ── Media móvil (moving average) ────────────────────────
   Reemplaza la regresión lineal por una media móvil centrada.
   La ventana se elige automáticamente según la cantidad de puntos:
   - ≤ 7 puntos  → ventana 3
   - ≤ 30 puntos → ventana 7
   - > 30 puntos → ventana 14
   Los extremos donde no hay suficientes vecinos usan una ventana
   parcial (promedio de los puntos disponibles), así la línea
   siempre cubre todos los datos sin valores nulos. */
function _movingAverage(values, window) {
  const n    = values.length;
  const half = Math.floor(window / 2);
  return values.map(function(_, i) {
    const from = Math.max(0, i - half);
    const to   = Math.min(n - 1, i + half);
    const slice = values.slice(from, to + 1);
    const sum   = slice.reduce(function(a, b) { return a + Number(b || 0); }, 0);
    return sum / slice.length;
  });
}

function _trendWindow(n) {
  if (n <= 7)  return 3;
  if (n <= 30) return 7;
  return 14;
}

/* Devuelve el dataset Chart.js de la línea de media móvil.
   color: opcional, usa accent UMOH por default. */
function _trendLineDataset(values, label = 'Media móvil', color = 'rgba(255, 0, 64, 0.85)') {
  const win  = _trendWindow(values.length);
  const data = _movingAverage(values, win);
  return {
    type:             'line',
    label:            label,
    data:             data,
    borderColor:      color,
    backgroundColor:  'transparent',
    borderWidth:      2,
    borderDash:       [6, 4],
    pointRadius:      0,
    pointHoverRadius: 0,
    fill:             false,
    tension:          0.3,
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
 * Si prev es 0 o null/undefined, muestra "0%" en vez de quedar vacío.
 */
function _setDelta(id, current, prev, lowerIsBetter = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (prev == null || prev === 0) {
    el.textContent = '0% vs período anterior';
    el.className   = 'kpi-delta delta--neutral';
    return;
  }
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
      '<div class="cs-item" data-cs-kpi="cs-top-seller" tabindex="0" role="button" aria-label="Ver detalle de Mejor Vendedor">' +
        '<span class="cs-label">Mejor Vendedor</span>' +
        '<span class="cs-value cs-value--name">' + s.top_seller + '</span>' +
        (p.top_seller && p.top_seller !== s.top_seller
          ? '<span class="cs-delta cs-flat">ant. ' + p.top_seller + '</span>'
          : '<span class="cs-delta cs-flat">—</span>') +
      '</div>' +
      '<div class="cs-item" data-cs-kpi="cs-avg-effectiveness" tabindex="0" role="button" aria-label="Ver detalle de Efectividad Promedio">' +
        '<span class="cs-label">Efectividad Promedio</span>' +
        '<span class="cs-value">' + fmtPercent(s.avg_effectiveness) + '</span>' +
        mini(s.avg_effectiveness, p.avg_effectiveness, false) +
      '</div>' +
      '<div class="cs-item" data-cs-kpi="cs-total-sales" tabindex="0" role="button" aria-label="Ver detalle de Ventas del Equipo">' +
        '<span class="cs-label">Ventas del Equipo</span>' +
        '<span class="cs-value">' + fmtNumber(s.total_sales) + '</span>' +
        mini(s.total_sales, p.total_sales, false) +
      '</div>' +
      '<div class="cs-item" data-cs-kpi="cs-avg-cycle-days" tabindex="0" role="button" aria-label="Ver detalle de Ciclo Promedio">' +
        '<span class="cs-label">Ciclo Promedio</span>' +
        '<span class="cs-value">' + s.avg_cycle_days.toFixed(1) + ' días</span>' +
        mini(s.avg_cycle_days, p.avg_cycle_days, true) +
      '</div>' +
      '<div class="cs-item" data-cs-kpi="cs-avg-ticket" tabindex="0" role="button" aria-label="Ver detalle de Ticket Promedio">' +
        '<span class="cs-label">Ticket Promedio</span>' +
        '<span class="cs-value">' + fmtCurrency(s.avg_ticket) + '</span>' +
        mini(s.avg_ticket, p.avg_ticket, false) +
      '</div>' +
      '<div class="cs-item" data-cs-kpi="cs-avg-capitas-per-sale" tabindex="0" role="button" aria-label="Ver detalle de Cápitas por Venta">' +
        '<span class="cs-label">Cápitas / Venta</span>' +
        '<span class="cs-value">' + (s.avg_capitas_per_sale != null && s.avg_capitas_per_sale > 0 ? s.avg_capitas_per_sale.toFixed(2) + ' cap.' : '—') + '</span>' +
        (s.avg_capitas_per_sale != null && s.avg_capitas_per_sale > 0 ? mini(s.avg_capitas_per_sale, p.avg_capitas_per_sale, false) : '') +
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
  if (!tbody) return;

  if (colHeader) colHeader.textContent = mode === 'impressions' ? 'Impresiones' : 'Clicks';

  // Estado vacío: sin datos en el período o pendiente de integración
  if (!terms || terms.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="terms-empty">Sin datos de términos de búsqueda para el período seleccionado.</td></tr>';
    return;
  }

  const colors = [
    CHART_PALETTE.blue.solid, CHART_PALETTE.teal.solid, CHART_PALETTE.purple.solid,
    CHART_PALETTE.amber.solid, CHART_PALETTE.coral.solid, CHART_PALETTE.green.solid,
    CHART_PALETTE.blue.solid, CHART_PALETTE.teal.solid
  ];

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

// Paleta semántica con escala cromática progresiva por sub-fase.
// Dentro de cada sub-fase los colores van de menor a mayor intensidad
// (izquierda → derecha), para que la lectura cromática sea progresiva.
//
// Entrada    (cyan claro → cyan medio)
// Seguimiento (azul claro → azul medio → azul intenso)
// Alta intención (ámbar claro → ámbar → naranja)
// Incubando  (púrpura claro → púrpura)
// Resultado  (verde sólido | rojo | gris — terminales distintos, sin escala)
const _JOURNEY_COLORS = {
  // Entrada — cyan escala 2 pasos
  'Inbox':           'rgba(125,211,252,0.70)',   // sky-300 suave
  'Nuevo':           'rgba(14,165,233,0.85)',    // sky-500 intenso
  // Seguimiento — azul escala 3 pasos
  'Para Hoy':        'rgba(147,197,253,0.75)',   // blue-300 claro
  'Procesando':      'rgba(59,130,246,0.85)',    // blue-500 medio
  'Contactados':     'rgba(29,78,216,0.95)',     // blue-700 intenso
  // Alta intención — ámbar→naranja escala 3 pasos
  'Prioritarios':    'rgba(253,230,138,0.80)',   // amber-200 claro
  'Cotizados':       'rgba(251,191,36,0.90)',    // amber-400 medio
  'En Auditoria':    'rgba(217,119,6,1.00)',     // amber-700 naranja intenso
  // Incubando — púrpura escala 2 pasos
  'Mes que viene':   'rgba(216,180,254,0.75)',   // purple-300 claro
  'A futuro':        'rgba(147,51,234,0.90)',    // purple-600 intenso
  // Resultado — colores terminales independientes (no escala)
  'Ventas Ganadas':  'rgba(34,197,94,0.90)',     // verde sólido
  'No prospera':     'rgba(239,68,68,0.85)',     // rojo
  'Erroneos':        'rgba(148,163,184,0.65)',   // gris neutro
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
// sections: nombres exactos de etapas que pertenecen a esta sub-fase (para calcular totales por nombre, sin asumir índices)
const _JOURNEY_PHASES_DEF = [
  { name: 'Entrada',        color: '#63b3ed', cols: 2, sections: ['Inbox', 'Nuevo'] },
  { name: 'Seguimiento',    color: '#4299e1', cols: 3, sections: ['Para Hoy', 'Procesando', 'Contactados'] },
  { name: 'Alta intención', color: '#f6ad55', cols: 3, sections: ['Prioritarios', 'Cotizados', 'En Auditoria'] },
  { name: 'Incubando',      color: '#b794f4', cols: 2, sections: ['Mes que viene', 'A futuro'] },
  { name: 'Resultado',      color: '#68d391', cols: 3, sections: ['Ventas Ganadas', 'No prospera', 'Erroneos'] },
];

/**
 * Datos didácticos estáticos por etapa del journey.
 * Usados por _openJourneyModal() al hacer click en una columna.
 * Keys: nombre exacto de la etapa tal como llega del backend.
 */
var _JOURNEY_STAGE_INFO = {
  'Inbox': {
    description:    'Los leads en Inbox acaban de ingresar al sistema desde la campaña y todavía no fueron asignados ni abiertos por ningún vendedor. Es el punto de entrada crudo del funnel — la primera señal de que la publicidad está generando demanda real.',
    interpretation: 'Un Inbox con muchos leads y sin movimiento es una señal de alerta: la campaña atrae, pero el equipo no está respondiendo a tiempo. La velocidad de respuesta en las primeras horas después del ingreso es el factor que más impacta la tasa de conversión.',
    action:         'Si Inbox supera el 20% del total del pipeline, revisar la capacidad de respuesta del equipo. Los leads sin contacto en las primeras 2 horas tienen una probabilidad de conversión significativamente menor.'
  },
  'Nuevo': {
    description:    'Nuevo agrupa leads que ya fueron reconocidos por el sistema pero que aún no iniciaron el proceso de calificación comercial. Están a un paso del Inbox — alguien los vio, pero todavía no los trabajó.',
    interpretation: 'Si Nuevo acumula un volumen alto de forma sostenida, puede indicar que los vendedores están marcando leads como vistos sin avanzar el proceso. Diferenciar entre "tomé el lead" y "empecé a trabajarlo" es clave para diagnosticar el cuello.',
    action:         'Establecer un criterio claro: un lead en Nuevo debe pasar a Para Hoy o Procesando en un plazo máximo de 24 horas hábiles. Si no se puede cumplir, el problema es de capacidad o priorización.'
  },
  'Para Hoy': {
    description:    'Para Hoy es la bandeja de tareas del día del equipo comercial. Contiene leads que el sistema o el propio vendedor marcaron como urgentes para gestionar en la jornada actual. Es un indicador directo de la carga de trabajo inmediata.',
    interpretation: 'Un Para Hoy alto con un Contactados bajo en el mismo período indica que el equipo está sobrecargado o priorizando mal. Si crece sin vaciarse, la gestión está atrasada respecto al ritmo de entrada de leads.',
    action:         'Revisar Para Hoy cada mañana como primera tarea del equipo. Si hay más de 10 leads pendientes por vendedor, redistribuir la carga antes de que el retraso se acumule.'
  },
  'Procesando': {
    description:    'Procesando contiene leads que están siendo trabajados activamente: el vendedor está intentando establecer contacto, completando datos o esperando respuesta del prospecto. Es la etapa de mayor intensidad operativa del journey.',
    interpretation: 'Un volumen saludable en Procesando indica que el equipo está activo. Si este número cae pero Para Hoy crece, los leads no están avanzando. Si Procesando es muy alto y Contactados es bajo, el problema puede estar en la calidad del contacto o en la disponibilidad del prospecto.',
    action:         'Definir un límite máximo de tiempo en Procesando. Un lead que lleva más de 5 días en esta columna sin avanzar debe ser re-calificado o movido a A futuro.'
  },
  'Contactados': {
    description:    'Contactados son leads con los que el vendedor ya estableció comunicación efectiva. Se les habló, se identificó su necesidad y están en evaluación activa. Es el primer gran filtro del journey: separar los que responden de los que no.',
    interpretation: 'Un ratio alto de Contactados respecto a Para Hoy y Procesando indica que el equipo está siendo efectivo en alcanzar prospectos. Si Contactados es bajo, el problema puede estar en la calidad de los datos de contacto o en la estrategia de outreach.',
    action:         'Los leads en Contactados tienen el timing más favorable para avanzar al cierre. Priorizar el seguimiento en las siguientes 24-48 horas para no perder el momento de interés del prospecto.'
  },
  'Prioritarios': {
    description:    'Prioritarios es un marcador del vendedor que indica leads de alta calidad o urgencia especial: alguien que pidió información detallada, que ya comparó opciones, o que tiene una necesidad inmediata. Son las oportunidades con mayor probabilidad de cierre en el corto plazo.',
    interpretation: 'Un volumen creciente en Prioritarios es una buena señal de calificación. Si Prioritarios crece pero las Ventas Ganadas no, puede haber un problema en el proceso de cierre o en el manejo de objeciones finales.',
    action:         'Los leads Prioritarios merecen seguimiento diario por el vendedor y visibilidad del supervisor. Cada día sin avance reduce la probabilidad de cierre. Considerar acompañamiento comercial directo del lider de ventas.'
  },
  'Cotizados': {
    description:    'Los leads en Cotizados ya recibieron una propuesta económica concreta y están evaluando la decisión de compra. Es una de las etapas más avanzadas del journey — el prospecto conoce el precio, las coberturas y las condiciones del servicio.',
    interpretation: 'Si Cotizados crece sin que crezcan las Ventas Ganadas, hay fricción en la etapa de cierre. Las causas más frecuentes son: precio percibido como alto, falta de urgencia del prospecto, competencia en evaluación paralela, o seguimiento tardío después de la cotización.',
    action:         'Priorizar el seguimiento de leads Cotizados en las próximas 48 horas. El tiempo entre la cotización y el primer seguimiento es el factor crítico. Un lead cotizado que no recibe respuesta en 48 horas tiene alta probabilidad de enfriarse.'
  },
  'En Auditoria': {
    description:    'En Auditoria son leads que aceptaron avanzar pero cuyo expediente está siendo revisado por el equipo de backoffice o la aseguradora. El proceso comercial terminó — el resultado depende ahora de la aprobación administrativa.',
    interpretation: 'Un volumen alto en Auditoria es una señal positiva: significa que el equipo comercial está convirtiendo leads en solicitudes formales. Si este número crece mucho sin que Ventas Ganadas crezca en proporción, puede haber rechazo por calidad de datos o documentación incompleta.',
    action:         'Seguir de cerca el tiempo promedio en Auditoria. Si supera los 5 días hábiles, contactar al prospecto para mantenerlo informado y evitar que desista durante la espera.'
  },
  'Mes que viene': {
    description:    'Mes que viene son leads que mostraron interés real pero eligieron posponer la decisión al próximo mes. No rechazaron — agendaron. Son el pipeline de corto plazo que, bien gestionado, se convierte en ventas del ciclo siguiente.',
    interpretation: 'Un porcentaje elevado en Mes que viene puede indicar que los vendedores están siendo demasiado permisivos con las postergaciones, o que hay una fricción real con el momento de compra. También puede ser una señal positiva si el producto tiene estacionalidad natural.',
    action:         'Crear un recordatorio de reactivación para cada lead en Mes que viene. El seguimiento debe iniciar 5 días antes de la fecha objetivo, no el mismo dia. El prospecto debe sentir continuidad, no una llamada inesperada.'
  },
  'A futuro': {
    description:    'A futuro son leads con interés identificado pero sin fecha concreta de compra. El timeline es mayor a un mes. Son el pipeline de mediano plazo — no se descartan, pero requieren una estrategia de nurturing diferente a los leads activos.',
    interpretation: 'Si A futuro acumula un porcentaje muy alto del total, puede indicar que el equipo está estacionando leads sin trabajarlos, o que el producto tiene un ciclo de decision genuinamente largo. Diferenciar estos dos escenarios es clave para saber si el problema es comercial o del mercado.',
    action:         'Los leads en A futuro deben recibir contacto mensual mínimo: una nota de valor, un cambio en la propuesta, o un recordatorio de beneficio. El silencio durante meses casi siempre deriva en pérdida del lead cuando el prospecto finalmente decide.'
  },
  'Ventas Ganadas': {
    description:    'Ventas Ganadas son los leads que completaron el proceso de compra: la póliza o contrato fue emitido, el prospecto se convirtió en cliente. Es el único resultado que genera ingresos reales para el negocio y el indicador más importante del journey.',
    interpretation: 'El ratio Ventas Ganadas sobre el total de leads es la tasa de conversión del funnel completo. Un valor por encima del 5% es generalmente saludable en seguros de salud. Si este porcentaje baja de un período al otro, revisar si el problema está en la calidad del lead (TOFU) o en el proceso comercial (MOFU).',
    action:         'Cada venta ganada debe tener un proceso de onboarding claro para el nuevo cliente. La satisfacción en los primeros 30 días impacta directamente en la retención y en las referencias, que son el canal de menor costo de adquisición.'
  },
  'No prospera': {
    description:    'No prospera son leads que pasaron por el proceso comercial pero no cerraron: el prospecto decidió no comprar, eligió otra opción, o no cumplía los requisitos del producto. Es el resultado negativo esperado en cualquier funnel — un porcentaje de No prospera es inevitable y sano.',
    interpretation: 'Si No prospera supera a Ventas Ganadas, la relación entre esfuerzo comercial y resultado es negativa. Las causas pueden ser: calidad baja del lead, precio fuera del mercado, proceso de venta débil, o producto no adecuado para el segmento objetivo.',
    action:         'Analizar los motivos de No prospera sistemáticamente. Si hay un patrón (precio, cobertura, competencia), esa información debe alimentar tanto la estrategia comercial como la segmentación de campañas. No prospera es el feedback más valioso del funnel.'
  },
  'Erroneos': {
    description:    'Erroneos son leads que llegaron al CRM pero no corresponden al público objetivo: datos de contacto inválidos, personas fuera del perfil, duplicados, o formularios completados por error. Son ruido en el pipeline que consume tiempo del equipo sin posibilidad de conversión.',
    interpretation: 'Un porcentaje de Erroneos por encima del 10% del total es una señal de alerta seria en la segmentación de la campaña. Indica que la audiencia publicitaria está atrayendo tráfico no calificado, lo cual encarece el CPL real y sobrecarga al equipo con gestión improductiva.',
    action:         'Reportar el perfil de los leads erróneos al equipo de media para afinar la segmentación. Cada lead erróneo es dinero invertido en publicidad que no tiene posibilidad de retorno. Reducir Erroneos mejora directamente el CPL real y la eficiencia del equipo.'
  }
};

/**
 * Abre el modal didáctico del journey stage.
 * Llamado al hacer click en cualquier .journey-col.
 *
 * @param {string} label - nombre de la etapa
 * @param {number} val   - cantidad de leads en esta etapa
 * @param {number} total - total de leads del período
 */
function _openJourneyModal(label, val, total) {
  var modal = document.getElementById('journey-stage-modal');
  if (!modal) return;

  var info = _JOURNEY_STAGE_INFO[label] || {
    description:    'Etapa del customer journey.',
    interpretation: 'Analizar el volumen en contexto con el resto del pipeline.',
    action:         'Revisar con el equipo comercial el estado de estos leads.'
  };
  var phase  = _JOURNEY_PHASE_MAP[label] || { name: 'Journey', color: '#8FA5A8' };
  var pctStr = total > 0 ? ((val / total) * 100).toFixed(1) + '% del total' : '';

  document.getElementById('journey-modal-title').textContent          = label;
  document.getElementById('journey-modal-metric-value').textContent   = fmtNumber(val);
  document.getElementById('journey-modal-metric-pct').textContent     = pctStr;
  document.getElementById('journey-modal-phase-name').textContent     = phase.name;
  document.getElementById('journey-modal-description').textContent    = info.description;
  document.getElementById('journey-modal-interpretation').textContent = info.interpretation;
  document.getElementById('journey-modal-action').textContent         = info.action;

  var phaseBadge = document.getElementById('journey-modal-phase-badge');
  phaseBadge.style.background = phase.color + '22';
  phaseBadge.style.color      = phase.color;

  var phaseDot = document.getElementById('journey-modal-phase-dot');
  phaseDot.style.background = phase.color;

  var exampleText = val === 0
    ? 'No hay leads en esta etapa en el período seleccionado.'
    : 'En este período, ' + fmtNumber(val) + ' leads se encuentran en "' + label + '"' +
      (total > 0 ? ', representando el ' + ((val / total) * 100).toFixed(1) + '% del pipeline total.' : '.');
  document.getElementById('journey-modal-example').textContent = exampleText;

  modal.removeAttribute('hidden');
  modal.querySelector('.journey-modal').focus();
}

/**
 * Cierra el journey stage modal.
 */
function _closeJourneyModal() {
  var modal = document.getElementById('journey-stage-modal');
  if (modal) modal.setAttribute('hidden', '');
}

// Inicializa los listeners del journey stage modal una sola vez (overlay click + Escape + botón X).
(function _initJourneyModalListeners() {
  document.addEventListener('DOMContentLoaded', function() {
    var modal    = document.getElementById('journey-stage-modal');
    var closeBtn = document.getElementById('journey-modal-close');
    if (!modal || !closeBtn) return;

    closeBtn.addEventListener('click', _closeJourneyModal);

    modal.addEventListener('click', function(e) {
      if (e.target === modal) _closeJourneyModal();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !modal.hasAttribute('hidden')) _closeJourneyModal();
    });
  });
}());

/**
 * Calcula los insights del journey a partir de los datos reales del período.
 * Evalúa heurísticas por severidad (warning > positivo > info).
 * Retorna máximo 3 insights, o 1 si solo hay info.
 *
 * @param {string[]} labels - etiquetas del journey (ya filtradas)
 * @param {number[]} vals   - valores correspondientes
 * @param {number}   total  - suma de todos los vals
 * @returns {Array<{type:string, icon:string, name:string, text:string}>}
 */
function _computeJourneyInsights(labels, vals, total) {
  function getVal(lbl) {
    var idx = labels.indexOf(lbl);
    return idx !== -1 ? vals[idx] : 0;
  }
  function pctFmt(n) { return total > 0 ? ((n / total) * 100).toFixed(0) + '%' : '0%'; }

  var cotAu   = getVal('Cotizados') + getVal('En Auditoria');
  var ganadas = getVal('Ventas Ganadas');
  var incub   = getVal('Mes que viene') + getVal('A futuro');
  var erron   = getVal('Erroneos');
  var entrada = getVal('Inbox') + getVal('Nuevo');
  var seguim  = getVal('Para Hoy') + getVal('Procesando') + getVal('Contactados');
  var altaInt = getVal('Prioritarios') + cotAu;

  var warnings  = [];
  var positives = [];
  var infos     = [];

  // Regla 1: calidad de leads
  if (total > 0 && erron / total > 0.10) {
    warnings.push({
      type: 'warning', icon: '!',
      name: 'Calidad de leads',
      text: 'El ' + pctFmt(erron) + ' de leads son erróneos (' + fmtNumber(erron) + ' leads). Revisar segmentación de campaña para reducir tráfico no calificado.'
    });
  }

  // Regla 2: cuello de botella en cierre
  if (ganadas > 0 && cotAu > 2 * ganadas) {
    warnings.push({
      type: 'warning', icon: '!',
      name: 'Cuello en cierre',
      text: 'Hay ' + fmtNumber(cotAu) + ' leads cotizados/en auditoría pero solo ' + fmtNumber(ganadas) + ' ventas ganadas. Revisar fricción en la firma: precio, documentación o seguimiento tardío.'
    });
  }

  // Regla 3: leads avanzados sin cierres
  if (cotAu >= 5 && ganadas === 0) {
    warnings.push({
      type: 'warning', icon: '!',
      name: 'Sin cierres en el período',
      text: 'Hay ' + fmtNumber(cotAu) + ' leads avanzados (cotizados/auditoría) sin ningún cierre registrado. Acción comercial urgente recomendada.'
    });
  }

  // Regla 4: pipeline incubando
  if (total > 0 && incub / total > 0.30) {
    warnings.push({
      type: 'warning', icon: '!',
      name: 'Pipeline incubando',
      text: 'El ' + pctFmt(incub) + ' del total son leads pospuestos (' + fmtNumber(incub) + '). Considerar una campaña de reactivación para no perder estos contactos.'
    });
  }

  // Regla 5: leads sin tomar
  if (seguim > 0 && entrada > seguim * 1.5) {
    warnings.push({
      type: 'warning', icon: '!',
      name: 'Leads sin tomar',
      text: 'Hay ' + fmtNumber(entrada) + ' leads en Inbox/Nuevo versus ' + fmtNumber(seguim) + ' en seguimiento. El equipo está detrás del flujo de entrada.'
    });
  }

  // Regla 6: conversión saludable
  if (total > 0 && ganadas / total >= 0.05) {
    positives.push({
      type: 'positive', icon: '+',
      name: 'Conversión saludable',
      text: pctFmt(ganadas) + ' de leads cerraron como venta (' + fmtNumber(ganadas) + ' de ' + fmtNumber(total) + '). Métrica por encima del benchmark típico del sector.'
    });
  }

  // Regla 7: sin leads erróneos
  if (erron === 0 && total >= 10) {
    positives.push({
      type: 'positive', icon: '+',
      name: 'Sin leads erróneos',
      text: 'La calidad del tráfico es óptima en este período: ninguno de los ' + fmtNumber(total) + ' leads fue descartado por datos incorrectos.'
    });
  }

  // Default info
  if (warnings.length === 0 && positives.length === 0) {
    infos.push({
      type: 'info', icon: 'i',
      name: 'Pipeline en operación normal',
      text: fmtNumber(total) + ' leads en gestión, ' + fmtNumber(ganadas) + ' cerrados, ' + fmtNumber(altaInt) + ' en alta intención. Sin señales de alerta en este período.'
    });
  }

  var combined = warnings.concat(positives).concat(infos);
  return (warnings.length === 0 && positives.length === 0)
    ? combined.slice(0, 1)
    : combined.slice(0, 3);
}

/**
 * Construye o actualiza el bloque .journey-insights debajo del journey.
 * Reemplaza al antiguo _updateJourneyDesc / .journey-description.
 *
 * @param {HTMLElement} el     - el div.journey-insights a actualizar
 * @param {string[]}    labels - etiquetas del journey (ya filtradas)
 * @param {number[]}    vals   - valores correspondientes
 * @param {number}      total  - suma de todos los vals
 */
function _updateJourneyInsights(el, labels, vals, total) {
  var insights = _computeJourneyInsights(labels, vals, total);

  var cardsHTML = insights.map(function(ins) {
    return (
      '<div class="journey-insight-card journey-insight-card--' + ins.type + '">' +
        '<div class="journey-insight-badge">' + ins.icon + '</div>' +
        '<div class="journey-insight-body">' +
          '<div class="journey-insight-name">' + ins.name + '</div>' +
          '<p class="journey-insight-text">' + ins.text + '</p>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  el.innerHTML =
    '<div class="journey-insights-header">' +
      '<span class="journey-insights-icon">*</span>' +
      '<span class="journey-insights-title">Insights del Journey</span>' +
    '</div>' +
    '<div class="journey-insights-list">' + cardsHTML + '</div>';
}

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

  // Totales por sub-fase: suma de vals cuyo label pertenece a phase.sections (match por nombre, no por índice)
  const phaseTotals = _JOURNEY_PHASES_DEF.map(function(phase) {
    return filteredPairs.reduce(function(sum, pair) {
      return phase.sections.indexOf(pair.label) !== -1 ? sum + pair.val : sum;
    }, 0);
  });

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

    // Actualizar totales de la banda de sub-fases
    const phaseBands = existingWrap.querySelectorAll('.journey-phase-band');
    phaseBands.forEach(function(band, i) {
      const totalEl = band.querySelector('.journey-phase-total');
      if (totalEl && phaseTotals[i] !== undefined) totalEl.textContent = fmtNumber(phaseTotals[i]);
    });

    // Actualizar el bloque de insights con los valores del período nuevo
    const existingInsights = existingWrap.querySelector('.journey-insights');
    if (existingInsights) _updateJourneyInsights(existingInsights, labels, vals, total);

    // Re-vincular clicks con los valores actualizados del período
    existingCols.forEach(function(col, i) {
      if (i >= labels.length) return;
      var lbl  = labels[i];
      var vCur = vals[i];
      var tot  = total;
      col.onclick = function() { _openJourneyModal(lbl, vCur, tot); };
    });

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
  _JOURNEY_PHASES_DEF.forEach(function(phase, pi) {
    const band = document.createElement('div');
    band.className = 'journey-phase-band';
    band.style.setProperty('--phase-cols', phase.cols);
    band.style.setProperty('--phase-color', phase.color);
    band.innerHTML =
      '<div class="journey-phase-bar"></div>' +
      '<div class="journey-phase-caption">' +
        '<span class="journey-phase-label">' + phase.name + '</span>' +
        '<span class="journey-phase-total">' + fmtNumber(phaseTotals[pi]) + '</span>' +
      '</div>';
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
    col.addEventListener('click', (function(lbl, vv, tot) {
      return function() { _openJourneyModal(lbl, vv, tot); };
    }(label, v, total)));

    row.appendChild(col);

    if (!isLast) {
      const arrow = document.createElement('div');
      arrow.className = 'journey-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      row.appendChild(arrow);
    }
  });

  wrap.appendChild(row);

  const journeyInsights = document.createElement('div');
  journeyInsights.className = 'journey-insights';
  _updateJourneyInsights(journeyInsights, labels, vals, total);
  wrap.appendChild(journeyInsights);

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

  // Ventas Ganadas: tomar de data.status si está disponible, o del campo directo
  const closedWonFromStatus = (function() {
    if (!data.status) return data.closed_won_leads || 0;
    const idx = data.status.labels.indexOf('Ventas Ganadas');
    return idx !== -1 ? (data.status.data[idx] || 0) : (data.closed_won_leads || 0);
  })();
  const prevClosedWon = prev.closed_won_leads || 0;

  setKPI('mofu-leads',      fmtNumber(data.total_leads));
  setKPI('mofu-cpl',        fmtCurrency(data.cpl));
  setKPI('mofu-tipif',      fmtPercent(data.tipification_rate));
  setKPI('mofu-highintent', fmtNumber(data.high_intent_leads));
  setKPI('mofu-closedwon',  fmtNumber(closedWonFromStatus));

  _setDelta('delta-mofu-leads',      data.total_leads,       prev.total_leads);
  _setDelta('delta-mofu-cpl',        data.cpl,               prev.cpl,               true);
  _setDelta('delta-mofu-tipif',      data.tipification_rate, prev.tipification_rate);
  _setDelta('delta-mofu-highintent', data.high_intent_leads, prev.high_intent_leads);
  _setDelta('delta-mofu-closedwon',  closedWonFromStatus,    prevClosedWon);

  /* ── MOFU sparklines ── */
  if (data.trend) {
    const src  = data.trend.sparkline || data.trend;
    const isUp = arr => arr[arr.length - 1] >= arr[0];
    _renderSparkline('sparkline-mofu-leads',      src.leads, isUp(src.leads),  src.labels || []);
    _renderSparkline('sparkline-mofu-cpl',        src.cpl,   !isUp(src.cpl),   src.labels || []);
    _renderSparkline('sparkline-mofu-tipif',      src.leads, isUp(src.leads),  src.labels || []);
    _renderSparkline('sparkline-mofu-highintent', src.leads, isUp(src.leads),  src.labels || []);
    /* closedwon: usa la misma forma que leads — proxy directo */
    _renderSparkline('sparkline-mofu-closedwon',  src.leads, isUp(src.leads),  src.labels || []);
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
  window._bofuData = data;
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

  /* F.3 — Limpiar canvas si no llegan datos de tendencia (evita residuo visual
     del período anterior cuando el backend no devuelve trend filtrado). */
  ['chart-bofu-revenue', 'chart-bofu-sales-trend'].forEach(id => {
    if (!data.trend) {
      const el = document.getElementById(id);
      if (el) { const ctx2d = el.getContext('2d'); if (ctx2d) ctx2d.clearRect(0, 0, el.width, el.height); }
    }
  });

  const ctxBR = document.getElementById('chart-bofu-revenue');
  if (ctxBR && data.trend && data.trend.labels && data.trend.labels.length) {
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
  if (ctxBS && data.trend && data.trend.labels && data.trend.labels.length) {
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

/* Registry de filas pendientes para el modal de detalle de lead.
   Se actualiza cada vez que renderBofu() llama a _renderPendingPriceTable(). */
let _pendingRows = [];

function _renderPendingPriceTable(rows) {
  const tbody = document.getElementById('pending-price-body');
  const badge = document.getElementById('pending-price-count');
  if (!tbody) return;

  /* Guardar referencia para el modal */
  _pendingRows = rows;

  if (badge) badge.textContent = `${rows.length} pendiente${rows.length === 1 ? '' : 's'}`;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="pending-empty">Todas las ventas tienen monto cargado.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const fecha = r.lead_created_at
      ? new Date(r.lead_created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';
    const tip = (r.tipification && r.tipification.trim()) || '<span class="muted">Sin clasificar</span>';

    /* F.4.b — Mostrar canal real del lead. Si no existe, fallback a Campaña / Vendedor */
    const canalLabel = r.canal || (r.is_campaign ? 'Campaña' : 'Vendedor');
    const canalClass = r.is_campaign ? 'origin-campaign' : 'origin-vendor';
    const origin = `<span class="origin-badge ${canalClass}">${canalLabel}</span>`;

    /* F.4.a — Etapa actual desde leads.section */
    const stage = r.section || '—';

    const nombre = r.nombre || `#${r.meistertask_id}`;
    const asesor = r.assignee || '—';
    const mid    = r.meistertask_id || '';

    return `
      <tr class="pending-row" data-mid="${mid}" style="cursor:pointer" role="button" tabindex="0" aria-label="Ver detalle de ${nombre}">
        <td class="pending-name">${nombre}</td>
        <td class="pending-asesor">${asesor}</td>
        <td class="pending-tip">${tip}</td>
        <td class="pending-origin">${origin}</td>
        <td class="pending-stage">${stage}</td>
        <td class="pending-date">${fecha}</td>
      </tr>
    `;
  }).join('');

  /* F.4.d — Delegar click en tbody (una sola escucha, no por fila) */
  tbody.onclick = function(e) {
    const tr = e.target.closest('tr.pending-row');
    if (!tr) return;
    const mid = tr.dataset.mid;
    _openLeadDetailModal(mid);
  };

  /* Soporte teclado: Enter / Space abre el modal */
  tbody.onkeydown = function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tr = e.target.closest('tr.pending-row');
    if (!tr) return;
    e.preventDefault();
    _openLeadDetailModal(tr.dataset.mid);
  };
}

/* ── Modal de detalle del lead (F.4.d) ──────────────────────── */

/**
 * Abre el modal #lead-detail-modal con la data del lead identificado por meistertask_id.
 * Usa los datos ya cargados en _pendingRows — no hace fetch adicional.
 * @param {string|number} mid - meistertask_id del lead
 */
function _openLeadDetailModal(mid) {
  const row = _pendingRows.find(r => String(r.meistertask_id) === String(mid));
  if (!row) return;

  const overlay = document.getElementById('lead-detail-modal');
  if (!overlay) return;

  /* Título */
  const titleEl = document.getElementById('lead-modal-title');
  if (titleEl) titleEl.textContent = `${row.nombre || '#' + mid} (${row.canal || 'sin canal'})`;

  /* Calcular días en CRM */
  const creado = row.lead_created_at ? new Date(row.lead_created_at) : null;
  const diasCRM = creado
    ? Math.floor((Date.now() - creado.getTime()) / 86400000)
    : null;
  const diasStr = diasCRM !== null ? `${diasCRM} día${diasCRM === 1 ? '' : 's'}` : '—';

  const fechaStr = creado
    ? creado.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  /* Grid de datos básicos */
  const gridEl = document.getElementById('lead-modal-basics');
  if (gridEl) {
    gridEl.innerHTML = `
      <div class="lead-modal-field"><span class="lead-modal-label">Canal</span><span class="lead-modal-value">${row.canal || '—'}</span></div>
      <div class="lead-modal-field"><span class="lead-modal-label">Asesor</span><span class="lead-modal-value">${row.assignee || '—'}</span></div>
      <div class="lead-modal-field"><span class="lead-modal-label">Tipificación</span><span class="lead-modal-value">${row.tipification || '—'}</span></div>
      <div class="lead-modal-field"><span class="lead-modal-label">Etapa actual</span><span class="lead-modal-value">${row.section || '—'}</span></div>
      <div class="lead-modal-field"><span class="lead-modal-label">Fecha de ingreso</span><span class="lead-modal-value">${fechaStr}</span></div>
      <div class="lead-modal-field"><span class="lead-modal-label">Días en CRM</span><span class="lead-modal-value">${diasStr}</span></div>
    `;
  }

  /* Historial de cambios de sección */
  const histEl = document.getElementById('lead-modal-history');
  if (histEl) {
    if (row.lead_section_history && row.lead_section_history.length) {
      histEl.innerHTML = row.lead_section_history.map(h => {
        const d = new Date(h.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `<li class="lead-modal-history-item"><span class="lead-modal-history-date">${d}</span><span class="lead-modal-history-move">${h.from} &rarr; ${h.to}</span></li>`;
      }).join('');
    } else {
      histEl.innerHTML = '<li class="lead-modal-history-empty">Sin historial disponible.</li>';
    }
  }

  /* Datos monetarios */
  const moneyEl     = document.getElementById('lead-modal-monetary');
  const moneySect   = document.getElementById('lead-modal-monetary-section');
  if (moneyEl && moneySect) {
    if (row.lead_monetary) {
      const m = row.lead_monetary;
      const updatedAt = m.updated_at
        ? new Date(m.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '—';
      moneyEl.innerHTML = `
        <div class="lead-modal-field"><span class="lead-modal-label">Precio final</span><span class="lead-modal-value">${m.precio_final != null ? fmtCurrency(m.precio_final) : '—'}</span></div>
        <div class="lead-modal-field"><span class="lead-modal-label">Capitas</span><span class="lead-modal-value">${m.capitas != null ? m.capitas : '—'}</span></div>
        <div class="lead-modal-field"><span class="lead-modal-label">Cerrado</span><span class="lead-modal-value">${m.is_closed ? 'Si' : 'No'}</span></div>
        <div class="lead-modal-field"><span class="lead-modal-label">Actualizado</span><span class="lead-modal-value">${updatedAt}</span></div>
      `;
      moneySect.hidden = false;
    } else {
      moneySect.hidden = true;
    }
  }

  /* Abrir */
  overlay.removeAttribute('hidden');
  overlay.focus();
}

/**
 * Cierra el modal #lead-detail-modal.
 */
function _closeLeadDetailModal() {
  const overlay = document.getElementById('lead-detail-modal');
  if (overlay) overlay.setAttribute('hidden', '');
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
