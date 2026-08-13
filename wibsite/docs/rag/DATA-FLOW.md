# Data Flows (RAG-optimized)

> Actualizado: 2026-08-12 — canal real: **Twilio** (Meta en pausa). Ruta Meta documentada en `docs/CIERRE-FINAL-TWILIO` como transición futura opcional.

## Flow 1: WhatsApp Inbound Message (Twilio — implementado, TEC-06 F-05)
```
User WhatsApp ──→ Twilio (inbound webhook)
                        │
                        ▼
               helper-node POST /webhooks/whatsapp
               (normaliza, persiste lead+delivery)
                        │
                        ▼
               n8n Webhook (01-inbound-message, /webhook/chatwoot-inbound)
                        │
                    ┌───┴───┐
                    │       │
                    ▼       ▼
             Dify Workflow  helper-node
             (classify)     (push a Chatwoot /api/chatwoot/push)
                    │
                    ▼
             Respuesta → Twilio (typing + envío, F-24)
                    │
                    ▼
             Twenty CRM (upsert lead)
```

## Flow 2: Campaign Broadcast (Twilio — implementado, TEC-06 F-06)
```
n8n Schedule/Manual Trigger
          │
          ▼
    helper-node GET /campaigns/pending
          │
          ▼
    Twenty CRM (query contacts by audience_filter)
          │
          ▼
    Dify (generate personalized content)
          │
          ▼
    helper-node POST /api/twilio/send (StatusCallback)
          │
          ▼
    Twilio StatusCallback → helper (delivery: sent/delivered/read/failed)
          │
          ▼
    helper-node POST /campaigns/track (por contacto)
```

## Flow 3: Opt-Out Handling
```
User responde STOP → Twilio/Twenty → helper POST /opt-outs
                                              │
                                              ▼
                                      n8n campaign checks
                                      GET /opt-outs/check?phone=X
```

## Flow 4: Lead Classification (Dify Workflow)
```
Input: message content, sender info, conversation history
          │
          ▼
    Dify Workflow: whatsapp-lead-classifier.yml (8 nodos LLM)
          │
     ┌────┴────┐
     │         │
     ▼         ▼
 LLM Call   Data Extraction
(gpt-4o-mini) (name, phone, interest, score)
     │         │
     └────┬────┘
          ▼
    Output: { classification, score, extracted_data, suggested_reply }
```

## Flow 5: Telemetría (OTel → Elasticsearch)
```
helper (prom-client + OTLP) / n8n ogt / servicios → OTLP :4317/:4318
          │
          ▼
    otel-collector (config.yaml)
          │
          ▼
    Elasticsearch :9200 (índices *-doags.otel-production)
          │
          ▼
    Kibana :5601 (dashboards, trazas, logs)
```

## Integration Points
| Point | Source | Target | Protocol |
|-------|--------|--------|----------|
| Twilio → Helper | Twilio Inbound | Helper /webhooks/whatsapp | HTTP POST |
| Helper → Chatwoot | Helper /api/chatwoot/push | Chatwoot API | HTTP POST (api_access_token) |
| Helper → n8n | Helper forward | n8n /webhook/chatwoot-inbound | HTTP POST |
| n8n → Dify | n8n HTTP Request | Dify Workflow API | HTTP POST (Bearer) |
| n8n → Twenty | n8n HTTP Request | Twenty GraphQL | HTTP POST (Bearer) |
| Helper → Twilio | Helper /api/twilio/send | Twilio API | HTTP POST (Basic auth) |
| Twilio → Helper | StatusCallback | Helper | HTTP POST |
| Apps → OTel | helper/n8n | otel-collector:4317/4318 | OTLP gRPC/HTTP |
| OTel → ES | otel-collector | elasticsearch:9200 | HTTP (ES API) |

## Ruta Meta (opcional futura, reposada)
`docs/CIERRE-FINAL-TWILIO` mantiene la transición Meta documentada; hoy Twilio cubre inbound + broadcast con delivery tracking.