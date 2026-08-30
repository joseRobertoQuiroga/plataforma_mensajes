$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$expectedChannels = @("telegram", "messenger", "email", "tiktok", "whatsapp")
$actualStatus = "unknown"
$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    $resp = Invoke-RestMethod -Uri "$env:HELPER_URL/health" -TimeoutSec 10
    $channels = $resp.modules.channels
    if (-not $channels) {
        throw "health.modules.channels ausente"
    }
    $names = @($channels | ForEach-Object { $_.channel })
    $missing = @($expectedChannels | Where-Object { $_ -notin $names })
    if ($missing.Count -gt 0) {
        throw "Canales faltantes en health: $($missing -join ', ')"
    }
    $actualStatus = "channels_ok($($names.Count))"
    $exitCode = 0
} catch {
    $exitCode = 1
    $errorCode = "CHANNELS_UNAVAILABLE"
    $errorMessage = $_.Exception.Message
}

$finishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$duration = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds)

$result = @{
    schema = @{ name = "TEVS"; version = "1.0" }
    test = @{
        test_id = "TEST-CHN-001"
        test_name = "Multicanal Registry Health"
        test_version = "1.0.0"
        test_type = "health"
        category = "multichannel"
        severity = "high"
        tags = @("channels", "multicanal", "gate1")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "wibsite-helper"; version = "2.2.0" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $true }
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ channels = $expectedChannels }
        actual = @{ status = $actualStatus }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "availability"
        message = $errorMessage
        component = "helper/channels"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
