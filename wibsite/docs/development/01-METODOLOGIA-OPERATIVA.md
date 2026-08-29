# Metodología Operativa

> Implementada en GitLab el 2026-08-28. Modelo: **AI-Native Agile + DevSecOps** (Kanban + sprints ligeros + trunk-based + MR obligatorio + CI gates + ADR).

## 1. Flujo de trabajo

```
Issue (type::* + status::*) → Rama corta → Commits → MR → CI (helper-tests + validate_tevs)
→ Revisión → Merge a main (protegida) → Observabilidad (ES) → Feedback → Issue
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

## 6. Ramas (trunk-based)

`main` (protegida) + ramas cortas: `feature/` · `fix/` · `chore/` · `infra/` · `docs/` · `governance/`

## 7. MR obligatorio

Toda MR indica: qué cambia, por qué, issue que resuelve (`Closes #ID`), archivos afectados, riesgos, cómo fue probado.

## 8. CI gates (pipeline GitLab)

1. `helper-tests` — unit tests del helper (node:22-alpine)
2. `validate_tevs` — suite TeVS contra Elastic (pwsh, red compartida `wibsite_default`)

Variables CI/CD: `ELASTIC_PASSWORD` + `HELPER_API_KEY` (masked + protected).

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