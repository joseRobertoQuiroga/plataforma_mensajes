# Wibsite Business — Documento Maestro de Arquitectura y Desarrollo

> **Versión:** 1.0 (Julio 2026)
> **Estado:** Fase 1 en implementación
> **Stack:** Chatwoot + Dify + n8n + Twenty CRM + Frappe (futuro)

---

## Índice

1. [Visión del Producto](#1-visión-del-producto)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Flujos de Datos](#4-flujos-de-datos)
5. [Roadmap a Producción](#5-roadmap-a-producción)
6. [Fase 0: Fundación](#6-fase-0-fundación)
7. [Fase 1: WhatsApp + IA + Twenty CRM](#7-fase-1-whatsapp--ia--twenty-crm)
8. [Fase 2: Integración Frappe ERP](#8-fase-2-integración-frappe-erp)
9. [Fase 3: Lumi Sales Copilot](#9-fase-3-lumi-sales-copilot)
10. [Fase 4: Pipeline IA Avanzado](#10-fase-4-pipeline-ia-avanzado)
11. [Fase 5: Endurecimiento Producción](#11-fase-5-endurecimiento-producción)
12. [Fase 6: Analytics e Inteligencia de Negocio](#12-fase-6-analytics-e-inteligencia-de-negocio)
13. [Fase 7: Multi-Tenant y Escalamiento](#13-fase-7-multi-tenant-y-escalamiento)
14. [Referencia de Configuración](#14-referencia-de-configuración)
15. [Matriz de Riesgos](#15-matriz-de-riesgos)
16. [Métricas de Éxito](#16-métricas-de-éxito)

---

## 1. Visión del Producto

### 1.1 Propuesta de Valor

Wibsite Business no es "un CRM con IA". Es una **plataforma de operaciones comerciales inteligentes** que reemplaza 4-7 herramientas dispersas (WhatsApp Business, chatbot, CRM, ERP, Power BI, automatizaciones) en un solo ecosistema integrado.

### 1.2 Diferenciadores Clave

| Componente | Diferenciador | Competencia |
|-----------|--------------|-------------|
| Omnicanal | Chatwoot centraliza WhatsApp + Web + Instagram en un panel | HubSpot solo integraciones parciales |
| IA Conversacional | Dify clasifica intención, extrae datos, genera respuestas y califica leads automáticamente | Zoho IA parcial, Salesforce caro |
| CRM Moderno | Twenty CRM con UX tipo Notion/Airtable | Odoo CRM pesado, HubSpot caro |
| Automatización | n8n conecta todo sin código | Make/Zapier = costo adicional |
| ERP Integrado | Frappe maneja facturación, inventario, proyectos (Fase 2) | HubSpot no tiene ERP |
| Copiloto IA | Lumi analiza cada lead y recomienda acciones al vendedor | Ninguno ofrece esto integrado |

### 1.3 Mercado Objetivo

- **Primario:** PYMEs en Bolivia y Latinoamérica (5-200 empleados)
- **Secundario:** Medianas empresas en LATAM que buscan digitalizar su fuerza de ventas
- **Precio estimado:** USD 15-59 por usuario/mes (según plan)

### 1.4 Competencia en Bolivia

No existe competidor directo. La competencia real es la **suma de herramientas sueltas**:
- HubSpot (CRM) + WhatsApp Business API + Chatbot + Make + Odoo + Power BI
- El cliente paga integración aparte

Wibsite compite contra el **costo y complejidad de integrar 5-6 productos diferentes**.

---

## 2. Arquitectura del Sistema

### 2.1 Diagrama de Arquitectura General

```
                           ┌──────────────────────────────────────────┐
                           │              CLIENTE                    │
                           │    WhatsApp / Web / Instagram            │
                           └──────────────────┬───────────────────────┘
                                              │
                    ┌─────────────────────────▼─────────────────────────┐
                    │                   CHATWOOT                       │
                    │          Plataforma Omnicanal de Comunicación     │
                    │                                                  │
                    │  Funciones:                                      │
                    │  • Recibir mensajes de WhatsApp/Web/IG           │
                    │  • Enrutar a agente humano o IA                  │
                    │  • Webhook a n8n por cada mensaje                │
                    │  • Recibir respuestas desde n8n                  │
                    │  • Panel de agente con historial                  │
                    └──────────────────────┬───────────────────────────┘
                                           │ Webhook (POST /webhook/chatwoot-inbound)
                                           ▼
                    ┌──────────────────────────────────────────────────────┐
                    │                      n8n                             │
                    │             Orquestador de Workflows                 │
                    │                                                      │
                    │  ┌─────────────────┐  ┌──────────────────────────┐   │
                    │  │ Workflow 01     │  │ Workflow 02              │   │
                    │  │ Inbound Message │  │ Campaign Broadcast       │   │
                    │  │                 │  │                          │   │
                    │  │ Chatwoot → Dify │  │ Schedule / Webhook →    │   │
                    │  │ → Twenty CRM   │  │ Twenty CRM → Meta API    │   │
                    │  │ → Chatwoot Rta │  │ → Tracking → Helper      │   │
                    │  └────────┬────────┘  └───────────┬──────────────┘   │
                    └───────────┼───────────────────────┼──────────────────┘
                                │                       │
                     ┌─────────┘                       └──────────┐
                     ▼                                              ▼
     ┌──────────────────────────────┐          ┌──────────────────────────────┐
     │            DIFY              │          │        TWENTY CRM            │
     │     Motor de IA / RAG        │          │     CRM Comercial Moderno    │
     │                              │          │                              │
     │  Workflow: WhatsApp Lead     │          │  Objetos:                    │
     │  Classifier                  │          │  • Leads                     │
     │  1. Detecta idioma           │          │  • Contactos                 │
     │  2. Clasifica intención      │          │  • Cuentas (Empresas)        │
     │  3. Extrae datos contacto    │          │  • Oportunidades             │
     │  4. Calcula scoring 0-100    │          │  • Actividades               │
     │  5. Genera respuesta IA      │          │                              │
     │  6. Decide escalamiento      │          │  Campos personalizados:      │
     │  7. Sugiere próxima acción   │          │  • intentScore (0-100)       │
     │                              │          │  • leadStatus (cold/warm/hot)│
     │  Proveedores IA:             │          │  • priority (low/med/high)   │
     │  • GPT-4o-mini (default)     │          │  • buyingStage               │
     │  • Groq (fallback gratuito)  │          │  • aiSummary (texto)         │
     │  • Gemini (fallback gratuito)│          │  • leadSource (string)       │
     └──────────────────────────────┘          │  • sourceConversationId      │
                                               └──────────────────────────────┘
                                                               │
                                                               │ (Fase 2)
                                                               ▼
                                               ┌──────────────────────────────┐
                                               │       FRAPPE ERP            │
                                               │                              │
                                               │  Módulos:                   │
                                               │  • CRM Básico (no usado)    │
                                               │  • Cotizaciones             │
                                               │  • Facturas                 │
                                               │  • Productos / Inventario   │
                                               │  • Compras                  │
                                               │  • Finanzas                 │
                                               │  • Proyectos                │
                                               │  • RRHH                     │
                                               └──────────────────────────────┘

                    ┌──────────────────────────────────────────────────────┐
                    │               HELPER NODE (Express)                  │
                    │          Lógica de integración personalizada         │
                    │                                                      │
                    │  • API de campañas (CRUD, schedule, tracking)        │
                    │  • Webhooks Meta (status callbacks sent/delivered)   │
                    │  • Gestión de opt-outs                              │
                    │  • Normalización de payloads Chatwoot               │
                    │  • Almacenamiento local (JSON store)                │
                    └──────────────────────────────────────────────────────┘
```

### 2.2 Arquitectura de Contenedores

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE NETWORK                           │
│                                                                         │
│  ┌──────────┐  ┌───────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ postgres │  │ redis │  │ weaviate │  │  nginx   │  │ t2v-transf. │  │
│  │ :5432    │  │ :6379 │  │ :8080    │  │ :80/8080 │  │ :8080       │  │
│  └──────────┘  └───────┘  └──────────┘  └──────────┘  └─────────────┘  │
│       │             │            │            │                          │
│       └──────┬──────┴─────┬──────┘            │                          │
│              │            │                   │                          │
│  ┌───────────▼──┐  ┌─────▼────────┐  ┌───────▼───────────┐             │
│  │  chatwoot    │  │   dify-api   │  │   twenty-server   │             │
│  │  :3000       │  │   :5001      │  │   :3000           │             │
│  │  EXP:3002    │  │   EXP:5001   │  │   EXP:3001        │             │
│  └──────────────┘  └──────────────┘  └───────────────────┘             │
│       │                                                                │
│  ┌────▼───────────┐  ┌──────────────┐  ┌───────────────────┐          │
│  │ chatwoot-worker│  │  dify-worker │  │    dify-web       │          │
│  │  (sidekiq)     │  │  (celery)    │  │    :3000          │          │
│  └────────────────┘  └──────────────┘  │    EXP:3003       │          │
│                                         └───────────────────┘          │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────────┐        │
│  │    n8n       │  │      helper       │  │                  │        │
│  │  :5678       │  │    :3100          │  │                  │        │
│  │  EXP:5679    │  │    EXP:3100       │  │                  │        │
│  └──────────────┘  └───────────────────┘  └──────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Puertos Externos (mapeo host → contenedor)

| Servicio | Puerto Host | Puerto Contenedor | Nota |
|----------|-------------|-------------------|------|
| Chatwoot | 3002 | 3000 | |
| Dify Web | 3003 | 3000 | |
| Dify API | 5001 | 5001 | |
| n8n | 5679 | 5678 | Cambiado de 5678 por conflicto con leadflow |
| Twenty CRM | 3001 | 3000 | |
| Helper Node | 3100 | 3100 | |
| Nginx | 8080 | 80 | Opcional, se puede cambiar a 80 |
| PostgreSQL | — | 5432 | Solo red interna Docker |
| Redis | — | 6379 | Solo red interna Docker |
| Weaviate | — | 8080 | Solo red interna Docker |

> **Nota:** Si leadflow (proyecto existente) no está corriendo, se pueden restaurar los puertos originales (5678, 80) editando `docker-compose.yml`.

---

## 3. Stack Tecnológico

### 3.1 Componentes Core

| Componente | Versión | Licencia | Propósito |
|-----------|---------|----------|-----------|
| Chatwoot | v3.14+ | MIT (Open Source) | Plataforma omnicanal de comunicación |
| Dify | v1.0+ | Apache 2.0 | Motor de IA, workflows, RAG |
| n8n | v1.73+ | Sustainable Use License | Automatización y orquestación low-code |
| Twenty CRM | v0.46+ | AGPLv3 | CRM moderno con GraphQL API |
| Frappe ERP | v15+ | GPLv3 | ERP empresarial (Fase 2) |

### 3.2 Infraestructura Compartida

| Componente | Versión | Propósito |
|-----------|---------|-----------|
| PostgreSQL | 15 | Base de datos compartida (4 databases: chatwoot, dify, n8n, twenty) |
| Redis | 7 | Caché, colas de mensajes, sesiones |
| Weaviate | 1.26 | Base de datos vectorial para Dify RAG |
| Nginx | 1.27 | Proxy reverso unificado |

### 3.3 Servicios Personalizados

| Servicio | Stack | Propósito |
|----------|-------|-----------|
| Helper Node | Node.js + Express | Lógica de integración (campañas, tracking, opt-out, webhooks) |
| Init Script | Node.js + Axios | Configuración automatizada vía API de cada servicio |

### 3.4 Proveedores IA (Dify)

| Proveedor | Modelo | Costo | Propósito |
|-----------|--------|-------|-----------|
| OpenAI (default) | GPT-4o-mini | Bajo ($0.15/1M tokens) | Clasificación, extracción, generación de respuestas |
| Groq (fallback 1) | Llama-3.3-70b | Gratuito (30 RPM) | Fallback si OpenAI falla |
| Gemini (fallback 2) | Gemini 2.0 Flash | Gratuito (15 RPM) | Segundo fallback |
| Ollama (local) | Mistral | Gratis | Offline / desarrollo local |

### 3.5 APIs Externas

| API | Versión | Propósito |
|-----|---------|-----------|
| Meta Graph API | v21.0 | Envío/recepción de mensajes WhatsApp Business |
| Chatwoot API | v1 | Gestión de conversaciones, envío de mensajes |
| Twenty CRM API | GraphQL | CRUD de leads, contactos, oportunidades |
| Frappe API | REST | Facturación, productos, proyectos (Fase 2) |

---

## 4. Flujos de Datos

### 4.1 Flujo de Mensaje Entrante (Inbound)

```
1. Cliente envía mensaje WhatsApp
   │
2. Meta Cloud API → Chatwoot (WhatsApp Inbox)
   │  Webhook: conversation_created + message_created
   ▼
3. Chatwoot dispara webhook a n8n
   │  POST /webhooks/chatwoot-inbound
   │  Payload: { message_type, content, sender, conversation_id, account_id, inbox_id }
   ▼
4. n8n filtra: solo mensajes tipo "incoming", ignora "outgoing" y "activity"
   │
5. n8n construye payload estructurado y llama a Dify
   │  POST /v1/workflows/run
   │  Body: { inputs: { message, contact_name, platform, conversation_history } }
   ▼
6. Dify ejecuta workflow "WhatsApp Lead Classifier":
   │  a. Detecta idioma del mensaje
   │  b. Clasifica intención (9 categorías: product_inquiry, purchase_intent, etc.)
   │  c. Extrae datos del contacto (nombre, email, empresa, cargo, etc.)
   │  d. Calcula intent_score (0-100) y lead_status (cold/warm/hot)
   │  e. Genera respuesta sugerida en lenguaje natural
   │  f. Decide si requiere escalamiento humano
   │  g. Sugiere próxima acción (llamar, agendar demo, enviar catálogo, etc.)
   ▼
7. Dify retorna JSON estructurado a n8n
   │  { response_text, intent_score, intent_label, lead_status, priority,
   │    confidence, captured_data, recommended_action, needs_human,
   │    should_auto_reply, suggested_tags }
   ▼
8. n8n ejecuta 3 acciones en paralelo:
   │
   ├── 8a. Si should_auto_reply → envía respuesta via Chatwoot API
   │    POST /api/v1/accounts/{id}/conversations/{id}/messages
   │    Body: { content: response_text, message_type: "outgoing", private: false }
   │
   ├── 8b. Agrega nota privada de análisis IA en Chatwoot
   │    POST /api/v1/accounts/{id}/conversations/{id}/messages
   │    Body: { content: "🤖 Análisis IA: ...", private: true }
   │
   └── 8c. Crea/actualiza lead en Twenty CRM
        POST /rest/leads
        Body: { name, email, phone, companyName, intentScore, leadStatus, ... }

9. Si needs_human = true → n8n agrega nota de escalamiento en Chatwoot
   │  El agente humano ve el análisis IA y toma control
   ▼
10. El agente responde desde Chatwoot, la conversación continúa
```

### 4.2 Flujo de Campaña (Outbound)

```
1. Trigger: Schedule (cada 30 min) o Webhook manual POST /webhook/campaign-trigger
   │
2. n8n consulta campañas pendientes
   │  GET http://helper:3100/campaigns/pending
   │  Retorna: campañas con status="scheduled" y scheduled_at <= now()
   ▼
3. Por cada campaña pendiente:
   │
   ├── 3a. Obtiene audiencia desde Twenty CRM
   │    POST /rest/leads (con filtro: leadSource contiene "WhatsApp")
   │
   └── 3b. Para cada contacto en la audiencia:
        │
        ├── 3b.i  Verifica opt-out
        │    GET http://helper:3100/opt-outs/check?phone={phone}
        │    Si optedOut = true → salta este contacto
        │
        ├── 3b.ii Personaliza mensaje (opcional: vía Dify)
        │    POST /v1/workflows/run (workflow de personalización)
        │
        ├── 3b.iii Envía WhatsApp via Meta Cloud API
        │    POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
        │    Body: { messaging_product: "whatsapp", to: "{phone}", type: "template", template: {...} }
        │
        └── 3b.iv Registra delivery en helper-node
             POST http://helper:3100/campaigns/track
             Body: { campaign_id, contact_id, status: "sent", message_id }

4. Helper-node recibe status callbacks de Meta (sent → delivered → read)
   │  POST /webhooks/whatsapp (desde Meta Cloud API)
   │  Actualiza status en campañas
   ▼
5. n8n actualiza estadísticas de campaña
   │  POST http://helper:3100/campaigns/{id}/complete
   ▼
6. Fin de campaña
```

### 4.3 Flujo de Lead a Venta (Futuro: Fase 2+)

```
1. Lead en Twenty CRM → estado="converted", se convierte en oportunidad
   │
2. n8n detecta el cambio vía webhook o polling
   │
3. n8n crea cotización en Frappe ERP
   │  POST /api/resource/Quotation
   │
4. Cliente acepta cotización
   │
5. n8n crea factura en Frappe (Sales Invoice)
   │
6. n8n crea proyecto en Frappe (Project)
   │
7. n8n actualiza Twenty CRM con número de factura y proyecto
   ▼
Lead → Oportunidad → Cotización → Factura → Proyecto
                       (todo automático vía n8n)
```

---

## 5. Roadmap a Producción

### 5.1 Vista General

```
Fase 0 ─────── Sem 1:  Fundación ────────────────── ████████░░░░░░░░░░░░░░░░░░
Fase 1 ─────── Sem 2-4: WhatsApp + IA + Twenty ──── ░░░░░░░░████░░░░░░░░░░░░░░
Fase 2 ─────── Sem 5-7: Frappe ERP ──────────────── ░░░░░░░░░░░░██████░░░░░░░░
Fase 3 ─────── Sem 8-10: Lumi Copilot ───────────── ░░░░░░░░░░░░░░░░████░░░░░░
Fase 4 ─────── Sem 11-13: IA Avanzada ───────────── ░░░░░░░░░░░░░░░░░░████░░░░
Fase 5 ─────── Sem 14-16: Producción ────────────── ░░░░░░░░░░░░░░░░░░░░████░░
Fase 6 ─────── Sem 17-19: Analytics ─────────────── ░░░░░░░░░░░░░░░░░░░░░░████
Fase 7 ─────── Sem 20-24: Escalamiento ──────────── ░░░░░░░░░░░░░░░░░░░░░░░░███
                    Mes 1  │  Mes 2  │  Mes 3  │  Mes 4  │  Mes 5  │  Mes 6
```

### 5.2 Dependencias Entre Fases

```
Fase 0 ──── Es prerequisito de: Fase 1 (todas)
Fase 1 ──── Es prerequisito de: Fase 2, 3, 4
Fase 2 ──── Es prerequisito de: Fase 6 (reporting financiero)
Fase 3 ──── Es prerequisito de: Fase 4 (recomendaciones avanzadas)
Fase 4 ──── Puede correr en paralelo con Fase 5
Fase 5 ──── Es prerequisito de: PRODUCCIÓN
Fase 6 ──── Puede correr después de Fase 1+2
Fase 7 ──── Es la última fase (escalamiento post-producción)
```

### 5.3 Hitos Clave (Milestones)

| Hito | Fase | Criterio de Éxito | Semana |
|------|------|-------------------|--------|
| **M0: MVP Operativo** | Fase 1 | WhatsApp → IA clasifica → lead en Twenty | Sem 3 |
| **M1: Campañas Activas** | Fase 1 | Envío masivo WhatsApp con tracking | Sem 4 |
| **M2: ERP Conectado** | Fase 2 | Venta en Twenty → Factura en Frappe | Sem 7 |
| **M3: Copiloto Activo** | Fase 3 | Vendedor ve insights IA en Twenty | Sem 10 |
| **M4: IA Madura** | Fase 4 | RAG, state machine, multi-idioma | Sem 13 |
| **M5: Producción Ready** | Fase 5 | Seguridad, monitoreo, backup, CI/CD | Sem 16 |
| **M6: BI Completo** | Fase 6 | Dashboards, forecasting, reportes | Sem 19 |
| **M7: Multi-Tenant** | Fase 7 | Varias empresas, white-label, billing | Sem 24 |

---

## 6. Fase 0: Fundación

**Duración:** Semana 1 (7 días)
**Objetivo:** Tener toda la infraestructura Docker corriendo y comunicándose.

### 6.1 Checklist Detallado

#### Día 1: Preparación del Entorno
- [ ] Verificar Docker Desktop instalado y funcionando
- [ ] Verificar Node.js 20+ instalado
- [ ] Identificar proyectos existentes (leadflow) y sus puertos
- [ ] Resolver conflictos de puertos

#### Día 2: Configuración de Variables
- [ ] Copiar `.env.example` a `.env`
- [ ] Generar secretos JWT con `crypto.randomBytes`
- [ ] Configurar puertos (evitar conflictos con leadflow)
- [ ] Configurar contraseñas de bases de datos

#### Día 3-4: Levantar Servicios
- [ ] Ejecutar `docker compose up -d`
- [ ] Verificar que PostgreSQL crea las 4 databases (chatwoot, dify, n8n, twenty)
- [ ] Verificar que Redis responde
- [ ] Verificar que Weaviate y transformers están operativos
- [ ] Verificar logs de cada contenedor

#### Día 5: Verificación de Conectividad
- [ ] Verificar health endpoint de cada servicio:
  - Chatwoot: `http://localhost:3002`
  - Dify Web: `http://localhost:3003`
  - Dify API: `http://localhost:5001/health`
  - n8n: `http://localhost:5679/healthz`
  - Twenty: `http://localhost:3001/healthz`
  - Helper: `http://localhost:3100/health`
- [ ] Verificar que los contenedores se comunican entre sí

#### Día 6: Instalación de Dependencias
- [ ] npm install en helper-node
- [ ] npm install en scripts

#### Día 7: Documentación y Backups
- [ ] Documentar estado actual de cada servicio
- [ ] Hacer backup del docker-compose.yml y .env
- [ ] Probar `docker compose down && docker compose up -d`

### 6.2 Verificación de Fase 0

```bash
# Comando de verificación
curl -s http://localhost:3002/health && echo " Chatwoot OK"
curl -s http://localhost:3003 && echo " Dify Web OK"
curl -s http://localhost:5001/health && echo " Dify API OK"
curl -s http://localhost:5679/healthz && echo " n8n OK"
curl -s http://localhost:3001/healthz && echo " Twenty OK"
curl -s http://localhost:3100/health && echo " Helper OK"

# Verificar bases de datos
docker compose exec postgres psql -U wibsite -c "\l"
# Debe mostrar: chatwoot, dify, n8n, twenty
```

### 6.3 Problemas Conocidos

| Problema | Síntoma | Solución |
|----------|---------|----------|
| Puerto ocupado | Container no inicia | Cambiar puerto en .env y docker-compose.yml |
| DB no creada | Servicio no conecta | Verificar init-db.sql montado correctamente |
| Redis no conecta | Error de conexión | Verificar REDIS_URL en cada servicio |
| Weaviate lento | Dify tarda en arrancar | Esperar 2-3 min, weaviate necesita poblar índices |

---

## 7. Fase 1: WhatsApp + IA + Twenty CRM

**Duración:** Semana 2-4 (21 días)
**Objetivo:** Un cliente puede enviar WhatsApp, la IA clasifica el lead en Twenty, y se pueden enviar campañas.

### 7.1 Sub-fase 1.1: Configuración de Meta WhatsApp (Días 1-3)

- [ ] Crear cuenta en Facebook Developers (si no existe)
- [ ] Crear App tipo "Business"
- [ ] Añadir producto "WhatsApp"
- [ ] Configurar webhook: URL = `http://{tu-ip}:3100/webhooks/whatsapp`
- [ ] Configurar Verify Token = `wibsite_verify_2026`
- [ ] Obtener: `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`
- [ ] Generar App Access Token (válido por 60 días o renovable)
- [ ] Verificar número de teléfono en Meta Business Suite
- [ ] Probar envío manual via Graph API Explorer

### 7.2 Sub-fase 1.2: Configuración de Chatwoot (Días 3-5)

- [ ] Abrir `http://localhost:3002`
- [ ] Registrar cuenta (admin + contraseña)
- [ ] Ir a Settings > Profile > Access Token → copiar a `CHATWOOT_API_KEY`
- [ ] Ir a Settings > Inboxes > Add Inbox > WhatsApp Business
- [ ] Configurar con credenciales de Meta (App ID, App Secret, Phone Number ID)
- [ ] Ir a Settings > Integrations > Webhooks
- [ ] Añadir webhook: URL = `http://n8n:5678/webhook/chatwoot-inbound`
- [ ] Suscribir a: `conversation_created`, `message_created`, `conversation_status_changed`
- [ ] Probar: enviar un WhatsApp → debe aparecer en Chatwoot

### 7.3 Sub-fase 1.3: Configuración de Dify (Días 4-6)

- [ ] Abrir `http://localhost:3003`
- [ ] Completar wizard de inicialización
- [ ] Ir a Settings > Model Provider → configurar proveedor (OpenAI o Groq)
- [ ] Ir a Workflows → Import → seleccionar `dify/workflows/whatsapp-lead-classifier.yml`
- [ ] Verificar nodos del workflow: language detection, intent classification, extraction, scoring, response
- [ ] Publicar workflow
- [ ] Ir a API Access → Create API Key → copiar a `DIFY_API_KEY`
- [ ] Probar workflow desde el playground de Dify con mensajes de ejemplo

### 7.4 Sub-fase 1.4: Configuración de Twenty CRM (Días 5-7)

- [ ] Abrir `http://localhost:3001`
- [ ] Crear workspace (email + contraseña)
- [ ] Ir a Settings > API > Create API Key → copiar a `TWENTY_API_KEY`
- [ ] Crear campos personalizados en el objeto Lead:
  - `intentScore`: Number (0-100)
  - `leadStatus`: Select (cold, warm, hot, qualified, converted, lost)
  - `priority`: Select (low, medium, high)
  - `buyingStage`: Select (awareness, consideration, decision, retention)
  - `aiSummary`: Text (multi-line)
  - `leadSource`: Text
  - `sourceConversationId`: Text
- [ ] Crear pipeline de ventas: Nuevo → Calificado → Demo → Propuesta → Cerrado
- [ ] Probar: crear un lead manualmente

### 7.5 Sub-fase 1.5: Configuración de n8n (Días 6-8)

- [ ] Abrir `http://localhost:5679`
- [ ] Registrar cuenta
- [ ] Ir a Workflows → Add → Import from File
- [ ] Importar `n8n/workflows/01-inbound-message.json`
- [ ] Importar `n8n/workflows/02-campaign-broadcast.json`
- [ ] Para cada workflow, crear credenciales:
  - **Chatwoot API**: HTTP Header Auth → Header: `api_access_token`, Value: (CHATWOOT_API_KEY)
  - **Dify API**: HTTP Header Auth → Header: `Authorization`, Value: `Bearer (DIFY_API_KEY)`
  - **Twenty CRM**: HTTP Header Auth → Header: `Authorization`, Value: `Bearer (TWENTY_API_KEY)`
  - **Meta Graph API**: OAuth2 with App Access Token
- [ ] Ir a Settings > Environment → añadir:
  - `DIFY_API_KEY`
  - `CHATWOOT_API_KEY`
  - `TWENTY_API_KEY`
  - `META_API_VERSION` = `v21.0`
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `META_APP_ACCESS_TOKEN`

### 7.6 Sub-fase 1.6: Prueba End-to-End Inbound (Días 8-10)

- [ ] Activar workflow "01 - Inbound Message" en n8n
- [ ] Enviar WhatsApp: "Hola, me interesa saber sobre sus planes de automatización"
- [ ] Verificar:
  - [ ] Mensaje aparece en Chatwoot
  - [ ] n8n recibe webhook y lo procesa
  - [ ] Dify clasifica y genera respuesta
  - [ ] Chatwoot recibe respuesta automática
  - [ ] Nota privada con análisis IA visible en Chatwoot
  - [ ] Lead creado en Twenty CRM con score > 60
- [ ] Enviar WhatsApp de prueba adicional:
  - "Quiero agendar una demo para mi empresa" → debe detectar meeting_request, score alto
  - "Tengo un problema con el servicio" → debe detectar support, escalar
  - "Hola" → debe detectar greeting, score bajo

### 7.7 Sub-fase 1.7: Prueba de Campañas (Días 10-12)

- [ ] Crear campaña via helper API:
  ```bash
  curl -X POST http://localhost:3100/campaigns \
    -H "Content-Type: application/json" \
    -d '{"name": "Oferta Julio", "message": "Hola {{name}}...", "template_name": "campaign_generic"}'
  ```
- [ ] Programar campaña:
  ```bash
  curl -X POST http://localhost:3100/campaigns/{id}/schedule \
    -d '{"scheduled_at": "2026-07-10T10:00:00Z"}'
  ```
- [ ] Activar workflow "02 - Campaign Broadcast" en n8n
- [ ] Verificar que n8n recoge la campaña y la envía
- [ ] Verificar tracking de delivery en helper
- [ ] Verificar estadísticas de campaña

### 7.8 Sub-fase 1.8: Ajustes y Optimización (Días 12-14)

- [ ] Ajustar prompts de Dify según resultados de pruebas
- [ ] Configurar webhook de Meta para status callbacks (sent/delivered/read)
- [ ] Probar edge cases:
  - Mensaje vacío → Dify debe manejarlo
  - Mensaje muy largo → truncar o chunkear
  - Lead duplicado → Twenty debe actualizar, no duplicar
  - Contacto opt-out → no enviar campaña
- [ ] Documentar ajustes realizados

### 7.9 Validación de Fase 1

```
Criterios de éxito:
✅ WhatsApp → Chatwoot: mensaje visible en < 5 seg
✅ Chatwoot → n8n: webhook procesado en < 2 seg
✅ n8n → Dify: clasificación en < 10 seg
✅ Dify → n8n: respuesta estructurada en < 15 seg
✅ n8n → Twenty: lead creado en < 3 seg
✅ n8n → Chatwoot: respuesta enviada en < 3 seg
✅ Campaña: envío a 10+ contactos funciona
✅ Tracking: status sent/delivered/read se registran
❌ Sin errores 500 en ningún componente
```

---

## 8. Fase 2: Integración Frappe ERP

**Duración:** Semana 5-7 (21 días)
**Objetivo:** Cuando un lead se convierte en venta en Twenty, se crea automáticamente la factura y proyecto en Frappe.

### 8.1 Sub-fase 2.1: Setup Frappe (Días 1-4)

- [ ] Agregar Frappe al docker-compose.yml
- [ ] Verificar versión compatible (Frappe v15+ / ERPNext v15+)
- [ ] Configurar base de datos y redis para Frappe
- [ ] Completar instalación inicial de ERPNext
- [ ] Configurar sitio por defecto
- [ ] Crear usuario admin
- [ ] Deshabilitar módulo CRM de Frappe (no se usará)

### 8.2 Sub-fase 2.2: Mapeo de Datos (Días 4-7)

- [ ] Definir mapeo Twenty → Frappe:
  ```
  Twenty Lead → Frappe Lead (crear si no existe)
  Twenty Account → Frappe Customer
  Twenty Opportunity → Frappe Opportunity
  Twenty Deal (ganado) → Frappe Sales Order + Sales Invoice
  ```
- [ ] Definir mapeo Frappe → Twenty:
  ```
  Frappe Item → Twenty Product (crear si no existe)
  Frappe Price List → Precios en Twenty
  ```
- [ ] Configurar webhook en Frappe para eventos de negocio

### 8.3 Sub-fase 2.3: Workflows n8n ERP (Días 7-12)

- [ ] Crear workflow "Lead Convertido → Frappe Cliente + Factura":
  - [ ] n8n webhook desde Twenty (lead.status = "converted")
  - [ ] n8n consulta datos completos del lead en Twenty
  - [ ] n8n crea Customer en Frappe
  - [ ] n8n crea Sales Invoice en Frappe
  - [ ] n8n actualiza Twenty con número de factura
- [ ] Crear workflow "Frappe Producto → Twenty Producto":
  - [ ] n8n webhook desde Frappe (Item created/updated)
  - [ ] n8n sincroniza producto a Twenty
- [ ] Pruebas de integración:
  - [ ] Convertir lead en Twenty → Factura creada en Frappe
  - [ ] Error en Frappe → n8n maneja el fallo gracefulmente
  - [ ] Datos incompletos → validación en n8n

### 8.4 Sub-fase 2.4: Sincronización Bidireccional (Días 12-16)

- [ ] Sincronización inicial: productos de Frappe → Twenty
- [ ] Sincronización periódica: precios actualizados
- [ ] Manejo de conflictos (qué gana si hay discrepancia)
- [ ] Dashboard de sincronización (helper endpoint)

### 8.5 Sub-fase 2.5: Pruebas End-to-End (Días 16-21)

- [ ] Flujo completo: Lead → Oportunidad → Cotización → Factura → Proyecto
- [ ] Probar con datos reales de producto
- [ ] Verificar consistencia de datos entre Twenty y Frappe
- [ ] Probar recuperación ante fallos

### 8.6 Validación de Fase 2

```
✅ Frappe instalado y funcionando
✅ Productos sincronizados Twenty ↔ Frappe
✅ Lead convertido en Twenty → Factura creada en Frappe automáticamente
✅ Error handling: si Frappe falla, Twenty no se corrompe
✅ Sincronización bidireccional funcional
```

---

## 9. Fase 3: Lumi Sales Copilot

**Duración:** Semana 8-10 (21 días)
**Objetivo:** El vendedor ve al lado de cada lead en Twenty un panel con análisis IA, recomendaciones y próxima acción.

### 9.1 Sub-fase 3.1: Arquitectura del Copiloto (Días 1-3)

- [ ] Decidir enfoque:
  - **Opción A:** Extensión de navegador para Twenty (Chrome/Firefox)
  - **Opción B:** Iframe embebido en Twenty como custom page
  - **Opción C:** Widget standalone que se abre desde Twenty
- [ ] Definir datos que Lumi necesita:
  - Historial de conversaciones (desde Chatwoot)
  - Lead score y status (desde Dify)
  - Pipeline stage (desde Twenty)
  - Productos recomendados (desde Frappe)
  - Actividades recientes (desde Twenty)
- [ ] Diseñar UI del copiloto (inspirado en GitHub Copilot)

### 9.2 Sub-fase 3.2: API de Insights (Días 4-10)

- [ ] Crear endpoint en helper-node: `GET /lumi/insights/{leadId}`
- [ ] Consultar historial de conversación en Chatwoot
- [ ] Consultar score y clasificación en Twenty
- [ ] Generar resumen IA via Dify:
  ```json
  {
    "resumen": "Cliente interesado en LeadFlow...",
    "necesidades_detectadas": ["automatización WhatsApp", "CRM"],
    "dolor": "Pierde clientes porque responde tarde",
    "probabilidad_compra": 82,
    "objeciones": ["precio"],
    "proxima_accion": "agendar_demo",
    "mejor_momento_llamar": "10:00 AM - 12:00 PM",
    "productos_recomendados": ["LeadFlow", "Lumi Copilot"]
  }
  ```
- [ ] Cachear resultados (Redis, TTL 5 min)
- [ ] Endpoint para actividades sugeridas: `POST /lumi/actions`

### 9.3 Sub-fase 3.3: Interfaz de Usuario (Días 10-16)

- [ ] Desarrollar componente frontend (React):
  - Panel lateral con información del lead
  - Score visual (barra de progreso animada)
  - Resumen generado por IA
  - Acciones recomendadas (botones)
  - Timeline de interacciones
  - Indicador de lead status (frío/tibio/caliente)
- [ ] Integrar en Twenty como página embebida
- [ ] Diseño responsive y coherente con Twenty UI

### 9.4 Sub-fase 3.4: Pipeline Predictivo (Días 16-19)

- [ ] Workflow Dify que analiza pipeline completo
- [ ] Predicción de cierre por oportunidad:
  - Basado en score, tiempo en etapa, actividad reciente, interacciones
- [ ] Alertas de leads "muriendo":
  - Sin actividad por 15+ días
  - Score que disminuye
  - Objeciones no resueltas
- [ ] Dashboard del copiloto en Twenty:

```
Buenos días, [Vendedor].

Hoy deberías contactar 12 clientes.
Hay 4 negocios que probablemente cierren esta semana.
Hay 3 oportunidades con alto riesgo de perder.
[Vendedor] tiene la mejor tasa de conversión (34%).
```

### 9.5 Sub-fase 3.5: Pruebas y Ajustes (Días 19-21)

- [ ] Probar con leads reales
- [ ] Validar precisión de predicciones
- [ ] Ajustar prompts de Dify para mejores insights
- [ ] Pruebas de usabilidad con vendedores

### 9.6 Validación de Fase 3

```
✅ Lumi visible al lado de cada lead en Twenty
✅ Insights precisos (precisión > 80% en clasificación)
✅ Recomendaciones accionables
✅ Pipeline predictivo funcional
✅ Alertas de leads en riesgo
✅ Tiempo de respuesta del copiloto < 3 seg
```

---

## 10. Fase 4: Pipeline IA Avanzado

**Duración:** Semana 11-13 (21 días)
**Objetivo:** El bot conversacional tiene memoria, puede subir conocimientos, maneja múltiples idiomas y estados de conversación.

### 10.1 Sub-fase 4.1: RAG con Knowledge Base (Días 1-5)

- [ ] Implementar subida de documentos (CSV, PDF, TXT) via Dify
- [ ] Pipeline de chunking + embeddings en Weaviate
- [ ] Configurar RAG en el workflow de Dify
- [ ] Pruebas: "¿Cuánto cuesta el plan Business?" → respuesta basada en documentos

### 10.2 Sub-fase 4.2: State Machine (Días 5-9)

- [ ] Definir estados de conversación:
  - SALUDO → DESCUBRIMIENTO → CUALIFICACION → PROPUESTA → CIERRE
- [ ] Mapa de transiciones válidas
- [ ] Dify workflow con state machine
- [ ] Persistencia de estado en Redis
- [ ] Pruebas: "Quiero comprar" → transición a CUALIFICACION

### 10.3 Sub-fase 4.3: Function Calling (Días 9-13)

- [ ] Definir funciones disponibles para Dify:
  - `AGENDAR_DEMO`: Crea evento en Twenty
  - `ENVIAR_CATALOGO`: Envía PDF via WhatsApp
  - `CREAR_LEAD`: Crea lead cualificado
  - `CONSULTAR_STOCK`: Busca en Frappe
  - `CALCULAR_PRECIO`: Calcula cotización
- [ ] Implementar ejecución de funciones via n8n o helper
- [ ] Pruebas: "Quiero agendar una demo para el jueves" → función ejecutada

### 10.4 Sub-fase 4.4: Multi-idioma (Días 13-16)

- [ ] Dify workflow detecta idioma automáticamente
- [ ] Respuestas en el mismo idioma del cliente
- [ ] Soporte inicial: español, inglés, portugués
- [ ] Pruebas con mensajes en portugués e inglés

### 10.5 Sub-fase 4.5: Sentiment Analysis y Seguimiento (Días 16-19)

- [ ] Dify analiza sentimiento del cliente (positivo, neutral, negativo, frustrado)
- [ ] Si sentimiento negativo → escalar a humano automáticamente
- [ ] Programar seguimientos automáticos:
  - Si lead no responde en 48h → enviar recordatorio
  - Si lead abandonó en etapa de propuesta → enviar descuento
  - Si lead felicitó → enviar encuesta de satisfacción

### 10.6 Sub-fase 4.6: Pruebas de Carga (Días 19-21)

- [ ] 10 conversaciones simultáneas → sin degradación
- [ ] 50 leads en pipeline → predicciones en < 3 seg
- [ ] Campaña a 1000 contactos → completada en < 30 min

---

## 11. Fase 5: Endurecimiento Producción

**Duración:** Semana 14-16 (21 días)
**Objetivo:** El sistema es seguro, monitoreado, respaldado y listo para producción real.

### 11.1 Sub-fase 5.1: Seguridad (Días 1-5)

- [ ] Auditoría de autenticación:
  - [ ] Chatwoot: contraseñas seguras, 2FA opcional
  - [ ] n8n: acceso restringido por IP
  - [ ] Twenty: solo acceso interno
  - [ ] Dify: API key con permisos mínimos
- [ ] HTTPS en todos los endpoints (certbot + Let's Encrypt)
- [ ] Webhook HMAC verification (Meta firma los webhooks)
- [ ] Rate limiting por IP en nginx
- [ ] CORS restringido (no `*`)
- [ ] Sanitización de inputs en helper-node
- [ ] Revisión de secretos en .env (nunca committear)

### 11.2 Sub-fase 5.2: Monitoreo (Días 5-9)

- [ ] Configurar healthchecks en Docker compose
- [ ] Dashboard de monitoreo (n8n monitoring o Grafana):
  - [ ] Uptime de cada servicio
  - [ ] Latencia de webhooks
  - [ ] Errores por servicio
  - [ ] Uso de CPU/memoria
  - [ ] Conexiones a BD
- [ ] Alertas:
  - [ ] Servicio caído → email/Slack
  - [ ] Latencia > 30 seg → alerta
  - [ ] Tasa de error > 5% → alerta
  - [ ] Disco > 80% → alerta

### 11.3 Sub-fase 5.3: Backups (Días 9-11)

- [ ] Backup automático de PostgreSQL (pg_dump diario)
- [ ] Backup de JSON store del helper
- [ ] Backup de configuración n8n
- [ ] Prueba de restauración
- [ ] Retención: 7 días diario, 4 semanas semanal

### 11.4 Sub-fase 5.4: CI/CD (Días 11-14)

- [ ] Git repository para wibsite/
- [ ] GitHub Actions:
  - [ ] Lint de docker-compose.yml
  - [ ] Pruebas de helper-node
  - [ ] Build de imagen helper
  - [ ] Deploy automático a servidor
- [ ] Entornos: development, staging, production

### 11.5 Sub-fase 5.5: Disaster Recovery (Días 14-16)

- [ ] Documentar procedimiento de recuperación:
  - Restaurar desde backup
  - Reconstruir desde docker-compose
  - Recuperar datos de Twenty (API)
- [ ] Probar recuperación en entorno staging
- [ ] SLA objetivo: < 4 horas recuperación

### 11.6 Sub-fase 5.6: Documentación Final (Días 16-21)

- [ ] Manual de operaciones (runbook)
- [ ] Manual de usuario para vendedores
- [ ] Manual de administración
- [ ] Diagrama de red
- [ ] Lista de contactos de emergencia

---

## 12. Fase 6: Analytics e Inteligencia de Negocio

**Duración:** Semana 17-19 (21 días)
**Objetivo:** Dashboards con KPIs comerciales, predicciones y recomendaciones generadas por IA.

### 12.1 Sub-fase 6.1: Data Warehouse (Días 1-5)

- [ ] Tabla de eventos unificados (conversaciones, leads, campañas, ventas)
- [ ] ETL vía n8n desde Twenty + Frappe + Helper
- [ ] Vistas materializadas para reporting

### 12.2 Sub-fase 6.2: Dashboard Comercial (Días 5-10)

- [ ] KPIs en Twenty:
  - Leads nuevos (hoy, esta semana, este mes)
  - Tasa de conversión (lead → venta)
  - Tiempo promedio de cierre
  - Valor promedio de venta
  - Embudo de ventas (pipeline)
  - Actividad del equipo (llamadas, mensajes, reuniones)
- [ ] Gráficos: línea de tendencia, barras comparativas, embudo

### 12.3 Sub-fase 6.3: Dashboard de Campañas (Días 10-13)

- [ ] Tasa de entrega (sent vs delivered)
- [ ] Tasa de lectura (delivered vs read)
- [ ] Tasa de respuesta (read vs replied)
- [ ] ROI por campaña
- [ ] Comparativa entre campañas

### 12.4 Sub-fase 6.4: Forecasting IA (Días 13-17)

- [ ] Workflow Dify de predicción de ventas:
  - Basado en pipeline actual, histórico, estacionalidad
  - Predicción a 7, 30, 90 días
- [ ] Recomendaciones:
  - "Aumenta tus llamadas en 20% para alcanzar la meta"
  - "Los leads de WhatsApp cierran 2x más que los de web"
  - "Tu mejor hora para contactar es 10-11 AM"

### 12.5 Sub-fase 6.5: Reportes Exportables (Días 17-21)

- [ ] Exportar a PDF (reportes mensuales)
- [ ] Exportar a CSV (datos crudos)
- [ ] Email automático con reporte semanal

---

## 13. Fase 7: Multi-Tenant y Escalamiento

**Duración:** Semana 20-24 (30 días)
**Objetivo:** El sistema soporta múltiples empresas inquilinas, cada una con sus datos aislados.

### 13.1 Sub-fase 7.1: Aislamiento Multi-Tenant (Días 1-8)

- [ ] Estrategia de aislamiento: Database per Tenant
- [ ] Script de onboarding: crear DB, correr migraciones, configurar servicios
- [ ] Chatwoot multi-account
- [ ] Dify multi-workspace
- [ ] Twenty multi-workspace
- [ ] n8n multi-tenant (workflows compartidos, datos aislados)

### 13.2 Sub-fase 7.2: White-Label (Días 8-13)

- [ ] Personalización por tenant:
  - Logo
  - Colores
  - Dominio propio
  - Mensajes del bot
  - Plantillas de WhatsApp

### 13.3 Sub-fase 7.3: Billing y Suscripciones (Días 13-20)

- [ ] Integración Stripe
- [ ] Planes:
  - Free: 1 usuario, 100 leads/mes, sin Frappe
  - Pro ($29/mes): 3 usuarios, 1000 leads, Frappe básico
  - Business ($59/mes): 10 usuarios, leads ilimitados, Frappe completo
  - Agency ($89/mes): usuarios ilimitados, white-label, API
- [ ] Webhooks de Stripe para provisioning automático
- [ ] Portal de facturación (cambiar plan, ver facturas)
- [ ] Trial de 14 días

### 13.4 Sub-fase 7.4: Onboarding Automatizado (Días 20-25)

- [ ] Wizard de registro multi-paso:
  - Paso 1: Datos de la empresa (nombre, industria)
  - Paso 2: Conectar WhatsApp
  - Paso 3: Subir base de conocimientos
  - Paso 4: Configurar equipo
- [ ] Email de bienvenida
- [ ] Tour guiado del producto

### 13.5 Sub-fase 7.5: API Pública (Días 25-30)

- [ ] API REST para integraciones externas
- [ ] Documentación OpenAPI/Swagger
- [ ] Rate limiting por API key
- [ ] Webhooks salientes (notificar a sistemas externos)

---

## 14. Referencia de Configuración

### 14.1 Variables de Entorno (.env)

```env
# ─── Shared Database ─────────────────────────────────────
POSTGRES_USER=wibsite
POSTGRES_PASSWORD=wibsite_pass

# ─── Chatwoot ────────────────────────────────────────────
CHATWOOT_PORT=3002
CHATWOOT_FRONTEND_URL=http://localhost:3002
CHATWOOT_SECRET_KEY=<generar con crypto.randomBytes(64).toString('hex')>

# ─── Dify ────────────────────────────────────────────────
DIFY_API_PORT=5001
DIFY_WEB_PORT=3003
DIFY_ADMIN_PASSWORD=admin123
DIFY_SECRET_KEY=<generar con crypto.randomBytes(32).toString('hex')>

# ─── n8n ─────────────────────────────────────────────────
N8N_PORT=5679
N8N_HOST=localhost
N8N_WEBHOOK_URL=http://localhost:5679
N8N_ENCRYPTION_KEY=<generar con crypto.randomBytes(32).toString('hex')>

# ─── Twenty CRM ─────────────────────────────────────────
TWENTY_PORT=3001
TWENTY_SERVER_URL=http://localhost:3001
TWENTY_FRONTEND_URL=http://localhost:3001
TWENTY_ACCESS_TOKEN_SECRET=<generar 32 bytes hex>
TWENTY_LOGIN_TOKEN_SECRET=<generar 32 bytes hex>
TWENTY_REFRESH_TOKEN_SECRET=<generar 32 bytes hex>
TWENTY_FILE_TOKEN_SECRET=<generar 32 bytes hex>

# ─── Meta / WhatsApp ─────────────────────────────────────
META_APP_ID=
META_APP_SECRET=
META_API_VERSION=v21.0
META_WEBHOOK_VERIFY_TOKEN=wibsite_verify_2026
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

### 14.2 Variables de Entorno en n8n

| Variable | Valor | Dónde se obtiene |
|----------|-------|------------------|
| CHATWOOT_API_KEY | `string` | Chatwoot UI > Settings > Profile > Access Token |
| DIFY_API_KEY | `string` | Dify UI > API Access > Create Key |
| TWENTY_API_KEY | `string` | Twenty UI > Settings > API > Create Key |
| META_API_VERSION | `v21.0` | Fijo |
| WHATSAPP_PHONE_NUMBER_ID | `string` | Meta Business Suite > WhatsApp |
| META_APP_ACCESS_TOKEN | `string` | Meta Developers > App > WhatsApp > API Setup |

### 14.3 Puertos del Sistema

| Servicio | Puerto Externo | Puerto Interno | Protocolo |
|----------|---------------|----------------|-----------|
| Chatwoot | 3002 | 3000 | HTTP |
| Dify Web | 3003 | 3000 | HTTP |
| Dify API | 5001 | 5001 | HTTP |
| n8n | 5679 | 5678 | HTTP |
| Twenty CRM | 3001 | 3000 | HTTP |
| Helper Node | 3100 | 3100 | HTTP |
| Nginx | 8080 (o 80) | 80 | HTTP |

### 14.4 Comandos Útiles

```bash
# Iniciar todos los servicios
docker compose up -d

# Ver logs de un servicio específico
docker compose logs -f chatwoot

# Reiniciar un servicio
docker compose restart helper

# Ver estado de los servicios
docker compose ps

# Ejecutar comando en un contenedor
docker compose exec postgres psql -U wibsite -d chatwoot -c "\dt"

# Backup de PostgreSQL
docker compose exec -T postgres pg_dump -U wibsite -d chatwoot > backup_chatwoot.sql

# Generar secretos
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ver puertos en uso
netstat -ano | Select-String ":PORT"

# Detener todo (sin borrar volúmenes)
docker compose down

# Detener todo y borrar volúmenes (⚠️ pierde datos)
docker compose down -v
```

---

## 15. Matriz de Riesgos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|-------------|---------|------------|
| 1 | Meta cambia API de WhatsApp | Baja | Alto | Monitorear changelog de Meta, usar versiones estables |
| 2 | Dify cambia formato de workflows | Media | Alto | Exportar workflows regularmente, mantener backups |
| 3 | Chatwoot requiere migración major | Baja | Medio | Usar versiones LTS, probar en staging antes |
| 4 | Twenty CRM breaking changes en API | Media | Medio | Versionar llamadas API, probar integración continua |
| 5 | n8n cambia licencia | Baja | Alto | Tener plan de migración a temporal alternativo |
| 6 | Puerto conflictivo con leadflow | Alta | Bajo | Documentar puertos, usar variables en .env |
| 7 | Fuga de datos entre tenants | Baja | Crítico | Implementar RLS desde el día 1, auditorías |
| 8 | Webhook no llega por firewall | Media | Alto | Usar healthchecks, alertas de silencio |
| 9 | API Key de Meta expira (60 días) | Alta | Alto | Calendario de renovación, alertas automáticas |
| 10 | Dify sin conexión a Internet (sin LLM) | Baja | Alto | Tener Ollama local como fallback offline |
| 11 | Fraude en campañas (spam) | Media | Alto | Límites por campaña, verificación de opt-in |
| 12 | Proveedor cloud cae | Baja | Crítico | Estrategia multi-región, backups externos |

---

## 16. Métricas de Éxito

### 16.1 Métricas Técnicas

| Métrica | Objetivo | Cómo se mide |
|---------|----------|-------------|
| Uptime del sistema | > 99.5% | Monitoreo (n8n o Grafana) |
| Latencia webhook Chatwoot → n8n | < 2 seg | Logs de n8n |
| Latencia n8n → Dify → respuesta | < 15 seg | Logs de n8n |
| Tasa de error en webhooks | < 1% | n8n execution stats |
| Cobertura de tests | > 70% | Jest coverage report |
| Tiempo de recuperación (RTO) | < 4 horas | DR test |
| Punto de recuperación (RPO) | < 24 horas | Backup frequency |

### 16.2 Métricas de Negocio

| Métrica | Objetivo | Cómo se mide |
|---------|----------|-------------|
| Precisión de clasificación IA | > 85% | Muestreo manual, feedback |
| Tasa de auto-respuesta | > 60% | Logs: respondidos vs escalados |
| Tasa de entrega de campañas | > 95% | Helper tracking |
| Tasa de lectura de campañas | > 60% | Meta status callbacks |
| Leads creados automáticamente | > 100/semana | Twenty CRM |
| Tasa de conversión lead → venta | > 10% | Twenty pipeline |
| Satisfacción del vendedor (Lumi) | > 4/5 | Encuesta interna |

### 16.3 Métricas de Producto

| Feature | Estado Objetivo | Fase |
|---------|----------------|------|
| WhatsApp inbound con IA | ✅ En producción | Fase 1 |
| Campañas WhatsApp | ✅ En producción | Fase 1 |
| CRM con leads IA | ✅ En producción | Fase 1 |
| Integración ERP | ✅ En producción | Fase 2 |
| Copiloto Lumi | ✅ En producción | Fase 3 |
| RAG y knowledge base | ✅ En producción | Fase 4 |
| Multi-idioma | ✅ En producción | Fase 4 |
| Monitoreo producción | ✅ En producción | Fase 5 |
| BI y dashboards | ✅ En producción | Fase 6 |
| Multi-tenant | ✅ En producción | Fase 7 |
| Billing y suscripciones | ✅ En producción | Fase 7 |

---

## Apéndice A: Estructura Completa del Proyecto

```
wibsite/
├── .env                           # Variables de entorno (NO COMMITTEAR)
├── .env.example                   # Template de variables
├── docker-compose.yml             # Orquestación de todos los servicios
├── nginx.conf                     # Proxy reverso
│
├── chatwoot/                      # Config personalizada de Chatwoot (futuro)
│
├── dify/
│   └── workflows/
│       └── whatsapp-lead-classifier.yml   # Workflow Dify de clasificación
│
├── n8n/
│   └── workflows/
│       ├── 01-inbound-message.json        # Chatwoot → Dify → Twenty CRM
│       └── 02-campaign-broadcast.json     # Campañas WhatsApp
│
├── helper-node/                   # Servicio de integración personalizado
│   ├── Dockerfile
│   ├── index.js
│   └── package.json
│
├── scripts/
│   ├── init-db.sql                # Creación de databases en PostgreSQL
│   ├── init-wibsite.js            # Configuración automatizada via API
│   └── package.json
│
└── specs/
    ├── ARCHITECTURE.md            # (este documento, resumen)
    ├── COMPLETE_ARCHITECTURE.md   # (este documento, completo)
    └── SETUP_GUIDE.md             # Guía paso a paso de configuración
```

## Apéndice B: Referencia de API

### Helper Node API

| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | /campaigns | Crear campaña |
| GET | /campaigns | Listar campañas |
| GET | /campaigns/pending | Obtener campañas pendientes de envío |
| POST | /campaigns/{id}/schedule | Programar campaña |
| POST | /campaigns/{id}/complete | Marcar campaña como completada |
| POST | /campaigns/track | Registrar delivery de mensaje |
| GET | /campaigns/{id}/stats | Estadísticas de campaña |
| GET | /webhooks/whatsapp | Verificación webhook Meta |
| POST | /webhooks/whatsapp | Status callbacks de Meta |
| POST | /opt-outs | Registrar opt-out |
| GET | /opt-outs/check | Verificar si un número opt-out |
| POST | /chatwoot/normalize | Normalizar payload de Chatwoot |
| GET | /health | Healthcheck |

### n8n Webhooks

| Ruta | Propósito |
|------|-----------|
| POST /webhook/chatwoot-inbound | Webhook de Chatwoot para mensajes entrantes |
| POST /webhook/campaign-trigger | Trigger manual para campañas |

### Meta Webhook

| Ruta | Propósito |
|------|-----------|
| GET /webhooks/whatsapp | Verificación (hub.challenge) |
| POST /webhooks/whatsapp | Mensajes entrantes y status callbacks |

---

> **Documento mantenido por:** Wibsite Development Team
> **Última actualización:** Julio 2026
> **Próxima revisión:** Al completar cada fase
