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
    // Filtro global de campaña (Fase 4 — sprint 1.8). Aceptamos el parámetro
    // por contrato del frontend, pero las queries de MOFU leen directamente de
    // `leads` que no tiene campaign_id (los leads de MeisterTask no traen ese
    // campo). Para Prepagas hoy con una sola campaña activa, todos los
    // is_campaign_lead=true son de esa campaña — sin diferencia funcional.
    // TODO multi-campaña: refactor a leer de mofu_facts con filtro campaign_id.
    $campaign_filter = $_GET['campaign_id'] ?? '';

    // Filtro de canal del lead (2026-05-19, paridad con BOFU). Valores:
    //   campaign     → solo leads de campaña (is_campaign_lead = true).
    //   non_campaign → solo leads particulares (Propio, Referido, vacíos).
    //   all          → ambos (default en MOFU para no alterar comportamiento histórico).
    //
    // Por defecto MOFU usa 'all' porque el customer journey históricamente
    // incluyó todos los leads. El usuario puede filtrar para entender mejor
    // qué porción del journey viene de campaña vs vendedor.
    $canal_filter = $_GET['canal'] ?? 'all';
    if (!in_array($canal_filter, ['campaign', 'non_campaign', 'all'], true)) {
        $canal_filter = 'all';
    }
    // 1. Funnel stages config: section_name → flags (high_intent, lost, incubating, etc.)
    //    Incluye display_order para construir el journey en el mismo orden que el CRM.
    $stages = supabase_query('funnel_stages', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'section_name,funnel_stage,is_high_intent,is_closed_won,is_typified,is_lost,is_incubating,display_order',
        'order'       => 'display_order.asc',
    ]);
    $stage_by_section = [];
    foreach ($stages as $s) {
        $stage_by_section[$s['section_name']] = $s;
    }

    // 2. Leads del cliente (todos — el filtrado por período se hace en PHP).
    //    tipification     = segmento real (Voluntario/Monotributista/Obligatorio)
    //    canal            = origen del lead
    //    is_campaign_lead = true si canal in (Form/Wsp/Formulario/WhatsApp/Campaña)
    //                       (columna generada por Postgres, ver migration 008)
    $leads = supabase_query('leads', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'meistertask_id,section,tipification,canal,is_campaign_lead,lead_created_at,status_updated_at',
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

    // 4. Separar leads de campaña vs leads del vendedor (Referido/Propio).
    //    Las métricas principales (total_leads, segmentos, status) reflejan
    //    solo campaña. Los del vendedor se reportan en bloque non_campaign.
    $campaign_leads = []; $non_campaign_leads = [];
    foreach ($leads as $l) {
        if (!empty($l['is_campaign_lead'])) {
            $campaign_leads[] = $l;
        } else {
            $non_campaign_leads[] = $l;
        }
    }

    // 5. Agrupar leads de campaña por fecha. Usamos to_app_date() para que
    //    el bucket coincida con "la fecha que aparece en la tarea" en
    //    MeisterTask (hora Argentina), evitando off-by-one para tareas
    //    creadas cerca de medianoche UTC.
    $by_date = [];
    foreach ($campaign_leads as $l) {
        $d = to_app_date($l['lead_created_at'] ?? null);
        if (!$d) continue;
        if (!isset($by_date[$d])) {
            $by_date[$d] = [
                'total_leads' => 0,
                'leads' => [],
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

    // Rango temporal unificado (ver lib/config.php::global_period_dates).
    // Anclado en HOY (APP_TZ) para que todos los endpoints calculen idéntica ventana.
    [$start, $end] = global_period_dates($period, $dates[0] ?? null);

    // Período previo: mismo length, terminando el día antes de $start
    $period_days = (strtotime($end) - strtotime($start)) / 86400 + 1;
    $prev_end    = date('Y-m-d', strtotime($start) - 86400);
    $prev_start  = date('Y-m-d', strtotime($prev_end) - ($period_days - 1) * 86400);

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
    $leads_closed_won = 0; $leads_typified = 0;
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
            if ($c['closed_won'])  $leads_closed_won++;

            $tip = trim($l['tipification'] ?? '');
            if ($tip !== '') $leads_typified++;
            if ($tip === '') $tip = 'Sin clasificar';
            $segs[$tip] = ($segs[$tip] ?? 0) + 1;
        }
    }

    // Ajuste closed_won: los non_campaign leads en sección is_closed_won=true que
    // caen dentro del período también son ventas reales (regla de negocio: toda venta
    // en "Ventas Ganadas" cuenta). Se suman aquí para que closed_won_leads coincida
    // con el customer journey y con la BD (audit 2026-05-15).
    // Nota: no se suman a total_leads porque esa métrica mide rendimiento de campaña.
    foreach ($non_campaign_leads as $l) {
        $d = to_app_date($l['lead_created_at'] ?? null);
        if (!$d || $d < $start || $d > $end) continue;
        $c_nc = $classify($l);
        if ($c_nc['closed_won']) $leads_closed_won++;
    }

    // CPL = sum(spend en periodo) / total_leads
    $period_spend = 0.0;
    foreach ($selected as $d => $_) $period_spend += $spend_by_date[$d] ?? 0;
    $cpl = $total_leads > 0 ? round($period_spend / $total_leads, 2) : 0;

    // Tipification rate = leads con campo tipification no vacío / total.
    // (Antes se usaba "en_blanco" como proxy, pero leads con stage='closed_won'
    //  no caían en ningún bucket nominado y se contaban como tipificados aunque
    //  no lo estuvieran — inflaba el rate ~10pts. Ver auditoría 2026-05-05.)
    $tipification_rate = $total_leads > 0
        ? round($leads_typified / $total_leads * 100, 1) : 0;

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

    // 9. Prev — suma del período previo (mismo length que el actual), para deltas correctos.
    $prev_selected = filter_range($by_date, $prev_start, $prev_end);
    $pr_total = 0; $pr_high = 0; $pr_typified = 0; $pr_closed_won = 0; $pr_spend_total = 0.0;
    foreach ($prev_selected as $d => $bucket) {
        $pr_total      += $bucket['total_leads'];
        $pr_spend_total += $spend_by_date[$d] ?? 0;
        foreach ($bucket['leads'] as $l) {
            $c = $classify($l);
            if ($c['high_intent']) $pr_high++;
            if ($c['typified'])    $pr_typified++;
            if ($c['closed_won'])  $pr_closed_won++;
        }
    }
    $prev = [
        'total_leads'       => $pr_total,
        'cpl'               => $pr_total > 0 ? round($pr_spend_total / $pr_total, 2) : 0,
        'tipification_rate' => $pr_total > 0 ? round($pr_typified / $pr_total * 100, 1) : 0,
        'high_intent_leads' => $pr_high,
        'closed_won_leads'  => $pr_closed_won,
    ];

    // 10. Status breakdown — Customer Journey.
    //
    //    AUDITORIA 2026-05-19 (Franco) — dos cambios clave para que MOFU
    //    y BOFU sean coherentes en "Ventas Ganadas":
    //
    //    (a) Las columnas closed_won se cuentan por `status_updated_at`
    //        (fecha en que el lead llegó a esa sección) en lugar de
    //        `lead_created_at`. Antes la columna mostraba "leads creados
    //        en el período que HOY están en Ventas Ganadas" — una vista
    //        cohorte. Ahora muestra "leads cerrados en el período" — vista
    //        de evento, igual semántica que BOFU.closed_sales.
    //        Resto del journey sigue contando por lead_created_at (cohorte
    //        de leads que ENTRARON en el período).
    //
    //    (b) Respeta el filtro $canal_filter. Si canal=campaign, solo
    //        cuenta is_campaign_lead=true. Si canal=non_campaign, solo
    //        manuales. Default 'all' mantiene el comportamiento histórico.
    //
    //    Además: status_canal_breakdown expone, por cada sección, el
    //    desglose campaign vs vendedor — para que el frontend muestre
    //    la línea "X campaña · Y vendedor" debajo del número.
    $C = COLORS;

    $closed_won_section_names = [];
    foreach ($stage_by_section as $name => $cfg) {
        if (!empty($cfg['is_closed_won'])) {
            $closed_won_section_names[$name] = true;
        }
    }

    $canal_match = function(array $lead) use ($canal_filter): bool {
        $is_campaign = !empty($lead['is_campaign_lead']);
        if ($canal_filter === 'campaign')     return $is_campaign;
        if ($canal_filter === 'non_campaign') return !$is_campaign;
        return true;
    };

    // Inicializar contadores por sección con desglose por canal
    $status_counts = [];
    $status_canal_breakdown = [];
    foreach ($stage_by_section as $name => $_cfg) {
        $status_counts[$name] = 0;
        $status_canal_breakdown[$name] = ['campaign' => 0, 'non_campaign' => 0];
    }

    // Iterar TODOS los leads (no solo campaign), filtrar por canal + período
    // según la regla de cada sección.
    foreach ($leads as $l) {
        $sec = $l['section'] ?? '';
        if (!array_key_exists($sec, $status_counts)) continue;

        // Para closed_won: filtrar por close date (status_updated_at).
        // Para el resto: filtrar por lead_created_at (cohorte que entró).
        $is_closed_won = isset($closed_won_section_names[$sec]);
        $date_field    = $is_closed_won ? 'status_updated_at' : 'lead_created_at';
        $d = to_app_date($l[$date_field] ?? null);
        if (!$d || $d < $start || $d > $end) continue;

        if (!$canal_match($l)) continue;

        $status_counts[$sec]++;
        if (!empty($l['is_campaign_lead'])) {
            $status_canal_breakdown[$sec]['campaign']++;
        } else {
            $status_canal_breakdown[$sec]['non_campaign']++;
        }
    }

    // Construir arrays de labels y data en el mismo orden del journey
    $status_labels = array_keys($status_counts);
    $status_data   = array_values($status_counts);

    // Override de leads_closed_won para coherencia con la nueva semántica
    // de status_counts (close date + canal filter). Antes se computaba en
    // la sección 7 con lead_created_at; ahora reflejamos exactamente lo
    // que muestra la columna "Ventas Ganadas" del journey — y por ende
    // matchea con BOFU.closed_sales.
    $leads_closed_won = 0;
    foreach ($closed_won_section_names as $name => $_) {
        $leads_closed_won += $status_counts[$name] ?? 0;
    }

    // Segmentos: top 5 operatorias por count
    arsort($segs);
    $seg_labels = []; $seg_data = [];
    foreach (array_slice($segs, 0, 5, true) as $label => $count) {
        $seg_labels[] = $label;
        $seg_data[] = $count;
    }
    $seg_colors = [$C['navy'], $C['slate'], $C['silver'], $C['mist'], $C['light']];

    // 11. Bloque non_campaign — leads del vendedor (Referido/Propio/etc.)
    //     en el período seleccionado. Se reportan separados para que el
    //     frontend los muestre como "+ N leads del vendedor" sin inflar
    //     las métricas de campaña.
    $nc_total = 0; $nc_high = 0; $nc_lost = 0; $nc_incub = 0;
    foreach ($non_campaign_leads as $l) {
        $d = to_app_date($l['lead_created_at'] ?? null);
        if (!$d || $d < $start || $d > $end) continue;
        $nc_total++;
        $c = $classify($l);
        if ($c['high_intent']) $nc_high++;
        if ($c['lost'])        $nc_lost++;
        if ($c['incubating'])  $nc_incub++;
    }

    // status_canal_breakdown: para cada sección, arrays paralelos a status.data
    // con el desglose campaña vs vendedor. El frontend renderiza una línea
    // pequeña debajo de cada columna del journey "X campaña · Y vendedor".
    $status_breakdown_campaign     = [];
    $status_breakdown_non_campaign = [];
    foreach ($status_labels as $sec) {
        $status_breakdown_campaign[]     = $status_canal_breakdown[$sec]['campaign'] ?? 0;
        $status_breakdown_non_campaign[] = $status_canal_breakdown[$sec]['non_campaign'] ?? 0;
    }

    echo json_encode([
        'canal'             => $canal_filter,
        'total_leads'       => $total_leads,
        'cpl'               => $cpl,
        'tipification_rate' => $tipification_rate,
        'high_intent_leads' => $leads_alta_intencion,
        'closed_won_leads'  => $leads_closed_won,
        'trend' => $trend,
        'status' => [
            'labels' => $status_labels,
            'data'   => $status_data,
            // Colors are overridden by charts.js semantic palette; this array is a
            // structural placeholder with the correct length for schema validation.
            'colors' => array_fill(0, count($status_labels), $C['slate']),
            // Desglose campaign / non_campaign por sección, mismo orden que labels.
            'breakdown_campaign'     => $status_breakdown_campaign,
            'breakdown_non_campaign' => $status_breakdown_non_campaign,
        ],
        'segments' => [
            'labels' => $seg_labels,
            'data'   => $seg_data,
            'colors' => array_slice($seg_colors, 0, count($seg_labels)),
        ],
        'non_campaign' => [
            'total_leads'       => $nc_total,
            'high_intent_leads' => $nc_high,
            'lost'              => $nc_lost,
            'incubating'        => $nc_incub,
            'description'       => 'Leads cargados manualmente por el vendedor (Referido / Propio / etc.). No se cuentan como rendimiento de campaña.',
        ],
        'prev' => $prev,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
