<?php
/**
 * GET /api/endpoints/tofu.php?period=30d|7d|90d
 * Devuelve métricas TOFU desde la Sheet canónica.
 */

require_once __DIR__ . '/../lib/sheets.php';
require_once __DIR__ . '/../lib/config.php';

api_headers();

try {
    $token = get_token();
    $rows  = read_sheet(SHEET_ID, 'tofu_raw!A1:I100', $token);
    $data  = rows_to_maps($rows);

    if (empty($data)) api_error('Sin datos en tofu_raw', 404);

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
    $impressions = 0; $clicks = 0; $spend = 0.0;
    $all_terms = []; $channels_agg = []; $devices_agg = [];

    foreach ($selected as $r) {
        $impressions += (int)   $r['impressions'];
        $clicks      += (int)   $r['clicks'];
        $spend       += (float) $r['spend'];

        foreach (json_decode($r['top_search_terms'] ?? '[]', true) ?: [] as $t) {
            $k = $t['term'];
            $all_terms[$k] = ($all_terms[$k] ?? 0) + (int)($t['clicks'] ?? 0);
        }
        foreach (json_decode($r['channel_breakdown'] ?? '{}', true) ?: [] as $ch => $v) {
            $channels_agg[$ch] = ($channels_agg[$ch] ?? 0) + (int)($v['clicks'] ?? 0);
        }
        foreach (json_decode($r['device_breakdown'] ?? '{}', true) ?: [] as $dev => $v) {
            $devices_agg[$dev] = ($devices_agg[$dev] ?? 0) + (int)($v['clicks'] ?? 0);
        }
    }

    $cpc = $clicks > 0 ? round($spend / $clicks, 2) : 0;

    arsort($all_terms);
    $max = max(array_values($all_terms) ?: [1]);
    $search_terms = [];
    foreach (array_slice($all_terms, 0, 10, true) as $term => $cl) {
        $search_terms[] = ['term' => $term, 'clicks' => $cl, 'pct' => round($cl / $max * 100)];
    }

    arsort($channels_agg);
    $ch_colors = [COLORS['navy'], COLORS['slate'], COLORS['silver'], COLORS['mist'], COLORS['light']];
    $channels = ['labels' => array_keys($channels_agg), 'data' => array_values($channels_agg),
                 'colors' => array_slice($ch_colors, 0, count($channels_agg))];

    arsort($devices_agg);
    $dev_colors = [COLORS['navy'], COLORS['slate'], COLORS['mist'], COLORS['light']];
    $devices = ['labels' => array_keys($devices_agg), 'data' => array_values($devices_agg),
                'colors' => array_slice($dev_colors, 0, count($devices_agg))];

    // Trend
    $trend = build_trend($selected, $period, [
        'impressions' => fn($r) => (int)$r['impressions'],
        'clicks'      => fn($r) => (int)$r['clicks'],
    ]);

    // Prev
    $prev = null;
    if ($prev_d && isset($by_date[$prev_d])) {
        $pr = $by_date[$prev_d];
        $pr_cl = (int)$pr['clicks']; $pr_sp = (float)$pr['spend'];
        $prev = ['impressions' => (int)$pr['impressions'], 'clicks' => $pr_cl,
                 'cpc' => $pr_cl > 0 ? round($pr_sp / $pr_cl, 2) : 0];
    }

    // Geo — hardcoded hasta Fase 3 (integración con schema de geo)
    $geo_90 = ['Mendoza' => 1030, 'Guaymallén' => 315, 'Godoy Cruz' => 189,
               'Las Heras' => 162, 'Luján de Cuyo' => 156, 'Maipú' => 118];
    $geo_30 = ['Mendoza' => 495, 'Guaymallén' => 107, 'Godoy Cruz' => 55,
               'Las Heras' => 43, 'Luján de Cuyo' => 42, 'Maipú' => 36];
    $geo = ($period === '90d') ? $geo_90 : $geo_30;

    echo json_encode([
        'impressions'  => $impressions,
        'clicks'       => $clicks,
        'cpc'          => $cpc,
        'trend'        => $trend,
        'search_terms' => $search_terms,
        'channels'     => $channels,
        'devices'      => $devices,
        'geo'          => $geo,
        'prev'         => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
