# GITLAB-ISSUE-WORKFLOW — Gestión de Issues desde los Roadmaps MD

> **Tipo:** Procedimiento estándar + Lecciones aprendidas | **Fecha:** 27/08/2026
> **Alcance:** flujo completo de planificación → carga → verificación de tareas en GitLab, partiendo de los roadmaps del repositorio.
> **Fuentes:** `ROADMAP-ITERATIVO-NUEVAS-FUNCIONALIDADES.md` · `ROADMAP-IMPLEMENTACION-MEJORAS-SELECCIONADAS.md` · `docs/ANALISIS-CRUZADO-ERP-CRM-2026-08-26.md`

---

## 1. Propósito

Convertir la planificación en `.md` en **tareas gestionables en GitLab** (milestones + labels + issues) con un estándar fijo de contenido (contexto, alcance, relaciones, verificación), para gestionar el avance, la priorización y la proyección del proyecto de forma profesional y repetible en futuras iteraciones.

## 2. Acceso y credenciales

| Dato | Valor | Fuente |
|---|---|---|
| URL GitLab | `http://gitlab.local:9080` (host: `http://localhost:9080`) | `infrastructure/gitlab/docker-compose.yml:20` |
| API REST | `http://127.0.0.1:9080/api/v4` | — |
| SSH (git) | `localhost:9022` | compose `:17` |
| Proyecto | `sales-ai-platform/wibsite` (id=1) | — |
| Usuario administrador | `root` (admin) | API `/user` |
| Token Personal (PAT) | en el remote git: `git config --get remote.gitlab.url` (formato `oauth2:glpat-…`) — **verificado vigente** | `.git/config` |
| Contraseña root | ⚠️ la del compose (`initial_root_password`) **ya NO es válida** (401): solo aplica al primer arranque. | ver §8 |

**Nota KeePass:** no hay base `.kdbx` localizada en el workspace; las credenciales vivas del proyecto están en `docs/rag/CREDENTIALS-REFERENCE.md`, `.env` y el resumen de `scripts/start-wibsite.ps1` (§5 del script). Si la contraseña root se desconoce, resetearla con:
`docker exec -it gitlab-ce gitlab-rake "gitlab:password:reset[root]"` y actualizar `.env` (`GITLAB_ROOT_PASSWORD`).

## 3. Arquitectura: GitLab dentro del ecosistema

- **Stack separado:** `infrastructure/gitlab/docker-compose.yml` (proyecto compose `gitlab`): `gitlab-ce` + `gitlab-runner`. Puertos elegidos sin colisión con el stack wibsite (9080/9443/9022).
- **Integración con el arranque del ecosistema:** `scripts/start-wibsite.ps1` ya levanta TODO:
  1. Stack principal (`docker compose up -d --build`) — línea 347
  2. GitLab: `Start-GitLabStack` (línea 226) → `docker compose -f infrastructure\gitlab\docker-compose.yml up -d`
  3. `Sync-GitLabNetwork` (línea 242): conecta `gitlab-ce` a la red `wibsite_default` (alias `gitlab`)
  4. `Sync-RunnerExtraHosts` (línea 263): actualiza `gitlab.local → IP` en el runner si la IP cambió
  5. `Test-GitLabHealth` (línea 293): espera healthcheck (máx 10 min)
  6. Verificación de puertos incluye 9080/9443/9022 (línea 76); monitoreo en vivo incluye GitLab (línea 499)
- **CI:** el runner usa `network_mode=wibsite_default` para alcanzar elasticsearch/postgres/redis del stack wibsite (necesario para la suite TeVS). `.gitlab-ci.yml` define los jobs.

## 4. Monitoreo del ecosistema: sistema SOAC

- El sistema **SOAC** (Sistema de Observabilidad, Alertas y Control) está **integrado en el compose principal** (`docker-compose.yml`): `elasticsearch` (:406), `kibana` (:429), `otel-collector` (:451); los servicios del stack emiten OTLP hacia `otel-collector:4318`.
- **El script de arranque `scripts/start-wibsite.ps1` lo levanta y lo valida:**
  - Paso 2: `docker compose up -d --build` levanta los 3 contenedores SOAC con el resto del stack.
  - Paso 3 (espera de salud, líneas 371-388): valida **Elasticsearch** (`/_cluster/health` con credenciales `elastic` de `.env`; se considera OK si `status -ne "red"`) junto con el helper.
  - Paso 8 (monitoreo en vivo): consulta ES cada 10s.
  - Resumen: URLs de Kibana (gateway SSO `/kibana/`), ES (:9200), OTel (:4318) y TeVS.
- **Validación profunda: suite TeVS** (`scripts/tevs/tevs-runner.ps1`, 14 tests). Se ejecuta en CI: job `validate_tevs` de `.gitlab-ci.yml` (runner en la red `wibsite_default` → alcanza `elasticsearch:9200`), o manualmente. El script de arranque la ejecuta automáticamente en el paso 3c (requiere `pwsh`/PowerShell 7; si no está instalado avisa y continúa; flag `-SkipTeVS` para omitirla).
- **Verificado en vivo (27/08/2026):** `wibsite-elasticsearch`, `wibsite-kibana` y `wibsite-otel-collector` **Up**; ES `_cluster/health` = `yellow` (normal en nodo único, 97 shards; no bloquea el arranque); Kibana responde 302 en `http://localhost:5601/kibana/app/home` y vía gateway SSO `https://localhost:8080/kibana/` (basePath `/kibana`).
- Acceso: `https://localhost:8080/kibana/` (SSO Authelia). Credenciales ES: `elastic` / `ELASTIC_PASSWORD` de `.env`.
- **NO existe SWAG** (linuxserver/swag) en el proyecto: el gateway es `nginx + Authelia`. No confundir con SOAC.

## 5. Taxonomía en GitLab

### 5.1 Labels (respetan la taxonomía existente del proyecto)
| Grupo | Labels | Uso |
|---|---|---|
| Área | `area::campaigns` `area::contacts` `area::leads` `area::responses` `area::agents` `area::calendar` `area::templates` `area::consolidation` (+ las preexistentes `area::data` `area::frontend` `area::backend`…) | dominio funcional del issue |
| Prioridad | `priority::critical` (P0) · `priority::high` (P1) · `priority::medium` (P2) · `priority::low` (P3) | ya existentes; mapeo directo P0–P3 |
| Estado | `status::backlog` · `status::blocked` · `status::ready` | bloqueado = pospuesto con motivo; ready = ya implementado, validar |
| Tipo | `type::feature` · `type::task` · `type::documentation` · **`type::validation`** (nueva) | validation = ya existe en código, no desarrollar |
| Roadmap | `roadmap::f1` … `roadmap::f5` (nuevas) | trazan la idea de usuario F1–F5 |

### 5.2 Milestones (por oleada, con fechas de proyección)
`Oleada 0 - Cimientos de datos` → `Oleada 8 - Consolidación (F5)` + `Pospuestos - Dependencias externas` (sin fechas).
Cada issue pertenece a exactamente 1 milestone; la relación con F1–F5 se lleva con labels `roadmap::fN`.

### 5.3 Prefijos de título
`[FEATURE]` implementar/completar · `[VALIDATION]` ya implementado (validar y exponer) · `[TASK]` técnico/deuda · `[VERIFICATION]` gate de cierre de oleada · `[DOC]` documentación. Formato: `[PREFIJO] ID - Título` (ej. `[FEATURE] F1 - Ciclo de vida del lead con etapas claras (idea de usuario)`).

## 6. Plantilla estándar de issue (7 secciones)

```markdown
## Contexto
<qué es, por qué, estado actual en código en 1-2 frases>

## Alcance
- <acciones concretas, bullet por entregable>

## Relaciones
- Depende de: <IDs>
- Desbloquea: <IDs>
- Origen: <idea de usuario F# / investigación ID (P#) / gate de oleada>
- Oleada: <milestone>

## Implementación objetivo
- <archivo:línea> (ej. helper-node/index.js (leads :1384-1488))

## Verificación (DoD)
- [ ] <test unitario Jest (archivo.test.js)>
- [ ] <e2e Playwright (spec)>
- [ ] <traza en audit_logs / migración / doc actualizada>

## Referencias
- <MD + sección> · <ANALISIS-CRUZADO §9.x ID> · <issue GitLab #N>

## KPI
<indicador medible>
```
**Regla:** todo issue debe poder validarse sin ambigüedad solo con su DoD.

## 7. Herramienta de carga: `scripts/gitlab/gitlab-upsert-issues.ps1`

- Script reutilizable que **actualiza (PUT)** o **crea (POST)** labels, milestones e issues vía API de GitLab.
- Token: se toma del remote (`git config --get remote.gitlab.url`); no se hardcodea.
- Mapeo issue→iid por **orden de llamadas `Add-Issue`**: para actualizar, ejecutar con el mismo orden; para crear issues nuevos, añadir llamadas al final (o borrar antes los issues y volver a cargar).
- Ejecución (desde la raíz `wibsite`):
```powershell
$c = [IO.File]::ReadAllText('.\scripts\gitlab\gitlab-upsert-issues.ps1', [Text.Encoding]::UTF8); Invoke-Expression $c
```
- Salida esperada: `OK #iid [PREFIJO] ID - Título` para cada issue (HTTP 2xx).

## 8. Lección aprendida (CRÍTICA): codificación en PowerShell 5.1

**Síntoma:** títulos/descripciones llegaban a GitLab como mojibake (`Campañas` → `CampaÃ±as`).

**Causa raíz:** `Invoke-RestMethod` de PowerShell 5.1 corrompe el body cuando contiene caracteres no-ASCII (los bytes UTF-8 se re-interpretan como Latin-1). Ocurre tanto con `-Body byte[]` como con strings.

**Solución aplicada (y usada por el script):**
1. Serializar el JSON convirtiendo todo carácter > 0x7E a escape `\uXXXX` (body 100% ASCII).
2. Escribirlo a archivo temporal con `WriteAllText(..., UTF8)`.
3. Enviar con **`curl.exe -X PUT -H "Content-Type: application/json" --data-binary @archivo`** (bytes exactos, sin capas intermedias).

**Verificación obligatoria post-carga:** leer 2-3 recursos de vuelta con `curl -o archivo.json` y revisar el archivo (no la consola, que también falsea la codificación). Los acentos deben verse correctos.

## 9. Flujo para futuras iteraciones

1. **Planear:** actualizar/crear el roadmap en `.md` (registro de iteraciones al final del documento).
2. **Traducir:** por cada ítem nuevo, definir prefijo, ID, labels (área/prioridad/estado/tipo/roadmap), milestone y las 7 secciones de la plantilla.
3. **Cargar:** añadir el bloque `Add-Issue` al script `gitlab-upsert-issues.ps1` y ejecutarlo (PUT actualiza los existentes por orden; POST crea los nuevos si se mueve el mapeo).
4. **Verificar:** chequeo de acentos vía archivo (no consola), conteo de issues por milestone (`GET /projects/1/issues?milestone=<id>`), y muestreo de 3 issues.
5. **Ejecutar:** mover issues a `status::in-progress` conforme se trabajan; cerrar los `[VERIFICATION]` de oleada solo cuando TODOS sus DoD estén en verde (regla de oro del proyecto).
6. **Cerrar ciclo:** actualizar `Avances/`, `TEC-02/TEC-06`, `MAESTRO-FUNCIONALIDADES-CORE.md` (cubierto por issue `[DOC] DOC-FINAL`).

## 10. Estado de la carga actual (27/08/2026)

| Recurso | Cantidad | Detalle |
|---|---|---|
| Milestones | 10 | Oleada 0–8 (con fechas ago–dic 2026) + Pospuestos |
| Labels nuevas | 14 | 8 `area::`, 1 `type::validation`, 5 `roadmap::fN` |
| Issues creados | 77 | #17–#93: 62 mejoras + 5 ideas F1–F5 + 9 gates + 1 DOC + 3 pospuestos (`status::blocked`) |
| Issues preexistentes | 16 | #1–#16 (no tocados; D1 referencia #5) |
| Verificación | ✅ | Acentos correctos verificados por lectura de archivo (milestone "Campañas inteligentes", issue F1 completo) |

---
*Documento generado el 27/08/2026 tras la primera carga completa y el incidente de codificación resuelto.*
