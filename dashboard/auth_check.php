<?php
/**
 * UMOH — Verificación de sesión (endpoint AJAX)
 *
 * FASE 1: Auth bypass — siempre autenticado hasta Fase 4.
 * Para activar auth real, cambiar PHASE1_BYPASS a false.
 */

define('PHASE1_BYPASS', true);

header('Content-Type: application/json');
header('Cache-Control: no-store');

if (PHASE1_BYPASS) {
    echo json_encode(['authenticated' => true, 'user' => 'admin', 'name' => 'Admin', 'role' => 'admin']);
    exit;
}

ini_set('session.cookie_domain', '.umohcrew.com');
session_set_cookie_params([
    'lifetime' => 86400 * 30,
    'path'     => '/',
    'domain'   => '.umohcrew.com',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

if (!empty($_SESSION['umoh_user'])) {
    echo json_encode([
        'authenticated' => true,
        'user'          => $_SESSION['umoh_user'],
        'name'          => $_SESSION['umoh_name'] ?? '',
        'role'          => $_SESSION['umoh_role'] ?? 'client',
    ]);
} else {
    http_response_code(401);
    echo json_encode(['authenticated' => false]);
}
