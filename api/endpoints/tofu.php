<?php
/**
 * tofu.php — GET /api/endpoints/tofu.php?period=30d
 * Retorna métricas TOFU (Awareness): impresiones, clicks, CPC,
 * términos de búsqueda, canales, dispositivos, geo.
 * Fase 1: responde con datos mock.
 */

require_once __DIR__ . '/../config/env.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$period  = $_GET['period'] ?? '30d';
$allowed = ['7d', '30d', '90d'];
if (!in_array($period, $allowed, true)) {
    http_response_code(400);
    echo json_encode(['error' => "Período inválido. Opciones: " . implode(', ', $allowed)]);
    exit;
}

// TODO Fase 2: reemplazar con GoogleAdsConnector::getTofuMetrics()

echo json_encode(['mock' => true, 'period' => $period, 'message' => 'Implementar en Fase 2']);
