# Deploy en Hostinger Shared Hosting

## Requisitos previos
- Hostinger plan con PHP 8.3 y MySQL
- Acceso FTP (FileZilla o similar) o File Manager en hPanel
- Dominio `umohcrew.com` ya apuntado a Hostinger

---

## 1. Crear subdominio

1. En hPanel → **Dominios → Subdominios**
2. Crear `prepagas.umohcrew.com`
3. Directorio raíz: `/public_html/prepagas` (o el path que prefieras)

---

## 2. Subir archivos por FTP

```
Servidor: ftp.umohcrew.com  (o el que muestra hPanel)
Usuario:  tu_usuario_ftp
Puerto:   21
```

Estructura a subir al directorio raíz del subdominio:

```
/
├── .env                  ← crearlo a partir de .env.example, NO subir .env.example
├── clients/
│   └── prepagas.json
├── api/
│   └── ... (todo el directorio api/)
└── dashboard/
    └── ... (todo el directorio dashboard/)
```

**Importante:** el archivo `.htaccess` (paso 4) va en la raíz del subdominio.

---

## 3. Crear base de datos MySQL

1. hPanel → **Bases de datos → MySQL**
2. Crear base: `umoh_portal` (o el nombre disponible)
3. Crear usuario y asignarlo a la base con todos los permisos
4. Anotar host (normalmente `localhost`), nombre, usuario y contraseña

Ejecutar el schema inicial:
```sql
CREATE TABLE clients (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    slug          VARCHAR(100) NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Alta del primer cliente:
INSERT INTO clients (slug, name, password_hash)
VALUES ('prepagas', 'Prevención Salud', PASSWORD_HASH_AQUI);
-- Generar hash con: php -r "echo password_hash('tu_password', PASSWORD_BCRYPT);"
```

---

## 4. Configurar .htaccess

Crear `/public_html/prepagas/.htaccess`:

```apache
Options -Indexes

# Redirigir raíz al dashboard
DirectoryIndex dashboard/index.php dashboard/index.html

# PHP 8.3 en Hostinger (si no está por defecto)
# AddHandler application/x-httpd-php83 .php

# Proteger archivos sensibles
<FilesMatch "(\.env|\.json)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# Excepción: permitir acceso al JSON del cliente desde PHP (no desde browser)
<Files "*.json">
    Order Deny,Allow
    Deny from all
</Files>

# Headers de seguridad
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# CORS para los endpoints PHP (ajustar origen en producción)
<FilesMatch "\.php$">
    Header set Access-Control-Allow-Origin "*"
</FilesMatch>
```

---

## 5. Configurar .env

Crear `.env` en la raíz (a partir de `.env.example`):

```env
DB_HOST=localhost
DB_NAME=tu_nombre_de_base
DB_USER=tu_usuario_mysql
DB_PASS=tu_contraseña_mysql

APP_ENV=production
JWT_SECRET=genera_una_cadena_aleatoria_larga_aqui
```

**No commitear el `.env` al repositorio.**

---

## 6. Verificar PHP

Crear `/public_html/prepagas/phpinfo.php` temporalmente:
```php
<?php phpinfo();
```
Abrir `prepagas.umohcrew.com/phpinfo.php` y verificar:
- PHP 8.3.x ✓
- PDO MySQL habilitado ✓
- `allow_url_fopen` = On (necesario para fetch GeoJSON en el mapa)

**Borrar `phpinfo.php` después de verificar.**

---

## 7. Checklist final

- [ ] Dashboard abre en `prepagas.umohcrew.com` sin errores de consola
- [ ] Los 4 tabs navegan correctamente
- [ ] El selector de período recarga los datos
- [ ] El mapa de Leaflet carga el GeoJSON de Mendoza
- [ ] Los archivos `.env` y `.json` retornan 403 desde el browser
- [ ] `phpinfo.php` eliminado

---

## Alta de un nuevo cliente

1. Crear `clients/{slug}.json` con los IDs correspondientes
2. `INSERT INTO clients (slug, name, password_hash) VALUES (...)` en MySQL
3. Crear subdominio `{slug}.umohcrew.com` en hPanel apuntando al mismo directorio
4. El sistema detecta el slug desde el subdominio y carga el JSON correcto (Fase 4+)
