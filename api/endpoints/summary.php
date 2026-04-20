<?php
/**
 * summary.php — GET /api/endpoints/summary.php?period=30d
 * Retorna KPIs de Performance para el período dado.
 * Fase 1: responde con datos mock estructurados.
 */

require_once __DIR__ . '/../config/env.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$period = $_GET['period'] ?? '30d';
$allowed = ['7d', '30d', '90d'];
if (!in_array($period, $allowed, true)) {
    http_response_code(400);
    echo json_encode(['error' => "Período inválido. Opciones: " . implode(', ', $allowed)]);
    exit;
}

// TODO Fase 2: reemplazar con consulta real a Google Ads API
// $connector = new GoogleAdsConnector($clientConfig['google_customer_id']);
// $data = $connector->getSummary($startDate, $endDate);

echo json_encode(['mock' => true, 'period' => $period, 'message' => 'Implementar en Fase 2']);
