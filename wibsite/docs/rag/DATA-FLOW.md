# Data Flows (RAG-optimized)

## Flow 1: WhatsApp Inbound Message Processing
```
User WhatsApp ──→ Meta Cloud API
                       │
                       ▼
              Chatwoot WhatsApp Inbox
                       │
                       ▼ (webhook: message_created)
              n8n Webhook (01-inbound-message)
                       │
                   ┌───┴───┐
                   │       │
                   ▼       ▼
            Dify Workflow  helper-node
            (classify)     (normalize)
                   │
                   ▼
            Chatwoot API
            (send reply)
                   │
                   ▼
            Twenty CRM
            (create/update lead)
```

## Flow 2: Campaign Broadcast
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
    Meta WhatsApp API (send template messages)
         │
         ▼
    helper-node POST /campaigns/track
    (delivery status per contact)
         │
         ▼
    Meta Webhook → helper-node POST /webhooks/whatsapp
    (status: sent/delivered/read/failed)
```

## Flow 3: Opt-Out Handling
```
User replies "STOP" → Meta Webhook → helper-node POST /opt-outs
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
    Dify Workflow: whatsapp-lead-classifier.yml
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

## Integration Points
| Point | Source | Target | Protocol |
|-------|--------|--------|----------|
| Chatwoot → n8n | Chatwoot Webhook | n8n Webhook | HTTP POST |
| n8n → Dify | n8n HTTP Request | Dify Workflow API | HTTP POST (Bearer) |
| n8n → Twenty | n8n HTTP Request | Twenty GraphQL | HTTP POST (Bearer) |
| n8n → Chatwoot | n8n HTTP Request | Chatwoot API | HTTP POST (api_access_token) |
| n8n → Helper | n8n HTTP Request | Helper API | HTTP |
| Meta → Helper | Meta Webhook | Helper /webhooks/whatsapp | HTTP GET/POST |
