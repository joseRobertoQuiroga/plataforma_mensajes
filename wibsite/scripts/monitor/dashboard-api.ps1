# Wibsite - API Dashboard CLI
param([switch]$watch)

$HELPER = "http://localhost:3100"
$AUTH = @{"x-api-key"="test"}

$endpoints = @(
    @{name="Health"; method="GET"; path="/health"; expect=200},
    @{name="Dashboard"; method="GET"; path="/api/dashboard/summary"; auth=$true; expect=200},
    @{name="Campaigns"; method="GET"; path="/api/campaigns"; auth=$true; expect=200},
    @{name="Channels"; method="GET"; path="/api/channels"; auth=$true; expect=200},
    @{name="Scoring Rules"; method="GET"; path="/api/scoring/rules"; auth=$true; expect=200},
    @{name="Templates"; method="GET"; path="/api/templates"; auth=$true; expect=200},
    @{name="Agent Templates"; method="GET"; path="/api/agent/templates"; auth=$true; expect=200},
    @{name="Template Validate"; method="GET"; path="/api/agent/templates/validate"; auth=$true; expect=200},
    @{name="Agent Graph"; method="POST"; path="/api/agent/test-graph"; auth=$true; body=$true; expect=200},
    @{name="LLM Health"; method="GET"; path="/api/llm/health"; auth=$true; expect=200},
    @{name="Twenty Health"; method="GET"; path="/api/twenty/health"; auth=$true; expect=200},
    @{name="Audit Logs"; method="GET"; path="/api/logs"; auth=$true; expect=200},
    @{name="Search Leads"; method="GET"; path="/api/leads/search?q=test"; auth=$true; expect=200},
    @{name="Webhook GET"; method="GET"; path="/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=OK"; expect=200},
    @{name="SLI Metrics"; method="GET"; path="/api/sli/metrics"; auth=$true; expect=200}
)

function Show-APIDashboard {
    Clear-Host
    Write-Host "=== Wibsite API Dashboard ===" -ForegroundColor Cyan
    Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Gray
    
    $pass=0; $fail=0; $total=0; $totalLat=0
    
    foreach ($ep in $endpoints) {
        $total++
        $url = "$HELPER$($ep.path)"
        $start = Get-Date
        
        try {
            $params = @{Uri=$url; Method=$ep.method; TimeoutSec=5; UseBasicParsing=$true}
            if ($ep.auth) { $params.Headers = $AUTH }
            if ($ep.body) { 
                $params.Body = '{"message":"test"}'
                $params.ContentType = "application/json"
            }
            $r = Invoke-WebRequest @params
            $ms = [math]::Round(((Get-Date) - $start).TotalMilliseconds, 0)
            $totalLat += $ms
            
            if ($r.StatusCode -eq $ep.expect) { $pass++; $c="Green"; $i="[OK]" }
            else { $fail++; $c="Yellow"; $i="[??]" }
            Write-Host " $i $($ep.name.PadRight(22)) ${ms}ms $($r.StatusCode)" -ForegroundColor $c
        } catch {
            $ms = [math]::Round(((Get-Date) - $start).TotalMilliseconds, 0)
            $fail++; $c="Red"
            $code = if ($_.Exception.Response.StatusCode) { [int]$_.Exception.Response.StatusCode } else { "ERR" }
            Write-Host " [XX] $($ep.name.PadRight(22)) ${ms}ms $code" -ForegroundColor $c
        }
    }
    
    $avg = if ($total -gt 0) { [math]::Round($totalLat/$total, 0) } else { 0 }
    $pct = if ($total -gt 0) { [math]::Round($pass/$total*100, 0) } else { 0 }
    
    Write-Host "`n--- Summary ---" -ForegroundColor Yellow
    Write-Host " $pass/$total OK, $fail Failed, Avg ${avg}ms, ${pct}% Health" -ForegroundColor $(if($pct -ge 90){"Green"}else{"Red"})
}

do {
    Show-APIDashboard
    if ($watch) { Start-Sleep -Seconds 10; Write-Host "Refreshing..." -ForegroundColor DarkGray }
} while ($watch)
