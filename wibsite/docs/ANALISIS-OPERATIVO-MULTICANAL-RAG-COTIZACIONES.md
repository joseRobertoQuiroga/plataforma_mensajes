# Análisis Operativo — Canales, Multimodal, RAG, Plantillas y Cotizaciones (15/08/2026)

> Pregunta central: ¿qué falta (excluyendo secretos/passwords, que quedan para deploy) para probar localmente el sistema completo — recepción de texto/audio/imagen y respuestas del agente — con Telegram y Email (Gmail) como canales de prueba?
> Complementa: `docs/ANALISIS-CRUZADO-2026-08-15.md`, `Avances/ESTADO-GENERAL.md`.

---

## 1. Hallazgos nuevos de esta revisión (ya corregidos)

| # | Hallazgo | Corrección aplicada |
|---|----------|---------------------|
| H1 | `docker-compose.yml` no pasaba `DIFY_API_KEY` al helper → **Dify nunca se invocaba** (siempre fallback OpenRouter) | añadida env `DIFY_API_KEY: ${DIFY_API_KEY}` |
| H2 | `DIFY_API_URL` en compose sin sufijo `/v1/workflows/run` → **404** al invocar Dify | llmClient normaliza la URL (acepta base o ruta completa) |
| H3 | El workflow Dify exige `contact_name` y el helper no lo enviaba → **400 invalid_param** | llmClient envía `contact_name`/`phone` (desde el estado del lead) |
| H4 | `.env` usaba `OPENROUTER_MODEL=openai/gpt-4o` (pagado) — contradice la capa gratuita | cambiado a `openai/gpt-4o-mini` |

**Verificado en runtime:** `POST /api/agent/chat` → audit `Dify classify ok (6111ms, mode: primary)` — el workflow Dify de 8 nodos ya participa del flujo real.

> ⚠️ Latencia Dify: ~6.1s por turno (workflow blocking). Para fluidez: (a) streaming, (b) timeout corto con fallback OpenRouter (~2.3s), (c) clasificador local para saludos/objeciones y Dify solo para clasificación compleja.

---

## 2. Estado de los 5 canales + chatbot como interfaz

| Canal | Adapter | Envío | Recepción | Para probar YA |
|-------|---------|-------|-----------|----------------|
| **Telegram** | ✅ real (Bot API) | ✅ `sendMessage` | ✅ `/webhooks/telegram` + secret | **Solo falta `TELEGRAM_BOT_TOKEN`** (BotFather → 5 min) |
| **Email/Gmail** | ✅ API HTTP genérica (Resend/Postmark/Mailgun/SendGrid) | ✅ `sendMessage` | ✅ `/webhooks/email-inbound` (normaliza Postmark y formato interno) | Envío: cuenta free Resend/SendGrid. Recepción: webhook del proveedor (SendGrid Inbound Parse / CloudMailin). **Gmail directo requiere OAuth/IMAP (no implementado)** |
| **WhatsApp** | ✅ Twilio (sandbox activo) + webhook Meta listo | ✅ Twilio Messages | ✅ `/webhooks/twilio-inbound` | Ya opera en sandbox Twilio; Meta Cloud API = pendiente aprobación de Meta |
| **Messenger** | ✅ Graph API v21 | ✅ `me/messages` | ✅ `/webhooks/messenger` + hub.verify | Falta `MESSENGER_PAGE_TOKEN` + página Meta |
| **TikTok** | 🟡 bases | vía agregador | ✅ `/webhooks/tiktok-comments` | API de comentarios requiere aprobación de app |

**Chatbot como interfaz única:** pipeline unificado (`handleInboundMessage` → grafo agente → reply por el mismo canal) para los 5 canales. Apoyo: `GET /api/channels/status`, `POST /api/channels/test` (enviar mensaje de prueba sin webhook público).

---

## 3. Monitoreo, multiagente y controles

**Verificado (15/08):** trazas E2E (`HTTP → agent.graph.run → llm.completion` con usage/intent/score; gate **10/10**); logs de negocio en ES (`event.type`, `wibsite.module/flow/action`, trace/span; puente OTLP nuevo); TeVS **11/11**; audit_logs 90%+ con trace/span; guards de autonomía/confidencialidad/anti-hallucination/circuit-breaker activos.

**Multiagente (G-35):** hoy es **un solo agente** (grafo 8 etapas, 9 nodos) — no existe router multiagente. El monitoreo ya está listo para multiagente (cada agente emitiría spans con su `wibsite.module`). Plan natural: (1) vendedor (actual), (2) soporte (`intent=soporte`), (3) re-encendido/campañas, con `agentRouter` que elige por intent/score — el clasificador ya existe.

**Controles posteriores pendientes:**
- ⬜ Alertas en Kibana/ES: error_rate > 5% (5 min), `fallback_activated`, `webhook_failed`, `PG write failed` → notificación.
- ⬜ Dashboard multicanal: tasa de respuesta por canal, latencia LLM P95, fallos STT/visión.
- ✅ Acceso: SSO Authelia + RLS 7 tablas + rate limiting (verificado 403/200).

---

## 4. Multimodal — estado y respuesta por audio

| Entrada | Estado | Detalle |
|---------|--------|---------|
| Texto | ✅ completo | todos los canales |
| **Audio (voz)** | 🟡 bases listas, falta token STT | Telegram: `voice` → `getFile` → STT OpenRouter (`/audio/transcriptions`, p.ej. whisper) → texto al agente. Messenger/WhatsApp igual vía URL |
| **Imagen** | 🟡 bases listas | `describeImage` vía `gpt-4o-mini` (visión free tier) → descripción al agente |
| Video | 🟡 degradado | transcripción de audio + descripción de thumbnail (frames FFmpeg = futuro) |

**Respuesta por audio (TTS) — viabilidad: ALTA, no implementada aún** (`ttsEngine.js` no existe; G-37 ⬜).

- **Camino 1 — OpenRouter TTS** (`POST /audio/speech`, p.ej. `openai/gpt-4o-mini-tts`): texto del agente → mp3/ogg → `sendVoice`. Latencia estimada TTS 1-3s + envío ~1s ≈ **4-5s por respuesta** — fluido para mensajería (no es llamada en tiempo real).
- **Camino 2 — bajo demanda (recomendado):** el agente responde texto por defecto (2-6s) y **voz solo si el usuario manda voz o lo pide**. Evita costo/latencia innecesaria.
- **Sin pérdida de información:** todo pasa por texto primero (STT → texto → agente → texto → TTS); el texto siempre queda en audit_logs/ES e historial. Si STT falla → el agente pide escribirlo (degradación ya implementada).
- **Capa gratuita:** whisper en OpenRouter tiene límites; alternativas free: Groq STT (whisper v3) y Edge-TTS (sin key) — el adapter es configurable por URL/modelo.

**Implementación sugerida (próxima iteración):** `mediaProcessor.synthesizeSpeech(text, {format:'ogg'})` + `telegramAdapter.sendVoice` + flag `reply_audio: auto|off|on_demand` por canal. ~1-2 h; sin dependencias nuevas (HTTP).

---

## 5. RAG y carga de la información del negocio

**Estado real:**
- `kb-documents/faq.txt` tiene 8 FAQs genéricas; `scripts/load-kb-documents.js` indexa en Weaviate + fallback in-memory. Endpoints: `GET/POST /api/knowledge-base/documents`, `POST /api/knowledge-base/query`.
- **HALLAZGO CLAVE (R1): el grafo del agente NO consulta RAG.** El LLM solo clasifica intent/score; las respuestas salen de nodos con texto fijo + `slotFilling` (regex). La FAQ de negocio nunca llega a la conversación del agente.
- **Servicios/inventario:** hoy viven en `template.products[]` (nombre, descripción, min/max price); propuestaNode matchea y da rango si la zona lo permite.

**Qué falta para la agencia (integración, web, móvil, full stack, plataformas):**
1. **Conectar RAG al grafo (R2):** en analyzeNode, si el mensaje matchea FAQ, añadir el chunk como contexto (o nodo `kb` previo a propuesta). Mecánica: `queryInMemoryKB(message)` → top-1 → contexto.
2. **Carga de servicios:** un archivo por servicio en `kb-documents/` (`servicios-integracion.txt`, `servicios-web.txt`, `servicios-movil.txt`, `servicios-fullstack.txt`, `servicios-plataformas.txt`) con alcance, tiempos, rangos y casos de éxito → `node scripts/load-kb-documents.js` o `POST /api/knowledge-base/documents`.
3. **`template.products[]` sincronizado** con los 5 servicios (hoy hay 4 en template-consultora-software: integración, módulo nuevo, desarrollo a medida, auditoría).

---

## 6. Lógica de negocio + plantillas dinámicas + cuestionarios por servicio + cotizaciones

**Ya existe:**
- `templateEngine` valida/carga JSON; `PUT /api/agent/templates/:id` **guarda plantillas dinámicamente** (sin tocar código).
- `agentConfig` por tenant: `business_name`, 10 tipos de negocio, 5 personalidades, `products[]`, `faqs[]`, horarios, saludo, disclaimers (`GET/PUT /api/agent/config`).
- El grafo recoge: nombre, teléfono, email, `service_type` (regex: integración/auditoría/consultoría/desarrollo a medida/módulo nuevo), urgencia; propuesta con rango de precio en zona amarilla + disclaimer.

**Lo que falta (cuestionarios + estimados + mini-cotizaciones):**

| # | Capacidad | Estado | Qué falta |
|---|-----------|--------|-----------|
| C1 | Detección del servicio específico | 🟡 regex básico | ampliar `SERVICE_RE` (web, móvil, full stack, plataformas, tiendas) + match por template.products |
| C2 | Cuestionarios por servicio | ⬜ | campo `questionnaire[]` por producto en la plantilla (integración → "¿qué sistemas conectas?", web → "¿landing/tienda/panel?", móvil → "¿iOS/Android?") y nodo que pregunte según servicio detectado |
| C3 | Estimación por alcance | ⬜ | matriz servicio × factores (urgencia, nº integraciones, módulos) → rango ajustado (hoy solo min/max fijo) |
| C4 | Mini-cotización generada | ⬜ | al completar fit: resumen (servicio, alcance, rango, tiempos, garantía 6m, validez 15d) enviado por el canal + guardado en lead + opcional PDF/HTML |
| C5 | Primer contacto por campaña | ✅ Twilio | falta broadcast multicanal genérico (Telegram/Email) |

**Diseño sugerido (datos de plantilla, sin reescribir nodos):**

```json
"products": [{
  "name": "Desarrollo web",
  "description": "Landings, tiendas, paneles",
  "min_price": 800, "max_price": 6000,
  "questionnaire": [
    {"field": "web_type", "question": "¿Buscas una landing, una tienda en línea o un panel de gestión?"},
    {"field": "scale", "question": "¿Cuántos usuarios/visitas aproximadas manejarías?"}
  ],
  "estimate_factors": {"web_type": {"landing": 0.6, "tienda": 1.5, "panel": 2.2}}
}]
```

---

## 7. Cómo se ve la información hoy (logs, Dify, Twenty)

- **PG `audit_logs`**: 24 event types; activos hoy: `state_transition`, `api_call`, `e2e_trace`, `fallback_activated`, `security_alert`, `webhook_received`, `webhook_failed`, `error`, `incident_opened`. Consulta: `SELECT event_type, count(*) FROM audit_logs GROUP BY 1;`
- **Elasticsearch**: `traces-doags.otel-production` (spans HTTP→graph→LLM con usage/intent/score), `logs-doags.otel-production` (eventos de negocio con attrs `wibsite.*`), `metrics-doags.otel-production`. Kibana :5601.
- **Dify** (desde hoy en el flujo): workflow clasificador de 8 nodos; modo primary con fallback OpenRouter + circuit breaker. Output `final_result` con intent/score.
- **Twenty**: `/api/twenty/sync` (push de leads con campos SPICED/MEDDIC), `/webhooks/twenty` (bidireccional), `/api/twenty/health`.

---

## 8. Checklist para llegar a las pruebas locales (Telegram + Email)

**Inmediato (hoy):**
1. Crear bot en BotFather → `TELEGRAM_BOT_TOKEN` en `.env` → `docker compose up -d helper` → `POST /api/channels/test {channel:"telegram", to:"<chat_id>", text:"hola"}`.
2. Email: crear cuenta free (Resend/SendGrid) → `EMAIL_API_URL/KEY/FROM` → probar envío con `/api/channels/test`; recepción con webhook del proveedor (SendGrid Inbound Parse o CloudMailin) apuntando a `https://<tu-ip>:8080/webhooks/email-inbound` (o `ngrok` → helper :3100).

**Siguiente iteración (recomendado):**
3. TTS (`synthesizeSpeech` + `sendVoice`) para responder audio a mensajes de voz (análisis §4).
4. Conectar RAG al grafo (R2) + cargar los 5 servicios en kb-documents (§5).
5. Cuestionarios por servicio + estimación + mini-cotización (C2-C4) vía plantilla JSON (§6).
6. Alertas Kibana (MC3) + dashboard multicanal.

**Diferido (no bloquea pruebas):** WhatsApp/Messenger (esperando Meta), TikTok (aprobación de API), Frappe/ERP y Metabase (oleadas futuras), F-51 k6, F-47 suite de comportamiento.

---

## 9. Pendientes no relacionados con secretos/passwords (resumen)

| # | Pendiente | Bloquea | Estado |
|---|-----------|---------|--------|
| B1 | F-09 cutover PG (lecturas unificadas, flag STORE_MODE=pg) | producción | dual-write ✅; falta flag |
| B2 | n8n: activar workflows 01/02 con credenciales UI | automatización | workflows en BD sin activar |
| B3 | F-51 load test k6 | capacidad | no existe |
| B4 | F-47 suite de comportamiento E2E | calidad agente | no existe |
| R1/R2 | RAG conectado al grafo | respuestas de negocio | KB existe pero no se usa en conversación |
| C2-C4 | Cuestionarios por servicio + estimación + mini-cotización | caso de negocio del usuario | diseño listo (§6) |
| G-37 | TTS respuesta por audio | responder voz | diseño listo (§4) |
| MC3 | Alertas Kibana | reacción automática | pendiente |
| MC5 | Broadcast multicanal (Telegram/Email) | campañas en nuevos canales | solo Twilio hoy |
