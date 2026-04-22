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
          barPercentage: 0.6, categoryPercentage: 0.7
        }]
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
          barPercentage: 0.6, categoryPercentage: 0.7
        }]
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
          categoryPercentage: 0.7
        }]
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
          categoryPercentage: 0.7
        }]
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

  /* ── Geo: choropleth map by department ── */
  if (data.geo) renderGeoMap(data.geo);

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

/* ── Geo choropleth map ─────────────────────────────────── */
let _leafletMap = null;
let _geoLayer   = null;

function _choroplethColor(value, max) {
  const t = max > 0 ? value / max : 0;
  if (t > 0.8) return '#FF0040';
  if (t > 0.6) return '#FF4068';
  if (t > 0.4) return '#FF80A0';
  if (t > 0.2) return '#C8D8DC';
  return '#E8F0F5';
}

function renderGeoMap(geoData) {
  const container = document.getElementById('geo-map');
  if (!container || typeof L === 'undefined') return;

  if (!_leafletMap) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    _leafletMap = L.map('geo-map', {
      center:             [-32.9, -68.8],
      zoom:               10,
      zoomControl:        false,
      scrollWheelZoom:    false,
      attributionControl: false,
      dragging:           false,
      doubleClickZoom:    false,
      boxZoom:            false,
      keyboard:           false
    });
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(_leafletMap);
  }

  if (_geoLayer) { _leafletMap.removeLayer(_geoLayer); _geoLayer = null; }

  const maxVal = Math.max(...Object.values(geoData), 1);

  _geoLayer = L.geoJSON(GRAN_MENDOZA_GEOJSON, {
    style: feature => {
      const nombre = feature.properties.nombre;
      const val    = geoData[nombre] || 0;
      return {
        fillColor:   _choroplethColor(val, maxVal),
        fillOpacity: 0.82,
        weight:      1.5,
        color:       '#253040',
        opacity:     0.5
      };
    },
    onEachFeature: (feature, layer) => {
      const nombre = feature.properties.nombre;
      const val    = geoData[nombre] || 0;
      layer.bindTooltip(
        `<div style="font-family:Outfit,sans-serif;font-size:13px;font-weight:600">${nombre}</div><div style="font-size:12px">${fmtNumber(val)} clicks</div>`,
        { className: 'geo-tooltip', sticky: true, direction: 'top' }
      );
      layer.on({
        mouseover: e => e.target.setStyle({ fillOpacity: 1.0, weight: 2.5 }),
        mouseout:  e => _geoLayer.resetStyle(e.target)
      });
    }
  }).addTo(_leafletMap);

  setTimeout(() => {
    if (_leafletMap) {
      _leafletMap.invalidateSize();
      if (_geoLayer) _leafletMap.fitBounds(_geoLayer.getBounds(), { padding: [20, 20] });
    }
  }, 200);
}

function invalidateGeoMap() {
  if (_leafletMap) {
    _leafletMap.invalidateSize();
    if (_geoLayer) _leafletMap.fitBounds(_geoLayer.getBounds(), { padding: [20, 20] });
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
          categoryPercentage: 0.7
        }]
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
          categoryPercentage: 0.7
        }]
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

  /* ── Status: SVG funnel chart — interactive, no static labels ── */
  _destroyChart('chart-status');
  const ctxSt = document.getElementById('chart-status');
  if (ctxSt && data.status) {
    const prevSvg = ctxSt.parentElement.querySelector('.umoh-funnel');
    if (prevSvg) prevSvg.remove();
    const prevTip = document.getElementById('umoh-funnel-tip');
    if (prevTip) prevTip.remove();
    ctxSt.style.display = 'none';

    const statusColors = [
      CHART_PALETTE.blue.solid,
      CHART_PALETTE.coral.solid,
      CHART_PALETTE.amber.solid,
      CHART_PALETTE.purple.solid,
      CHART_PALETTE.teal.solid,
      'rgba(72,199,142,0.65)',
      CHART_PALETTE.green.solid
    ];

    const labels = data.status.labels;
    const vals   = data.status.data;
    const total  = vals.reduce((a, b) => a + b, 0);
    const maxVal = Math.max(...vals);
    const n      = vals.length;

    const parent  = ctxSt.parentElement;
    const W       = Math.max(parent.clientWidth || 480, 320);
    const stageH  = 46;
    const gap     = 3;
    const totalH  = n * stageH + (n - 1) * gap;
    const cx      = W / 2;
    const maxBarW = W * 0.90;
    const minBarW = maxBarW * 0.20;

    const widths = vals.map(v => minBarW + (v / maxVal) * (maxBarW - minBarW));

    /* Tooltip — fixed position, follows cursor, matches Chart.js style */
    const tip = document.createElement('div');
    tip.id = 'umoh-funnel-tip';
    tip.style.cssText = 'position:fixed;background:rgba(15,23,42,0.92);color:#fff;font-family:Outfit,sans-serif;font-size:13px;font-weight:500;line-height:1.6;padding:8px 12px;border-radius:8px;pointer-events:none;display:none;white-space:nowrap;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.35)';
    document.body.appendChild(tip);

    const NS  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${totalH}`);
    svg.style.cssText = `display:block;width:100%;height:${totalH}px;overflow:visible;`;
    svg.classList.add('umoh-funnel');

    vals.forEach((val, i) => {
      const topW  = widths[i];
      const botW  = i < n - 1 ? widths[i + 1] : widths[i] * 0.82;
      const y     = i * (stageH + gap);
      const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
      const color = statusColors[i % statusColors.length];

      const x1 = cx - topW / 2;
      const x2 = cx + topW / 2;
      const x3 = cx + botW / 2;
      const x4 = cx - botW / 2;
      const r  = 5;

      const isFirst = i === 0;
      const isLast  = i === n - 1;
      let d;
      if (isFirst) {
        d = `M ${x1+r} ${y} L ${x2-r} ${y} Q ${x2} ${y} ${x2} ${y+r} L ${x3} ${y+stageH} L ${x4} ${y+stageH} L ${x1} ${y+r} Q ${x1} ${y} ${x1+r} ${y} Z`;
      } else if (isLast) {
        d = `M ${x1} ${y} L ${x2} ${y} L ${x3-r} ${y+stageH} Q ${x3} ${y+stageH} ${x3} ${y+stageH-r} L ${x4} ${y+stageH-r} Q ${x4} ${y+stageH} ${x4+r} ${y+stageH} Z`;
      } else {
        d = `M ${x1} ${y} L ${x2} ${y} L ${x3} ${y+stageH} L ${x4} ${y+stageH} Z`;
      }

      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', color);
      path.style.cursor     = 'pointer';
      path.style.transition = 'opacity 0.15s';

      path.addEventListener('mousemove', e => {
        tip.style.display = 'block';
        tip.style.left    = (e.clientX + 14) + 'px';
        tip.style.top     = (e.clientY - 10) + 'px';
        tip.innerHTML     = `<span style="font-weight:700">${labels[i]}</span><br>${fmtNumber(val)} leads &nbsp;&middot;&nbsp; ${pct}%`;
        path.style.opacity = '0.72';
      });
      path.addEventListener('mouseleave', () => {
        tip.style.display  = 'none';
        path.style.opacity = '1';
      });

      svg.appendChild(path);
    });

    parent.appendChild(svg);
  }

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
          categoryPercentage: 0.7
        }]
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
          categoryPercentage: 0.7
        }]
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
