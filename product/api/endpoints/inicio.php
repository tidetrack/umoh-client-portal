<?php
/**
 * GET /api/endpoints/inicio.php
 *
 * Datos para la sección "Inicio" del dashboard.
 * Devuelve: saludo del usuario, KPIs de resumen por sección y resumen generado
 * con lógica heurística (placeholder hasta que se conecte Claude API + tabla ai_summaries).
 *
 * Cuando ai_summaries esté disponible en Supabase:
 *   1. Leer la fila WHERE client_slug = ? AND period = ? AND generated_at > now() - interval '6 hours'
 *   2. Si existe → devolver headline, highlights, recommendation cacheados
 *   3. Si no existe → generar con Claude API, insertar/upsert en ai_summaries, devolver
 *
 * Por ahora: el resumen se genera on-the-fly con heurísticas sobre los datos reales.
 *
 * @param period  string  7d | 30d | 90d | custom (default: 30d)
 * @param start   string  YYYY-MM-DD (si period=custom)
 * @param end     string  YYYY-MM-DD (si period=custom)
 * @returns JSON  { user_name, period_label, ai_summary, section_kpis }
 */

require_once __DIR__ . '/../lib/config.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

// ── Helpers ──────────────────────────────────────────────────────────────────

function _json_ok(array $payload): void {
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function _json_err(string $msg, int $code = 500): void {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function _pct_label(float $pct): string {
    if (abs($pct) < 0.5) return 'plana';
    return $pct >= 0 ? sprintf('+%.1f%%', $pct) : sprintf('%.1f%%', $pct);
}

function _fmt_ars(float $n): string {
    if ($n >= 1_000_000) return '$' . number_format($n / 1_000_000, 1, ',', '.') . 'M';
    if ($n >= 1_000)     return '$' . number_format($n / 1_000, 0, ',', '.') . 'k';
    return '$' . number_format($n, 0, ',', '.');
}

function _fmt_num(float $n): string {
    if ($n >= 1_000_000) return number_format($n / 1_000_000, 1, ',', '.') . 'M';
    if ($n >= 1_000)     return number_format($n / 1_000, 1, ',', '.') . 'k';
    return (string) round($n);
}

// ── Session / Auth ────────────────────────────────────────────────────────────

$_host     = $_SERVER['HTTP_HOST'] ?? '';
$_is_local = ($_host === 'localhost' || $_host === '127.0.0.1'
    || str_starts_with($_host, 'localhost:')
    || str_starts_with($_host, '127.0.0.1:'));

if ($_is_local) {
    session_set_cookie_params(['lifetime' => 86400 * 30, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
} else {
    ini_set('session.cookie_domain', '.umohcrew.com');
    session_set_cookie_params(['lifetime' => 86400 * 30, 'path' => '/', 'domain' => '.umohcrew.com', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
}
session_start();

if (empty($_SESSION['umoh_user'])) {
    _json_err('No autenticado', 401);
}

$user_name = $_SESSION['umoh_name'] ?? 'Usuario';

// ── Parámetros ────────────────────────────────────────────────────────────────

$period = $_GET['period'] ?? '30d';
$start  = $_GET['start']  ?? null;
$end    = $_GET['end']    ?? null;

$period_labels = [
    '7d'  => 'Últimos 7 días',
    '30d' => 'Últimos 30 días',
    '90d' => 'Últimos 90 días',
];
$period_label = $period_labels[$period] ?? 'Período seleccionado';
if ($period === 'custom' && $start && $end) {
    $period_label = 'Del ' . $start . ' al ' . $end;
}

// ── Cargar datos de los endpoints existentes ──────────────────────────────────
// Incluimos los otros endpoints como funciones si están disponibles, o hacemos
// llamadas internas. Como Hostinger es shared hosting sin CLI HTTP interno,
// reutilizamos la lógica directamente via require.
//
// Estrategia: intentar cargar Supabase. Si falla, caer a valores placeholder
// para que la UI no rompa (el resumen heurístico se genera igual).

$supabase_url = $_ENV['SUPABASE_URL'] ?? getenv('SUPABASE_URL') ?? null;
$supabase_key = $_ENV['SUPABASE_ANON_KEY'] ?? getenv('SUPABASE_ANON_KEY') ?? null;

$summary_data = null;
$tofu_data    = null;
$mofu_data    = null;
$bofu_data    = null;

if ($supabase_url && $supabase_key) {
    // Rango unificado anclado en HOY (APP_TZ) — mismo helper que el resto de
    // los endpoints. Garantiza que los 4 KPIs de Inicio matcheen con los
    // de las secciones (Performance / TOFU / MOFU / BOFU).
    [$g_start, $g_end] = global_period_dates($period);

    $headers = [
        'apikey: ' . $supabase_key,
        'Authorization: Bearer ' . $supabase_key,
        'Content-Type: application/json',
    ];

    $fetch = function (string $u) use ($headers) {
        $ch = curl_init($u);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 6,
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
        return is_string($raw) ? (json_decode($raw, true) ?: []) : [];
    };

    // Auditoría 2026-05-19 (Franco): inicio.php leía de `tofu_facts`/`mofu_facts`/
    // `bofu_facts` (tablas precomputadas por el script Python), mientras que el
    // resto de los endpoints lee de tablas RAW. Eso producía discrepancias entre
    // el KPI del Inicio y el de cada sección. Migrado a las mismas queries raw +
    // misma dedup que summary.php/bofu.php para garantizar coherencia exacta.

    // TOFU — sum impressions/clicks/spend de tofu_ads_daily en [start, end]
    $rows = $fetch($supabase_url . '/rest/v1/tofu_ads_daily'
        . '?select=impressions,clicks,spend'
        . '&client_slug=eq.prepagas'
        . '&date=gte.' . urlencode($g_start)
        . '&date=lte.' . urlencode($g_end)
        . '&limit=1000');
    if (is_array($rows)) {
        $impr  = array_sum(array_column($rows, 'impressions'));
        $clk   = array_sum(array_column($rows, 'clicks'));
        $spend = array_sum(array_column($rows, 'spend'));
        $tofu_data = [
            'impressions' => (int)$impr,
            'clicks'      => (int)$clk,
            'spend'       => (float)$spend,
            'cpc'         => $clk > 0 ? $spend / $clk : 0,
        ];
    }

    // MOFU — leads de campaña creados en [start, end]
    $rows = $fetch($supabase_url . '/rest/v1/leads'
        . '?select=meistertask_id,is_campaign_lead,lead_created_at'
        . '&client_slug=eq.prepagas'
        . '&is_campaign_lead=eq.true'
        . '&lead_created_at=gte.' . urlencode($g_start)
        . '&lead_created_at=lt.'  . urlencode(date('Y-m-d', strtotime($g_end . ' +1 day')))
        . '&limit=5000');
    if (is_array($rows)) {
        $total_leads = count($rows);
        $tofu_spend  = $tofu_data['spend'] ?? 0;
        $mofu_data = [
            'total_leads'   => $total_leads,
            'cost_per_lead' => ($total_leads > 0 && $tofu_spend > 0) ? $tofu_spend / $total_leads : 0,
        ];
    }

    // BOFU — ventas cerradas: lead_monetary is_closed=true, dedup por mid,
    // filtrar a campaña vía leads.is_campaign_lead, sumar precio_final
    // donde updated_at::date in [start, end]. Mismo criterio que summary.php.
    $lm_rows = $fetch($supabase_url . '/rest/v1/lead_monetary'
        . '?select=meistertask_id,precio_final,updated_at'
        . '&client_slug=eq.prepagas'
        . '&is_closed=eq.true'
        . '&limit=5000');
    $leads_rows = $fetch($supabase_url . '/rest/v1/leads'
        . '?select=meistertask_id,is_campaign_lead'
        . '&client_slug=eq.prepagas'
        . '&limit=5000');
    if (is_array($lm_rows) && is_array($leads_rows)) {
        // Dedup por meistertask_id: preferir precio_final > 0, desempate updated_at
        $closed_by_mid = [];
        foreach ($lm_rows as $row) {
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
        $is_campaign_by_id = [];
        foreach ($leads_rows as $l) {
            $is_campaign_by_id[$l['meistertask_id']] = !empty($l['is_campaign_lead']);
        }

        $count = 0; $revenue = 0.0;
        foreach ($closed_by_mid as $mid => $c) {
            $d = to_app_date($c['updated_at'] ?? null);
            if (!$d || $d < $g_start || $d > $g_end) continue;
            // Solo campaña — coherente con Performance (summary.php) que también
            // separa campaign de non_campaign para los KPIs principales.
            if (empty($is_campaign_by_id[$mid])) continue;
            $count++;
            $revenue += (float)($c['precio_final'] ?? 0);
        }

        $bofu_data = [
            'closed_sales'    => $count,
            'total_revenue'   => $revenue,
            'avg_ticket'      => $count > 0 ? $revenue / $count : 0,
            'conversion_rate' => isset($mofu_data) && $mofu_data['total_leads'] > 0
                ? ($count / $mofu_data['total_leads']) * 100
                : 0,
        ];
    }
}

// ── Fallback: placeholder con valores mock realistas ─────────────────────────
// Se usa cuando Supabase no está disponible o el período no tiene datos.

if (!$tofu_data) {
    $tofu_data = [
        'impressions' => 0,
        'clicks'      => 0,
        'spend'       => 0,
        'cpc'         => 0,
    ];
}
if (!$mofu_data) {
    $mofu_data = ['total_leads' => 0, 'cost_per_lead' => 0];
}
if (!$bofu_data) {
    $bofu_data = ['closed_sales' => 0, 'total_revenue' => 0, 'avg_ticket' => 0, 'conversion_rate' => 0];
}

$spend = $tofu_data['spend'] ?? 0;
// Unificación 2026-05-19: una sola métrica de rentabilidad en todo el portal,
// el ROAS (revenue/spend, formato Nx). Antes acá había un híbrido inconsistente
// (variable $roi pero valor en formato "Nx" que en realidad era ROAS).
$roas = ($spend > 0 && isset($bofu_data['total_revenue']))
    ? ($bofu_data['total_revenue'] / $spend)
    : 0;

// ── Section KPIs ─────────────────────────────────────────────────────────────

$section_kpis = [
    'performance' => [
        'label'     => 'ROAS',
        'value'     => $roas > 0 ? sprintf('%.2fx', $roas) : '—',
        'delta_pct' => 0,
    ],
    'tofu' => [
        'label'     => 'Impresiones',
        'value'     => _fmt_num($tofu_data['impressions']),
        'delta_pct' => 0,
    ],
    'mofu' => [
        'label'     => 'Leads',
        'value'     => _fmt_num($mofu_data['total_leads']),
        'delta_pct' => 0,
    ],
    'bofu' => [
        'label'     => 'Ingresos',
        'value'     => _fmt_ars($bofu_data['total_revenue']),
        'delta_pct' => 0,
    ],
];

// ── Resumen heurístico ────────────────────────────────────────────────────────
// ── Intentar leer del cache `ai_summaries` ───────────────────────────────────
// Decisión de Franco (2026-05-07): NO se usa Claude API. El resumen lo genera
// el script `scripts/run_inicio_summary.py` con reglas heurísticas y se guarda
// en la tabla `ai_summaries`. Acá leemos esa tabla. Si no hay row (porque el
// script todavía no se corrió o la tabla no existe), seguimos al fallback
// heurístico inline de abajo.

$cached_summary = null;
if ($supabase_url && $supabase_key) {
    $url = $supabase_url . '/rest/v1/ai_summaries'
        . '?client_slug=eq.prepagas'
        . '&period=eq.' . urlencode($period)
        . '&select=headline,highlights,recommendation,generated_at'
        . '&limit=1';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'apikey: ' . $supabase_key,
            'Authorization: Bearer ' . $supabase_key,
        ],
        CURLOPT_TIMEOUT => 4,
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    if (is_string($resp)) {
        $data = json_decode($resp, true);
        if (is_array($data) && !empty($data) && isset($data[0]['headline'])) {
            $cached_summary = $data[0];
        }
    }
}

if ($cached_summary !== null) {
    $headline       = (string)($cached_summary['headline'] ?? '');
    $highlights     = is_array($cached_summary['highlights'] ?? null)
                      ? $cached_summary['highlights'] : [];
    $recommendation = (string)($cached_summary['recommendation'] ?? '');

    _json_ok([
        'user_name'    => $user_name,
        'period_label' => $period_label,
        'ai_summary'   => [
            'headline'       => $headline,
            'highlights'     => $highlights,
            'recommendation' => $recommendation,
            'generated_at'   => $cached_summary['generated_at'] ?? null,
            'source'         => 'cache',
        ],
        'section_kpis' => $section_kpis,
    ]);
}

// ── Fallback: generar resumen heurístico on-the-fly ─────────────────────────
// Si la tabla ai_summaries no existe todavía o no tiene row para este período,
// generamos el resumen acá con las mismas heurísticas que el script Python.
// El cliente verá el resumen actualizado al instante; no hay degradación.

$impressions  = $tofu_data['impressions'];
$clicks       = $tofu_data['clicks'];
$cpc          = $tofu_data['cpc'];
$total_leads  = $mofu_data['total_leads'];
$cpl          = $mofu_data['cost_per_lead'];
$closed_sales = $bofu_data['closed_sales'];
$revenue      = $bofu_data['total_revenue'];
$avg_ticket   = $bofu_data['avg_ticket'];
$conv_rate    = $bofu_data['conversion_rate'] ?? 0;
$ctr          = $impressions > 0 ? ($clicks / $impressions) * 100 : 0;

// Headline: varía según el dato más relevante disponible
if ($revenue > 0 && $closed_sales > 0) {
    $headline = sprintf(
        'El período generó %s en ingresos con %d ventas cerradas, a un ticket promedio de %s.',
        _fmt_ars($revenue), $closed_sales, _fmt_ars($avg_ticket)
    );
} elseif ($total_leads > 0) {
    $headline = sprintf(
        'El período capturó %d leads de campaña con %s de inversión publicitaria.',
        $total_leads, _fmt_ars($spend)
    );
} elseif ($impressions > 0) {
    $headline = sprintf(
        'El período alcanzó %s impresiones con un CTR de %.2f%% en Google Ads.',
        _fmt_num($impressions), $ctr
    );
} else {
    $headline = 'Sin datos suficientes para este período. Verificá que el pipeline de extracción esté corriendo.';
}

// Highlights: hasta 4 observaciones basadas en los números
$highlights = [];

if ($impressions > 0) {
    $highlights[] = sprintf(
        '%s impresiones registradas — CTR de %.2f%% (industria aseguradora: 3–6%%).',
        _fmt_num($impressions), $ctr
    );
}

if ($total_leads > 0 && $cpl > 0) {
    $highlights[] = sprintf(
        '%d leads captados a un costo por lead de %s.',
        $total_leads, _fmt_ars($cpl)
    );
}

if ($closed_sales > 0 && $conv_rate > 0) {
    $highlights[] = sprintf(
        'Tasa de conversión de %.1f%% — %d ventas cerradas de %d leads.',
        $conv_rate, $closed_sales, $total_leads
    );
}

if ($roas > 1) {
    $highlights[] = sprintf(
        'ROAS positivo de %.2fx: cada peso invertido generó %.2f pesos en ingresos.',
        $roas, $roas
    );
} elseif ($revenue === 0 && $spend > 0) {
    $highlights[] = sprintf(
        'Inversión de %s activa en el período sin ingresos registrados aún.',
        _fmt_ars($spend)
    );
}

// Si no hay datos reales, dar highlights genéricos
if (empty($highlights)) {
    $highlights = [
        'Los datos del período se están procesando o el pipeline no ha corrido aún.',
        'Verificá el estado del extractor en GitHub Actions.',
    ];
}

// Recomendación: heurística basada en el cuello de botella más visible
if ($ctr < 2 && $impressions > 5000) {
    $recommendation = 'El CTR está por debajo del benchmark de la industria (3–6%). Revisá el copy de los anuncios y la relevancia de las palabras clave para mejorar la tasa de clicks.';
} elseif ($total_leads > 0 && $conv_rate < 5) {
    $recommendation = 'La tasa de conversión de leads a ventas está baja. El equipo comercial debería revisar la velocidad de contacto y la calidad de los leads que ingresan al CRM.';
} elseif ($total_leads === 0 && $impressions > 0) {
    $recommendation = 'Hay tráfico pero sin leads. Revisá el formulario de contacto y la landing page — puede haber un problema de UX que está impidiendo que los visitantes conviertan.';
} elseif ($roas > 3) {
    $recommendation = 'El ROAS está en terreno muy positivo (>3x). Este es el momento ideal para escalar presupuesto en las campañas con mejor CPC y mantener el mix de palabras clave ganador.';
} else {
    $recommendation = 'Revisá los datos del período anterior para identificar variaciones significativas. Un análisis semanal del CPL y la tasa de tipificación puede revelar oportunidades de optimización.';
}

// ── Respuesta ─────────────────────────────────────────────────────────────────

_json_ok([
    'user_name'    => $user_name,
    'period_label' => $period_label,
    'ai_summary'   => [
        'headline'       => $headline,
        'highlights'     => $highlights,
        'recommendation' => $recommendation,
        'generated_by'   => 'heuristic', // 'claude-api' cuando se conecte
    ],
    'section_kpis' => $section_kpis,
]);
