# Estándares de Gobernanza (GitLab)

> Implementado 2026-08-28 — **verificado vía API 2026-08-30** (re-auditoría de gobernanza).

## 1. Labels (48 creados — verificado 30/08)

| Grupo | Labels | Count |
|-------|--------|-------|
| type:: | feature · bug · task · spike · tech-debt · documentation · infra · security · incident · adr · **validation** | 11 |
| priority:: | critical · high · medium · low | 4 |
| area:: | backend · frontend · ai · messaging · infra · security · data · **agents · calendar · campaigns · consolidation · contacts · leads · responses · templates** | 15 |
| risk:: | low · medium · high | 3 |
| status:: | backlog · ready · in-progress · review · testing · ready-for-deploy · deployed · done · blocked · cancelled | 10 |
| roadmap:: | f1 · f2 · f3 · f4 · f5 | 5 |

Regla: labels estables — no crear arbitrariamente. `type::validation` se usa para funcionalidad ya implementada en código que requiere validar/exponer (ej. issue #94 línea base).

## 2. Board

- 1 board "Kanban" con 8 listas (backlog → done) + estados especiales (blocked/cancelled).

## 3. Milestones

- `SPRINT-YYYY-NN` (1-2 semanas). Actual: SPRINT-2026-17.
- **Oleadas 0-8** del roadmap (cada una con start/due date) + **Pospuestos** (dependencias externas).
- Nota 30/08: los issues transversales (V1-V8, P1-P8, T1-T3, F6, DOC-16, línea base #94) **no tienen milestone** — son deuda/validación fuera de oleadas.

## 4. Protección de ramas

- `main`: push = Maintainers, merge = Maintainers.
- `dev` (30/08): protegida (push = Maintainers, merge = Maintainers, sin force-push) — necesaria para inyectar las variables CI masked+protected.

## 5. CI/CD

- Stages: `test` → `validate_tevs`.
- Jobs (pipeline de prevalidación, verificado #58 SUCCESS en dev):
  - `helper-tests` (unit 83) — bloqueante en dev/main/MR.
  - `smoke-tests` (2) — bloqueante.
  - `flow-tests` (3) — bloqueante.
  - `validate_tevs` (TeVS 14) — en `dev` informativo (`allow_failure: true`); en `main` gate estricto.
- Runners: self-managed en red `wibsite_default` (jobs alcanzan ES/helper/nginx internos).
- Variables masked+protected: `ELASTIC_PASSWORD`, `HELPER_API_KEY` (solo se inyectan en ramas protegidas).
- Secretos nunca en `.gitlab-ci.yml` ni en el repo.

## 6. Registro histórico

- Commits con convención: `fix(scope):`, `feat(scope):`, `chore(scope):`, `docs(scope):`.
- Releases: Semantic Versioning (MAJOR.MINOR.PATCH) — pendiente de crear tags/releases (cada versión anterior queda respaldada por git history).
- **Backups**: cada commit/MR previo es un punto de restauración (git history); no se elimina historia.

## 7. Documentación

Estructura obligatoria (esta) — todo documento nuevo en su dominio:

```
docs/
├── product/      objetivos, estado real, brecha
├── architecture/ arquitectura verificada
├── adr/          decisiones
├── development/  metodología, estándares, pendientes
├── operations/   runbook, observabilidad
├── security/     estado de seguridad
└── agents/       agentes IA y MCP
```

- Índice unificado de brecha: `docs/INDEX-GAPS.md` (fuente canónica `development/03-PENDIENTES-Y-VALIDACION.md`).
- Maestro de funcionalidades: `docs/maestro/MAESTRO-FUNCIONALIDADES-CORE.md` (G1-G18, 68 entradas RAG).
- Los índices (`INDEX.md` raíz, `docs/INDEX.md`) reflejan el estado real 30/08: frontend unificado, hub eliminado.

## 8. Verificación estándar (TeVS)

- Suite `scripts/tevs/` (**14 tests**) contra Elasticsearch — gate en CI (10/14 en dev; 4 de entorno informativos: DR-001/002, SEC-001, UI-001).
- Resultados en índices `tevs-results-*`.
- E2E Playwright: suite `e2e/` (13 specs + frontend specs) — **por alcance** (solo modificaciones del cambio; no suite completa por consumo de recursos).
- e2e-trace: gate de trazabilidad (10/10).
- Validación profunda SOAC: **bajo demanda** (cruce estado real ↔ telemetría ES) para modificaciones grandes o análisis de bugs.

## 9. Entornos

- LOCAL (actual, Docker Compose) · DEV (rama `dev`, prevalidación) · STAGING · PRODUCTION (por definir en deploy — F-54).