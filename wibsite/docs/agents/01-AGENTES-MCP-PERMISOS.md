# Agentes IA, MCP y Permisos

> Implementado 2026-08-28 (Fase 4 del estándar: primero lectura).

## 1. Capa MCP operativa

- Servidor: `mcp-gitlab` 0.9.3 (83 tools: projects, MRs, pipelines, issues, releases, variables, notes, discussions, approvals…).
- Bridge: `C:\proyectos\MCP\gitlab-mcp\bridge.py` (framing LSP↔JSON-line, I/O nativo Windows).
- Config: `~/.config/opencode/opencode.jsonc` → `mcp.gitlab` con `GITLAB_READ_ONLY=true`.
- Instancia: `http://localhost:9080` · PAT `opencode-mcp` (read_api + read_repository).
- Verificado: INIT (protocol 2025-03-26), 83 tools, `gitlab_get_project` + `gitlab_list_issues` OK.

## 2. Permisos progresivos (patrón)

| Nivel | Permitido | Estado |
|-------|-----------|--------|
| 1 READ | Leer código/issues/MRs/pipelines/logs | ✅ Activo (MCP read-only) |
| 2 PROPOSE | Crear issue, branch, MR | Próximo (PAT con scope api controlado) |
| 3 EXECUTE | Merge, deploy DEV/STAGING | Por definir (humano) |
| 4 HUMAN APPROVAL | Producción, DB migrations, secretos | Siempre humano |

Regla: la capacidad técnica no determina la autoridad.

## 3. Roles de agentes (concepto)

| Agente | Responsabilidad |
|--------|-----------------|
| Planner | Descomponer epics/features, detectar ambigüedad (DoR), proponer sprint |
| Developer | Leer issue, consultar ADR, branch, código, tests, MR |
| QA | AC → tests → regresiones → validación |
| DevOps | Pipelines, infra, observabilidad, diagnóstico |
| Security | Dependency/secret/container scan, findings trazables |
| Documentation | docs/ actualizada, ADR, changelog (sin inventar) |

## 4. Reglas para agentes

1. Nunca main directo · 2. Toda modificación asociada a Issue · 3. Toda MR pasa CI ·
4. Producción requiere aprobación humana · 5. Decisiones vía ADR ·
6. DONE solo con DoD · 7. Requisitos ambiguos → BLOCKED/NEEDS CLARIFICATION ·
8. Secretos nunca en Git · 9. No implementar sin DoR · 10. La verdad es el código.