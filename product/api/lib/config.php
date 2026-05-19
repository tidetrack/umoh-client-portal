<?php
/**
 * api/lib/config.php
 * Configuración compartida + helpers de fecha/trend para todos los endpoints.
 */

define('SA_KEY_PATH', __DIR__ . '/../config/sa.json');
define('SHEET_ID',    '12iVYwOtU969NVZ1v6kP32GBbv-AUOkqV25KhN1tDAew');

define('COLORS', [
    'navy'   => '#253040',
    'slate'  => '#5A7080',
    'silver' => '#8FA5A8',
    'mist'   => '#C8D8DC',
    'light'  => '#E8EDF2',
    'accent' => '#FF0040',
]);

// Meses en español (sin depender de locale/strftime)
define('ES_MONTHS', [
    1=>'Ene',2=>'Feb',3=>'Mar',4=>'Abr',5=>'May',6=>'Jun',
    7=>'Jul',8=>'Ago',9=>'Sep',10=>'Oct',11=>'Nov',12=>'Dic',
]);

function get_token(): string {
    if (!file_exists(SA_KEY_PATH)) {
        throw new RuntimeException('SA key not found at ' . SA_KEY_PATH);
    }
    $sa = json_decode(file_get_contents(SA_KEY_PATH), true);
    return google_access_token($sa);
}

function api_error(string $msg, int $code = 500): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function api_headers(): void {
    $allowed = [
        'https://prepagas.umohcrew.com',
        'https://prepagas.umohcrew.com/staging',
    ];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
}

// Zona horaria de referencia para todos los rangos temporales del portal.
// Single source of truth — si en el futuro hay clientes en otras zonas, esto
// se moverá a config por cliente. Hoy: Prepagas (Mendoza).
const APP_TZ = 'America/Argentina/Mendoza';

/**
 * Devuelve la fecha de "hoy" en zona horaria de la app (YYYY-MM-DD).
 * NO uses date('Y-m-d') directo — Hostinger corre en UTC y eso provoca
 * off-by-one en la madrugada argentina.
 */
function app_today(): string {
    static $cached = null;
    if ($cached !== null) return $cached;
    $cached = (new DateTime('now', new DateTimeZone(APP_TZ)))->format('Y-m-d');
    return $cached;
}

/**
 * ÚNICA fuente de verdad del rango temporal del portal.
 *
 * Resuelve [start, end] (YYYY-MM-DD) anclando "now" en HOY (APP_TZ), no en
 * el último día con datos. Esto garantiza que TODOS los endpoints
 * (inicio/tofu/mofu/bofu/summary) computen la misma ventana en cada request
 * sin tener que coordinarse entre sí.
 *
 * Semántica:
 *   '7d'         → 7 días inclusivos terminando hoy (today-6 → today).
 *   '30d'        → 30 días inclusivos terminando hoy (today-29 → today).
 *   '90d'        → 90 días inclusivos terminando hoy (today-89 → today).
 *   'custom'     → lee $_GET['start'] y $_GET['end'] (validados).
 *   'historical' → desde $fallback_first (o 2020-01-01) hasta hoy.
 *
 * Decisión Franco 2026-05-19 (auditoría de período): anclar en HOY y no en
 * "último dato disponible" porque (1) match al modelo mental del usuario,
 * (2) hace que el rango no se encoja cuando un endpoint tiene menos datos
 * que otro, (3) elimina la necesidad de cada endpoint de mergear sus dates
 * con los de las otras tablas para calcular un anchor común.
 */
function global_period_dates(string $period, ?string $fallback_first = null): array {
    $today = app_today();

    if ($period === 'custom') {
        $start = $_GET['start'] ?? null;
        $end   = $_GET['end']   ?? null;
        $valid = fn($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d);
        if (!$valid($start) || !$valid($end)) {
            // Fallback a 30d si los params son inválidos
            $start = date('Y-m-d', strtotime($today . ' -29 days'));
            $end   = $today;
        } elseif ($start > $end) {
            [$start, $end] = [$end, $start];
        }
        return [$start, $end];
    }

    if ($period === 'historical') {
        return [$fallback_first ?? '2020-01-01', $today];
    }

    $days_back = ['7d' => 6, '30d' => 29, '90d' => 89];
    $days      = $days_back[$period] ?? 29;
    $end       = $today;
    $start     = date('Y-m-d', strtotime($end . ' -' . $days . ' days'));
    return [$start, $end];
}

/**
 * @deprecated 2026-05-19 — usar global_period_dates() en su lugar.
 *
 * Wrapper de compatibilidad: ignora $last_date/$first_date (eran fuente de
 * inconsistencia entre endpoints) y delega al helper unificado. Se mantiene
 * para no romper llamadas mientras se completa la migración.
 */
function period_dates(string $period, string $last_date = '', ?string $first_date = null): array {
    return global_period_dates($period, $first_date);
}

/**
 * Filtra un array indexado por fecha al rango [start, end].
 */
function filter_range(array $by_date, string $start, string $end): array {
    return array_filter(
        $by_date,
        fn($d) => $d >= $start && $d <= $end,
        ARRAY_FILTER_USE_KEY
    );
}

/**
 * Construye arrays de tendencia agrupando por día, semana o mes según cantidad
 * de puntos en el rango. Devuelve ['labels' => [...], ...campos].
 *
 * $fields = ['campo_salida' => fn($row) => valor_numerico, ...]
 *
 * La granularidad se determina en este orden de prioridad:
 *   1. Si se pasa $_GET['granularity'] = 'dias'|'semanas'|'meses' → respeta esa elección
 *   2. 7d / 30d / 90d → siempre día
 *   3. custom/historical → por cantidad de puntos (auto)
 */
function build_trend(array $filtered, string $period, array $fields): array {
    $n      = count($filtered);
    $es     = ES_MONTHS;
    $result = ['labels' => []];
    foreach ($fields as $k => $_) $result[$k] = [];

    if ($n === 0) return $result;

    // Granularity explícita del usuario (pasa desde el historic-section o custom range)
    $user_gran = $_GET['granularity'] ?? '';
    $gran_map  = ['dias' => 'day', 'semanas' => 'week', 'meses' => 'month'];

    if ($user_gran !== '' && isset($gran_map[$user_gran])) {
        $mode = $gran_map[$user_gran];
    } elseif (in_array($period, ['7d', '30d', '90d'], true)) {
        $mode = 'day';
    } elseif ($n <= 14) {
        $mode = 'day';
    } elseif ($n > 45) {
        $mode = 'month';
    } else {
        $mode = 'week';
    }

    $labels    = [];
    $buckets   = [];
    $week_num  = [];

    foreach ($filtered as $date => $row) {
        $d = new DateTime($date);

        switch ($mode) {
            case 'day':
                $key = $date;
                if (!isset($labels[$key])) {
                    $labels[$key] = $d->format('d') . '/' . $d->format('m');
                }
                break;
            case 'week':
                $key = $d->format('o') . '-W' . $d->format('W');
                if (!isset($labels[$key])) {
                    $labels[$key] = 'Sem ' . (count($labels) + 1);
                }
                break;
            case 'month':
                $key = $d->format('Y-m');
                if (!isset($labels[$key])) {
                    $labels[$key] = $es[(int)$d->format('n')] . ' ' . $d->format('Y');
                }
                break;
        }

        foreach ($fields as $fk => $fn) {
            $buckets[$key][$fk] = ($buckets[$key][$fk] ?? 0.0) + (float)$fn($row);
        }
    }

    foreach ($labels as $key => $label) {
        $result['labels'][] = $label;
        foreach ($fields as $fk => $_) {
            $result[$fk][] = round($buckets[$key][$fk] ?? 0, 2);
        }
    }

    // Mínimo 2 puntos para que Chart.js renderice
    if (count($result['labels']) === 1) {
        $result['labels'][] = $result['labels'][0];
        foreach ($fields as $fk => $_) {
            $result[$fk][] = $result[$fk][0];
        }
    }

    return $result;
}
