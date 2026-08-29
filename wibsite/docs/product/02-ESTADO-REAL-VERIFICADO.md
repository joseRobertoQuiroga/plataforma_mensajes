# Estado Real Verificado

> **Verificación en vivo: 2026-08-28.** Todo lo listado aquí tiene evidencia en **código y/o runtime** (no solo documentación).
> Método: docker ps · API helper :3100 · API GitLab :9080 · git log · pipelines.

## 1. Infraestructura (verificado docker ps 28/08)

| Servicio | Puerto | Estado |
|----------|--------|--------|
| gitlab-ce + gitlab-runner | 9080 / 9022 | ✅ Up healthy |
| wibsite-nginx (gateway) | 80/443/3003/8080 | ✅ Up |
| wibsite-helper | 3100 | ✅ Up — health OK v2.2.0 |
| wibsite-frontend | 4000 | ✅ Up |
| wibsite-n8n | 5679 | ✅ Up — healthz ok |
| wibsite-dify (api/web/worker/sandbox/plugin) | 5001/3000/5002/8194 | ✅ Up |
| wibsite-postgres | 5432 | ✅ Up healthy (5 bases) |
| wibsite-redis | 6379 | ✅ Up healthy |
| wibsite-weaviate + t2v | — | ✅ Up |
| wibsite-elasticsearch | 9200 | ✅ Up (cluster yellow single-node) |
| wibsite-kibana | 5601 | ✅ Up |
| wibsite-otel-collector | 4317/4318 | ✅ Up |
| wibsite-minio | 9000/9001 | ✅ Up healthy |
| wibsite-authelia | 9091 | ✅ Up healthy |
| wibsite-chatwoot (inbox + worker) | — | ✅ Up |
| wibsite-plugin-daemon | 5002 | ✅ Up |
| **Total** | | **21 contenedores** (20 stack + gitlab-runner) |

## 2. Helper Node (código verificado)

| Aspecto | Valor verificado |
|---------|------------------|
| Versión | package.json v2.2.0 (health API confirma) |
| Rutas | **136 rutas** `app.*` en `helper-node/index.js` (28/08) |
| Health | `GET /health` 200 (uptime 1h39m) |
| Dashboard | `GET /api/dashboard/summary` → 10 campañas (6 activas), 24 entregas, 27 leads (24 scored, top 97) |
| Canales | `/api/channels/status` → telegram=configured, whatsapp=configured (Twilio), messenger/email/tiktok=no |
| Módulos (código) | conversationStore (9 estados), agentCore (grafo 9 nodos + guards + checkpointer), ragEngine, antiHallucination, templateEngine (3+ plantillas), leadProfile (SPICED/MEDDIC 13 campos), quoteEngine (8 servicios), auditLogger (24 eventos), piiFilter, otelBridge, channels (5 adapters), mediaProcessor |
| Persistencia | dual-write JSON+PG (facade) + RLS 7 políticas + tenantContext |

## 3. IA y automatización

| Componente | Estado verificado |
|------------|-------------------|
| Dify | Workflow clasificador con OpenRouter (7 modelos); fallback + circuit breaker en agentCore |
| n8n | 3 workflows importados; healthz ok; activación UI pendiente |
| Twenty CRM | Sync 10 campos custom (verificación directa pendiente: endpoint `twenty` no localizado en index.js → código reorganizado) |
| OpenRouter | API key presente en `.env`; LLM real en flujo (doc 15/08) |

## 4. Calidad y CI/CD (verificado 28/08)

| Gate | Resultado |
|------|-----------|
| Unit tests helper | 176 tests / 22 suites (doc 15/08) — re-verificación local pendiente |
| E2E Playwright | 141 tests 0 fallos (commit `8f4141e`, rama dev) |
| TeVS | 14/14 (pipeline GitLab #23 `validate_tevs` SUCCESS) |
| e2e-trace | 10/10 (commit 8f4141e) |
| Pipeline GitLab | #23 SUCCESS (helper-tests node:22-alpine + validate_tevs pwsh) |
| CI variables | `ELASTIC_PASSWORD` + `HELPER_API_KEY` masked+protected |
| main | Protegida (push/merge = Maintainers) |

## 5. GitLab (gobernanza — implementado 28/08)

| Elemento | Estado |
|----------|--------|
| Proyecto `sales-ai-platform/wibsite` (monorepo, código en `wibsite/`) | ✅ |
| Historia limpia sin secretos (7 commits baseline) | ✅ |
| **Labels estándar (34)** — type::/priority::/area::/risk::/status:: | ✅ |
| **Board Kanban** (8 listas: backlog→done) | ✅ |
| **Milestone SPRINT-2026-17** (2026-08-24 → 09-06) | ✅ |
| **Issue templates (10)** + **MR template** en `.gitlab/` | ✅ |
| **Documentación estructurada** `docs/{product,architecture,adr,development,operations,security,agents}` | ✅ |
| **MCP GitLab operativo** (83 tools, read-only) vía bridge opencode | ✅ |

## 6. MCP (Fase 4 del estándar — verificado en vivo 28/08)

- Servidor `mcp-gitlab` 0.9.3 + bridge LSP↔JSONL (`C:\proyectos\MCP\gitlab-mcp\bridge.py`).
- Config en `~/.config/opencode/opencode.jsonc` (`mcp.gitlab`, `GITLAB_READ_ONLY=true`).
- Prueba E2E: INIT (protocol 2025-03-26), 83 tools, `gitlab_get_project` + `gitlab_list_issues` contra instancia local.
- PAT `opencode-mcp` (read_api+read_repository) para el MCP; PAT `governance-admin` (api) para tareas administrativas de gobernanza.

## 7. Divergencias documentación vs código detectadas (28/08)

| Doc dice | Código/runtime real | Tratamiento |
|----------|---------------------|-------------|
| "Telegram: falta conectar token" | `telegram configured=true` en `/api/channels/status` | **Código es la verdad** → Telegram operativo (validación con bot real pendiente) |
| "~120-130 rutas" | 136 rutas en index.js | Código es la verdad |
| "TeVS 11/11" / "13/13" / "14/14" | Pipeline #23: 14/14 | Pipeline es la verdad |
| "Twenty endpoint /api/twenty/health" | 404 en runtime | Endpoint no verificado → se documenta como pendiente de re-verificación |

→ Detalle completo en [03-BRECHA-PLANEACION-vs-CODIGO.md](03-BRECHA-PLANEACION-vs-CODIGO.md)