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
    // 1. Ventas cerradas: lead_monetary con is_closed=true
    $closed = supabase_query('lead_monetary', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'is_closed'   => 'eq.true',
        'select'      => 'meistertask_id,capitas,precio_final,updated_at',
        'limit'       => '5000',
    ]);

    // 2. Leads — para enriquecer con tipification + saber si la venta es de campaña.
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
        'select'      => 'date,impressions',
        'order'       => 'date.asc',
        'limit'       => '500',
    ]);
    $impr_by_date = [];
    foreach ($tofu_rows as $r) {
        $d = $r['date'];
        $impr_by_date[$d] = ($impr_by_date[$d] ?? 0) + (int)$r['impressions'];
    }

    // 4. Agrupar ventas cerradas por fecha de cierre (updated_at).
    //    Las métricas principales reflejan solo ventas de leads de campaña.
    //    Las ventas de leads del vendedor se reportan en bloque non_campaign.
    $by_date = [];
    $nc_revenue = 0.0; $nc_sales = 0; $nc_capitas = 0;
    foreach ($closed as $c) {
        $upd = $c['updated_at'] ?? null;
        if (!$upd) continue;
        $d = substr($upd, 0, 10);

        $price = (float)($c['precio_final'] ?? 0);
        $caps  = (int)($c['capitas'] ?? 0);
        $lead  = $lead_by_id[$c['meistertask_id']] ?? null;
        $is_campaign = !empty($lead['is_campaign_lead']);

        if (!$is_campaign) {
            $nc_revenue += $price;
            $nc_sales++;
            $nc_capitas += $caps;
            continue;
        }

        if (!isset($by_date[$d])) {
            $by_date[$d] = [
                'total_revenue' => 0.0,
                'closed_sales'  => 0,
                'capitas'       => 0,
                'sales_by_op'   => [],
            ];
        }
        $by_date[$d]['total_revenue'] += $price;
        $by_date[$d]['closed_sales']++;
        $by_date[$d]['capitas']       += $caps;

        $tip = trim($lead['tipification'] ?? '');
        if ($tip === '') $tip = 'Sin clasificar';
        $by_date[$d]['sales_by_op'][$tip] = ($by_date[$d]['sales_by_op'][$tip] ?? 0) + $price;
    }
    ksort($by_date);

    if (empty($by_date)) api_error('Sin ventas cerradas en Supabase para ' . CLIENT_SLUG, 404);

    // 5. Filtrar por período
    $period = $_GET['period'] ?? '30d';
    $dates  = array_keys($by_date);
    $last   = end($dates);
    $prev_d = count($dates) >= 2 ? $dates[count($dates) - 2] : null;

    [$start, $end] = period_dates($period, $last, $dates[0] ?? null);
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

    $avg_ticket     = $closed_sales > 0 ? round($total_revenue / $closed_sales, 2) : 0;
    $avg_ticket_cap = $capitas > 0      ? round($total_revenue / $capitas, 2)      : 0;

    // Conversion rate definido como closed_sales / impressions en el período.
    // Es el ratio de cuánta gente que vio el ad terminó comprando.
    $period_impr = 0;
    foreach ($impr_by_date as $d => $n) {
        if ($d >= $start && $d <= $end) $period_impr += $n;
    }
    $conversion_rate = $period_impr > 0 ? round($closed_sales / $period_impr * 100, 4) : 0;

    // 7. Trend: revenue y sales por día
    $trend = build_trend($selected, $period, [
        'revenue' => fn($r) => (float)$r['total_revenue'],
        'sales'   => fn($r) => (int)$r['closed_sales'],
    ]);

    // 8. Prev day
    $prev = null;
    if ($prev_d && isset($by_date[$prev_d])) {
        $pr = $by_date[$prev_d];
        $pr_rev = $pr['total_revenue']; $pr_sales = $pr['closed_sales'];
        $pr_cap = $pr['capitas'];
        $pr_impr = $impr_by_date[$prev_d] ?? 0;
        $prev = [
            'total_revenue'         => round($pr_rev, 2),
            'closed_sales'          => $pr_sales,
            'avg_ticket'            => $pr_sales > 0 ? round($pr_rev / $pr_sales, 2) : 0,
            'conversion_rate'       => $pr_impr > 0 ? round($pr_sales / $pr_impr * 100, 4) : 0,
            'capitas_closed'        => $pr_cap,
            'avg_ticket_per_capita' => $pr_cap > 0 ? round($pr_rev / $pr_cap, 2) : 0,
        ];
    }

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

    // 10. Ranking de vendedores (mismas métricas que summary.php — ver allí
    //     para definiciones). Replicado acá para que la sección BOFU sea
    //     autosuficiente en una sola request.
    $sales_by_lead = [];
    foreach ($closed as $c) {
        $sales_by_lead[$c['meistertask_id']] = [
            'price' => (float)($c['precio_final'] ?? 0),
            'date'  => substr($c['updated_at'] ?? '', 0, 10),
        ];
    }
    $sellers_agg = [];
    foreach ($leads as $l) {
        if (empty($l['is_campaign_lead'])) continue;
        $name = trim($l['assignee'] ?? '');
        if ($name === '' || strtolower($name) === 'umoh crew') continue;
        $created = substr($l['lead_created_at'] ?? '', 0, 10);
        if ($created === '' || $created < $start || $created > $end) continue;
        if (!isset($sellers_agg[$name])) {
            $sellers_agg[$name] = ['leads' => 0, 'sales' => 0, 'revenue' => 0.0, 'capitas' => 0, 'cycle_sum' => 0, 'cycle_count' => 0];
        }
        $sellers_agg[$name]['leads']++;
        $sale = $sales_by_lead[$l['meistertask_id']] ?? null;
        if ($sale && $sale['date'] >= $start && $sale['date'] <= $end) {
            $sellers_agg[$name]['sales']++;
            $sellers_agg[$name]['revenue'] += $sale['price'];
        }
    }
    $sellers = [];
    foreach ($sellers_agg as $name => $s) {
        $sellers[] = [
            'name'           => $name,
            'leads'          => $s['leads'],
            'sales'          => $s['sales'],
            'revenue'        => round($s['revenue'], 2),
            'effectiveness'  => $s['leads'] > 0 ? round($s['sales'] / $s['leads'] * 100, 1) : 0,
            'avg_ticket'     => $s['sales'] > 0 ? round($s['revenue'] / $s['sales'], 2) : 0,
            'capitas'        => 0,  // pendiente: capitas vienen NULL del extractor
            'avg_cycle_days' => 0,  // pendiente
        ];
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
            'lead_created_at' => $l['lead_created_at'] ?? '',
            'is_campaign'     => !empty($l['is_campaign_lead']),
        ];
    }
    // Ordenar: más recientes primero
    usort($pending_price, fn($a, $b) => strcmp($b['lead_created_at'] ?? '', $a['lead_created_at'] ?? ''));

    echo json_encode([
        'total_revenue'         => round($total_revenue, 2),
        'closed_sales'          => $closed_sales,
        'avg_ticket'            => $avg_ticket,
        'conversion_rate'       => $conversion_rate,
        'capitas_closed'        => $capitas,
        'avg_ticket_per_capita' => $avg_ticket_cap,
        'trend' => $trend,
        'typification' => [
            'labels' => $type_labels,
            'data'   => $type_data,
            'colors' => array_slice($type_colors, 0, count($type_labels)),
        ],
        'sellers'       => $sellers,
        'pending_price' => $pending_price,
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
