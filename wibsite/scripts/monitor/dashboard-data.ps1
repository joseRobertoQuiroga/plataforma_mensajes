# Wibsite - Data Dashboard CLI
# Muestra estado detallado de datos: campañas, leads, entregas, scores

param([switch]$watch, [int]$top=5)

$HELPER = "http://localhost:3100"
$AUTH = @{"x-api-key"="test"}

function Show-DataDashboard {
    Clear-Host
    Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║       Wibsite Business - Data Dashboard          ║" -ForegroundColor Cyan
    Write-Host "║       $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')              ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan

    # 1. CAMPAIGNS
    Write-Host "`n── Campañas ──────────────────────────────────" -ForegroundColor Yellow
    try {
        $camps = Invoke-RestMethod "$HELPER/api/campaigns" -Method Get -Headers $AUTH -TimeoutSec 5
        Write-Host "  Total: $($camps.total)" -ForegroundColor White
        Write-Host "  Últimas campañas:" -ForegroundColor Gray
        $camps.data | Select-Object -First $top | ForEach-Object {
            $icon = switch($_.status) { 
                "sending" { "🟢" } "scheduled" { "🔵" } "completed" { "✅" } 
                "paused" { "⏸" } "failed" { "🔴" } "draft" { "⚪" } default { "📋" } 
            }
            $stats = "S:$($_.sent_count) D:$($_.delivered_count) R:$($_.read_count) F:$($_.failed_count)"
            Write-Host "  $icon $($_.name.PadRight(25)) $($_.channel.PadRight(10)) $($_.status.PadRight(12)) $stats"
        }
    } catch {
        Write-Host "  🔴 No data" -ForegroundColor Red
    }

    # 2. TOP LEADS
    Write-Host "`n── Top Leads ─────────────────────────────────" -ForegroundColor Yellow
    try {
        $leads = Invoke-RestMethod "$HELPER/api/leads/top?limit=$top" -Method Get -Headers $AUTH -TimeoutSec 5
        Write-Host "  Mejores leads por score:" -ForegroundColor Gray
        $leads | ForEach-Object {
            $cat = if ($_.score -ge 70) { "🔥" } elseif ($_.score -ge 40) { "🌤" } else { "❄" }
            $name = if ($_.name) { $_.name } else { "Sin nombre" }
            Write-Host "  $cat $($name.PadRight(25)) Score: $($_.score)".PadRight(15) "$($_.status)"
        }
    } catch {
        Write-Host "  🔴 No data" -ForegroundColor Red
    }

    # 3. SCORING DISTRIBUTION
    Write-Host "`n── Distribución Scoring ──────────────────────" -ForegroundColor Yellow
    try {
        $h = Invoke-RestMethod "$HELPER/health" -TimeoutSec 5
        $hot = $h.modules.leads.hot
        $warm = $h.modules.leads.warm
        $total = $h.modules.leads.scored
        $cold = $total - $hot - $warm
        
        $barLen = 30
        $hotBar = [math]::Round($hot / [math]::Max($total,1) * $barLen)
        $warmBar = [math]::Round($warm / [math]::Max($total,1) * $barLen)
        $coldBar = $barLen - $hotBar - $warmBar
        
        Write-Host "  🔥 Hot  $hot".PadRight(10) "$('█' * $hotBar)$('░' * ($barLen - $hotBar))" -ForegroundColor Red
        Write-Host "  🌤 Warm $warm".PadRight(10) "$('█' * $warmBar)$('░' * ($barLen - $warmBar))" -ForegroundColor Yellow
        Write-Host "  ❄ Cold $cold".PadRight(10) "$('█' * $coldBar)$('░' * ($barLen - $coldBar))" -ForegroundColor Gray
    } catch {
        Write-Host "  🔴 No data" -ForegroundColor Red
    }

    # 4. CHANNEL STATUS
    Write-Host "`n── Canales ──────────────────────────────────" -ForegroundColor Yellow
    try {
        $channels = Invoke-RestMethod "$HELPER/api/channels" -Method Get -Headers $AUTH -TimeoutSec 5
        $channels | ForEach-Object {
            $icon = switch($_.status) { 
                "connected" { "🟢" } "disconnected" { "🔴" } 
                "error" { "🔴" } "pending" { "🟡" } default { "⚪" } 
            }
            Write-Host "  $icon $($_.channel.PadRight(15)) $($_.status.PadRight(15)) $($_.status_message)"
        }
    } catch {
        Write-Host "  🔴 No data" -ForegroundColor Red
    }

    # 5. RECENT ERRORS
    Write-Host "`n── Últimos Errores ──────────────────────────" -ForegroundColor Yellow
    try {
        $errLogs = Invoke-RestMethod "$HELPER/api/logs?level=error&limit=5" -Method Get -Headers $AUTH -TimeoutSec 5
        if ($errLogs.data.Length -gt 0) {
            $errLogs.data | ForEach-Object {
                Write-Host "  🔴 $($_.timestamp): $($_.message)" -ForegroundColor Red
            }
        } else {
            Write-Host "  ✅ Sin errores recientes" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ℹ️ No logs disponibles" -ForegroundColor Gray
    }
}

do {
    Show-DataDashboard
    if ($watch) {
        Write-Host "`n  Actualizando cada 5s... (Ctrl+C para salir)" -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
    }
} while ($watch)
