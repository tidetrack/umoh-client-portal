<?php
/**
 * GET /api/endpoints/tofu.php?period=30d|7d|90d
 * Devuelve métricas TOFU desde Supabase (tabla tofu_ads_daily).
 *
 * Mantiene el mismo shape de respuesta que la versión anterior basada en Sheets,
 * para no romper el contrato con el frontend.
 */

require_once __DIR__ . '/../lib/supabase.php';
require_once __DIR__ . '/../lib/config.php';

api_headers();

// Auth gate: la session se setea en /dashboard/login.php y vive en cookie
// .umohcrew.com (configurada con domain compartido). Si no hay session,
// 401 — el frontend hace logout y redirige a /login.php.
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
if (empty($_SESSION['umoh_user'])) {
    api_error('No autenticado', 401);
}

// Por ahora hardcodeamos el cliente: el MVP sirve solo a prepagas.
// Cuando se active el login (Fase 4), el slug se va a derivar del usuario.
const CLIENT_SLUG = 'prepagas';

try {
    $rows = supabase_query('tofu_ads_daily', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'order'       => 'date.asc',
        'limit'       => '1000',
    ]);

    if (empty($rows)) api_error('Sin datos en tofu_ads_daily para ' . CLIENT_SLUG, 404);

    // Agrupar por fecha. Si hay múltiples plataformas en el futuro,
    // se suman impressions/clicks/spend en la misma fila por día.
    $by_date = [];
    foreach ($rows as $r) {
        $d = $r['date'];
        if (!isset($by_date[$d])) {
            $by_date[$d] = [
                'date'              => $d,
                'impressions'       => 0,
                'clicks'            => 0,
                'spend'             => 0.0,
                'top_search_terms'  => [],
                'channel_breakdown' => [],
                'device_breakdown'  => [],
                'geo_breakdown'     => [],
            ];
        }
        $by_date[$d]['impressions'] += (int)   $r['impressions'];
        $by_date[$d]['clicks']      += (int)   $r['clicks'];
        $by_date[$d]['spend']       += (float) $r['spend'];

        // JSONB ya viene como array decodificado desde Supabase REST.
        if (is_array($r['top_search_terms'] ?? null)) {
            foreach ($r['top_search_terms'] as $t) {
                $by_date[$d]['top_search_terms'][] = $t;
            }
        }
        // channel_breakdown / device_breakdown / geo_breakdown:
        // formato {label: {clicks, impressions}}. Cuando la misma fecha tiene
        // múltiples plataformas, sumamos por label.
        foreach (['channel_breakdown', 'device_breakdown', 'geo_breakdown'] as $bk) {
            if (!is_array($r[$bk] ?? null)) continue;
            foreach ($r[$bk] as $label => $metrics) {
                if (!is_array($metrics)) continue;
                if (!isset($by_date[$d][$bk][$label])) {
                    $by_date[$d][$bk][$label] = ['clicks' => 0, 'impressions' => 0];
                }
                $by_date[$d][$bk][$label]['clicks']      += (int)($metrics['clicks']      ?? 0);
                $by_date[$d][$bk][$label]['impressions'] += (int)($metrics['impressions'] ?? 0);
            }
        }
    }
    ksort($by_date);

    $period = $_GET['period'] ?? '30d';
    $dates  = array_keys($by_date);
    $last   = end($dates);
    $prev_d = count($dates) >= 2 ? $dates[count($dates) - 2] : null;

    [$start, $end] = period_dates($period, $last, $dates[0] ?? null);
    $selected = filter_range($by_date, $start, $end);

    // Agregar el período. Para channels/devices guardamos clicks Y impressions
    // por separado: el frontend tiene un toggle (channels-filter / devices-filter)
    // que decide cuál mostrar.
    $impressions = 0; $clicks = 0; $spend = 0.0;
    $all_terms_clicks = []; $all_terms_imp = [];
    $channels_clicks  = []; $channels_imp  = [];
    $devices_clicks   = []; $devices_imp   = [];
    $geo_agg          = [];

    foreach ($selected as $r) {
        $impressions += (int)   $r['impressions'];
        $clicks      += (int)   $r['clicks'];
        $spend       += (float) $r['spend'];

        foreach ($r['top_search_terms'] as $t) {
            $k = $t['term'] ?? null;
            if ($k === null) continue;
            $all_terms_clicks[$k] = ($all_terms_clicks[$k] ?? 0) + (int)($t['clicks']      ?? 0);
            $all_terms_imp[$k]    = ($all_terms_imp[$k]    ?? 0) + (int)($t['impressions'] ?? 0);
        }
        foreach ($r['channel_breakdown'] as $ch => $v) {
            $channels_clicks[$ch] = ($channels_clicks[$ch] ?? 0) + (int)($v['clicks']      ?? 0);
            $channels_imp[$ch]    = ($channels_imp[$ch]    ?? 0) + (int)($v['impressions'] ?? 0);
        }
        foreach ($r['device_breakdown'] as $dev => $v) {
            $devices_clicks[$dev] = ($devices_clicks[$dev] ?? 0) + (int)($v['clicks']      ?? 0);
            $devices_imp[$dev]    = ($devices_imp[$dev]    ?? 0) + (int)($v['impressions'] ?? 0);
        }
        foreach ($r['geo_breakdown'] as $city => $v) {
            $geo_agg[$city] = ($geo_agg[$city] ?? 0) + (int)($v['clicks'] ?? 0);
        }
    }

    $cpc = $clicks > 0 ? round($spend / $clicks, 2) : 0;

    arsort($all_terms_clicks);
    $max_terms_clicks = max(array_values($all_terms_clicks) ?: [1]);
    $max_terms_imp    = max(array_values($all_terms_imp) ?: [1]);
    $search_terms = [];
    foreach (array_slice($all_terms_clicks, 0, 10, true) as $term => $cl) {
        $imp = $all_terms_imp[$term] ?? 0;
        $search_terms[] = [
            'term'        => $term,
            'clicks'      => $cl,
            'impressions' => $imp,
            'pct'         => round($cl  / $max_terms_clicks * 100),
            'pct_imp'     => round($imp / $max_terms_imp    * 100),
        ];
    }

    // Channels: dataset por clicks (default) y dataset paralelo por impressions.
    // Mantienen el mismo orden de labels (sorted by clicks desc) para que el
    // toggle del frontend sea consistente.
    arsort($channels_clicks);
    $ch_labels = array_keys($channels_clicks);
    $ch_colors = [COLORS['navy'], COLORS['slate'], COLORS['silver'], COLORS['mist'], COLORS['light']];
    $channels = [
        'labels' => $ch_labels,
        'data'   => array_values($channels_clicks),
        'colors' => array_slice($ch_colors, 0, count($ch_labels)),
    ];
    $channels_imp_dataset = [
        'labels' => $ch_labels,
        'data'   => array_map(fn($l) => $channels_imp[$l] ?? 0, $ch_labels),
        'colors' => array_slice($ch_colors, 0, count($ch_labels)),
    ];

    arsort($devices_clicks);
    $dev_labels = array_keys($devices_clicks);
    $dev_colors = [COLORS['navy'], COLORS['slate'], COLORS['mist'], COLORS['light']];
    $devices = [
        'labels' => $dev_labels,
        'data'   => array_values($devices_clicks),
        'colors' => array_slice($dev_colors, 0, count($dev_labels)),
    ];
    $devices_imp_dataset = [
        'labels' => $dev_labels,
        'data'   => array_map(fn($l) => $devices_imp[$l] ?? 0, $dev_labels),
        'colors' => array_slice($dev_colors, 0, count($dev_labels)),
    ];

    $trend = build_trend($selected, $period, [
        'impressions' => fn($r) => (int)$r['impressions'],
        'clicks'      => fn($r) => (int)$r['clicks'],
    ]);

    // Prev: el día inmediatamente anterior al último, para mostrar delta puntual.
    $prev = null;
    if ($prev_d && isset($by_date[$prev_d])) {
        $pr    = $by_date[$prev_d];
        $pr_cl = (int)   $pr['clicks'];
        $pr_sp = (float) $pr['spend'];
        $prev  = [
            'impressions' => (int)$pr['impressions'],
            'clicks'      => $pr_cl,
            'cpc'         => $pr_cl > 0 ? round($pr_sp / $pr_cl, 2) : 0,
        ];
    }

    // Geo: normalizar nombres de Google Ads → labels del GeoJSON Gran Mendoza.
    // Google Ads reporta sin acentos y "Mendoza" para Capital Mendoza; el GeoJSON
    // del frontend usa "Capital", "Maipú", "Luján de Cuyo" con tildes. Sin este
    // mapeo el choropleth pinta todo en gris (val=0 por mismatch de strings).
    $geo_name_map = [
        'Mendoza'        => 'Capital',
        'Maipu'          => 'Maipú',
        'Maipú'          => 'Maipú',
        'Lujan de Cuyo'  => 'Luján de Cuyo',
        'Luján de Cuyo'  => 'Luján de Cuyo',
        'Guaymallen'     => 'Guaymallén',
        'Guaymallén'     => 'Guaymallén',
        'Las Heras'      => 'Las Heras',
        'Godoy Cruz'     => 'Godoy Cruz',
    ];
    $geo_normalized = [];
    foreach ($geo_agg as $city => $cl) {
        $name = $geo_name_map[$city] ?? $city;
        $geo_normalized[$name] = ($geo_normalized[$name] ?? 0) + $cl;
    }
    arsort($geo_normalized);
    $geo = array_slice($geo_normalized, 0, 15, true);

    echo json_encode([
        'impressions'  => $impressions,
        'clicks'       => $clicks,
        'cpc'          => $cpc,
        'trend'        => $trend,
        'search_terms' => $search_terms,
        'channels'     => $channels,
        'channels_imp' => $channels_imp_dataset,
        'devices'      => $devices,
        'devices_imp'  => $devices_imp_dataset,
        'geo'          => $geo,
        'prev'         => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
