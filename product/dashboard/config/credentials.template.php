<?php
const UMOH_USERS = [
    'admin' => [
        'password_hash' => 'ADMIN_HASH_PLACEHOLDER',
        'role'          => 'admin',
        'clients'       => ['prepagas'],
        'name'          => 'Admin UMOH',
    ],
    'prepagas' => [
        'password_hash' => 'PREPAGAS_HASH_PLACEHOLDER',
        'role'          => 'client',
        'clients'       => ['prepagas'],
        'name'          => 'Prevención Salud',
    ],
];
