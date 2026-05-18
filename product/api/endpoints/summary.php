<?php
/**
 * GET /api/endpoints/summary.php?period=30d|7d|90d
 * Agrega TOFU + MOFU + BOFU para la vista Performance general.
 *
 * Lee directo de Supabase (no llama a los endpoints individuales)
 * para mantener latencia baja.
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
    $period = $_GET['period'] ?? '30d';
    // Filtro global de campaña (Fase 4 — sprint 1.8). Hoy solo aplica al bloque
    // sellers/seller_summary (via seller_facts). Las métricas TOFU/MOFU/BOFU
    // del summary leen de tablas crudas que aún no tienen campaign_id —
    // refactor pendiente cuando haya multi-campaña.
    $campaign_filter = $_GET['campaign_id'] ?? '';

    // 1. TOFU: tofu_ads_daily — impressions y spend por día
    $tofu_rows = supabase_query('tofu_ads_daily', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'date,impressions,spend',
        'order'       => 'date.asc',
        'limit'       => '500',
    ]);
    $tofu = [];
    foreach ($tofu_rows as $r) {
        $d = $r['date'];
        if (!isset($tofu[$d])) $tofu[$d] = ['impressions' => 0, 'spend' => 0.0];
        $tofu[$d]['impressions'] += (int)   $r['impressions'];
        $tofu[$d]['spend']       += (float) $r['spend'];
    }

    // 2. MOFU: leads de campaña por fecha de creación + assignee para ranking
    $leads = supabase_query('leads', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'meistertask_id,is_campaign_lead,assignee,lead_created_at,status_updated_at,section',
        'limit'       => '5000',
    ]);
    $mofu = []; $nc_leads = 0;
    foreach ($leads as $l) {
        $created = $l['lead_created_at'] ?? null;
        if (!$created) continue;
        if (empty($l['is_campaign_lead'])) { $nc_leads++; continue; }
        $d = substr($created, 0, 10);
        $mofu[$d] = ($mofu[$d] ?? 0) + 1;
    }

    // 3. BOFU: ventas cerradas, separando campaña de vendedor.
    //    Mismo criterio único de venta cerrada que bofu.php (ver comentario
    //    allá): 1 venta = 1 meistertask_id, dedup por completitud (precio>0)
    //    y desempate por updated_at más reciente. Esto evita el inflado por
    //    duplicados en lead_monetary con plan_code/capitas=NULL.
    $closed_raw = supabase_query('lead_monetary', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'is_closed'   => 'eq.true',
        'select'      => 'meistertask_id,precio_final,updated_at',
        'limit'       => '5000',
    ]);
    $closed_by_mid = [];
    foreach ($closed_raw as $row) {
        $mid = $row['meistertask_id'] ?? null;
        if ($mid === null) continue;
        $cur = $closed_by_mid[$mid] ?? null;
        if (!$cur) { $closed_by_mid[$mid] = $row; continue; }
        $cur_p = (float)($cur['precio_final'] ?? 0);
        $new_p = (float)($row['precio_final'] ?? 0);
        if ($new_p > 0 && $cur_p <= 0) { $closed_by_mid[$mid] = $row; continue; }
        if ($new_p <= 0 && $cur_p > 0) continue;
        if (strcmp((string)($row['updated_at'] ?? ''), (string)($cur['updated_at'] ?? '')) > 0) {
            $closed_by_mid[$mid] = $row;
        }
    }
    $closed = array_values($closed_by_mid);
    // index leads para saber si la venta es de campaña
    $is_campaign_by_id = [];
    foreach ($leads as $l) {
        $is_campaign_by_id[$l['meistertask_id']] = !empty($l['is_campaign_lead']);
    }
    $bofu = []; $nc_revenue = 0.0; $nc_sales = 0;
    foreach ($closed as $c) {
        $upd = $c['updated_at'] ?? null;
        if (!$upd) continue;
        $price = (float)($c['precio_final'] ?? 0);
        if (empty($is_campaign_by_id[$c['meistertask_id']])) {
            $nc_revenue += $price; $nc_sales++; continue;
        }
        $d = substr($upd, 0, 10);
        if (!isset($bofu[$d])) $bofu[$d] = ['revenue' => 0.0, 'sales' => 0];
        $bofu[$d]['revenue'] += $price;
        $bofu[$d]['sales']++;
    }

    // 4. Calcular período
    ksort($tofu); ksort($mofu); ksort($bofu);
    $all_dates = array_unique(array_merge(array_keys($tofu), array_keys($mofu), array_keys($bofu)));
    sort($all_dates);
    if (empty($all_dates)) api_error('Sin datos en Supabase para ' . CLIENT_SLUG, 404);
    $last = end($all_dates);

    [$start, $end] = period_dates($period, $last, $all_dates[0] ?? null);

    // Período previo: mismo length, terminando el día antes de $start
    $period_days = (strtotime($end) - strtotime($start)) / 86400 + 1;
    $prev_end    = date('Y-m-d', strtotime($start) - 86400);
    $prev_start  = date('Y-m-d', strtotime($prev_end) - ($period_days - 1) * 86400);

    // 5. Filtrar y agregar el período
    $impressions = 0; $spend = 0.0; $leads_count = 0; $revenue = 0.0; $sales = 0;
    foreach ($tofu as $d => $r) {
        if ($d < $start || $d > $end) continue;
        $impressions += $r['impressions'];
        $spend       += $r['spend'];
    }
    foreach ($mofu as $d => $n) {
        if ($d < $start || $d > $end) continue;
        $leads_count += $n;
    }
    foreach ($bofu as $d => $r) {
        if ($d < $start || $d > $end) continue;
        $revenue += $r['revenue'];
        $sales   += $r['sales'];
    }

    // 6. Trend: spend y revenue por día (datos del período seleccionado)
    $merged = [];
    foreach (array_unique(array_merge(array_keys($tofu), array_keys($bofu))) as $d) {
        if ($d < $start || $d > $end) continue;
        $merged[$d] = [
            'spend'   => $tofu[$d]['spend']   ?? 0,
            'revenue' => $bofu[$d]['revenue'] ?? 0,
        ];
    }
    ksort($merged);

    $trend = build_trend($merged, $period, [
        'spend'   => fn($r) => (float)$r['spend'],
        'revenue' => fn($r) => (float)$r['revenue'],
    ]);

    // 7. Prev — suma del período previo (mismo length que el actual), para deltas correctos.
    //    Si el rango previo no tiene datos, cada métrica queda en 0 (el frontend maneja eso).
    $prev_impressions = 0; $prev_spend = 0.0; $prev_leads = 0; $prev_revenue = 0.0; $prev_sales = 0;
    foreach ($tofu as $d => $r) {
        if ($d < $prev_start || $d > $prev_end) continue;
        $prev_impressions += $r['impressions'];
        $prev_spend       += $r['spend'];
    }
    foreach ($mofu as $d => $n) {
        if ($d < $prev_start || $d > $prev_end) continue;
        $prev_leads += $n;
    }
    foreach ($bofu as $d => $r) {
        if ($d < $prev_start || $d > $prev_end) continue;
        $prev_revenue += $r['revenue'];
        $prev_sales   += $r['sales'];
    }
    $prev = [
        'revenue'      => round($prev_revenue, 2),
        'ad_spend'     => round($prev_spend, 2),
        'impressions'  => $prev_impressions,
        'leads'        => $prev_leads,
        'closed_sales' => $prev_sales,
    ];

    // 8. Ranking + summary de vendedores — lee de seller_facts (migración 012)
    //    en vez de calcular runtime. Esto cierra el bug de la card "Mejor
    //    Vendedor / Efectividad Promedio / Ciclo Promedio..." en Performance,
    //    que no se renderizaba porque el endpoint no devolvía sellers_summary.
    // Reutiliza $prev_start / $prev_end calculados en el bloque de período.

    // Helper: lee seller_facts en un rango y agrega por seller_name.
    $aggregate_sellers = function(string $rs, string $re) use ($campaign_filter) {
        $q = [
            'client_slug' => 'eq.' . CLIENT_SLUG,
            'date'        => 'gte.' . $rs,
            'select'      => 'seller_name,leads_assigned,sales_count,revenue,capitas_closed,avg_cycle_days,date',
            'limit'       => '5000',
        ];
        if ($campaign_filter !== '' && $campaign_filter !== 'all') {
            $q['campaign_id'] = 'eq.' . $campaign_filter;
        }
        $rows = supabase_query('seller_facts', $q);
        $rows = array_filter($rows, fn($r) => ($r['date'] ?? '') <= $re);

        $agg = [];
        foreach ($rows as $r) {
            $name = $r['seller_name'] ?? '';
            if ($name === '') continue;
            if (!isset($agg[$name])) {
                $agg[$name] = [
                    'leads' => 0, 'sales' => 0, 'revenue' => 0.0,
                    'capitas' => 0, 'cycle_weighted' => 0.0,
                ];
            }
            $sales = (int)($r['sales_count'] ?? 0);
            $agg[$name]['leads']          += (int)($r['leads_assigned'] ?? 0);
            $agg[$name]['sales']          += $sales;
            $agg[$name]['revenue']        += (float)($r['revenue'] ?? 0);
            $agg[$name]['capitas']        += (int)($r['capitas_closed'] ?? 0);
            $agg[$name]['cycle_weighted'] += (float)($r['avg_cycle_days'] ?? 0) * $sales;
        }
        return $agg;
    };

    $curr_sellers = $aggregate_sellers($start, $end);
    $prev_sellers = $aggregate_sellers($prev_start, $prev_end);

    // 8a. Lista detallada de sellers (formato esperado por _renderSellersTable)
    $build_seller_row = function(string $name, array $s) {
        $cycle = $s['sales'] > 0 ? round($s['cycle_weighted'] / $s['sales'], 1) : 0.0;
        return [
            'name'           => $name,
            'leads'          => $s['leads'],
            'sales'          => $s['sales'],
            'revenue'        => round($s['revenue'], 2),
            'effectiveness'  => $s['leads'] > 0 ? round($s['sales'] / $s['leads'] * 100, 1) : 0,
            'avg_ticket'     => $s['sales'] > 0 ? round($s['revenue'] / $s['sales'], 2) : 0,
            'capitas'        => $s['capitas'],
            'cycle_days'     => $cycle,
            'avg_cycle_days' => $cycle,
        ];
    };

    $sellers = [];
    foreach ($curr_sellers as $name => $s) {
        $row = $build_seller_row($name, $s);
        if (isset($prev_sellers[$name])) {
            $row['prev'] = $build_seller_row($name, $prev_sellers[$name]);
        }
        $sellers[] = $row;
    }
    usort($sellers, fn($a, $b) => $b['sales'] <=> $a['sales'] ?: $b['revenue'] <=> $a['revenue']);

    // 8b. sellers_summary — los 6 KPIs agregados que muestra _renderCommercialSummary
    //     en la card "Resumen Comercial" del Performance. Faltaba este bloque
    //     en el JSON, por eso la card no se renderizaba (return temprano si !s).
    $build_seller_summary = function(array $rows) {
        if (empty($rows)) {
            return [
                'top_seller'           => '—',
                'avg_effectiveness'    => 0.0,
                'total_sales'          => 0,
                'avg_cycle_days'       => 0.0,
                'avg_ticket'           => 0.0,
                'avg_capitas_per_sale' => 0.0,
            ];
        }
        // Top seller = el que tiene más ventas (tiebreaker: revenue)
        $top = array_keys($rows)[0]; $top_score = -1; $top_rev = -1;
        $total_leads = 0; $total_sales = 0; $total_revenue = 0.0;
        $total_capitas = 0; $cycle_weighted_total = 0.0;
        foreach ($rows as $name => $s) {
            if ($s['sales'] > $top_score || ($s['sales'] === $top_score && $s['revenue'] > $top_rev)) {
                $top = $name; $top_score = $s['sales']; $top_rev = $s['revenue'];
            }
            $total_leads          += $s['leads'];
            $total_sales          += $s['sales'];
            $total_revenue        += $s['revenue'];
            $total_capitas        += $s['capitas'];
            $cycle_weighted_total += $s['cycle_weighted'];
        }
        return [
            'top_seller'           => $top,
            'avg_effectiveness'    => $total_leads > 0 ? round($total_sales / $total_leads * 100, 1) : 0.0,
            'total_sales'          => $total_sales,
            'avg_cycle_days'       => $total_sales > 0 ? round($cycle_weighted_total / $total_sales, 1) : 0.0,
            'avg_ticket'           => $total_sales > 0 ? round($total_revenue / $total_sales, 2) : 0.0,
            'avg_capitas_per_sale' => $total_sales > 0 ? round($total_capitas / $total_sales, 2) : 0.0,
        ];
    };

    $sellers_summary = $build_seller_summary($curr_sellers);
    $sellers_summary['prev'] = $build_seller_summary($prev_sellers);

    echo json_encode([
        'revenue'      => round($revenue, 2),
        'ad_spend'     => round($spend, 2),
        'impressions'  => $impressions,
        'leads'        => $leads_count,
        'closed_sales' => $sales,
        'trend'        => $trend,
        'non_campaign' => [
            'leads_total'   => $nc_leads,
            'closed_sales'  => $nc_sales,
            'total_revenue' => round($nc_revenue, 2),
        ],
        'sellers'         => $sellers,
        'sellers_summary' => $sellers_summary,
        'prev'         => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
