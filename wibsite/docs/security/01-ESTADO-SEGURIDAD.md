# Estado de Seguridad

> Verificado 2026-08-28. Legado: `SECURITY-MASTER.md`, `SECURITY-GAPS-PRE-DEPLOY.md` (referencia histórica local).

## 1. Cerrado y verificado (código/runtime)

| Ítem | Evidencia |
|------|-----------|
| SSO Authelia + nginx auth_request | 403 sin sesión SSO (verificado) |
| Middleware helper: auth API key, rate limit (30/60), sanitizador 23 patrones, HMAC webhooks | Código `middleware/` + tests |
| PII filter + auditLogger (24 eventos) | Código + OTLP→ES |
| RLS PostgreSQL multi-tenant (7 políticas) + tenantContext | Código + scripts/db/ |
| Anti-hallucination (boundaries, unknown responses) | Código + tests |
| Secretos en CI: `ELASTIC_PASSWORD`, `HELPER_API_KEY` masked+protected | GitLab CI variables (verificado API) |
| Historia GitLab limpia sin secretos | Baseline `dfda663` (7 commits) |
| `.gitlab-ci.yml` sin password hardcodeada | S2 cerrado (verificado en main) |

## 2. Abierto (issues en GitLab)

| Issue | Ítem | Prioridad |
|-------|------|-----------|
| #T1 | S1: HELPER_API_KEY literal en config local (diferido a deploy) | Crítico |
| #T2 | S3: nginx.key + wibsite-store.json (PII) en historia del repo local | Crítico |
| #T3 | otel-collector password en config | Alto |
| #T4 | body parser n8n | Medio |
| #F6 | Hardening SECURITY-MASTER §14: Let's Encrypt, CORS restrictivo, contenedores no-root, resource limits, SSRF n8n, ClamAV, EXIF strip, retención de datos, breach notification | Fases 1-5 |

## 3. Reglas obligatorias (no modificables)

1. Secretos nunca en Git/README/issues/prompts.
2. Producción protegida + aprobación humana.
3. Logs sensibles controlados (PII filter).
4. Permisos mínimos por servicio.
5. Cambios de seguridad/DB/auth → ADR + revisión humana.