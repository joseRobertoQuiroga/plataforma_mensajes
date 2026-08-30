# Brecha: Planeación (documentación) vs Código

> Principio: el **código y lo implementado es la verdad**. Todo lo que la documentación promete y el código/runtime no confirma se registra aquí como **PENDIENTE de implementar o validar**.
> Última actualización: 2026-08-30 (re-auditoría; previa 28/08).
>
> 📌 Vista derivada. La fuente canónica es [`../development/03-PENDIENTES-Y-VALIDACION.md`](../development/03-PENDIENTES-Y-VALIDACION.md); índice unificado en [`../INDEX-GAPS.md`](../INDEX-GAPS.md).

## A. Discrepancias doc vs código (verificadas 30/08)

| # | Documentación | Código/Runtime real | Acción |
|---|---------------|---------------------|--------|
| D1 | "Telegram: falta conectar token" (ESTADO-GENERAL) | `telegram configured=true` | Validar envío real con bot (BotFather) → cerrar brecha |
| D2 | "~120-130 rutas helper" | **136 rutas** (111 únicas) | ✅ Confirmado 30/08; métrica oficial 136 |
| D3 | "TeVS 11/11, 13/13, 14/14" (docs previos) | **14 tests** (10/14 en CI dev; 4 de entorno informativos) | Usar 14 tests como catálogo oficial; 10/14 gate funcional |
| D4 | "Twenty `/api/twenty/health`" (COMPONENTES) | 404 runtime; módulo no localizado en index.js | Re-localizar endpoints Twenty en código (SPIKE) |
| D5 | "n8n 3 workflows activos" | healthz ok; activación vía SQL documentada, toggle UI pendiente | Verificar activos en runtime (SPIKE) |
| D6 | "Chatwoot inbox configurado" | Contenedor up; verificación de inbox pendiente | Re-verificar inbox + webhook |
| D7 | "Hub central + Dashboard SPA en helper" (docs previos) | `hub/` **eliminado** (commit `d17b09c`); frontend Next.js unificado (15 páginas) | ✅ Decisión técnica 30/08 → maestro G13 + 02-ESTADO actualizados |
| D8 | "22 suites · 176 tests" (TESTING-INDEX 15/08) | **24 suites** de test (TESTING-INDEX actualizado 30/08) | ✅ Conteo real de archivos |

## B. En proceso (parcial — verificado parcialmente)

| # | Ítem | Estado real | Bloqueante |
|---|------|-------------|------------|
| P1 | Cutover PostgreSQL primario (STORE_MODE=pg) | Dual-write ✅; flag de lecturas unificadas pendiente (F-09/F-10/F-11) | RLS tenant completo |
| P2 | RLS multi-tenant completo | 7 políticas en código; validación E2E multi-tenant pendiente | — |
| P3 | n8n activación UI + credenciales | Workflows en BD; toggle UI pendiente | UI n8n |
| P4 | Portal postMessage cross-module | 8 módulos SSO ✅; postMessage pendiente | — |
| P5 | Alertas Kibana | endpoint `/api/internal/alerts` ✅; reglas Kibana por crear | — |
| P6 | Meta WhatsApp API | Webhook listo; envío vía Twilio hasta migración | Credenciales Meta |
| P7 | Messenger/Email/TikTok tokens | Adapters en código; sin configurar | Tokens externos |

## C. Falta validar / verificar (documentado pero sin evidencia en vivo)

| # | Ítem | Qué falta |
|---|------|-----------|
| V1 | Unit tests helper (176/22 suites) | Re-ejecutar `npm test` en el estado actual (commit 8f4141e) |
| V2 | Endpoints Twenty CRM | Localizar rutas reales en código y probar sync |
| V3 | Multimodal (STT/visión/TTS) | Probar en runtime con OPENROUTER_STT_MODEL |
| V4 | Dashboards Kibana (traces+metrics+logs) | Validar visualización de los 3 datastreams |
| V5 | Load test k6 | Re-ejecutar tras cambios recientes |
| V6 | flujo inbound real completo | Twilio→helper→n8n→Dify→Twenty con evidencia actualizada |
| V7 | Broadcast multicanal | Probar con canal real (Telegram) |
| V8 | Backups + restauración | Ejecutar `backup.sh` y probar restore |
| V9 | Clúster ES (yellow→green) | Decidir réplicas single-node vs HA |

## D. Planeado sin implementar (documentado, sin código)

| # | Ítem | Fuente |
|---|------|--------|
| F1 | Planes de negocio + onboarding SaaS (F-53) | TEC-06 |
| F2 | Despliegue distribuido + piloto (F-54/F-56) | TEC-06 |
| F3 | Metabase/BI (F-52) | TEC-06 / nginx comentado |
| F4 | Frappe/ERP (F-28/F-29) | TEC-06 / nginx comentado |
| F5 | i18n dashboard, export PDF/CSV, push notifications, CRUD usuarios, dark mode | OBJETIVOS-PENDIENTES P3 |
| F6 | Hardening SECURITY-MASTER §14 (Fase 1-5: Let's Encrypt, contenedores no-root, ClamAV, EXIF, etc.) | SECURITY-MASTER |
| F7 | ~31 gaps abiertos G-13..G-45 | docs/GAPS-MINIFASES.md |
| F8 | Lumi Sales Copilot (Fase 3 ROADMAP) | ROADMAP.md |

## E. Deuda técnica / riesgos conocidos (documentados)

| # | Ítem | Prioridad |
|---|------|-----------|
| T1 | S1: HELPER_API_KEY literal en config (diferido a deploy) | Crítico (diferido) |
| T2 | S3: nginx.key + wibsite-store.json (PII) en historia git del repo local | Crítico (diferido; GitLab importado limpio) |
| T3 | otel-collector config con password (verificar si persiste tras S2) | Alto |
| T4 | body parser n8n REST (bug conocido) | Medio |

> Los ítems A-E se crean como Issues tipados en GitLab (board Kanban) para seguimiento; este documento es la referencia canónica de la brecha.