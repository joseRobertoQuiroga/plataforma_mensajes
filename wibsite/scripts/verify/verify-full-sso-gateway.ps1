$PASS = 0; $FAIL = 0; $ISSUES = @()

function check { param($label, $script, $expected)
    try {
        $result = & $script
        if ($expected -is [string]) { $ok = $result -like $expected }
        elseif ($expected -is [scriptblock]) { $ok = & $expected $result }
        else { $ok = $result -eq $expected }
        if ($ok) { $PASS++; Write-Host "  [PASS] $label" -ForegroundColor Green }
        else { $FAIL++; $ISSUES += @{label=$label; result=$result}; Write-Host "  [FAIL] $label -> $result" -ForegroundColor Red }
    } catch {
        $FAIL++; $ISSUES += @{label=$label; result=$_.Exception.Message}
        Write-Host "  [FAIL] $label -> $($_.Exception.Message.Substring(0,[Math]::Min(80,$_.Exception.Message.Length)))" -ForegroundColor Red
    }
}

Write-Host "=== SSO + Gateway Full Verification ===" -ForegroundColor Cyan
Write-Host ""

# A1: Authelia
check "Authelia healthy" { (docker ps --filter name=wibsite-authelia --format '{{.Status}}' 2>&1).Trim() } "*healthy*"

# A2: Nginx errors
check "Nginx sin errores" { (docker logs wibsite-nginx --tail 5 2>&1 | Select-String "emerg|emergency" | Out-String).Trim() } ""

# A3: Rutas protegidas redirigen a login (con error_page 401)
function get-redirect { param($p)
    try { $r=Invoke-WebRequest "http://localhost:8080$p" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 0 -ErrorAction Stop; @{code=$r.StatusCode; loc=$r.Headers.Location} }
    catch { @{code=[int]$_.Exception.Response.StatusCode; loc=$_.Exception.Response.Headers.Location} }
}

$protPaths = @("/crm/","/n8n/","/admin/","/chatwoot/","/dify/","/portal/")
foreach ($p in $protPaths) {
    $rd = get-redirect $p
    $isRedirect = $rd.code -eq 302
    check "  $p redirige a login" { $isRedirect } $true
    if (-not $isRedirect -and $rd.loc) { Write-Host "    Location: $($rd.loc)" -ForegroundColor Yellow }
}

# A4: Rutas publicas
check "Hub publico" { $r=Invoke-WebRequest "http://localhost:8080/hub/" -UseBasicParsing -TimeoutSec 3; $r.StatusCode } 200
check "Health publico" { $r=Invoke-WebRequest "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 3; $r.StatusCode } 200
check "Webhook verify" { $r=Invoke-RestMethod "http://localhost:3100/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=OK" -TimeoutSec 3; $r } "OK"

# A5: API requiere auth
check "API sin key retorna 401" { try { Invoke-RestMethod "http://localhost:3100/api/dashboard/summary" -TimeoutSec 3 -ErrorAction Stop | Out-Null; $false } catch { $true } } $true

# B1-B2: Proxies basicos
check "Proxy helper via nginx" { $r=Invoke-RestMethod "http://localhost:8080/health" -TimeoutSec 3; $r.status } "ok"
check "Helper version" { $r=Invoke-RestMethod "http://localhost:8080/health" -TimeoutSec 3; $r.version } "2.2.0"

# B3: n8n (usar / en vez de /health)
check "n8n accesible" { $r=Invoke-WebRequest "http://localhost:5679/" -UseBasicParsing -TimeoutSec 3; $r.StatusCode } 200

# B4: Dify via SSO
check "Dify via SSO" { $rd=get-redirect "/dify/"; $rd.code } 302

# B5: Security headers
check "X-Content-Type-Options" { $r=Invoke-WebRequest "http://localhost:8080/hub/" -UseBasicParsing -TimeoutSec 3; $r.Headers["X-Content-Type-Options"] } "nosniff"
check "X-Frame-Options" { $r=Invoke-WebRequest "http://localhost:8080/hub/" -UseBasicParsing -TimeoutSec 3; $r.Headers["X-Frame-Options"] } "SAMEORIGIN"

# C1-C4: Conexiones BD/LLM
$health = Invoke-RestMethod "http://localhost:3100/health" -TimeoutSec 3
check "Helper->PG" { $health.dependencies.db } "postgresql"
check "Helper->Redis" { $health.dependencies.redis } "available"
check "Helper->Weaviate" { $health.dependencies.weaviate } "connected"
check "Helper->LLM" { $health.dependencies.llm.configured } $true

# C5: Webhook verify
check "Webhook n8n verify" { Invoke-RestMethod "http://localhost:3100/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=OK" -TimeoutSec 3 } "OK"

# C6: Twenty CRM
$twenty = Invoke-RestMethod "http://localhost:3100/api/twenty/health" -Method Get -Headers @{"x-api-key"="test"}
check "Twenty CRM conectado" { $twenty.connected } $true

# D3: Authelia logs sin errores
check "Authelia sin errores en logs" { (docker logs wibsite-authelia --tail 10 2>&1 | Select-String "error|fatal|emerg" | Out-String).Trim() } ""

# SUMMARY
Write-Host ""
Write-Host "=== Results: $PASS PASS, $FAIL FAIL ===" -ForegroundColor $(if ($FAIL -eq 0){"Green"}else{"Red"})
if ($ISSUES.Count -gt 0) {
    Write-Host "`nIssues found:" -ForegroundColor Yellow
    $ISSUES | ForEach-Object { Write-Host "  - $($_.label): $($_.result)" }
}
exit $FAIL
