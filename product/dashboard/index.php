<?php
$_host = $_SERVER['HTTP_HOST'] ?? '';
$_is_local = ($_host === 'localhost' || $_host === '127.0.0.1' || str_starts_with($_host, 'localhost:') || str_starts_with($_host, '127.0.0.1:'));
if ($_is_local) {
    session_set_cookie_params(['lifetime' => 86400 * 30, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
} else {
    ini_set('session.cookie_domain', '.umohcrew.com');
    session_set_cookie_params(['lifetime' => 86400 * 30, 'path' => '/', 'domain' => '.umohcrew.com', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
}
session_start();
if (empty($_SESSION['umoh_user'])) {
    header('Location: login.php');
    exit;
}
// Cache-busting: inyectado por GitHub Actions en cada deploy via inject_credentials.py
// Fallback: timestamp del archivo CSS para entornos locales sin inyección
$_asset_v = defined('ASSET_VERSION') ? ASSET_VERSION : filemtime(__DIR__ . '/assets/css/umoh.css');
?>
<!DOCTYPE html>
<html lang="es" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Prevención Salud | UMOH</title>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">

  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" crossorigin="">

  <!-- Dashboard CSS -->
  <link rel="stylesheet" href="assets/css/umoh.css?v=<?php echo $_asset_v; ?>">

  <!-- Theme: apply saved preference synchronously to avoid flash -->
  <script>
    (function () {
      var t = localStorage.getItem('umoh-theme') || 'light';
      document.documentElement.setAttribute('data-theme', t);
    }());
  </script>

  <!-- Session data injected for JS -->
  <script>
    window.DASHBOARD_USERNAME = <?php echo json_encode($_SESSION['umoh_name'] ?? 'Usuario'); ?>;
    window.DASHBOARD_ROLE     = <?php echo json_encode($_SESSION['umoh_role'] ?? 'client'); ?>;
  </script>
</head>
<body>

  <!-- ══════════════════════════════════════════════
       DASHBOARD WRAPPER
  ══════════════════════════════════════════════ -->
  <div id="dashboard-wrapper" class="dashboard-wrapper">

  <!-- ══════════════════════════════════════════════
       HEADER
  ══════════════════════════════════════════════ -->
  <header class="site-header">
    <div class="header-inner">

      <!-- Brand -->
      <div class="header-brand">
        <div class="brand-mark" aria-hidden="true">
          <img src="assets/img/asterisco.png" alt="" width="22" height="22">
        </div>
        <div class="brand-info">
          <span class="brand-agency">umoh</span>
          <span class="brand-client">Prevención Salud</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="header-controls">

        <!-- Period selector + date picker -->
        <div class="period-selector-wrap">
          <div class="period-selector" role="group" aria-label="Selector de período">
            <button class="period-btn" data-period="7d">7 días</button>
            <button class="period-btn active" data-period="30d">30 días</button>
            <button class="period-btn" data-period="90d">90 días</button>
            <button class="period-btn" data-period="custom">Personalizado</button>
          </div>
          <div id="date-picker-popover" class="date-picker-popover" hidden aria-hidden="true">
            <div class="date-picker-inner">
              <div id="historic-section" class="historic-section">
                <span class="historic-label">Histórico total</span>
                <div class="historic-granularity" role="group" aria-label="Granularidad del histórico">
                  <button class="historic-btn" data-granularity="dias">Días</button>
                  <button class="historic-btn" data-granularity="semanas">Semanas</button>
                  <button class="historic-btn active" data-granularity="meses">Meses</button>
                </div>
              </div>
              <div class="date-picker-divider"></div>
              <div class="date-picker-row">
                <label class="date-picker-label" for="date-start">Desde</label>
                <input type="date" id="date-start" class="date-picker-input">
              </div>
              <div class="date-picker-row">
                <label class="date-picker-label" for="date-end">Hasta</label>
                <input type="date" id="date-end" class="date-picker-input">
              </div>
              <button id="date-apply-btn" class="date-apply-btn">Aplicar</button>
            </div>
          </div>
        </div>

        <!-- User menu -->
        <div class="user-menu" id="user-menu">
          <button class="user-menu-trigger" aria-haspopup="true" aria-expanded="false">
            <div class="user-avatar" id="user-avatar"><img src="assets/img/icon-asterisco-1.png" alt=""></div>
            <span class="user-greeting">Hola, <strong id="user-display-name">Usuario</strong></span>
            <svg class="user-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="user-menu-dropdown" role="menu">
            <div class="user-menu-header">
              <div class="user-menu-avatar-lg" id="user-avatar-lg"><img src="assets/img/icon-asterisco-1.png" alt=""></div>
              <div>
                <div class="user-menu-fullname" id="user-menu-fullname">Usuario</div>
                <div class="user-menu-role">Administrador</div>
              </div>
            </div>
            <div class="user-menu-divider"></div>
            <a href="logout.php" class="user-menu-item user-menu-item--danger" role="menuitem">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Cerrar sesión
            </a>
          </div>
        </div>

      </div>
    </div>
  </header>

  <!-- ══════════════════════════════════════════════
       NAVIGATION
  ══════════════════════════════════════════════ -->
  <nav class="dashboard-nav" role="navigation" aria-label="Secciones del dashboard">
    <div class="nav-inner">
      <button class="nav-tab active" data-section="performance">Performance</button>
      <button class="nav-tab" data-section="tofu">Awareness / TOFU</button>
      <button class="nav-tab" data-section="mofu">Interest / MOFU</button>
      <button class="nav-tab" data-section="bofu">Sales / BOFU</button>
    </div>
  </nav>

  <!-- ══════════════════════════════════════════════
       MAIN
  ══════════════════════════════════════════════ -->
  <main class="dashboard-main">

    <!-- ────────────────────────────────────────
         PERFORMANCE
    ──────────────────────────────────────────── -->
    <section id="section-performance" class="dashboard-section active" aria-label="Performance">

      <div class="section-header">
        <h2 class="section-title">Performance</h2>
        <p class="section-subtitle">Resumen general de inversión y resultados del período seleccionado</p>
      </div>

      <div class="kpi-grid kpi-grid--3">
        <div class="kpi-card" data-kpi="revenue">
          <span class="kpi-label">Ingreso por Ventas</span>
          <span class="kpi-value" id="kpi-revenue">—</span>
          <span class="kpi-delta" id="delta-revenue"></span>
          <canvas class="kpi-sparkline" id="sparkline-revenue" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="spend">
          <span class="kpi-label">Costo Publicitario</span>
          <span class="kpi-value" id="kpi-spend">—</span>
          <span class="kpi-delta" id="delta-spend"></span>
          <canvas class="kpi-sparkline" id="sparkline-spend" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="roi">
          <span class="kpi-label">ROI</span>
          <span class="kpi-value" id="kpi-roi">—</span>
          <span class="kpi-delta" id="delta-roi"></span>
          <canvas class="kpi-sparkline" id="sparkline-roi" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="impressions">
          <span class="kpi-label">Total Impresiones</span>
          <span class="kpi-value" id="kpi-impressions">—</span>
          <span class="kpi-delta" id="delta-impressions"></span>
          <canvas class="kpi-sparkline" id="sparkline-impressions" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="leads">
          <span class="kpi-label">Total Leads</span>
          <span class="kpi-value" id="kpi-leads">—</span>
          <span class="kpi-delta" id="delta-leads"></span>
          <canvas class="kpi-sparkline" id="sparkline-leads" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="sales">
          <span class="kpi-label">Ventas Cerradas</span>
          <span class="kpi-value" id="kpi-sales">—</span>
          <span class="kpi-delta" id="delta-sales"></span>
          <canvas class="kpi-sparkline" id="sparkline-sales" aria-hidden="true"></canvas>
        </div>
      </div>

      <!-- Resumen comercial del equipo -->
      <div class="charts-grid charts-grid--full">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Resumen Comercial del Equipo</h3>
            <span class="chart-badge">indicadores generales de vendedores</span>
          </div>
          <div class="chart-card-body" style="padding: var(--sp-5) var(--sp-6);">
            <div class="commercial-summary" id="commercial-summary">
              <!-- populated by charts.js -->
            </div>
          </div>
        </div>
      </div>

      <div class="charts-grid charts-grid--2col">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Evolución de Ingresos</h3>
            <span class="chart-badge">tendencia del período</span>
          </div>
          <div class="chart-card-body chart-body--tall">
            <canvas id="chart-perf-revenue"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Evolución de Inversión</h3>
            <span class="chart-badge">tendencia del período</span>
          </div>
          <div class="chart-card-body chart-body--tall">
            <canvas id="chart-perf-spend"></canvas>
          </div>
        </div>
      </div>

    </section>

    <!-- ────────────────────────────────────────
         TOFU — AWARENESS
    ──────────────────────────────────────────── -->
    <section id="section-tofu" class="dashboard-section" aria-label="Awareness TOFU">

      <div class="section-header">
        <h2 class="section-title">Awareness / TOFU</h2>
        <p class="section-subtitle">Impacto inicial y alcance de la marca en Google</p>
      </div>

      <div class="kpi-grid kpi-grid--3">
        <div class="kpi-card" data-kpi="tofu-impressions">
          <span class="kpi-label">Impresiones</span>
          <span class="kpi-value" id="tofu-impressions">—</span>
          <span class="kpi-delta" id="delta-tofu-impressions"></span>
          <canvas class="kpi-sparkline" id="sparkline-tofu-impressions" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="tofu-clicks">
          <span class="kpi-label">Clicks</span>
          <span class="kpi-value" id="tofu-clicks">—</span>
          <span class="kpi-delta" id="delta-tofu-clicks"></span>
          <canvas class="kpi-sparkline" id="sparkline-tofu-clicks" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="tofu-cpc">
          <span class="kpi-label">CPC Promedio</span>
          <span class="kpi-value" id="tofu-cpc">—</span>
          <span class="kpi-delta" id="delta-tofu-cpc"></span>
          <canvas class="kpi-sparkline" id="sparkline-tofu-cpc" aria-hidden="true"></canvas>
        </div>
      </div>

      <!-- Trend charts: split into 2 bar charts side by side -->
      <div class="charts-grid charts-grid--2col">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Evolución de Impresiones</h3>
            <span class="chart-badge">tendencia del período</span>
          </div>
          <div class="chart-card-body chart-body--tall">
            <canvas id="chart-tofu-impressions"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Evolución de Clicks</h3>
            <span class="chart-badge">tendencia del período</span>
          </div>
          <div class="chart-card-body chart-body--tall">
            <canvas id="chart-tofu-clicks"></canvas>
          </div>
        </div>
      </div>

      <div class="charts-grid charts-grid--2col">

        <!-- Search terms — spans 2 cols -->
        <div class="chart-card chart-card--wide">
          <div class="chart-card-header">
            <h3 class="chart-title">Top Términos de Búsqueda</h3>
            <select class="chart-filter-select" id="terms-filter" aria-label="Filtrar términos por métrica">
              <option value="clicks">Por Clicks</option>
              <option value="impressions">Por Impresiones</option>
            </select>
          </div>
          <div class="chart-card-body">
            <table class="terms-table" aria-label="Top términos de búsqueda">
              <thead>
                <tr>
                  <th>Término</th>
                  <th class="th-bar"></th>
                  <th class="th-num" id="terms-col-header">Clicks</th>
                </tr>
              </thead>
              <tbody id="search-terms-body">
                <!-- populated by charts.js -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Channels donut -->
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Canal</h3>
            <select class="chart-filter-select" id="channels-filter" aria-label="Filtrar canales por métrica">
              <option value="clicks">Por Clicks</option>
              <option value="impressions">Por Impresiones</option>
            </select>
          </div>
          <div class="chart-card-body chart-body--donut">
            <canvas id="chart-channels" aria-label="Canal por métrica"></canvas>
          </div>
        </div>

        <!-- Devices donut -->
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Dispositivos</h3>
            <select class="chart-filter-select" id="devices-filter" aria-label="Filtrar dispositivos por métrica">
              <option value="clicks">Por Clicks</option>
              <option value="impressions">Por Impresiones</option>
            </select>
          </div>
          <div class="chart-card-body chart-body--donut">
            <canvas id="chart-devices" aria-label="Dispositivos por métrica"></canvas>
          </div>
        </div>

        <!-- Geo choropleth map — spans 2 cols -->
        <div class="chart-card chart-card--wide">
          <div class="chart-card-header">
            <h3 class="chart-title">Clicks por Departamento</h3>
            <span class="chart-badge">Gran Mendoza</span>
          </div>
          <div class="chart-card-body" style="height: 280px; padding: 0; overflow: hidden; border-radius: 0 0 var(--r-xl) var(--r-xl);">
            <div id="geo-map" class="geo-map" style="width:100%; height:100%;"></div>
          </div>
          <div class="geo-legend" style="padding: 8px 16px 10px;">
            <span class="geo-legend-label">Menor</span>
            <div class="geo-legend-scale">
              <span style="background:#E8F0F5" title="Muy bajo"></span>
              <span style="background:#C8D8DC" title="Bajo"></span>
              <span style="background:#FF80A0" title="Medio"></span>
              <span style="background:#FF4068" title="Alto"></span>
              <span style="background:#FF0040" title="Muy alto"></span>
            </div>
            <span class="geo-legend-label">Mayor</span>
          </div>
        </div>

      </div>
    </section>

    <!-- ────────────────────────────────────────
         MOFU — INTEREST
    ──────────────────────────────────────────── -->
    <section id="section-mofu" class="dashboard-section" aria-label="Interest MOFU">

      <div class="section-header">
        <h2 class="section-title">Interest / MOFU</h2>
        <p class="section-subtitle">Efectividad de la estrategia para filtrar y calificar interesados</p>
      </div>

      <div class="kpi-grid kpi-grid--4">
        <div class="kpi-card" data-kpi="mofu-leads">
          <span class="kpi-label">Leads Totales</span>
          <span class="kpi-value" id="mofu-leads">—</span>
          <span class="kpi-delta" id="delta-mofu-leads"></span>
          <canvas class="kpi-sparkline" id="sparkline-mofu-leads" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="mofu-cpl">
          <span class="kpi-label">CPL — Costo por Lead</span>
          <span class="kpi-value" id="mofu-cpl">—</span>
          <span class="kpi-delta" id="delta-mofu-cpl"></span>
          <canvas class="kpi-sparkline" id="sparkline-mofu-cpl" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="mofu-tipif">
          <span class="kpi-label">Tasa de Tipificación</span>
          <span class="kpi-value" id="mofu-tipif">—</span>
          <span class="kpi-delta" id="delta-mofu-tipif"></span>
          <canvas class="kpi-sparkline" id="sparkline-mofu-tipif" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="mofu-highintent">
          <span class="kpi-label">Leads — Formulario</span>
          <span class="kpi-value" id="mofu-highintent">—</span>
          <span class="kpi-delta" id="delta-mofu-highintent"></span>
          <canvas class="kpi-sparkline" id="sparkline-mofu-highintent" aria-hidden="true"></canvas>
        </div>
      </div>

      <!-- Trend charts: split into 2 bar charts side by side -->
      <div class="charts-grid charts-grid--2col">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Evolución de Leads</h3>
            <span class="chart-badge">tendencia del período</span>
          </div>
          <div class="chart-card-body chart-body--tall">
            <canvas id="chart-mofu-leads"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Evolución del CPL</h3>
            <span class="chart-badge">tendencia del período</span>
          </div>
          <div class="chart-card-body chart-body--tall">
            <canvas id="chart-mofu-cpl"></canvas>
          </div>
        </div>
      </div>

      <!-- Status stacked bar + Segments donut: side by side -->
      <div class="charts-grid charts-grid--2col">

        <!-- Status vertical funnel bar chart -->
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Distribución por Estado</h3>
            <span class="chart-note">Fuente: MeisterTask · datos manuales</span>
          </div>
          <div class="chart-card-body chart-body--tall">
            <canvas id="chart-status" aria-label="Distribución por estado de lead" style="height: 340px;"></canvas>
          </div>
        </div>

        <!-- Segments donut -->
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Distribución por Segmento</h3>
          </div>
          <div class="chart-card-body chart-body--donut">
            <canvas id="chart-segments" aria-label="Distribución por segmento"></canvas>
          </div>
        </div>

      </div>
    </section>

    <!-- ────────────────────────────────────────
         BOFU — SALES
    ──────────────────────────────────────────── -->
    <section id="section-bofu" class="dashboard-section" aria-label="Sales BOFU">

      <div class="section-header">
        <h2 class="section-title">Sales / BOFU</h2>
        <p class="section-subtitle">Resultado del trabajo conjunto entre Marketing y Ventas</p>
      </div>

      <div class="kpi-grid kpi-grid--4">
        <div class="kpi-card" data-kpi="revenue">
          <span class="kpi-label">Ingresos Totales</span>
          <span class="kpi-value" id="bofu-revenue">—</span>
          <span class="kpi-delta" id="delta-bofu-revenue"></span>
          <canvas class="kpi-sparkline" id="sparkline-bofu-revenue" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="sales">
          <span class="kpi-label">Ventas Cerradas</span>
          <span class="kpi-value" id="bofu-sales">—</span>
          <span class="kpi-delta" id="delta-bofu-sales"></span>
          <canvas class="kpi-sparkline" id="sparkline-bofu-sales" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="bofu-ticket">
          <span class="kpi-label">Ticket Promedio</span>
          <span class="kpi-value" id="bofu-ticket">—</span>
          <span class="kpi-delta" id="delta-bofu-ticket"></span>
          <canvas class="kpi-sparkline" id="sparkline-bofu-ticket" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card" data-kpi="bofu-conversion">
          <span class="kpi-label">Tasa de Conversión</span>
          <span class="kpi-value" id="bofu-conversion">—</span>
          <span class="kpi-delta" id="delta-bofu-conversion"></span>
          <canvas class="kpi-sparkline" id="sparkline-bofu-conversion" aria-hidden="true"></canvas>
        </div>
      </div>

      <div class="kpi-grid kpi-grid--2">
        <div class="kpi-card">
          <span class="kpi-label">Cápitas Cerradas</span>
          <span class="kpi-value" id="bofu-capitas">—</span>
          <span class="kpi-delta" id="delta-bofu-capitas"></span>
          <canvas class="kpi-sparkline" id="sparkline-bofu-capitas" aria-hidden="true"></canvas>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Ticket Promedio por Cápita</span>
          <span class="kpi-value" id="bofu-ticket-capita">—</span>
          <span class="kpi-delta" id="delta-bofu-ticket-capita"></span>
          <canvas class="kpi-sparkline" id="sparkline-bofu-ticket-capita" aria-hidden="true"></canvas>
        </div>
      </div>

      <!-- Trend charts — split into 2 independent charts -->
      <div class="charts-grid charts-grid--2col">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Evolución de Ingresos</h3>
            <span class="chart-badge">tendencia del período</span>
          </div>
          <div class="chart-card-body chart-body--tall">
            <canvas id="chart-bofu-revenue"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Evolución de Ventas</h3>
            <span class="chart-badge">tendencia del período</span>
          </div>
          <div class="chart-card-body chart-body--tall">
            <canvas id="chart-bofu-sales-trend"></canvas>
          </div>
        </div>
      </div>

      <div class="charts-grid charts-grid--2col">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Ventas por Tipificación</h3>
          </div>
          <div class="chart-card-body chart-body--donut">
            <canvas id="chart-typification" aria-label="Ventas por tipificación"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Ventas por Segmento</h3>
            <span class="chart-badge">cierre por tipo</span>
          </div>
          <div class="chart-card-body">
            <table class="segment-table" aria-label="Ventas por segmento">
              <thead>
                <tr>
                  <th>Segmento</th>
                  <th class="th-num">Ventas</th>
                  <th class="th-num">% del total</th>
                </tr>
              </thead>
              <tbody id="bofu-segment-body">
                <!-- populated by charts.js -->
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Ranking de vendedores -->
      <div class="charts-grid charts-grid--full">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Ranking de Vendedores</h3>
            <span class="chart-badge">indicadores comerciales · período seleccionado</span>
          </div>
          <div class="chart-card-body" style="padding: var(--sp-4);">
            <table class="sellers-table" id="sellers-table" aria-label="Ranking de vendedores">
              <thead>
                <tr>
                  <th class="th-rank">#</th>
                  <th>Vendedor</th>
                  <th class="th-num">Ventas</th>
                  <th class="th-num">Efectividad</th>
                  <th class="th-num">Ticket Prom</th>
                  <th class="th-num">Cápitas</th>
                  <th class="th-num">Ciclo Prom</th>
                </tr>
              </thead>
              <tbody id="sellers-body">
                <!-- populated by charts.js -->
              </tbody>
              <tfoot id="sellers-foot"></tfoot>
            </table>
          </div>
        </div>
      </div>

    </section>

  </main>

  <!-- ══════════════════════════════════════════════
       FOOTER
  ══════════════════════════════════════════════ -->
  <footer class="site-footer">
    <div class="footer-inner">
      <span class="footer-brand">umoh</span>
      <span class="footer-sep">—</span>
      <span class="footer-text">Todos los derechos reservados &copy; 2025</span>
      <span class="footer-badge">LIVE DATA</span>
    </div>
  </footer>

  <!-- ══════════════════════════════════════════════
       /DASHBOARD WRAPPER
  ══════════════════════════════════════════════ -->
  </div><!-- /#dashboard-wrapper -->

  <!-- ══════════════════════════════════════════════
       SCRIPTS — order matters
  ══════════════════════════════════════════════ -->
  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <!-- Leaflet JS -->
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>

  <!-- KPI Info Modal -->
  <div id="kpi-modal" class="kpi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="kpi-modal-title" hidden>
    <div class="kpi-modal">
      <button class="kpi-modal-close" id="kpi-modal-close" aria-label="Cerrar">&times;</button>
      <h2 class="kpi-modal-title" id="kpi-modal-title">—</h2>
      <p class="kpi-modal-formula" id="kpi-modal-formula"></p>
      <p class="kpi-modal-desc" id="kpi-modal-desc"></p>
      <div class="kpi-modal-chart-area">
        <canvas id="kpi-modal-chart" aria-hidden="true"></canvas>
      </div>
      <div class="kpi-modal-example">
        <span class="kpi-modal-example-label">Ejemplo aplicado</span>
        <p id="kpi-modal-example"></p>
      </div>
    </div>
  </div>

  <!-- Theme toggle pill switch (position: fixed top-right) -->
  <button id="theme-toggle" class="theme-toggle-switch" title="Cambiar tema" aria-label="Cambiar modo claro/oscuro">
    <span class="theme-switch-track">
      <span class="theme-switch-thumb">
        <svg class="theme-icon theme-icon--sun" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <svg class="theme-icon theme-icon--moon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </span>
    </span>
  </button>

  <!-- Dashboard scripts -->
  <script src="assets/js/mockdata.js?v=<?php echo $_asset_v; ?>"></script>
  <script src="assets/js/api.js?v=<?php echo $_asset_v; ?>"></script>
  <script src="assets/js/charts.js?v=<?php echo $_asset_v; ?>"></script>
  <script src="assets/js/filters.js?v=<?php echo $_asset_v; ?>"></script>

</body>
</html>
