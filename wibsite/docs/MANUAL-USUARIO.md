# Wibsite Business — Manual de Usuario
# Plataforma Omnicanal de Automatización de Ventas con IA
# Versión: MVP 1.0 — Julio 2026

---

## Índice

1. [Acceso a la Plataforma](#1-acceso-a-la-plataforma)
2. [Hub Central](#2-hub-central)
3. [Dashboard de Monitoreo](#3-dashboard-de-monitoreo)
4. [Chatwoot — Bandeja Omnicanal](#4-chatwoot--bandeja-omnicanal)
5. [Dify — Motor de IA](#5-dify--motor-de-ia)
6. [n8n — Orquestador de Flujos](#6-n8n--orquestador-de-flujos)
7. [Twenty CRM](#7-twenty-crm)
8. [Flujos Integrados](#8-flujos-integrados)

---

## 1. Acceso a la Plataforma

### URL de acceso
```
https://localhost:8080/
```

### Login Único (SSO)

Todo el acceso a la plataforma está protegido por un sistema de **Single Sign-On (SSO)**. Solo necesitás autenticarte una vez para acceder a todos los módulos.

| Campo | Valor |
|-------|-------|
| Email | `admin@wibsite.com` |
| Contraseña | `Admin@123` |

**Flujo**: Al hacer clic en cualquier módulo desde el Hub, serás redirigido al portal de login. Una vez autenticado, la sesión permanece activa por **8 horas**. No necesitás volver a loguearte en cada módulo.

### Módulos disponibles

| Módulo | URL | Descripción |
|--------|-----|-------------|
| Hub Central | `/hub/` | Página de inicio y navegación |
| Dashboard | `/admin/` | Monitoreo de campañas, leads y canales |
| Chatwoot | `/chatwoot/` | Bandeja omnicanal (WhatsApp, Messenger, etc.) |
| Dify | `/dify/` | Motor de IA: workflows de clasificación y contenido |
| n8n | `/n8n/` | Orquestador visual de automatizaciones |
| Twenty CRM | `/crm/` | CRM con gestión de leads y personas |

---

## 2. Hub Central

**URL**: `https://localhost:8080/`

Es la página de inicio de Wibsite. Muestra una cuadrícula de tarjetas con acceso rápido a cada módulo.

### Elementos visuales

| Elemento | Descripción |
|----------|-------------|
| **Cabecera** | Logo y nombre de la plataforma con subtítulo descriptivo |
| **Barra de estado** | Chips con el estado de cada servicio (online/offline) |
| **Tarjetas de módulos** | 6 tarjetas con ícono, nombre y descripción de cada módulo |
| **Credenciales** | Cada tarjeta muestra usuario/contraseña del módulo para referencia |
| **Indicador LED** | Punto verde/amarillo/rojo según estado del servicio |

### Tarjetas disponibles

| Tarjeta | Al hacer clic |
|---------|---------------|
| **Dify AI Studio** | Abre el motor de IA para crear/editar workflows |
| **n8n Automations** | Abre el orquestador de flujos de trabajo |
| **Chatwoot Inbox** | Abre la bandeja omnicanal de mensajes |
| **Twenty CRM** | Abre el sistema CRM de gestión de leads |
| **Wibsite Dashboard** | Abre el panel de monitoreo de campañas |
| **Documentación** | Abre el índice de documentación técnica |

---

## 3. Dashboard de Monitoreo

**URL**: `http://localhost:8080/admin/`

Panel de control para monitoreo de campañas, leads y canales de comunicación.

### Pestañas disponibles

#### 3.1 Dashboard (Overview)

Vista principal con indicadores clave de rendimiento (KPIs):

| KPI | Descripción |
|-----|-------------|
| **Campañas Activas** | Número de campañas en estado "sending" o "scheduled" |
| **Mensajes Hoy** | Total de mensajes enviados/recibidos en el día |
| **Leads Scored** | Leads que ya tienen puntaje de IA asignado |
| **Top Lead** | Nombre y puntaje del lead mejor calificado |

**Estado de Canales**: LEDs indicadores por canal (WhatsApp, Messenger, TikTok, SMS, Email) que muestran:
- 🟢 **Verde (connected)**: Canal operativo
- 🟡 **Amarillo (pending/limited)**: En configuración o con rate limiting
- 🔴 **Rojo (disconnected/error)**: Canal caído

**Entregas vs Envíos**: Barra de progreso que muestra la proporción de mensajes entregados, leídos, respondidos y fallidos.

#### 3.2 Campañas

Tabla completa de todas las campañas con columnas:

| Columna | Descripción |
|---------|-------------|
| Nombre | Nombre de la campaña |
| Canal | WhatsApp, Messenger, TikTok, SMS, Email |
| Estado | draft, scheduled, sending, paused, completed, failed |
| Env | Total de envíos realizados |
| Ent | Mensajes entregados exitosamente |
| Leíd | Mensajes leídos por el destinatario |
| Resp | Respuestas recibidas |
| Fall | Envíos fallidos |
| Prog | Fecha programada de envío |
| Creada | Fecha de creación |
| Acción | Botones de acción (ver, editar, etc.) |

**Botón "+ Importar Leads (Excel/CSV)"**: Abre un modal para cargar leads masivamente:
1. Seleccionar la campaña destino del dropdown
2. Arrastrar un archivo Excel (.xlsx, .xls) o CSV
3. El sistema detecta automáticamente columnas: phone, name, email
4. Columnas no reconocidas van a `custom_fields`
5. Muestra reporte: leads creados / errores / duplicados

#### 3.3 Leads

Tabla de todos los leads registrados en el sistema con:
- Nombre, teléfono, email
- **Score**: puntaje de 0-100 con barra de color (rojo < 40, amarillo 40-74, verde >= 75)
- Estado, origen, fecha de creación

#### 3.4 Plantillas

Gestión de plantillas de mensaje predefinidas por canal y categoría:
- **Categorías**: welcome, promotion, followup, notification, newsletter
- **Canales**: WhatsApp, Messenger, TikTok, SMS, Email
- **Acciones**: crear, editar, eliminar, previsualizar (reemplaza `{{name}}` y `{{phone}}`)

#### 3.5 Canales

Vista detallada del estado de cada canal con:
- Nombre del canal
- Estado actual (connected, disconnected, error, limited)
- Mensaje de estado descriptivo
- Timestamp de última verificación

### Botones de acción globales

| Botón | Función |
|-------|---------|
| ☁ **Sync CRM** | Sincroniza todos los leads con Twenty CRM |
| 📊 **Score All** | Evalúa el scoring de TODOS los leads usando reglas de IA |
| 🌱 **Seed** | Genera datos de prueba (campañas, leads, entregas) |
| 🗑 **Clear** | Elimina todos los datos |
| 🤖 **Test LLM** | Prueba la conexión con OpenRouter (modelo GPT-4o-mini) |
| ⟳ **Refresh** | Recarga manual de todos los datos |

---

## 4. Chatwoot — Bandeja Omnicanal

**URL**: `http://localhost:8080/chatwoot/`

Sistema de bandeja de entrada unificada para todos los canales de mensajería.

### Lo que podés hacer

| Funcionalidad | Cómo se usa |
|---------------|-------------|
| **Ver conversaciones** | Panel izquierdo lista todas las conversaciones activas |
| **Responder mensajes** | Escribir en el campo de texto y enviar. El mensaje se entrega al canal del cliente (WhatsApp, Messenger, etc.) |
| **Ver perfil del contacto** | Panel derecho muestra nombre, teléfono, email, etiquetas |
| **Agregar notas privadas** | Notas internas visibles solo para el equipo, no para el cliente |
| **Asignar conversaciones** | Asignar a un agente específico del equipo |
| **Etiquetar conversaciones** | Agregar tags para categorizar (ej: "lead_caliente", "soporte") |
| **Ver historial** | Scroll hacia arriba para ver mensajes anteriores |

### Integración con IA

Cuando un cliente envía un mensaje por WhatsApp:
1. El mensaje llega a Chatwoot
2. n8n lo captura vía webhook
3. Dify analiza el mensaje con IA
4. Si `needs_human = false`, se envía respuesta automática
5. Si `needs_human = true`, se escala al agente con una nota privada de análisis
6. Siempre se agrega una nota privada con el análisis de IA (score, intención, datos extraídos)

### Auto-scoring

Cuando un agente responde a un cliente, el sistema automáticamente:
- Aumenta el score del lead en **+15 puntos**
- Actualiza la categoría (cold → warm, warm → hot)
- Esto refleja que el lead recibió atención humana y es más valioso

---

## 5. Dify — Motor de IA

**URL**: `http://localhost:8080/dify/`

Plataforma de workflows de IA para crear, probar y publicar flujos de inteligencia artificial.

### Lo que podés hacer

| Funcionalidad | Cómo se usa |
|---------------|-------------|
| **Crear workflow** | Studio → Create → seleccionar tipo "Workflow" |
| **Agregar nodos LLM** | Arrastrar nodo "LLM" al canvas, conectar con otros nodos |
| **Configurar prompts** | Escribir system prompt e instrucciones para el modelo |
| **Probar workflow** | Botón "Run" → ingresar inputs de prueba → ver outputs |
| **Publicar workflow** | Botón "Publish" → genera un endpoint API |
| **Ver API key** | Pestaña "API Access" del workflow publicado |
| **Monitorear ejecuciones** | Pestaña "Logs" → historial de llamadas con inputs/outputs |

### Workflows incluidos

#### 5.1 WhatsApp Lead Classifier (`whatsapp-lead-classifier.yml`)

**Propósito**: Analizar mensajes entrantes de WhatsApp y clasificar leads.

| Input | Descripción |
|-------|-------------|
| `message` | Texto del mensaje del cliente |
| `contact_name` | Nombre del contacto |
| `platform` | Plataforma (whatsapp) |
| `conversation_history` | Historial de la conversación |

| Output | Descripción |
|--------|-------------|
| `intent_score` | Puntaje 0-100 |
| `intent_label` | Categoría: product_inquiry, purchase_intent, support, etc. |
| `lead_status` | cold, warm, hot |
| `suggested_response` | Respuesta sugerida para enviar al cliente |
| `needs_human` | true/false — ¿requiere agente humano? |
| `captured_data` | Datos extraídos: nombre, email, empresa, interés, etc. |
| `suggested_tags` | Etiquetas sugeridas para el CRM |

**Nodos del workflow**:
1. **detect_language** — Detecta el idioma del mensaje
2. **classify_intent** — Clasifica la intención en 9 categorías
3. **extract_contact_data** — Extrae datos del contacto
4. **calculate_score** — Calcula puntaje con reglas ponderadas
5. **generate_response** — Genera respuesta sugerida
6. **assemble_result** — Ensambla el JSON final

#### 5.2 Campaign Content Generator (`campaign-content-generator.yml`)

**Propósito**: Generar contenido personalizado de campañas para cada destinatario.

| Input | Descripción |
|-------|-------------|
| `campaign_name` | Nombre de la campaña |
| `campaign_message` | Mensaje base de la campaña |
| `contact_name` | Nombre del destinatario |
| `company_name` | Empresa del destinatario |

| Output | Descripción |
|--------|-------------|
| `personalized_message` | Mensaje personalizado listo para enviar |
| `template_name` | Nombre del template de WhatsApp sugerido |
| `greeting` | Saludo generado |
| `call_to_action` | Llamada a la acción |

**Nodos del workflow**:
1. **personalize_message** — LLM que personaliza el mensaje
2. **select_template** — Selecciona el template adecuado según tipo de campaña
3. **assemble_output** — Ensambla el resultado final

---

## 6. n8n — Orquestador de Flujos

**URL**: `http://localhost:8080/n8n/`

Plataforma de automatización visual que conecta todos los servicios.

### Lo que podés hacer

| Funcionalidad | Cómo se usa |
|---------------|-------------|
| **Ver workflows** | Menú lateral → Workflows |
| **Activar/desactivar** | Toggle en la esquina superior derecha de cada workflow |
| **Ver ejecuciones** | Menú lateral → Executions → historial de cada corrida |
| **Editar workflow** | Clic en el workflow → arrastrar nodos, conectar, configurar |
| **Probar manualmente** | Botón "Test Workflow" (triángulo play) |
| **Ver logs** | Clic en una ejecución → ver inputs/outputs de cada nodo |

### Workflows incluidos

#### 6.1 01 - Inbound WhatsApp → Dify → Twenty CRM

**Propósito**: Procesar mensajes entrantes de WhatsApp con IA y sincronizar al CRM.

**Flujo**:
```
Chatwoot Webhook → Filtrar mensajes entrantes → Construir payload Dify
  → Llamar Dify API → Parsear respuesta → ¿Necesita humano?
    ├─ NO → Enviar respuesta automática → Agregar nota de IA → Sync CRM
    └─ SÍ → Escalar a agente humano → Sync CRM
```

**Nodos clave**:
| Nodo | Función |
|------|---------|
| Chatwoot Webhook | Recibe mensajes de Chatwoot en `/webhook/chatwoot-inbound` |
| Filter Message Type | Solo procesa mensajes entrantes (ignora outgoing) |
| Call Dify API | Envía el mensaje a Dify para análisis |
| Send Reply via Chatwoot | Publica respuesta automática en la conversación |
| Add AI Analysis Note | Agrega nota privada con score, intención, datos |
| Escalate to Human Agent | Notifica al agente cuando se requiere intervención |
| Upsert Lead in Twenty CRM | Crea o actualiza el lead en Twenty |

#### 6.2 02 - Campaign Broadcast WhatsApp

**Propósito**: Ejecutar campañas de difusión masiva por WhatsApp.

**Flujo**:
```
Schedule Trigger (cada 1 min) / Manual Webhook
  → Obtener campañas pendientes → Loop por campaña
    → Obtener audiencia de Twenty CRM → Loop por contacto
      → Verificar opt-out
        ├─ NO → Generar contenido con Dify → Enviar vía Meta API → Tracking
        └─ SÍ → Saltar
  → Completar campaña
```

**Nodos clave**:
| Nodo | Función |
|------|---------|
| Schedule Trigger | Dispara automáticamente cada 1 minuto |
| Manual Webhook Trigger | Disparo manual vía POST a `/webhook/campaign-trigger` |
| Get Pending Campaigns | Consulta helper por campañas scheduled |
| Get Audience from Twenty CRM | Obtiene leads del CRM para la campaña |
| Generate Campaign Content | Llama a Dify para personalizar mensaje |
| Send via Meta API | Envía mensaje WhatsApp template a través de Meta |
| Track Delivery | Registra el estado del envío en el helper |
| Update Campaign Status | Marca la campaña como completada |

---

## 7. Twenty CRM

**URL**: `http://localhost:8080/crm/`

Sistema CRM para gestión de leads, personas y oportunidades.

### Lo que podés hacer

| Funcionalidad | Cómo se usa |
|---------------|-------------|
| **Ver personas** | Menú lateral → People → lista de todos los contactos |
| **Crear persona** | Botón "+" → completar formulario |
| **Editar persona** | Clic en una persona → campos editables |
| **Ver detalle** | Panel derecho con todos los campos: nombre, email, teléfono, empresa, cargo |
| **Filtrar/buscar** | Barra de búsqueda superior |
| **Campos personalizados Wibsite** | Campos específicos creados por la integración |

### Campos personalizados de Wibsite en Twenty

| Campo | Descripción |
|-------|-------------|
| `intentScore` | Puntaje de intención del lead (0-100) |
| `leadStatus` | Estado: COLD, WARM, HOT |
| `priority` | Prioridad: LOW, MEDIUM, HIGH |
| `buyingStage` | Etapa de compra: awareness, consideration, decision, retention |
| `leadSource` | Origen del lead (WhatsApp, Messenger, etc.) |
| `aiSummary` | Resumen generado por IA con intención y score |
| `tags` | Etiquetas sugeridas por la IA |
| `message` | Producto/servicio de interés |
| `city` | Ciudad/ubicación |
| `sourceConversationId` | ID de la conversación original en Chatwoot |

### Sincronización con Helper

El botón **"☁ Sync CRM"** en el Dashboard:
1. Lee todos los leads del helper
2. Busca si ya existen en Twenty (por teléfono)
3. Si existe → actualiza los datos
4. Si no existe → crea una nueva persona
5. Guarda el `contact_id` de Twenty en el lead del helper

---

## 8. Flujos Integrados

### 8.1 Flujo de Mensaje Entrante (WhatsApp)

```
Cliente envía "Hola, quiero información"
         │
         ▼
    [Meta WhatsApp]
         │
         ▼
    [Chatwoot] ──────► [Agente ve el mensaje en bandeja]
         │
         │ webhook
         ▼
    [n8n: 01-inbound]
         │
         │ POST /v1/workflows/run
         ▼
    [Dify: Lead Classifier]
         │
         │ Analiza: intención, score, datos, respuesta
         ▼
    [n8n: Parsear respuesta]
         │
    ┌────┴────┐
    ▼         ▼
  Auto       Escalar
  Reply      a Humano
    │         │
    ▼         ▼
  Nota IA   Nota IA
    │         │
    └────┬────┘
         ▼
    [Twenty CRM]
    Lead creado/actualizado
    con score, tags, datos
```

### 8.2 Flujo de Campaña Saliente (Broadcast)

```
Usuario crea campaña en Dashboard
         │
         ▼
    [Helper: campaña status=scheduled]
         │
         ▼
    [n8n: Schedule Trigger cada 1 min]
         │
         │ GET /campaigns/pending
         ▼
    [Helper: devuelve campañas pendientes]
         │
         │ GET /rest/people?filter=...
         ▼
    [Twenty CRM: devuelve audiencia]
         │
         │ Loop por contacto
         ▼
    [n8n: Generate Campaign Content]
         │
         │ POST /v1/workflows/run
         ▼
    [Dify: Campaign Content Generator]
         │
         │ Mensaje personalizado
         ▼
    [n8n: Send via Meta API]
         │
         │ POST graph.facebook.com/.../messages
         ▼
    [Meta WhatsApp: entrega mensaje al cliente]
         │
         │ Tracking
         ▼
    [Helper: registra delivery]
         │
         ▼
    [Campaña completada]
```

### 8.3 Flujo de Scoring en Tiempo Real

```
Agente responde en Chatwoot
         │
         │ webhook
         ▼
    [Helper: /api/scoring/trigger-from-chatwoot]
         │
         │ message_type === 'outgoing'
         ▼
    [Boost +15 al score del lead]
         │
         │ Recalcula categoría
         ▼
    [Dashboard: score actualizado]
```

---

## Credenciales de referencia

| Servicio | Usuario | Contraseña | URL |
|----------|---------|------------|-----|
| SSO (Authelia) | `admin@wibsite.com` | `Admin@123` | `/authelia/` |
| Dify | `joserobertoquirogasalvador@gmail.com` | `Admin@123` | `/dify/` |
| n8n | `admin@wibsite.com` | `Wibsite2024!` | `/n8n/` |
| Chatwoot | `admin@wibsite.com` | `Admin@123` | `/chatwoot/` |
| Twenty CRM | `admin@wibsite.com` | `Admin@123` | `/crm/` |
| Dashboard | (SSO) | (SSO) | `/admin/` |

---

## Puertos y red

| Servicio | Puerto Host | Puerto Interno | Acceso |
|----------|-------------|----------------|--------|
| Nginx (proxy) | 8080 | 80 | Navegador |
| Helper Node | 3100 | 3100 | API interna |
| Chatwoot | 3002 | 3000 | Proxy + directo |
| Dify Web | 3003 | 3000 | Proxy |
| Dify API | 5001 | 5001 | Proxy + interno |
| n8n | 5679 | 5678 | Proxy + directo |
| Twenty CRM | 3001 | 3000 | Proxy |
| Authelia | - | 9091 | Solo interno |
| PostgreSQL | - | 5432 | Solo interno |
| Redis | - | 6379 | Solo interno |
