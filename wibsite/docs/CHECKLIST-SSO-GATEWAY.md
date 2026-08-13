# Checklist de Verificación — SSO Unificado + API Gateway + Integraciones

> Modo de uso: ejecutar cada bloque de comandos y marcar ✅/❌. Tiempo estimado: 3-5 minutos.

---

## BLOQUE A — Authelia SSO (Login Único)

### A1. Authelia vivo

```powershell
docker ps --filter name=wibsite-authelia --format "{{.Status}}"
# Esperado: "Up X minutes (healthy)"
# [ ] ✅/❌
```

### A2. Nginx vivo sin errores

```powershell
docker logs wibsite-nginx --tail 5 2>&1 | Select-String "emerg|error"
# Esperado: SIN salida (sin errores)
# [ ] ✅/❌
```

### A3. Rutas protegidas redirigen a login (sin sesión)

```powershell
function Test-Redirect { param($path)
  try { $r=Invoke-WebRequest "http://localhost:8080$path" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 0 -ErrorAction Stop; @{path=$path; code=$r.StatusCode; redirect=$r.Headers.Location} }
  catch { @{path=$path; code="ERR"; redirect=$_.Exception.Response.Headers.Location} }
}

Test-Redirect "/crm/"      ; Test-Redirect "/n8n/"
Test-Redirect "/admin/"    ; Test-Redirect "/chatwoot/"
Test-Redirect "/dify/"     ; Test-Redirect "/portal/"
Test-Redirect "/api/campaigns"
# Esperado: todas con code=302 o redirigiendo a /auth/
# [ ] ✅/❌
```

### A4. Rutas públicas accesibles sin login

```powershell
function Test-Public { param($path)
  try { $r=Invoke-WebRequest "http://localhost:8080$path" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; @{path=$path; code=$r.StatusCode} }
  catch { @{path=$path; code="ERR"} }
}

Test-Public "/hub/"          # 200
Test-Public "/health"        # 200
Test-Public "/api/health"    # 200
Test-Public "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=OK"  # 200 + body=OK
# [ ] ✅/❌
```

### A5. API requiere autenticación

```powershell
Invoke-RestMethod "http://localhost:3100/api/campaigns" -Method Get -ErrorAction SilentlyContinue
# Esperado: {"error":"API key required..."}
# [ ] ✅/❌
```

---

## BLOQUE B — API Gateway (nginx) Proxy Correcto

### B1. Proxy estático sirve archivos

```powershell
Invoke-WebRequest "http://localhost:8080/hub/" -UseBasicParsing | Select-Object StatusCode, @{n="Length";e={$_.Content.Length}}
# Esperado: 200, Length > 1000
# [ ] ✅/❌
```

### B2. Proxy a helper responde

```powershell
Invoke-RestMethod "http://localhost:8080/health" -TimeoutSec 3 | Select-Object service,status,version
# Esperado: service=wibsite-helper, status=ok, version=2.2.0
# [ ] ✅/❌
```

### B3. Proxy a n8n funciona

```powershell
Invoke-WebRequest "http://localhost:5679/health" -UseBasicParsing -TimeoutSec 3 | Select-Object StatusCode
# Esperado: 200
# [ ] ✅/❌
```

### B4. Dify accesible vía SSO proxy (no por puerto directo)

```powershell
Invoke-WebRequest "http://localhost:8080/dify/" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 0 -ErrorAction SilentlyContinue
# Esperado: 302 redirige a /auth/ (pasa por SSO, no por :3003 directo)
# [ ] ✅/❌
```

### B5. Headers de seguridad presentes

```powershell
$h = Invoke-WebRequest "http://localhost:8080/hub/" -UseBasicParsing -TimeoutSec 3
$h.Headers["X-Content-Type-Options"]   # Esperado: nosniff
$h.Headers["X-Frame-Options"]          # Esperado: SAMEORIGIN
$h.Headers["Referrer-Policy"]          # Esperado: strict-origin-when-cross-origin
# [ ] ✅/❌
```

---

## BLOQUE C — Comunicación entre Módulos

### C1. Helper → PostgreSQL

```powershell
$h = Invoke-RestMethod "http://localhost:3100/health" -TimeoutSec 3
$h.dependencies.db
# Esperado: "postgresql"
# [ ] ✅/❌
```

### C2. Helper → Redis

```powershell
$h.dependencies.redis
# Esperado: "available"
# [ ] ✅/❌
```

### C3. Helper → Weaviate

```powershell
$h.dependencies.weaviate
# Esperado: "connected"
# [ ] ✅/❌
```

### C4. Helper → OpenRouter (LLM)

```powershell
$h.dependencies.llm.configured
# Esperado: true
# [ ] ✅/❌
```

```powershell
$llm = Invoke-RestMethod "http://localhost:3100/api/llm/health" -Method Get -Headers @{"x-api-key"="test"}
$llm.configured
# Esperado: true
# [ ] ✅/❌
```

### C5. Helper → n8n (webhook reenvío)

```powershell
# Simular mensaje inbound: helper reenvía a n8n
Invoke-RestMethod "http://localhost:3100/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=OK" -TimeoutSec 3
# Esperado: "OK" (webhook verify)
# [ ] ✅/❌
```

### C6. Helper → Twenty CRM (health)

```powershell
$twenty = Invoke-RestMethod "http://localhost:3100/api/twenty/health" -Method Get -Headers @{"x-api-key"="test"}
$twenty | ConvertTo-Json
# Esperado: status=ok o connected
# [ ] ✅/❌
```

### C7. Helper → Chatwoot (bridge push)

```powershell
Invoke-RestMethod "http://localhost:3100/api/chatwoot/push" -Method Post -Body (@{phone="+59170000000"; name="PruebaSSO"; message="Test de integracion"} | ConvertTo-Json) -ContentType "application/json" -Headers @{"x-api-key"="test"} -ErrorAction SilentlyContinue
# Esperado: status=created (si inbox configurado) o error de conexión (servicio OK)
# [ ] ✅/❌
```

### C8. n8n → Webhook helper (roundtrip)

```powershell
Invoke-WebRequest "http://localhost:5679/webhook/chatwoot-inbound" -Method Post -Body '{"message_type":"incoming","content":"test gateway"}' -ContentType "application/json" -UseBasicParsing -TimeoutSec 5
# Esperado: respuesta 200 o 202
# [ ] ✅/❌
```

---

## BLOQUE D — Logs de Integración (qué verificar)

### D1. Helper — Inicio sin errores

```powershell
docker logs wibsite-helper --tail 6 2>&1 | Select-String "error|Error|emerg|fatal"
# Esperado: SIN salida
# [ ] ✅/❌
```

### D2. nginx — Access log: rutas responden

```powershell
docker logs wibsite-nginx --tail 20 2>&1 | Select-String "GET|POST|PUT|DELETE" | Select-Object -Last 10
# Esperado: requests con HTTP 200, 301, 302 (sin 500s)
# [ ] ✅/❌
```

### D3. Authelia — Sin errores de configuración

```powershell
docker logs wibsite-authelia --tail 10 2>&1 | Select-String "error|fatal|emerg"
# Esperado: SIN salida
# [ ] ✅/❌
```

### D4. Postgres — Conexiones activas

```powershell
docker exec wibsite-postgres psql -U wibsite -c "SELECT count(*) FROM pg_stat_activity;" 2>&1
# Esperado: count >= 1
# [ ] ✅/❌
```

### D5. Redis — Conexión

```powershell
docker exec wibsite-redis redis-cli PING 2>&1
# Esperado: PONG
# [ ] ✅/❌
```

### D6. Audit logs — Eventos registrados

```powershell
$logs = Invoke-RestMethod "http://localhost:3100/api/logs?limit=5" -Method Get -Headers @{"x-api-key"="test"} -ErrorAction SilentlyContinue
$logs.data.Length
# Esperado: >= 0 (mínimo sin errores)
# [ ] ✅/❌
```

### D7. Docker — Todos los contenedores estables (sin restart loops)

```powershell
docker ps --filter name=wibsite --format "{{.Names}} {{.Status}}" | Select-String "Restarting|unhealthy"
# Esperado: SIN salida (ninguno en restarting/unhealthy)
# [ ] ✅/❌
```

---

## BLOQUE E — Verificación Rápida Unificada (un solo paso)

```powershell
# Ejecutar todo en un solo comando
$s = @{}
$s.authelia = "RUNNING" -eq (docker ps --filter name=wibsite-authelia --format "{{.State}}" 2>&1)
$s.nginx = (docker logs wibsite-nginx --tail 3 2>&1 | Select-String "emerg") -eq $null
try { $r = Invoke-RestMethod "http://localhost:3100/health" -TimeoutSec 3; $s.health = $r.status -eq "ok"; $s.pg = $r.dependencies.db -eq "postgresql"; $s.redis = $r.dependencies.redis -eq "available"; $s.weaviate = $r.dependencies.weaviate -eq "connected"; $s.llm = $r.dependencies.llm.configured } catch { $s.health = $false }
try { Invoke-RestMethod "http://localhost:8080/hub/" -TimeoutSec 3 -ErrorAction Stop | Out-Null; $s.hub = $true } catch { $s.hub = $false }
$allPass = ($s.Values -notcontains $false)
Write-Host ""
Write-Host "=== SSO + Gateway Verification ===" -ForegroundColor Cyan
Write-Host "Authelia        : $(if($s.authelia){'OK'}else{'FAIL'})"
Write-Host "Nginx (no err)  : $(if($s.nginx){'OK'}else{'FAIL'})"
Write-Host "Helper Health   : $(if($s.health){'OK'}else{'FAIL'})"
Write-Host "PostgreSQL      : $(if($s.pg){'OK'}else{'FAIL'})"
Write-Host "Redis           : $(if($s.redis){'OK'}else{'FAIL'})"
Write-Host "Weaviate        : $(if($s.weaviate){'OK'}else{'FAIL'})"
Write-Host "OpenRouter/LLM  : $(if($s.llm){'OK'}else{'FAIL'})"
Write-Host "Hub público     : $(if($s.hub){'OK'}else{'FAIL'})"
Write-Host ""
if ($allPass) { Write-Host "ALL SYSTEMS GO" -ForegroundColor Green } else { Write-Host "CHECK FAILURES ABOVE" -ForegroundColor Red }
```

---

## BLOQUE F — Resultado Esperado

| Verificación | Esperado | Bloque |
|-------------|----------|--------|
| Authelia running | healthy | A1 |
| Nginx sin errores | sin emerg | A2 |
| Rutas protegidas redirigen | 302 → /auth/ | A3 |
| Rutas públicas accesibles | 200 | A4 |
| API sin key retorna 401 | error msg | A5 |
| Proxy archivos estáticos | 200 + content | B1 |
| Proxy a helper | v2.2.0 | B2 |
| Proxy a n8n | 200 | B3 |
| Dify via SSO | 302 | B4 |
| Security headers | nosniff, SAMEORIGIN | B5 |
| Helper→PG | postgresql | C1 |
| Helper→Redis | available | C2 |
| Helper→Weaviate | connected | C3 |
| Helper→LLM | true | C4 |
| Helper→n8n | 200 OK | C5 |
| Helper→Twenty | status ok | C6 |
| Helper→Chatwoot | bridge activo | C7 |
| Helper logs limpios | sin errors | D1 |
| nginx access logs | sin 500 | D2 |
| Authelia logs limpios | sin error/fatal | D3 |
| PG conexiones | >= 1 | D4 |
| Redis PING | PONG | D5 |
| Audit logs | sin errores 500 | D6 |
| Contenedores estables | sin restarting | D7 |
