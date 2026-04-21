<?php
// auth setup — cross-subdomain session
ini_set('session.cookie_domain', '.umohcrew.com');
session_set_cookie_params([
    'lifetime' => 86400 * 30,
    'path'     => '/',
    'domain'   => '.umohcrew.com',
    'secure'   => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

if (!empty($_SESSION['umoh_user'])) {
    header('Location: index.html');
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
                header('Location: index.html');
                exit;
            }
        }
        $error = 'Usuario o contraseña incorrectos.';
    }
}
?>
<!DOCTYPE html>
<html lang="es">
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

    :root {
      --navy:       #212A38;
      --navy-deep:  #0E1520;
      --navy-light: #2A3647;
      --red:        #FF003B;
      --red-dark:   #CC002F;
      --white:      #FFFFFF;
      --text:       rgba(255,255,255,0.90);
      --muted:      rgba(255,255,255,0.45);
      --border:     rgba(255,255,255,0.10);
      --input-bg:   rgba(255,255,255,0.06);
    }

    html, body {
      height: 100%;
      font-family: 'Outfit', system-ui, sans-serif;
      background: var(--navy-deep);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
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

    /* ── Planets ──────────────────────────────────── */
    /*
     * Cada imagen recortada contiene únicamente el planeta (≈265×243 px original).
     * p02-cropped → x30 visible  ≈ 1400px → posición arriba-derecha
     * p03-cropped → x50 visible  ≈ 2300px → posición abajo-izquierda (parcial)
     * p04-cropped → tamaño medio ≈  700px → posición izquierda-centro
     */
    .planet {
      position: fixed;
      pointer-events: none;
      user-select: none;
      z-index: 0;
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

    /* ── Planetas extra (4–8) — TEST: eliminables individualmente ── */

    /* Planeta 7 — izquierda baja — 260px (p03) */
    .planet-7 {
      width: 260px;
      bottom: 18%;
      left: 30px;
      animation: float2 26s ease-in-out infinite;
      animation-delay: -3s;
      opacity: 0.68;
    }


    /* ── Planetas extra (9, 12, 13) — definitivos ── */

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
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 4px 14px;
    }

    /* ── Card ─────────────────────────────────────── */
    .card {
      background: rgba(22, 31, 44, 0.80);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 40px 36px 36px;
    }

    .card-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--white);
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
      color: var(--white);
      outline: none;
      transition: border-color 0.2s, background 0.2s;
    }

    input[type="text"]:focus,
    input[type="password"]:focus {
      border-color: var(--red);
      background: rgba(255,255,255,0.09);
    }

    input::placeholder { color: rgba(255,255,255,0.20); }

    /* ── Submit button ────────────────────────────── */
    .btn-submit {
      width: 100%;
      margin-top: 8px;
      padding: 14px 20px;
      background: var(--red);
      color: var(--white);
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
      color: rgba(255,255,255,0.90);
      margin-bottom: 10px;
    }

    .footer-meta {
      font-size: 11px;
      font-weight: 500;
      color: rgba(255,255,255,0.18);
      letter-spacing: 0.06em;
    }

    .footer-meta a {
      color: rgba(255,255,255,0.32);
      text-decoration: none;
      transition: color 0.15s;
    }

    .footer-meta a:hover { color: rgba(255,255,255,0.6); }

    /* ── Responsive ───────────────────────────────── */
    @media (max-width: 768px) {
      .planet-3  { width: 300px; }
      .planet-7  { width: 180px; }
      .planet-9  { width: 130px; left: -30px; }   /* más a la izquierda, parcial off-screen */
      .planet-12 { width: 150px; }
      .planet-13 { width: 200px; right: -40px; }  /* más a la derecha, parcial off-screen */
    }
  </style>
</head>
<body>

  <!-- PLANETAS DECORATIVOS — definitivos: 3, 7, 9, 12, 13 -->

  <!-- Planeta 3 — centro pantalla (derecha) — 450px — p04 -->
  <img src="assets/img/p04-cropped.png" alt="" class="planet planet-3" aria-hidden="true">

  <!-- Planeta 7 — izquierda baja — 260px — p03 -->
  <img src="assets/img/p03-cropped.png" alt="" class="planet planet-7" aria-hidden="true">


  <!-- Planeta 9  — superior izquierda — 170px — p04 -->
  <img src="assets/img/p04-cropped.png" alt="" class="planet planet-9" aria-hidden="true">

  <!-- Planeta 12 — inferior derecha — 200px — p04 -->
  <img src="assets/img/p04-cropped.png" alt="" class="planet planet-12" aria-hidden="true">

  <!-- Planeta 13 — superior derecha — 280px — p03 -->
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

      <p style="font-size:12px; color:rgba(255,255,255,0.30); text-align:center; line-height:1.5;">
        ¿Necesitás acceso? Escribinos a<br>
        <a href="mailto:hola@umohcrew.com" style="color:rgba(255,255,255,0.50); text-decoration:none;">hola@umohcrew.com</a>
      </p>
    </div>

    <div class="footer">
      <p class="footer-tagline">Digital Ecosystem <span style="color:#FF003B;">Creators</span></p>
      <p class="footer-meta">
        UMOH &nbsp;·&nbsp; Acceso restringido &nbsp;·&nbsp; <a href="https://umohcrew.com" target="_blank">umohcrew.com</a>
      </p>
    </div>

  </div>
</body>
</html>
