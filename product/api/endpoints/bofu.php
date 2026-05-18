<?php
/**
 * GET /api/endpoints/bofu.php?period=30d|7d|90d
 * Devuelve métricas BOFU desde Supabase (lead_monetary + leads).
 *
 * Cierre por fecha = lead_monetary.updated_at (cuando se marca is_closed).
 * Mantiene el mismo JSON shape que la versión anterior basada en Sheets.
 */

require_once __DIR__ . '/../lib/supabase.php';
require_once __DIR__ . '/../lib/config.php';

api_headers();

$_host = $_SERVER['HTTP_HOST'] ?? '';
$_is_local = ($_host === 'localhost' || $_host === '127.0.0.1'
    || str_starts_with($_host, 'localhost:') || str_starts_with($_host, '127.0.0.1:'));
if ($_is_local) {
    session_set_cookie_params(['lifetime' => 86400 * 30, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
} else {
    ini_set('session.cookie_domain', '.umohcrew.com');
    session_set_cookie_params(['lifetime' => 86400 * 30, 'path' => '/', 'domain' => '.umohcrew.com', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
}
session_start();
if (empty($_SESSION['umoh_user'])) api_error('No autenticado', 401);

const CLIENT_SLUG = 'prepagas';

try {
    // Filtro global de campaña (Fase 4 — sprint 1.8). Para Prepagas hoy con
    // una sola campaña activa, "all" y el ID real producen el mismo dataset
    // (todas las filas de leads/lead_monetary pertenecen a esa campaña). Cuando
    // haya multi-campaña, las queries directas a `leads` deberán cambiar a usar
    // las facts tables que ya están filtradas por campaign_id. Por ahora el
    // único bloque que sí filtra realmente es sellers (via seller_facts).
    $campaign_filter = $_GET['campaign_id'] ?? '';

    // Filtro de canal del lead (2026-05-16). Valores:
    //   campaign     → solo leads de campaña (is_campaign_lead = true). Default.
    //   non_campaign → solo leads particulares (Propio, Referido, vacíos).
    //   all          → ambos.
    // Default 'campaign' preserva la UX previa al feature (lo que veía el cliente).
    $canal_filter = $_GET['canal'] ?? 'campaign';
    if (!in_array($canal_filter, ['campaign', 'non_campaign', 'all'], true)) {
        $canal_filter = 'campaign';
    }
    // 1. Ventas cerradas: lead_monetary con is_closed=true
    //
    // ⚠️ Criterio único de "venta cerrada" en todo el módulo BOFU/Sales
    // (definido con Franco 2026-05-18):
    //
    //   1 venta = 1 meistertask_id único con is_closed=true.
    //
    // `lead_monetary` puede tener N filas por meistertask_id porque la
    // UNIQUE constraint es (client_slug, meistertask_id, plan_code, capitas)
    // y Postgres trata NULL != NULL: cada corrida del pipeline que ve
    // plan_code/capitas en NULL inserta una fila nueva sin colisionar. Eso
    // inflaba `closed_sales` (84 filas vs ~33 ventas reales) y degradaba
    // todos los ratios derivados (avg_ticket, cápitas/venta, conversion,
    // ROAS) que dependen de "cantidad de ventas" o "cápitas totales".
    //
    // Solución: deduplicar por meistertask_id eligiendo la fila MÁS COMPLETA
    // (precio_final > 0 gana sobre NULL/0), con desempate por updated_at más
    // reciente. La fila elegida representa "la venta" para todos los KPIs.
    $closed_raw = supabase_query('lead_monetary', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'is_closed'   => 'eq.true',
        'select'      => 'meistertask_id,capitas,precio_final,cuota_mensual,plan_code,data_source,updated_at',
        'limit'       => '5000',
    ]);
    $closed_by_mid = [];
    foreach ($closed_raw as $row) {
        $mid = $row['meistertask_id'] ?? null;
        if ($mid === null) continue;
        $cur = $closed_by_mid[$mid] ?? null;
        if (!$cur) { $closed_by_mid[$mid] = $row; continue; }
        $cur_p = (float)($cur['precio_final'] ?? 0);
        $new_p = (float)($row['precio_final'] ?? 0);
        // 1) Preferir fila con precio_final > 0
        if ($new_p > 0 && $cur_p <= 0) { $closed_by_mid[$mid] = $row; continue; }
        if ($new_p <= 0 && $cur_p > 0) continue;
        // 2) Desempate: updated_at más reciente
        if (strcmp((string)($row['updated_at'] ?? ''), (string)($cur['updated_at'] ?? '')) > 0) {
            $closed_by_mid[$mid] = $row;
        }
    }
    $closed = array_values($closed_by_mid);

    // 2. Leads — enriquecimiento para el modal de detalle del lead.
    //    Nota: `comments` no existe en la tabla `leads` de Supabase — los comentarios
    //    están en `lead_activity` (migración 007). El historial de actividad se lee
    //    desde ese endpoint, no desde leads.
    $leads = supabase_query('leads', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'meistertask_id,nombre,tipification,canal,is_campaign_lead,assignee,section,lead_created_at',
        'limit'       => '5000',
    ]);
    $lead_by_id = [];
    foreach ($leads as $l) {
        $lead_by_id[$l['meistertask_id']] = $l;
    }

    // 3. Impresiones del período desde tofu_ads_daily (para conversion_rate
    //    según definición: closed_sales / impressions). También recolectamos
    //    leads_by_date por si se necesita para otras métricas.
    $leads_by_date = [];
    foreach ($leads as $l) {
        $created = $l['lead_created_at'] ?? null;
        if (!$created) continue;
        $d = substr($created, 0, 10);
        $leads_by_date[$d] = ($leads_by_date[$d] ?? 0) + 1;
    }

    $tofu_rows = supabase_query('tofu_ads_daily', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'date,impressions,spend',
        'order'       => 'date.asc',
        'limit'       => '500',
    ]);
    $impr_by_date  = [];
    $spend_by_date = [];
    foreach ($tofu_rows as $r) {
        $d = $r['date'];
        $impr_by_date[$d]  = ($impr_by_date[$d]  ?? 0) + (int)$r['impressions'];
        $spend_by_date[$d] = ($spend_by_date[$d] ?? 0.0) + (float)$r['spend'];
    }

    // 4. Agrupar ventas cerradas por fecha de cierre (updated_at) en dos buckets
    //    independientes (campaign y non_campaign), para luego consolidar según
    //    $canal_filter. Los totales de non_campaign también se exponen aparte
    //    para descripción/microcopy.
    $by_date_campaign = [];
    $by_date_nc       = [];
    $nc_revenue = 0.0; $nc_sales = 0; $nc_capitas = 0;

    $add_to_bucket = function(array &$bucket, string $d, float $price, int $caps, string $tip) {
        if (!isset($bucket[$d])) {
            $bucket[$d] = [
                'total_revenue' => 0.0,
                'closed_sales'  => 0,
                'capitas'       => 0,
                'sales_by_op'   => [],
            ];
        }
        $bucket[$d]['total_revenue'] += $price;
        $bucket[$d]['closed_sales']++;
        $bucket[$d]['capitas']       += $caps;
        $bucket[$d]['sales_by_op'][$tip] = ($bucket[$d]['sales_by_op'][$tip] ?? 0) + $price;
    };

    foreach ($closed as $c) {
        $upd = $c['updated_at'] ?? null;
        if (!$upd) continue;
        $d = substr($upd, 0, 10);

        $price = (float)($c['precio_final'] ?? 0);
        $caps  = (int)($c['capitas'] ?? 0);
        $lead  = $lead_by_id[$c['meistertask_id']] ?? null;
        $is_campaign = !empty($lead['is_campaign_lead']);

        $tip = trim($lead['tipification'] ?? '');
        if ($tip === '') $tip = 'Sin clasificar';

        if ($is_campaign) {
            $add_to_bucket($by_date_campaign, $d, $price, $caps, $tip);
        } else {
            $add_to_bucket($by_date_nc, $d, $price, $caps, $tip);
            $nc_revenue += $price;
            $nc_sales++;
            $nc_capitas += $caps;
        }
    }

    // Consolidación según filtro de canal. 'all' fusiona ambos buckets sumando
    // por fecha (sales_by_op se fusiona por tipificación).
    if ($canal_filter === 'campaign') {
        $by_date = $by_date_campaign;
    } elseif ($canal_filter === 'non_campaign') {
        $by_date = $by_date_nc;
    } else {
        $by_date = $by_date_campaign;
        foreach ($by_date_nc as $d => $row) {
            if (!isset($by_date[$d])) {
                $by_date[$d] = $row;
                continue;
            }
            $by_date[$d]['total_revenue'] += $row['total_revenue'];
            $by_date[$d]['closed_sales']  += $row['closed_sales'];
            $by_date[$d]['capitas']       += $row['capitas'];
            foreach ($row['sales_by_op'] as $op => $rev) {
                $by_date[$d]['sales_by_op'][$op] = ($by_date[$d]['sales_by_op'][$op] ?? 0) + $rev;
            }
        }
    }
    ksort($by_date);

    // Solo abortamos si NO hay ventas en ningún bucket (caso onboarding). Si hay
    // ventas en el otro canal pero no en el filtro elegido, devolvemos KPIs en
    // cero para no romper el frontend al cambiar el dropdown.
    if (empty($by_date_campaign) && empty($by_date_nc)) {
        api_error('Sin ventas cerradas en Supabase para ' . CLIENT_SLUG, 404);
    }

    // 5. Filtrar por período. Calculamos los límites del período sobre el set
    //    completo de fechas (campaign + nc), no sólo el bucket filtrado: así
    //    el rango temporal es consistente entre filtros y no se "encoge" cuando
    //    el filtro elegido tiene menos datos.
    $period     = $_GET['period'] ?? '30d';
    $all_dates  = array_keys(array_merge($by_date_campaign, $by_date_nc));
    sort($all_dates);
    $last       = end($all_dates);

    [$start, $end] = period_dates($period, $last, $all_dates[0] ?? null);

    // Período previo: mismo length, terminando el día antes de $start
    $period_days = (strtotime($end) - strtotime($start)) / 86400 + 1;
    $prev_end    = date('Y-m-d', strtotime($start) - 86400);
    $prev_start  = date('Y-m-d', strtotime($prev_end) - ($period_days - 1) * 86400);

    $selected = filter_range($by_date, $start, $end);

    // 6. Agregar
    $total_revenue = 0.0; $closed_sales = 0; $capitas = 0;
    $sales_by_op = [];

    foreach ($selected as $r) {
        $total_revenue += $r['total_revenue'];
        $closed_sales  += $r['closed_sales'];
        $capitas       += $r['capitas'];
        foreach ($r['sales_by_op'] as $op => $rev) {
            $sales_by_op[$op] = ($sales_by_op[$op] ?? 0) + $rev;
        }
    }

    $avg_ticket       = $closed_sales > 0 ? round($total_revenue / $closed_sales, 2) : 0;
    // Cápitas por venta (decisión Franco 2026-05-15): cantidad de cápitas / cantidad de ventas.
    // NO es el ticket monetario por cápita — eso era el cálculo viejo y estaba mal nombrado.
    $capitas_per_sale = $closed_sales > 0 ? round($capitas / $closed_sales, 2) : 0;

    // Conversion rate definido como closed_sales / impressions en el período.
    // Es el ratio de cuánta gente que vio el ad terminó comprando.
    $period_impr  = 0;
    $period_spend = 0.0;
    foreach ($impr_by_date as $d => $n) {
        if ($d >= $start && $d <= $end) $period_impr += $n;
    }
    foreach ($spend_by_date as $d => $s) {
        if ($d >= $start && $d <= $end) $period_spend += $s;
    }
    $conversion_rate = $period_impr > 0 ? round($closed_sales / $period_impr * 100, 4) : 0;

    // ROAS: Return On Ad Spend. Ingresos del período (según filtro de canal)
    // divididos por inversión total en ads del período. Sin redondeo agresivo
    // (2 decimales) porque la card en frontend lo formatea como Nx.
    $roas = $period_spend > 0 ? round($total_revenue / $period_spend, 2) : 0;

    // 7. Trend: revenue y sales por día
    $trend = build_trend($selected, $period, [
        'revenue' => fn($r) => (float)$r['total_revenue'],
        'sales'   => fn($r) => (int)$r['closed_sales'],
    ]);

    // 8. Prev — suma del período previo (mismo length que el actual), para deltas correctos.
    $prev_selected = filter_range($by_date, $prev_start, $prev_end);
    $pr_rev = 0.0; $pr_sales = 0; $pr_cap = 0; $pr_impr = 0; $pr_spend = 0.0;
    foreach ($prev_selected as $r) {
        $pr_rev   += $r['total_revenue'];
        $pr_sales += $r['closed_sales'];
        $pr_cap   += $r['capitas'];
    }
    foreach ($impr_by_date as $d => $n) {
        if ($d >= $prev_start && $d <= $prev_end) $pr_impr += $n;
    }
    foreach ($spend_by_date as $d => $s) {
        if ($d >= $prev_start && $d <= $prev_end) $pr_spend += $s;
    }
    $prev = [
        'total_revenue'    => round($pr_rev, 2),
        'closed_sales'     => $pr_sales,
        'avg_ticket'       => $pr_sales > 0 ? round($pr_rev / $pr_sales, 2) : 0,
        'conversion_rate'  => $pr_impr > 0 ? round($pr_sales / $pr_impr * 100, 4) : 0,
        'capitas_closed'   => $pr_cap,
        'capitas_per_sale' => $pr_sales > 0 ? round($pr_cap / $pr_sales, 2) : 0,
        'total_spend'      => round($pr_spend, 2),
        'roas'             => $pr_spend > 0 ? round($pr_rev / $pr_spend, 2) : 0,
    ];

    // 9. Tipification breakdown — top 5 operatorias por revenue
    $C = COLORS;
    arsort($sales_by_op);
    $type_labels = []; $type_data = [];
    foreach (array_slice($sales_by_op, 0, 5, true) as $op => $rev) {
        if ($rev <= 0) continue;
        $type_labels[] = $op;
        $type_data[]   = round($rev, 2);
    }
    $type_colors = [$C['navy'], $C['slate'], $C['silver'], $C['mist'], $C['light']];

    // 10. Ranking de vendedores — lee de la tabla seller_facts (migración 012)
    //     en lugar de calcular en runtime. Esto unifica la fuente de verdad
    //     con la Sheet espejo, incluye capitas y cycle_days reales (antes en 0)
    //     y elimina la duplicación de lógica de filtrado por campaign_lead.
    //
    //     Período actual: $start..$end (calculado arriba via period_dates).
    //     Período previo: reutiliza $prev_start / $prev_end calculados en el bloque 5.

    // Helper interno: lee seller_facts en un rango y agrega por seller_name.
    // avg_cycle_days se calcula como weighted avg por sales_count (matemática-
    // mente correcto cuando se promedian días de ciclo de varios cierres).
    $aggregate_sellers = function(string $rs, string $re) use ($campaign_filter) {
        $q = [
            'client_slug' => 'eq.' . CLIENT_SLUG,
            'date'        => 'gte.' . $rs,
            'select'      => 'seller_name,leads_assigned,sales_count,revenue,capitas_closed,avg_cycle_days,date',
            'limit'       => '5000',
        ];
        if ($campaign_filter !== '' && $campaign_filter !== 'all') {
            $q['campaign_id'] = 'eq.' . $campaign_filter;
        }
        $rows = supabase_query('seller_facts', $q);
        // Filtrar manualmente la cota superior (PostgREST no permite 2x date= en una sola query).
        $rows = array_filter($rows, fn($r) => ($r['date'] ?? '') <= $re);

        $agg = [];
        foreach ($rows as $r) {
            $name = $r['seller_name'] ?? '';
            if ($name === '') continue;
            if (!isset($agg[$name])) {
                $agg[$name] = [
                    'leads' => 0, 'sales' => 0, 'revenue' => 0.0,
                    'capitas' => 0, 'cycle_weighted' => 0.0,
                ];
            }
            $sales = (int)($r['sales_count'] ?? 0);
            $agg[$name]['leads']          += (int)($r['leads_assigned'] ?? 0);
            $agg[$name]['sales']          += $sales;
            $agg[$name]['revenue']        += (float)($r['revenue'] ?? 0);
            $agg[$name]['capitas']        += (int)($r['capitas_closed'] ?? 0);
            $agg[$name]['cycle_weighted'] += (float)($r['avg_cycle_days'] ?? 0) * $sales;
        }
        return $agg;
    };

    $curr_sellers = $aggregate_sellers($start, $end);
    $prev_sellers = $aggregate_sellers($prev_start, $prev_end);

    $build_seller_row = function(string $name, array $s) {
        $cycle = $s['sales'] > 0 ? round($s['cycle_weighted'] / $s['sales'], 1) : 0.0;
        return [
            'name'           => $name,
            'leads'          => $s['leads'],
            'sales'          => $s['sales'],
            'revenue'        => round($s['revenue'], 2),
            'effectiveness'  => $s['leads'] > 0 ? round($s['sales'] / $s['leads'] * 100, 1) : 0,
            'avg_ticket'     => $s['sales'] > 0 ? round($s['revenue'] / $s['sales'], 2) : 0,
            'capitas'        => $s['capitas'],
            'cycle_days'     => $cycle,        // nombre que usa la tabla en charts.js
            'avg_cycle_days' => $cycle,        // alias de compatibilidad para la card MVP
        ];
    };

    $sellers = [];
    foreach ($curr_sellers as $name => $s) {
        $row = $build_seller_row($name, $s);
        if (isset($prev_sellers[$name])) {
            $row['prev'] = $build_seller_row($name, $prev_sellers[$name]);
        }
        $sellers[] = $row;
    }
    usort($sellers, fn($a, $b) => $b['sales'] <=> $a['sales'] ?: $b['revenue'] <=> $a['revenue']);

    // 11. Ventas pendientes de cargar monto: leads en sección is_closed_won
    //     PERO sin lead_monetary o con precio_final = 0/null. Estos son los
    //     leads que el vendedor marcó como ganados pero no cargó el precio aún.
    $closed_won_sections = [];
    foreach ($stages_resp = supabase_query('funnel_stages', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'is_closed_won' => 'eq.true',
        'select'      => 'section_name',
    ]) as $s) {
        $closed_won_sections[$s['section_name']] = true;
    }

    $monetary_by_id = [];
    foreach ($closed as $c) {
        $price = (float)($c['precio_final'] ?? 0);
        $monetary_by_id[$c['meistertask_id']] = $price;
    }

    $pending_price = [];
    foreach ($leads as $l) {
        $sec = $l['section'] ?? '';
        if (!isset($closed_won_sections[$sec])) continue;
        $price = $monetary_by_id[$l['meistertask_id']] ?? null;
        if ($price !== null && $price > 0) continue;
        $pending_price[] = [
            'meistertask_id'  => $l['meistertask_id'],
            'nombre'          => $l['nombre'] ?? '',
            'assignee'        => $l['assignee'] ?? '',
            'tipification'    => $l['tipification'] ?? '',
            'canal'           => $l['canal'] ?? '',
            'section'         => $l['section'] ?? '',
            'lead_created_at' => $l['lead_created_at'] ?? '',
            'is_campaign'     => !empty($l['is_campaign_lead']),
        ];
    }
    // Ordenar: más recientes primero
    usort($pending_price, fn($a, $b) => strcmp($b['lead_created_at'] ?? '', $a['lead_created_at'] ?? ''));

    // 12. Lista de ventas ganadas para la tabla "Ventas Ganadas como tareas" (Frente 5).
    //     Une lead_monetary (datos de precio/cápitas) con leads (nombre, asesor, tipificación).
    //     Incluye badge de "completitud" para que Franco vea qué falta cargar.
    //     La lista es completa (sin filtro de período) porque sirve para auditoría histórica.
    $monetary_full = [];
    foreach ($closed as $c) {
        $monetary_full[$c['meistertask_id']] = $c;
    }

    $sales_list = [];
    foreach ($leads as $l) {
        $sec = $l['section'] ?? '';
        if (!isset($closed_won_sections[$sec])) continue;  // Solo sección "Ventas Ganadas"

        $mid = $l['meistertask_id'];
        $mon = $monetary_full[$mid] ?? null;

        $precio   = $mon ? (float)($mon['precio_final'] ?? 0) : 0.0;
        $capitas_v = $mon ? ((int)($mon['capitas'] ?? 0)) : 0;
        $plan     = $mon ? ($mon['plan_code'] ?? null) : null;

        // Badge de completitud: campos faltantes en la venta
        $missing = [];
        if ($precio <= 0)    $missing[] = 'Sin precio';
        if ($capitas_v <= 0) $missing[] = 'Sin cápitas';
        if (!$plan)          $missing[] = 'Sin plan';

        $sales_list[] = [
            'meistertask_id'  => $mid,
            'nombre'          => $l['nombre'] ?? '',
            'assignee'        => $l['assignee'] ?? '',
            'tipification'    => $l['tipification'] ?? '',
            'canal'           => $l['canal'] ?? '',
            'lead_created_at' => $l['lead_created_at'] ?? null,
            'close_date'      => $mon ? ($mon['updated_at'] ?? null) : null,
            'precio_final'    => $precio,
            'capitas'         => $capitas_v,
            'plan_code'       => $plan,
            'is_campaign'     => !empty($l['is_campaign_lead']),
            'missing'         => $missing,        // array de strings para el badge
            'complete'        => empty($missing),  // true si precio+capitas+plan están presentes
        ];
    }

    // Ordenar: más recientes primero (por fecha de cierre, luego por creación)
    usort($sales_list, function($a, $b) {
        $ca = $a['close_date'] ?? $a['lead_created_at'] ?? '';
        $cb = $b['close_date'] ?? $b['lead_created_at'] ?? '';
        return strcmp($cb, $ca);
    });

    echo json_encode([
        'canal'            => $canal_filter,
        'total_revenue'    => round($total_revenue, 2),
        'closed_sales'     => $closed_sales,
        'avg_ticket'       => $avg_ticket,
        'conversion_rate'  => $conversion_rate,
        'capitas_closed'   => $capitas,
        'capitas_per_sale' => $capitas_per_sale,
        'total_spend'      => round($period_spend, 2),
        'roas'             => $roas,
        'trend' => $trend,
        'typification' => [
            'labels' => $type_labels,
            'data'   => $type_data,
            'colors' => array_slice($type_colors, 0, count($type_labels)),
        ],
        'sellers'       => $sellers,
        'pending_price' => $pending_price,
        'sales_list'    => $sales_list,
        'non_campaign' => [
            'closed_sales'   => $nc_sales,
            'total_revenue'  => round($nc_revenue, 2),
            'capitas_closed' => $nc_capitas,
            'avg_ticket'     => $nc_sales > 0 ? round($nc_revenue / $nc_sales, 2) : 0,
            'description'    => 'Ventas cerradas con leads cargados manualmente por el vendedor (no atribuidas a campaña).',
        ],
        'prev' => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
