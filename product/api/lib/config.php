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

/**
 * Calcula las fechas de inicio y fin para un período dado.
 * $last_date = última fecha disponible en los datos.
 * Devuelve [start, end] como strings YYYY-MM-DD.
 */
function period_dates(string $period, string $last_date): array {
    $days_back = ['7d' => 6, '30d' => 29, '90d' => 89];
    $days      = $days_back[$period] ?? 29;
    $end       = $last_date;
    $start     = date('Y-m-d', strtotime($end . ' -' . $days . ' days'));
    return [$start, $end];
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
 */
function build_trend(array $filtered, string $period, array $fields): array {
    $n      = count($filtered);
    $es     = ES_MONTHS;
    $result = ['labels' => []];
    foreach ($fields as $k => $_) $result[$k] = [];

    if ($n === 0) return $result;

    // Elegir granularidad
    if ($n <= 14) {
        $mode = 'day';
    } elseif ($period === '90d' || $n > 45) {
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
