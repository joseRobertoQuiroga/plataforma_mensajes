# Wibsite - System Dashboard CLI
# Uso: .\dashboard-system.ps1 [-watch] para auto-refresh cada 5s

param([switch]$watch)

$HELPER = "http://localhost:3100"
$HUB = "http://localhost:8080"

function Color-Status {
    param($status)
    switch($status) {
        "ok" { return "🟢" }
        "connected" { return "🟢" }
        "available" { return "🟢" }
        "healthy" { return "🟢" }
        "degraded" { return "🟡" }
        "error" { return "🔴" }
        "unavailable" { return "🔴" }
        "disconnected" { return "🔴" }
        default { return "⚪" }
    }
}

function Show-Dashboard {
    Clear-Host
    Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║       Wibsite Business - System Dashboard        ║" -ForegroundColor Cyan
    Write-Host "║       $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')              ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
    
    # 1. CONTAINER STATUS
    Write-Host "`n── Contenedores ──────────────────────────────" -ForegroundColor Yellow
    $containers = docker ps --format "{{.Names}}|{{.Status}}" 2>&1
    $containers | ForEach-Object {
        $parts = $_ -split '\|'
        $name = $parts[0] -replace 'wibsite-', ''
        $status = $parts[1]
        if ($status -match 'Up|healthy') { $icon = "🟢" } elseif ($status -match 'Restart|unhealthy') { $icon = "🔴" } else { $icon = "⚪" }
        Write-Host "  $icon $name".PadRight(42) "$status"
    }
    
    # 2. HELPER HEALTH
    Write-Host "`n── Helper Node ───────────────────────────────" -ForegroundColor Yellow
    try {
        $h = Invoke-RestMethod "$HELPER/health" -TimeoutSec 5
        Write-Host "  $(Color-Status $h.status) Version".PadRight(42) "$($h.version)"
        Write-Host "  $(Color-Status $h.dependencies.db) Database".PadRight(42) "$($h.dependencies.db)"
        Write-Host "  $(Color-Status ($h.dependencies.llm.configured -eq $true ? 'connected' : 'disconnected')) LLM".PadRight(42) "$($h.dependencies.llm.model)"
        Write-Host "  $(Color-Status $h.dependencies.weaviate) Weaviate".PadRight(42) "$($h.dependencies.weaviate)"
        Write-Host "  $(Color-Status $h.dependencies.redis) Redis".PadRight(42) "$($h.dependencies.redis)"
        Write-Host "  ⏱ Uptime".PadRight(42) "$($h.uptime.human)"
        Write-Host "  📊 SLI Error Rate".PadRight(42) "$($h.sli.errorRate)"
        Write-Host "  📊 SLI Avg Latency".PadRight(42) "$($h.sli.avgLatencyMs)ms"
        Write-Host "  📊 Delivery Success 24h".PadRight(42) "$($h.sli.deliverySuccessRate24h)"
    } catch {
        Write-Host "  🔴 Helper Node: NO RESPONDE ($($_.Exception.Message))" -ForegroundColor Red
    }
    
    # 3. MODULES OVERVIEW
    Write-Host "`n── Módulos ───────────────────────────────────" -ForegroundColor Yellow
    try {
        $h = Invoke-RestMethod "$HELPER/health" -TimeoutSec 5
        Write-Host "  📦 Campaigns".PadRight(42) "$($h.modules.campaigns.total) total, $($h.modules.campaigns.active) active"
        Write-Host "  👥 Leads".PadRight(42) "$($h.modules.leads.total) total, $($h.modules.leads.scored) scored"
        Write-Host "  🔥 Hot/Warm".PadRight(42) "$($h.modules.leads.hot) hot / $($h.modules.leads.warm) warm"
        Write-Host "  📨 Deliveries".PadRight(42) "$($h.modules.deliveries.total) total, $($h.modules.deliveries.today) today"
        Write-Host "  📊 Scores".PadRight(42) "$($h.modules.scores.total) total, $($h.modules.scores.llmBased) LLM-based"
        Write-Host "  💬 Conversations".PadRight(42) "$($h.modules.conversations.active) active"
        Write-Host "  📚 KB Documents".PadRight(42) "$($h.modules.knowledgeBase.documents)"
    } catch { Write-Host "  🔴 No data" -ForegroundColor Red }
    
    # 4. EXTERNAL SERVICES
    Write-Host "`n── Servicios Externos ────────────────────────" -ForegroundColor Yellow
    $services = @(
        @{name="Hub"; url=$HUB; path="/hub/"},
        @{name="Twenty CRM"; url="http://localhost:3001"; path="/"},
        @{name="Dify"; url="http://localhost:3003"; path="/"},
        @{name="n8n"; url="http://localhost:5679"; path="/health"},
        @{name="Chatwoot"; url="http://localhost:3002"; path="/"}
    )
    foreach ($svc in $services) {
        try {
            $r = Invoke-WebRequest "$($svc.url)$($svc.path)" -TimeoutSec 3 -UseBasicParsing
            $icon = if ($r.StatusCode -eq 200 -or $r.StatusCode -eq 302 -or $r.StatusCode -eq 301) { "🟢" } else { "🟡" }
            Write-Host "  $icon $($svc.name)".PadRight(42) "HTTP $($r.StatusCode)"
        } catch {
            Write-Host "  🔴 $($svc.name)".PadRight(42) "NO RESPONDE"
        }
    }
}

do {
    Show-Dashboard
    if ($watch) {
        Write-Host "`n  Actualizando cada 5s... (Ctrl+C para salir)" -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
    }
} while ($watch)
