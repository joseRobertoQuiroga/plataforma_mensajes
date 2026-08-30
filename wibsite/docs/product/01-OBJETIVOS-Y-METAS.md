# Objetivos y Metas del Producto

> Estado verificado contra **código y runtime** el 2026-08-30 (re-auditoría; previa 28/08).
> Criterio: `IMPLEMENTADO` = evidencia en código/ejecución · `EN PROCESO` = parcial · `PLANEADO` = documentado pero no verificado en código.

## 1. Objetivos de producto

| # | Objetivo | Estado | Evidencia (30/08/2026) |
|---|----------|--------|------------------------|
| 1 | Plataforma de mensajería omnicanal para PYMEs (WhatsApp, Telegram, Messenger, Email, TikTok, SMS) | IMPLEMENTADO (parcial en canales externos) | 5 adapters en `helper-node/services/channels/`; runtime `/api/channels/status`: telegram=configured, whatsapp=configured, messenger/email/tiktok=no configurados |
| 2 | Agente de ventas IA con memoria y flujo comercial | IMPLEMENTADO | `helper-node/services/agentCore/` (grafo 9 nodos, guards, checkpointer, commercialState); tests en `__tests__/` |
| 3 | CRM metodológico (SPICED/MEDDIC) con Twenty | IMPLEMENTADO | `helper-node/services/leadProfile.js`; 10 campos custom en Twenty |
| 4 | RAG con conocimiento de negocio | IMPLEMENTADO | `services/ragEngine.js` + nodo `kb` del grafo + `kb-documents/` cargadas al arranque |
| 5 | Cotización automática (8 servicios) | IMPLEMENTADO | `services/agentCore/quoteEngine.js` + nodo `cotizacion` |
| 6 | Monitoreo y observabilidad (traces, logs, métricas) | IMPLEMENTADO | Elasticsearch 9.x + Kibana + OTel Collector operativos; ILM 1d/30d; índices con datos hasta 30/08 |
| 7 | Seguridad: SSO, RLS multi-tenant, PII, secretos | IMPLEMENTADO (parcial) | Authelia+nginx auth_request verificado (403 sin SSO); RLS 7 políticas; secretos masked en CI |
| 8 | Multicanal real (Twilio WhatsApp) | IMPLEMENTADO | Bridge Twilio inbound+broadcast verificado |
| 9 | CI/CD con gates de calidad | IMPLEMENTADO (base) | Pipeline dev **#58 SUCCESS** (helper-tests 83 + smoke 2 + flow 3; TeVS 14 informativo) |
| 10 | Multi-tenant SaaS y despliegue distribuido | PLANEADO | F-52..F-56 (documentado, sin implementar) |
| 11 | Frappe/ERP y Metabase/BI | PLANEADO (diferido) | Rutas nginx comentadas |
| 12 | **UI unificada** (decisión técnica 30/08: motores sin UI) | IMPLEMENTADO | `frontend/` Next.js (15 páginas); hub eliminado; n8n/Dify/Chatwoot/Twenty como motores vía API |

## 2. Metas del roadmap

| Meta | Objetivo | Estado |
|------|----------|--------|
| Fase 0 — Fundación | Stack completo + documentación | ✅ IMPLEMENTADO |
| Fase 1 — WhatsApp + IA + Twenty | Canal real + flujo inbound + campaign | ✅ IMPLEMENTADO (vía Twilio; Meta pendiente) |
| Fase 2 — Frappe ERP | Integración ERP | 🚫 PLANEADO (diferido) |
| Fase 5 — Endurecimiento producción | Auditoría, monitoreo, backups, CI/CD | 🟡 EN PROCESO (auditorías ✅, CI/CD base ✅, deploy ❌) |
| Fase 7 — Multi-tenant | Aislamiento, white-label, billing | 🚫 PLANEADO |

## 3. Métricas de éxito documentadas

| Métrica | Objetivo | Estado real verificado |
|---------|----------|------------------------|
| Disponibilidad servicios | >99.9% | Stack 21 contenedores up (28/08) |
| Latencia helper p95 | <200ms | Health OK v2.2.0 (uptime 1h39m) |
| Clasificación Dify | <5s | Con DIFY_BUDGET_MS=6000: p95 4471→1177ms (doc 15/08) |
| Throughput campañas | >1000 msgs/h | Load: 3.29 turnos/s, p95 1177ms (doc 15/08) |
| Tests | — | 176 unit (doc) / 141 E2E (commit 8f4141e) / TeVS 14/14 (pipeline #23) |

## 4. Planes de negocio (monetización)

- Documentados en `BUSINESS-MASTER.md` (4 planes, KPIs por flujo, proyecciones financieras).
- **Estado en código:** sin implementar (requiere F-53 planes + onboarding, F-10 multi-tenant). → PLANEADO.