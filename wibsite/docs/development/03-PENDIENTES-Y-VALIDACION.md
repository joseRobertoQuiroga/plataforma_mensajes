# Pendientes y Validación

> **Fuente canónica de la brecha** entre lo **implementado (código)** y lo **planeado/pendiente**.
> Actualizado 2026-08-28. Cada ítem tiene su Issue tipado en GitLab (board Kanban).
>
> 📌 Punto de entrada consolidado: [`../INDEX-GAPS.md`](../INDEX-GAPS.md) (índice unificado de brecha).

## A. Validaciones pendientes (evidencia en vivo faltante)

| Issue | Ítem | Acción |
|-------|------|--------|
| #V1 | Unit tests helper — **re-ejecutados 30/08** (24 suites; 83 tests unit en pipeline dev #58) | ✅ Cerrado parcial: `cd helper-node && npm run test:unit` |
| #V2 | Localizar y probar endpoints Twenty CRM (404 en `/api/twenty/health`) | SPIKE en código |
| #V3 | Validar multimodal STT/visión/TTS en runtime | Configurar OPENROUTER_STT_MODEL |
| #V4 | Validar dashboards Kibana (traces+metrics+logs) | Kibana :5601 |
| #V5 | Re-ejecutar load test (k6 + simulador) | scripts/load/ |
| #V6 | Flujo inbound real con evidencia actualizada | Twilio/Telegram → grafo |
| #V7 | Broadcast multicanal con canal real | Telegram bot |
| #V8 | Backup + restauración probada | backup.sh |
| #V9 | Clúster ES yellow→green (réplicas) | decisión HA |

## B. En proceso (parcial)

| Issue | Ítem | Bloqueante |
|-------|------|------------|
| #P1 | Cutover PG primario (`STORE_MODE=pg`) lecturas unificadas | RLS tenant completo |
| #P2 | Validación E2E multi-tenant (RLS) | — |
| #P3 | n8n activación UI + credenciales | UI n8n :5679 |
| #P4 | Portal postMessage cross-module | — |
| #P5 | Alertas Kibana (reglas) | — |
| #P6 | Migración Meta WhatsApp (webhook listo) | credenciales Meta |
| #P7 | Tokens Messenger/Email/TikTok | tokens externos |
| #P8 | Telegram real (validación envío) | bot test |

## C. Planeado sin implementar

| Issue | Ítem |
|-------|------|
| #F1 | Planes de negocio + onboarding SaaS (F-53) |
| #F2 | Despliegue distribuido + piloto (F-54/F-56) |
| #F3 | Metabase/BI (F-52) |
| #F4 | Frappe/ERP (F-28/F-29) |
| #F5 | i18n, export PDF/CSV, push, CRUD usuarios, dark mode |
| #F6 | Hardening SECURITY-MASTER §14 (Let's Encrypt, no-root, ClamAV, EXIF…) |
| #F7 | Gaps G-13..G-45 (~31) |
| #F8 | Lumi Sales Copilot |

## D. Deuda técnica / riesgos

| Issue | Ítem | Prioridad |
|-------|------|-----------|
| #T1 | S1: HELPER_API_KEY literal (diferido a deploy) | Crítico |
| #T2 | S3: nginx.key + wibsite-store.json (PII) en historia git local | Crítico |
| #T3 | otel-collector password en config | Alto |
| #T4 | body parser n8n REST | Medio |

## E. Discrepancias doc vs código (cerradas por verificación)

| Ítem | Resolución |
|------|------------|
| Telegram "sin token" | **Código confirma configured=true** → solo validación real pendiente (#P8) |
| "~120-130 rutas" | **153 rutas** en index.js (123 únicas, 31/08) |
| TeVS 11/13 → 14/14 | Pipeline #23 es la verdad |
| Twenty health 404 | Módulo reorganizado → #V2 |