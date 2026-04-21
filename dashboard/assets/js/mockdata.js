/**
 * mockdata.js — Datos de ejemplo para todas las secciones del dashboard.
 * Cliente: Prevención Salud (prepagas.umohcrew.com)
 *
 * Paleta de colores: navy (#253040), slate (#5A7080), silver (#8FA5A8),
 * mist (#C8D8DC). El rojo #FF0040 solo se usa como acento puntual.
 *
 * Cada período incluye `prev` (período anterior equivalente) para deltas
 * y `trend` para gráficos de evolución temporal.
 */

/* ── Paleta UMOH (sin rojo dominante) ────────────────────── */
const C = {
  navy:   '#253040',
  slate:  '#5A7080',
  silver: '#8FA5A8',
  mist:   '#C8D8DC',
  light:  '#E8EDF2',
  accent: '#FF0040'   // solo como acento
};

const MOCK_DATA = {

  /* ──────────────────────────────────────────
     PERFORMANCE — resumen general
  ────────────────────────────────────────── */
  performance: {
    '7d': {
      revenue: 1240500, ad_spend: 185000, impressions: 124500, leads: 48, closed_sales: 12,
      trend: {
        labels:  ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
        spend:   [26000, 28000, 25000, 27000, 30000, 22000, 27000],
        revenue: [172000, 185000, 168000, 192000, 210000, 145000, 168500]
      },
      prev: { revenue: 1105000, ad_spend: 168000, impressions: 110800, leads: 43, closed_sales: 10 }
    },
    '30d': {
      revenue: 4850000, ad_spend: 720000, impressions: 485000, leads: 187, closed_sales: 43,
      trend: {
        labels:  ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        spend:   [175000, 185000, 172000, 188000],
        revenue: [1150000, 1280000, 1165000, 1255000]
      },
      prev: { revenue: 4190000, ad_spend: 638000, impressions: 415000, leads: 158, closed_sales: 36 }
    },
    '90d': {
      revenue: 14200000, ad_spend: 2100000, impressions: 1420000, leads: 534, closed_sales: 121,
      trend: {
        labels:  ['Enero', 'Febrero', 'Marzo'],
        spend:   [680000, 710000, 710000],
        revenue: [4550000, 4750000, 4900000]
      },
      prev: { revenue: 13280000, ad_spend: 1960000, impressions: 1325000, leads: 498, closed_sales: 113 }
    }
  },

  /* ──────────────────────────────────────────
     TOFU — Awareness
  ────────────────────────────────────────── */
  tofu: {
    '7d': {
      impressions: 124500, clicks: 3840, cpc: 48.15,
      trend: {
        labels:      ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
        impressions: [17800, 19200, 17100, 18500, 20400, 14900, 16600],
        clicks:      [550,   590,   534,   568,   630,   460,   508]
      },
      search_terms: [
        { term: 'prepaga mendoza',           clicks: 892, pct: 100 },
        { term: 'seguro de salud mendoza',   clicks: 645, pct: 72  },
        { term: 'obra social privada',       clicks: 487, pct: 55  },
        { term: 'prevención salud mendoza',  clicks: 412, pct: 46  },
        { term: 'prepaga para familias',     clicks: 334, pct: 37  },
        { term: 'plan de salud empresarial', clicks: 289, pct: 32  },
        { term: 'cobertura médica mendoza',  clicks: 241, pct: 27  },
        { term: 'seguro medico barato',      clicks: 198, pct: 22  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [1920, 840, 620, 315, 145],
        colors: [C.navy, C.slate, C.silver, C.mist, C.light]
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [2304, 1344, 192],
        colors: [C.navy, C.slate, C.mist]
      },
      geo: {
        'Capital': 145, 'Godoy Cruz': 198, 'Guaymallén': 167,
        'Las Heras': 112, 'Luján de Cuyo': 89, 'Maipú': 134
      },
      prev: { impressions: 110800, clicks: 3420, cpc: 49.12 }
    },
    '30d': {
      impressions: 485000, clicks: 14920, cpc: 48.25,
      trend: {
        labels:      ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        impressions: [115000, 128000, 118000, 124000],
        clicks:      [3540,   3880,   3610,   3890]
      },
      search_terms: [
        { term: 'prepaga mendoza',           clicks: 3480, pct: 100 },
        { term: 'seguro de salud mendoza',   clicks: 2510, pct: 72  },
        { term: 'obra social privada',       clicks: 1890, pct: 54  },
        { term: 'prevención salud mendoza',  clicks: 1600, pct: 46  },
        { term: 'prepaga para familias',     clicks: 1298, pct: 37  },
        { term: 'plan de salud empresarial', clicks: 1120, pct: 32  },
        { term: 'cobertura médica mendoza',  clicks:  938, pct: 27  },
        { term: 'seguro medico barato',      clicks:  770, pct: 22  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [7460, 3280, 2415, 1228, 537],
        colors: [C.navy, C.slate, C.silver, C.mist, C.light]
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [8950, 5220, 750],
        colors: [C.navy, C.slate, C.mist]
      },
      geo: {
        'Capital': 565, 'Godoy Cruz': 770, 'Guaymallén': 652,
        'Las Heras': 437, 'Luján de Cuyo': 346, 'Maipú': 522
      },
      prev: { impressions: 415000, clicks: 12780, cpc: 49.92 }
    },
    '90d': {
      impressions: 1420000, clicks: 43600, cpc: 48.17,
      trend: {
        labels:      ['Enero', 'Febrero', 'Marzo'],
        impressions: [455000, 475000, 490000],
        clicks:      [13800,  14600,  15200]
      },
      search_terms: [
        { term: 'prepaga mendoza',           clicks: 10140, pct: 100 },
        { term: 'seguro de salud mendoza',   clicks:  7330, pct: 72  },
        { term: 'obra social privada',       clicks:  5520, pct: 54  },
        { term: 'prevención salud mendoza',  clicks:  4680, pct: 46  },
        { term: 'prepaga para familias',     clicks:  3790, pct: 37  },
        { term: 'plan de salud empresarial', clicks:  3270, pct: 32  },
        { term: 'cobertura médica mendoza',  clicks:  2740, pct: 27  },
        { term: 'seguro medico barato',      clicks:  2250, pct: 22  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [21800, 9580, 7060, 3590, 1570],
        colors: [C.navy, C.slate, C.silver, C.mist, C.light]
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [26160, 15260, 2180],
        colors: [C.navy, C.slate, C.mist]
      },
      geo: {
        'Capital': 1650, 'Godoy Cruz': 2250, 'Guaymallén': 1905,
        'Las Heras': 1275, 'Luján de Cuyo': 1010, 'Maipú': 1525
      },
      prev: { impressions: 1325000, clicks: 40800, cpc: 48.04 }
    }
  },

  /* ──────────────────────────────────────────
     MOFU — Interest
  ────────────────────────────────────────── */
  mofu: {
    '7d': {
      total_leads: 48, cpl: 3854.17, tipification_rate: 71.2, high_intent_leads: 18,
      trend: {
        labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
        leads:  [7, 8, 6, 7, 9, 5, 6],
        cpl:    [4200, 3850, 4167, 3857, 3333, 4400, 4500]
      },
      status: {
        labels: ['Cargado 100%', 'Contactado', 'En emisión', 'A futuro', 'No prospera', 'Erróneo', 'En blanco'],
        data:   [12, 9, 6, 7, 5, 4, 5],
        colors: [C.navy, C.slate, C.accent, C.silver, C.mist, C.light, '#E8EDF2']
      },
      segments: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [22, 15, 11],
        colors: [C.navy, C.slate, C.silver]
      },
      prev: { total_leads: 43, cpl: 3906.98, tipification_rate: 66.3, high_intent_leads: 15 }
    },
    '30d': {
      total_leads: 187, cpl: 3850.80, tipification_rate: 74.3, high_intent_leads: 68,
      trend: {
        labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        leads:  [42, 50, 46, 49],
        cpl:    [4167, 3700, 3739, 3837]
      },
      status: {
        labels: ['Cargado 100%', 'Contactado', 'En emisión', 'A futuro', 'No prospera', 'Erróneo', 'En blanco'],
        data:   [46, 38, 24, 28, 21, 14, 16],
        colors: [C.navy, C.slate, C.accent, C.silver, C.mist, C.light, '#E8EDF2']
      },
      segments: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [87, 58, 42],
        colors: [C.navy, C.slate, C.silver]
      },
      prev: { total_leads: 158, cpl: 4038.67, tipification_rate: 69.8, high_intent_leads: 58 }
    },
    '90d': {
      total_leads: 534, cpl: 3932.58, tipification_rate: 72.8, high_intent_leads: 195,
      trend: {
        labels: ['Enero', 'Febrero', 'Marzo'],
        leads:  [165, 175, 194],
        cpl:    [4121, 4057, 3660]
      },
      status: {
        labels: ['Cargado 100%', 'Contactado', 'En emisión', 'A futuro', 'No prospera', 'Erróneo', 'En blanco'],
        data:   [132, 108, 69, 82, 61, 40, 42],
        colors: [C.navy, C.slate, C.accent, C.silver, C.mist, C.light, '#E8EDF2']
      },
      segments: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [248, 167, 119],
        colors: [C.navy, C.slate, C.silver]
      },
      prev: { total_leads: 498, cpl: 3935.74, tipification_rate: 71.2, high_intent_leads: 182 }
    }
  },

  /* ──────────────────────────────────────────
     BOFU — Sales
  ────────────────────────────────────────── */
  bofu: {
    '7d': {
      total_revenue: 1240500, closed_sales: 12, avg_ticket: 103375,
      conversion_rate: 25.0, capitas_closed: 34, avg_ticket_per_capita: 36485,
      trend: {
        labels:  ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
        revenue: [172000, 185000, 168000, 192000, 210000, 145000, 168500],
        sales:   [2, 2, 1, 2, 2, 1, 2]
      },
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [5, 4, 3],
        colors: [C.navy, C.slate, C.silver]
      },
      prev: { total_revenue: 1105000, closed_sales: 10, avg_ticket: 110500, conversion_rate: 23.3, capitas_closed: 29, avg_ticket_per_capita: 38103 }
    },
    '30d': {
      total_revenue: 4850000, closed_sales: 43, avg_ticket: 112791,
      conversion_rate: 22.99, capitas_closed: 124, avg_ticket_per_capita: 39113,
      trend: {
        labels:  ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        revenue: [1150000, 1280000, 1165000, 1255000],
        sales:   [10, 12, 11, 10]
      },
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [20, 14, 9],
        colors: [C.navy, C.slate, C.silver]
      },
      prev: { total_revenue: 4190000, closed_sales: 36, avg_ticket: 116389, conversion_rate: 22.8, capitas_closed: 108, avg_ticket_per_capita: 38796 }
    },
    '90d': {
      total_revenue: 14200000, closed_sales: 121, avg_ticket: 117355,
      conversion_rate: 22.66, capitas_closed: 352, avg_ticket_per_capita: 40341,
      trend: {
        labels:  ['Enero', 'Febrero', 'Marzo'],
        revenue: [4550000, 4750000, 4900000],
        sales:   [38, 41, 42]
      },
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [56, 39, 26],
        colors: [C.navy, C.slate, C.silver]
      },
      prev: { total_revenue: 13280000, closed_sales: 113, avg_ticket: 117522, conversion_rate: 22.69, capitas_closed: 331, avg_ticket_per_capita: 40121 }
    }
  }

};

/* ──────────────────────────────────────────
   Generador de datos para rango personalizado
   Produce labels y valores a escala en base al nº de días
────────────────────────────────────────── */
function generateCustomMockData(endpoint, startStr, endStr) {
  const start = new Date(startStr);
  const end   = new Date(endStr);
  const days  = Math.max(1, Math.round((end - start) / 86400000) + 1);

  /* Elige granularidad de etiquetas */
  let labels = [];
  if (days <= 14) {
    /* diario */
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }
  } else if (days <= 90) {
    /* semanal */
    let week = 1;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      labels.push(`Sem ${week++}`);
    }
  } else {
    /* mensual */
    const seen = new Set();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.toLocaleString('es', { month: 'short' })} ${d.getFullYear()}`;
      if (!seen.has(key)) { seen.add(key); labels.push(key); }
    }
  }

  const n = labels.length;

  /* Genera valores aleatorios estables basados en promedios 30d */
  function synth(base, variance, count) {
    return Array.from({ length: count }, (_, i) =>
      Math.round(base * (1 + variance * Math.sin(i * 1.3 + 0.8)))
    );
  }

  if (endpoint === 'summary') {
    const baseSpend   = Math.round(720000 * days / 30);
    const baseRevenue = Math.round(4850000 * days / 30);
    const spend   = synth(baseSpend / n,   0.1, n);
    const revenue = synth(baseRevenue / n, 0.12, n);
    const base = MOCK_DATA.performance['30d'];
    return {
      ...base,
      revenue:     baseRevenue,
      ad_spend:    baseSpend,
      impressions: Math.round(485000 * days / 30),
      leads:       Math.round(187 * days / 30),
      closed_sales: Math.round(43 * days / 30),
      trend: { labels, spend, revenue }
    };
  }

  if (endpoint === 'tofu') {
    const base = MOCK_DATA.tofu['30d'];
    const baseImp    = Math.round(485000 * days / 30);
    const baseClicks = Math.round(14920 * days / 30);
    return {
      ...base,
      impressions: baseImp,
      clicks: baseClicks,
      trend: {
        labels,
        impressions: synth(baseImp / n,    0.1, n),
        clicks:      synth(baseClicks / n, 0.1, n)
      }
    };
  }

  if (endpoint === 'mofu') {
    const base      = MOCK_DATA.mofu['30d'];
    const baseLeads = Math.round(187 * days / 30);
    const leads     = synth(baseLeads / n, 0.15, n);
    const cpl       = leads.map((l, i) => l > 0 ? Math.round((720000 * days / 30 / n) / l) : 0);
    return { ...base, total_leads: baseLeads, trend: { labels, leads, cpl } };
  }

  if (endpoint === 'bofu') {
    const base       = MOCK_DATA.bofu['30d'];
    const baseRev    = Math.round(4850000 * days / 30);
    const baseSales  = Math.round(43 * days / 30);
    return {
      ...base,
      total_revenue: baseRev,
      closed_sales:  baseSales,
      trend: {
        labels,
        revenue: synth(baseRev / n,   0.12, n),
        sales:   synth(baseSales / n, 0.15, n).map(v => Math.max(0, Math.round(v)))
      }
    };
  }

  return MOCK_DATA.performance['30d'];
}
