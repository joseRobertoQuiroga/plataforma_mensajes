# Playbook de Cambios — Cómo Modificar el Sistema

Este documento describe el proceso para realizar cambios en cada componente del stack Wibsite.

---

## 1. Cambios en Helper Node (`helper-node/index.js`)

### Propósito
Helper Node es el servicio Express.js que centraliza la lógica de campañas, scoring, webhooks y dashboard. Es el componente que más se modifica.

### Proceso

```bash
# 1. Editar el archivo fuente
code wibsite/helper-node/index.js    # o cualquier editor

# 2. Probar sintaxis
node --check helper-node/index.js    # debe salir sin errores

# 3. Reconstruir y reiniciar
docker compose build helper
docker compose up -d helper

# 4. Verificar health
curl http://localhost:3100/health

# 5. Verificar que no rompió nada
curl http://localhost:3100/api/dashboard/summary    # debe retornar JSON
curl http://localhost:3100/api/templates            # debe listar plantillas
```

### Reglas
- **SIEMPRE** usar `updateStore()` para mutar el store (nunca `saveStore()` directo ni mutación de arrays).
- **NO** romper compatibilidad backward con endpoints legacy (`/campaigns`, `/webhooks/whatsapp`).
- **NO** exponer secretos en logs o respuestas.
- **SI** agregas un endpoint nuevo, ponlo bajo `/api/*` y documéntalo en HELPER-NODE.md y ENDPOINTS.md.

### Agregar nuevo endpoint

```javascript
// 1. Definir ruta
app.post('/api/mi-endpoint', (req, res) => {
  try {
    const data = req.body;
    // ... lógica
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. NO usar app.get('*') o app.use() catch-all antes de las rutas.
// 3. El catch-all debe ser el ÚLTIMO middleware.
```

---

## 2. Cambios en Docker Compose (`docker-compose.yml`)

### Agregar un nuevo servicio

```yaml
services:
  mi-servicio:
    image: autor/imagen:tag
    container_name: wibsite-mi-servicio
    restart: unless-stopped
    environment:
      - VARIABLE=valor
    networks:
      - wibsite_default
    depends_on:
      - postgres
      - redis
```

### Agregar variable de entorno

```yaml
services:
  helper:
    environment:
      - MI_NUEVA_VAR=${MI_NUEVA_VAR:-default_value}
```

Luego agregar en `.env`:
```
MI_NUEVA_VAR=valor_real
```

### Aplicar cambios

```bash
docker compose up -d                    # levantar cambios
docker compose logs -f mi-servicio      # verificar logs
```

### Reglas
- **NO** hardcodear IPs o puertos. Usar nombres de servicio Docker.
- **NO** exponer puertos si el servicio solo se consume internamente.
- **SI** necesitas exponer un nuevo puerto al host, asegúrate de que no haya conflicto.

---

## 3. Cambios en Dify (Workflows)

### Workflow existente (WhatsApp Lead Classifier)

#### Vía UI (recomendado para pruebas)
1. Abrir `http://localhost:3003` → Studio → App `WhatsApp Lead Classifier`
2. Editar nodos LLM, prompts, outputs
3. Click "Run" para probar
4. Click "Publish" para publicar
5. Verificar vía API:

```bash
curl -X POST http://localhost:5001/v1/workflows/run \
  -H "Authorization: Bearer app-IohwPPX3HDWA46TQLEcGBZq0" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "message": "Hola, quiero precios",
      "conversation_history": "[]",
      "contact_name": "Test",
      "platform": "whatsapp"
    },
    "response_mode": "blocking",
    "user": "test"
  }'
```

#### Vía API (para cambios programáticos)
Se requiere login con cookies + CSRF token:

```python
# Login
import requests, base64, json

BASE = "http://localhost:5001/console/api"
session = requests.Session()

pwd = base64.b64encode(b"Admin@123").decode()
r = session.post(f"{BASE}/login", json={
    "email": "joserobertoquirogasalvador@gmail.com",
    "password": pwd
})

# Obtener y publicar draft
csrf = session.cookies.get("csrf_token")
app_id = "c7fdaa3c-d911-4cef-ae62-54bf206f2f78"

# 1. Obtener draft
r = session.get(f"{BASE}/apps/{app_id}/workflows/draft",
    headers={"X-CSRF-TOKEN": csrf})

# 2. Publicar
r = session.post(f"{BASE}/apps/{app_id}/workflows/publish",
    headers={"X-CSRF-TOKEN": csrf})

# Ver: C:\Users\joser\AppData\Local\Temp\opencode\fix_dify_workflow2.py
```

### Migrar de Code node a LLM node
Si un Code node falla (ej: sintaxis de template `{{#node_id.text#}}` no se reemplaza):
1. Reemplazar con nodo LLM
2. El prompt debe generar el mismo JSON que producía el código
3. No requiere sandbox

### Reglas
- **SIEMPRE** publicar después de editar (`/workflows/publish`).
- **NO** borrar el workflow si está en producción.
- **SI** cambias los outputs del End node, actualiza `docs/context/DIFY.md` y el script de prueba.

---

## 4. Cambios en n8n (Workflows)

### Bug conocido: Body parser roto en n8n 2.23.4
La REST API de n8n falla con JSON body parsing. **Workaround**: usar la UI para todo.

### Vía UI
1. Abrir `http://localhost:5679` → Login con `admin@wibsite.com` / `Wibsite2024!`
2. Ir a **Workflows**
3. Editar, duplicar o crear workflow
4. **IMPORTANTE**: Después de editar, Click **Save** → después toggle **Active**
5. Verificar en **Executions**

### Importar/Exportar workflow
- **Exportar**: En la UI, tres puntos → Download
- **Importar**: En la UI, tres puntos → Import from File
- **Archivos**: Se guardan en `wibsite/n8n/workflows/`

### Activar workflow vía BD (cuando API REST falla)

```sql
-- Conectarse a PostgreSQL de n8n
docker exec -it wibsite-postgres psql -U n8n -d n8n

-- Ver workflows
SELECT id, name, active FROM workflow_entity;

-- Activar workflow por ID
UPDATE workflow_entity SET active = true WHERE id = 'ID_DEL_WORKFLOW';

-- Verificar
SELECT id, name, active FROM workflow_entity WHERE active = true;

-- Nota: Al reiniciar n8n, los workflows activos se cargan y registran
--       sus webhooks automáticamente.
```

```bash
# Reiniciar n8n después de activar por BD
docker compose restart n8n
```

### Reglas
- **NO** usar REST API de n8n para operaciones que requieran JSON body (login sí funciona con form-urlencoded).
- **NO** cambiar el nombre de un nodo que ya está conectado a otros nodos.
- **SI** cambias URLs de webhook, actualiza también en Chatwoot o Meta.

---

## 5. Cambios en Documentación

### Estructura

```
docs/
  INDEX.md                          -- Índice maestro (este archivo lista todo)
  PLAYBOOK-CAMBIOS.md               -- Cómo hacer cambios (este archivo)
  CHECKLIST-MANTENIMIENTO.md        -- Mantenimiento periódico
  MEMORY.md                         -- ADR (decisiones técnicas)
  CHANGELOG.md                      -- Historial de versiones
  GLOSSARY.md                       -- Términos del dominio
  RUNBOOK.md                        -- Operaciones diarias y troubleshooting

  context/*
    ARCHITECTURE.md                 -- Diagrama y stack
    DIFY.md, N8N.md, ...           -- Contexto por módulo

  rag/*
    ENDPOINTS.md                    -- Todos los endpoints
    ENVIRONMENT-VARIABLES.md        -- Variables de entorno
    CREDENTIALS-REFERENCE.md        -- Credenciales
    DATA-FLOW.md                    -- Flujos de datos
    DEPENDENCY-MATRIX.md            -- Dependencias entre servicios
    ARCHITECTURE-OVERVIEW.md        -- Vista general RAG

    decisions/                      -- ADRs individuales (opcional)
```

### Reglas
- **Un archivo por concepto**. No mezclar.
- **context/**: describe el qué y el por qué de un módulo.
- **rag/**: describe datos concretos (endpoints, variables, flujos).
- **Actualizar INDEX.md** cada vez que agregues un archivo.
- **Actualizar CHANGELOG.md** con cada cambio significativo.
- **Actualizar MEMORY.md** con cada decisión técnica relevante.

---

## 6. Agregar un Nuevo Servicio Docker

```bash
# 1. Editar docker-compose.yml
#    - Agregar service definition
#    - Si expone puerto, agregar a nginx.conf
#    - Si necesita BD, agregar init-db.sql

# 2. Editar .env si requiere variables

# 3. Reconstruir y levantar
docker compose up -d

# 4. Verificar health check
curl http://localhost:NUEVO_PUERTO/health

# 5. Agregar a SOURCE_INDEX.md y DEPENDENCY-MATRIX.md

# 6. Agregar health check al demo script
#    Archivo: C:\Users\joser\AppData\Local\Temp\opencode\demo-mvp.ps1
```

---

## 7. Rollback

### Helper Node
```bash
# Reconstruir versión anterior
git checkout HEAD~1 -- helper-node/index.js
docker compose build helper
docker compose up -d helper
```

### Docker Compose
```bash
# Revertir cambios
git checkout docker-compose.yml .env
docker compose up -d
```

### Dify Workflow
- En UI: Historial de versiones → restaurar versión anterior
- O re-importar YAML respaldo

### n8n Workflow
- En UI: Workflows → "Workflow History" → restaurar
- O re-importar desde archivo `.json` de respaldo

---

## 8. Configuración de SPAs detrás de nginx (subpath)

### Problema
Los SPAs (n8n, Twenty, Chatwoot, Dify) generan HTML con rutas ABSOLUTAS a sus assets JS/CSS (`/assets/...`, `/vite/assets/...`, `/_next/...`). Cuando se accede vía nginx bajo un subpath (`/n8n/`, `/crm/`, `/chatwoot/`), el navegador solicita esos assets a la RAÍZ del dominio (`localhost:8080/assets/...`) donde nginx no los sirve → 404 → SPA no carga.

### Solución por servicio

#### Dify Web → `/_next/` + rutas internas
Dify Web (Next.js) ya tiene rutas internas (`/_next/*`, `/auth/*`, `/apps/*`, etc.). Se agregaron locations en nginx para proxyar esas rutas a `dify-web:3000`.
```nginx
location /_next/     { proxy_pass http://dify-web:3000; }
location /auth/      { proxy_pass http://dify-web:3000; }
location /apps/      { proxy_pass http://dify-web:3000; }
# ... ver nginx.conf completo
```

#### n8n → `N8N_PATH=/n8n/`
n8n soporta la variable `N8N_PATH` que hace que genere HTML con paths prefijados (`/n8n/assets/...`, `/n8n/static/...`, con `BASE_PATH=/n8n/` para API calls).
```yaml
# docker-compose.yml
n8n:
  environment:
    N8N_PATH: /n8n/
```
El nginx location `/n8n/` con `rewrite ^/n8n/(.*) /$1 break;` se encarga del resto.

#### Twenty CRM → assets a nivel raíz
Twenty no soporta subpath en runtime (Vite build-time). Se agregaron locations raíz para sus assets:
```nginx
location /assets/ { proxy_pass http://twenty-server:3000; }
location /images/ { proxy_pass http://twenty-server:3000; }
```
El HTML de Twenty referencia `/assets/...` directamente; el browser solicita a raíz, nginx proxy a Twenty. API calls van directo a `http://localhost:3001` (configurado en `window._env_.REACT_APP_SERVER_BASE_URL`).

#### Chatwoot → assets raíz + regex API
Chatwoot usa `/vite/assets/...` para JS/CSS y `/brand-assets/...` para logos. Se agregaron locations raíz:
```nginx
location /vite/          { proxy_pass http://chatwoot:3000; }
location /brand-assets/  { proxy_pass http://chatwoot:3000; }
```
Además, las llamadas API del frontend van a `/api/v1/*` a nivel raíz. Se agregó regex location antes de Helper API:
```nginx
location ~ ^/api/v1/ { proxy_pass http://chatwoot:3000; }
```

### Reglas
- **NO** usar `sub_filter` de nginx (no funciona confiablemente con nginx:1.27-alpine).
- **SI** un servicio soporta subpath nativo (como n8n con `N8N_PATH`), usarlo.
- **SI** no soporta subpath, agregar locations raíz para SUS paths específicos.
- **VERIFICAR** que no haya conflictos: dos servicios no pueden usar el mismo path raíz.
- Después de cambiar nginx.conf, ejecutar `docker exec wibsite-nginx nginx -s reload` para recargar.

---

## 9. Pruebas Post-Cambio

### Reinicio después de cambios en nginx o docker-compose

```bash
# Después de cambiar nginx.conf
docker exec wibsite-nginx nginx -t     # verificar sintaxis
docker exec wibsite-nginx nginx -s reload  # recargar sin downtime

# Después de cambiar docker-compose.yml (ej: agregar variable a n8n)
docker compose up -d servicio_afectado

# Después de rebuild (ej: helper)
docker compose build helper
docker compose up -d helper
```

Siempre ejecutar después de cualquier cambio:

```bash
# 1. Health checks directos
curl -s http://localhost:3100/health
curl -s http://localhost:5001/health
curl -s http://localhost:5679/healthz
curl -s http://localhost:3001/healthz
curl -s http://localhost:3002/health
curl -s http://localhost:8194/health

# 2. Servicios vía nginx (SPA HTML + assets clave)
curl -s -o /dev/null -w "hub=%{http_code} " http://localhost:8080/hub/
curl -s -o /dev/null -w "dify=%{http_code} " http://localhost:8080/dify/
curl -s -o /dev/null -w "n8n=%{http_code} " http://localhost:8080/n8n/
curl -s -o /dev/null -w "n8n-asset=%{http_code} " http://localhost:8080/n8n/assets/index-BQ3Sn2Ox.js
curl -s -o /dev/null -w "n8n-basepath=%{http_code} " http://localhost:8080/n8n/static/base-path.js
curl -s -o /dev/null -w "twenty=%{http_code} " http://localhost:8080/crm/
curl -s -o /dev/null -w "twenty-asset=%{http_code} " http://localhost:8080/assets/index-CUHVUKDv.js
curl -s -o /dev/null -w "chatwoot=%{http_code} " http://localhost:8080/chatwoot/
curl -s -o /dev/null -w "chatwoot-asset=%{http_code} " http://localhost:8080/vite/assets/dashboard-dYuxRZ8s.js
curl -s -o /dev/null -w "api=%{http_code} " http://localhost:8080/api/health
curl -s -o /dev/null -w "admin=%{http_code} " http://localhost:8080/admin/
echo ""

# 3. Dashboard summary
curl -s http://localhost:3100/api/dashboard/summary | python -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('campaigns') else 'FAIL')"

# 4. LLM health
curl -s http://localhost:3100/api/llm/health

# 5. Demo completo (si hay cambios mayores)
powershell -ExecutionPolicy Bypass -File "$env:TEMP\opencode\demo-mvp.ps1"
```
