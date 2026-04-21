<?php
/**
 * GET /api/endpoints/bofu.php?period=30d|7d|90d
 * Devuelve métricas BOFU desde la Sheet canónica.
 */

require_once __DIR__ . '/../lib/sheets.php';
require_once __DIR__ . '/../lib/config.php';

api_headers();

try {
    $token = get_token();
    $rows  = read_sheet(SHEET_ID, 'bofu_input!A1:J100', $token);
    $data  = rows_to_maps($rows);

    if (empty($data)) api_error('Sin datos en bofu_input', 404);

    $by_date = [];
    foreach ($data as $row) {
        if (empty($row['date'])) continue;
        $by_date[$row['date']] = $row;
    }
    ksort($by_date);

    $period = $_GET['period'] ?? '30d';
    $dates  = array_keys($by_date);
    $last   = end($dates);
    $prev_d = count($dates) >= 2 ? $dates[count($dates) - 2] : null;

    // Filtrar por período real
    [$start, $end] = period_dates($period, $last);
    $selected = filter_range($by_date, $start, $end);

    // Agregar
    $total_revenue = 0.0; $closed_sales = 0; $capitas = 0;
    $sales_vol = 0.0; $sales_mono = 0.0; $sales_oblig = 0.0;

    foreach ($selected as $r) {
        $total_revenue += (float)$r['total_revenue'];
        $closed_sales  += (int)  $r['closed_sales'];
        $capitas       += (int)  $r['capitas_closed'];
        $sales_vol     += (float)$r['sales_voluntario'];
        $sales_mono    += (float)$r['sales_monotributista'];
        $sales_oblig   += (float)$r['sales_obligatorio'];
    }

    $avg_ticket     = $closed_sales > 0 ? round($total_revenue / $closed_sales, 2) : 0;
    $avg_ticket_cap = $capitas > 0 ? round($total_revenue / $capitas, 2) : 0;

    // conversion_rate = closed_sales / total_leads (necesita mofu)
    $mofu_rows   = read_sheet(SHEET_ID, 'mofu_input!A1:M100', $token);
    $mofu_data   = rows_to_maps($mofu_rows);
    $total_leads = 0;
    foreach ($mofu_data as $mr) {
        if (empty($mr['date'])) continue;
        if ($mr['date'] < $start || $mr['date'] > $end) continue;
        $total_leads += (int)$mr['total_leads'];
    }
    $conversion_rate = $total_leads > 0 ? round($closed_sales / $total_leads * 100, 2) : 0;

    // Trend
    $trend = build_trend($selected, $period, [
        'revenue' => fn($r) => (float)$r['total_revenue'],
        'sales'   => fn($r) => (int)$r['closed_sales'],
    ]);

    // Prev
    $prev = null;
    if ($prev_d && isset($by_date[$prev_d])) {
        $pr = $by_date[$prev_d];
        $pr_rev = (float)$pr['total_revenue']; $pr_sales = (int)$pr['closed_sales'];
        $pr_cap = (int)$pr['capitas_closed'];
        $pr_leads = 0;
        foreach ($mofu_data as $mr) {
            if (!empty($mr['date']) && $mr['date'] === $prev_d) $pr_leads += (int)$mr['total_leads'];
        }
        $prev = [
            'total_revenue'         => $pr_rev,
            'closed_sales'          => $pr_sales,
            'avg_ticket'            => $pr_sales > 0 ? round($pr_rev / $pr_sales, 2) : 0,
            'conversion_rate'       => $pr_leads > 0 ? round($pr_sales / $pr_leads * 100, 2) : 0,
            'capitas_closed'        => $pr_cap,
            'avg_ticket_per_capita' => $pr_cap > 0 ? round($pr_rev / $pr_cap, 2) : 0,
        ];
    }

    $C = COLORS;
    $type_labels = []; $type_data = [];
    if ($sales_vol > 0)   { $type_labels[] = 'Voluntario';     $type_data[] = round($sales_vol, 2); }
    if ($sales_mono > 0)  { $type_labels[] = 'Monotributista'; $type_data[] = round($sales_mono, 2); }
    if ($sales_oblig > 0) { $type_labels[] = 'Obligatorio';    $type_data[] = round($sales_oblig, 2); }

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
            'colors' => [$C['navy'], $C['slate'], $C['silver']],
        ],
        'prev' => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
