---
name: default
about: Plantilla por defecto para Merge Requests (con checklist de validación obligatorio)
title: ""
---

## Resumen del cambio
<!-- Que cambia (código, flujo, módulo, docs) -->

## Por qué
<!-- Que issue resuelve: Closes #ID (referenciar el Issue del roadmap) -->

## Archivos/componentes afectados
<!-- Listar módulos/flujos tocados (helper services, frontend páginas, scripts, infra, docs) -->

## Riesgos
<!-- label risk::* (low/medium/high) + justificación -->

---

## ✅ Checklist de validación (obligatorio antes del merge)

### 1. Tests actualizados (regla: TODO cambio toca su test)
- [ ] **Unit tests**: si toqué `helper-node/services/*` o lógica pura → actualicé/añadí su `__tests__/*.test.js` (capa `npm run test:unit`)
- [ ] **Integración/flujos**: si toqué rutas o flujos de negocio → cubierto en `integration/flow/contract` o nuevo spec
- [ ] **Frontend**: si toqué `frontend/src/` → actualicé `frontend/__tests__/` y/o spec e2e del frontend

### 2. E2E Playwright (por alcance — solo las modificaciones del cambio)
- [ ] Ejecuté los specs **relacionados** al cambio: `npx playwright test e2e/specs/<spec-afectado>.spec.js`
- [ ] El reporter SOAC generó eventos `e2e_ui` (visibles en ES/Kibana) — **no** ejecutar suite completa (consumo de recursos)

### 3. TeVS (gate)
- [ ] Ejecuté el runner local: `pwsh scripts/tevs/tevs-runner.ps1 -TestFolder scripts/tevs/tests` (o en CI dev es informativo)
- [ ] Si toqué infra/observabilidad → **añadí/actualicé** un `TEST-XXX-NNN.ps1` con el JSON schema TEVS v1.0
- [ ] Entorno completo (DR/SEC-001/UI-001): documentar si aplica (no bloquean en dev)

### 4. Validación profunda SOAC (solo bajo demanda — modificaciones grandes o bugs)
- [ ] (Opcional) Cruce estado real ↔ telemetría ES: trazas/logs/métricas del flujo verificado (solo para cambios grandes o análisis de bug)

### 5. Documentación (regla: el código es la verdad)
- [ ] Actualicé `docs/maestro/MAESTRO-FUNCIONALIDADES-CORE.md` (estado del RAG-GX-YY afectado)
- [ ] Actualicé `docs/INDEX-GAPS.md` / `docs/development/03-PENDIENTES-Y-VALIDACION.md` si cambia la brecha
- [ ] Actualicé `docs/TESTING-INDEX.md` (conteos de tests) y `docs/CHANGELOG.md`
- [ ] `docs/product/01/02/03` si cambia el estado real verificado

### 6. Higiene y seguridad
- [ ] **Sin secretos en el diff** (revisar `glpat-`, `_pass_`, API keys hardcodeadas, `.env*`)
- [ ] `risk::*` label aplicado
- [ ] Pipeline `dev` verde (helper-tests + smoke + flow) — validate_tevs informativo en dev

### 7. Backups / versionado
- [ ] La versión anterior queda respaldada por el commit/MR previo (git history) — no se elimina historia
- [ ] Si hubo migración de datos/estado: documentado el punto de restauración

---

## Notas / decisiones técnicas
<!-- Contrato de arquitectura: motores sin UI, vista unificada, etc. -->