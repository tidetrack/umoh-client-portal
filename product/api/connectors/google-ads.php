<?php
/**
 * google-ads.php — Conector con Google Ads API (PMAX campaigns).
 *
 * Fase 2: implementar OAuth2 + REST calls a la Google Ads API v17+.
 * Documentación: https://developers.google.com/google-ads/api/docs/start
 *
 * Estructura esperada del JSON de retorno (TOFU):
 * {
 *   "impressions": int,
 *   "clicks":      int,
 *   "cpc":         float,
 *   "search_terms": [ { "term": string, "clicks": int, "pct": float } ],
 *   "channels":    { "labels": [], "data": [], "colors": [] },
 *   "devices":     { "labels": [], "data": [], "colors": [] },
 *   "geo":         { "DepartamentoNombre": clicks }
 * }
 */

require_once __DIR__ . '/../config/env.php';

class GoogleAdsConnector
{
    private string $clientId;
    private string $clientSecret;
    private string $refreshToken;
    private string $developerToken;
    private string $customerId;
    private string $accessToken = '';

    public function __construct(string $customerId)
    {
        $this->clientId       = env('GOOGLE_ADS_CLIENT_ID', '');
        $this->clientSecret   = env('GOOGLE_ADS_CLIENT_SECRET', '');
        $this->refreshToken   = env('GOOGLE_ADS_REFRESH_TOKEN', '');
        $this->developerToken = env('GOOGLE_ADS_DEVELOPER_TOKEN', '');
        $this->customerId     = $customerId;
    }

    /**
     * Obtener métricas TOFU para un rango de fechas.
     * @param string $startDate  'YYYY-MM-DD'
     * @param string $endDate    'YYYY-MM-DD'
     */
    public function getTofuMetrics(string $startDate, string $endDate): array
    {
        // TODO Fase 2: implementar
        // 1. refreshAccessToken()
        // 2. querySearchTermReport()
        // 3. queryChannelReport()
        // 4. queryDeviceReport()
        // 5. queryGeoReport() — filtrar por provincia Mendoza
        throw new RuntimeException('Google Ads connector no implementado. Usar mock data.');
    }

    private function refreshAccessToken(): void
    {
        // POST https://oauth2.googleapis.com/token
        // grant_type=refresh_token
    }

    private function gaqlQuery(string $query): array
    {
        // POST https://googleads.googleapis.com/v17/customers/{customerId}/googleAds:searchStream
        // Headers: Authorization: Bearer {accessToken}, developer-token, login-customer-id
        return [];
    }
}
