/**
 * api.js — Capa de abstracción de datos.
 *
 * Fase 1: USE_MOCK = true  → sirve desde mockdata.js
 * Fase 2: USE_MOCK = false → llama a los endpoints PHP reales
 *
 * charts.js y filters.js siempre llaman a fetchData().
 * Para pasar a producción solo cambiar USE_MOCK a false.
 */

const USE_MOCK = true; // Cambiar a false en producción (el servidor ya tiene USE_MOCK=false)
const API_BASE = 'api/endpoints';

/**
 * Obtiene datos para un endpoint dado.
 * @param {string} endpoint  - 'summary' | 'tofu' | 'mofu' | 'bofu'
 * @param {Object} params    - { period: '7d' | '30d' | '90d' | 'custom', start?, end? }
 * @returns {Promise<Object>}
 */
async function fetchData(endpoint, params = {}) {
  if (USE_MOCK) {
    return getMockData(endpoint, params);
  }

  const base = window.location.origin + '/' + API_BASE;
  const url  = new URL(`${base}/${endpoint}.php`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status} on /${endpoint}`);
  }

  return res.json();
}

/**
 * Resuelve datos mock por endpoint y período.
 * @param {string} endpoint
 * @param {Object} params
 * @returns {Promise<Object>}
 */
function getMockData(endpoint, params) {
  const period = params.period || '30d';

  /* Rango personalizado: generar datos con granularidad correcta de fechas */
  if (period === 'custom' && params.start && params.end) {
    const data = generateCustomMockData(endpoint, params.start, params.end);
    return new Promise(resolve => setTimeout(() => resolve(data), 80));
  }

  const map = {
    summary: MOCK_DATA.performance,
    tofu:    MOCK_DATA.tofu,
    mofu:    MOCK_DATA.mofu,
    bofu:    MOCK_DATA.bofu
  };

  if (!map[endpoint]) {
    return Promise.reject(new Error(`Endpoint desconocido: ${endpoint}`));
  }

  const data = map[endpoint][period];
  if (!data) {
    return Promise.reject(new Error(`Sin datos para período: ${period}`));
  }

  return new Promise(resolve => setTimeout(() => resolve(data), 80));
}
