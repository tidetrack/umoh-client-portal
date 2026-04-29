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

    [$start, $end] = period_dates($period, $last);
    $selected = filter_range($by_date, $start, $end);

    // Agregar el período
    $impressions = 0; $clicks = 0; $spend = 0.0;
    $all_terms = []; $channels_agg = []; $devices_agg = []; $geo_agg = [];

    foreach ($selected as $r) {
        $impressions += (int)   $r['impressions'];
        $clicks      += (int)   $r['clicks'];
        $spend       += (float) $r['spend'];

        foreach ($r['top_search_terms'] as $t) {
            $k = $t['term'] ?? null;
            if ($k === null) continue;
            $all_terms[$k] = ($all_terms[$k] ?? 0) + (int)($t['clicks'] ?? 0);
        }
        foreach ($r['channel_breakdown'] as $ch => $v) {
            $channels_agg[$ch] = ($channels_agg[$ch] ?? 0) + (int)($v['clicks'] ?? 0);
        }
        foreach ($r['device_breakdown'] as $dev => $v) {
            $devices_agg[$dev] = ($devices_agg[$dev] ?? 0) + (int)($v['clicks'] ?? 0);
        }
        foreach ($r['geo_breakdown'] as $city => $v) {
            $geo_agg[$city] = ($geo_agg[$city] ?? 0) + (int)($v['clicks'] ?? 0);
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
    $channels = [
        'labels' => array_keys($channels_agg),
        'data'   => array_values($channels_agg),
        'colors' => array_slice($ch_colors, 0, count($channels_agg)),
    ];

    arsort($devices_agg);
    $dev_colors = [COLORS['navy'], COLORS['slate'], COLORS['mist'], COLORS['light']];
    $devices = [
        'labels' => array_keys($devices_agg),
        'data'   => array_values($devices_agg),
        'colors' => array_slice($dev_colors, 0, count($devices_agg)),
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

    // Geo: extraído de Google Ads (geographic_view + geo_target_constant).
    // Si no hay datos, $geo queda vacío y el mapa del frontend muestra estado inicial.
    arsort($geo_agg);
    $geo = array_slice($geo_agg, 0, 15, true);

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
