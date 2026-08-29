# Wibsite — Fuente de Verdad (GitLab)

> **Principio:** el **código y lo implementado es la verdad**. La documentación registra el estado real verificado y las planeaciones pendientes.
> Fuente única de verdad: **GitLab Self-Managed** (`sales-ai-platform/wibsite`) — issues, MRs, pipelines, milestones, boards y esta documentación.
> Última verificación en vivo: **2026-08-28**.

## Documentos maestros

| Ruta | Contenido |
|------|-----------|
| [docs/product/01-OBJETIVOS-Y-METAS.md](docs/product/01-OBJETIVOS-Y-METAS.md) | Objetivos del producto y su estado (código vs planeado) |
| [docs/product/02-ESTADO-REAL-VERIFICADO.md](docs/product/02-ESTADO-REAL-VERIFICADO.md) | Estado real del sistema verificado en vivo (código + runtime) |
| [docs/product/03-BRECHA-PLANEACION-vs-CODIGO.md](docs/product/03-BRECHA-PLANEACION-vs-CODIGO.md) | Discrepancias documentación vs código (lo que falta implementar/validar) |
| [docs/architecture/01-ARQUITECTURA-VERIFICADA.md](docs/architecture/01-ARQUITECTURA-VERIFICADA.md) | Arquitectura y stack verificado |
| [docs/adr/](docs/adr/) | Decisiones arquitectónicas (ADR-001…) |
| [docs/development/01-METODOLOGIA-OPERATIVA.md](docs/development/01-METODOLOGIA-OPERATIVA.md) | Metodología operativa (AI-Native Agile + DevSecOps) |
| [docs/development/02-ESTANDARES-GOBERNANZA.md](docs/development/02-ESTANDARES-GOBERNANZA.md) | Labels, board, tipos, DoR/DoD, git flow, CI gates |
| [docs/development/03-PENDIENTES-Y-VALIDACION.md](docs/development/03-PENDIENTES-Y-VALIDACION.md) | Lista de pendientes (en proceso / falta validar) |
| [docs/operations/01-OPERACIONES-RUNBOOK.md](docs/operations/01-OPERACIONES-RUNBOOK.md) | Operaciones, CI/CD y runbook esencial |
| [docs/operations/02-OBSERVABILIDAD.md](docs/operations/02-OBSERVABILIDAD.md) | Observabilidad verificada (Elastic/Kibana/OTel) |
| [docs/security/01-ESTADO-SEGURIDAD.md](docs/security/01-ESTADO-SEGURIDAD.md) | Estado de seguridad (cerrado vs abierto) |
| [docs/agents/01-AGENTES-MCP-PERMISOS.md](docs/agents/01-AGENTES-MCP-PERMISOS.md) | Agentes IA, MCP operativo y permisos progresivos |

## Flujo de trabajo (reglas mínimas)

1. Todo cambio relevante parte de una **Issue** con `type::*` y `status::*` (board Kanban).
2. Rama corta: `feature/TASK-XXX-desc`, `fix/BUG-XXX-desc`, `chore/…`, `infra/…`, `docs/…`.
3. **Merge Request** obligatorio con CI verde (`helper-tests` + `validate_tevs`).
4. `main` protegida (push/merge = Maintainers). Sin commits directos.
5. Secretos nunca en Git (variables CI/CD masked+protected).
6. Decisiones arquitectónicas → ADR en `docs/adr/`.
7. Una tarea solo pasa a `status::done` cumpliendo su Definition of Done.
8. La verdad del estado es el **código + runtime verificado**, no los documentos heredados.