# Estándares de Gobernanza (GitLab)

> Implementado 2026-08-28 — verificado vía API.

## 1. Labels (34 creados)

| Grupo | Labels |
|-------|--------|
| type:: | feature · bug · task · spike · tech-debt · documentation · infra · security · incident · adr |
| priority:: | critical · high · medium · low |
| area:: | backend · frontend · ai · messaging · infra · security · data |
| risk:: | low · medium · high |
| status:: | backlog · ready · in-progress · review · testing · ready-for-deploy · deployed · done · blocked · cancelled |

Regla: labels estables — no crear arbitrariamente.

## 2. Board

- 1 board "Kanban" con 8 listas (backlog → done) + estados especiales (blocked/cancelled).

## 3. Milestones

- `SPRINT-YYYY-NN` (1-2 semanas). Actual: SPRINT-2026-17.

## 4. Protección de ramas

- `main`: push = Maintainers, merge = Maintainers.

## 5. CI/CD

- Stages: `test` (helper-tests) → `validate_tevs` (gate).
- Runners: self-managed en red `wibsite_default` (jobs alcanzan ES/helper/nginx internos).
- Variables masked+protected: `ELASTIC_PASSWORD`, `HELPER_API_KEY`.
- Secretos nunca en `.gitlab-ci.yml` ni en el repo.

## 6. Registro histórico

- Commits con convención: `fix(scope):`, `feat(scope):`, `chore(scope):`, `docs(scope):` (historia actual en main).
- Releases: Semantic Versioning (MAJOR.MINOR.PATCH) — pendiente de crear tags/releases.

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

## 8. Verificación estándar (TeVS)

- Suite `scripts/tevs/` (14 tests) contra Elasticsearch — gate en CI.
- Resultados en índices `tevs-results-*`.
- E2E Playwright: suite `e2e/` (141 tests) — evidencia por commit.
- e2e-trace: gate de trazabilidad (10/10).

## 9. Entornos

- LOCAL (actual, Docker Compose) · DEV · STAGING · PRODUCTION (por definir en deploy — F-54).