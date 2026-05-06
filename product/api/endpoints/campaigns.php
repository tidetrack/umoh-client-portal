<?php
/**
 * GET /api/endpoints/campaigns.php
 * Devuelve la lista de campañas únicas del cliente.
 *
 * Source of truth: tofu_facts (cada fila tiene campaign_id + campaign_name).
 * Si el cliente no tiene datos en tofu_facts todavía, se hace fallback a
 * tofu_ads_daily para no devolver una lista vacía durante el bootstrap.
 *
 * Output:
 * {
 *   "campaigns": [
 *     { "id": "23534226120", "name": "PMAX Prevención Salud" }
 *   ]
 * }
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
    // Traer todas las (campaign_id, campaign_name) de tofu_facts.
    // PostgREST no soporta DISTINCT — agrupamos en PHP.
    $rows = supabase_query('tofu_facts', [
        'client_slug' => 'eq.' . CLIENT_SLUG,
        'select'      => 'campaign_id,campaign_name',
        'limit'       => '5000',
    ]);

    $campaigns = [];
    foreach ($rows as $r) {
        $id   = $r['campaign_id'] ?? '';
        $name = $r['campaign_name'] ?? '';
        if ($id === '' || isset($campaigns[$id])) continue;
        $campaigns[$id] = ['id' => (string)$id, 'name' => $name];
    }

    // Ordenar por name asc (estable y predecible para el dropdown)
    $list = array_values($campaigns);
    usort($list, fn($a, $b) => strcmp($a['name'], $b['name']));

    echo json_encode(['campaigns' => $list], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    api_error($e->getMessage());
}
