<?php
/**
 * env.php — Loader de variables de entorno sin Composer/dotenv.
 * Compatible con Hostinger Shared Hosting (PHP 8.3).
 *
 * Busca el archivo .env en la raíz del proyecto subiendo desde este archivo.
 */

function loadEnv(): void
{
    $dir  = dirname(__DIR__, 2); // raíz del proyecto
    $file = $dir . '/.env';

    if (!file_exists($file)) {
        return; // en producción las vars se setean directo en el servidor
    }

    $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        $line = trim($line);

        // Ignorar comentarios y líneas vacías
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        if (!str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key   = trim($key);
        $value = trim($value);

        // Quitar comillas opcionales
        if (
            strlen($value) >= 2 &&
            (($value[0] === '"' && $value[-1] === '"') ||
             ($value[0] === "'" && $value[-1] === "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

function env(string $key, mixed $default = null): mixed
{
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

loadEnv();
