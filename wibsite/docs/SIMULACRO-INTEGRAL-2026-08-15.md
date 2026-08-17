# Simulacro Integral — Multiagente, Multimodal y SOAC (15/08/2026)

> **Objetivo:** ejecutar un simulacro completo de todos los flujos (Jest, gates, conversación comercial multi-turno, multimodal Telegram/Messenger, Dify→Twenty, persistencia y aislamiento) validando cada paso con el sistema de monitoreo SOAC (audit_logs PG + ES traces/logs + TeVS + e2e-trace).
> **Regla de la sesión:** sin cambios de código salvo correcciones precisas de errores detectados durante la validación (listadas en §3).

---

## 1. Resultado global del simulacro

| Verificación | Resultado |
|--------------|-----------|
| Jest (19 suites) | ✅ **169/169 PASS** |
| e2e-trace (F-46) | ✅ **10/10** |
| TeVS | ✅ **13/13 PASSED** (persistido en `tevs-results-2026.08.15`) |
| Runtime | ✅ 20 contenedores, gateway 200, SSO 403, helper/dify 200 |
| Conversación comercial 5 turnos (Telegram simulado) | ✅ greeting→calificacion→propuesta→profundizacion→objeciones→cierre→handoff con estados comerciales sincronizados |
| Multimodal imagen (Messenger simulado, OpenRouter real) | ✅ `Vision ok (418 chars)` → descripción inyectada al contexto del agente → grafo completo |
| Multimodal voz (Telegram, STT sin token) | ✅ degradación elegante: `media.degraded` auditado, agente sigue operativo |
| Dify (primary) | ✅ classify ok por turno (~2-3.7s, tokens, intent/score normalizados en span) |
| Twenty | ⚠️ API key expirada (`Token has expired` 401) — ver §3 H3 |
| Checkpointer F-14 (PG) | ✅ turnos persistidos en `conversation_summaries` (machine_state, commercial_state, score, lead_extract) |
| RLS aislamiento | ✅ 8 políticas; verificada en vivo: con tenant forzado → 0 filas ajenas; sin tenant → filas propias |
| Dual-write PG | ✅ leads/campañas/scores/opt-outs verificados en corridas previas y persistidos |

---

## 2. Diagrama — servicios externos y flujo multimodal/multiagente

```
                             ┌──────────────────────────────────────────────────────────────┐
                             │                     SOAC (gestión y control)                  │
                             │  audit_logs (PG) · traces/metrics/logs (ES) · TeVS · gates    │
                             └───────────────▲───────────────────────────────┬──────────────┘
                                             │ OTLP spans + logs + audit     │ consulta/validación
                                             │ (trace_id/span_id E2E)        │ (TeVS, e2e-trace, Kibana)

 CLIENTES/CANALES                     HELPER (núcleo)                        SERVICIOS EXTERNOS
 ─────────────────                    ───────────────                        ────────────────────
  Telegram ──webhook──►  /webhooks/telegram        │                              Telegram Bot API
   (voz/foto/            normalize → media[]      │      sendMessage/sendVoice ──► api.telegram.org
    texto)               │                       │      getFile (voz/foto) ──────► api.telegram.org/file
                         ▼                       │
  Messenger ──webhook─►  /webhooks/messenger      │      Graph API v21 ──────────► graph.facebook.com
   (audio/imagen/        normalize → media[url]   │
    texto)               │                       │
                         ▼                       │
  Email ──webhook────►  /webhooks/email-inbound   │      API HTTP proveedor ─────► Resend/Postmark/Mailgun
                         │                       │
  WhatsApp ──webhook──►  /webhooks/twilio-inbound │      Messages API ───────────► api.twilio.com
                         │        (o Meta /webhooks/whatsapp)                     Meta Graph Cloud API (pendiente)
                         ▼                       │
             ┌─────────────────────────┐         │
             │ handleInboundMessage    │         │
             │ 1. lead + delivery      │         │
             │    (JSON + PG dual-write)│        │
             │ 2. mediaProcessor       │─────────┼─────► OpenRouter (capa gratuita)
             │    · audio → STT        │         │        · /audio/transcriptions (whisper)  [STT]
             │    · imagen → visión    │         │        · chat/completions gpt-4o-mini      [visión + clasificador]
             │ 3. executeCommercialGraph│        │        · /audio/speech (TTS, PLAN)         [respuesta en audio]
             │    (grafo 8 etapas)     │         │
             │    · analyze → Dify     │─────────┼─────► Dify (workflow 8 nodos, clasificación)
             │      └─ fallback        │         │
             │        OpenRouter       │         │
             │ 4. reply por el canal   │─────────┼─────► Bot API / Graph / Twilio / Email API
             └─────────────────────────┘         │
                         │                       │
                         ▼                       ▼
             ┌─────────────────────┐   ┌──────────────────────────┐
             │ Persistencia        │   │ n8n (automatización)     │
             │ · JSON store        │   │ · workflows 01/02 (por   │
             │ · PG (RLS 8 tablas) │   │   activar en UI)         │
             │ · Redis (conversación│  └──────────────────────────┘
             │ · Weaviate (KB)     │   ┌──────────────────────────┐
             │ · checkpointer PG    │   │ Twenty CRM               │
             │   (conversation_     │◄──┤ · /api/twenty/sync (lead │
             │    summaries)        │──►│   + campos SPICED/MEDDIC)│
             └─────────────────────┘   │ ⚠ API key expirada hoy   │
                                       └──────────────────────────┘
```

### Flujo de audio (voz) — hoy y plan de respuesta rápida

```
ENTRADA (hoy, implementado):                     RESPUESTA RÁPIDA (plan §4):
 Telegram voice → getFile → URL .ogg      texto del agente → TTS (OpenRouter /audio/speech
   → STT whisper (OPENROUTER_STT_MODEL)     o Edge-TTS free) → .ogg → sendVoice (Telegram)
   → TEXTO al agente                      Latencia estimada: TTS 1-3s + envío ~1s ≈ 4-5s
 WhatsApp voice → URL del adjunto        Modo recomendado: reply_audio=on_demand
   → STT (mismo camino)                    (voz solo si el usuario manda voz o lo pide)
 Messenger audio → attachment.url       Llamadas en tiempo real (Twilio Voice/WebRTC):
   → STT (mismo camino)                    viable a futuro; requiere media streams +
 Sin token STT → media.degraded auditado    streaming STT/TTS — NO bloqueante para MVP
```

### Flujo de imagen

```
Telegram photo → getFile → URL → describeImage (gpt-4o-mini visión) → "[Descripción de imagen]: …" → contexto del agente
Messenger image → attachment.url directo → mismo camino
WhatsApp image → URL del adjunto → mismo camino
Hoy verificado EN VIVO: "Vision ok (418 chars)" → media.processed → grafo con contexto visual
```

### Multiagente — estado y trazabilidad

- **Hoy:** 1 agente (grafo 8 etapas, 9 nodos) con clasificador de intención (Dify primary / OpenRouter fallback). Cada turno emite: spans `HTTP → agent.graph.run → llm.completion [→ media.stt|media.vision]` + `state_transition` por etapa + estado comercial proyectado (greeting→calificando→propuesta_enviada→en_objeción→agendado/cerrado→derivado_a_humano).
- **Router multiagente (plan):** `intent=soporte` → agente soporte; `venta` → agente vendedor; re-encendido → agente nurture. El SOAC ya soporta la distinción por `wibsite.module`/`event.type`; el clasificador de intención ya existe en runtime.
- **Simulacro multi-turno verificado hoy:** 5 turnos → objeciones matcheadas, pricing dispara zona amarilla con rango + disclaimer, "agendemos" → cierre → **handoff** (escalado a humano, estándar F-22).

---

## 3. Errores detectados y corregidos durante el simulacro (correcciones precisas)

| # | Síntoma | Causa raíz | Corrección aplicada |
|---|---------|-----------|---------------------|
| H1 | El agente nunca salía de `calificacion` (ni propuesta, ni objeciones, ni precios) | (a) el pipeline multicanal usaba `template-default` (products vacíos); (b) `SERVICE_RE` no reconocía "desarrollo web/tienda en linea/etc." | (a) pipeline usa `AGENT_TEMPLATE_ID` o `consultora-software` con fallback default; (b) SERVICE_RE ampliado (web, móvil, full stack, tienda online, ecommerce, pasarela de pagos…) |
| H2 | `conversation_summaries` invisible/denegada para `app_user` | migración aplicada sin GRANTs; RLS habilitada se revirtió en una transacción fallida | GRANT CRUD + sequence a app_user; policy RLS robusta (`current_tenant_id() IS NULL OR tenant_id = current_tenant_id()::text`); ENABLE RLS re-aplicado — aislamiento verificado (0 filas ajenas con tenant forzado) |
| H3 | `POST /api/twenty/sync` → 500 | **TWENTY_API_KEY expirada** (`Token has expired`, 401 del servidor Twenty) — configuración, no código | Documentado como pendiente de configuración: regenerar API key en Twenty UI y actualizar `.env` |
| H4 | Visión falló 400 con URL de Wikimedia | el provider no pudo descargar URL con caracteres %-encoded | no es bug del sistema: con URL normal (`httpbin.org/image/jpeg`) la visión funcionó 418 chars; queda como lección: las URLs de media deben ser directas |
| H5 | Stack Docker caído al iniciar el simulacro | Docker Desktop detenido | levantado (`docker compose up -d`), 20 contenedores verificados |

---

## 4. Validación SOAC del simulacro (estándar quién→qué→cómo→módulo→proceso)

Cada paso del simulacro dejó evidencia verificable en el sistema de control:

| Paso del simulacro | Evidencia SOAC |
|--------------------|----------------|
| Mensaje Telegram entrante | PG: `webhook_received` (conversation_id, módulo channels) + ES logs mismo evento |
| Clasificación Dify | PG: `api_call` "Dify classify ok (Xms)" con mode/tokens/intent/score + span `llm.completion` con usage |
| Grafo | PG: `state_transition` por etapa + span `agent.graph.run` con final_stage/commercial_state/autonomy_zone/score |
| Voz sin STT | PG+ES: `fallback_activated` → `media.degraded` (dependency mediaProcessor, severity medium) |
| Imagen con visión | PG: `api_call` "Vision ok (418 chars)" + `media.processed`; ES span `media.vision` (modelo, caption_chars, trace_id) |
| Reply por canal | PG: `api_call` "Respuesta telegram/messenger…" con ok/error |
| Persistencia | PG: `conversation_summaries` turnos con machine_state/commercial_state/score/lead_extract; lead en JSON + campaign_leads |
| Aislamiento | RLS: 8 políticas; test en vivo 0 filas ajenas con tenant forzado |
| Gates | e2e-trace **10/10** (traza HTTP→graph→LLM intacta), TeVS **13/13** |

**Lectura en Kibana (:5601):** Data Views `traces-doags.otel-production`, `logs-doags.otel-production` — filtrar por `wibsite.conversation_id` para ver la conversación completa con su traza.

---

## 5. Pendientes resultantes del simulacro (no bloqueantes para pruebas locales)

1. **H3:** regenerar TWENTY_API_KEY (Twenty UI) — desbloquea la sincronización de leads al CRM.
2. Conectar tokens de canales para pruebas reales: `TELEGRAM_BOT_TOKEN` (primero), `EMAIL_API_URL/KEY`, `MESSENGER_PAGE_TOKEN`.
3. Configurar `OPENROUTER_STT_MODEL` (whisper) para activar transcripción de voz real.
4. TTS (`synthesizeSpeech` + `sendVoice`) para respuestas de voz — diseño en `ANALISIS-OPERATIVO-MULTICANAL-RAG-COTIZACIONES.md` §4.
5. Conectar RAG al grafo + plantilla de negocio con cuestionarios por servicio y mini-cotizaciones (mismo doc §5-§6).
6. Alertas Kibana (error_rate, fallback_activated, webhook_failed, PG write failed) — MC3.
7. Deploy: checklist `SECURITY-GAPS-PRE-DEPLOY.md` (S1-S3).
