<?php
/**
 * GET /api/endpoints/mofu.php?period=30d|7d|90d
 * Devuelve métricas MOFU desde la Sheet canónica.
 */

require_once __DIR__ . '/../lib/sheets.php';
require_once __DIR__ . '/../lib/config.php';

api_headers();

try {
    $token = get_token();
    $rows  = read_sheet(SHEET_ID, 'mofu_input!A1:M100', $token);
    $data  = rows_to_maps($rows);

    if (empty($data)) api_error('Sin datos en mofu_input', 404);

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
    $total_leads = 0; $sum_cpl = 0.0; $cpl_count = 0;
    $leads_contactado = 0; $leads_no_prospera = 0; $leads_a_futuro = 0;
    $leads_en_emision = 0; $leads_erroneo = 0; $leads_alta_intencion = 0;
    $seg_vol = 0; $seg_mono = 0; $seg_oblig = 0;

    foreach ($selected as $r) {
        $total_leads          += (int)   $r['total_leads'];
        $sum_cpl              += (float) $r['cost_per_lead'];
        $cpl_count++;
        $leads_contactado     += (int)   $r['leads_contactado'];
        $leads_no_prospera    += (int)   $r['leads_no_prospera'];
        $leads_a_futuro       += (int)   $r['leads_a_futuro'];
        $leads_en_emision     += (int)   $r['leads_en_emision'];
        $leads_erroneo        += (int)   $r['leads_erroneo'];
        $leads_alta_intencion += (int)   $r['leads_alta_intencion'];
        $seg_vol              += (int)   $r['segment_voluntario'];
        $seg_mono             += (int)   $r['segment_monotributista'];
        $seg_oblig            += (int)   $r['segment_obligatorio'];
    }

    $cpl = $cpl_count > 0 ? round($sum_cpl / $cpl_count, 2) : 0;
    $en_blanco = $total_leads - ($leads_contactado + $leads_no_prospera + $leads_a_futuro
                   + $leads_en_emision + $leads_erroneo + $leads_alta_intencion);
    $en_blanco = max(0, $en_blanco);
    $tipification_rate = $total_leads > 0
        ? round(($total_leads - $en_blanco) / $total_leads * 100, 1) : 0;

    // Trend
    $trend = build_trend($selected, $period, [
        'leads' => fn($r) => (int)$r['total_leads'],
        'cpl'   => fn($r) => (float)$r['cost_per_lead'],
    ]);

    // Prev
    $prev = null;
    if ($prev_d && isset($by_date[$prev_d])) {
        $pr = $by_date[$prev_d];
        $pr_total = (int)$pr['total_leads'];
        $pr_blank = max(0, $pr_total - ((int)$pr['leads_contactado'] + (int)$pr['leads_no_prospera']
                    + (int)$pr['leads_a_futuro'] + (int)$pr['leads_en_emision']
                    + (int)$pr['leads_erroneo'] + (int)$pr['leads_alta_intencion']));
        $prev = [
            'total_leads'       => $pr_total,
            'cpl'               => round((float)$pr['cost_per_lead'], 2),
            'tipification_rate' => $pr_total > 0 ? round(($pr_total - $pr_blank) / $pr_total * 100, 1) : 0,
            'high_intent_leads' => (int)$pr['leads_alta_intencion'],
        ];
    }

    $C = COLORS;
    echo json_encode([
        'total_leads'       => $total_leads,
        'cpl'               => $cpl,
        'tipification_rate' => $tipification_rate,
        'high_intent_leads' => $leads_alta_intencion,
        'trend' => $trend,
        'status' => [
            'labels' => ['Cargado 100%', 'Contactado', 'En emisión', 'A futuro', 'No prospera', 'Erróneo', 'En blanco'],
            'data'   => [$leads_alta_intencion, $leads_contactado, $leads_en_emision,
                         $leads_a_futuro, $leads_no_prospera, $leads_erroneo, $en_blanco],
            'colors' => [$C['navy'], $C['slate'], $C['accent'], $C['silver'], $C['mist'], $C['light'], '#E8EDF2'],
        ],
        'segments' => [
            'labels' => ['Voluntario', 'Monotributista', 'Obligatorio'],
            'data'   => [$seg_vol, $seg_mono, $seg_oblig],
            'colors' => [$C['navy'], $C['slate'], $C['silver']],
        ],
        'prev' => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
