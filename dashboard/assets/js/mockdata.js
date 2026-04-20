/**
 * mockdata.js — Datos de ejemplo para todas las secciones del dashboard.
 * Cliente: Prevención Salud (prepagas.umohcrew.com)
 * Reemplazar por llamadas a la API PHP en Fase 2.
 */

const MOCK_DATA = {

  /* ──────────────────────────────────────────
     PERFORMANCE — resumen general
  ────────────────────────────────────────── */
  performance: {
    '7d': {
      revenue:      1240500,
      ad_spend:      185000,
      impressions:   124500,
      leads:             48,
      closed_sales:      12,
      trend: {
        labels:  ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
        spend:   [26000, 28000, 25000, 27000, 30000, 22000, 27000],
        revenue: [172000, 185000, 168000, 192000, 210000, 145000, 168500]
      }
    },
    '30d': {
      revenue:      4850000,
      ad_spend:      720000,
      impressions:   485000,
      leads:            187,
      closed_sales:      43,
      trend: {
        labels:  ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        spend:   [175000, 185000, 172000, 188000],
        revenue: [1150000, 1280000, 1165000, 1255000]
      }
    },
    '90d': {
      revenue:     14200000,
      ad_spend:     2100000,
      impressions:  1420000,
      leads:            534,
      closed_sales:     121,
      trend: {
        labels:  ['Enero', 'Febrero', 'Marzo'],
        spend:   [680000, 710000, 710000],
        revenue: [4550000, 4750000, 4900000]
      }
    }
  },

  /* ──────────────────────────────────────────
     TOFU — Awareness
  ────────────────────────────────────────── */
  tofu: {
    '7d': {
      impressions: 124500,
      clicks:        3840,
      cpc:           48.15,
      search_terms: [
        { term: 'prepaga mendoza',            clicks: 892, pct: 100 },
        { term: 'seguro de salud mendoza',    clicks: 645, pct: 72  },
        { term: 'obra social privada',        clicks: 487, pct: 55  },
        { term: 'prevención salud mendoza',   clicks: 412, pct: 46  },
        { term: 'prepaga para familias',      clicks: 334, pct: 37  },
        { term: 'plan de salud empresarial',  clicks: 289, pct: 32  },
        { term: 'cobertura médica mendoza',   clicks: 241, pct: 27  },
        { term: 'seguro medico barato',       clicks: 198, pct: 22  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [1920, 840, 620, 315, 145],
        colors: ['#FF0040', '#FF4068', '#FF80A0', '#5A7080', '#8FA5A8']
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [2304, 1344, 192],
        colors: ['#FF0040', '#253040', '#8FA5A8']
      },
      geo: {
        'Capital':       145,
        'Godoy Cruz':    198,
        'Guaymallén':    167,
        'Las Heras':     112,
        'Luján de Cuyo':  89,
        'Maipú':         134
      }
    },
    '30d': {
      impressions: 485000,
      clicks:       14920,
      cpc:           48.25,
      search_terms: [
        { term: 'prepaga mendoza',            clicks: 3480, pct: 100 },
        { term: 'seguro de salud mendoza',    clicks: 2510, pct: 72  },
        { term: 'obra social privada',        clicks: 1890, pct: 54  },
        { term: 'prevención salud mendoza',   clicks: 1600, pct: 46  },
        { term: 'prepaga para familias',      clicks: 1298, pct: 37  },
        { term: 'plan de salud empresarial',  clicks: 1120, pct: 32  },
        { term: 'cobertura médica mendoza',   clicks:  938, pct: 27  },
        { term: 'seguro medico barato',       clicks:  770, pct: 22  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [7460, 3280, 2415, 1228, 537],
        colors: ['#FF0040', '#FF4068', '#FF80A0', '#5A7080', '#8FA5A8']
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [8950, 5220, 750],
        colors: ['#FF0040', '#253040', '#8FA5A8']
      },
      geo: {
        'Capital':       565,
        'Godoy Cruz':    770,
        'Guaymallén':    652,
        'Las Heras':     437,
        'Luján de Cuyo': 346,
        'Maipú':         522
      }
    },
    '90d': {
      impressions: 1420000,
      clicks:        43600,
      cpc:           48.17,
      search_terms: [
        { term: 'prepaga mendoza',            clicks: 10140, pct: 100 },
        { term: 'seguro de salud mendoza',    clicks:  7330, pct: 72  },
        { term: 'obra social privada',        clicks:  5520, pct: 54  },
        { term: 'prevención salud mendoza',   clicks:  4680, pct: 46  },
        { term: 'prepaga para familias',      clicks:  3790, pct: 37  },
        { term: 'plan de salud empresarial',  clicks:  3270, pct: 32  },
        { term: 'cobertura médica mendoza',   clicks:  2740, pct: 27  },
        { term: 'seguro medico barato',       clicks:  2250, pct: 22  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [21800, 9580, 7060, 3590, 1570],
        colors: ['#FF0040', '#FF4068', '#FF80A0', '#5A7080', '#8FA5A8']
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [26160, 15260, 2180],
        colors: ['#FF0040', '#253040', '#8FA5A8']
      },
      geo: {
        'Capital':       1650,
        'Godoy Cruz':    2250,
        'Guaymallén':    1905,
        'Las Heras':     1275,
        'Luján de Cuyo': 1010,
        'Maipú':         1525
      }
    }
  },

  /* ──────────────────────────────────────────
     MOFU — Interest
     Fuente: MeisterTask (datos manuales por ahora)
  ────────────────────────────────────────── */
  mofu: {
    '7d': {
      total_leads:        48,
      cpl:             3854.17,
      tipification_rate:  71.2,
      high_intent_leads:  18,
      status: {
        labels: ['Cargado 100%', 'Contactado', 'En emisión', 'A futuro', 'No prospera', 'Erróneo', 'En blanco'],
        data:   [12, 9, 6, 7, 5, 4, 5],
        colors: ['#FF0040', '#FF4068', '#FF80A0', '#5A7080', '#8FA5A8', '#C8D8DC', '#253040']
      },
      segments: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [22, 15, 11],
        colors: ['#FF0040', '#FF4068', '#8FA5A8']
      }
    },
    '30d': {
      total_leads:       187,
      cpl:            3850.80,
      tipification_rate:  74.3,
      high_intent_leads:   68,
      status: {
        labels: ['Cargado 100%', 'Contactado', 'En emisión', 'A futuro', 'No prospera', 'Erróneo', 'En blanco'],
        data:   [46, 38, 24, 28, 21, 14, 16],
        colors: ['#FF0040', '#FF4068', '#FF80A0', '#5A7080', '#8FA5A8', '#C8D8DC', '#253040']
      },
      segments: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [87, 58, 42],
        colors: ['#FF0040', '#FF4068', '#8FA5A8']
      }
    },
    '90d': {
      total_leads:       534,
      cpl:            3932.58,
      tipification_rate:  72.8,
      high_intent_leads:  195,
      status: {
        labels: ['Cargado 100%', 'Contactado', 'En emisión', 'A futuro', 'No prospera', 'Erróneo', 'En blanco'],
        data:   [132, 108, 69, 82, 61, 40, 42],
        colors: ['#FF0040', '#FF4068', '#FF80A0', '#5A7080', '#8FA5A8', '#C8D8DC', '#253040']
      },
      segments: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [248, 167, 119],
        colors: ['#FF0040', '#FF4068', '#8FA5A8']
      }
    }
  },

  /* ──────────────────────────────────────────
     BOFU — Sales
  ────────────────────────────────────────── */
  bofu: {
    '7d': {
      total_revenue:         1240500,
      closed_sales:               12,
      avg_ticket:             103375,
      conversion_rate:          25.0,
      capitas_closed:             34,
      avg_ticket_per_capita:   36485,
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [5, 4, 3],
        colors: ['#FF0040', '#FF4068', '#8FA5A8']
      }
    },
    '30d': {
      total_revenue:         4850000,
      closed_sales:               43,
      avg_ticket:             112791,
      conversion_rate:          22.99,
      capitas_closed:            124,
      avg_ticket_per_capita:   39113,
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [20, 14, 9],
        colors: ['#FF0040', '#FF4068', '#8FA5A8']
      }
    },
    '90d': {
      total_revenue:        14200000,
      closed_sales:              121,
      avg_ticket:             117355,
      conversion_rate:          22.66,
      capitas_closed:            352,
      avg_ticket_per_capita:   40341,
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [56, 39, 26],
        colors: ['#FF0040', '#FF4068', '#8FA5A8']
      }
    }
  }

};
