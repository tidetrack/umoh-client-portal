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
        revenue: [172000, 185000, 168000, 192000, 210000, 145000, 168500],
        sparkline: {
          labels:  ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom',
                    'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
          spend:   [24000, 26000, 23000, 25000, 27000, 20000, 25000,
                    26000, 28000, 25000, 27000, 30000, 22000, 27000],
          revenue: [158000, 168000, 152000, 175000, 195000, 132000, 155000,
                    172000, 185000, 168000, 192000, 210000, 145000, 168500]
        }
      },
      sellers_summary: {
        top_seller: 'Sofía Méndez', total_sales: 12, avg_effectiveness: 30.4,
        avg_cycle_days: 3.4, avg_ticket: 104750, avg_capitas_per_sale: 2.83,
        prev: { top_seller: 'Matías Torres', total_sales: 10, avg_effectiveness: 27.8, avg_cycle_days: 3.7, avg_ticket: 101000, avg_capitas_per_sale: 2.90 }
      },
      prev: { revenue: 1105000, ad_spend: 168000, impressions: 110800, leads: 43, closed_sales: 10 }
    },
    '30d': {
      revenue: 4850000, ad_spend: 720000, impressions: 485000, leads: 187, closed_sales: 43,
      trend: {
        labels:  ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        spend:   [175000, 185000, 172000, 188000],
        revenue: [1150000, 1280000, 1165000, 1255000],
        sparkline: {
          labels:  ['Sem -4', 'Sem -3', 'Sem -2', 'Sem -1',
                    'Sem 1',  'Sem 2',  'Sem 3',  'Sem 4'],
          spend:   [162000, 170000, 158000, 174000,
                    175000, 185000, 172000, 188000],
          revenue: [1062000, 1185000, 1075000, 1160000,
                    1150000, 1280000, 1165000, 1255000]
        }
      },
      sellers_summary: {
        top_seller: 'Sofía Méndez', total_sales: 43, avg_effectiveness: 29.8,
        avg_cycle_days: 3.3, avg_ticket: 105500, avg_capitas_per_sale: 2.88,
        prev: { top_seller: 'Sofía Méndez', total_sales: 36, avg_effectiveness: 27.2, avg_cycle_days: 3.7, avg_ticket: 103500, avg_capitas_per_sale: 3.00 }
      },
      prev: { revenue: 4190000, ad_spend: 638000, impressions: 415000, leads: 158, closed_sales: 36 }
    },
    '90d': {
      revenue: 14200000, ad_spend: 2100000, impressions: 1420000, leads: 534, closed_sales: 121,
      trend: {
        labels:  ['Enero', 'Febrero', 'Marzo'],
        spend:   [680000, 710000, 710000],
        revenue: [4550000, 4750000, 4900000],
        sparkline: {
          labels:  ['Oct', 'Nov', 'Dic',
                    'Ene', 'Feb', 'Mar'],
          spend:   [635000, 660000, 665000,
                    680000, 710000, 710000],
          revenue: [4200000, 4380000, 4520000,
                    4550000, 4750000, 4900000]
        }
      },
      sellers_summary: {
        top_seller: 'Sofía Méndez', total_sales: 121, avg_effectiveness: 28.9,
        avg_cycle_days: 3.5, avg_ticket: 106200, avg_capitas_per_sale: 2.91,
        prev: { top_seller: 'Sofía Méndez', total_sales: 103, avg_effectiveness: 26.8, avg_cycle_days: 3.8, avg_ticket: 103800, avg_capitas_per_sale: 2.93 }
      },
      prev: { revenue: 13280000, ad_spend: 1960000, impressions: 1325000, leads: 498, closed_sales: 113 }
    },
    'all_meses': {
      revenue: 58400000, ad_spend: 8640000, impressions: 5840000, leads: 2256, closed_sales: 517,
      trend: {
        labels:  ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'],
        spend:   [640000, 695000, 720000, 710000, 680000, 700000, 715000, 698000, 702000, 680000, 710000, 710000],
        revenue: [3900000, 4200000, 4500000, 4550000, 4300000, 4600000, 4700000, 4580000, 4650000, 4550000, 4750000, 4900000]
      },
      sellers_summary: {
        top_seller: 'Sofía Méndez', total_sales: 517, avg_effectiveness: 28.5,
        avg_cycle_days: 3.4, avg_ticket: 104800, avg_capitas_per_sale: 2.92,
        prev: { top_seller: 'Sofía Méndez', total_sales: 462, avg_effectiveness: 26.4, avg_cycle_days: 3.7, avg_ticket: 102400, avg_capitas_per_sale: 2.92 }
      },
      prev: { revenue: 52000000, ad_spend: 7800000, impressions: 5100000, leads: 2010, closed_sales: 462 }
    },
    'all_semanas': {
      revenue: 14200000, ad_spend: 2100000, impressions: 1420000, leads: 534, closed_sales: 121,
      trend: {
        labels:  ['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6','Sem 7','Sem 8','Sem 9','Sem 10','Sem 11','Sem 12','Sem 13'],
        spend:   [155000, 162000, 168000, 170000, 165000, 172000, 168000, 174000, 170000, 176000, 171000, 175000, 174000],
        revenue: [1050000, 1090000, 1120000, 1100000, 1080000, 1150000, 1110000, 1180000, 1140000, 1200000, 1160000, 1220000, 1190000]
      },
      sellers_summary: {
        top_seller: 'Sofía Méndez', total_sales: 121, avg_effectiveness: 28.9,
        avg_cycle_days: 3.5, avg_ticket: 106200, avg_capitas_per_sale: 2.91,
        prev: { top_seller: 'Sofía Méndez', total_sales: 103, avg_effectiveness: 26.8, avg_cycle_days: 3.8, avg_ticket: 103800, avg_capitas_per_sale: 2.93 }
      },
      prev: { revenue: 13280000, ad_spend: 1960000, impressions: 1325000, leads: 498, closed_sales: 113 }
    },
    'all_dias': {
      revenue: 4850000, ad_spend: 720000, impressions: 485000, leads: 187, closed_sales: 43,
      trend: {
        labels:  Array.from({ length: 30 }, (_, i) => `D${i + 1}`),
        spend:   [22000, 24000, 25000, 23000, 26000, 24000, 22000, 25000, 27000, 24000, 26000, 23000, 25000, 28000, 24000, 26000, 23000, 25000, 27000, 24000, 26000, 25000, 23000, 27000, 24000, 26000, 22000, 25000, 28000, 23000],
        revenue: [145000, 158000, 162000, 148000, 175000, 160000, 145000, 168000, 182000, 160000, 178000, 152000, 170000, 195000, 162000, 178000, 155000, 172000, 188000, 162000, 180000, 168000, 155000, 185000, 162000, 178000, 148000, 172000, 195000, 155000]
      },
      sellers_summary: {
        top_seller: 'Sofía Méndez', total_sales: 43, avg_effectiveness: 29.8,
        avg_cycle_days: 3.3, avg_ticket: 105500, avg_capitas_per_sale: 2.88,
        prev: { top_seller: 'Sofía Méndez', total_sales: 36, avg_effectiveness: 27.2, avg_cycle_days: 3.7, avg_ticket: 103500, avg_capitas_per_sale: 3.00 }
      },
      prev: { revenue: 4190000, ad_spend: 638000, impressions: 415000, leads: 158, closed_sales: 36 }
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
        clicks:      [550,   590,   534,   568,   630,   460,   508],
        cpc:         [49.4,  47.8,  48.6,  47.3,  46.8,  50.1,  48.2],
        sparkline: {
          labels:      ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom',
                        'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
          impressions: [15800, 17200, 15600, 16800, 18500, 13400, 15000,
                        17800, 19200, 17100, 18500, 20400, 14900, 16600],
          clicks:      [495, 530, 478, 510, 568, 414, 460,
                        550, 590, 534, 568, 630, 460, 508],
          cpc:         [50.8, 49.5, 50.2, 48.9, 48.1, 51.4, 49.7,
                        49.4, 47.8, 48.6, 47.3, 46.8, 50.1, 48.2]
        }
      },
      search_terms: [
        { term: 'prepaga mendoza',           clicks: 892, pct: 100, impressions: 4200, pct_imp: 100 },
        { term: 'seguro de salud mendoza',   clicks: 645, pct: 72,  impressions: 3800, pct_imp: 90  },
        { term: 'obra social privada',       clicks: 487, pct: 55,  impressions: 3100, pct_imp: 74  },
        { term: 'prevención salud mendoza',  clicks: 412, pct: 46,  impressions: 2600, pct_imp: 62  },
        { term: 'prepaga para familias',     clicks: 334, pct: 37,  impressions: 2200, pct_imp: 52  },
        { term: 'plan de salud empresarial', clicks: 289, pct: 32,  impressions: 1900, pct_imp: 45  },
        { term: 'cobertura médica mendoza',  clicks: 241, pct: 27,  impressions: 1500, pct_imp: 36  },
        { term: 'seguro medico barato',      clicks: 198, pct: 22,  impressions: 1200, pct_imp: 29  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [1920, 840, 620, 315, 145],
        colors: [C.navy, C.slate, C.silver, C.mist, C.light]
      },
      channels_imp: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [68400, 28500, 15200, 8100, 4300]
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [2304, 1344, 192],
        colors: [C.navy, C.slate, C.mist]
      },
      devices_imp: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [74700, 42200, 7600]
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
        clicks:      [3540,   3880,   3610,   3890],
        cpc:         [49.8,   48.4,   47.9,   48.2],
        sparkline: {
          labels:      ['Sem -4', 'Sem -3', 'Sem -2', 'Sem -1',
                        'Sem 1',  'Sem 2',  'Sem 3',  'Sem 4'],
          impressions: [103000, 114000, 106000, 112000,
                        115000, 128000, 118000, 124000],
          clicks:      [3170, 3510, 3245, 3490,
                        3540, 3880, 3610, 3890],
          cpc:         [51.2, 50.1, 49.6, 49.1,
                        49.8, 48.4, 47.9, 48.2]
        }
      },
      search_terms: [
        { term: 'prepaga mendoza',           clicks: 3480, pct: 100, impressions: 16400, pct_imp: 100 },
        { term: 'seguro de salud mendoza',   clicks: 2510, pct: 72,  impressions: 14800, pct_imp: 90  },
        { term: 'obra social privada',       clicks: 1890, pct: 54,  impressions: 12100, pct_imp: 74  },
        { term: 'prevención salud mendoza',  clicks: 1600, pct: 46,  impressions: 10200, pct_imp: 62  },
        { term: 'prepaga para familias',     clicks: 1298, pct: 37,  impressions:  8500, pct_imp: 52  },
        { term: 'plan de salud empresarial', clicks: 1120, pct: 32,  impressions:  7400, pct_imp: 45  },
        { term: 'cobertura médica mendoza',  clicks:  938, pct: 27,  impressions:  5900, pct_imp: 36  },
        { term: 'seguro medico barato',      clicks:  770, pct: 22,  impressions:  4700, pct_imp: 29  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [7460, 3280, 2415, 1228, 537],
        colors: [C.navy, C.slate, C.silver, C.mist, C.light]
      },
      channels_imp: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [266300, 111000, 59200, 31500, 16700]
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [8950, 5220, 750],
        colors: [C.navy, C.slate, C.mist]
      },
      devices_imp: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [291000, 164400, 29600]
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
        clicks:      [13800,  14600,  15200],
        cpc:         [49.3,   48.6,   47.8],
        sparkline: {
          labels:      ['Oct', 'Nov', 'Dic',
                        'Ene', 'Feb', 'Mar'],
          impressions: [420000, 438000, 452000,
                        455000, 475000, 490000],
          clicks:      [12740, 13380, 13920,
                        13800, 14600, 15200],
          cpc:         [50.6, 50.1, 49.8,
                        49.3, 48.6, 47.8]
        }
      },
      search_terms: [
        { term: 'prepaga mendoza',           clicks: 10140, pct: 100, impressions: 47900, pct_imp: 100 },
        { term: 'seguro de salud mendoza',   clicks:  7330, pct: 72,  impressions: 43100, pct_imp: 90  },
        { term: 'obra social privada',       clicks:  5520, pct: 54,  impressions: 35400, pct_imp: 74  },
        { term: 'prevención salud mendoza',  clicks:  4680, pct: 46,  impressions: 29700, pct_imp: 62  },
        { term: 'prepaga para familias',     clicks:  3790, pct: 37,  impressions: 24900, pct_imp: 52  },
        { term: 'plan de salud empresarial', clicks:  3270, pct: 32,  impressions: 21600, pct_imp: 45  },
        { term: 'cobertura médica mendoza',  clicks:  2740, pct: 27,  impressions: 17200, pct_imp: 36  },
        { term: 'seguro medico barato',      clicks:  2250, pct: 22,  impressions: 13900, pct_imp: 29  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [21800, 9580, 7060, 3590, 1570],
        colors: [C.navy, C.slate, C.silver, C.mist, C.light]
      },
      channels_imp: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [779600, 324700, 173100, 92100, 48700]
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [26160, 15260, 2180],
        colors: [C.navy, C.slate, C.mist]
      },
      devices_imp: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [852000, 482800, 85200]
      },
      geo: {
        'Capital': 1650, 'Godoy Cruz': 2250, 'Guaymallén': 1905,
        'Las Heras': 1275, 'Luján de Cuyo': 1010, 'Maipú': 1525
      },
      prev: { impressions: 1325000, clicks: 40800, cpc: 48.04 }
    },
    'all_meses': {
      impressions: 5840000, clicks: 179600, cpc: 48.10,
      trend: {
        labels:      ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'],
        impressions: [440000, 465000, 490000, 485000, 460000, 478000, 488000, 472000, 480000, 455000, 475000, 490000],
        clicks:      [13500, 14250, 15100, 14920, 14120, 14700, 14980, 14520, 14760, 13800, 14600, 15200],
        cpc:         [51.8, 51.2, 50.4, 49.8, 50.1, 49.6, 49.2, 49.9, 49.5, 49.3, 48.6, 47.8]
      },
      search_terms: [
        { term: 'prepaga mendoza',           clicks: 10140, pct: 100, impressions: 47900, pct_imp: 100 },
        { term: 'seguro de salud mendoza',   clicks:  7330, pct: 72,  impressions: 43100, pct_imp: 90  },
        { term: 'obra social privada',       clicks:  5520, pct: 54,  impressions: 35400, pct_imp: 74  },
        { term: 'prevención salud mendoza',  clicks:  4680, pct: 46,  impressions: 29700, pct_imp: 62  },
        { term: 'prepaga para familias',     clicks:  3790, pct: 37,  impressions: 24900, pct_imp: 52  },
        { term: 'plan de salud empresarial', clicks:  3270, pct: 32,  impressions: 21600, pct_imp: 45  },
        { term: 'cobertura médica mendoza',  clicks:  2740, pct: 27,  impressions: 17200, pct_imp: 36  },
        { term: 'seguro medico barato',      clicks:  2250, pct: 22,  impressions: 13900, pct_imp: 29  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [21800, 9580, 7060, 3590, 1570],
        colors: [C.navy, C.slate, C.silver, C.mist, C.light]
      },
      channels_imp: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [779600, 324700, 173100, 92100, 48700]
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [26160, 15260, 2180],
        colors: [C.navy, C.slate, C.mist]
      },
      devices_imp: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [852000, 482800, 85200]
      },
      geo: { 'Capital': 1650, 'Godoy Cruz': 2250, 'Guaymallén': 1905, 'Las Heras': 1275, 'Luján de Cuyo': 1010, 'Maipú': 1525 },
      prev: { impressions: 5100000, clicks: 156800, cpc: 49.20 }
    },
    'all_semanas': {
      impressions: 1420000, clicks: 43600, cpc: 48.17,
      trend: {
        labels:      ['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6','Sem 7','Sem 8','Sem 9','Sem 10','Sem 11','Sem 12','Sem 13'],
        impressions: [102000, 108000, 114000, 112000, 106000, 110000, 112000, 108000, 110000, 114000, 108000, 112000, 114000],
        clicks:      [3120,   3320,   3500,   3440,   3250,   3380,   3440,   3320,   3380,   3500,   3320,   3440,   3500],
        cpc:         [50.4, 50.1, 49.6, 49.8, 50.2, 49.5, 49.2, 49.8, 49.5, 49.0, 49.6, 49.2, 48.9]
      },
      search_terms: [
        { term: 'prepaga mendoza',           clicks: 10140, pct: 100, impressions: 47900, pct_imp: 100 },
        { term: 'seguro de salud mendoza',   clicks:  7330, pct: 72,  impressions: 43100, pct_imp: 90  },
        { term: 'obra social privada',       clicks:  5520, pct: 54,  impressions: 35400, pct_imp: 74  },
        { term: 'prevención salud mendoza',  clicks:  4680, pct: 46,  impressions: 29700, pct_imp: 62  },
        { term: 'prepaga para familias',     clicks:  3790, pct: 37,  impressions: 24900, pct_imp: 52  },
        { term: 'plan de salud empresarial', clicks:  3270, pct: 32,  impressions: 21600, pct_imp: 45  },
        { term: 'cobertura médica mendoza',  clicks:  2740, pct: 27,  impressions: 17200, pct_imp: 36  },
        { term: 'seguro medico barato',      clicks:  2250, pct: 22,  impressions: 13900, pct_imp: 29  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [21800, 9580, 7060, 3590, 1570],
        colors: [C.navy, C.slate, C.silver, C.mist, C.light]
      },
      channels_imp: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [779600, 324700, 173100, 92100, 48700]
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [26160, 15260, 2180],
        colors: [C.navy, C.slate, C.mist]
      },
      devices_imp: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [852000, 482800, 85200]
      },
      geo: { 'Capital': 1650, 'Godoy Cruz': 2250, 'Guaymallén': 1905, 'Las Heras': 1275, 'Luján de Cuyo': 1010, 'Maipú': 1525 },
      prev: { impressions: 1325000, clicks: 40800, cpc: 48.04 }
    },
    'all_dias': {
      impressions: 485000, clicks: 14920, cpc: 48.25,
      trend: {
        labels:      Array.from({ length: 30 }, (_, i) => `D${i + 1}`),
        impressions: [15200, 16800, 17400, 15900, 18800, 17200, 15500, 18100, 19600, 17200, 19200, 16300, 18300, 20900, 17400, 19100, 16600, 18500, 20200, 17400, 19300, 18100, 16700, 19900, 17400, 19200, 15900, 18500, 21000, 16700],
        clicks:      [470, 520, 540, 490, 580, 530, 478, 558, 606, 530, 592, 502, 564, 648, 536, 590, 512, 570, 624, 536, 596, 558, 514, 616, 536, 592, 490, 570, 648, 514],
        cpc:         [50.8, 50.2, 49.8, 50.5, 49.2, 49.6, 50.1, 49.4, 49.0, 49.6, 49.2, 50.0, 49.5, 48.8, 49.4, 49.1, 50.0, 49.6, 49.0, 49.5, 49.2, 49.7, 50.2, 49.4, 49.8, 49.2, 50.4, 49.6, 48.8, 49.6]
      },
      search_terms: [
        { term: 'prepaga mendoza',           clicks: 3480, pct: 100, impressions: 16400, pct_imp: 100 },
        { term: 'seguro de salud mendoza',   clicks: 2510, pct: 72,  impressions: 14800, pct_imp: 90  },
        { term: 'obra social privada',       clicks: 1890, pct: 54,  impressions: 12100, pct_imp: 74  },
        { term: 'prevención salud mendoza',  clicks: 1600, pct: 46,  impressions: 10200, pct_imp: 62  },
        { term: 'prepaga para familias',     clicks: 1298, pct: 37,  impressions:  8500, pct_imp: 52  },
        { term: 'plan de salud empresarial', clicks: 1120, pct: 32,  impressions:  7400, pct_imp: 45  },
        { term: 'cobertura médica mendoza',  clicks:  938, pct: 27,  impressions:  5900, pct_imp: 36  },
        { term: 'seguro medico barato',      clicks:  770, pct: 22,  impressions:  4700, pct_imp: 29  }
      ],
      channels: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [7460, 3280, 2415, 1228, 537],
        colors: [C.navy, C.slate, C.silver, C.mist, C.light]
      },
      channels_imp: {
        labels: ['Google Search', 'Display', 'YouTube', 'Discover', 'Gmail'],
        data:   [266300, 111000, 59200, 31500, 16700]
      },
      devices: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [8950, 5220, 750],
        colors: [C.navy, C.slate, C.mist]
      },
      devices_imp: {
        labels: ['Mobile', 'Desktop', 'Tablet'],
        data:   [291000, 164400, 29600]
      },
      geo: { 'Capital': 565, 'Godoy Cruz': 770, 'Guaymallén': 652, 'Las Heras': 437, 'Luján de Cuyo': 346, 'Maipú': 522 },
      prev: { impressions: 415000, clicks: 12780, cpc: 49.92 }
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
        cpl:    [4200, 3850, 4167, 3857, 3333, 4400, 4500],
        sparkline: {
          labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom',
                   'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
          leads:  [6, 7, 5, 6, 8, 4, 5,
                   7, 8, 6, 7, 9, 5, 6],
          cpl:    [4500, 4050, 4400, 4050, 3625, 4800, 4800,
                   4200, 3850, 4167, 3857, 3333, 4400, 4500]
        }
      },
      status: {
        labels: ['Contactado', 'Erróneo', 'No prospera', 'A futuro', 'Cotizado', 'En emisión', 'Cargado 100%'],
        data:   [9, 4, 5, 7, 5, 6, 12]
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
        cpl:    [4167, 3700, 3739, 3837],
        sparkline: {
          labels: ['Sem -4', 'Sem -3', 'Sem -2', 'Sem -1',
                   'Sem 1',  'Sem 2',  'Sem 3',  'Sem 4'],
          leads:  [37, 44, 40, 43,
                   42, 50, 46, 49],
          cpl:    [4500, 4090, 4225, 4150,
                   4167, 3700, 3739, 3837]
        }
      },
      status: {
        labels: ['Contactado', 'Erróneo', 'No prospera', 'A futuro', 'Cotizado', 'En emisión', 'Cargado 100%'],
        data:   [38, 14, 21, 28, 19, 24, 46]
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
        cpl:    [4121, 4057, 3660],
        sparkline: {
          labels: ['Oct', 'Nov', 'Dic',
                   'Ene', 'Feb', 'Mar'],
          leads:  [152, 158, 168,
                   165, 175, 194],
          cpl:    [4380, 4320, 4180,
                   4121, 4057, 3660]
        }
      },
      status: {
        labels: ['Contactado', 'Erróneo', 'No prospera', 'A futuro', 'Cotizado', 'En emisión', 'Cargado 100%'],
        data:   [108, 40, 61, 82, 56, 69, 132]
      },
      segments: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [248, 167, 119],
        colors: [C.navy, C.slate, C.silver]
      },
      prev: { total_leads: 498, cpl: 3935.74, tipification_rate: 71.2, high_intent_leads: 182 }
    },
    'all_meses': {
      total_leads: 2256, cpl: 3830.85, tipification_rate: 73.5, high_intent_leads: 832,
      trend: {
        labels: ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'],
        leads:  [168, 182, 196, 192, 178, 188, 195, 184, 188, 165, 175, 194],
        cpl:    [4050, 3980, 3850, 3900, 4020, 3870, 3840, 3980, 3940, 4121, 4057, 3660]
      },
      status: {
        labels: ['Contactado', 'Erróneo', 'No prospera', 'A futuro', 'Cotizado', 'En emisión', 'Cargado 100%'],
        data:   [108, 40, 61, 82, 56, 69, 132]
      },
      segments: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [248, 167, 119],
        colors: [C.navy, C.slate, C.silver]
      },
      prev: { total_leads: 2010, cpl: 3980.10, tipification_rate: 71.0, high_intent_leads: 740 }
    },
    'all_semanas': {
      total_leads: 534, cpl: 3932.58, tipification_rate: 72.8, high_intent_leads: 195,
      trend: {
        labels: ['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6','Sem 7','Sem 8','Sem 9','Sem 10','Sem 11','Sem 12','Sem 13'],
        leads:  [38, 42, 44, 42, 40, 43, 42, 44, 42, 46, 44, 48, 49],
        cpl:    [4280, 4080, 3980, 4060, 4150, 4020, 4060, 3940, 4060, 3820, 3940, 3720, 3660]
      },
      status: {
        labels: ['Contactado', 'Erróneo', 'No prospera', 'A futuro', 'Cotizado', 'En emisión', 'Cargado 100%'],
        data:   [108, 40, 61, 82, 56, 69, 132]
      },
      segments: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [248, 167, 119],
        colors: [C.navy, C.slate, C.silver]
      },
      prev: { total_leads: 498, cpl: 3935.74, tipification_rate: 71.2, high_intent_leads: 182 }
    },
    'all_dias': {
      total_leads: 187, cpl: 3850.80, tipification_rate: 74.3, high_intent_leads: 68,
      trend: {
        labels: Array.from({ length: 30 }, (_, i) => `D${i + 1}`),
        leads:  [5, 6, 7, 6, 8, 6, 5, 7, 8, 6, 7, 5, 7, 9, 6, 7, 5, 7, 8, 6, 7, 7, 5, 8, 6, 7, 5, 7, 8, 5],
        cpl:    [4400, 4000, 3714, 4000, 3250, 3833, 4400, 3571, 3250, 4000, 3714, 4400, 3571, 2778, 4000, 3714, 4400, 3571, 3250, 4000, 3714, 3571, 4400, 3250, 4000, 3714, 4400, 3571, 3250, 4400]
      },
      status: {
        labels: ['Contactado', 'Erróneo', 'No prospera', 'A futuro', 'Cotizado', 'En emisión', 'Cargado 100%'],
        data:   [38, 14, 21, 28, 19, 24, 46]
      },
      segments: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [87, 58, 42],
        colors: [C.navy, C.slate, C.silver]
      },
      prev: { total_leads: 158, cpl: 4038.67, tipification_rate: 69.8, high_intent_leads: 58 }
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
        sales:   [2, 2, 1, 2, 2, 1, 2],
        sparkline: {
          labels:  ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom',
                    'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
          revenue: [152000, 164000, 149000, 170000, 186000, 128000, 149000,
                    172000, 185000, 168000, 192000, 210000, 145000, 168500],
          sales:   [1, 2, 1, 2, 2, 1, 1,
                    2, 2, 1, 2, 2, 1, 2]
        }
      },
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [5, 4, 3],
        colors: [C.navy, C.slate, C.silver]
      },
      sellers: [
        { name: 'Sofía Méndez',  sales: 4, leads: 14, avg_ticket: 112000, capitas: 11, cycle_days: 2.8,
          prev: { sales: 3, leads: 13, avg_ticket: 108000, capitas: 9,  cycle_days: 3.2 } },
        { name: 'Matías Torres',  sales: 3, leads: 11, avg_ticket: 108000, capitas: 9,  cycle_days: 3.1,
          prev: { sales: 3, leads: 12, avg_ticket: 105000, capitas: 8,  cycle_days: 3.4 } },
        { name: 'Luciana Pérez',  sales: 3, leads: 13, avg_ticket: 95000,  capitas: 8,  cycle_days: 3.6,
          prev: { sales: 2, leads: 10, avg_ticket: 98000,  capitas: 7,  cycle_days: 3.9 } },
        { name: 'Andrés Gómez',   sales: 2, leads: 10, avg_ticket: 102000, capitas: 6,  cycle_days: 4.1,
          prev: { sales: 2, leads: 11, avg_ticket: 99000,  capitas: 5,  cycle_days: 4.3 } }
      ],
      prev: { total_revenue: 1105000, closed_sales: 10, avg_ticket: 110500, conversion_rate: 23.3, capitas_closed: 29, avg_ticket_per_capita: 38103 }
    },
    '30d': {
      total_revenue: 4850000, closed_sales: 43, avg_ticket: 112791,
      conversion_rate: 22.99, capitas_closed: 124, avg_ticket_per_capita: 39113,
      trend: {
        labels:  ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        revenue: [1150000, 1280000, 1165000, 1255000],
        sales:   [10, 12, 11, 10],
        sparkline: {
          labels:  ['Sem -4', 'Sem -3', 'Sem -2', 'Sem -1',
                    'Sem 1',  'Sem 2',  'Sem 3',  'Sem 4'],
          revenue: [1020000, 1135000, 1030000, 1110000,
                    1150000, 1280000, 1165000, 1255000],
          sales:   [9, 10, 9, 9,
                    10, 12, 11, 10]
        }
      },
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [20, 14, 9],
        colors: [C.navy, C.slate, C.silver]
      },
      sellers: [
        { name: 'Sofía Méndez',  sales: 14, leads: 52, avg_ticket: 114000, capitas: 42, cycle_days: 2.7,
          prev: { sales: 12, leads: 48, avg_ticket: 109000, capitas: 36, cycle_days: 3.1 } },
        { name: 'Matías Torres',  sales: 12, leads: 44, avg_ticket: 109000, capitas: 35, cycle_days: 3.0,
          prev: { sales: 11, leads: 46, avg_ticket: 106000, capitas: 31, cycle_days: 3.3 } },
        { name: 'Luciana Pérez',  sales: 10, leads: 50, avg_ticket:  96000, capitas: 29, cycle_days: 3.5,
          prev: { sales:  8, leads: 42, avg_ticket:  99000, capitas: 24, cycle_days: 3.8 } },
        { name: 'Andrés Gómez',   sales:  7, leads: 41, avg_ticket: 103000, capitas: 18, cycle_days: 4.0,
          prev: { sales:  5, leads: 22, avg_ticket: 100000, capitas: 17, cycle_days: 4.4 } }
      ],
      prev: { total_revenue: 4190000, closed_sales: 36, avg_ticket: 116389, conversion_rate: 22.8, capitas_closed: 108, avg_ticket_per_capita: 38796 }
    },
    '90d': {
      total_revenue: 14200000, closed_sales: 121, avg_ticket: 117355,
      conversion_rate: 22.66, capitas_closed: 352, avg_ticket_per_capita: 40341,
      trend: {
        labels:  ['Enero', 'Febrero', 'Marzo'],
        revenue: [4550000, 4750000, 4900000],
        sales:   [38, 41, 42],
        sparkline: {
          labels:  ['Oct', 'Nov', 'Dic',
                    'Ene', 'Feb', 'Mar'],
          revenue: [4200000, 4380000, 4520000,
                    4550000, 4750000, 4900000],
          sales:   [35, 37, 39,
                    38, 41, 42]
        }
      },
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [56, 39, 26],
        colors: [C.navy, C.slate, C.silver]
      },
      sellers: [
        { name: 'Sofía Méndez',  sales: 42, leads: 154, avg_ticket: 115000, capitas: 125, cycle_days: 2.7,
          prev: { sales: 38, leads: 145, avg_ticket: 110000, capitas: 111, cycle_days: 3.0 } },
        { name: 'Matías Torres',  sales: 36, leads: 132, avg_ticket: 110000, capitas: 105, cycle_days: 2.9,
          prev: { sales: 33, leads: 138, avg_ticket: 107000, capitas:  94, cycle_days: 3.2 } },
        { name: 'Luciana Pérez',  sales: 29, leads: 148, avg_ticket:  97000, capitas:  84, cycle_days: 3.4,
          prev: { sales: 25, leads: 128, avg_ticket: 100000, capitas:  73, cycle_days: 3.7 } },
        { name: 'Andrés Gómez',   sales: 14, leads: 122, avg_ticket: 104000, capitas:  38, cycle_days: 4.0,
          prev: { sales: 17, leads:  65, avg_ticket: 101000, capitas:  53, cycle_days: 4.3 } }
      ],
      prev: { total_revenue: 13280000, closed_sales: 113, avg_ticket: 117522, conversion_rate: 22.69, capitas_closed: 331, avg_ticket_per_capita: 40121 }
    },
    'all_meses': {
      total_revenue: 58400000, closed_sales: 517, avg_ticket: 112960,
      conversion_rate: 22.92, capitas_closed: 1512, avg_ticket_per_capita: 38624,
      trend: {
        labels:  ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'],
        revenue: [3900000, 4200000, 4500000, 4550000, 4300000, 4600000, 4700000, 4580000, 4650000, 4550000, 4750000, 4900000],
        sales:   [35, 37, 40, 40, 38, 41, 42, 40, 41, 38, 41, 42]
      },
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [56, 39, 26],
        colors: [C.navy, C.slate, C.silver]
      },
      sellers: [
        { name: 'Sofía Méndez',  sales: 176, leads: 616, avg_ticket: 116000, capitas: 529, cycle_days: 2.6,
          prev: { sales: 158, leads: 580, avg_ticket: 111000, capitas: 474, cycle_days: 2.9 } },
        { name: 'Matías Torres',  sales: 148, leads: 528, avg_ticket: 111000, capitas: 432, cycle_days: 2.8,
          prev: { sales: 136, leads: 555, avg_ticket: 108000, capitas: 396, cycle_days: 3.1 } },
        { name: 'Luciana Pérez',  sales: 120, leads: 594, avg_ticket:  98000, capitas: 351, cycle_days: 3.3,
          prev: { sales: 104, leads: 513, avg_ticket: 101000, capitas: 304, cycle_days: 3.6 } },
        { name: 'Andrés Gómez',   sales:  73, leads: 490, avg_ticket: 105000, capitas: 200, cycle_days: 3.9,
          prev: { sales:  64, leads: 264, avg_ticket: 102000, capitas: 174, cycle_days: 4.2 } }
      ],
      prev: { total_revenue: 52000000, closed_sales: 462, avg_ticket: 112554, conversion_rate: 22.99, capitas_closed: 1348, avg_ticket_per_capita: 38576 }
    },
    'all_semanas': {
      total_revenue: 14200000, closed_sales: 121, avg_ticket: 117355,
      conversion_rate: 22.66, capitas_closed: 352, avg_ticket_per_capita: 40341,
      trend: {
        labels:  ['Sem 1','Sem 2','Sem 3','Sem 4','Sem 5','Sem 6','Sem 7','Sem 8','Sem 9','Sem 10','Sem 11','Sem 12','Sem 13'],
        revenue: [1020000, 1080000, 1120000, 1100000, 1060000, 1140000, 1100000, 1160000, 1120000, 1200000, 1140000, 1220000, 1180000],
        sales:   [9, 9, 10, 10, 9, 10, 9, 10, 10, 11, 10, 11, 10]
      },
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [56, 39, 26],
        colors: [C.navy, C.slate, C.silver]
      },
      sellers: [
        { name: 'Sofía Méndez',  sales: 42, leads: 154, avg_ticket: 115000, capitas: 125, cycle_days: 2.7,
          prev: { sales: 38, leads: 145, avg_ticket: 110000, capitas: 111, cycle_days: 3.0 } },
        { name: 'Matías Torres',  sales: 36, leads: 132, avg_ticket: 110000, capitas: 105, cycle_days: 2.9,
          prev: { sales: 33, leads: 138, avg_ticket: 107000, capitas:  94, cycle_days: 3.2 } },
        { name: 'Luciana Pérez',  sales: 29, leads: 148, avg_ticket:  97000, capitas:  84, cycle_days: 3.4,
          prev: { sales: 25, leads: 128, avg_ticket: 100000, capitas:  73, cycle_days: 3.7 } },
        { name: 'Andrés Gómez',   sales: 14, leads: 122, avg_ticket: 104000, capitas:  38, cycle_days: 4.0,
          prev: { sales: 17, leads:  65, avg_ticket: 101000, capitas:  53, cycle_days: 4.3 } }
      ],
      prev: { total_revenue: 13280000, closed_sales: 113, avg_ticket: 117522, conversion_rate: 22.69, capitas_closed: 331, avg_ticket_per_capita: 40121 }
    },
    'all_dias': {
      total_revenue: 4850000, closed_sales: 43, avg_ticket: 112791,
      conversion_rate: 22.99, capitas_closed: 124, avg_ticket_per_capita: 39113,
      trend: {
        labels:  Array.from({ length: 30 }, (_, i) => `D${i + 1}`),
        revenue: [145000, 158000, 162000, 148000, 175000, 160000, 145000, 168000, 182000, 160000, 178000, 152000, 170000, 195000, 162000, 178000, 155000, 172000, 188000, 162000, 180000, 168000, 155000, 185000, 162000, 178000, 148000, 172000, 195000, 155000],
        sales:   [1, 1, 2, 1, 2, 1, 1, 2, 2, 1, 2, 1, 2, 2, 1, 2, 1, 2, 2, 1, 2, 2, 1, 2, 1, 2, 1, 2, 2, 1]
      },
      typification: {
        labels: ['Voluntario', 'Monotributista', 'Obligatorio'],
        data:   [20, 14, 9],
        colors: [C.navy, C.slate, C.silver]
      },
      sellers: [
        { name: 'Sofía Méndez',  sales: 14, leads: 52, avg_ticket: 114000, capitas: 42, cycle_days: 2.7,
          prev: { sales: 12, leads: 48, avg_ticket: 109000, capitas: 36, cycle_days: 3.1 } },
        { name: 'Matías Torres',  sales: 12, leads: 44, avg_ticket: 109000, capitas: 35, cycle_days: 3.0,
          prev: { sales: 11, leads: 46, avg_ticket: 106000, capitas: 31, cycle_days: 3.3 } },
        { name: 'Luciana Pérez',  sales: 10, leads: 50, avg_ticket:  96000, capitas: 29, cycle_days: 3.5,
          prev: { sales:  8, leads: 42, avg_ticket:  99000, capitas: 24, cycle_days: 3.8 } },
        { name: 'Andrés Gómez',   sales:  7, leads: 41, avg_ticket: 103000, capitas: 18, cycle_days: 4.0,
          prev: { sales:  5, leads: 22, avg_ticket: 100000, capitas: 17, cycle_days: 4.4 } }
      ],
      prev: { total_revenue: 4190000, closed_sales: 36, avg_ticket: 116389, conversion_rate: 22.8, capitas_closed: 108, avg_ticket_per_capita: 38796 }
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
    const cpl       = leads.map(l => l > 0 ? Math.round((720000 * days / 30 / n) / l) : 0);
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
