# Análisis de Gaps — SSO Unificado + API Gateway

> **Fecha:** Julio 2026 | **Verificación ejecutada:** 27 checks en 6 bloques
> **Resultado:** 22/27 PASS · 5 issues identificadas · 2 gaps críticos

---

## Resumen de Resultados

| Bloque | Total | PASS | FAIL | Issues |
|--------|-------|------|------|--------|
| A — SSO | 5 | 4 | 1 | A3: 401 sin redirect a login |
| B — Gateway | 5 | 4 | 1 | B3: n8n /health no existe |
| C — Comunicación | 8 | 8 | 0 | ✅ Todo OK |
| D — Logs | 7 | 6 | 1 | D3: Error HTTPS Authelia · D4: Query PG |
| **TOTAL** | **27** | **22** | **5** | **2 críticos, 3 menores** |

---

## Gap Crítico #1: Rutas protegidas no redirigen a login (A3)

### Problema
Las rutas protegidas (`/crm/`, `/n8n/`, `/admin/`, `/chatwoot/`, `/dify/`, `/portal/`, `/api/campaigns`) retornan **401 sin Location header** en lugar de redirigir al usuario a la página de login de Authelia.

**Comportamiento actual:**
```
GET /crm/ → 401 Unauthorized (sin Location)
GET /n8n/ → 401 Unauthorized (sin Location)
GET /dify/ → 401 Unauthorized (sin Location)
```

**Comportamiento esperado:**
```
GET /crm/ → 302 Found → Location: /auth/?rd=http://localhost:8080/crm/
```

### Causa Raíz
El nginx `auth_request /auth` responde 401 cuando no hay sesión, pero **no tiene `error_page 401` configurado** para interceptar ese 401 y redirigir al portal de login de Authelia.

### Instrucciones de Solución

**Archivo:** `nginx.conf`

Agregar el handler de error_page 401 dentro del servidor principal, DESPUÉS del bloque `location = /auth`:

```nginx
# Después del location = /auth { ... }

location @auth_redirect {
    return 302 http://localhost:8080/auth/?rd=$scheme://$http_host$request_uri;
}
```

Y en cada location protegido, agregar `error_page 401 = @auth_redirect;` antes del `proxy_pass`:

```nginx
# Ejemplo con /crm/
location /crm/ {
    auth_request /auth;
    auth_request_set $auth_cookie $upstream_http_set_cookie;
    add_header Set-Cookie $auth_cookie;
    error_page 401 = @auth_redirect;    # <-- AGREGAR ESTA LÍNEA
    proxy_pass http://twenty-server:3000/;
    # ... resto de headers
}
```

**Ubicaciones que necesitan la línea `error_page 401 = @auth_redirect;`:**
- `/api/`
- `/admin/`
- `/campaigns/` y `= /campaigns`
- `/n8n/`
- `/static/`, `/rest/`, `/webhook-test/`, `/webhook-waiting/`
- `/chatwoot/`
- `/crm/`
- `/grafana/`
- `/glitchtip/`
- `/minio-console/`
- `/portal/`
- `/reportes/`
- `/erp/`

**Verificación posterior:**
```powershell
Invoke-WebRequest "http://localhost:8080/crm/" -MaximumRedirection 0 -UseBasicParsing
# Esperado: 302 → Location: /auth/?rd=...
```

---

## Gap Crítico #2: Authelia rechaza cookies por HTTP no seguro (D3)

### Problema
Authelia está devolviendo un error porque el esquema de la URL destino es HTTP (no HTTPS) pero las cookies de sesión son de tipo "secure-only".

**Error en logs:**
```
Scheme of target URL http://localhost:8080/n8n/ must be secure since cookies are only transported over a secure connection
```

### Causa Raíz
Authelia tiene `session.cookie.secure: true` por defecto (bueno para producción) pero en desarrollo local usamos HTTP sin SSL.

### Instrucciones de Solución

**Opción A (Recomendada para desarrollo):** Desactivar cookies seguras en Authelia

**Archivo:** `authelia/configuration.yml`

Agregar al final de la sección `session`:

```yaml
session:
  name: wibsite_session
  domain: localhost
  secret: ${AUTHELIA_SESSION_SECRET}
  expiration: 8h
  inactivity: 2h
  remember_me_duration: 30d
  cookies:
    - domain: localhost
      authelia_url: http://localhost:8080
      default_redirection_url: http://localhost:8080/hub/
```

**Opción B:** Configurar HTTPS para localhost con certificados

Ejecutar:
```powershell
# Generar certs (cuando se necesite)
openssl req -x509 -newkey rsa:4096 -keyout certs/nginx.key -out certs/nginx.crt -days 365 -nodes -subj "/CN=localhost"

# En nginx.conf, agregar server 443 con certs
# Cambiar todos los Location a https://
# Cambiar default_redirection_url a https://localhost:8080/hub/
```

**Verificación posterior:**
```powershell
docker logs wibsite-authelia --tail 5 2>&1 | Select-String "error|must be secure"
# Esperado: sin salida
```

---

## Gap Menor #3: n8n /health endpoint no existe (B3)

### Problema
El test B3 usa `/health` en n8n, que retorna 404.

### Solución
Cambiar el test para usar `/` (raíz) en vez de `/health`:

```powershell
# En CHECKLIST-SSO-GATEWAY.md, Bloque B3, cambiar:
Invoke-WebRequest "http://localhost:5679/" -UseBasicParsing -TimeoutSec 3
# Esperado: 200 (n8n UI carga)
```

---

## Gap Menor #4: Query PG connections retorna formato inesperado (D4)

### Problema
El comando `docker exec wibsite-postgres psql -U wibsite -c "SELECT count(*)..."` retorna formato con espacios y saltos de línea, no un número limpio.

### Solución
Usar formato correcto:

```powershell
docker exec wibsite-postgres psql -U wibsite -t -c "SELECT count(*) FROM pg_stat_activity;"
# -t flag = tuples only (sin headers ni formato extra)
# Esperado: número limpio
```

---

## Gap Menor #5: Nginx warnings duplicate MIME type

### Problema
Nginx emite warning por `sub_filter_types text/html text/css application/javascript;` — el tipo text/html ya está en `sub_filter_types` por defecto.

### Solución
En el location /dify/, cambiar:

```nginx
sub_filter_types text/html text/css application/javascript;
```
a:
```nginx
sub_filter_types text/html text/css;
```

---

## Checklist de Acción Inmediata

| # | Gap | Criticidad | Acción | Archivo |
|---|-----|-----------|--------|---------|
| 1 | 401 sin redirect a login | **CRÍTICO** | Agregar `error_page 401 = @auth_redirect;` a locations protegidos + location @auth_redirect | `nginx.conf` |
| 2 | Authelia HTTPS scheme error | **CRÍTICO** | Agregar `session.cookies` con authelia_url en configuration.yml | `authelia/configuration.yml` |
| 3 | n8n health 404 | Bajo | Cambiar test a usar `/` en vez de `/health` | `CHECKLIST-SSO-GATEWAY.md` |
| 4 | PG query formato | Bajo | Agregar flag `-t` a comando psql | `CHECKLIST-SSO-GATEWAY.md` |
| 5 | Duplicate MIME type | Bajo | Cambiar `sub_filter_types` a solo `text/html text/css` | `nginx.conf` (location /dify/) |

---

## Comandos de Solución Rápida

```powershell
# 1. Arreglar nginx (401 redirect)
# Abrir nginx.conf y agregar:
#   - location @auth_redirect { return 302 ... }
#   - error_page 401 = @auth_redirect; en cada location protegido

# 2. Arreglar Authelia (HTTP cookies)
# Abrir authelia/configuration.yml y agregar session.cookies

# 3. Reiniciar servicios
docker compose restart authelia nginx

# 4. Verificar fix #1
Invoke-WebRequest "http://localhost:8080/crm/" -MaximumRedirection 0 -UseBasicParsing
# Esperado: 302 a /auth/

# 5. Verificar fix #2
docker logs wibsite-authelia --tail 3 2>&1 | Select-String "error|secure"
# Esperado: sin errores de scheme
```
