# Suite de Auditoría y Diagnóstico de la Plataforma Wibsite

Guía completa de uso, arquitectura de pruebas y diagnóstico de fallas para la suite de automatización de auditorías en `scripts/`.

---

## 🎯 Objetivo de la Suite

Esta suite permite auditar y verificar con **alta precisión y velocidad (menos de 3 segundos)** la integridad de la plataforma Wibsite:
1. **SSO Unificado (Authelia OIDC)** en todos los servicios (n8n, Chatwoot, MinIO, Grafana, Dify, etc.).
2. **Aislamiento Multi-Tenant (PostgreSQL 15 RLS)** con forzado de políticas y conexiones no-superuser (`app_user`).
3. **Conectividad y Enrutamiento Nginx Proxy** en el puerto `:8080` (HTTPS).
4. **Salud de Microservicios** (`helper-node`, Redis, Weaviate).
5. **Salud de Contenedores Docker** (los 23 servicios en ejecución y saludables).

---

## 🚀 Cómo Ejecutar la Auditoría

### 1. Auditoría Completa (Script Maestro)

Para ejecutar las **42 comprobaciones** completas de la plataforma:

**En Node.js (Windows / Linux / Mac):**
```bash
node scripts/audit-all.js
```

**En PowerShell (Windows):**
```powershell
.\scripts\audit-all.ps1
```

---

## 📊 Estructura de Módulos de Auditoría

Los scripts se encuentran organizados en la carpeta `scripts/audit/`:

```
scripts/
├── audit-all.js                       # Script maestro de auditoría (Runner 5/5)
├── audit-all.ps1                      # Wrapper PowerShell para ejecución directa
├── AUDIT_SUITE_GUIDE.md               # Esta documentación detallada
└── audit/
    ├── 01-check-containers.js         # Auditoría 1: Estado y Salud de 20 Contenedores
    ├── 02-test-connectivity.js        # Auditoría 2: Conectividad HTTP/HTTPS Nginx (8 Endpoints)
    ├── 03-test-oidc-sso.js            # Auditoría 3: SSO Unificado & Discovery OIDC Authelia
    ├── 04-test-multi-tenant-rls.js    # Auditoría 4: PostgreSQL RLS y Aislamiento Multi-Tenant
    └── 05-check-helper-api.js         # Auditoría 5: Helper-Node API, Middleware & DB User
```

---

## 🔍 Detalle de Cada Módulo de Prueba

### Módulo 1: `01-check-containers.js`
- **Qué prueba:** Inspecciona el daemon de Docker (`docker ps`) y valida que los **20 contenedores** del proyecto existan, estén en estado `Up` y pasen sus comprobaciones de salud (`healthy`).
- **Contenedores Auditados:**
  - `wibsite-authelia`, `wibsite-cadvisor`, `wibsite-chatwoot`, `wibsite-chatwoot-worker`
  - `wibsite-dify-api`, `wibsite-dify-sandbox`, `wibsite-dify-web`, `wibsite-dify-worker`
  - `wibsite-glitchtip`, `wibsite-glitchtip-pg`, `wibsite-glitchtip-redis`, `wibsite-grafana`
  - `wibsite-helper`, `wibsite-minio`, `wibsite-n8n`, `wibsite-nginx`, `wibsite-plugin-daemon`
  - `wibsite-postgres`, `wibsite-prometheus`, `wibsite-redis`, `wibsite-t2v`, `wibsite-twenty-server`, `wibsite-weaviate`
- **En caso de error:** Imprime el estado exacto del contenedor y los últimos logs devueltos por `docker logs`.

### Módulo 2: `02-test-connectivity.js`
- **Qué prueba:** Realiza solicitudes HTTP/HTTPS a los 8 endpoints clave a través del Nginx Gateway (`https://localhost:8080`).
- **Rutas Auditadas:**
  - `/hub/` (Público, debe ser `200 OK`)
  - `/auth/` (Portal SSO Authelia, debe ser `200 OK`)
  - `/health` (Healthcheck Nginx, debe ser `200 OK`)
  - `/n8n/`, `/chatwoot/`, `/grafana/`, `/dify/`, `/minio-console/` (Protegidos, deben redirigir `302` a Authelia si no hay sesión)
- **En caso de error:** Detalla el código de estado devuelto, el tiempo de respuesta o la falla de red TCP/TLS.

### Módulo 3: `03-test-oidc-sso.js`
- **Qué prueba:** Valida la consistencia de la configuración SSO OIDC:
  - **Prueba 1:** Discovery OIDC externo en `/auth/.well-known/openid-configuration` (el `issuer` DEBE ser exactamente `https://localhost:8080`).
  - **Prueba 2:** Discovery OIDC interno desde contenedores (`Chatwoot` vía `host.docker.internal`).
  - **Prueba 3:** Estado de MinIO OIDC Provider (`mc admin config get local identity_openid`).
  - **Prueba 4:** Variables de entorno y modo de autenticación en n8n (`N8N_AUTH_METHOD=email`, `WEBHOOK_URL=https://localhost:8080`).
- **En caso de error:** Muestra la discrepancia del `issuer` o la variable de entorno ausente.

### Módulo 4: `04-test-multi-tenant-rls.js`
- **Qué prueba:** Garantiza el aislamiento estricto por Tenant en PostgreSQL 15:
  - **Prueba 1:** Existencia de la función `current_tenant_id()` de PostgreSQL.
  - **Prueba 2:** Estado del rol `app_user` (debe ser `usesuper = false` para que la RLS no sea ignorada).
  - **Prueba 3:** Verificación de `relrowsecurity = true` y `relforcerowsecurity = true` en las 7 tablas clave (`campaigns`, `campaign_leads`, `lead_scores`, `opt_outs`, `workflow_logs`, `audit_logs`, `channel_status`).
  - **Prueba 4:** Prueba de consulta en vivo con `SET ROLE app_user; SET app.tenant_id = '...'`:
    - Consulta Tenant Alpha -> retorna únicamente 2 campañas de Alpha.
    - Consulta Tenant Beta -> retorna únicamente 1 campaña de Beta.
    - Intento de fuga cruzada (Beta buscando registros de Alpha) -> **0 registros devueltos**.
- **En caso de error:** Alerta inmediatamente sobre fugas de datos o desconfiguración en roles.

### Módulo 5: `05-check-helper-api.js`
- **Qué prueba:** Estado y configuración del microservicio `helper-node`:
  - **Prueba 1:** Endpoint HTTP `/health` en puerto `:3100`.
  - **Prueba 2:** Variable de entorno `PG_USER` en el contenedor `wibsite-helper` (debe ser `app_user`).
  - **Prueba 3:** Presencia del middleware `tenantContext` registrado en los logs de inicio, además de la conexión activa a PostgreSQL, Redis y Weaviate.
- **En caso de error:** Extrae y muestra los últimos logs de diagnóstico de `wibsite-helper`.

---

## 🛠️ Guía de Diagnóstico y Resolución Rápida de Errores

| Falla Detectada | Causa Raíz Probable | Solución |
|---|---|---|
| **Contenedor 'unhealthy' o 'exited'** | Proceso del servicio se cayó o no supera el healthcheck. | Executar `docker logs wibsite-<nombre>` y luego `docker compose up -d --force-recreate <nombre>`. |
| **Issuer OIDC es `http://authelia:9091` en vez de `https://localhost:8080`** | Nginx no está enviando `proxy_set_header Host "localhost:8080"` a Authelia. | Verificar `nginx.conf` en la ubicación `/auth/` y recargar con `docker exec wibsite-nginx nginx -s reload`. |
| **RLS Aislamiento Falla (se ven todos los registros)** | La consulta se ejecutó con el usuario `wibsite` (Superuser) o falta `FORCE ROW LEVEL SECURITY`. | Ejecutar `ALTER USER app_user NOSUPERUSER;` y `ALTER TABLE <tabla> FORCE ROW LEVEL SECURITY;`. |
| **n8n devuelve 404 en OIDC Callbacks** | `N8N_AUTH_METHOD` está en `oidc` sin tener una licencia Enterprise. | Cambiar en `docker-compose.yml` a `N8N_AUTH_METHOD: email` y recrear el contenedor `n8n`. |
| **MinIO OIDC no aparece habilitado** | Falta aplicar la configuración runtime vía `mc`. | Ejecutar `docker exec wibsite-minio sh -c "mc admin config set local identity_openid enable=on ..."` y reiniciar MinIO. |
