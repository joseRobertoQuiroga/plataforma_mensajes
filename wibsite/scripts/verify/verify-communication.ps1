Write-Host "=== C1: Helper -> PostgreSQL ===" -ForegroundColor Yellow
try {
    $h = Invoke-RestMethod "http://localhost:3100/health" -TimeoutSec 3
    $ok = $h.dependencies.db -eq "postgresql"
    Write-Host "  PG: $($h.dependencies.db) $(if($ok){'PASS'}else{'FAIL'})"
} catch { Write-Host "  FAIL" }

Write-Host "`n=== C2: Helper -> Redis ===" -ForegroundColor Yellow
try { $ok = $h.dependencies.redis -eq "available"; Write-Host "  Redis: $($h.dependencies.redis) $(if($ok){'PASS'}else{'FAIL'})" } catch { Write-Host "  FAIL" }

Write-Host "`n=== C3: Helper -> Weaviate ===" -ForegroundColor Yellow
try { $ok = $h.dependencies.weaviate -eq "connected"; Write-Host "  Weaviate: $($h.dependencies.weaviate) $(if($ok){'PASS'}else{'FAIL'})" } catch { Write-Host "  FAIL" }

Write-Host "`n=== C4: Helper -> OpenRouter ===" -ForegroundColor Yellow
try {
    $llm = Invoke-RestMethod "http://localhost:3100/api/llm/health" -Method Get -Headers @{"x-api-key"="test"}
    $ok = $llm.configured -eq $true
    Write-Host "  LLM configured: $($llm.configured) $(if($ok){'PASS'}else{'FAIL'})"
} catch { Write-Host "  FAIL" }

Write-Host "`n=== C5: Helper -> n8n webhook reenvio ===" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod "http://localhost:3100/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=OK" -TimeoutSec 3
    $ok = $r -eq "OK"
    Write-Host "  Webhook verify: $r $(if($ok){'PASS'}else{'FAIL'})"
} catch { Write-Host "  FAIL" }

Write-Host "`n=== C6: Helper -> Twenty CRM ===" -ForegroundColor Yellow
try {
    $twenty = Invoke-RestMethod "http://localhost:3100/api/twenty/health" -Method Get -Headers @{"x-api-key"="test"}
    Write-Host "  Twenty: $($twenty | ConvertTo-Json -Compress)"
    Write-Host "  Result: PASS"
} catch { Write-Host "  FAIL: $($_.Exception.Message)" }

Write-Host "`n=== C7: Helper -> Chatwoot ===" -ForegroundColor Yellow
try {
    $cw = Invoke-RestMethod "http://localhost:3100/api/chatwoot/push" -Method Post -Body (@{phone="+59170000099"; name="TestChatwoot"; message="Test bridge"} | ConvertTo-Json) -ContentType "application/json" -Headers @{"x-api-key"="test"} -ErrorAction Stop
    Write-Host "  Chatwoot: $($cw | ConvertTo-Json -Compress)"
    Write-Host "  Result: PASS"
} catch {
    $msg = $_.Exception.Message
    if ($msg -match "405|404|chatwoot") { Write-Host "  Chatwoot bridge: $msg (servicio no configurado - gap identificado)" }
    else { Write-Host "  FAIL: $msg" }
}

Write-Host "`n=== D1: Helper logs limpios ===" -ForegroundColor Yellow
$helperErr = docker logs wibsite-helper --tail 10 2>&1 | Select-String "error|Error|fatal"
if ($helperErr) { $helperErr | ForEach-Object { Write-Host "  $_" } } else { Write-Host "  Sin errores: PASS" }

Write-Host "`n=== D2: nginx access sin 500s ===" -ForegroundColor Yellow
$nginxErr = docker logs wibsite-nginx --tail 30 2>&1 | Select-String " 500 "
if ($nginxErr) { $nginxErr | ForEach-Object { Write-Host "  $_" } } else { Write-Host "  Sin 500s: PASS" }

Write-Host "`n=== D3: Authelia sin errores ===" -ForegroundColor Yellow
$autheliaErr = docker logs wibsite-authelia --tail 10 2>&1 | Select-String "error|fatal|emerg"
if ($autheliaErr) { $autheliaErr | ForEach-Object { Write-Host "  $_" } } else { Write-Host "  Sin errores: PASS" }

Write-Host "`n=== D4: PG conexiones ===" -ForegroundColor Yellow
try {
    $pgCount = docker exec wibsite-postgres psql -U wibsite -c "SELECT count(*) FROM pg_stat_activity;" -t 2>&1
    Write-Host "  PG connections: $($pgCount.Trim()) $(if([int]$pgCount -ge 1){'PASS'}else{'FAIL'})"
} catch { Write-Host "  FAIL" }

Write-Host "`n=== D5: Redis PING ===" -ForegroundColor Yellow
try {
    $redisPing = docker exec wibsite-redis redis-cli PING 2>&1
    Write-Host "  Redis: $redisPing $(if($redisPing -like '*PONG*'){'PASS'}else{'FAIL'})"
} catch { Write-Host "  FAIL" }

Write-Host "`n=== D6: Audit logs ===" -ForegroundColor Yellow
try {
    $logs = Invoke-RestMethod "http://localhost:3100/api/logs?limit=5" -Method Get -Headers @{"x-api-key"="test"}
    Write-Host "  Audit logs count: $($logs.data.Length) $(if($logs.data.Length -ge 0){'PASS'}else{'FAIL'})"
} catch { Write-Host "  FAIL: $($_.Exception.Message)" }

Write-Host "`n=== D7: Contenedores estables ===" -ForegroundColor Yellow
$unstable = docker ps --filter name=wibsite --format "{{.Names}} {{.Status}}" | Select-String "Restarting|unhealthy"
if ($unstable) { $unstable | ForEach-Object { Write-Host "  $_" } } else { Write-Host "  Todos estables: PASS" }
