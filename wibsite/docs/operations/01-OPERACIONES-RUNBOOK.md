# Operaciones y Runbook (esencial)

> Verificado 2026-08-28. Referencia completa histórica: `OPS-MASTER.md`, `RUNBOOK.md`, `docs/playbook-cambios.md` (legado local).

## 1. Stack operativo

| Comando | Uso |
|---------|-----|
| `docker compose up -d` (raíz wibsite) | Levantar stack (20 servicios) |
| `docker compose -f infrastructure/gitlab/docker-compose.yml up -d` | GitLab + Runner |
| `scripts/start-wibsite.ps1` | Orquestación completa (stack + GitLab + sync redes + health) |
| `docker compose ps` | Estado de servicios |
| `docker logs <ctr> --tail 100` | Logs de servicio |

## 2. Accesos

| Servicio | URL | Auth |
|----------|-----|------|
| Gateway | https://localhost:8080 (http://localhost:80) | SSO Authelia |
| Helper API | http://localhost:3100 | X-API-Key |
| Kibana | http://localhost:5601 | elastic user |
| n8n | http://localhost:5679 | admin@wibsite.com |
| Dify | http://localhost:5001 | console |
| GitLab | http://localhost:9080 | root (GITLAB_ROOT_PASSWORD en `.env`) |
| MinIO | http://localhost:9001 | consola |

## 3. CI/CD (GitLab)

- Pipeline: `helper-tests` → `validate_tevs` (gate). Rama: `main`. Tag runner: `test`.
- El runner ejecuta en la red `wibsite_default` — los jobs alcanzan `elasticsearch:9200`, `helper:3100`, `nginx:443`.
- `ELASTIC_PASSWORD` / `HELPER_API_KEY`: variables CI/CD masked+protected (nunca en el yml).

## 4. Verificación rápida

```powershell
# Health helper
Invoke-RestMethod http://localhost:3100/health
# Canales
Invoke-RestMethod http://localhost:3100/api/channels/status -Headers @{ "X-API-Key" = $env:HELPER_API_KEY }
# ES
Invoke-RestMethod http://localhost:9200/_cluster/health -Headers @{Authorization="Basic ..."}
# TeVS local
pwsh -File scripts/tevs/tevs-runner.ps1 -TestFolder ./tests -ElasticUrl http://localhost:9200 ...
```

## 5. Backup

- `scripts/backup.sh` — PostgreSQL (todas las bases), config, media; limpieza >30 días.
- GitLab: volúmenes nombrados + bind mount `./backups` (`gitlab-rake gitlab:backup:create`).

## 6. Incidentes

1. Crear issue `type::incident` (template).
2. Mitigar → registrar postmortem en `docs/operations/` → tasks preventivas con trazabilidad.

## 7. Entornos

- LOCAL = actual. DEV/STAGING/PRODUCTION: por definir (F-54) — cualquier deploy debe registrar versión+commit+entorno+fecha+pipeline.