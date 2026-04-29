<?php
/**
 * supabase.php — Cliente REST minimal para Supabase.
 *
 * Hostinger shared hosting no permite Composer; este wrapper usa cURL nativo
 * y la PostgREST API que expone Supabase en /rest/v1/<table>.
 *
 * Credenciales: lee SUPABASE_URL y SUPABASE_SERVICE_KEY desde el entorno vía
 * el helper env() de product/api/config/env.php.
 *
 * Uso típico:
 *   require_once __DIR__ . '/supabase.php';
 *   $rows = supabase_query('tofu_ads_daily', [
 *       'client_slug' => 'eq.prepagas',
 *       'date'        => 'gte.2026-04-01',
 *       'order'       => 'date.asc',
 *       'limit'       => '100',
 *   ]);
 *
 * Operadores PostgREST soportados en filtros:
 *   eq, neq, gt, gte, lt, lte, like, ilike, in, is
 * Documentación: https://postgrest.org/en/stable/api.html#operators
 */

require_once __DIR__ . '/../config/env.php';

/**
 * Ejecuta un GET contra la API REST de Supabase y devuelve filas decodificadas.
 *
 * @param string $table   Nombre de la tabla (ej: 'tofu_ads_daily')
 * @param array  $params  Filtros y modificadores PostgREST (eq.<val>, order, limit, select, etc.)
 * @return array          Array de filas (cada fila es un array asociativo)
 * @throws RuntimeException si faltan credenciales o falla la request
 */
function supabase_query(string $table, array $params = []): array
{
    $url = env('SUPABASE_URL');
    $key = env('SUPABASE_SERVICE_KEY');

    if (!$url || !$key) {
        throw new RuntimeException(
            'SUPABASE_URL o SUPABASE_SERVICE_KEY no están definidas en el entorno.'
        );
    }

    $query    = http_build_query($params);
    $endpoint = rtrim($url, '/') . '/rest/v1/' . rawurlencode($table)
              . ($query !== '' ? '?' . $query : '');

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'apikey: ' . $key,
            'Authorization: Bearer ' . $key,
            'Accept: application/json',
        ],
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);

    $response  = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err       = curl_error($ch);
    // PHP 8.0+ libera el handle automáticamente al salir de scope; curl_close()
    // está deprecado en 8.5+ y es no-op desde 8.0.

    if ($err !== '') {
        throw new RuntimeException("Supabase REST cURL error: $err");
    }
    if ($http_code >= 400) {
        throw new RuntimeException("Supabase REST HTTP $http_code: $response");
    }

    $data = json_decode($response, true);
    if (!is_array($data)) {
        throw new RuntimeException("Supabase REST devolvió respuesta no-array: $response");
    }

    return $data;
}
