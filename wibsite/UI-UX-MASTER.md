# Wibsite Business — UI/UX Master: Portal Unificado de Módulos

> **Versión:** 1.0 — Julio 2026
> **Propósito:** Análisis, diseño y plan de unificación visual de todos los módulos de Wibsite en una sola experiencia de navegación, sin reemplazar las interfaces existentes.
> **Estado:** Auditoría UX inicial — Hub documental funcional, integración real pendiente
> **Principio rector:** No crear nuevas vistas desde cero. Usar las UIs existentes de cada módulo como vistas activas embebidas.

---

## Índice

1. [Auditoría de Experiencia de Usuario Actual](#1-auditoría-de-experiencia-de-usuario-actual)
2. [Arquitectura del Portal Unificado](#2-arquitectura-del-portal-unificado)
3. [Catálogo de Vistas por Módulo](#3-catálogo-de-vistas-por-módulo)
4. [Estructura de Navegación Unificada](#4-estructura-de-navegación-unificada)
5. [Estrategia de Embebido de Módulos](#5-estrategia-de-embebido-de-módulos)
6. [Comunicación Cruzada entre Módulos](#6-comunicación-cruzada-entre-módulos)
7. [SSO y Sesión Unificada](#7-sso-y-sesión-unificada)
8. [Branding y Personalización Visual](#8-branding-y-personalización-visual)
9. [Vistas Específicas y Componentes Reutilizables](#9-vistas-específicas-y-componentes-reutilizables)
10. [Roadmap de Implementación UX](#10-roadmap-de-implementación-ux)
11. [Matriz de Impacto y Riesgos UX](#11-matriz-de-impacto-y-riesgos-ux)
12. [Integración con Roadmap Multi-Agente y Seguridad](#12-integración-con-roadmap-multi-agente-y-seguridad)

---

## 1. Auditoría de Experiencia de Usuario Actual

### 1.1 Mapa de la Experiencia Actual

```
Usuario abre navegador
    │
    ▼
http://localhost:8080/hub/
    │
    ├── Ve tarjetas de módulos con estado LED
    │
    ├── Click en "Chatwoot" → nueva pestaña :3002 → login separado
    ├── Click en "Dify" → nueva pestaña :3003 → login separado
    ├── Click en "n8n" → nueva pestaña :5679 → login separado
    ├── Click en "Twenty CRM" → nueva pestaña :3001 → login separado
    ├── Click en "Dashboard" → nueva pestaña :3100 → sin login
    │
    └── Para cambiar de módulo: volver al hub, hacer click en otro
```

### 1.2 Problemas Identificados

| # | Problema | Severidad | Afecta a |
|---|----------|-----------|----------|
| UX-01 | **Múltiples URLs/pestañas**: Cada módulo abre en pestaña separada. El usuario pierde contexto al cambiar. | 🔴 Crítico | Todos los usuarios |
| UX-02 | **Múltiples logins**: Cada módulo requiere su propia autenticación (diferentes credenciales, diferentes UIs de login). | 🔴 Crítico | Todos los usuarios |
| UX-03 | **Sin navegación unificada**: No hay sidebar/header global. Para ir de Chatwoot a Twenty, hay que volver al hub. | 🔴 Crítico | Todos los usuarios |
| UX-04 | **Estilos inconsistentes**: Cada módulo tiene su propio tema, colores, tipografía. No hay sensación de producto único. | 🟠 Alto | Percepción de marca |
| UX-05 | **Sin contexto cruzado**: Un lead en Twenty no está vinculado a su conversación en Chatwoot ni a su clasificación en Dify. | 🟠 Alto | Agentes de ventas |
| UX-06 | **Hub es documentación, no portal de trabajo**: El hub actual es un diccionario visual/estado del proyecto, no un centro de operaciones diario. | 🟠 Alto | Uso diario |
| UX-07 | **Dify redirección rota**: `/dify/` vía Nginx retorna 404. Hay que usar `:3003` directo. | 🟡 Medio | Usuarios de IA |
| UX-08 | **Sin notificaciones unificadas**: No hay un centro de notificaciones que consolide eventos de todos los módulos. | 🟡 Medio | Agentes de ventas |
| UX-09 | **Sin búsqueda global**: No se puede buscar un lead, conversación o campaña desde un solo lugar. | 🟡 Medio | Potenciales |
| UX-10 | **Responsive limitado**: El helper dashboard es responsive, pero los módulos embebidos tienen sus propios breakpoints. | 🟢 Bajo | Móvil |

### 1.3 Principios de Diseño para la Unificación

1. **No reemplazar, embeker**: Cada módulo mantiene su UI nativa. El portal es un contenedor que las organiza.
2. **Una URL, un login**: El usuario ingresa una vez y navega todo el sistema sin volver a autenticarse.
3. **Navegación consistente**: Sidebar global siempre visible con acceso a todas las vistas relevantes.
4. **Contexto persistente**: Al cambiar de módulo, el contexto actual (lead, conversación, campaña) se mantiene.
5. **Marca unificada**: Wibsite como identidad visual sobre los módulos existentes (watermark, colores, logo).
6. **Progresivo**: Se implementa por fases. Primero el shell, luego la comunicación cruzada, luego componentes compartidos.

---

## 2. Arquitectura del Portal Unificado

### 2.1 Patrón: Portal Shell con Micro-Frontends Embebidos

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHELL PRINCIPAL (Wibsite Portal)              │
│ ┌──────────┬──────────────────────────────────────────────────┐ │
│ │          │  ┌─────────────────────────────────────────────┐  │ │
│ │ SIDEBAR  │  │              TOP BAR                        │  │ │
│ │ (Siempre │  │  Logo | Breadcrumb | Búsqueda Global | User │  │ │
│ │  visible)│  ├─────────────────────────────────────────────┤  │ │
│ │          │  │                                               │  │ │
│ │ • Inbox  │  │        CONTENIDO PRINCIPAL (Iframe)           │  │ │
│ │ • CRM    │  │                                               │  │ │
│ │ • IA     │  │  ┌─────────────────────────────────────────┐  │ │ │
│ │ • Calls  │  │  │  Módulo activo embebido vía iframe      │  │ │ │
│ │ • Camp.  │  │  │  (Chatwoot / Dify / n8n / Twenty /      │  │ │ │
│ │ • Anal.  │  │  │   Helper Dashboard)                     │  │ │ │
│ │ • Config │  │  └─────────────────────────────────────────┘  │ │ │
│ │          │  │                                               │  │ │
│ │          │  └─────────────────────────────────────────────┘  │ │
│ └──────────┴──────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  STATUS BAR: Estado servicios | Notificaciones | Versión    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Tecnología del Shell

| Aspecto | Decisión | Justificación |
|---------|----------|---------------|
| **Framework** | HTML/CSS/JS vanilla (sin framework) | Consistente con hub existente. Mínimo overhead. No agrega otro servicio. |
| **Embebido** | iframes con `postMessage` | Aísla CSS/JS de cada módulo. No requiere modificar los módulos. `postMessage` permite comunicación controlada. |
| **Estado** | sessionStorage + BroadcastChannel | Persiste navegación, contexto de lead activo, pestaña seleccionada. BroadcastChannel sincroniza entre pestañas. |
| **Comunicación** | `window.postMessage()` | API estándar y segura. Cada módulo puede recibir/enviar eventos. |
| **Estilo shell** | CSS custom properties + Wibsite design tokens | Tema oscuro consistente con hub. Variables CSS para branding. |
| **SSO** | Authelia auth_request + cookies compartidas | Sesión única para todos los módulos. |

### 2.3 Árbol de Navegación

```
Wibsite Portal
├── 📬 Inbox (Chatwoot embed)
│   ├── Conversaciones Activas
│   ├── Conversaciones Asignadas
│   └── Historial
├── 📇 CRM (Twenty embed)
│   ├── Leads
│   ├── Contactos
│   ├── Cuentas
│   └── Oportunidades
├── 🧠 IA Studio (Dify embed)
│   ├── Workflow Clasificador
│   ├── Knowledge Base
│   └── Logs de Ejecución
├── 📊 Automations (n8n embed)
│   ├── Workflow Inbound
│   ├── Workflow Campaign
│   └── Workflow Nurturing
├── 📈 Campaigns (Helper Dashboard)
│   ├── Dashboard (KPI)
│   ├── Campañas (CRUD)
│   ├── Leads (Tabla + Scoring)
│   ├── Plantillas (Mensajes)
│   └── Canales (LEDs + Config)
├── 📞 Calls (Twilio Voice)
│   ├── Llamadas Activas
│   ├── Historial de Llamadas
│   └── Configuración de Voz
├── 📊 Analytics
│   ├── Dashboard General
│   ├── Reporte de Ventas
│   └── Forecast IA
└── ⚙️ Configuración
    ├── Agente (Contexto + Personalidad)
    ├── Canales (WhatsApp, Voz, etc.)
    ├── Seguridad (Reglas, API Keys)
    ├── Equipo (Usuarios, Roles)
    └── Facturación (Plan, Límites)
```

---

## 3. Catálogo de Vistas por Módulo

### 3.1 Chatwoot — Vista Inbox (URL base: `http://chatwoot:3000`)

| Vista | URL en módulo | ¿Embebible? | Notas |
|-------|--------------|-------------|-------|
| **Dashboard Inbox** | `/app/` | ✅ Sí | Lista de conversaciones activas. La vista principal. |
| **Conversación individual** | `/app/accounts/{id}/conversations/{id}` | ✅ Sí | Requiere pasar `conversation_id` desde el shell. |
| **Contactos** | `/app/accounts/{id}/contacts` | ✅ Sí | Lista de contactos con historial. |
| **Configuración** | `/app/settings` | ⚠️ Parcial | Algunas rutas pueden romperse en iframe por CSP. |
| **Login** | `/auth/sign_in` | ❌ No | El shell maneja auth vía Authelia. |

**Vista principal para embeker:** `app/accounts/{accountId}/dashboard` (inbox general)
**Vista contextual:** `app/accounts/{accountId}/conversations/{conversationId}` (cuando se navega desde CRM)

### 3.2 Dify — Vista IA Studio (URL base: `http://dify-web:3000` o `http://localhost:3003`)

| Vista | URL | ¿Embebible? | Notas |
|-------|-----|-------------|-------|
| **Dashboard** | `/` (raíz) | ✅ Sí | Overview de apps y workflows. |
| **Workflow Editor** | `/workflow/{workflowId}` | ✅ Sí | El editor visual del clasificador. |
| **Logs de ejecución** | `/logs/{workflowId}` | ✅ Sí | Historial de ejecuciones. |
| **Knowledge Base** | `/datasets` | ✅ Sí | Gestión de documentos para RAG. |
| **API Tokens** | `/develop/access-token` | ⚠️ Parcial | Información sensible, podría requerir auth extra. |
| **Login** | `/signin` | ❌ No | SSO vía Authelia. |

**Problema actual:** `/dify/` vía Nginx retorna 404. Hay que arreglar el proxy.
**Solución:** Nginx debe servir Dify en `/dify/` con rewrite, o exponer directamente en `:3003`.

### 3.3 n8n — Vista Automations (URL base: `http://n8n:5678`)

| Vista | URL | ¿Embebible? | Notas |
|-------|-----|-------------|-------|
| **Workflows** | `/workflows` | ✅ Sí | Lista de workflows. |
| **Workflow Editor** | `/workflow/{workflowId}` | ✅ Sí | Editor visual de nodos. |
| **Execuciones** | `/executions` | ✅ Sí | Historial de ejecuciones. |
| **Credenciales** | `/credentials` | ❌ No | Contiene secrets, no embeker. |
| **Login** | `/login` | ❌ No | SSO vía Authelia. |

**Ruta vía Nginx:** `/n8n/` → funciona correctamente.

### 3.4 Twenty CRM — Vista CRM (URL base: `http://twenty-server:3000`)

| Vista | URL | ¿Embebible? | Notas |
|-------|-----|-------------|-------|
| **People/Leads** | `/objects/people` | ✅ Sí | Lista de personas con campos custom. |
| **Persona individual** | `/object/person/{id}` | ✅ Sí | Detalle del lead con timeline. |
| **Oportunidades** | `/objects/opportunities` | ✅ Sí | Pipeline de ventas. |
| **Configuración** | `/settings` | ⚠️ Parcial | Campos custom, API keys. |
| **Login** | `/auth/sign-in` | ❌ No | SSO vía Authelia. |

**Ruta vía Nginx:** `/crm/` → funciona correctamente.

### 3.5 Helper Dashboard — Vista Campaigns (URL base: `http://helper:3100`)

| Vista | URL | ¿Embebible? | Notas |
|-------|-----|-------------|-------|
| **Dashboard** | `/` (raíz del SPA) | ✅ Sí | SPA completa con 5 tabs. |
| **Campañas** | `/#campaigns` | ✅ Sí | CRUD de campañas. |
| **Leads** | `/#leads` | ✅ Sí | Tabla de leads con scoring. |
| **Plantillas** | `/#templates` | ✅ Sí | Gestión de plantillas. |
| **Canales** | `/#channels` | ✅ Sí | LEDs de estado de canales. |

**Ruta vía Nginx:** `/admin/` → funciona correctamente.
**Nota:** Es el único módulo propio. Se puede modificar sin restricciones de licencia.

---

## 4. Estructura de Navegación Unificada

### 4.1 Sidebar Principal (Siempre Visible)

```
┌──────────────────┐
│  Wibsite Logo    │
│  Business        │
├──────────────────┤
│                  │
│  📬 Inbox        │ ← Chatwoot
│  📇 CRM          │ ← Twenty
│  🧠 IA Studio    │ ← Dify
│  ⚡ Automations  │ ← n8n
│  📈 Campaigns    │ ← Helper Dashboard
│  📞 Calls        │ ← Twilio Voice (futuro)
│  📊 Analytics    │ ← Fase 6
│  ⚙️ Configuration│ ← Agent Config + Settings
│                  │
├──────────────────┤
│  🔍 Búsqueda     │ ← Global search
│  🔔 Notific. (3) │ ← Badge con contador
│  👤 Admin        │ ← Perfil + logout
│  🟢 Todos OK     │ ← Health status
└──────────────────┘
```

### 4.2 Top Bar (Contextual)

```
┌──────────────────────────────────────────────────────────────┐
│  Wibsite                                🔔 👤 admin@...     │
│  📬 Inbox > Conversaciones > María García   Volver al Hub   │
│                                                              │
│  [Chatwoot] [Twenty] [Dify] [n8n] ─ Pestañas rápidas       │
│  Breadcrumb: Módulo actual > Vista > Contexto               │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Comportamiento de Navegación

1. **Click en sidebar**: Cambia el iframe principal al módulo seleccionado
2. **Breadcrumb**: Muestra la ruta actual dentro del módulo. Se actualiza vía postMessage.
3. **Pestañas rápidas**: Arriba del iframe, permite cambiar entre vistas del mismo módulo sin recargar el shell.
4. **Búsqueda global**: Consulta API unificada (helper-node) que busca en todos los módulos.
5. **Notificaciones**: Badge con eventos no leídos. Click abre panel lateral.
6. **Estado de salud**: LED verde/rojo automático vía health checks.

---

## 5. Estrategia de Embebido de Módulos

### 5.1 Implementación del Shell

```html
<!-- wibsite-portal/index.html — Shell Principal -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wibsite Business</title>
  <link rel="stylesheet" href="portal.css">
  <script src="portal.js" defer></script>
</head>
<body>
  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <img src="logo.svg" alt="Wibsite" class="logo">
      <span class="version">v3.0</span>
    </div>
    <nav class="sidebar-nav" id="mainNav">
      <!-- Generado por JS desde NAV_ITEMS -->
    </nav>
    <div class="sidebar-footer">
      <div class="health-indicator" id="healthIndicator">🟢 Todos los servicios OK</div>
      <div class="user-info" id="userInfo">👤 admin@wibsite.com</div>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="main-content">
    <!-- Top Bar -->
    <header class="top-bar" id="topBar">
      <div class="breadcrumb" id="breadcrumb">
        <a href="#" data-module="inbox">📬 Inbox</a>
        <span class="sep">›</span>
        <span class="current">Dashboard</span>
      </div>
      <div class="top-bar-actions">
        <button class="btn btn-ghost" id="globalSearch" title="Buscar (Ctrl+K)">
          🔍
        </button>
        <button class="btn btn-ghost notification-btn" id="notificationBtn" title="Notificaciones">
          🔔 <span class="badge" id="notificationBadge">0</span>
        </button>
        <div class="user-menu" id="userMenu">
          👤 <span id="userName">admin</span>
          <div class="user-dropdown">
            <a href="#" data-action="profile">Perfil</a>
            <a href="#" data-action="settings">Configuración</a>
            <hr>
            <a href="#" data-action="logout">Cerrar Sesión</a>
          </div>
        </div>
      </div>
    </header>

    <!-- Module Quick Tabs -->
    <div class="module-tabs" id="moduleTabs">
      <!-- Generado por JS: tabs del módulo activo -->
    </div>

    <!-- Module Iframe Container -->
    <div class="iframe-container" id="iframeContainer">
      <div class="iframe-loading" id="iframeLoading">
        <div class="spinner"></div>
        <span>Cargando módulo...</span>
      </div>
      <iframe id="moduleFrame"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="microphone; camera"
        loading="lazy"
        title="Módulo activo">
      </iframe>
    </div>
  </main>

  <!-- Notification Panel -->
  <aside class="notification-panel" id="notificationPanel">
    <h3>Notificaciones</h3>
    <div id="notificationList"></div>
  </aside>

  <!-- Global Search Modal -->
  <div class="modal" id="searchModal">
    <div class="modal-content">
      <input type="text" id="searchInput" placeholder="Buscar leads, conversaciones, campañas..." autofocus>
      <div id="searchResults"></div>
    </div>
  </div>
</body>
</html>
```

### 5.2 Configuración de Módulos

```javascript
// portal.js — Configuración de módulos
const MODULES = {
  inbox: {
    id: 'inbox',
    label: 'Inbox',
    icon: '📬',
    url: '/chatwoot/app/accounts/1/dashboard',
    tabs: [
      { id: 'dashboard', label: 'Dashboard', url: '/chatwoot/app/accounts/1/dashboard' },
      { id: 'conversations', label: 'Conversaciones', url: '/chatwoot/app/accounts/1/conversations' },
      { id: 'contacts', label: 'Contactos', url: '/chatwoot/app/accounts/1/contacts' },
    ],
    color: 'var(--green)',
    postMessageEvents: ['conversation:select', 'contact:select'],
  },
  crm: {
    id: 'crm',
    label: 'CRM',
    icon: '📇',
    url: '/crm/objects/people',
    tabs: [
      { id: 'people', label: 'Personas', url: '/crm/objects/people' },
      { id: 'opportunities', label: 'Oportunidades', url: '/crm/objects/opportunities' },
    ],
    color: 'var(--purple)',
    postMessageEvents: ['person:select', 'opportunity:select'],
  },
  ai: {
    id: 'ai',
    label: 'IA Studio',
    icon: '🧠',
    url: 'http://localhost:3003/',  // Dify directo hasta arreglar proxy
    tabs: [
      { id: 'workflows', label: 'Workflows', url: 'http://localhost:3003/' },
      { id: 'knowledge', label: 'Knowledge Base', url: 'http://localhost:3003/datasets' },
      { id: 'logs', label: 'Logs', url: 'http://localhost:3003/logs' },
    ],
    color: 'var(--blue)',
  },
  automations: {
    id: 'automations',
    label: 'Automations',
    icon: '⚡',
    url: '/n8n/workflows',
    tabs: [
      { id: 'workflows', label: 'Workflows', url: '/n8n/workflows' },
      { id: 'executions', label: 'Ejecuciones', url: '/n8n/executions' },
    ],
    color: 'var(--yellow)',
  },
  campaigns: {
    id: 'campaigns',
    label: 'Campañas',
    icon: '📈',
    url: '/admin/',
    tabs: [
      { id: 'dashboard', label: 'Dashboard', url: '/admin/' },
      { id: 'campaigns', label: 'Campañas', url: '/admin/#campaigns' },
      { id: 'leads', label: 'Leads', url: '/admin/#leads' },
      { id: 'templates', label: 'Plantillas', url: '/admin/#templates' },
      { id: 'channels', label: 'Canales', url: '/admin/#channels' },
    ],
    color: 'var(--cyan)',
  },
  calls: {
    id: 'calls',
    label: 'Llamadas',
    icon: '📞',
    url: '/admin/#calls',  // Vista futura en helper o nueva SPA
    tabs: [
      { id: 'active', label: 'Activas', url: '/admin/#calls-active' },
      { id: 'history', label: 'Historial', url: '/admin/#calls-history' },
    ],
    color: 'var(--orange)',
    disabled: true,  // Habilitar cuando Fase 3 de voz esté implementada
  },
  config: {
    id: 'config',
    label: 'Configuración',
    icon: '⚙️',
    url: '/admin/#agent-config',  // Nueva vista de configuración de agente
    tabs: [
      { id: 'agent', label: 'Agente', url: '/admin/#agent-config' },
      { id: 'security', label: 'Seguridad', url: '/admin/#security' },
      { id: 'team', label: 'Equipo', url: '/admin/#team' },
    ],
    color: 'var(--muted)',
  },
};
```

### 5.3 Comunicación Shell ↔ Iframe via postMessage

```javascript
// portal.js — Comunicación cruzada

// Enviar evento al iframe
function sendToModule(eventType, data) {
  const frame = document.getElementById('moduleFrame');
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage({
      source: 'wibsite-portal',
      type: eventType,
      payload: data,
    }, '*'); // En producción: restringir al origen del módulo
  }
}

// Recibir eventos del iframe
window.addEventListener('message', (event) => {
  // Validar origen en producción
  const { source, type, payload } = event.data;
  if (source !== 'wibsite-module') return;

  switch (type) {
    case 'navigation:change':
      // Actualizar breadcrumb
      updateBreadcrumb(payload.module, payload.view, payload.context);
      break;

    case 'conversation:select':
      // Usuario seleccionó una conversación en Chatwoot
      // Guardar contexto para cuando cambie a CRM
      sessionStorage.setItem('activeLeadId', payload.leadId);
      sessionStorage.setItem('activeConversationId', payload.conversationId);
      // Actualizar el inicio rápido si es visible
      updateQuickActions(payload);
      break;

    case 'person:select':
      // Usuario seleccionó una persona en Twenty CRM
      // Navegar a Chatwoot si hay conversación vinculada
      if (payload.conversationId) {
        showQuickAction('Abrir en Chatwoot', () => {
          switchModule('inbox', `/conversations/${payload.conversationId}`);
        });
      }
      break;

    case 'notification:new':
      // Nueva notificación desde cualquier módulo
      addNotification(payload);
      break;

    case 'search:request':
      // El módulo solicita búsqueda global
      openGlobalSearch();
      break;

    case 'error':
      // Error en el módulo
      showToast(payload.message, 'error');
      break;
  }
});

// Eventos que los módulos deben implementar (agregar script en cada módulo)
// Ejemplo para añadir a Chatwoot mediante inyección:
/*
(function() {
  window.addEventListener('message', (event) => {
    if (event.data?.source !== 'wibsite-portal') return;
    const { type, payload } = event.data;
    switch (type) {
      case 'navigate':
        // Navegar a una conversación específica
        window.location.href = `/app/accounts/1/conversations/${payload.conversationId}`;
        break;
      case 'search':
        // Enfocar input de búsqueda
        document.querySelector('input[placeholder*="Search"]')?.focus();
        break;
    }
  });

  // Notificar cambios al shell
  function notifyShell(type, payload) {
    window.parent.postMessage({
      source: 'wibsite-module',
      module: 'chatwoot',
      type,
      payload,
    }, '*');
  }

  // Interceptar clicks en conversaciones
  document.addEventListener('click', (e) => {
    const convEl = e.target.closest('[data-conversation-id]');
    if (convEl) {
      notifyShell('conversation:select', {
        conversationId: convEl.dataset.conversationId,
        leadId: convEl.dataset.leadId,
        leadName: convEl.dataset.leadName,
      });
    }
  });
})();
*/
```

### 5.4 Seguridad en Iframes

```html
<!-- Atributos de seguridad del iframe -->
<iframe
  id="moduleFrame"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  allow="microphone 'self'; camera 'self'"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  title="Wibsite Module">
</iframe>
```

| Atributo | Propósito |
|----------|-----------|
| `sandbox` | Restringe capacidades del iframe (sin popups, sin navegación top, sin plugins) |
| `allow` | Permite micrófono y cámara solo cuando el módulo los necesita (voz) |
| `loading="lazy"` | Carga diferida para mejorar rendimiento inicial |
| `referrerpolicy` | No enviar referer completo por seguridad |

---

## 6. Comunicación Cruzada entre Módulos

### 6.1 Escenarios de Navegación Cruzada

| Origen | Destino | Evento | Acción |
|--------|---------|--------|--------|
| **Twenty CRM** (persona) | **Chatwoot** (conversación) | `person:select` | Abrir conversación de ese lead en Chatwoot |
| **Chatwoot** (conversación) | **Twenty CRM** (persona) | `conversation:select` | Abrir detalle del lead en Twenty |
| **Chatwoot** (conversación) | **Dify** (clasificación) | `conversation:select` | Mostrar clasificación IA de esa conversación |
| **Dify** (workflow) | **n8n** (ejecución) | `workflow:run` | Abrir la ejecución del workflow en n8n |
| **Helper Dashboard** (campaña) | **n8n** (workflow) | `campaign:select` | Abrir el workflow de campaña asociado |
| **Helper Dashboard** (lead) | **Twenty CRM** (persona) | `lead:select` | Abrir el lead en Twenty |
| **Cualquier módulo** | **Búsqueda global** | `search:request` | Abrir modal de búsqueda unificada |

### 6.2 Barra de Acciones Contextuales

Cuando el shell detecta un contexto activo (un lead, una conversación), muestra una barra de acciones rápidas arriba del iframe:

```
┌──────────────────────────────────────────────────────────────┐
│  Contexto activo: María García — Lead Hot (Score: 82)       │
│  [📬 Ver en Chatwoot] [📇 Ver en CRM] [🧠 Ver Análisis IA] │
│  [📞 Llamar] [📧 Enviar Email] [📊 Historial]              │
└──────────────────────────────────────────────────────────────┘
```

Esto se actualiza automáticamente cuando el usuario selecciona algo en cualquier módulo.

### 6.3 Sesión Compartida (sessionStorage)

```javascript
// Contexto compartido entre navegaciones
const CONTEXT_KEYS = {
  ACTIVE_LEAD_ID: 'wibsite:active:leadId',
  ACTIVE_CONVERSATION_ID: 'wibsite:active:conversationId',
  ACTIVE_CAMPAIGN_ID: 'wibsite:active:campaignId',
  ACTIVE_MODULE: 'wibsite:active:module',
  ACTIVE_TAB: 'wibsite:active:tab',
  LAST_SEARCH: 'wibsite:lastSearch',
};

// setContext y getContext manejan sessionStorage automáticamente
function setContext(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
  // Emitir a otras pestañas del mismo origen
  broadcastChannel.postMessage({ type: 'context:update', key, value });
}

function getContext(key) {
  const val = sessionStorage.getItem(key);
  return val ? JSON.parse(val) : null;
}
```

---

## 7. SSO y Sesión Unificada

### 7.1 Flujo de Autenticación Unificada

```
Usuario visita http://localhost:8080/
    │
    ▼
Nginx recibe request
    │
    ▼
Nginx → auth_request → http://authelia:9091/api/authz/auth-request
    │
    ├── ✅ Válido → Proxy_pass al shell
    │
    └── ❌ No autenticado → Redirect a portal de login Authelia
         │
         ▼
    Usuario ingresa credenciales (admin@wibsite.com / Admin@123)
         │
         ▼
    Authelia valida contra users.yml (argon2id)
         │
         ▼
    ✅ Válido → Setea cookies de sesión (8h TTL) → Redirect al shell
         │
         ▼
    Usuario ve el portal unificado con todos los módulos accesibles
```

### 7.2 Integración con Módulos

| Módulo | ¿Soporta SSO? | Mecanismo |
|--------|--------------|-----------|
| **Chatwoot** | ⚠️ Parcial | Login con cookie. Se puede configurar SSO vía OAuth2 genérico. |
| **Dify** | ⚠️ Parcial | Login con cookie + CSRF token. SSO vía OIDC (OpenID Connect). |
| **n8n** | ✅ Sí | SAML + OIDC soportado. Configurable via env vars. |
| **Twenty** | ⚠️ Parcial | Login con cookie + JWT. SSO vía OAuth2. |
| **Helper** | ❌ No (sin auth) | Se protege con Authelia. |

### 7.3 Estrategia de Autenticación por Fase

| Fase | Estrategia | Tiempo |
|------|-----------|--------|
| **Fase 1** (inmediata) | Authelia como gateway Nginx. Todos los módulos requieren sesión. | 2 días |
| **Fase 2** (corto plazo) | Cookies compartidas. Authelia redirige al usuario ya autenticado a cada módulo. | 1 semana |
| **Fase 3** (mediano plazo) | OAuth2/OIDC centralizado. Cada módulo usa Authelia como Identity Provider. | 2-3 semanas |

---

## 8. Branding y Personalización Visual

### 8.1 Design Tokens de Wibsite

```css
/* portal.css — Design Tokens */
:root {
  /* Colores Wibsite */
  --wibsite-primary: #3b82f6;
  --wibsite-primary-dark: #1d4ed8;
  --wibsite-primary-light: #93c5fd;
  --wibsite-accent: #06b6d4;
  --wibsite-bg: #0f172a;
  --wibsite-bg-alt: #1e293b;
  --wibsite-surface: #1e293b;
  --wibsite-border: #334155;
  --wibsite-text: #f1f5f9;
  --wibsite-text-muted: #94a3b8;
  --wibsite-success: #22c55e;
  --wibsite-warning: #eab308;
  --wibsite-danger: #ef4444;
  --wibsite-info: #3b82f6;

  /* Sidebar */
  --sidebar-width: 260px;
  --sidebar-bg: #0d1525;
  --sidebar-hover: rgba(255,255,255,0.03);
  --sidebar-active: rgba(59,130,246,0.1);

  /* Typography */
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-size-xs: 0.65rem;
  --font-size-sm: 0.75rem;
  --font-size-base: 0.875rem;
  --font-size-lg: 1rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Borders */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.3);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.3);

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
}
```

### 8.2 Watermark/Branding sobre Módulos Embebidos

Para mantener la marca Wibsite sobre los módulos sin modificarlos:

```css
/* overlay.css — Capa de marca sobre iframes */
.iframe-container::after {
  content: '';
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 80px;
  height: 20px;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(4px);
  border-radius: 4px;
  border: 1px solid rgba(59, 130, 246, 0.2);
  z-index: 10;
  pointer-events: none;
  /* Wibsite logo small via inline SVG */
  background-image: url("data:image/svg+xml,...");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.5;
  transition: opacity 0.3s;
}
.iframe-container:hover::after {
  opacity: 0.8;
}
```

### 8.3 Inyección de Estilos en Módulos (CSS Injection)

Para aplicar la tipografía y espaciado de Wibsite sin modificar el código fuente de los módulos:

```javascript
// Se inyecta un stylesheet en el iframe via postMessage
// (requiere que el módulo acepte mensajes)
function injectStyles(frame) {
  frame.contentWindow.postMessage({
    source: 'wibsite-portal',
    type: 'style:inject',
    payload: {
      css: `
        /* Ajustes visuales para integrarse con Wibsite */
        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
        }
        /* Ajustar padding superior si hay top bar de módulo */
        .app-header, .top-bar {
          padding-top: 48px !important;
        }
        /* Marca de agua en esquina */
        .wibsite-branding {
          position: fixed;
          bottom: 8px;
          right: 8px;
          z-index: 9999;
          opacity: 0.3;
          font-size: 10px;
          color: #3b82f6;
          pointer-events: none;
        }
      `
    }
  }, '*');
}
```

---

## 9. Vistas Específicas y Componentes Reutilizables

### 9.1 Componentes Compartidos (No reemplazan, extienden)

| Componente | ¿Dónde vive? | Función | ¿Extiende a? |
|-----------|-------------|---------|--------------|
| **Global Search** | Shell (portal.js) | Buscar leads, conversaciones, campañas en todos los módulos | N/A (es global) |
| **Notification Center** | Shell | Consolidar notificaciones de Chatwoot, n8n, Helper | Todos los módulos |
| **Quick Actions Bar** | Shell | Acciones contextuales según lead/conversación activa | Chatwoot + Twenty + Calls |
| **Lead Context Panel** | Segundo iframe lateral | Muestra perfil del lead activo (via lead-profile API) | Chatwoot + Twenty |
| **AI Insights Panel** | Segundo iframe lateral | Muestra clasificación IA del lead activo (via Dify) | Chatwoot + Twenty |
| **Health Status Bar** | Shell | LEDs de estado de todos los servicios | N/A (es global) |

### 9.2 Panel Lateral de Contexto (Split View)

```
┌──────────────────────────────────────────────────────────────┐
│  [Módulo principal embebido]   │  [Panel de contexto]        │
│                                │                              │
│  ┌──────────────────────────┐  │  ┌────────────────────────┐  │
│  │                          │  │  │  Lead Profile          │  │
│  │  Chatwoot / Twenty /     │  │  │  • María García        │  │
│  │  Dify embed              │  │  │  • Score: 82 (🔥 Hot)  │  │
│  │                          │  │  │  • Intención: Compra   │  │
│  │                          │  │  │  • Estado: Propuesta   │  │
│  │                          │  │  │  • Último msg: hoy     │  │
│  │                          │  │  ├────────────────────────┤  │
│  │                          │  │  │  AI Insights           │  │
│  │                          │  │  │  • Necesidad:          │  │
│  │                          │  │  │    automatización      │  │
│  │                          │  │  │  • Próxima acción:     │  │
│  │                          │  │  │    agendar demo        │  │
│  │                          │  │  ├────────────────────────┤  │
│  │                          │  │  │  Acciones Rápidas      │  │
│  │                          │  │  │  [📞 Llamar] [📧 Msg] │  │
│  │                          │  │  │  [📊 Historial]        │  │
│  └──────────────────────────┘  │  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 9.3 Breadcrumb de Navegación

```javascript
const breadcrumbMap = {
  inbox: {
    dashboard: { label: 'Dashboard', parent: null },
    conversations: { label: 'Conversaciones', parent: null },
    'conversations/:id': { label: null, parent: 'conversations' }, // dinámico
    contacts: { label: 'Contactos', parent: null },
  },
  crm: {
    people: { label: 'Personas', parent: null },
    'people/:id': { label: null, parent: 'people' },
    opportunities: { label: 'Oportunidades', parent: null },
  },
  // ...
};
```

---

## 10. Roadmap de Implementación UX

### Fase UX-1: Shell Foundation (Semana 1)

| # | Acción | Módulos | Tiempo | Verificación |
|---|--------|---------|--------|-------------|
| 1.1 | Crear shell HTML/CSS con sidebar + top bar + iframe container | portal | 1 día | ✅ Sidebar visible con todos los módulos |
| 1.2 | Implementar navegación por sidebar (click → cambia iframe) | portal | 0.5 día | ✅ Click en CRM → iframe carga Twenty |
| 1.3 | Implementar breadcrumb dinámico | portal | 0.5 día | ✅ Breadcrumb muestra ruta actual |
| 1.4 | Arreglar proxy Dify (`/dify/` → `:3003`) | nginx | 0.5 día | ✅ `/dify/` funciona sin 404 |
| 1.5 | Activar Authelia como gateway | authelia + nginx | 2 días | ✅ Login único protege todos los módulos |
| 1.6 | Inyectar Wibsite watermark/branding en módulos | portal | 0.5 día | ✅ Marca visible en todos los módulos |
| 1.7 | Implementar health checker en tiempo real | portal | 0.5 día | ✅ LEDs reflejan estado real |

**Verificación final Fase UX-1:**
```
✅ Usuario ingresa a http://localhost:8080/
✅ Ve sidebar con todos los módulos
✅ Click en CRM → carga Twenty CRM en iframe
✅ Click en Inbox → carga Chatwoot en iframe
✅ Click en IA → carga Dify en iframe
✅ Sin volver a loguear (SSO)
✅ Watermark de Wibsite visible
✅ LEDs de estado actualizados
```

### Fase UX-2: Contexto Compartido (Semanas 2-3)

| # | Acción | Módulos | Tiempo | Verificación |
|---|--------|---------|--------|-------------|
| 2.1 | Implementar postMessage shell ↔ módulos | portal + scripts de inyección | 2 días | ✅ Eventos cruzados funcionan |
| 2.2 | Inyectar script de notificación en Chatwoot | chatwoot (vía inyección) | 1 día | ✅ Chatwoot notifica al shell |
| 2.3 | Inyectar script de notificación en Twenty | twenty (vía inyección) | 1 día | ✅ Twenty notifica al shell |
| 2.4 | Implementar barra de acciones contextuales | portal | 1 día | ✅ Al seleccionar lead, muestra acciones |
| 2.5 | Implementar búsqueda global (Ctrl+K) | portal + helper API | 2 días | ✅ Buscar "María" → resultados de todos los módulos |
| 2.6 | Panel lateral de contexto (Lead Profile) | portal + lead-profile API | 2 días | ✅ Al seleccionar lead, panel muestra perfil completo |

**Verificación final Fase UX-2:**
```
✅ Click en lead en Twenty → contexto guardado
✅ Switchear a Chatwoot → abre conversación de ese lead
✅ Barra de acciones contextuales visible
✅ Búsqueda global funciona (Ctrl+K)
✅ Panel lateral muestra perfil del lead
✅ Notificaciones de módulos aparecen en el shell
```

### Fase UX-3: Vistas Especializadas (Semanas 4-6)

| # | Acción | Módulos | Tiempo | Verificación |
|---|--------|---------|--------|-------------|
| 3.1 | Split view: Chatwoot + Lead Profile panel | portal | 1 día | ✅ Vista partida funcional |
| 3.2 | Split view: Twenty + AI Insights panel | portal + dify | 1 día | ✅ Vista partida funcional |
| 3.3 | Vista Calls en el shell | portal + twilio | 2 días | ✅ Llamadas visibles en el portal (Fase 3 voz) |
| 3.4 | Vista Configuration (Editor de Agente) | portal + agent-config.html | 2 días | ✅ Configuración del agente en el portal |
| 3.5 | Dashboard analítico consolidado | portal + helper analytics | 3 días | ✅ KPIs de todos los módulos en una vista |
| 3.6 | Temas visuales (Wibsite Dark/Light) | portal | 2 días | ✅ Usuario puede cambiar tema |

**Verificación final Fase UX-3:**
```
✅ Split view Chatwoot + Lead Profile funcional
✅ Split view Twenty + AI Insights funcional
✅ Llamadas integradas en el portal
✅ Editor de agente accesible desde Configuración
✅ Dashboard analítico consolidado
✅ Cambio de tema funciona
```

### Fase UX-4: Refinamiento y Multi-Tenant (Semanas 7-8)

| # | Acción | Módulos | Tiempo | Verificación |
|---|--------|---------|--------|-------------|
| 4.1 | Personalización por tenant (logo, colores) | portal + agent-config | 2 días | ✅ Cada tenant ve su marca |
| 4.2 | Permisos y roles en el shell | portal + auth | 2 días | ✅ Admin ve todo, agente ve solo lo suyo |
| 4.3 | Responsive: versión móvil del shell | portal | 2 días | ✅ Sidebar colapsable, iframe responsive |
| 4.4 | Performance: lazy loading de iframes | portal | 1 día | ✅ Solo el módulo activo carga recursos |
| 4.5 | Onboarding: tour guiado del portal | portal | 1 día | ✅ Nuevo usuario ve tutorial interactivo |

---

## 11. Matriz de Impacto y Riesgos UX

| # | Riesgo | Prob | Impacto | Mitigación |
|---|--------|------|---------|------------|
| UX-R01 | Módulo no carga en iframe (CSP block) | Media | Alto | Verificar Content-Security-Policy de cada módulo. Usar sandbox attributes. |
| UX-R02 | postMessage no funciona en algunos módulos | Media | Medio | Inyectar script listener via Nginx o extensión. Validar origen. |
| UX-R03 | Dify no se embebe por X-Frame-Options | Alta | Alto | Configurar Dify para permitir iframes: `CONSOLE_CORS_ALLOW_ORIGINS`. |
| UX-R04 | Veinte no se embebe por X-Frame-Options | Media | Alto | Revisar configuración de Twenty. Permitir origen del shell. |
| UX-R05 | Sesión expira en medio de uso | Baja | Medio | TTL de sesión renovable. Mostrar advertencia antes de expirar. |
| UX-R06 | Iframe lento al cargar (módulo pesado) | Alta | Medio | Lazy loading + skeleton screens + spinner. Cargar módulo en background. |
| UX-R07 | Conflicto de shortcuts (Ctrl+K, Ctrl+S) | Alta | Medio | Registrar shortcuts solo cuando el shell está enfocado. Pasar eventos no capturados al iframe. |
| UX-R08 | Módulo con su propio scroll + shell con scroll | Alta | Medio | iframe con height 100% y overflow auto. Shell con height fijo. |
| UX-R09 | Notificaciones duplicadas | Media | Bajo | Deducir por ID de evento. No mostrar si ya fue vista. |
| UX-R10 | Usuario no entiende que está en un portal | Baja | Bajo | Breadcrumb claro + indicador de módulo activo en sidebar. |

### Módulos con Restricciones de Embebido Conocidas

| Módulo | Restricción | Solución |
|--------|------------|----------|
| **Dify** | `X-Frame-Options` podría estar configurado | Configurar `CONSOLE_CORS_ALLOW_ORIGINS=http://localhost:8080` en docker-compose |
| **Dify Web** | Next.js SSR puede romperse en iframe | Usar URL directa `http://localhost:3003` (puerto expuesto) en lugar de proxy |
| **Chatwoot** | Service Worker de PWA puede interferir | Deshabilitar service worker en iframe o configurar correctamente |
| **Twenty** | GraphQL playground no debería embeberse | No embeker GraphQL playground, solo las vistas de negocio |
| **n8n** | No tiene restricciones conocidas | ✓ Embebible directamente |
| **Helper** | Es nuestro, sin restricciones | ✓ Embebible y modificable |

---

## 12. Integración con Roadmap Multi-Agente y Seguridad

### 12.1 Vínculos con ROADMAP-MULTI-AGENT-MEMORY-CONTEXT.md

| Componente del Roadmap | Vista UX Relacionada | ¿Dónde se ve? |
|------------------------|---------------------|---------------|
| **Conversation Store (Redis)** | Panel de perfil de lead (timeline + estado) | Split view en Chatwoot |
| **Lead Profile** | Panel lateral con perfil unificado | Sidebar contextual (siempre visible) |
| **RAG Knowledge Base** | Subida de documentos en Configuración del Agente | Pestaña "Knowledge Base" en ⚙️ |
| **Multi-Agent Router** | Indicador de qué agente está respondiendo | Chat bubble con badge "Sales Agent" / "Support" |
| **Sub-Agent Adaptador** | Configuración de contexto del negocio | Editor visual en ⚙️ > Agente |
| **TTS / Voz** | Vista de llamadas + player de audio | 📞 Calls + inline player en conversaciones |
| **Anti-Hallucination** | Indicador de confianza en respuestas IA | Badge "AI (82% confianza)" en respuestas |
| **Nurturing Automático** | Timeline de acciones de nurturing | Panel de timeline en perfil del lead |

### 12.2 Vínculos con SECURITY-MASTER.md

| Componente de Seguridad | Vista UX Relacionada | Implementación UX |
|-------------------------|---------------------|-------------------|
| **Sanitizador de Prompts** | Indicador de alerta de seguridad | Badge rojo "⚠️ Inyección detectada" en la conversación |
| **Rate Limiting** | Mensaje de error amigable | Toast "Demasiados mensajes. Intenta en 1 minuto." |
| **API Key Management** | Vista de gestión de API keys | ⚙️ > Seguridad > API Keys con UI de creación/rotación |
| **Multi-Tenant Isolation** | Cambio de tenant visible en el shell | Selector de tenant en top bar (solo admin) |
| **Audit Logs** | Vista de logs de auditoría | ⚙️ > Seguridad > Logs con filtros y exportación |
| **Anti-Alucinaciones** | Indicador de verificación de fuente | Icono 📎 con "Fuente: Catálogo 2026.pdf" en respuestas |

### 12.3 Vista de Configuración de Seguridad (UX)

```
⚙️ Configuración > Seguridad
├── 🔑 API Keys
│   ├── [Crear Nueva Key] [Rotar] [Revocar]
│   ├── Key de Desarrollo (creada 15/07/2026) ●●●●●●●●●● [Copiar] [Revocar]
│   └── Key de Producción (creada 01/07/2026) ●●●●●●●●●● [Copiar] [Revocar]
│
├── 🛡️ Protección del Agente
│   ├── Sensibilidad: [Baja] [Media] [Alta] ● ← slider
│   ├── Rate Limit: 30 mensajes/minuto
│   ├── Bloquear patrones: [admin] [system prompt] [ignore] [+ Agregar]
│   └── [Probar Protección] → Sandbox: "Intenta hackear el sistema"
│
├── 📋 Logs de Auditoría
│   ├── [Última hora] [Hoy] [Últimos 7 días] [Personalizado]
│   └── Tabla: Fecha | Evento | Usuario | IP | Detalle
│
└── 🔒 Políticas de Datos
    ├── Retención de conversaciones: 90 días
    ├── Retención de logs: 1 año
    └── Cifrado en reposo: ✅ Activado
```

---

## Resumen de Objetivos UX

| # | Objetivo | Fase | Criterio de Éxito |
|---|---------|------|-------------------|
| UX-O1 | **Una sola URL para todo el sistema** | UX-1 | `http://localhost:8080/` es la única URL que el usuario necesita |
| UX-O2 | **Un solo login para todos los módulos** | UX-1 | Usuario se loguea una vez y accede a Chatwoot, Twenty, Dify, n8n, Dashboard |
| UX-O3 | **Navegación consistente y siempre visible** | UX-1 | Sidebar con todos los módulos siempre accesible |
| UX-O4 | **Contexto persistente entre módulos** | UX-2 | Seleccionar lead en Twenty → abre su conversación en Chatwoot |
| UX-O5 | **Búsqueda global unificada** | UX-2 | Ctrl+K busca en leads, conversaciones, campañas, contactos |
| UX-O6 | **Panel de contexto del lead siempre visible** | UX-2 | Split view: módulo principal + perfil del lead activo |
| UX-O7 | **Notificaciones centralizadas** | UX-2 | Todas las notificaciones de todos los módulos en un solo lugar |
| UX-O8 | **Editor visual de agente** | UX-3 | Configurar contexto, personalidad, productos del agente sin código |
| UX-O9 | **Dashboard analítico consolidado** | UX-3 | KPIs de ventas, campañas, leads en una sola vista |
| UX-O10 | **Personalización por tenant** | UX-4 | Logo, colores, dominio personalizado por cliente |
| UX-O11 | **Responsive y mobile-friendly** | UX-4 | Portal usable desde tablet y móvil |
| UX-O12 | **Tour de onboarding** | UX-4 | Nuevo usuario guiado a través del portal en primeros pasos |
