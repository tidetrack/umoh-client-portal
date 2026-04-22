<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

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
