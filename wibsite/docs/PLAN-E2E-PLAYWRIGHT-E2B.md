# Plan Final — E2E de UI con Playwright + Sandbox E2B (OpenSandbox)

> **Fecha:** 15/08/2026 · **Estado:** PLAN (pendiente de aprobación e implementación)
> **Objetivo:** reforzar las pruebas E2E, simulaciones de usuario y verificación/monitoreo del proyecto, añadiendo una capa de UI real (Playwright) y ejecución aislada/reproducible (E2B), integrada al estándar SOAC.

---

## 0. Herramientas instaladas (globales, listas para usar con cualquier proyecto)

| Utilidad | Versión | Instalación | Disponible para opencode |
|----------|---------|-------------|--------------------------|
| `@playwright/mcp` | 0.0.79 | `npm i -g @playwright/mcp` | ✅ servidor MCP `playwright` en `~/.config/opencode/opencode.jsonc` |
| `@e2b/cli` | 2.16.1 | `npm i -g @e2b/cli` | ✅ binario `e2b` + skill `e2b-sandbox` |

Skills globales creadas:
- `ui-e2e-testing` → guía al agente a usar el navegador real (navigate/snapshot/click/console/network/screenshot) para validar y depurar interfaces.
- `e2b-sandbox` → guía para ejecutar suites/builds/E2E en microVM efímera.

> ⚠️ Pendiente del usuario: autenticar E2B (`e2b auth login` o `E2B_API_KEY`) — no se inventa la key. Playwright MCP requiere **reiniciar opencode** para que cargue el nuevo MCP.

---

## 1. Objetivo y alcance

Cerrar el faltante principal detectado en la auditoría (15/08): **cero validación de interfaz real** (todo el testing actual es API/Jest/TeVS). Añadir:

1. **Suite Playwright de UI** (`e2e/`) — flujos críticos del portal/hub/módulos SSO + consolas de n8n/Chatwoot/Dify.
2. **Simulación de usuario** (login Authelia, navegación de microfrontends, formularios, chat).
3. **Verificación visual** (screenshots por módulo) + **artefactos** (traces/videos) → MinIO.
4. **Integración SOAC**: reporter → audit `e2e_ui` → ES + alertas Kibana + TeVS `TEST-UI-001`.
5. **k6 browser** (load de rutas de usuario, F-51 ampliado).
6. **E2B** para corridas aisladas en CI/commits.

---

## 2. Arquitectura objetivo

```
┌───────────── SOAC (ES + PG + TeVS + e2e-trace) ─────────────┐
│  event "e2e_ui" {spec, result, duration, trace_url,          │
│                  video_url, console_errors[], network_4xx[]} │
│  Kibana dashboard "UI E2E" · alerta fail en specs críticos   │
└──────────────▲──────────────────────────────────┬────────────┘
               │ reporter → /api/internal/ui-results│
               │                                    │
  CI/Dev ─► OpenSandbox (E2B, efímero) ──► Playwright ──► https://localhost:8080 (gateway)
            │ · npm ci + npx playwright install      │          │ Authelia login
            │ · Jest + TeVS + k6 + Playwright        ▼          ▼
            └ artifacts → MinIO (bucket e2e-artifacts, TTL 7d)  portal/modules
```

---

## 3. Fases de implementación

### Fase A — Suite Playwright de UI (crítico, ~medio día)

**A1. Setup** (nuevo, no toca el helper):
- Carpeta `wibsite/e2e/` + `playwright.config.ts`:
  - `baseURL: https://localhost:8080` (o variable de entorno `WIBSITE_BASE_URL`)
  - `use: { trace: 'retain-on-failure', video: 'retain-on-failure', screenshot: 'only-on-failure', ignoreHTTPSErrors: true }`
  - projects: chromium (desktop), firefox (opcional), webkit (opcional)
- `package.json` (raíz wibsite o e2e/): devDependency `@playwright/test`.

**A2. Specs críticos** (`e2e/specs/`):
1. `portal.spec.ts` — login Authelia (usuario `admin@wibsite.com` + password documentada) → `/hub/` muestra SLI/dependencias reales; navegar los 8 módulos del portal shell (`/portal/`) y verificar que cada iframe carga (título/estado).
2. `search.spec.ts` — Ctrl+K → búsqueda `/api/search` → Lead Panel se abre y muestra perfil.
3. `chat.spec.ts` — vía Chatwoot widget o un cliente de chat: enviar mensaje → verificar respuesta del agente (cuestionario/cotización/RAG).
4. `n8n.spec.ts` — login n8n (credenciales ya reseteadas) → verificar 2/3 workflows activos y el estado del 3º → **esto desbloquea F4 de forma automatizable**.
5. `monitoring.spec.ts` — `/hub/control-center.html` → dependencia Elasticsearch (SOAC) verde, alertas, dashboard.

**A3. Reporter SOAC** (`e2e/reporter.ts`):
- En `onTestEnd`, POST a `/api/internal/ui-results` (helper) con API key → el helper emite `logEvent('e2e_ui', {...})` → audit PG + ES.
- En `onEnd`, subir artefactos a MinIO (SDK minio) y registrar URLs en el evento.

**A4. Gate CI** (extiende `tevs-validation.yml` o nuevo job):
- Job `ui-e2e` (runner con infra): `docker compose up -d` → `npx playwright install --with-deps` → `npx playwright test` → subir report/trace como artefacto del workflow.

### Fase B — Control y monitoreo SOAC (~medio día)

- **B1. Endpoint helper** `POST /api/internal/ui-results` (auth con API key): valida payload, genera `trace_id`/`span_id`, escribe `audit_logs` (`event_type='e2e_ui'`) y lo emite a ES logs vía `otelBridge.sendLog`.
- **B2. TeVS +1 test** `TEST-UI-001-ui-e2e.ps1`: ejecuta el runner de Playwright y valida en ES que existan eventos `e2e_ui` de la corrida con resultado correcto.
- **B3. Métrica prom-client**: contador `ui_e2e_total{spec,result}`.
- **B4. Kibana**: Data view + dashboard "UI E2E" (tasa de paso por spec, tendencia, latencias) + regla de alerta `e2e_ui.result=failed` en specs críticos.

### Fase C — Load de usuario (k6 browser) (~medio día)

- `scripts/load/k6-browser-scenario.js` (k6 browser): login → portal → búsqueda → chat → reply; umbrales p95 < 2500ms UI, error < 5%.
- Complementa `k6-scenario.js` (API) existente.

### Fase D — E2B / CI aislado (1 día, opcional)

- Job de GitHub Actions con E2B (o contenedor) que ejecuta la matriz completa: `npm ci` + Jest + TeVS + k6 + Playwright en microVM efímera por commit.
- Modo agente local: correr la suite en sandbox sin contaminar (skill `e2b-sandbox`).

---

## 4. Integración con el estándar SOAC (quién→qué→cómo→módulo→proceso)

| Evento SOAC | Módulo | Flujo | Acción |
|-------------|--------|-------|--------|
| `e2e_ui` (nuevo) | ui-e2e | e2e.playwright | test.started / test.finished |
| `error` (existente) | ui-e2e | e2e.playwright | test.failed |
| span `ui.e2e` (nuevo en otelBridge) | ui-e2e | e2e.run | por corrida con spec/result/duration |
| métrica `ui_e2e_total` | ui-e2e | e2e.run | contador |
| alerta Kibana | ui-e2e | e2e.run | fail en specs críticos |

Todo con `trace_id`/`span_id` correlacionados y artefactos enlazados (MinIO) para debug.

---

## 5. Pruebas y validación del plan (simulacro)

1. **Unit/integration**: Jest 176/176 sigue verde (no se toca el helper salvo el endpoint nuevo + test de `ui-results`).
2. **E2E UI**: correr la suite contra el stack local; criterio de aceptación: 5/5 specs pasan con login Authelia real.
3. **SOAC**: verificar en ES que aparecen eventos `e2e_ui` con trace/span; TeVS 13→14 PASSED; e2e-trace 10/10.
4. **Load**: k6 browser + API con umbrales.
5. **E2B**: corrida completa en sandbox efímero (si el usuario autentica la key).

---

## 6. Dependencias y riesgos

| Riesgo | Mitigación |
|--------|------------|
| Login SSO/2FA en Authelia | Usuario de pruebas sin TOTP o inyección de cookie de sesión vía API |
| Iframes cross-origin (Dify/n8n/Kibana) | Frame locators; validar también por URL directa SSO |
| Estabilidad de selectores en SPAs pesadas | Smoke crítico + retries (2) al inicio, no regresión visual exhaustiva |
| Navegadores en CI | `npx playwright install --with-deps` o imagen `mcr.microsoft.com/playwright` |
| E2B requiere API key | `e2b auth login` del usuario; alternativa: job en contenedor |
| Puerto/dominio del gateway (localhost:8080 HTTPS) | `ignoreHTTPSErrors` + certificado de dev |

---

## 7. Orden de ejecución recomendado

1. ✅ (hecho) Instalar `@playwright/mcp` + `@e2b/cli` globales + config MCP global + skills.
2. Fase A: setup `e2e/` + 5 specs + reporter + gate CI.
3. Fase B: endpoint `ui-results` + TEST-UI-001 + métrica + dashboard/alertas Kibana.
4. Fase C: k6 browser.
5. Fase D: E2B en CI (tras `e2b auth login`).
6. Cierre: correr la matriz completa y documentar en `tevs-results-*` + CHANGELOG 3.5.0.

> **Nota:** requiere reiniciar opencode para activar el MCP `playwright` (config global ya escrita).
