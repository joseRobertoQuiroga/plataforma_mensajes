# SECURITY GAPS — PRE-DEPLOY

> **Estado:** ⚠️ PENDIENTE — NO corregidos aún. **Re-verificado: 2026-08-15** (siguen vigentes los 3 hallazgos; se confirma que SÍ están aislados y no bloquean el desarrollo funcional).
> **Propósito:** Este documento **excluye** los hallazgos de seguridad del trabajo de implementación en curso (tests, monitoreo, funcionalidad, módulos). Se mantienen aquí, aislados, como checklist **obligatoria** antes de cualquier despliegue a producción.
> **Fuente:** Auditoría 2026-08-13 + Análisis de estado 14/08/2026 (ver `docs/AUDITORIA-2026-08-13.md` y `docs/ANALISIS-ESTADO-GAPS-MINIFASES.md`). Re-verificación en `docs/ANALISIS-CRUZADO-2026-08-15.md` §3.1.

---

## Resumen ejecutivo

| # | Severidad | Hallazgo | Ubicación | Impacto |
|---|-----------|----------|-----------|---------|
| S1 | 🔴 CRÍTICO | API key literal no evaluada (key pública fija) | `wibsite/.env:57` + env del contenedor | Cualquiera puede autenticarse contra la API del helper |
| S2 | 🔴 CRÍTICO | Password de Elasticsearch hardcodeada en CI | `.gitlab-ci.yml:12` | Exposición del password en el repo; no usa secretos del runner |
| S3 | 🔴 CRÍTICO | `nginx.key` (privada) + `wibsite-store.json` (PII) en git history | commit `a603c91` | Rotura de confidencialidad: key privada y PII de leads en historia del repo |

---

## S1 — API key del helper: literal no evaluada (CRÍTICO)

**Qué:** `HELPER_API_KEY=wb_dev_$(openssl rand -hex 16)` está **literal** en `.env:57` y en el entorno del contenedor. El `$(...)` **NO se evalúa** — dotenv no ejecuta subshells. El valor real registrado en runtime ES esa cadena literal.

**Por qué es crítico:**
- Key **fija, pública y conocida** (visible en el repo).
- Contradice F-32 (rotación de credenciales) y F-35 (re-auditoría de seguridad, que dio ✅ por no inspeccionar el `.env` real del runtime).
- Verificación: `docker exec wibsite-helper printenv HELPER_API_KEY` → devuelve la cadena literal.

**Corrección (en etapa deploy):**
1. Generar hex real: `openssl rand -hex 32` (o 64).
2. Aplicar en `.env` (local) y en el entorno del contenedor; rotar.
3. Distribuir la nueva key a los clientes que la usan (webhooks, agentes).

---

## S2 — Password de Elasticsearch hardcodeado en CI (CRÍTICO)

**Qué:** `.gitlab-ci.yml:12` → `ELASTIC_PASSWORD: "wibsite_elastic_pass_2026"` **hardcodeado** en variables de CI.

**Por qué es crítico:**
- Password de ES (producción/monitoreo) en texto plano en el repo.
- El estándar F-35 se verificó ✅ en `docker-compose`/`otel-collector` (usan `${ELASTIC_PASSWORD}`), pero el pipeline CI lo hardcodea — excepción que invalida el gate.

**Corrección (en etapa deploy):**
1. Mover `ELASTIC_PASSWORD` a variables del runner GitLab (`CI/CD → Variables`, tipo **Masked** y **Protected**).
2. Referenciar en `.gitlab-ci.yml` como `$ELASTIC_PASSWORD`.
3. Rotar el password de ES.

---

## S3 — nginx.key + wibsite-store.json (PII) en git history (CRÍTICO — P0 histórico)

**Qué:** Los commits antiguos (p.ej. `a603c91`) incluyen:
- `wibsite/certs/nginx.key` — clave privada del certificado TLS del gateway.
- `wibsite-store.json` — almacén JSON con datos de leads (PII).

**Por qué es crítico:**
- La clave privada comprometida permite suplantar el gateway.
- PII de leads en la historia del repo = incumplimiento de protección de datos.
- Nota: `wibsite-store.json` fue **excluido** del último backup (`51e057b`), pero la historia previa lo contiene.

**Corrección (en etapa deploy — requiere decisión del usuario):**
1. `git filter-repo` (o `filter-branch`) para purgar `nginx.key` y `wibsite-store.json` de toda la historia.
2. Rotación completa del certificado TLS (nueva key + nueva CA/CSR).
3. Si el repo es remoto, force-push + invalidar cachés de la plataforma (GitHub/GitLab).

---

## Verificaciones que SÍ están OK (no requieren acción)

| Item | Estado |
|------|--------|
| `wibsite/.env` en `.gitignore` | ✅ `git check-ignore` OK |
| `.env.example` versionado | ✅ solo con `<placeholder>` correcto para `HELPER_API_KEY` |
| Password ES en compose/otel-collector | ✅ vía `${ELASTIC_PASSWORD}` (no hardcodeada) |
| Autenticación timing-safe | ✅ `crypto.timingSafeEqual` en `middleware/auth` |
| nginx.conf sin key hardcodeada | ✅ |

---

## Checklist pre-deploy (orden sugerido)

- [ ] S1: regenerar `HELPER_API_KEY` real y rotarla en runtime + clientes.
- [ ] S2: mover `ELASTIC_PASSWORD` a secretos masked/protected del runner GitLab; rotar password ES.
- [ ] S3: purga de historia (filter-repo) de `nginx.key` y `wibsite-store.json` + rotación del certificado.
- [ ] Re-auditar: `git log --all --oneline -- wibsite/certs/nginx.key` y `git log --all --oneline -- wibsite-store.json` vacíos.
- [ ] Confirmar que ningún CI/workflow imprime variables sensibles.
- [ ] (Post-deploy) Re-correr TeVS + e2e-trace tras la rotación de secretos y documentar en `tevs-results-*`.

## Notas de la re-verificación 2026-08-15

- Los 3 hallazgos **siguen vigentes** (no se tocaron por decisión explícita: quedan para la etapa de deploy).
- Todo lo demás avanzó sin verse afectado: dual-write PG verificado, tests 169/169, TeVS 11/11, multicanal implementado.
- Nuevo riesgo a vigilar en deploy: los **tokens de canales** (TELEGRAM_BOT_TOKEN, MESSENGER_PAGE_TOKEN, EMAIL_API_KEY…) que se agreguen en `.env` deben mantenerse fuera del repo (`.env` ya está ignorado; usar el mismo patrón).