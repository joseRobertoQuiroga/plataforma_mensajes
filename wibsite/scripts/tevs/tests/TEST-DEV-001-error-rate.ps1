$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$maxAllowedErrors = 10
$actualErrors = 0
$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
    $esHeaders = @{ 
        Authorization = "Basic $auth"
        "Content-Type" = "application/json"
    }
    
    # Query for any errors or exceptions in traces or logs in the last 30 minutes
    # Using traces-doags.otel-* for now, looking for error status
    $query = @{
        query = @{
            bool = @{
                must = @(
                    @{ range = @{ "@timestamp" = @{ gte = "now-30m"; lte = "now" } } }
                )
                should = @(
                    @{ match = @{ "status.code" = "STATUS_CODE_ERROR" } },
                    @{ match = @{ "log.level" = "error" } },
                    @{ match = @{ "log.level" = "fatal" } }
                )
                minimum_should_match = 1
            }
        }
    }
    
    $payload = $query | ConvertTo-Json -Depth 5 -Compress
    $esResponse = Invoke-RestMethod -Method Post -Uri "http://localhost:9200/traces-doags.otel-production-*,logs-doags.otel-production-*/_count" -Headers $esHeaders -Body $payload
    
    $actualErrors = $esResponse.count
    
    if ($actualErrors -le $maxAllowedErrors) {
        $exitCode = 0
    } else {
        $exitCode = 2  # Return 2 for WARNING (Deviation), doesn't necessarily fail the deployment but flags it
        $errorCode = "DEVIATION_ERROR_RATE"
        $errorMessage = "Error rate ($actualErrors) exceeded the allowed threshold ($maxAllowedErrors) in the last 30m."
    }
} catch {
    $exitCode = 1
    $errorCode = "QUERY_ERROR"
    $errorMessage = $_.Exception.Message
}

$finishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$duration = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds)

$result = @{
    schema = @{ name = "TEVS"; version = "1.0" }
    test = @{
        test_id = "TEST-DEV-001"
        test_name = "Error Rate Deviation Validation"
        test_version = "1.0.0"
        test_type = "monitoring"
        category = "deviation"
        severity = "medium"
        tags = @("errors", "anomaly", "gate6")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "Global Observability"; version = "1.0" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $false } # It's a deviation warning, not a hard block
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ max_errors = $maxAllowedErrors }
        actual = @{ errors = $actualErrors }
        result = if ($exitCode -eq 0) { "passed" } elseif ($exitCode -eq 2) { "warning" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "anomaly_detected"
        message = $errorMessage
        component = "Elasticsearch"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
