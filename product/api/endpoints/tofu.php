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
    // Filtro de campaña activa: si viene ?campaign_id=X, agregamos el filtro
    // a la query. Si está vacío o "all", no se filtra (vista agregada de
    // todas las campañas activas del cliente).
    $campaign_filter = $_GET['campaign_id'] ?? '';
    $tofu_query_params = [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'order'       => 'date.asc',
        'limit'       => '1000',
    ];
    if ($campaign_filter !== '' && $campaign_filter !== 'all') {
        $tofu_query_params['campaign_id'] = 'eq.' . $campaign_filter;
    }
    $rows = supabase_query('tofu_ads_daily', $tofu_query_params);

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

    // Rango temporal unificado (ver lib/config.php::global_period_dates).
    // Anclado en HOY (APP_TZ) para que todos los endpoints calculen idéntica ventana.
    [$start, $end] = global_period_dates($period, $dates[0] ?? null);

    // Período previo: mismo length, terminando el día antes de $start
    $period_days = (strtotime($end) - strtotime($start)) / 86400 + 1;
    $prev_end    = date('Y-m-d', strtotime($start) - 86400);
    $prev_start  = date('Y-m-d', strtotime($prev_end) - ($period_days - 1) * 86400);

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

    // Términos de búsqueda: leer desde tofu_search_terms (tabla dedicada).
    // Esta tabla consolida términos de search_term_view (campañas Search) y
    // category labels de campaign_search_term_insight (campañas PMAX).
    // Si no hay datos en la tabla dedicada, hacemos fallback al campo JSONB
    // top_search_terms de tofu_ads_daily (comportamiento anterior).
    //
    // El filtro de fecha usa el rango $start/$end del período seleccionado.
    // El filtro de campaign_id se aplica solo si hay filtro activo (igual que
    // el filtro de la query principal de tofu_ads_daily).
    $st_query_params = [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'date'        => 'gte.' . $start,
        'order'       => 'clicks.desc',
        'limit'       => '500',
        'select'      => 'date,term,clicks,impressions',
    ];
    // Supabase REST usa "lte" en un segundo filtro del mismo campo como "and":
    // no hay soporte nativo de BETWEEN via query params, se usa gte + lte separados.
    // La librería supabase_query del proyecto pasa los params tal como vienen;
    // para el segundo bound usamos el header Range o lo manejamos en PHP filtrando.
    // Solución: traer con gte=$start y filtrar por date <= $end en PHP (el limit=500
    // es más que suficiente para 7-90 días de términos).
    if ($campaign_filter !== '' && $campaign_filter !== 'all') {
        $st_query_params['campaign_id'] = 'eq.' . $campaign_filter;
    }
    $raw_st_rows = supabase_query('tofu_search_terms', $st_query_params);

    // Filtrar por end date en PHP (supabase_query no soporta doble filtro mismo campo)
    $st_rows_filtered = array_filter(
        is_array($raw_st_rows) ? $raw_st_rows : [],
        fn($r) => isset($r['date']) && $r['date'] >= $start && $r['date'] <= $end,
    );

    // Agregar clicks e impressions por término (puede haber el mismo término en
    // múltiples días o campañas dentro del período seleccionado).
    $st_clicks_agg = [];
    $st_imp_agg    = [];
    foreach ($st_rows_filtered as $r) {
        $t = $r['term'] ?? null;
        if ($t === null || $t === '') continue;
        $st_clicks_agg[$t] = ($st_clicks_agg[$t] ?? 0) + (int)($r['clicks'] ?? 0);
        $st_imp_agg[$t]    = ($st_imp_agg[$t]    ?? 0) + (int)($r['impressions'] ?? 0);
    }

    // Si tofu_search_terms está vacío para este período, usar fallback al JSONB inline.
    // El fallback usa $all_terms_clicks/$all_terms_imp que ya están acumulados arriba.
    if (empty($st_clicks_agg)) {
        $st_clicks_agg = $all_terms_clicks;
        $st_imp_agg    = $all_terms_imp;
    }

    arsort($st_clicks_agg);
    $max_terms_clicks = max(array_values($st_clicks_agg) ?: [1]);
    $max_terms_imp    = max(array_values($st_imp_agg) ?: [1]);
    $search_terms = [];
    foreach (array_slice($st_clicks_agg, 0, 10, true) as $term => $cl) {
        $imp = $st_imp_agg[$term] ?? 0;
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

    // CPC diario para el popup KPI: spend / clicks del mismo día (0 si no hay clicks).
    $trend = build_trend($selected, $period, [
        'impressions' => fn($r) => (int)$r['impressions'],
        'clicks'      => fn($r) => (int)$r['clicks'],
        'spend'       => fn($r) => (float)$r['spend'],
        'cpc'         => fn($r) => ((int)$r['clicks']) > 0
                                    ? round((float)$r['spend'] / (int)$r['clicks'], 2)
                                    : 0,
    ]);

    // Prev — suma del período previo (mismo length que el actual), para deltas correctos.
    $prev_impressions_p = 0; $prev_clicks_p = 0; $prev_spend_p = 0.0;
    $prev_selected = filter_range($by_date, $prev_start, $prev_end);
    foreach ($prev_selected as $r) {
        $prev_impressions_p += (int)   $r['impressions'];
        $prev_clicks_p      += (int)   $r['clicks'];
        $prev_spend_p       += (float) $r['spend'];
    }
    $prev = [
        'impressions' => $prev_impressions_p,
        'clicks'      => $prev_clicks_p,
        'cpc'         => $prev_clicks_p > 0 ? round($prev_spend_p / $prev_clicks_p, 2) : 0,
        'spend'       => round($prev_spend_p, 2),
    ];

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
