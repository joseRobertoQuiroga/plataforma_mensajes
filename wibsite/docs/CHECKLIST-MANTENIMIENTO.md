# Checklist de Mantenimiento — Wibsite

## Diario (al trabajar en el proyecto)

- [ ] Verificar que los 16 contenedores Docker están UP:
      ```bash
      docker ps | wc -l   # debe mostrar 16
      ```
- [ ] Helper health: `curl http://localhost:3100/health`
- [ ] Dify workflow funcional: ejecutar test rápido desde `demo-mvp.ps1`
- [ ] Revisar logs de errores: `docker compose logs --since=24h | grep -i error`
- [ ] Verificar que `wibsite-store.json` no supere 10MB (si crece → migrar a PostgreSQL)

## Semanal

### Infraestructura
- [ ] Verificar espacio en disco: `wsl df -h` (Docker en WSL)
- [ ] Rotar logs de Docker si es necesario: `docker system prune -f`
- [ ] Verificar health de todos los servicios:
      ```bash
      curl -s http://localhost:3100/health
      curl -s http://localhost:3100/api/llm/health
      curl -s http://localhost:3100/api/twenty/health
      ```
- [ ] Verificar que el frontend unificado carga (raíz `https://localhost:8080/` → frontend Next.js)
- [ ] Verificar health del helper en `http://localhost:3100/health`

### Base de Datos
- [ ] Backup de PostgreSQL:
      ```bash
      docker exec -t wibsite-postgres pg_dumpall -U wibsite > backup_$(date +%Y%m%d).sql
      ```
- [ ] Backup de JSON store (si se usa):
      ```bash
      cp wibsite/helper-node/wibsite-store.json backup-store.json
      ```
- [ ] Verificar tamaño de BD:
      ```bash
      docker exec wibsite-postgres psql -U wibsite -d wibsite -c "\l+"
      ```

### Créditos y Costos
- [ ] Verificar saldo OpenRouter: `https://openrouter.ai/account`
- [ ] Revisar consumo de tokens en Dify (logs de ejecución)
- [ ] Verificar que los tokens Meta no hayan expirado (si se configuró)

## Mensual

### Integridad de Datos
- [ ] Verificar que campañas se crean correctamente:
      ```bash
      curl -s http://localhost:3100/api/campaigns | python -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"data\"])} campañas')"
      ```
- [ ] Verificar scoring de leads:
      ```bash
      curl -s http://localhost:3100/api/leads/top?limit=5 | python -c "import sys,json; d=json.load(sys.stdin); [print(l['name'],l['score']) for l in d[:5]]"
      ```
- [ ] Verificar Twenty CRM sync (si hay leads):
      ```bash
      curl -s http://localhost:3100/api/twenty/sync-all -X POST
      ```
- [ ] Probar LLM:
      ```bash
      curl -s http://localhost:3100/api/llm/chat -X POST -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"test"}]}'
      ```

### Documentación
- [ ] Revisar que `docs/INDEX.md` refleje todos los archivos existentes
- [ ] Revisar que `docs/CHANGELOG.md` esté actualizado
- [ ] Revisar que `docs/MEMORY.md` tenga ADRs de decisiones recientes
- [ ] Verificar que endpoints nuevos estén documentados en `docs/rag/ENDPOINTS.md`

### Dify
- [ ] Verificar que el workflow "WhatsApp Lead Classifier" esté publicado
- [ ] Verificar que los modelos OpenRouter están disponibles
- [ ] Revisar ejecuciones fallidas en Dify (Workers → Logs)

### n8n
- [ ] Verificar que los workflows estén activos (si corresponde)
- [ ] Revisar ejecuciones fallidas en n8n (Executions tab)
- [ ] Verificar webhooks registrados: `GET /rest/webhook` (requiere login)

## Por Despliegue / Release

### Pre-Release
- [ ] Todos los tests pasan (run `demo-mvp.ps1`)
- [ ] `docs/CHANGELOG.md` actualizado con la nueva versión
- [ ] `docker compose build` sin errores
- [ ] Backup de BD realizado
- [ ] Documentación actualizada con nuevos endpoints/cambios

### Post-Release
- [ ] Todos los servicios UP (`docker compose ps`)
- [ ] Dashboard carga correctamente
- [ ] Dify workflow responde correctamente
- [ ] n8n workflows activos (si aplica)
- [ ] Twenty CRM conectado

## Emergencia

### Helper Node caído
```bash
docker compose logs helper --tail=50    # ver causa
docker compose restart helper           # reiniciar
docker compose logs helper --tail=20    # verificar que arrancó
```

### PostgreSQL caído
```bash
docker compose logs postgres --tail=30  # ver causa
docker compose restart postgres         # reiniciar
# Helper debería caer a JSON file store automáticamente
```

### Dify workflow falla
- Abrir `http://localhost:3003` → Studio → App → Run manual
- Si el error es del modelo OpenRouter → verificar API key/saldo
- Si el error es de sandbox (Code nodes) → reemplazar por LLM nodes
- Si el error es de sintaxis → publicar nuevamente

### n8n no responde
```bash
docker compose logs n8n --tail=30       # ver causa
docker compose restart n8n              # reiniciar
# Verificar que los workflows se vuelven a cargar
# Pueden perder estado "active" — reactivar desde UI
```

### Rollback general
```bash
git checkout <commit-anterior> -- docker-compose.yml .env helper-node/index.js
docker compose up -d
```
