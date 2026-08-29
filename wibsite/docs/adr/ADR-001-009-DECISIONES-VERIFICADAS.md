# ADR-001 — GitLab Self-Managed como fuente de verdad

**Status:** Accepted (2026-08-28)

**Context:** El proyecto crecía con documentación distribuida en múltiples archivos locales sin trazabilidad única entre intención, código, validación y operación.

**Decision:** GitLab Self-Managed (`gitlab.local:9080`) es la fuente de verdad: issues, MRs, pipelines, milestones, boards, labels y documentación estructurada (`docs/{product,architecture,adr,development,operations,security,agents}`). El código en el monorepo `wibsite/`.

**Alternatives:** GitHub + GitHub Actions (descartado: no self-hosted), documentación local (rechazada: sin trazabilidad).

**Consequences:** (+) trazabilidad única, CI con gates, historia limpia sin secretos. (−) instancia local requiere mantenimiento/backup; MCP oficial de GitLab en beta.

---

# ADR-002 — MCP como capa de integración de agentes

**Status:** Accepted (2026-08-28)

**Context:** Los agentes IA (opencode) necesitan operar el proyecto de forma organizada (issues, MRs, pipelines) sin credenciales dispersas ni acceso ad-hoc.

**Decision:** Capa MCP con `mcp-gitlab` 0.9.3 (83 tools) vía bridge de framing (`bridge.py` — LSP Content-Length ↔ JSON-line, I/O nativo Windows). Config en `~/.config/opencode/opencode.jsonc` con `GITLAB_READ_ONLY=true` (Fase 4: primero lectura).

**Alternatives:** GitLab Duo (requiere subscripción), API directa en prompts (frágil), MCP oficial GitLab (beta, distribución no accesible).

**Consequences:** (+) 83 tools operativas, permisos progresivos por PAT. (−) bridge propio que mantener; `mcp-gitlab` es comunidad (no oficial).

---

# ADR-003 — PostgreSQL como almacenamiento primario

**Status:** Accepted (implementado parcial)

**Context:** El helper-node usaba JSON file store con riesgo de pérdida y sin consultas.

**Decision:** PostgreSQL primario (5 bases separadas: chatwoot, dify, n8n, twenty, wibsite), dual-write con JSON fallback, RLS multi-tenant (7 políticas).

**Alternatives:** MongoDB (no evaluado), JSON store (fallback).

**Consequences:** (+) persistencia robusta, RLS. (−) cutover `STORE_MODE=pg` con lecturas unificadas pendiente (P1 brecha).

---

# ADR-004 — Elastic + OTel como observabilidad

**Status:** Accepted (implementado)

**Context:** Se requería trazabilidad de logs, métricas y trazas con retención.

**Decision:** Elasticsearch 9.x + Kibana + OTel Collector (OTLP gRPC/HTTP), datastreams traces/metrics/logs con ILM rollover 1d / delete 30d. Reemplaza Prometheus/Grafana/GlitchTip.

**Consequences:** (+) stack unificado, TeVS escribe resultados en `tevs-results-*`. (−) single-node (yellow), password en config a revisar (T3).

---

# ADR-005 — OpenRouter como proveedor LLM

**Status:** Accepted (implementado)

**Context:** xAI Grok quedó sin créditos; se necesitaba proveedor multi-modelo con fallback.

**Decision:** OpenRouter como proveedor (7 modelos: GPT-4o-mini default, GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash, Llama 3.3 70B, Mistral Large, Command R7B). Dify como orquestador + fallback directo con circuit breaker (DIFY_BUDGET_MS=6000).

**Consequences:** (+) flexibilidad multi-modelo, presupuesto controlado. (−) dependencia externa; API key en `.env`.

---

# ADR-006 — Twilio como canal WhatsApp real (hasta migración Meta)

**Status:** Accepted (implementado)

**Context:** Meta WhatsApp API requería credenciales no disponibles; se necesitaba canal real.

**Decision:** Bridge Twilio (inbound webhook + status callback + typing + opt-out duro). Webhook Meta (`/webhooks/whatsapp`) listo para migración futura.

**Consequences:** (+) canal real operativo. (−) costo por mensaje; migración futura a Meta (P6 brecha).

---

# ADR-007 — Authelia + nginx auth_request como SSO

**Status:** Accepted (implementado)

**Context:** Exposición de APIs del gateway sin autenticación.

**Decision:** Authelia 4.37 + nginx `auth_request` sobre rutas protegidas (verificado: 403 sin sesión SSO).

**Consequences:** (+) SSO centralizado. (−) requiere sesión por módulo; verificación E2E de flujo SSO pendiente.

---

# ADR-008 — RAG con Weaviate + fallback in-memory

**Status:** Accepted (implementado)

**Context:** El agente necesita conocimiento de negocio con búsqueda semántica.

**Decision:** Weaviate 1.26.1 + t2v-transformers (MiniLM-L6) como store vectorial; `ragEngine` con fallback in-memory; nodo `kb` del grafo carga `kb-documents/` al arranque.

**Consequences:** (+) conocimiento por tenant. (−) chunking y relevancia por validar en producción.

---

# ADR-009 — Bridge MCP con I/O nativo en Windows (Python 3.14)

**Status:** Accepted (2026-08-28)

**Context:** `os.read()`/`read()` de Python 3.14 en Windows se bloquea con datos disponibles en pipes anónimos (verificado empíricamente); el SDK MCP Python usa JSON por línea mientras opencode (SDK TS) usa framing LSP.

**Decision:** `bridge.py` con `ReadFile`/`WriteFile` nativos (ctypes), auto-detección de framing del cliente (LSP o JSON-line) y reencolado al servidor en JSON-line.

**Alternatives:** usar `uvx mcp-gitlab` directo (falla con opencode), upgrade SDK MCP (no disponible).

**Consequences:** (+) MCP estable con cualquier cliente. (−) puente a mantener en `C:\proyectos\MCP\gitlab-mcp\`.