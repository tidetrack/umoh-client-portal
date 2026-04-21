<?php
/**
 * GET /api/endpoints/summary.php?period=30d|7d|90d
 * Agrega TOFU + MOFU + BOFU para la vista Performance general.
 */

require_once __DIR__ . '/../lib/sheets.php';
require_once __DIR__ . '/../lib/config.php';

api_headers();

try {
    $token  = get_token();
    $period = $_GET['period'] ?? '30d';

    // Leer las 3 sheets de una vez
    $tofu_rows = rows_to_maps(read_sheet(SHEET_ID, 'tofu_raw!A1:I100',   $token));
    $mofu_rows = rows_to_maps(read_sheet(SHEET_ID, 'mofu_input!A1:M100', $token));
    $bofu_rows = rows_to_maps(read_sheet(SHEET_ID, 'bofu_input!A1:J100', $token));

    // Indexar por fecha
    function by_date_idx(array $rows): array {
        $m = [];
        foreach ($rows as $r) { if (!empty($r['date'])) $m[$r['date']] = $r; }
        ksort($m);
        return $m;
    }

    $tofu = by_date_idx($tofu_rows);
    $mofu = by_date_idx($mofu_rows);
    $bofu = by_date_idx($bofu_rows);

    $dates = array_unique(array_merge(array_keys($tofu), array_keys($mofu), array_keys($bofu)));
    sort($dates);
    $last   = end($dates);
    $prev_d = count($dates) >= 2 ? $dates[count($dates) - 2] : null;

    // Filtrar por período real
    [$start, $end] = period_dates($period, $last);
    $sel_tofu = filter_range($tofu, $start, $end);
    $sel_mofu = filter_range($mofu, $start, $end);
    $sel_bofu = filter_range($bofu, $start, $end);

    // Agregar métricas del período seleccionado
    $impressions = 0; $spend = 0.0; $leads = 0; $revenue = 0.0; $sales = 0;

    foreach ($sel_tofu as $r) { $impressions += (int)$r['impressions']; $spend += (float)$r['spend']; }
    foreach ($sel_mofu as $r) { $leads += (int)$r['total_leads']; }
    foreach ($sel_bofu as $r) { $revenue += (float)$r['total_revenue']; $sales += (int)$r['closed_sales']; }

    // Trend usando los datos filtrados
    $all_dates = array_unique(array_merge(array_keys($sel_tofu), array_keys($sel_mofu), array_keys($sel_bofu)));
    sort($all_dates);
    $merged = [];
    foreach ($all_dates as $d) {
        $merged[$d] = [
            'spend'   => isset($sel_tofu[$d]) ? (float)$sel_tofu[$d]['spend'] : 0,
            'revenue' => isset($sel_bofu[$d]) ? (float)$sel_bofu[$d]['total_revenue'] : 0,
        ];
    }

    $trend = build_trend($merged, $period, [
        'spend'   => fn($r) => $r['spend'],
        'revenue' => fn($r) => $r['revenue'],
    ]);

    // Prev (último punto antes del rango seleccionado)
    $prev = null;
    if ($prev_d) {
        $pr_impr = isset($tofu[$prev_d]) ? (int)$tofu[$prev_d]['impressions'] : 0;
        $pr_sp   = isset($tofu[$prev_d]) ? (float)$tofu[$prev_d]['spend']     : 0;
        $pr_lead = isset($mofu[$prev_d]) ? (int)$mofu[$prev_d]['total_leads'] : 0;
        $pr_rev  = isset($bofu[$prev_d]) ? (float)$bofu[$prev_d]['total_revenue'] : 0;
        $pr_sal  = isset($bofu[$prev_d]) ? (int)$bofu[$prev_d]['closed_sales']    : 0;
        $prev    = ['revenue' => $pr_rev, 'ad_spend' => $pr_sp,
                    'impressions' => $pr_impr, 'leads' => $pr_lead, 'closed_sales' => $pr_sal];
    }

    echo json_encode([
        'revenue'      => round($revenue, 2),
        'ad_spend'     => round($spend, 2),
        'impressions'  => $impressions,
        'leads'        => $leads,
        'closed_sales' => $sales,
        'trend'        => $trend,
        'prev'         => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
