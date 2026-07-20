# Wibsite Business — Arquitectura

## Visión General

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                    CLIENTE                                  │
                    │              WhatsApp / Web / Instagram                     │
                    └────────────────────────┬────────────────────────────────────┘
                                             │
                    ┌────────────────────────▼────────────────────────────────────┐
                    │                     CHATWOOT                                │
                    │         Plataforma omnicanal de comunicación               │
                    │    Recibe mensajes → Webhook a n8n → Recibe respuestas      │
                    └────────────────────────┬────────────────────────────────────┘
                                             │
                                             │ webhook
                                             ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                        n8n                                  │
                    │           Orquestador de workflows automatizados            │
                    │                                                             │
                    │  ┌─────────────┐  ┌──────────┐  ┌──────────────────────┐   │
                    │  │ Inbound Flow│  │Campaign  │  │ Integration Helpers  │   │
                    │  │ Chatwoot →  │  │Broadcast │  │ (data transform,     │   │
                    │  │ Dify →     │  │Twenty →  │  │  logging, tracking)  │   │
                    │  │ Twenty CRM │  │Meta API  │  │                      │   │
                    │  └──────┬──────┘  └────┬─────┘  └──────────────────────┘   │
                    └─────────┼──────────────┼────────────────────────────────────┘
                              │              │
               ┌──────────────┘              └──────────────┐
               ▼                                             ▼
┌─────────────────────────────┐              ┌─────────────────────────────┐
│           DIFY              │              │        TWENTY CRM           │
│     Motor de IA / RAG       │              │   CRM Comercial Moderno     │
│                             │              │                             │
│  • Clasifica intención      │              │  • Contactos y cuentas       │
│  • Extrae datos contacto    │              │  • Leads y oportunidades     │
│  • Calcula scoring (0-100)  │              │  • Pipeline visual           │
│  • Genera respuesta sugerida│              │  • Actividades y timeline    │
│  • Detecta escalamiento     │              │  • Scoring y prioridades     │
│  • Personaliza campañas     │              │  • Segmentación para campañas│
└─────────────────────────────┘              └─────────────────────────────┘
                                                              │
                                                              │ (Futuro: via n8n)
                                                              ▼
                                             ┌─────────────────────────────┐
                                             │       FRAPPE ERP           │
                                             │    (Fase 2 en adelante)     │
                                             └─────────────────────────────┘
```

## Flujo de Mensaje Entrante (Inbound)

```
1. Cliente envía WhatsApp
2. Meta Cloud API → Chatwoot (WhatsApp Inbox)
3. Chatwoot dispara webhook → n8n (endpoint: /webhook/chatwoot-inbound)
4. n8n filtra: solo mensajes tipo "incoming"
5. n8n construye payload y llama a Dify API
6. Dify ejecuta workflow "Wibsite WhatsApp Lead Classifier":
   a. Detecta idioma
   b. Clasifica intención (compra, soporte, consulta, etc.)
   c. Extrae datos del contacto (nombre, email, empresa, etc.)
   d. Calcula score (0-100) y determina status (cold/warm/hot)
   e. Genera respuesta sugerida
   f. Decide si requiere escalamiento humano
7. Dify retorna JSON estructurado a n8n
8. n8n:
   a. Si puede auto-responder → envía respuesta via Chatwoot API
   b. Agrega nota privada con análisis IA en Chatwoot
   c. Crea/actualiza lead en Twenty CRM vía API GraphQL
   d. Si requiere humano → agrega nota de escalamiento en Chatwoot
```

## Flujo de Campaña (Outbound)

```
1. n8n (Schedule Trigger o Webhook manual) consulta campañas pendientes
2. Para cada campaña pendiente:
   a. Obtiene audiencia desde Twenty CRM (filtros: leads activos, no opt-out)
   b. Para cada contacto en la audiencia:
      - Verifica opt-out
      - Personaliza mensaje (opcional: vía Dify)
      - Envía WhatsApp via Meta Cloud API
      - Registra delivery en helper-node
3. Helper-node recibe status callbacks de Meta (sent/delivered/read/failed)
4. n8n actualiza estadísticas de campaña en helper-node
```

## Stack Tecnológico

| Componente | Tecnología | Puerto | Propósito |
|-----------|-----------|--------|-----------|
| Chatwoot | Ruby on Rails + Vue.js | 3002 | Comunicación omnicanal |
| Dify | Python (Flask) + Next.js | 3003 (web) / 5001 (api) | IA, RAG, Workflows |
| n8n | Node.js + Vue.js | 5678 | Orquestación y automatización |
| Twenty CRM | TypeScript + React + GraphQL | 3001 | CRM comercial |
| Helper Node | Node.js + Express | 3100 | Lógica de integración personalizada |
| PostgreSQL | 15 | — | Base de datos compartida |
| Redis | 7 | — | Caché y colas |
| Weaviate | 1.26 | — | Base de datos vectorial para Dify |
| Nginx | 1.27 | 80 | Proxy reverso unificado |

## Rutas Unificadas (via Nginx)

| Ruta | Destino |
|------|---------|
| /chatwoot/ | Chatwoot UI |
| /dify/ | Dify Web UI |
| /dify-api/ | Dify API |
| /n8n/ | n8n UI |
| /crm/ | Twenty CRM |
| /api/helper/ | Helper API |

## Variables de Entorno Críticas

Ver `.env.example` para la lista completa. Las más importantes:

- `CHATWOOT_SECRET_KEY` — Secreto de Rails para Chatwoot
- `DIFY_SECRET_KEY` — Secreto de Flask para Dify
- `N8N_ENCRYPTION_KEY` — Clave de cifrado de n8n
- `TWENTY_*_SECRET` — Secretos JWT de Twenty CRM
- `META_APP_ID`, `META_APP_SECRET` — Credenciales de Meta App
- `WHATSAPP_PHONE_NUMBER_ID` — ID del número de WhatsApp Business
- `DIFY_API_KEY` — API Key generada en Dify
- `CHATWOOT_API_KEY` — API Key generada en Chatwoot
- `TWENTY_API_KEY` — API Key generada en Twenty CRM
