$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$exitCode = 1
$errorCode = $null
$errorMessage = $null

$collectorConfigPath = "c:\proyectos\plataforma_mensajes\wibsite\otel-collector\config.yaml"

try {
    if (-not (Test-Path $collectorConfigPath)) {
        throw "Collector config not found at $collectorConfigPath"
    }

    $configContent = Get-Content $collectorConfigPath -Raw
    
    # Simple regex parsing to check for resilience features
    $hasMemoryLimiter = $configContent -match "memory_limiter:"
    $hasRetry = $configContent -match "retry:"
    
    if ($hasMemoryLimiter -and $hasRetry) {
        $exitCode = 0
    } else {
        $exitCode = 1
        $errorCode = "MISSING_DR_CONFIG"
        $errorMessage = "OpenTelemetry Collector is missing memory_limiter or retry_on_failure configurations, risking data loss during ES outages."
    }

} catch {
    $exitCode = 1
    $errorCode = "CONFIG_READ_ERROR"
    $errorMessage = $_.Exception.Message
}

$finishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$duration = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds)

$result = @{
    schema = @{ name = "TEVS"; version = "1.0" }
    test = @{
        test_id = "TEST-DR-001"
        test_name = "Telemetry Collector Resilience Config"
        test_version = "1.0.0"
        test_type = "dr_config"
        category = "disaster_recovery"
        severity = "high"
        tags = @("dr", "otel", "resilience", "gate10")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "OTEL Collector"; version = "latest" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $true } 
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ has_retry_and_limits = $true }
        actual = @{ has_retry_and_limits = ($exitCode -eq 0) }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "architecture_risk"
        message = $errorMessage
        component = "OTEL"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
