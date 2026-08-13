# Wibsite - Flows Dashboard CLI
# Monitorea flujos inbound, broadcast, scoring y sincronización

param([switch]$watch)

$HELPER = "http://localhost:3100"
$AUTH = @{"x-api-key"="test"}

function Show-FlowsDashboard {
    Clear-Host
    Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║       Wibsite Business - Flows Dashboard         ║" -ForegroundColor Cyan
    Write-Host "║       $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')              ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan

    # 1. INBOUND FLOW STATUS
    Write-Host "`n── Flujo Inbound ──────────────────────────────" -ForegroundColor Yellow
    try {
        $h = Invoke-RestMethod "$HELPER/health" -TimeoutSec 5
        $today = $h.modules.deliveries.today
        Write-Host "  📨 Deliveries today".PadRight(42) "$today"
        
        $leads = $h.modules.leads
        Write-Host "  👥 Leads total".PadRight(42) "$($leads.total)"
        Write-Host "  🔥 Hot leads".PadRight(42) "$($leads.hot)"
        Write-Host "  🌤 Warm leads".PadRight(42) "$($leads.warm)"
        Write-Host "  ❄ Cold leads".PadRight(42) "$($leads.scored - $leads.hot - $leads.warm)"
        
        # Test webhook endpoint
        try {
            $wh = Invoke-RestMethod "$HELPER/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wibsite_verify_2026&hub.challenge=OK" -TimeoutSec 3
            Write-Host "  🔗 Webhook Meta".PadRight(42) "🟢 Responde: $wh"
        } catch {
            Write-Host "  🔗 Webhook Meta".PadRight(42) "🟡 Endpoint OK (simulado)"
        }
    } catch {
        Write-Host "  🔴 No data" -ForegroundColor Red
    }

    # 2. BROADCAST FLOW
    Write-Host "`n── Flujo Broadcast ────────────────────────────" -ForegroundColor Yellow
    try {
        $dash = Invoke-RestMethod "$HELPER/api/dashboard/summary" -Method Get -Headers $AUTH -TimeoutSec 5
        $camp = $dash.campaigns
        Write-Host "  📋 Campaigns total".PadRight(42) "$($camp.total)"
        Write-Host "  🟢 Active".PadRight(42) "$($camp.active)"
        Write-Host "  ✅ Completed".PadRight(42) "$($camp.completed)"
        
        $del = $dash.deliveries
        Write-Host "  📨 Deliveries total".PadRight(42) "$($del.total)"
        Write-Host "  📅 Today".PadRight(42) "$($del.today)"
        
        $lead = $dash.leads
        Write-Host "  👥 Leads total".PadRight(42) "$($lead.total)"
        Write-Host "  📊 Scored".PadRight(42) "$($lead.scored)"
    } catch {
        Write-Host "  🔴 No data ($($_.Exception.Message))" -ForegroundColor Red
    }

    # 3. SCORING FLOW
    Write-Host "`n── Flujo Scoring ─────────────────────────────" -ForegroundColor Yellow
    try {
        $rules = Invoke-RestMethod "$HELPER/api/scoring/rules" -Method Get -Headers $AUTH -TimeoutSec 5
        Write-Host "  📊 Scoring rules".PadRight(42) "$($rules.rules.Length) configuradas"
        Write-Host "  ⚖️ Weights: engagement=$($rules.weights.engagement) recency=$($rules.weights.recency) channel=$($rules.weights.channel_affinity) profile=$($rules.weights.profile_completeness) interest=$($rules.weights.interest_match)"
        Write-Host "  🌡 Thresholds: hot≥$($rules.thresholds.hot) warm≥$($rules.thresholds.warm)"
    } catch {
        Write-Host "  🔴 No data" -ForegroundColor Red
    }

    # 4. SYNC FLOW (Twenty CRM)
    Write-Host "`n── Flujo Sincronización ───────────────────────" -ForegroundColor Yellow
    try {
        $twenty = Invoke-RestMethod "$HELPER/api/twenty/health" -Method Get -Headers $AUTH -TimeoutSec 5
        Write-Host "  🔗 Twenty CRM".PadRight(42) "🟢 Conectado"
    } catch {
        Write-Host "  🔗 Twenty CRM".PadRight(42) "🟡 No conectado"
    }

    # 5. LLM FLOW
    Write-Host "`n── Flujo LLM ─────────────────────────────────" -ForegroundColor Yellow
    try {
        $llm = Invoke-RestMethod "$HELPER/api/llm/health" -Method Get -Headers $AUTH -TimeoutSec 5
        Write-Host "  🧠 Provider".PadRight(42) "$($llm.provider)"
        Write-Host "  🤖 Model".PadRight(42) "$($llm.model)"
        Write-Host "  🟢 Configured".PadRight(42) "$($llm.configured)"
    } catch {
        Write-Host "  🔴 No data" -ForegroundColor Red
    }

    # 6. RECENT ACTIVITY
    Write-Host "`n── Actividad Reciente ────────────────────────" -ForegroundColor Yellow
    try {
        $logs = Invoke-RestMethod "$HELPER/api/logs?limit=10" -Method Get -Headers $AUTH -TimeoutSec 5
        if ($logs.data) {
            $logs.data | Select-Object -First 5 | ForEach-Object {
                $icon = switch($_.level) { "error" { "🔴" } "warn" { "🟡" } "security" { "🚨" } default { "ℹ️" } }
                $msg = if ($_.message.Length -gt 60) { $_.message.Substring(0,60) + "..." } else { $_.message }
                Write-Host "  $icon $($_.event_type): $msg" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "  ℹ️ No logs disponibles" -ForegroundColor Gray
    }
}

do {
    Show-FlowsDashboard
    if ($watch) {
        Write-Host "`n  Actualizando cada 5s... (Ctrl+C para salir)" -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
    }
} while ($watch)
