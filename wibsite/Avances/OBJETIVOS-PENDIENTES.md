# OBJETIVOS PENDIENTES — Por Completar

> Priorizado por impacto y dependencias — Última actualización: 2026-08-12
> Fuente de verdad de fases: `docs/tecnica/TEC-06-FASES-IMPLEMENTACION.md` §5 (34/56 fases ✅ · 22 ⬜) · Gaps: `docs/GAPS-MINIFASES.md`

---

## ✅ LO QUE YA HAY (implementado y verificado en docs/código)

### Infraestructura (20 servicios docker-compose)
- Solo Docker, ningún orquestador superior · PostgreSQL 15 + pgvector (5 BD), Redis 7, Weaviate 1.26.1 + t2v-transformers
- **Elastic Stack**: Elasticsearch 9.4.2 + Kibana + OTel Collector (sustituye Prometheus/Grafana/GlitchTip) · MinIO · Authelia 4.37 (config + nginx auth_request)
- Nginx unificado :8080 con rutas /hub/, /chatwoot/, /dify/, /n8n/, /crm/, /kibana/, /minio-console/ + security headers
- Backups PostgreSQL (`backup.sh`) y verificación unificada (`verify-fase.sh`, TEC-06 F-34/F-41/F-55)

### Helper Node (~108 rutas · package.json v2.1.1)
- CRUD campañas multi-canal + leads + Excel/CSV + tracking + scoring (rule-based + LLM) + 11 plantillas
- Middleware seguridad: API Key, rate limit, sanitizador 23 patrones, HMAC webhooks + PII filter + auditLogger 12 event types
- ConversationStore (9 estados), Lead Profile Builder, Agent Config (10 rubros/5 personalidades), RAG Weaviate + fallback, Anti-Hallucination, SLI/SLO, templateEngine + validador, agentCore (POC F-13), dual write JSON+PG (F-07/F-08)
- Dashboard SPA + `hub/control-center.html` (portal shell /hub/, F-43/F-44)

### Canal real y módulos
- **Bridge Twilio operativo** (F-03…F-06, F-24): inbound, broadcast + StatusCallback, typing, opt-out duro → reemplaza Meta
- Dify: workflow clasificador 8 nodos LLM con OpenRouter (7 modelos) · n8n: 3 workflows activos en BD · Twenty: 10 campos custom + sync 12/12 · SPICED/MEDDIC 13 campos · plantillas comercial: objeciones 8, temperatura + decay, cadencia 8 intentos, handoff (F-19…F-23)

### Verificación y documentación
- 112 tests unitarios (8 suites) + 15 contract + 174 documentados · auditoría integral 78 checks OK (2026-08-03) · suite TeVS creada (11 tests + runner + ILM + alertas + dashboard)
- 100+ docs: capa contextual (CTX-01…07), técnica (TEC-01…06), maestro RAG (68 entradas, 33✅), GAPS-MINIFASES

---

## 🚨 P0 — Bloqueantes para el siguiente hito

| # | Objetivo | TEC-06 | Detalle |
|---|----------|--------|---------|
| 1 | **Verificar stack en vivo** | — | Docker Desktop estuvo detenido el 2026-08-12: `docker compose up -d` + `docker compose ps` + checks de ESTADO-GENERAL |
| 2 | **Rotación de secretos reales** | F-32 | HELPER_API_KEY débil/`"test"` hardcodeada en `nginx.conf:214`; ELASTIC_PASSWORD hardcodeada en `otel-collector/config.yaml`; regenerar todos los `<generar>` de `.env.example` |
| 3 | **Ejecutar suite TeVS por primera vez** | F-36/38 | `scripts/tevs/tevs-runner.ps1` — 11 tests creados, 0 ejecuciones registradas |
| 4 | **Limpieza de secreto/PII en git** | F-35 | `wibsite-store.json` (PII 2.4 MB), `certs/nginx.key`, `n8n-cookies*.txt`, `n8n_login.json`, `%{redirect_url}'` → .gitignore + purge histórico |
| 5 | **Cutover PG primario + multi-tenant** | F-09, F-10, F-11 | Migración JSON→PG completa, `tenant_id`+RLS, middleware tenantContext (gated: F-09) |

## 🔴 P1 — Funcionalidad core

| # | Objetivo | TEC-06 | Detalle |
|---|----------|--------|---------|
| 6 | ~~Motor agéntico completo~~ ✅ 2026-08-12 | F-14, F-16, F-17, F-18 | Checkpointer memoria profunda (F-14), grafo 9 nodos (F-16), guardas confidencialidad/autonomía (F-17), Dify como nodo + fallback (F-18) — implementado con grafo propio (fallback permitido por F-13) |
| 7 | ~~Sync máquinas comercial ↔ técnica~~ ✅ 2026-08-12 | F-21 | commercialState.js con MAP comercial↔técnico + hook en onTransition (dep F-16/F-20 ok) |
| 8 | Re-auditoría de seguridad completa | F-35 | Ejecutar con los gaps cerrados (depende F-31, F-32, F-33) |
| 9 | CI con gates | F-42 | `.github/workflows/tevs-validation.yml` y `.gitlab-ci.yml` existen pero asumen URLs internas inexistentes (depende F-41) |
| 10 | Trazabilidad E2E sin pérdida | F-46 | e2e-trace en PRUEBAS (depende F-40/41/44) |
| 11 | n8n: credenciales + toggle UI | F-02 | 3 workflows activos en BD; falta credenciales UI (depende F-01) |
| 12 | Frappe ERP | F-28, F-29 | Solo ruta nginx huérfana (`/erp/`→frappe:8000); servicio no existe en compose (depende F-05) |

## 🟡 P2 — Robustez y SaaS

| # | Objetivo | TEC-06 | Detalle |
|---|----------|--------|---------|
| 13 | Suite de comportamiento del agente | F-47 | 20+ guiones con aserciones (depende F-19…F-24) |
| 14 | Load test 50 conversaciones | F-51 | Script k6 pendiente (depende F-36/F-47) |
| 15 | Portal: búsqueda + notificaciones | F-45 | (depende F-43) |
| 16 | BI Metabase + KPIs | F-52 | Solo ruta nginx huérfana (`/reportes/`→metabase:3000); requiere F-09/F-10 |
| 17 | Planes + onboarding automático | F-53 | (depende F-10/F-30) |
| 18 | Despliegue distribuido prod + piloto | F-54, F-56 | deploy.sh + go-live (requiere I + G + F) |
| 19 | Cierre de gaps restantes | G-13…G-45 | ~31 gaps abiertos en `docs/GAPS-MINIFASES.md` |

## 🟢 P3 — Calidad de vida

| # | Objetivo | Componente |
|---|----------|------------|
| 20 | i18n del dashboard (es/en) | Helper |
| 21 | Exportar reportes de campañas (PDF/CSV) | Helper |
| 22 | Notificaciones push en dashboard | Helper |
| 23 | CRUD de usuarios/agentes | Helper, Chatwoot |
| 24 | Modo oscuro en dashboard | Helper |

---

## Leyenda de Estados

| Símbolo | Significado |
|---------|-------------|
| ✅ | Completado y verificado |
| 🚨 P0 | Bloqueante del siguiente hito |
| 🔴 P1 | Funcionalidad core |
| 🟡 P2 | Robustez / SaaS |
| 🟢 P3 | Cosméticas / calidad de vida |

> Al cerrar una fase: marcar ✅ en TEC-06 §5 + actualizar ESTADO-GENERAL.md, LOGROS.md y el estado RAG en `docs/maestro/` (regla TEC-04 §7).