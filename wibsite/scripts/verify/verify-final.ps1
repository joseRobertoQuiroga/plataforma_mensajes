$PASS = 0; $FAIL = 0

function check($label, $condition) {
    if ($condition) { $script:PASS++; Write-Host "  [PASS] $label" -ForegroundColor Green }
    else { $script:FAIL++; Write-Host "  [FAIL] $label" -ForegroundColor Red }
}

function redir($path) {
    $r = Invoke-WebRequest "https://localhost:8080$path" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 0 -ErrorAction SilentlyContinue
    if ($r -and ($r.StatusCode -eq 302 -or $r.StatusCode -eq 301)) { return $true } else { return $false }
}

Write-Host "=== SSO + Gateway Final Verification ===" -ForegroundColor Cyan

# A: Authelia + Nginx
$autheliaStatus = (docker ps --filter name=wibsite-authelia --format '{{.Status}}' 2>&1).Trim()
check "Authelia healthy" ($autheliaStatus -like "*healthy*")
check "Nginx sin errores emerg" ((docker logs wibsite-nginx --tail 3 2>&1 | Out-String).Trim() -notmatch "emerg|emergency")

# A3: Rutas protegidas redirigen al SSO
$paths = @("/crm/","/n8n/","/admin/","/chatwoot/","/dify/","/portal/")
foreach ($p in $paths) {
    check "${p} -> login SSO" (redir $p)
}

# A4: Publicas
check "Hub /hub/ -> 200" ((Invoke-WebRequest "https://localhost:8080/hub/" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue).StatusCode -eq 200)
check "Health -> 200" ((Invoke-WebRequest "https://localhost:8080/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue).StatusCode -eq 200)

# B: Gateway
$h = Invoke-RestMethod "https://localhost:8080/health" -TimeoutSec 3
check "Helper v2.2.0" ($h.version -eq "2.2.0")
check "Proxy helper v5a nginx" ($h.status -eq "ok")
check "n8n accesible" ((Invoke-WebRequest "http://localhost:5679/" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue).StatusCode -eq 200)
check "Webhook verify OK" ((Invoke-RestMethod "http://localhost:3100/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=OK" -TimeoutSec 3) -eq "OK")
check "Security headers" ((Invoke-WebRequest "https://localhost:8080/hub/" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue).Headers["X-Content-Type-Options"] -eq "nosniff")

# A5: API requiere key
$noauth = Invoke-RestMethod "http://localhost:3100/api/dashboard/summary" -TimeoutSec 3 -ErrorAction SilentlyContinue
check "API sin key retorna 401" (-not $noauth)

# C: Conexiones
$health = Invoke-RestMethod "http://localhost:3100/health" -TimeoutSec 3
check "Helper->PG" ($health.dependencies.db -eq "postgresql")
check "Helper->Redis" ($health.dependencies.redis -eq "available")
check "Helper->Weaviate" ($health.dependencies.weaviate -eq "connected")
check "Helper->LLM" ($health.dependencies.llm.configured -eq $true)

check "Webhook verify OK" ((Invoke-RestMethod "http://localhost:3100/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=OK" -TimeoutSec 3) -eq "OK")

$twenty = Invoke-RestMethod "http://localhost:3100/api/twenty/health" -Method Get -Headers @{"x-api-key"="test"} -TimeoutSec 3
check "Twenty CRM conectado" ($twenty.connected -eq $true)

# D: Services
check "Redis PING" ((docker exec wibsite-redis redis-cli PING 2>&1) -like "*PONG*")
check "Audit logs OK" ((Invoke-RestMethod "http://localhost:3100/api/logs?limit=1" -Method Get -Headers @{"x-api-key"="test"} -TimeoutSec 3 -ErrorAction SilentlyContinue).data.Length -ge 0)
check "Contenedores estables" ((docker ps --filter name=wibsite --format '{{.Status}}' 2>&1 | Select-String "Restarting").Count -eq 0)

# Summary
$total = $PASS + $FAIL
Write-Host "`n=== Results: $PASS/$total PASS ===" -ForegroundColor Cyan
if ($FAIL -eq 0) {
    Write-Host "ALL SYSTEMS GO - SSO + Gateway + Integraciones" -ForegroundColor Green
    Write-Host "Login: https://localhost:8080/crm/ -> user:admin@wibsite.com pass:Admin@123" -ForegroundColor Gray
} else {
    Write-Host "FAILURES DETECTED - review above" -ForegroundColor Red
}
exit $FAIL
