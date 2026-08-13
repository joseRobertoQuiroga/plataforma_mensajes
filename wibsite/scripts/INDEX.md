# Índice y Catálogo Completo de Scripts del Sistema

Este directorio contiene la suite completa de automatización, pruebas de conectividad, auditorías del sistema, simulaciones con datos mockup, monitoreo de observabilidad e integración de agentes de la plataforma Wibsite.

---

## 🗂️ Estructura de Directorios

```
scripts/
├── INDEX.md                           # Este índice y catálogo general
├── AUDIT_SUITE_GUIDE.md               # Manual detallado de auditorías y diagnósticos
├── audit-all.js                       # Runner Maestro de Auditoría y Simulaciones (13 Módulos / 78+ Pruebas)
├── audit-all.ps1                      # Runner Maestro para PowerShell (Windows)
├── utils/
│   └── logger.js                      # Sistema de Logging estructurado y persistente en archivo
├── logs/
│   ├── audit.log                      # Registro histórico de auditorías (última: 2026-08-03, 78 pruebas OK)
│   └── simulation.log                 # Registro de ejecuciones de simulaciones con datos mockup
├── audit/
│   ├── 01-check-containers.js         # Auditoría 1: Salud y Estado de los 20 Contenedores Docker
│   ├── 02-test-connectivity.js        # Auditoría 2: Conectividad HTTP/HTTPS Nginx (:8080) - 8 Endpoints
│   ├── 03-test-oidc-sso.js            # Auditoría 3: SSO Unificado & Authelia OIDC Discovery
│   ├── 04-test-multi-tenant-rls.js    # Auditoría 4: PostgreSQL 15 RLS & Aislamiento Multi-Tenant
│   ├── 05-check-helper-api.js         # Auditoría 5: Helper-Node API, DB app_user & TenantContext
│   ├── 06-check-observability.js      # Auditoría 6: Observabilidad, Elastic Stack (ES/Kibana/OTel)
│   ├── 07-check-database-health.js    # Auditoría 7: Salud de 7 DBs Postgres, Redis 7 & Weaviate Vector DB
│   ├── 08-check-background-workers.js # Auditoría 8: Trabajadores Asíncronos (Sidekiq, Celery, Workers)
│   ├── 09-check-security-and-pii.js   # Auditoría 9: Auditoría de Eventos, Sanitización PII & RateLimiter
│   └── 10-check-channel-and-campaign-health.js # Auditoría 10: Salud de Canales, Campañas & Lead Scoring
├── simulations/
│   ├── 01-simulate-inbound-flow.js    # Simulación 1: Flujo Entrante (Inbound WhatsApp / AI / CRM)
│   ├── 02-simulate-broadcast-flow.js  # Simulación 2: Flujo Saliente (Outbound Campaign Broadcast)
│   └── 03-analyze-agent-conversations.js # Simulación 3: Grafo de Agentes IA (LangGraph / AgentCore)
├── tevs/                              # Suite TeVS — validación contra Elasticsearch (ver docs/04_*.md)
│   ├── tevs-runner.ps1                # Runner principal (execution-timeouts, exit codes 0-5)
│   ├── tests/                         # 11 tests: TEST-OBS-001, TEST-SEC-001/002, TEST-DEV-001/002/003,
│   │                                  #          TEST-DATA-001, TEST-CORR-001, TEST-AGENT-001, TEST-DR-001/002
│   ├── setup-tevs-index.ps1           # Crea índice + ILM (retention)
│   ├── setup-ilm-policy.ps1           # Política ILM de retención
│   ├── setup-tevs-alerts.ps1          # Instala alertas TeVS
│   └── tevs-dashboard.ndjson          # Dashboard Kibana importable
└── verify/
    └── verify-connectivity.js         # Comprobador rápido de conectividad externa Nginx
```

> ⚠️ La suite TeVS está **creada pero nunca ejecutada** (Docker Desktop estuvo detenido el 2026-08-12). Primera ejecución pendiente: ver `Avances/PROCEDIMIENTOS.md` §9.

---

## 🚀 Guía de Ejecución Rápida

### 1. Auditoría Completa y Simulaciones (Script Maestro)
Para ejecutar las **75+ comprobaciones** completas de la plataforma:
```bash
node scripts/audit-all.js
```
O en PowerShell:
```powershell
.\scripts\audit-all.ps1
```

### 2. Módulos de Auditoría Específicos
- **Salud de Bases de Datos & Redis:** `node scripts/audit/07-check-database-health.js`
- **Trabajadores Asíncronos (Workers):** `node scripts/audit/08-check-background-workers.js`
- **Seguridad & Filtrado PII:** `node scripts/audit/09-check-security-and-pii.js`
- **Canales de Comunicación & Campañas:** `node scripts/audit/10-check-channel-and-campaign-health.js`

### 3. Simulaciones con Datos Mockup
- **Flujo Entrante (Inbound WhatsApp / AI / CRM):** `node scripts/simulations/01-simulate-inbound-flow.js`
- **Flujo Saliente (Broadcast Campaign):** `node scripts/simulations/02-simulate-broadcast-flow.js`
- **Análisis de Agente IA & LangGraph State Machine:** `node scripts/simulations/03-analyze-agent-conversations.js`

---

## 📊 Módulos de Monitoreo y Observabilidad

| Servicio | Puerto / URL | Función en el Sistema |
|---|---|---|
| **Elasticsearch** | `:9200` / `http://localhost:9200` | Almacén de trazas y logs OTLP (índices `*-doags.otel-production`) |
| **Kibana** | `:5601` / `http://localhost:5601` (también `/kibana/` vía nginx) | Visualización de trazas, logs y dashboards |
| **OTel Collector** | `:4317` gRPC / `:4318` HTTP | Recepción OTLP y export a Elasticsearch |
| **MinIO** | `:9000` API / `:9001` consola | Object storage |
| **Helper-Node Prometheus Metrics** | `:3100/metrics` | Métricas de duraciones de requests y llamadas al modelo LLM |

> **Nota:** Prometheus, Grafana, cAdvisor y GlitchTip **fueron retirados** de `docker-compose.yml`; sustituidos por Elastic Stack (ES + Kibana + OTel Collector). `monitoring/` queda como esqueleto heredado.

---

## 📝 Sistema de Logging Persistente (`scripts/logs/`)

Todos los scripts utilizan la librería unificada `scripts/utils/logger.js`.
Cada ejecución registra eventos con sello de tiempo ISO y nivel de gravedad (`INFO`, `WARN`, `ERROR`, `SUCCESS`):
- **`scripts/logs/audit.log`**: Almacena el historial de diagnósticos de contenedores, conectividad, OIDC, RLS, bases de datos, workers y seguridad.
- **`scripts/logs/simulation.log`**: Almacena los pasos y respuestas obtenidas durante la ejecución de las simulaciones con datos mockup.
