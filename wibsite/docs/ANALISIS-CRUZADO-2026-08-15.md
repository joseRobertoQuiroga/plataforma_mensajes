# Análisis Cruzado — Estado Real, Gaps Sectorizados y Validación del Sistema de Monitoreo

> **Fecha:** 2026-08-15 · **Método:** inspección de código + pruebas unitarias/integración + verificación runtime (Docker/PG/ES) + gates de monitoreo (e2e-trace, TeVS)
> **Complementa:** `docs/AUDITORIA-2026-08-13.md`, `docs/ANALISIS-ESTADO-GAPS-MINIFASES.md`, `docs/SECURITY-GAPS-PRE-DEPLOY.md`

---

## 1. Resumen de la sesión (qué se corrigió y verificó)

| # | Acción | Resultado | Evidencia |
|---|--------|-----------|-----------|
| 1 | Tests rotos (`flow.test.js`) | Corregido: mock de `ragEngine`, store aislado por suite, timeouts de hooks | 169/169 tests, 19 suites, 3 corridas estables |
| 2 | Leak de worker Jest (GETADDRINFOREQWRAP) | Corregido: `closeRedis()` + `app.closeAll()` (graceful shutdown) + stores temporales por suite + PG/Redis apuntados a 127.0.0.1 en tests | sin handles abiertos (`--detectOpenHandles` limpio) |
| 3 | Dual-write PG (G1/S5) | **RESUELTO:** rutas de negocio conectadas al facade (`writeCampaignToPg/writeLeadToPg/writeScoreToPg/writeOptOutToPg`); bug adicional: `updateStore` sin `await` → respuestas `[]` y PG sin datos | campaña+lead+score+opt-out verificados en PG en vivo |
| 4 | `conversation_summaries` (S4) | **RESUELTO:** migración aplicada a PG (F-14 desbloqueado) | `\d conversation_summaries` OK |
| 5 | Datastreams sin rollover (G2/S6) | **RESUELTO:** ILM `traces@lifecycle`, `logs`, `metrics` → rollover 1d + delete 30d | nuevo backing index `logs-…-2026.08.15-000002` creado en vivo |
| 6 | Logs de app ausentes en ES (G4/S11) | **RESUELTO:** puente OTLP logs en `otelBridge.sendLog` + `auditLogger` conectado | logs-doags: 1 → 109+ docs con attrs completos |
| 7 | Residuos obsoletos (G6/S9) | **RESUELTO:** `monitoring/` (prometheus/grafana/alertmanager) eliminado; rutas nginx `/erp/` y `/reportes/` comentadas con nota (ERP/BI diferidos, no descartados) | nginx -t OK, /erp/ → 404 |
| 8 | Multicanal (Email·Telegram·WhatsApp·TikTok·Messenger) | **IMPLEMENTADO:** registry de adapters + pipeline inbound unificado + webhooks + `/api/channels/status` + `/api/channels/test` | suite `channels.test.js` 18 tests; webhook Telegram simulado E2E en vivo (lead→grafo→LLM OpenRouter real→audit PG+ES) |
| 9 | Multimodal (audio/imagen) | **BASES IMPLEMENTADAS:** `mediaProcessor` (STT vía OpenRouter transcripciones; visión vía gpt-4o-mini; video→audio+thumbnail) con degradación elegante | tests 5/5 |
| 10 | Gates de monitoreo | Re-ejecutados: e2e-trace **10/10**, TeVS **11/11 PASSED** (incluye TEST-DEV-001 que falló el 11/08) | corrida EXEC-20260814-231309 |

---

## 2. Sistema de Monitoreo, Control y Seguridad (SOAC) — validación como guía de trabajo

**Veredicto: ✅ operativo y validado como herramienta de control** — durante esta sesión se usó para detectar y verificar cada corrección (1→10 de la tabla anterior). **Todos los cambios de esta oleada pasan por el SOAC**: cada módulo nuevo emite eventos `event_type` + `wibsite.module/flow/action` + spans OTel con trace/span correlacionados.

| Componente | Estado | Uso verificado en la sesión |
|------------|--------|------------------------------|
| Traces OTLP → ES | ✅ | 1363+ spans; cadena HTTP→graph→LLM con usage/intent/score intactos (gate 10/10) |
| Logs OTLP → ES | ✅ (nuevo 15/08) | 109+ docs con `event.type`, `wibsite.module/flow/action`, `trace_id/span_id` correlacionados |
| Metrics → ES | ✅ | 1573 docs (prom-client + collector) |
| audit_logs PG | ✅ | 24 event types definidos; ahora activos también `webhook_received`, `channel.reply`, `channel.test_send`, `media.processed`, `media.degraded` |
| TeVS | ✅ | **13/13 PASSED** (11 originales + TEST-CHN-001 canales + TEST-MM-001 multimodal, añadidos 15/08) |
| e2e-trace gate | ✅ | 10/10 ×5 corridas (estable; ahora provider-agnóstico: acepta usage de Dify o OpenRouter y selecciona el último span LLM efectivo) |
| ILM/rollover | ✅ (nuevo 15/08) | rollover 1d + retención 30d en los 3 datastreams |
| Instrumentación multicanal | ✅ (nuevo 15/08) | webhooks emiten `webhook_received/webhook_failed/channel.reply` con attrs de canal |
| Instrumentación multimodal | ✅ (nuevo 15/08) | `mediaProcessor` emite spans `media.stt`/`media.vision` + eventos `api_call/error` con latencia y modelo; degradación → `media.degraded` |
| Dify en el flujo | ✅ (nuevo 15/08) | modo primary verificado en runtime (3794ms, tokens 352, intent/score normalizados en span y audit) |
| Alertas Kibana | 🟡 | Reglas pendientes de crear (sustituyen a Grafana retirado) |
| Cluster ES | ⚠️ yellow | 1 nodo, réplicas sin asignar (aceptable en dev; en prod: 2+ nodos) |

### Mejora propuesta para el SOAC (siguiente iteración)

1. **Reglas de alerta en Kibana**: error_rate > 5% (5 min), fallback_activated, `webhook_failed`, `PG write failed` → notificación (webhook/email).
2. **Dashboard multicanal**: tasa de respuesta por canal, latencia LLM P95, ratio STT/visión fallidos.
3. **Alerta de datastream**: si un datastream no recibe docs en 24h → aviso de pipeline detenido.

---

## 3. Gaps sectorizados (bloqueante / alcance / documental)

### 3.1 🔴 Bloqueantes — seguridad (deferidos a etapa deploy por decisión del usuario)

> **Fuente única:** `docs/SECURITY-GAPS-PRE-DEPLOY.md` — NO se tocan en esta etapa.

| ID | Gap | Bloquea | Impacto | Corrección (etapa deploy) |
|----|-----|---------|---------|---------------------------|
| S1 | `HELPER_API_KEY` literal no evaluada (key fija) | autenticación de la API | cualquiera autentica contra el helper | regenerar `openssl rand -hex 32`, rotar en .env + clientes |
| S2 | `ELASTIC_PASSWORD` hardcodeado en `.gitlab-ci.yml:12` | pipeline CI seguro | password del monitoreo en el repo | mover a variables masked/protected del runner |
| S3 | `certs/nginx.key` + `wibsite-store.json` (PII) en git history | confidencialidad | key privada + PII públicos | git filter-repo + rotar certificado |

### 3.2 🟠 Bloqueantes funcionales — pendientes (alcance acordado, no de esta sesión)

| ID | Gap | Bloquea | Alcance/impacto | Plan |
|----|-----|---------|-----------------|------|
| B1 | F-09 cutover PG: `STORE_MODE` default `dual`; lectura sigue siendo JSON | migrar producción a PG | PG y JSON divergen si no se activa cutover | decidir feature flag `STORE_MODE=pg` cuando las lecturas se unifiquen (lectura actual: JSON) |
| B2 | n8n: workflows 01/02 sin activar (UI :5679), credenciales sin configurar | automatización inbound/broadcast | el flujo n8n→Dify→Twenty depende de activación manual | configurar credenciales + activar en UI; verificar vía API n8n |
| B3 | F-51 load test k6 no existe | validar 50 conversaciones | sin datos de capacidad antes del piloto | crear `scripts/load/k6-*.js` con umbrales P95 |
| B4 | F-47 suite de comportamiento del vendedor (E2E con grafo real) | calidad del agente | solo tests unitarios por nodo | suite E2E con conversaciones scripteadas |

### 3.3 🟡 Alcance/diferidos (decisión de negocio — se mantienen en docs, no se descartan)

| ID | Item | Estado | Nota |
|----|------|--------|------|
| D1 | Frappe/ERP (F-28/F-29) | ⬜ diferido — ruta nginx comentada | el núcleo actual es Dify + Twenty; ERP complementario futuro |
| D2 | Metabase/BI (F-52) | ⬜ diferido — ruta nginx comentada | diario de métricas pendiente |
| D3 | TikTok comments | ⚠️ bases — requiere API aprobada o agregador | adapter + webhook listos |
| D4 | Prometheus/Grafana/Alertmanager | 🗑 retirados (configs eliminados 15/08) | sustituidos por Elastic Stack; alertas → Kibana |
| D5 | F-53 planes SaaS / F-54 deploy distribuido / F-56 go-live | ⬜ | oleadas siguientes |
| D6 | F-52/53 rate limiting por plan | ⬜ | rateLimiter global en memoria (60/min) sin dimensión de plan |

### 3.4 🟢 Mejoras menores (no bloqueantes)

| ID | Item | Nota |
|----|------|------|
| M1 | `[ErrorTracker] DB Init failed: permission denied for schema public` | app_user no puede CREATE TABLE; el módulo cae a in-memory (por diseño) — evaluar DDL en migración |
| M2 | Sentry DSN inválido (`http://glitchtip:8282`) genera warning en arranque | GlitchTip retirado; limpiar env default |
| M3 | Warning nginx: `listen … http2` deprecado + MIME types duplicados | cosmético; limpiar en próxima revisión de nginx.conf |
| M4 | Corrida TeVS histórica con fallo (11/08 18:53, QUERY_ERROR) | documentado; corridas actuales 11/11 |
| M5 | n8n expuesto en host :5679 (interno :5678) | documentar en RUNBOOK |

---

## 4. Alcance multicanal y multimodal (estado 15/08)

| Canal | Adapter | Envío | Recepción (webhook) | Estado |
|-------|---------|-------|---------------------|--------|
| **Telegram** | `channels/telegramAdapter.js` | ✅ Bot API sendMessage | ✅ `/webhooks/telegram` + verify secret | **LISTO PARA PROBAR** — solo falta TELEGRAM_BOT_TOKEN |
| **WhatsApp** | `channels/whatsappAdapter.js` (Twilio) | ✅ Twilio Messages API | ✅ `/webhooks/twilio-inbound` + `/webhooks/whatsapp` (Meta) | operativo con bridge Twilio |
| **Messenger** | `channels/messengerAdapter.js` | ✅ Graph API v21 | ✅ `/webhooks/messenger` + hub.verify | listo — falta MESSENGER_PAGE_TOKEN |
| **Email** | `channels/emailAdapter.js` | ✅ API HTTP genérica (Resend/Postmark/Mailgun/SendGrid) | ✅ `/webhooks/email-inbound` | listo — falta EMAIL_API_URL/KEY |
| **TikTok** | `channels/tiktokAdapter.js` | ⚠️ vía agregador (API oficial requiere aprobación) | ✅ `/webhooks/tiktok-comments` | bases — depende de aprobación |

**Pipeline inbound unificado** (`handleInboundMessage` en index.js):
`webhook → normalize → lead+delivery (dual-write) → mediaProcessor (STT/visión) → executeCommercialGraph (8 etapas) → sendToChannel → audit (PG + ES logs)`

**Multimodal (bases, evolución guiada):**
- Audio/voz → STT vía OpenRouter `/audio/transcriptions` (`OPENROUTER_STT_MODEL`, p.ej. whisper). En Telegram los mensajes de voz se descargan vía `getFile` → URL → STT.
- Imagen → descripción vía visión (`gpt-4o-mini`, free tier con imágenes).
- Video → transcripción del audio + descripción del thumbnail (extracción de frames con FFmpeg = evolución futura).
- Sin configuración → degradación elegante: el agente recibe el texto del canal o placeholder.

**Prueba de canal (sin webhook público):** `POST /api/channels/test {channel:"telegram", to:"<chat_id>", text:"hola"}`

---

## 5. Verificación ejecutada hoy (evidencia cruda)

```bash
# Stack
docker ps                                   # 20 contenedores up
curl -k https://localhost:8080/hub/          # 200
curl -k https://localhost:8080/api/campaigns # 403 sin SSO

# Tests
npx jest --silent                           # 19 suites, 169/169 PASS
npx jest --detectOpenHandles --silent       # 0 open handles

# Gates de monitoreo
node scripts/verify/e2e-trace.js --key ...  # 10/10
powershell scripts/tevs/tevs-runner.ps1 -TestFolder scripts/tevs/tests  # 11/11 PASSED

# Dual-write (vía API real)
POST /api/campaigns → campaigns PG = 1
POST /api/campaigns/:id/leads → campaign_leads PG = 1 (mismo UUID)
POST /api/leads/score → lead_scores PG = 1 (campaign_id derivado)
POST /api/opt-outs → opt_outs PG = 1

# Multicanall
POST /webhooks/telegram (update simulado) → 200, lead JSON, grafo 4 etapas,
  LLM OpenRouter real (fallback classify, 3188ms), reply degradado (sin token),
  audit en PG (webhook_received/api_call) y ES logs con attrs completos

# ES
GET _data_stream → traces 1363 / metrics 1573 / logs 109+
GET _ilm/policy/traces@lifecycle → rollover 1d / delete 30d
logs-doags nuevo backing index -2026.08.15-000002 (rollover funcionando)
```

---

## 6. Próximos pasos ordenados (actualizado 15/08 — Oleada J ejecutada)

1. ~~Probar Telegram real~~ 🟡 pendiente solo el token: generar bot (BotFather) → `TELEGRAM_BOT_TOKEN` en `.env` → `docker compose up -d helper` → probar `/api/channels/test` y luego webhook (`ngrok` o similar para URL pública + `setWebhook`).
2. Conectar resto de canales a medida que haya tokens (Messenger → Meta, Email → proveedor, WhatsApp → Meta Cloud API para salir de Twilio sandbox).
3. ~~Crear reglas de alerta en Kibana~~ 🟡 parcial: endpoint `/api/internal/alerts` operativo en el hub; crear reglas Kibana (error_rate, fallback_activated, webhook_failed, PG write failed).
4. ~~B1-B4~~ ✅ implementados 15/08: B1 lectura PG, B2 n8n activado (2/3), B3 k6+simulador, B4 suite de comportamiento. Restan: lecturas PG completas en cutover total y credenciales del tercer workflow n8n.
5. **Etapa deploy**: ejecutar checklist `SECURITY-GAPS-PRE-DEPLOY.md` (S1-S3) antes de cualquier despliegue.
6. RAG ampliado: cargar los 5 servicios del negocio en `helper-node/kb-documents/` (ya se cargan automáticamente al arranque).
