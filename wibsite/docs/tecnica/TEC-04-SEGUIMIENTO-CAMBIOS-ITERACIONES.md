# TEC-04 — Seguimiento de Cambios, Iteraciones y Deuda Técnica

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Técnica (CONTROL)
> **Propósito:** cómo se registra el avance, qué herramientas de seguimiento existen, qué inconsistencias/deuda hay abiertas y qué ritual de actualización mantiene la documentación confiable.
> **Fuentes:** `CONSOLIDADO-METODOLOGIA.md`, `FASES-CRUZADAS.md` (reglas R1-R6), `docs/CHANGELOG.md`, `docs/MEMORY.md`, `docs/PLAYBOOK-CAMBIOS.md`.

---

## 1. Herramientas de seguimiento existentes (y su rol)

| Herramienta | Archivo | Qué registra | Frecuencia |
|---|---|---|---|
| Estado vivo | `Avances/ESTADO-GENERAL.md` | % por área, próximos pasos top 5 | Diario |
| Logros | `Avances/LOGROS.md` | Todo lo completado por dominio | Semanal |
| Pendientes | `Avances/OBJETIVOS-PENDIENTES.md` | P0-P3 con dependencias | Semanal |
| Salud de componentes | `Avances/COMPONENTES.md` | Estado por servicio/endpoint | Semanal |
| Historial de versiones | `docs/CHANGELOG.md` | Added/Changed/Fixed por versión | Por release |
| Decisiones | `docs/MEMORY.md` | ADR-001…021 (activo/obsoleto) | Por decisión |
| Funcionalidades | `docs/TAREAS-FUNCIONALES.md` | Checklist por objetivo | Semanal |
| Objetivos técnicos | `docs/tecnica/TEC-03` (este sistema) | OT-01…12 con estado | Semanal |
| Mapa RAG | `docs/maestro/MAESTRO-*` | Estado por funcionalidad core | Por cambio de feature |
| Verificación | `verify-mvp.sh` / `verify-fase.sh` + 112 tests | Gates de avance | Por iteración |

**Nada de esto es opcional:** la regla R3 (FASES-CRUZADAS) exige al completar un paso: verificación + marcar Hecho + CHANGELOG + notificación.

## 2. Versionado y cronología real

| Versión | Fecha | Contenido |
|---|---|---|
| v2.0.0 → v2.1.0 | Julio 2026 (Sesión 1, ~25h) | Helper v2: PostgreSQL + fallback, dashboard, Excel, plantillas, scoring |
| v2.1.1 | 2026-07-10 (Sesión 2, ~15h) | Bugfixes: race condition (storeLock), 409 duplicados, normalización teléfonos; auditoría 14/14 + 2 bugs |
| **v2.2.0** | Julio 2026 | Seguridad (auth/rate-limit/sanitizer/HMAC), conversation store 9 estados, lead profile, agent config, RAG engine, anti-hallucination, SLI/SLO, **112 tests** |
| v3.0.0 (objetivo) | — | Estado ilustrativo post-MVP en FASE1-MVP-CRUZADO |

Imágenes pineadas (OPS §7): chatwoot (evaluar pinning, usa `:latest` ⚠️ A-09), dify-api, n8n (fijada por bug ADR-019), twenty.

## 3. Ritual de iteración (cómo trabajar una iteración)

1. **Antes de codificar:** leer TEC-05 §3 (ruta de lectura) + la ficha del módulo en `docs/context/` + tests existentes. Verificar prerrequisitos del paso en TEC-03.
2. **Durante:** respetar alcance del OT; cada cambio agrega unit test + log de auditoría (`security_alert`, `state_transition`, `api_call`, `error`, `config_change`, `data_migration`).
3. **Al completar:** ejecutar verificación del OT (si falla, **no avanzar**) → actualizar TEC-03 tabla §3 + `Avances/*` + CHANGELOG + este documento si hay nueva deuda.
4. **Al completar fase:** `verify-fase.sh` + regresión de fases anteriores + tag git.
5. **Tests que fallan se investigan, no se ignoran** (regla de oro 5).

## 4. Deuda técnica registrada (backlog de deuda, no de features)

| ID | Deuda | Impacto | Plan | Ref |
|---|---|---|---|---|
| D1 | JSON store como primario (pool PG sin usar) | 🔴 Multi-tenant, huérfanos, BI | OT-02 (3 semanas) | ADR-001/007, DATA §10 |
| D2 | n8n body parser bug (2.23.4) | 🟡 Gestión vía UI/SQL | No actualizar hasta fix; reevaluar en upgrades | ADR-019 |
| D3 | Imágenes `:latest` (chatwoot, dify, twenty) | 🟡 Reproducibilidad | Pinear versiones (A-09) | SEC A-09, OPS §7 |
| D4 | HTTPS sin aplicar (certs generados) | 🟡 Seguridad tránsito | OT-05 | SEC A-04 |
| D5 | Sync Twenty unidireccional | 🟡 CRM desactualizado | OT-06 | TEC-02 G7 |
| D6 | Dify sandbox activo sin uso | 🟢 Recurso idle | Mantener para futuros code nodes | ADR-020 |
| D7 | Templates duplicados (DEFAULT_TEMPLATES + store) | 🟢 Confusión | Resolver en OT-02 | DATABASE-VALIDATION P4 |
| D8 | Chatwoot históricamente inestable (502/reinicios) | 🟡 Confiabilidad | Resolver DNS ya aplicado (ADR-014); monitorear con OT-03 | doc/ESTADO.md |

## 5. Inconsistencias documentales conocidas (resolver en próximas revisiones)

| ID | Inconsistencia | Documentos en conflicto | Resolución propuesta |
|---|---|---|---|
| I1 | Dos numeraciones de fases | `Avances/ROADMAP.md` vs `ROADMAP-MULTI-AGENT` | Unificadas en TEC-03 §1 (U-Fx) |
| I2 | Costo tenant Demo: $0.50 vs $5/mes | BUSINESS-MASTER §1 vs §7 | Corregir BUSINESS-MASTER (CTX06-O7) |
| I3 | Credenciales n8n: `Admin@123` vs `Wibsite2024!` | ADR-003 vs MANUAL-TECNICO §5 | Verificar la real y unificar |
| I4 | Estado Dify "10% construir grafo" vs workflow funcional probado | TAREAS-FUNCIONALES/MANUAL vs ADR-018/021 | Actualizar TAREAS-FUNCIONALES (workflow operativo) |
| I5 | "35+ endpoints" vs "50+" | ESTADO-GENERAL/COMPONENTES vs LOGROS | Recontar en próxima revisión (v2.2.0) |
| I6 | Workflows n8n: 2 importados vs 3 activos en BD | ESTADO-GENERAL vs COMPONENTES/LOGROS | Documentar el 3er workflow |
| I7 | SECURITY-MASTER "Authelia no activo, 0% mitigaciones" vs ADR-016 implementado | SECURITY-MASTER vs MEMORY | Marcar A-11 como mitigado parcial en próxima revisión de SECURITY-MASTER |
| I8 | Fase 1: 70% vs 75% vs "Fase 0.5 95%/70% global" | ROADMAP vs ESTADO-GENERAL vs doc/ESTADO* | Adoptar ESTADO-GENERAL (más reciente) y U-F1 |

**Regla ante conflicto de datos:** gana el documento con fecha más reciente; se registra aquí y se corrige el documento rezagado en la siguiente iteración de mantenimiento.

## 6. Salud documental (métrica de CONSOLIDADO-METODOLOGIA)

Fórmula: `(docs actualizados / docs totales) × 100` — objetivo >95%, alerta <80%. Con la incorporación de esta estructura (contextual/tecnica/maestro), los documentos con desactualización conocida son los listados en §5 (I3-I7): tratarlos en el próximo ciclo de mantenimiento semanal.

**Documentos que NO se duplican en la nueva estructura** (siguen siendo la fuente de verdad de su dominio): manuales (`MANUAL-TECNICO/USUARIO`), operación (`RUNBOOK`, `PLAYBOOK-CAMBIOS`, checklists), datos IA (`docs/rag/*`), fichas (`docs/context/*`), maestros (`*-MASTER.md`), cruces (`FASE*.md`). La nueva estructura **referencia** — no reescribe.

## 7. Checklist de cierre de iteración (plantilla)

```
[ ] Verificación del OT ejecutada y pasando
[ ] 112 tests + nuevos tests pasando
[ ] TEC-03 tabla §3 actualizada (estado + fecha verificación)
[ ] Avances/ESTADO-GENERAL.md y LOGROS/OBJETIVOS actualizados
[ ] CHANGELOG.md con entrada de versión
[ ] Si hubo decisión: nuevo ADR en MEMORY.md
[ ] Si cambió una feature core: archivo maestro RAG actualizado
[ ] Si apareció deuda/inconsistencia: registrada en TEC-04 §4/§5
[ ] Logs de auditoría del tipo correcto presentes
```

---

## Referencias cruzadas
- → [TEC-03](TEC-03-OBJETIVOS-TECNICOS-FASES.md) (qué se persigue) | [TEC-05](TEC-05-GUIA-CONTEXTO-RAG.md) (cómo encontrar todo)
- → `CONSOLIDADO-METODOLOGIA.md` (metodología completa), `docs/PLAYBOOK-CAMBIOS.md` (cómo cambiar cada componente sin romper)
