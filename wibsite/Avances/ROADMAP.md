# ROADMAP — Hoja de Ruta del Proyecto

> Proyección de fases, dependencias y milestones — Última actualización: 2026-07-18

---

## Fase 0 — Fundación ✅ (COMPLETADA)

| Milestone | Estado | Descripción |
|-----------|--------|-------------|
| M0.1 | ✅ | Docker Compose con todos los servicios |
| M0.2 | ✅ | PostgreSQL + Redis + Weaviate operativos |
| M0.3 | ✅ | Documentación inicial completa |
| M0.4 | ✅ | Helper Node funcional (35+ endpoints) |
| M0.5 | ✅ | Dify con workflow clasificador funcional |
| M0.6 | ✅ | n8n con workflows importados |
| M0.7 | ✅ | Twenty CRM con campos custom y API key |

---

## Fase 1 — WhatsApp + IA + Twenty CRM 🔄 (EN PROGRESO 70%)

| # | Objetivo | Estado | Dependencia |
|---|----------|--------|-------------|
| 1.1 | Configurar Meta App Business | 🚫 No iniciado | — |
| 1.2 | Configurar Inbox WhatsApp en Chatwoot | 🚫 No iniciado | 1.1 |
| 1.3 | Webhook Chatwoot → n8n | 🚫 No iniciado | 1.2 |
| 1.4 | Credenciales n8n (Dify, Twenty, Meta) | 🚫 No iniciado | 1.1 |
| 1.5 | Webhook Meta → helper-node | 🚫 No iniciado | 1.1 |
| 1.6 | Prueba flujo inbound completo | 🚫 No iniciado | 1.1-1.5 |
| 1.7 | Prueba flujo campaign broadcast | 🚫 No iniciado | 1.1, 1.4 |
| 1.8 | Activar workflows n8n desde UI | 🚫 No iniciado | — |
| 1.9 | Validación SSO con Authelia | 🚫 No iniciado | — |

### Sub-fases detalladas (estimación: 3-5 días hábiles)

**Sub-fase 1A — Meta App (1 día)**
- Crear App Business en Facebook Developers
- Configurar producto WhatsApp
- Verificar número de teléfono
- Generar tokens
- Completar variables en `.env`

**Sub-fase 1B — Integración Chatwoot (1 día)**
- Agregar inbox WhatsApp en Chatwoot
- Configurar webhook → n8n
- Verificar recepción de mensajes

**Sub-fase 1C — Credenciales n8n (1 día)**
- Agregar credenciales desde UI
- Configurar variables de entorno
- Activar workflows

**Sub-fase 1D — Validación (1 día)**
- Probar flujo inbound completo
- Probar flujo campaign broadcast
- Verificar sync Twenty CRM
- Documentar resultados

---

## Fase 2 — Integración Frappe ERP 🚫 (NO INICIADA)

| Objetivo | Estimación | Dependencia |
|----------|-----------|-------------|
| Setup Frappe ERP en Docker | 3 días | Fase 1 |
| Sincronización leads Twenty → Frappe | 2 días | Fase 1 |
| Sincronización pedidos/vtas | 3 días | Fase 1 |
| Automatización facturación | 2 días | Fase 1 |
| Workflows n8n Frappe | 2 días | Fase 1 |

---

## Fase 3 — Lumi Sales Copilot 🚫 (NO INICIADA)

| Objetivo | Estimación | Dependencia |
|----------|-----------|-------------|
| Asistente de ventas IA en tiempo real | 5 días | Fase 2 |
| Recomendaciones de productos | 3 días | Fase 2 |
| Automatización seguimiento leads | 3 días | Fase 2 |
| Análisis de conversación en vivo | 3 días | Fase 2 |

---

## Fase 4 — Pipeline IA Avanzado 🚫 (NO INICIADA)

| Objetivo | Dependencia |
|----------|-------------|
| RAG con documentos empresariales | Fase 3 |
| State machine para diálogos multi-turno | Fase 3 |
| Function calling desde Dify | Fase 3 |
| Detección multi-idioma y sentimiento | Fase 3 |

---

## Fase 5 — Endurecimiento Producción 🚫 (NO INICIADA)

| Objetivo | Dependencia |
|----------|-------------|
| Auditoría de seguridad | Fase 1 |
| Monitoreo con alertas | Fase 1 |
| Backups automatizados | Fase 1 |
| CI/CD pipeline | Fase 1 |
| Plan de recuperación ante desastres | Fase 1 |

---

## Fase 6 — Analytics e Inteligencia de Negocio 🚫 (NO INICIADA)

| Objetivo | Dependencia |
|----------|-------------|
| Data Warehouse | Fase 5 |
| Dashboards ejecutivos | Fase 5 |
| Forecasting de ventas | Fase 5 |
| Segmentación avanzada | Fase 5 |

---

## Fase 7 — Multi-Tenant y Escalamiento 🚫 (NO INICIADA)

| Objetivo | Dependencia |
|----------|-------------|
| Aislamiento de datos multi-tenant | Fase 6 |
| White-label | Fase 6 |
| Sistema de billing | Fase 6 |
| Onboarding self-service | Fase 6 |
| API pública | Fase 6 |

---

## Diagrama de Dependencias

```
Fase 0 ── Fundación ✅
   │
   ▼
Fase 1 ── WhatsApp + IA + Twenty CRM 🔄 (70%)
   │
   ├──► Fase 2 ── Frappe ERP 🚫
   │        │
   │        ▼
   │    Fase 3 ── Lumi Sales Copilot 🚫
   │        │
   │        ▼
   │    Fase 4 ── Pipeline IA Avanzado 🚫
   │
   ├──► Fase 5 ── Endurecimiento Producción 🚫
   │
   └──► Fase 6 ── Analytics 🚫
             │
             ▼
         Fase 7 ── Multi-Tenant 🚫
```

---

## Métricas de Éxito

### Técnicas
- Disponibilidad de servicios: >99.9%
- Tiempo de respuesta helper-node: <200ms p95
- Tiempo de clasificación Dify: <5s
- Throughput de campañas: >1000 msgs/hora

### Negocio
- Leads clasificados/día: objetivo >50
- Tasa de conversión leads → oportunidades
- Efectividad de campañas (tasa de entrega, lectura, respuesta)
- Reducción de tiempo de respuesta a leads

### Producto
- Cobertura de canales: WhatsApp, Messenger, TikTok, SMS, Email
- Precisión de clasificación IA: >85%
- Tasa de auto-respuesta sin intervención humana
