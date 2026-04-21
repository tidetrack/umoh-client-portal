<?php
/**
 * UMOH — Credenciales de acceso al portal
 *
 * ESTE ARCHIVO ESTÁ EN .gitignore — NO COMMITEAR.
 * Subir manualmente via FTP a /prepagas/config/credentials.php
 *
 * Para generar un hash nuevo:
 *   php -r "echo password_hash('TuPasswordAqui', PASSWORD_BCRYPT);"
 */

define('UMOH_USERS', [

    // Acceso administrador UMOH — ve todos los clientes
    'umoh_admin' => [
        'name'          => 'UMOH Agency',
        'password_hash' => '$2b$10$i2mKhK5BlLakcFl8.d5ncuccwff6GXkbpJn0QZho2W0rEuwivoDKK',
        'role'          => 'admin',
        'clients'       => ['*'],   // wildcard = acceso a todos
    ],

    // Acceso cliente: Prevención Salud Mendoza
    'prevencion_salud' => [
        'name'          => 'Prevención Salud',
        'password_hash' => '$2b$10$i2mKhK5BlLakcFl8.d5ncuccwff6GXkbpJn0QZho2W0rEuwivoDKK',
        'role'          => 'client',
        'clients'       => ['prepagas'],
    ],

]);
