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

    // 3. BOFU: ventas cerradas, separando campaña de vendedor
    $closed = supabase_query('lead_monetary', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'is_closed'   => 'eq.true',
        'select'      => 'meistertask_id,precio_final,updated_at',
        'limit'       => '5000',
    ]);
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
    $last   = end($all_dates);
    $prev_d = count($all_dates) >= 2 ? $all_dates[count($all_dates) - 2] : null;

    [$start, $end] = period_dates($period, $last, $all_dates[0] ?? null);

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

    // 7. Prev (último punto antes del período seleccionado, para deltas)
    $prev = null;
    if ($prev_d) {
        $prev = [
            'revenue'      => isset($bofu[$prev_d]) ? round($bofu[$prev_d]['revenue'], 2) : 0,
            'ad_spend'     => isset($tofu[$prev_d]) ? round($tofu[$prev_d]['spend'], 2)   : 0,
            'impressions'  => $tofu[$prev_d]['impressions'] ?? 0,
            'leads'        => $mofu[$prev_d] ?? 0,
            'closed_sales' => $bofu[$prev_d]['sales'] ?? 0,
        ];
    }

    // 8. Ranking de vendedores (por assignee). Solo leads de campaña.
    //    Métricas por vendedor:
    //      leads          — leads totales asignados (en período)
    //      sales          — ventas cerradas (lead_monetary.is_closed=true) en período
    //      revenue        — sumatoria precio_final
    //      effectiveness  — sales / leads * 100
    //      avg_cycle_days — promedio (status_updated_at - lead_created_at) de los cerrados
    //      avg_ticket     — revenue / sales
    $sales_by_lead = [];
    foreach ($closed as $c) {
        $sales_by_lead[$c['meistertask_id']] = [
            'price' => (float)($c['precio_final'] ?? 0),
            'date'  => substr($c['updated_at'] ?? '', 0, 10),
        ];
    }

    $sellers_agg = [];
    foreach ($leads as $l) {
        if (empty($l['is_campaign_lead'])) continue;
        $name    = trim($l['assignee'] ?? '');
        if ($name === '' || strtolower($name) === 'umoh crew') continue;
        $created = substr($l['lead_created_at'] ?? '', 0, 10);
        if ($created === '' || $created < $start || $created > $end) continue;

        if (!isset($sellers_agg[$name])) {
            $sellers_agg[$name] = ['leads' => 0, 'sales' => 0, 'revenue' => 0.0, 'cycle_sum' => 0, 'cycle_count' => 0];
        }
        $sellers_agg[$name]['leads']++;

        $sale = $sales_by_lead[$l['meistertask_id']] ?? null;
        if ($sale && $sale['date'] >= $start && $sale['date'] <= $end) {
            $sellers_agg[$name]['sales']++;
            $sellers_agg[$name]['revenue'] += $sale['price'];

            $st_upd = $l['status_updated_at'] ?? null;
            if ($st_upd && $created) {
                $diff = (strtotime(substr($st_upd, 0, 10)) - strtotime($created)) / 86400;
                if ($diff >= 0) {
                    $sellers_agg[$name]['cycle_sum']   += $diff;
                    $sellers_agg[$name]['cycle_count']++;
                }
            }
        }
    }

    $sellers = [];
    foreach ($sellers_agg as $name => $s) {
        $sellers[] = [
            'name'           => $name,
            'leads'          => $s['leads'],
            'sales'          => $s['sales'],
            'revenue'        => round($s['revenue'], 2),
            'effectiveness'  => $s['leads'] > 0 ? round($s['sales'] / $s['leads'] * 100, 1) : 0,
            'avg_cycle_days' => $s['cycle_count'] > 0 ? round($s['cycle_sum'] / $s['cycle_count'], 1) : 0,
            'avg_ticket'     => $s['sales'] > 0 ? round($s['revenue'] / $s['sales'], 2) : 0,
        ];
    }
    usort($sellers, fn($a, $b) => $b['sales'] <=> $a['sales'] ?: $b['revenue'] <=> $a['revenue']);

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
        'sellers'      => $sellers,
        'prev'         => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
