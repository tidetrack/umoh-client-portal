<?php
/**
 * database.php — PDO connection factory.
 * Usar: $pdo = Database::connect();
 */

require_once __DIR__ . '/env.php';

class Database
{
    private static ?PDO $instance = null;

    public static function connect(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $host    = env('DB_HOST', 'localhost');
        $name    = env('DB_NAME', '');
        $user    = env('DB_USER', '');
        $pass    = env('DB_PASS', '');
        $charset = env('DB_CHARSET', 'utf8mb4');

        $dsn = "mysql:host={$host};dbname={$name};charset={$charset}";

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        self::$instance = new PDO($dsn, $user, $pass, $options);
        return self::$instance;
    }
}
