# OBJETIVOS PENDIENTES — Por Completar

> Priorizado por impacto y dependencias — última actualización: **2026-08-15**
> Fuente de verdad de fases: `docs/tecnica/TEC-06-FASES-IMPLEMENTACION.md` §5 (**40+/56 fases ✅** — verificado en vivo 15/08) · Gaps sectorizados: `docs/ANALISIS-CRUZADO-2026-08-15.md` · Seguridad: `docs/SECURITY-GAPS-PRE-DEPLOY.md`

---

## ✅ LO QUE YA HAY (implementado y verificado en docs/código)

### Infraestructura (20 servicios docker-compose — verificado EN VIVO 15/08)
- Stack completo corriendo: gateway HTTPS 200 (/hub/, /api/health), 403 sin SSO, n8n :5679 200, Dify :5001 200, helper :3100 200
- **Elastic Stack**: ES 9.4.2 + Kibana + OTel Collector **operativos** (traces+metrics+logs; ILM rollover 1d/30d) · MinIO · Authelia (SSO verificado)
- Backups PostgreSQL (`backup.sh`) y verificación unificada (`verify-fase.sh`)

### Helper Node (~120 rutas · package.json v2.2.0 · 169 tests en 19 suites)
- CRUD campañas multi-canal + leads + Excel/CSV + tracking + scoring + 11 plantillas
- Middleware seguridad: API Key, rate limit, sanitizador 23 patrones, HMAC + PII filter + auditLogger 24 event types + **puente OTLP logs → ES**
- ConversationStore (9 estados) + checkpointer con **`conversation_summaries` migrada a PG (15/08)**
- RLS tenant 7 políticas + tenantContext · dual-write JSON+PG **conectado a rutas y verificado (15/08)** · agentCore (grafo 9 nodos, guards, Dify+fallback) · RAG · Anti-Hallucination · templateEngine
- **Multicanal (15/08):** 5 adapters + pipeline inbound unificado + webhooks (telegram/messenger/email/tiktok) + `/api/channels/status|test` + bases multimodales (STT+visión)

### Canal real y módulos
- **Bridge Twilio operativo** (F-03…F-06, F-24) · Dify workflow clasificador · n8n 3 workflows en BD · Twenty sync · SPICED/MEDDIC · plantillas comercial (objeciones, cadencia, handoff)

### Verificación y documentación
- **169 tests (19 suites) PASS** · **TeVS 11/11 PASSED** (ejecutado y persistido desde 11/08) · **e2e-trace 10/10** · auditorías 03/08, 13/08, 14/08 y análisis cruzado 15/08

---

## 🔴 P0 — Bloqueantes para el siguiente hito

| # | Objetivo | TEC-06 | Detalle |
|---|----------|--------|---------|
| 1 | ~~Verificar stack en vivo~~ ✅ 15/08 | — | 20 contenedores up, gateway/helper/n8n/dify 200 verificados |
| 2 | **Seguridad pre-deploy (S1-S3)** | F-32/F-35 | Ver `docs/SECURITY-GAPS-PRE-DEPLOY.md`: HELPER_API_KEY literal, ELASTIC_PASSWORD en CI, nginx.key+PII en git history — **diferido a etapa deploy por decisión** |
| 3 | ~~Ejecutar suite TeVS~~ ✅ | F-36/38 | 11/11 PASSED con corridas persistidas (11/08, 12/08, 15/08) |
| 4 | Limpieza de secreto/PII en git | F-35 | Parte de S3 (filter-repo) — etapa deploy |
| 5 | Cutover PG primario + multi-tenant | F-09, F-10, F-11 | **F-08 dual-write ✅ (15/08)**; falta feature flag `STORE_MODE=pg` con lecturas unificadas (B1 en análisis cruzado) |

## 🟠 P1 — Funcionalidad core

| # | Objetivo | TEC-06 | Detalle |
|---|----------|--------|---------|
| 6 | ~~Motor agéntico completo~~ ✅ | F-14, F-16, F-17, F-18 | Implementado + probado (49/49 en 6 suites) |
| 7 | ~~Sync máquinas comercial ↔ técnica~~ ✅ | F-21 | commercialState.js + hook onTransition |
| 8 | Re-auditoría de seguridad completa | F-35 | ✅ hecha (13-14/08); re-correr tras corregir S1-S3 en deploy |
| 9 | CI con gates | F-42 | workflows corregidos (branches, secrets, flags); password ES hardcodeada → S2 |
| 10 | ~~Trazabilidad E2E~~ ✅ | F-46 | gate e2e-trace 10/10 estable |
| 11 | n8n: credenciales + toggle UI | F-02 | workflows activos en BD; falta activación UI (puerto host :5679) |
| 12 | Frappe ERP | F-28, F-29 | **Diferido** — ruta nginx `/erp/` comentada (núcleo actual: Dify + Twenty) |

## 🟡 P2 — Robustez y SaaS

| # | Objetivo | TEC-06 | Detalle |
|---|----------|--------|---------|
| 13 | ~~Suite de comportamiento del agente~~ ✅ 15/08 | F-47 | `behavior.test.js`: venta completa con cotización, soporte/derivación, KB sin pérdida de contexto |
| 14 | ~~Load test 50 conversaciones~~ ✅ 15/08 | F-51 | `scripts/load/k6-scenario.js` + simulador node (`load-test-node.js`) — 8 conv: p95 1177ms, 3.29 turnos/s |
| 15 | Portal: búsqueda + notificaciones | F-45 | ✅ **implementado 15/08** (Ctrl+K `/api/search`, notificaciones, Lead Panel) |

## ➕ Alcance nuevo (15/08) — multicanal

| # | Objetivo | Detalle |
|---|----------|---------|
| MC1 | Probar Telegram real | BotFather → `TELEGRAM_BOT_TOKEN` → `/api/channels/test` → webhook con URL pública |
| MC2 | Conectar Messenger/Email/WhatsApp Cloud | tokens por canal a medida que estén disponibles |
| MC3 | ~~Alertas~~ 🟡 parcial | endpoint `/api/internal/alerts` operativo en el hub; reglas Kibana por crear |
| MC4 | Multimodal avanzado | ✅ STT/visión/TTS implementados; frames de video (FFmpeg) futuros |
| MC5 | ~~Broadcast multicanal~~ ✅ 15/08 | `POST /api/channels/broadcast` con auditoría por envío |

## ➕ Oleada J (15/08) — implementados y verificados

| # | Pendiente | Estado |
|---|-----------|--------|
| J1 | R2 — RAG conectado al grafo | ✅ nodo `kb` + carga de `kb-documents` al arranque + stemming — verificado en runtime |
| J2 | C1-C4 — cuestionarios/estimación/mini-cotización | ✅ quoteEngine + nodo cotizacion + plantilla 8 servicios |
| J3 | G-37 TTS + sendVoice | ✅ synthesizeSpeech + reply_audio on_demand |
| J4 | B1 — lectura PG (STORE_MODE=pg) | ✅ snapshot con TTL + findAll stores |
| J5 | B2 — n8n activación | ✅ 2/3 workflows activos en runtime (logs verificados) |
| J6 | Portal Fase 2 parcial | ✅ Lead Panel + Ctrl+K + notificaciones |
| J7 | Dify budget timeout | ✅ DIFY_BUDGET_MS=6000 → fallback fluido (p95 4471→1177ms) |
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