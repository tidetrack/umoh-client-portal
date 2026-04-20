<?php
/**
 * meta.php — Conector con Meta Marketing API.
 *
 * Fase 3: implementar llamadas a Graph API v19.
 * Documentación: https://developers.facebook.com/docs/marketing-api/
 *
 * Estructura esperada del JSON de retorno:
 * {
 *   "spend":       float,
 *   "impressions": int,
 *   "reach":       int,
 *   "clicks":      int,
 *   "leads":       int,
 *   "cpl":         float
 * }
 */

require_once __DIR__ . '/../config/env.php';

class MetaConnector
{
    private string $appId;
    private string $appSecret;
    private string $accessToken;
    private string $apiVersion;
    private string $accountId;

    private const BASE_URL = 'https://graph.facebook.com';

    public function __construct(string $accountId)
    {
        $this->appId       = env('META_APP_ID', '');
        $this->appSecret   = env('META_APP_SECRET', '');
        $this->accessToken = env('META_ACCESS_TOKEN', '');
        $this->apiVersion  = env('META_API_VERSION', 'v19.0');
        $this->accountId   = $accountId;
    }

    /**
     * Obtener insights de campañas para un rango de fechas.
     * @param string $startDate  'YYYY-MM-DD'
     * @param string $endDate    'YYYY-MM-DD'
     */
    public function getCampaignInsights(string $startDate, string $endDate): array
    {
        // TODO Fase 3: implementar
        // GET /{apiVersion}/act_{accountId}/insights
        // ?fields=spend,impressions,reach,clicks,actions
        // &time_range={"since":"...","until":"..."}
        // &level=campaign
        throw new RuntimeException('Meta connector no implementado. Usar mock data.');
    }

    private function get(string $endpoint, array $params = []): array
    {
        $params['access_token'] = $this->accessToken;
        $url = self::BASE_URL . '/' . $this->apiVersion . $endpoint . '?' . http_build_query($params);

        $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => 15]]);
        $raw = file_get_contents($url, false, $ctx);

        if ($raw === false) {
            throw new RuntimeException('Meta API request failed');
        }

        return json_decode($raw, true);
    }
}
