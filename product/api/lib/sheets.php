<?php
/**
 * api/lib/sheets.php
 * ------------------
 * Helper para leer Google Sheets via Service Account (sin Composer).
 * Implementa JWT RS256 puro con openssl — disponible en todos los PHP 7.4+.
 */

function _b64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Genera un access token de Google OAuth2 a partir de una Service Account.
 *
 * @param  array  $sa  Contenido del JSON de la SA (ya parseado)
 * @return string      Bearer token válido por 1 hora
 */
function google_access_token(array $sa): string {
    $now    = time();
    $header = _b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claims = _b64url(json_encode([
        'iss'   => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/spreadsheets.readonly',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now,
        'exp'   => $now + 3600,
    ]));

    $signing_input = "$header.$claims";
    $key = openssl_pkey_get_private($sa['private_key']);
    openssl_sign($signing_input, $sig, $key, OPENSSL_ALGO_SHA256);
    $jwt = $signing_input . '.' . _b64url($sig);

    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
        'timeout' => 10,
        'ignore_errors' => true,
    ]]);

    $raw = @file_get_contents('https://oauth2.googleapis.com/token', false, $ctx);
    $res = json_decode($raw, true);

    if (empty($res['access_token'])) {
        throw new RuntimeException('No access token: ' . $raw);
    }
    return $res['access_token'];
}

/**
 * Lee un rango de una Google Sheet y devuelve array de filas.
 *
 * @param  string $sheet_id     ID de la spreadsheet
 * @param  string $range        Ej: "tofu_raw!A1:Z100"
 * @param  string $token        Bearer token
 * @return array                Filas (array de arrays)
 */
function read_sheet(string $sheet_id, string $range, string $token): array {
    $url = 'https://sheets.googleapis.com/v4/spreadsheets/'
         . urlencode($sheet_id) . '/values/' . urlencode($range);

    $ctx = stream_context_create(['http' => [
        'header'        => "Authorization: Bearer $token\r\n",
        'timeout'       => 10,
        'ignore_errors' => true,
    ]]);

    $raw = @file_get_contents($url, false, $ctx);
    $res = json_decode($raw, true);
    return $res['values'] ?? [];
}

/**
 * Convierte filas de Sheet a array de mapas clave→valor
 * usando la primera fila como cabecera.
 *
 * @param  array $rows   Resultado de read_sheet (incluye cabecera)
 * @return array         [ ['date'=>'...', 'clicks'=>'...', ...], ... ]
 */
function rows_to_maps(array $rows): array {
    if (count($rows) < 2) return [];
    $headers = $rows[0];
    $result  = [];
    foreach (array_slice($rows, 1) as $row) {
        $map = [];
        foreach ($headers as $i => $h) {
            $map[$h] = $row[$i] ?? '';
        }
        $result[] = $map;
    }
    return $result;
}
