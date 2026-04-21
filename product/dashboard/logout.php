<?php
/**
 * UMOH — Cierre de sesión
 *
 * Destruye la sesión y redirige al login.
 */

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
session_unset();
session_destroy();

// Borrar la cookie de sesión del navegador
setcookie(session_name(), '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'domain'   => '.umohcrew.com',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);

header('Location: login.php');
exit;
