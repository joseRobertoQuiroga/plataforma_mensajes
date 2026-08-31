# Wibsite Business Ã¢â‚¬â€ Estado General del Proyecto

> Documento vivo de desarrollo Ã¢â‚¬â€ Refleja el estado actual del proyecto en tiempo real

---

## Ficha del Proyecto

| Campo | Valor |
|-------|-------|
| **Nombre** | Wibsite Business |
| **PropÃƒÂ³sito** | Plataforma de mensajerÃƒÂ­a omnicanal con IA para PYMEs (WhatsApp, Messenger, TikTok, SMS, Email, Telegram) |
| **Stack** | Chatwoot + Dify + n8n + Twenty CRM + Helper Node + PostgreSQL + Redis + Weaviate + Elastic Stack (Elasticsearch + Kibana + OTel Collector) + MinIO |
| **OrquestaciÃƒÂ³n** | Docker Compose (20 servicios) |
| **Estado General** | 🟢 **Oleada 2 COMPLETADA — K4, K10, K12, L2, L6, C3, O2 cerrados. Listo para Oleada 3** |
| **Última actualización** | 2026-08-31 (Oleada 2 cerrada: Tags multi-valor, Campos custom, Listas manuales leads, Recalificación automática, Ponderación por rubro, Segmentos dinámicos. Tests 83/83 ✅) |
| **Helper Node** | v2.3.0 — **153 rutas** (123 únicas), 83 tests (8 suites unit), Oleada 2 fully live |

---

## Barra de Progreso por ÃƒÂ rea

```
Infraestructura         Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  +Authelia, Elastic Stack, MinIO (compose 20 servicios)
Helper Node             Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  v2.2.0 + store facade dual-write + agentCore + templateEngine (~120 rutas)
Middleware Seguridad    Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Auth, Rate Limit, Sanitizer, HMAC + PII filter
Conversation Store      Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  State machine 9 estados + checkpointer (conversation_summaries migrada a PG 15/08)
Lead Profile Builder    Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Tags, next action, score history
Agent Config Editor     Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  10 tipos negocio, 5 personalidades
RAG Engine              Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Weaviate + fallback in-memory
Anti-Hallucination      Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Boundaries, triggers, unknown responses
SLI/SLO Monitoring      Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Health+, metrics, uptime tracking + prom-client
Template Engine         Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Load, validate, merge, 3 plantillas
Agent Graph Engine      Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Grafo 9 nodos (F-16) + checkpointer (F-14) + guards (F-17) + Dify/fallback (F-18) + sync comercial (F-21)
Audit Logging           Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  PII filter + 24 event types + PG + puente OTLP logs Ã¢â€ â€™ Elasticsearch (15/08)
Portal Shell            Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  9 mÃƒÂ³dulos, SSO, postMessage
CRM MetodolÃƒÂ³gico        Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Script SPICED/MEDDIC 13 campos
VerificaciÃƒÂ³n            Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  TeVS 11/11 + e2e-trace 10/10 + 169 tests Jest (19 suites)
Observabilidad          Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  ES 9.4.2 + Kibana + OTel: traces+metrics+logs con rollover diario (ILM 1d/30d, 15/08)
Dify (IA)               Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦
Twenty CRM              Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦
n8n Workflows           Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜  90%  Ã¢Å¡Â Ã¯Â¸Â  3 workflows activos en BD; falta toggle UI y credenciales
Multicanal              Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜  90%  Ã¢Å“â€¦  Pipeline unificado: Email+Telegram+WhatsApp+Messenger+TikTok + broadcast + pruebas por canal; falta conectar tokens
Multimodal              Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜  90%  Ã¢Å“â€¦  STT (audioÃ¢â€ â€™texto) + visiÃƒÂ³n (imagenÃ¢â€ â€™descripciÃƒÂ³n) + TTS (textoÃ¢â€ â€™voz con reply_audio) vÃƒÂ­a OpenRouter
RAG de negocio          Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Conectado al grafo (nodo kb) + carga de kb-documents en arranque Ã¢â‚¬â€ verificado en runtime
Cotizaciones            Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Cuestionarios por servicio (8 servicios) + estimaciÃƒÂ³n por alcance + mini-cotizaciÃƒÂ³n (nodo cotizacion)
Portal Shell            Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜  90%  Ã¢Å“â€¦  8 mÃƒÂ³dulos SSO + Lead Panel + bÃƒÂºsqueda Ctrl+K + notificaciones; postMessage cross-module pendiente
Carga (F-51)            Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  k6 + simulador node: 8 conv p95 1177ms Ã‚Â· 3.29 turnos/s
n8n Workflows           Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜  90%  Ã¢Å¡Â Ã¯Â¸Â  2/3 activos en runtime (01 inbound + 02 broadcast); tercero variante con credenciales pendientes
DocumentaciÃƒÂ³n           Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  100+ archivos tÃƒÂ©cnicos
Scripts/Automatiz.      Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  backup, migrate, verify, fields, orphan-check
Chatwoot Inbox          Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜  80%  Ã¢Å¡Â Ã¯Â¸Â  Inbox + puente Twilio configurado
Meta WhatsApp API       Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜Ã¢â€“â€˜  80%  Ã¢Å¡Â Ã¯Â¸Â  Webhook Meta listo (/webhooks/whatsapp); envÃƒÂ­o por Twilio hasta migraciÃƒÂ³n
SSO (Authelia)          Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Config compose + nginx auth_request (verificado 403 sin SSO)
Flujo Inbound Real      Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  TwilioÃ¢â€ â€™helperÃ¢â€ â€™n8nÃ¢â€ â€™DifyÃ¢â€ â€™Twenty (F-05) + pipeline multicanal (15/08)
Flujo Campaign Real     Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  /api/twilio/send + StatusCallback (F-06)
Tests Unitarios         Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  176 tests (22 suites) Ã¢â‚¬â€ 15/08
TeVS (Elastic)            13/13 PASSED (15/08)
Dual-Write PG           Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë†Ã¢â€“Ë† 100%  Ã¢Å“â€¦  Rutas conectadas al facade (F-08): campaÃƒÂ±as/leads/scores/opt-outs verificados en PG (15/08)
```

---

## Resumen de Estado por Componente

| Componente | Estado | Funcionalidad | Pendiente Clave |
|-----------|--------|--------------|-----------------|
| **PostgreSQL** | Ã¢Å“â€¦ Operativo | 5 bases de datos activas | Ã¢â‚¬â€ |
| **Redis** | Ã¢Å“â€¦ Operativo | CachÃƒÂ© y colas | Ã¢â‚¬â€ |
| **Weaviate** | Ã¢Å“â€¦ Operativo | BÃƒÂºsqueda vectorial | Ã¢â‚¬â€ |
| **Nginx** | Ã¢Å“â€¦ Operativo | Proxy reverso en :8080 | Ã¢â‚¬â€ |
| **Chatwoot** | Ã¢Å“â€¦ Servicio OK + bridge Twilio | UI funcional, webhook n8n configurable, push inbound `/api/chatwoot/push` | Configurar inbox WhatsApp nativo (opcional) |
| **Dify** | Ã¢Å“â€¦ Completo | Workflow clasificador funcional con OpenRouter | Ã¢â‚¬â€ |
| **n8n** | Ã¢Å“â€¦ Servicio OK, Ã¢Å¡Â Ã¯Â¸Â Config pendiente | Workflows importados, body parser bug conocido | Activar workflows UI, crear credenciales |
| **Twenty CRM** | ❌ **CANCELADO (ADR-010, 31/08)** — fuera de alcance por decisión técnica; frontera única = frontend unificado; resto de contenedores = motores de backend | Ã¢â‚¬â€ |
| **Helper Node** | Ã¢Å“â€¦ Completo | ~108 rutas (~35+ grupos), dashboard SPA, PostgreSQL + JSON fallback | Ã¢â‚¬â€ |
| **Elasticsearch** | Ã¢Å“â€¦ Operativo | Datastreams traces/metrics/logs con ILM rollover 1d + delete 30d (15/08) | Ã¢â‚¬â€ |
| **Kibana** | Ã¢Å“â€¦ Operativo | UI observabilidad en :5601 | Ã¢â‚¬â€ |
| **OTel Collector** | Ã¢Å“â€¦ Operativo | OTLP :4317/:4318 Ã¢â€ â€™ ES: traces + metrics + logs (helper emite logs 15/08) | Ã¢â‚¬â€ |
| **MinIO** | Ã¢Å“â€¦ Operativo | Object storage :9000 + consola :9001 | Ã¢â‚¬â€ |
| **Meta API** | Ã¢Å¡Â Ã¯Â¸Â Webhook listo | `/webhooks/whatsapp` (GET verify + POST) | EnvÃƒÂ­o por Twilio hasta migraciÃƒÂ³n |
| **Authelia** | Ã¢Å“â€¦ Operativo | Gateway SSO con nginx auth_request Ã¢â‚¬â€ verificado 403 sin SSO (14/08) | Ã¢â‚¬â€ |
| **Telegram** | Ã¢Å“â€¦ Adapter listo | Bot API sendMessage + webhook + normalizaciÃƒÂ³n (voz/foto/video) | Conectar TELEGRAM_BOT_TOKEN y probar con bot real |
| **Multimodal** | Ã¢Å“â€¦ Bases | STT (OpenRouter transcripciones) + visiÃƒÂ³n (gpt-4o-mini) con degradaciÃƒÂ³n elegante | Configurar OPENROUTER_STT_MODEL |
| **Frappe/ERP** | Ã¢Â¬Å“ Diferido | Ruta nginx `/erp/` comentada; decisiÃƒÂ³n de negocio futura | F-28/F-29 |
| **Metabase/BI** | Ã¢Â¬Å“ Diferido | Ruta nginx `/reportes/` comentada | F-52 |

> **VerificaciÃƒÂ³n en vivo (2026-08-30 (verificacin en vivo: Oleada 0 completada. Cutover PG y normalizacin al 100%. Tests 83/83 en dev)

---

## Logros Clave (Resumen)

- 20 servicios Docker orquestados y comunicÃƒÂ¡ndose (incluye Elastic Stack + MinIO)
- Helper Node con CRUD completo de campaÃƒÂ±as multi-canal, scoring, templates, sync CRM
- Workflow Dify de 8 nodos LLM funcional clasificando leads vÃƒÂ­a OpenRouter
- 10 campos personalizados en Twenty CRM con sincronizaciÃƒÂ³n bidireccional
- 3 workflows n8n importados (inbound message + campaign broadcast + score & sync)
- Bridge Twilio real funcionando (inbound + broadcast con StatusCallback, F-03Ã¢â‚¬Â¦F-06)
- Elastic Stack + OpenTelemetry configurados (reemplazan Prometheus/Grafana/GlitchTip)
- Suite TeVS creada (11 tests integraciÃƒÂ³n con Elasticsearch) Ã¢â‚¬â€ pendiente de ejecuciÃƒÂ³n
- 100+ archivos de documentaciÃƒÂ³n tÃƒÂ©cnica
- Dashboard SPA con monitoreo en tiempo real + hub/control-center
- Upload Excel/CSV con auto-detecciÃƒÂ³n de columnas
- Motor agÃƒÂ©ntico ejecutable (Oleada C, 2026-08-12): grafo 9 nodos con aristas condicionales, checkpointer de memoria (Redis + PG `conversation_summaries`), guards de confidencialidad/autonomÃƒÂ­a (zonas green/yellow/red con PII assisted), Dify como nodo con fallback OpenRouter + circuit breaker, y sync mÃƒÂ¡quina comercialÃ¢â€ â€tÃƒÂ©cnica vÃƒÂ­a `commercialState`
- **Oleada multicanal + monitoreo**
- **Oleada 1: Ciclo de vida del lead (F1, L4, L5, L8, K1, K5, K6, K7, K13, D3)** completada con 83/83 tests.

Ã¢â€ â€™ Ver detalle completo en [`LOGROS.md`](./LOGROS.md)

---

## PrÃƒÂ³ximos Pasos Inmediatos (Top 5)

| Prioridad | AcciÃƒÂ³n | Requiere |
|-----------|--------|----------|
| 1 | Ã°Å¸â€â€˜ Conectar `TELEGRAM_BOT_TOKEN` (BotFather) y probar el bot real vÃƒÂ­a `/webhooks/telegram` o `/api/channels/test` | Token de bot |
| 2 | Ã°Å¸â€â€™ Resolver checklist de seguridad pre-deploy (`docs/SECURITY-GAPS-PRE-DEPLOY.md`: S1-S3) | Etapa deploy |
| 3 | Ã¢Å¡â„¢Ã¯Â¸Â Activar workflows n8n (01-inbound, 02-broadcast) con credenciales en UI (:5679) | UI n8n |
| 4 | Ã°Å¸â€œÅ  Validar dashboards Kibana con los 3 datastreams (traces+metrics+logs) | Kibana :5601 |
| 5 | Ã¢â€“Â¶Ã¯Â¸Â F-09 cutover PG (feature flag STORE_MODE=pg cuando RLS tenant complete) + F-51 load test k6 | Ver TEC-06 |

Ã¢â€ â€™ Ver detalle completo en [`OBJETIVOS-PENDIENTES.md`](./OBJETIVOS-PENDIENTES.md)

---

## Estructura del Proyecto

```
wibsite/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ Avances/                  # Ã¢â€ Â ESTÃƒÂ AQUÃƒÂ Ã¢â‚¬â€ Documento vivo de estado
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ ESTADO-GENERAL.md     #   Este archivo Ã¢â‚¬â€ visiÃƒÂ³n general
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ LOGROS.md             #   Todo lo completado hasta ahora
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ OBJETIVOS-PENDIENTES.md  #   Pendientes priorizados
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ COMPONENTES.md        #   Matriz de salud de servicios
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ PROCEDIMIENTOS.md     #   Comandos y pasos operativos
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ROADMAP.md            #   Hoja de ruta futura
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ docs/                     # DocumentaciÃƒÂ³n detallada
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ specs/                    # Especificaciones tÃƒÂ©cnicas
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ scripts/                  # Scripts de automatizaciÃƒÂ³n
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ helper-node/              # Servicio Express.js personalizado
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ n8n/workflows/            # Workflows n8n
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ dify/workflows/           # Workflows Dify
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ authelia/                 # ConfiguraciÃƒÂ³n Authelia
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ certs/                    # Certificados SSL
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ docker-compose.yml        # OrquestaciÃƒÂ³n de servicios
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ nginx.conf                # ConfiguraciÃƒÂ³n Nginx
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ .env                      # Variables de entorno
```

---

## Comandos RÃƒÂ¡pidos

```bash
# Ver estado de servicios
docker compose ps

# Verificar health de helper-node
curl http://localhost:3100/health

# Ver salud Elastic Stack
curl http://localhost:9200/_cluster/health
# Kibana: http://localhost:5601

# Ejecutar suite TeVS (PowerShell)
./scripts/tevs/tevs-runner.ps1 -Environment local -ElasticUrl "http://localhost:9200"

# Ver dashboard de campaÃƒÂ±as
curl http://localhost:3100/api/dashboard/summary

# Poblar datos de prueba
curl -X POST http://localhost:3100/api/seed

# Verificar conexiÃƒÂ³n Twenty CRM
curl http://localhost:3100/api/twenty/health
```