<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$_host = $_SERVER['HTTP_HOST'] ?? '';
$_is_local = ($_host === 'localhost' || $_host === '127.0.0.1' || str_starts_with($_host, 'localhost:') || str_starts_with($_host, '127.0.0.1:'));
if ($_is_local) {
    session_set_cookie_params(['lifetime' => 86400 * 30, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
} else {
    ini_set('session.cookie_domain', '.umohcrew.com');
    session_set_cookie_params(['lifetime' => 86400 * 30, 'path' => '/', 'domain' => '.umohcrew.com', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
}
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
