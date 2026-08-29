# Wibsite Business — Diseño de Navegación Unificada

> **ESTADO: OBSOLETO (Reemplazado por Frontend Unificado en Next.js, ver ADR-022)**
>
> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Propósito:** Diseño de unificación de servicios en una sola vista navegable sin retorno a instancia original.

---

## 1. Problema Actual

Actualmente, para usar los diferentes módulos:
```
Hub (/hub/) → Click en tarjeta → Abre en nueva pestaña/ventana
  ├── Admin Dashboard (/admin/)
  ├── n8n (/n8n/)
  ├── Chatwoot (/chatwoot/)
  ├── Twenty CRM (/crm/)
  ├── Dify (:3003 directo)
  └── Grafana/MinIO/GlitchTip (sin ruta unificada)
```

**Problemas:**
- Dify no pasa por SSO (usa puerto 3003 directo)
- Cada módulo abre en pestaña separada = contexto perdido
- Sin panel lateral de lead activo
- La navegación es "volver al hub" e ir a otro módulo

---

## 2. Solución Propuesta: Portal Shell Unificado con iframe + postMessage

### Arquitectura
```
Navegador: /portal/ (única URL, un solo login)
  ┌─────────────────────────────────────────────────┐
  │  Topbar: Logo | Búsqueda (Ctrl+K) | Notifs | Usuario │
  ├──────────┬──────────────────────────────────────┤
  │ Sidebar  │  Content Area (iframe)               │
  │          │                                      │
  │ 📊 Hub  │  El módulo activo se carga aquí      │
  │ ⚙️ Admin│  Sin recargar la página completa      │
  │ 💬 Inbox│  Contexto de lead persiste en panel   │
  │ 👥 CRM  │                                      │
  │ 🧠 IA   │  ┌──────────────────────────────┐    │
  │ ⚡ Auto │  │                              │    │
  │ 📈 Mét. │  │      (iframe del módulo)     │    │
  │ 🐛 Err  │  │                              │    │
  │          │  └──────────────────────────────┘    │
  ├──────────┴──────────────────────────────────────┤
  │  Panel lateral contextual (Lead activo)         │
  └─────────────────────────────────────────────────┘
```

### Componentes

#### A. Portal Shell (`hub/portal/index.html`) — YA IMPLEMENTADO
- Sidebar con 9 módulos
- Iframe con sandbox
- postMessage para comunicación
- Health checker integrado
- Watermark de versión

#### B. Panel Lateral de Lead Activo (NUEVO)
```javascript
// Protocolo postMessage entre módulos
// Cualquier módulo envía:
window.parent.postMessage({ 
  type: 'wibsite-module', 
  module: 'chatwoot|admin|crm',
  leadId: 'uuid-del-lead',
  action: 'view|edit|handoff'
}, '*');

// Portal recibe y actualiza panel lateral
window.addEventListener('message', (event) => {
  if (event.data?.type === 'wibsite-module') {
    // Actualizar panel lateral con datos del lead
    fetch(`/api/leads/${event.data.leadId}/profile`)
      .then(r => r.json())
      .then(profile => updateLeadPanel(profile));
  }
});
```

#### C. Navegación Sin Recarga
- Transiciones suaves entre módulos (fade)
- Estado activo persistente en sessionStorage
- Breadcrumb dinámico: `Inbox > Conversación #123`
- Swap de iframe sin recargar el shell

#### D. Contexto Compartido
| Módulo Origen | Acción | Módulo Destino | Contexto Enviado |
|---------------|--------|----------------|-------------------|
| Twenty CRM | Click en lead | Chatwoot | leadId, conversationId |
| Chatwoot | Click en perfil | Twenty CRM | contactId |
| Admin Dashboard | Click en lead | Chatwoot/Twenty | leadId, score, última interacción |
| Portal | Ctrl+K búsqueda | Módulo destino | query, tipo resultado |

---

## 3. Plan de Implementación

### Fase 1: SSO Unificado (Authelia + Dify)
| Paso | Acción | Archivos |
|------|--------|----------|
| 1.1 | Hacer pasar Dify por auth_request de nginx | `nginx.conf` (location /dify/ → proxy_pass a dify-web:3000) |
| 1.2 | Verificar que Dify funciona detrás de Authelia | Test manual |
| 1.3 | Agregar Grafana, GlitchTip, MinIO Console al SSO | Ya en nginx.conf v4 |
| 1.4 | Prueba: login único abre todos los módulos | CHECKLIST-SSO.md |

### Fase 2: Portal Shell Mejorado
| Paso | Acción | Archivos |
|------|--------|----------|
| 2.1 | Lead Context Panel (split view) | `hub/portal/js/leadPanel.js` |
| 2.2 | Búsqueda global Ctrl+K | `hub/portal/js/search.js`, `GET /api/search` |
| 2.3 | Notificaciones unificadas | `hub/portal/js/notifications.js` |
| 2.4 | Health checker en tiempo real | `hub/portal/js/health.js` |
| 2.5 | Transiciones CSS entre módulos | `hub/portal/css/transitions.css` |

### Fase 3: PostMessage Cross-Module
| Paso | Acción | Protocolo |
|------|--------|-----------|
| 3.1 | Twenty → Chatwoot (abrir conversación) | `{type:'open-chatwoot', leadId, phone}` |
| 3.2 | Chatwoot → Twenty (ver perfil) | `{type:'open-crm', contactId}` |
| 3.3 | Dashboard → Módulo (navegar a lead) | `{type:'navigate', module, leadId}` |
| 3.4 | Panel lateral se actualiza solo | Escucha todos los eventos |

### Fase 4: Experiencia Fluida
| Paso | Acción |
|------|--------|
| 4.1 | Lazy loading de módulos (carga solo al navegar) |
| 4.2 | Cache de iframes (no recargar al volver) |
| 4.3 | Sesión única 8h (Authelia) |
| 4.4 | Sin redirects a puertos diferentes |

---

## 4. Estado Actual vs Objetivo

| Aspecto | Estado Actual | Objetivo | Esfuerzo |
|---------|--------------|----------|----------|
| Portal shell | ✅ Sidebar + iframe + health checker | Panel lateral + transiciones | 4h |
| SSO Dify | ⬜ Puerto 3003 directo | ✅ Vía nginx auth_request | 1h |
| SSO Grafana | ✅ Ruta protegida | ✅ Ya en nginx | 0h |
| Lead Panel | ⬜ No existe | ✅ Split view con perfil | 3h |
| Búsqueda global | ⬜ No existe | ✅ Ctrl+K + endpoint search | 3h |
| PostMessage | ✅ Básico implementado | ✅ 4 escenarios cross-module | 4h |
| Transiciones | ⬜ Recarga completa | ✅ Sin recarga del shell | 2h |
| **Total** | **~30%** | **100%** | **~17h** |

---

## 5. Arquitectura de Comunicación Cross-Module

```
                    ┌──────────────────────────────────┐
                    │        Portal Shell (hub/)        │
                    │  - Sidebar navigation              │
                    │  - Lead Context Panel              │
                    │  - Global Search (Ctrl+K)          │
                    │  - Notification Center             │
                    └──────────┬───────────────┬────────┘
                               │               │
                    postMessage│               │API calls
                               ▼               ▼
                    ┌──────────────────┐  ┌────────────────┐
                    │  Module Iframes  │  │  Helper API    │
                    │                  │  │                │
                    │  chatwoot/       │  │  GET /api/leads│
                    │  crm/            │  │  GET /api/search│
                    │  admin/          │  │  POST /api/... │
                    │  n8n/            │  └────────────────┘
                    │  dify/ (via 3003)│
                    └──────────────────┘
```

**Reglas del protocolo postMessage:**
1. Todos los mensajes tienen `type: 'wibsite-{origen}'`
2. El origen SIEMPRE se valida (nunca `*`)
3. El payload incluye `module` + `action` + datos mínimos
4. El portal responde con `{type:'wibsite-ack', status:'ok|error'}`
5. Timeout de 5s para respuestas

---

## 6. Próximos Pasos Inmediatos

1. **Habilitar Dify detrás de SSO**: Mover ruta /dify/ en nginx a proxy_pass http://dify-web:3000/ (en vez de redirect a :3003)
2. **Agregar panel lateral**: Crear leadPanel.js con fetch a /api/leads/:id/profile
3. **Implementar búsqueda global**: Endpoint GET /api/search + UI Ctrl+K en portal
4. **Probar comunicación cross-module**: Twenty → Chatwoot como primer escenario

> **Nota:** Esta unificación queda pendiente de la activación completa de Authelia SSO, ya que todos los módulos deben estar detrás del mismo guardián de autenticación para que el portal funcione sin redirects a páginas de login separadas.
