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
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">

  <!-- Material Symbols Outlined — íconos de secciones del sidebar -->
  <!-- Nota: se carga la familia completa sin restricción de icon_names.
       El parámetro icon_names combinado con axes (opsz,wght,FILL,GRAD) causa
       que Google Fonts devuelva CSS vacío. La familia completa pesa ~35 KB gzip. -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" />

  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" crossorigin="">

  <!-- Dashboard CSS -->
  <link rel="stylesheet" href="assets/css/umoh.css?v=<?php echo $_asset_v; ?>">

  <!-- Theme: apply saved preference synchronously to avoid flash -->
  <script>
    (function () {
      var t = localStorage.getItem('umoh-theme') || 'light';
      document.documentElement.setAttribute('data-theme', t);
      /* Sidebar collapsed state: applied early to avoid layout flash */
      if (localStorage.getItem('umoh:sidebar') === 'collapsed') {
        document.body.classList.add('sidebar-collapsed');
      }
    }());
  </script>

  <!-- Session data injected for JS -->
  <script>
    window.DASHBOARD_USERNAME = <?php echo json_encode($_SESSION['umoh_name'] ?? 'Usuario'); ?>;
    window.DASHBOARD_ROLE     = <?php echo json_encode($_SESSION['umoh_role'] ?? 'client'); ?>;
  </script>
</head>
<body class="sidebar-layout">

  <!-- ══════════════════════════════════════════════
       HAMBURGER — Mobile only
  ══════════════════════════════════════════════ -->
  <button id="sb-hamburger" class="sb-hamburger" aria-label="Abrir menú" aria-expanded="false">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  </button>

  <!-- ══════════════════════════════════════════════
       SIDEBAR
  ══════════════════════════════════════════════ -->
  <aside class="dashboard-sidebar" id="dashboard-sidebar" aria-label="Panel de navegación">

    <!-- A. Header del sidebar: logo PNG asterisco UMOH + nombre + botón colapsar -->
    <div class="sb-header">
      <div class="sb-brand">
        <!-- Logo del cliente — ocupa el lugar del asterisco UMOH en el header del sidebar.
             El asterisco UMOH se mantiene disponible para uso en login/loading screens.
             TODO Fase 4 multi-cliente: resolver client-logo.webp dinámicamente via CLIENT_SLUG -->
        <div class="sb-client-logo-wrap" aria-hidden="true">
          <img src="assets/img/client-logo.webp" alt="Logo cliente" class="sb-client-logo">
        </div>
        <div class="sb-brand-text sb-label">
          <span class="sb-brand-agency">umoh</span>
          <span class="sb-brand-client">Prevención Salud</span>
        </div>
      </div>
      <button class="sb-collapse-btn" id="sb-collapse-btn" aria-label="Colapsar sidebar" title="Colapsar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
    </div>

    <!-- Scrollable body del sidebar -->
    <div class="sb-body">

      <!-- B. Selector de campañas — dropdown expandible -->
      <div class="sb-section" id="sb-campaigns-section">
        <!-- Trigger del dropdown: muestra la campaña activa -->
        <button class="sb-dropdown-trigger" id="sb-campaigns-trigger" aria-expanded="false" aria-controls="sb-campaigns-panel" type="button">
          <svg class="sb-dt-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          <div class="sb-dt-text sb-label">
            <span class="sb-dt-name" id="sb-campaigns-active-name">Todas las campañas</span>
            <span class="sb-dt-meta" id="sb-campaigns-active-meta">vista agregada</span>
          </div>
          <!-- Chevron: apunta abajo cuando cerrado -->
          <svg class="sb-dt-chevron sb-label" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <!-- Dot activo en modo colapsado -->
          <span class="sb-campaign-dot" aria-hidden="true"></span>
        </button>

        <!-- Panel expandible -->
        <div class="sb-dropdown-panel" id="sb-campaigns-panel">
          <!-- Búsqueda (visible solo si hay >10 campañas — JS la muestra) -->
          <div class="sb-campaign-search sb-label" id="sb-campaign-search" style="display:none;">
            <svg class="sb-campaign-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="search" class="sb-campaign-search-input" id="sb-campaign-search-input" placeholder="Buscar campaña..." aria-label="Buscar campaña">
          </div>
          <!-- Lista de campañas -->
          <div class="sb-campaign-list" id="sb-campaign-list" role="listbox" aria-label="Campañas disponibles">
            <button class="sb-campaign-item active" data-campaign-id="all" data-campaign-name="" role="option" aria-selected="true">
              <svg class="sb-campaign-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="6"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
              <div class="sb-campaign-info sb-label">
                <span class="sb-campaign-name">Todas las campañas</span>
                <span class="sb-campaign-id">vista agregada</span>
              </div>
            </button>
            <!-- Campañas adicionales se inyectan por JS -->
          </div>
        </div>
      </div>

      <!-- C. Navegación de secciones — lista fija siempre visible -->
      <div class="sb-section sb-section--nav">
        <nav class="sb-nav-list" id="sb-nav-list" role="navigation" aria-label="Secciones del dashboard">
          <button class="sb-nav-item active" data-section="inicio" aria-current="page">
            <svg class="sb-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span class="sb-label">Inicio</span>
            <span class="sb-tooltip" aria-hidden="true">Inicio</span>
          </button>
          <button class="sb-nav-item" data-section="performance" aria-current="false">
            <span class="material-symbols-outlined sb-nav-icon" aria-hidden="true">bar_chart_4_bars</span>
            <span class="sb-label">Performance</span>
            <span class="sb-tooltip" aria-hidden="true">Performance</span>
          </button>
          <button class="sb-nav-item" data-section="tofu" aria-current="false">
            <span class="material-symbols-outlined sb-nav-icon" aria-hidden="true">visibility</span>
            <span class="sb-label">I. Awareness</span>
            <span class="sb-tooltip" aria-hidden="true">I. Awareness</span>
          </button>
          <button class="sb-nav-item" data-section="mofu" aria-current="false">
            <span class="material-symbols-outlined sb-nav-icon" aria-hidden="true">psychology_alt</span>
            <span class="sb-label">II. Interest</span>
            <span class="sb-tooltip" aria-hidden="true">II. Interest</span>
          </button>
          <button class="sb-nav-item" data-section="bofu" aria-current="false">
            <span class="material-symbols-outlined sb-nav-icon" aria-hidden="true">add_shopping_cart</span>
            <span class="sb-label">III. Sales</span>
            <span class="sb-tooltip" aria-hidden="true">III. Sales</span>
          </button>
        </nav>
      </div>

      <!-- D. Selector de período -->
      <div class="sb-period-wrap" id="sb-period-wrap">
        <div class="sb-period-header">
          <span class="sb-period-label">Período</span>
          <span class="sb-period-range" id="sb-period-range" aria-live="polite"></span>
        </div>
        <div class="sb-period-selector" role="group" aria-label="Selector de período">
          <button class="sb-period-btn" data-period="7d">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            7 días
          </button>
          <button class="sb-period-btn active" data-period="30d">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            30 días
          </button>
          <button class="sb-period-btn" data-period="90d">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            90 días
          </button>
          <!-- Personalizado: toggle inline con chevron -->
          <button class="sb-period-btn sb-period-btn--custom" data-period="custom" id="sb-period-custom-btn" aria-expanded="false" aria-controls="sb-custom-date-panel">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Personalizado
            <!-- Chevron integrado: apunta abajo cerrado -->
            <svg class="sb-period-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>

        <!-- Panel inline del date picker — se expande dentro del sidebar -->
        <div class="sb-custom-date-panel" id="sb-custom-date-panel">
          <div class="date-picker-inner">
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

        <!-- Popover flotante: mantenido para compatibilidad pero no usado por el sidebar -->
        <div id="date-picker-popover" class="date-picker-popover sb-inline-hidden" hidden aria-hidden="true"></div>

        <!-- Ícono compacto visible solo en modo colapsado -->
        <div class="sb-period-compact" id="sb-period-compact">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--umoh-accent)" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span class="sb-period-compact-label" id="sb-period-compact-label">30d</span>
        </div>
      </div>

    </div><!-- /.sb-body -->

    <!-- E. Perfil de usuario al fondo (el tema va adentro del dropdown) -->
    <div class="sb-user" id="sb-user">
      <!-- Dropdown: sale hacia arriba -->
      <div class="sb-user-dropdown" id="sb-user-dropdown" role="menu">
        <div class="user-menu-header">
          <div class="user-menu-avatar-lg">
            <!-- Avatar real del usuario -->
            <!-- TODO: cuando tengamos roles, condicionar avatar admin aquí -->
            <div class="sb-user-avatar sb-user-avatar--lg" id="sb-user-avatar-menu">
              <img src="assets/img/umoh-asterisk-light.png" alt="Avatar" class="avatar-light">
              <img src="assets/img/umoh-asterisk-dark.png"  alt="Avatar" class="avatar-dark">
            </div>
          </div>
          <div>
            <div class="user-menu-fullname" id="sb-user-fullname">Usuario</div>
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
      <!-- Trigger -->
      <button class="sb-user-trigger" id="sb-user-trigger" aria-haspopup="true" aria-expanded="false">
        <!-- TODO: cuando tengamos roles, condicionar avatar admin aquí -->
        <div class="sb-user-avatar" id="sb-user-avatar">
          <img src="assets/img/umoh-asterisk-light.png" alt="Avatar" class="avatar-light">
          <img src="assets/img/umoh-asterisk-dark.png"  alt="Avatar" class="avatar-dark">
        </div>
        <div class="sb-user-info sb-label">
          <span class="sb-user-name" id="sb-user-name">Usuario</span>
          <span class="sb-user-role">Administrador</span>
        </div>
        <!-- Chevron: apunta abajo cuando cerrado, arriba cuando abierto -->
        <svg class="sb-user-chevron sb-label" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    </div>

    <!-- Resize handle — arrastrar para ajustar el ancho del sidebar -->
    <div class="sb-resize-handle" id="sb-resize-handle" aria-hidden="true" title="Arrastrar para redimensionar"></div>

  </aside><!-- /#dashboard-sidebar -->

  <!-- ══════════════════════════════════════════════
       CONTENT AREA
  ══════════════════════════════════════════════ -->
  <div class="dashboard-content" id="dashboard-content">

  <!-- ══════════════════════════════════════════════
       MAIN
  ══════════════════════════════════════════════ -->
  <main class="dashboard-main">

    <!-- ────────────────────────────────────────
         INICIO — nueva sección default
    ──────────────────────────────────────────── -->
    <section id="section-inicio" class="dashboard-section active" aria-label="Inicio">

      <!-- Header con saludo -->
      <div class="inicio-header">
        <div class="inicio-avatar" aria-hidden="true" id="inicio-avatar">
          <!-- TODO: cuando tengamos roles, condicionar avatar admin aquí -->
          <img src="assets/img/umoh-asterisk-light.png" alt="Avatar" class="avatar-light" style="width:100%;height:100%;object-fit:contain;border-radius:0;">
          <img src="assets/img/umoh-asterisk-dark.png"  alt="Avatar" class="avatar-dark"  style="width:100%;height:100%;object-fit:contain;border-radius:0;">
        </div>
        <div class="inicio-greeting-block">
          <h1 class="inicio-saludo">Hola, <span id="inicio-user-name">Franco</span></h1>
          <p class="inicio-subtitle" id="inicio-subtitle">Esto es lo que pasó con tus campañas en los últimos 30 días</p>
        </div>
      </div>

      <!-- Resumen AI -->
      <div class="inicio-ai-card" id="inicio-ai-card">
        <div class="inicio-ai-header">
          <span class="inicio-ai-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Análisis IA
          </span>
          <button class="inicio-ai-refresh-btn" id="inicio-ai-refresh-btn" type="button" title="Regenerar análisis" aria-label="Regenerar análisis">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Regenerar
          </button>
        </div>
        <!-- Skeleton mientras carga -->
        <div class="inicio-ai-skeleton" id="inicio-ai-skeleton">
          <div class="sk-line sk-line--title"></div>
          <div class="sk-line sk-line--long"></div>
          <div class="sk-line sk-line--medium"></div>
          <div class="sk-line sk-line--long"></div>
          <div class="sk-line sk-line--short"></div>
        </div>
        <!-- Placeholder cuando no hay datos -->
        <div id="inicio-ai-empty" class="inicio-ai-empty" hidden>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          <p class="inicio-ai-empty-text">Sin campañas activas</p>
          <p class="inicio-ai-empty-sub">Los datos aparecerán aquí una vez que el pipeline esté conectado.</p>
        </div>
        <!-- Contenido real (oculto hasta que carga) -->
        <div id="inicio-ai-content" hidden>
          <p class="inicio-ai-headline" id="inicio-ai-headline"></p>
          <ul class="inicio-ai-highlights" id="inicio-ai-highlights"></ul>
          <div class="inicio-ai-recommendation">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--umoh-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p id="inicio-ai-recommendation"></p>
          </div>
          <p class="inicio-ai-timestamp" id="inicio-ai-timestamp" aria-live="polite"></p>
        </div>
      </div>

      <!-- Cards de acceso rápido (generadas dinámicamente por renderInicio) -->
      <!-- Los 4 skeletons iniciales dan feedback visual mientras carga el endpoint -->
      <div class="inicio-quick-grid" id="inicio-quick-grid">
        <div class="inicio-quick-card iq-skeleton" aria-hidden="true">
          <div class="inicio-quick-icon"></div>
          <span class="inicio-quick-section-name iq-sk-label"></span>
          <div><div class="iq-sk-val"></div><div class="iq-sk-label"></div></div>
        </div>
        <div class="inicio-quick-card iq-skeleton" aria-hidden="true">
          <div class="inicio-quick-icon"></div>
          <span class="inicio-quick-section-name iq-sk-label"></span>
          <div><div class="iq-sk-val"></div><div class="iq-sk-label"></div></div>
        </div>
        <div class="inicio-quick-card iq-skeleton" aria-hidden="true">
          <div class="inicio-quick-icon"></div>
          <span class="inicio-quick-section-name iq-sk-label"></span>
          <div><div class="iq-sk-val"></div><div class="iq-sk-label"></div></div>
        </div>
        <div class="inicio-quick-card iq-skeleton" aria-hidden="true">
          <div class="inicio-quick-icon"></div>
          <span class="inicio-quick-section-name iq-sk-label"></span>
          <div><div class="iq-sk-val"></div><div class="iq-sk-label"></div></div>
        </div>
      </div>

    </section>

    <!-- ────────────────────────────────────────
         PERFORMANCE
    ──────────────────────────────────────────── -->
    <section id="section-performance" class="dashboard-section" aria-label="Performance">

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
        <h2 class="section-title--hero">Top of Funnel</h2>
        <p class="section-title--sub">Awareness</p>
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

        <div class="chart-card chart-card--wide">
          <div class="chart-card-header">
            <h3 class="chart-title">Clicks por Ciudad</h3>
            <span class="chart-badge">Top localidades</span>
          </div>
          <div class="chart-card-body" style="padding: var(--sp-4) var(--sp-6);">
            <table class="geo-table">
              <thead>
                <tr>
                  <th class="geo-rank">#</th>
                  <th class="geo-city">Ciudad</th>
                  <th class="geo-bar"></th>
                  <th class="geo-clicks">Clicks</th>
                </tr>
              </thead>
              <tbody id="geo-table-body"></tbody>
            </table>
          </div>
        </div>

      </div>
    </section>

    <!-- ────────────────────────────────────────
         MOFU — INTEREST
    ──────────────────────────────────────────── -->
    <section id="section-mofu" class="dashboard-section" aria-label="Interest MOFU">

      <div class="section-header">
        <h2 class="section-title--hero">Middle of Funnel</h2>
        <p class="section-title--sub">Interest</p>
        <p class="section-subtitle">Efectividad de la estrategia para filtrar y calificar interesados</p>
      </div>

      <div class="kpi-grid kpi-grid--5">
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
        <div class="kpi-card" data-kpi="mofu-closedwon">
          <span class="kpi-label">Ventas Ganadas</span>
          <span class="kpi-value" id="mofu-closedwon">—</span>
          <span class="kpi-delta" id="delta-mofu-closedwon"></span>
          <canvas class="kpi-sparkline" id="sparkline-mofu-closedwon" aria-hidden="true"></canvas>
        </div>
      </div>

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

      <div class="charts-grid charts-grid--full">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Customer Journey — CRM</h3>
            <span class="chart-note">Fuente: MeisterTask · 13 etapas en orden del proceso de ventas</span>
          </div>
          <div class="chart-card-body" style="padding: 0; overflow: hidden;">
            <canvas id="chart-status" aria-label="Distribución por estado de lead" style="display:none;"></canvas>
          </div>
        </div>
      </div>

      <div class="charts-grid charts-grid--2col">
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
        <h2 class="section-title--hero">Bottom of Funnel</h2>
        <p class="section-title--sub">Sales</p>
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

      <div class="charts-grid charts-grid--full">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3 class="chart-title">Ventas pendientes de cargar monto</h3>
            <span class="chart-badge" id="pending-price-count">0 pendientes</span>
          </div>
          <div class="chart-card-body" style="padding: var(--sp-4);">
            <table class="pending-table" id="pending-price-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Asesor</th>
                  <th>Tipificación</th>
                  <th>Origen</th>
                  <th>Etapa actual</th>
                  <th class="th-num">Fecha ingreso</th>
                </tr>
              </thead>
              <tbody id="pending-price-body"></tbody>
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

  </div><!-- /.dashboard-content -->

  <!-- ══════════════════════════════════════════════
       MODALES (fuera del content para evitar z-index issues)
  ══════════════════════════════════════════════ -->

  <!-- Journey Stage Modal -->
  <div id="journey-stage-modal" class="journey-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="journey-modal-title" hidden>
    <div class="journey-modal">
      <button class="journey-modal-close" id="journey-modal-close" aria-label="Cerrar">&times;</button>
      <div class="journey-modal-phase-badge" id="journey-modal-phase-badge">
        <span class="journey-modal-phase-dot" id="journey-modal-phase-dot"></span>
        <span id="journey-modal-phase-name"></span>
      </div>
      <h2 class="journey-modal-title" id="journey-modal-title">—</h2>
      <div class="journey-modal-metric">
        <span class="journey-modal-metric-value" id="journey-modal-metric-value">—</span>
        <span class="journey-modal-metric-label">leads</span>
        <span class="journey-modal-metric-pct" id="journey-modal-metric-pct"></span>
      </div>
      <div class="journey-modal-section">
        <span class="journey-modal-section-label">Que significa esta etapa</span>
        <p class="journey-modal-section-text" id="journey-modal-description"></p>
      </div>
      <div class="journey-modal-section">
        <span class="journey-modal-section-label">Como interpretar el volumen</span>
        <p class="journey-modal-section-text" id="journey-modal-interpretation"></p>
      </div>
      <div class="journey-modal-action">
        <span class="journey-modal-action-label">Accion sugerida</span>
        <p class="journey-modal-action-text" id="journey-modal-action"></p>
      </div>
      <div class="journey-modal-example">
        <span class="journey-modal-example-label">Ejemplo aplicado</span>
        <p class="journey-modal-example-text" id="journey-modal-example"></p>
      </div>
    </div>
  </div>

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

  <!-- Lead Detail Modal -->
  <div id="lead-detail-modal" class="kpi-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="lead-modal-title" tabindex="-1" hidden>
    <div class="kpi-modal lead-modal">
      <button class="kpi-modal-close" id="lead-modal-close" aria-label="Cerrar">&times;</button>
      <h2 class="kpi-modal-title" id="lead-modal-title">—</h2>

      <div class="lead-modal-section">
        <span class="lead-modal-section-label">Datos del lead</span>
        <div class="lead-modal-basics-grid" id="lead-modal-basics"></div>
      </div>

      <div class="lead-modal-section">
        <span class="lead-modal-section-label">Historial de etapas</span>
        <ul class="lead-modal-history-list" id="lead-modal-history"></ul>
      </div>

      <div class="lead-modal-section" id="lead-modal-monetary-section" hidden>
        <span class="lead-modal-section-label">Datos monetarios</span>
        <div class="lead-modal-basics-grid" id="lead-modal-monetary"></div>
      </div>

      <div class="lead-modal-section" id="lead-modal-activity-section">
        <span class="lead-modal-section-label">Actividad y seguimientos</span>
        <div class="lead-modal-activity" id="lead-modal-activity"></div>
      </div>
    </div>
  </div>

  <!-- FAB scroll-to-top -->
  <button id="nav-fab" class="nav-fab" aria-label="Volver arriba" title="Volver arriba">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </svg>
  </button>

  <!-- Theme toggle pill switch -->
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

  <!-- ══════════════════════════════════════════════
       SCRIPTS — order matters
  ══════════════════════════════════════════════ -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>

  <script src="assets/js/mockdata.js?v=<?php echo $_asset_v; ?>"></script>
  <script src="assets/js/api.js?v=<?php echo $_asset_v; ?>"></script>
  <script src="assets/js/charts.js?v=<?php echo $_asset_v; ?>"></script>
  <script src="assets/js/filters.js?v=<?php echo $_asset_v; ?>"></script>

  <!-- Lead Detail Modal wiring -->
  <script>
  (function() {
    var overlay  = document.getElementById('lead-detail-modal');
    var closeBtn = document.getElementById('lead-modal-close');

    function closeLead() { if (overlay) overlay.setAttribute('hidden', ''); }

    if (closeBtn) closeBtn.addEventListener('click', closeLead);
    if (overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeLead();
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay && !overlay.hasAttribute('hidden')) closeLead();
    });
  })();
  </script>

  <!-- ══════════════════════════════════════════════
       MODAL: Comando CLI para regenerar el análisis de Inicio
       Se activa desde el botón "Regenerar" en la sección Inicio.
  ══════════════════════════════════════════════ -->
  <div id="regen-modal-overlay" class="regen-modal-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="regen-modal-title">
    <div class="regen-modal">
      <div class="regen-modal-header">
        <h3 class="regen-modal-title" id="regen-modal-title">Regenerar análisis</h3>
        <button class="regen-modal-close" id="regen-modal-close" aria-label="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <p class="regen-modal-body">Corré este comando en tu terminal local para generar un resumen fresco. Una vez ejecutado, recargá el dashboard para ver el análisis actualizado.</p>
      <div class="regen-modal-cmd-wrap">
        <code class="regen-modal-cmd" id="regen-modal-cmd">python scripts/run_inicio_summary.py --client-slug prepagas --period 30d</code>
        <button class="regen-modal-copy" id="regen-modal-copy" type="button" aria-label="Copiar comando">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copiar
        </button>
      </div>
      <p class="regen-modal-note">El período del comando se actualiza según el selector activo.</p>
    </div>
  </div>

  <script>
  (function () {
    const overlay   = document.getElementById('regen-modal-overlay');
    const closeBtn  = document.getElementById('regen-modal-close');
    const copyBtn   = document.getElementById('regen-modal-copy');
    const cmdEl     = document.getElementById('regen-modal-cmd');

    function openRegenModal(period) {
      if (!overlay || !cmdEl) return;
      const slug = 'prepagas';
      cmdEl.textContent = `python scripts/run_inicio_summary.py --client-slug ${slug} --period ${period}`;
      overlay.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeRegenModal() {
      if (!overlay) return;
      overlay.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeRegenModal);
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeRegenModal();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay && !overlay.hasAttribute('hidden')) closeRegenModal();
    });

    if (copyBtn && cmdEl) {
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(cmdEl.textContent).then(() => {
          copyBtn.textContent = 'Copiado';
          setTimeout(() => {
            copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar`;
          }, 2000);
        });
      });
    }

    // Exponer openRegenModal al scope global para que charts.js lo llame
    window._openRegenModal = openRegenModal;
  })();
  </script>

</body>
</html>
