# Wibsite - CLI Validation Suite
$HELPER = "http://localhost:3100"
$pass = 0; $fail = 0; $total = 0

function Test-Check {
    param([string]$Name, [ScriptBlock]$Script)
    $script:total++
    try {
        $result = & $Script
        if ($result) { $script:pass++; Write-Host "  [+] $Name" -ForegroundColor Green }
        else { $script:fail++; Write-Host "  [x] $Name" -ForegroundColor Red }
    } catch {
        $script:fail++; Write-Host "  [x] $Name : $_" -ForegroundColor Red
    }
}

Write-Host "=== Wibsite CLI Validation Suite ===" -ForegroundColor Cyan

# 1. Health
Test-Check "Helper Health" { (Invoke-RestMethod "$HELPER/health" -TimeoutSec 5).status -eq "ok" }
Test-Check "Version 2.2.0" { (Invoke-RestMethod "$HELPER/health" -TimeoutSec 5).version -eq "2.2.0" }

# 2. Dependencies
Test-Check "PostgreSQL connected" { (Invoke-RestMethod "$HELPER/health" -TimeoutSec 5).dependencies.db -eq "postgresql" }
Test-Check "LLM configured" { (Invoke-RestMethod "$HELPER/health" -TimeoutSec 5).dependencies.llm.configured -eq $true }
Test-Check "Weaviate available" { (Invoke-RestMethod "$HELPER/health" -TimeoutSec 5).dependencies.weaviate -eq "connected" }
Test-Check "Redis available" { (Invoke-RestMethod "$HELPER/health" -TimeoutSec 5).dependencies.redis -eq "available" }

# 3. Campaign
Test-Check "Campaign list" { (Invoke-RestMethod "$HELPER/api/campaigns" -Method Get -Headers @{"x-api-key"="test"}).total -ge 0 }
Test-Check "Channels list" { (Invoke-RestMethod "$HELPER/api/channels" -Method Get -Headers @{"x-api-key"="test"}).Length -ge 5 }

# 4. Templates
$tpl = Invoke-RestMethod "$HELPER/api/agent/templates" -Method Get -Headers @{"x-api-key"="test"}
Test-Check "Agent templates exist" { $tpl.data.Length -ge 1 }

$valid = Invoke-RestMethod "$HELPER/api/agent/templates/validate" -Method Get -Headers @{"x-api-key"="test"}
Test-Check "Templates valid" { ($valid.data | Where-Object { $_.valid }).Length -eq $valid.data.Length }

# 5. Agent Core
$graph = Invoke-RestMethod "$HELPER/api/agent/test-graph" -Method Post -Body (@{message="test"} | ConvertTo-Json) -ContentType "application/json" -Headers @{"x-api-key"="test"}
Test-Check "Agent graph executes" { $graph.context.turnCount -gt 0 }

# 6. Export
$camp = (Invoke-RestMethod "$HELPER/api/campaigns" -Method Get -Headers @{"x-api-key"="test"}).data[0]
if ($camp) {
    $csv = Invoke-RestMethod "$HELPER/api/campaigns/$($camp.id)/export" -Method Get -Headers @{"x-api-key"="test"}
    Test-Check "Campaign export CSV" { $csv.Length -gt 0 }
}

# 7. LLM
try {
    $llmBody = @{messages=@(@{role="user"; content="Hola, prueba"})} | ConvertTo-Json
    $llm = Invoke-RestMethod "$HELPER/api/llm/chat" -Method Post -Body $llmBody -ContentType "application/json" -Headers @{"x-api-key"="test"} -TimeoutSec 20
    Test-Check "LLM responds" { $llm.choices[0].message.content.Length -gt 0 }
} catch {
    $resp = $_.Exception.Response
    if ($resp.StatusCode -eq 400) {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $body = $reader.ReadToEnd()
        Test-Check "LLM responds" { $false }
        Write-Host "  LLM details: $body" -ForegroundColor Yellow
    } else {
        Test-Check "LLM responds" { $false }
    }
}

# 8. Dashboard summary
$dash = Invoke-RestMethod "$HELPER/api/dashboard/summary" -Method Get -Headers @{"x-api-key"="test"}
Test-Check "Dashboard has data" { $dash.campaigns.total -ge 0 }

# Results
Write-Host "`n=== Results: $pass/$total passed, $fail failed ===" -ForegroundColor Cyan
exit $fail
