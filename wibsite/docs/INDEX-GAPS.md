# Índice Unificado de Brecha (Gap) — Wibsite

> **Fuente única de la brecha** entre lo **implementado (código/runtime)** y lo **planeado/pendiente**.
> Principio rector: *el código y el runtime son la verdad*. Todo lo que la documentación promete y el código
> no confirma se registra aquí como PENDIENTE de implementar o validar.
> Última consolidación: 2026-08-29. Este índice sustituye la duplicación previa entre
> `03-BRECHA-PLANEACION-vs-CODIGO` y `03-PENDIENTES-Y-VALIDACION` (mismas tablas en dos archivos).

---

## 1. Cómo usar este índice (rutas de lectura)

| Necesitas | Lee |
|---|---|
| Estado real implementado (verificado contra código) | [product/02-ESTADO-REAL-VERIFICADO](../product/02-ESTADO-REAL-VERIFICADO.md) |
| Objetivos y metas del producto (con evidencia) | [product/01-OBJETIVOS-Y-METAS](../product/01-OBJETIVOS-Y-METAS.md) |
| La **brecha** (canónico): pendientes de validar, en proceso, planeado, deuda | [development/03-PENDIENTES-Y-VALIDACION](../development/03-PENDIENTES-Y-VALIDACION.md) |
| Reglas de gobernanza y convenciones | [development/02-ESTANDARES-GOBERNANZA](../development/02-ESTANDARES-GOBERNANZA.md) |
| Estado de seguridad (cerrado/abierto) | [security/01-ESTADO-SEGURIDAD](../security/01-ESTADO-SEGURIDAD.md) |

> **Regla de oro:** `development/03-PENDIENTES-Y-VALIDACION.md` es la **única fuente canónica** de la brecha.
> `product/03-BRECHA-PLANEACION-vs-CODIGO.md` queda como vista derivada (planeación vs código) y **no debe
> duplicar tablas**; se actualiza solo si cambia la interpretación planeación→código.

---

## 2. Resumen ejecutivo de la brecha (estado 2026-08-30)

### 2.1 Implementado (verificado en código) — maestro RAG-GX-YY
Catálogo completo en [`docs/maestro/MAESTRO-FUNCIONALIDADES-CORE.md`](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md).
Resumen de estado de las 68 funcionalidades RAG:

| Estado | Cantidad | % |
|---|---|---|
| ✅ Implementado | 33 | ~49% |
| 🟡 Parcial / activación pendiente | 9 | ~13% |
| ⚠️ Implementado con riesgo/deuda | 1 | ~2% |
| 🔴 Diseñado / no iniciado | 25 | ~37% |

### 2.2 Validaciones pendientes (evidencia en vivo faltante) — V1..V9

| ID | Ítem | Acción |
|---|---|---|
| V1 | Unit tests helper — **re-ejecutados 30/08** (24 suites, 83 tests unit en pipeline dev) | ✅ Cerrado parcial: pipeline #58 green |
| V2 | Localizar/probar endpoints Twenty CRM (404 `/api/twenty/health`) | SPIKE en código |
| V3 | Validar multimodal STT/visión/TTS en runtime | Configurar `OPENROUTER_STT_MODEL` |
| V4 | Validar dashboards Kibana (traces+metrics+logs) | Kibana :5601 |
| V5 | Re-ejecutar load test (k6 + simulador) | `scripts/load/` |
| V6 | Flujo inbound real con evidencia actualizada | Twilio/Telegram → grafo |
| V7 | Broadcast multicanal con canal real | Telegram bot |
| V8 | Backup + restauración probada | `backup.sh` |
| V9 | Clúster ES yellow→green (réplicas) | decisión HA |

### 2.3 En proceso (parcial) — P1..P8

| ID | Ítem | Bloqueante |
|---|---|---|
| P1 | Cutover PG primario (`STORE_MODE=pg`) lecturas unificadas | RLS tenant completo |
| P2 | Validación E2E multi-tenant (RLS) | — |
| P3 | n8n activación UI + credenciales | UI n8n :5679 |
| P4 | Portal postMessage cross-module | — |
| P5 | Alertas Kibana (reglas) | — |
| P6 | Migración Meta WhatsApp (webhook listo) | credenciales Meta |
| P7 | Tokens Messenger/Email/TikTok | tokens externos |
| P8 | Telegram real (validación envío) | bot test |

### 2.4 Planeado sin implementar — F1..F8

| ID | Ítem |
|---|---|
| F1 | Planes de negocio + onboarding SaaS (F-53) |
| F2 | Despliegue distribuido + piloto (F-54/F-56) |
| F3 | Metabase/BI (F-52) |
| F4 | Frappe/ERP (F-28/F-29) |
| F5 | i18n, export PDF/CSV, push, CRUD usuarios, dark mode |
| F6 | Hardening SECURITY-MASTER §14 (Let's Encrypt, no-root, ClamAV, EXIF…) |
| F7 | Gaps G-13..G-45 (~31) |
| F8 | Lumi Sales Copilot |

### 2.5 Deuda técnica / riesgos conocidos — T1..T4

| ID | Ítem | Prioridad |
|---|---|---|
| T1 | S1: `HELPER_API_KEY` literal en config local (diferido a deploy) | Crítico |
| T2 | S3: `nginx.key` + `wibsite-store.json` (PII) en historia del repo **local** | Crítico |
| T3 | `otel-collector` password en config (verificar tras S2) | Alto |
| T4 | body parser n8n REST | Medio |

> Nota de seguridad (29/08): en el repo GitLab la historia se importó limpia (baseline `dfda663`) y la rama
> `dev` nace de `a603c91`; los secretos T1/T2 están **fuera** de ambas historias de GitLab (solo existían en el
> repo local `origin`/GitHub, tratados en `.gitignore` y eliminados en el commit `d17b09c`).

---

## 3. Discrepancias doc vs código — cerradas por verificación (28/08 y 30/08)

| Ítem | Resolución |
|---|---|
| Telegram "sin token" | Código confirma `configured=true` → solo validación real pendiente (P8) |
| "~120-130 rutas" | **136 rutas** en `index.js` |
| TeVS 11/13 → 14/14 | **14 tests** (10/14 CI dev + 4 entorno informativos) — pipeline #58 |
| Twenty health 404 | Módulo reorganizado → V2 |
| "Hub central / Dashboard SPA" | **Hub eliminado** (d17b09c); frontend Next.js unificado — docs/índices corregidos 30/08 |
| "22 suites · 176 tests" | **24 suites** — TESTING-INDEX actualizado |
| "Labels 34" (02-ESTANDARES) | **48 labels reales** (15 area, 5 roadmap, 11 type) — actualizado 30/08 |
| Flujo "rama → main" (01-METODOLOGIA) | Flujo real **rama → dev → main** (prevalidación en dev) — actualizado 30/08 |

---

## 4. Actualización incremental (regla para cada tarea)

> **Checklist obligatorio por MR:** el template `.gitlab/merge_request_templates/default.md` aparece
> automáticamente en cada MR y exige marcar la validación de tests/E2E por alcance/TeVS/docs. Todo cambio
> (código, flujo, módulo, docs) DEBE pasar el checklist antes del merge.

1. **Antes** de implementar: registrar la funcionalidad como Issue en GitLab (board) con labels
   `status::ready` + `area::` + `priority::` + `type::`.
2. **Durante**: mover el Issue a `status::in-progress`.
3. **Transición a código**: una vez implementado y con la suite de pruebas enfocada en verde, mover a
   `status::testing`.
4. **Cierre**: si las verificaciones pasan (gate), marcar `status::done` y **actualizar**:
   - `docs/maestro/MAESTRO-FUNCIONALIDADES-CORE.md` (cambiar estado del RAG-GX-YY,
     agregar si viene de `🔴` nuevo).
   - `docs/development/03-PENDIENTES-Y-VALIDACION.md` (bajar del bloque pendiente → cerrado).
   - `docs/TESTING-INDEX.md` (conteos de tests si cambian).
   - `docs/CHANGELOG.md` (fecha + alcance).
   - Este `INDEX-GAPS.md` (resumen ejecutivo).
5. **Tests por alcance** (regla de consumo de recursos): E2E Playwright y validación profunda SOAC se
   ejecutan **solo sobre las modificaciones del cambio** (o bajo demanda para bugs/cambios grandes),
   nunca la suite completa en cada push.
6. **No avanzar** si las verificaciones fallan (regla de oro; el pipeline `dev`→`main` solo debe aceptar
   verde).

> Cada ítem V/P/F/T tiene su Issue tipado en GitLab; este índice es la referencia canónica de la brecha.
