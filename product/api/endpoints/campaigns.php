<?php
/**
 * GET /api/endpoints/campaigns.php
 * Devuelve la lista de campañas únicas del cliente con su(s) plataforma(s).
 *
 * Source of truth: tofu_facts (cada fila tiene campaign_id + campaign_name + platform).
 *
 * Output:
 * {
 *   "campaigns": [
 *     { "id": "23534226120", "name": "PMAX Prevención Salud", "platforms": ["google_ads"] }
 *   ]
 * }
 *
 * Si la misma campaign_id aparece en múltiples plataformas (caso inusual),
 * "platforms" tiene más de un elemento. En el caso típico es array de 1.
 */

require_once __DIR__ . '/../lib/supabase.php';
require_once __DIR__ . '/../lib/config.php';

api_headers();

// Auth gate (mismo patrón que los otros endpoints)
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
    // Traer todas las (campaign_id, campaign_name, platform) de tofu_facts.
    // PostgREST no soporta DISTINCT — agrupamos en PHP.
    // Pedimos platform para poder construir el array de plataformas por campaña.
    $rows = supabase_query('tofu_facts', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'campaign_id,campaign_name,platform',
        'limit'       => '5000',
    ]);

    // Indexamos por campaign_id. Cada entrada acumula las plataformas distintas
    // que tienen filas para esa campaña (en la práctica casi siempre es 1).
    $campaigns = [];
    foreach ($rows as $r) {
        $id       = (string)($r['campaign_id'] ?? '');
        $name     = $r['campaign_name'] ?? '';
        $platform = $r['platform'] ?? '';
        if ($id === '') continue;

        if (!isset($campaigns[$id])) {
            $campaigns[$id] = ['id' => $id, 'name' => $name, 'platforms' => []];
        }
        // Acumular plataformas sin duplicados
        if ($platform !== '' && !in_array($platform, $campaigns[$id]['platforms'], true)) {
            $campaigns[$id]['platforms'][] = $platform;
        }
    }

    // Ordenar por name asc (estable y predecible para el dropdown)
    $list = array_values($campaigns);
    usort($list, fn($a, $b) => strcmp($a['name'], $b['name']));

    echo json_encode(['campaigns' => $list], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
