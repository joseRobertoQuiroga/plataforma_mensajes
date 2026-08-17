# Auditoría Documental — Sincronización docs ↔ código ↔ tests ↔ runtime (15/08/2026)

> **Objetivo:** alinear TODA la documentación con el estado real verificado del código (v3.4.0), los tests (176/176 · 22 suites), los gates SOAC (TeVS 13/13, e2e-trace 10/10) y el runtime (20 contenedores).
> **Método:** grep global de cifras/estados obsoletos → actualización de documentos vivos → validación final con el SOAC.

---

## 1. Estado verificado de referencia (evidencia de esta corrida)

| Fuente | Valor verificado |
|--------|------------------|
| Jest | **22 suites · 176/176 PASS** |
| TeVS | **13/13 PASSED** (catálogo: AGENT, CHN, CORR, DATA, DEV×3, DR×2, MM, OBS, SEC×2) |
| e2e-trace (F-46) | **10/10** |
| Runtime | 20 contenedores UP · hub 200 · helper 200 · dify 200 · n8n 200 |
| Versión helper | v3.4.0 (CHANGELOG) |
| BDs | wibsite (356+ audit), chatwoot (1 inbox/6 conv), n8n (3 workflows, 2 activos runtime), dify (75+ runs), twenty (key expirada) |
| ES | traces 3686+ · logs 200+ · metrics 1573+ · ILM 1d/30d |

---

## 2. Documentos actualizados en esta pasada (vivos)

| Doc | Cambio principal |
|-----|------------------|
| `Avances/ESTADO-GENERAL.md` | 176/22, TeVS 13, nuevas capacidades (RAG, cotizaciones, TTS, portal, carga) |
| `Avances/LOGROS.md` | tabla ejecutiva: 176 tests/22 suites, TeVS ejecutado, multicanal/multimodal |
| `Avances/OBJETIVOS-PENDIENTES.md` | P0-P2 al día + oleada J implementada + MC1-MC5 |
| `Avances/COMPONENTES.md` | Sección observabilidad = Elastic Stack SOAC (13/13, 10/10) |
| `Avances/PROCEDIMIENTOS.md` | `monitoring/` eliminado (15/08) |
| `docs/GAPS-MINIFASES.md` | G-21/G-23/G-24 ✅, G-36/G-37 ✅, CI 176 tests, tabla de gaps por oleada |
| `docs/ANALISIS-ESTADO-GAPS-MINIFASES.md` | 22/22 suites · 176/176 tests (S12 resuelto con evolución) |
| `docs/CHANGELOG.md` | 3.4.0 (Oleada J) completo |
| `docs/TESTING-INDEX.md` | Estado actual (22 suites, TeVS 13 catálogo, e2e-trace, load tests) + matriz ampliada |
| `docs/MANUAL-TECNICO.md` | Endpoints nuevos: agente (RAG/cotización), multicanal, portal, observabilidad |
| `docs/tecnica/TEC-02` | 176 tests en 22 suites |
| `docs/tecnica/TEC-03` | OT-12 ✅ con gates SOAC |
| `docs/tecnica/TEC-04` | v3.4.0 en tabla de versiones + gates de avance actualizados |
| `docs/tecnica/TEC-06` | §5: 40+ ✅ · F-08/09/10/11, F-42…F-51 actualizados con fechas 15/08 + sección "Extra" (RAG, cotizaciones, TTS, broadcast, puente logs, ILM) |
| `docs/contextual/CTX-02` | v3.4.0, dual-write conectado, RAG en grafo |
| `docs/maestro/MAESTRO-FUNCIONALIDADES-CORE.md` | 176 tests, F-08 verificado en vivo |
| `docs/PRUEBAS-COMPLETAS.md` | 176 tests · 22 suites |
| `docs/SEGUIMIENTO-HUMANO.md` | Total 22 suites / 176 tests |
| `docs/INDEX.md` | Referencias a los docs nuevos (15/08) |

## 3. Documentos históricos (snapshots fechados — NO reescritos por diseño)

Estos docs son registros de un momento del proyecto; sus cifras (112 tests, 8 suites, TeVS pendiente) eran correctas **en su fecha**. Se conservan como historial; el estado vigente vive en los docs vivos (§2):

- `docs/ANALISIS-CRITICO-FINAL.md`, `docs/CIERRE-FINAL-TWILIO.md`, `docs/CIERRE-SESION-OBJECTIVOS.md`, `docs/DIAGNOSTICO-FINAL.md`, `docs/AUDITORIA-2026-08-13.md` (cifras correctas para 13/08).

> **Regla adoptada:** si un doc histórico es referenciado para tomar decisiones, debe cruzarse con `Avances/ESTADO-GENERAL.md` (fuente de verdad viva) y `docs/ANALISIS-CRUZADO-2026-08-15.md`.

## 4. Hallazgos documentales pendientes (menores, no bloqueantes)

| # | Doc | Nota |
|---|-----|------|
| D1 | `docs/SEGUIMIENTO-HUMANO.md` fila 18 | actualizada a Elastic Stack; revisar el resto de la tabla de seguimiento en la próxima pasada |
| D2 | `docs/contextual/*` (CTX-03…07) | coherentes con la arquitectura; sin cifras obsoletas |
| D3 | `specs/` | no revisados en esta pasada (pendiente si se usan para F-53+) |
| D4 | `docs/tecnica/TEC-06` | F-28/F-29/F-52/F-53/F-54/F-56 permanecen ⬜ por decisión de negocio (diferidas) — correcto |

## 5. Validación SOAC de esta pasada

- Todos los cambios de documentación se realizaron tras ejecutar la validación completa: Jest 176/176 → TeVS 13/13 → e2e-trace 10/10 (corrida 15/08).
- La evidencia queda en: `tevs-results-2026.08.15` (ES), `audit_logs` (PG, incluye `e2e_trace` de las corridas), `logs-doags.otel-production` (eventos de la sesión).
- Próxima pasada sugerida: después de conectar tokens de canales (Telegram) y regenerar la key de Twenty.
