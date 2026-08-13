# Plan de integración — Observabilidad, errores, storage y BI para Wibsite Business

> Instalación y conexión detallada de: Prometheus + cAdvisor + Grafana, GlitchTip (alternativa liviana a Sentry), MinIO, Metabase y Flowbite.
> Sigue el orden de fases ya definido: visibilidad → errores → storage → BI. Flowbite corre en paralelo, sin dependencias.

---

## 0. Prerrequisito

Todo lo que sigue asume que ya existe el guardián de entrada (Authelia u oauth2-proxy) delante de Nginx. Cada UI nueva (Grafana, GlitchTip, consola de MinIO, Metabase) se agrega **detrás** de esa capa de auth, no como excepción.

Agregar en `.env` (nuevas variables, sumadas a las existentes):

```env
# Grafana
GRAFANA_ADMIN_PASSWORD=cambiar_esto

# GlitchTip
GLITCHTIP_SECRET_KEY=generar_con_openssl_rand_hex_32
GLITCHTIP_DOMAIN=http://localhost:8080/glitchtip
GLITCHTIP_DB_PASSWORD=cambiar_esto

# MinIO
MINIO_ROOT_USER=wibsite_admin
MINIO_ROOT_PASSWORD=cambiar_esto_32_chars
MINIO_BUCKET=wibsite-media

# Metabase
MB_DB_PASS=${POSTGRES_PASSWORD}
```

---

## 1. Prometheus + cAdvisor + Grafana (Observabilidad)

**Objetivo:** ver CPU/RAM/latencia de cada contenedor en tiempo real, antes de tocar cualquier otra pieza.

Prometheus por sí solo no lee métricas de Docker — necesita **cAdvisor** como fuente. Sin cAdvisor, Prometheus queda instalado pero vacío.

### docker-compose.yml — agregar

```yaml
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: wibsite-cadvisor
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    networks:
      - wibsite-network
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    container_name: wibsite-prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=15d'
    networks:
      - wibsite-network
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: wibsite-grafana
    environment:
      - GF_SERVER_ROOT_URL=%(protocol)s://%(domain)s/grafana/
      - GF_SERVER_SERVE_FROM_SUB_PATH=true
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - wibsite-network
    restart: unless-stopped
```

Agregar a `volumes:` al final del archivo: `prometheus_data:` y `grafana_data:`.

### monitoring/prometheus.yml (archivo nuevo)

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
  - job_name: 'helper'
    static_configs:
      - targets: ['helper:3100']
    metrics_path: /metrics
```

`helper:3100` con `/metrics` requiere sumar `prom-client` al Helper Node (una línea de middleware Express) para exponer métricas propias de negocio (requests por endpoint, tiempo de sync a Twenty) además de las de infraestructura que ya da cAdvisor. Es opcional para el arranque — cAdvisor solo ya te da visibilidad de infraestructura.

### nginx.conf — agregar

```nginx
location /grafana/ {
    auth_request /auth;
    proxy_pass http://grafana:3000/;
    proxy_set_header Host $host;
}
```

### Verificación

```bash
docker compose up -d cadvisor prometheus grafana
curl -o /dev/null -sw '%{http_code}' http://localhost:9090/-/healthy   # Prometheus: 200
curl -o /dev/null -sw '%{http_code}' http://localhost:3000/api/health  # Grafana: 200
```

Entrar a Grafana → Connections → Data sources → Prometheus → URL `http://prometheus:9090` → Save & Test.

### Local vs producción

| | Local | Producción |
|---|---|---|
| Retención | 3-5 días (`--storage.tsdb.retention.time=5d`) | 15-30 días |
| Alertas | Desactivadas | Activas (contact point a Telegram/email vía Grafana Alerting) |
| Volúmenes | Efímeros, se pueden borrar | Persistentes con backup periódico |

---

## 2. GlitchTip (en lugar de Sentry self-hosted)

**Nota técnica importante:** Sentry self-hosted "completo" requiere ~14 servicios (Kafka, ClickHouse, Zookeeper, Snuba) — es una infraestructura pensada para escala enterprise, desproporcionada para tu stack actual. **GlitchTip** es open source, mucho más liviano (3 contenedores), y **usa el mismo SDK y el mismo protocolo que Sentry** — tu código no cambia si algún día decidís migrar al Sentry completo.

**Objetivo:** capturar errores del Helper Node con contexto (endpoint, usuario, payload) antes de que el cliente los reporte.

### docker-compose.yml — agregar

```yaml
  glitchtip-postgres:
    image: postgres:15
    container_name: wibsite-glitchtip-db
    environment:
      - POSTGRES_DB=glitchtip
      - POSTGRES_USER=glitchtip
      - POSTGRES_PASSWORD=${GLITCHTIP_DB_PASSWORD}
    volumes:
      - glitchtip_db_data:/var/lib/postgresql/data
    networks:
      - wibsite-network
    restart: unless-stopped

  glitchtip-redis:
    image: redis:7-alpine
    container_name: wibsite-glitchtip-redis
    networks:
      - wibsite-network
    restart: unless-stopped

  glitchtip:
    image: glitchtip/glitchtip:latest
    container_name: wibsite-glitchtip
    environment:
      - DATABASE_URL=postgres://glitchtip:${GLITCHTIP_DB_PASSWORD}@glitchtip-postgres:5432/glitchtip
      - REDIS_URL=redis://glitchtip-redis:6379/0
      - SECRET_KEY=${GLITCHTIP_SECRET_KEY}
      - GLITCHTIP_DOMAIN=${GLITCHTIP_DOMAIN}
      - EMAIL_URL=consolemail://
      - ENABLE_OPEN_USER_REGISTRATION=false
    depends_on:
      - glitchtip-postgres
      - glitchtip-redis
    networks:
      - wibsite-network
    restart: unless-stopped

  glitchtip-worker:
    image: glitchtip/glitchtip:latest
    container_name: wibsite-glitchtip-worker
    command: ./manage.py runworker
    environment:
      - DATABASE_URL=postgres://glitchtip:${GLITCHTIP_DB_PASSWORD}@glitchtip-postgres:5432/glitchtip
      - REDIS_URL=redis://glitchtip-redis:6379/0
      - SECRET_KEY=${GLITCHTIP_SECRET_KEY}
    depends_on:
      - glitchtip
    networks:
      - wibsite-network
    restart: unless-stopped
```

Agregar a `volumes:`: `glitchtip_db_data:`.

### nginx.conf — agregar

```nginx
location /glitchtip/ {
    auth_request /auth;
    proxy_pass http://glitchtip:8000/;
    proxy_set_header Host $host;
}
```

### Conexión con Helper Node

1. Crear cuenta admin: `docker exec -it wibsite-glitchtip ./manage.py createsuperuser`
2. Entrar a GlitchTip → crear proyecto "wibsite-helper" → copiar el DSN que genera.
3. En `helper-node/package.json`: agregar dependencia `@sentry/node` (el SDK de Sentry es compatible con GlitchTip).
4. En `helper-node/index.js`, al inicio del archivo:

```javascript
const Sentry = require("@sentry/node");
Sentry.init({ dsn: process.env.GLITCHTIP_DSN, tracesSampleRate: 0.2 });
app.use(Sentry.Handlers.requestHandler());
// ... rutas existentes ...
app.use(Sentry.Handlers.errorHandler()); // después de todas las rutas, antes del error handler final
```

5. Agregar `GLITCHTIP_DSN=<el DSN copiado>` al `.env` del Helper.

### Verificación

```bash
curl -o /dev/null -sw '%{http_code}' http://localhost:8080/glitchtip/ # 200 tras login
```

Forzar un error de prueba en el Helper y confirmar que aparece en el proyecto de GlitchTip.

### Local vs producción

| | Local | Producción |
|---|---|---|
| `tracesSampleRate` | 1.0 (capturar todo mientras desarrollás) | 0.1-0.2 (evitar sobrecarga con tráfico real) |
| Notificaciones | Ninguna | Webhook a Telegram/Slack por cada error nuevo (se configura en el proyecto de GlitchTip) |
| `ENABLE_OPEN_USER_REGISTRATION` | Puede ser `true` para probar rápido | Siempre `false` — solo vos das de alta usuarios |

---

## 3. MinIO (almacenamiento de archivos)

**Objetivo:** un lugar único para adjuntos (imágenes de WhatsApp, comprobantes, logos de campaña), en vez de disco local disperso.

### docker-compose.yml — agregar

```yaml
  minio:
    image: minio/minio:latest
    container_name: wibsite-minio
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    networks:
      - wibsite-network
    restart: unless-stopped
```

Agregar a `volumes:`: `minio_data:`.

### nginx.conf — agregar

```nginx
# API S3 (uso máquina a máquina desde Helper Node — NO va detrás de auth_request,
# rompería la firma de las requests S3)
location /storage/ {
    proxy_pass http://minio:9000/;
    proxy_set_header Host $host;
}

# Consola web de administración — sí va detrás del guardián
location /minio-console/ {
    auth_request /auth;
    proxy_pass http://minio:9001/;
    proxy_set_header Host $host;
}
```

### Conexión con Helper Node

1. Entrar a la consola (`/minio-console/`) y crear el bucket `wibsite-media`, o vía CLI:

```bash
docker exec wibsite-minio mc alias set local http://localhost:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}
docker exec wibsite-minio mc mb local/wibsite-media
```

2. En `helper-node/package.json`: agregar dependencia `minio` (cliente oficial, compatible con S3).
3. Ejemplo de uso en el Helper para subir un archivo recibido:

```javascript
const Minio = require('minio');
const minioClient = new Minio.Client({
  endPoint: 'minio',
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD
});

async function uploadFile(buffer, filename, mimetype) {
  await minioClient.putObject(process.env.MINIO_BUCKET, filename, buffer, { 'Content-Type': mimetype });
  return `/storage/${process.env.MINIO_BUCKET}/${filename}`;
}
```

### Verificación

```bash
curl -o /dev/null -sw '%{http_code}' http://localhost:9000/minio/health/live  # 200
```

Subir un archivo de prueba desde la consola y confirmar que aparece en el bucket.

### Local vs producción

| | Local | Producción |
|---|---|---|
| Volumen | Puede recrearse sin drama | Persistente, con backup periódico (`mc mirror` a un segundo destino, o snapshot del volumen) |
| Acceso | Root user directo | Crear un usuario de servicio con permisos limitados solo al bucket `wibsite-media` (Access → Users en la consola), en vez de usar el root user desde el Helper |
| Retención | Sin política | Definir cuánto tiempo se guardan adjuntos de leads que nunca convirtieron (lifecycle policy en el bucket) |

---

## 4. Metabase (reportes y BI)

**Objetivo:** convertir los datos que ya generás (campañas, scoring, leads) en reportes que el cliente puede ver directamente.

**Prerrequisito real:** este paso rinde recién cuando el Helper Node ya escribe en PostgreSQL con el schema Lumi (`organization_id` + tablas normalizadas) en vez del JSON store plano — Metabase arma reportes sobre datos estructurados, no sobre un archivo JSON.

### Base de datos — agregar a scripts/init-db.sql

```sql
CREATE DATABASE metabase;
```

### docker-compose.yml — agregar

```yaml
  metabase:
    image: metabase/metabase:latest
    container_name: wibsite-metabase
    environment:
      - MB_DB_TYPE=postgres
      - MB_DB_DBNAME=metabase
      - MB_DB_PORT=5432
      - MB_DB_USER=${POSTGRES_USER}
      - MB_DB_PASS=${MB_DB_PASS}
      - MB_DB_HOST=postgres
    networks:
      - wibsite-network
    restart: unless-stopped
```

### nginx.conf — agregar

```nginx
location /reportes/ {
    auth_request /auth;
    proxy_pass http://metabase:3000/;
    proxy_set_header Host $host;
}
```

### Conexión con la base de datos de negocio

1. Antes de conectar Metabase a `wibsite` (la base con el schema Lumi), crear un **rol de solo lectura** en Postgres — Metabase no necesita ni debe poder escribir:

```sql
CREATE ROLE metabase_reader WITH LOGIN PASSWORD 'otro_password_distinto';
GRANT CONNECT ON DATABASE wibsite TO metabase_reader;
GRANT USAGE ON SCHEMA public TO metabase_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metabase_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO metabase_reader;
```

2. En Metabase (`/reportes/`) → Admin → Databases → Add database → Postgres → host `postgres`, base `wibsite`, usuario `metabase_reader`.
3. Armar el primer dashboard: campañas activas, leads por estado (hot/warm/cold), tasa de respuesta por canal — todo ya existe en tus tablas.
4. Para exponer un dashboard a un cliente sin que vea datos de otros: usar "Sandboxing" de Metabase filtrando por `organization_id`, o generar un dashboard público filtrado (`Sharing → Public link`) por cliente.

### Verificación

```bash
curl -o /dev/null -sw '%{http_code}' http://localhost:3000/api/health  # 200
```

### Local vs producción

| | Local | Producción |
|---|---|---|
| Datos | Seed data de prueba | Datos reales — por eso el rol de solo lectura no es opcional |
| Acceso | Vos como único usuario | Un usuario de Metabase por cliente, con sandboxing por `organization_id` |
| Dashboards públicos | No usar | Solo si el link está filtrado por tenant — nunca un dashboard público sin filtro |

---

## 5. Flowbite (componentes UI) — sin dependencias, en paralelo

**Objetivo:** dar consistencia visual al dashboard actual sin migrar de framework.

### Instalación

En `helper-node/public/`, agregar el CDN de Flowbite (no requiere build ni npm si el dashboard sigue siendo HTML/JS puro):

```html
<link href="https://cdn.jsdelivr.net/npm/flowbite@2.5.2/dist/flowbite.min.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/flowbite@2.5.2/dist/flowbite.min.js"></script>
```

Requiere Tailwind CSS ya configurado (si el dashboard no lo tiene, sumar el CDN de Tailwind también: `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>` para desarrollo rápido, o build propio para producción).

### Integración recomendada (orden sugerido de migración de componentes)

1. Badges de estado de campaña (draft/scheduled/sending/completed) → `Flowbite Badge`.
2. Modales de import/seed/templates → `Flowbite Modal`.
3. Tabla de leads con scores → `Flowbite Table` + `Flowbite Progress Bar` para el score visual.
4. LEDs de canal → mantener el custom actual (Flowbite no tiene un componente equivalente directo) o adaptarlo con `Flowbite Badge` + `Flowbite Tooltip`.

No hay diferencia entre local y producción para esta pieza — es el mismo código servido en ambos entornos, sin infraestructura adicional.

---

## 6. Orden de ejecución para levantar todo junto

```bash
# Fase 1
docker compose up -d cadvisor prometheus grafana

# Fase 2
docker compose up -d glitchtip-postgres glitchtip-redis glitchtip glitchtip-worker

# Fase 3
docker compose up -d minio

# Fase 4 (después de migrar Helper Node al schema Lumi)
docker compose up -d metabase

# Nginx al final, para que resuelva todas las rutas nuevas
docker compose restart nginx
```

## 7. Checklist final antes de dar por cerrada la integración

- [ ] Los 4 paneles nuevos (`/grafana/`, `/glitchtip/`, `/minio-console/`, `/reportes/`) piden login vía el guardián de entrada, no acceso directo.
- [ ] Grafana muestra métricas reales de los contenedores existentes (Chatwoot, n8n, Dify, Twenty, Helper).
- [ ] Un error forzado en el Helper Node aparece en GlitchTip con contexto completo.
- [ ] Un archivo subido de prueba aparece en el bucket de MinIO y es accesible vía `/storage/`.
- [ ] Metabase conecta a `wibsite` con el rol `metabase_reader` (no con el usuario admin de Postgres).
- [ ] Al menos un componente del dashboard actual fue migrado a Flowbite como prueba de concepto.
- [ ] Todos los volúmenes nuevos (`prometheus_data`, `grafana_data`, `glitchtip_db_data`, `minio_data`) están declarados en la sección `volumes:` del `docker-compose.yml`.
- [ ] `.env` actualizado con todas las variables nuevas y sin valores por defecto en producción.
