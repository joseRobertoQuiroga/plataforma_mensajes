# Wibsite Business — Runbook

## 1. Inicio Rápido

```bash
# Levantar todo el stack
cd wibsite
docker compose up -d

# Ver estado
docker compose ps

# Logs de todos los servicios
docker compose logs -f

# Logs de un servicio específico
docker compose logs -f helper n8n dify-api
```

## 2. Diagnóstico

### Verificar que cada servicio funciona
```bash
# Helper (v2)
curl http://localhost:3100/health

# Dashboard
open http://localhost:3100

# Dify API
curl http://localhost:5001/health

# n8n
curl http://localhost:5679/healthz

# Twenty CRM
curl http://localhost:3001/healthz

# Chatwoot
curl http://localhost:3002/health

# Nginx (punto de entrada unificado)
curl http://localhost:8080/health
```

### Verificar Nginx (rutas hub)
```bash
# Hub principal
curl -o /dev/null -sw '%{http_code}' http://localhost:8080/hub/
# Esperado: 200

# Admin dashboard (vía nginx)
curl -o /dev/null -sw '%{http_code}' http://localhost:8080/admin/
# Esperado: 200

# Dify (vía nginx)
curl -o /dev/null -sw '%{http_code}' http://localhost:8080/dify/
# Esperado: 307 (redirect a /dify/login)

# n8n (vía nginx)
curl -o /dev/null -sw '%{http_code}' http://localhost:8080/n8n/
# Esperado: 200

# Twenty CRM (vía nginx)
curl -o /dev/null -sw '%{http_code}' http://localhost:8080/crm/
# Esperado: 200

# Chatwoot (vía nginx — puede ser 502 si caído)
curl -o /dev/null -sw '%{http_code}' http://localhost:8080/chatwoot/
# Esperado: 200 (o 502 si chatwoot caído)
```

### Verificar conexión a PostgreSQL
```bash
docker exec wibsite-postgres psql -U wibsite -d wibsite -c "SELECT current_database(), version();"
```

### Verificar plugins de Dify instalados
```bash
# Login primero (email en Base64)
PASS=$(echo -n 'Admin@123' | base64)
curl -X POST http://localhost:5001/console/api/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"joserobertoquirogasalvador@gmail.com\",\"password\":\"$PASS\"}" \
  -c /tmp/dify_cookies.txt

# Listar providers
curl http://localhost:5001/console/api/workspaces/current/plugin/providers \
  -b /tmp/dify_cookies.txt
```

### Verificar workflows n8n
```bash
# Login
curl -X POST http://localhost:5679/rest/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrLdapLoginId":"admin@wibsite.com","password":"Admin@123"}' \
  -c /tmp/n8n_cookies.txt

# Listar workflows
curl http://localhost:5679/rest/workflows -b /tmp/n8n_cookies.txt
```

## 3. Problemas Comunes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| Chatwoot se reinicia en loop | Falta migración DB o base de datos no creada | `docker compose logs chatwoot` para ver error exacto. Asegurar que `init-db.sql` creó `chatwoot` DB |
| n8n login falla | Se usó `email` en vez de `emailOrLdapLoginId` | Cambiar campo a `emailOrLdapLoginId` |
| Dify plugin no aparece | Plugin-daemon no conectado o marketplace no accesible | Verificar `PLUGIN_DAEMON_KEY` coincide en dify-api y plugin-daemon |
| Helper no arranca | Express 5 incompatible con `app.get('*')` | Usar `app.use()` en vez de `app.get('*')` para catch-all |
| xAI Grok validation falla | El equipo xAI no tiene créditos | Recargar créditos en cuenta xAI. Mientras, usar OpenAI u otro provider |
| n8n workflow import 400 | Conexiones referencian nodo inexistente | Verificar nombres de nodos en `connections` vs `nodes` del JSON |
| n8n workflow delete 400 | n8n requiere archivar antes de borrar | Desactivar workflow, luego usar PATCH para archivar, luego DELETE |
| Twenty no responde | Primera vez requiere setup manual | Abrir http://localhost:3001 y crear workspace |
| Twenty sync falla 400 INVALID_PHONE_NUMBER | Teléfono sin prefijo `+` | Twenty requiere formato internacional con `+`. El helper normaliza automáticamente |
| Twenty custom fields no aparecen | Namespace global — nombre duplicado en otro objeto | Usar prefijo `lead` para nombres conflictivos (leadScoreHistory, leadLastScore, etc.) |
| Webhook Meta no llega | META_APP_ID vacío o URL no configurada | Configurar credenciales en .env y registrar webhook en Meta Developer Console |
| helper-node no conecta PostgreSQL | Database `wibsite` no existe | Ejecutar init-db.sql o crear manualmente: `CREATE DATABASE wibsite;` |
| Excel upload falla con archivo >1MB | multer default limit 1MB | Ya resuelto — límite aumentado a 20MB |
| Excel upload lento (>1000 filas) | JSON file store sin índice | 2000 filas en 0.13s — rendimiento aceptable. Con PostgreSQL será más rápido |
| UTF-8 en Excel upload se ve corrupto | Terminal muestra encoding incorrecto | Los datos se almacenan correctamente en UTF-8. Es problema de visualización |
| Nginx error host not found | Chatwoot caído y proxy_pass sin resolver | Ya resuelto con `resolver 127.0.0.11` + variable `$chatwoot_upstream` en nginx.conf v2 |
| Seed data no aparece en dashboard | Dashboard cachea en cliente (15s auto-refresh) | Esperar refresh o recargar página manualmente |

## 4. Backup y Restore

### PostgreSQL
```bash
# Backup de todas las databases
docker exec -t wibsite-postgres pg_dumpall -U wibsite > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup de una database específica
docker exec -t wibsite-postgres pg_dump -U wibsite -d wibsite > backup_wibsite.sql

# Restore
cat backup.sql | docker exec -i wibsite-postgres psql -U wibsite
```

### JSON Store (helper-node fallback)
```bash
cp wibsite/helper-node/wibsite-store.json backup-store.json
```

## 5. Logs

| Servicio | Comando |
|----------|---------|
| Todos | `docker compose logs -f` |
| Helper | `docker compose logs -f helper` |
| n8n | `docker compose logs -f n8n` |
| Dify API | `docker compose logs -f dify-api` |
| Dify Worker | `docker compose logs -f dify-worker` |
| Plugin Daemon | `docker compose logs -f plugin-daemon` |
| Chatwoot | `docker compose logs -f chatwoot` |
| Twenty | `docker compose logs -f twenty-server` |
| Nginx | `docker compose logs -f nginx` |
| PostgreSQL | `docker compose logs -f postgres` |

## 6. Reinicio de Servicios

Orden correcto (respetar dependencias):

```bash
# 1. Infraestructura
docker compose restart postgres redis

# 2. Vector store
docker compose restart weaviate t2v-transformers

# 3. Apps principales (esperar que postgres esté healthy)
docker compose restart chatwoot dify-api dify-worker dify-web plugin-daemon n8n twenty-server helper

# 4. Proxy
docker compose restart nginx

# O todo junto (Docker se encarga del orden)
docker compose restart
```

## 7. Actualización

```bash
# Actualizar imágenes
docker compose pull

# Reconstruir imágenes custom (helper-node)
docker compose build helper

# Aplicar cambios
docker compose up -d
```

## 8. Datos Útiles

### URLs vía Nginx (recomendado)
- **Hub central**: http://localhost:8080/ → redirect a /hub/
- **Hub principal (cards)**: http://localhost:8080/hub/
- **Dashboard monitoreo**: http://localhost:8080/admin/
- **Dify Web**: http://localhost:8080/dify/
- **n8n**: http://localhost:8080/n8n/
- **Chatwoot**: http://localhost:8080/chatwoot/
- **Twenty CRM**: http://localhost:8080/crm/
- **Helper API base**: http://localhost:8080/api/

### URLs directas
- **Dashboard monitoreo**: http://localhost:3100
- **Dify Web**: http://localhost:3003
- **n8n**: http://localhost:5679
- **Chatwoot**: http://localhost:3002
- **Twenty CRM**: http://localhost:3001
- **Helper API base**: http://localhost:3100/api/
- **PostgreSQL**: localhost:5432 (user: wibsite, pass: wibsite_pass)

### Endpoints útiles
- **Seed data**: POST http://localhost:3100/api/seed
- **Limpiar datos**: DELETE http://localhost:3100/api/seed
- **Subir Excel leads**: POST http://localhost:3100/api/campaigns/:id/leads/upload (multipart/form-data, field: file)
- **Evaluar scoring**: POST http://localhost:3100/api/scoring/evaluate (body: {lead_id})
- **Scoring masivo**: POST http://localhost:3100/api/scoring/evaluate-all
- **Sync Twenty**: POST http://localhost:3100/api/twenty/sync (body: {lead_id})
- **Sync Twenty masivo**: POST http://localhost:3100/api/twenty/sync-all
- **Plantillas**: GET http://localhost:3100/api/templates
- **Chat LLM**: POST http://localhost:3100/api/llm/chat
- **Scoring LLM**: POST http://localhost:3100/api/scoring/evaluate-llm
- **Health LLM**: GET http://localhost:3100/api/llm/health
