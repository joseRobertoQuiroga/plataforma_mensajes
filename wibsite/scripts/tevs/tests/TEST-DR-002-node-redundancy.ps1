$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    # Check if Redis is healthy (Ping)
    $redisPing = docker exec wibsite-redis redis-cli ping
    
    # Check if Postgres is accepting connections (pg_isready)
    $pgReady = docker exec wibsite-postgres pg_isready -U wibsite -d dify
    
    if (($redisPing -match "PONG") -and ($pgReady -match "accepting connections")) {
        $exitCode = 0
    } else {
        $exitCode = 1
        $errorCode = "NODE_UNHEALTHY"
        $errorMessage = "Core redundant state nodes (Redis/Postgres) are failing health checks. Async queues might drop tasks."
    }

} catch {
    $exitCode = 1
    $errorCode = "HEALTH_CHECK_ERROR"
    $errorMessage = $_.Exception.Message
}

$finishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$duration = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds)

$result = @{
    schema = @{ name = "TEVS"; version = "1.0" }
    test = @{
        test_id = "TEST-DR-002"
        test_name = "State Nodes Redundancy (Redis/PG)"
        test_version = "1.0.0"
        test_type = "dr_health"
        category = "disaster_recovery"
        severity = "critical"
        tags = @("dr", "redis", "postgres", "gate10")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "Infrastructure"; version = "latest" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $true } 
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ nodes_healthy = $true }
        actual = @{ nodes_healthy = ($exitCode -eq 0) }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "architecture_risk"
        message = $errorMessage
        component = "Database"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
