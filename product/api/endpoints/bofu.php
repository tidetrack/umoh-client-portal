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

    // 2. Leads — para enriquecer con operatoria (segmento de venta)
    $leads = supabase_query('leads', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'meistertask_id,operatoria,lead_created_at',
        'limit'       => '5000',
    ]);
    $lead_by_id = [];
    foreach ($leads as $l) {
        $lead_by_id[$l['meistertask_id']] = $l;
    }

    // 3. Total leads del período (para conversion_rate)
    $leads_by_date = [];
    foreach ($leads as $l) {
        $created = $l['lead_created_at'] ?? null;
        if (!$created) continue;
        $d = substr($created, 0, 10);
        $leads_by_date[$d] = ($leads_by_date[$d] ?? 0) + 1;
    }

    // 4. Agrupar ventas cerradas por fecha (updated_at = momento de cierre)
    $by_date = [];
    foreach ($closed as $c) {
        $upd = $c['updated_at'] ?? null;
        if (!$upd) continue;
        $d = substr($upd, 0, 10);
        if (!isset($by_date[$d])) {
            $by_date[$d] = [
                'total_revenue' => 0.0,
                'closed_sales'  => 0,
                'capitas'       => 0,
                'sales_by_op'   => [],
            ];
        }
        $price = (float)($c['precio_final'] ?? 0);
        $by_date[$d]['total_revenue'] += $price;
        $by_date[$d]['closed_sales']++;
        $by_date[$d]['capitas']       += (int)($c['capitas'] ?? 0);

        $lead = $lead_by_id[$c['meistertask_id']] ?? null;
        $op = trim($lead['operatoria'] ?? '');
        if ($op === '') $op = 'Sin clasificar';
        $by_date[$d]['sales_by_op'][$op] = ($by_date[$d]['sales_by_op'][$op] ?? 0) + $price;
    }
    ksort($by_date);

    if (empty($by_date)) api_error('Sin ventas cerradas en Supabase para ' . CLIENT_SLUG, 404);

    // 5. Filtrar por período
    $period = $_GET['period'] ?? '30d';
    $dates  = array_keys($by_date);
    $last   = end($dates);
    $prev_d = count($dates) >= 2 ? $dates[count($dates) - 2] : null;

    [$start, $end] = period_dates($period, $last);
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

    // Conversion rate = closed_sales en período / leads_creados en período
    $period_leads = 0;
    foreach ($leads_by_date as $d => $n) {
        if ($d >= $start && $d <= $end) $period_leads += $n;
    }
    $conversion_rate = $period_leads > 0 ? round($closed_sales / $period_leads * 100, 2) : 0;

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
        $pr_leads = $leads_by_date[$prev_d] ?? 0;
        $prev = [
            'total_revenue'         => round($pr_rev, 2),
            'closed_sales'          => $pr_sales,
            'avg_ticket'            => $pr_sales > 0 ? round($pr_rev / $pr_sales, 2) : 0,
            'conversion_rate'       => $pr_leads > 0 ? round($pr_sales / $pr_leads * 100, 2) : 0,
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
        'prev' => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
