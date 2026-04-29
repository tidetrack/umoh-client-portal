<?php
/**
 * GET /api/endpoints/mofu.php?period=30d|7d|90d
 * Devuelve métricas MOFU desde Supabase (tablas leads + funnel_stages + tofu_ads_daily).
 *
 * Mantiene el mismo JSON shape que la versión anterior basada en Sheets.
 */

require_once __DIR__ . '/../lib/supabase.php';
require_once __DIR__ . '/../lib/config.php';

api_headers();

// Auth gate (igual que tofu.php)
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
    // 1. Funnel stages config: section_name → flags (high_intent, lost, incubating, etc.)
    $stages = supabase_query('funnel_stages', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'section_name,funnel_stage,is_high_intent,is_closed_won,is_typified,is_lost,is_incubating',
    ]);
    $stage_by_section = [];
    foreach ($stages as $s) {
        $stage_by_section[$s['section_name']] = $s;
    }

    // 2. Leads del cliente (todos — el filtrado por período se hace en PHP).
    //    Limit alto porque pueden ser cientos; si crece a miles habría que paginar.
    $leads = supabase_query('leads', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'meistertask_id,section,operatoria,lead_created_at',
        'limit'       => '5000',
    ]);

    // 3. tofu_ads_daily para sacar spend y calcular CPL
    $spend_rows = supabase_query('tofu_ads_daily', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'date,spend',
        'order'       => 'date.asc',
        'limit'       => '500',
    ]);
    $spend_by_date = [];
    foreach ($spend_rows as $r) {
        $d = $r['date'];
        $spend_by_date[$d] = ($spend_by_date[$d] ?? 0) + (float)$r['spend'];
    }

    // 4. Agrupar leads por fecha (lead_created_at::date)
    $by_date = [];
    foreach ($leads as $l) {
        $created = $l['lead_created_at'] ?? null;
        if (!$created) continue;
        $d = substr($created, 0, 10);  // YYYY-MM-DD
        if (!isset($by_date[$d])) {
            $by_date[$d] = [
                'total_leads' => 0,
                'leads' => [],  // refs a los lead objects para clasificación posterior
            ];
        }
        $by_date[$d]['total_leads']++;
        $by_date[$d]['leads'][] = $l;
    }
    ksort($by_date);

    // 5. Calcular período + filtro de fechas
    $period = $_GET['period'] ?? '30d';
    $dates  = array_keys($by_date);
    if (empty($dates)) api_error('Sin leads en Supabase para ' . CLIENT_SLUG, 404);
    $last   = end($dates);
    $prev_d = count($dates) >= 2 ? $dates[count($dates) - 2] : null;

    [$start, $end] = period_dates($period, $last);
    $selected = filter_range($by_date, $start, $end);

    // 6. Helper para clasificar un lead en sus buckets
    $classify = function($lead) use ($stage_by_section) {
        $sec = $lead['section'] ?? '';
        $cfg = $stage_by_section[$sec] ?? null;
        return [
            'high_intent' => $cfg && $cfg['is_high_intent'],
            'lost'        => $cfg && $cfg['is_lost'],
            'incubating'  => $cfg && $cfg['is_incubating'],
            'closed_won'  => $cfg && $cfg['is_closed_won'],
            'typified'    => $cfg && $cfg['is_typified'],
            'excluded'    => $cfg && $cfg['funnel_stage'] === 'excluded',
            'contactado'  => $sec === 'Contactados',
            'en_emision'  => $sec === 'En Auditoria',
        ];
    };

    // 7. Agregar buckets del período
    $total_leads = 0;
    $leads_alta_intencion = 0; $leads_contactado = 0; $leads_a_futuro = 0;
    $leads_en_emision = 0; $leads_erroneo = 0; $leads_no_prospera = 0;
    $segs = [];   // {operatoria_label: count}

    foreach ($selected as $d => $bucket) {
        $total_leads += $bucket['total_leads'];
        foreach ($bucket['leads'] as $l) {
            $c = $classify($l);
            if ($c['high_intent']) $leads_alta_intencion++;
            if ($c['contactado'])  $leads_contactado++;
            if ($c['incubating'])  $leads_a_futuro++;
            if ($c['en_emision'])  $leads_en_emision++;
            if ($c['excluded'])    $leads_erroneo++;
            if ($c['lost'])        $leads_no_prospera++;

            $op = trim($l['operatoria'] ?? '');
            if ($op === '') $op = 'Sin clasificar';
            $segs[$op] = ($segs[$op] ?? 0) + 1;
        }
    }

    // CPL = sum(spend en periodo) / total_leads
    $period_spend = 0.0;
    foreach ($selected as $d => $_) $period_spend += $spend_by_date[$d] ?? 0;
    $cpl = $total_leads > 0 ? round($period_spend / $total_leads, 2) : 0;

    // En blanco: leads que no encajan en ninguna categoría tipificada
    $en_blanco = max(0, $total_leads - ($leads_contactado + $leads_no_prospera + $leads_a_futuro
                   + $leads_en_emision + $leads_erroneo + $leads_alta_intencion));
    $tipification_rate = $total_leads > 0
        ? round(($total_leads - $en_blanco) / $total_leads * 100, 1) : 0;

    // 8. Trend: leads y CPL por día
    $trend_data = [];
    foreach ($selected as $d => $bucket) {
        $cpl_d = $bucket['total_leads'] > 0 ? ($spend_by_date[$d] ?? 0) / $bucket['total_leads'] : 0;
        $trend_data[$d] = ['leads' => $bucket['total_leads'], 'cpl' => $cpl_d];
    }
    $trend = build_trend($trend_data, $period, [
        'leads' => fn($r) => (int)$r['leads'],
        'cpl'   => fn($r) => (float)$r['cpl'],
    ]);

    // 9. Prev day
    $prev = null;
    if ($prev_d && isset($by_date[$prev_d])) {
        $pr = $by_date[$prev_d];
        $pr_total = $pr['total_leads'];
        $pr_high = 0; $pr_typified = 0;
        foreach ($pr['leads'] as $l) {
            $c = $classify($l);
            if ($c['high_intent']) $pr_high++;
            if ($c['typified'])    $pr_typified++;
        }
        $prev_spend = $spend_by_date[$prev_d] ?? 0;
        $prev = [
            'total_leads'       => $pr_total,
            'cpl'               => $pr_total > 0 ? round($prev_spend / $pr_total, 2) : 0,
            'tipification_rate' => $pr_total > 0 ? round($pr_typified / $pr_total * 100, 1) : 0,
            'high_intent_leads' => $pr_high,
        ];
    }

    // 10. Status breakdown — etiquetas que el frontend espera
    $C = COLORS;
    $status_labels = ['Cargado 100%', 'Contactado', 'En emisión', 'A futuro', 'No prospera', 'Erróneo', 'En blanco'];
    $status_data   = [$leads_alta_intencion, $leads_contactado, $leads_en_emision,
                      $leads_a_futuro, $leads_no_prospera, $leads_erroneo, $en_blanco];

    // Segmentos: top 5 operatorias por count
    arsort($segs);
    $seg_labels = []; $seg_data = [];
    foreach (array_slice($segs, 0, 5, true) as $label => $count) {
        $seg_labels[] = $label;
        $seg_data[] = $count;
    }
    $seg_colors = [$C['navy'], $C['slate'], $C['silver'], $C['mist'], $C['light']];

    echo json_encode([
        'total_leads'       => $total_leads,
        'cpl'               => $cpl,
        'tipification_rate' => $tipification_rate,
        'high_intent_leads' => $leads_alta_intencion,
        'trend' => $trend,
        'status' => [
            'labels' => $status_labels,
            'data'   => $status_data,
            'colors' => [$C['navy'], $C['slate'], $C['accent'], $C['silver'], $C['mist'], $C['light'], '#E8EDF2'],
        ],
        'segments' => [
            'labels' => $seg_labels,
            'data'   => $seg_data,
            'colors' => array_slice($seg_colors, 0, count($seg_labels)),
        ],
        'prev' => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
