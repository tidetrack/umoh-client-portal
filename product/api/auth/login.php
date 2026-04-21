<?php
/**
 * login.php — Autenticación de clientes.
 * POST /api/auth/login  { "slug": "prepagas", "password": "..." }
 * → 200 { "token": "...", "client": { "slug", "name" } }
 * → 401 { "error": "Credenciales inválidas" }
 *
 * Fase 1: endpoint stub — devuelve error hasta que se configure MySQL.
 */

require_once __DIR__ . '/../config/env.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$slug     = trim($body['slug']     ?? '');
$password = trim($body['password'] ?? '');

if ($slug === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'slug y password son requeridos']);
    exit;
}

// TODO Fase 4: validar contra MySQL
// $pdo  = Database::connect();
// $stmt = $pdo->prepare('SELECT id, slug, name, password_hash FROM clients WHERE slug = ? LIMIT 1');
// $stmt->execute([$slug]);
// $client = $stmt->fetch();
// if (!$client || !password_verify($password, $client['password_hash'])) { ... }

http_response_code(503);
echo json_encode(['error' => 'Autenticación no implementada en Fase 1. Dashboard en modo mock.']);
