# Estado Real Verificado

> **Verificación en vivo: 2026-08-30** (re-auditoría; previa 2026-08-28). Todo lo listado aquí tiene evidencia en **código y/o runtime** (no solo documentación).
> Método: docker ps · API helper :3100 · API GitLab :9080 · git log · pipelines · ES/Kibana (SOAC).

## 1. Infraestructura (verificado docker ps 30/08)

| Servicio | Puerto | Estado |
|----------|--------|--------|
| gitlab-ce + gitlab-runner | 9080 / 9022 | ✅ Up healthy |
| wibsite-nginx (gateway) | 80/443/3003/8080 | ✅ Up |
| wibsite-helper | 3100 | ✅ Up — health OK v2.1.1 |
| wibsite-frontend (Next.js unificado) | 4000 | ✅ Up |
| wibsite-n8n | 5679 | ✅ Up — healthz ok |
| wibsite-dify (api/web/worker/sandbox/plugin) | 5001/3000/5002/8194 | ✅ Up |
| wibsite-postgres | 5432 | ✅ Up healthy (5 bases) |
| wibsite-redis | 6379 | ✅ Up healthy |
| wibsite-weaviate + t2v | — | ✅ Up |
| wibsite-elasticsearch | 9200 | ✅ Up (cluster yellow single-node, 101 shards) |
| wibsite-kibana | 5601 | ✅ Up |
| wibsite-otel-collector | 4317/4318 | ✅ Up |
| wibsite-minio | 9000/9001 | ✅ Up healthy |
| wibsite-authelia | 9091 | ✅ Up healthy |
| wibsite-plugin-daemon | 5002 | ✅ Up |
| **Total** | | **20 contenedores** (18 stack wibsite + gitlab-ce + gitlab-runner) |

## 2. Helper Node (código verificado 30/08)

| Aspecto | Valor verificado |
|---------|------------------|
| Versión | package.json **v2.1.1** (health API confirma) |
| Rutas | **136 rutas** `app.*` en `helper-node/index.js` (111 únicas) — confirmado 30/08 |
| Módulos (código) | conversationStore (9 estados), agentCore (grafo 9 nodos + guards + checkpointer), ragEngine, antiHallucination, templateEngine (3+ plantillas), leadProfile (SPICED/MEDDIC 13 campos), quoteEngine (8 servicios), auditLogger (24 eventos), piiFilter, otelBridge, channels (5 adapters), mediaProcessor, **chatGroups, agentKnowledge, agentRegistry (nuevos)** |
| Persistencia | dual-write JSON+PG (facade) + RLS 7 políticas + tenantContext |

## 3. Frontend unificado (decisión técnica 30/08)

| Aspecto | Estado verificado |
|---------|-------------------|
| **Vista única** | `frontend/` Next.js standalone con **15 páginas** en `src/app/` (dashboard, chat, leads, pipeline, campaigns, templates, reports, automation, settings, …) |
| Comunicación | Proxy en `next.config.ts`: `/api/*` y `/webhooks/*` → helper (o vía nginx en prod) |
| Hub estático | `hub/` **ELIMINADO** (commit `d17b09c`) — sustituido por el frontend |
| Módulos externos | n8n, Dify, Chatwoot, Twenty se usan como **motores** (APIs/backends) sin exponer sus UI como frontera |

## 4. IA y automatización

| Componente | Estado verificado |
|------------|-------------------|
| Dify | Workflow clasificador con OpenRouter (7 modelos); fallback + circuit breaker en agentCore |
| n8n | 3 workflows importados; healthz ok; activación UI pendiente |
| Twenty CRM | Sync 10 campos custom (verificación directa pendiente: endpoint `twenty` no localizado en index.js → código reorganizado) |
| OpenRouter | API key presente en `.env`; LLM real en flujo (doc 15/08) |

## 5. Calidad y CI/CD (verificado 30/08)

| Gate | Resultado |
|------|-----------|
| Pipeline de prevalidación **dev** | **#58 SUCCESS** (helper-tests 83 ✓ · smoke 2 ✓ · flow 3 ✓ · validate_tevs informativo) |
| Unit tests helper | 24 suites / 83 tests unit (capa unit del pipeline) — `npm run test:unit` ✅ |
| Smoke + Flow | smoke 2/2 ✅ · flow 3/3 ✅ (flujos de negocio Twilio→Lead→Score→Campaign) |
| E2E Playwright | 13 specs + frontend specs — **por alcance** (no suite completa en cada push) |
| TeVS | **14 tests** (10/14 pasan CI dev; 4 requieren entorno completo: DR-001/002, SEC-001, UI-001 — informativos) |
| e2e-trace | 10/10 (commit 8f4141e) |
| SOAC en vivo | ES yellow (1 nodo); índices traces/logs/metrics con datos hasta 30/08; tevs-results 84 docs (30/08) |
| Pipeline main | gate estricto (validate_tevs `allow_failure: false`) |
| CI variables | `ELASTIC_PASSWORD` + `HELPER_API_KEY` masked+protected (dev y main protegidas) |
| main / dev | Ambas protegidas (push/merge = Maintainers) |

## 6. GitLab (gobernanza — verificado 30/08)

| Elemento | Estado |
|----------|--------|
| Proyecto `sales-ai-platform/wibsite` (monorepo, código en `wibsite/`) | ✅ |
| Historia limpia sin secretos (baseline `dfda663`) | ✅ |
| **Labels estándar (34)** — type::/priority::/area::/risk::/status:: | ✅ |
| **Board Kanban** (8 listas: backlog→done) | ✅ |
| **Milestones** (SPRINT-2026-17 + Oleadas 0-8 + Pospuestos) | ✅ |
| **Issue templates (10)** + **MR template** en `.gitlab/` | ✅ (MR template con checklist de validación) |
| **Documentación estructurada** `docs/{product,architecture,adr,development,operations,security,agents}` | ✅ |
| Issues | 94 (93 roadmap + #94 línea base `status::done`) |

## 7. Divergencias documentación vs código detectadas (30/08)

| Doc dice | Código/runtime real | Tratamiento |
|----------|---------------------|-------------|
| "Telegram: falta conectar token" | `telegram configured=true` en `/api/channels/status` | **Código es la verdad** → Telegram operativo (validación con bot real pendiente) |
| "~120-130 rutas" | **136 rutas** en index.js | Código es la verdad |
| "TeVS 11/11" / "13/13" / "14/14" | **14 tests** (10 CI dev + 4 entorno informativos) | Pipeline es la verdad |
| "Twenty endpoint /api/twenty/health" | 404 en runtime | Endpoint no verificado → pendiente de re-verificación |
| "Hub central / Dashboard SPA en helper" | **Hub eliminado**; frontend Next.js unificado | Decisión técnica 30/08 → maestro G13 actualizado |
| "22 suites · 176 tests" | **24 suites** (TESTING-INDEX actualizado) | Conteo real de archivos |

→ Detalle completo en [03-BRECHA-PLANEACION-vs-CODIGO.md](03-BRECHA-PLANEACION-vs-CODIGO.md)