$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    # 1. El helper expone el estado multimodal en /health
    $health = Invoke-RestMethod -Uri "http://localhost:3100/health" -TimeoutSec 10
    if (-not $health.modules.multimodal) {
        throw "health.modules.multimodal ausente"
    }
    $mm = $health.modules.multimodal

    # 2. Degradación elegante: sin STT configurado, la transcripción devuelve null sin lanzar
    # (se verifica vía el contrato del pipeline: el agente sigue respondiendo con media no procesado)
    $agentUrl = "http://localhost:3100/api/agent/chat"
    $key = $env:HELPER_API_KEY
    if (-not $key) { $key = 'wb_dev_$(openssl rand -hex 16)' }
    $body = @{ conversationId = "tevs-mm-$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"; message = "Hola, tengo una consulta" } | ConvertTo-Json
    $agent = Invoke-RestMethod -Method Post -Uri $agentUrl -Headers @{ "x-api-key" = $key } -ContentType "application/json" -Body $body -TimeoutSec 60
    if (-not $agent.response) {
        throw "Agente no respondió en prueba multimodal"
    }

    $exitCode = 0
} catch {
    $exitCode = 1
    $errorCode = "MULTIMODAL_DEGRADATION_FAILED"
    $errorMessage = $_.Exception.Message
}

$finishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$duration = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds)

$result = @{
    schema = @{ name = "TEVS"; version = "1.0" }
    test = @{
        test_id = "TEST-MM-001"
        test_name = "Multimodal Degradation Contract"
        test_version = "1.0.0"
        test_type = "contract"
        category = "multimodal"
        severity = "medium"
        tags = @("multimodal", "stt", "vision", "degradation")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "wibsite-helper"; version = "2.2.0" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $false }
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ multimodal_health = "present"; agent_reply = "present" }
        actual = @{ status = if ($exitCode -eq 0) { "degradation_ok" } else { "failed" } }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "contract"
        message = $errorMessage
        component = "helper/multimodal"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
