# Metodología Operativa

> Implementada en GitLab el 2026-08-28. Modelo: **AI-Native Agile + DevSecOps** (Kanban + sprints ligeros + trunk-based + MR obligatorio + CI gates + ADR).

## 1. Flujo de trabajo

```
Issue (type::* + status::*) → Rama corta → Commits → MR → CI prevalidación (dev)
→ Revisión → Merge a dev (protegida, prevalidación automática) → Integración → 
Merge a main (protegida, gate estricto) → Observabilidad (ES) → Feedback → Issue
```

## 2. Tablero Kanban (GitLab Board)

| Columna | Label | WIP |
|---------|-------|-----|
| BACKLOG | `status::backlog` | — |
| READY | `status::ready` | — |
| IN PROGRESS | `status::in-progress` | máx 2 |
| REVIEW | `status::review` | máx 2 |
| TESTING | `status::testing` | máx 2 |
| READY FOR DEPLOY | `status::ready-for-deploy` | — |
| DEPLOYED | `status::deployed` | — |
| DONE | `status::done` | — |
| (fuera de flujo) | `status::blocked` / `status::cancelled` | — |

## 3. Tipos de issue (10 templates en `.gitlab/issue_templates/`)

`feature` · `bug` · `task` · `spike` · `tech_debt` · `documentation` · `security` · `incident` · `adr` · `infra`

## 4. Definition of Ready (una issue no entra a desarrollo sin esto)

- [ ] Objetivo claro
- [ ] Problema/alcance definido
- [ ] Acceptance Criteria
- [ ] Dependencias conocidas
- [ ] Arquitectura suficiente

## 5. Definition of Done

- [ ] Implementación terminada
- [ ] Acceptance Criteria cumplidos
- [ ] Tests ejecutados
- [ ] CI exitoso
- [ ] Documentación actualizada si corresponde
- [ ] Sin secretos en el diff

## 6. Ramas (trunk-based con integración)

- `main` (protegida, gate estricto — deploy) + `dev` (protegida, prevalidación automática — integración) + ramas cortas: `feature/` · `fix/` · `chore/` · `infra/` · `docs/` · `governance/`
- Flujo: rama corta → MR → merge a `dev` (corre pipeline de prevalidación en cada push) → integración → `main` (solo con gate verde).

## 7. MR obligatorio

Toda MR indica: qué cambia, por qué, issue que resuelve (`Closes #ID`), archivos afectados, riesgos, cómo fue probado + **checklist de validación** (template `.gitlab/merge_request_templates/default.md`: tests por capa, E2E por alcance, TeVS, docs, secretos, backups).

## 8. CI gates (pipeline GitLab — verificado #58 SUCCESS en dev)

1. `helper-tests` — unit tests del helper (node:22-alpine) — **bloqueante** en dev/main/MR
2. `smoke-tests` — flujo esencial — **bloqueante**
3. `flow-tests` — flujos de negocio — **bloqueante**
4. `validate_tevs` — suite TeVS (14) contra Elastic (pwsh, red compartida `wibsite_default`) — **informativo en dev** (`allow_failure: true`), **gate estricto en main**

Variables CI/CD: `ELASTIC_PASSWORD` + `HELPER_API_KEY` (masked + protected; solo en ramas protegidas).

## 9. Sprints

Milestones `SPRINT-YYYY-NN` (1-2 semanas). Actual: **SPRINT-2026-17** (2026-08-24 → 09-06).

## 10. ADR

Toda decisión arquitectónica relevante → `docs/adr/` (plantilla: Status/Context/Decision/Alternatives/Consequences).

## 11. Incidents

Issue `type::incident` → mitigación → postmortem en `docs/operations/` → tasks preventivas.

## 12. Reglas para agentes IA

1. Nunca modificar `main` directamente.
2. Toda modificación asociada a una Issue.
3. Toda feature/MR pasa CI.
4. Producción requiere aprobación humana.
5. Decisiones arquitectónicas vía ADR.
6. Una tarea solo a DONE cumpliendo DoD.
7. Sin requisitos suficientes → `status::blocked` / NEEDS CLARIFICATION.
8. Secretos nunca en Git.
9. El agente no implementa tareas que no cumplan Definition of Ready.
10. La verdad es el código + runtime verificado.