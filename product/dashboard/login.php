<?php
$_is_local = in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost', '127.0.0.1', 'localhost:8080']);
$_domain   = $_is_local ? '' : '.umohcrew.com';
ini_set('session.cookie_domain', $_domain);
session_set_cookie_params([
    'lifetime' => 86400 * 30,
    'path'     => '/',
    'domain'   => $_domain,
    'secure'   => !$_is_local,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

if (!empty($_SESSION['umoh_user'])) {
    header('Location: index.php');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    $creds_file = __DIR__ . '/config/credentials.php';
    if (!file_exists($creds_file)) {
        $error = 'Sistema no configurado. Contactá al equipo UMOH.';
    } else {
        require $creds_file;
        if (isset(UMOH_USERS[$username])) {
            $user = UMOH_USERS[$username];
            if (password_verify($password, $user['password_hash'])) {
                $_SESSION['umoh_user']    = $username;
                $_SESSION['umoh_role']    = $user['role'];
                $_SESSION['umoh_clients'] = $user['clients'];
                $_SESSION['umoh_name']    = $user['name'];
                header('Location: index.php');
                exit;
            }
        }
        $error = 'Usuario o contraseña incorrectos.';
    }
}
?>
<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UMOH — Portal de Clientes</title>
  <link rel="icon" type="image/png" href="assets/img/asterisco.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Design tokens — dark (default) ─────────────── */
    :root {
      --red:        #FF003B;
      --red-dark:   #CC002F;

      --bg:              #0E1520;
      --card-bg:         rgba(22, 31, 44, 0.80);
      --text:            rgba(255,255,255,0.90);
      --text-strong:     #FFFFFF;
      --muted:           rgba(255,255,255,0.45);
      --border:          rgba(255,255,255,0.10);
      --input-bg:        rgba(255,255,255,0.06);
      --input-color:     #FFFFFF;
      --placeholder:     rgba(255,255,255,0.20);
      --badge-bg:        rgba(255,255,255,0.06);
      --help-text:       rgba(255,255,255,0.30);
      --help-link:       rgba(255,255,255,0.50);
      --footer-tagline:  rgba(255,255,255,0.90);
      --footer-meta:     rgba(255,255,255,0.18);
      --footer-link:     rgba(255,255,255,0.32);
      --footer-link-hover: rgba(255,255,255,0.60);
      --toggle-bg:       rgba(255,255,255,0.08);
      --toggle-border:   rgba(255,255,255,0.14);
      --toggle-color:    rgba(255,255,255,0.65);
      --toggle-hover-bg: rgba(255,255,255,0.14);
    }

    /* ── Design tokens — light ───────────────────────── */
    [data-theme="light"] {
      --bg:              #EEF1F7;
      --card-bg:         rgba(255,255,255,0.92);
      --text:            rgba(14,21,32,0.90);
      --text-strong:     #0E1520;
      --muted:           rgba(14,21,32,0.50);
      --border:          rgba(14,21,32,0.12);
      --input-bg:        rgba(14,21,32,0.04);
      --input-color:     #0E1520;
      --placeholder:     rgba(14,21,32,0.25);
      --badge-bg:        rgba(14,21,32,0.07);
      --help-text:       rgba(14,21,32,0.40);
      --help-link:       rgba(14,21,32,0.65);
      --footer-tagline:  rgba(14,21,32,0.90);
      --footer-meta:     rgba(14,21,32,0.25);
      --footer-link:     rgba(14,21,32,0.45);
      --footer-link-hover: rgba(14,21,32,0.75);
      --toggle-bg:       rgba(14,21,32,0.06);
      --toggle-border:   rgba(14,21,32,0.14);
      --toggle-color:    rgba(14,21,32,0.60);
      --toggle-hover-bg: rgba(14,21,32,0.12);
    }

    html, body {
      height: 100%;
      font-family: 'Outfit', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
      transition: background 0.25s, color 0.25s;
    }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      position: relative;
      overflow: hidden;
    }

    /* ── Theme toggle ─────────────────────────────────── */
    .theme-toggle {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 1px solid var(--toggle-border);
      background: var(--toggle-bg);
      color: var(--toggle-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, border-color 0.2s, color 0.2s;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .theme-toggle:hover {
      background: var(--toggle-hover-bg);
    }

    .theme-toggle svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
      flex-shrink: 0;
    }

    .icon-sun  { display: none; }
    .icon-moon { display: block; }

    [data-theme="light"] .icon-sun  { display: block; }
    [data-theme="light"] .icon-moon { display: none; }

    /* ── Planets ──────────────────────────────────── */
    .planet {
      position: fixed;
      pointer-events: none;
      user-select: none;
      z-index: 0;
      transition: opacity 0.3s;
    }

    /* Planeta 3 — centrado en pantalla, levemente a la derecha, 450px */
    .planet-3 {
      width: 450px;
      top: 50%;
      left: 50%;
      transform: translate(-30%, -50%);
      animation: float3 30s ease-in-out infinite;
      opacity: 0.75;
    }

    @keyframes float1 {
      0%, 100% { transform: translate(0,  0px)  rotate(0deg);  }
      33%       { transform: translate(8px, -28px) rotate(3deg);  }
      66%       { transform: translate(-5px, 16px) rotate(-2deg); }
    }

    @keyframes float2 {
      0%, 100% { transform: translate(0,   0px)  rotate(0deg);  }
      40%       { transform: translate(-12px, -36px) rotate(-3deg); }
      70%       { transform: translate(8px,  20px)  rotate(2deg);  }
    }

    @keyframes float3 {
      0%, 100% { transform: translate(-30%, -50%)              rotate(0deg);  }
      50%       { transform: translate(-30%, calc(-50% - 10px)) rotate(1.5deg); }
    }

    /* Planeta 7 — izquierda baja — 260px (p03) */
    .planet-7 {
      width: 260px;
      bottom: 18%;
      left: 30px;
      animation: float2 26s ease-in-out infinite;
      animation-delay: -3s;
      opacity: 0.68;
    }

    /* Planeta 9  — superior izquierda — 170px — p04 */
    .planet-9 {
      width: 170px;
      top: 50px;
      left: 40px;
      animation: float2 17s ease-in-out infinite;
      animation-delay: -6s;
      opacity: 0.75;
    }

    /* Planeta 12 — inferior derecha — 200px — p04 */
    .planet-12 {
      width: 200px;
      bottom: 30px;
      right: 40px;
      animation: float1 19s ease-in-out infinite;
      animation-delay: -8s;
      opacity: 0.72;
    }

    /* Planeta 13 — superior derecha — 280px — p03 */
    .planet-13 {
      width: 280px;
      top: 30px;
      right: 40px;
      animation: float2 23s ease-in-out infinite;
      animation-delay: -5s;
      opacity: 0.68;
    }

    [data-theme="light"] .planet { opacity: 0.35; }

    /* ── Wrapper ──────────────────────────────────── */
    .wrapper {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 420px;
      animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Logo ─────────────────────────────────────── */
    .logo-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 36px;
      gap: 14px;
    }

    .logo-img {
      height: 32px;
      width: auto;
      display: block;
    }

    .logo-badge {
      display: block;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      background: var(--badge-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 4px 14px;
    }

    /* ── Card ─────────────────────────────────────── */
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 40px 36px 36px;
      transition: background 0.25s, border-color 0.25s;
    }

    .card-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-strong);
      letter-spacing: -0.3px;
      margin-bottom: 8px;
    }

    .card-desc {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.6;
      margin-bottom: 32px;
    }

    /* ── Error ────────────────────────────────────── */
    .error-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 0, 59, 0.08);
      border: 1px solid rgba(255, 0, 59, 0.25);
      border-radius: 8px;
      padding: 11px 14px;
      font-size: 13px;
      font-weight: 500;
      color: #FF6080;
      margin-bottom: 24px;
    }

    .error-msg::before {
      content: '!';
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: rgba(255,0,59,0.25);
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
    }

    /* ── Form fields ──────────────────────────────── */
    .field { margin-bottom: 18px; }

    label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 8px;
    }

    input[type="text"],
    input[type="password"] {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 13px 16px;
      font-size: 14px;
      font-family: 'Outfit', sans-serif;
      font-weight: 400;
      color: var(--input-color);
      outline: none;
      transition: border-color 0.2s, background 0.2s;
    }

    input[type="text"]:focus,
    input[type="password"]:focus {
      border-color: var(--red);
      background: var(--input-bg);
    }

    input::placeholder { color: var(--placeholder); }

    /* ── Submit button ────────────────────────────── */
    .btn-submit {
      width: 100%;
      margin-top: 8px;
      padding: 14px 20px;
      background: var(--red);
      color: #FFFFFF;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      font-family: 'Outfit', sans-serif;
      letter-spacing: 0.03em;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s, transform 0.1s;
    }

    .btn-submit:hover  { background: var(--red-dark); }
    .btn-submit:active { transform: scale(0.99); }

    .btn-arrow {
      font-size: 16px;
      transition: transform 0.2s;
    }

    .btn-submit:hover .btn-arrow { transform: translateX(3px); }

    /* ── Divider ──────────────────────────────────── */
    .divider {
      height: 1px;
      background: var(--border);
      margin: 28px 0;
    }

    /* ── Help text ────────────────────────────────── */
    .help-text {
      font-size: 12px;
      color: var(--help-text);
      text-align: center;
      line-height: 1.5;
    }

    .help-text a {
      color: var(--help-link);
      text-decoration: none;
      transition: color 0.15s;
    }

    .help-text a:hover { color: var(--text); }

    /* ── Footer ───────────────────────────────────── */
    .footer {
      text-align: center;
      margin-top: 28px;
    }

    .footer-tagline {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--footer-tagline);
      margin-bottom: 10px;
    }

    .footer-meta {
      font-size: 11px;
      font-weight: 500;
      color: var(--footer-meta);
      letter-spacing: 0.06em;
    }

    .footer-meta a {
      color: var(--footer-link);
      text-decoration: none;
      transition: color 0.15s;
    }

    .footer-meta a:hover { color: var(--footer-link-hover); }

    /* ── Responsive ───────────────────────────────── */
    @media (max-width: 768px) {
      .planet-3  { width: 300px; }
      .planet-7  { width: 180px; }
      .planet-9  { width: 130px; left: -30px; }
      .planet-12 { width: 150px; }
      .planet-13 { width: 200px; right: -40px; }
    }
  </style>
</head>
<body>

  <!-- Theme toggle -->
  <button class="theme-toggle" id="themeToggle" aria-label="Cambiar tema" title="Cambiar tema">
    <!-- Sun (shown in light mode) -->
    <svg class="icon-sun" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="2"  x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2"  y1="12" x2="4"  y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
    <!-- Moon (shown in dark mode) -->
    <svg class="icon-moon" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  </button>

  <!-- PLANETAS DECORATIVOS — definitivos: 3, 7, 9, 12, 13 -->
  <img src="assets/img/p04-cropped.png" alt="" class="planet planet-3"  aria-hidden="true">
  <img src="assets/img/p03-cropped.png" alt="" class="planet planet-7"  aria-hidden="true">
  <img src="assets/img/p04-cropped.png" alt="" class="planet planet-9"  aria-hidden="true">
  <img src="assets/img/p04-cropped.png" alt="" class="planet planet-12" aria-hidden="true">
  <img src="assets/img/p03-cropped.png" alt="" class="planet planet-13" aria-hidden="true">

  <div class="wrapper">

    <div class="logo-area">
      <img src="assets/img/logo-white.png" alt="UMOH" class="logo-img">
      <span class="logo-badge">Portal de Clientes</span>
    </div>

    <div class="card">
      <p class="card-title">Bienvenido</p>
      <p class="card-desc">Ingresá con tus credenciales para ver el rendimiento de tus campañas.</p>

      <?php if ($error): ?>
        <div class="error-msg"><?= htmlspecialchars($error) ?></div>
      <?php endif; ?>

      <form method="POST" action="login.php" autocomplete="off">
        <div class="field">
          <label for="username">Usuario</label>
          <input
            type="text"
            id="username"
            name="username"
            placeholder="tu_usuario"
            value="<?= htmlspecialchars($_POST['username'] ?? '') ?>"
            required
            autofocus
          >
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="••••••••••••"
            required
          >
        </div>
        <button type="submit" class="btn-submit">
          Ingresar
          <span class="btn-arrow">→</span>
        </button>
      </form>

      <div class="divider"></div>

      <p class="help-text">
        ¿Necesitás acceso? Escribinos a<br>
        <a href="mailto:hola@umohcrew.com">hola@umohcrew.com</a>
      </p>
    </div>

    <div class="footer">
      <p class="footer-tagline">Digital Ecosystem <span style="color:#FF003B;">Creators</span></p>
      <p class="footer-meta">
        UMOH &nbsp;·&nbsp; Acceso restringido &nbsp;·&nbsp; <a href="https://umohcrew.com" target="_blank">umohcrew.com</a>
      </p>
    </div>

  </div>

  <script>
    (function () {
      var html    = document.documentElement;
      var btn     = document.getElementById('themeToggle');
      var logoImg = document.querySelector('.logo-img');
      var key     = 'umoh-theme';

      function _applyLogo(theme) {
        if (!logoImg) return;
        logoImg.src = theme === 'light'
          ? 'assets/img/logo-dark.png'
          : 'assets/img/logo-white.png';
      }

      // Apply saved theme (or system preference) before first paint
      var saved = localStorage.getItem(key);
      if (!saved) {
        saved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      html.setAttribute('data-theme', saved);
      _applyLogo(saved);

      btn.addEventListener('click', function () {
        var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem(key, next);
        _applyLogo(next);
      });
    })();
  </script>
</body>
</html>
