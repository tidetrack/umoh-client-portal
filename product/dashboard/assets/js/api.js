/**
 * api.js — Capa de abstracción de datos.
 *
 * USE_MOCK es per-endpoint: cada vista del dashboard puede estar mock o real
 * de forma independiente. Esto permite migrar sección por sección a datos
 * reales sin romper las que todavía no están integradas.
 *
 * Estado MVP (2026-04-29):
 *   tofu    → REAL (Supabase tabla tofu_ads_daily, vía product/api/endpoints/tofu.php)
 *   summary → mock (pendiente migración a Supabase)
 *   mofu    → mock (pendiente endpoint Supabase para tabla leads)
 *   bofu    → mock (pendiente endpoint Supabase para tabla lead_monetary)
 *
 * charts.js y filters.js siempre llaman a fetchData().
 */

const USE_MOCK = {
  summary: true,
  tofu:    false,
  mofu:    true,
  bofu:    true,
};
const API_BASE = 'api/endpoints';

/**
 * Obtiene datos para un endpoint dado.
 * @param {string} endpoint  - 'summary' | 'tofu' | 'mofu' | 'bofu'
 * @param {Object} params    - { period: '7d' | '30d' | '90d' | 'custom', start?, end? }
 * @returns {Promise<Object>}
 */
async function fetchData(endpoint, params = {}) {
  if (USE_MOCK[endpoint] !== false) {
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
  let period = params.period || '30d';

  /* Rango personalizado: generar datos con granularidad correcta de fechas */
  if (period === 'custom' && params.start && params.end) {
    const data = generateCustomMockData(endpoint, params.start, params.end);
    return new Promise(resolve => setTimeout(() => resolve(data), 80));
  }

  /* Histórico total: usar granularidad seleccionada */
  if (period === 'all') {
    const g = (params.granularity) || 'meses';
    period = `all_${g}`;
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
