/**
 * charts.js — Toda la lógica de render: Chart.js + Leaflet.
 * Consumir siempre a través de renderSection(section, data).
 *
 * Paleta: navy/slate/silver/mist como colores principales.
 * Rojo #FF0040 solo para el acento puntual (máx. 1 dataset por chart).
 */

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
    cutout: '65%',
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

  /* ── Stacked bar: Inversión (bottom) + Resultado Neto (top) ── */
  _destroyChart('chart-trend');
  const ctx = document.getElementById('chart-trend');
  if (!ctx) return;

  const netRevenue = data.trend.revenue.map((r, i) => r - data.trend.spend[i]);
  const axis = _axisDefaults();

  _charts['chart-trend'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.trend.labels,
      datasets: [
        {
          label:           'Inversión',
          data:            data.trend.spend,
          backgroundColor: 'rgba(143,165,168,0.7)',  /* silver */
          borderRadius:    { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
          borderSkipped:   false,
          stack:           'stack'
        },
        {
          label:           'Resultado Neto',
          data:            netRevenue,
          backgroundColor: 'rgba(37,48,64,0.85)',   /* navy */
          borderRadius:    { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
          borderSkipped:   false,
          stack:           'stack'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { font: { family: 'Outfit', size: 12 }, color: _cssVar('--text-secondary'), usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 0) return ` Inversión: ${fmtCurrency(ctx.parsed.y)}`;
              return ` Ingresos: ${fmtCurrency(data.trend.revenue[ctx.dataIndex])} (neto: ${fmtCurrency(ctx.parsed.y)})`;
            }
          }
        }
      },
      scales: {
        y: { stacked: true, ...axis, ticks: { ...axis.ticks, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } },
        x: { stacked: true, ...axis, grid: { display: false } }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════
   TOFU
══════════════════════════════════════════════════════════ */
function renderTofu(data) {
  const prev = data.prev || {};

  setKPI('tofu-impressions', fmtNumber(data.impressions));
  setKPI('tofu-clicks',      fmtNumber(data.clicks));
  setKPI('tofu-cpc',         fmtCurrency(data.cpc));

  _setDelta('delta-tofu-impressions', data.impressions, prev.impressions);
  _setDelta('delta-tofu-clicks',      data.clicks,      prev.clicks);
  _setDelta('delta-tofu-cpc',         data.cpc,         prev.cpc, true);

  /* ── Trend: Impresiones + Clicks (ejes duales) ── */
  _destroyChart('chart-tofu-trend');
  const ctxTrend = document.getElementById('chart-tofu-trend');
  if (ctxTrend && data.trend) {
    const axis = _axisDefaults();
    const muted = _cssVar('--text-muted');

    _charts['chart-tofu-trend'] = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: data.trend.labels,
        datasets: [
          {
            label:           'Impresiones',
            data:            data.trend.impressions,
            borderColor:     '#2563EB',
            backgroundColor: 'rgba(37,99,235,0.08)',
            borderWidth:     2,
            pointRadius:     4,
            pointBackgroundColor: '#2563EB',
            tension:         0.35,
            fill:            true,
            yAxisID:         'yImp'
          },
          {
            label:           'Clicks',
            data:            data.trend.clicks,
            borderColor:     '#F59E0B',
            backgroundColor: 'rgba(245,158,11,0.07)',
            borderWidth:     2,
            pointRadius:     4,
            pointBackgroundColor: '#F59E0B',
            tension:         0.35,
            fill:            true,
            yAxisID:         'yClk'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { font: { family: 'Outfit', size: 12 }, color: _cssVar('--text-secondary'), usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.dataset.yAxisID === 'yImp'
                  ? fmtNumber(ctx.parsed.y)
                  : fmtNumber(ctx.parsed.y);
                return ` ${ctx.dataset.label}: ${v}`;
              }
            }
          }
        },
        scales: {
          yImp: { ...axis, position: 'left',  ticks: { ...axis.ticks, callback: v => (v / 1000).toFixed(0) + 'k' }, title: { display: true, text: 'Impresiones', color: muted, font: { size: 11 } } },
          yClk: { ...axis, position: 'right', grid: { display: false }, ticks: { ...axis.ticks }, title: { display: true, text: 'Clicks', color: muted, font: { size: 11 } } },
          x:    { ...axis, grid: { display: false } }
        }
      }
    });
  }

  /* Search terms table */
  const tbody = document.getElementById('search-terms-body');
  if (tbody) {
    tbody.innerHTML = data.search_terms.map(row => `
      <tr>
        <td class="term-name">${row.term}</td>
        <td class="term-bar"><div class="bar-wrap"><div class="bar-fill" style="width:${row.pct}%"></div></div></td>
        <td class="term-clicks">${fmtNumber(row.clicks)}</td>
      </tr>
    `).join('');
  }

  /* Channels donut */
  _destroyChart('chart-channels');
  const ctxCh = document.getElementById('chart-channels');
  if (ctxCh) {
    _charts['chart-channels'] = new Chart(ctxCh, {
      type: 'doughnut',
      data: {
        labels:   data.channels.labels,
        datasets: [{ data: data.channels.data, backgroundColor: data.channels.colors, borderWidth: 0, hoverOffset: 8 }]
      },
      options: _donutOpts()
    });
  }

  /* Devices donut */
  _destroyChart('chart-devices');
  const ctxDev = document.getElementById('chart-devices');
  if (ctxDev) {
    _charts['chart-devices'] = new Chart(ctxDev, {
      type: 'doughnut',
      data: {
        labels:   data.devices.labels,
        datasets: [{ data: data.devices.data, backgroundColor: data.devices.colors, borderWidth: 0, hoverOffset: 8 }]
      },
      options: _donutOpts()
    });
  }

  renderGeoMap(data.geo);
}

/* ── Leaflet choropleth ────────────────────────────────── */
let _leafletMap = null;
let _geoLayer   = null;

const GRAN_MENDOZA_DEPTS = ['Capital', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'Luján de Cuyo', 'Maipú'];
const GEOJSON_URL = 'https://raw.githubusercontent.com/mgaitan/departamentos-argentina/master/departamentos.geojson';

function _choroplethColor(value, max) {
  const t = value / max;
  if (t > 0.8) return '#FF0040';
  if (t > 0.6) return '#FF4068';
  if (t > 0.4) return '#FF80A0';
  if (t > 0.2) return '#C8D8DC';
  return '#F0F5F5';
}

async function renderGeoMap(geoData) {
  const container = document.getElementById('geo-map');
  if (!container) return;

  if (!_leafletMap) {
    _leafletMap = L.map('geo-map', { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 14
    }).addTo(_leafletMap);
  }

  if (_geoLayer) { _leafletMap.removeLayer(_geoLayer); _geoLayer = null; }

  const maxVal = Math.max(...Object.values(geoData));

  try {
    const resp = await fetch(GEOJSON_URL);
    if (!resp.ok) throw new Error(`GeoJSON HTTP ${resp.status}`);
    const json = await resp.json();

    const filtered = {
      type: 'FeatureCollection',
      features: json.features.filter(f => {
        const prov = (f.properties.provincia || '').trim();
        const dept = (f.properties.departamento || f.properties.nombre || '').trim();
        return prov === 'Mendoza' && GRAN_MENDOZA_DEPTS.includes(dept);
      })
    };

    if (filtered.features.length === 0) throw new Error('No se encontraron departamentos de Gran Mendoza');

    _geoLayer = L.geoJSON(filtered, {
      style: feature => {
        const dept = (feature.properties.departamento || feature.properties.nombre || '').trim();
        const val  = geoData[dept] || 0;
        return { fillColor: _choroplethColor(val, maxVal), fillOpacity: 0.78, weight: 1.5, color: '#253040', opacity: 0.6 };
      },
      onEachFeature: (feature, layer) => {
        const dept = (feature.properties.departamento || feature.properties.nombre || '').trim();
        const val  = geoData[dept] || 0;
        layer.bindTooltip(`<b>${dept}</b><br>${fmtNumber(val)} clicks`, { className: 'geo-tooltip', sticky: true });
        layer.on({
          mouseover: e => { e.target.setStyle({ fillOpacity: 0.95 }); },
          mouseout:  e => { _geoLayer.resetStyle(e.target); }
        });
      }
    }).addTo(_leafletMap);

    _leafletMap.fitBounds(_geoLayer.getBounds(), { padding: [30, 30] });
  } catch (err) {
    console.error('[GeoMap]', err);
    container.innerHTML = `<p class="map-error">No se pudo cargar el mapa: ${err.message}</p>`;
  }
}

/* ══════════════════════════════════════════════════════════
   MOFU
══════════════════════════════════════════════════════════ */
function renderMofu(data) {
  const prev = data.prev || {};

  setKPI('mofu-leads',      fmtNumber(data.total_leads));
  setKPI('mofu-cpl',        fmtCurrency(data.cpl));
  setKPI('mofu-tipif',      fmtPercent(data.tipification_rate));
  setKPI('mofu-highintent', fmtNumber(data.high_intent_leads));

  _setDelta('delta-mofu-leads',      data.total_leads,       prev.total_leads);
  _setDelta('delta-mofu-cpl',        data.cpl,               prev.cpl,               true);
  _setDelta('delta-mofu-tipif',      data.tipification_rate, prev.tipification_rate);
  _setDelta('delta-mofu-highintent', data.high_intent_leads, prev.high_intent_leads);

  /* ── Trend: Leads (barras) + CPL (línea eje derecho) ── */
  _destroyChart('chart-mofu-trend');
  const ctxMT = document.getElementById('chart-mofu-trend');
  if (ctxMT && data.trend) {
    const axis = _axisDefaults();
    const muted = _cssVar('--text-muted');

    _charts['chart-mofu-trend'] = new Chart(ctxMT, {
      type: 'bar',
      data: {
        labels: data.trend.labels,
        datasets: [
          {
            type:            'bar',
            label:           'Leads',
            data:            data.trend.leads,
            backgroundColor: 'rgba(37,48,64,0.75)',
            borderRadius:    4,
            borderSkipped:   false,
            yAxisID:         'yLeads'
          },
          {
            type:            'line',
            label:           'CPL',
            data:            data.trend.cpl,
            borderColor:     '#FF0040',
            backgroundColor: 'transparent',
            borderWidth:     2,
            pointRadius:     4,
            pointBackgroundColor: '#FF0040',
            tension:         0.35,
            yAxisID:         'yCpl'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { font: { family: 'Outfit', size: 12 }, color: _cssVar('--text-secondary'), usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.dataset.label === 'CPL') return ` CPL: ${fmtCurrency(ctx.parsed.y)}`;
                return ` Leads: ${fmtNumber(ctx.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          yLeads: { ...axis, position: 'left',  grid: { color: axis.grid.color }, title: { display: true, text: 'Leads', color: muted, font: { size: 11 } } },
          yCpl:   { ...axis, position: 'right', grid: { display: false }, ticks: { ...axis.ticks, callback: v => '$' + (v / 1000).toFixed(1) + 'k' }, title: { display: true, text: 'CPL', color: muted, font: { size: 11 } } },
          x:      { ...axis, grid: { display: false } }
        }
      }
    });
  }

  /* Status horizontal bars */
  _destroyChart('chart-status');
  const ctxSt = document.getElementById('chart-status');
  if (ctxSt) {
    _charts['chart-status'] = new Chart(ctxSt, {
      type: 'bar',
      data: {
        labels:   data.status.labels,
        datasets: [{ data: data.status.data, backgroundColor: data.status.colors, borderRadius: 4, borderSkipped: false, barThickness: 20 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${fmtNumber(ctx.parsed.x)} leads` } }
        },
        scales: {
          x: { ..._axisDefaults(), ticks: { ..._axisDefaults().ticks } },
          y: { grid: { display: false }, ticks: { font: { size: 12 }, color: _cssVar('--text-secondary') } }
        }
      }
    });
  }

  /* Segments donut */
  _destroyChart('chart-segments');
  const ctxSeg = document.getElementById('chart-segments');
  if (ctxSeg) {
    _charts['chart-segments'] = new Chart(ctxSeg, {
      type: 'doughnut',
      data: {
        labels:   data.segments.labels,
        datasets: [{ data: data.segments.data, backgroundColor: data.segments.colors, borderWidth: 0, hoverOffset: 8 }]
      },
      options: _donutOpts()
    });
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

  /* ── Trend: Ingresos (barras) + Ventas (línea eje derecho) ── */
  _destroyChart('chart-bofu-trend');
  const ctxBT = document.getElementById('chart-bofu-trend');
  if (ctxBT && data.trend) {
    const axis = _axisDefaults();
    const muted = _cssVar('--text-muted');

    _charts['chart-bofu-trend'] = new Chart(ctxBT, {
      type: 'bar',
      data: {
        labels: data.trend.labels,
        datasets: [
          {
            type:            'bar',
            label:           'Ingresos',
            data:            data.trend.revenue,
            backgroundColor: 'rgba(37,48,64,0.75)',
            borderRadius:    4,
            borderSkipped:   false,
            yAxisID:         'yRev'
          },
          {
            type:            'line',
            label:           'Ventas',
            data:            data.trend.sales,
            borderColor:     '#FF0040',
            backgroundColor: 'transparent',
            borderWidth:     2,
            pointRadius:     5,
            pointBackgroundColor: '#FF0040',
            tension:         0.35,
            yAxisID:         'ySales'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { font: { family: 'Outfit', size: 12 }, color: _cssVar('--text-secondary'), usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.dataset.label === 'Ventas') return ` Ventas: ${fmtNumber(ctx.parsed.y)}`;
                return ` Ingresos: ${fmtCurrency(ctx.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          yRev:   { ...axis, position: 'left',  ticks: { ...axis.ticks, callback: v => '$' + (v / 1000).toFixed(0) + 'k' }, title: { display: true, text: 'Ingresos', color: muted, font: { size: 11 } } },
          ySales: { ...axis, position: 'right', grid: { display: false }, ticks: { ...axis.ticks }, title: { display: true, text: 'Ventas', color: muted, font: { size: 11 } } },
          x:      { ...axis, grid: { display: false } }
        }
      }
    });
  }

  /* Typification donut */
  _destroyChart('chart-typification');
  const ctxTyp = document.getElementById('chart-typification');
  if (ctxTyp) {
    _charts['chart-typification'] = new Chart(ctxTyp, {
      type: 'doughnut',
      data: {
        labels:   data.typification.labels,
        datasets: [{ data: data.typification.data, backgroundColor: data.typification.colors, borderWidth: 0, hoverOffset: 8 }]
      },
      options: _donutOpts()
    });
  }

  /* Segment sales table */
  const segBody = document.getElementById('bofu-segment-body');
  if (segBody && data.typification) {
    const total = data.typification.data.reduce((a, b) => a + b, 0);
    segBody.innerHTML = data.typification.labels.map((label, i) => {
      const val = data.typification.data[i];
      const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
      const color = data.typification.colors[i];
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
}

/* ══════════════════════════════════════════════════════════
   SPARKLINES — micro line charts inside Performance KPI cards
══════════════════════════════════════════════════════════ */

/**
 * Renders a single sparkline chart.
 * @param {string} id      - canvas element ID (e.g. 'sparkline-revenue')
 * @param {number[]} values - array of data points
 * @param {boolean} positive - true = accent color, false = red
 */
function _renderSparkline(id, values, positive) {
  _destroyChart(id);
  const ctx = document.getElementById(id);
  if (!ctx || !values || values.length < 2) return;

  const color = positive ? _cssVar('--umoh-accent') : '#FF0040';
  const colorAlpha = positive ? 'rgba(255,0,64,0.12)' : 'rgba(255,0,64,0.12)';

  _charts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: values.map(() => ''),
      datasets: [{
        data:            values,
        borderColor:     color,
        backgroundColor: colorAlpha,
        borderWidth:     1.5,
        pointRadius:     0,
        tension:         0.4,
        fill:            true
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 400 },
      plugins: {
        legend:  { display: false },
        tooltip: { enabled: false }
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
 * Revenue and spend come directly from trend data.
 * ROI, impressions, leads, sales are derived point-by-point.
 */
function renderSparklines(data) {
  if (!data.trend) return;

  const trend   = data.trend;
  const revenue = trend.revenue;
  const spend   = trend.spend;

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

  _renderSparkline('sparkline-revenue',     revenue,     isUp(revenue));
  _renderSparkline('sparkline-spend',       spend,       !isUp(spend));   /* lower spend = better */
  _renderSparkline('sparkline-roi',         roi,         isUp(roi));
  _renderSparkline('sparkline-impressions', impressions, isUp(impressions));
  _renderSparkline('sparkline-leads',       leads,       isUp(leads));
  _renderSparkline('sparkline-sales',       sales,       isUp(sales));
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
