/**
 * charts.js — Toda la lógica de render: Chart.js + Leaflet.
 * Consumir siempre a través de renderSection(section, data).
 */

/* ── Chart registry (para destruir antes de recrear) ────── */
const _charts = {};

function _destroyChart(id) {
  if (_charts[id]) {
    _charts[id].destroy();
    delete _charts[id];
  }
}

/* ── Formato numérico ───────────────────────────────────── */
function fmtCurrency(n) {
  const rounded = Math.round(n);
  return '$' + rounded.toLocaleString('es-AR');
}

function fmtNumber(n) {
  return Math.round(n).toLocaleString('es-AR');
}

function fmtPercent(n) {
  return parseFloat(n).toFixed(1) + '%';
}

/* ── Setear KPI en DOM ──────────────────────────────────── */
function setKPI(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ── Opciones base para donuts ──────────────────────────── */
const DONUT_OPTS = {
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        font:    { family: 'Outfit', size: 12 },
        color:   '#5A7080',
        padding: 16,
        usePointStyle: true,
        pointStyleWidth: 10
      }
    },
    tooltip: {
      callbacks: {
        label: ctx => ` ${ctx.label}: ${fmtNumber(ctx.parsed)} (${fmtPercent(ctx.parsed / ctx.dataset.data.reduce((a,b) => a+b, 0) * 100)})`
      }
    }
  },
  cutout: '65%',
  responsive:          true,
  maintainAspectRatio: true
};

/* ── Chart.js global defaults ───────────────────────────── */
Chart.defaults.font.family = 'Outfit';
Chart.defaults.color       = '#5A7080';

/* ══════════════════════════════════════════════════════════
   PERFORMANCE
══════════════════════════════════════════════════════════ */
function renderPerformance(data) {
  setKPI('kpi-revenue',     fmtCurrency(data.revenue));
  setKPI('kpi-spend',       fmtCurrency(data.ad_spend));
  setKPI('kpi-impressions', fmtNumber(data.impressions));
  setKPI('kpi-leads',       fmtNumber(data.leads));
  setKPI('kpi-sales',       fmtNumber(data.closed_sales));

  _destroyChart('chart-trend');
  const ctx = document.getElementById('chart-trend');
  if (!ctx) return;

  _charts['chart-trend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.trend.labels,
      datasets: [
        {
          label:           'Inversión',
          data:            data.trend.spend,
          borderColor:     '#8FA5A8',
          backgroundColor: 'rgba(143,165,168,0.08)',
          borderWidth:     2,
          pointRadius:     4,
          pointBackgroundColor: '#8FA5A8',
          tension:         0.4,
          fill:            true,
          yAxisID:         'y'
        },
        {
          label:           'Ingresos',
          data:            data.trend.revenue,
          borderColor:     '#FF0040',
          backgroundColor: 'rgba(255,0,64,0.07)',
          borderWidth:     2.5,
          pointRadius:     5,
          pointBackgroundColor: '#FF0040',
          tension:         0.4,
          fill:            true,
          yAxisID:         'y'
        }
      ]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { font: { family: 'Outfit', size: 12 }, color: '#5A7080', usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmtCurrency(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            font: { family: 'Outfit', size: 11 },
            color: '#8FA5A8',
            callback: v => '$' + (v / 1000).toFixed(0) + 'k'
          },
          grid: { color: 'rgba(200,216,220,0.25)' },
          border: { dash: [4, 4] }
        },
        x: {
          ticks: { font: { family: 'Outfit', size: 11 }, color: '#8FA5A8' },
          grid:  { display: false }
        }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════
   TOFU
══════════════════════════════════════════════════════════ */
function renderTofu(data) {
  setKPI('tofu-impressions', fmtNumber(data.impressions));
  setKPI('tofu-clicks',      fmtNumber(data.clicks));
  setKPI('tofu-cpc',         fmtCurrency(data.cpc));

  /* Search terms table */
  const tbody = document.getElementById('search-terms-body');
  if (tbody) {
    tbody.innerHTML = data.search_terms.map(row => `
      <tr>
        <td class="term-name">${row.term}</td>
        <td class="term-bar">
          <div class="bar-wrap">
            <div class="bar-fill" style="width:${row.pct}%"></div>
          </div>
        </td>
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
      options: DONUT_OPTS
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
      options: DONUT_OPTS
    });
  }

  /* Geo map */
  renderGeoMap(data.geo);
}

/* ── Leaflet choropleth ─────────────────────────────────── */
let _leafletMap  = null;
let _geoLayer    = null;

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

  /* Inicializar mapa Leaflet una sola vez */
  if (!_leafletMap) {
    _leafletMap = L.map('geo-map', {
      zoomControl:      true,
      scrollWheelZoom:  false,
      attributionControl: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 14
    }).addTo(_leafletMap);
  }

  /* Limpiar capa anterior */
  if (_geoLayer) {
    _leafletMap.removeLayer(_geoLayer);
    _geoLayer = null;
  }

  const maxVal = Math.max(...Object.values(geoData));

  try {
    const resp = await fetch(GEOJSON_URL);
    if (!resp.ok) throw new Error(`GeoJSON HTTP ${resp.status}`);
    const json = await resp.json();

    /* Filtrar solo los 6 departamentos del Gran Mendoza */
    const filtered = {
      type: 'FeatureCollection',
      features: json.features.filter(f => {
        const prov = (f.properties.provincia  || '').trim();
        const dept = (f.properties.departamento || f.properties.nombre || '').trim();
        return prov === 'Mendoza' && GRAN_MENDOZA_DEPTS.includes(dept);
      })
    };

    if (filtered.features.length === 0) {
      throw new Error('No se encontraron departamentos de Gran Mendoza en el GeoJSON');
    }

    _geoLayer = L.geoJSON(filtered, {
      style: feature => {
        const dept = (feature.properties.departamento || feature.properties.nombre || '').trim();
        const val  = geoData[dept] || 0;
        return {
          fillColor:   _choroplethColor(val, maxVal),
          fillOpacity: 0.78,
          weight:      1.5,
          color:       '#253040',
          opacity:     0.6
        };
      },
      onEachFeature: (feature, layer) => {
        const dept = (feature.properties.departamento || feature.properties.nombre || '').trim();
        const val  = geoData[dept] || 0;
        layer.bindTooltip(
          `<b>${dept}</b><br>${fmtNumber(val)} clicks`,
          { className: 'geo-tooltip', sticky: true }
        );
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
  setKPI('mofu-leads',      fmtNumber(data.total_leads));
  setKPI('mofu-cpl',        fmtCurrency(data.cpl));
  setKPI('mofu-tipif',      fmtPercent(data.tipification_rate));
  setKPI('mofu-highintent', fmtNumber(data.high_intent_leads));

  /* Status horizontal bars */
  _destroyChart('chart-status');
  const ctxSt = document.getElementById('chart-status');
  if (ctxSt) {
    _charts['chart-status'] = new Chart(ctxSt, {
      type: 'bar',
      data: {
        labels:   data.status.labels,
        datasets: [{
          data:            data.status.data,
          backgroundColor: data.status.colors,
          borderRadius:    4,
          borderSkipped:   false,
          barThickness:    20
        }]
      },
      options: {
        indexAxis:           'y',
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${fmtNumber(ctx.parsed.x)} leads`
            }
          }
        },
        scales: {
          x: {
            ticks: { font: { size: 11 }, color: '#8FA5A8' },
            grid:  { color: 'rgba(200,216,220,0.25)' },
            border: { dash: [4,4] }
          },
          y: {
            ticks: { font: { size: 12 }, color: '#5A7080' },
            grid:  { display: false }
          }
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
      options: DONUT_OPTS
    });
  }
}

/* ══════════════════════════════════════════════════════════
   BOFU
══════════════════════════════════════════════════════════ */
function renderBofu(data) {
  setKPI('bofu-revenue',       fmtCurrency(data.total_revenue));
  setKPI('bofu-sales',         fmtNumber(data.closed_sales));
  setKPI('bofu-ticket',        fmtCurrency(data.avg_ticket));
  setKPI('bofu-conversion',    fmtPercent(data.conversion_rate));
  setKPI('bofu-capitas',       fmtNumber(data.capitas_closed));
  setKPI('bofu-ticket-capita', fmtCurrency(data.avg_ticket_per_capita));

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
      options: DONUT_OPTS
    });
  }
}

/* ── Entry point: router de sección ────────────────────── */
function renderSection(section, data) {
  switch (section) {
    case 'performance': renderPerformance(data); break;
    case 'tofu':        renderTofu(data);        break;
    case 'mofu':        renderMofu(data);        break;
    case 'bofu':        renderBofu(data);        break;
  }
}
